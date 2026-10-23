/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The cars of the city's real trips (src/render3d/city/tripCars.ts, docs/NO_GRID_PLAN.md 1.5): they drive the month's
// routes on the roads as drawn, keeping left, as many as the routes' cars, more in the rush hours, none on a road no
// trip takes, slower where a road is jammed.

import { readFileSync } from 'fs';
import { join } from 'path';
import { BoxGeometry, BufferAttribute, Group, Matrix4, Mesh, Vector3 } from 'three';
import { CityBuses } from '../../src/render3d/city/buses.js';
import { EraVehicles } from '../../src/render3d/city/eraVehicles.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { hourShare, MAX_TRIP_CARS, outShare, TripCars } from '../../src/render3d/city/tripCars.js';
import { roadCapacity, roadSpeed } from '../../src/roadLevels.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';
import { buildRoadNet } from '../../src/sim/roadNetwork.js';
import { monthTrips, type TripNet, type TripPlaces } from '../../src/sim/trips.js';

const flat = { sample: () => 0 } as unknown as CityHeightField;
const U = 10 / 16;

/** A town of homes along a street at the west, jobs along one at the east, joined by a main road, and a side road no
 * trip takes; its trips with `cars` an hour from each home group */
function town(cars: number) {
  const graph = new RoadGraph();
  const homes = graph.add({ from: [100, 100], to: [100, 700], level: 2 }).segments;
  const main = graph.add({ from: [100, 400], to: [1500, 400], level: 2 }).segments;
  const jobs = graph.add({ from: [1500, 100], to: [1500, 700], level: 2 }).segments;
  const side = graph.add({ from: [800, 900], to: [1300, 1300], level: 2 }).segments[0];
  const roads = buildRoadNet(graph), m = roads.segmentIds.length;
  const speed = new Float64Array(m), capacity = new Float64Array(m);
  for (let k = 0; k < m; k++) { const level = graph.segment(roads.segmentIds[k]).level; speed[k] = roadSpeed(level); capacity[k] = roadCapacity(level); }
  const net: TripNet = { offsets: roads.offsets, wayTo: roads.wayTo, waySegment: roads.waySegment, segA: roads.segA, segB: roads.segB,
    length: roads.length, speed, capacity };
  const index = (id: number) => roads.segmentIndex.get(id)!;
  const homeSegs = graph.segmentsAt(graph.nodeNear([100, 400], 1)!.id).filter((id) => !main.includes(id));
  const jobSegs = graph.segmentsAt(graph.nodeNear([1500, 400], 1)!.id).filter((id) => !main.includes(id));
  const places: TripPlaces = {
    homeTile: Int32Array.from([1, 2]), homeSegment: Int32Array.from(homeSegs.map(index)), homeT: Float32Array.from([0.5, 0.5]),
    homeCars: Float32Array.from([cars, cars]), jobTile: Int32Array.from([3, 4]), jobSegment: Int32Array.from(jobSegs.map(index)),
    jobT: Float32Array.from([0.5, 0.5]), jobs: Float32Array.from([500, 500]), shops: Float32Array.from([200, 200]),
  };
  const result = monthTrips({ net, places, seed: 9 });
  const trips = { roads, net, places, result, step: 0, homeToWork: new Float32Array(0), jobToHome: new Float32Array(0),
    trafficTiles: new Int32Array(0), traffic: new Uint8Array(0), roadTiles: new Int32Array(0), roadFull: new Float32Array(0) };
  const map = { width: 200, height: 200, tileSizeM: 16, roadGraph: graph, trips };
  void homes; void jobs;
  return { graph, map, side, main };
}

/** Where the cars drawn are (world units): each kind's first part moves with its car */
function carsOf(cars: TripCars): Vector3[] {
  const out: Vector3[] = [], m = new Matrix4(), p = new Vector3();
  const kinds = (cars as any).kinds as Array<{ parts: Array<{ mesh: any; local: Matrix4 }>; count: number }>;
  for (const kind of new Set(kinds)) {
    const { mesh, local } = kind.parts[0], inverse = local.clone().invert();
    for (let i = 0; i < kind.count; i++) { mesh.getMatrixAt(i, m); m.multiply(inverse); p.setFromMatrixPosition(m); out.push(p.clone()); }
  }
  return out;
}

const nearestOn = (graph: RoadGraph, p: Vector3) => graph.nearest([p.x / U, p.z / U], 50);

describe('the cars of the real trips', () => {
  test('drive the trips\' roads keeping left, as many as their cars, none on a road no trip takes', () => {
    const { graph, map, side } = town(300);
    const cars = new TripCars(map, flat, 'northeast', U, U);
    expect(cars.active).toBe(true);
    cars.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    const at = carsOf(cars);
    expect(at.length).toBe(cars.drawn);
    expect(at.length).toBeGreaterThan(5);
    expect(at.length).toBeLessThanOrEqual(MAX_TRIP_CARS);
    for (const p of at) {
      const near = nearestOn(graph, p)!;
      // ... on a road, off its middle by a lane, never on the side road
      expect(near.distance).toBeLessThan(4);
      expect(near.distance).toBeGreaterThan(0.3);
      expect(near.segment).not.toBe(side);
    }
  });

  test('more in the rush hours than at night, most going out in the morning and home in the evening', () => {
    expect(hourShare(7.5)).toBeCloseTo(1, 2);
    expect(hourShare(17.5)).toBeCloseTo(1, 2);
    expect(hourShare(3)).toBeLessThan(0.2);
    expect(outShare(7)).toBeGreaterThan(0.5);
    expect(outShare(18)).toBeLessThan(0.5);
    const { map } = town(300), cars = new TripCars(map, flat, 'northeast', U, U);
    cars.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    const rush = cars.drawn;
    const night = new TripCars(town(300).map, flat, 'northeast', U, U);
    night.update(new Vector3(500, 0, 250), 300, 100, 3);
    expect(night.drawn).toBeLessThan(rush / 2);
    // ... and the cars of the rush hour go home and are not sent again in the night
    for (let t = 0; t < 600; t += 0.25) cars.update(new Vector3(500, 0, 250), 300, 100 + t, 3);
    expect(cars.drawn).toBeLessThan(rush / 2);
  });

  test('the cars drive as traffic: each faces the way it moves, only forward, and none drives into the one ahead', () => {
    const { map } = town(600), cars = new TripCars(map, flat, 'northeast', U, U);
    const traffic = cars.traffic, pose = { x: 0, z: 0, dx: 0, dz: 0 };
    cars.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    const seen = new Map<number, { x: number; z: number; s: number }>();
    let moved = 0;
    for (let t = 0.1; t < 60; t += 0.1) {
      cars.update(new Vector3(500, 0, 250), 300, 100 + t, 7.5);
      // in each lane of each road, the cars in order along it, none overlapping the next
      const lanes = new Map<string, Array<{ u: number; half: number; x: number; z: number }>>();
      for (const car of traffic.cars) {
        traffic.pose(car, pose);
        const last = seen.get(car.id);
        if (last) {
          expect(car.s).toBeGreaterThanOrEqual(last.s - 1e-9);
          const mx = pose.x - last.x, mz = pose.z - last.z;
          if (Math.hypot(mx, mz) > 1e-3) { expect(mx * pose.dx + mz * pose.dz).toBeGreaterThan(0); moved++; }
        }
        seen.set(car.id, { x: pose.x, z: pose.z, s: car.s });
        const p = car.path.pieces[car.piece];
        if (Math.abs(car.shift - car.lane) > 1e-3) continue;
        const key = `${p.segment}:${p.up !== car.rev}:${car.lane}`;
        const u = (traffic as unknown as { u(c: unknown, p: unknown): number }).u(car, p);
        let list = lanes.get(key);
        if (!list) lanes.set(key, list = []);
        list.push({ u, half: car.length / 2, x: pose.x, z: pose.z });
      }
      // the cars next to each other in a lane, measured where they are drawn: never closer than their half lengths
      for (const list of lanes.values()) {
        list.sort((a, b) => a.u - b.u);
        for (let i = 1; i < list.length; i++) {
          const dd = Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z);
          expect(dd).toBeGreaterThan((list[i].half + list[i - 1].half) * 0.97);
        }
      }
    }
    expect(moved).toBeGreaterThan(100);
  });

  test('a new month\'s trips leave the cars on the road where they are: they drive on to the ends of their trips', () => {
    const { map } = town(300), cars = new TripCars(map, flat, 'northeast', U, U);
    for (let t = 0; t < 5; t += 0.1) cars.update(new Vector3(500, 0, 250), 300, 100 + t, 7.5);
    const before = new Map(cars.traffic.cars.map(c => [c.id, c.s]));
    expect(before.size).toBeGreaterThan(3);
    (map as { trips: unknown }).trips = { ...map.trips };
    cars.update(new Vector3(500, 0, 250), 300, 105.1, 7.5);
    const still = cars.traffic.cars.filter(c => before.has(c.id));
    expect(still.length).toBeGreaterThanOrEqual(before.size - 1);
    for (const c of still) expect(c.s).toBeGreaterThanOrEqual(before.get(c.id)!);
  });

  test('a road no trip takes, a town with no trips, or a camera far away: no cars', () => {
    const { map } = town(0), cars = new TripCars(map, flat, 'northeast', U, U);
    cars.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    expect(cars.drawn).toBe(0);
    const busy = town(300), far = new TripCars(busy.map, flat, 'northeast', U, U);
    far.update(new Vector3(500, 0, 250), 5000, 100, 7.5);
    expect(far.drawn).toBe(0);
    // ... and a route whose road has gone since is left out
    for (const id of [...busy.graph.segments.keys()]) busy.graph.remove(id);
    far.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    expect(far.drawn).toBe(0);
  });
});

describe('jams where the city\'s roads are full, and every car on a trip', () => {
  /** The cars on the main road after a while of traffic, their mean speed and how many */
  function mainRoad(cars: number, hour: number) {
    const { map, main, graph } = town(cars), traffic = new TripCars(map, flat, 'northeast', U, U);
    for (let t = 0; t < 90; t += 0.1) traffic.update(new Vector3(500, 0, 250), 300, 100 + t, hour);
    const on = traffic.traffic.cars.filter(c => main.includes(c.path.pieces[c.piece].segment));
    const v = on.reduce((sum, c) => sum + c.v, 0) / Math.max(1, on.length);
    return { traffic, on, v, map, graph };
  }

  test('a road over its capacity in the rush hour fills with slow cars and gets signals; a quiet road flows free', () => {
    const jam = mainRoad(4000, 7.5), quiet = mainRoad(60, 7.5);
    const k = (jam.map.trips as any).roads.segmentIndex.get(jam.on[0]?.path.pieces[jam.on[0].piece].segment);
    // (the simulation's own load: the main road takes more cars than it can)
    expect(jam.map.trips!.result.cars[k] / jam.map.trips!.net.capacity[k]).toBeGreaterThan(1);
    expect(jam.on.length).toBeGreaterThan(quiet.on.length * 3);
    expect(jam.v).toBeLessThan(quiet.v * 0.6);
    expect(jam.traffic.traffic.signalled.length).toBeGreaterThan(0);
    expect(quiet.traffic.traffic.signalled.length).toBe(0);
  });

  test('the same road is thick and slow in the rush hour and thin and quick at night', () => {
    const rush = mainRoad(4000, 7.5), night = mainRoad(4000, 2);
    expect(night.on.length).toBeLessThan(rush.on.length / 2);
    expect(night.v).toBeGreaterThan(rush.v * 1.5);
  });

  test('a junction with signals lets its roads in by turns, never two crossing roads at once', () => {
    const lanes = mainRoad(4000, 7.5).traffic.traffic;
    const node = lanes.signalled[0];
    const greens = new Set<string>();
    for (let t = 0; t < 120; t += 0.5) {
      const open = [...((lanes as any).signals.get(node).turn.keys() as Iterable<number>)].filter(seg => lanes.green(node, seg, t));
      greens.add(open.join(','));
      // the roads open at once are one turn's: straight across from each other, or one alone
      expect(new Set(open.map(seg => (lanes as any).signals.get(node).turn.get(seg))).size).toBeLessThanOrEqual(1);
    }
    // ... each turn in its time, and an all-red between
    expect(greens.has('')).toBe(true);
    expect(greens.size).toBeGreaterThanOrEqual(3);
  });

  test('every car comes from a home of its route and goes to a workplace or shop of its destination, or home again', () => {
    const { traffic, map } = mainRoad(600, 7.5), pl = map.trips!.places;
    const homes = new Set(pl.homeTile), jobs = new Set(pl.jobTile);
    expect(traffic.traffic.cars.length).toBeGreaterThan(5);
    for (const car of traffic.traffic.cars) {
      const trip = car.trip as import('../../src/render3d/city/tripCars.js').CarTrip;
      expect(trip).toBeDefined();
      const home = trip.homeward ? trip.to : trip.from, there = trip.homeward ? trip.from : trip.to;
      expect(home.kind).toBe('home');
      expect(homes.has(home.tile)).toBe(true);
      expect(jobs.has(there.tile)).toBe(true);
      expect(there.kind).toBe(trip.purpose === 1 ? 'shop' : 'work');
      // it turns into its destination's driveway before the end of the route's way, at most
      expect(car.stop).toBeLessThanOrEqual(car.path.total + 1e-6);
    }
    // ... and a click finds one with its trip
    const pose = { x: 0, z: 0, dx: 0, dz: 0 }, some = traffic.traffic.cars[0];
    traffic.traffic.pose(some, pose);
    expect(traffic.tripAt(pose.x, pose.z, 2)?.trip).toBe(some.trip);
  });
});

describe('the buses in the traffic', () => {
  test('a bus is a car of the traffic: it drives its way to the town\'s middle facing forward, and the cars queue behind it', () => {
    const { map } = town(600);
    const busMap = { ...map, buses: [25 * 200 + 6], rulerHouse: { x: 93, y: 25 } };
    const cars = new TripCars(busMap, flat, 'northeast', U, U), buses = new CityBuses(busMap, flat, U);
    let last: Vector3 | null = null, moved = 0, back = 0, inTraffic = 0;
    for (let t = 0; t < 90; t += 0.1) {
      buses.traffic = cars.traffic;
      buses.update([], 100 + t);
      cars.update(new Vector3(500, 0, 250), 300, 100 + t, 7.5);
      const bus = buses.root.children[0];
      if (cars.traffic.cars.some(c => c.tag < 0)) inTraffic++;
      if (last && bus.visible) {
        const mx = bus.position.x - last.x, mz = bus.position.z - last.z;
        if (Math.hypot(mx, mz) > 1e-3) { moved++; if (mx * Math.sin(bus.rotation.y) + mz * Math.cos(bus.rotation.y) <= 0) back++; }
      }
      last = bus.position.clone();
    }
    expect(inTraffic).toBeGreaterThan(500);
    expect(moved).toBeGreaterThan(100);
    expect(back).toBe(0);
    buses.dispose();
  });
});

describe('the trip cars of the city\'s era', () => {
  const index = JSON.parse(readFileSync(join(__dirname, '..', '..', 'assets/models/vehicles/index.json'), 'utf8'));
  const scene = () => {
    const g = new Group();
    for (const name of ['body', 'paint', 'lights', 'wheel0']) {
      const box = new BoxGeometry(1, 1, 1);
      box.setAttribute('color', new BufferAttribute(new Float32Array(box.getAttribute('position').count * 3).fill(1), 3));
      const mesh = new Mesh(box); mesh.name = name; g.add(mesh);
    }
    return g;
  };
  /** Every exported vehicle, loaded at once */
  async function loaded() {
    const vehicles = new EraVehicles(index, '', async () => ({ scene: scene() }), Promise.resolve(null));
    for (const id of Object.keys(index.vehicles)) vehicles.model(id);
    for (let k = 0; k < 4; k++) await new Promise(r => setTimeout(r, 0));
    return vehicles;
  }
  /** The ids of the era vehicles drawn, by the pool's body meshes */
  const drawnIds = (cars: TripCars): string[] => {
    const pool = (cars as any).pool;
    return [...pool.draws.values()].filter((d: any) => d.levels[0].count > 0).map((d: any) => d.model.id);
  };

  test('a village drives only its carts, bicycles and hand carts; in a transition a few of the next era\'s', async () => {
    const vehicles = await loaded();
    const { map } = town(300), cars = new TripCars(map, flat, 'northeast', U, U);
    cars.vehicles = vehicles;
    cars.era = () => 1;
    cars.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    expect(cars.drawn).toBeGreaterThan(5);
    const ids = drawnIds(cars);
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) expect(id.startsWith('era1/')).toBe(true);
    // the procedural cars are put away
    expect(carsOf(cars).length).toBe(0);
    const next = new TripCars(town(300).map, flat, 'northeast', U, U);
    next.vehicles = vehicles;
    next.era = () => 1;
    next.nextShare = () => 1;
    next.update(new Vector3(500, 0, 250), 300, 100, 7.5);
    expect(drawnIds(next).some(id => id.startsWith('era2/'))).toBe(true);
  });

  test('the future\'s flying taxis fly over their routes', async () => {
    const vehicles = await loaded();
    const { map } = town(600), cars = new TripCars(map, flat, 'central', U, U);
    cars.vehicles = vehicles;
    cars.era = () => 5;
    const pool = () => (cars as any).pool, draw = () => pool()?.draws.get('era5/flying_taxi');
    // (a minute of traffic, enough for a few of them to be sent)
    for (let t = 0; t < 60 && !(draw()?.levels[0].count > 0); t += 0.1) cars.update(new Vector3(500, 0, 250), 300, 100 + t, 7.5);
    expect(draw().levels[0].count).toBeGreaterThan(0);
    const m = new Matrix4(), p = new Vector3();
    draw().levels[0].parts[0].mesh.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    expect(p.y).toBeGreaterThan(index.vehicles['era5/flying_taxi'].fly * U * 0.8);
  });
});
