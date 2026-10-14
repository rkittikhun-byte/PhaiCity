/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Zone cells along the roads, as in Cities: Skylines (owner, 14 Oct 2026: "ลดขนาดช่องลงอีก เหลือ 4x4 และ วาดสีทีละช่อง
// และ ให้ snap กันถนน", Mueang Khon Kaen first). Beside every road that zones may face, on both sides, rows of 4 m
// cells (a Thai shophouse's frontage) lie along the road's smooth line (src/roadGeometry.ts), straight, slanted or
// curved, CELL_DEPTH deep; the player paints homes, shops or factories a cell at a time (the zoneCells command,
// src/cityCommands.ts). Where two roads' cells would overlap, the nearer road's win; no cell lies on a road, a railway,
// water, a building, outside the district or on land the city has not bought.
// A painted cell is kept by where its middle lies, on a 2 m raster of the map (its key), so the paint stays when the
// road is straightened or upgraded in place. Step 1: painting and keeping; the buildings that grow on painted cells
// come next (docs/ZONE_CELLS.md). Plain code: no DOM, nothing random.

import { isOpenLand } from "./plots";
import { isLineRoad, networkOf, roadReach, smoothLine, type Point } from "./roadGeometry";
import { servesZones } from "./roadLevels";

/** A cell's side and the raster a cell's middle is kept on (metres), and how many cells deep a road's rows go */
export const CELL_M = 4;
export const RASTER_M = 2;
export const CELL_DEPTH = 8;
/** The gap between a road's edge and its first row (world units) */
const EDGE_GAP = 0.25;

/** The zones a cell takes, and their codes in map.zoneCells */
export const CELL_ZONES = ["residential", "commercial", "industrial"] as const;
export type CellZone = typeof CELL_ZONES[number];
export const zoneCode = (zone: CellZone): number => CELL_ZONES.indexOf(zone) + 1;
export const zoneOfCode = (code: number): CellZone | null => CELL_ZONES[code - 1] ?? null;

export interface CellMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadLevels?: Uint8Array | null;
  readonly insideProvince?: Uint8Array | null;
  getTileValue(x: number, y: number): number;
  /** Whether this map's zones are painted a cell at a time */
  cellZones?: boolean;
  /** Painted cells: key → zone code */
  zoneCells?: Map<number, number> | null;
  /** Counts the paint's changes, for whoever draws it */
  zoneCellsVersion?: number;
}

export interface Cell {
  /** Where its middle lies on the raster: the paint's key */
  key: number;
  /** Its middle (world units, 10 a tile) and the way its road runs there (radians: 0 along +z) */
  x: number;
  z: number;
  angle: number;
  /** Its row from the road, 0 next to it */
  row: number;
}

export interface CellLayout {
  /** World units a cell's side, and a raster square's */
  cellUnits: number;
  rasterUnits: number;
  rasterWidth: number;
  cells: Cell[];
  byKey: Map<number, number>;
  /** The cells whose middles lie on each tile, for finding the one under a point */
  byTile: Map<number, number[]>;
}

/** World units a metre on this map */
const unitsPerMetre = (map: CellMap): number => 10 / (map.tileSizeM || 16);

/** The raster key of a point (world units) */
export function rasterKey(map: CellMap, x: number, z: number): number {
  const r = RASTER_M * unitsPerMetre(map), width = Math.ceil(map.width * 10 / r);
  return Math.floor(z / r) * width + Math.floor(x / r);
}

/** The cells along the map's roads. owns: whether the city may build on a tile (its land and its district) */
export function cellLayout(map: CellMap, owns: (x: number, y: number) => boolean = () => true): CellLayout {
  const units = unitsPerMetre(map), cellUnits = CELL_M * units, rasterUnits = RASTER_M * units;
  const rasterWidth = Math.ceil(map.width * 10 / rasterUnits), rasterHeight = Math.ceil(map.height * 10 / rasterUnits);
  const taken = new Uint8Array(rasterWidth * rasterHeight);
  const keyOf = (x: number, z: number): number => {
    const rx = Math.floor(x / rasterUnits), rz = Math.floor(z / rasterUnits);
    return rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight ? -1 : rz * rasterWidth + rx;
  };
  const value = (i: number): number => map.getTileValue(i % map.width, Math.floor(i / map.width));
  const levels = map.roadLevels;
  const roads = networkOf({ width: map.width, height: map.height, value, level: (i) => levels?.[i] ?? 1 }, false);
  const rails = networkOf({ width: map.width, height: map.height, value, level: () => 0 }, true);
  // The roads and railways themselves, out to their edges, take their ground first
  const lines = [...roads.stretches, ...rails.stretches].map((stretch) => ({ stretch, line: smoothLine(stretch.points) }));
  for (const { stretch, line } of lines) {
    // Raster squares whose middles lie on the road or its shoulders, so the first row of cells fits beside it
    const reach = (stretch.rail ? 1.9 : roadReach(stretch.level)) - rasterUnits / 2, r = Math.ceil(reach / rasterUnits) + 1;
    for (const [px, pz] of line) {
      const cx = Math.floor(px / rasterUnits), cz = Math.floor(pz / rasterUnits);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const rx = cx + dx, rz = cz + dz;
        if (rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight) continue;
        if (Math.hypot((rx + 0.5) * rasterUnits - px, (rz + 0.5) * rasterUnits - pz) <= reach) taken[rz * rasterWidth + rx] = 1;
      }
    }
  }
  // Every row of cells beside the roads zones may face, nearest the road first
  const candidates: Array<Cell & { distance: number }> = [];
  for (const { stretch, line } of lines) {
    if (stretch.rail || !servesZones(stretch.level) || line.length < 2) continue;
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const length = along[along.length - 1], count = Math.floor(length / cellUnits);
    if (count < 1) continue;
    const start = (length - count * cellUnits) / 2, edge = roadReach(stretch.level) + EDGE_GAP;
    let segment = 1;
    for (let k = 0; k < count; k++) {
      const s = start + (k + 0.5) * cellUnits;
      while (segment < line.length - 1 && along[segment] < s) segment++;
      const [ax, az] = line[segment - 1], [bx, bz] = line[segment], span = along[segment] - along[segment - 1] || 1;
      const t = (s - along[segment - 1]) / span, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const tx = (bx - ax) / span, tz = (bz - az) / span, angle = Math.atan2(tx, tz);
      for (const side of [1, -1]) {
        const nx = -tz * side, nz = tx * side;
        for (let row = 0; row < CELL_DEPTH; row++) {
          const distance = edge + (row + 0.5) * cellUnits;
          candidates.push({ key: -1, x: px + nx * distance, z: pz + nz * distance, angle, row, distance });
        }
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const cells: Cell[] = [], byKey = new Map<number, number>(), byTile = new Map<number, number[]>();
  const half = cellUnits / 2 - 0.15;
  for (const cell of candidates) {
    const key = keyOf(cell.x, cell.z);
    if (key < 0 || taken[key]) continue;
    // Its corners, edges and middle: on open land the city may build on, and clear of every cell before it
    const sin = Math.sin(cell.angle), cos = Math.cos(cell.angle), spots: number[] = [];
    let clear = true;
    for (const u of [-half, 0, half]) for (const v of [-half, 0, half]) {
      // u across the road, v along it
      const x = cell.x + cos * u + sin * v, z = cell.z - sin * u + cos * v, spot = keyOf(x, z);
      const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
      // A road's tile is wider than the road drawn on it (taken above), so a cell may reach over its margin
      if (spot < 0 || taken[spot] || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ||
          !(isOpenLand(map.getTileValue(tx, ty)) || isLineRoad(map.getTileValue(tx, ty))) || !owns(tx, ty) ||
          (map.insideProvince && !map.insideProvince[ty * map.width + tx])) {
        clear = false;
        break;
      }
      spots.push(spot);
    }
    if (!clear) continue;
    for (const spot of spots) taken[spot] = 1;
    const index = cells.length, tile = Math.floor(cell.z / 10) * map.width + Math.floor(cell.x / 10);
    cells.push({ key, x: cell.x, z: cell.z, angle: cell.angle, row: cell.row });
    byKey.set(key, index);
    if (!byTile.has(tile)) byTile.set(tile, []);
    byTile.get(tile)!.push(index);
  }
  return { cellUnits, rasterUnits, rasterWidth, cells, byKey, byTile };
}

/** The cell under a point (world units), or null */
export function cellAt(layout: CellLayout, width: number, x: number, z: number): Cell | null {
  const tx = Math.floor(x / 10), tz = Math.floor(z / 10), half = layout.cellUnits / 2;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    for (const index of layout.byTile.get((tz + dz) * width + tx + dx) ?? []) {
      const cell = layout.cells[index], sin = Math.sin(cell.angle), cos = Math.cos(cell.angle);
      const ox = x - cell.x, oz = z - cell.z, u = ox * cos - oz * sin, v = ox * sin + oz * cos;
      if (Math.abs(u) <= half && Math.abs(v) <= half) return cell;
    }
  }
  return null;
}

/** The cells a stroke from one point to another (world units) passes over, in order, each once */
export function cellsAlong(layout: CellLayout, width: number, from: Point | null, to: Point): number[] {
  const keys: number[] = [], seen = new Set<number>();
  const [ax, az] = from ?? to, [bx, bz] = to, steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (layout.cellUnits / 3)));
  for (let k = 0; k <= steps; k++) {
    const cell = cellAt(layout, width, ax + (bx - ax) * k / steps, az + (bz - az) * k / steps);
    if (cell && !seen.has(cell.key)) { seen.add(cell.key); keys.push(cell.key); }
  }
  return keys;
}

/** What the roads, the land and the district look like to the cells, so the layout is found again only when it changes */
export function layoutSignature(map: CellMap, owns: (x: number, y: number) => boolean): number {
  let hash = map.width * 31 + map.height;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const v = map.getTileValue(x, y), i = y * map.width + x;
    const kind = v >= 64 && v <= 238 ? 1 + (map.roadLevels?.[i] ?? 1) : isOpenLand(v) ? (owns(x, y) ? 0 : 20) : 30;
    if (kind) hash = (Math.imul(hash, 16777619) ^ (i * 64 + kind)) | 0;
  }
  return hash;
}

const layouts = new WeakMap<object, { signature: number; layout: CellLayout }>();

/** The cells of a map, kept until its roads, buildings or land change */
export function cellsOf(map: CellMap, owns: (x: number, y: number) => boolean = () => true): CellLayout {
  const signature = layoutSignature(map, owns), kept = layouts.get(map);
  if (kept && kept.signature === signature) return kept.layout;
  const layout = cellLayout(map, owns);
  layouts.set(map, { signature, layout });
  return layout;
}

/** The price of painting a cell, from its zone's tool price: a 16 m tile's paint (PAINT_PRICE_SHARE) shared by its cells */
export function cellPrice(zonePrice: number, paintShare: number, tileSizeM: number): number {
  return zonePrice * paintShare * (CELL_M * CELL_M) / (tileSizeM * tileSizeM);
}

/** The painted cells as a save keeps them: key, code, key, code … */
export function writeZoneCells(cells: Map<number, number> | null | undefined): number[] | undefined {
  if (!cells || !cells.size) return undefined;
  const out: number[] = [];
  for (const [key, code] of [...cells].sort((a, b) => a[0] - b[0])) out.push(key, code);
  return out;
}

export function readZoneCells(saved: unknown): Map<number, number> {
  const cells = new Map<number, number>();
  if (!Array.isArray(saved)) return cells;
  for (let i = 0; i + 1 < saved.length; i += 2) {
    const key = saved[i], code = saved[i + 1];
    if (Number.isInteger(key) && key >= 0 && Number.isInteger(code) && zoneOfCode(code)) cells.set(key, code);
  }
  return cells;
}
