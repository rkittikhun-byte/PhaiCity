/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
/// <reference path="./meshoptimizer.d.ts" />

// Levels of detail for the models a city repeats many times (docs/3d/RENDERER_SPEC.md §8B): lighter copies of a model,
// made once when it loads, each drawn only from the distance at which it changes nothing on the screen by more than a
// pixel, so a town of thousands of buildings stays at 60 frames a second on integrated graphics without anything
// seen to change.
//
// The copies come from meshoptimizer's simplifier (MIT; loaded lazily, never in a headless test unless one hands it
// in), which keeps each copy within a set distance of the model (its error) and keeps the edges between colours. A
// copy whose error is e world units moves no point of the model on the screen by more than
// e x pixelsPerUnit / distance pixels, where pixelsPerUnit is the screen's pixels per world unit one unit from the
// camera: so it is drawn from e x pixelsPerUnit / LOD_PIXELS on (lodDistance). Near the camera every model is drawn as
// it always was.

/** The simplifier's calls this file uses (meshoptimizer's MeshoptSimplifier) */
export interface Simplifier {
  readonly supported?: boolean;
  readonly ready: Promise<void>;
  simplify(indices: Uint32Array, positions: Float32Array, stride: number, targetIndexCount: number, targetError: number,
    flags?: ('LockBorder' | 'Sparse' | 'ErrorAbsolute' | 'Prune' | 'Regularize' | 'Permissive')[]): [Uint32Array, number];
}

/** The errors the levels are made for, in the model's own units (metres for the era buildings), finest first */
export const LOD_ERRORS: readonly number[] = [0.04, 0.12, 0.36];
/** How far a level may move any point of a model on the screen, in pixels, where it starts to be drawn */
export const LOD_PIXELS = 1;
/** A level changes only once the distance is this share past its threshold, so a still camera never flickers */
export const LOD_HYSTERESIS = 0.06;
/** A level is kept only when it has at most this share of the triangles of the level before it */
export const LOD_MIN_SAVING = 0.8;

/** One part of a model at a level: its own vertices (only those it uses) and triangles */
export interface LodGeometry { attributes: Record<string, { array: Float32Array; size: number }>; index: Uint32Array }
/** A level of a model: the error it was made within (the model's units), and each of its parts (null: gone) */
export interface LodLevel { error: number; parts: (LodGeometry | null)[] }

/** The distance (world units) from which a level whose error is `error` world units can be drawn */
export function lodDistance(error: number, pixelsPerUnit: number, pixels = LOD_PIXELS): number {
  return error * pixelsPerUnit / pixels;
}

/**
 * The level to draw at `distance` (world units from the camera to the nearest point of the model): the coarsest whose
 * threshold it is past. `thresholds[k]` is where level k + 1 may start, rising. A level already drawn (`current`) holds
 * until the distance is LOD_HYSTERESIS past its threshold either way.
 */
export function lodLevel(distance: number, thresholds: ArrayLike<number>, current = -1): number {
  let level = 0;
  for (let k = 0; k < thresholds.length; k++) {
    const t = current < 0 ? thresholds[k] : thresholds[k] * (current > k ? 1 - LOD_HYSTERESIS : 1 + LOD_HYSTERESIS);
    if (distance >= t) level = k + 1; else break;
  }
  return level;
}

/** The pixels a world unit one unit from a perspective camera takes on the screen, for a drawing `height` pixels high */
export function pixelsPerUnit(height: number, fovDegrees: number): number {
  return height / (2 * Math.tan(fovDegrees * Math.PI / 360));
}

/** A part of a model to make levels of: its attributes (position among them) and its triangles (null: in order) */
export interface LodSource { attributes: Record<string, { array: Float32Array; size: number }>; index: Uint32Array | null }

const triangles = (parts: readonly (LodGeometry | LodSource | null)[]): number =>
  parts.reduce((sum, p) => sum + (p ? (p.index ? p.index.length : p.attributes.position.array.length / 3) / 3 : 0), 0);

/** A part's triangles over only the vertices they use, in the order first used */
export function compact(source: LodSource, index: Uint32Array): LodGeometry {
  const count = source.attributes.position.array.length / 3, remap = new Int32Array(count).fill(-1);
  const out = new Uint32Array(index.length);
  let used = 0;
  for (let i = 0; i < index.length; i++) {
    const v = index[i];
    if (remap[v] < 0) remap[v] = used++;
    out[i] = remap[v];
  }
  const attributes: LodGeometry['attributes'] = {};
  for (const [name, { array, size }] of Object.entries(source.attributes)) {
    const next = new Float32Array(used * size);
    for (let v = 0; v < count; v++) {
      const to = remap[v];
      if (to >= 0) for (let c = 0; c < size; c++) next[to * size + c] = array[v * size + c];
    }
    attributes[name] = { array: next, size };
  }
  return { attributes, index: out };
}

/** Faces meeting at more than this are a crease the levels keep (degrees): the era buildings are drawn flat shaded, so
 * every plank, groove and window frame shows as a line of light and shade however shallow it is */
export const CREASE_DEGREES = 20;

/**
 * A part with its vertices split wherever the faces round them turn by more than `degrees`, so each side of a crease
 * has a vertex of its own. The simplifier keeps such seams, as it keeps the edges between colours: it may still slide a
 * vertex along a crease, but never across one, so no shallow relief is smoothed away. Positions and every other
 * attribute are copied to the split vertices.
 */
export function splitCreases(source: LodSource, degrees = CREASE_DEGREES): LodSource {
  const positions = source.attributes.position.array, count = positions.length / 3;
  const index = source.index ?? Uint32Array.from({ length: count }, (_, i) => i), faces = index.length / 3;
  const normals = new Float32Array(faces * 3);
  for (let f = 0; f < faces; f++) {
    const a = index[f * 3] * 3, b = index[f * 3 + 1] * 3, c = index[f * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l > 0) { normals[f * 3] = nx / l; normals[f * 3 + 1] = ny / l; normals[f * 3 + 2] = nz / l; }
  }
  // Each vertex's faces, then the faces round it gathered by the way they face
  const start = new Uint32Array(count + 1);
  for (let i = 0; i < index.length; i++) start[index[i] + 1]++;
  for (let v = 0; v < count; v++) start[v + 1] += start[v];
  const fill = start.slice(0, count), corners = new Uint32Array(index.length);
  for (let i = 0; i < index.length; i++) corners[fill[index[i]]++] = i;
  const limit = Math.cos(degrees * Math.PI / 180), out = new Uint32Array(index.length), from: number[] = [];
  for (let v = 0; v < count; v++) {
    const groups: { n: number; vertex: number }[] = [];
    for (let k = start[v]; k < start[v + 1]; k++) {
      const corner = corners[k], f = (corner / 3) | 0, n = f * 3;
      let group = groups.find(g => normals[g.n] * normals[n] + normals[g.n + 1] * normals[n + 1] + normals[g.n + 2] * normals[n + 2] >= limit);
      if (!group) { group = { n, vertex: from.length }; from.push(v); groups.push(group); }
      out[corner] = group.vertex;
    }
  }
  const attributes: LodSource['attributes'] = {};
  for (const [name, { array, size }] of Object.entries(source.attributes)) {
    const next = new Float32Array(from.length * size);
    from.forEach((v, i) => { for (let c = 0; c < size; c++) next[i * size + c] = array[v * size + c]; });
    attributes[name] = { array: next, size };
  }
  return { attributes, index: out };
}

/**
 * The size, in the model's units, below which a crease's light and shade no longer reads on its own: an era building's
 * planks, grooves, frames and roof ribs are a quarter to half a metre across. The last level may smooth creases away, so
 * it is drawn only from where this is under a pixel too (makeLevels).
 */
export const LOD_FEATURE = 0.5;

/** One level of every part, simplified within `target` from `parts`: its parts and the largest error any reached */
function level(parts: readonly LodSource[], simplifier: Simplifier, target: number): { error: number; parts: (LodGeometry | null)[] } {
  let error = 0;
  const out = parts.map(part => {
    const positions = part.attributes.position.array, vertices = positions.length / 3;
    const index = part.index ?? Uint32Array.from({ length: vertices }, (_, i) => i);
    if (index.length < 3) return null;
    const [simplified, reached] = simplifier.simplify(index, positions, 3, 0, target, ['ErrorAbsolute', 'Prune']);
    error = Math.max(error, reached);
    return simplified.length >= 3 ? compact(part, simplified) : null;
  });
  return { error, parts: out };
}

/**
 * The levels of a model of several parts (body and windows, say), each part simplified from the original within each
 * of `errors`, dropping parts that come to nothing. Creases are kept (splitCreases), and after them comes one level
 * that need not keep them, drawn only where a crease-made feature (LOD_FEATURE) is under a pixel as well. A level that
 * saves too little over the one before it is left out, and a level's error is the largest any part reached (never
 * less than the level before it's), so its distance is never too near.
 */
export function makeLevels(sources: readonly LodSource[], simplifier: Simplifier, errors: readonly number[] = LOD_ERRORS): LodLevel[] {
  const levels: LodLevel[] = [], creased = sources.map(part => splitCreases(part));
  let before = triangles(sources);
  const keep = (made: { error: number; parts: (LodGeometry | null)[] }, least = 0): void => {
    const count = triangles(made.parts);
    if (count > before * LOD_MIN_SAVING) return;
    levels.push({ error: Math.max(made.error, least, levels.length ? levels[levels.length - 1].error : 0), parts: made.parts });
    before = count;
  };
  for (const target of errors) keep(level(creased, simplifier, target));
  keep(level(sources, simplifier, errors[errors.length - 1] ?? LOD_FEATURE), LOD_FEATURE);
  return levels;
}

/**
 * The error of a model's shadow caster (the model's units: metres for the era buildings, drawn at 10/16): the sun's
 * shadow map is 1,024 texels over at least 170 world units (index.ts render), so a texel is 0.166 units or more, 0.27 m
 * of an era building; a caster within 0.25 m casts the same shadow
 */
export const SHADOW_ERROR = 0.25;

/**
 * A model's parts for its shadow alone: simplified within `error` with no care for creases or colours, which a depth
 * map never sees, so far lighter than any level drawn on the screen; null for a part that comes to nothing
 */
export function makeShadow(sources: readonly LodSource[], simplifier: Simplifier, error = SHADOW_ERROR): (LodGeometry | null)[] {
  return sources.map(part => {
    const positions = part.attributes.position.array;
    const index = part.index ?? Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
    if (index.length < 3) return null;
    const [simplified] = simplifier.simplify(index, positions, 3, 0, error, ['ErrorAbsolute', 'Prune', 'Permissive']);
    return simplified.length >= 3 ? compact({ attributes: { position: part.attributes.position }, index }, simplified) : null;
  });
}

let injected: Simplifier | null = null;
let loading: Promise<Simplifier | null> | null = null;
/** The simplifier the levels are made with: handed in (a test), else meshoptimizer's, loaded once; null where it cannot
 * run (no WebAssembly), and then every model is drawn whole as before */
export function loadSimplifier(): Promise<Simplifier | null> {
  if (injected) { const s = injected; return s.ready.then(() => s); }
  return loading ??= import('meshoptimizer/simplifier').then(async module => {
    const simplifier = module.MeshoptSimplifier as Simplifier;
    if (simplifier.supported === false) return null;
    await simplifier.ready;
    return simplifier;
  }).catch(error => { console.warn('PhaiCity: the model simplifier did not load; models are drawn whole', error); return null; });
}
/** Hands in the simplifier to use (null: back to loading meshoptimizer's) */
export function useSimplifier(simplifier: Simplifier | null): void { injected = simplifier; loading = null; }
