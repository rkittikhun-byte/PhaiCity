/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The cars of the city's real trips (src/render3d/city/tripCars.ts, docs/NO_GRID_PLAN.md 1.5): they drive the month's
// routes on the roads as drawn, keeping left, as many as the routes' cars, more in the rush hours, none on a road no
// trip takes, slower where a road is jammed.

import { Matrix4, Vector3 } from 'three';
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
    cars.update(new Vector3(500, 0, 250), 300, 100, 3);
    expect(cars.drawn).toBeLessThan(rush / 2);
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
