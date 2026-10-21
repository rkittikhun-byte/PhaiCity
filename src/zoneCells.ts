/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Zone cells along the roads, as in Cities: Skylines (owner, 14 Oct 2026: "ลดขนาดช่องลงอีก เหลือ 4x4 และ วาดสีทีละช่อง
// และ ให้ snap กันถนน", then "จาก 4x4 เหลือ 2x2", Mueang Khon Kaen first). Beside every road that zones may face, on
// both sides, rows of 4 m cells (CELL_M, about a Thai shophouse's frontage) lie along the road's smooth line
// (src/roadGeometry.ts), straight, slanted or curved, CELL_DEPTH deep (16 m: one plot, PLOT_ROWS rows); the player paints homes, shops or factories a cell at a time (the zoneCells command,
// src/cityCommands.ts). Where two roads' cells would overlap, the nearer road's win; no cell lies on a road, a railway,
// water, a building, outside the district or on land the city has not bought.
// A painted cell is kept by where its middle lies, on a 1 m raster of the map (its key), so the paint stays when the
// road is straightened or upgraded in place. A tile whose cells are painted enough becomes a plot that grows its own
// building (syncCellPlots; docs/ARCHITECTURE.md section 4, docs/METRE_DRAWING_PLAN.md). Plain code: no DOM, nothing
// random.

import { isOpenLand, plotKindOfValue, plotTile } from "./plots";
import { BLBNCNBIT as PLOT_FLAGS, ZONEBIT as ZONE_BIT } from "./tileFlags";
import { DIRT } from "./tileValues";
import { isLineRoad, networkOf, realUnits, roadLines, roadReach, smoothLine, type Point } from "./roadGeometry";
import { servesZones } from "./roadLevels";
import { graphLines, withGraph } from "./roads/graphLines";
import type { RoadGraph } from "./roads/roadGraph";
import { tileMetres, tileOfUnits, unitsOfTile, unitsPerMetre as metreUnits } from "./units";

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
  /** The roads and railways drawn in metres (src/roads/roadGraph.ts): the cells lie along them exactly as drawn */
  readonly roadGraph?: RoadGraph | null;
  readonly railGraph?: RoadGraph | null;
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
const unitsPerMetre = (map: CellMap): number => metreUnits(tileMetres(map));

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
      const tx = tileOfUnits(x0 + cell.nx * step), ty = tileOfUnits(z0 + cell.nz * step);
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

/** The raster key of a point (world units) */
export function rasterKey(map: CellMap, x: number, z: number): number {
  const r = RASTER_M * unitsPerMetre(map), width = Math.ceil(unitsOfTile(map.width) / r);
  return Math.floor(z / r) * width + Math.floor(x / r);
}

/** The raster keys of every point within tile (tx, ty): the keys a cell whose middle lies on that tile can have */
export function tileRasterKeys(map: CellMap, tx: number, ty: number): number[] {
  const r = RASTER_M * unitsPerMetre(map), width = Math.ceil(unitsOfTile(map.width) / r), keys: number[] = [];
  const x0 = Math.floor(unitsOfTile(tx) / r), x1 = Math.ceil(unitsOfTile(tx + 1) / r);
  const z0 = Math.floor(unitsOfTile(ty) / r), z1 = Math.ceil(unitsOfTile(ty + 1) / r);
  for (let rz = z0; rz < z1; rz++) for (let rx = x0; rx < x1; rx++) keys.push(rz * width + rx);
  return keys;
}

/**
 * Each stroke drawn in metres as one line (world units) from its first end, the end node of the lower id, with how far
 * along it each point lies: the cells along its roads are counted from there, a cell's length apart, so a road drawn
 * across it, a part of it raised a level or a road built on from its end never moves them (docs/METRE_DRAWING_PLAN.md
 * 3.1), and the paint kept by where a cell's middle lies stays on it.
 */
function strokeLines(graph: RoadGraph, units: number): Map<number, { points: Point[]; along: number[] }> {
  const byPiece = new Map<number, number[]>();
  for (const id of [...graph.segments.keys()].sort((a, b) => a - b)) {
    const piece = graph.segment(id).piece ?? 0;
    if (!piece) continue;
    let list = byPiece.get(piece);
    if (!list) byPiece.set(piece, list = []);
    list.push(id);
  }
  const out = new Map<number, { points: Point[]; along: number[] }>();
  for (const [piece, ids] of byPiece) {
    const at = new Map<number, number[]>();
    for (const id of ids) {
      const s = graph.segment(id);
      for (const node of [s.a, s.b]) {
        let list = at.get(node);
        if (!list) at.set(node, list = []);
        list.push(id);
      }
    }
    const ends = [...at.entries()].filter(([, list]) => list.length === 1).map(([node]) => node).sort((a, b) => a - b);
    let node = ends.length ? ends[0] : graph.segment(ids[0]).a;
    const used = new Set<number>(), points: Point[] = [];
    for (;;) {
      const next = (at.get(node) ?? []).find((id) => !used.has(id));
      if (next === undefined) break;
      used.add(next);
      const s = graph.segment(next), line = graph.polyline(next, 1).map(([x, z]): Point => [x * units, z * units]);
      if (s.a !== node) line.reverse();
      for (const p of line) {
        const last = points[points.length - 1];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-6) points.push(p);
      }
      node = s.a === node ? s.b : s.a;
    }
    const along = [0];
    for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    if (points.length > 1) out.set(piece, { points, along });
  }
  return out;
}

/** How far along a stroke's line (strokeLines) the point of it nearest p lies */
function alongStroke(stroke: { points: Point[]; along: number[] }, p: Point): number {
  let best = 0, bestD = Infinity;
  const { points, along } = stroke;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / l2));
    const d = Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]);
    if (d < bestD) { bestD = d; best = along[i - 1] + t * Math.sqrt(l2); }
  }
  return best;
}

/** Where along a line its cells' middles lie (world units from its start): for a road drawn in metres on its stroke's
 * steps (strokeLines), a cell's length apart from the stroke's first end, each whole on the line; for a road that is
 * only tiles centred on it, as many as fit */
function cellMiddles(line: readonly Point[], along: readonly number[], cellUnits: number,
  stroke: { points: Point[]; along: number[] } | undefined): number[] {
  const length = along[along.length - 1], out: number[] = [];
  if (!stroke) {
    const count = Math.floor(length / cellUnits), start = (length - count * cellUnits) / 2;
    for (let k = 0; k < count; k++) out.push(start + (k + 0.5) * cellUnits);
    return out;
  }
  // The line runs along its stroke or against it: compare where its start and a point a little along it lie
  let i = 1;
  while (i < line.length - 1 && along[i] < Math.min(length, cellUnits)) i++;
  const u0 = alongStroke(stroke, line[0]), sign = alongStroke(stroke, line[i]) >= u0 ? 1 : -1;
  const first = ((sign * (cellUnits / 2 - u0)) % cellUnits + cellUnits) % cellUnits, slack = 0.05 * cellUnits;
  for (let s = first; s <= length - cellUnits / 2 + slack; s += cellUnits) if (s >= cellUnits / 2 - slack) out.push(s);
  return out;
}

/** The two rasters a layout marks (the ground the roads take, the ground the cells cover), kept from one layout to the
 * next and cleared: new ones, 7 MB each on a city map, cost a fault of the system's memory at the first mark on each
 * page of them, half of the 0.3-0.6 s the cells took after each road drawn (19 Oct 2026) */
let rasters: [Uint8Array, Uint8Array] | null = null;
function rasterBits(bytes: number): [Uint8Array, Uint8Array] {
  if (rasters?.[0].length !== bytes) rasters = [new Uint8Array(bytes), new Uint8Array(bytes)];
  else { rasters[0].fill(0); rasters[1].fill(0); }
  return rasters;
}

/** The cells along the map's roads. owns: whether the city may build on a tile (its land and its district) */
export function cellLayout(map: CellMap, owns: (x: number, y: number) => boolean = () => true): CellLayout {
  const units = unitsPerMetre(map), cellUnits = CELL_M * units, rasterUnits = RASTER_M * units;
  // The roads at their real width on a real-scale city map (src/roadGeometry.ts), so the first row lies at its edge
  const real = realUnits(tileMetres(map));
  const rasterWidth = Math.ceil(unitsOfTile(map.width) / rasterUnits), rasterHeight = Math.ceil(unitsOfTile(map.height) / rasterUnits);
  // One bit a raster square: a 7.7 km map is 59 million of them
  const [bits, covers] = rasterBits(Math.ceil(rasterWidth * rasterHeight / 8));
  const taken = { get: (k: number): boolean => (bits[k >> 3] & (1 << (k & 7))) !== 0, set: (k: number): void => { bits[k >> 3] |= 1 << (k & 7); } };
  const keyOf = (x: number, z: number): number => {
    const rx = Math.floor(x / rasterUnits), rz = Math.floor(z / rasterUnits);
    return rx < 0 || rz < 0 || rx >= rasterWidth || rz >= rasterHeight ? -1 : rz * rasterWidth + rx;
  };
  // The tiles read once, and whether the city may build on each when first asked: the roads' lines below read each
  // tile a few times, through the map about 1.5 million calls on a city map (19 Oct 2026: most of the 0.3-0.6 s the
  // cells took after each road drawn)
  const tiles = new Uint16Array(map.width * map.height), mayBuild = new Uint8Array(map.width * map.height);
  for (let y = 0, i = 0; y < map.height; y++) for (let x = 0; x < map.width; x++, i++) tiles[i] = map.getTileValue(x, y);
  const ownsAt = (x: number, y: number): boolean => {
    const i = y * map.width + x;
    if (!mayBuild[i]) mayBuild[i] = owns(x, y) ? 2 : 1;
    return mayBuild[i] === 2;
  };
  const value = (i: number): number => tiles[i];
  const levels = map.roadLevels, pieces = map.roadPieces, paths = map.roadPaths;
  const piece = (i: number): number => pieces?.[i] ?? 0, level = (i: number): number => levels?.[i] ?? 1;
  // The roads drawn in metres exactly as drawn (src/roads/graphLines.ts, docs/METRE_DRAWING_PLAN.md 3.1), and the
  // roads that are only tiles read from the tiles they leave, joined as the 3D view joins them (drawnRoads)
  const drawnGraph = (graph: RoadGraph | null | undefined, rail: boolean) => graph?.segments.size
    ? graphLines(graph, { width: map.width, height: map.height, tileSizeM: tileMetres(map), value, piece, level }, rail) : null;
  const roadGraph = drawnGraph(map.roadGraph, false), railGraph = drawnGraph(map.railGraph, true);
  const graphOwn = new Uint8Array(roadGraph?.tiles.length ? map.width * map.height : 0);
  for (const i of roadGraph?.tiles ?? []) graphOwn[i] = 1;
  const roads = networkOf({ width: map.width, height: map.height, value: graphOwn.length ? (i) => (graphOwn[i] ? 0 : value(i)) : value,
    level, piece, path: (p) => paths?.[p] ?? null }, false);
  const rails = networkOf({ width: map.width, height: map.height, value, level: () => 0, piece,
    path: (p) => paths?.[p] ?? null }, true);
  // The roads as the 3D view draws them, one line where a road runs on through a junction (src/roadGeometry.ts
  // roadLines), so their rows of cells run on through it too; each cell still belongs to the stretch it faces
  const tileShapes = roadLines(roads);
  const shapes = roadGraph?.runs.length
    ? withGraph(tileShapes, roads.plates, roadGraph, { width: map.width, height: map.height, value }, false) : tileShapes;
  const drawn = shapes.lines;
  const stretchAt = new Map<number, number>();
  for (const stretch of roads.stretches) { const id = Math.min(...stretch.tiles); for (const tile of stretch.tiles) stretchAt.set(tile, id); }
  // The stretch a road drawn in metres faces: the lowest tile under its line
  const lowestTile = (points: readonly Point[]): number => points.reduce((low, [x, z]) => {
    const tx = tileOfUnits(x), ty = tileOfUnits(z);
    return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height ? Math.min(low, ty * map.width + tx) : low;
  }, map.width * map.height);
  const strokes = map.roadGraph?.segments.size ? strokeLines(map.roadGraph, units) : new Map<number, { points: Point[]; along: number[] }>();
  const lines = [
    ...drawn.map((road) => ({ rail: false, level: road.level, line: road.points,
      first: road.stretches.length ? Math.min(...roads.stretches[road.stretches[0]].tiles) : lowestTile(road.points),
      stroke: road.piece ? strokes.get(road.piece) : undefined })),
    ...rails.stretches.map((stretch) => ({ rail: true, level: 0, line: smoothLine(stretch.points), first: 0, stroke: undefined })),
    ...(railGraph?.runs ?? []).map((run) => ({ rail: true, level: 0, line: run.points, first: 0, stroke: undefined })),
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
  for (const [n, { rail, level, line, first, stroke }] of lines.entries()) {
    if (rail || !servesZones(level) || line.length < 2) continue;
    let road = first;
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const middles = cellMiddles(line, along, cellUnits, stroke);
    if (!middles.length) continue;
    const edge = roadReach(level, real) + EDGE_GAP;
    const corners = cornersOf.get(n) ?? [], cornerReach = 1.5 * (edge + CELL_DEPTH * cellUnits);
    let segment = 1;
    for (const s of middles) {
      while (segment < line.length - 1 && along[segment] < s) segment++;
      const [ax, az] = line[segment - 1], [bx, bz] = line[segment], span = along[segment] - along[segment - 1] || 1;
      const t = (s - along[segment - 1]) / span, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const tx = (bx - ax) / span, tz = (bz - az) / span, angle = Math.atan2(tx, tz);
      // The stretch of road it faces: the one whose tile lies under the road's line there
      road = stretchAt.get(tileOfUnits(pz) * map.width + tileOfUnits(px)) ?? road;
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
      const tx = tileOfUnits(x), ty = tileOfUnits(z);
      if (spot < 0 || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ||
          !cellGround(tiles[ty * map.width + tx]) || !ownsAt(tx, ty) ||
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
    const pv = tiles[plotTileIdx];
    if (!isOpenLand(pv) && plotKindOfValue(pv) === null) return false;
    const home = bucketOf(Math.floor(cell.x / cellUnits), Math.floor(cell.z / cellUnits));
    if (!bucket.has(home)) bucket.set(home, []);
    bucket.get(home)!.push([cell.x, cell.z]);
    footprint(cell.x, cell.z, sin, cos, halfV, true);
    const index = cells.length, tile = tileOfUnits(cell.z) * map.width + tileOfUnits(cell.x);
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
  const tx = tileOfUnits(x), tz = tileOfUnits(z), half = layout.cellUnits / 2;
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

/** How far from the mouse the round brush paints (metres): two cells either way */
export const BRUSH_RADIUS_M = 8;

/** The cells whose middles lie within radius (world units) of a stroke from one point to another (world units), the
 * round brush's (docs/METRE_DRAWING_PLAN.md 3.2), in the order of their keys */
export function cellsNear(layout: CellLayout, width: number, from: Point | null, to: Point, radius: number): number[] {
  const [ax, az] = from ?? to, [bx, bz] = to, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const keys = new Set<number>(), reach = Math.ceil(radius / unitsOfTile(1)) + 1;
  const steps = Math.max(1, Math.ceil(Math.sqrt(l2) / unitsOfTile(1)));
  const seen = new Set<number>();
  for (let k = 0; k <= steps; k++) {
    const tx = tileOfUnits(ax + dx * k / steps), tz = tileOfUnits(az + dz * k / steps);
    for (let oz = -reach; oz <= reach; oz++) for (let ox = -reach; ox <= reach; ox++) {
      const tile = (tz + oz) * width + tx + ox;
      if (seen.has(tile)) continue;
      seen.add(tile);
      for (const index of layout.byTile.get(tile) ?? []) {
        const cell = layout.cells[index];
        const t = l2 ? Math.max(0, Math.min(1, ((cell.x - ax) * dx + (cell.z - az) * dz) / l2)) : 0;
        if (Math.hypot(ax + dx * t - cell.x, az + dz * t - cell.z) <= radius) keys.add(cell.key);
      }
    }
  }
  return [...keys].sort((p, q) => p - q);
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

const layouts = new WeakMap<object, Array<{ signature: number; layout: CellLayout }>>();
/** How many layouts of a map are kept: callers asking with different land (the buildings' poses with all of it, the
 * view and the commands with the city's) would otherwise lay the cells again in turn */
const KEPT_LAYOUTS = 3;

/** The cells of a map, kept until its roads, buildings or land change */
export function cellsOf(map: CellMap, owns: (x: number, y: number) => boolean = () => true): CellLayout {
  const signature = layoutSignature(map, owns), kept = layouts.get(map) ?? [];
  const found = kept.find((entry) => entry.signature === signature);
  if (found) return found.layout;
  const layout = cellLayout(map, owns);
  layouts.set(map, [{ signature, layout }, ...kept].slice(0, KEPT_LAYOUTS));
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
 * the road's row-0 edge, and turned to face the road along its curve; and `cells`, how many cells along the road the
 * painted run reaches from its first to its last, for a building as wide as it (docs/METRE_DRAWING_PLAN.md 3.3:
 * a shophouse bay a cell, a 12 m house on three, eraBuildings.ts frontageVariant). `depthHalf`: half the building's
 * depth in world units, when it is not `size` tiles of 10 model units at `scale` (an era model is in metres, a tile 16 m
 * deep, so it stands its whole plot deep from the road's edge).
 */
export function cellPlotPose(
  map: CellMap,
  tx: number,
  ty: number,
  size: number,
  scale: number,
  depthHalf?: number,
): { x: number; z: number; rotation: number; cells: number } | null {
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
  const centerAcross = frontEdge + (depthHalf ?? half);
  return {
    x: ref.x + rx * midAlong + nx * centerAcross,
    z: ref.z + rz * midAlong + nz * centerAcross,
    rotation: Math.atan2(-nx, -nz),
    cells: Math.round((maxAlong - minAlong) / layout.cellUnits) + 1,
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

/**
 * Whether syncCellPlots could change anything round these tiles: a plot on one of them or beside it, or a painted cell
 * within reach tiles of them (a cell counts for a plot tile at most two tiles from its middle, plotTileOfCell). When
 * neither, the cells need not be laid again to find nothing changes.
 */
export function paintNear(map: CellPlotMap, tiles: Iterable<number>, reach = 6): boolean {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const tile of tiles) {
    const tx = tile % map.width, ty = (tile - tx) / map.width;
    x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx); y1 = Math.max(y1, ty);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || map.getTileFlags(nx, ny) & ZONE_BIT) continue;
      if (plotKindOfValue(map.getTileValue(nx, ny)) !== null) return true;
    }
  }
  if (!map.zoneCells?.size || x0 > x1) return false;
  const r = RASTER_M * unitsPerMetre(map), width = Math.ceil(unitsOfTile(map.width) / r);
  for (const key of map.zoneCells.keys()) {
    const tx = tileOfUnits((key % width + 0.5) * r), ty = tileOfUnits((Math.floor(key / width) + 0.5) * r);
    if (tx >= x0 - reach && tx <= x1 + reach && ty >= y0 - reach && ty <= y1 + reach) return true;
  }
  return false;
}

/** The share of a tile's cells one zone must cover for the tile to become that zone's plot; fewer do when they reach
 * every one of its PLOT_ROWS rows, one column of them 4 m along the road and the plot's 16 m deep being a shophouse
 * bay's plot (docs/METRE_DRAWING_PLAN.md 3.3: "ตึกแถว 1×4 ช่อง") */
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
    // ... and the rows each zone's cells reach, one bit a row
    const counts = [0, 0, 0, 0], rows = [0, 0, 0, 0];
    for (const index of allCells) {
      const code = map.zoneCells?.get(layout.cells[index].key) ?? 0;
      counts[code]++; rows[code] |= 1 << (layout.cells[index].row % PLOT_ROWS);
    }
    let best = 1;
    for (let code = 2; code <= 3; code++) if (counts[code] > counts[best]) best = code;
    const minCells = Math.max(2, Math.ceil(PLOT_COVER * allCells.length));
    const deep = counts[best] >= PLOT_ROWS && rows[best] === (1 << PLOT_ROWS) - 1;
    const qualifies = allCells.length > 0 && (counts[best] >= minCells || deep);
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
