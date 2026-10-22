/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A city's trips, month by month (docs/NO_GRID_PLAN.md 1.2, 4.6): at the start of each month the trips are set going from
// the city as it is then (src/sim/tripPlaces.ts, src/sim/trips.ts), and what they found comes into the city half a month
// later (TRIPS_LAG steps), whether they were worked out at once (Node: tests, the auto player, a server) or in a worker
// (the browser, step 1.4): so the city is the same everywhere. Only on a real-scale city map, whose every road is in the
// road graph (src/roads/roadCover.ts). What the trips found is the map's `trips` (CityTrips), which the simulation and the
// 3D view only read, and which a save does not keep: an opened city works them out again in its first month.

import { mix } from "./agentRandom";
import { Random } from "../random";
import type { RoadGraph } from "../roads/roadGraph";
import type { RoadNet } from "./roadNetwork";
import { segmentShape } from "./roadUpkeep";
import { tripNet, type TripMap, tripPlaces } from "./tripPlaces";
import { monthTrips, type TripJob, type TripNet, type TripPlaces, type TripResult } from "./trips";
import { isCityTileSize } from "../units";

/** Steps from a month's start to when its trips come into the city: half a month (docs/NO_GRID_PLAN.md 4.6) */
export const TRIPS_LAG = 32;

/** What the month's trips found, as the city reads it */
export interface CityTrips {
  /** The road graph's arrays the trips were found on (segment indices are theirs) and its version then */
  roads: RoadNet;
  /** The roads as the trips saw them: each one's speed and the cars it takes */
  net: TripNet;
  places: TripPlaces;
  result: TripResult;
  /** The step they came into the city at */
  step: number;
  /** Minutes from each home tile to work, and from each shop or factory tile to the nearest home (NaN where no place
   * of its kind is, Infinity where it cannot get there), by tile index */
  homeToWork: Float32Array;
  jobToHome: Float32Array;
  /** The traffic each road tile shows the old readers (0-240, src/traffic.js's scale, trafficOf), the busiest road
   * through it: tile indices and their traffic (paintTraffic) */
  trafficTiles: Int32Array;
  traffic: Uint8Array;
  /** How full each road tile's fullest road is (its cars over what it takes, 0 for a road no trip takes), for the
   * traffic layer (src/cityMap.ts): tile indices and fullness */
  roadTiles: Int32Array;
  roadFull: Float32Array;
}

/** Cars an hour that make a road's traffic heavy on the old scale (200 of 240), whatever its size: the old readers
 * weigh traffic by its cars (src/blockMapUtils.js: a tile of light traffic gives pollution 50, of heavy 75) */
export const HEAVY_CARS = 1500;
/** A road this full (cars over what it takes) starts to jam, and its jam counts as heavy traffic when it is full by a
 * fifth more */
const JAM_FROM = 0.8, JAM_SPAN = 0.4;

/** The traffic a road shows on the old 0-240 scale (src/traffic.js, src/road.js): by its cars, or by its jam when it is
 * fuller than JAM_FROM (a jammed laterite track is as bad as a busy highway) */
export function trafficOf(cars: number, capacity: number): number {
  const full = cars / Math.max(1, capacity), jam = full > JAM_FROM ? (full - JAM_FROM) / JAM_SPAN : 0;
  return Math.min(240, Math.round(200 * Math.max(cars / HEAVY_CARS, jam)));
}

/** Works a month's trips out: at once (the default), or somewhere else (a worker) as long as it gives the same */
export interface TripRunner {
  /** Starts a month's job; `done` is called with what it found, perhaps later */
  start(job: TripJob, done: (result: TripResult) => void): void;
}

const atOnce: TripRunner = { start: (job, done) => done(monthTrips(job)) };

/** The month's number for the trips, from the city's Random as it stands, without drawing from it, so the rest of the
 * city's luck goes on as it would have without the trips */
export function tripsSeed(month: number): number {
  return mix(Random.getState(), month);
}

/** The core's part: a month's trips set going, and brought into the city TRIPS_LAG steps later */
export class TripSystem {
  private pending: { at: number; roads: RoadNet; places: TripPlaces; result: TripResult | null; job: TripJob } | null = null;

  constructor(private readonly runner: TripRunner = atOnce) {}

  /** At a month's start: the city's trips set going (the step it is at, the month's count) */
  monthly(map: TripMap & { trips?: CityTrips | null; width: number; height: number }, step: number, month: number,
    riders?: (x: number, y: number) => number, weather = 1): void {
    const graph = map.roadGraph;
    if (!isCityTileSize(map.tileSizeM) || !graph || !graph.segments.size) {
      this.pending = null;
      map.trips = null;
      return;
    }
    const { net, roads } = tripNet(map, graph);
    const places = tripPlaces(map, roads, riders);
    const job: TripJob = { net, places, seed: tripsSeed(month), weather };
    const pending = { at: step + TRIPS_LAG, roads, places, result: null as TripResult | null, job };
    this.pending = pending;
    this.runner.start(job, (result) => { if (this.pending === pending) pending.result = result; });
  }

  /** After each step: the trips come into the city once their step has come (worked out here if they are not back) */
  step(map: { trips?: CityTrips | null; width: number; height: number; tileSizeM?: number | null; roadGraph?: RoadGraph | null },
    step: number): void {
    const pending = this.pending;
    if (!pending || step < pending.at) return;
    this.pending = null;
    const result = pending.result ?? monthTrips(pending.job);
    const size = map.width * map.height, homeToWork = new Float32Array(size).fill(NaN), jobToHome = new Float32Array(size).fill(NaN);
    const p = pending.places;
    for (let i = 0; i < p.homeTile.length; i++) homeToWork[p.homeTile[i]] = result.anyJobs ? result.homeToWork[i] : NaN;
    for (let i = 0; i < p.jobTile.length; i++) jobToHome[p.jobTile[i]] = result.anyHomes ? result.jobToHome[i] : NaN;
    // Each road tile's traffic, the busiest road through it, for the old readers (pollution, the tiles' traffic, tolls)
    const busiest = new Map<number, number>(), fullest = new Map<number, number>(), graph = map.roadGraph, net = pending.job.net;
    const raster = { width: map.width, height: map.height, tileSizeM: map.tileSizeM ?? 16 };
    for (let k = 0; k < result.cars.length; k++) {
      const segment = graph?.segments.get(pending.roads.segmentIds[k]);
      if (!segment || !graph) continue;
      const value = trafficOf(result.cars[k], net.capacity[k]), full = result.cars[k] / Math.max(1, net.capacity[k]);
      for (const i of segmentShape(graph, segment, raster).tiles) {
        if (value && (busiest.get(i) ?? 0) < value) busiest.set(i, value);
        if ((fullest.get(i) ?? -1) < full) fullest.set(i, full);
      }
    }
    const order = [...busiest.keys()].sort((a, b) => a - b), roads = [...fullest.keys()].sort((a, b) => a - b);
    map.trips = { roads: pending.roads, net, places: p, result, step, homeToWork, jobToHome,
      trafficTiles: Int32Array.from(order), traffic: Uint8Array.from(order, (i) => busiest.get(i)!),
      roadTiles: Int32Array.from(roads), roadFull: Float32Array.from(roads, (i) => fullest.get(i)!) };
  }
}

/**
 * The traffic density map the old readers use (src/traffic.js's 0-240 a block of tiles: the road tiles' traffic looks,
 * the pollution of traffic, the evaluation, the tolls, the helicopter) painted from the month's trips, the busiest road
 * tile of each block (docs/NO_GRID_PLAN.md 1.3); false where the city's trips do not paint it (not a real-scale city
 * map), whose map the random walks of src/traffic.js fill and each cycle takes down (blockMapUtils.js)
 */
export function paintTraffic(map: { width: number; tileSizeM?: number | null; roadGraph?: RoadGraph | null; trips?: CityTrips | null },
  density: { clear(): void; worldGet(x: number, y: number): number; worldSet(x: number, y: number, value: number): void }): boolean {
  if (!isCityTileSize(map.tileSizeM) || !map.roadGraph?.segments.size) return false;
  density.clear();
  const trips = map.trips;
  if (!trips) return true;
  for (let n = 0; n < trips.trafficTiles.length; n++) {
    const i = trips.trafficTiles[n], x = i % map.width, y = (i - x) / map.width;
    if (density.worldGet(x, y) < trips.traffic[n]) density.worldSet(x, y, trips.traffic[n]);
  }
  return true;
}

/** What the month's trips make of a road (the inspector's card, src/inspect.ts) */
export interface RoadTrips {
  /** Cars on it in the busiest hour, both ways, and the cars it takes before it slows */
  cars: number;
  capacity: number;
  /** How fast its cars go now, and on it clear (km/h) */
  speedKmh: number;
  clearKmh: number;
  /** The roads of homes whose trips use it, and the share of its cars going to work and to the shops (0-100) */
  homes: number;
  work: number;
  shop: number;
}

/** The routes along each road, by its index, worked out once for each month's trips */
const routesBy = new WeakMap<CityTrips, Map<number, number[]>>();

/** What the month's trips make of the road at (x, z) metres, within a tile of it, or null (no road there, no trips yet,
 * or a road drawn since the month's trips set out) */
export function roadTrips(trips: CityTrips | null | undefined, graph: RoadGraph | null | undefined, x: number, z: number,
  tileSizeM: number): RoadTrips | null {
  if (!trips || !graph) return null;
  const near = graph.nearest([x, z], tileSizeM);
  const k = near ? trips.roads.segmentIndex.get(near.segment) : undefined;
  if (k === undefined) return null;
  let by = routesBy.get(trips);
  if (!by) {
    routesBy.set(trips, by = new Map());
    trips.result.routes.forEach((route, r) => {
      for (const s of route.segments) {
        let list = by!.get(s);
        if (!list) by!.set(s, list = []);
        if (list[list.length - 1] !== r) list.push(r);
      }
    });
  }
  const routes = (by.get(k) ?? []).map((r) => trips.result.routes[r]);
  const total = routes.reduce((sum, r) => sum + r.cars, 0), work = routes.filter((r) => r.purpose === 0).reduce((sum, r) => sum + r.cars, 0);
  const length = trips.net.length[k], seconds = trips.result.seconds[k];
  return {
    cars: Math.round(trips.result.cars[k]), capacity: Math.round(trips.net.capacity[k]),
    speedKmh: Math.round(seconds > 0 ? length / seconds * 3.6 : trips.net.speed[k] * 3.6), clearKmh: Math.round(trips.net.speed[k] * 3.6),
    homes: new Set(routes.map((r) => r.fromSegment)).size,
    work: total > 0 ? Math.round(work / total * 100) : 0, shop: total > 0 ? 100 - Math.round(work / total * 100) : 0,
  };
}
