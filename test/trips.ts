/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Trips on the road graph (src/sim/trips.ts, docs/NO_GRID_PLAN.md 1.2): the homes' cars go to the jobs and shops by the
// quickest way, a road fills and the later trips go round it, a home with no way to work is told so, and the same
// month makes the same trips.

import { roadCapacity, roadSpeed } from "../src/roadLevels";
import { RoadGraph } from "../src/roads/roadGraph";
import { buildRoadNet } from "../src/sim/roadNetwork";
import { monthTrips, segmentSeconds, type TripNet, type TripPlaces, TRIP_MINUTES } from "../src/sim/trips";

/** The trips' view of a graph, each road at the level it was drawn */
function netOf(graph: RoadGraph): { net: TripNet; index: (id: number) => number } {
  const roads = buildRoadNet(graph), m = roads.segmentIds.length;
  const speed = new Float64Array(m), capacity = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    const level = graph.segment(roads.segmentIds[k]).level;
    speed[k] = roadSpeed(level); capacity[k] = roadCapacity(level);
  }
  return { net: { offsets: roads.offsets, wayTo: roads.wayTo, waySegment: roads.waySegment, segA: roads.segA, segB: roads.segB,
    length: roads.length, speed, capacity }, index: (id) => roads.segmentIndex.get(id)! };
}

/** Places: homes (segment index, t, cars) and jobs (segment index, t, jobs, shops) */
function placesOf(homes: Array<[number, number, number]>, jobs: Array<[number, number, number, number]>): TripPlaces {
  return {
    homeTile: Int32Array.from(homes, (_, i) => i), homeSegment: Int32Array.from(homes, (h) => h[0]),
    homeT: Float32Array.from(homes, (h) => h[1]), homeCars: Float32Array.from(homes, (h) => h[2]),
    jobTile: Int32Array.from(jobs, (_, i) => 1000 + i), jobSegment: Int32Array.from(jobs, (j) => j[0]),
    jobT: Float32Array.from(jobs, (j) => j[1]), jobs: Float32Array.from(jobs, (j) => j[2]), shops: Float32Array.from(jobs, (j) => j[3]),
  };
}

/** Ten streets of homes meeting at H, a straight road to the jobs' street at J, and a longer way round */
function twoWays() {
  const g = new RoadGraph(), streets: number[] = [];
  for (let i = 0; i < 10; i++) streets.push(g.add({ from: [-300, -200 + 40 * i], to: [0, 0], level: 2 }).segments[0]);
  const near = g.add({ from: [0, 0], to: [2000, 0], level: 2 }).segments[0];
  const round = [...g.add({ from: [0, 0], to: [1000, 600], level: 2 }).segments, ...g.add({ from: [1000, 600], to: [2000, 0], level: 2 }).segments];
  const jobs = g.add({ from: [2000, 0], to: [2200, 0], level: 2 }).segments[0];
  return { g, streets, near, round, jobs };
}

describe("trips on the road graph", () => {
  test("a few cars all take the quicker road", () => {
    const { g, streets, near, round, jobs } = twoWays(), { net, index } = netOf(g);
    const places = placesOf(streets.map((s) => [index(s), 0.5, 10]), [[index(jobs), 0.5, 1000, 0]]);
    const trips = monthTrips({ net, places, seed: 1 });
    expect(trips.cars[index(near)]).toBeCloseTo(100 * 0.7, 3);
    for (const s of round) expect(trips.cars[index(s)]).toBe(0);
    // ... and every home is a few minutes from work
    for (const m of trips.homeToWork) expect(m).toBeLessThan(5);
    expect(trips.routes.length).toBeGreaterThan(0);
  });

  test("the quicker road fills first, and once it is slow the later trips go the longer way round", () => {
    const { g, streets, near, round, jobs } = twoWays(), { net, index } = netOf(g);
    const places = placesOf(streets.map((s) => [index(s), 0.5, 400]), [[index(jobs), 0.5, 1000, 0]]);
    const trips = monthTrips({ net, places, seed: 1 });
    const onNear = trips.cars[index(near)], onRound = trips.cars[index(round[0])];
    expect(onNear + onRound).toBeCloseTo(4000 * 0.7, 1);
    // The near road carries more than it takes before it slows, and the rest go round
    expect(onNear).toBeGreaterThan(roadCapacity(2));
    expect(onRound).toBeGreaterThan(0);
    // ... until the two ways take about as long
    const nearTime = trips.seconds[index(near)], roundTime = trips.seconds[index(round[0])] + trips.seconds[index(round[1])];
    expect(Math.abs(nearTime - roundTime) / roundTime).toBeLessThan(0.35);
    expect(nearTime).toBeGreaterThan(segmentSeconds(net, index(near), 0) * 1.1);
  });

  test("a home with no road to any job is cut off; with no jobs anywhere it is only early", () => {
    const { g, streets, jobs } = twoWays();
    const island = g.add({ from: [5000, 5000], to: [5200, 5000], level: 2 }).segments[0], { net, index } = netOf(g);
    const cut = monthTrips({ net, places: placesOf([[index(island), 0.5, 10], [index(streets[0]), 0.5, 10]], [[index(jobs), 0.5, 100, 100]]), seed: 3 });
    expect(cut.homeToWork[0]).toBe(Infinity);
    expect(cut.homeToWork[1]).toBeLessThan(5);
    expect(cut.anyJobs).toBe(true);
    const none = monthTrips({ net, places: placesOf([[index(streets[0]), 0.5, 10]], []), seed: 3 });
    expect(none.anyJobs).toBe(false);
    expect(none.homeToWork[0]).toBe(Infinity);
    // ... and a job further than the trips go is out of reach
    const far = new RoadGraph(), long = far.add({ from: [0, 0], to: [60000, 0], level: 2 }).segments[0];
    const home = far.add({ from: [0, 0], to: [-100, 0], level: 2 }).segments[0], work = far.add({ from: [60000, 0], to: [60100, 0], level: 2 }).segments[0];
    const f = netOf(far);
    expect(long).toBeGreaterThan(0);
    const away = monthTrips({ net: f.net, places: placesOf([[f.index(home), 0.5, 10]], [[f.index(work), 0.5, 100, 0]]), seed: 3 });
    expect(away.homeToWork[0]).toBe(Infinity);
    expect(60000 / roadSpeed(2) / 60).toBeGreaterThan(TRIP_MINUTES);
  });

  test("the same month makes the same trips; another month's number chooses again", () => {
    const { g, streets, jobs } = twoWays();
    const shops = g.add({ from: [0, 0], to: [0, -400], level: 2 }).segments[0], { net, index } = netOf(g);
    const places = placesOf(streets.map((s, i) => [index(s), 0.2 + i * 0.05, 200]), [[index(jobs), 0.5, 1000, 300], [index(shops), 0.7, 200, 600]]);
    const a = monthTrips({ net, places, seed: 42 }), b = monthTrips({ net, places, seed: 42 }), c = monthTrips({ net, places, seed: 43 });
    const sum = (t: typeof a) => JSON.stringify({ cars: Array.from(t.cars), routes: t.routes.map((r) => [r.fromSegment, r.toSegment, Array.from(r.segments), r.cars]) });
    expect(sum(a)).toBe(sum(b));
    expect(sum(a)).not.toBe(sum(c));
    // Shoppers go to the shops; everyone gets somewhere
    expect(a.routes.some((r) => r.purpose === 1 && r.toSegment === index(shops))).toBe(true);
    expect(a.routes.reduce((s, r) => s + r.cars, 0)).toBeCloseTo(2000, 1);
  });
});

describe("a city's trips, month by month (src/sim/cityTrips.ts)", () => {
  /** The Khon Kaen city a year in (test/fixtures/khonKaen-v5.json), opened as the game opens a save */
  function opened(withTrips = true) {
    const fs = require("fs");
    const { CityCore } = require("../src/core/cityCore");
    const { decodeMap } = require("../src/cityStorage");
    const { GameMap } = require("../src/gameMap.js");
    const { Storage } = require("../src/storage.js");
    const save = JSON.parse(fs.readFileSync("test/fixtures/khonKaen-v5.json", "utf8"));
    save.map = decodeMap(save.mapRle);
    delete save.mapRle;
    if (save.version !== Storage.CURRENT_VERSION) Storage.transitionOldSave(save);
    const core = new CityCore({ map: new GameMap(save.width, save.height), saved: save });
    if (!withTrips) {
      const systems = (core as any).systems as Array<{ name: string }>;
      systems.splice(systems.findIndex((s) => s.name === "trips"), 1);
    }
    return core;
  }

  test("set going at a month's start and in the city half a month later, the same each time, changing nothing else yet", () => {
    // The cities run one after the other: they share the game's one Random, which each takes up from its save
    const tiles = (core: any) => { const out: number[] = []; for (let y = 0; y < core.map.height; y++) for (let x = 0; x < core.map.width; x++) out.push(core.map.getTileValue(x, y)); return out.join(","); };
    const play = (withTrips: boolean) => {
      const core = opened(withTrips);
      let started = -1;
      core.on("month", () => { if (started < 0) started = core.steps; });
      while (started < 0) core.step();
      for (let k = 0; k < 31; k++) core.step();
      const before = core.map.trips ?? null;
      core.step();
      const trips = core.map.trips ?? null;
      for (let k = 0; k < 64 * 2; k++) core.step();
      return { started, before, trips, tiles: tiles(core) };
    };
    const a = play(true), b = play(true), c = play(false);
    expect(a.before).toBeNull();
    const trips = a.trips;
    expect(trips.step).toBe(a.started + 32);
    expect(trips.result.routes.length).toBeGreaterThan(0);
    // Each home tile knows how far work is
    for (let i = 0; i < trips.places.homeTile.length; i++) {
      if (trips.result.anyJobs) expect(Number.isNaN(trips.homeToWork[trips.places.homeTile[i]])).toBe(false);
    }
    expect(trips.places.homeTile.length).toBeGreaterThan(0);
    expect(JSON.stringify(Array.from(b.trips.result.cars))).toBe(JSON.stringify(Array.from(trips.result.cars)));
    // ... and the city without them grew just the same (step 1.2 does not change the growth yet)
    expect(a.tiles).toBe(b.tiles);
    expect(a.tiles === c.tiles).toBe(true);
  }, 180000);
});
