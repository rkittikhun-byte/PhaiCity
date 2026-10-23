/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's buses (owner, 15 Oct 2026: "ป้ายรถเมล์ ไม่ต้องมีตั้งนะ แค่วาง รถเมล์ ก็ไปรับได้เลย"): each one put down on a
// road (gameMap.buses, src/busStopTool.ts) drives from there to the town's middle (the ruler's house) and back along the
// roads as drawn, turning where its way turns (docs/NO_GRID_PLAN.md 1.5, src/render3d/city/graphPaths.ts), picking people
// up, as the simulation counts it (src/transit.ts); without the road graph or the house, up and down its road there. Once
// the era vehicles have loaded it is the era's bus (eraVehicles.ts transitVehicle: the red bus, the north's red
// songthaew, the air-conditioned bus, the low-floor bus, the driverless shuttle). While the trip cars drive
// (tripCars.ts) each bus is a car in their traffic (laneTraffic.ts), so it keeps its gap, waits at junctions and the cars
// queue behind it instead of driving through it; its wheels turn by the distance it has come. It only reads the map
// and the roads' lines.

import { Group, type Object3D } from 'three';
import { registry } from '../models/registry.js';
import type { RegionId } from '../regional/types.js';
import { animateObject, type EraVehicles, paintFor } from './eraVehicles.js';
import type { LaneCar, LanePath, LaneTraffic } from './laneTraffic.js';
import { lanePathOf } from './tripCars.js';
import { type HeightSource, roadSurfaceHeight } from './roadBuild.js';
import type { Point } from '../../roadGeometry.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import type { CityHeightField } from './heightfield.js';
import { pointAlong, type Way, wayBetween } from './graphPaths.js';

/** How far a bus drives either way from where it was put down (world units), and how fast */
const RUN = 60;
const SPEED = 6;
/** Seconds a bus halts at each end of its way */
const HALT = 4;
/** How far left of the road's middle it keeps, as traffic does in Thailand (world units, about 1.6 m) */
const LANE = 1;

interface BusMap {
  readonly width: number;
  readonly height?: number;
  buses?: number[];
  readonly roadGraph?: RoadGraph | null;
  readonly tileSizeM?: number | null;
  readonly rulerHouse?: { readonly x: number; readonly y: number } | null;
}

export class CityBuses {
  readonly root = new Group();
  private readonly models: Object3D[] = [];
  /** Each bus's way to the town's middle, made again when the roads, the buses or the house change */
  private ways: Array<Way | null> = [];
  private waysKey = '';
  /** The era vehicles and the one the buses are now (set by the city view); the id the models were made as */
  vehicles: EraVehicles | null = null;
  vehicleId: () => string | null = () => null;
  region: RegionId = 'central';
  private madeAs = '';
  /** The trip cars' traffic while it drives (set by the city view), and each bus's run in it: its way on the lanes, its
   * car, which way it is going, how far it had come, and when its halt at an end is over */
  traffic: LaneTraffic | null = null;
  private runs: Array<{ path: LanePath | null; way: Way | null; car: LaneCar | null; rev: boolean; s: number; halt: number; odometer: number }> = [];

  constructor(private readonly map: BusMap, private readonly terrain: CityHeightField, private readonly size: number) {
    this.root.name = 'buses';
  }

  /** Each frame: every bus on its road, at the time given (seconds); lines: the roads as drawn (roadCurves.ts) */
  update(lines: ReadonlyArray<{ points: Point[]; rail: boolean }>, seconds: number): void {
    const buses = this.map.buses ?? [];
    this.eraModels();
    while (this.models.length < buses.length) {
      const model = this.make(this.models.length);
      model.scale.setScalar(this.size);
      this.models.push(model); this.root.add(model);
    }
    this.models.forEach((model, n) => { model.visible = n < buses.length; });
    this.planWays(buses);
    buses.forEach((index, n) => {
      const way = this.ways[n], model = this.models[n];
      if (way && this.traffic && this.inTraffic(n, way, model, seconds)) return;
      if (way) {
        // Out to the town's middle and back, a halt of a few seconds at each end
        const lap = way.length * 2 / SPEED + HALT * 2, time = (seconds + n * 7) % lap;
        const out = time < way.length / SPEED + HALT;
        const run = out ? Math.min(way.length, Math.max(0, (time - HALT) * SPEED)) : Math.max(0, way.length - (time - way.length / SPEED - HALT * 2) * SPEED);
        const at = pointAlong(way, run), turn = Math.atan2(out ? at.dx : -at.dx, out ? at.dz : -at.dz);
        const x0 = at.x + Math.cos(turn) * LANE, z0 = at.z - Math.sin(turn) * LANE;
        model.position.set(x0, this.terrain.sample(x0, z0), z0);
        model.rotation.y = turn;
        model.visible = true;
        this.turnWheels(model, (Math.floor((seconds + n * 7) / lap) * way.length * 2 + (out ? run : way.length * 2 - run)) / this.size, seconds);
        return;
      }
      const x = (index % this.map.width + 0.5) * 10, z = (Math.floor(index / this.map.width) + 0.5) * 10;
      const phase = seconds * SPEED / RUN + n;
      const place = this.along(lines, x, z, Math.sin(phase) * RUN);
      if (!place) { model.visible = false; return; }
      // It faces the way it drives: back along the line while its run swings back
      const turn = place.turn + (Math.cos(phase) < 0 ? Math.PI : 0);
      // Its left is (cos, -sin) of the way it faces
      const x0 = place.x + Math.cos(turn) * LANE, z0 = place.z - Math.sin(turn) * LANE;
      model.position.set(x0, this.terrain.sample(x0, z0), z0);
      model.rotation.y = turn;
    });
  }

  /** The bus as the era's vehicle when it has loaded, else the procedural bus */
  private make(n: number): Object3D {
    const id = this.madeAs, entry = id ? this.vehicles?.entry(id) : null;
    const era = entry ? this.vehicles!.object(id, paintFor(id, entry, this.region, ((n * 0.618034) % 1))) : null;
    return era ?? registry['veh.bus']?.factory({ seed: n }) ?? new Group();
  }

  /** Makes the buses again when the era's vehicle changes or loads */
  private eraModels(): void {
    const id = this.vehicleId(), ready = id && this.vehicles?.model(id) ? id : '';
    if (ready === this.madeAs) return;
    this.madeAs = ready;
    for (const model of this.models) this.root.remove(model);
    this.models.length = 0;
  }

  /** A bus as a car of the traffic: out to the town's middle and back along its way, a halt at each end; whether it was
   * placed (its way has no lanes, or the traffic was made again and it waits to come back on) */
  private inTraffic(n: number, way: Way, model: Object3D, seconds: number): boolean {
    const traffic = this.traffic!, graph = this.map.roadGraph;
    let run = this.runs[n];
    if (!run || run.way !== way) {
      if (run?.car) traffic.remove(run.car);
      const units = 10 / (this.map.tileSizeM ?? 16);
      const lanes = graph && way.segments ? lanePathOf(graph, way.segments, way.fromT ?? 0, way.toT ?? 1, units,
        (k, share) => graph.length(way.segments![k]) * units * share / SPEED) : null;
      run = this.runs[n] = { path: lanes?.path ?? null, way, car: null, rev: false, s: 0, halt: seconds + (n * 3) % 7, odometer: 0 };
    }
    if (!run.path) return false;
    // (the traffic made again, as it is each month: back on where it was)
    if (run.car && !traffic.cars.includes(run.car)) run.car = null;
    if (run.car?.done) {
      traffic.remove(run.car);
      run.odometer += run.car.odometer; run.car = null; run.rev = !run.rev; run.s = 0; run.halt = seconds + HALT;
    }
    if (!run.car && seconds >= run.halt) {
      const entry = this.madeAs ? this.vehicles?.entry(this.madeAs) : null;
      run.car = traffic.add(run.path, run.rev, run.s, 0, (entry?.length ?? 10.5) * this.size, 0.85, -1 - n);
    }
    const car = run.car;
    if (car) {
      run.s = car.s;
      const at = traffic.pose(car, { x: 0, z: 0, dx: 0, dz: 1, side: 0 }), level = car.path.pieces[car.piece].level ?? 2;
      // on the road's own surface (roadBuild.ts roadSurfaceHeight), not the ground under it
      const heights = this.terrain as unknown as HeightSource, units = 10 / (this.map.tileSizeM ?? 16);
      const y = typeof heights.sampleTile === 'function'
        ? roadSurfaceHeight(heights, this.map.width, this.map.height ?? this.map.width, units, at.x, at.z, level, at.side ?? 0)
        : this.terrain.sample(at.x, at.z);
      model.position.set(at.x, y, at.z);
      model.rotation.y = Math.atan2(at.dx, at.dz);
    }
    model.visible = Boolean(car) || model.position.lengthSq() > 0;
    this.turnWheels(model, (run.odometer + (car?.odometer ?? 0)) / this.size, seconds);
    return true;
  }

  /** The era bus's wheels by the metres it has driven */
  private turnWheels(model: Object3D, metres: number, seconds: number): void {
    const entry = this.madeAs ? this.vehicles?.entry(this.madeAs) : null;
    if (entry) animateObject(model, entry, metres, seconds);
  }

  /** Each bus's way along the road graph from where it was put down to the ruler's house, when both are there */
  private planWays(buses: readonly number[]): void {
    const graph = this.map.roadGraph, house = this.map.rulerHouse, size = this.map.tileSizeM ?? 16;
    const key = `${graph?.version ?? -1}:${buses.join(',')}:${house ? `${house.x},${house.y}` : '-'}`;
    if (key === this.waysKey) return;
    this.waysKey = key;
    const units = 10 / size;
    this.ways = buses.map((index) => {
      if (!graph?.segments.size || !house) return null;
      const from: [number, number] = [(index % this.map.width + 0.5) * size, (Math.floor(index / this.map.width) + 0.5) * size];
      const way = wayBetween(graph, from, [(house.x + 0.5) * size, (house.y + 0.5) * size], units, size * 3);
      return way && way.length > 20 ? way : null;
    });
  }

  /** The point `offset` along the road line nearest (x, z), and the line's own way there */
  private along(lines: ReadonlyArray<{ points: Point[]; rail: boolean }>, x: number, z: number, offset: number):
      { x: number; z: number; turn: number } | null {
    let best: { line: Point[]; i: number; t: number; d: number } | null = null;
    for (const { points, rail } of lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (!best || d < best.d) best = { line: points, i, t, d };
      }
    }
    if (!best || best.d > 12) return null;
    // Walk the offset along the line from there
    const { line } = best;
    let i = best.i, left = Math.abs(offset), forward = offset >= 0;
    let [px, pz] = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * best.t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * best.t];
    let k = forward ? i : i - 1;
    while (left > 0 && k >= 0 && k < line.length) {
      const [qx, qz] = line[k], d = Math.hypot(qx - px, qz - pz);
      if (d >= left) { px += (qx - px) * left / d; pz += (qz - pz) * left / d; left = 0; break; }
      left -= d; px = qx; pz = qz; k += forward ? 1 : -1;
    }
    const a = line[Math.max(0, Math.min(line.length - 2, k - (forward ? 1 : 0)))], b = line[Math.max(1, Math.min(line.length - 1, k + (forward ? 0 : 1)))];
    const turn = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return { x: px, z: pz, turn };
  }

  dispose(): void {
    for (const run of this.runs) if (run?.car) this.traffic?.remove(run.car);
    this.runs = [];
    this.root.clear();
  }
}
