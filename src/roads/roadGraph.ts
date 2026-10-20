/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads as the player draws them, in metres (docs/METRE_DRAWING_PLAN.md 4.1, step 1.1): nodes where roads end or
// meet, and segments between two nodes, each a straight line or a cubic Bézier curve. What is drawn stays where it is
// drawn: a new road that crosses an old one splits the old one at the crossing into two segments of exactly its old
// shape (de Casteljau), an end dropped within MERGE_M of a node joins it, and an end dropped on the middle of a road
// splits that road there into a T. The tiles the simulation reads are made from this graph (roadRaster.ts).
//
// Plain code: no DOM, nothing random, the same graph from the same calls in the same order (ids count up), so a city
// replays and a server can run it. x runs east and z south, as the 3D view's, in metres from the map's corner.

export type Vec = readonly [number, number];

export interface RoadNode {
  readonly id: number;
  x: number;
  z: number;
}

export type SegmentShape = "line" | "curve";

export interface RoadSegment {
  readonly id: number;
  a: number;
  b: number;
  shape: SegmentShape;
  /** A curve's two inner control points (metres); none for a line */
  c1?: Vec;
  c2?: Vec;
  /** The road's level, 1 laterite … 8 tollway (src/roadLevels.ts) */
  level: number;
  /** A road the state built (gameMap.nationalTransport): no upkeep, no wear */
  national?: boolean;
  /** The stroke it was drawn in (src/roadPieces.ts piece), kept by both halves when it is split */
  piece?: number;
}

/** What a new road is drawn as: two ends for a line; two ends and two inner control points for a curve */
export interface DrawnRoad {
  from: Vec;
  to: Vec;
  c1?: Vec;
  c2?: Vec;
  level: number;
  national?: boolean;
  piece?: number;
}

/** What adding a road did: its own segments, end to end, and the old segments split to meet it (each old id replaced
 * by the two new ones), so undo and the tiles can follow */
export interface AddResult {
  segments: number[];
  split: { old: number; into: [number, number] }[];
}

/** Where a graph stood, to take it back to (RoadGraph mark, undo): the ids it was to give next, and the segments it had
 * then that were split or removed since */
export interface RoadMark {
  readonly nodes: number;
  readonly segments: number;
  readonly removed: RoadSegment[];
}

/** An end this near a node joins it (metres) */
export const MERGE_M = 0.5;
/** A crossing this near a segment's end is taken as that end's node rather than splitting it into a stub (metres) */
const END_M = 1;
/** The side of a bucket of the spatial index (metres) */
const BUCKET_M = 64;
/** Steps a curve is cut into to look for crossings, before each crossing is found exactly */
const CURVE_STEPS = 32;

/** A length to the millimetre */
const mm = (v: number): number => Math.round(v * 1000) / 1000;
const sub = (p: Vec, q: Vec): [number, number] => [p[0] - q[0], p[1] - q[1]];
const lerp = (p: Vec, q: Vec, t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const dist = (p: Vec, q: Vec): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
const cross = (p: Vec, q: Vec): number => p[0] * q[1] - p[1] * q[0];

/** The four control points of a segment (a line's inner ones a third of the way along) */
function controls(graph: RoadGraph, s: RoadSegment): [Vec, Vec, Vec, Vec] {
  const a = graph.node(s.a), b = graph.node(s.b), pa: Vec = [a.x, a.z], pb: Vec = [b.x, b.z];
  if (s.shape === "curve" && s.c1 && s.c2) return [pa, s.c1, s.c2, pb];
  return [pa, lerp(pa, pb, 1 / 3), lerp(pa, pb, 2 / 3), pb];
}

/** A point of a cubic Bézier at t */
export function bezierAt(p: readonly Vec[], t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/** A cubic Bézier cut at t into two of exactly its shape (de Casteljau) */
export function splitBezier(p: readonly Vec[], t: number): [[Vec, Vec, Vec, Vec], [Vec, Vec, Vec, Vec]] {
  const p01 = lerp(p[0], p[1], t), p12 = lerp(p[1], p[2], t), p23 = lerp(p[2], p[3], t);
  const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t), m = lerp(p012, p123, t);
  return [[p[0], p01, p012, m], [m, p123, p23, p[3]]];
}

/** Where two straight pieces p0-p1 and q0-q1 cross, as (s along p, t along q), or null; ends included */
function crossing(p0: Vec, p1: Vec, q0: Vec, q1: Vec): [number, number] | null {
  const r = sub(p1, p0), d = sub(q1, q0), denom = cross(r, d);
  if (Math.abs(denom) < 1e-12) return null;
  const w = sub(q0, p0), s = cross(w, d) / denom, t = cross(w, r) / denom;
  const eps = 1e-9;
  return s >= -eps && s <= 1 + eps && t >= -eps && t <= 1 + eps ? [Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, t))] : null;
}

/** A graph's data (RoadGraph toJSON) moved by dx east and dz south (metres), as a city moved into a bigger frame of its
 * district is (src/cityFrame.ts) */
export function movedGraphData(data: ReturnType<RoadGraph["toJSON"]>, dx: number, dz: number): ReturnType<RoadGraph["toJSON"]> {
  const round = (v: number): number => Math.round(v * 1000) / 1000;
  return {
    nodes: data.nodes.map(([id, x, z]) => [id, round(x + dx), round(z + dz)]),
    segments: data.segments.map((row) => {
      const c = row[4] as number[];
      return [...row.slice(0, 4), c.length === 4 ? [round(c[0] + dx), round(c[1] + dz), round(c[2] + dx), round(c[3] + dz)] : [],
        ...row.slice(5)];
    }),
    next: [data.next[0], data.next[1]],
  };
}

export class RoadGraph {
  readonly nodes = new Map<number, RoadNode>();
  readonly segments = new Map<number, RoadSegment>();
  /** Counts up each time a road is added or removed, so whatever draws the graph knows when to draw it again */
  version = 0;
  private nextNode = 1;
  private nextSegment = 1;
  /** The mark whose removed segments are being kept (mark) */
  private watched: RoadMark | null = null;
  /** Segment ids by the buckets their bounds touch */
  private buckets = new Map<number, Set<number>>();
  private bucketsOf = new Map<number, number[]>();

  node(id: number): RoadNode {
    const n = this.nodes.get(id);
    if (!n) throw new RangeError(`No road node ${id}`);
    return n;
  }

  segment(id: number): RoadSegment {
    const s = this.segments.get(id);
    if (!s) throw new RangeError(`No road segment ${id}`);
    return s;
  }

  /** The segments meeting at a node, by id */
  segmentsAt(node: number): number[] {
    const out: number[] = [];
    for (const s of this.segments.values()) if (s.a === node || s.b === node) out.push(s.id);
    return out.sort((x, y) => x - y);
  }

  /** The segment's control points (a line's inner ones on it) */
  controlsOf(id: number): [Vec, Vec, Vec, Vec] { return controls(this, this.segment(id)); }

  /** A point along a segment, t from its node a (0) to b (1) */
  pointAt(id: number, t: number): [number, number] {
    const s = this.segment(id);
    if (s.shape === "line") {
      const a = this.node(s.a), b = this.node(s.b);
      return lerp([a.x, a.z], [b.x, b.z], t);
    }
    return bezierAt(controls(this, s), t);
  }

  /** A segment as points every `step` metres or so, ends included (a line is its two ends) */
  polyline(id: number, step = 1): [number, number][] {
    const s = this.segment(id);
    if (s.shape === "line") return [this.pointAt(id, 0), this.pointAt(id, 1)];
    const n = Math.max(2, Math.ceil(this.length(id) / step));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push(this.pointAt(id, i / n));
    return pts;
  }

  /** A segment's length in metres */
  length(id: number): number {
    const s = this.segment(id);
    if (s.shape === "line") {
      const a = this.node(s.a), b = this.node(s.b);
      return Math.hypot(b.x - a.x, b.z - a.z);
    }
    let total = 0, prev = this.pointAt(id, 0);
    for (let i = 1; i <= 64; i++) { const p = this.pointAt(id, i / 64); total += dist(prev, p); prev = p; }
    return total;
  }

  /** The nearest point on a segment to p: its t, the point and how far it is */
  nearestOn(id: number, p: Vec): { t: number; point: [number, number]; distance: number } {
    const s = this.segment(id);
    if (s.shape === "line") {
      const a = this.node(s.a), b = this.node(s.b), ab = sub([b.x, b.z], [a.x, a.z]), len2 = ab[0] * ab[0] + ab[1] * ab[1];
      const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a.x) * ab[0] + (p[1] - a.z) * ab[1]) / len2)) : 0;
      const point = this.pointAt(id, t);
      return { t, point, distance: dist(point, p) };
    }
    // A curve: the nearest of many points, then narrowed down round it
    let bestT = 0, best = Infinity;
    for (let i = 0; i <= CURVE_STEPS * 2; i++) {
      const t = i / (CURVE_STEPS * 2), d = dist(this.pointAt(id, t), p);
      if (d < best) { best = d; bestT = t; }
    }
    let lo = Math.max(0, bestT - 1 / (CURVE_STEPS * 2)), hi = Math.min(1, bestT + 1 / (CURVE_STEPS * 2));
    for (let k = 0; k < 40; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (dist(this.pointAt(id, m1), p) < dist(this.pointAt(id, m2), p)) hi = m2; else lo = m1;
    }
    const t = (lo + hi) / 2, point = this.pointAt(id, t);
    return { t, point, distance: dist(point, p) };
  }

  /** The node within reach of p, nearest first, or null */
  nodeNear(p: Vec, reach = MERGE_M): RoadNode | null {
    let best: RoadNode | null = null, bestD = reach;
    for (const n of this.nodes.values()) {
      const d = Math.hypot(n.x - p[0], n.z - p[1]);
      if (d <= bestD) { best = n; bestD = d; }
    }
    return best;
  }

  /** The segments whose bounds come within reach of p (metres), by id */
  segmentsNear(p: Vec, reach: number): number[] {
    const found = new Set<number>();
    for (const key of this.keysFor(p[0] - reach, p[1] - reach, p[0] + reach, p[1] + reach)) {
      for (const id of this.buckets.get(key) ?? []) found.add(id);
    }
    return [...found].sort((x, y) => x - y);
  }

  /** The nearest point on any road within reach of p: the segment, its t, the point and how far, or null */
  nearest(p: Vec, reach: number): { segment: number; t: number; point: [number, number]; distance: number } | null {
    let best: { segment: number; t: number; point: [number, number]; distance: number } | null = null;
    for (const id of this.segmentsNear(p, reach)) {
      const near = this.nearestOn(id, p);
      if (near.distance <= reach && (!best || near.distance < best.distance)) best = { segment: id, ...near };
    }
    return best;
  }

  /**
   * Adds a road drawn from `from` to `to` (a curve through its inner control points c1 and c2). Its ends join a node
   * within MERGE_M, or split a road they land on into a T; where it crosses roads, both are split at the crossing.
   * Old roads keep their shapes exactly.
   */
  add(road: DrawnRoad): AddResult {
    this.version++;
    const split: AddResult["split"] = [];
    const a = this.endNode(road.from, split), b = this.endNode(road.to, split);
    if (a === b) return { segments: [], split };
    const pa = this.node(a), pb = this.node(b);
    const curve = road.c1 && road.c2;
    const draft: RoadSegment = {
      id: -1, a, b, shape: curve ? "curve" : "line", level: road.level,
      ...(curve ? { c1: road.c1, c2: road.c2 } : {}),
      ...(road.national ? { national: true } : {}), ...(road.piece !== undefined ? { piece: road.piece } : {}),
    };
    // Where it crosses the roads already there, along itself (t) and along each of them
    const ownControls = curve ? [[pa.x, pa.z], road.c1!, road.c2!, [pb.x, pb.z]] as Vec[] : null;
    const at = (t: number): [number, number] => ownControls ? bezierAt(ownControls, t) : lerp([pa.x, pa.z], [pb.x, pb.z], t);
    const crossings = this.crossingsOf(at, curve ? CURVE_STEPS : 1, a, b);
    // Split each road it crosses at the crossing, nearest the start first, and collect the nodes along the new road
    const stops: { t: number; node: number }[] = [{ t: 0, node: a }];
    for (const c of crossings) {
      // A road crossed twice was split at the first crossing: the second lies on one of its halves now
      const point = at(c.t);
      let segment = c.segment, u = c.u;
      if (!this.segments.has(segment)) {
        const live = (id: number): number[] =>
          this.segments.has(id) ? [id] : (split.find(s => s.old === id)?.into ?? []).flatMap(live);
        const pieces = live(segment);
        if (!pieces.length) continue;
        segment = pieces.reduce((best, id) => this.nearestOn(id, point).distance < this.nearestOn(best, point).distance ? id : best);
        u = this.nearestOn(segment, point).t;
      }
      const node = this.splitAt(segment, u, split);
      if (node !== a && node !== b && !stops.some(s => s.node === node)) stops.push({ t: c.t, node });
    }
    stops.push({ t: 1, node: b });
    stops.sort((x, y) => x.t - y.t);
    // Lay the new road as one segment between each pair of stops, each a piece of its own shape
    const made: number[] = [];
    let rest = ownControls;
    let restFrom = 0;
    for (let i = 1; i < stops.length; i++) {
      const s0 = stops[i - 1], s1 = stops[i];
      if (s0.node === s1.node) continue;
      const seg: RoadSegment = { ...draft, id: this.nextSegment++, a: s0.node, b: s1.node };
      if (rest) {
        // The part of the curve from s0 to s1, cut out of what is left of it
        const local = (s1.t - restFrom) / (1 - restFrom);
        if (i < stops.length - 1) {
          const [head, tail] = splitBezier(rest, local);
          seg.c1 = head[1]; seg.c2 = head[2];
          rest = tail; restFrom = s1.t;
        } else { seg.c1 = rest[1]; seg.c2 = rest[2]; }
      }
      this.put(seg);
      made.push(seg.id);
    }
    return { segments: made, split };
  }

  /** Removes a segment, and its nodes when nothing else meets there */
  remove(id: number): void {
    const s = this.segment(id);
    this.version++;
    this.keep(s);
    this.unindex(id);
    this.segments.delete(id);
    for (const n of [s.a, s.b]) if (this.segmentsAt(n).length === 0) this.nodes.delete(n);
  }

  /**
   * Where the graph stands now, to take it back to with undo: everything added from now on has a higher id (ids only
   * count up), and each segment it has now that is split or removed is kept in the mark, until the next mark.
   */
  mark(): RoadMark {
    this.watched = { nodes: this.nextNode, segments: this.nextSegment, removed: [] };
    return this.watched;
  }

  /** The graph taken back to a mark: what was added since gone, what was split or removed since back as it was */
  undo(mark: RoadMark): void {
    this.version++;
    for (const id of [...this.segments.keys()]) {
      if (id < mark.segments) continue;
      this.unindex(id);
      this.segments.delete(id);
    }
    for (const id of [...this.nodes.keys()]) if (id >= mark.nodes) this.nodes.delete(id);
    for (const s of mark.removed) this.put({ ...s });
    this.nextNode = mark.nodes;
    this.nextSegment = mark.segments;
    if (this.watched === mark) this.watched = null;
  }

  /** The graph as plain data, in id order, for saves (JSON) */
  toJSON(): { nodes: [number, number, number][]; segments: (number | string | number[] | undefined)[][]; next: [number, number] } {
    const round = (v: number): number => Math.round(v * 1000) / 1000;
    return {
      nodes: [...this.nodes.values()].sort((p, q) => p.id - q.id).map(n => [n.id, round(n.x), round(n.z)]),
      segments: [...this.segments.values()].sort((p, q) => p.id - q.id).map(s => [s.id, s.a, s.b, s.level,
        s.shape === "curve" && s.c1 && s.c2 ? [round(s.c1[0]), round(s.c1[1]), round(s.c2[0]), round(s.c2[1])] : [],
        s.national ? 1 : 0, s.piece ?? -1]),
      next: [this.nextNode, this.nextSegment],
    };
  }

  /** A graph from toJSON's data */
  static fromJSON(data: ReturnType<RoadGraph["toJSON"]>): RoadGraph {
    const g = new RoadGraph();
    for (const [id, x, z] of data.nodes) g.nodes.set(id, { id, x, z });
    for (const row of data.segments) {
      const [id, a, b, level, c, national, piece] = row as [number, number, number, number, number[], number, number];
      const seg: RoadSegment = { id, a, b, level, shape: c.length === 4 ? "curve" : "line" };
      if (c.length === 4) { seg.c1 = [c[0], c[1]]; seg.c2 = [c[2], c[3]]; }
      if (national) seg.national = true;
      if (piece >= 0) seg.piece = piece;
      g.put(seg);
    }
    [g.nextNode, g.nextSegment] = data.next;
    return g;
  }

  // ---------------------------------------------------------------------------------------------------------------

  /** A new node, to the millimetre as a save keeps it, so a city opened from its save goes on just as it would have */
  private newNode(p: Vec): number {
    const id = this.nextNode++;
    this.nodes.set(id, { id, x: mm(p[0]), z: mm(p[1]) });
    return id;
  }

  /** The node a road's end lands on: a node within MERGE_M, the split of a road it lands on, else a new one */
  private endNode(p: Vec, split: AddResult["split"]): number {
    const near = this.nodeNear(p);
    if (near) return near.id;
    const on = this.nearest(p, MERGE_M);
    if (on) return this.splitAt(on.segment, on.t, split);
    return this.newNode(p);
  }

  /** Splits a segment at t into two of its exact shape, sharing a new node; an end's node when t lies at an end */
  private splitAt(id: number, t: number, split: AddResult["split"]): number {
    const s = this.segment(id), len = this.length(id);
    if (t * len <= END_M) return s.a;
    if ((1 - t) * len <= END_M) return s.b;
    const p = controls(this, s), [head, tail] = splitBezier(p, t);
    const mid = this.newNode(head[3]);
    this.keep(s);
    this.unindex(id);
    this.segments.delete(id);
    const first: RoadSegment = { ...s, id: this.nextSegment++, b: mid };
    const second: RoadSegment = { ...s, id: this.nextSegment++, a: mid };
    if (s.shape === "curve") { first.c1 = head[1]; first.c2 = head[2]; second.c1 = tail[1]; second.c2 = tail[2]; }
    this.put(first);
    this.put(second);
    split.push({ old: id, into: [first.id, second.id] });
    return mid;
  }

  /** Where a new road (a point at t from 0 to 1, in `steps` straight pieces) crosses the roads there, but not at its own
   * ends' nodes: t along it, the segment, and u along that */
  private crossingsOf(at: (t: number) => [number, number], steps: number, a: number, b: number):
    { t: number; segment: number; u: number }[] {
    const found: { t: number; segment: number; u: number }[] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) pts.push(at(i / steps));
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    const candidates = new Set<number>();
    for (const key of this.keysFor(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))) {
      for (const id of this.buckets.get(key) ?? []) candidates.add(id);
    }
    for (const id of [...candidates].sort((p, q) => p - q)) {
      const s = this.segment(id);
      const other = s.shape === "curve" ? this.polyline(id, Math.max(0.5, this.length(id) / CURVE_STEPS)) : this.polyline(id);
      for (let i = 1; i < pts.length; i++) for (let j = 1; j < other.length; j++) {
        const c = crossing(pts[i - 1], pts[i], other[j - 1], other[j]);
        if (!c) continue;
        const t = (i - 1 + c[0]) / (pts.length - 1), u = (j - 1 + c[1]) / (other.length - 1);
        const point = at(t);
        // Its own ends are already joined (endNode)
        const na = this.node(a), nb = this.node(b);
        if (Math.hypot(point[0] - na.x, point[1] - na.z) <= END_M || Math.hypot(point[0] - nb.x, point[1] - nb.z) <= END_M) continue;
        found.push({ t, segment: id, u: s.shape === "curve" ? this.refine(id, point, u) : u });
      }
    }
    // Nearest the start first
    return found.sort((p, q) => p.t - q.t);
  }


  /** The t on a curve nearest a crossing found on its straight pieces */
  private refine(id: number, point: Vec, guess: number): number {
    let lo = Math.max(0, guess - 1 / CURVE_STEPS), hi = Math.min(1, guess + 1 / CURVE_STEPS);
    for (let k = 0; k < 40; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (dist(this.pointAt(id, m1), point) < dist(this.pointAt(id, m2), point)) hi = m2; else lo = m1;
    }
    return (lo + hi) / 2;
  }

  /** A segment the graph had at the mark watched, kept as it was before it goes */
  private keep(s: RoadSegment): void {
    const mark = this.watched;
    if (mark && s.id < mark.segments && !mark.removed.some((r) => r.id === s.id)) {
      mark.removed.push({ ...s, ...(s.c1 ? { c1: [s.c1[0], s.c1[1]] as Vec } : {}), ...(s.c2 ? { c2: [s.c2[0], s.c2[1]] as Vec } : {}) });
    }
  }

  private put(s: RoadSegment): void {
    if (s.c1 && s.c2) { s.c1 = [mm(s.c1[0]), mm(s.c1[1])]; s.c2 = [mm(s.c2[0]), mm(s.c2[1])]; }
    this.segments.set(s.id, s);
    const pts = controls(this, s), xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    const keys = this.keysFor(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
    for (const key of keys) {
      let set = this.buckets.get(key);
      if (!set) this.buckets.set(key, set = new Set());
      set.add(s.id);
    }
    this.bucketsOf.set(s.id, keys);
  }

  private unindex(id: number): void {
    for (const key of this.bucketsOf.get(id) ?? []) this.buckets.get(key)?.delete(id);
    this.bucketsOf.delete(id);
  }

  /** The buckets a box of metres touches (a curve lies within its control points' box) */
  private keysFor(x0: number, z0: number, x1: number, z1: number): number[] {
    const keys: number[] = [];
    const bx0 = Math.floor(x0 / BUCKET_M), bx1 = Math.floor(x1 / BUCKET_M), bz0 = Math.floor(z0 / BUCKET_M), bz1 = Math.floor(z1 / BUCKET_M);
    for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) keys.push(bz * 100003 + bx);
    return keys;
  }
}
