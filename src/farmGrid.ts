/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone's grid along the roads (owner, 23 Oct 2026: "ช่องสี่เหลี่ยม หรือตาราง ที่วาด มันจะต้องขนานกับถนนทุกเส้น", then
// "ทำตารางโซนเกษตรให้ขนานกับถนนทุกเส้นเลย"; docs/GAME_DESIGN.md 7.5, docs/NO_GRID_PLAN.md 3C). On a real-scale city map the
// farm brush paints 4 m cells laid in rows along the nearest road that farms may use, straight, slanted or curved, as the
// zones' cells are (src/zoneCells.ts), only deeper: from the road's edge out as far as a field may lie from it (the
// rules' farmZone.reach). Where two roads' rows would overlap the nearer road's win; no cell lies on a road, a railway,
// water or a building, or outside the district. The cells are laid a chunk of the map at a time, each with the cells round
// it, so the brush, the commands and the 3D view ask only for the part they look at and get the same cells.
//
// What is painted is kept as squares of 2 m, 8 × 8 a 16 m tile (map.farmSquares, 8 bytes a tile, a byte a row), so the
// paint stays where it lies when a road beside it is upgraded or another is built nearer: a cell is painted when the square
// under its middle is, and a tile counts as farmland as much as its squares are painted (src/farmZone.ts fieldShare). A
// field tile with no squares is painted whole (the whole-tile fields of older saves and other maps). Plain code: no DOM,
// nothing random.

import { cellAt, cellLayout, CELL_M, roadRect, type Cell, type CellLayout, type CellMap } from "./zoneCells";
import type { Point } from "./roadGeometry";
import { isOpenLand, plotKindOfValue } from "./plots";
import { isLineRoad } from "./roadGeometry";
import { FIELD_BASE, FIELD_LAST } from "./tileValues";
import { BIT_MASK } from "./tileFlags";
import { isBridgeTile, isWaterTile } from "./canals";
import { TILE_UNITS, tileMetres, tileOfUnits } from "./units";
import { FARM_ZONE } from "./provinceRules";

/** Squares a side of a tile (2 m on a 16 m tile), and a tile's squares all painted */
export const SQUARES = 8;
export const ALL_SQUARES = SQUARES * SQUARES;
/** Tiles a side of a chunk the cells are laid by */
export const FARM_CHUNK = 10;

export interface FarmGridMap extends CellMap {
  /** The painted squares of each field tile, SQUARES bytes a tile (a byte a row, bit c the column), or null */
  farmSquares?: Uint8Array | null;
}

const isField = (value: number): boolean => value >= FIELD_BASE && value <= FIELD_LAST;

/** Whether a tile is a dug canal's water or a bridge over it (src/canals.ts): its margin beside the banks is like a road
 * tile's to the farm cells */
const isCanalTile = (map: FarmGridMap, value: number, index: number): boolean =>
  (map.canals?.[index] ?? 0) > 0 && (isWaterTile(value) || isBridgeTile(value));

/** Whether a tile is a road's or a canal's, whose margin the farm cells beside them may reach over */
const lineTile = (map: FarmGridMap, index: number): boolean => {
  const v = map.getTileValue(index % map.width, Math.floor(index / map.width)) & BIT_MASK;
  return isLineRoad(v) || isCanalTile(map, v, index);
};

/** Ground a farm cell may lie on: open land, fields, the margin of a road's or a canal's tile, and the zones' plots (the
 * same cells whether a tile is painted or grown, so painting never moves them; a plot's are not painted,
 * src/cityCommands.ts) */
const farmGround = (map: FarmGridMap) => (value: number, index: number): boolean =>
  isOpenLand(value) || isField(value) || isLineRoad(value) || plotKindOfValue(value) !== null || isCanalTile(map, value, index);

/** How many rows of cells a road's farm grid has: as far as a field may lie from the road (reach tiles), and one more */
export const farmRows = (map: { tileSizeM?: number | null }, reach: number): number =>
  Math.ceil(reach * tileMetres(map) / CELL_M) + 1;

// --- The cells, a chunk at a time ------------------------------------------------------------------------------------

/** Each chunk's cells as last laid, by map: kept while the road and land round the chunk stay the same */
const chunks = new WeakMap<object, Map<number, { stamp: number; layout: CellLayout }>>();
/** At most this many chunks kept a map (a 480 × 480 city has 2,304) */
const KEPT_CHUNKS = 400;

/** What the tiles round a chunk are to its cells: roads by their level and piece, the land they may lie on, the rest */
function chunkStamp(map: FarmGridMap, cx: number, cy: number, pad: number): number {
  const x0 = Math.max(0, cx * FARM_CHUNK - pad), y0 = Math.max(0, cy * FARM_CHUNK - pad);
  const x1 = Math.min(map.width, (cx + 1) * FARM_CHUNK + pad), y1 = Math.min(map.height, (cy + 1) * FARM_CHUNK + pad);
  const raw = map.rawCells?.() ?? null, levels = map.roadLevels, pieces = map.roadPieces, inside = map.insideProvince;
  const imul = Math.imul, ground = farmGround(map);
  let hash = (x0 * 7919 + y0 * 104729 + x1 * 31 + y1) | 0;
  for (let y = y0; y < y1; y++) for (let x = x0, i = y * map.width + x0; x < x1; x++, i++) {
    const v = raw !== null ? raw[i] & BIT_MASK : map.getTileValue(x, y);
    let kind = v >= 64 && v <= 238 ? v * 4096 + (levels?.[i] ?? 1) * 256 + (pieces?.[i] ?? 0) % 256 : ground(v, i) ? 1 : 2;
    if (inside && !inside[i]) kind += 3;
    hash = (imul(hash, 16777619) ^ imul(i, 31) ^ kind) | 0;
  }
  // ... and the roads and railways drawn in metres that come near it, by their ends, bends, levels and strokes
  const metres = tileMetres(map), box = [x0 * metres, y0 * metres, x1 * metres, y1 * metres];
  for (const graph of [map.roadGraph, map.railGraph, map.canalGraph]) {
    if (!graph) { hash = imul(hash, 31) | 0; continue; }
    for (const s of graph.segments.values()) {
      const a = graph.node(s.a), b = graph.node(s.b), xs = [a.x, b.x, s.c1?.[0] ?? a.x, s.c2?.[0] ?? b.x], zs = [a.z, b.z, s.c1?.[1] ?? a.z, s.c2?.[1] ?? b.z];
      if (Math.max(...xs) < box[0] || Math.min(...xs) > box[2] || Math.max(...zs) < box[1] || Math.min(...zs) > box[3]) continue;
      for (const v of [s.id, s.level, s.piece ?? 0, ...xs, ...zs]) hash = (imul(hash, 16777619) ^ Math.round(v * 100)) | 0;
    }
  }
  return hash;
}

/** The farm cells of a chunk (cx, cy), whose middles lie in it, laid with those round it */
export function farmChunk(map: FarmGridMap, cx: number, cy: number, reach: number = FARM_ZONE.reach): CellLayout {
  const rows = farmRows(map, reach), pad = Math.ceil(rows * CELL_M / tileMetres(map)) + 5;
  const stamp = (chunkStamp(map, cx, cy, pad) ^ Math.imul(rows, 2654435761)) | 0;
  let kept = chunks.get(map);
  if (!kept) chunks.set(map, kept = new Map());
  const id = cy * 65536 + cx, found = kept.get(id);
  if (found && found.stamp === stamp) return found.layout;
  const span = FARM_CHUNK * TILE_UNITS;
  const layout = cellLayout(map, () => true, { depth: rows, plots: false, ground: farmGround(map), canals: true,
    window: { x0: cx * span, z0: cy * span, x1: (cx + 1) * span, z1: (cy + 1) * span } });
  if (kept.size >= KEPT_CHUNKS && !found) kept.delete(kept.keys().next().value as number);
  kept.delete(id);
  kept.set(id, { stamp, layout });
  return layout;
}

/** The farm cells whose middles lie on the tiles x0..x1, y0..y1 (inclusive), each once, chunk by chunk */
export function farmCellsOnTiles(map: FarmGridMap, x0: number, y0: number, x1: number, y1: number,
                                 reach: number = FARM_ZONE.reach): Cell[] {
  const out: Cell[] = [];
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(map.width - 1, x1); y1 = Math.min(map.height - 1, y1);
  if (x0 > x1 || y0 > y1) return out;
  for (let cy = Math.floor(y0 / FARM_CHUNK); cy <= Math.floor(y1 / FARM_CHUNK); cy++) {
    for (let cx = Math.floor(x0 / FARM_CHUNK); cx <= Math.floor(x1 / FARM_CHUNK); cx++) {
      const layout = farmChunk(map, cx, cy, reach);
      const ax = Math.max(x0, cx * FARM_CHUNK), bx = Math.min(x1, (cx + 1) * FARM_CHUNK - 1);
      const ay = Math.max(y0, cy * FARM_CHUNK), by = Math.min(y1, (cy + 1) * FARM_CHUNK - 1);
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
        for (const index of layout.byTile.get(y * map.width + x) ?? []) out.push(layout.cells[index]);
      }
    }
  }
  return out;
}

/** The farm cells whose middles lie on the given tiles */
export function farmCellsOfTiles(map: FarmGridMap, tiles: Iterable<number>, reach: number = FARM_ZONE.reach): Cell[] {
  const out: Cell[] = [], layouts = new Map<number, CellLayout>();
  for (const tile of tiles) {
    const x = tile % map.width, y = (tile - x) / map.width, cx = Math.floor(x / FARM_CHUNK), cy = Math.floor(y / FARM_CHUNK);
    // (each chunk asked once: its stamp reads the tiles round it)
    let layout = layouts.get(cy * 65536 + cx);
    if (!layout) layouts.set(cy * 65536 + cx, layout = farmChunk(map, cx, cy, reach));
    for (const index of layout.byTile.get(tile) ?? []) out.push(layout.cells[index]);
  }
  return out;
}

/** The farm cell under a point (world units), or the nearest within a small margin, or null */
export function farmCellAt(map: FarmGridMap, x: number, z: number, reach: number = FARM_ZONE.reach): Cell | null {
  const tx = tileOfUnits(x), ty = tileOfUnits(z);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
  // (the chunks the tiles round the point lie in, as cellAt looks a tile round it)
  const seen = new Set<number>();
  let best: Cell | null = null, bestD = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = Math.floor((tx + dx) / FARM_CHUNK), cy = Math.floor((ty + dy) / FARM_CHUNK);
    if (cx < 0 || cy < 0 || seen.has(cy * 65536 + cx)) continue;
    seen.add(cy * 65536 + cx);
    const cell = cellAt(farmChunk(map, cx, cy, reach), map.width, x, z);
    if (!cell) continue;
    if (inCell(cell, x, z, TILE_UNITS * CELL_M / tileMetres(map))) return cell;
    const d = Math.hypot(cell.x - x, cell.z - z);
    if (d < bestD) { bestD = d; best = cell; }
  }
  return best;
}

/** The farm cell of a key (a cell's middle on the 1 m raster, src/zoneCells.ts rasterKey), or null */
export function farmCellOfKey(map: FarmGridMap, key: number, reach: number = FARM_ZONE.reach): Cell | null {
  const r = TILE_UNITS / tileMetres(map), width = Math.ceil(map.width * TILE_UNITS / r);
  const x = (key % width + 0.5) * r, z = (Math.floor(key / width) + 0.5) * r;
  const tx = tileOfUnits(x), ty = tileOfUnits(z);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
  const layout = farmChunk(map, Math.floor(tx / FARM_CHUNK), Math.floor(ty / FARM_CHUNK), reach);
  const index = layout.byKey.get(key);
  return index === undefined ? null : layout.cells[index];
}

/** The farm cells whose middles lie within radius (world units) of the stroke from one point to another (world units;
 * from null, at one point): what the round brush and the brush paint, the cells of the road-aligned grid */
export function farmCellsNear(map: FarmGridMap, from: Point | null, to: Point, radius: number, reach: number = FARM_ZONE.reach): Cell[] {
  const [ax, az] = from ?? to, [bx, bz] = to, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const cells = farmCellsOnTiles(map, tileOfUnits(Math.min(ax, bx) - radius), tileOfUnits(Math.min(az, bz) - radius),
    tileOfUnits(Math.max(ax, bx) + radius), tileOfUnits(Math.max(az, bz) + radius), reach);
  return cells.filter((cell) => {
    const t = l2 ? Math.max(0, Math.min(1, ((cell.x - ax) * dx + (cell.z - az) * dz) / l2)) : 0;
    return Math.hypot(ax + dx * t - cell.x, az + dz * t - cell.z) <= radius;
  });
}

/** The road a rectangle dragged from a point (world units) is drawn along: the way the farm cell under it, or the
 * nearest within two tiles, runs (radians, 0 along +z); 0, the map's own axes, where no road's cells are near */
export function farmFrameAt(map: FarmGridMap, x: number, z: number, reach: number = FARM_ZONE.reach): number {
  const under = farmCellAt(map, x, z, reach);
  if (under) return under.angle;
  let best: Cell | null = null, bestD = 2 * TILE_UNITS;
  for (const cell of farmCellsOnTiles(map, tileOfUnits(x) - 2, tileOfUnits(z) - 2, tileOfUnits(x) + 2, tileOfUnits(z) + 2, reach)) {
    const d = Math.hypot(cell.x - x, cell.z - z);
    if (d < bestD) { bestD = d; best = cell; }
  }
  return best ? best.angle : 0;
}

/**
 * The farm cells inside a rectangle dragged from a to b (world units), drawn in the frame of the road nearest its first
 * corner (roadRect, farmFrameAt): those whose middles lie inside it, grown by half a cell so the cells the drag starts
 * and ends on are in. The rectangle's corners too, for its outline.
 */
export function farmCellsInRect(map: FarmGridMap, a: Point, b: Point, reach: number = FARM_ZONE.reach): { cells: Cell[]; corners: Point[] } {
  const units = TILE_UNITS * CELL_M / tileMetres(map), rect = roadRect(a, b, farmFrameAt(map, a[0], a[1], reach), units / 2);
  const xs = rect.corners.map((p) => p[0]), zs = rect.corners.map((p) => p[1]);
  const cells = farmCellsOnTiles(map, tileOfUnits(Math.min(...xs)), tileOfUnits(Math.min(...zs)),
    tileOfUnits(Math.max(...xs)), tileOfUnits(Math.max(...zs)), reach).filter((cell) => rect.inside(cell.x, cell.z));
  return { cells, corners: rect.corners };
}

/** Whether the brush may paint a farm cell: its tile (homeSquare) open land or a field (not a plot or a building, whose
 * cells lie there only so painting never moves the rest) */
export function farmCellOnLand(map: FarmGridMap, cell: Cell): boolean {
  const home = homeSquare(map, cell);
  if (!home) return false;
  const v = map.getTileValue(home.owner % map.width, Math.floor(home.owner / map.width)) & BIT_MASK;
  return isOpenLand(v) || isField(v);
}

/** Whether a point (world units) lies on a cell of side `side` world units */
function inCell(cell: Cell, x: number, z: number, side: number): boolean {
  const sin = Math.sin(cell.angle), cos = Math.cos(cell.angle), ox = x - cell.x, oz = z - cell.z;
  const half = side / 2, u = ox * cos - oz * sin, v = ox * sin + oz * cos;
  return Math.abs(u) <= half && Math.abs(v) <= half * (cell.span ?? 1);
}

// --- The painted squares ---------------------------------------------------------------------------------------------

/** A tile's square: its tile, row and column */
export interface Square { tile: number; row: number; column: number }

/** The square a point (world units) lies on, or null off the map */
export function squareAt(map: { width: number; height: number }, x: number, z: number): Square | null {
  const tx = tileOfUnits(x), ty = tileOfUnits(z);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
  const size = TILE_UNITS / SQUARES;
  return { tile: ty * map.width + tx, row: Math.min(SQUARES - 1, Math.floor((z - ty * TILE_UNITS) / size)),
    column: Math.min(SQUARES - 1, Math.floor((x - tx * TILE_UNITS) / size)) };
}

/** The squares whose middles lie on a cell (world units a side: cellUnits), by tile: each tile's bits as SQUARES bytes */
export function cellSquares(map: { width: number; height: number }, cell: Cell, cellUnits: number): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>(), size = TILE_UNITS / SQUARES, reach = cellUnits * Math.SQRT2 / 2 + size;
  const sin = Math.sin(cell.angle), cos = Math.cos(cell.angle), half = cellUnits / 2, halfV = half * (cell.span ?? 1);
  const gx0 = Math.max(0, Math.floor((cell.x - reach) / size)), gx1 = Math.min(map.width * SQUARES - 1, Math.floor((cell.x + reach) / size));
  const gz0 = Math.max(0, Math.floor((cell.z - reach) / size)), gz1 = Math.min(map.height * SQUARES - 1, Math.floor((cell.z + reach) / size));
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    const ox = (gx + 0.5) * size - cell.x, oz = (gz + 0.5) * size - cell.z;
    const u = ox * cos - oz * sin, v = ox * sin + oz * cos;
    if (u < -half || u >= half || v < -halfV || v >= halfV) continue;
    const tx = Math.floor(gx / SQUARES), ty = Math.floor(gz / SQUARES), tile = ty * map.width + tx;
    let bits = out.get(tile);
    if (!bits) out.set(tile, bits = new Uint8Array(SQUARES));
    bits[gz - ty * SQUARES] |= 1 << (gx - tx * SQUARES);
  }
  // (the square under its middle always: a cell's middle lies within √2 m of its square's)
  const middle = squareAt(map, cell.x, cell.z);
  if (middle) {
    let bits = out.get(middle.tile);
    if (!bits) out.set(middle.tile, bits = new Uint8Array(SQUARES));
    bits[middle.row] |= 1 << middle.column;
  }
  return out;
}

/** How many squares a tile's bits hold */
export function squareCount(bits: ArrayLike<number>, offset = 0): number {
  let n = 0;
  for (let r = 0; r < SQUARES; r++) for (let m = bits[offset + r]; m; m &= m - 1) n++;
  return n;
}

/** How many of tile i's squares are painted: ALL_SQUARES for a tile with none kept (painted whole) */
export function paintedSquares(map: FarmGridMap, i: number): number {
  const squares = map.farmSquares;
  if (!squares || squares.length < (i + 1) * SQUARES) return ALL_SQUARES;
  const n = squareCount(squares, i * SQUARES);
  return n || ALL_SQUARES;
}

/** Whether a square of tile i is painted: every one of a tile with none kept */
export function squarePainted(map: FarmGridMap, square: Square): boolean {
  const squares = map.farmSquares, at = square.tile * SQUARES;
  if (!squares || squares.length < at + SQUARES) return true;
  let any = 0;
  for (let r = 0; r < SQUARES; r++) any |= squares[at + r];
  return !any || ((squares[at + square.row] >> square.column) & 1) === 1;
}

/** Where a farm cell's paint is kept: the square that says whether it is painted (tile, row, column), and the tile it
 * belongs to (owner): the field it is drawn with, whose checks the brush asks */
export interface Home extends Square { owner: number }

/**
 * Where a farm cell's paint is kept: the square under its middle and its tile. A road's tile is wider than the road drawn
 * on it, so the first rows beside a slanted road often lie over one, as the zones' cells do: a cell whose middle lies on a
 * road's tile belongs to the land tile its squares reach nearest its middle, by that square; one lying wholly on road
 * tiles belongs to the first land tile out from the road along it, and is kept by the square under its middle (squares
 * on a road's tile count for nothing in the simulation, src/farmZone.ts fieldShare).
 */
export { lineTile };

export function homeSquare(map: FarmGridMap, cell: Cell): Home | null {
  const middle = squareAt(map, cell.x, cell.z);
  if (!middle) return null;
  const road = (tile: number): boolean => lineTile(map, tile);
  if (!road(middle.tile)) return { ...middle, owner: middle.tile };
  const size = TILE_UNITS / SQUARES, units = TILE_UNITS * CELL_M / tileMetres(map);
  let best: Home | null = null, bestD = Infinity;
  for (const [tile, bits] of cellSquares(map, cell, units)) {
    if (road(tile)) continue;
    const tx = tile % map.width, ty = (tile - tx) / map.width;
    for (let row = 0; row < SQUARES; row++) for (let column = 0; column < SQUARES; column++) {
      if (!((bits[row] >> column) & 1)) continue;
      const d = Math.hypot(tx * TILE_UNITS + (column + 0.5) * size - cell.x, ty * TILE_UNITS + (row + 0.5) * size - cell.z);
      if (d < bestD - 1e-9) { bestD = d; best = { tile, row, column, owner: tile }; }
    }
  }
  if (best) return best;
  // (wholly on road tiles: the land tile out from the road along the cell's side of it)
  for (let step = 1; step <= 4; step++) {
    const at = squareAt(map, cell.x + cell.nx * units * step, cell.z + cell.nz * units * step);
    if (at && !road(at.tile)) return { ...middle, owner: at.tile };
  }
  return null;
}

/** Whether a farm cell is painted: its tile a field, and the square it is kept by painted (homeSquare) */
export function cellPainted(map: FarmGridMap, cell: Cell): boolean {
  const home = homeSquare(map, cell);
  if (!home) return false;
  const x = home.owner % map.width, y = (home.owner - x) / map.width;
  if (!isField(map.getTileValue(x, y) & BIT_MASK)) return false;
  if (home.tile === home.owner) return squarePainted(map, home);
  const squares = map.farmSquares;
  return !!squares && ((squares[home.tile * SQUARES + home.row] >> home.column) & 1) === 1;
}

/** The painted farm cells kept by the given tiles (fields; homeSquare), each with its tile: those whose middles lie on
 * them, and on the road tiles beside them */
export function paintedCells(map: FarmGridMap, tiles: Iterable<number>, reach: number = FARM_ZONE.reach): Array<{ cell: Cell; tile: number }> {
  const wanted = new Set(tiles), look = new Set<number>(wanted);
  for (const tile of wanted) {
    const x = tile % map.width, y = (tile - x) / map.width;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && lineTile(map, ny * map.width + nx)) look.add(ny * map.width + nx);
    }
  }
  const out: Array<{ cell: Cell; tile: number }> = [];
  for (const cell of farmCellsOfTiles(map, look, reach)) {
    const home = homeSquare(map, cell);
    if (home && wanted.has(home.owner) && cellPainted(map, cell)) out.push({ cell, tile: home.owner });
  }
  return out;
}

/** The painted squares as a save keeps them: by tile, as 16 hex digits, only where a field covers part of its tile or
 * a cell beside a road reaches over the road's tile */
export function farmSquaresKept(map: FarmGridMap): Record<string, string> | null {
  const squares = map.farmSquares;
  if (!squares || squares.length !== map.width * map.height * SQUARES) return null;
  const kept: Record<string, string> = {};
  let any = false;
  for (let i = 0; i < map.width * map.height; i++) {
    // (and those over a road tile's margin, which keep the cells beside the road painted)
    const n = squareCount(squares, i * SQUARES), v = map.getTileValue(i % map.width, Math.floor(i / map.width)) & BIT_MASK;
    if (!n || !(isField(v) && n < ALL_SQUARES || lineTile(map, i))) continue;
    let hex = "";
    for (let r = 0; r < SQUARES; r++) hex += squares[i * SQUARES + r].toString(16).padStart(2, "0");
    kept[i] = hex;
    any = true;
  }
  return any ? kept : null;
}

/** The painted squares from a save (farmSquaresKept), on a map width x height; null when it keeps none */
export function readFarmSquares(saved: unknown, width: number, height: number): Uint8Array | null {
  if (!saved || typeof saved !== "object") return null;
  const squares = new Uint8Array(width * height * SQUARES);
  let any = false;
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= width * height || typeof value !== "string" || !/^[0-9a-f]{16}$/i.test(value)) continue;
    for (let r = 0; r < SQUARES; r++) squares[i * SQUARES + r] = parseInt(value.slice(r * 2, r * 2 + 2), 16);
    any = true;
  }
  return any ? squares : null;
}

/** The squares of an older save's fields, painted a 4 m cell of 4 × 4 at a time (src/farmZone.ts before 23 Oct 2026:
 * bit row * 4 + column, 0 a whole tile), each cell its 2 × 2 squares: the same share of each tile */
export function squaresOfCells(cells: ArrayLike<number> | null, width: number, height: number): Uint8Array | null {
  if (!cells) return null;
  const squares = new Uint8Array(width * height * SQUARES);
  let any = false;
  for (let i = 0; i < Math.min(cells.length, width * height); i++) {
    const mask = cells[i] & 0xffff;
    if (!mask) continue;
    for (let bit = 0; bit < 16; bit++) {
      if (!((mask >> bit) & 1)) continue;
      const r = (bit >> 2) * 2, c = (bit & 3) * 2, two = 3 << c;
      squares[i * SQUARES + r] |= two;
      squares[i * SQUARES + r + 1] |= two;
    }
    any = true;
  }
  return any ? squares : null;
}

/**
 * An older save's fields painted on part of their tile, seen through the road-aligned cells once (docs/NO_GRID_PLAN.md
 * 3C): every 4 m cell it painted whose squares hold no road-aligned cell's middle gives its squares to the cell under
 * its middle, so nothing painted is lost from sight. tiles: the fields painted in part. Returns how many cells were added.
 */
export function showOldFarmCells(map: FarmGridMap, tiles: Iterable<number>, reach: number = FARM_ZONE.reach): number {
  const squares = map.farmSquares;
  if (!squares) return 0;
  const units = TILE_UNITS * CELL_M / tileMetres(map);
  let added = 0;
  for (const tile of tiles) {
    const at = tile * SQUARES;
    if (!squareCount(squares, at)) continue;
    const tx = tile % map.width, ty = (tile - tx) / map.width;
    const shown = new Set<number>();
    // (the cells kept by this tile, painted or not)
    const mine = farmCellsOfTiles(map, [tile, tile - 1, tile + 1, tile - map.width, tile + map.width].filter((t) => t >= 0 && t < map.width * map.height), reach)
      .map((cell) => ({ cell, home: homeSquare(map, cell) })).filter((one) => one.home?.tile === tile && one.home.owner === tile);
    for (const { home } of mine) {
      if ((squares[at + home!.row] >> home!.column) & 1) shown.add((home!.row >> 1) * 4 + (home!.column >> 1));
    }
    for (let bit = 0; bit < 16; bit++) {
      const r = (bit >> 2) * 2, c = (bit & 3) * 2;
      if (shown.has(bit) || !((squares[at + r] >> c) & 1)) continue;
      // (the cell kept by this tile nearest the old cell's middle)
      const x = (tx + (c + 1) / SQUARES) * TILE_UNITS, z = (ty + (r + 1) / SQUARES) * TILE_UNITS;
      let cell: Cell | null = null, bestD = Infinity;
      for (const { cell: one } of mine) {
        const d = Math.hypot(one.x - x, one.z - z);
        if (d < bestD - 1e-9) { bestD = d; cell = one; }
      }
      const bits = cell ? cellSquares(map, cell, units).get(tile) : null;
      if (!cell || !bits) continue;
      for (let k = 0; k < SQUARES; k++) squares[at + k] |= bits[k];
      added++;
    }
  }
  return added;
}
