/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Groundwater (น้ำใต้ดิน, docs/WATER_PLAN.md). Each tile's land holds a natural level of water, 0 (none) to 7 (open
// water), worked out from the land: plenty near rivers, lakes and the sea, less with distance, and less with height
// above the nearest water when the map knows its heights (a whole-province map, GEO_SPEC section 5). Each tile also
// has a store, what is in the ground now: full to begin with, drawn down around a water works that pumps, filled
// again by the rains toward the land's natural level, and never in a dry month. Ground near water fills fast; far
// from it, slowly, so a works pumped hard there runs its ground low (owner, 13 Oct 2026: used for long, it runs out).
// Only the stores are saved with a city: the natural levels come from its land again. No DOM, jQuery or window:
// the simulation reads it (CLAUDE.md, "Online plan" rule 3), and nothing random.

import { WATER_HIGH, WATER_LOW } from "./tileValues";
import { isCityTileSize } from "./units";

export const GROUNDWATER_MAX = 7;
/** Every dry tile's land holds at least this much: a well gives a little anywhere */
export const GROUNDWATER_MIN = 1;
/** A store holds this much per level, so a tile's store is 0 to GROUNDWATER_FULL */
export const UNITS_PER_LEVEL = 32;
export const GROUNDWATER_FULL = GROUNDWATER_MAX * UNITS_PER_LEVEL;
/** Tiles from the nearest water over which the natural level falls to its least */
const FALLOFF_TILES = 12;
/**
 * ... on a map at real scale, metres instead (owner, 15 Oct 2026: "แก้เมืองหยุดโต"): 12 tiles of a province map are some
 * 7 km, but 12 of a city map's 16 m tiles only 192 m, which left every water works in a town on nearly dry ground, a
 * seventh of a full works' water, and the town's buildings without
 */
const FALLOFF_M = 2000;
/** Metres above the nearest water that cost one level */
const METRES_PER_LEVEL = 15;
/** A month of rain gives back level² / RECHARGE_DIVISOR of what a store lacks (a seventh near water, far less inland) */
const RECHARGE_DIVISOR = 384;
/** Tiles round a water works that it draws from, beyond its own */
export const DRAW_RADIUS = 4;

interface Terrain {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;
  /** Metres a tile, on a map that knows it */
  readonly tileSizeM?: number | null;
}

/** Tiles from the nearest water over which the natural level falls to its least, on this map */
export function falloffTiles(map: Pick<Terrain, "tileSizeM">): number {
  const metres = map.tileSizeM;
  return metres && isCityTileSize(metres) ? Math.round(FALLOFF_M / metres) : FALLOFF_TILES;
}

const isWater = (value: number): boolean => value >= WATER_LOW && value <= WATER_HIGH;

/**
 * Each tile's natural level, row by row. heights (metres per tile, optional) lowers it on ground that stands above
 * the water nearest to it. Open water has GROUNDWATER_MAX and nothing else does.
 */
export function computeGroundwater(map: Terrain, heights: ArrayLike<number> | null = null): Uint8Array {
  const { width, height } = map;
  const falloff = falloffTiles(map);
  const count = width * height;
  const distance = new Int16Array(count).fill(-1);
  // The height of the water each tile is nearest to
  const waterLevel = new Float32Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!isWater(map.getTileValue(x, y))) continue;
      distance[i] = 0;
      waterLevel[i] = heights ? Math.max(0, heights[i]) : 0;
      queue[tail++] = i;
    }
  }
  // Out from the water, one tile at a time, as far as the falloff
  while (head < tail) {
    const i = queue[head++];
    if (distance[i] >= falloff) continue;
    const x = i % width;
    const y = (i - x) / width;
    const next = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
    for (const j of next) {
      if (j < 0 || distance[j] !== -1) continue;
      distance[j] = distance[i] + 1;
      waterLevel[j] = waterLevel[i];
      queue[tail++] = j;
    }
  }

  const levels = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (distance[i] === 0) {
      levels[i] = GROUNDWATER_MAX;
      continue;
    }
    if (distance[i] < 0) {
      levels[i] = GROUNDWATER_MIN;
      continue;
    }
    let level = GROUNDWATER_MAX * (1 - distance[i] / falloff);
    if (heights) level -= Math.max(0, heights[i] - waterLevel[i]) / METRES_PER_LEVEL;
    // Land never reaches the level of open water
    levels[i] = Math.max(GROUNDWATER_MIN, Math.min(GROUNDWATER_MAX - 1, Math.round(level)));
  }
  return levels;
}

/** The stores of untouched land: every tile as full as its land holds. */
export function fullStores(natural: Uint8Array): Uint8Array {
  return natural.map((level) => level * UNITS_PER_LEVEL);
}

/** A month of rain: every store below its land's natural level fills part of the way back, faster by factor (the
 * ruler's green zoning, src/policies.ts). */
export function rechargeGroundwater(stores: Uint8Array, natural: Uint8Array, factor = 1): void {
  for (let i = 0; i < stores.length; i++) {
    const level = natural[i];
    const target = level * UNITS_PER_LEVEL;
    if (stores[i] >= target) continue;
    stores[i] = Math.min(target, stores[i] + Math.ceil((target - stores[i]) * level * level * factor / RECHARGE_DIVISOR));
  }
}

/**
 * A water works centred on (x, y) draws amount from the ground: that much under its centre, less further out, as far
 * as DRAW_RADIUS. Open water is a river or a lake, not a store, and is never drawn down.
 */
export function drawGroundwater(stores: Uint8Array, natural: Uint8Array, width: number, height: number,
    x: number, y: number, amount: number): void {
  for (let dy = -DRAW_RADIUS; dy <= DRAW_RADIUS; dy++) {
    for (let dx = -DRAW_RADIUS; dx <= DRAW_RADIUS; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const tx = x + dx;
      const ty = y + dy;
      if (distance > DRAW_RADIUS || tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      const i = ty * width + tx;
      if (natural[i] >= GROUNDWATER_MAX) continue;
      const taken = Math.round(amount * (DRAW_RADIUS + 1 - distance) / (DRAW_RADIUS + 1));
      stores[i] = Math.max(0, stores[i] - taken);
    }
  }
}

/**
 * How much of its full output a water works gets from the ground, 0–1: the mean store under its footprint (size ×
 * size, centred on (x, y) as the game's buildings are) over the fullest a store can be.
 */
export function pumpFactor(stores: Uint8Array, width: number, height: number, x: number, y: number,
    size: number): number {
  const offset = size > 2 ? 1 : 0;
  let sum = 0;
  let count = 0;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const tx = x - offset + dx;
      const ty = y - offset + dy;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      sum += stores[ty * width + tx];
      count++;
    }
  }
  return count ? sum / count / GROUNDWATER_FULL : 0;
}
