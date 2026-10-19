/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals (คลอง, docs/CANALS.md, owner 19 Oct 2026): the player digs them with a line tool, as roads and railways are
// drawn. A canal is plain water on the map (RIVER), so everything water does it does at once: land value, dams and
// fishing harbours beside it, bridges, boats, and the groundwater round it (src/groundwater.ts). Unlike a natural
// river it can be filled in again with the bulldozer. The map remembers which tiles were dug (gameMap.canals, saved as
// canals) so the views can tell a canal from a river; a mark counts only while its tile is still water or a bridge
// over it, so undo and the bulldozer need not clear it. Plain code: no DOM.

import { BIT_MASK } from "./tileFlags";
import {
  BRWH, BRWV, HBRDG0, HBRDG3, HBRIDGE, HRAIL, VBRDG0, VBRDG3, VBRIDGE, VRAIL, WATER_HIGH, WATER_LOW,
} from "./tileValues";

export const CANAL_TOOL = "canal";
/** The levels a canal grows through while it stands (docs/CANALS.md "Five levels"): 1 a new ditch … 5 a canal of boats
 * and gardens. The canals layer keeps each tile's level, 0 where none was dug. */
export const CANAL_LEVELS = 5;
/** Every this many months each canal tile below the level its canal has earned rises one */
export const CANAL_RISE_MONTHS = 3;
/** What a canal needs for its higher levels: the city's people and the land value along its banks */
export const CANAL_NEEDS: ReadonlyArray<{ level: number; people: number; landValue: number }> = [
  { level: 3, people: 2000, landValue: 30 },
  { level: 4, people: 10000, landValue: 60 },
  { level: 5, people: 50000, landValue: 100 },
];
/** What each level adds to the land value nearby, in full within CANAL_NEAR tiles and at half out to CANAL_FAR */
export const CANAL_LAND_VALUE = [0, 0, 4, 8, 14, 22];
export const CANAL_NEAR = 2;
export const CANAL_FAR = 4;
/** A canal tile's price before the province's factor: digging costs more than a road, so lining every street with
 * water for its land value does not pay */
export const CANAL_PRICE = 40;
/** ... a road it crosses becomes a bridge, which costs five of the road's tiles, as the road tool's do */
export const CANAL_ROAD_BRIDGE = 50;
/** ... and a railway's bridge, as the rail tool's */
export const CANAL_RAIL_BRIDGE = 100;

interface CanalMap {
  width: number;
  height: number;
  canals?: Uint8Array | null;
  testBounds(x: number, y: number): boolean;
  getTileValue(x: number, y: number): number;
}

export const isWaterTile = (value: number): boolean => value >= WATER_LOW && value <= WATER_HIGH;

/** A road or railway bridge, which stands over water (src/bulldozerTool.js turns each back into water) */
export function isBridgeTile(value: number): boolean {
  return value === HBRIDGE || value === VBRIDGE || value === BRWH || value === BRWV || value === HRAIL ||
    value === VRAIL || value >= HBRDG0 && value <= HBRDG3 || value >= VBRDG0 && value <= VBRDG3;
}

/** A fresh layer: no canals */
export function newCanals(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

/** Whether a tile is a dug canal's water (not a bridge over it) */
export function isCanalAt(map: CanalMap, x: number, y: number): boolean {
  if (!map.canals || !map.testBounds(x, y) || !map.canals[y * map.width + x]) return false;
  return isWaterTile(map.getTileValue(x, y) & BIT_MASK);
}

/** Whether a tile was dug as a canal and still is, its water or a bridge over it */
export function canalMarkStands(map: CanalMap, x: number, y: number): boolean {
  if (!map.canals || !map.testBounds(x, y) || !map.canals[y * map.width + x]) return false;
  const value = map.getTileValue(x, y) & BIT_MASK;
  return isWaterTile(value) || isBridgeTile(value);
}

/** The layer as a save keeps it: the levels of the marks that still stand, or null when there are none */
export function canalsKept(map: CanalMap): Uint8Array | null {
  const layer = map.canals;
  if (!layer) return null;
  const kept = new Uint8Array(layer.length);
  let any = false;
  for (let i = 0; i < layer.length; i++) {
    if (layer[i] && canalMarkStands(map, i % map.width, Math.floor(i / map.width))) {
      kept[i] = layer[i];
      any = true;
    }
  }
  return any ? kept : null;
}

/** The level a canal has earned: 2 once it stands, more in a bigger town with dearer land along it */
export function canalTarget(people: number, landValue: number): number {
  let level = 2;
  for (const need of CANAL_NEEDS) if (people >= need.people && landValue >= need.landValue) level = need.level;
  return level;
}

/** A canal's tiles (its water and bridges joined to each other) that still stand, from the tile at start */
function canalOf(map: CanalMap, start: number, seen: Uint8Array): number[] {
  const { width, height } = map, tiles = [start];
  seen[start] = 1;
  for (let q = 0; q < tiles.length; q++) {
    const i = tiles[q], x = i % width, y = (i - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * width + nx;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[j] || !canalMarkStands(map, nx, ny)) continue;
      seen[j] = 1;
      tiles.push(j);
    }
  }
  return tiles;
}

/**
 * A month of the canals growing: each canal earns its level from the city's people and the average land value along
 * it (landValueAt, the highest within CANAL_NEAR tiles of each of its tiles; 0 where nothing is built), and every
 * CANAL_RISE_MONTHS months its tiles below that level rise one. Returns whether any tile rose.
 */
export function growCanals(map: CanalMap, month: number, people: number, landValueAt: (x: number, y: number) => number): boolean {
  const layer = map.canals;
  if (!layer || month % CANAL_RISE_MONTHS !== 0) return false;
  const { width } = map, seen = new Uint8Array(layer.length);
  let rose = false;
  for (let start = 0; start < layer.length; start++) {
    if (!layer[start] || seen[start] || !canalMarkStands(map, start % width, Math.floor(start / width))) continue;
    const tiles = canalOf(map, start, seen);
    let sum = 0, counted = 0;
    for (const i of tiles) {
      const x = i % width, y = (i - x) / width;
      let best = 0;
      for (let dy = -CANAL_NEAR; dy <= CANAL_NEAR; dy++) for (let dx = -CANAL_NEAR; dx <= CANAL_NEAR; dx++) {
        if (map.testBounds(x + dx, y + dy)) best = Math.max(best, landValueAt(x + dx, y + dy));
      }
      if (best > 0) { sum += best; counted++; }
    }
    const target = canalTarget(people, counted ? sum / counted : 0);
    for (const i of tiles) {
      if (layer[i] && layer[i] < target) { layer[i]++; rose = true; }
    }
  }
  return rose;
}

/** What the canals add to each tile's land value (CANAL_LAND_VALUE by the highest level near it), or null for none */
export function canalLandValues(map: CanalMap): Uint8Array | null {
  const layer = map.canals;
  if (!layer) return null;
  const { width, height } = map, out = new Uint8Array(layer.length);
  let any = false;
  for (let i = 0; i < layer.length; i++) {
    const level = layer[i];
    if (!level || !CANAL_LAND_VALUE[level]) continue;
    const x = i % width, y = (i - x) / width;
    if (!isCanalAt(map, x, y)) continue;
    any = true;
    const full = CANAL_LAND_VALUE[level], half = Math.round(full / 2);
    for (let dy = -CANAL_FAR; dy <= CANAL_FAR; dy++) for (let dx = -CANAL_FAR; dx <= CANAL_FAR; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const near = Math.max(Math.abs(dx), Math.abs(dy)) <= CANAL_NEAR ? full : half, j = ny * width + nx;
      if (near > out[j]) out[j] = near;
    }
  }
  return any ? out : null;
}
