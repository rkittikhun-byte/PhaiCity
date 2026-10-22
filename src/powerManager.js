/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import { BlockMap } from './blockMap.ts';
import { forEachCardinalDirection } from './direction.ts';
import { EventEmitter } from './eventEmitter.js';
import { Position } from './position.ts';
import { fuelShare, plantFuel, plantPower, plantSmokes, powerKindAt } from './powerPlants.ts';
import { NOT_ENOUGH_POWER } from './messages.ts';
import { Random } from './random.ts';
import { ANIMBIT, BURNBIT, CONDBIT, POWERBIT } from "./tileFlags.ts";
import { NUCLEAR, PLANT2, PLANT3, POWERPLANT } from "./tileValues.ts";
import { isPlantCentre, NUCLEAR_KIND } from "./plantBlocks.ts";
import { conductsPower } from "./roadTiles.ts";
import { byRoads, powerAlongRoads, scanState, usersOnMap } from "./sim/cityUtilities.ts";
import { centreSize } from "./sim/roadAccess.ts";
import { ZONEBIT } from "./tileFlags.ts";

// PhaiCity: the plants on the coal plant's tiles are of five kinds now, each with its own power (src/powerPlants.ts)
var NUCLEAR_POWER_STRENGTH = 2000;


var PowerManager = EventEmitter(function(map) {
  this._map = map;
  this._powerStack = [];
  this.powerGridMap = new BlockMap(this._map.width, this._map.height, 1);
  // PhaiCity: how much more or less power each plant gives in this province (src/provinceRules.ts)
  this.outputFactor = 1;
  // ... the province's resources, which run its kinds of plant, and its dry season, which slows its dams
  this.resources = {};
  this.drySeason = null;
  // ... and the share of the plants' power the city used at the last power scan, by which they burn fuel
  this.load = 1;
  // ... and the plants' power at that scan, in tiles, which a player reads to see how many more the city can light
  this.capacity = 0;
  // PhaiCity: on a real-scale city map the power runs along the road graph (docs/NO_GRID_PLAN.md 2.2,
  // src/sim/cityUtilities.ts): the plants the map scan found this cycle with their power, and the plots and the zones'
  // and buildings' centres it found, which take from it
  this._plants = [];
  this._users = {plots: [], zones: []};
});


// PhaiCity: whether the power runs along the road graph on this map rather than over the tiles
PowerManager.prototype.usesRoads = function() {
  return byRoads(this._map);
};


// PhaiCity: the map scan found a plot (src/plots.ts), or a zone's or building's centre, that takes power
PowerManager.prototype.plotUser = function(x, y) {
  this._users.plots.push(y * this._map.width + x);
};

PowerManager.prototype.zoneUser = function(x, y) {
  this._users.zones.push(y * this._map.width + x);
};


PowerManager.prototype.setTilePower = function(x, y) {
  var tile = this._map.getTile(x, y);
  var tileValue = tile.getValue();

  if (tileValue === NUCLEAR || tileValue === POWERPLANT || isPlantCentre(tileValue) ||
      this.powerGridMap.worldGet(x, y) > 0) {
    tile.addFlags(POWERBIT);
    return;
  }

  tile.removeFlags(POWERBIT);
};


PowerManager.prototype.clearPowerStack = function() {
  this._powerStackPointer = 0;
  this._powerStack = [];
  this._plants = [];
  this._users = {plots: [], zones: []};
};


// PhaiCity: power runs along the roads, as water does (owner, 15 Oct 2026: "ไฟฟ้าไม่ต้องปักเสาเลย มีถนน แล้วก็มีไฟเลย
// ได้ไหม แต่ต้องสร้างเครื่องกำเนิดไฟ"): every road tile carries it, from a plant beside a road to the zones beside it, and
// takes none of the plant's power on the way (a district's roads are thousands of tiles)
// (src/roadTiles.ts conductsPower: roads, level crossings and opening bridges)
var isRoadTile = conductsPower;


PowerManager.prototype.testForConductive = function(pos, testDir) {
  var movedPos = Position.move(pos, testDir);

  if (this._map.isPositionInBounds(movedPos)) {
    var tile = this._map.getTile(movedPos.x, movedPos.y);
    if (tile.isConductive() || isRoadTile(tile.getValue())) {
      if (this.powerGridMap.worldGet(movedPos.x, movedPos.y) === 0)
          return true;
    }
  }

  return false;
};


// Note: the algorithm is buggy: if you have two adjacent power
// plants, the second will be regarded as drawing power from the first
// rather than as a power source itself
PowerManager.prototype.doPowerScan = function(census) {
  if (this.usesRoads()) {
    this._roadPowerScan(census);
    return;
  }

  // Clear power this._map.
  this.powerGridMap.clear();

  // Power that the combined power plants of every kind and the nuclear plants can deliver.
  var maxPower = ((census.plantPower || 0) +
                  census.nuclearPowerPop * NUCLEAR_POWER_STRENGTH) * this.outputFactor;

  var powerConsumption = 0; // Amount of power used.
  this.capacity = maxPower;

  while (this._powerStack.length > 0) {
    var pos = this._powerStack.pop();
    var anyDir = undefined;
    var conNum;
    do {
      if (anyDir)
        pos = Position.move(pos, anyDir);

      // PhaiCity: a road carries the power without taking any
      if (!isRoadTile(this._map.getTileValue(pos.x, pos.y))) {
        powerConsumption++;
        if (powerConsumption > maxPower) {
          this.load = 1;
          this._emitEvent(NOT_ENOUGH_POWER);
          return;
        }
      }

      this.powerGridMap.worldSet(pos.x, pos.y, 1);
      conNum = 0;

      forEachCardinalDirection(dir => {
        if (conNum >= 2) {
          return;
        }

        if (this.testForConductive(pos, dir)) {
          conNum++;
          anyDir = dir;
        }
      });

      if (conNum > 1)
        this._powerStack.push(new Position(pos.x, pos.y));
    } while (conNum);
  }
  this.load = maxPower > 0 ? powerConsumption / maxPower : 0;
};


// PhaiCity: on a real-scale city map, the power along the roads (docs/NO_GRID_PLAN.md 2.2): each plant feeds the roads
// it meets, each plot takes its level's power and each building its tiles' worth, the nearest to a plant by road first;
// where it runs out the far ends go dark. Nothing flows from one plot or building to the next any more: what stands on
// no road has no power. The tiles served get their power bit at the next scan, as before (setTilePower).
PowerManager.prototype._roadPowerScan = function(census) {
  this._applyRoadPower(this._plants, this._users);
};


PowerManager.prototype._applyRoadPower = function(plants, users) {
  var factor = this.outputFactor;
  // (the plants' power, as the census counts it, those on no road among them)
  this.capacity = plants.reduce(function(sum, p) { return sum + p.amount; }, 0) * factor;
  var result = powerAlongRoads(this._map, plants.map(function(p) {
    return {centre: p.centre, size: p.size, amount: p.amount * factor};
  }), users);
  this.powerGridMap.clear();
  var width = this._map.width;
  for (var i = 0; i < result.powered.length; i++) {
    var tile = result.powered[i];
    this.powerGridMap.worldSet(tile % width, Math.floor(tile / width), 1);
  }
  // What the power layers draw along the roads (src/cityMap.ts, src/render3d/city/trafficLayer.ts); read only
  this._map.roadPower = scanState(this._map.roadPower,
                                  {roads: result.roads, state: result.state, supply: result.supply, used: result.used});
  // (as on the tiles: a city short of power burns its plants' whole fuel)
  this.load = result.short ? 1 : this.capacity > 0 ? result.used / this.capacity : 0;
  if (result.short)
    this._emitEvent(NOT_ENOUGH_POWER);
};


// PhaiCity: the power along the roads before a city's first map scan, from the plants and the buildings on its map now,
// so the scan finds the power where it was when the city was saved (the tiles' walk had none on the first scan)
PowerManager.prototype.primeRoads = function(month) {
  if (!this.usesRoads())
    return;
  var map = this._map, plants = [], sites = map.sites || null;
  for (var y = 0; y < map.height; y++) {
    for (var x = 0; x < map.width; x++) {
      var value = map.getTileValue(x, y), centre = y * map.width + x;
      if (value !== POWERPLANT && value !== NUCLEAR && value !== PLANT3 && value !== PLANT2)
        continue;
      if (sites !== null && sites[centre] !== undefined)
        continue;
      var nuclear = value === NUCLEAR || (map.powerKinds || {})[centre] === NUCLEAR_KIND;
      var power = nuclear ? NUCLEAR_POWER_STRENGTH :
                  plantPower(powerKindAt(map.powerKinds, centre), this.resources, month, this.drySeason);
      plants.push({centre: centre, size: centreSize(value), amount: power});
    }
  }
  this._applyRoadPower(plants, usersOnMap(map, ZONEBIT));
};


// PhaiCity: another source of power the map scan found, such as a waste power plant (src/waste.ts); the census
// counts its power
PowerManager.prototype.addSource = function(x, y, power) {
  this._powerStack.push(new Position(x, y));
  this._plants.push({centre: y * this._map.width + x, size: 3, amount: power || 0});
};


PowerManager.prototype.coalPowerFound = function(map, x, y, simData) {
  simData.census.coalPowerPop += 1;

  // PhaiCity: what kind of plant stands here, as built (src/powerPlants.ts): its power this month and its fuel
  var kind = powerKindAt(map.powerKinds, y * map.width + x);
  var month = Math.floor((simData.cityTime || 0) % 48) >> 2;
  var power = plantPower(kind, this.resources, month, this.drySeason);
  simData.census.plantPower += power;
  this._plants.push({centre: y * map.width + x, size: centreSize(map.getTileValue(x, y)), amount: power});
  // ... burning for the share of the power the city used (src/powerPlants.ts fuelShare)
  simData.census.plantFuel += plantFuel(kind, this.resources) * fuelShare(this.load);

  this._powerStack.push(new Position(x, y));

  // Only plants that burn fuel smoke (the 2D view's chimneys, which only the old 4x4 has)
  if (!plantSmokes(kind) || isPlantCentre(map.getTileValue(x, y)))
    return;

  // Ensure animation runs
  var dX = [-1, 2, 1, 2];
  var dY = [-1, -1, 0, 0];

  for (var i = 0; i < 4; i++)
    map.addTileFlags(x + dX[i], y + dY[i], ANIMBIT);
};


var dX = [1, 2, 1, 2];
var dY = [-1, -1, 0, 0];
var meltdownTable = [30000, 20000, 10000];

PowerManager.prototype.nuclearPowerFound = function(map, x, y, simData) {
  // TODO With the auto repair system, zone gets repaired before meltdown
  // In original Micropolis code, we bail and don't repair if melting down
  if (simData.disasterManager.disastersEnabled &&
      Random.getRandom(meltdownTable[simData.gameLevel]) === 0) {
    simData.disasterManager.doMeltdown(x, y);
    return;
  }

  simData.census.nuclearPowerPop += 1;
  this._powerStack.push(new Position(x, y));
  this._plants.push({centre: y * map.width + x, size: centreSize(map.getTileValue(x, y)), amount: NUCLEAR_POWER_STRENGTH});

  // Ensure animation bits set
  for (var i = 0; i < 4; i++)
    map.addTileFlags(x, y, ANIMBIT | CONDBIT | POWERBIT | BURNBIT);
};


// PhaiCity: a plant on only the tiles its model covers, a 3x3 or a 2x2 (src/plantBlocks.ts): its kind's power as on the
// old 4x4, and a nuclear plant's (its kind recorded as "nuclear") as the old nuclear plant's, meltdown and all
PowerManager.prototype.sizedPlantFound = function(map, x, y, simData) {
  if ((map.powerKinds || {})[y * map.width + x] === NUCLEAR_KIND)
    this.nuclearPowerFound(map, x, y, simData);
  else
    this.coalPowerFound(map, x, y, simData);
};


PowerManager.prototype.registerHandlers = function(mapScanner, repairManager) {
  mapScanner.addAction(POWERPLANT, this.coalPowerFound.bind(this));
  mapScanner.addAction(NUCLEAR, this.nuclearPowerFound.bind(this));
  mapScanner.addAction(PLANT3, this.sizedPlantFound.bind(this));
  mapScanner.addAction(PLANT2, this.sizedPlantFound.bind(this));
  repairManager.addAction(POWERPLANT, 7, 4);
  repairManager.addAction(NUCLEAR, 7, 4);
  repairManager.addAction(PLANT3, 7, 3);
  repairManager.addAction(PLANT2, 7, 2);
};


export { PowerManager };
