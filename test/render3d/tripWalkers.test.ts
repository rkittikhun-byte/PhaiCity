/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The people walking the pavements (src/render3d/city/tripWalkers.ts; owner, 23 Oct 2026: "ทุก object ที่เกิดขึ้น ต้องมีที่มา
// และที่ไป ไม่ใช่เดินมั่วๆ"): each walks from a home of the month's trips to a workplace or shop near it, or home again,
// along the pavement beside the road, facing the way it walks, and is gone once it gets there.

import { TripWalkers } from '../../src/render3d/city/tripWalkers.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';
import { buildRoadNet } from '../../src/sim/roadNetwork.js';

const U = 10 / 16;

/** A street 600 m long with homes near one end and a workplace 250 m along it */
function street() {
  const graph = new RoadGraph();
  graph.add({ from: [100, 200], to: [700, 200], level: 2 });
  const roads = buildRoadNet(graph), k = roads.segmentIndex.get([...graph.segments.keys()][0])!;
  const width = 60;
  const tile = (x: number, z: number) => Math.floor(z / 16) * width + Math.floor(x / 16);
  const places = {
    homeTile: Int32Array.from([tile(150, 215), tile(170, 215)]), homeSegment: Int32Array.from([k, k]),
    homeT: Float32Array.from([0.1, 0.12]), homeCars: Float32Array.from([400, 400]),
    jobTile: Int32Array.from([tile(400, 185)]), jobSegment: Int32Array.from([k]), jobT: Float32Array.from([0.5]),
    jobs: Float32Array.from([300]), shops: Float32Array.from([0]),
  };
  const trips = { roads, places, result: { routes: [] } } as never;
  return { map: { width, height: 40, tileSizeM: 16, roadGraph: graph, trips }, places };
}

describe('the walks of the city', () => {
  test('people walk from a home to a workplace near it, or home again, on the pavement, facing the way they walk', () => {
    const { map, places } = street(), walkers = new TripWalkers(map, U);
    walkers.hour = () => 7.5;
    const seen = new Map<number, { x: number; z: number }>();
    let steps = 0, back = 0, arrived = 0;
    const ids = new Set<number>();
    for (let t = 0; t < 400; t += 0.2) {
      walkers.update(250, 125, 300, t);
      for (const w of walkers.walkers) ids.add(w.id);
      walkers.each(-1e9, 1e9, -1e9, 1e9, (w, x, z, heading) => {
        const was = seen.get(w.id);
        // on the pavement: off the road's middle (z 125 world units) by more than the road's half width
        expect(Math.abs(z - 200 * U)).toBeGreaterThan(3 * U);
        if (was) {
          const mx = x - was.x, mz = z - was.z;
          if (Math.hypot(mx, mz) > 1e-4) { steps++; if (mx * Math.sin(heading) + mz * Math.cos(heading) <= 0) back++; }
        }
        seen.set(w.id, { x, z });
        // its walk: a home of the city and its workplace
        const home = w.trip.homeward ? w.trip.to : w.trip.from, there = w.trip.homeward ? w.trip.from : w.trip.to;
        expect([...places.homeTile]).toContain(home.tile);
        expect(there.tile).toBe(places.jobTile[0]);
        expect(there.kind).toBe('work');
      });
      for (const id of [...seen.keys()]) if (!walkers.walkers.some(w => w.id === id)) { seen.delete(id); arrived++; }
    }
    expect(ids.size).toBeGreaterThan(5);
    expect(steps).toBeGreaterThan(100);
    expect(back).toBe(0);
    // ... and they get there and go in
    expect(arrived).toBeGreaterThan(3);
  });

  test('no walks where nothing to walk to is near enough, and fewer at night', () => {
    const { map } = street(), walkers = new TripWalkers(map, U);
    walkers.hour = () => 7.5;
    for (let t = 0; t < 60; t += 0.2) walkers.update(250, 125, 300, t);
    const rush = walkers.walkers.length;
    const night = new TripWalkers(street().map, U);
    night.hour = () => 2;
    for (let t = 0; t < 60; t += 0.2) night.update(250, 125, 300, t);
    expect(night.walkers.length).toBeLessThan(rush);
    const far = street();
    far.places.jobSegment[0] = -1;
    const none = new TripWalkers(far.map, U);
    for (let t = 0; t < 30; t += 0.2) none.update(250, 125, 300, t);
    expect(none.walkers.length).toBe(0);
  });
});
