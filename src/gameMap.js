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

import { Bounds } from "./bounds.ts";
import * as Direction from './direction.ts';
import { MiscUtils } from './miscUtils.js';
import { Position } from './position.ts';
import { MapTile, Tile } from './tile.ts';
import { ALLBITS, BIT_MASK, BNCNBIT, ZONEBIT } from "./tileFlags.ts";
import { TILE_INVALID } from "./tileValues.ts";

function GameMap(width, height, defaultValue) {
  if (!(this instanceof GameMap))
    return new GameMap(width, height, defaultValue);

  if (arguments.length > 1 && typeof(width) === 'number' &&
      (width < 1 || height < 1))
    throw new Error('GameMap constructor called with invalid width or height ' + width + ' ' + height);

  // Argument shuffling
  if (arguments.length === 0) {
    width = 120;
    height = 100;
    defaultValue = new Tile().getValue();
  } else if (arguments.length === 1) {
    if (typeof(width) === 'number') {
      // Default value
      defaultValue = width;
    } else {
      // Tile
      defaultValue = width.getValue();
    }
    width = 120;
    height = 100;
  } else if (arguments.length === 2) {
    defaultValue = new Tile().getValue();
  } else if (arguments.length === 3) {
    if (typeof(defaultValue) === 'object')
      defaultValue = defaultValue.getValue();
  }


  this.width = width;
  this.height = height;
  this.bounds = Bounds.fromOrigin(width, height);

  // PhaiCity: each tile's value and flags, 16 bits a tile, not an object a tile (docs/NO_GRID_PLAN.md 5.4): a real-scale
  // city of 480 x 480 tiles kept 230,400 objects, and a whole district would keep millions. A tile asked for is a
  // MapTile that reads and writes its cell (src/tile.ts).
  this._cells = new Uint16Array(width * height).fill(new Tile(defaultValue).getRawValue());

  // Generally set externally
  this.cityCentreX = Math.floor(this.width / 2);
  this.cityCentreY = Math.floor(this.height / 2);
  this.pollutionMaxX = this.cityCentreX;
  this.pollutionMaxY = this.cityCentreY;
}


var saveProps = ['cityCentreX', 'cityCentreY', 'pollutionMaxX', 'pollutionMaxY', 'width', 'height'];

GameMap.prototype.save = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    saveData[saveProps[i]] = this[saveProps[i]];

  saveData.map = Array.from(this._cells, function(raw) {
    return {value: raw};
  });
};


GameMap.prototype.load = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    this[saveProps[i]] = saveData[saveProps[i]];

  var map = saveData.map;
  for (i = 0, l = map.length; i < l; i++)
    this.setTileValue(i % this.width, Math.floor(i / this.width), map[i].value);
};


// PhaiCity: the roads and railways a whole-province map starts with are the state's (docs/geo/GEO_SPEC.md
// section 10, owner 12 Oct 2026): the city does not pay for them and they never wear out. nationalTransport holds
// the map's own transport codes, one per tile (0 none), or is null on other maps.
GameMap.prototype.isNationalTransport = function(x, y) {
  var national = this.nationalTransport;
  return !!national && national[x + y * this.width] !== 0;
};


GameMap.prototype._calculateIndex = function(x, y) {
  return x + y * this.width;
};


GameMap.prototype.isPositionInBounds = function(pos) {
  return this.bounds.contains(pos);
}


GameMap.prototype.testBounds = function(x, y) {
  // PhaiCity: no Position made for the test (docs/NO_GRID_PLAN.md 5.1)
  return this.bounds.containsXY(x, y);
};


GameMap.prototype.getTile = function(x, y, newTile) {
  // Argument-shuffling
  if (typeof(x) === 'object') {
    y = x.y;
    x = x.x;
  }

  var width = this.width;
  var height = this.height;

  if (x < 0 || y < 0 || x >= width || y >= height) {
    console.warn('getTile called with bad bounds', x, y);
    return new Tile(TILE_INVALID);
  }

  var tileIndex = x + y * width;

  // Return the original tile if we're not given a tile to fill
  if (!newTile)
    return new MapTile(this._cells, tileIndex);

  // PhaiCity: ... else copy it into the tile given, and give that back (the map's scan does so for every tile each
  // pass: no tile is made for it, docs/NO_GRID_PLAN.md 5.4)
  newTile.setRaw(this._cells[tileIndex]);
  return newTile;
};


// PhaiCity: a tile's value and flags written straight into its cell, counted as Tile counts a change (setTo)
GameMap.prototype._write = function(tileIndex, raw) {
  if (this._cells[tileIndex] === raw)
    return;
  this._cells[tileIndex] = raw;
  Tile.changes++;
};


// How many times any tile has changed (src/tile.ts Tile.changes): whatever keeps a copy of the map, such as the 3D
// view, skips going over every tile while this stays the same
GameMap.prototype.changeCount = function() {
  return Tile.changes;
};


// PhaiCity: the cells themselves (a tile's value and flags in 16 bits, value & BIT_MASK), for a reader going over every
// tile that never writes them: a call a tile through getTileValue was most of such a pass (docs/NO_GRID_PLAN.md 5.4)
GameMap.prototype.rawCells = function() {
  return this._cells;
};


// The value and flags of the tile at an index together, for readers going over the whole map
GameMap.prototype.rawTileAt = function(index) {
  return this._cells[index];
};


GameMap.prototype.getTileValue = function(x, y) {
  if (arguments.length < 1)
    throw new Error('GameMap getTileValue called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (typeof(x) === 'object') {
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap getTileValue called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  return this._cells[tileIndex] & BIT_MASK;
};


GameMap.prototype.getTileFlags = function(x, y) {
  if (arguments.length < 1)
    throw new Error('GameMap getTileFlags called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (typeof(x) === 'object') {
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap getTileFlags called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  return this._cells[tileIndex] & ALLBITS;
};


GameMap.prototype.getTiles = function(x, y, w, h) {
  if (arguments.length < 3)
    throw new Error('GameMap getTiles called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 3) {
    h = w;
    w = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap getTiles called with invalid bounds ' + x + ', ' + y);

  var res = [];
  for (var a = y, ylim = y + h; a < ylim; a++) {
    res[a - y] = [];
    for (var b = x, xlim = x + w; b < xlim; b++) {
      var tileIndex = this._calculateIndex(b, a);
      res[a-y].push(new MapTile(this._cells, tileIndex));
    }
  }
  return res;
};


GameMap.prototype.getTileValuesForPainting = function(x, y, w, h, result) {
  result = result || [];

  if (arguments.length < 3)
    throw new Error('GameMap getTileValuesForPainting called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 3) {
    h = w;
    w = y;
    y = x.y;
    x = x.x;
  }

  var width = this.width;
  var height = this.height;

  // Result is stored in row-major order
  for (var a = y, ylim = y + h; a < ylim; a++) {
    for (var b = x, xlim = x + w; b < xlim; b++) {
      if (a < 0 || b < 0 || a >= height || b >= width) {
        result[(a - y) * w + (b - x)] = TILE_INVALID;
        continue;
      }

      var tileIndex =  b + a * width;
      result[(a - y) * w + (b - x)] = this._cells[tileIndex];
    }
  }

  return result;
};


GameMap.prototype.getTileFromMapOrDefault = function(pos, dir, defaultTile) {
  switch (dir) {
    case Direction.NORTH:
      if (pos.y > 0)
        return this.getTileValue(pos.x, pos.y - 1);
      return defaultTile;

    case Direction.EAST:
      if (pos.x < this.width - 1)
        return this.getTileValue(pos.x + 1, pos.y);

      return defaultTile;

    case Direction.SOUTH:
      if (pos.y < this.height - 1)
        return this.getTileValue(pos.x, pos.y + 1);

      return defaultTile;

    case Direction.WEST:
      if (pos.x > 0)
        return this.getTileValue(pos.x - 1, pos.y);

      return defaultTile;

    default:
        return defaultTile;
  }
};


GameMap.prototype.setTile = function(x, y, value, flags) {
  if (arguments.length < 3)
    throw new Error('GameMap setTile called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 3) {
    flags = value;
    value = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap setTile called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  new MapTile(this._cells, tileIndex).set(value, flags);
};


GameMap.prototype.setTo = function(x, y, tile) {
  if (arguments.length < 2)
    throw new Error('GameMap setTo called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (tile === undefined) {
    tile = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap setTo called with invalid bounds ' + x + ', ' + y);

  // PhaiCity: the tile's value and flags are copied into the cell (the tile itself was kept, so a later change to it
  // changed the map; no caller changes a tile after putting it down)
  var tileIndex = this._calculateIndex(x, y);
  this._write(tileIndex, tile.getRawValue());
};


GameMap.prototype.setTileValue = function(x, y, value) {
  if (arguments.length < 2)
    throw new Error('GameMap setTileValue called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 2) {
    value = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap setTileValue called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  new MapTile(this._cells, tileIndex).setValue(value);
};


GameMap.prototype.setTileFlags = function(x, y, flags) {
  if (arguments.length < 2)
    throw new Error('GameMap setTileFlags called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 2) {
    flags = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap setTileFlags called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  new MapTile(this._cells, tileIndex).setFlags(flags);
};


GameMap.prototype.addTileFlags = function(x, y, flags) {
  if (arguments.length < 2)
    throw new Error('GameMap addTileFlags called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 2) {
    flags = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap addTileFlags called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  new MapTile(this._cells, tileIndex).addFlags(flags);
};


GameMap.prototype.removeTileFlags = function(x, y, flags) {
  if (arguments.length < 2)
    throw new Error('GameMap removeTileFlags called with too few arguments' + [].toString.apply(arguments));

  // Argument-shuffling
  if (arguments.length === 2) {
    flags = y;
    y = x.y;
    x = x.x;
  }

  if (!this.testBounds(x, y))
    throw new Error('GameMap removeTileFlags called with invalid bounds ' + x + ', ' + y);

  var tileIndex = this._calculateIndex(x, y);
  new MapTile(this._cells, tileIndex).removeFlags(flags);
};


GameMap.prototype.putZone = function(centreX, centreY, centreTile, size) {
  var x, y;

  if (!this.testBounds(centreX, centreY) || !this.testBounds(centreX - 1 + size - 1, centreY - 1 + size - 1))
    throw new Error('GameMap putZone called with invalid bounds ' + x + ', ' + y);

  var tile = centreTile - 1 - size;
  var startX = centreX - 1;
  var startY = centreY - 1;

  for (y = startY; y < startY + size; y++) {
    for (x = startX; x < startX + size; x++) {
      if (x === centreX && y === centreY)
        this.setTo(x, y, new Tile(tile, BNCNBIT | ZONEBIT));
      else
        this.setTo(x, y, new Tile(tile, BNCNBIT));
      tile += 1;
    }
  }
};


export { GameMap };
