/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals in 3D (docs/CANALS.md "Five levels", owner 19 Oct 2026: "ทำให้สวยๆ เลย และดูดี"): a canal is drawn along its
// smooth middle line, as the roads are, with its water flush with the ground and its banks or walls rising beside it.
// Each level has its own cross-section and its own things along it:
//   1 a new ditch: bare laterite banks and heaps of dug earth, brown water;
//   2 an earth canal: grassy banks, a row of wooden piles, water hyacinth, a plank pier now and then;
//   3 a lined canal: concrete walls with a coping, steps down to the water, drain outlets;
//   4 a canal walk: walls with a paved walk on both banks, railings, lamps and benches;
//   5 a canal of boats and gardens: a brick promenade with shade trees, lamps, benches, a plain riverside sala and
//     long-tail boats moored along the wall.
// The city view (src/render3d/city/canals.ts) passes the lines, junctions and ground; the model gallery shows a straight
// piece of each level (createCanalPiece). Every colour comes from the material library. World units: a tile is 10.

import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  Material, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { getMaterial, tint, vertexFinish, type MaterialKey } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { SCENE } from '../../../theme/tokens.js';
import { applyWorldUV, countTriangles, mergeByMaterial, mergeGeometry } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { createTree } from '../vegetation/trees.js';
import { createLongtailBoat } from '../vehicles/watercraft.js';

export type Point = [number, number];
export const CANAL_PIECE_ID = 'water.canal';
export const CANAL_PIECE_LEVELS = [1, 2, 3, 4, 5] as const;
/** World units a metre where a map's tiles are not at real scale (10 m tiles drawn a little smaller, as roads are) */
export const CANAL_PROVINCE_METRE = 0.6;
/** How far above the ground the water lies, so it never flickers against the land under it */
const WATER_LIFT = 0.05;

/** The surfaces of a cross-section, each a library material tinted by its vertices */
type Surface = 'mud' | 'dirt' | 'grass' | 'concrete' | 'coping' | 'paving' | 'brick';
const SURFACE_MATERIAL: Readonly<Record<Surface, MaterialKey>> = {
  mud: 'dirt_laterite', dirt: 'dirt_laterite', grass: 'grass', concrete: 'concrete_weathered', coping: 'concrete_raw',
  paving: 'sidewalk_tile', brick: 'brick_red',
};

/**
 * One bank of a level, from the water's edge outward: [metres from the middle, metres above the ground, surface].
 * Two points at the same distance make a wall. The last point lies a little under the ground, so no gap shows.
 */
interface Profile { water: number; bank: ReadonlyArray<readonly [number, number, Surface]> }
export const CANAL_PROFILES: Readonly<Record<number, Profile>> = {
  1: { water: 2.5, bank: [[2.5, -0.03, 'mud'], [3.1, 0.45, 'dirt'], [3.9, 0.72, 'dirt'], [4.7, 0.64, 'dirt'],
    [5.8, 0, 'dirt'], [6.1, -0.05, 'dirt']] },
  2: { water: 3, bank: [[3, -0.03, 'mud'], [3.25, 0.32, 'grass'], [4.4, 0.36, 'grass'], [5.6, 0.12, 'grass'],
    [6.3, -0.05, 'grass']] },
  3: { water: 3.5, bank: [[3.5, -0.03, 'concrete'], [3.5, 1, 'concrete'], [3.5, 1.06, 'coping'], [3.85, 1.06, 'coping'],
    [3.85, 0.98, 'concrete'], [4.6, 0.95, 'concrete'], [4.65, 0.9, 'grass'], [5.8, 0, 'grass'], [6, -0.05, 'grass']] },
  4: { water: 3.5, bank: [[3.5, -0.03, 'concrete'], [3.5, 1.05, 'concrete'], [3.5, 1.11, 'coping'], [3.8, 1.11, 'coping'],
    [3.8, 1.08, 'paving'], [5.5, 1.08, 'paving'], [5.5, 1.2, 'coping'], [5.7, 1.2, 'coping'], [5.7, 0.8, 'concrete'],
    [6.6, 0, 'grass'], [6.8, -0.05, 'grass']] },
  5: { water: 4, bank: [[4, -0.03, 'concrete'], [4, 1.05, 'concrete'], [4, 1.12, 'brick'], [4.35, 1.12, 'brick'],
    [4.35, 1.1, 'paving'], [6, 1.1, 'paving'], [6, 1.14, 'grass'], [6.9, 1.14, 'grass'], [6.9, 1.2, 'brick'],
    [7.1, 1.2, 'brick'], [7.1, 0.7, 'brick'], [7.7, 0, 'grass'], [7.9, -0.05, 'grass']] },
};

const clampLevel = (level: number): number => Math.max(1, Math.min(5, Math.round(level) || 1));
export const canalProfile = (level: number): Profile => CANAL_PROFILES[clampLevel(level)];
/** Half the width a level takes, water and banks, in metres */
export const canalHalfWidth = (level: number): number => { const bank = canalProfile(level).bank; return bank[bank.length - 1][0]; };

/** A stretch of canal of one level along its middle line (world units) */
export interface CanalRun {
  points: Point[];
  level: number;
  /** A square end with a bank across it, where the canal stops on its own */
  capStart?: boolean;
  capEnd?: boolean;
  /** An end where the canal opens into a river or lake, through a sluice gate (ประตูระบายน้ำ) */
  openStart?: boolean;
  openEnd?: boolean;
}
/** Where canals meet: the middle, and the way each one leaves it with its level */
export interface CanalJunction { at: Point; arms: Array<{ end: Point; way: Point; level: number }> }

export interface CanalEnv {
  /** World units a metre */
  metre: number;
  /** The ground's height (world units) */
  ground(x: number, z: number): number;
  /** No bank here (a bridge stands over the canal) */
  noBank?(x: number, z: number): boolean;
  /** For the things along it: the same canal always looks the same */
  seed?: number;
}

/** What one build gives: vertex-tinted surfaces by material, the water, and where each detail stands */
export interface CanalBuild {
  surfaces: Map<MaterialKey, { positions: number[]; colors: number[] }>;
  /** Each level's water, in that level's colour */
  water: Map<number, { positions: number[]; colors: number[] }>;
  details: Map<DetailKind, Matrix4[]>;
}

// --- colours, from the material library --------------------------------------------------------------------------

let palette: Record<string, Color> | null = null;
function colours(): Record<string, Color> {
  if (palette) return palette;
  const of = (key: MaterialKey): Color => getMaterial(key).color.clone();
  const water = of('water_river'), deep = of('glass_tinted'), earth = of('dirt_laterite'), grass = of('grass');
  palette = {
    mud: earth.clone().multiplyScalar(0.62), dirt: earth.clone(), grass: grass.clone(), concrete: of('concrete_weathered'),
    coping: of('concrete_raw'), paving: of('sidewalk_tile').lerp(new Color(1, 1, 1), 0.25), brick: of('brick_red'),
    // Each level's water: muddy when new, greener as the banks grow over, clearer once lined
    // (the laterite material's own colour is white, its picture brings the red, so the muddy water's brown is the theme's)
    water1: water.clone().lerp(new Color(SCENE.palette.soilCut.shade), 0.55).multiplyScalar(0.8), water2: water.clone().lerp(grass, 0.3).multiplyScalar(0.58),
    water3: water.clone().lerp(deep, 0.3).multiplyScalar(0.6), water4: water.clone().lerp(deep, 0.45).multiplyScalar(0.62),
    water5: water.clone().lerp(deep, 0.6).multiplyScalar(0.66),
  };
  return palette;
}
/** A little light and shade along a bank, so a long one is not one flat colour */
function shaded(base: Color, x: number, z: number): Color {
  const n = Math.sin(x * 0.37 + Math.cos(z * 0.21) * 2.1) * Math.cos(z * 0.29 - x * 0.13);
  return base.clone().multiplyScalar(0.94 + n * 0.06);
}

// --- lines -------------------------------------------------------------------------------------------------------

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const len = (a: Point): number => Math.hypot(a[0], a[1]);
const unit = (a: Point): Point => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
/** Water lies on this side of a line walked along (x east, z south): the line's left as seen from above */
const perp = (t: Point): Point => [-t[1], t[0]];

/** Each point's mitred outward normal (away from the water, which lies on perp's side) and how far to stretch it */
function normals(points: readonly Point[], closed: boolean): Array<{ n: Point; s: number }> {
  const count = points.length, out: Array<{ n: Point; s: number }> = [];
  for (let k = 0; k < count; k++) {
    const prev = k > 0 ? points[k - 1] : closed ? points[count - 1] : null;
    const next = k < count - 1 ? points[k + 1] : closed ? points[0] : null;
    const tin = prev ? unit(sub(points[k], prev)) : null, tout = next ? unit(sub(next, points[k])) : null;
    const nin = tin ? perp(tin) : null, nout = tout ? perp(tout) : null;
    const a = nin ?? nout!, b = nout ?? nin!;
    const avg = unit([a[0] + b[0], a[1] + b[1]]);
    const s = 1 / Math.max(0.35, avg[0] * a[0] + avg[1] * a[1]);
    out.push({ n: [-avg[0], -avg[1]], s });
  }
  return out;
}

/** A line's points every step (world units) or closer, so banks follow the ground and curves stay round */
function dense(points: readonly Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], pieces = Math.max(1, Math.ceil(len(sub(b, a)) / step));
    for (let k = 0; k < pieces; k++) out.push([a[0] + (b[0] - a[0]) * k / pieces, a[1] + (b[1] - a[1]) * k / pieces]);
  }
  if (points.length) out.push([...points[points.length - 1]] as Point);
  return out;
}

/** The parts of a line further than r from every centre, cut exactly at r (where canals meet, their pad takes over) */
export function cutAround(line: readonly Point[], centres: readonly Point[], r: number): Point[][] {
  const near = (p: Point): boolean => centres.some((c) => len(sub(p, c)) < r);
  // Points closer than the pad, so none of them steps over it
  const points = centres.length ? dense(line, Math.max(0.25, r / 3)) : line;
  const out: Point[][] = [];
  let run: Point[] = [];
  const crossing = (a: Point, b: Point): Point => {
    // Halve towards the place at r
    let lo = 0, hi = 1;
    const inside = near(a);
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2, p: Point = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
      if (near(p) === inside) lo = mid; else hi = mid;
    }
    const t = (lo + hi) / 2;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i], inside = near(p);
    if (i > 0 && near(points[i - 1]) !== inside) {
      const at = crossing(points[i - 1], p);
      if (inside) { run.push(at); if (run.length > 1) out.push(run); run = []; } else run = [at];
    }
    if (!inside) run.push(p);
  }
  if (run.length > 1) out.push(run);
  return out;
}

// --- building ----------------------------------------------------------------------------------------------------

type Sink = { positions: number[]; colors: number[] };
function waterFor(build: CanalBuild, level: number): Sink {
  let sink = build.water.get(clampLevel(level));
  if (!sink) build.water.set(clampLevel(level), sink = { positions: [], colors: [] });
  return sink;
}
function sinkFor(build: CanalBuild, key: MaterialKey): Sink {
  let sink = build.surfaces.get(key);
  if (!sink) build.surfaces.set(key, sink = { positions: [], colors: [] });
  return sink;
}
function triangle(sink: Sink, a: number[], b: number[], c: number[], ca: Color, cb: Color, cc: Color): void {
  sink.positions.push(...a, ...b, ...c);
  sink.colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
}

/**
 * One bank along a chain of points that keeps the water on its perp side: the level's cross-section stretched along it,
 * each strip in its surface's material. Parts over a bridge are left out.
 */
function bank(build: CanalBuild, chain: readonly Point[], level: number, env: CanalEnv, closed = false): void {
  const profile = canalProfile(level), m = env.metre, pal = colours();
  const points = dense(chain, 2.5), frame = normals(points, closed), count = points.length;
  const rows = points.map((p, k) => profile.bank.map(([d, h, surface]) => {
    const reach = (d - profile.water) * m * frame[k].s, x = p[0] + frame[k].n[0] * reach, z = p[1] + frame[k].n[1] * reach;
    return { at: [x, env.ground(x, z) + h * m, z], colour: shaded(pal[surface], x, z), surface };
  }));
  const segments = closed ? count : count - 1;
  for (let k = 0; k < segments; k++) {
    const k2 = (k + 1) % count, mid: Point = [(points[k][0] + points[k2][0]) / 2, (points[k][1] + points[k2][1]) / 2];
    if (env.noBank?.(mid[0], mid[1])) continue;
    for (let j = 0; j < profile.bank.length - 1; j++) {
      const a = rows[k][j], b = rows[k2][j], c = rows[k][j + 1], d = rows[k2][j + 1];
      // A strip takes the surface of its outer edge: a wall's face is the wall, its top the coping
      const sink = sinkFor(build, SURFACE_MATERIAL[profile.bank[j + 1][2]]);
      // Wound so the tops face up and the walls face the water (or away from it, on their outer side)
      triangle(sink, a.at, b.at, c.at, a.colour, b.colour, c.colour);
      triangle(sink, b.at, d.at, c.at, b.colour, d.colour, c.colour);
    }
  }
}

/** The water between a run's two banks */
function waterStrip(build: CanalBuild, points: readonly Point[], level: number, env: CanalEnv): void {
  const half = canalProfile(level).water * env.metre, sink = waterFor(build, level);
  const line = dense(points, 2.5), frame = normals(line, false);
  const edge = line.map((p, k) => {
    // the outward normal points to the right bank; the left one lies the other way
    const r = half * frame[k].s, rx = p[0] + frame[k].n[0] * r, rz = p[1] + frame[k].n[1] * r;
    const lx = p[0] - frame[k].n[0] * r, lz = p[1] - frame[k].n[1] * r;
    // Level across, above the ground on both sides where the land slopes across it (the banks hide the low side's gap)
    const y = Math.max(env.ground(p[0], p[1]), env.ground(rx, rz), env.ground(lx, lz)) + WATER_LIFT;
    return { right: [rx, y, rz], left: [lx, y, lz] };
  });
  for (let k = 0; k < edge.length - 1; k++) {
    const a = edge[k], b = edge[k + 1];
    sink.positions.push(...a.left, ...b.left, ...a.right, ...b.left, ...b.right, ...a.right);
    // Lighter along the middle, darker in the walls' shade
    for (const shade of [0.9, 0.9, 0.9, 0.9, 0.9, 0.9]) sink.colors.push(shade, shade, shade);
  }
}

/** The two banks of a run, and across its ends where the canal stops on its own */
function runBanks(build: CanalBuild, run: CanalRun, env: CanalEnv): void {
  const half = canalProfile(run.level).water * env.metre, line = run.points;
  if (line.length < 2) return;
  const side = (sign: 1 | -1): Point[] => {
    const frame = normals(line, false);
    return line.map((p, k): Point => [p[0] - sign * frame[k].n[0] * half * frame[k].s, p[1] - sign * frame[k].n[1] * half * frame[k].s]);
  };
  // Walked forward the right edge keeps the water on its perp side, the left edge walked back does too (normals()),
  // and so does the way across an end from one to the other, so a square end is one bank round its corners
  const right = side(-1), left = side(1).reverse();
  if (run.capStart && run.capEnd) bank(build, [...right, ...left], run.level, env, true);
  else if (run.capEnd) bank(build, [...right, ...left], run.level, env);
  else if (run.capStart) bank(build, [...left, ...right], run.level, env);
  else { bank(build, right, run.level, env); bank(build, left, run.level, env); }
}

/** Where canals meet: the water of their middle, and a curved bank between each arm and the next */
function junction(build: CanalBuild, j: CanalJunction, env: CanalEnv): void {
  if (j.arms.length < 2) return;
  const level = Math.max(...j.arms.map((a) => a.level)), m = env.metre;
  // Round the middle, each arm's way turned a quarter (perp) points to the next arm
  const arms = [...j.arms].sort((a, b) => Math.atan2(a.way[1], a.way[0]) - Math.atan2(b.way[1], b.way[0]));
  const edges = arms.map((arm) => {
    const n = perp(arm.way), half = canalProfile(arm.level).water * m;
    return { back: [arm.end[0] - n[0] * half, arm.end[1] - n[1] * half] as Point, on: [arm.end[0] + n[0] * half, arm.end[1] + n[1] * half] as Point };
  });
  const ring: Point[] = [];
  for (let i = 0; i < arms.length; i++) {
    const k = (i + 1) % arms.length, a = edges[i].on, b = edges[k].back, w1 = arms[i].way, w2 = arms[k].way;
    // The curve between them, through where the two edges carried on towards the middle would meet; straight where
    // they never would (two arms going opposite ways)
    let curve: Point[] = [a, b];
    const cross = w1[0] * w2[1] - w1[1] * w2[0];
    if (Math.abs(cross) > 0.05) {
      const t = ((b[0] - a[0]) * w2[1] - (b[1] - a[1]) * w2[0]) / cross;
      const u = ((b[0] - a[0]) * w1[1] - (b[1] - a[1]) * w1[0]) / cross;
      if (t < 0 && u < 0) {
        const c: Point = [a[0] + w1[0] * t, a[1] + w1[1] * t];
        curve = [];
        for (let step = 0; step <= 8; step++) {
          const v = step / 8;
          curve.push([(1 - v) * (1 - v) * a[0] + 2 * v * (1 - v) * c[0] + v * v * b[0], (1 - v) * (1 - v) * a[1] + 2 * v * (1 - v) * c[1] + v * v * b[1]]);
        }
      }
    }
    ring.push(edges[i].back, ...curve.slice(0, -1));
    // Its bank keeps the water (the middle) on its perp side
    const mid = curve[Math.floor(curve.length / 2)], dir = unit(sub(curve[curve.length - 1], curve[0])), side = perp(dir);
    const toward = side[0] * (j.at[0] - mid[0]) + side[1] * (j.at[1] - mid[1]) >= 0;
    bank(build, toward ? curve : [...curve].reverse(), level, env);
  }
  const sink = waterFor(build, level);
  const y = Math.max(env.ground(j.at[0], j.at[1]), ...ring.map((p) => env.ground(p[0], p[1]))) + WATER_LIFT;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    sink.positions.push(j.at[0], y, j.at[1], q[0], y, q[1], p[0], y, p[1]);
    for (let v = 0; v < 9; v++) sink.colors.push(0.9);
  }
}

// --- details -----------------------------------------------------------------------------------------------------

export type DetailKind = 'mound' | 'pile' | 'hyacinth' | 'plank' | 'step' | 'drain' | 'post' | 'rail' | 'pole' | 'lamp'
  | 'seat' | 'tree' | 'boat' | 'salaPost' | 'salaFloor' | 'salaRoof' | 'gatePier' | 'gate';

/** Every distance along a chain (world units), from offset, at each step: calls at(x, z, tangent, along) */
function along(points: readonly Point[], step: number, offset: number, at: (x: number, z: number, t: Point, s: number) => void): void {
  let walked = 0, next = offset;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = len(sub(b, a));
    if (l <= 0) continue;
    const t: Point = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    while (next <= walked + l) {
      const u = (next - walked) / l;
      at(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, t, next);
      next += step;
    }
    walked += l;
  }
}

const up = new Vector3(0, 1, 0);
function place(build: CanalBuild, kind: DetailKind, x: number, y: number, z: number, yaw: number, sx: number, sy = sx, sz = sx): void {
  let list = build.details.get(kind);
  if (!list) build.details.set(kind, list = []);
  list.push(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(sx, sy, sz)));
}

/** A sluice gate where a canal opens into a river: a concrete pier at each edge and the steel gate between them */
function gate(build: CanalBuild, at: Point, way: Point, level: number, env: CanalEnv): void {
  const m = env.metre, half = canalProfile(level).water, n = perp(way), yaw = Math.atan2(way[0], way[1]);
  const y = env.ground(at[0], at[1]);
  for (const side of [-1, 1]) {
    const p: Point = [at[0] + n[0] * side * (half + 0.2) * m, at[1] + n[1] * side * (half + 0.2) * m];
    place(build, 'gatePier', p[0], y - 0.05 * m, p[1], yaw, m);
  }
  place(build, 'gate', at[0], y + 0.7 * m, at[1], yaw, 2 * half * m, m, m);
}

/** The things that stand along a run of one level, on both banks and on the water */
function runDetails(build: CanalBuild, run: CanalRun, env: CanalEnv): void {
  const level = clampLevel(run.level), m = env.metre, water = canalProfile(level).water, rng = seededRng(env.seed ?? 7);
  const line = run.points;
  if (line.length < 2) return;
  const last = line.length - 1;
  if (run.openStart) gate(build, line[0], unit(sub(line[1], line[0])), level, env);
  if (run.openEnd) gate(build, line[last], unit(sub(line[last - 1], line[last])), level, env);
  const path = dense(line, 2.5);
  // A point beside the line: its middle moved d metres to one side (side 1 the right bank, -1 the left)
  const beside = (x: number, z: number, t: Point, side: number, d: number): Point => {
    const n = perp(t);
    return [x - n[0] * side * d * m, z - n[1] * side * d * m];
  };
  const groundAt = (p: Point, h: number): number => env.ground(p[0], p[1]) + h * m;
  // The water's level across the canal at a point of its middle, as waterStrip lays it
  const waterAt = (x: number, z: number, t: Point, h: number): number => {
    const a = beside(x, z, t, 1, water), b = beside(x, z, t, -1, water);
    return Math.max(env.ground(x, z), env.ground(a[0], a[1]), env.ground(b[0], b[1])) + WATER_LIFT + h * m;
  };
  const free = (p: Point): boolean => !env.noBank?.(p[0], p[1]);
  const yawOf = (t: Point): number => Math.atan2(t[0], t[1]);
  for (const side of [1, -1]) {
    const phase = side > 0 ? 0 : 0.5;
    if (level === 1) {
      // Heaps of dug earth along the berm
      along(path, 5.5 * m, (1.5 + phase * 2) * m, (x, z, t) => {
        const p = beside(x, z, t, side, 4.2 + rng() * 0.5);
        if (free(p)) place(build, 'mound', p[0], groundAt(p, 0.55), p[1], rng() * 6.3, (0.9 + rng() * 0.6) * m, 0.42 * m, (0.7 + rng() * 0.4) * m);
      });
    }
    if (level === 2) {
      // A row of wooden piles at the water's edge, and water hyacinth drifting along it
      along(path, 0.95 * m, phase * m, (x, z, t) => {
        const p = beside(x, z, t, side, water + 0.06);
        if (free(p)) place(build, 'pile', p[0], groundAt(p, -0.15), p[1], 0, m, (0.6 + rng() * 0.15) * m, m);
      });
      along(path, 3.2 * m, (1 + phase * 3) * m, (x, z, t) => {
        if (rng() < 0.45) return;
        const p = beside(x, z, t, side, water - 0.45 - rng() * 0.5);
        place(build, 'hyacinth', p[0], waterAt(x, z, t, 0.02), p[1], rng() * 6.3, (0.5 + rng() * 0.4) * m, 0.14 * m, (0.4 + rng() * 0.3) * m);
      });
    }
    if (level === 2 || level === 1) continue;
    // Lined canals: drain outlets in the wall, and steps down to the water here and there
    along(path, 13 * m, (5 + phase * 6) * m, (x, z, t) => {
      const p = beside(x, z, t, side, water + 0.02);
      if (free(p)) place(build, 'drain', p[0], groundAt(p, 0.45), p[1], yawOf(t) + Math.PI / 2, m);
    });
    along(path, 44 * m, (14 + phase * 22) * m, (x, z, t) => {
      for (let s = 0; s < 5; s++) {
        const p = beside(x, z, t, side, water - 0.25 - s * 0.32);
        // each step runs along the wall, the flight going down into the water
        if (free(p)) place(build, 'step', p[0], groundAt(p, 0.92 - s * 0.24), p[1], yawOf(t) + Math.PI / 2, m);
      }
    });
    if (level === 3) continue;
    // Walks: railings along the wall, lamps and benches
    const rail = water + 0.15;
    along(path, 2 * m, phase * m, (x, z, t) => {
      const p = beside(x, z, t, side, rail);
      if (!free(p)) return;
      place(build, 'post', p[0], groundAt(p, 1.1), p[1], 0, m);
      for (const h of [1.55, 1.95]) place(build, 'rail', p[0], groundAt(p, h), p[1], yawOf(t), m, m, 2 * m);
    });
    const outer = level === 5 ? 4.6 : 5.25;
    along(path, 14 * m, (3 + phase * 7) * m, (x, z, t) => {
      const p = beside(x, z, t, side, outer);
      if (!free(p)) return;
      place(build, 'pole', p[0], groundAt(p, 1.1), p[1], 0, m);
      place(build, 'lamp', p[0] - perp(t)[0] * side * 0.35 * m, groundAt(p, 4.55), p[1] - perp(t)[1] * side * 0.35 * m, yawOf(t), m);
    });
    along(path, 21 * m, (10 + phase * 10) * m, (x, z, t) => {
      const p = beside(x, z, t, side, level === 5 ? 5.6 : 5);
      // facing the water: its back (local -x) away from it
      if (free(p)) place(build, 'seat', p[0], groundAt(p, 1.1), p[1], yawOf(t) + (side > 0 ? Math.PI : 0), m);
    });
    if (level === 4) continue;
    // The promenade: shade trees in their beds, a sala now and then, boats moored along the wall
    along(path, 9 * m, (4.5 + phase * 4.5) * m, (x, z, t, s) => {
      const p = beside(x, z, t, side, 6.45);
      if (!free(p) || Math.abs(((s / m) % 86) - 43) < 5) return;
      place(build, 'tree', p[0], groundAt(p, 1.14), p[1], rng() * 6.3, (0.42 + rng() * 0.08) * m);
    });
    if (side > 0) along(path, 86 * m, 43 * m, (x, z, t) => {
      const p = beside(x, z, t, side, 5.2);
      if (!free(p)) return;
      const yaw = yawOf(t), y = groundAt(p, 1.1);
      place(build, 'salaFloor', p[0], y, p[1], yaw, m);
      place(build, 'salaRoof', p[0], y + 2.9 * m, p[1], yaw, m);
      for (const [u, v] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
        const n = perp(t), q: Point = [p[0] + (n[0] * u + t[0] * v) * m, p[1] + (n[1] * u + t[1] * v) * m];
        place(build, 'salaPost', q[0], y, q[1], yaw, m);
      }
    });
    along(path, 27 * m, (8 + phase * 13) * m, (x, z, t) => {
      if (rng() < 0.3) return;
      const p = beside(x, z, t, side, water - 1.05);
      place(build, 'boat', p[0], waterAt(x, z, t, -0.05), p[1], yawOf(t) + (rng() < 0.5 ? 0 : Math.PI), 0.62 * m);
    });
  }
}

/** Every surface, the water and the details of these canals */
export function buildCanals(runs: readonly CanalRun[], junctions: readonly CanalJunction[], env: CanalEnv): CanalBuild {
  const build: CanalBuild = { surfaces: new Map(), water: new Map(), details: new Map() };
  for (const run of runs) {
    if (run.points.length < 2) continue;
    waterStrip(build, run.points, run.level, env);
    runBanks(build, run, env);
    runDetails(build, run, env);
  }
  for (const j of junctions) junction(build, j, env);
  return build;
}

// --- meshes ------------------------------------------------------------------------------------------------------

/** The surfaces and the water as meshes: one a material, the library's own finishes tinted by their vertices */
export function canalSurfaceMeshes(build: CanalBuild, name: string): Mesh[] {
  const meshes: Mesh[] = [];
  const mesh = (sink: Sink, key: MaterialKey, repeat: number, water?: Color): void => {
    if (!sink.positions.length) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(sink.positions, 3));
    if (!water) geometry.setAttribute('color', new Float32BufferAttribute(sink.colors, 3));
    const textured = applyWorldUV(geometry, repeat);
    textured.computeVertexNormals();
    const material = water ? tint('water_river', water) : vertexFinish(key);
    const out = new Mesh(textured, material);
    out.name = `${name}/${material.name}`;
    out.receiveShadow = true;
    meshes.push(out);
  };
  // Paving and brick in small units, as a walk is laid; earth, grass and concrete broader
  for (const [key, sink] of build.surfaces) mesh(sink, key, key === 'sidewalk_tile' ? 0.9 : key === 'brick_red' ? 1.4 : 4);
  const pal = colours();
  for (const [level, sink] of build.water) mesh(sink, 'water_river', 6, pal[`water${level}`]);
  return meshes;
}

interface Part { geometry: BufferGeometry; material: Material }
let parts: Map<DetailKind, Part[]> | null = null;

/** Each detail's shape, a metre to a unit, standing on its foot at the origin and running along +z */
export function canalDetailParts(): Map<DetailKind, Part[]> {
  if (parts) return parts;
  const wood = getMaterial('wood_teak'), stone = getMaterial('concrete_weathered'), steel = getMaterial('metal_painted');
  const part = (geometry: BufferGeometry, material: Material): Part[] => [{ geometry, material }];
  // A whole model's meshes, its transforms baked in (a tree, a boat)
  const model = (root: Group): Part[] => {
    const out: Part[] = [];
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
      out.push({ geometry: (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld), material: object.material });
    });
    return out;
  };
  const roof = new CylinderGeometry(0.05, 2.35, 1.1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.55, 0);
  parts = new Map<DetailKind, Part[]>([
    ['mound', part(new IcosahedronGeometry(1, 1), getMaterial('dirt_laterite'))],
    ['pile', part(new CylinderGeometry(0.07, 0.085, 1, 6).translate(0, 0.5, 0), wood)],
    ['hyacinth', part(new IcosahedronGeometry(1, 0), getMaterial('foliage_tropical'))],
    ['plank', part(new BoxGeometry(1.4, 0.08, 1.2), wood)],
    ['step', part(new BoxGeometry(1.8, 0.24, 0.34), stone)],
    ['drain', part(new CylinderGeometry(0.17, 0.17, 0.12, 10).rotateX(Math.PI / 2), getMaterial('metal_steel'))],
    ['post', part(new CylinderGeometry(0.035, 0.035, 0.95, 5).translate(0, 0.475, 0), steel)],
    ['rail', part(new BoxGeometry(0.05, 0.05, 1), steel)],
    ['pole', part(new CylinderGeometry(0.05, 0.075, 3.45, 6).translate(0, 1.725, 0), steel)],
    ['lamp', part(new BoxGeometry(0.28, 0.2, 0.5), getMaterial('emissive_window'))],
    ['seat', part(mergeGeometry([new BoxGeometry(0.42, 0.06, 1.6).translate(0, 0.44, 0), new BoxGeometry(0.06, 0.38, 1.6).translate(-0.2, 0.66, 0),
      new BoxGeometry(0.4, 0.42, 0.08).translate(0, 0.21, -0.7), new BoxGeometry(0.4, 0.42, 0.08).translate(0, 0.21, 0.7)]), wood)],
    ['tree', model(createTree('rain_tree', { seed: 11 }))],
    ['boat', model(createLongtailBoat({ seed: 3 }))],
    ['salaPost', part(new CylinderGeometry(0.09, 0.09, 2.9, 6).translate(0, 1.45, 0), wood)],
    ['salaFloor', part(new BoxGeometry(3, 0.18, 3).translate(0, 0.09, 0), wood)],
    ['salaRoof', part(roof, getMaterial('roof_clay_tile'))],
    ['gatePier', part(new BoxGeometry(0.7, 2.6, 0.9).translate(0, 1.3, 0), stone)],
    ['gate', part(new BoxGeometry(1, 1.3, 0.16), getMaterial('metal_painted'))],
  ]);
  return parts;
}

// --- the gallery's piece -----------------------------------------------------------------------------------------

/** A detail's colour for the gallery's one tinted mesh: a textured library material's own colour is white (its picture
 * brings the colour), so the theme's colour for that material stands in */
function detailColour(material: Material): Color {
  const own = (material as Material & { color?: Color }).color ?? new Color(1, 1, 1);
  const key = material.name.split('#')[0] as keyof typeof SCENE.materials;
  const theme = SCENE.materials[key];
  return own.r + own.g + own.b > 2.85 && theme !== undefined ? new Color(theme) : own;
}

/** A straight canal two tiles long of one level (variant 1–5), for the model gallery */
export function createCanalPiece(options: ModelOptions = {}): Group {
  const level = clampLevel(options.variant ?? 3);
  const env: CanalEnv = { metre: CANAL_PROVINCE_METRE, ground: () => 0, seed: 5 };
  const build = buildCanals([{ points: [[0, -10], [0, 10]], level }], [], env);
  // Its things, trimmed to the piece so they stay inside its two tiles, as one mesh tinted by each part's colour (a model
  // keeps to a few draw calls; the city draws them with their own materials, src/render3d/city/canals.ts)
  const detailParts: Array<{ geometry: BufferGeometry; material: Material; transform: Matrix4 }> = [];
  const shapes = canalDetailParts(), finish = vertexFinish('plaster_white');
  for (const [kind, matrices] of build.details) for (const matrix of matrices) {
    const z = matrix.elements[14];
    if (Math.abs(z) > 10 - (kind === 'tree' ? 3 : kind === 'boat' ? 3.5 : kind.startsWith('sala') ? 2 : 0.6)) continue;
    for (const shape of shapes.get(kind) ?? []) {
      const geometry = shape.geometry.index ? shape.geometry.toNonIndexed() : shape.geometry.clone();
      const colour = detailColour(shape.material), count = geometry.getAttribute('position').count;
      geometry.setAttribute('color', new Float32BufferAttribute(Array.from({ length: count * 3 }, (_, i) => [colour.r, colour.g, colour.b][i % 3]), 3));
      detailParts.push({ geometry, material: finish, transform: matrix });
    }
  }
  const root = mergeByMaterial(CANAL_PIECE_ID, detailParts);
  detailParts.forEach((part) => part.geometry.dispose());
  for (const mesh of canalSurfaceMeshes(build, CANAL_PIECE_ID)) root.add(mesh);
  // Clipped to its two tiles: what reaches past their ends is cut away
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const position = (object.geometry as BufferGeometry).getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      position.setX(i, Math.max(-10, Math.min(10, position.getX(i))));
      position.setZ(i, Math.max(-10, Math.min(10, position.getZ(i))));
      position.setY(i, Math.max(-0.05, position.getY(i)));
    }
    position.needsUpdate = true;
    object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
  });
  root.name = CANAL_PIECE_ID;
  root.userData = { id: CANAL_PIECE_ID, category: 'terrain', footprint: [2, 2], tiles: [], triangles: countTriangles(root),
    regionTier: 'R3', region: options.region ?? 'central', level, canal: true };
  return root;
}
