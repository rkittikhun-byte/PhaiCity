/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

/**
 * Road centre lines through one tile, in the tile's own metres: centre (0, 0), edges at ±5, x east, z south.
 * Sides use the road mask bits: 1 N, 2 E, 4 S, 8 W.
 *
 * The game lays roads tile by tile, so a road that runs at a slant is a staircase of corners. A corner whose
 * neighbour on a side is the opposite corner is one step of such a staircase, and its centre line crosses that side
 * at 45°. Corners bend smoothly between their two sides: a straight cut when both sides are steps, an easing curve
 * where a staircase meets a straight road, and (when asked) a quarter circle for a lone turn. Staircases then read
 * as diagonals and curves (owner, 13 Oct 2026: "ทำถนนเฉียง").
 */
export type Point2 = readonly [number, number];
export type CentreLines = readonly (readonly Point2[])[];

const SIDES = [1, 2, 4, 8] as const;
const MIDPOINT: Readonly<Record<number, Point2>> = { 1: [0, -5], 2: [5, 0], 4: [0, 5], 8: [-5, 0] };
const OUTWARD: Readonly<Record<number, Point2>> = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
const OPPOSITE: Readonly<Record<number, number>> = { 1: 4, 2: 8, 4: 1, 8: 2 };
/** How far a line runs past a straight side, along its own direction. */
const CENTRE_RUN_ON = 5;

export const isCornerMask = (mask: number): boolean => mask === 3 || mask === 6 || mask === 12 || mask === 9;

/**
 * A corner's staircase, packed into one number: bits 0–3 are its sides that are steps (the road beyond is the
 * opposite corner), bits 4–7 those whose step continues the staircase on its own far side too. `beyond(side, far)`
 * is the mask of the plain road across `side` (when `far` is 0) or across that road's side `far`, else null.
 */
export function staircase(mask: number, beyond: (side: number, far: number) => number | null): number {
  if (!isCornerMask(mask)) return 0;
  let sides = 0;
  for (const side of SIDES) if (mask & side && beyond(side, 0) === 15 - mask) {
    sides |= side;
    if (beyond(side, (15 - mask) & ~OPPOSITE[side]) === mask) sides |= side << 4;
  }
  return sides;
}

/**
 * A staircase on the map as the variant of the canonical corner (north and east) that `quarterTurns` rotates into
 * place: bits 1 and 2 when its north or east side is a step, 4 and 8 when that step continues.
 */
export function staircaseVariant(packed: number, quarterTurns: number): number {
  const turn = (bit: number): number => ((bit << quarterTurns) | (bit >> (4 - quarterTurns))) & 15;
  let variant = 0;
  for (const bit of [1, 2]) {
    if (packed & turn(bit)) variant |= bit;
    if (packed >> 4 & turn(bit)) variant |= bit << 2;
  }
  return variant;
}
/** The canonical corner's variants that can occur. */
export const STAIRCASE_VARIANTS: readonly number[] = [0, 1, 2, 3, 5, 7, 10, 11, 15];

/** Whether the tile's lines bend: a corner with a staircase side, or any corner when lone turns are rounded. */
export const bends = (mask: number, diagonal: number, round: boolean): boolean => isCornerMask(mask) && (diagonal !== 0 || round);

/** Where a bent road crosses one of its sides, and the direction it crosses in. */
interface RoadArm { readonly side: number; readonly point: Point2; readonly direction: Point2 }
export interface RoadShape { readonly lines: CentreLines }

/** A corner's curve from its first side's midpoint to its second's, with the directions it crosses them in. */
function bend(mask: number, diagonal: number): { points: Point2[]; arms: RoadArm[] } {
  const [a, b] = SIDES.filter(side => mask & side), A = MIDPOINT[a], B = MIDPOINT[b];
  const length = Math.hypot(B[0] - A[0], B[1] - A[1]), chord: Point2 = [(B[0] - A[0]) / length, (B[1] - A[1]) / length];
  const start: Point2 = diagonal & a ? chord : [-OUTWARD[a][0], -OUTWARD[a][1]], end = diagonal & b ? chord : OUTWARD[b];
  // Cubic handles: a quarter circle's, a straight line's third, and for an easing curve the pair whose road meets
  // the straight road beyond its straight side exactly as wide, out to the laterite's and carriageway's 3.5 m.
  const [handleA, handleB] = !(diagonal & a) && !(diagonal & b) ? [5 * 0.5523, 5 * 0.5523] :
    diagonal & a && diagonal & b ? [length / 3, length / 3] : diagonal & a ? [2.1, 3.7] : [3.7, 2.1];
  const p1: Point2 = [A[0] + start[0] * handleA, A[1] + start[1] * handleA], p2: Point2 = [B[0] - end[0] * handleB, B[1] - end[1] * handleB];
  const points = Array.from({ length: 13 }, (_, i): Point2 => {
    const t = i / 12, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [w[0] * A[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * B[0], w[0] * A[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * B[1]];
  });
  return { points, arms: [{ side: a, point: A, direction: start }, { side: b, point: B, direction: end }] };
}

const cache = new Map<number, RoadShape>();
/**
 * The tile's road. Plain roads run from the centre across each connected side; a bent corner is one curve between
 * its two sides (see `bends`). Past a straight side a line runs on straight (`CENTRE_RUN_ON`), as the road beyond
 * does; past a step it goes on as the step beyond bends (`far`: which steps continue, as in `staircase`), so the two
 * tiles of every edge measure the same road there and meet without a seam.
 */
export function roadShape(mask: number, diagonal = 0, round = false, far = 0): RoadShape {
  const key = (mask & 15) | (diagonal & 15) << 4 | (far & diagonal & 15) << 8 | (round ? 4096 : 0), known = cache.get(key);
  if (known) return known;
  let lines: Point2[][];
  if (bends(mask, diagonal, round)) {
    const own = bend(mask, diagonal), line = [...own.points], beyond: Point2[][] = [];
    own.arms.forEach((arm, i) => {
      const { side, point, direction } = arm;
      if (diagonal & side) {
        // The step beyond is the opposite corner: a step on this side and, if it continues, on its far side too.
        const back = OPPOSITE[side], next = 15 - mask, step = bend(next, back | (far & side ? next & ~back : 0));
        beyond.push(step.points.map(([x, z]): Point2 => [x + OUTWARD[side][0] * 10, z + OUTWARD[side][1] * 10]));
      } else {
        const run = i ? CENTRE_RUN_ON : -CENTRE_RUN_ON, past: Point2 = [point[0] + direction[0] * run, point[1] + direction[1] * run];
        if (i) line.push(past); else line.unshift(past);
      }
    });
    lines = [line, ...beyond];
  } else if (!(mask & 15)) lines = [[[0, 0], [0, 0]]];
  else lines = SIDES.filter(side => mask & side).map(side => [[0, 0], [OUTWARD[side][0] * (5 + CENTRE_RUN_ON), OUTWARD[side][1] * (5 + CENTRE_RUN_ON)]]);
  const shape: RoadShape = Object.freeze({ lines: Object.freeze(lines.map(line => Object.freeze(line))) });
  cache.set(key, shape);
  return shape;
}

/** Distance from a point to the nearest centre line. */
export function centreDistance(x: number, z: number, lines: CentreLines): number {
  let best = Infinity;
  for (const line of lines) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

/** Distance from a point to the tile's road. */
export const roadDistance = (x: number, z: number, shape: RoadShape): number => centreDistance(x, z, shape.lines);

/** The part of a triangle where `value` ≤ 0 (taken as linear along its edges): none, one or two triangles, same winding. */
export function clipTriangle<T>(corners: readonly [T, T, T], value: (corner: T) => number, between: (a: T, b: T, t: number) => T): T[][] {
  const kept: T[] = [];
  for (let i = 0; i < 3; i++) {
    const a = corners[i], b = corners[(i + 1) % 3], fa = value(a), fb = value(b);
    if (fa <= 0) kept.push(a);
    if ((fa <= 0) !== (fb <= 0)) kept.push(between(a, b, fa / (fa - fb)));
  }
  const triangles: T[][] = [];
  for (let i = 1; i + 1 < kept.length; i++) triangles.push([kept[0], kept[i], kept[i + 1]]);
  return triangles;
}

/**
 * A grid square's two triangles (corners NW, NE, SW, SE; the last number of each is its distance to the road), split
 * along the diagonal whose ends lie equally far from the road, so a slanted road shades along its length instead of
 * in a zigzag. Squares across a straight road keep the ground's own split.
 */
export function alongRoad<T extends readonly number[]>(a: T, b: T, c: T, d: T): (readonly [T, T, T])[] {
  const n = a.length - 1;
  return Math.abs(a[n] - d[n]) < Math.abs(b[n] - c[n]) - 1e-6 ? [[a, c, d], [a, d, b]] : [[a, c, b], [b, c, d]];
}
