/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Point } from '../../roadGeometry.js';

export interface JunctionApproach {
  points: readonly Point[];
  way: Point;
  half: number;
}

export interface JunctionMouth {
  at: Point;
  way: Point;
  normal: Point;
  half: number;
  distance: number;
}

export interface JunctionEdgePoint {
  at: Point;
  normal: Point;
  fraction: number;
}

export interface JunctionCorner {
  points: JunctionEdgePoint[];
  radius: number;
}

interface LineSampler {
  available: number;
  frame(distance: number): JunctionMouth;
}

/** Sample the actual drawn ribbon, rather than extending a tangent from the centre of the node. */
function sampler(arm: JunctionApproach, at: Point): LineSampler {
  const points = arm.points, lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  let base = 0, best = Infinity, direction = 1;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(a[0] + dx * t - at[0], a[1] + dz * t - at[1]);
    if (d < best) {
      best = d; base = lengths[i - 1] + (lengths[i] - lengths[i - 1]) * t;
      direction = dx * arm.way[0] + dz * arm.way[1] >= 0 ? 1 : -1;
    }
  }
  const total = lengths[lengths.length - 1];
  const pointAt = (distance: number): Point => {
    const s = Math.max(0, Math.min(total, distance));
    let i = 1;
    while (i < points.length - 1 && lengths[i] < s) i++;
    const a = points[i - 1], b = points[i];
    const t = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  return {
    available: direction > 0 ? total - base : base,
    frame(distance) {
      const s = base + direction * distance, p = pointAt(s);
      const a = pointAt(s - direction * 0.25), b = pointAt(s + direction * 0.25);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const way: Point = l > 1e-6 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : arm.way;
      return { at: p, way, normal: [-way[1], way[0]], half: arm.half, distance };
    },
  };
}

function edge(mouth: JunctionMouth, side: number): Point {
  return [mouth.at[0] + mouth.normal[0] * mouth.half * side, mouth.at[1] + mouth.normal[1] * mouth.half * side];
}

function corner(a: JunctionMouth, b: JunctionMouth, radius: number, final: boolean): JunctionCorner & { needA: number; needB: number } {
  const A = edge(a, 1), B = edge(b, -1), points: JunctionEdgePoint[] = [];
  const push = (at: Point, normal: Point): void => { points.push({ at, normal, fraction: 0 }); };
  let turn = Math.atan2(b.way[1], b.way[0]) - Math.atan2(a.way[1], a.way[0]);
  while (turn <= 0) turn += Math.PI * 2;
  const det = a.way[0] * b.way[1] - a.way[1] * b.way[0];
  let needA = a.distance, needB = b.distance, r = 0;
  if (turn < Math.PI - 0.002 && det > 1e-6) {
    const dx = B[0] - A[0], dz = B[1] - A[1];
    const alpha = (-dx * b.way[1] + dz * b.way[0]) / det;
    const beta = (-dx * a.way[1] + dz * a.way[0]) / det;
    // The angle between the two outward road edges is turn, not PI - turn. Using the latter
    // only works for right angles and pulls the arc endpoints off skewed three/five-way arms.
    const halfAngle = turn / 2;
    r = radius;
    const tangent = r / Math.tan(halfAngle);
    needA += Math.max(0, tangent + 0.15 - alpha);
    needB += Math.max(0, tangent + 0.15 - beta);
    if (final) r = Math.min(r, Math.max(0, Math.min(alpha, beta) - 0.03) * Math.tan(halfAngle));
    if (r > 0.001 && (!final || alpha > 0.03 && beta > 0.03)) {
      const c: Point = [A[0] - a.way[0] * alpha, A[1] - a.way[1] * alpha];
      const td = r / Math.tan(halfAngle), bisector = Math.hypot(a.way[0] + b.way[0], a.way[1] + b.way[1]);
      const o: Point = [c[0] + (a.way[0] + b.way[0]) / bisector * r / Math.sin(halfAngle),
        c[1] + (a.way[1] + b.way[1]) / bisector * r / Math.sin(halfAngle)];
      const tA: Point = [c[0] + a.way[0] * td, c[1] + a.way[1] * td];
      const tB: Point = [c[0] + b.way[0] * td, c[1] + b.way[1] * td];
      push(A, a.normal);
      if (Math.hypot(tA[0] - A[0], tA[1] - A[1]) > 1e-5) push(tA, a.normal);
      const angle = Math.atan2(tA[1] - o[1], tA[0] - o[0]), sweep = turn - Math.PI;
      const steps = Math.max(6, Math.ceil(r * Math.abs(sweep) / 0.45));
      for (let i = 1; i < steps; i++) {
        const theta = angle + sweep * i / steps, x = Math.cos(theta), z = Math.sin(theta);
        push([o[0] + x * r, o[1] + z * r], [-x, -z]);
      }
      push(tB, [-b.normal[0], -b.normal[1]]);
      if (Math.hypot(tB[0] - B[0], tB[1] - B[1]) > 1e-5) push(B, [-b.normal[0], -b.normal[1]]);
    }
  }
  if (!points.length) {
    // A straight back edge of a T, a reflex bend, or an arm too short for the full radius.
    // Bounded Bezier handles meet the mouths tangentially without a spike or a giant round pad.
    r = 0;
    const span = Math.hypot(B[0] - A[0], B[1] - A[1]), handle = span / 3;
    const steps = Math.max(2, Math.ceil(span / 0.6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const p: Point = [u * u * u * A[0] + 3 * u * u * t * (A[0] - a.way[0] * handle) + 3 * u * t * t * (B[0] - b.way[0] * handle) + t * t * t * B[0],
        u * u * u * A[1] + 3 * u * u * t * (A[1] - a.way[1] * handle) + 3 * u * t * t * (B[1] - b.way[1] * handle) + t * t * t * B[1]];
      const nx = a.normal[0] * u - b.normal[0] * t, nz = a.normal[1] * u - b.normal[1] * t, len = Math.hypot(nx, nz) || 1;
      push(p, [nx / len, nz / len]);
    }
  }
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].at[0] - points[i - 1].at[0], points[i].at[1] - points[i - 1].at[1]);
    points[i].fraction = length;
  }
  for (const p of points) p.fraction = length > 0 ? p.fraction / length : 0;
  return { points, radius: r, needA, needB };
}

/** Shared mouth/corner solution for surfaces, shoulders and markings, for any road level. */
export function junctionLayout(at: Point, arms: readonly JunctionApproach[], metre = 1): { mouths: JunctionMouth[]; corners: JunctionCorner[] } {
  const samplers = arms.map((a) => sampler(a, at)), trims = arms.map(() => 0);
  const radius = (i: number): number => Math.min(arms[i].half, arms[(i + 1) % arms.length].half) * 0.9 + 2 * metre;
  let mouths = samplers.map((s) => s.frame(0));
  for (let pass = 0; pass < 12; pass++) {
    mouths = samplers.map((s, i) => s.frame(trims[i]));
    let changed = false;
    for (let i = 0; i < arms.length; i++) {
      const j = (i + 1) % arms.length, c = corner(mouths[i], mouths[j], radius(i), false);
      for (const [k, need] of [[i, c.needA], [j, c.needB]]) {
        const next = Math.min(samplers[k].available * 0.45, Math.max(trims[k], need));
        if (next > trims[k] + 0.001) { trims[k] = next; changed = true; }
      }
    }
    if (!changed) break;
  }
  mouths = samplers.map((s, i) => s.frame(trims[i]));
  const corners = mouths.map((a, i) => corner(a, mouths[(i + 1) % arms.length], radius(i), true));
  return { mouths, corners };
}
