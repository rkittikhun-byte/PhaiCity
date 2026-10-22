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

import { BURNBIT, CONDBIT } from "./tileFlags.ts";
import { DIRT, LASTRAIL, RUBBLE, ROADBASE } from "./tileValues.ts";
import { familyValue, inFamily, laidOutline, outlineTiles } from "./buildings/turnedFootprint.ts";

function RepairManager(map) {
  this._map = map;
  this._actions = [];
}


var isCallable = function(f) {
  return typeof(f) === 'function';
};


RepairManager.prototype.addAction = function(criterion, period, zoneSize) {
  this._actions.push({criterion: criterion, period: period, zoneSize: zoneSize});
};


RepairManager.prototype.repairZone = function(x, y, zoneSize) {
  var centre = this._map.getTileValue(x, y);
  // PhaiCity: a building turned to a slanted road mends the tiles of its turned outline that are bare or its own, never
  // one a road or anything else took (src/buildings/turnedFootprint.ts)
  var placed = this._map.buildings && this._map.buildings.atTile(y * this._map.width + x);
  var outline = placed ? laidOutline(this._map, placed) : null;
  if (outline) {
    outlineTiles(outline, this._map.width, this._map.height, this._map.tileSizeM || 16).forEach(function(i) {
      var tx = i % this._map.width, ty = Math.floor(i / this._map.width), tile = this._map.getTile(tx, ty);
      if (tile.isZone() || tile.isAnimated())
        return;
      var value = tile.getValue();
      if (value === DIRT || inFamily(value, centre, zoneSize))
        this._map.setTile(tx, ty, familyValue(centre, zoneSize, tx - x, ty - y), CONDBIT | BURNBIT);
    }, this);
    return;
  }
  var tileValue = centre - zoneSize - 2;

  for (var yy = -1; yy < zoneSize - 1; yy++) {
    for (var xx = -1; xx < zoneSize - 1; xx++) {
      tileValue++;

      var current = this._map.getTile(x + xx, y + yy);
      if (current.isZone() || current.isAnimated())
        continue;

      var currentValue = current.getValue();
      // PhaiCity: never over a road, railway or power line on its block: a building put down against a slanted road
      // whose laid tiles are its square block but a corner the road kept (src/buildings/turnedFootprint.ts laidOutline)
      // took that corner back when it was first mended, and the road was cut (22 Oct 2026: a health post finished
      // beside the village's power plant cut its one road to the town, and the town went dark)
      if (currentValue >= ROADBASE && currentValue <= LASTRAIL)
        continue;
      if (currentValue < RUBBLE || currentValue >= ROADBASE)
        this._map.setTile(x + xx, y + yy, tileValue, CONDBIT | BURNBIT);
    }
  }
};


RepairManager.prototype.checkTile = function(x, y, cityTime) {
  for (var i = 0, l = this._actions.length; i < l; i++) {
    var current = this._actions[i];
    var period = current.period;

    if ((cityTime & period) !== 0)
      continue;

    var tile = this._map.getTile(x, y);
    var tileValue = tile.getValue();

    var callable = isCallable(current.criterion);
    if (callable && current.criterion.call(null, tile))
      this.repairZone(x, y, current.zoneSize);
    else if (!callable && current.criterion === tileValue)
      this.repairZone(x, y, current.zoneSize);
  }
};


export { RepairManager };
