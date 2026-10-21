/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The canals drawn in metres (docs/CANALS.md, docs/METRE_DRAWING_PLAN.md step 1's leftovers): the canal graph's
// segments as the lines the 3D view's canals follow (src/render3d/city/canals.ts) and the canal tool snaps to
// (src/game.js), exactly where they were dug, in world units (10 a tile, x east and z south). A canal's line stops
// where it leaves its own water (a river it was dug across stays the river's); two pieces meeting nearly straight on at
// a node go on as one line, and any other node more than one reaches is a junction, where the view lays a pad of water
// with curved banks. The tiles they lie on are theirs: canals dug before they were kept in metres are read from the
// rest of the tiles. Plain code, no DOM.

import type { Point } from "../roadGeometry";
import { unitsPerMetre } from "../units";
import type { RoadGraph } from "./roadGraph";
import { segmentStands, segmentTiles } from "./roadRaster";

export interface CanalMap {
  readonly width: number;
  readonly height: number;
  /** Metres a tile */
  readonly tileSizeM: number;
  /** Whether a tile is a dug canal's water or a bridge over it (src/canals.ts canalMarkStands) */
  canal(i: number): boolean;
  /** Whether a tile is any water or a bridge over it: what a canal dug across a river lies on */
  wet(i: number): boolean;
}

export interface CanalGraphLines {
  /** Each canal as points along its middle (world units) */
  lines: Point[][];
  /** Where canals meet, or one turns at a node (world units) */
  junctions: Point[];
  /** The canal tiles they lie on, in increasing order */
  tiles: number[];
}

/** Points along a canal at most this far apart (world units) */
const STEP = 2.5;
/** Two pieces meeting at a node at least this far from turning back (degrees) go on as one line */
const STRAIGHT_ON = 150;
/** How far along a piece the way it leaves a node is measured (world units) */
const ARM = 12;

const dist = (p: Point, q: Point): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}

/** The way a run leaves its start (end 0) or its end (end 1), a unit vector, measured ARM along it */
function wayOut(points: readonly Point[], end: 0 | 1): Point {
  const from = end === 0 ? points[0] : points[points.length - 1];
  let to = from;
  for (let k = 1; k < points.length; k++) {
    to = end === 0 ? points[k] : points[points.length - 1 - k];
    if (dist(from, to) >= ARM) break;
  }
  const d = dist(from, to) || 1;
  return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
}

/** The canals of a canal graph that still lie on water, as lines and junctions, and the canal tiles they take */
export function canalGraphLines(graph: RoadGraph, map: CanalMap): CanalGraphLines {
  const { width, height } = map, units = unitsPerMetre(map.tileSizeM), raster = { width, height, tileSizeM: map.tileSizeM };
  const tileAt = (p: Point): number => {
    const tx = Math.floor(p[0] / 10), ty = Math.floor(p[1] / 10);
    return tx >= 0 && ty >= 0 && tx < width && ty < height ? ty * width + tx : -1;
  };
  const onCanal = (p: Point): boolean => { const i = tileAt(p); return i >= 0 && map.canal(i); };
  // Where a canal passes from a to b out of (or into) its water, to a hundredth of a unit: the last point on the side a
  // lies on
  const edge = (a: Point, b: Point): Point => {
    const side = onCanal(a);
    let lo = 0, hi = 1;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if (onCanal([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m]) === side) lo = m; else hi = m;
    }
    return [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
  };
  const runs: Array<{ points: Point[]; a: number; b: number }> = [], own = new Set<number>();
  for (const id of [...graph.segments.keys()].sort((p, q) => p - q)) {
    if (!segmentStands(graph, id, raster, map.wet)) continue;
    for (const i of segmentTiles(graph, id, raster)) if (map.canal(i)) own.add(i);
    const s = graph.segment(id);
    const points = densify(graph.polyline(id, STEP / units).map(([x, z]): Point => [x * units, z * units]), STEP);
    let run: Point[] | null = null, start = -1;
    const push = (b: number): void => {
      if (run && run.length > 1 && dist(run[0], run[run.length - 1]) > 0.01) runs.push({ points: run, a: start, b });
      run = null;
    };
    points.forEach((p, k) => {
      const on = onCanal(p);
      if (on === (run !== null)) { if (run) run.push(p); return; }
      if (on) {
        run = k > 0 ? [edge(p, points[k - 1]), p] : [p];
        start = k > 0 ? -1 : s.a;
      } else {
        run!.push(edge(points[k - 1], p));
        push(-1);
      }
    });
    push(s.b);
  }

  // Each node's run ends, and which pairs go on through it as one line
  const endsAt = new Map<number, Array<{ run: number; end: 0 | 1; way: Point }>>();
  runs.forEach((run, r) => {
    for (const end of [0, 1] as const) {
      const node = end === 0 ? run.a : run.b;
      if (node < 0) continue;
      let list = endsAt.get(node);
      if (!list) endsAt.set(node, list = []);
      list.push({ run: r, end, way: wayOut(run.points, end) });
    }
  });
  const partner = new Map<string, string>(), junctions: Point[] = [];
  for (const [node, list] of [...endsAt].sort((p, q) => p[0] - q[0])) {
    if (list.length === 2 && list[0].run !== list[1].run) {
      const dot = list[0].way[0] * list[1].way[0] + list[0].way[1] * list[1].way[1];
      if (Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI >= STRAIGHT_ON) {
        const ka = `${list[0].run}:${list[0].end}`, kb = `${list[1].run}:${list[1].end}`;
        partner.set(ka, kb);
        partner.set(kb, ka);
        continue;
      }
    }
    if (list.length >= 2) {
      const n = graph.node(node);
      junctions.push([n.x * units, n.z * units]);
    }
  }
  // The runs joined into lines through the nodes they go on through
  const used = new Set<number>(), lines: Point[][] = [];
  const chain = (start: number, enter: 0 | 1): void => {
    const points: Point[] = [];
    let r = start, e = enter;
    for (;;) {
      used.add(r);
      const pts = e === 0 ? runs[r].points : [...runs[r].points].reverse();
      for (const p of pts) if (!points.length || dist(points[points.length - 1], p) > 1e-6) points.push(p);
      const next = partner.get(`${r}:${e === 0 ? 1 : 0}`);
      if (!next) break;
      const [t, te] = next.split(":").map(Number);
      if (used.has(t)) break;
      r = t;
      e = te as 0 | 1;
    }
    lines.push(points);
  };
  runs.forEach((_, r) => {
    if (used.has(r)) return;
    if (!partner.has(`${r}:0`)) chain(r, 0);
    else if (!partner.has(`${r}:1`)) chain(r, 1);
  });
  runs.forEach((_, r) => { if (!used.has(r)) chain(r, 0); });
  return { lines, junctions, tiles: [...own].sort((p, q) => p - q) };
}
