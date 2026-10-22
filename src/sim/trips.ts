/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Trips on the road graph (docs/NO_GRID_PLAN.md step 1.2): a month's commuters and shoppers, from the homes to the jobs
// and the shops, each on its way along the roads as drawn. The original game sent a car on a random walk of at most
// 30 tiles from a zone and counted the roads it passed; here the trips are found as Cities: Skylines finds them:
//
//   homes (people)  ─ a destination for each, by its pull over the time it takes to get there (gravity) ─►  jobs, shops
//   the way there: the quickest by the roads' times, each road's time its length over its speed, slowed by its cars
//   (the traffic engineers' BPR curve: 1 + 0.15 (cars / capacity)^4)
//
// Trips are gathered by the road a group of homes lies on (a group goes to a few destinations, not each person to one),
// so a town of thousands of homes is a few hundred groups. The groups set out one after another in an order drawn
// afresh each month, each finding its way with the cars of those before it already on the roads, so a road fills and
// the later ones go round it: the jams come where the roads are too few, and settle there rather than swinging from
// one road to another month to month. Each group's numbers come from the month's number and the road's index
// (src/sim/agentRandom.ts), so adding a home changes no other group's trips. Only + - * / and square roots
// are used in what decides a trip, which every JavaScript engine works out alike, so the browser, a worker and the
// server make the same trips. Plain code, typed arrays in and out (to go to a worker without copying), no DOM.

import { agentRandom } from "./agentRandom";

/** The roads as the trips see them (src/sim/roadNetwork.ts, with each road's speed and capacity by its level) */
export interface TripNet {
  /** Each node's ways out (compressed rows): from offsets[i] to offsets[i + 1] in wayTo (the node) and waySegment */
  offsets: Int32Array;
  wayTo: Int32Array;
  waySegment: Int32Array;
  /** Each segment's two nodes, length (metres), speed when clear (m/s) and capacity (cars an hour, both ways) */
  segA: Int32Array;
  segB: Int32Array;
  length: Float64Array;
  speed: Float64Array;
  capacity: Float64Array;
}

/** Where trips start and end: each place's tile, the road it reaches (segment index) and how far along it (0 at its
 * node a, 1 at b), and what it sends or draws */
export interface TripPlaces {
  homeTile: Int32Array;
  homeSegment: Int32Array;
  homeT: Float32Array;
  /** Cars it sends in the busiest hour (its people who drive to work or to the shops then) */
  homeCars: Float32Array;
  jobTile: Int32Array;
  jobSegment: Int32Array;
  jobT: Float32Array;
  /** Its jobs (the pull of work), and its pull for shoppers (shops only) */
  jobs: Float32Array;
  shops: Float32Array;
}

export interface TripJob {
  net: TripNet;
  places: TripPlaces;
  /** The month's number (src/sim/agentRandom.ts monthSeed) */
  seed: number;
  /** How slow the month's weather makes the roads: 1 clear, more in rain (src/weather.ts) */
  weather?: number;
}

/** A way a group of trips goes: from a home's road to a destination's, along these segments, and its cars */
export interface TripRoute {
  /** The road and place it starts at and ends at (segment index, how far along) */
  fromSegment: number;
  fromT: number;
  toSegment: number;
  toT: number;
  /** The segments it goes along in order, from its start to its end (its first and last are its own roads) */
  segments: Int32Array;
  /** Its cars in the busiest hour */
  cars: number;
  /** How long it takes (minutes) */
  minutes: number;
  /** Work (0) or shopping (1) */
  purpose: number;
}

export interface TripResult {
  /** Each segment's cars in the busiest hour, both ways, by segment index */
  cars: Float32Array;
  /** How long each segment takes now (seconds), slowed by its cars */
  seconds: Float32Array;
  /** Minutes from each home to the nearest job, and to the nearest shop (Infinity where none can be reached) */
  homeToWork: Float32Array;
  homeToShop: Float32Array;
  /** Minutes from each job to the nearest home (Infinity where none can be reached) */
  jobToHome: Float32Array;
  /** The ways the month's trips go, for the cars on the roads (src/render3d) and for asking who uses a road */
  routes: TripRoute[];
  /** Homes and jobs there are (a home with no job anywhere is not cut off, only early) */
  anyJobs: boolean;
  anyHomes: boolean;
}

/** How far trips go: a destination further than this (minutes) is out of reach, as in Cities: Skylines */
export const TRIP_MINUTES = 30;
/** The pull of a destination halves at this many minutes, and falls off as the square of the time beyond */
const PULL_MINUTES = 10;
/** Destinations each group of homes sends its trips to, a purpose */
const CHOICES = 3;
/** The most groups of homes whose ways are worked out in a month; more are a share chosen by their cars, counted up */
export const MOST_GROUPS = 400;
/** The share of a home's busy-hour cars that go to work; the rest go shopping */
const WORK_SHARE = 0.7;
/** The BPR curve's numbers, and the slowest a road gets (times its clear time) */
const BPR_A = 0.15;
const MOST_SLOWER = 8;

/** A segment's time (seconds) with these cars on it */
export function segmentSeconds(net: TripNet, k: number, cars: number, weather = 1): number {
  const clear = net.length[k] / Math.max(0.1, net.speed[k]) * weather;
  const x = cars / Math.max(1, net.capacity[k]), slow = 1 + BPR_A * x * x * x * x;
  return clear * (slow < MOST_SLOWER ? slow : MOST_SLOWER);
}

/** A binary heap of nodes by cost, the lowest first, ties by the node's number, so it pops in one order everywhere */
export class Heap {
  private nodes = new Int32Array(64);
  private costs = new Float64Array(64);
  size = 0;
  push(node: number, cost: number): void {
    if (this.size === this.nodes.length) {
      const n = new Int32Array(this.size * 2), c = new Float64Array(this.size * 2);
      n.set(this.nodes); c.set(this.costs);
      this.nodes = n; this.costs = c;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.costs[p] < cost || (this.costs[p] === cost && this.nodes[p] <= node)) break;
      this.nodes[i] = this.nodes[p]; this.costs[i] = this.costs[p];
      i = p;
    }
    this.nodes[i] = node; this.costs[i] = cost;
  }
  /** The lowest node; its cost is `top` before popping */
  get top(): number { return this.costs[0]; }
  pop(): number {
    const out = this.nodes[0], node = this.nodes[--this.size], cost = this.costs[this.size];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      if (l >= this.size) break;
      let c = l;
      if (r < this.size && (this.costs[r] < this.costs[l] || (this.costs[r] === this.costs[l] && this.nodes[r] < this.nodes[l]))) c = r;
      if (this.costs[c] > cost || (this.costs[c] === cost && this.nodes[c] >= node)) break;
      this.nodes[i] = this.nodes[c]; this.costs[i] = this.costs[c];
      i = c;
    }
    this.nodes[i] = node; this.costs[i] = cost;
    return out;
  }
}

/**
 * The quickest times from some starting nodes (each with a cost already) to every node, up to `limit` seconds, and
 * the way each was reached (the node and segment it was reached from, -1 for a start). dist must be filled with
 * Infinity; the nodes it reached are listed in `reached`, so they can be set back.
 */
function quickest(net: TripNet, seconds: Float32Array, starts: Array<[number, number]>, limit: number,
  dist: Float64Array, fromNode: Int32Array, fromSegment: Int32Array, reached: number[]): void {
  const heap = new Heap();
  for (const [node, cost] of starts) {
    if (cost >= dist[node] || cost > limit) continue;
    if (dist[node] === Infinity) reached.push(node);
    dist[node] = cost; fromNode[node] = -1; fromSegment[node] = -1;
    heap.push(node, cost);
  }
  while (heap.size) {
    const cost = heap.top, node = heap.pop();
    if (cost > dist[node]) continue;
    for (let w = net.offsets[node]; w < net.offsets[node + 1]; w++) {
      const next = net.wayTo[w], k = net.waySegment[w], c = cost + seconds[k];
      if (c >= dist[next] || c > limit) continue;
      if (dist[next] === Infinity) reached.push(next);
      dist[next] = c; fromNode[next] = node; fromSegment[next] = k;
      heap.push(next, c);
    }
  }
}

/** Places gathered by the road they reach: the segment, where along it on average (by weight), their weight */
interface Group { segment: number; t: number; weight: number; members: number[] }

function groupsOf(segments: Int32Array, ts: Float32Array, weights: Float32Array): Group[] {
  const by = new Map<number, Group>();
  for (let i = 0; i < segments.length; i++) {
    const w = weights[i];
    if (!(w > 0) || segments[i] < 0) continue;
    let g = by.get(segments[i]);
    if (!g) by.set(segments[i], g = { segment: segments[i], t: 0, weight: 0, members: [] });
    g.t += ts[i] * w; g.weight += w; g.members.push(i);
  }
  const out = [...by.values()].sort((p, q) => p.segment - q.segment);
  for (const g of out) g.t /= g.weight;
  return out;
}

/** The nearest of some places (by segment, how far along, and whether each counts) to each node, and then to each of
 * other places: minutes, Infinity where none is within reach */
function nearestMinutes(net: TripNet, seconds: Float32Array, fromSegment: Int32Array, fromT: Float32Array,
  counts: (i: number) => boolean, toSegment: Int32Array, toT: Float32Array, limit: number): Float32Array {
  const nodes = net.offsets.length - 1, dist = new Float64Array(nodes).fill(Infinity);
  const viaNode = new Int32Array(nodes), viaSegment = new Int32Array(nodes), reached: number[] = [], starts: Array<[number, number]> = [];
  for (let i = 0; i < fromSegment.length; i++) {
    const k = fromSegment[i];
    if (k < 0 || !counts(i)) continue;
    starts.push([net.segA[k], fromT[i] * seconds[k]], [net.segB[k], (1 - fromT[i]) * seconds[k]]);
  }
  starts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  quickest(net, seconds, starts, limit, dist, viaNode, viaSegment, reached);
  const out = new Float32Array(toSegment.length);
  for (let i = 0; i < toSegment.length; i++) {
    const k = toSegment[i];
    if (k < 0) { out[i] = Infinity; continue; }
    const s = Math.min(dist[net.segA[k]] + toT[i] * seconds[k], dist[net.segB[k]] + (1 - toT[i]) * seconds[k]);
    out[i] = s <= limit ? s / 60 : Infinity;
  }
  return out;
}

/**
 * A month of trips: where each group of homes sends its cars, the way they go, the cars on each road, how long each
 * road takes with them, and how far each home is from work and the shops and each job from the homes.
 */
export function monthTrips(job: TripJob): TripResult {
  const { net, places, seed } = job, weather = job.weather ?? 1;
  const segments = net.segA.length, nodes = net.offsets.length - 1, limit = TRIP_MINUTES * 60;
  // Each road's time, clear, then slowed as the groups' cars go on it
  const cars = new Float64Array(segments), seconds = new Float32Array(segments);
  for (let k = 0; k < segments; k++) seconds[k] = segmentSeconds(net, k, 0, weather);
  const homes = places.homeTile.length, jobsCount = places.jobTile.length;
  let anyJobs = false, anyHomes = false;
  for (let i = 0; i < jobsCount && !anyJobs; i++) anyJobs = places.jobs[i] > 0 || places.shops[i] > 0;
  for (let i = 0; i < homes && !anyHomes; i++) anyHomes = places.homeCars[i] > 0;

  // The groups of homes, and of destinations for each purpose, by the road they reach
  const homeGroups = groupsOf(places.homeSegment, places.homeT, places.homeCars);
  const work = groupsOf(places.jobSegment, places.jobT, places.jobs), shop = groupsOf(places.jobSegment, places.jobT, places.shops);
  // ... in an order of the month's own, and too many: a share of them chosen by their cars, counted up to the whole
  const keyed = homeGroups.map((g) => ({ g, key: agentRandom(seed, g.segment, 7)() / g.weight }));
  keyed.sort((p, q) => p.key - q.key || p.g.segment - q.g.segment);
  const chosen = keyed.slice(0, MOST_GROUPS).map((k) => k.g);
  const all = homeGroups.reduce((sum, g) => sum + g.weight, 0), some = chosen.reduce((sum, g) => sum + g.weight, 0);
  const scale = some > 0 ? all / some : 1;

  const routes: TripRoute[] = [];
  const dist = new Float64Array(nodes).fill(Infinity), viaNode = new Int32Array(nodes), viaSegment = new Int32Array(nodes);
  const pull = (minutes: number): number => { const x = minutes / PULL_MINUTES; return 1 / (1 + x * x); };
  for (const g of chosen) {
    const k = g.segment, reached: number[] = [];
    const starts: Array<[number, number]> = [[net.segA[k], g.t * seconds[k]], [net.segB[k], (1 - g.t) * seconds[k]]];
    quickest(net, seconds, starts.sort((p, q) => p[0] - q[0]), limit, dist, viaNode, viaSegment, reached);
    const touched = new Set<number>();
    for (const [purpose, groups, share] of [[0, work, WORK_SHARE], [1, shop, 1 - WORK_SHARE]] as const) {
      // Each destination's time from here, and its pull over it
      const options: Array<{ d: Group; seconds: number; enter: number; weight: number }> = [];
      let total = 0;
      for (const d of groups) {
        const m = d.segment;
        let s: number, enter: number;
        if (m === k) { s = Math.abs(d.t - g.t) * seconds[k]; enter = -1; }
        else {
          const viaA = dist[net.segA[m]] + d.t * seconds[m], viaB = dist[net.segB[m]] + (1 - d.t) * seconds[m];
          if (viaA <= viaB) { s = viaA; enter = net.segA[m]; } else { s = viaB; enter = net.segB[m]; }
        }
        if (!(s <= limit)) continue;
        const weight = d.weight * pull(s / 60);
        options.push({ d, seconds: s, enter, weight });
        total += weight;
      }
      if (!(total > 0)) continue;
      // A few destinations, each by its pull, chosen by the group's own numbers this month
      const draw = agentRandom(seed, k, purpose + 1), each = g.weight * share * scale / CHOICES;
      for (let c = 0; c < CHOICES; c++) {
        let at = draw() * total, pick = options[options.length - 1];
        for (const o of options) { at -= o.weight; if (at < 0) { pick = o; break; } }
        // ... and its way: back from where it enters the destination's road to the group's own road
        const way: number[] = [];
        if (pick.enter >= 0) {
          way.push(pick.d.segment);
          for (let n = pick.enter; viaSegment[n] >= 0; n = viaNode[n]) way.push(viaSegment[n]);
          way.push(k);
          way.reverse();
        } else way.push(k);
        for (const s of way) { cars[s] += each; touched.add(s); }
        routes.push({ fromSegment: k, fromT: g.t, toSegment: pick.d.segment, toT: pick.d.t, segments: Int32Array.from(way),
          cars: each, minutes: pick.seconds / 60, purpose });
      }
    }
    for (const n of reached) dist[n] = Infinity;
    // ... its cars on the roads for those after it
    for (const s of touched) seconds[s] = segmentSeconds(net, s, cars[s], weather);
  }

  // How far each home is from the nearest job and shop, and each job from the nearest home, with the roads as busy as
  // the month's trips make them
  const homeToWork = nearestMinutes(net, seconds, places.jobSegment, places.jobT, (i) => places.jobs[i] > 0,
    places.homeSegment, places.homeT, limit);
  const homeToShop = nearestMinutes(net, seconds, places.jobSegment, places.jobT, (i) => places.shops[i] > 0,
    places.homeSegment, places.homeT, limit);
  const jobToHome = nearestMinutes(net, seconds, places.homeSegment, places.homeT, (i) => places.homeCars[i] > 0,
    places.jobSegment, places.jobT, limit);
  return { cars: Float32Array.from(cars), seconds, homeToWork, homeToShop, jobToHome, routes, anyJobs, anyHomes };
}
