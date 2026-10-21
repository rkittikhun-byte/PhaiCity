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
import { NUCLEAR, POWERPLANT } from "./tileValues.ts";
import { conductsPower } from "./roadTiles.ts";

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
});


PowerManager.prototype.setTilePower = function(x, y) {
  var tile = this._map.getTile(x, y);
  var tileValue = tile.getValue();

  if (tileValue === NUCLEAR || tileValue === POWERPLANT ||
      this.powerGridMap.worldGet(x, y) > 0) {
    tile.addFlags(POWERBIT);
    return;
  }

  tile.removeFlags(POWERBIT);
};


PowerManager.prototype.clearPowerStack = function() {
  this._powerStackPointer = 0;
  this._powerStack = [];
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


// PhaiCity: another source of power the map scan found, such as a waste power plant (src/waste.ts); the census
// counts its power
PowerManager.prototype.addSource = function(x, y) {
  this._powerStack.push(new Position(x, y));
};


PowerManager.prototype.coalPowerFound = function(map, x, y, simData) {
  simData.census.coalPowerPop += 1;

  // PhaiCity: what kind of plant stands here, as built (src/powerPlants.ts): its power this month and its fuel
  var kind = powerKindAt(map.powerKinds, y * map.width + x);
  var month = Math.floor((simData.cityTime || 0) % 48) >> 2;
  simData.census.plantPower += plantPower(kind, this.resources, month, this.drySeason);
  // ... burning for the share of the power the city used (src/powerPlants.ts fuelShare)
  simData.census.plantFuel += plantFuel(kind, this.resources) * fuelShare(this.load);

  this._powerStack.push(new Position(x, y));

  // Only plants that burn fuel smoke
  if (!plantSmokes(kind))
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

  // Ensure animation bits set
  for (var i = 0; i < 4; i++)
    map.addTileFlags(x, y, ANIMBIT | CONDBIT | POWERBIT | BURNBIT);
};


PowerManager.prototype.registerHandlers = function(mapScanner, repairManager) {
  mapScanner.addAction(POWERPLANT, this.coalPowerFound.bind(this));
  mapScanner.addAction(NUCLEAR, this.nuclearPowerFound.bind(this));
  repairManager.addAction(POWERPLANT, 7, 4);
  repairManager.addAction(NUCLEAR, 7, 4);
};


export { PowerManager };
