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

import { plotFound } from "./plots.ts";
import { Tile } from "./tile.ts";
import { FLOOD, PORTBASE, RESBASE } from "./tileValues.ts";

// Tile to be filled to avoid creating lots of GC-able objects
var tile = new Tile();


function MapScanner(map) {
  this._map = map;
  this._actions = [];
}


var isCallable = function(f) {
  return typeof(f) === 'function';
};


MapScanner.prototype.addAction = function(criterion, action) {
  this._actions.push({criterion: criterion, action: action});
};


MapScanner.prototype.mapScan = function(startX, maxX, simData) {
  // PhaiCity: on a map with painted zones, each home, shop and factory tile is a plot that grows by itself
  // (src/plots.ts); a tile of an old 3x3 zone goes on as before
  var painted = this._map.paintedZones === true;
  // PhaiCity: a building still being built gives and takes nothing until it is done: no service, power, places or
  // upkeep (src/construction.ts)
  var sites = this._map.sites || null;
  var width = this._map.width;
  // PhaiCity: on a real-scale city map the power runs along the roads (docs/NO_GRID_PLAN.md 2.2): the scan tells the
  // power manager which plots and buildings take from it
  var power = simData.powerManager;
  var roads = power && typeof power.usesRoads === 'function' && power.usesRoads();

  for (var y = 0; y < this._map.height; y++) {
    for (var x = startX; x < maxX; x++) {
      this._map.getTile(x, y, tile);
      var tileValue = tile.getValue();

      if (tileValue < FLOOD)
        continue;

      if (painted && tileValue >= RESBASE && tileValue < PORTBASE && !tile.isZone()) {
        if (tile.isConductive())
          simData.powerManager.setTilePower(x, y);
        if (plotFound(this._map, x, y, simData)) {
          if (roads)
            power.plotUser(x, y);
          continue;
        }
      }

      if (tile.isConductive()) {
        simData.powerManager.setTilePower(x, y);
        // Count the power just set, not the copy taken before it: a new power plant would otherwise count as
        // an unpowered zone once and could raise a false "brownouts" warning
        this._map.getTile(x, y, tile);
      }

      if (sites !== null && tile.isZone() && sites[y * width + x] !== undefined)
        continue;

      if (tile.isZone()) {
        if (roads)
          power.zoneUser(x, y);
        simData.repairManager.checkTile(x, y, simData.cityTime);
        var powered = tile.isPowered();
        if (powered)
          simData.census.poweredZoneCount += 1;
        else
          simData.census.unpoweredZoneCount += 1;
      }

      for (var i = 0, l = this._actions.length; i < l; i++) {
        var current = this._actions[i];
        var callable = isCallable(current.criterion);

        if (callable && current.criterion.call(null, tile)) {
          current.action.call(null, this._map, x, y, simData);
          break;
        } else if (!callable && current.criterion === tileValue) {
          current.action.call(null, this._map, x, y, simData);
          break;
        }
      }
    }
  }
};


export { MapScanner };
