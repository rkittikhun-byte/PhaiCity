/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Where a click of the road, railway and canal tools lands (owner, 22 Oct 2026: "การวางจุดของตอนคลิกสร้างถนน จาก A ไป
// B จุด B มีจุด snap อยู่ ทำให้จุด B ชิดกว่านี้ และจุด A มีจุดให้ snap หลายจุดกว่านี้"). The first point, A, has many
// places to land on near the mouse: a junction or a road's end when the mouse is right on it, a point along a road
// about every MARK_STEP_M between its junctions, any point of a road's middle line (anywhere on the road, its edges
// too), and the guideline a block of plots from a straight road. Every later point, B, lands close to the mouse: on a
// junction or an end only when the mouse is on it, on a road only when the mouse is on the road or a few pixels off its
// edge, and onto a straight way from the last point only when that moves it a few pixels and metres at most. Reaches
// are in pixels on the screen (metresPerPixel), so they are the same at any zoom. Plain code, no DOM: metres from the
// map's corner, x east and z south.

import { snapWay, type Metres } from "./roadDraw";

/** Why a click lands where it does: a junction, a road's dead end, a point along a road, the road's middle line, a
 * guideline a block from a road, along the road the line leaves, or onto a straight or 45° way */
export type SnapKind = "node" | "end" | "mark" | "road" | "guide" | "way" | "angle";

export interface Snap {
  point: Metres;
  kind: SnapKind;
  /** The way the road (or guideline) runs there, a unit vector, out of its end for an end; null where none */
  way: Metres | null;
  /** A guideline's stretch near the point, for its marker */
  guide?: [Metres, Metres];
}

/** The roads a tool snaps to, as the game draws them (src/roads/graphLines.ts drawnRoads), in metres */
export interface SnapNet {
  /** Each road's middle line, as points */
  lines: readonly (readonly Metres[])[];
  /** Where roads meet, as the map gives them (taken only where three arms of the lines meet: jointsOf) */
  nodes: readonly Metres[];
  /** Each line's half width on the ground with its shoulder (metres); DEFAULT_HALF_M where not given */
  half?: readonly number[];
}

/** How near the mouse must be, in pixels on the screen, for each kind to take the first point (A) (a road: from its
 * edge) ... */
export const START_PIXELS = { node: 10, road: 16, mark: 4, guide: 8 } as const;
/** ... and each later point (B), which lands near the mouse */
export const NEXT_PIXELS = { node: 7, road: 6, way: 6 } as const;
/** B moved onto a straight way never more than this many metres (half that onto the 15° steps between the main ways) */
export const WAY_MAX_M = 3;
/** The points along a road A lands on: its stretch between two junctions or ends cut into equal parts about this long */
export const MARK_STEP_M = 8;
/** A road whose width is not known: a two-lane road with its shoulders */
export const DEFAULT_HALF_M = 3.5;
/** A junction or an end takes a click on its own ground: within this many half widths of the road the mouse is on */
const SURFACE = 1.5;
/** A guideline runs beside a straight stretch of road at least this long, and is shown this far either way */
const GUIDE_MIN_M = 24;
const GUIDE_SHOWN_M = 40;
/** A point this near the last one is the point the line is drawn from */
const SAME_M = 1;

const dist = (p: readonly number[], q: readonly number[]): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** The nearest point of a road's middle line to p: which line, where, how far, the way it runs, and how far along it */
interface Foot { line: number; point: Metres; d: number; way: Metres; along: number; half: number }

const halfOf = (net: SnapNet, line: number): number => net.half?.[line] ?? DEFAULT_HALF_M;

/** The nearest point of each road the mouse is on or within reach (metres) of, from its edge, nearest first */
function feet(p: Metres, net: SnapNet, reach: number): Foot[] {
  const out: Foot[] = [];
  net.lines.forEach((line, n) => {
    if (line.length < 2) return;
    const within = halfOf(net, n) + reach;
    let best: Foot | null = null, along = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz, len = Math.sqrt(len2);
      if (len2 > 0 && Math.abs(p[0] - (a[0] + b[0]) / 2) <= within + len && Math.abs(p[1] - (a[1] + b[1]) / 2) <= within + len) {
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
        const q: Metres = [a[0] + dx * t, a[1] + dz * t], d = dist(q, p);
        if (d <= within && (best === null || d < best.d))
          best = { line: n, point: q, d, way: [dx / len, dz / len], along: along + len * t, half: halfOf(net, n) };
      }
      along += len;
    }
    if (best) out.push(best);
  });
  return out.sort((a, b) => a.d - b.d);
}

/** How far p lies from a line of points, and how far along it its nearest point is */
function onLine(line: readonly Metres[], p: readonly number[]): { d: number; along: number } {
  let best = { d: Infinity, along: 0 }, along = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz, len = Math.sqrt(len2);
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
    if (d < best.d) best = { d, along: along + len * t };
    along += len;
  }
  return best;
}

const lengthOf = (line: readonly Metres[]): number => {
  let sum = 0;
  for (let i = 1; i < line.length; i++) sum += dist(line[i - 1], line[i]);
  return sum;
};

/** The point s metres along a line of points, to the millimetre */
function pointAlong(line: readonly Metres[], s: number): Metres {
  const mm = (v: number): number => Math.round(v * 1000) / 1000;
  let along = 0;
  for (let i = 1; i < line.length; i++) {
    const len = dist(line[i - 1], line[i]);
    if (along + len >= s && len > 0) {
      const t = (s - along) / len;
      return [mm(line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t), mm(line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t)];
    }
    along += len;
  }
  return [line[line.length - 1][0], line[line.length - 1][1]];
}

/**
 * Where the roads meet and where they stop, from the lines themselves (kept per net): a junction where three or more
 * arms meet (a line running through counts two, one ending there one), a dead end where a line's end meets nothing.
 * The given nodes count only where they are such a junction: a road the map brought in tiles gives its junction's
 * tile, which may lie a tile off the lines (16.8 m on Mueang Khon Kaen's state roads), where no road is.
 */
interface Joints {
  nodes: Metres[];
  ends: Array<{ point: Metres; way: Metres }>;
  /** Each line's bounds and length */
  boxes: number[][];
  lengths: number[];
}
const jointCache = new WeakMap<object, Joints>();
function jointsOf(net: SnapNet): Joints {
  const kept = jointCache.get(net.lines);
  if (kept) return kept;
  const boxes = net.lines.map((line) => {
    const xs = line.map((q) => q[0]), zs = line.map((q) => q[1]);
    return [Math.min(...xs) - SAME_M, Math.max(...xs) + SAME_M, Math.min(...zs) - SAME_M, Math.max(...zs) + SAME_M];
  });
  const lengths = net.lines.map(lengthOf);
  const arms = (p: readonly number[]): number => {
    let count = 0;
    net.lines.forEach((line, n) => {
      const [x0, x1, z0, z1] = boxes[n];
      if (line.length < 2 || p[0] < x0 || p[0] > x1 || p[1] < z0 || p[1] > z1) return;
      const on = onLine(line, p);
      if (on.d >= SAME_M) return;
      const atStart = dist(line[0], p) < SAME_M, atEnd = dist(line[line.length - 1], p) < SAME_M;
      count += atStart && atEnd && lengths[n] > SAME_M * 2 ? 2 : atStart || atEnd ? 1 : 2;
    });
    return count;
  };
  const nodes: Metres[] = [];
  const isNode = (p: readonly number[]): boolean => nodes.some((q) => dist(q, p) < SAME_M);
  for (const node of net.nodes) if (!isNode(node) && arms(node) >= 3) nodes.push([node[0], node[1]]);
  const ends: Array<{ point: Metres; way: Metres }> = [];
  net.lines.forEach((line) => {
    if (line.length < 2) return;
    for (const [i, j] of [[0, 1], [line.length - 1, line.length - 2]]) {
      const p = line[i];
      if (isNode(p)) continue;
      const count = arms(p);
      if (count >= 3) nodes.push([p[0], p[1]]);
      else if (count === 1) {
        const len = dist(p, line[j]) || 1;
        ends.push({ point: [p[0], p[1]], way: [(p[0] - line[j][0]) / len, (p[1] - line[j][1]) / len] });
      }
    }
  });
  const joints = { nodes, ends, boxes, lengths };
  jointCache.set(net.lines, joints);
  return joints;
}

/** Where along each line its stretches start and stop: its ends and every junction on it, in order (kept per net) */
const anchorCache = new WeakMap<object, Map<number, number[]>>();
function anchorsOf(net: SnapNet, n: number): number[] {
  let byLine = anchorCache.get(net.lines);
  if (!byLine) anchorCache.set(net.lines, byLine = new Map());
  let anchors = byLine.get(n);
  if (!anchors) {
    const joints = jointsOf(net), line = net.lines[n], [x0, x1, z0, z1] = joints.boxes[n];
    anchors = [0, joints.lengths[n]];
    for (const node of joints.nodes) {
      if (node[0] < x0 || node[0] > x1 || node[1] < z0 || node[1] > z1) continue;
      const on = onLine(line, node);
      if (on.d < SAME_M) anchors.push(on.along);
    }
    anchors.sort((a, b) => a - b);
    byLine.set(n, anchors);
  }
  return anchors;
}

/** The points along a road where A lands (src/game.js shows them as dots): each stretch between its junctions and ends
 * cut into equal parts about MARK_STEP_M long, as distances along the line, between from and to */
export function marksAlong(net: SnapNet, n: number, from = -Infinity, to = Infinity): number[] {
  const anchors = anchorsOf(net, n), out: number[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], length = anchors[i] - a;
    if (length < MARK_STEP_M * 1.5 || a > to || anchors[i] < from) continue;
    const parts = Math.round(length / MARK_STEP_M);
    for (let k = 1; k < parts; k++) {
      const s = a + length * k / parts;
      if (s >= from && s <= to) out.push(s);
    }
  }
  return out;
}

/** The nearest junction to p within reach, other than near the point a line is drawn from */
function nearestNode(p: Metres, nodes: readonly Metres[], reach: number, last: Metres | null): Metres | null {
  let best: Metres | null = null, bestD = reach;
  for (const node of nodes) {
    const d = dist(node, p);
    if (d <= bestD && !(last && dist(node, last) <= SAME_M)) { best = node; bestD = d; }
  }
  return best;
}

/** The nearest dead end to p within reach, with the way out of it, other than the point a line is drawn from */
function nearestEnd(p: Metres, net: SnapNet, reach: number, last: Metres | null): Snap | null {
  let best: Snap | null = null, bestD = reach;
  for (const end of jointsOf(net).ends) {
    const d = dist(end.point, p);
    if (d > bestD || (last && dist(end.point, last) <= SAME_M)) continue;
    best = { point: end.point, kind: "end", way: end.way };
    bestD = d;
  }
  return best;
}

/** A junction or a road's end, when the mouse is right on it: within nodePixels, or on its ground (the mouse on its
 * road within SURFACE half widths of it) */
function onJoint(p: Metres, net: SnapNet, foot: Foot | null, reach: number, last: Metres | null): Snap | null {
  const ground = foot && foot.d <= foot.half ? Math.max(reach, foot.half * SURFACE) : reach;
  const node = nearestNode(p, jointsOf(net).nodes, ground, last);
  if (node) {
    // ... with the way of the road the mouse is on, when it runs through the junction
    const way = foot && onLine(net.lines[foot.line], node).d < SAME_M ? foot.way : null;
    return { point: [node[0], node[1]], kind: "node", way };
  }
  return nearestEnd(p, net, ground, last);
}

/**
 * Where the first point of a line (A) lands with the mouse at p: a junction or a road's end the mouse is right on, else
 * the point along the road a few pixels from the mouse's (marksAlong), else the nearest point of the road's middle line
 * when the mouse is on the road or within START_PIXELS.road of its edge, else the guideline a block from a straight road
 * (spacing metres, 0 for none) within START_PIXELS.guide; null where none is that near.
 */
export function snapStart(p: Metres, metresPerPixel: number, net: SnapNet, spacing = 0): Snap | null {
  const near = feet(p, net, START_PIXELS.road * metresPerPixel), foot = near[0] ?? null;
  const joint = onJoint(p, net, foot, START_PIXELS.node * metresPerPixel, null);
  if (joint) return joint;
  if (foot) {
    const pull = START_PIXELS.mark * metresPerPixel;
    const mark = marksAlong(net, foot.line, foot.along - pull, foot.along + pull)
      .sort((a, b) => Math.abs(a - foot.along) - Math.abs(b - foot.along))[0];
    if (mark !== undefined) return { point: pointAlong(net.lines[foot.line], mark), kind: "mark", way: foot.way };
    return { point: foot.point, kind: "road", way: foot.way };
  }
  return spacing > 0 ? guideline(p, net, spacing, START_PIXELS.guide * metresPerPixel) : null;
}

/** The nearest point within reach of the lines beside each straight stretch of road, spacing metres from its middle */
function guideline(p: Metres, net: SnapNet, spacing: number, reach: number): Snap | null {
  let best: Snap | null = null, bestD = reach;
  for (const line of net.lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < GUIDE_MIN_M) continue;
      const wx = dx / len, wz = dz / len;
      // The mouse's distance along the stretch and to the side of it, from its first point
      const s = (p[0] - a[0]) * wx + (p[1] - a[1]) * wz, side = (p[0] - a[0]) * -wz + (p[1] - a[1]) * wx;
      if (s <= 0 || s >= len) continue;
      const off = Math.abs(Math.abs(side) - spacing);
      if (off > bestD) continue;
      const k = Math.sign(side) * spacing, q: Metres = [a[0] + wx * s - wz * k, a[1] + wz * s + wx * k];
      const show = (t: number): Metres => {
        const u = Math.max(0, Math.min(len, s + t));
        return [a[0] + wx * u - wz * k, a[1] + wz * u + wx * k];
      };
      best = { point: q, kind: "guide", way: [wx, wz], guide: [show(-GUIDE_SHOWN_M), show(GUIDE_SHOWN_M)] };
      bestD = off;
    }
  }
  // ... but not where it would land on a road anyway
  return best && !feet(best.point, net, 0).length ? best : null;
}

/**
 * Where a later point of a line (B) lands with the mouse at p, close to the mouse: a junction or a road's end the mouse
 * is right on, else the nearest point of a road's middle line when the mouse is on the road or within
 * NEXT_PIXELS.road of its edge, else straight on from the last point (along, square to or at 15° steps from the road it
 * left, leaving; north, east, south, west or between) when that moves it NEXT_PIXELS.way and WAY_MAX_M at most (half
 * that onto a 15° step between those), else
 * null: where the mouse is. Never back onto the point the line is drawn from.
 */
export function snapNext(p: Metres, metresPerPixel: number, net: SnapNet, last: Metres | null, leaving: Metres | null,
                         degrees: number): Snap | null {
  const near = feet(p, net, NEXT_PIXELS.road * metresPerPixel).filter((f) => !last || dist(f.point, last) > SAME_M);
  const foot = near[0] ?? null;
  const joint = onJoint(p, net, foot, NEXT_PIXELS.node * metresPerPixel, last);
  if (joint) return joint;
  if (foot) return { point: foot.point, kind: "road", way: foot.way };
  if (last === null) return null;
  const straight = snapWay(last, p, leaving, degrees);
  if (straight === null) return null;
  // ... the main ways (north, east, south, west and between; along and square to the road it left) as far as
  // NEXT_PIXELS.way and WAY_MAX_M, the 15° steps between half that
  const angle = Math.atan2(straight[1] - last[1], straight[0] - last[0]);
  const main = onStep(angle, Math.PI / 4) || (leaving !== null && onStep(angle - Math.atan2(leaving[1], leaving[0]), Math.PI / 2));
  const reach = Math.min(NEXT_PIXELS.way * metresPerPixel, WAY_MAX_M) * (main ? 1 : 0.5);
  if (dist(straight, p) > reach) return null;
  return { point: straight, kind: leaving ? "way" : "angle", way: null };
}

/** Whether an angle (radians) is a whole number of steps */
const onStep = (angle: number, step: number): boolean => {
  const off = ((angle % step) + step) % step;
  return Math.min(off, step - off) < 1e-6;
};

/** The places near p (within reach metres) where a click may land, for the dots the game shows: for the first point
 * the points along the roads (marksAlong) as well as their junctions and dead ends, for a later point only those */
export function snapPoints(p: Metres, reach: number, net: SnapNet, first: boolean):
  Array<{ point: Metres; kind: "mark" | "end" | "node" }> {
  const out: Array<{ point: Metres; kind: "mark" | "end" | "node" }> = [], joints = jointsOf(net);
  for (const node of joints.nodes) if (dist(node, p) <= reach) out.push({ point: node, kind: "node" });
  for (const end of joints.ends) if (dist(end.point, p) <= reach) out.push({ point: end.point, kind: "end" });
  if (!first) return out;
  net.lines.forEach((line, n) => {
    if (line.length < 2) return;
    const on = onLine(line, p);
    if (on.d > reach) return;
    for (const s of marksAlong(net, n, on.along - reach * 2, on.along + reach * 2)) {
      const q = pointAlong(line, s);
      if (dist(q, p) <= reach) out.push({ point: q, kind: "mark" });
    }
  });
  return out;
}
