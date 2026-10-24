/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Where chimneys smoke (docs/3d/RENDERER_SPEC.md 8D; owner, 24 Oct 2026: "ควันไฟ ทำให้มันดีกว่านี้ได้ไหมน่ะ"). The era
// buildings' Blender models carried their smoke as a few grey spheres in a row, baked into the glb in the palette's
// `smoke` colour, which read as a string of beads, still and the same for every chimney. This file finds those spheres
// when a model is loaded, takes them out of the model and keeps only where each chain started and how thick it was; the
// plumes (plumes.ts) are drawn from that, by the world. Plain code, no DOM, so tests run it.

import type { Matrix4, Vector3 } from 'three';

/** Where a chimney's smoke leaves it, in the model's own metres: the base of the chain's lowest sphere, and the
 * sphere's radius, which is how thick the chimney's smoke is */
export interface SmokeSource { x: number; y: number; z: number; r: number }

/** The palette's `smoke` (E4E0DA in hex), as the glb keeps it in a vertex colour: the linear value, or the sRGB one where the
 * exporter did not convert */
const SMOKE_LINEAR: readonly [number, number, number] = [0.776, 0.745, 0.701];
const SMOKE_SRGB: readonly [number, number, number] = [0.894, 0.878, 0.855];
/** How far a channel may stray (8-bit quantisation) and still be the smoke colour; the palette's nearest whites are
 * three times as far */
const TOLERANCE = 0.02;
/** The radii (metres) of a puff the models draw: smaller is a part of a building, bigger is not a puff */
const MIN_RADIUS = 0.35, MAX_RADIUS = 6;

const near = (a: ArrayLike<number>, i: number, target: readonly [number, number, number]): boolean =>
  Math.abs(a[i] - target[0]) < TOLERANCE && Math.abs(a[i + 1] - target[1]) < TOLERANCE && Math.abs(a[i + 2] - target[2]) < TOLERANCE;

/** Whether the colour at vertex v of a vertex colour array (three floats a vertex) is the palette's smoke */
export function isSmokeColour(color: ArrayLike<number>, v: number): boolean {
  return near(color, v * 3, SMOKE_LINEAR) || near(color, v * 3, SMOKE_SRGB);
}

/** A model with its smoke spheres taken out */
export interface SmokeSplit {
  position: Float32Array; color: Float32Array; index: Uint32Array | null;
  sources: SmokeSource[];
}

/**
 * Takes the spheres drawn in the smoke colour out of a model's triangles (every vertex of each in that colour; the
 * remaining vertices are packed) and returns where each chain of them started. A chain is spheres that follow one
 * another up and away from the chimney, as the models' `drift` and `smoke` helpers build them. A model with none comes
 * back as it was.
 */
export function splitSmoke(position: Float32Array, color: Float32Array, index: Uint32Array | null): SmokeSplit {
  const count = position.length / 3, tri = index ? index.length / 3 : count / 3;
  const corner = (t: number, k: number): number => index ? index[t * 3 + k] : t * 3 + k;
  const smoky = new Uint8Array(count);
  for (let v = 0; v < count; v++) smoky[v] = isSmokeColour(color, v) ? 1 : 0;
  const dropped = new Uint8Array(tri);
  let any = false;
  for (let t = 0; t < tri; t++) if (smoky[corner(t, 0)] && smoky[corner(t, 1)] && smoky[corner(t, 2)]) { dropped[t] = 1; any = true; }
  if (!any) return { position, color, index, sources: [] };

  // Each sphere is a component of the dropped triangles, joined through the vertices they share
  const parent = new Int32Array(count).map((_, i) => i);
  const find = (v: number): number => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
  for (let t = 0; t < tri; t++) if (dropped[t]) {
    const a = find(corner(t, 0));
    for (let k = 1; k < 3; k++) { const b = find(corner(t, k)); if (a !== b) parent[b] = a; }
  }
  const boxes = new Map<number, { min: number[]; max: number[] }>();
  for (let t = 0; t < tri; t++) if (dropped[t]) for (let k = 0; k < 3; k++) {
    const v = corner(t, k), root = find(v), p = v * 3;
    let box = boxes.get(root);
    if (!box) boxes.set(root, box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    for (let c = 0; c < 3; c++) { box.min[c] = Math.min(box.min[c], position[p + c]); box.max[c] = Math.max(box.max[c], position[p + c]); }
  }
  // ... of which only the round ones the size of a puff are smoke; a small pale part of a building that happens to be in the
  // same colour (a vent, a label) stays where it is
  const roots = new Set<number>();
  const spheres: { x: number; y: number; z: number; r: number; h: number }[] = [];
  for (const [root, b] of boxes) {
    const wx = b.max[0] - b.min[0], wy = b.max[1] - b.min[1], wz = b.max[2] - b.min[2];
    const r = Math.sqrt(Math.max(1e-4, wx * wz)) / 2, round = wy > 0.3 * Math.max(wx, wz) && wy < 3 * Math.max(wx, wz);
    if (r < MIN_RADIUS || r > MAX_RADIUS || !round) continue;
    roots.add(root);
    spheres.push({ x: (b.min[0] + b.max[0]) / 2, y: (b.min[1] + b.max[1]) / 2, z: (b.min[2] + b.max[2]) / 2, r, h: wy / 2 });
  }
  if (!spheres.length) return { position, color, index, sources: [] };
  for (let t = 0; t < tri; t++) if (dropped[t] && !roots.has(find(corner(t, 0)))) dropped[t] = 0;
  spheres.sort((a, b) => a.y - b.y);
  // ... which follow one another up and away: each joins the chain whose last sphere is near enough below it
  const chains: typeof spheres[] = [];
  for (const s of spheres) {
    let home: typeof spheres | null = null, best = Infinity;
    for (const chain of chains) {
      const last = chain[chain.length - 1], reach = 3.2 * (s.r + last.r);
      const d = Math.hypot(s.x - last.x, s.y - last.y, s.z - last.z);
      if (d < reach && d < best) { best = d; home = chain; }
    }
    if (home) home.push(s); else chains.push([s]);
  }
  const sources = chains.map(chain => { const s = chain[0]; return { x: s.x, y: s.y - s.h, z: s.z, r: s.r }; });

  // The vertices left, packed
  const remap = new Int32Array(count).fill(-1);
  let kept = 0;
  const outIndex: number[] = [];
  for (let t = 0; t < tri; t++) if (!dropped[t]) for (let k = 0; k < 3; k++) {
    const v = corner(t, k);
    if (remap[v] < 0) remap[v] = kept++;
    outIndex.push(remap[v]);
  }
  const outPosition = new Float32Array(kept * 3), outColor = new Float32Array(kept * 3);
  for (let v = 0; v < count; v++) if (remap[v] >= 0) {
    const o = remap[v] * 3;
    for (let c = 0; c < 3; c++) { outPosition[o + c] = position[v * 3 + c]; outColor[o + c] = color[v * 3 + c]; }
  }
  return { position: outPosition, color: outColor, index: Uint32Array.from(outIndex), sources };
}

/** One chimney placed in the city: where its smoke leaves it (world units), the units a metre is drawn at, and how
 * much it gives (below) */
export interface Emitter { key: string; x: number; y: number; z: number; scale: number; output: number; soot: number }

/** What the view reads of a placed building to know whether it smokes: its place, its model's sources and its state */
export interface SmokingPlacement {
  index: number; powered: boolean; weather?: number; scale: number;
  modelMatrix(target: Matrix4): Matrix4;
}

/** The thinnest and the thickest smoke: a cooking fire's wisp, and a power plant's column. `output` is 1 for a source of
 * this radius (metres) */
export const OUTPUT_RADIUS = 1.2;
export const OUTPUT_MIN = 0.3, OUTPUT_MAX = 1.6;

/** How much a source gives, by its radius: a bakery's chimney thin and pale, heavy industry's thick */
export const outputOf = (r: number): number => Math.max(OUTPUT_MIN, Math.min(OUTPUT_MAX, r / OUTPUT_RADIUS));
/** How sooty it is, 0 pale to 1 black: only the thick plumes of heavy industry have soot in them */
export const sootOf = (output: number, r = 1): number => r > STEAM_RADIUS ? 0 : Math.max(0, Math.min(1, (output - 0.55) / 1.0));
/** A source this wide is a cooling tower's steam, white, never sooty */
export const STEAM_RADIUS = 2.2;

/** A building smokes only while it stands used: powered (src/blockMapUtils.js: factories only make smoke, and the
 * pollution the simulation counts, while they work), and not left standing empty to weather (src/plotBuildings.ts decayOf,
 * whose weather is 0.5 once weathered); a construction site and rubble are not era models and have no sources */
export const smokes = (p: { powered: boolean; weather?: number }): boolean => p.powered && (p.weather ?? 0) < 0.5;

/** Each chimney of a placed building, in the world; none when it does not smoke */
export function emittersOf(p: SmokingPlacement, sources: readonly SmokeSource[], target: Emitter[], matrix: Matrix4,
  point: Vector3): void {
  if (!smokes(p)) return;
  p.modelMatrix(matrix);
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    point.set(s.x, s.y, s.z); point.applyMatrix4(matrix);
    const output = outputOf(s.r);
    target.push({ key: `${p.index}.${i}`, x: point.x, y: point.y, z: point.z, scale: p.scale, output, soot: sootOf(output, s.r) });
  }
}
