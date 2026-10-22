/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Land blocks (ซื้อที่ดิน, docs/LAND.md; owner, 13 Oct 2026: "เป็น block เหมือนๆ cities.. จะดีกว่า มันจะได้ไม่หนัก").
// A province map is cut into square blocks of BLOCK_SIZE tiles, as Cities: Skylines cuts its map. A new city owns the
// three by three blocks round its town; the player buys more, one at a time, each beside one already owned and dearer
// than the last, as many as the ruler's rank allows. Tiles of blocks not yet owned show the land but take no tool
// (src/cityCommands.ts). Buying is a command ({ type: "land", x, y }). A practice map, and a city saved before the
// blocks, owns all its land (gameMap.landBlocks is null). No DOM.

import { isCityTileSize } from "./units";

/** Tiles a side of a block on a whole-province map */
export const BLOCK_SIZE = 24;
/** ... and on a real-scale city map (16 m a tile, docs/CITY_SCALE.md): 512 m, near Cities: Skylines 2's 600 m tiles */
export const CITY_BLOCK_SIZE = 32;
/** A map with tiles this small, in metres, is a city map */
/** The first block bought costs this, and each after it this much more */
export const FIRST_BLOCK_PRICE = 1000;
export const BLOCK_PRICE_STEP = 500;
/** Blocks the ruler may have bought, by rank (src/rulerRank.ts: 0 หมื่น … 5 เจ้าพระยา, who may buy all) */
export const BLOCKS_BY_RANK: readonly number[] = [2, 5, 9, 14, 20, Infinity];
/**
 * ... and on a city map, whose blocks are 512 m rather than some 14 km, with a smaller step in price (owner, 16 Oct 2026:
 * "ให้อัพให้ได้ level สูงสุด"): at หลวง nine blocks more held a town of 25,000, short of the 50,000 the next rank asks,
 * so no city could rise past it. Each rank now holds the people the next one asks for.
 */
export const CITY_BLOCKS_BY_RANK: readonly number[] = [4, 12, 30, 60, 120, Infinity];
export const CITY_BLOCK_PRICE_STEP = 100;

/** Why buying a block was refused */
export const LAND_OWNED = "the city owns that land";
export const LAND_NOT_BESIDE = "the land must be beside land the city owns";
export const LAND_OUTSIDE = "that land is outside the province";
export const LAND_NEEDS_RANK = "buying more land needs a higher rank";
export const LAND_NO_MONEY = "not enough money for the land";
export const LAND_ALL_OPEN = "the city owns all its land";
/** Why a tool was refused where the city does not own the land */
export const LAND_LOCKED = "the city does not own that land";

export interface LandMap {
  readonly width: number;
  readonly height: number;
  /** Owned blocks, 1 a block, row by row (blockColumns × blockRows); null when all the land is the city's */
  landBlocks?: Uint8Array | null;
  /** How many blocks were bought (not counting those the city started with) */
  landBought?: number;
  /** The province's own tiles (1), on a whole-province map */
  insideProvince?: Uint8Array | null;
  /** Metres a tile: a city map's are small (docs/CITY_SCALE.md) */
  tileSizeM?: number | null;
}

/** Tiles a side of this map's blocks. */
export const blockSizeOf = (map: { tileSizeM?: number | null }): number =>
  isCityMap(map) ? CITY_BLOCK_SIZE : BLOCK_SIZE;

/** Whether a map is a real-scale city map (docs/CITY_SCALE.md), by the size of its tiles. */
export function isCityMap(map: { tileSizeM?: number | null }): boolean {
  return isCityTileSize(map.tileSizeM);
}

export const blockColumns = (map: { readonly width: number; tileSizeM?: number | null }): number =>
  Math.ceil(map.width / blockSizeOf(map));
export const blockRows = (map: { readonly height: number; tileSizeM?: number | null }): number =>
  Math.ceil(map.height / blockSizeOf(map));

/** The block a tile lies in, as its index in landBlocks. */
export function blockAt(map: LandMap, x: number, y: number): number {
  // (the size once: it is asked for every tile of a city map, docs/NO_GRID_PLAN.md 5.1)
  const size = blockSizeOf(map);
  return Math.floor(y / size) * Math.ceil(map.width / size) + Math.floor(x / size);
}

/** Whether the city owns the land at (x, y): always where the map has no blocks. */
export function ownsLand(map: LandMap, x: number, y: number): boolean {
  if (!map.landBlocks) return true;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.landBlocks[blockAt(map, x, y)] === 1;
}

/**
 * Whether the city may build at (x, y): it owns the land (ownsLand) and the tile is the province's (the commands'
 * canBuildAt), with the map's arrays read once, for a test asked of every tile of the map (the cells' layout signature,
 * src/zoneCells.ts: reading the map's fields for each of a 480 x 480 city's tiles took 0.3 s a time under Jest, the map
 * object carrying a great many fields; docs/NO_GRID_PLAN.md 5.4). Made for one use: the arrays are those of now.
 */
export function buildableTest(map: LandMap): BuildableTest {
  const blocks = map.landBlocks ?? null, inside = map.insideProvince ?? null, width = map.width, height = map.height;
  const size = blockSizeOf(map), columns = Math.ceil(width / size);
  const test = (x: number, y: number): boolean => {
    if (blocks !== null) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      // (whole numbers by `| 0`, the tile on the map so not below 0: no Math call a tile)
      if (blocks[((y / size) | 0) * columns + ((x / size) | 0)] !== 1) return false;
    }
    return inside === null || inside[x + y * width] === 1;
  };
  return Object.assign(test, { land: { blocks, inside, size, columns } });
}

/** The arrays a buildableTest reads, as they were when it was made: a reader going over every tile tests them inline,
 *  and one that keeps what it found knows the land changed only when the blocks bought did (src/zoneCells.ts cellsOf) */
export interface BuildableLand {
  readonly blocks: ArrayLike<number> | null;
  readonly inside: ArrayLike<number> | null;
  readonly size: number;
  readonly columns: number;
}
export type BuildableTest = ((x: number, y: number) => boolean) & { readonly land: BuildableLand };

/** Whether any of a block's tiles is the province's own. */
export function blockInProvince(map: LandMap, block: number): boolean {
  const inside = map.insideProvince;
  if (!inside) return true;
  const columns = blockColumns(map);
  const size = blockSizeOf(map);
  const x0 = (block % columns) * size;
  const y0 = Math.floor(block / columns) * size;
  for (let y = y0; y < Math.min(map.height, y0 + size); y++) {
    for (let x = x0; x < Math.min(map.width, x0 + size); x++) if (inside[y * map.width + x] === 1) return true;
  }
  return false;
}

/** A new province city's land: the three by three blocks round its town. */
export function startingBlocks(map: LandMap, town: { x: number; y: number }): Uint8Array {
  const columns = blockColumns(map);
  const rows = blockRows(map);
  const blocks = new Uint8Array(columns * rows);
  const bx = Math.floor(town.x / blockSizeOf(map));
  const by = Math.floor(town.y / blockSizeOf(map));
  for (let y = by - 1; y <= by + 1; y++) {
    for (let x = bx - 1; x <= bx + 1; x++) if (x >= 0 && y >= 0 && x < columns && y < rows) blocks[y * columns + x] = 1;
  }
  return blocks;
}

/** What the next block costs, before the province's price rules. */
export function blockPrice(map: LandMap): number {
  return FIRST_BLOCK_PRICE + (isCityMap(map) ? CITY_BLOCK_PRICE_STEP : BLOCK_PRICE_STEP) * (map.landBought ?? 0);
}

/** The blocks each rank may have bought on this map */
export function blocksByRank(map: { tileSizeM?: number | null }): readonly number[] {
  return isCityMap(map) ? CITY_BLOCKS_BY_RANK : BLOCKS_BY_RANK;
}

/** Why the block at (x, y) may not be bought now, or null. rank: the ruler's, 0–5; funds: the treasury's. */
export function landProblem(map: LandMap, x: number, y: number, rank: number, funds: number): string | null {
  if (!map.landBlocks) return LAND_ALL_OPEN;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return LAND_OUTSIDE;
  const block = blockAt(map, x, y);
  if (map.landBlocks[block] === 1) return LAND_OWNED;
  if (!blockInProvince(map, block)) return LAND_OUTSIDE;
  const columns = blockColumns(map);
  const bx = block % columns;
  const by = Math.floor(block / columns);
  const owned = (cx: number, cy: number): boolean =>
    cx >= 0 && cy >= 0 && cx < columns && cy < blockRows(map) && map.landBlocks?.[cy * columns + cx] === 1;
  if (!owned(bx - 1, by) && !owned(bx + 1, by) && !owned(bx, by - 1) && !owned(bx, by + 1)) return LAND_NOT_BESIDE;
  const allowed = blocksByRank(map);
  if ((map.landBought ?? 0) >= allowed[Math.max(0, Math.min(allowed.length - 1, rank))]) return LAND_NEEDS_RANK;
  return funds < blockPrice(map) ? LAND_NO_MONEY : null;
}

/** Buys the block at (x, y), which landProblem allowed, for its price. */
export function buyBlock(map: LandMap, x: number, y: number, budget: { spend(amount: number): void }): void {
  if (!map.landBlocks) return;
  budget.spend(blockPrice(map));
  map.landBlocks[blockAt(map, x, y)] = 1;
  map.landBought = (map.landBought ?? 0) + 1;
}

/** A block's first tile, so a tool outline of the block's size drawn from one tile in (src/cityCommands.ts footprint)
 * fills it. */
export function blockOutlineTile(map: { tileSizeM?: number | null }, x: number, y: number): { x: number; y: number } {
  const size = blockSizeOf(map);
  return { x: Math.floor(x / size) * size + 1, y: Math.floor(y / size) * size + 1 };
}

/** Reasons a land command or a tool on unowned land is refused (none are logged as errors by the game). */
export const LAND_REASONS: readonly string[] = [LAND_OWNED, LAND_NOT_BESIDE, LAND_OUTSIDE, LAND_NEEDS_RANK, LAND_NO_MONEY,
  LAND_ALL_OPEN, LAND_LOCKED];
