/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era vehicles (owner, 22 Oct 2026: "รถที่มาวิ่ง ... ให้วิ่งตามยุค ตามสมัยได้ไหม"; art/vehicles/IMPORT.md): what drives
// the roads follows the city's era (gameMap.era, src/era.ts) and region as its people and buildings do. Ox and buffalo
// carts, bicycles and hand carts in the farming village; samlors, songthaews, the red bus and the first motorcycles in
// the market town; tuk-tuks, pickups and motorcycle taxis in the factory town; cars, vans, the delivery scooter and the
// low-floor bus in the modern city; electric cars, bubble cars, the driverless shuttle and flying taxis in the future.
// While a city nears its next era (its buildings turning, src/eraScore.ts) the next era's vehicles come in a few at a
// time, by the share of the buildings already in it.
//
// The models are the Blender ones of art/vehicles, exported as assets/models/vehicles/era<n>/<kind>.glb (Draco, flat
// colours in vertex colours, metres, the front at +Z): a `body`, a `paint` (white, tinted per car), `lights` (lit at
// night) and one mesh per set of wheels, which turn. VehiclePool draws any number of them instanced, a lighter copy
// (lod.ts) where the change is under a pixel. It only reads the city.

import {
  BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, type Material, Matrix4, type Mesh, Mesh as ThreeMesh,
  type Object3D, Quaternion, Vector3,
} from 'three';
import { eraBuildingMaterial } from '../materials/library.js';
import type { RegionId } from '../regional/types.js';
import { DRACO_DECODER_PATH } from './eraBuildings.js';
import { loadSimplifier, lodDistance, makeLevels, type LodSource, type Simplifier } from './lod.js';

export const VEHICLES_BASE = 'assets/models/vehicles/';

export type VehicleClass = 'small' | 'cart' | 'car' | 'heavy' | 'flyer';

/** One vehicle of the index (art/vehicles/scripts/export_game.py) */
export interface VehicleEntry {
  readonly era: number;
  readonly kind: string;
  readonly th: string;
  readonly en: string;
  readonly class: VehicleClass;
  /** Metres */
  readonly length: number;
  readonly width: number;
  readonly height: number;
  /** The body's, paint's and lights' triangles (wheels apart) */
  readonly triangles: number;
  /** The colours a car of the kind is painted in (sRGB hex); empty for a fixed livery */
  readonly paints: readonly string[];
  /** How fast it goes against a car (an ox cart 0.3) */
  readonly slow: number;
  /** The height it flies at (metres), 0 on the road */
  readonly fly: number;
  /** Each set of wheels: its mesh, radius (m), axis (x a wheel, z a rotor, Blender's axes) and where each one is
   * (glTF metres: x, y up, z front) */
  readonly wheels: ReadonlyArray<{ mesh: string; radius: number; axis: 'x' | 'z'; at: ReadonlyArray<readonly number[]>; triangles: number }>;
}

export interface VehicleIndex { readonly version: number; readonly vehicles: Readonly<Record<string, VehicleEntry>> }

/** Triangles a vehicle's body may have in the game, by class (export_game.py GAME_BUDGET), and its wheels in all */
export const VEHICLE_BUDGET: Readonly<Record<VehicleClass, number>> = { small: 2500, cart: 3200, car: 2000, heavy: 2600, flyer: 1600 };
export const WHEELS_BUDGET = 1200;

type Mix = Readonly<Record<string, number>>;

/**
 * What drives the roads in each era, as shares (they need not add up to 1): the era's own vehicles and those of the
 * eras before that are still about (a few ox carts in the market town, the old songthaew in the modern city). Read
 * from the concept sheets and Thai roads: carts only in the first two eras, motorcycles the most of all in the factory
 * town, the flying taxi and the cargo drone only in the future.
 */
export const ERA_MIX: Readonly<Record<number, Mix>> = {
  1: { 'era1/bicycle': 0.38, 'era1/buffalo_cart': 0.22, 'era1/ox_cart': 0.2, 'era1/hand_cart': 0.2 },
  2: {
    'era1/bicycle': 0.16, 'era2/motorcycle': 0.2, 'era2/samlor': 0.17, 'era2/songthaew': 0.15, 'era2/truck': 0.1,
    'era2/bus': 0.04, 'era1/ox_cart': 0.06, 'era1/buffalo_cart': 0.04, 'era1/hand_cart': 0.04,
  },
  3: {
    'era3/motorcycle_helmet': 0.17, 'era3/motorcycle_taxi': 0.1, 'era2/motorcycle': 0.06, 'era3/pickup': 0.15,
    'era3/pickup_cage': 0.1, 'era3/tuktuk': 0.08, 'era3/box_truck': 0.08, 'era2/songthaew': 0.1, 'era3/bus': 0.03,
    'era1/bicycle': 0.05, 'era2/samlor': 0.03,
  },
  4: {
    'era4/sedan': 0.18, 'era4/hatchback': 0.13, 'era4/pickup': 0.16, 'era4/scooter': 0.08, 'era3/motorcycle_helmet': 0.14,
    'era4/van': 0.07, 'era4/taxi': 0.06, 'era2/songthaew': 0.04, 'era3/box_truck': 0.05, 'era4/bus': 0.03,
    'era3/tuktuk': 0.03, 'era3/pickup_cage': 0.03,
  },
  5: {
    'era5/ev_car': 0.26, 'era5/ev_pod': 0.16, 'era5/ev_scooter': 0.14, 'era5/pod_bus': 0.06, 'era5/flying_taxi': 0.1,
    'era5/cargo_drone': 0.06, 'era4/hatchback': 0.06, 'era4/van': 0.05, 'era4/pickup': 0.06, 'era4/scooter': 0.03,
  },
};

/**
 * Each region's own, over the era's (a share set here replaces the era's): the north's red songthaew (รถแดง) everywhere
 * a songthaew runs, Isan's อีแต๋น farm wagon and more buffalo, the south's wooden รถโพถ้อง bus, Bangkok's tuk-tuks and
 * taxis in the centre, the eastern seaboard's songthaews and trucks.
 */
export const REGION_MIX: Readonly<Record<RegionId, Readonly<Record<number, Mix>>>> = {
  north: { 1: { 'era1/ox_cart': 0.26, 'era1/buffalo_cart': 0.16 }, 2: { 'era2/songthaew': 0.22 }, 3: { 'era2/songthaew': 0.16 },
    4: { 'era2/songthaew': 0.1 } },
  northeast: { 1: { 'era1/buffalo_cart': 0.3, 'era1/ox_cart': 0.14 }, 2: { 'era2/etan': 0.1, 'era2/samlor': 0.14 },
    3: { 'era2/etan': 0.06 } },
  central: { 3: { 'era3/tuktuk': 0.14 }, 4: { 'era4/taxi': 0.1, 'era3/tuktuk': 0.06 } },
  east: { 3: { 'era3/box_truck': 0.11, 'era2/songthaew': 0.12 }, 4: { 'era2/songthaew': 0.06 } },
  west: { 1: { 'era1/hand_cart': 0.24 } },
  south: { 2: { 'era2/pothong': 0.08 }, 3: { 'era2/pothong': 0.04 } },
};

/** Which of a songthaew's paints (art/vehicles era2.py SONGTHAEW_PAINTS: red, blue, green, white, yellow) each region's
 * run in: Chiang Mai's red, Pattaya's blue, Khon Kaen's many colours */
export const SONGTHAEW_REGION_PAINTS: Readonly<Record<RegionId, readonly number[]>> = {
  north: [0], east: [1], northeast: [1, 2, 3, 4], central: [1, 3], west: [3, 2], south: [4, 1],
};

const clampEra = (era: number): number => Math.max(1, Math.min(5, Math.round(era) || 1));

/** The vehicles of an era and region with their shares (adding up to 1), largest first */
export function vehicleMix(era: number, region: RegionId): Array<{ id: string; share: number }> {
  const e = clampEra(era), mix: Record<string, number> = { ...ERA_MIX[e], ...(REGION_MIX[region]?.[e] ?? {}) };
  const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(mix).filter(([, s]) => s > 0).map(([id, s]) => ({ id, share: s / total }))
    .sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1));
}

/** The vehicle of public transport (src/transit.ts: the bus put on a road): the era's bus, the red songthaew in the
 * north until the modern city has its low-floor buses, the driverless shuttle in the future. Buses come in era 2
 * (src/unlocks.ts), so a city of the first era that has one (a sandbox) runs the market town's. */
export function transitVehicle(era: number, region: RegionId): string {
  const e = clampEra(era);
  if (region === 'north' && (e === 2 || e === 3)) return 'era2/songthaew';
  return e <= 2 ? 'era2/bus' : e === 3 ? 'era3/bus' : e === 4 ? 'era4/bus' : 'era5/pod_bus';
}

/** The share of a city's buildings already in its next era (map.buildingEras, src/eraScore.ts), 0 in the last era */
export function nextEraShare(era: number, buildingEras: ArrayLike<number> | null | undefined): number {
  const e = clampEra(era);
  if (e >= 5 || !buildingEras) return 0;
  let all = 0, ahead = 0;
  for (let i = 0; i < buildingEras.length; i++) {
    const b = buildingEras[i];
    if (!b) continue;
    all++;
    if (b > e) ahead++;
  }
  return all ? ahead / all : 0;
}

/** The vehicle for a number u in [0, 1) from a mix (cumulative shares) */
export function pickFrom(mix: ReadonlyArray<{ id: string; share: number }>, u: number): string {
  let sum = 0;
  for (const { id, share } of mix) { sum += share; if (u < sum) return id; }
  return mix[mix.length - 1]?.id ?? '';
}

/** A car's vehicle: the next era's mix for a share `next` of the cars (u2 below it), else the era's */
export function pickVehicle(era: number, region: RegionId, next: number, u: number, u2: number): string {
  const e = clampEra(era);
  return pickFrom(vehicleMix(e < 5 && u2 < next ? e + 1 : e, region), u);
}

/** The colour a car is painted in (sRGB hex), or null for a fixed livery: one of the kind's paints, a songthaew's by
 * its region */
export function paintFor(id: string, entry: Pick<VehicleEntry, 'paints'>, region: RegionId, u: number): string | null {
  const paints = entry.paints;
  if (!paints.length) return null;
  if (id.endsWith('/songthaew')) {
    const allowed = (SONGTHAEW_REGION_PAINTS[region] ?? [0]).filter(i => i < paints.length);
    if (allowed.length) return paints[allowed[Math.floor(u * allowed.length) % allowed.length]];
  }
  return paints[Math.floor(u * paints.length) % paints.length];
}

// --- models -----------------------------------------------------------------------------------------------------------

/** A vehicle's geometry: its parts at a level of detail, its wheels by set */
export interface VehicleLevel {
  readonly body: BufferGeometry | null;
  readonly paint: BufferGeometry | null;
  readonly lights: BufferGeometry | null;
  readonly wheels: ReadonlyArray<BufferGeometry | null>;
}

export interface VehicleModel {
  readonly id: string;
  readonly entry: VehicleEntry;
  /** Full detail first, then a lighter copy if the simplifier could make one, with the error (m) it was made within */
  readonly levels: ReadonlyArray<VehicleLevel & { error: number }>;
  /** Each wheel set's places (metres, glTF space) */
  readonly wheelAt: ReadonlyArray<readonly Vector3[]>;
}

/** The errors (metres) a vehicle's lighter copy is made within: about the size of a mirror */
export const VEHICLE_LOD_ERRORS: readonly number[] = [0.05, 0.14];

function geometryOf(source: LodSource | null): BufferGeometry | null {
  if (!source || !source.attributes.position) return null;
  const g = new BufferGeometry();
  for (const [name, { array, size }] of Object.entries(source.attributes)) g.setAttribute(name, new BufferAttribute(array, size));
  if (source.index) g.setIndex(new BufferAttribute(source.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** A glTF mesh's geometry as plain positions and colours (Draco may hand them quantized, colours as RGBA) */
function sourceOf(mesh: Mesh): LodSource {
  const g = mesh.geometry as BufferGeometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
  const position = new Float32Array(pos.count * 3), color = new Float32Array(pos.count * 3).fill(1);
  for (let i = 0; i < pos.count; i++) {
    position[i * 3] = pos.getX(i); position[i * 3 + 1] = pos.getY(i); position[i * 3 + 2] = pos.getZ(i);
    if (col) { color[i * 3] = col.getX(i); color[i * 3 + 1] = col.getY(i); color[i * 3 + 2] = col.getZ(i); }
  }
  return { attributes: { position: { array: position, size: 3 }, color: { array: color, size: 3 } },
    index: g.index ? new Uint32Array(g.index.array) : null };
}

/** A loaded glb's scene as a vehicle model; with a simplifier, its lighter copy too */
export function vehicleModel(id: string, entry: VehicleEntry, scene: Object3D, simplifier: Simplifier | null = null): VehicleModel {
  const byName = new Map<string, Mesh>();
  scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    // a mesh may come as a node named after it or as its child
    const name = /^(body|paint|lights|wheel\d+)/.exec(mesh.name)?.[1] ?? /^(body|paint|lights|wheel\d+)/.exec(mesh.parent?.name ?? '')?.[1];
    if (name && !byName.has(name)) byName.set(name, mesh);
  });
  const names = ['body', 'paint', 'lights', ...entry.wheels.map(w => w.mesh)];
  const sources = names.map(n => { const m = byName.get(n); return m ? sourceOf(m) : null; });
  const full = (parts: Array<LodSource | null>, error: number): VehicleLevel & { error: number } => ({
    body: geometryOf(parts[0]), paint: geometryOf(parts[1]), lights: geometryOf(parts[2]),
    wheels: parts.slice(3).map(geometryOf), error,
  });
  const levels = [full(sources, 0)];
  if (simplifier) {
    const present = sources.map((s, i) => ({ s, i })).filter(p => p.s) as Array<{ s: LodSource; i: number }>;
    const made = makeLevels(present.map(p => p.s), simplifier, VEHICLE_LOD_ERRORS);
    const last = made[made.length - 1];
    if (last) {
      const parts: Array<LodSource | null> = sources.map(() => null);
      present.forEach((p, k) => { parts[p.i] = last.parts[k]; });
      levels.push(full(parts, last.error));
    }
  }
  const wheelAt = entry.wheels.map(w => w.at.map(a => new Vector3(a[0], a[1], a[2])));
  return { id, entry, levels, wheelAt };
}

/** The index of every exported vehicle, or null when it is missing (the procedural cars stay) */
export async function loadVehicleIndex(base = VEHICLES_BASE): Promise<VehicleIndex | null> {
  try {
    const response = await fetch(base + 'index.json');
    if (!response.ok) return null;
    const index = await response.json() as VehicleIndex;
    return index && index.vehicles ? index : null;
  } catch {
    return null;
  }
}

type Loader = (url: string) => Promise<{ scene: Object3D }>;

/** The vehicle models, each loaded once when first asked for */
export class EraVehicles {
  private readonly models = new Map<string, VehicleModel>();
  private readonly asked = new Map<string, Promise<VehicleModel | null>>();
  private loader: Promise<Loader> | null = null;
  private disposed = false;
  /** Bumped whenever a model arrives, so a pool knows to look again */
  version = 0;

  constructor(readonly index: VehicleIndex, private readonly base = VEHICLES_BASE, private readonly load: Loader | null = null,
    private readonly simplifier: Promise<Simplifier | null> = loadSimplifier()) {}

  has(id: string): boolean { return id in this.index.vehicles; }
  entry(id: string): VehicleEntry | null { return this.index.vehicles[id] ?? null; }

  /** The model, or null until it has loaded (asking for it the first time) */
  model(id: string): VehicleModel | null {
    const ready = this.models.get(id);
    if (ready) return ready;
    if (!this.asked.has(id) && this.has(id)) this.asked.set(id, this.fetch(id));
    return null;
  }

  /** The model once it has loaded (null if it cannot) */
  whenLoaded(id: string): Promise<VehicleModel | null> {
    return this.model(id) ? Promise.resolve(this.model(id)) : this.asked.get(id) ?? Promise.resolve(null);
  }

  /** Puts in a model made elsewhere (tests) */
  put(model: VehicleModel): void { this.models.set(model.id, model); this.version++; }

  private getLoader(): Promise<Loader> {
    if (this.load) return Promise.resolve(this.load);
    return this.loader ??= (async () => {
      const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/loaders/DRACOLoader.js')]);
      const draco = new DRACOLoader();
      draco.setDecoderPath(DRACO_DECODER_PATH);
      const gltf = new GLTFLoader();
      gltf.setDRACOLoader(draco);
      return (url: string) => gltf.loadAsync(url);
    })();
  }

  private fetch(id: string): Promise<VehicleModel | null> {
    const entry = this.index.vehicles[id];
    return Promise.all([this.getLoader().then(load => load(`${this.base}${id}.glb`)), this.simplifier]).then(([result, simplifier]) => {
      if (this.disposed) return null;
      const model = vehicleModel(id, entry, result.scene, simplifier);
      this.models.set(id, model);
      this.version++;
      return model;
    }).catch(error => { console.warn(`PhaiCity: vehicle ${id} did not load`, error); return null; });
  }

  /** One vehicle as a plain object (a bus of the transit, a wandering car): its parts and wheels as meshes, the paint
   * tinted; null until loaded. The wheels are the group's children named wheel<set>.<n>, at their places. */
  object(id: string, paint: string | null): Group | null {
    const model = this.model(id);
    if (!model) return null;
    const level = model.levels[0], group = new Group(), body = eraBuildingMaterial(false);
    group.name = `vehicle.${id}`;
    if (level.body) group.add(new ThreeMesh(level.body, body));
    if (level.lights) group.add(new ThreeMesh(level.lights, eraBuildingMaterial(true)));
    if (level.paint) {
      // One instance, so the shared material takes its colour from the instance (as the pool's)
      const painted = new InstancedMesh(level.paint, body, 1);
      painted.setMatrixAt(0, new Matrix4());
      painted.setColorAt(0, new Color(paint ?? '#ffffff'));
      group.add(painted);
    }
    level.wheels.forEach((g, set) => {
      if (!g) return;
      model.wheelAt[set].forEach((at, n) => {
        const wheel = new ThreeMesh(g, body);
        wheel.name = `wheel${set}.${n}`;
        wheel.position.copy(at);
        group.add(wheel);
      });
    });
    group.traverse(node => { const m = node as Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
    return group;
  }

  dispose(): void { this.disposed = true; }
}

// --- drawing many ----------------------------------------------------------------------------------------------------

interface LevelDraw {
  readonly parts: Array<{ mesh: InstancedMesh; paint: boolean }>;
  readonly wheels: Array<{ mesh: InstancedMesh; at: readonly Vector3[]; axis: 'x' | 'z' }>;
  count: number;
}
interface ModelDraw { model: VehicleModel; cap: number; levels: LevelDraw[] }

const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0);

/**
 * Many vehicles drawn together: for each model and level one InstancedMesh a part and one a set of wheels, so the
 * whole traffic is a few dozen draw calls. Each frame: begin(), add() each vehicle, end().
 */
export class VehiclePool {
  readonly root = new Group();
  private readonly draws = new Map<string, ModelDraw>();
  private readonly wheel = new Matrix4();
  private readonly spinTurn = new Quaternion();
  private readonly one = new Vector3(1, 1, 1);
  private readonly colour = new Color();
  /** Vehicles and triangles drawn in the last frame */
  drawn = 0;
  triangles = 0;

  constructor(private readonly materials: { body: Material; lights: Material } = { body: eraBuildingMaterial(false), lights: eraBuildingMaterial(true) }) {
    this.root.name = 'eraVehicles';
  }

  /** Room for `cap` of a model at once (made the first time; a model asked for with more room is made again) */
  ensure(model: VehicleModel, cap: number): void {
    const had = this.draws.get(model.id);
    if (had && had.cap >= cap) return;
    if (had) this.drop(had);
    const levels = model.levels.map((level): LevelDraw => {
      const parts: LevelDraw['parts'] = [];
      const make = (g: BufferGeometry, material: Material, n: number): InstancedMesh => {
        const mesh = new InstancedMesh(g, material, n);
        mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
        this.root.add(mesh);
        return mesh;
      };
      if (level.body) parts.push({ mesh: make(level.body, this.materials.body, cap), paint: false });
      if (level.paint) {
        const mesh = make(level.paint, this.materials.body, cap);
        mesh.setColorAt(0, this.colour.set(1, 1, 1));
        parts.push({ mesh, paint: true });
      }
      if (level.lights) parts.push({ mesh: make(level.lights, this.materials.lights, cap), paint: false });
      const wheels: LevelDraw['wheels'] = [];
      level.wheels.forEach((g, set) => {
        const at = model.wheelAt[set];
        if (g && at?.length) wheels.push({ mesh: make(g, this.materials.body, cap * at.length), at, axis: model.entry.wheels[set].axis });
      });
      return { parts, wheels, count: 0 };
    });
    this.draws.set(model.id, { model, cap, levels });
  }

  begin(): void {
    for (const d of this.draws.values()) for (const l of d.levels) l.count = 0;
    this.drawn = 0; this.triangles = 0;
  }

  /**
   * One vehicle: its pose (`matrix`, scaled to world units), its paint (sRGB hex) or null, its wheels' turn (radians;
   * a rotor's spin), and its distance from the camera with the screen's pixels a world unit away (lod.ts) and the
   * world units a metre, which choose its level. Whether there was room.
   */
  add(id: string, matrix: Matrix4, paint: string | null, spin: number, distance: number, pixelsPerUnit: number, unitsPerMetre: number): boolean {
    const d = this.draws.get(id);
    if (!d) return false;
    let k = 0;
    if (pixelsPerUnit > 0) for (let i = 1; i < d.model.levels.length; i++) {
      if (distance >= lodDistance(d.model.levels[i].error * unitsPerMetre, pixelsPerUnit)) k = i;
    }
    const level = d.levels[k];
    if (level.count >= d.cap) return false;
    const n = level.count++;
    for (const { mesh, paint: painted } of level.parts) {
      mesh.setMatrixAt(n, matrix);
      if (painted) mesh.setColorAt(n, paint ? this.colour.set(paint) : this.colour.set(1, 1, 1));
      this.triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
    }
    for (const { mesh, at, axis } of level.wheels) {
      this.spinTurn.setFromAxisAngle(axis === 'z' ? Y : X, spin);
      for (let w = 0; w < at.length; w++) {
        this.wheel.compose(at[w], this.spinTurn, this.one).premultiply(matrix);
        mesh.setMatrixAt(n * at.length + w, this.wheel);
      }
      this.triangles += at.length * (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
    }
    this.drawn++;
    return true;
  }

  end(): void {
    for (const d of this.draws.values()) for (const l of d.levels) {
      for (const { mesh } of l.parts) {
        mesh.count = l.count; mesh.visible = l.count > 0; mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      for (const { mesh, at } of l.wheels) { mesh.count = l.count * at.length; mesh.visible = l.count > 0; mesh.instanceMatrix.needsUpdate = true; }
    }
  }

  hide(): void { this.begin(); this.end(); }

  private drop(d: ModelDraw): void {
    for (const l of d.levels) for (const { mesh } of [...l.parts, ...l.wheels]) { this.root.remove(mesh); mesh.dispose(); }
    this.draws.delete(d.model.id);
  }

  dispose(): void { for (const d of [...this.draws.values()]) this.drop(d); this.root.clear(); }
}
