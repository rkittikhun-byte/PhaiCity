/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The cars of the city's real trips (docs/NO_GRID_PLAN.md 1.5): each drives one of the month's routes on the road graph
// (src/sim/trips.ts), from a home's road to its work or the shops in the morning and back in the evening, turning at the
// junctions where its route turns, as fast as its roads are that month, so on a jammed road the cars bunch up and creep.
// A route has as many cars at once as its cars an hour times the time it takes (a road with no trips has none), fewer
// at night, up to MAX_TRIP_CARS round the camera. One InstancedMesh for each part of each kind of car. It only reads the
// city (map.trips, map.roadGraph); the old wandering cars (pedestrians.ts CityRoadTraffic) drive where there are no trips.
// Once the era vehicles have loaded (eraVehicles.ts, art/vehicles) each car is one of the city's era and region, by
// their shares, a few of the next era's while the city's buildings turn to it, its wheels turning and its animals'
// legs walking as it goes; until then, and without them, the procedural cars of the region drive.
//
// The cars drive as traffic does (owner, 23 Oct 2026: "รถไม่ควรจะซ้อนกันคันกัน"; laneTraffic.ts): each keeps its gap
// behind the one ahead in its lane, slows to its speed, passes it in a free lane where the road has two a way, and
// waits its turn at a junction; a slow ox cart holds the cars behind it on a one-lane road. A car always faces the way
// it drives, and stands still, wheels and legs too, while it waits.

import { Group, InstancedMesh, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from 'three';
import { registry } from '../models/registry.js';
import { type EraVehicles, paintFor, pickFrom, type VehicleModel, VehiclePool, vehicleMix } from './eraVehicles.js';
import type { CityHeightField } from './heightfield.js';
import { type LaneCar, type LanePath, type LanePiece, LaneTraffic } from './laneTraffic.js';
import type { RegionId } from '../regional/types.js';
import { halfWidth } from '../../roadGeometry.js';
import { roadSpec } from '../../roadLevels.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import type { CityTrips } from '../../sim/cityTrips.js';
import type { TripRoute } from '../../sim/trips.js';

/** The most cars drawn at once round the camera (docs/NO_GRID_PLAN.md 8.3) */
export const MAX_TRIP_CARS = 400;
/** Cars are drawn this far round the camera's target, and not when it is further than FAR away */
const VIEW_SPAN = 420;
const FAR = 900;
/** A procedural car's length (m) */
const CAR_M = 4.6;

/** Each region's cars, as the old traffic's (pedestrians.ts VEHICLE_POOL_IDS) */
const CAR_IDS: Readonly<Record<RegionId, readonly string[]>> = {
  northeast: ['veh.pickup', 'veh.motorbike', 'veh.sedan', 'veh.songthaew', 'veh.tuktuk', 'veh.pickup', 'veh.motorbike', 'veh.truck'],
  north: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.pickup', 'veh.motorbike', 'veh.truck'],
  central: ['veh.sedan', 'veh.pickup', 'veh.motorbike', 'veh.tuktuk', 'veh.sedan', 'veh.songthaew', 'veh.truck'],
  east: ['veh.pickup', 'veh.sedan', 'veh.motorbike', 'veh.truck', 'veh.songthaew', 'veh.sedan'],
  west: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.truck'],
  south: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.tuktuk', 'veh.truck'],
};

/** How busy the roads are at an hour of the day, against the busiest hour (1 at 7:30 and 17:30, a tenth at night) */
export function hourShare(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const peak = (at: number, width: number): number => { const d = (h - at) / width; return 1 / (1 + d * d); };
  return Math.min(1, 0.08 + 0.92 * Math.max(peak(7.5, 1.4), peak(17.5, 1.6), 0.45 * peak(12.5, 3)));
}

/** The share of a route's cars going out (home to work or the shops) at an hour: most in the morning, few in the evening */
export function outShare(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return h >= 5 && h < 11 ? 0.85 : h >= 15 && h < 21 ? 0.15 : 0.5;
}

/** A number in [0, 1) for a car, the same every frame */
function hash01(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A route as a car drives it: its way on the lanes, how long the trip takes, and its bounds (world units) */
interface Path extends LanePath {
  route: TripRoute;
  index: number;
  seconds: number;
  box: [number, number, number, number];
}

/**
 * A way through road segments (graph ids, in order) from a point on the first (t) to a point on the last, as cars drive
 * it on the lanes (laneTraffic.ts): its line in world units, and each piece's lanes, speed and junctions. `secondsOf(n,
 * share)` is how long the trip takes over the share of its nth segment it drives (0: a town's pace, 14 m/s). Null when a
 * segment is gone. Also its seconds in all and its bounds.
 */
export function lanePathOf(graph: RoadGraph, segments: readonly number[], fromT: number, toT: number, units: number,
  secondsOf: (n: number, share: number) => number = () => 0): { path: LanePath; seconds: number; box: [number, number, number, number] } | null {
  const u = units, xs: number[] = [], zs: number[] = [], ts: number[] = [], pieces: LanePiece[] = [];
  // a junction is a node where three roads or more meet: where two meet a road just goes on
  const junction = (node: number): number => (graph.degree(node) >= 3 ? node : -1);
  let clock = 0, walked = 0;
  for (let n = 0; n < segments.length; n++) {
    const id = segments[n], s = graph.segments.get(id);
    if (!s) return null;
    // Which way along it, and how far: from the way's start (or the node it comes in by) to its end (or the node it
    // goes on by)
    const nextS = n + 1 < segments.length ? graph.segments.get(segments[n + 1]) : undefined;
    const prevS = n > 0 ? graph.segments.get(segments[n - 1]) : undefined;
    const shares = (o: typeof s | undefined, node: number): boolean => Boolean(o && (o.a === node || o.b === node));
    let t0: number, t1: number;
    if (segments.length === 1) { t0 = fromT; t1 = toT; }
    else if (n === 0) { t0 = fromT; t1 = shares(nextS, s.b) ? 1 : 0; }
    else if (n === segments.length - 1) { t0 = shares(prevS, s.a) ? 0 : 1; t1 = toT; }
    else { t0 = shares(prevS, s.a) ? 0 : 1; t1 = 1 - t0; }
    if (Math.abs(t1 - t0) < 1e-6) continue;
    const pieceSeconds = secondsOf(n, Math.abs(t1 - t0));
    const level = s.level, spec = roadSpec(level), length = graph.length(id) * u;
    const steps = s.shape === 'line' ? 1 : Math.max(2, Math.ceil(graph.length(id) * Math.abs(t1 - t0) / 4));
    const start = walked, first = Math.max(0, xs.length - 1);
    for (let j = 0; j <= steps; j++) {
      if (j === 0 && xs.length) continue;
      const t = t0 + (t1 - t0) * j / steps, [mx, mz] = graph.pointAt(id, t);
      if (xs.length) walked += Math.hypot(mx * u - xs[xs.length - 1], mz * u - zs[zs.length - 1]);
      xs.push(mx * u); zs.push(mz * u); ts.push(t);
    }
    const up = t1 > t0, run = walked - start;
    // as fast as the month's trips go on it, within a walking pace and a highway's
    const speed = Math.max(0.6 * u, Math.min(33 * u, pieceSeconds > 0 ? run / pieceSeconds : 14 * u));
    pieces.push({ segment: id, up, start, end: walked, entry: (up ? t0 : 1 - t0) * length, length,
      lanes: Math.max(1, Math.floor(spec.lanes / 2)), laneWidth: halfWidth(level, u), speed,
      nodeEnd: t1 === 1 ? junction(s.b) : t1 === 0 ? junction(s.a) : -1,
      nodeStart: t0 === 0 ? junction(s.a) : t0 === 1 ? junction(s.b) : -1, t0, t1, first });
    clock += pieceSeconds;
  }
  if (xs.length < 2 || walked <= 0 || !pieces.length) return null;
  const dist = new Float32Array(xs.length);
  for (let j = 1; j < xs.length; j++) dist[j] = dist[j - 1] + Math.hypot(xs[j] - xs[j - 1], zs[j] - zs[j - 1]);
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
  for (let j = 0; j < xs.length; j++) { bx0 = Math.min(bx0, xs[j]); bx1 = Math.max(bx1, xs[j]); bz0 = Math.min(bz0, zs[j]); bz1 = Math.max(bz1, zs[j]); }
  return { path: { xs: Float32Array.from(xs), zs: Float32Array.from(zs), ts: Float32Array.from(ts), dist, total: dist[dist.length - 1], pieces },
    seconds: clock > 0 ? clock : walked / (14 * u), box: [bx0, bz0, bx1, bz1] };
}

/** A route's cars on the road now, how many cars it has made, and when it may send the next */
interface RouteCars { cars: LaneCar[]; made: number; next: number }

/** A kind of car as instanced meshes: each part, its place in the car, and how many are drawn */
interface Kind { parts: Array<{ mesh: InstancedMesh; local: Matrix4 }>; count: number }

export interface TripCarsMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadGraph?: RoadGraph | null;
  readonly trips?: CityTrips | null;
}

export class TripCars {
  readonly root = new Group();
  private kinds: Kind[] = [];
  private paths: Path[] = [];
  private builtFor: CityTrips | null = null;
  private builtVersion = -1;
  private readonly matrix = new Matrix4();
  private readonly part = new Matrix4();
  private readonly position = new Vector3();
  private readonly turn = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly pose = { x: 0, z: 0, dx: 0, dz: 1 };
  /** Cars drawn in the last frame */
  drawn = 0;
  /** The era vehicles (eraVehicles.ts), the city's era and the share of its buildings in the next one, the camera and
   * the screen's pixels a world unit away (for the lighter copies far off); set by the city view */
  vehicles: EraVehicles | null = null;
  era: () => number = () => 1;
  nextShare: () => number = () => 0;
  camera: Object3D | null = null;
  pixelsPerUnit = 0;
  private pool: VehiclePool | null = null;
  private mixKey = '';
  private mixes: Array<Array<{ id: string; share: number; model: VehicleModel }>> = [];
  private readonly eye = new Vector3();
  /** The traffic: every car on the road round the camera, by its route; each car's model (by its tag) */
  readonly traffic: LaneTraffic;
  private readonly routes = new Map<number, RouteCars>();
  /** Cars of a month gone, finishing their trips (the month's trips are worked out again each month); and until when
   * the new month's routes send their cars from their starts only, not spread along them, so none appears mid-road */
  private orphans: LaneCar[] = [];
  private quietUntil = -Infinity;
  private readonly models = new Map<number, VehicleModel | number>();
  private lastSeconds: number | null = null;
  private eraModeWas = false;

  constructor(private readonly map: TripCarsMap, private readonly terrain: CityHeightField, private readonly region: RegionId,
    private readonly size: number, private readonly units: number) {
    this.root.name = 'tripCars';
    this.traffic = new LaneTraffic(units);
  }

  /** Whether there are trips to drive: where there are none the old wandering cars drive instead */
  get active(): boolean {
    return Boolean(this.map.trips?.result.routes.length) && Boolean(this.map.roadGraph);
  }

  /**
   * Moves the traffic on to this moment and draws it: `seconds` the view's clock (cars move in real time; a paused
   * clock stands them still), `hour` the time of day (0-24), the camera's target and distance
   */
  update(target: Vector3, distance: number, seconds: number, hour: number): void {
    const trips = this.map.trips, graph = this.map.roadGraph;
    if (!trips || !graph || distance > FAR) { this.hide(); this.clearTraffic(); this.lastSeconds = null; return; }
    if (graph.version !== this.builtVersion) { this.build(trips, graph); this.clearTraffic(); }
    else if (trips !== this.builtFor) {
      // a new month's trips on the same roads: the cars on the road drive on to the ends of their trips
      this.build(trips, graph);
      for (const rc of this.routes.values()) this.orphans.push(...rc.cars);
      this.routes.clear();
      this.quietUntil = seconds + 40;
    }
    const eraMode = this.prepareEra();
    if (eraMode !== this.eraModeWas) { this.eraModeWas = eraMode; this.models.clear(); }
    if (eraMode) { this.hideKinds(); this.pool!.begin(); if (this.camera) this.eye.setFromMatrixPosition(this.camera.matrixWorld); }
    else { this.pool?.hide(); this.ensureKinds(); }
    for (const kind of this.kinds) kind.count = 0;
    const dt = this.lastSeconds === null ? 0 : Math.max(0, Math.min(0.25, seconds - this.lastSeconds));
    this.lastSeconds = seconds;

    const busy = hourShare(hour), out = outShare(hour), span = Math.min(VIEW_SPAN, Math.max(160, distance * 1.1));
    const x0 = target.x - span, x1 = target.x + span, z0 = target.z - span, z1 = target.z + span;
    // The routes in sight, and how many cars each has on it now
    const near: Array<{ path: Path; cars: number }> = [];
    let wanted = 0;
    for (const path of this.paths) {
      const [bx0, bz0, bx1, bz1] = path.box;
      if (bx1 < x0 || bx0 > x1 || bz1 < z0 || bz0 > z1) continue;
      const cars = path.route.cars * path.seconds / 3600 * busy;
      if (cars <= 0) continue;
      near.push({ path, cars });
      wanted += cars;
    }
    const keep = wanted > MAX_TRIP_CARS ? MAX_TRIP_CARS / wanted : 1;
    // Routes gone from sight take their cars with them
    const shown = new Set(near.map(n => n.path.index));
    for (const [index, rc] of this.routes) if (!shown.has(index)) { this.orphans.push(...rc.cars); this.routes.delete(index); }
    // Each route in sight sends its cars: spread along it when it first comes into sight, then one at its start each
    // time the last has gone far enough, while it has fewer than it should
    for (const { path, cars } of near) {
      const share = cars * keep, n = Math.floor(share) + (hash01(path.index, Math.floor(seconds / 20), 3) < share - Math.floor(share) ? 1 : 0);
      let rc = this.routes.get(path.index);
      if (!rc) {
        rc = { cars: [], made: 0, next: seconds };
        this.routes.set(path.index, rc);
        if (seconds < this.quietUntil) continue;
        for (let i = 0; i < n && this.traffic.cars.length < MAX_TRIP_CARS; i++) {
          const s = (i + hash01(path.index, i, 2) * 0.6) / Math.max(1, n) * path.total;
          this.spawn(path, rc, s, out);
        }
        continue;
      }
      if (rc.cars.length < n && seconds >= rc.next && this.traffic.cars.length < MAX_TRIP_CARS) {
        if (this.spawn(path, rc, 0, out)) rc.next = seconds + Math.max(1, path.seconds / Math.max(1, n) * 0.5);
        else rc.next = seconds + 0.5;
      }
    }
    // Drive
    this.traffic.step(dt);
    this.orphans = this.orphans.filter(car => { if (!car.done) return true; this.dropCar(car); return false; });
    for (const rc of this.routes.values()) {
      for (let i = rc.cars.length - 1; i >= 0; i--) if (rc.cars[i].done) { this.dropCar(rc.cars[i]); rc.cars.splice(i, 1); }
    }
    // Draw those in sight
    let drawn = 0;
    for (const car of this.traffic.cars) {
      // (the buses are cars of the traffic too, drawn by buses.ts)
      if (car.tag < 0) continue;
      const at = this.traffic.pose(car, this.pose);
      if (at.x < x0 || at.x > x1 || at.z < z0 || at.z > z1) continue;
      if (this.draw(car, eraMode, seconds)) drawn++;
    }
    if (eraMode) this.pool!.end();
    else for (const kind of this.kinds) for (const { mesh } of kind.parts) {
      mesh.count = kind.count;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = kind.count > 0;
    }
    this.drawn = drawn;
  }

  /** Puts one of a route's cars on the road `s` along its way (from where it starts); whether there was room */
  private spawn(path: Path, rc: RouteCars, s: number, out: number): boolean {
    const serial = rc.made, rev = hash01(path.index, serial, 1) >= out;
    const tag = path.index * 4096 + (serial % 4096);
    const model = this.modelFor(tag);
    const metres = typeof model !== 'number' ? model.entry.length : CAR_M;
    const slow = typeof model !== 'number' ? model.entry.slow : 1;
    const lane = Math.floor(hash01(path.index, serial, 4) * 4);
    const car = this.traffic.add(path, rev, s, lane, metres * this.size, slow, tag);
    if (!car) return false;
    rc.made++;
    rc.cars.push(car);
    return true;
  }

  private dropCar(car: LaneCar): void { this.traffic.remove(car); this.models.delete(car.tag); }

  private clearTraffic(): void { this.traffic.clear(); this.routes.clear(); this.models.clear(); this.orphans = []; }

  /** A car's model: an era vehicle, or the index of a procedural kind; kept for the car's life */
  private modelFor(tag: number): VehicleModel | number {
    let model = this.models.get(tag);
    if (model === undefined) {
      const route = Math.floor(tag / 4096), serial = tag % 4096;
      model = this.eraModeWas ? (this.pickModel(route, serial) ?? 0) : Math.floor(hash01(route, serial, 5) * Math.max(1, this.kinds.length || 7));
      this.models.set(tag, model);
    }
    return model;
  }

  /** One car where the traffic has it; whether it was drawn */
  private draw(car: LaneCar, eraMode: boolean, seconds: number): boolean {
    const { x, z, dx, dz } = this.pose;
    const model = this.modelFor(car.tag);
    if (eraMode && typeof model !== 'number') {
      // An era vehicle: a flyer over its route, its wheels turned and its legs walked by how far it has come
      const entry = model.entry, fly = entry.fly * this.size;
      const y = this.terrain.sample(x, z) + (fly ? fly + Math.sin(seconds * 1.3 + car.id) * 0.4 * this.size : 0);
      this.position.set(x, y, z);
      this.turn.setFromAxisAngle(this.up, Math.atan2(dx, dz));
      this.scale.setScalar(this.size);
      this.matrix.compose(this.position, this.turn, this.scale);
      const paint = paintFor(model.id, entry, this.region, hash01(car.tag, 7, 7));
      const away = this.camera ? this.eye.distanceTo(this.position) : 0;
      return this.pool!.add(model.id, this.matrix, paint, car.odometer / this.size, seconds, away, this.pixelsPerUnit, this.size);
    }
    if (eraMode) return false;
    const kinds = this.kinds, kind = kinds[(typeof model === 'number' ? model : 0) % Math.max(1, kinds.length)];
    if (!kind || kind.count >= kind.parts[0]?.mesh.instanceMatrix.count) return false;
    this.position.set(x, this.terrain.sample(x, z), z);
    this.turn.setFromAxisAngle(this.up, Math.atan2(dx, dz));
    this.scale.setScalar(this.size);
    this.matrix.compose(this.position, this.turn, this.scale);
    for (const { mesh, local } of kind.parts) mesh.setMatrixAt(kind.count, this.part.multiplyMatrices(this.matrix, local));
    kind.count++;
    return true;
  }

  /** Whether the era vehicles draw this frame: every model of the era's mix has loaded (the next era's join as they
   * load); makes the pool's room for them when the era, the region's mix or the models change */
  private prepareEra(): boolean {
    const vehicles = this.vehicles;
    if (!vehicles) return false;
    const era = Math.max(1, Math.min(5, Math.round(this.era()) || 1)), next = era < 5 && this.nextShare() > 0;
    const key = `${era}:${next}:${vehicles.version}`;
    if (key !== this.mixKey) {
      this.mixKey = key;
      // the cars on the road now are of the era they were sent in until they arrive
      const eras = next ? [era, era + 1] : [era];
      this.mixes = eras.map(e => vehicleMix(e, this.region).flatMap(({ id, share }) => {
        const model = vehicles.model(id);
        return model ? [{ id, share, model }] : [];
      }));
      const ready = vehicleMix(era, this.region).filter(({ id }) => vehicles.has(id) && !vehicles.model(id)).length === 0;
      if (!ready || !this.mixes[0].length) { this.mixes = []; return false; }
      this.pool ??= new VehiclePool();
      if (!this.pool.root.parent) this.root.add(this.pool.root);
      for (const mix of this.mixes) for (const { model, share } of mix) {
        this.pool.ensure(model, Math.min(MAX_TRIP_CARS, Math.ceil(MAX_TRIP_CARS * share * 2.5) + 8));
      }
      // ... and those of an era gone, made again (a car keeps its model only while the pool has room for it)
      for (const [tag, model] of this.models) if (typeof model !== 'number' && !this.mixes.some(m => m.some(x => x.model === model))) this.models.delete(tag);
    }
    return this.mixes.length > 0;
  }

  /** A car's vehicle, the same for its whole trip: the next era's for its share of the cars */
  private pickModel(route: number, i: number): VehicleModel | null {
    const mixes = this.mixes, nextMix = mixes[1];
    const mix = nextMix?.length && hash01(route, i, 6) < this.nextShare() ? nextMix : mixes[0];
    if (!mix?.length) return null;
    const id = pickFrom(mix, hash01(route, i, 5));
    return mix.find(m => m.id === id)?.model ?? null;
  }

  private hideKinds(): void {
    for (const kind of this.kinds) for (const { mesh } of kind.parts) { mesh.count = 0; mesh.visible = false; }
  }

  /** Each route's way on the lanes, from the graph as it is (a route whose road is gone since is left out) */
  private build(trips: CityTrips, graph: RoadGraph): void {
    this.builtFor = trips;
    this.builtVersion = graph.version;
    this.paths = [];
    const ids = trips.roads.segmentIds, seconds = trips.result.seconds, u = this.units;
    trips.result.routes.forEach((route, index) => {
      const way = lanePathOf(graph, Array.from(route.segments, k => ids[k]), route.fromT, route.toT, u,
        (n, share) => (seconds[route.segments[n]] ?? 0) * share);
      if (!way) return;
      this.paths.push({ ...way.path, route, index, seconds: way.seconds, box: way.box });
    });
  }

  /** The region's cars as instanced meshes, made once */
  private ensureKinds(): void {
    if (this.kinds.length) return;
    const ids = CAR_IDS[this.region] ?? CAR_IDS.central, made = new Map<string, Kind>();
    const each = Math.ceil(MAX_TRIP_CARS / ids.length) + 8;
    for (const id of ids) {
      let kind = made.get(id);
      if (!kind) {
        const entry = registry[id];
        if (!entry) continue;
        const model: Object3D = entry.factory({ seed: made.size, region: this.region });
        model.updateMatrixWorld(true);
        const parts: Kind['parts'] = [];
        model.traverse((node) => {
          const mesh = node as Mesh;
          if (!mesh.isMesh) return;
          const instanced = new InstancedMesh(mesh.geometry, mesh.material, each * 2);
          instanced.count = 0;
          instanced.castShadow = false;
          instanced.receiveShadow = true;
          instanced.frustumCulled = false;
          this.root.add(instanced);
          parts.push({ mesh: instanced, local: mesh.matrixWorld.clone() });
        });
        if (!parts.length) continue;
        kind = { parts, count: 0 };
        made.set(id, kind);
      }
      this.kinds.push(kind);
    }
    // (a kind named twice is one set of meshes, chosen twice as often)
  }

  private hide(): void {
    this.hideKinds();
    this.pool?.hide();
    this.drawn = 0;
  }

  dispose(): void {
    for (const kind of new Set(this.kinds)) for (const { mesh } of kind.parts) mesh.dispose();
    this.kinds = [];
    this.paths = [];
    this.clearTraffic();
    this.pool?.dispose();
    this.pool = null;
    this.root.clear();
  }
}
