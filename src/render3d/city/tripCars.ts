/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The cars of the city's real trips (docs/NO_GRID_PLAN.md 1.5): each drives one of the month's routes on the road graph
// (src/sim/trips.ts), from a home's road to its work or the shops in the morning and back in the evening, turning at the
// junctions where its route turns, as fast as its roads are that month, so on a jammed road the cars bunch up and creep.
// A route has as many cars at once as its cars an hour times the time it takes (a road with no trips has none), fewer
// at night, up to MAX_TRIP_CARS round the camera. One InstancedMesh for each part of each kind of car. It only reads the
// city (map.trips, map.roadGraph); the old wandering cars (pedestrians.ts CityRoadTraffic) drive where there are no trips.

import { Group, InstancedMesh, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from 'three';
import { registry } from '../models/registry.js';
import type { CityHeightField } from './heightfield.js';
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

/** A route as a car drives it: its line (world units) with the distance and the time to each point, and its roads' lanes */
interface Path {
  route: TripRoute;
  index: number;
  xs: Float32Array;
  zs: Float32Array;
  /** Seconds from the start to each point */
  times: Float32Array;
  /** The lateral offset of its lane (world units) at each point's piece, and lanes a way there */
  lane: Float32Array;
  lanes: Uint8Array;
  /** Seconds it takes, and its bounds (world units) */
  seconds: number;
  box: [number, number, number, number];
}

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
  /** Cars drawn in the last frame */
  drawn = 0;

  constructor(private readonly map: TripCarsMap, private readonly terrain: CityHeightField, private readonly region: RegionId,
    private readonly size: number, private readonly units: number) {
    this.root.name = 'tripCars';
  }

  /** Whether there are trips to drive: where there are none the old wandering cars drive instead */
  get active(): boolean {
    return Boolean(this.map.trips?.result.routes.length) && Boolean(this.map.roadGraph);
  }

  /**
   * Places the cars for this moment: `seconds` the view's clock (cars move in real time), `hour` the time of day
   * (0-24), the camera's target and distance
   */
  update(target: Vector3, distance: number, seconds: number, hour: number): void {
    const trips = this.map.trips, graph = this.map.roadGraph;
    if (!trips || !graph || distance > FAR) { this.hide(); return; }
    if (trips !== this.builtFor || graph.version !== this.builtVersion) this.build(trips, graph);
    this.ensureKinds();
    for (const kind of this.kinds) kind.count = 0;
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
    // ... fewer of each where there would be too many
    const keep = wanted > MAX_TRIP_CARS ? MAX_TRIP_CARS / wanted : 1;
    let drawn = 0;
    for (const { path, cars } of near) {
      const n = Math.ceil(cars * keep - 1e-9);
      for (let i = 0; i < n && drawn < MAX_TRIP_CARS; i++) {
        // ... the last one only now and then, by its share
        if (i === n - 1 && hash01(path.index, i, 3) >= cars * keep - (n - 1)) continue;
        const forward = hash01(path.index, i, 1) < out;
        const along = (seconds + hash01(path.index, i, 2) * path.seconds + i * path.seconds / Math.max(1, n)) % path.seconds;
        if (this.place(path, forward ? along : path.seconds - along, forward, i, x0, x1, z0, z1)) drawn++;
      }
    }
    for (const kind of this.kinds) for (const { mesh } of kind.parts) {
      mesh.count = kind.count;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = kind.count > 0;
    }
    this.drawn = drawn;
  }

  /** One car of a route at a time along it (seconds from its start); whether it was drawn */
  private place(path: Path, time: number, forward: boolean, i: number, x0: number, x1: number, z0: number, z1: number): boolean {
    const { times, xs, zs } = path;
    let lo = 0, hi = times.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= time) lo = mid; else hi = mid; }
    const span = times[hi] - times[lo], f = span > 0 ? (time - times[lo]) / span : 0;
    let x = xs[lo] + (xs[hi] - xs[lo]) * f, z = zs[lo] + (zs[hi] - zs[lo]) * f;
    if (x < x0 || x > x1 || z < z0 || z > z1) return false;
    let dx = xs[hi] - xs[lo], dz = zs[hi] - zs[lo];
    if (!forward) { dx = -dx; dz = -dz; }
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return false;
    // Keeping left (Thailand), in a lane of its own way
    const lanes = path.lanes[lo], laneWidth = path.lane[lo] / Math.max(1, lanes), lane = Math.floor(hash01(path.index, i, 4) * lanes);
    const side = (lane + 0.5) * laneWidth;
    x += dz / length * side;
    z -= dx / length * side;
    const kinds = this.kinds, kind = kinds[Math.floor(hash01(path.index, i, 5) * kinds.length)];
    if (!kind || kind.count >= kind.parts[0]?.mesh.instanceMatrix.count) return false;
    this.position.set(x, this.terrain.sample(x, z), z);
    this.turn.setFromAxisAngle(this.up, Math.atan2(dx, dz));
    this.scale.setScalar(this.size);
    this.matrix.compose(this.position, this.turn, this.scale);
    for (const { mesh, local } of kind.parts) mesh.setMatrixAt(kind.count, this.part.multiplyMatrices(this.matrix, local));
    kind.count++;
    return true;
  }

  /** Each route's line, times and lanes, from the graph as it is (a route whose road is gone since is left out) */
  private build(trips: CityTrips, graph: RoadGraph): void {
    this.builtFor = trips;
    this.builtVersion = graph.version;
    this.paths = [];
    const ids = trips.roads.segmentIds, seconds = trips.result.seconds, u = this.units;
    trips.result.routes.forEach((route, index) => {
      const xs: number[] = [], zs: number[] = [], times: number[] = [], lane: number[] = [], lanes: number[] = [];
      let clock = 0, ok = true;
      const segs = route.segments;
      for (let n = 0; n < segs.length && ok; n++) {
        const k = segs[n], id = ids[k], s = graph.segments.get(id);
        if (!s) { ok = false; break; }
        // Which way along it, and how far: from the route's start (or the node it comes in by) to its end (or the node it
        // goes on by)
        const nextS = n + 1 < segs.length ? graph.segments.get(ids[segs[n + 1]]) : undefined;
        const prevS = n > 0 ? graph.segments.get(ids[segs[n - 1]]) : undefined;
        const shares = (o: typeof s | undefined, node: number): boolean => Boolean(o && (o.a === node || o.b === node));
        let t0: number, t1: number;
        if (segs.length === 1) { t0 = route.fromT; t1 = route.toT; }
        else if (n === 0) { t0 = route.fromT; t1 = shares(nextS, s.b) ? 1 : 0; }
        else if (n === segs.length - 1) { t0 = shares(prevS, s.a) ? 0 : 1; t1 = route.toT; }
        else { t0 = shares(prevS, s.a) ? 0 : 1; t1 = 1 - t0; }
        const pieceSeconds = (seconds[k] ?? 0) * Math.abs(t1 - t0);
        const level = s.level, spec = roadSpec(level), half = halfWidth(level, u);
        const steps = s.shape === 'line' ? 1 : Math.max(2, Math.ceil(graph.length(id) * Math.abs(t1 - t0) / 4));
        for (let j = 0; j <= steps; j++) {
          if (j === 0 && xs.length) continue;
          const t = t0 + (t1 - t0) * j / steps, [mx, mz] = graph.pointAt(id, t);
          xs.push(mx * u); zs.push(mz * u);
          times.push(clock + pieceSeconds * j / steps);
          lane.push(half);
          lanes.push(Math.max(1, Math.floor(spec.lanes / 2)));
        }
        clock += pieceSeconds;
      }
      if (!ok || xs.length < 2 || clock <= 0) return;
      let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
      for (let j = 0; j < xs.length; j++) { bx0 = Math.min(bx0, xs[j]); bx1 = Math.max(bx1, xs[j]); bz0 = Math.min(bz0, zs[j]); bz1 = Math.max(bz1, zs[j]); }
      this.paths.push({ route, index, xs: Float32Array.from(xs), zs: Float32Array.from(zs), times: Float32Array.from(times),
        lane: Float32Array.from(lane), lanes: Uint8Array.from(lanes), seconds: clock, box: [bx0, bz0, bx1, bz1] });
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
    for (const kind of this.kinds) for (const { mesh } of kind.parts) { mesh.count = 0; mesh.visible = false; }
    this.drawn = 0;
  }

  dispose(): void {
    for (const kind of new Set(this.kinds)) for (const { mesh } of kind.parts) mesh.dispose();
    this.kinds = [];
    this.paths = [];
    this.root.clear();
  }
}
