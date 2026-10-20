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

import { forEachCardinalDirection } from './direction.ts';
import { MiscUtils } from './miscUtils.js';
import { Position } from './position.ts';
import { Random } from './random.ts';
import { SPRITE_HELICOPTER } from './spriteConstants.ts';
import { SpriteUtils } from './spriteUtils.js';
import { TileUtils } from './tileUtils.js';
import { DIRT, POWERBASE, ROADBASE } from "./tileValues.ts";
import { isRoadTile, roadLevelAt, roadSpec, servesZones } from './roadLevels.ts';

function Traffic(map, spriteManager) {
  this._map = map;
  this._stack = [];
  this._spriteManager = spriteManager;
  // PhaiCity: public transport (src/transit.ts), which the simulation sets: a share of the trips from where it reaches
  // ride instead of drive, and where a train or metro reaches, a trip with no way by road still gets there
  this.transit = null;
  // ... and the month's weather (src/weather.ts), which the simulation sets: in rain, a storm or fog the traffic goes
  // slower, so each trip crowds the roads a little more
  this.weatherLoad = 1;
}


Traffic.prototype.makeTraffic = function(x, y, blockMaps, destFn) {
  this._stack = [];

  var pos = new Position(x, y);

  if (this.findPerimeterRoad(pos)) {
    return this.driveFrom(pos, x, y, blockMaps, destFn);
  } else {
    return Traffic.NO_ROAD_FOUND;
  }
};


// PhaiCity: a trip from a painted plot (src/plots.ts), which has found its own road at (roadX, roadY)
Traffic.prototype.makeTrafficFrom = function(roadX, roadY, x, y, blockMaps, destFn) {
  this._stack = [];
  return this.driveFrom(new Position(roadX, roadY), x, y, blockMaps, destFn);
};


// A trip from the road at pos for the zone or plot at (x, y)
Traffic.prototype.driveFrom = function(pos, x, y, blockMaps, destFn) {
  if (this.tryDrive(pos, destFn)) {
    this.addToTrafficDensityMap(blockMaps, this.transit ? 1 - this.transit.ridersAt(x, y) : 1);
    return Traffic.ROUTE_FOUND;
  }

  if (this.transit && this.transit.railAt(x, y))
    return Traffic.ROUTE_FOUND;

  return Traffic.NO_ROUTE_FOUND;
};


// share: of the trip's people who drive (PhaiCity, the rest ride public transport)
Traffic.prototype.addToTrafficDensityMap = function(blockMaps, share) {
  var driving = share === undefined ? 1 : share;
  var trafficDensityMap = blockMaps.trafficDensityMap;

  while (this._stack.length > 0) {
    var pos = this._stack.pop();

    // Could this happen?!?
    if (!this._map.testBounds(pos.x, pos.y))
      continue;

    var tileValue = this._map.getTileValue(pos.x, pos.y);

    if (tileValue >= ROADBASE && tileValue < POWERBASE) {
      // Update traffic density.
      var traffic = trafficDensityMap.worldGet(pos.x, pos.y);
      // PhaiCity: a wider road fills more slowly (src/roadLevels.ts)
      traffic += Math.round(50 * roadSpec(roadLevelAt(this._map, pos.x, pos.y)).load * driving * this.weatherLoad);
      traffic = Math.min(traffic, 240);
      trafficDensityMap.worldSet(pos.x, pos.y, traffic);

      // Attract traffic copter to the traffic
      if (traffic >= 240 && Random.getRandom(5) === 0) {
        var sprite = this._spriteManager.getSprite(SPRITE_HELICOPTER);
        if (sprite !== null) {
          sprite.destX = SpriteUtils.worldToPix(pos.x);
          sprite.destY = SpriteUtils.worldToPix(pos.y);
        }
      }
    }
  }
};


var perimX = [-1, 0, 1, 2, 2, 2, 1, 0,-1,-2,-2,-2];
var perimY = [-2,-2,-2,-1, 0, 1, 2, 2, 2, 1, 0,-1];

Traffic.prototype.findPerimeterRoad = function(pos) {
  for (var i = 0; i < 12; i++) {
    var xx = pos.x + perimX[i];
    var yy = pos.y + perimY[i];

    if (this._map.testBounds(xx, yy)) {
      // PhaiCity: motorways and tollways have no driveways for the zones beside them (src/roadLevels.ts)
      var value = this._map.getTileValue(xx, yy);
      if (TileUtils.isDriveable(value) && (!isRoadTile(value) || servesZones(roadLevelAt(this._map, xx, yy)))) {
        pos.x = xx;
        pos.y = yy;
        return true;
      }
    }
  }

  return false;
};


var MAX_TRAFFIC_DISTANCE = 30;

Traffic.prototype.tryDrive = function(startPos, destFn) {
  var dirLast;
  // PhaiCity: a position is made from its x and y; the port passed a whole position, and moved an undefined one, so
  // no car ever left its zone and the roads never carried traffic
  var drivePos = new Position(startPos.x, startPos.y);

  /* Maximum distance to try */
  for (var dist = 0; dist < MAX_TRAFFIC_DISTANCE; dist++) {
    var  dir = this.tryGo(drivePos, dirLast);
    if (dir) {
      drivePos = Position.move(drivePos, dir);
      dirLast = dir.oppositeDirection();

      if (dist & 1)
        this._stack.push(new Position(drivePos.x, drivePos.y));

      if (this.driveDone(drivePos, destFn))
        return true;
    } else {
      if (this._stack.length > 0) {
        this._stack.pop();
        dist += 3;
      } else {
        return false;
      }
    }
  }

  return false;
};


Traffic.prototype.tryGo = function(pos, dirLast) {
  var directions = [];

  // Find connections from current position.
  var count = 0;

  forEachCardinalDirection(dir => {
    if (dir != dirLast && TileUtils.isDriveable(this._map.getTileFromMapOrDefault(pos, dir, DIRT))) {
      directions.push(dir);
      count++;
    }
  });

  if (count === 0) {
    return;
  }

  if (count === 1) {
    return directions[0];
  }

  const index = Random.getRandom(directions.length - 1);
  return directions[index];
};


Traffic.prototype.driveDone = function(pos, destFn) {
  if (pos.y > 0) {
    if (destFn(this._map.getTileValue(pos.x, pos.y - 1)))
      return true;
  }

  if (pos.x < (this._map.width - 1)) {
    if (destFn(this._map.getTileValue(pos.x + 1, pos.y)))
      return true;
  }

  if (pos.y < (this._map.height - 1)) {
    if (destFn(this._map.getTileValue(pos.x, pos.y + 1)))
      return true;
  }

  if (pos.x > 0) {
    if (destFn(this._map.getTileValue(pos.x - 1, pos.y)))
      return true;
  }

  return false;
};


Object.defineProperties(Traffic,
  {ROUTE_FOUND: MiscUtils.makeConstantDescriptor(1),
   NO_ROUTE_FOUND: MiscUtils.makeConstantDescriptor(0),
   NO_ROAD_FOUND: MiscUtils.makeConstantDescriptor(-1)});


export { Traffic };
