/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The people walking the pavements (owner, 23 Oct 2026: "ทุกอย่าง ทุก object ที่เกิดขึ้น ต้องมีที่มาและที่ไป ไม่ใช่เดินมั่วๆ"):
// each is on a short walk of the city's own, from a home of the month's trips (src/sim/trips.ts places) to a workplace
// or a shop near enough to walk to (WALK_REACH_M), or home again in the evening, along the pavement beside the roads of
// the way between them (the road graph's shortest way, tripCars.ts lanePathOf). A walker comes out at the frontage of
// where it starts and goes in at where it ends; it faces the way it walks and steps as far as it walks
// (pedestrians.ts WALK_STRIDE_M); it carries its walk (WalkTrip) for the inspector. More walk in the rush hours. It only
// reads the city; pedestrians.ts draws them with the concept-sheet people.

import { wayBetween } from './graphPaths.js';
import { type LanePath, walkPose } from './laneTraffic.js';
import { hourShare, lanePathOf, outShare } from './tripCars.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import type { CityTrips } from '../../sim/cityTrips.js';

/** The farthest a walk goes (metres, as the crow flies), how fast people walk (m/s), and the most walking at once */
export const WALK_REACH_M = 450;
export const WALK_SPEED_MS = 1.1;
export const MAX_WALKERS = 90;
/** Walkers a home sends in the busiest hour, for each car it sends */
const WALKERS_A_CAR = 0.04;
/** How far beside the road's edge the pavement's middle is (m) */
const PAVEMENT_M = 1.3;

/** A walk: where from and to (the buildings' tile indices and what they are), why, and whether it is the way home */
export interface WalkTrip {
  readonly from: { readonly tile: number; readonly kind: 'home' | 'work' | 'shop' };
  readonly to: { readonly tile: number; readonly kind: 'home' | 'work' | 'shop' };
  readonly purpose: number;
  readonly homeward: boolean;
}

export interface Walker {
  readonly id: number;
  readonly path: LanePath;
  /** Walking the way backwards (from its end), which side of the road (1 left of the way it walks, -1 right) */
  readonly rev: boolean;
  readonly side: number;
  /** How far it has walked (world units) */
  s: number;
  readonly speed: number;
  readonly trip: WalkTrip;
  /** Its look among the people (pedestrians.ts placeWalker's who) */
  readonly who: number;
}

export interface TripWalkersMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadGraph?: RoadGraph | null;
  readonly trips?: CityTrips | null;
}

function hash01(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export class TripWalkers {
  readonly walkers: Walker[] = [];
  private nextId = 1;
  private made = 0;
  private builtFor: CityTrips | null = null;
  private builtVersion = -1;
  /** The places' world positions (tile middles): homes and workplaces or shops */
  private homes: Array<{ i: number; x: number; z: number }> = [];
  private dests: Array<{ i: number; x: number; z: number }> = [];
  private readonly ways = new Map<string, LanePath | null>();
  private lastSeconds: number | null = null;
  private readonly at = { x: 0, z: 0, dx: 0, dz: 1 };
  /** The game's hour (0-24), set by the city view */
  hour: () => number = () => 12;

  /** units: world units a metre */
  constructor(private readonly map: TripWalkersMap, private readonly units: number) {}

  get active(): boolean { return Boolean(this.map.trips && this.map.roadGraph?.segments.size); }

  private build(trips: CityTrips, graph: RoadGraph): void {
    this.builtFor = trips; this.builtVersion = graph.version; this.ways.clear();
    const pl = trips.places, w = this.map.width, place = (tile: number) => ({ x: (tile % w + 0.5) * 10, z: (Math.floor(tile / w) + 0.5) * 10 });
    this.homes = []; this.dests = [];
    for (let i = 0; i < pl.homeTile.length; i++) if (pl.homeCars[i] > 0 && pl.homeSegment[i] >= 0) this.homes.push({ i, ...place(pl.homeTile[i]) });
    for (let i = 0; i < pl.jobTile.length; i++) if ((pl.jobs[i] > 0 || pl.shops[i] > 0) && pl.jobSegment[i] >= 0) this.dests.push({ i, ...place(pl.jobTile[i]) });
  }

  /** The way between a home and a destination along the roads, made once (null where there is none) */
  private wayOf(home: number, dest: number): LanePath | null {
    const key = `${home}:${dest}`;
    if (this.ways.has(key)) return this.ways.get(key)!;
    const trips = this.map.trips!, graph = this.map.roadGraph!, pl = trips.places, ids = trips.roads.segmentIds;
    const metre = (seg: number, t: number): [number, number] => graph.pointAt(ids[seg], t);
    const from = metre(pl.homeSegment[home], pl.homeT[home]), to = metre(pl.jobSegment[dest], pl.jobT[dest]);
    const way = wayBetween(graph, from, to, this.units, 2);
    const path = way?.segments ? lanePathOf(graph, way.segments, way.fromT ?? 0, way.toT ?? 1, this.units)?.path ?? null : null;
    if (this.ways.size > 2000) this.ways.clear();
    this.ways.set(key, path);
    return path;
  }

  /** Moves the walks on to `seconds` and sends new ones round the camera's target (within span, world units) */
  update(tx: number, tz: number, span: number, seconds: number): void {
    const trips = this.map.trips, graph = this.map.roadGraph;
    if (!trips || !graph) { this.walkers.length = 0; return; }
    if (trips !== this.builtFor || graph.version !== this.builtVersion) {
      if (graph.version !== this.builtVersion) this.walkers.length = 0;
      this.build(trips, graph);
    }
    const dt = this.lastSeconds === null ? 0 : Math.max(0, Math.min(0.25, seconds - this.lastSeconds));
    this.lastSeconds = seconds;
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      w.s += w.speed * dt;
      if (w.s >= w.path.total) this.walkers.splice(i, 1);
    }
    // How many walk round here now: by the homes in sight, their cars and the hour
    const hour = this.hour(), busy = hourShare(hour), out = outShare(hour), pl = trips.places;
    const near = this.homes.filter(h => Math.abs(h.x - tx) < span && Math.abs(h.z - tz) < span);
    if (!near.length) return;
    let want = 0;
    for (const h of near) want += pl.homeCars[h.i];
    want = Math.min(MAX_WALKERS, Math.round(want * WALKERS_A_CAR * busy));
    const reach = WALK_REACH_M * this.units;
    // a few new walks a frame while there are fewer than there should be
    for (let tries = 0; tries < 3 && this.walkers.length < want; tries++) {
      const serial = this.made++, home = near[Math.floor(hash01(serial, 1, 21) * near.length)];
      const close = this.dests.filter(d => Math.hypot(d.x - home.x, d.z - home.z) < reach);
      if (!close.length) continue;
      const dest = close[Math.floor(hash01(serial, 2, 21) * close.length)];
      const path = this.wayOf(home.i, dest.i);
      if (!path || path.total < 4 * this.units) continue;
      const rev = hash01(serial, 3, 21) >= out, shop = pl.shops[dest.i] > pl.jobs[dest.i];
      const homePlace = { tile: pl.homeTile[home.i], kind: 'home' as const }, there = { tile: pl.jobTile[dest.i], kind: (shop ? 'shop' : 'work') as 'shop' | 'work' };
      this.walkers.push({ id: this.nextId++, path, rev, side: hash01(serial, 4, 21) < 0.5 ? 1 : -1, s: 0,
        speed: WALK_SPEED_MS * this.units * (0.85 + hash01(serial, 5, 21) * 0.3),
        trip: { from: rev ? there : homePlace, to: rev ? homePlace : there, purpose: shop ? 1 : 0, homeward: rev },
        who: 200000 + (serial % 5000) });
    }
  }

  /** Each walker in sight: its place on the pavement (world units), the way it faces and how far it has walked */
  each(x0: number, x1: number, z0: number, z1: number, draw: (w: Walker, x: number, z: number, heading: number) => void): void {
    for (const w of this.walkers) {
      const p = w.path.pieces[0];
      const offset = w.side * ((p?.laneWidth ?? 3 * this.units) + PAVEMENT_M * this.units);
      walkPose(w.path, w.rev ? w.path.total - w.s : w.s, w.rev, offset, this.at);
      if (this.at.x < x0 || this.at.x > x1 || this.at.z < z0 || this.at.z > z1) continue;
      draw(w, this.at.x, this.at.z, Math.atan2(this.at.dx, this.at.dz));
    }
  }

  /** The walker nearest (x, z) within reach and its walk, for the inspector */
  tripAt(x: number, z: number, reach: number): Walker | null {
    let best: Walker | null = null, bestD = reach;
    this.each(x - reach, x + reach, z - reach, z + reach, (w, wx, wz) => {
      const d = Math.hypot(wx - x, wz - z);
      if (d < bestD) { bestD = d; best = w; }
    });
    return best;
  }
}

