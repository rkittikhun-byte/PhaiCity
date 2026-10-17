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
import { BULLBIT, BURNBIT, CONDBIT } from "./tileFlags.ts";
import { TileUtils } from './tileUtils.js';
import * as TileValues from "./tileValues.ts";

import { ZoneUtils } from './zoneUtils.js';

// PhaiCity: cost and level for the road levels (src/roadLevels.ts); the old road is laterite at ฿10 a tile
var RoadTool = ConnectingTool(function(map, cost, level) {
  this.init(cost || 10, map, true, true);
  this.roadLevel = level || 1;
});


// State road projects (เวนคืนที่ดินเพื่อสร้างถนน) can cut through houses, shops, factories, parks, and other buildings
// (except the ruler's house). Multi-tile 3×3/4×4/6×6 zones have their footprint cleared; 1×1 painted plots clear their tile.
RoadTool.prototype.clearRightOfWay = function(x, y) {
  this.doAutoBulldoze(x, y);
  var tileObj = this._worldEffects.getTile(x, y);
  var v = tileObj.getValue();
  if (v === TileValues.DIRT || (v >= TileValues.RIVER && v <= TileValues.LASTRIVEDGE) ||
      (v >= TileValues.HBRIDGE && v <= TileValues.LASTROAD) ||
      (v >= TileValues.HPOWER && v <= TileValues.LASTRAIL))
    return;

  // Find if (x, y) is part of a multi-tile zone (3×3, 4×4, or 6×6) by checking the centre tile or nearby centre tiles
  var cx = -1, cy = -1, zSize = 0;
  if (tileObj.isZone()) {
    zSize = ZoneUtils.checkZoneSize(v);
    if (!zSize) zSize = ZoneUtils.checkBigZone(v).zoneSize;
    if (zSize > 0) { cx = x; cy = y; }
  }
  if (zSize === 0) {
    var big = ZoneUtils.checkBigZone(v);
    if (big.zoneSize > 0) {
      cx = x + big.deltaX;
      cy = y + big.deltaY;
      zSize = big.zoneSize;
    } else {
      for (var dy = -4; dy <= 1 && zSize === 0; dy++) {
        for (var dx = -4; dx <= 1 && zSize === 0; dx++) {
          var nx = x + dx, ny = y + dy;
          if (!this._map.testBounds(nx, ny)) continue;
          var nt = this._worldEffects.getTile(nx, ny);
          if (!nt.isZone()) continue;
          var nv = nt.getValue();
          var s = ZoneUtils.checkZoneSize(nv) || ZoneUtils.checkBigZone(nv).zoneSize;
          if (s >= 3 && x >= nx - 1 && x < nx - 1 + s && y >= ny - 1 && y < ny - 1 + s) {
            cx = nx; cy = ny; zSize = s;
          }
        }
      }
    }
  }

  if (zSize > 0) {
    // Protect the ruler's house (ที่ว่าการอำเภอ / จวนเจ้าเมือง) from accidental demolition
    var rh = this._map.rulerHouse;
    if (rh && rh.x === cx && rh.y === cy)
      return;
    for (var yy = cy - 1; yy < cy - 1 + zSize; yy++) {
      for (var xx = cx - 1; xx < cx - 1 + zSize; xx++) {
        if (this._map.testBounds(xx, yy))
          this._worldEffects.setTile(xx, yy, TileValues.DIRT);
      }
    }
    this.addBulldozeCost(v, this.bulldozerCost);
    return;
  }

  // Single-tile houses, painted plots (RESBASE..LASTZONE), parks, bus stops, water towers, rubble, etc.
  if (v >= TileValues.RESBASE || (v >= TileValues.WOODS2 && v <= TileValues.LASTFLOOD)) {
    this.addBulldozeCost(v, 1);
    this._worldEffects.setTile(x, y, TileValues.DIRT);
  }
};


RoadTool.prototype.layRoad = function(x, y) {
  this.clearRightOfWay(x, y);
  var tile = this._worldEffects.getTileValue(x, y);
  var cost = this.toolCost;

  switch (tile) {
    case TileValues.DIRT:
      this._worldEffects.setTile(x, y, TileValues.ROADS, BULLBIT | BURNBIT);
      break;

    case TileValues.RIVER:
    case TileValues.REDGE:
    case TileValues.CHANNEL:
      // A bridge costs five tiles of its road (PhaiCity: of its level)
      cost = 5 * this.toolCost;

      if (x < this._map.width - 1) {
        tile = this._worldEffects.getTileValue(x + 1, y);
        tile = TileUtils.normalizeRoad(tile);

        if (tile === TileValues.VRAILROAD || tile === TileValues.HBRIDGE ||
            (tile >= TileValues.ROADS && tile <= TileValues.HROADPOWER)) {
          this._worldEffects.setTile(x, y, TileValues.HBRIDGE, BULLBIT);
          break;
        }
      }

      if (x > 0) {
        tile = this._worldEffects.getTileValue(x - 1, y);
        tile = TileUtils.normalizeRoad(tile);

        if (tile === TileValues.VRAILROAD || tile === TileValues.HBRIDGE ||
            (tile >= TileValues.ROADS && tile <= TileValues.INTERSECTION)) {
          this._worldEffects.setTile(x, y, TileValues.HBRIDGE, BULLBIT);
          break;
        }
      }

      if (y < this._map.height - 1) {
        tile = this._worldEffects.getTileValue(x, y + 1);
        tile = TileUtils.normalizeRoad(tile);

        if (tile === TileValues.HRAILROAD || tile === TileValues.VROADPOWER ||
            (tile >= TileValues.VBRIDGE && tile <= TileValues.INTERSECTION)) {
          this._worldEffects.setTile(x, y, TileValues.VBRIDGE, BULLBIT);
          break;
        }
      }

      if (y > 0) {
        tile = this._worldEffects.getTileValue(x, y - 1);
        tile = TileUtils.normalizeRoad(tile);

        if (tile === TileValues.HRAILROAD || tile === TileValues.VROADPOWER ||
            (tile >= TileValues.VBRIDGE && tile <= TileValues.INTERSECTION)) {
          this._worldEffects.setTile(x, y, TileValues.VBRIDGE, BULLBIT);
          break;
        }
      }

      return this.TOOLRESULT_FAILED;

    case TileValues.LHPOWER:
      this._worldEffects.setTile(x, y, TileValues.VROADPOWER, CONDBIT | BURNBIT | BULLBIT);
      break;

    case TileValues.LVPOWER:
      this._worldEffects.setTile(x, y, TileValues.HROADPOWER, CONDBIT | BURNBIT | BULLBIT);
      break;

    case TileValues.LHRAIL:
      this._worldEffects.setTile(x, y, TileValues.HRAILROAD, BURNBIT | BULLBIT);
      break;

    case TileValues.LVRAIL:
      this._worldEffects.setTile(x, y, TileValues.VRAILROAD, BURNBIT | BULLBIT);
      break;

    default:
      return this.TOOLRESULT_FAILED;
  }

  this.addCost(cost);
  this.checkZoneConnections(x, y);
  return this.TOOLRESULT_OK;
};


RoadTool.prototype.doTool = function(x, y, blockMaps) {
  this.result = this.layRoad(x, y);
};


export { RoadTool };
