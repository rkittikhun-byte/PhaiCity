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
import type { RoadNet } from "./roadNetwork";
import { tripNet, type TripMap, tripPlaces } from "./tripPlaces";
import { monthTrips, type TripJob, type TripPlaces, type TripResult } from "./trips";
import { isCityTileSize } from "../units";

/** Steps from a month's start to when its trips come into the city: half a month (docs/NO_GRID_PLAN.md 4.6) */
export const TRIPS_LAG = 32;

/** What the month's trips found, as the city reads it */
export interface CityTrips {
  /** The road graph's arrays the trips were found on (segment indices are theirs) and its version then */
  roads: RoadNet;
  places: TripPlaces;
  result: TripResult;
  /** The step they came into the city at */
  step: number;
  /** Minutes from each home tile to work, and from each shop or factory tile to the nearest home (NaN where no place
   * of its kind is, Infinity where it cannot get there), by tile index */
  homeToWork: Float32Array;
  jobToHome: Float32Array;
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
  step(map: { trips?: CityTrips | null; width: number; height: number }, step: number): void {
    const pending = this.pending;
    if (!pending || step < pending.at) return;
    this.pending = null;
    const result = pending.result ?? monthTrips(pending.job);
    const size = map.width * map.height, homeToWork = new Float32Array(size).fill(NaN), jobToHome = new Float32Array(size).fill(NaN);
    const p = pending.places;
    for (let i = 0; i < p.homeTile.length; i++) homeToWork[p.homeTile[i]] = result.anyJobs ? result.homeToWork[i] : NaN;
    for (let i = 0; i < p.jobTile.length; i++) jobToHome[p.jobTile[i]] = result.anyHomes ? result.jobToHome[i] : NaN;
    map.trips = { roads: pending.roads, places: p, result, step, homeToWork, jobToHome };
  }
}
