/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Land blocks (ซื้อที่ดิน, docs/LAND.md; owner, 13 Oct 2026: "เป็น block เหมือนๆ cities.. จะดีกว่า มันจะได้ไม่หนัก").
// A province map is cut into square blocks of BLOCK_SIZE tiles, as Cities: Skylines cuts its map. A new city owns the
// three by three blocks round its town; the player buys more, one at a time, each beside one already owned and dearer
// than the last, as many as the ruler's rank allows. Tiles of blocks not yet owned show the land but take no tool
// (src/cityCommands.ts). Buying is a command ({ type: "land", x, y }). A practice map, and a city saved before the
// blocks, owns all its land (gameMap.landBlocks is null). No DOM.

/** Tiles a side of a block */
export const BLOCK_SIZE = 24;
/** The first block bought costs this, and each after it this much more */
export const FIRST_BLOCK_PRICE = 1000;
export const BLOCK_PRICE_STEP = 500;
/** Blocks the ruler may have bought, by rank (src/rulerRank.ts: 0 หมื่น … 5 เจ้าพระยา, who may buy all) */
export const BLOCKS_BY_RANK: readonly number[] = [2, 5, 9, 14, 20, Infinity];

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
}

export const blockColumns = (map: { readonly width: number }): number => Math.ceil(map.width / BLOCK_SIZE);
export const blockRows = (map: { readonly height: number }): number => Math.ceil(map.height / BLOCK_SIZE);

/** The block a tile lies in, as its index in landBlocks. */
export function blockAt(map: LandMap, x: number, y: number): number {
  return Math.floor(y / BLOCK_SIZE) * blockColumns(map) + Math.floor(x / BLOCK_SIZE);
}

/** Whether the city owns the land at (x, y): always where the map has no blocks. */
export function ownsLand(map: LandMap, x: number, y: number): boolean {
  if (!map.landBlocks) return true;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.landBlocks[blockAt(map, x, y)] === 1;
}

/** Whether any of a block's tiles is the province's own. */
export function blockInProvince(map: LandMap, block: number): boolean {
  const inside = map.insideProvince;
  if (!inside) return true;
  const columns = blockColumns(map);
  const x0 = (block % columns) * BLOCK_SIZE;
  const y0 = Math.floor(block / columns) * BLOCK_SIZE;
  for (let y = y0; y < Math.min(map.height, y0 + BLOCK_SIZE); y++) {
    for (let x = x0; x < Math.min(map.width, x0 + BLOCK_SIZE); x++) if (inside[y * map.width + x] === 1) return true;
  }
  return false;
}

/** A new province city's land: the three by three blocks round its town. */
export function startingBlocks(map: LandMap, town: { x: number; y: number }): Uint8Array {
  const columns = blockColumns(map);
  const rows = blockRows(map);
  const blocks = new Uint8Array(columns * rows);
  const bx = Math.floor(town.x / BLOCK_SIZE);
  const by = Math.floor(town.y / BLOCK_SIZE);
  for (let y = by - 1; y <= by + 1; y++) {
    for (let x = bx - 1; x <= bx + 1; x++) if (x >= 0 && y >= 0 && x < columns && y < rows) blocks[y * columns + x] = 1;
  }
  return blocks;
}

/** What the next block costs, before the province's price rules. */
export function blockPrice(map: LandMap): number {
  return FIRST_BLOCK_PRICE + BLOCK_PRICE_STEP * (map.landBought ?? 0);
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
  if ((map.landBought ?? 0) >= BLOCKS_BY_RANK[Math.max(0, Math.min(BLOCKS_BY_RANK.length - 1, rank))]) return LAND_NEEDS_RANK;
  return funds < blockPrice(map) ? LAND_NO_MONEY : null;
}

/** Buys the block at (x, y), which landProblem allowed, for its price. */
export function buyBlock(map: LandMap, x: number, y: number, budget: { spend(amount: number): void }): void {
  if (!map.landBlocks) return;
  budget.spend(blockPrice(map));
  map.landBlocks[blockAt(map, x, y)] = 1;
  map.landBought = (map.landBought ?? 0) + 1;
}

/** A block's first tile, so a tool outline of BLOCK_SIZE drawn from one tile in (src/cityCommands.ts footprint) fills it. */
export function blockOutlineTile(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x / BLOCK_SIZE) * BLOCK_SIZE + 1, y: Math.floor(y / BLOCK_SIZE) * BLOCK_SIZE + 1 };
}

/** Reasons a land command or a tool on unowned land is refused (none are logged as errors by the game). */
export const LAND_REASONS: readonly string[] = [LAND_OWNED, LAND_NOT_BESIDE, LAND_OUTSIDE, LAND_NEEDS_RANK, LAND_NO_MONEY,
  LAND_ALL_OPEN, LAND_LOCKED];
