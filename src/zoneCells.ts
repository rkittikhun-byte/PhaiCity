/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Zone cells along the roads, as in Cities: Skylines (owner, 14 Oct 2026: "ลดขนาดช่องลงอีก เหลือ 4x4 และ วาดสีทีละช่อง
// และ ให้ snap กันถนน", then "จาก 4x4 เหลือ 2x2", Mueang Khon Kaen first). Beside every road that zones may face, on
// both sides, rows of 2 m cells (half a Thai shophouse's frontage) lie along the road's smooth line
// (src/roadGeometry.ts), straight, slanted or curved, CELL_DEPTH deep (16 m: one plot, PLOT_ROWS rows); the player paints homes, shops or factories a cell at a time (the zoneCells command,
// src/cityCommands.ts). Where two roads' cells would overlap, the nearer road's win; no cell lies on a road, a railway,
// water, a building, outside the district or on land the city has not bought.
// A painted cell is kept by where its middle lies, on a 1 m raster of the map (its key), so the paint stays when the
// road is straightened or upgraded in place. Step 1: painting and keeping; the buildings that grow on painted cells
// come next (docs/ZONE_CELLS.md). Plain code: no DOM, nothing random.

import { isOpenLand, plotKindOfValue, plotTile } from "./plots";
import { BLBNCNBIT as PLOT_FLAGS, ZONEBIT as ZONE_BIT } from "./tileFlags";
import { DIRT } from "./tileValues";
import { isLineRoad, networkOf, realUnits, roadLines, roadReach, smoothLine, type Point } from "./roadGeometry";
import { servesZones } from "./roadLevels";

/** A cell's side and the raster a cell's middle is kept on (metres), and how many cells deep a road's rows go */
export const CELL_M = 4;
export const RASTER_M = 1;
export const CELL_DEPTH = 4;
/** The rows a 16 m plot tile takes. The cells beside a road are one plot deep, 16 m, so no building stands behind another
 * (owner, 18 Oct 2026: "ไม่มีแปลงหลัง มีแค่แปลงเดียวติดถนน", after 32 m, two plots, which it had asked for earlier and which
 * stacked buildings); a lot of 2 × 2 plots (src/plots.ts lotOf) then forms only where two roads' plots meet */
export const PLOT_ROWS = 4;
/** The gap between a road's edge and its first row (world units) */
const EDGE_GAP = 0.25;
/** How much sooner (world units of distance) the cells of a junction's corner come, for the road the corner belongs to */
const CORNER_FIRST = 10000;
/** Two cells' middles at least this share of a cell apart do not overlap enough to matter: cells side by side in a row
 * are a whole cell apart, so a row stays whole (owner, 15 Oct 2026: "ช่อง ทำไม ขาดๆ หายๆ แบบนี้ ทำไมไม่เรียงกันสวยๆ") */
const CELL_GAP = 0.9;

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
  /** The drawn line each road tile was laid by (src/roadPieces.ts) */
  readonly roadPieces?: Uint16Array | null;
  /** ... and the tiles each piece was drawn along (src/roadPieces.ts) */
  readonly roadPaths?: Readonly<Record<number, { from: number; to: number; tiles: readonly number[] }>> | null;
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
  /** Outward unit normal away from the road into this cell's side, and the yaw for a building (+Z front) to face the road */
  nx: number;
  nz: number;
  facing: number;
  /** Its row from the road, 0 next to it */
  row: number;
  /** The stretch of road it faces (src/objects/roadSegment.ts segmentId: its lowest tile) */
  road: number;
  /** Its length along its row as a share of a cell, where a road across the row's end cut it short (1 when missing) */
  span?: number;
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
  /** The cells assigned to each non-road buildable plot tile (including row 0 cells on adjacent road margins) */
  byPlotTile: Map<number, number[]>;
}

/** Ground a cell may lie on: open land, a road tile's margin, or a plot the cells themselves made (syncCellPlots), so its
 * cells stay to be painted over or cleared */
const cellGround = (value: number): boolean => isOpenLand(value) || isLineRoad(value) || plotKindOfValue(value) !== null;

/** World units a metre on this map */
const unitsPerMetre = (map: CellMap): number => 10 / (map.tileSizeM || 16);

/** Which non-road tile (tx, ty) a cell belongs to: its column's front tile, anchored from its row-0 road edge along
 * (nx, nz), for rows 0 to PLOT_ROWS - 1, and the tile behind that one for the rows behind them */
export function plotTileOfCell(map: CellMap, cell: Pick<Cell, "x" | "z" | "nx" | "nz"> & { row?: number }): number {
  const cellUnits = CELL_M * unitsPerMetre(map);
  const r = cell.row ?? 0, band = Math.floor(r / PLOT_ROWS);
  let tile = -1;
  for (let b = 0; b <= band; b++) {
    // Where this band's first row lies in the cell's column
    const back = (r - b * PLOT_ROWS) * cellUnits, x0 = cell.x - cell.nx * back, z0 = cell.z - cell.nz * back;
    let found = -1, fallback = -1;
    for (const step of [0, 2, 4, 6, 8, 10, 12]) {
      const tx = Math.floor((x0 + cell.nx * step) / 10), ty = Math.floor((z0 + cell.nz * step) / 10);
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || ty * map.width + tx === tile) continue;
      const v = map.getTileValue(tx, ty);
      if (!isLineRoad(v)) {
        if (isOpenLand(v) || plotKindOfValue(v) !== null) { found = ty * map.width + tx; break; }
        if (fallback < 0) fallback = ty * map.width + tx;
      }
    }
    tile = found >= 0 ? found : fallback;
    if (tile < 0) return -1;
  }
  return tile;
}

/** The cells a click on one paints (and the brush shows): its column across the plot's rows it lies in, from the
 * front of its plot to the back, and the columns beside it within tol (world units) */
export function plotCells(layout: CellLayout, width: number, cell: Cell, tol: number): Cell[] {
  const band = Math.floor(cell.row / PLOT_ROWS), u = layout.cellUnits, out: Cell[] = [];
  const tx = Math.floor(cell.x / 10), tz = Math.floor(cell.z / 10);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    for (const index of layout.byTile.get((tz + dz) * width + tx + dx) ?? []) {
      const other = layout.cells[index];
      if (other.road !== cell.road || other.nx * cell.nx + other.nz * cell.nz <= 0.5 || Math.floor(other.row / PLOT_ROWS) !== band) continue;
      if (Math.hypot(other.x - (cell.x + cell.nx * (other.row - cell.row) * u),
                     other.z - (cell.z + cell.nz * (other.row - cell.row) * u)) <= tol) out.push(other);
    }
  }
  return out;
}

/** The raster key of a point (world units) */
export function rasterKey(map: CellMap, x: number, z: number): number {
  const r = RASTER_M * unitsPerMetre(map), width = Math.ceil(map.width * 10 / r);
  return Math.floor(z / r) * width + Math.floor(x / r);
}

/** The cells along the map's roads. owns: whether the city may build on a tile (its land and its district) */
export function cellLayout(map: CellMap, owns: (x: number, y: number) => boolean = () => true): CellLayout {
  const units = unitsPerMetre(map), cellUnits = CELL_M * units, rasterUnits = RASTER_M * units;
  // The roads at their real width on a real-scale city map (src/roadGeometry.ts), so the first row lies at its edge
  const real = realUnits(map.tileSizeM || 16);
  const rasterWidth = Math.ceil(map.width * 10 / rasterUnits), rasterHeight = Math.ceil(map.height * 10 / rasterUnits);
  // One bit a raster square: a 7.7 km map is 59 million of them
  const bits = new Uint8Array(Math.ceil(rasterWidth * rasterHeight / 8));
  const taken = { get: (k: number): boolean => (bits[k >> 3] & (1 << (k & 7))) !== 0, set: (k: number): void => { bits[k >> 3] |= 1 << (k & 7); } };
  const keyOf = (x: number, z: number): number => {
    const rx = Math.floor(x / rasterUnits), rz = Math.floor(z / rasterUnits);
    return rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight ? -1 : rz * rasterWidth + rx;
  };
  const value = (i: number): number => map.getTileValue(i % map.width, Math.floor(i / map.width));
  const levels = map.roadLevels, pieces = map.roadPieces, paths = map.roadPaths;
  const roads = networkOf({ width: map.width, height: map.height, value, level: (i) => levels?.[i] ?? 1,
    piece: (i) => pieces?.[i] ?? 0, path: (piece) => paths?.[piece] ?? null }, false);
  const rails = networkOf({ width: map.width, height: map.height, value, level: () => 0, piece: (i) => pieces?.[i] ?? 0,
    path: (piece) => paths?.[piece] ?? null }, true);
  // The roads as the 3D view draws them, one line where a road runs on through a junction (src/roadGeometry.ts
  // roadLines), so their rows of cells run on through it too; each cell still belongs to the stretch it faces
  const shapes = roadLines(roads), drawn = shapes.lines;
  const stretchAt = new Map<number, number>();
  for (const stretch of roads.stretches) { const id = Math.min(...stretch.tiles); for (const tile of stretch.tiles) stretchAt.set(tile, id); }
  const lines = [
    ...drawn.map((road) => ({ rail: false, level: road.level, line: road.points,
      first: Math.min(...roads.stretches[road.stretches[0]].tiles) })),
    ...rails.stretches.map((stretch) => ({ rail: true, level: 0, line: smoothLine(stretch.points), first: 0 })),
  ];
  // The roads and railways themselves, out to their edges, take their ground first
  for (const { rail, level, line } of lines) {
    // Raster squares whose middles lie on the road or its shoulders, so the first row of cells fits beside it
    const reach = (rail ? 1.9 * Math.min(1, real ?? 1) : roadReach(level, real)) - rasterUnits / 2, r = Math.ceil(reach / rasterUnits) + 1;
    for (const [px, pz] of line) {
      const cx = Math.floor(px / rasterUnits), cz = Math.floor(pz / rasterUnits);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const rx = cx + dx, rz = cz + dz;
        if (rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight) continue;
        if (Math.hypot((rx + 0.5) * rasterUnits - px, (rz + 0.5) * rasterUnits - pz) <= reach) taken.set(rz * rasterWidth + rx);
      }
    }
  }
  // Each junction's corners belong to one of the roads meeting there: the one running on through it, else the
  // highest, else the longest. Its rows run on to the other road's edge and the other's rows begin behind them, so a
  // corner is two straight edges rather than the two roads' rows meeting on a jagged diagonal with gaps between them
  // (owner, 18 Oct 2026: "เติมช่องที่มุมแยก")
  const lengthOf = (points: readonly Point[]): number => points.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0, 0);
  const lengths = drawn.map((road) => lengthOf(road.points));
  const cornersOf = new Map<number, Point[]>();
  for (const junction of shapes.junctions) {
    const meeting = [...new Set(junction.arms.map((arm) => arm.line))];
    if (meeting.length < 2) continue;
    const main = junction.through ?? meeting.reduce((best, n) => drawn[n].level > drawn[best].level ||
      drawn[n].level === drawn[best].level && lengths[n] > lengths[best] ? n : best);
    if (!cornersOf.has(main)) cornersOf.set(main, []);
    cornersOf.get(main)!.push(junction.at);
  }
  // Every row of cells beside the roads zones may face, nearest the road first, its junctions' corners before that
  const candidates: Array<Cell & { distance: number }> = [];
  for (const [n, { rail, level, line, first }] of lines.entries()) {
    if (rail || !servesZones(level) || line.length < 2) continue;
    let road = first;
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const length = along[along.length - 1], count = Math.floor(length / cellUnits);
    if (count < 1) continue;
    const start = (length - count * cellUnits) / 2, edge = roadReach(level, real) + EDGE_GAP;
    const corners = cornersOf.get(n) ?? [], cornerReach = 1.5 * (edge + CELL_DEPTH * cellUnits);
    let segment = 1;
    for (let k = 0; k < count; k++) {
      const s = start + (k + 0.5) * cellUnits;
      while (segment < line.length - 1 && along[segment] < s) segment++;
      const [ax, az] = line[segment - 1], [bx, bz] = line[segment], span = along[segment] - along[segment - 1] || 1;
      const t = (s - along[segment - 1]) / span, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const tx = (bx - ax) / span, tz = (bz - az) / span, angle = Math.atan2(tx, tz);
      // The stretch of road it faces: the one whose tile lies under the road's line there
      road = stretchAt.get(Math.floor(pz / 10) * map.width + Math.floor(px / 10)) ?? road;
      for (const side of [1, -1]) {
        const nx = -tz * side, nz = tx * side, facing = Math.atan2(-nx, -nz);
        for (let row = 0; row < CELL_DEPTH; row++) {
          const distance = edge + (row + 0.5) * cellUnits, x = px + nx * distance, z = pz + nz * distance;
          const corner = corners.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < cornerReach);
          candidates.push({ key: -1, x, z, angle, nx, nz, facing, row, road, distance: corner ? distance - CORNER_FIRST : distance });
        }
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const cells: Cell[] = [], byKey = new Map<number, number>(), byTile = new Map<number, number[]>(), byPlotTile = new Map<number, number[]>();
  const half = cellUnits / 2 - 0.15;
  // The cells taken so far, by their middles, in buckets a cell wide: a cell too near one already taken (the nearer
  // road's, or its own row's on the inside of a bend) is left out, so no two overlap
  const bucket = new Map<number, Array<[number, number]>>(), gap = CELL_GAP * cellUnits;
  const bucketOf = (bx: number, bz: number): number => bz * 1048576 + bx;
  const crowded = (x: number, z: number): boolean => {
    const bx = Math.floor(x / cellUnits), bz = Math.floor(z / cellUnits);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const [ox, oz] of bucket.get(bucketOf(bx + dx, bz + dz)) ?? []) if (Math.hypot(ox - x, oz - z) < gap) return true;
    }
    return false;
  };
  // The ground the cells cover, a raster square at a time, for filling the gaps between them (below)
  const covers = new Uint8Array(bits.length);
  const covered = (k: number): boolean => (covers[k >> 3] & (1 << (k & 7))) !== 0;
  const footprint = (x: number, z: number, sin: number, cos: number, halfV: number, mark: boolean): number => {
    // The raster squares whose middles lie on the cell, set (mark) or counted where already covered
    const reach = Math.ceil(half * Math.SQRT2 / rasterUnits) + 1, cx = Math.floor(x / rasterUnits), cz = Math.floor(z / rasterUnits);
    let count = 0;
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const rx = cx + dx, rz = cz + dz;
      if (rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight) continue;
      const ox = (rx + 0.5) * rasterUnits - x, oz = (rz + 0.5) * rasterUnits - z;
      if (Math.abs(ox * cos - oz * sin) > half || Math.abs(ox * sin + oz * cos) > halfV) continue;
      const k = rz * rasterWidth + rx;
      if (mark) covers[k >> 3] |= 1 << (k & 7); else if (covered(k)) count++;
    }
    return count;
  };
  const sample = [-0.375, -0.125, 0.125, 0.375];
  /** After a cell did not fit: the side along its row (1 or -1) where only a road was in its way, else 0 */
  let roadSide = 0;
  /** Lays a cell span of a cell long along its row if it fits: the first pass by its middle (crowded), the second and
   * a cell cut short by how much of it lies on cells already there */
  const place = (cell: Cell & { distance: number }, filling: boolean, span = 1): boolean => {
    roadSide = 0;
    const key = keyOf(cell.x, cell.z);
    if (key < 0 || taken.get(key) || byKey.has(key) || (!filling && crowded(cell.x, cell.z))) return false;
    // Its corners, edges and middle: on open land the city may build on, and clear of every cell before it
    const sin = Math.sin(cell.angle), cos = Math.cos(cell.angle), halfV = span * cellUnits / 2 - 0.15;
    let road = 0;
    for (const u of [-half, 0, half]) for (const v of [-halfV, 0, halfV]) {
      // u across the road, v along it
      const x = cell.x + cos * u + sin * v, z = cell.z - sin * u + cos * v, spot = keyOf(x, z);
      const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
      if (spot < 0 || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ||
          !cellGround(map.getTileValue(tx, ty)) || !owns(tx, ty) ||
          (map.insideProvince && !map.insideProvince[ty * map.width + tx])) return false;
      // A road's tile is wider than the road drawn on it (taken above), so a cell may reach over its margin; a road
      // across one end of its row only, it may fit cut short (below)
      if (taken.get(spot)) {
        if (v === 0 || road === -Math.sign(v)) return false;
        road = Math.sign(v);
      }
    }
    if (road) { roadSide = road; return false; }
    if (filling) {
      // ... and no more than an eighth of it over the cells already there
      let over = 0;
      for (const u of sample) for (const v of sample) {
        const k = keyOf(cell.x + (cos * u + sin * v * span) * cellUnits, cell.z + (-sin * u + cos * v * span) * cellUnits);
        if (k >= 0 && covered(k)) over++;
      }
      if (over > 2) return false;
    }
    const created: Cell = { key, x: cell.x, z: cell.z, angle: cell.angle, nx: cell.nx, nz: cell.nz, facing: cell.facing, row: cell.row, road: cell.road };
    if (span < 1) created.span = span;
    const plotTileIdx = plotTileOfCell(map, created);
    if (plotTileIdx < 0) return false;
    const pv = map.getTileValue(plotTileIdx % map.width, Math.floor(plotTileIdx / map.width));
    if (!isOpenLand(pv) && plotKindOfValue(pv) === null) return false;
    const home = bucketOf(Math.floor(cell.x / cellUnits), Math.floor(cell.z / cellUnits));
    if (!bucket.has(home)) bucket.set(home, []);
    bucket.get(home)!.push([cell.x, cell.z]);
    footprint(cell.x, cell.z, sin, cos, halfV, true);
    const index = cells.length, tile = Math.floor(cell.z / 10) * map.width + Math.floor(cell.x / 10);
    cells.push(created);
    byKey.set(key, index);
    if (!byTile.has(tile)) byTile.set(tile, []);
    byTile.get(tile)!.push(index);
    if (!byPlotTile.has(plotTileIdx)) byPlotTile.set(plotTileIdx, []);
    byPlotTile.get(plotTileIdx)!.push(index);
    return true;
  };
  /** A cell slid along its row by a share of a cell */
  const slid = (cell: Cell & { distance: number }, share: number): Cell & { distance: number } =>
    ({ ...cell, x: cell.x + Math.sin(cell.angle) * share * cellUnits, z: cell.z + Math.cos(cell.angle) * share * cellUnits });
  /** Where a road crosses the end of a row and a whole cell does not fit before it, the row's last cell is cut short on
   * the road's side, three quarters or half a cell long, its far edge where it was, so the paint reaches the road
   * (owner, 18 Oct 2026: "เติมช่องที่มุมแยก") */
  const cutShort = (cell: Cell & { distance: number }, side: number): boolean =>
    [0.75, 0.5].some((span) => place(slid(cell, -side * (1 - span) / 2), true, span));
  const squeezed: typeof candidates = [];
  for (const cell of candidates) {
    if (place(cell, false)) continue;
    if (roadSide) { cutShort(cell, roadSide); continue; }
    const key = keyOf(cell.x, cell.z);
    if (key >= 0 && !taken.get(key) && !byKey.has(key) && crowded(cell.x, cell.z)) squeezed.push(cell);
  }
  // Where two roads' rows meet at a corner, a row's next cell seldom fits whole beside the other road's cells, so
  // the corner was left with gaps a cell wide (owner, 18 Oct 2026: "เติมช่องที่มุมแยก"): each cell left out for
  // crowding by its middle tries again where it was, then slid along its row by a quarter or half a cell, and stays
  // where it fits, cut short where a road is in its way
  for (const cell of squeezed) for (const shift of [0, 0.25, -0.25, 0.5, -0.5]) {
    const moved = slid(cell, shift);
    if (place(moved, true) || roadSide && cutShort(moved, roadSide)) break;
  }
  return { cellUnits, rasterUnits, rasterWidth, cells, byKey, byTile, byPlotTile };
}

/** The cell under a point (world units), or the nearest cell within a small margin on bends/curbs */
export function cellAt(layout: CellLayout, width: number, x: number, z: number): Cell | null {
  const tx = Math.floor(x / 10), tz = Math.floor(z / 10), half = layout.cellUnits / 2;
  let nearest: Cell | null = null, bestDist = layout.cellUnits * 1.35;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    for (const index of layout.byTile.get((tz + dz) * width + tx + dx) ?? []) {
      const cell = layout.cells[index], sin = Math.sin(cell.angle), cos = Math.cos(cell.angle);
      const ox = x - cell.x, oz = z - cell.z, u = ox * cos - oz * sin, v = ox * sin + oz * cos;
      if (Math.abs(u) <= half && Math.abs(v) <= half * (cell.span ?? 1)) return cell;
      const d = Math.hypot(ox, oz);
      if (d < bestDist) { bestDist = d; nearest = cell; }
    }
  }
  return nearest;
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
    const kind = v >= 64 && v <= 238 ? 1 + (map.roadLevels?.[i] ?? 1) : isOpenLand(v) || plotKindOfValue(v) !== null ? (owns(x, y) ? 0 : 20) : 30;
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
  // Migrate any legacy 2 m saved cell keys into the 4 m layout by their 1 m raster world position
  if (map.zoneCells && map.zoneCells.size > 0) {
    let matched = 0;
    for (const k of map.zoneCells.keys()) if (layout.byKey.has(k)) matched++;
    if (matched < map.zoneCells.size * 0.5 && layout.cells.length > 0) {
      const migrated = new Map<number, number>();
      for (const [oldKey, code] of map.zoneCells.entries()) {
        if (layout.byKey.has(oldKey)) { migrated.set(oldKey, code); continue; }
        const rx = oldKey % layout.rasterWidth, rz = Math.floor(oldKey / layout.rasterWidth);
        const x = (rx + 0.5) * layout.rasterUnits, z = (rz + 0.5) * layout.rasterUnits;
        const c = cellAt(layout, map.width, x, z);
        if (c) migrated.set(c.key, code);
      }
      if (migrated.size > 0) {
        map.zoneCells.clear();
        for (const [k, v] of migrated) map.zoneCells.set(k, v);
        map.zoneCellsVersion = (map.zoneCellsVersion ?? 0) + 1;
      }
    }
  }
  return layout;
}

/**
 * Exact world pose (x, z, rotation) for a plot or lot building of `size` tiles and `scale` fill at (tx, ty) on a
 * cellZones map: centered along the road on the painted cells belonging to that plot, its front edge (+Z) aligned with
 * the road's row-0 edge, and turned to face the road along its curve.
 */
export function cellPlotPose(
  map: CellMap,
  tx: number,
  ty: number,
  size: number,
  scale: number,
): { x: number; z: number; rotation: number } | null {
  if (!map.cellZones || !map.zoneCells || !map.zoneCells.size) return null;
  const layout = cellsOf(map);
  const paint = map.zoneCells;
  const raw: Cell[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const tile = (ty + dy) * map.width + (tx + dx);
      for (const idx of layout.byPlotTile.get(tile) ?? []) {
        const c = layout.cells[idx];
        if (paint.has(c.key)) raw.push(c);
      }
    }
  }
  if (!raw.length) return null;
  // Pick the dominant road + side so cross-street cells at a corner never skew the building's heading
  const groups = new Map<string, Cell[]>();
  for (const c of raw) {
    const sideKey = `${c.road}:${Math.round(c.nx * 2)}:${Math.round(c.nz * 2)}`;
    const list = groups.get(sideKey) ?? [];
    list.push(c);
    groups.set(sideKey, list);
  }
  let group = raw;
  for (const list of groups.values()) if (list.length > group.length || group === raw) group = list;
  const targetCode = paint.get(group[0].key) ?? 1;
  group = group.filter((c) => paint.get(c.key) === targetCode);
  if (!group.length) return null;

  let nx = 0, nz = 0;
  for (const c of group) { nx += c.nx; nz += c.nz; }
  const nLen = Math.hypot(nx, nz) || 1;
  nx /= nLen; nz /= nLen;
  const rx = nz, rz = -nx;
  const ref = group[0];

  let minAlong = Infinity, maxAlong = -Infinity, minAcross = Infinity, minRow = Infinity;
  for (const c of group) {
    const along = (c.x - ref.x) * rx + (c.z - ref.z) * rz;
    const across = (c.x - ref.x) * nx + (c.z - ref.z) * nz;
    if (along < minAlong) minAlong = along;
    if (along > maxAlong) maxAlong = along;
    if (across < minAcross) minAcross = across;
    if (c.row < minRow) minRow = c.row;
  }

  // If a small painted patch straddles a tile boundary, absorb spillover cells from the same patch so the building centers on it
  const half = size * 5 * scale;
  if (maxAlong - minAlong < half * 1.4) {
    const mid0 = (minAlong + maxAlong) / 2;
    for (let dy = -1; dy <= size; dy++) {
      for (let dx = -1; dx <= size; dx++) {
        if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;
        const nxT = tx + dx, nyT = ty + dy;
        if (nxT < 0 || nyT < 0 || nxT >= map.width || nyT >= map.height) continue;
        const neighborIndices = layout.byPlotTile.get(nyT * map.width + nxT) ?? [];
        const neighborPainted = neighborIndices.map((i) => layout.cells[i]).filter((c) => paint.get(c.key) === targetCode);
        if (neighborPainted.length > 0 && neighborPainted.length <= 2) {
          for (const c of neighborPainted) {
            if (c.road !== ref.road || Math.abs(c.row - minRow) > 2) continue;
            const along = (c.x - ref.x) * rx + (c.z - ref.z) * rz;
            const across = (c.x - ref.x) * nx + (c.z - ref.z) * nz;
            if (Math.abs(along - mid0) <= half * 1.5) {
              if (along < minAlong) minAlong = along;
              if (along > maxAlong) maxAlong = along;
              if (across < minAcross) minAcross = across;
            }
          }
        }
      }
    }
  }

  const midAlong = (minAlong + maxAlong) / 2;
  // Its front: the road's edge for a plot beside the road, the front of its rows for the plot behind it
  const frontEdge = minAcross - ((minRow % PLOT_ROWS) + 0.5) * layout.cellUnits;
  const centerAcross = frontEdge + half;
  return {
    x: ref.x + rx * midAlong + nx * centerAcross,
    z: ref.z + rz * midAlong + nz * centerAcross,
    rotation: Math.atan2(-nx, -nz),
  };
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

/** The share of a tile's cells one zone must cover for the tile to become that zone's plot */
export const PLOT_COVER = 0.28;

/** A map whose tiles the painted cells turn into plots */
export interface CellPlotMap extends CellMap {
  readonly paintedZones?: boolean;
  getTileFlags(x: number, y: number): number;
  setTile(x: number, y: number, value: number, flags: number): void;
}

/**
 * The plots the painted cells make (owner, 15 Oct 2026: "ทำให้อาคารงอกบนช่องที่ทาในอำเภอเมืองก่อน เมืองจะได้โตได้"): a 16 m
 * tile whose cells are painted one zone for at least PLOT_COVER of them becomes that zone's plot (src/plots.ts), which
 * grows its own building month by month as plots do; a plot whose cells no longer are (cleared, or painted another
 * zone) is taken back, its building with it, so nothing is left behind. tiles: the tile indices to look at (those the
 * paint touched), or every tile that has cells. Returns the tiles it changed.
 */
export function syncCellPlots(map: CellPlotMap, layout: CellLayout, tiles?: Iterable<number>): number[] {
  const changed: number[] = [];
  let candidates: Iterable<number>;
  if (tiles) {
    const expanded = new Set<number>();
    for (const tile of tiles) {
      const tx = tile % map.width, ty = (tile - tx) / map.width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height) expanded.add(ny * map.width + nx);
      }
    }
    candidates = expanded;
  } else {
    candidates = new Set([...layout.byTile.keys(), ...layout.byPlotTile.keys()]);
  }
  for (const tile of candidates) {
    const x = tile % map.width, y = (tile - x) / map.width;
    if (isLineRoad(map.getTileValue(x, y))) continue;
    const allCells = layout.byPlotTile.get(tile) ?? layout.byTile.get(tile) ?? [];
    const counts = [0, 0, 0, 0];
    for (const index of allCells) counts[map.zoneCells?.get(layout.cells[index].key) ?? 0]++;
    let best = 1;
    for (let code = 2; code <= 3; code++) if (counts[code] > counts[best]) best = code;
    const minCells = Math.max(2, Math.ceil(PLOT_COVER * allCells.length));
    const qualifies = allCells.length > 0 && counts[best] >= minCells;
    const kind = qualifies ? zoneOfCode(best) : null;
    const value = map.getTileValue(x, y), plot = (map.getTileFlags(x, y) & ZONE_BIT) ? null : plotKindOfValue(value);
    if (kind && plot === kind) continue;
    if (kind && (plot !== null || isOpenLand(value))) map.setTile(x, y, plotTile(kind, 0), PLOT_FLAGS);
    else if (!kind && plot !== null) map.setTile(x, y, DIRT, 0);
    else continue;
    changed.push(tile);
  }
  return changed;
}
