/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The smoke of chimneys in the 3D view (docs/3d/RENDERER_SPEC.md 8D; owner, 24 Oct 2026: "ควันไฟ ทำให้มันดีกว่านี้ได้ไหมน่ะ").
// Each chimney (smokeSources.ts) gives a plume of soft round puffs that rise, widen, thin and fade with height, swirl a
// little and lean downwind with the season's wind (src/wind.ts); the rain and fog keep them low, a thick plume from
// heavy industry is darker than a bakery's thin pale one, and a building that is not powered or stands empty gives none.
// Light on the graphics card: every puff of every plume is one instance of one quad, drawn in ONE call, and its place
// is worked out on the graphics card from its age, so the processor only writes the puffs again twice a second (when a
// chimney comes, goes or the camera moves between detail rings) and sets a few numbers a frame. Near the camera a
// plume has many puffs, farther fewer and bigger, farther still none, and no more than MAX_NEAR plumes are full.
// Colours from src/theme/tokens.ts SCENE.plume.

import { Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh, PlaneGeometry,
  ShaderMaterial, UniformsLib, UniformsUtils, Vector2, Vector3 } from 'three';
import { SCENE } from '../../theme/tokens.js';
import { emittersOf, type Emitter, type SmokeSource, type SmokingPlacement } from './smokeSources.js';

/** The puffs of the whole city, at most (the one draw's size) */
export const PLUME_BUDGET = 1100;
/** Distances from the camera (world units) out to which a plume has NEAR, MID and FAR puffs; beyond FAR it has none */
export const RINGS = { near: 170, mid: 480, far: 1100 } as const;
/** Puffs of a plume in each ring, and the bigger the puffs of the farther rings (so few still make a plume) */
export const PUFFS = { near: 26, mid: 11, far: 4 } as const;
const SIZE_UP = { near: 1, mid: 1.35, far: 2 } as const;
/** The most plumes with all their near puffs; the rest of those near have a mid plume */
export const MAX_NEAR = 14;
/** Seconds a puff lives, and how often the puffs are written again */
const LIFE = 11, REFRESH = 0.4;

export type Ring = 'near' | 'mid' | 'far';
export interface PlumePlan { emitter: Emitter; ring: Ring; puffs: number; distance: number }

/** Which plumes are drawn and how fully: the nearest first, each in the ring its distance puts it in, the ring's puffs
 * fewer for the plumes past MAX_NEAR and once the budget is spent; none past the far ring. Never more than `budget` puffs. */
export function planPlumes(emitters: readonly Emitter[], eye: { x: number; y: number; z: number }, budget = PLUME_BUDGET,
    maxNear = MAX_NEAR): PlumePlan[] {
  const ranked = emitters.map(emitter => ({ emitter, distance: Math.hypot(emitter.x - eye.x, emitter.y - eye.y, emitter.z - eye.z) }))
    .filter(e => e.distance < RINGS.far).sort((a, b) => a.distance - b.distance);
  const plans: PlumePlan[] = [];
  let used = 0, near = 0;
  for (const { emitter, distance } of ranked) {
    let ring: Ring = distance < RINGS.near ? 'near' : distance < RINGS.mid ? 'mid' : 'far';
    if (ring === 'near' && near >= maxNear) ring = 'mid';
    while (used + PUFFS[ring] > budget && ring !== 'far') ring = ring === 'near' ? 'mid' : 'far';
    if (used + PUFFS[ring] > budget) break;
    if (ring === 'near') near++;
    used += PUFFS[ring];
    plans.push({ emitter, ring, puffs: PUFFS[ring], distance });
  }
  return plans;
}

/** What a plume reads of the world each frame */
export interface PlumeWorld {
  /** Where the wind blows on the map (x east, y south, the same as world x and z), unit vector, and how hard 0–1 */
  wind: { x: number; y: number; strength: number };
  rain: number; fog: number;
  /** 0 day to 1 night, and how deep into sunrise or sunset the light is, 0–1 */
  night: number; twilight: number;
}

/** The height a plume reaches in metres over a puff's life: thicker plumes from heavier industry go higher; the rain and
 * fog keep it low. The vertex shader works the same out (VERTEX) */
export const plumeHeight = (output: number, world: { rain: number; fog: number }): number =>
  (9 + 14 * output) * (1 - 0.45 * world.rain) * (1 - 0.25 * world.fog);

/** How far downwind a puff of this age (0–1 of its life) has leaned, in the plume's metres, as the shader works it out:
 * the wind's way times its strength, more with height, none in still air */
export function plumeLean(age: number, height: number, wind: { x: number; y: number; strength: number }): { x: number; z: number } {
  const lean = height * 1.6 * age * (0.4 + 0.6 * age) * wind.strength;
  return { x: wind.x * lean, z: wind.y * lean };
}

/** How dense a plume shows: a thin plume faint, a thick one near solid, wet air thinning it; the shader's alpha at a puff's
 * age (0–1): in as it leaves the chimney, out toward the top */
export function plumeAlpha(age: number, output: number, world: { rain: number; fog: number }): number {
  const rise = Math.min(1, Math.max(0, age / 0.1)), fade = Math.pow(1 - age, 1.4);
  return Math.pow(Math.min(1, output), 0.8) * 0.95 * rise * rise * (3 - 2 * rise) * fade * (1 - 0.3 * world.rain - 0.3 * world.fog);
}

const VERTEX = /* glsl */`
attribute vec4 aSrc;   // x y z of the chimney's mouth, and the world units one metre is drawn at
attribute vec4 aPuff;  // phase 0-1, seed 0-1, mouth radius in metres, output (thickness) with the plume's fade
attribute vec2 aTone;  // soot 0-1, the ring's size-up
uniform float uTime, uLife, uRise, uDim;
uniform vec2 uWind;
uniform vec3 uPale, uSoot;
varying vec2 vUv;
varying float vAlpha, vSeed;
varying vec3 vColor;
#include <fog_pars_vertex>
void main() {
  float a = fract(uTime / uLife + aPuff.x);
  float m = aSrc.w, out_ = aPuff.w;
  float height = (9.0 + 14.0 * min(out_, 1.6)) * m * uRise;
  float rise = 1.0 - pow(1.0 - a, 1.7);
  float ph = aPuff.y * 6.2831853;
  vec3 c = aSrc.xyz;
  float size = aPuff.z * m * aTone.y;
  c.y += height * rise;
  // downwind, more with height; none in still air (uWind is the wind's way times its strength)
  c.xz += uWind * height * 1.6 * a * (0.4 + 0.6 * a);
  // a gentle swirl, growing with the puff
  c.x += sin(a * 5.0 + ph) * 0.4 * size * (1.0 + a * 2.5);
  c.z += cos(a * 4.3 + ph * 1.3) * 0.4 * size * (1.0 + a * 2.5);
  float radius = size * (1.1 + a * 5.6);
  float inA = smoothstep(0.0, 0.1, a);
  vAlpha = pow(min(out_, 1.0), 0.8) * 0.95 * inA * pow(1.0 - a, 1.4) * uDim;
  vColor = mix(uPale, uSoot, aTone.x * (1.0 - smoothstep(0.0, 0.8, a)));
  vSeed = aPuff.y;
  vUv = position.xy * 2.0;
  vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
  mvPosition.xy += position.xy * 2.0 * radius;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */`
varying vec2 vUv;
varying float vAlpha, vSeed;
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
  float d = length(vUv);
  if (d > 1.0 || vAlpha < 0.004) discard;
  // a lumpy edge, so a puff is never a clean disc, and the same puff always the same lumps
  float lump = 0.14 * sin(vUv.x * 4.0 + vSeed * 9.0) * sin(vUv.y * 4.0 + vSeed * 5.0) + 0.08 * sin((vUv.x + vUv.y) * 7.0 + vSeed * 3.0);
  float f = 1.0 - smoothstep(0.1, 1.0, d + lump);
  f *= f;
  // lit from above: the top of a puff a little paler than its underside
  vec3 col = vColor * (0.82 + 0.18 * (vUv.y * 0.5 + 0.5));
  gl_FragColor = vec4(col, vAlpha * f);
  #include <fog_fragment>
}`;

const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

interface Slot { emitter: Emitter; k: number; alive: boolean }

/** What the view reads of its chunks to find the chimneys (CityChunks.smokers) */
export interface PlumeChunks {
  smokers(visit: (placement: SmokingPlacement, sources: readonly SmokeSource[]) => void, x: number, z: number, radius: number): void;
}

/** Every chimney's plume of a city, in one instanced draw */
export class CityPlumes {
  readonly root = new Group();
  readonly mesh: Mesh;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly src: InstancedBufferAttribute; private readonly puff: InstancedBufferAttribute; private readonly tone: InstancedBufferAttribute;
  private readonly slots = new Map<string, Slot>();
  private readonly found: Emitter[] = [];
  private readonly matrix = new Matrix4(); private readonly point = new Vector3();
  private readonly pale = new Color(); private readonly soot = new Color(); private readonly tint = new Color();
  private lastRefresh = -Infinity;
  /** Plumes and puffs drawn at the last refresh (tests, the bench) */
  plumes = 0; puffs = 0;
  /** The plumes in the plan of the last refresh, by ring */
  rings: Record<Ring, number> = { near: 0, mid: 0, far: 0 };

  constructor(readonly budget = PLUME_BUDGET) {
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    const make = (size: number): InstancedBufferAttribute => new InstancedBufferAttribute(new Float32Array(budget * size), size).setUsage(DynamicDrawUsage);
    this.src = make(4); this.puff = make(4); this.tone = make(2);
    this.geometry.setAttribute('aSrc', this.src); this.geometry.setAttribute('aPuff', this.puff); this.geometry.setAttribute('aTone', this.tone);
    this.geometry.instanceCount = 0;
    this.material = new ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: true,
      uniforms: UniformsUtils.merge([UniformsLib.fog, {
        uTime: { value: 0 }, uLife: { value: LIFE }, uRise: { value: 1 }, uDim: { value: 1 },
        uWind: { value: new Vector2() }, uPale: { value: new Color() }, uSoot: { value: new Color() },
      }]),
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'city/plumes'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false;
    this.root.add(this.mesh);
  }

  /** One frame: the world's numbers into the shader, and twice a second the chimneys looked at again. `seconds` runs in real
   * time, so the smoke moves under a paused game as the weather does. */
  update(chunks: PlumeChunks, eye: Vector3, seconds: number, world: PlumeWorld): void {
    if (seconds - this.lastRefresh >= REFRESH || seconds < this.lastRefresh) { this.lastRefresh = seconds; this.refresh(chunks, eye); }
    const u = this.material.uniforms;
    (u.uWind.value as Vector2).set(world.wind.x * world.wind.strength, world.wind.y * world.wind.strength);
    this.mesh.visible = this.puffs > 0;
    if (!this.mesh.visible) return;
    u.uTime.value = seconds % (LIFE * 1000);
    u.uRise.value = (1 - 0.45 * world.rain) * (1 - 0.25 * world.fog);
    u.uDim.value = 1 - 0.3 * world.rain - 0.3 * world.fog;
    // the light of the hour: pale smoke warms toward the sunset's clay and goes a dim lavender by night, the soot with it
    const tw = Math.min(1, Math.max(0, world.twilight)), night = Math.min(1, Math.max(0, world.night)), light = 1 - 0.62 * night;
    const day = SCENE.plume;
    this.pale.set(day.day).lerp(this.tint.set(day.dusk), tw * 0.6).lerp(this.tint.set(day.night), night).multiplyScalar(light);
    this.soot.set(day.soot).lerp(this.tint.set(day.night), night * 0.7).multiplyScalar(0.55 + 0.45 * light);
    (u.uPale.value as Color).copy(this.pale); (u.uSoot.value as Color).copy(this.soot);
  }

  private refresh(chunks: PlumeChunks, eye: Vector3): void {
    this.found.length = 0;
    chunks.smokers((p, sources) => emittersOf(p, sources, this.found, this.matrix, this.point), eye.x, eye.z, RINGS.far);
    for (const s of this.slots.values()) s.alive = false;
    for (const e of this.found) {
      const slot = this.slots.get(e.key);
      if (slot) { slot.emitter = e; slot.alive = true; slot.k = Math.min(1, slot.k + 0.2); }
      else this.slots.set(e.key, { emitter: e, k: 0.2, alive: true });
    }
    // A chimney that stopped fades out over a few refreshes, then goes
    const live: Emitter[] = [], strength = new Map<string, number>();
    for (const [key, s] of this.slots) {
      if (!s.alive) { s.k -= 0.2; if (s.k <= 0.001) { this.slots.delete(key); continue; } }
      live.push(s.emitter); strength.set(key, s.k);
    }
    const plans = planPlumes(live, eye, this.budget);
    const src = this.src.array as Float32Array, puff = this.puff.array as Float32Array, tone = this.tone.array as Float32Array;
    let n = 0;
    this.rings = { near: 0, mid: 0, far: 0 };
    for (const plan of plans) {
      const e = plan.emitter, k = strength.get(e.key) ?? 1, base = hash(e.key);
      this.rings[plan.ring]++;
      for (let i = 0; i < plan.puffs; i++, n++) {
        const seed = hash(`${e.key}#${i}`);
        src[n * 4] = e.x; src[n * 4 + 1] = e.y; src[n * 4 + 2] = e.z; src[n * 4 + 3] = e.scale;
        puff[n * 4] = (i + 0.7 * seed + base) / plan.puffs % 1; puff[n * 4 + 1] = seed;
        puff[n * 4 + 2] = 0.9 + 1.0 * e.output; puff[n * 4 + 3] = e.output * k;
        tone[n * 2] = e.soot; tone[n * 2 + 1] = SIZE_UP[plan.ring];
      }
    }
    this.plumes = plans.length; this.puffs = n; this.geometry.instanceCount = n;
    this.src.needsUpdate = this.puff.needsUpdate = this.tone.needsUpdate = true;
  }

  dispose(): void { this.geometry.dispose(); this.material.dispose(); this.root.clear(); this.slots.clear(); }
}
