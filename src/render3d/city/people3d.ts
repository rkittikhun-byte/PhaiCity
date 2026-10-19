/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The people of the concept sheets walking the streets (owner, 19 Oct 2026; art/people/IMPORT.md).
//
// Every character (assets/models/people/<sheet>/<id>.glb, made by art/people/scripts/export_game.py) has the same
// jointed parts: body (hips), head (neck), arm_R/L (shoulders) -> forearm_R/L (elbows), leg_R/L (hips) ->
// shin_R/L (knees). The activity clips in clips.glb turn those parts, so one clip moves anyone. Each part of each
// character is one geometry in a single BatchedMesh, so every person on screen is one draw call together.
//
// Who walks depends on the city's era (gameMap.era, src/era.ts) and region: the shared characters (monk, yoke
// vendor, schoolchildren), the era's sheet and the region's sheet. The renderer only reads the city.

import {
  type AnimationClip, BatchedMesh, type KeyframeTrack, BufferAttribute, BufferGeometry, Matrix4, MeshStandardMaterial, type Object3D,
  Quaternion, Vector3, type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RegionId } from '../regional/types.js';

export const PEOPLE_BASE = 'assets/models/people/';

export const PARTS = ['body', 'head', 'arm_R', 'forearm_R', 'arm_L', 'forearm_L', 'leg_R', 'shin_R', 'leg_L',
  'shin_L'] as const;
export type PartName = typeof PARTS[number];
/** Each part's parent part, -1 for the root (the feet). Parents come before their children. */
const PARENT: readonly number[] = [-1, 0, 0, 2, 0, 4, -1, 6, -1, 8];
const ARM_PARTS = new Set<number>([2, 3, 4, 5]);

const REGION_SHEET: Readonly<Record<RegionId, string>> = {
  northeast: 'isan', north: 'north', central: 'central', east: 'east', west: 'west', south: 'south',
};

export interface PeopleEntry {
  readonly id: string;
  readonly sheet: string;
  readonly kind: string;
  readonly swingArms: boolean;
  readonly walker: boolean;
  readonly file: string | null;
}

export interface PeopleIndex {
  readonly clips: string;
  readonly people: readonly PeopleEntry[];
}

/** The sheets a city of this era and region draws its people from. */
export function sheetsFor(era: number, region: RegionId): string[] {
  return ['shared', 'era' + Math.max(1, Math.min(5, Math.round(era))), REGION_SHEET[region] ?? 'central'];
}

/** One character ready to draw: a geometry id per part, and the part's place and rest turn under its parent. */
export interface PersonRig {
  readonly id: string;
  readonly kind: string;
  readonly sheet: string;
  readonly swingArms: boolean;
  readonly geometry: number[];
  readonly restPosition: Vector3[];
  readonly restQuaternion: Quaternion[];
}

/** A clip sampled at 24 frames a second: per frame, a quaternion per part and the root's lift. */
export interface BakedClip {
  readonly frames: number;
  readonly seconds: number;
  readonly quaternions: Float32Array;
  readonly lift: Float32Array;
}

const FPS = 24;

/** A track's value at time t: linear between keys (spherical for quaternions), held past the ends. */
function sample(track: KeyframeTrack, t: number, out: number[]): number[] {
  const { times, values } = track;
  const size = values.length / times.length;
  let i = 0;
  while (i < times.length - 1 && times[i + 1] <= t) i++;
  const j = Math.min(times.length - 1, i + 1);
  const span = times[j] - times[i];
  const k = span > 0 ? Math.min(1, Math.max(0, (t - times[i]) / span)) : 0;
  if (size === 4) {
    Quaternion.slerpFlat(out, 0, values as unknown as number[], i * 4, values as unknown as number[], j * 4, k);
  } else {
    for (let c = 0; c < size; c++) out[c] = values[i * size + c] + (values[j * size + c] - values[i * size + c]) * k;
  }
  return out;
}

/** Samples a glTF clip of the clips rig (tracks "<part>.quaternion", "<root>.position"). */
export function bakeClip(clip: AnimationClip): BakedClip {
  const frames = Math.max(1, Math.round(clip.duration * FPS)) + 1;
  const quaternions = new Float32Array(frames * PARTS.length * 4);
  const lift = new Float32Array(frames);
  const value = [0, 0, 0, 1];
  for (let p = 0; p < PARTS.length; p++) {
    const track = clip.tracks.find(t => t.name === PARTS[p] + '.quaternion');
    for (let f = 0; f < frames; f++) {
      const o = (f * PARTS.length + p) * 4;
      if (!track) {
        quaternions[o + 3] = 1;
        continue;
      }
      const v = sample(track, Math.min(clip.duration, f / FPS), value);
      quaternions.set([v[0], v[1], v[2], v[3]], o);
    }
  }
  const root = clip.tracks.find(t => t.name.endsWith('.position') && !PARTS.some(p => t.name === p + '.position'));
  for (let f = 0; f < frames; f++) lift[f] = root ? sample(root, Math.min(clip.duration, f / FPS), value)[1] : 0;
  return { frames, seconds: clip.duration, quaternions, lift };
}

/** The part a mesh belongs to: itself or its nearest ancestor named after a part. */
function partOf(object: Object3D): number {
  let o: Object3D | null = object;
  while (o) {
    const i = (PARTS as readonly string[]).indexOf(o.name);
    if (i >= 0) return i;
    o = o.parent;
  }
  return -1;
}

function findPart(scene: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  scene.traverse(o => { if (!found && o.name === name) found = o; });
  return found;
}

/** One merged geometry per part (position, normal, colour from each material) and the parts' rest transforms. */
export function extractParts(scene: Object3D): { geometries: BufferGeometry[]; positions: Vector3[]; quaternions: Quaternion[] } {
  scene.updateMatrixWorld(true);
  const pieces: BufferGeometry[][] = PARTS.map(() => []);
  const inverse = new Matrix4();
  const relative = new Matrix4();
  scene.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const p = partOf(mesh);
    if (p < 0) return;
    const part = findPart(scene, PARTS[p]);
    if (!part) return;
    inverse.copy(part.matrixWorld).invert();
    relative.multiplyMatrices(inverse, mesh.matrixWorld);
    const source = mesh.geometry;
    const g = new BufferGeometry();
    g.setAttribute('position', source.getAttribute('position').clone());
    if (source.getAttribute('normal')) g.setAttribute('normal', source.getAttribute('normal').clone());
    else g.computeVertexNormals();
    g.setIndex(source.index ? source.index.clone() : null);
    if (!g.index) {
      const n = g.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new BufferAttribute(idx, 1));
    }
    g.applyMatrix4(relative);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const c = (material as MeshStandardMaterial).color;
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c ? c.r : 1;
      colors[i * 3 + 1] = c ? c.g : 1;
      colors[i * 3 + 2] = c ? c.b : 1;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    pieces[p].push(g);
  });
  const geometries = pieces.map(list => {
    if (list.length === 0) {
      // A part with nothing in it (never for a built character): one degenerate triangle keeps the batch uniform.
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      g.setAttribute('color', new BufferAttribute(new Float32Array(9), 3));
      g.setIndex(new BufferAttribute(new Uint32Array([0, 1, 2]), 1));
      return g;
    }
    const merged = mergeGeometries(list, false) ?? list[0];
    list.forEach(g => { if (g !== merged) g.dispose(); });
    return merged;
  });
  const positions: Vector3[] = [];
  const quaternions: Quaternion[] = [];
  for (const name of PARTS) {
    const part = findPart(scene, name);
    positions.push(part ? part.position.clone() : new Vector3());
    quaternions.push(part ? part.quaternion.clone() : new Quaternion());
  }
  return { geometries, positions, quaternions };
}

export type Activity = 'walk' | 'jog' | 'stand' | 'kick';

const scratchRoot = new Matrix4();
const scratchLocal = new Matrix4();
const scratchQ = new Quaternion();
const scratchP = new Vector3();
const ONE = new Vector3(1, 1, 1);
const scratchS = new Vector3();
const UP = new Vector3(0, 1, 0);
const worlds: Matrix4[] = PARTS.map(() => new Matrix4());
const qa = [0, 0, 0, 1];

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Draws up to `capacity` people from the characters and clips it is given. */
export class PeopleDrawer {
  readonly mesh: BatchedMesh;
  private readonly material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  private readonly rigs: PersonRig[] = [];
  private readonly pools = new Map<string, PersonRig[]>();
  private readonly instances: number[] = [];
  private readonly shown: (PersonRig | null)[] = [];
  private visible = 0;
  private sheets = '';

  constructor(
    characters: ReadonlyArray<{ entry: PeopleEntry; scene: Object3D }>,
    private readonly clips: Readonly<Record<string, BakedClip>>,
    private readonly capacity: number,
  ) {
    const parts = characters.map(c => ({ entry: c.entry, ...extractParts(c.scene) }));
    let vertices = 0;
    let indices = 0;
    for (const c of parts) for (const g of c.geometries) {
      vertices += g.getAttribute('position').count;
      indices += g.index ? g.index.count : 0;
    }
    this.mesh = new BatchedMesh(capacity * PARTS.length, Math.max(3, vertices), Math.max(3, indices), this.material);
    this.mesh.name = 'people';
    this.mesh.frustumCulled = false;
    this.mesh.perObjectFrustumCulled = false;
    this.mesh.sortObjects = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    for (const c of parts) {
      const geometry = c.geometries.map(g => this.mesh.addGeometry(g));
      c.geometries.forEach(g => g.dispose());
      this.rigs.push({ id: c.entry.id, kind: c.entry.kind, sheet: c.entry.sheet, swingArms: c.entry.swingArms,
        geometry, restPosition: c.positions, restQuaternion: c.quaternions });
    }
    const first = this.rigs[0];
    for (let slot = 0; slot < capacity; slot++) {
      this.shown.push(null);
      for (let p = 0; p < PARTS.length; p++) {
        const id = this.mesh.addInstance(first ? first.geometry[p] : 0);
        this.mesh.setVisibleAt(id, false);
        this.instances.push(id);
      }
    }
  }

  get characters(): ReadonlyArray<PersonRig> { return this.rigs; }

  /** Keep only these sheets in the crowd (the city's era and region, sheetsFor). */
  useSheets(sheets: readonly string[]): void {
    const key = sheets.join(',');
    if (key === this.sheets) return;
    this.sheets = key;
    const all = this.rigs.filter(r => sheets.includes(r.sheet));
    const list = all.length ? all : this.rigs;
    const free = list.filter(r => r.swingArms);
    const sporty = free.filter(r => r.kind === 'man' || r.kind === 'boy');
    this.pools.set('walk', list);
    this.pools.set('stand', list);
    this.pools.set('jog', free.length ? free : list);
    this.pools.set('kick', sporty.length ? sporty : (free.length ? free : list));
  }

  /** The character a person `who` is in an activity (the same person stays the same character). */
  pick(activity: Activity, who: number): PersonRig | null {
    const pool = this.pools.get(activity) ?? this.rigs;
    if (pool.length === 0) return null;
    if (activity === 'jog') {
      const jogger = pool.find(r => r.id.endsWith('_jogger'));
      if (jogger && hash(who) % 3 !== 0) return jogger;
    }
    return pool[hash(who) % pool.length];
  }

  /**
   * Places person `slot` at (x, y, z) facing `heading` (radians about Y, 0 = +Z), `scale` times life size.
   * `phase` runs 2π a step cycle for walk and jog and slowly for stand; a kick plays the top of the takraw kick.
   * `role` chooses who the person is (default: the activity), so a takraw player who stands between kicks stays
   * the same character.
   */
  place(slot: number, x: number, y: number, z: number, heading: number, scale: number, who: number,
    activity: Activity, phase: number, kicking = false, role: Activity = activity): void {
    if (slot >= this.capacity) return;
    const rig = this.pick(role, who);
    if (!rig) return;
    const clipName = activity === 'jog' ? 'run'
      : activity === 'walk' ? (rig.swingArms ? 'walk' : 'walk_carry')
        : activity === 'kick' ? 'takraw' : 'idle';
    const clip = this.clips[clipName] ?? this.clips.idle;
    let frame = 0;
    if (clip) {
      let t: number;
      if (activity === 'kick') t = kicking ? 8 / FPS : 0;
      else {
        const cycles = activity === 'stand' ? phase * 0.08 : phase / (Math.PI * 2);
        t = (cycles - Math.floor(cycles)) * clip.seconds;
      }
      frame = t * FPS;
    }
    const f0 = clip ? Math.min(clip.frames - 1, Math.floor(frame)) : 0;
    const f1 = clip ? Math.min(clip.frames - 1, f0 + 1) : 0;
    const k = frame - Math.floor(frame);
    const lift = clip ? clip.lift[f0] + (clip.lift[f1] - clip.lift[f0]) * k : 0;
    scratchQ.setFromAxisAngle(UP, heading);
    scratchP.set(x, y + lift * scale, z);
    scratchRoot.compose(scratchP, scratchQ, scratchS.set(scale, scale, scale));
    for (let p = 0; p < PARTS.length; p++) {
      const keepPose = !clip || (!rig.swingArms && ARM_PARTS.has(p));
      if (keepPose) scratchQ.copy(rig.restQuaternion[p]);
      else {
        const o0 = (f0 * PARTS.length + p) * 4;
        const o1 = (f1 * PARTS.length + p) * 4;
        Quaternion.slerpFlat(qa, 0, clip.quaternions as unknown as number[], o0, clip.quaternions as unknown as number[], o1, k);
        scratchQ.set(qa[0], qa[1], qa[2], qa[3]);
      }
      scratchLocal.compose(rig.restPosition[p], scratchQ, ONE);
      const parent = PARENT[p];
      worlds[p].multiplyMatrices(parent < 0 ? scratchRoot : worlds[parent], scratchLocal);
      const id = this.instances[slot * PARTS.length + p];
      if (this.shown[slot] !== rig) this.mesh.setGeometryIdAt(id, rig.geometry[p]);
      this.mesh.setMatrixAt(id, worlds[p]);
    }
    if (this.shown[slot] !== rig || slot >= this.visible) {
      for (let p = 0; p < PARTS.length; p++) this.mesh.setVisibleAt(this.instances[slot * PARTS.length + p], true);
    }
    this.shown[slot] = rig;
  }

  /** Hides every person from `count` on (call once a frame after placing). */
  finish(count: number): void {
    const n = Math.min(count, this.capacity);
    for (let slot = n; slot < this.visible; slot++) {
      for (let p = 0; p < PARTS.length; p++) this.mesh.setVisibleAt(this.instances[slot * PARTS.length + p], false);
    }
    this.visible = n;
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}

/**
 * Loads the people of every sheet a city could need (its region's, the shared ones and all five eras, so a new era
 * needs no loading) and the clips. Resolves to null when anything is missing, and the boxes keep walking instead.
 */
export async function loadPeople(region: RegionId, capacity: number, base = PEOPLE_BASE): Promise<PeopleDrawer | null> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const response = await fetch(base + 'index.json');
  if (!response.ok) return null;
  const index = await response.json() as PeopleIndex;
  const wanted = new Set(['shared', 'era1', 'era2', 'era3', 'era4', 'era5', REGION_SHEET[region] ?? 'central']);
  const entries = index.people.filter(p => p.walker && p.file && wanted.has(p.sheet));
  const [clipsFile, ...scenes] = await Promise.all([
    loader.loadAsync(base + index.clips),
    ...entries.map(e => loader.loadAsync(base + e.file).then(g => g.scene, () => null)),
  ]);
  const characters = entries.map((entry, i) => ({ entry, scene: scenes[i] as Object3D | null }))
    .filter((c): c is { entry: PeopleEntry; scene: Object3D } => c.scene !== null);
  if (characters.length === 0) return null;
  const clips: Record<string, BakedClip> = {};
  for (const clip of clipsFile.animations) clips[clip.name] = bakeClip(clip);
  return new PeopleDrawer(characters, clips, capacity);
}
