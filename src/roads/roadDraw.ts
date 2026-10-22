/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Drawing a road or railway in metres (docs/METRE_DRAWING_PLAN.md 1.5): the clicked points as the line the road command
// lays (src/cityCommands.ts road), the tiles it will lay worked out exactly as the command works them out, its length
// and price by the metre, and whether it runs too close alongside a road already there (where a click lands:
// src/roads/roadSnap.ts). Plain code, no DOM: metres from the map's corner, x east and z south.

import { RoadGraph } from "./roadGraph";
import { segmentTiles, type RasterMap } from "./roadRaster";

export type Metres = [number, number];

/** A road as the road command takes it: its two ends, and a curve's two inner control points */
export interface DrawnLine {
  from: Metres;
  to: Metres;
  c1?: Metres;
  c2?: Metres;
}

const dist = (p: Metres, q: Metres): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
const round2 = (v: number): number => Math.round(v * 100) / 100;
const roundPoint = (p: Metres): Metres => [round2(p[0]), round2(p[1])];

/**
 * The line through the clicked points (src/drawModes.ts): two make a straight road, three a curve bent towards the
 * middle one (the quadratic curve through them, as a cubic), four a curve from the first to the last bent by the two
 * between (an S or a sweep). Each to the centimetre, as the command keeps it.
 */
export function lineOfPoints(points: readonly Metres[]): DrawnLine | null {
  if (points.length < 2) return null;
  const a = points[0], b = points[points.length - 1];
  if (points.length === 2) return { from: roundPoint(a), to: roundPoint(b) };
  if (points.length === 3) {
    const p = points[1];
    return { from: roundPoint(a), to: roundPoint(b), c1: roundPoint([a[0] + (p[0] - a[0]) * 2 / 3, a[1] + (p[1] - a[1]) * 2 / 3]),
      c2: roundPoint([b[0] + (p[0] - b[0]) * 2 / 3, b[1] + (p[1] - b[1]) * 2 / 3]) };
  }
  return { from: roundPoint(a), to: roundPoint(b), c1: roundPoint(points[1]), c2: roundPoint(points[2]) };
}

/** A line on a graph of its own, as the road command works out its tiles */
function draft(line: DrawnLine): { graph: RoadGraph; segments: number[] } {
  const graph = new RoadGraph();
  return { graph, segments: graph.add({ ...line, level: 1 }).segments };
}

/**
 * A line as the road command lays it (src/cityCommands.ts road) on the roads already drawn (graph, the map's road or
 * rail graph; none for an empty map): the tiles it will be laid on, from its start to its end (tile index y * width +
 * x), and its length (metres), of the road as the graph will hold it, joined to the roads its ends and crossings meet
 * (RoadGraph tryAdd); null when it is too short to be a road
 */
export function lineOnGraph(line: DrawnLine, map: RasterMap, graph?: RoadGraph | null, level = 1):
  { tiles: number[]; length: number } | null {
  const g = graph ?? new RoadGraph();
  return g.tryAdd({ ...line, level }, ({ segments }) => segments.length ? {
    tiles: segments.flatMap((id) => segmentTiles(g, id, map)), length: segments.reduce((sum, id) => sum + g.length(id), 0),
  } : null);
}

/** The tiles a line will be laid on, from its start to its end (tile index y * width + x), exactly as the road command
 * lays them on the roads already drawn (graph) */
export function lineTiles(line: DrawnLine, map: RasterMap, graph?: RoadGraph | null): number[] {
  return lineOnGraph(line, map, graph)?.tiles ?? [];
}

/** A line's length on the ground (metres) */
export function lineLength(line: DrawnLine): number {
  const { graph, segments } = draft(line);
  return segments.reduce((sum, id) => sum + graph.length(id), 0);
}

/** Points along a line about every step metres, its ends included */
export function linePoints(line: DrawnLine, step: number): Metres[] {
  const { graph, segments } = draft(line);
  return segments.flatMap((id, n) => {
    const pts = graph.polyline(id, step);
    const out: Metres[] = graph.segment(id).shape === "line" ? densify(pts as Metres[], step) : pts as Metres[];
    return n === 0 ? out : out.slice(1);
  });
}

function densify(points: Metres[], step: number): Metres[] {
  const out: Metres[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

/**
 * What a road or railway costs by the metre (owner, 20 Oct 2026: drawn in metres, priced by its length, not its
 * staircase of tiles): the tool's price a tile for each tile's length of it over new ground, and on top whatever a tile
 * costs more than that (a bridge, woods cleared). tileCosts: what laying each of its tiles costs, 0 where a road is
 * already.
 */
export function linePrice(tilePrice: number, tileSizeM: number, metres: number, tileCosts: readonly number[]): number {
  if (!tileCosts.length) return 0;
  const fresh = tileCosts.filter((cost) => cost > 0).length, extra = tileCosts.reduce((sum, cost) => sum + Math.max(0, cost - tilePrice), 0);
  return Math.round(tilePrice * metres / tileSizeM * fresh / tileCosts.length) + extra;
}

/**
 * Where a line runs alongside a road already there, closer than gap (metres) between their middle lines and within
 * 25° of its way, for more than gap along it: such roads share their tiles, and the simulation takes them for one road
 * (owner, 20 Oct 2026). Its ends, where it joins a road, are let be within gap of it. The points of the line that are
 * too close, or none.
 */
export function alongside(line: DrawnLine, lines: readonly (readonly Metres[])[], gap: number): Metres[] {
  const step = gap / 4, pts = linePoints(line, step), from = pts[0], to = pts[pts.length - 1];
  // Only the roads whose bounds come within gap of it
  const box = (points: readonly Metres[]): number[] => [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))];
  const own = box(pts);
  lines = lines.filter((other) => {
    if (other.length < 2) return false;
    const [x0, x1, z0, z1] = box(other);
    return x0 <= own[1] + gap && x1 >= own[0] - gap && z0 <= own[3] + gap && z1 >= own[2] - gap;
  });
  const close: Metres[] = [];
  let run: Metres[] = [];
  const flush = (): void => { if (run.length * step > gap) close.push(...run); run = []; };
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    if (dist(p, from) <= gap * 1.5 || dist(p, to) <= gap * 1.5) { flush(); continue; }
    const q = pts[Math.min(pts.length - 1, k + 1)], r = pts[Math.max(0, k - 1)];
    const wx = q[0] - r[0], wz = q[1] - r[1], wl = Math.hypot(wx, wz) || 1;
    let near = false;
    for (const other of lines) {
      for (let i = 1; i < other.length && !near; i++) {
        const a = other[i - 1], b = other[i], dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
        if (!len2) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
        if (Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]) >= gap) continue;
        const cos = Math.abs(wx * dx + wz * dz) / (wl * Math.sqrt(len2));
        if (cos >= Math.cos(25 * Math.PI / 180)) near = true;
      }
      if (near) break;
    }
    if (near) run.push(p); else flush();
  }
  flush();
  return close;
}
