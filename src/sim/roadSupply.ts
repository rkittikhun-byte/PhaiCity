/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Power and water along the roads (docs/NO_GRID_PLAN.md step 2): on a real-scale city map the cables and the pipes lie
// under the roads of the road graph, not under 16 m tiles. The original game walked the tiles from each plant, a unit
// of power a tile, and stopped where the power ran out, so which buildings went dark hung on the order of its stack;
// the water was handed out in the order the map was scanned, left to right, so the east always went dry first. Here:
//
//   the roads that meet make a network (union-find over the graph's nodes); a plant or works joins the networks it
//   touches; each network's supply is what its sources give, and each building on it takes what its kind and size use;
//   short of supply, the buildings nearest a source by road are served first (one Dijkstra from all the sources), and
//   the far ends go without: where the supply ran out is a distance along the roads, which the player can see and mend.
//
// Plain code, typed arrays and plain numbers in and out, + - * / only in what decides, so every engine and a worker or
// the server make the same answer. No DOM, nothing random.

import { Heap } from "./trips";

/** The roads as the supply sees them: the graph's arrays (src/sim/roadNetwork.ts) */
export interface SupplyNet {
  offsets: Int32Array;
  wayTo: Int32Array;
  waySegment: Int32Array;
  segA: Int32Array;
  segB: Int32Array;
  length: Float64Array;
}

/** Where something meets the roads: a segment (its index in the net) and how far along it, 0 at its node a, 1 at b */
export interface Attach { k: number; t: number }

/** A plant, works or well: the roads it touches and what it gives */
export interface SupplySource { at: readonly Attach[]; amount: number }

/** A building that takes from the supply: the road it reaches and what it takes (0 takes nothing, but is reached) */
export interface SupplyUser { at: Attach | null; demand: number }

/** Short cables and pipes between roads that nearly meet (src/sim/cityUtilities.ts gapLinks): each joins node a[i] to
 * node b[i], length[i] metres apart along it */
export interface SupplyLinks { a: Int32Array; b: Int32Array; length: Float64Array }

/** A road's part of the supply: no source on its network, served, or past where the supply ran out */
export const ROAD_NONE = 0, ROAD_SERVED = 1, ROAD_SHORT = 2;

export interface SupplyResult {
  /** Each user served (1) or not (0), in the order given */
  served: Uint8Array;
  /** ... and the share of its demand each user got, 0-1: 1 served, the first one the supply ran out at what was left
   *  of it, 0 the rest (what a school's last seats give a home that wants more, src/sim/serviceSeats.ts) */
  part: Float64Array;
  /** Each user's network had a source (1), whether or not it was served: its road is "piped" */
  reached: Uint8Array;
  /** Each user's distance from the nearest source along the roads (metres; Infinity with none) */
  distance: Float64Array;
  /** Each segment's state: ROAD_NONE, ROAD_SERVED or ROAD_SHORT */
  roads: Uint8Array;
  /** What the sources give, and what the users served take, in all */
  supply: number;
  used: number;
  /** Some user went without on a network with a source */
  short: boolean;
}

/** The root of a node's network, halving the path on the way (union-find) */
function root(parent: Int32Array, i: number): number {
  while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
  return i;
}

/** Joins two networks, the lower root always the root, so the answer does not hang on the order of the joins */
function join(parent: Int32Array, a: number, b: number): void {
  const ra = root(parent, a), rb = root(parent, b);
  if (ra < rb) parent[rb] = ra; else if (rb < ra) parent[ra] = rb;
}

/** A little over equal, for sums of fractions added in another order */
const EPSILON = 1e-9;

/**
 * Hands each network's supply to its users, the nearest to a source by road first, until it runs out; the users past
 * that, and the roads past where it ran out, go without.
 */
export function supplyAlongRoads(net: SupplyNet, sources: readonly SupplySource[], users: readonly SupplyUser[],
  links: SupplyLinks | null = null): SupplyResult {
  const nodes = net.offsets.length - 1, segments = net.segA.length;
  // The networks: the roads that meet, the roads a short cable joins, and the sources that touch several
  const parent = new Int32Array(nodes);
  for (let i = 0; i < nodes; i++) parent[i] = i;
  for (let k = 0; k < segments; k++) join(parent, net.segA[k], net.segB[k]);
  const linked = new Map<number, Array<[number, number]>>();
  if (links) {
    for (let i = 0; i < links.a.length; i++) {
      join(parent, links.a[i], links.b[i]);
      for (const [from, to] of [[links.a[i], links.b[i]], [links.b[i], links.a[i]]]) {
        let list = linked.get(from);
        if (!list) linked.set(from, list = []);
        list.push([to, links.length[i]]);
      }
    }
  }
  for (const source of sources) {
    for (let j = 1; j < source.at.length; j++) join(parent, net.segA[source.at[0].k], net.segA[source.at[j].k]);
  }
  // Each network's supply
  const supplyOf = new Float64Array(nodes);
  let supply = 0;
  for (const source of sources) {
    if (!source.at.length || !(source.amount > 0)) continue;
    supplyOf[root(parent, net.segA[source.at[0].k])] += source.amount;
    supply += source.amount;
  }
  // How far each node lies from the nearest source along the roads (one search from all of them); a user on a source's
  // own segment may be nearer along it
  const dist = new Float64Array(nodes).fill(Infinity), heap = new Heap();
  const onSegment = new Map<number, number[]>();
  const start = (node: number, d: number): void => {
    if (d < dist[node]) { dist[node] = d; heap.push(node, d); }
  };
  for (const source of sources) {
    if (!(source.amount > 0)) continue;
    for (const { k, t } of source.at) {
      start(net.segA[k], t * net.length[k]);
      start(net.segB[k], (1 - t) * net.length[k]);
      let list = onSegment.get(k);
      if (!list) onSegment.set(k, list = []);
      list.push(t);
    }
  }
  while (heap.size) {
    const cost = heap.top, node = heap.pop();
    if (cost > dist[node]) continue;
    for (let w = net.offsets[node]; w < net.offsets[node + 1]; w++) {
      const next = net.wayTo[w], c = cost + net.length[net.waySegment[w]];
      if (c < dist[next]) { dist[next] = c; heap.push(next, c); }
    }
    for (const [next, length] of linked.get(node) ?? []) {
      const c = cost + length;
      if (c < dist[next]) { dist[next] = c; heap.push(next, c); }
    }
  }
  const distanceAt = (k: number, t: number): number => {
    let d = Math.min(dist[net.segA[k]] + t * net.length[k], dist[net.segB[k]] + (1 - t) * net.length[k]);
    for (const s of onSegment.get(k) ?? []) d = Math.min(d, Math.abs(t - s) * net.length[k]);
    return d;
  };

  // Each user's network and distance; then each network's users, nearest first (ties by their order given)
  const n = users.length, served = new Uint8Array(n), reached = new Uint8Array(n), distance = new Float64Array(n).fill(Infinity);
  const part = new Float64Array(n);
  const byNetwork = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const at = users[i].at;
    if (!at) continue;
    const r = root(parent, net.segA[at.k]);
    if (!(supplyOf[r] > 0)) continue;
    reached[i] = 1;
    distance[i] = distanceAt(at.k, at.t);
    let list = byNetwork.get(r);
    if (!list) byNetwork.set(r, list = []);
    list.push(i);
  }
  // Where each network's supply ran out (metres from its sources), Infinity where it did not
  const cut = new Map<number, number>();
  let used = 0, short = false;
  for (const r of [...byNetwork.keys()].sort((a, b) => a - b)) {
    const list = byNetwork.get(r)!;
    list.sort((a, b) => distance[a] - distance[b] || a - b);
    let left = supplyOf[r], out = false;
    for (const i of list) {
      const demand = users[i].demand;
      if (!(demand > 0)) { served[i] = 1; part[i] = 1; continue; }
      if (!out && demand <= left + EPSILON) {
        served[i] = 1;
        part[i] = 1;
        left -= demand;
        used += demand;
      } else if (!out) {
        out = true;
        short = true;
        cut.set(r, distance[i]);
        part[i] = left > 0 ? left / demand : 0;
      }
    }
  }
  // Each road: served where its middle lies nearer its network's sources than where the supply ran out
  const roads = new Uint8Array(segments);
  for (let k = 0; k < segments; k++) {
    const r = root(parent, net.segA[k]);
    if (!(supplyOf[r] > 0)) continue;
    roads[k] = distanceAt(k, 0.5) < (cut.get(r) ?? Infinity) ? ROAD_SERVED : ROAD_SHORT;
  }
  return { served, part, reached, distance, roads, supply, used, short };
}
