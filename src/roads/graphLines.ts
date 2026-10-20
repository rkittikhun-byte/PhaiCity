/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads as drawn (src/roads/roadGraph.ts) as the 3D view draws them (docs/METRE_DRAWING_PLAN.md 1.4): each road
// exactly where it was drawn, in world units, its junctions at the graph's nodes, never worked out again from its
// tiles. The roads that are only tiles (a map's own streets, roads laid before the graph) keep their lines read from
// the tiles (src/roadGeometry.ts networkOf, roadLines), on the tiles the graph's roads leave them, and the two meet:
// a tile road's end at a drawn road joins it in a junction, a drawn road's end at a tile road joins that, and where one
// crosses the other they cross in a junction. Plain code, no DOM, world units (10 a tile, x east and z south), so it
// runs in the road worker (src/render3d/city/road-worker.ts) as well as on the page.

import { isAnyRail, isAnyRoad, isLineRail, isLineRoad, isPowerCrossing } from "../roadTiles";
import { type JunctionArm, type JunctionShape, type LineMap, meetLine, networkOf, type Point, roadLines, type RoadLine, wayAlong }
  from "../roadGeometry";
import { TILE_UNITS, unitsPerMetre } from "../units";
import type { RoadGraph } from "./roadGraph";
import { segmentTiles } from "./roadRaster";

/** A drawn road between two nodes, or up to the edge of a tile that keeps its own model (a bridge, a level crossing) */
export interface GraphRun {
  points: Point[];
  level: number;
  /** Its stroke (src/roadPieces.ts), 0 for none */
  piece: number;
  /** The node at its start and at its end, -1 where it stops at such a tile's edge */
  a: number;
  b: number;
}

/** The drawn roads (or railways) of a map as the view draws them, plain data for the road worker */
export interface GraphLines {
  runs: GraphRun[];
  /** The nodes the runs reach: id, x and z */
  nodes: Array<[number, number, number]>;
  /** The tiles the drawn roads' strokes laid, in increasing order: the lines read from the tiles leave them out */
  tiles: number[];
}

/** What the drawn roads are matched against: the map's size, metres a tile, each tile's value and its piece */
export interface GraphMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM: number;
  value(i: number): number;
  piece(i: number): number;
  /** Each road tile's level (gameMap.roadLevels), which the road upgrade tool raises; without it a road is drawn at the
   * level it was drawn at */
  level?(i: number): number;
}

/** Points along a drawn road this far apart at most (world units), so its ribbon follows the ground */
const STEP = 2.5;
/** How far along a road the way it leaves a node is measured (world units) */
const ARM = 12;
/** A road's end this near a junction or another end on the line it meets joins them (world units) */
const JOIN = 6;
/** How far from its end a tile road or a drawn road looks for the road it meets (world units) */
const REACH = 15;
/** A crossing this near either road's end is left to the ends' own joins (world units) */
const END_CLEAR = 8;

const dist = (p: Point, q: Point): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Points no further apart than step, ends kept */
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}

/**
 * The map's drawn roads (rail false) or railways as the view draws them: each stroke still whole on the map, as points
 * along its segments, cut out of the tiles that keep their own model, and the tiles its strokes laid.
 */
export function graphLines(graph: RoadGraph, map: GraphMap, rail: boolean): GraphLines {
  const { width, height } = map, units = unitsPerMetre(map.tileSizeM);
  const any = rail ? isAnyRail : isAnyRoad;
  const plain = rail ? isLineRail : (v: number): boolean => isLineRoad(v) || isPowerCrossing(v);
  const tileAt = (p: Point): number => {
    const tx = Math.floor(p[0] / TILE_UNITS), ty = Math.floor(p[1] / TILE_UNITS);
    return tx >= 0 && ty >= 0 && tx < width && ty < height ? ty * width + tx : -1;
  };
  // Where a road passes from a to b out of what `same` holds for, to a hundredth of a unit: the last point it holds for
  const edge = (a: Point, b: Point, same: (p: Point) => boolean): Point => {
    let lo = 0, hi = 1;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if (same([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m])) lo = m; else hi = m;
    }
    return [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
  };
  const runs: GraphRun[] = [], reached = new Set<number>();
  const raster = { width, height, tileSizeM: map.tileSizeM };
  // A stroke is drawn from the graph while every tile each of its segments lies on is still a road or railway (one
  // bulldozed in part is left to its tiles' lines, src/roadGeometry.ts frozen), and then every tile it laid is the
  // graph's; a segment of no stroke (drawn over roads already there) is theirs
  const ids = [...graph.segments.keys()].sort((p, q) => p - q), whole = new Set<number>(), broken = new Set<number>();
  for (const id of ids) {
    const piece = graph.segment(id).piece ?? 0;
    if (!piece) continue;
    const tiles = segmentTiles(graph, id, raster);
    if (tiles.length && tiles.every((i) => any(map.value(i)))) whole.add(piece); else broken.add(piece);
  }
  for (const piece of broken) whole.delete(piece);
  const own: number[] = [];
  if (whole.size) for (let i = 0; i < width * height; i++) if (whole.has(map.piece(i))) own.push(i);
  for (const id of ids) {
    const s = graph.segment(id), piece = s.piece ?? 0;
    if (!whole.has(piece)) continue;
    const points = densify(graph.polyline(id, STEP / units).map(([x, z]): Point => [x * units, z * units]), STEP);
    const push = (run: Point[], level: number, a: number, b: number): void => {
      if (run.length < 2 || dist(run[0], run[run.length - 1]) < 0.01) return;
      runs.push({ points: run, level, piece, a, b });
      if (a >= 0) reached.add(a);
      if (b >= 0) reached.add(b);
    };
    // Each point's level: none off a plain tile (a bridge, a crossing keeps its own model), its own tile's level (raised
    // by the upgrade tool), and on a tile of another road it crosses, the level it comes with
    const levelAt = (p: Point, current: number): number => {
      const i = tileAt(p);
      if (i < 0 || !plain(map.value(i))) return 0;
      if (rail || !map.level) return s.level;
      return map.piece(i) === piece ? Math.max(1, map.level(i)) : current || s.level;
    };
    // ... cut into runs where it changes
    let run: Point[] | null = null, start = -1, level = 0;
    points.forEach((p, k) => {
      const now = levelAt(p, level);
      if (run && now === level) { run.push(p); return; }
      let from: Point | null = null;
      if (k > 0 && (run || now)) {
        const was = level;
        from = edge(points[k - 1], p, (q) => levelAt(q, was) === was);
      }
      if (run) { run.push(from!); push(run, level, start, -1); run = null; }
      if (now) { run = from ? [from, p] : [p]; start = from ? -1 : s.a; }
      level = now;
    });
    if (run) push(run, level, start, s.b);
  }
  const nodes = [...reached].sort((p, q) => p - q).map((id): [number, number, number] => {
    const n = graph.node(id);
    return [id, n.x * units, n.z * units];
  });
  return { runs, nodes, tiles: own };
}

/** The point of a line nearest p: the piece of it, how far along that, the point and how far off */
function nearestOn(line: readonly Point[], p: Point): { i: number; at: Point; d: number } {
  let best = { i: 1, at: line[0], d: Infinity };
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1)));
    const at: Point = [ax + dx * t, az + dz * t], d = dist(at, p);
    if (d < best.d) best = { i, at, d };
  }
  return best;
}

/** The way a line leaves its end (0 its start, 1 its last point) */
const wayOut = (line: readonly Point[], end: 0 | 1): Point => end === 0
  ? wayAlong(line as Point[], 1, line[0], ARM, true)
  : wayAlong(line as Point[], line.length - 1, line[line.length - 1], ARM, false);

const angleOf = (arm: JunctionArm): number => Math.atan2(arm.way[1], arm.way[0]);

/** The lines read from the tiles and the junctions between them (src/roadGeometry.ts roadLines) */
export interface DrawnLines {
  lines: RoadLine[];
  junctions: JunctionShape[];
}

/**
 * The lines read from the tiles the drawn roads leave (roadLines) and the drawn roads, as one: the drawn roads' runs
 * joined end to end through a node along their own stroke into lines, a junction at each node where more meet, and the
 * joins between the two kinds. Gives the lines, the junctions, the tiles' dead ends still standing and every
 * junction's middle.
 */
export function withGraph(tiles: DrawnLines, plates: Array<[number, number, number]>, graph: GraphLines,
  map: { width: number; height: number; value(i: number): number }, rail: boolean):
  DrawnLines & { plates: Array<[number, number, number]>; points: Point[] } {
  const { runs } = graph, base = tiles.lines.length;
  const lines: RoadLine[] = [...tiles.lines], junctions: JunctionShape[] = [...tiles.junctions];
  const nodeAt = new Map(graph.nodes.map(([id, x, z]): [number, Point] => [id, [x, z]]));

  // Each node's runs, by which of their ends lies there, and the way each leaves it
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
  // Two runs go on through a node as one road when they are of one stroke (a road split where another met it), of a
  // level, and leave it more or less opposite ways; roads of no stroke only when nearly straight on
  const partner = new Map<string, string>();
  for (const list of endsAt.values()) {
    const pairs: Array<[number, number, number]> = [];
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const ra = runs[list[a].run], rb = runs[list[b].run];
      if (list[a].run === list[b].run || ra.level !== rb.level) continue;
      const dot = list[a].way[0] * list[b].way[0] + list[a].way[1] * list[b].way[1];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      const stroke = ra.piece > 0 && ra.piece === rb.piece;
      if (stroke ? angle >= 100 : ra.piece === 0 && rb.piece === 0 && angle >= 150) pairs.push([angle, a, b]);
    }
    pairs.sort((p, q) => q[0] - p[0]);
    const used = new Set<number>();
    for (const [, a, b] of pairs) {
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      const ka = `${list[a].run}:${list[a].end}`, kb = `${list[b].run}:${list[b].end}`;
      partner.set(ka, kb); partner.set(kb, ka);
    }
  }
  // The runs joined into lines, and which end of its line each run's unjoined end is
  const lineOf = new Map<number, number>(), lineEnd = new Map<string, 0 | 1>();
  const chain = (start: number, enter: 0 | 1): void => {
    const points: Point[] = [], n = lines.length;
    let r = start, e = enter;
    lineEnd.set(`${start}:${enter}`, 0);
    for (;;) {
      lineOf.set(r, n);
      const own = e === 0 ? runs[r].points : [...runs[r].points].reverse();
      for (const p of own) { const last = points[points.length - 1]; if (!last || dist(last, p) > 1e-6) points.push(p); }
      const out = `${r}:${e === 0 ? 1 : 0}`, next = partner.get(out);
      const [t, te] = next ? next.split(":").map(Number) : [-1, 0];
      if (!next || lineOf.has(t)) { lineEnd.set(out, 1); break; }
      r = t; e = te as 0 | 1;
    }
    lines.push({ points, level: runs[start].level, rail, stretches: [] });
  };
  runs.forEach((_, r) => {
    if (lineOf.has(r)) return;
    if (!partner.has(`${r}:0`)) chain(r, 0);
    else if (!partner.has(`${r}:1`)) chain(r, 1);
  });
  runs.forEach((_, r) => { if (!lineOf.has(r)) chain(r, 0); });

  // A junction at each node where roads meet, the oldest stroke going on through it; a node only one road reaches is
  // its dead end, which may meet a road of the tiles
  const deadEnds: Array<{ line: number; end: 0 | 1; at: Point; used: boolean }> = [];
  for (const [node, list] of endsAt) {
    const at = nodeAt.get(node)!;
    const unjoined = list.filter((k) => !partner.has(`${k.run}:${k.end}`));
    if (list.length === 1 && unjoined.length === 1) {
      deadEnds.push({ line: lineOf.get(list[0].run)!, end: lineEnd.get(`${list[0].run}:${list[0].end}`) ?? 0, at, used: false });
      continue;
    }
    if (!unjoined.length && list.length <= 2) continue;
    let through: number | null = null, oldest = Infinity;
    const arms: JunctionArm[] = list.map((k) => {
      const run = runs[k.run], line = lineOf.get(k.run)!, key = `${k.run}:${k.end}`;
      if (!partner.has(key)) return { line, end: lineEnd.get(key) ?? 0, way: k.way, level: run.level };
      const age = run.piece || Number.MAX_SAFE_INTEGER;
      if (age < oldest || through === null) { oldest = age; through = line; }
      return { line, end: null, way: k.way, level: run.level };
    });
    arms.sort((p, q) => angleOf(p) - angleOf(q));
    junctions.push(shapeOf(at, arms, through));
  }

  // The joins between the drawn roads and the roads of the tiles
  const tileOf = (p: Point): number => {
    const tx = Math.floor(p[0] / TILE_UNITS), ty = Math.floor(p[1] / TILE_UNITS);
    return tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? -1 : ty * map.width + tx;
  };
  const own = new Set(graph.tiles);
  const plain = rail ? isLineRail : (v: number): boolean => isLineRoad(v) || isPowerCrossing(v);
  const beside = (i: number): number[] => {
    const x = i % map.width, y = (i - x) / map.width, out: number[] = [];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height) out.push(ny * map.width + nx);
    }
    return out;
  };
  const boundsOf = (points: readonly Point[]): number[] => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return [x0, x1, z0, z1];
  };
  const bounds = lines.map((line) => boundsOf(line.points));
  const reaches = (n: number, p: Point, reach: number): boolean => {
    const [x0, x1, z0, z1] = bounds[n];
    return p[0] >= x0 - reach && p[0] <= x1 + reach && p[1] >= z0 - reach && p[1] <= z1 + reach;
  };
  /** The nearest of some lines to p within reach: the line and its nearest point */
  const nearestLine = (from: number, to: number, p: Point, reach: number, skip = -1): { line: number; i: number; at: Point; d: number } | null => {
    let best: { line: number; i: number; at: Point; d: number } | null = null;
    for (let n = from; n < to; n++) {
      if (n === skip || lines[n].points.length < 2 || !reaches(n, p, reach)) continue;
      const near = nearestOn(lines[n].points, p);
      if (near.d <= reach && (!best || near.d < best.d)) best = { line: n, ...near };
    }
    return best;
  };
  /** The end of a line at p, if one lies there */
  const endAt = (from: number, to: number, p: Point, near: number): { line: number; end: 0 | 1 } | null => {
    for (let n = from; n < to; n++) {
      const pts = lines[n].points;
      if (pts.length < 2 || !reaches(n, p, near)) continue;
      if (dist(pts[0], p) <= near) return { line: n, end: 0 };
      if (dist(pts[pts.length - 1], p) <= near) return { line: n, end: 1 };
    }
    return null;
  };
  /** A line's points changed where it meets another road */
  const setLine = (n: number, points: Point[]): void => {
    lines[n] = { ...lines[n], points };
    bounds[n] = boundsOf(points);
  };
  const moveEnd = (n: number, end: 0 | 1, p: Point): void => {
    const pts = lines[n].points.slice();
    pts[end === 0 ? 0 : pts.length - 1] = p;
    setLine(n, pts);
  };
  /** The junction on a line within JOIN of p, if there is one */
  const junctionOn = (n: number, p: Point): JunctionShape | undefined =>
    junctions.find((j) => dist(j.at, p) <= JOIN && j.arms.some((arm) => arm.line === n));
  /** A road's end added to a junction, the arms kept round it */
  const addArm = (j: JunctionShape, n: number, end: 0 | 1): void => {
    const k = junctions.indexOf(j);
    const arms = [...j.arms, { line: n, end, way: wayOut(lines[n].points, end), level: lines[n].level }]
      .sort((p, q) => angleOf(p) - angleOf(q));
    junctions[k] = shapeOf(j.at, arms, j.through);
  };
  /** A junction where a road's end meets the middle of line t at p, t running on through it */
  const tee = (t: number, p: Point, n: number, end: 0 | 1): void => {
    const near = nearestOn(lines[t].points, p), line = lines[t].points;
    // ... or end to end, where that is t's end
    const at = dist(near.at, line[0]) <= 0.5 ? 0 : dist(near.at, line[line.length - 1]) <= 0.5 ? 1 : null;
    if (at !== null) { joinEnds(t, at, n, end, near.at); return; }
    const arms: JunctionArm[] = [
      { line: t, end: null, way: wayAlong(line, near.i, near.at, ARM, true), level: lines[t].level },
      { line: t, end: null, way: wayAlong(line, near.i, near.at, ARM, false), level: lines[t].level },
      { line: n, end, way: wayOut(lines[n].points, end), level: lines[n].level },
    ].sort((a, b) => angleOf(a) - angleOf(b));
    junctions.push(shapeOf(near.at, arms, t));
  };
  /** Two roads' ends joined end to end at p */
  const joinEnds = (a: number, ea: 0 | 1, b: number, eb: 0 | 1, p: Point): void => {
    const arms: JunctionArm[] = [
      { line: a, end: ea, way: wayOut(lines[a].points, ea), level: lines[a].level },
      { line: b, end: eb, way: wayOut(lines[b].points, eb), level: lines[b].level },
    ].sort((x, y) => angleOf(x) - angleOf(y));
    junctions.push(shapeOf(p, arms, null));
  };
  /** A line's end (n, end) run on along its own way to line t near q, its join there, and where that is */
  const meet = (n: number, end: 0 | 1, t: number, q: Point): void => {
    const met = meetLine(lines[n].points, end, lines[t].points, q);
    setLine(n, met);
    const p = end === 0 ? met[0] : met[met.length - 1], at = junctionOn(t, p);
    if (at) addArm(at, n, end);
    else tee(t, p, n, end);
  };

  // A tile road's dead end beside a drawn road's tile meets it: end to end with a drawn road's own end there, into a
  // junction already on it, or as a T on its middle
  const kept: Array<[number, number, number]> = [];
  for (const plate of plates) {
    const p: Point = [plate[0], plate[1]], i = tileOf(p);
    const touches = i >= 0 && beside(i).some((j) => own.has(j));
    const ending = touches ? endAt(0, base, p, 0.5) : null;
    const near = ending ? nearestLine(base, lines.length, p, REACH) : null;
    if (!ending || !near) {
      // ... and a lone tile a drawn road runs over is that road's
      if (!(touches && !endAt(0, base, p, 0.5) && nearestLine(base, lines.length, p, TILE_UNITS / 2))) kept.push(plate);
      continue;
    }
    const dead = deadEnds.find((d) => !d.used && d.line === near.line && dist(d.at, near.at) <= JOIN);
    if (dead) {
      dead.used = true;
      moveEnd(ending.line, ending.end, dead.at);
      joinEnds(ending.line, ending.end, dead.line, dead.end, dead.at);
    } else meet(ending.line, ending.end, near.line, near.at);
  }
  // A drawn road's dead end within a tile of another drawn road, whose tiles meet, runs on to it as a T
  for (const dead of deadEnds) {
    if (dead.used) continue;
    const other = nearestLine(base, lines.length, dead.at, TILE_UNITS, dead.line);
    const ends = other ? [lines[other.line].points[0], lines[other.line].points[lines[other.line].points.length - 1]] : [];
    if (!other || ends.some((e) => dist(e, other.at) <= JOIN)) continue;
    dead.used = true;
    meet(dead.line, dead.end, other.line, other.at);
  }
  // A drawn road's dead end on or beside a tile road's tile meets it: into a junction at that road's end, end to end
  // with its dead end, or as a T on its middle
  for (const dead of deadEnds) {
    if (dead.used) continue;
    const i = tileOf(dead.at);
    if (i < 0 || ![i, ...beside(i)].some((j) => !own.has(j) && plain(map.value(j)))) continue;
    const near = nearestLine(0, base, dead.at, REACH);
    if (!near) continue;
    dead.used = true;
    const ending = endAt(near.line, near.line + 1, near.at, JOIN);
    const plate = ending ? kept.findIndex((q) => dist([q[0], q[1]], near.at) <= JOIN) : -1;
    const at = ending && plate < 0 ? junctionOn(near.line, near.at) : undefined;
    if (ending && plate >= 0) {
      kept.splice(plate, 1);
      moveEnd(near.line, ending.end, dead.at);
      joinEnds(near.line, ending.end, dead.line, dead.end, dead.at);
    } else if (at) {
      const pts = lines[dead.line].points.slice();
      if (dead.end === 0) pts.unshift(at.at); else pts.push(at.at);
      setLine(dead.line, pts);
      addArm(at, dead.line, dead.end);
    } else meet(dead.line, dead.end, near.line, near.at);
  }
  // A drawn road crossing a tile road crosses it in a junction, the tile road running on through it
  for (let g = base; g < lines.length; g++) {
    const gp = lines[g].points;
    for (let t = 0; t < base; t++) {
      const tp = lines[t].points;
      if (tp.length < 2 || bounds[t][0] > bounds[g][1] || bounds[t][1] < bounds[g][0] ||
        bounds[t][2] > bounds[g][3] || bounds[t][3] < bounds[g][2]) continue;
      for (const x of crossings(gp, tp)) {
        if ([gp[0], gp[gp.length - 1], tp[0], tp[tp.length - 1]].some((e) => dist(e, x) <= END_CLEAR)) continue;
        if (junctions.some((j) => dist(j.at, x) <= JOIN)) continue;
        const ng = nearestOn(gp, x), nt = nearestOn(tp, x);
        const arms: JunctionArm[] = [
          { line: t, end: null, way: wayAlong(tp, nt.i, nt.at, ARM, true), level: lines[t].level },
          { line: t, end: null, way: wayAlong(tp, nt.i, nt.at, ARM, false), level: lines[t].level },
          { line: g, end: null, way: wayAlong(gp, ng.i, ng.at, ARM, true), level: lines[g].level },
          { line: g, end: null, way: wayAlong(gp, ng.i, ng.at, ARM, false), level: lines[g].level },
        ].sort((a, b) => angleOf(a) - angleOf(b));
        junctions.push(shapeOf(x, arms, t));
      }
    }
  }
  return { lines, junctions, plates: kept, points: junctions.map((j) => j.at) };
}

/**
 * Every road (rail false) or railway of a map as drawn: those of the graph exactly, and the others read from the tiles
 * the graph's roads leave them (src/roadGeometry.ts networkOf, roadLines), joined (withGraph). What the 3D view draws
 * (src/render3d/city/roadBuild.ts) and what a click snaps to (src/game.js networkLines).
 */
export function drawnRoads(map: LineMap, graph: GraphLines | null | undefined, rail: boolean):
  DrawnLines & { plates: Array<[number, number, number]>; points: Point[] } {
  let own: Uint8Array | null = null;
  if (graph?.tiles.length) {
    own = new Uint8Array(map.width * map.height);
    for (const i of graph.tiles) own[i] = 1;
  }
  const value = map.value.bind(map);
  const network = networkOf(own ? { ...map, value: (i) => (own![i] ? 0 : value(i)) } : map, rail);
  const drawn = roadLines(network);
  if (!graph?.runs.length) return { ...drawn, plates: network.plates, points: network.junctions };
  return withGraph(drawn, network.plates, graph, { width: map.width, height: map.height, value }, rail);
}

/** A junction: smooth where two roads meet end to end going on along one way */
function shapeOf(at: Point, arms: JunctionArm[], through: number | null): JunctionShape {
  const smooth = arms.length === 2 && arms.every((arm) => arm.end !== null) &&
    arms[0].way[0] * arms[1].way[0] + arms[0].way[1] * arms[1].way[1] < -Math.cos(6 * Math.PI / 180);
  return smooth ? { at, arms, through, smooth: true } : { at, arms, through };
}

/** Where two lines cross */
function crossings(p: readonly Point[], q: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i];
    const px0 = Math.min(ax, bx), px1 = Math.max(ax, bx), pz0 = Math.min(az, bz), pz1 = Math.max(az, bz);
    for (let j = 1; j < q.length; j++) {
      const [cx, cz] = q[j - 1], [dx, dz] = q[j];
      if (Math.max(cx, dx) < px0 || Math.min(cx, dx) > px1 || Math.max(cz, dz) < pz0 || Math.min(cz, dz) > pz1) continue;
      const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, denom = rx * sz - rz * sx;
      if (Math.abs(denom) < 1e-12) continue;
      const wx = cx - ax, wz = cz - az, s = (wx * sz - wz * sx) / denom, t = (wx * rz - wz * rx) / denom;
      if (s < 0 || s > 1 || t < 0 || t > 1) continue;
      const x: Point = [ax + rx * s, az + rz * s];
      if (!out.some((o) => dist(o, x) < 0.5)) out.push(x);
    }
  }
  return out;
}
