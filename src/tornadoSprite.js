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

import { BaseSprite } from './baseSprite.js';
import { SPRITE_DYING, SPRITE_MOVED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { Random } from './random.ts';
import * as SpriteConstants from './spriteConstants.ts';
import { SpriteUtils } from './spriteUtils.js';
import { isCityTileSize } from './units.ts';

function TornadoSprite(map, spriteManager, x, y) {
  this.init(SpriteConstants.SPRITE_TORNADO, map, spriteManager, x, y);
  this.width = 48;
  this.height = 48;
  this.xOffset = -24;
  this.yOffset = -40;
  this.frame = 1;
  this.count = 200;
}


BaseSprite(TornadoSprite);


var xDelta = [2, 3, 2, 0, -2, -3];
var yDelta = [-2, 0, 2, 3, 2, 0];

// PhaiCity: on a real-scale city map (16 m tiles, docs/NO_GRID_PLAN.md 4.4) a storm is a band, not one tile: it keeps
// to a way across the map, swinging a little, and wrecks the tiles round its path, those near its middle most often, so
// its track is a ragged swathe some 80 m wide; micropolisJS's storm jittered on the spot and took the tile under it alone,
// a 16 m line on such a map. Sixteen ways, each a step of about 3 pixels (a 16th of a tile a pixel), as the old one moved.
var STORM_WAYS = [[3, 0], [3, 1], [2, 2], [1, 3], [0, 3], [-1, 3], [-2, 2], [-3, 1],
                  [-3, 0], [-3, -1], [-2, -2], [-1, -3], [0, -3], [1, -3], [2, -2], [3, -1]];
// How far round its middle a storm wrecks tiles (tiles squared: two 16 m tiles, about 32 m), and the chance in 256 each move
// for a tile there, falling from STORM_NEAR at its middle by STORM_FALL a tile squared
var STORM_REACH2 = 4, STORM_NEAR = 24, STORM_FALL = 5;

TornadoSprite.prototype.moveAsBand = function(blockMaps) {
  var frame = this.frame;
  if (frame === 2) {
    frame = this.flag ? 3 : 1;
  } else {
    this.flag = frame === 1 ? 1 : 0;
    frame = 2;
  }
  if (this.count > 0)
    this.count--;
  this.frame = frame;

  var spriteList = this.spriteManager.getSpriteList();
  for (var i = 0; i < spriteList.length; i++) {
    var s = spriteList[i];
    if (s.frame !== 0 &&
        (s.type === SpriteConstants.SPRITE_AIRPLANE || s.type === SpriteConstants.SPRITE_HELICOPTER ||
         s.type === SpriteConstants.SPRITE_SHIP || s.type === SpriteConstants.SPRITE_TRAIN) &&
      SpriteUtils.checkSpriteCollision(this, s)) {
      s.explodeSprite();
    }
  }

  // Its way, chosen when it first moves, swinging a sixteenth now and then
  if (this.way === undefined)
    this.way = Random.getRandom(15);
  var swing = Random.getRandom(15);
  if (swing === 0)
    this.way = (this.way + 15) % 16;
  else if (swing === 1)
    this.way = (this.way + 1) % 16;
  this.x += STORM_WAYS[this.way][0];
  this.y += STORM_WAYS[this.way][1];

  if (this.spriteNotInBounds())
    this.frame = 0;
  if (this.count !== 0 && Random.getRandom(500) === 0)
    this.frame = 0;
  if (this.frame === 0)
    this._emitEvent(SPRITE_DYING);

  // The tile under it, as before, and those round it by their chance, in rows
  SpriteUtils.destroyMapTile(this.spriteManager, this.map, blockMaps, this.x, this.y);
  var cx = SpriteUtils.pixToWorld(this.x), cy = SpriteUtils.pixToWorld(this.y);
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      var d2 = dx * dx + dy * dy;
      if (d2 === 0 || d2 > STORM_REACH2)
        continue;
      if (Random.getRandom(255) < STORM_NEAR - STORM_FALL * d2)
        SpriteUtils.destroyMapTile(this.spriteManager, this.map, blockMaps,
                                   SpriteUtils.worldToPix(cx + dx) + 8, SpriteUtils.worldToPix(cy + dy) + 8);
    }
  }
  this._emitEvent(SPRITE_MOVED, {x: this.worldX, y: this.worldY});
};


TornadoSprite.prototype.move = function(spriteCycle, disasterManager, blockMaps) {
  if (isCityTileSize(this.map.tileSizeM)) {
    this.moveAsBand(blockMaps);
    return;
  }
  var frame = this.frame;

  // If middle frame, move right or left
  // depending on the flag value
  // If frame = 1, perhaps die based on flag
  // value
  if (frame === 2) {
    if (this.flag)
      frame = 3;
    else
      frame = 1;
  } else {
    if (frame === 1)
      this.flag = 1;
    else
      this.flag = 0;

    frame = 2;
  }

  if (this.count > 0)
    this.count--;

  this.frame = frame;

  var spriteList = this.spriteManager.getSpriteList();
  for (var i = 0; i < spriteList.length; i++) {
    var s = spriteList[i];

    // Explode vulnerable sprites
    if (s.frame !== 0 &&
        (s.type === SpriteConstants.SPRITE_AIRPLANE || s.type === SpriteConstants.SPRITE_HELICOPTER ||
         s.type === SpriteConstants.SPRITE_SHIP || s.type === SpriteConstants.SPRITE_TRAIN) &&
      SpriteUtils.checkSpriteCollision(this, s)) {
      s.explodeSprite();
    }
  }

  frame = Random.getRandom(5);
  this.x += xDelta[frame];
  this.y += yDelta[frame];

  if (this.spriteNotInBounds())
    this.frame = 0;

  if (this.count !== 0 && Random.getRandom(500) === 0)
    this.frame = 0;

  if (this.frame === 0)
    this._emitEvent(SPRITE_DYING);

  SpriteUtils.destroyMapTile(this.spriteManager, this.map, blockMaps, this.x, this.y);
  this._emitEvent(SPRITE_MOVED, {x: this.worldX, y: this.worldY});
};


// Metadata for image loading
Object.defineProperties(TornadoSprite,
  {ID: MiscUtils.makeConstantDescriptor(6),
   width: MiscUtils.makeConstantDescriptor(48),
   frames: MiscUtils.makeConstantDescriptor(3)});


export { TornadoSprite };
