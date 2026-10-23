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

import { ConnectingTool } from './connectingTool.js';
import { ANIMBIT, BNCNBIT, ZONEBIT } from "./tileFlags.ts";
import { DIRT } from "./tileValues.ts";
import { TileUtils } from './tileUtils.js';
import { familyValue } from './buildings/turnedFootprint.ts';

var BuildingTool = ConnectingTool(function(cost, centreTile, map, size, animated) {
  this.init(cost, map, false);
  this.centreTile = centreTile;
  this.size = size;
  this.animated = animated;
});


BuildingTool.prototype.putBuilding = function(leftX, topY) {
  var posX, posY, tileValue, tileFlags;
  var baseTile = this.centreTile - this.size - 1;

  for (var dy = 0; dy < this.size; dy++) {
    posY = topY + dy;

    for (var dx = 0; dx < this.size; dx++) {
      posX = leftX + dx;
      tileValue = baseTile;
      tileFlags = BNCNBIT;

      if (dx === 1) {
        if (dy === 1)
          tileFlags |= ZONEBIT;
        else if (dy === 2 && this.animated)
          tileFlags |= ANIMBIT;
      }

      this._worldEffects.setTile(posX, posY, tileValue, tileFlags);

      baseTile++;
    }
  }
};


// PhaiCity: whether a tile is paint with nothing grown on it yet, which gives way to a building (src/paintUnder.ts,
// put on the map by src/core/cityLayers.ts so the tools need not import the plots)
var mapEmptyPaintAt = function(map, x, y, value) {
  return !!(map && map.emptyPaintAt && map.emptyPaintAt(x, y, value));
};


BuildingTool.prototype.prepareBuildingSite = function(leftX, topY) {
  // Check that the entire site is on the map
  if (leftX < 0 || leftX + this.size > this._map.width)
    return this.TOOLRESULT_FAILED;

  if (topY < 0 || topY + this.size > this._map.height)
    return this.TOOLRESULT_FAILED;

  var posX, posY, tileValue;

  // Check whether the tiles are clear
  for (var dy = 0; dy < this.size; dy++) {
    posY = topY + dy;

    for (var dx = 0; dx < this.size; dx++) {
      posX = leftX + dx;

      tileValue = this._worldEffects.getTileValue(posX, posY);

      if (tileValue === DIRT)
        continue;

      if (!this.autoBulldoze) {
        // No TileValues.DIRT and no bull-dozer => not buildable
        return this.TOOLRESULT_NEEDS_BULLDOZE;
      }

      // PhaiCity: paint with nothing grown on it yet gives way too, free (src/paintUnder.ts)
      var paint = mapEmptyPaintAt(this._map, posX, posY, tileValue);
      if (!paint && !TileUtils.canBulldoze(tileValue)) {
        // tilevalue cannot be auto-bulldozed
        return this.TOOLRESULT_NEEDS_BULLDOZE;
      }

      this._worldEffects.setTile(posX, posY, DIRT);
      if (!paint)
        this.addBulldozeCost(tileValue);
    }
  }

  return this.TOOLRESULT_OK;
};


BuildingTool.prototype.buildBuilding = function(x, y) {
  // PhaiCity: a building put down turned to a slanted road lays the tiles of its turned outline, offsets from its centre
  // (src/buildings/turnedFootprint.ts), not its square block
  if (this.footprint)
    return this.buildTurned(x, y, this.footprint);

  // Correct to top left
  x--;
  y--;

  var prepareResult = this.prepareBuildingSite(x, y);
  if (prepareResult !== this.TOOLRESULT_OK)
    return prepareResult;

  this.addCost(this.toolCost);

  this.putBuilding(x, y);

  this.checkBorder(x, y);

  return this.TOOLRESULT_OK;
};


// PhaiCity: the turned tiles' site cleared as the square's is, then its centre laid with the zone bit and every other
// tile in its family as the square's tile beside it (familyValue)
BuildingTool.prototype.buildTurned = function(x, y, offsets) {
  var i, tx, ty, tileValue;
  for (i = 0; i < offsets.length; i++) {
    tx = x + offsets[i][0];
    ty = y + offsets[i][1];
    if (!this._map.testBounds(tx, ty))
      return this.TOOLRESULT_FAILED;
    tileValue = this._worldEffects.getTileValue(tx, ty);
    if (tileValue === DIRT)
      continue;
    if (!this.autoBulldoze || !(TileUtils.canBulldoze(tileValue) || mapEmptyPaintAt(this._map, tx, ty, tileValue)))
      return this.TOOLRESULT_NEEDS_BULLDOZE;
  }
  for (i = 0; i < offsets.length; i++) {
    tx = x + offsets[i][0];
    ty = y + offsets[i][1];
    tileValue = this._worldEffects.getTileValue(tx, ty);
    if (tileValue !== DIRT) {
      var paint = mapEmptyPaintAt(this._map, tx, ty, tileValue);
      this._worldEffects.setTile(tx, ty, DIRT);
      if (!paint)
        this.addBulldozeCost(tileValue);
    }
  }
  this.addCost(this.toolCost);
  for (i = 0; i < offsets.length; i++) {
    var dx = offsets[i][0], dy = offsets[i][1];
    var centre = dx === 0 && dy === 0;
    this._worldEffects.setTile(x + dx, y + dy, centre ? this.centreTile : familyValue(this.centreTile, this.size, dx, dy),
                               centre ? BNCNBIT | ZONEBIT : BNCNBIT);
  }
  return this.TOOLRESULT_OK;
};


BuildingTool.prototype.doTool = function(x, y, blockMaps) {
  this.result = this.buildBuilding(x, y);
};


export { BuildingTool };
