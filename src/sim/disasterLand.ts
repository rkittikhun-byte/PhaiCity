/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Disasters by the land and the wind, and roads that wear rather than break (docs/NO_GRID_PLAN.md 4.4), on a real-scale
// city map:
// - a fire catches the eight tiles round it, the four beside it as before and the corners less, and the wind blows it on:
//   downwind more, upwind less (fireChance), so a fire runs with the monsoon instead of spreading in a diamond;
// - a flood runs onto land no higher than the water's own a little (FLOOD_RISE_M), so it fills the low land along the
//   river and stops at a rise, not a diamond of tiles whatever the ground (floodsOnto);
// - a road the city does not pay to keep wears along its whole length, 0 new to 1 worn out, and slows its traffic, rather
//   than breaking into 16 m holes of rubble one tile at a time (roadWearMonth, WORN_SPEED); paid for again, it is mended.
//
// Plain code, + - x / and the city's Random only. No DOM.

import type { RoadGraph } from "../roads/roadGraph";
import { gradedTileHeight, type GradedHeightsMap } from "../terrain/groundGrade";

/** The eight tiles round a tile: the four beside it, then the corners */
export const ROUND: ReadonlyArray<readonly [number, number]> = [[-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [1, 1], [-1, 1]];

/** A fire's chance a scan to catch a tile beside it (micropolisJS's one in eight), at a corner a half of that */
export const FIRE_SIDE = 1 / 8;
export const FIRE_CORNER = 1 / 16;
/** How much more (downwind) or less (upwind) a gale makes it: 1 +- this */
export const FIRE_WIND = 0.8;

/** The chance, 0-1, that a fire catches the tile (dx, dy) from it (one of ROUND) in the wind (x, y towards, strength) */
export function fireChance(dx: number, dy: number, wind: { x: number; y: number; strength: number } | null | undefined): number {
  const corner = dx !== 0 && dy !== 0, base = corner ? FIRE_CORNER : FIRE_SIDE;
  if (!wind || !(wind.strength > 0)) return base;
  // the way to the tile against the way the wind blows: 1 straight downwind, -1 straight upwind (a corner's way is
  // 1/sqrt 2 along each, 0.7071 to four places)
  const along = corner ? (dx * wind.x + dy * wind.y) * 0.7071 : dx * wind.x + dy * wind.y;
  return base * (1 + FIRE_WIND * wind.strength * along);
}

/** How much higher than the water's own a flood may run onto land (metres) */
export const FLOOD_RISE_M = 0.5;

/** Whether a flood at tile `from` runs onto tile `to`, by the ground's heights (metres a tile; any where none are known) */
export function floodsOnto(heights: ArrayLike<number> | null | undefined, from: number, to: number): boolean {
  if (!heights) return true;
  return heights[to] - heights[from] <= FLOOD_RISE_M;
}

/** The same on a map, by its ground as levelled under what stands on it (src/terrain/groundGrade.ts): a yard levelled to
 * its road floods as its road does */
export function floodsOntoMap(map: GradedHeightsMap, from: number, to: number): boolean {
  if (!map.heights || map.heights.length !== map.width * map.height) return true;
  return gradedTileHeight(map, to) - gradedTileHeight(map, from) <= FLOOD_RISE_M;
}

/** How fast a road wears a month the city pays nothing for its upkeep (a share of its life), and is mended a month it
 * pays in full */
export const WEAR_MONTH = 0.04;
export const MEND_MONTH = 0.1;
/** A worn-out road's traffic goes at this share of its speed */
export const WORN_SPEED = 0.5;

/**
 * A month of the roads' wear: each of the city's own segments (not the state's) wears by WEAR_MONTH times the share of
 * its upkeep unpaid (0 paid in full, 1 nothing), or is mended by MEND_MONTH a month it is paid in full. paid: the share
 * of the roads' upkeep paid, 0-1. Wear is kept by segment id (gameMap.roadWear), only where some is left.
 */
export function roadWearMonth(graph: RoadGraph | null | undefined, wear: Map<number, number>, paid: number): void {
  if (!graph) return;
  const short = Math.max(0, Math.min(1, 1 - paid));
  for (const id of [...wear.keys()]) if (!graph.segments.has(id)) wear.delete(id);
  for (const [id, segment] of graph.segments) {
    if (segment.national) continue;
    const before = wear.get(id) ?? 0;
    const after = short > 0 ? Math.min(1, before + WEAR_MONTH * short) : Math.max(0, before - MEND_MONTH);
    if (after > 0) wear.set(id, Math.round(after * 1000) / 1000); else wear.delete(id);
  }
}

/** A road's speed as worn: its speed at WORN_SPEED of it when worn out */
export const wornSpeed = (speed: number, wear: number): number => speed * (1 - (1 - WORN_SPEED) * Math.max(0, Math.min(1, wear)));

/** The wear as a save keeps it: [segment id, wear] pairs */
export function writeRoadWear(wear: Map<number, number> | null | undefined): number[] | undefined {
  if (!wear || !wear.size) return undefined;
  const out: number[] = [];
  for (const [id, w] of [...wear].sort((a, b) => a[0] - b[0])) out.push(id, w);
  return out;
}

export function readRoadWear(saved: unknown): Map<number, number> {
  const out = new Map<number, number>();
  if (!Array.isArray(saved)) return out;
  for (let i = 0; i + 1 < saved.length; i += 2) {
    const id = saved[i], w = saved[i + 1];
    if (Number.isInteger(id) && typeof w === "number" && w > 0 && w <= 1) out.set(id, w);
  }
  return out;
}
