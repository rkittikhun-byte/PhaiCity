/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 3D view's traffic (src/render3d/city/laneTraffic.ts; owner, 23 Oct 2026: "รถไม่ควรจะซ้อนกันคันกัน เช่น คัน a วิ่งช้า
// กว่า คัน b ผ่ากลางคัน a ไปเลย"): a car never drives into the one ahead, slows to its speed behind it, passes it in a
// free lane, waits its turn at a junction, faces the way it goes, and only ever goes forward.

import { type LaneCar, type LanePath, type LanePiece, LaneTraffic } from '../../src/render3d/city/laneTraffic.js';
import { lanePathOf } from '../../src/render3d/city/tripCars.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';

/** A straight way from (x0, z0) to (x1, z1) as pieces of the given segments, split at the junction `node` halfway */
function way(x0: number, z0: number, x1: number, z1: number, lanes: number, speed: number, segs: [number, number], node: number): LanePath {
  const n = 40, xs = new Float32Array(n + 1), zs = new Float32Array(n + 1), dist = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) { xs[i] = x0 + (x1 - x0) * i / n; zs[i] = z0 + (z1 - z0) * i / n; }
  for (let i = 1; i <= n; i++) dist[i] = dist[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  const total = dist[n], half = total / 2;
  const piece = (segment: number, start: number, end: number, nodeStart: number, nodeEnd: number): LanePiece =>
    ({ segment, up: true, start, end, entry: 0, length: end - start, lanes, laneWidth: 3.5 * lanes, speed, nodeStart, nodeEnd });
  return { xs, zs, dist, total, pieces: [piece(segs[0], 0, half, -1, node), piece(segs[1], half, total, node, -1)] };
}

const length = 4.5;

/** Steps the traffic `seconds` long, calling check after each step */
function run(traffic: LaneTraffic, seconds: number, check: () => void, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) { traffic.step(dt); check(); }
}

describe('the traffic of the 3D view', () => {
  test('a car behind a slow ox cart keeps its gap and slows to the cart\'s pace, never through it, never backwards', () => {
    const traffic = new LaneTraffic(1), road = way(0, 0, 600, 0, 1, 12, [1, 2], -1);
    const cart = traffic.add(road, false, 60, 0, 6.5, 0.3, 1)!;
    const car = traffic.add(road, false, 0, 0, length, 1, 2)!;
    let worst = Infinity, lastS = car.s;
    run(traffic, 60, () => {
      worst = Math.min(worst, cart.s - car.s - (6.5 + length) / 2);
      expect(car.s).toBeGreaterThanOrEqual(lastS - 1e-9);
      expect(car.v).toBeGreaterThanOrEqual(0);
      lastS = car.s;
    });
    expect(worst).toBeGreaterThan(0.5);
    // ... going as slowly as the cart in the end, a few metres behind it
    expect(Math.abs(car.v - cart.v)).toBeLessThan(0.5);
    expect(cart.s - car.s).toBeLessThan(25);
  });

  test('where the road has two lanes a way, the car passes the cart in the other lane', () => {
    const traffic = new LaneTraffic(1), road = way(0, 0, 900, 0, 2, 12, [1, 2], -1);
    const cart = traffic.add(road, false, 60, 0, 6.5, 0.3, 1)!;
    const car = traffic.add(road, false, 0, 0, length, 1, 2)!;
    run(traffic, 40, () => {
      // never through the cart while they share a lane
      if (Math.round(car.shift) === cart.lane && Math.abs(car.shift - cart.lane) < 0.5) {
        expect(Math.abs(cart.s - car.s)).toBeGreaterThan((6.5 + length) / 2 - 0.3);
      }
    });
    expect(car.lane).toBe(1);
    expect(car.s).toBeGreaterThan(cart.s + 10);
  });

  test('two cars coming to a junction from two roads cross it one at a time', () => {
    const traffic = new LaneTraffic(1);
    const east = way(-150, 0, 150, 0, 1, 12, [1, 2], 7), north = way(0, -150, 0, 150, 1, 12, [3, 4], 7);
    const a = traffic.add(east, false, 100, 0, length, 1, 1)!;
    const b = traffic.add(north, false, 100, 0, length, 1, 2)!;
    // in the crossing: any of the car within the other road's width (3.5 m either side of its middle)
    const inside = (car: LaneCar): boolean => Math.abs(car.s - 150) < length / 2 + 3.5;
    let both = 0, crossedA = false, crossedB = false;
    run(traffic, 40, () => {
      if (inside(a) && inside(b)) both++;
      crossedA ||= a.s > 160; crossedB ||= b.s > 160;
    });
    expect(both).toBe(0);
    expect(crossedA && crossedB).toBe(true);
  });

  test('two cars coming the two ways of one road through a junction cross together, neither waiting', () => {
    const traffic = new LaneTraffic(1), road = way(-150, 0, 150, 0, 1, 12, [1, 2], 7);
    const east = traffic.add(road, false, 100, 0, length, 1, 1)!, west = traffic.add(road, true, 100, 0, length, 1, 2)!;
    let waited = 0;
    run(traffic, 15, () => { if (east.waiting >= 0 || west.waiting >= 0) waited++; });
    expect(waited).toBe(0);
    expect(east.s).toBeGreaterThan(160);
    expect(west.s).toBeGreaterThan(160);
  });

  test('every car faces the way it moves, home or away, and cars coming the other way pass', () => {
    const traffic = new LaneTraffic(1), road = way(0, 0, 300, 120, 1, 12, [1, 2], -1);
    const out = traffic.add(road, false, 0, 0, length, 1, 1)!;
    const home = traffic.add(road, true, 0, 0, length, 1, 2)!;
    const before = { x: 0, z: 0, dx: 0, dz: 0 }, after = { x: 0, z: 0, dx: 0, dz: 0 };
    run(traffic, 20, () => {
      for (const car of [out, home]) {
        traffic.pose(car, before);
        traffic.step(0.05);
        traffic.pose(car, after);
        const mx = after.x - before.x, mz = after.z - before.z;
        if (Math.hypot(mx, mz) > 1e-4) expect(mx * after.dx + mz * after.dz).toBeGreaterThan(0);
      }
    }, 0.5);
    // ... and each kept going: neither stood waiting for the other on their two ways of the road
    expect(out.s).toBeGreaterThan(200);
    expect(home.s).toBeGreaterThan(200);
  });

  test('a car is put on the road only where its lane is clear', () => {
    const traffic = new LaneTraffic(1), road = way(0, 0, 600, 0, 1, 12, [1, 2], -1);
    expect(traffic.add(road, false, 50, 0, length, 1, 1)).not.toBeNull();
    traffic.step(0.01);
    expect(traffic.add(road, false, 52, 0, length, 1, 2)).toBeNull();
    expect(traffic.add(road, false, 70, 0, length, 1, 3)).not.toBeNull();
  });

  test("a car's place on its segment is where it is along its way, on every piece of a long way far from the start of the map", () => {
    const graph = new RoadGraph();
    graph.add({ from: [3000, 2000], to: [3400, 2000], level: 2 });
    graph.add({ from: [3400, 2000], to: [3400, 2600], level: 2 });
    graph.add({ from: [3400, 2600], to: [2900, 2900], level: 2 });
    const ids = [...graph.segments.keys()];
    for (const rev of [false, true]) {
      const way = lanePathOf(graph, ids, 0, 1, 10 / 16)!.path, traffic = new LaneTraffic(10 / 16);
      for (let s = 3; s < way.total - 3; s += 37) {
        const car = traffic.add(way, rev, s, 0, 2, 1, 1)!;
        const p = way.pieces[car.piece], d = rev ? way.total - s : s;
        const fromWayStart = p.entry + (d - p.start), expected = rev ? p.length - fromWayStart : fromWayStart;
        expect((traffic as unknown as { u(c: LaneCar, p: LanePiece): number }).u(car, p)).toBeCloseTo(expected, 1);
        traffic.remove(car);
      }
    }
  });
});
