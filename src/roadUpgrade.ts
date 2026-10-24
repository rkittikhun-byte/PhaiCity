/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Raising a stretch of road from its card (owner, 24 Oct 2026: "วิธีการอัพคือคลิกถนน แล้วมี rect คลิก upgrade ถนนจะอัพให้เลย").
// The road card names the stretch it describes (src/inspect.ts `road`); this works out what raising it one level, or a
// few, costs and keeps in upkeep, and does it through the upgrade tool's own command, tile by tile, so the price, the
// map's levels, the saves and the log are the tool's. No DOM, nothing random.

import { MAX_ROAD_LEVEL, roadCapacity, roadLevelAt, roadSpec, upgradeCost } from "./roadLevels.js";

/** The stretch of road a card describes: its tiles (map indices) in order, and how long it is */
export interface RoadStretch {
  tiles: number[];
  lengthM: number;
}

/** What a stretch is raised to, and what it takes */
export interface UpgradeOffer {
  /** The level it would be (2–8) */
  level: number;
  /** Baht, for the whole stretch, with the province's and the planning office's prices */
  price: number;
  /** Baht a year more to keep it, as the budget's units count (a tile of asphalt 1 …) */
  upkeep: number;
  /** How many cars an hour it takes at that level */
  capacity: number;
}

interface LevelMap {
  readonly width: number;
  readonly height: number;
  roadLevels?: Uint8Array | null;
}

/** The level most of a stretch's tiles are at (the level the card names) */
export function stretchLevel(map: LevelMap, tiles: readonly number[]): number {
  const counts = new Array(MAX_ROAD_LEVEL + 1).fill(0);
  for (const i of tiles) counts[roadLevelAt(map, i % map.width, Math.floor(i / map.width))]++;
  let best = 1;
  for (let level = 1; level <= MAX_ROAD_LEVEL; level++) if (counts[level] >= counts[best]) best = level;
  return best;
}

/** What raising every tile below `to` up to `to` costs, one step at a time as the tool charges it, each tile's step
 * rounded as the tool rounds it (`factor`: the tool's price factor) */
export function stretchPrice(map: LevelMap, tiles: readonly number[], to: number, factor: number): number {
  let total = 0;
  for (const i of tiles) {
    for (let level = roadLevelAt(map, i % map.width, Math.floor(i / map.width)); level < to; level++) {
      total += Math.round(upgradeCost(level) * factor);
    }
  }
  return total;
}

/** The yearly upkeep (budget units) raising the stretch to `to` adds: its length in tiles times the levels' difference */
export function stretchUpkeepRise(map: LevelMap, tiles: readonly number[], to: number, lengthM: number, tileSizeM: number): number {
  let sum = 0, count = 0;
  for (const i of tiles) {
    const level = roadLevelAt(map, i % map.width, Math.floor(i / map.width));
    if (level < to) sum += roadSpec(to).upkeep - roadSpec(level).upkeep;
    count++;
  }
  return count ? Math.round(lengthM / tileSizeM * sum / count) : 0;
}

/** The choices a card offers for a stretch at `level`: the next level, and the one two above it when there is one
 * (never past the top) */
export function upgradeOffers(map: LevelMap, road: RoadStretch, tileSizeM: number, factor: number): UpgradeOffer[] {
  const level = stretchLevel(map, road.tiles), offers: UpgradeOffer[] = [];
  for (const to of [level + 1, level + 2]) {
    if (to > MAX_ROAD_LEVEL) break;
    offers.push({ level: to, price: stretchPrice(map, road.tiles, to, factor),
      upkeep: stretchUpkeepRise(map, road.tiles, to, road.lengthM, tileSizeM), capacity: roadCapacity(to) });
  }
  return offers;
}

/** Raises a stretch to `to` through `apply` (one upgrade command at a tile; true when it took), a pass for each step so
 * a tile never goes past it. Returns how many tile-steps were taken. */
export function raiseStretch(map: LevelMap, road: RoadStretch, to: number, apply: (x: number, y: number) => boolean): number {
  let taken = 0;
  for (let pass = 0; pass < MAX_ROAD_LEVEL; pass++) {
    let any = false;
    for (const i of road.tiles) {
      const x = i % map.width, y = Math.floor(i / map.width);
      if (roadLevelAt(map, x, y) >= to) continue;
      if (apply(x, y)) { taken++; any = true; }
    }
    if (!any) break;
  }
  return taken;
}
