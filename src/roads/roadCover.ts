/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every road in the road graph (docs/NO_GRID_PLAN.md 0.1). The roads the player draws are kept in metres
// (src/roads/roadGraph.ts), but a map's own roads (the state's highways and railways, a city map's real streets), the
// roads of a save from before the graph and a road only partly laid were tiles alone, so a system that works on the
// graph (trips, power, water) would not see them. Here those tiles become segments of the graph, from the lines the 3D
// view draws them along (src/roadGeometry.ts networkOf, roadLines), each a segment of no stroke: the view still draws
// them from their tiles (src/roads/graphLines.ts draws strokes only), but where the player's roads meet them, they
// meet in the graph's own junctions. The tiles do not change.
//
// A road whose end lies beside another on the tiles has always been joined to it for the simulation (it steps from
// tile to tile); such an end is joined to the road beside it by a short straight segment of no stroke (RoadGraph link).
// Plain code, no DOM, the same graph from the same tiles and graph, so a city replays and a save opens the same.

import { type DrawnPath, type LineMap, networkOf, roadLines } from "../roadGeometry";
import { isAnyRail, isAnyRoad, isLineRail, isLineRoad, isPowerCrossing } from "../roadTiles";
import { RoadGraph, type Vec } from "./roadGraph";
import { segmentTiles } from "./roadRaster";

export interface CoverMap {
  readonly width: number;
  readonly height: number;
  /** Metres a tile */
  readonly tileSizeM: number;
  /** A tile's value (without its flags), by index */
  value(i: number): number;
  /** A road tile's level (gameMap.roadLevels), 1 without */
  level?(i: number): number;
  /** Whether a tile is the state's (gameMap.nationalTransport) */
  national?(i: number): boolean;
  /** The stroke a road tile was laid by (gameMap.roadPieces) and the tiles it was drawn along (gameMap.roadPaths) */
  piece?(i: number): number;
  path?(piece: number): DrawnPath | null;
}

/** A road tile whose middle lies this near a segment (tiles) is the segment's, as are the tiles a segment is laid on */
const NEAR_TILES = 0.75;
/** A line is kept within this of its smoothed points (metres) */
const STRAY_M = 0.25;
/** An end beside another road is joined to it within this (tiles) */
const JOIN_TILES = 1.25;
/** Times the ends are looked at again for a road beside them, as a join can bring one beside another */
const JOIN_PASSES = 4;

const dist = (p: Vec, q: Vec): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** What is known of each graph's tiles, until it changes (its version): the tiles its segments are laid on, and of the
 * road tiles beside them whether one lies near a segment (1) or not (2) */
const known = new WeakMap<RoadGraph, { version: number; key: string; raster: Uint8Array; near: Uint8Array }>();

/** The tiles the graph's segments are laid on (src/roads/roadRaster.ts segmentTiles), and what is known of the others */
function knownOf(graph: RoadGraph, map: CoverMap): { raster: Uint8Array; near: Uint8Array } {
  const key = `${map.width}x${map.height}@${map.tileSizeM}`, old = known.get(graph);
  if (old && old.version === graph.version && old.key === key) return old;
  const raster = new Uint8Array(map.width * map.height), tiles = { width: map.width, height: map.height, tileSizeM: map.tileSizeM };
  for (const id of graph.segments.keys()) for (const i of segmentTiles(graph, id, tiles)) raster[i] = 1;
  const entry = { version: graph.version, key, raster, near: new Uint8Array(map.width * map.height) };
  known.set(graph, entry);
  return entry;
}

/** Whether a road (or railway) tile has one beside it: a lone tile joins nothing, so the graph does without it */
function joined(map: CoverMap, i: number, kind: (v: number) => boolean): boolean {
  const x = i % map.width, y = (i - x) / map.width;
  return x > 0 && kind(map.value(i - 1)) || x < map.width - 1 && kind(map.value(i + 1)) ||
    y > 0 && kind(map.value(i - map.width)) || y < map.height - 1 && kind(map.value(i + map.width));
}

/** The ends of each graph with no road beside them, until it changes (joinEnds) */
const lonely = new WeakMap<RoadGraph, { version: number; nodes: Set<number> }>();

/**
 * The road (or railway) tiles the graph has: those its segments are laid on, and those whose middle lies within
 * NEAR_TILES of one of them (a slanted road's staircase, a line smoothed from its tiles)
 */
export function coveredTiles(graph: RoadGraph, map: CoverMap, rail: boolean): Uint8Array {
  const kind = rail ? isAnyRail : isAnyRoad, size = map.tileSizeM, { raster, near } = knownOf(graph, map);
  const covered = new Uint8Array(map.width * map.height);
  for (let i = 0; i < covered.length; i++) {
    if (!kind(map.value(i))) continue;
    if (raster[i]) { covered[i] = 1; continue; }
    if (!near[i]) {
      const x = i % map.width, y = (i - x) / map.width;
      near[i] = graph.segments.size && graph.nearest([(x + 0.5) * size, (y + 0.5) * size], NEAR_TILES * size) ? 1 : 2;
    }
    if (near[i] === 1) covered[i] = 1;
  }
  return covered;
}

/** Douglas–Peucker over the points between two kept ones: the fewest within tolerance of the line */
function simplify(points: Vec[], keep: Uint8Array, tolerance: number): Vec[] {
  const marks = keep.slice();
  marks[0] = marks[points.length - 1] = 1;
  const stack: Array<[number, number]> = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) if (keep[i] || i === points.length - 1) { stack.push([start, i]); start = i; }
  while (stack.length) {
    const [a, b] = stack.pop()!, [ax, az] = points[a], [bx, bz] = points[b], dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz) || 1;
    let far = -1, farthest = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / length;
      if (d > farthest) { farthest = d; far = i; }
    }
    if (far >= 0) { marks[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => marks[i]);
}

/** A line's points with the junctions on it put in as points of its own, each kept: each junction looked for only on
 * the pieces of the line in its square (bucket metres a side) or beside it */
function withJunctions(line: Vec[], junctions: Map<string, Vec[]>, bucket: number): { points: Vec[]; keep: Uint8Array } {
  // Where each junction lies on the line: the piece (ending at point i) and how far along it
  const found = new Map<Vec, { i: number; t: number; d: number }>();
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const x0 = Math.floor((Math.min(ax, bx) - 0.05) / bucket), x1 = Math.floor((Math.max(ax, bx) + 0.05) / bucket);
    const z0 = Math.floor((Math.min(az, bz) - 0.05) / bucket), z1 = Math.floor((Math.max(az, bz) + 0.05) / bucket);
    for (let bz2 = z0; bz2 <= z1; bz2++) for (let bx2 = x0; bx2 <= x1; bx2++) {
      for (const at of junctions.get(`${bx2},${bz2}`) ?? []) {
        const t = len2 ? Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - az) * dz) / len2)) : 0;
        const d = Math.hypot(ax + dx * t - at[0], az + dz * t - at[1]), was = found.get(at);
        if (d < 0.05 && (!was || d < was.d)) found.set(at, { i, t, d });
      }
    }
  }
  const points = line.slice(), keep: number[] = line.map(() => 0);
  // ... put in from the end back, so the earlier places stay where they were
  const places = [...found.entries()].sort((p, q) => q[1].i - p[1].i || q[1].t - p[1].t);
  for (const [at, { i, t }] of places) {
    if (t <= 1e-6) { keep[i - 1] = 1; points[i - 1] = at; continue; }
    if (t >= 1 - 1e-6) { keep[i] = 1; points[i] = at; continue; }
    points.splice(i, 0, at);
    keep.splice(i, 0, 1);
  }
  return { points, keep: Uint8Array.from(keep) };
}

/** What covering a graph did: the segments added for tiles it lacked, and the ends joined to a road beside them */
export interface Covered {
  added: number;
  linked: number;
}

/**
 * Puts every road (rail false) or railway tile of the map that the graph lacks into it (see above), and joins each end
 * that lies beside another road on the tiles to it. What it added.
 */
export function coverRoads(graph: RoadGraph, map: CoverMap, rail: boolean): Covered {
  let added = 0;
  if (lacking(graph, map, rail)) {
    added += addLines(graph, map, rail, coveredTiles(graph, map, rail));
    // ... and what no line was drawn along (a knot of junction tiles, a lone tile), tile to tile, so it has them all
    if (lacking(graph, map, rail)) added += addTiles(graph, map, rail, coveredTiles(graph, map, rail));
  }
  let linked = 0;
  for (let pass = 0; pass < JOIN_PASSES; pass++) {
    const n = joinEnds(graph, map, rail);
    linked += n;
    if (!n) break;
  }
  return { added, linked };
}

/** Whether a road (or railway) tile of the map is not the graph's (coveredTiles), looked for without a new array */
function lacking(graph: RoadGraph, map: CoverMap, rail: boolean): boolean {
  const kind = rail ? isAnyRail : isAnyRoad, size = map.tileSizeM, { raster, near } = knownOf(graph, map);
  for (let i = 0; i < raster.length; i++) {
    if (raster[i] || near[i] === 1 || !kind(map.value(i))) continue;
    if (!near[i]) {
      const x = i % map.width, y = (i - x) / map.width;
      near[i] = graph.segments.size && graph.nearest([(x + 0.5) * size, (y + 0.5) * size], NEAR_TILES * size) ? 1 : 2;
    }
    if (near[i] === 2 && joined(map, i, kind)) return true;
  }
  return false;
}

/** The lines the view draws along the tiles the graph lacks (networkOf, roadLines) added to it, and the tiles that keep
 * their own model; how many segments */
function addLines(graph: RoadGraph, map: CoverMap, rail: boolean, covered: Uint8Array): number {
  const { width, height } = map, size = map.tileSizeM, units = size / 10;
  const kind = rail ? isAnyRail : isAnyRoad;
  const plain = rail ? isLineRail : (v: number): boolean => isLineRoad(v) || isPowerCrossing(v);
  const levelOf = (i: number): number => (rail ? 1 : Math.max(1, Math.min(8, map.level?.(i) ?? 1)));
  let added = 0;
  // The lines of the tiles it lacks, as the view draws them, apart from the tiles it has
  const lineMap: LineMap = {
    width, height, value: (i) => (covered[i] ? 0 : map.value(i)), level: (i) => (covered[i] ? 0 : levelOf(i)),
    piece: map.piece ? (i) => (covered[i] ? 0 : map.piece!(i)) : undefined, path: map.path,
  };
  const network = networkOf(lineMap, rail);
  const { lines, junctions } = roadLines(network);
  // The junctions by the square of four tiles a side they lie in, to find those on a line
  const bucket = size * 4, ats = new Map<string, Vec[]>();
  for (const j of junctions) {
    const at: Vec = [j.at[0] * units, j.at[1] * units], key = `${Math.floor(at[0] / bucket)},${Math.floor(at[1] / bucket)}`;
    let list = ats.get(key);
    if (!list) ats.set(key, list = []);
    list.push(at);
  }
  for (const line of lines) {
    if (line.points.length < 2) continue;
    const metres = line.points.map((p): Vec => [p[0] * units, p[1] * units]);
    const { points, keep } = withJunctions(metres, ats, bucket);
    const kept = simplify(points, keep, STRAY_M);
    // ... the state's when most of its tiles are
    const tiles = line.stretches.flatMap((s) => network.stretches[s].tiles);
    const national = Boolean(map.national) && tiles.filter((i) => map.national!(i)).length * 2 > tiles.length;
    for (let k = 1; k < kept.length; k++) {
      if (dist(kept[k - 1], kept[k]) < 0.01) continue;
      graph.add({ from: kept[k - 1], to: kept[k], level: rail ? 1 : Math.max(1, line.level), ...(national ? { national } : {}), traced: true });
      added++;
    }
  }
  // ... and the tiles that keep their own model (a bridge, a level crossing), from middle to middle, and to the edge
  // between it and a road's tile, where that road's line runs up to it (networkOf)
  for (let i = 0; i < width * height; i++) {
    const v = map.value(i);
    if (covered[i] || !kind(v) || plain(v)) continue;
    const x = i % width, y = (i - x) / width, middle: Vec = [(x + 0.5) * size, (y + 0.5) * size];
    const level = levelOf(i), national = Boolean(map.national?.(i));
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx, w = map.value(j);
      if (covered[j] || !kind(w)) continue;
      const other: Vec = [(nx + 0.5) * size, (ny + 0.5) * size];
      if (plain(w)) graph.add({ from: middle, to: [(middle[0] + other[0]) / 2, (middle[1] + other[1]) / 2], level, ...(national ? { national } : {}), traced: true });
      else if (j > i) graph.add({ from: middle, to: other, level, ...(national ? { national } : {}), traced: true });
      else continue;
      added++;
    }
  }
  return added;
}

/**
 * Each road tile the graph still lacks joined to the road tiles beside it, middle to middle (or to the nearest point of
 * the road a covered one lies on): so the graph has every road tile with a road beside it, and the tiles' every join
 * (a road laid tile by tile is a chain of a segment a tile); how many segments
 */
function addTiles(graph: RoadGraph, map: CoverMap, rail: boolean, covered: Uint8Array): number {
  const { width, height } = map, size = map.tileSizeM;
  const kind = rail ? isAnyRail : isAnyRoad;
  const levelOf = (i: number): number => (rail ? 1 : Math.max(1, Math.min(8, map.level?.(i) ?? 1)));
  let added = 0;
  for (let i = 0; i < width * height; i++) {
    if (covered[i] || !kind(map.value(i))) continue;
    const x = i % width, y = (i - x) / width, middle: Vec = [(x + 0.5) * size, (y + 0.5) * size];
    const level = levelOf(i), national = Boolean(map.national?.(i));
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (!kind(map.value(j))) continue;
      const other: Vec = [(nx + 0.5) * size, (ny + 0.5) * size];
      if (!covered[j]) {
        if (j > i) { graph.add({ from: middle, to: other, level, ...(national ? { national } : {}), traced: true }); added++; }
        continue;
      }
      const on = graph.nearest(other, NEAR_TILES * size);
      graph.add({ from: middle, to: on ? on.point : other, level, ...(national ? { national } : {}), traced: true });
      added++;
    }
  }
  return added;
}

/**
 * Each end of a road (a node only one segment meets) that lies beside another road on the tiles, the tile it lies on
 * beside or on one that road is laid on, within JOIN_TILES of it, joined to it where it is nearest (RoadGraph link),
 * nearest road first. Not a road that meets its own segment's other end. How many were joined.
 */
export function joinEnds(graph: RoadGraph, map: CoverMap, rail: boolean): number {
  const size = map.tileSizeM, reach = JOIN_TILES * size, raster = { width: map.width, height: map.height, tileSizeM: size };
  const kind = rail ? isAnyRail : isAnyRoad;
  // The ends found with no road beside them while the graph stays as it is (each on a road tile then: one that is not
  // a road now is passed by anyway)
  let alone = lonely.get(graph);
  if (!alone || alone.version !== graph.version) lonely.set(graph, alone = { version: graph.version, nodes: new Set() });
  const ends: number[] = [];
  for (const nodeId of graph.nodes.keys()) if (graph.degree(nodeId) === 1 && !alone.nodes.has(nodeId)) ends.push(nodeId);
  let linked = 0;
  for (const nodeId of ends.sort((p, q) => p - q)) {
    if (!graph.nodes.has(nodeId) || graph.degree(nodeId) !== 1) continue;
    const node = graph.node(nodeId), p: Vec = [node.x, node.z], own = graph.segmentsAt(nodeId)[0], ownSeg = graph.segment(own);
    const tx = Math.floor(p[0] / size), ty = Math.floor(p[1] / size);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || !kind(map.value(ty * map.width + tx))) continue;
    const other = ownSeg.a === nodeId ? ownSeg.b : ownSeg.a;
    let best: { id: number; t: number; d: number } | null = null;
    for (const id of graph.segmentsNear(p, reach)) {
      const s = graph.segment(id);
      if (id === own || s.a === other || s.b === other || s.a === nodeId || s.b === nodeId) continue;
      const near = graph.nearestOn(id, p);
      if (near.distance > reach || (best && near.distance >= best.d)) continue;
      // ... beside it on the tiles: the end's tile, or one beside it, is one that road is laid on
      const tiles = new Set(segmentTiles(graph, id, raster));
      let beside = false;
      for (let dy = -1; dy <= 1 && !beside; dy++) for (let dx = -1; dx <= 1 && !beside; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 1) continue;
        beside = tiles.has((ty + dy) * map.width + tx + dx);
      }
      if (beside) best = { id, t: near.t, d: near.distance };
    }
    if (!best) {
      if (alone.version === graph.version) alone.nodes.add(nodeId);
      continue;
    }
    const s = graph.segment(best.id);
    if (graph.link(nodeId, best.id, best.t, Math.max(ownSeg.level, s.level), Boolean(ownSeg.national && s.national)) !== null) linked++;
  }
  return linked;
}

/** A city map's road and rail graphs given every road and railway of its tiles (coverRoads), made where it had none;
 * only a real-scale city map's (docs/NO_GRID_PLAN.md 4.4). What was added to each. */
export function coverCityRoads(map: {
  width: number; height: number; tileSizeM?: number | null; roadGraph?: RoadGraph | null; railGraph?: RoadGraph | null;
  roadLevels?: ArrayLike<number> | null; roadPieces?: ArrayLike<number> | null; nationalTransport?: ArrayLike<number> | null;
  roadPaths?: Record<number, unknown> | null; getTile(x: number, y: number): { getRawValue(): number };
  rawTileAt?(i: number): number;
}, isCity: boolean): { roads: Covered; rails: Covered } | null {
  if (!isCity || !map.tileSizeM) return null;
  const width = map.width, mask = 1023;
  const cover: CoverMap = {
    width, height: map.height, tileSizeM: map.tileSizeM,
    value: map.rawTileAt ? (i) => map.rawTileAt!(i) & mask : (i) => map.getTile(i % width, Math.floor(i / width)).getRawValue() & mask,
    level: (i) => map.roadLevels?.[i] || 1,
    national: (i) => Boolean(map.nationalTransport?.[i]),
    piece: (i) => map.roadPieces?.[i] ?? 0,
    path: (p) => (map.roadPaths?.[p] as DrawnPath | undefined) ?? null,
  };
  // ... a graph made only when there is a road (or railway) for it
  const roadGraph = map.roadGraph ?? new RoadGraph(), railGraph = map.railGraph ?? new RoadGraph();
  const roads = coverRoads(roadGraph, cover, false), rails = coverRoads(railGraph, cover, true);
  if (!map.roadGraph && roadGraph.segments.size) map.roadGraph = roadGraph;
  if (!map.railGraph && railGraph.segments.size) map.railGraph = railGraph;
  return { roads, rails };
}
