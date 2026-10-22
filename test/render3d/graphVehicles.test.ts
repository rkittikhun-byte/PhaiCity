/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Buses and trains on the roads and railways as drawn (docs/NO_GRID_PLAN.md 1.5): a bus drives from where it was put
// down to the town's middle along the road graph and back, a train runs the longest line of the rail graph with its
// carriages following the line (src/render3d/city/graphPaths.ts, buses.ts, railTrains.ts).

import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { CityBuses } from '../../src/render3d/city/buses.js';
import { longestWay, pointAlong, wayBetween } from '../../src/render3d/city/graphPaths.js';
import { RailTrains } from '../../src/render3d/city/railTrains.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';

const flat = { sample: () => 0 } as unknown as CityHeightField;
const U = 10 / 16;

describe('ways along the graphs', () => {
  test('the shortest way between two places turns where the roads turn; the longest runs end to end', () => {
    const g = new RoadGraph();
    g.add({ from: [0, 0], to: [800, 0], level: 2 });
    g.add({ from: [400, 0], to: [400, 600], level: 2 });
    g.add({ from: [800, 0], to: [800, 300], level: 2 });
    const way = wayBetween(g, [100, 5], [405, 500], U)!;
    // Along the first road to the junction, then down the second: 300 + 500 m
    expect(way.length / U).toBeCloseTo(800, 0);
    expect(pointAlong(way, 300 * U)).toMatchObject({ x: expect.closeTo(400 * U, 3), z: expect.closeTo(0, 3) });
    const long = longestWay(g, U)!;
    // From the end of the branch at (400, 600) to (800, 300): 600 + 400 + 300 m
    expect(long.length / U).toBeCloseTo(1300, 0);
  });

  test('a bus drives the roads from where it was put down to the ruler\'s house and back', () => {
    const g = new RoadGraph();
    g.add({ from: [0, 8], to: [1600, 8], level: 2 });
    g.add({ from: [800, 8], to: [800, 1200], level: 2 });
    const map = { width: 100, buses: [2], roadGraph: g, tileSizeM: 16, rulerHouse: { x: 50, y: 60 } };
    const buses = new CityBuses(map, flat, U);
    const lines: never[] = [];
    for (const seconds of [0, 20, 60, 120, 200]) {
      buses.update(lines, seconds);
      const bus = buses.root.children[0];
      expect(bus.visible).toBe(true);
      // ... always on a road, a lane off its middle
      const near = g.nearest([bus.position.x / U, bus.position.z / U], 10)!;
      expect(near.distance).toBeLessThan(2.5);
    }
  });

  test('a train runs the railway with its carriages along the line behind it', () => {
    const g = new RoadGraph();
    g.add({ from: [0, 100], to: [3000, 100], level: 1 });
    g.add({ from: [3000, 100], to: [4000, 900], c1: [3500, 100], c2: [4000, 400], level: 1 });
    const trains = new RailTrains({ railGraph: g, tileSizeM: 16 }, flat, U);
    expect(trains.active).toBe(true);
    for (const seconds of [0, 30, 120, 250]) {
      trains.update(seconds);
      const cars = trains.root.children;
      expect(cars).toHaveLength(5);
      for (const car of cars) expect(g.nearest([car.position.x / U, car.position.z / U], 10)!.distance).toBeLessThan(0.5);
      for (let i = 1; i < cars.length; i++) {
        const d = Math.hypot(cars[i].position.x - cars[i - 1].position.x, cars[i].position.z - cars[i - 1].position.z) / U;
        expect(d).toBeGreaterThan(18);
        expect(d).toBeLessThan(21);
      }
    }
    // ... and no train on a railway too short for it
    const short = new RoadGraph();
    short.add({ from: [0, 0], to: [60, 0], level: 1 });
    expect(new RailTrains({ railGraph: short, tileSizeM: 16 }, flat, U).active).toBe(false);
  });
});
