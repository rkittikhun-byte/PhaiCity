/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Ways along the road and rail graphs for the vehicles the view drives on them (docs/NO_GRID_PLAN.md 1.5): the shortest
// way between two places (a bus from where it was put down to the town's middle), the longest way through a network (a
// train along its railway), and a point a distance along such a way. Points in world units; plain code, no DOM.

import type { RoadGraph } from '../../roads/roadGraph.js';
import { roadNet } from '../../sim/roadNetwork.js';

export type WayPoint = [number, number];

/** A way: its points (world units) and the distance from its start to each; the segments it goes through in order
 * (graph ids) and where on the first it starts and on the last it ends (t), for the traffic (tripCars.ts lanePathOf) */
export interface Way { points: WayPoint[]; along: Float64Array; length: number; segments?: number[]; fromT?: number; toT?: number }

/** A way through the segments given in order, from a point on the first (t) to a point on the last (t), in world units */
function wayOf(graph: RoadGraph, segments: number[], fromT: number, toT: number, units: number): Way | null {
  const points: WayPoint[] = [];
  for (let n = 0; n < segments.length; n++) {
    const s = graph.segments.get(segments[n]);
    if (!s) return null;
    const next = n + 1 < segments.length ? graph.segments.get(segments[n + 1]) : undefined;
    const prev = n > 0 ? graph.segments.get(segments[n - 1]) : undefined;
    const meets = (o: typeof s | undefined, node: number): boolean => Boolean(o && (o.a === node || o.b === node));
    let t0: number, t1: number;
    if (segments.length === 1) { t0 = fromT; t1 = toT; }
    else if (n === 0) { t0 = fromT; t1 = meets(next, s.b) ? 1 : 0; }
    else if (n === segments.length - 1) { t0 = meets(prev, s.a) ? 0 : 1; t1 = toT; }
    else { t0 = meets(prev, s.a) ? 0 : 1; t1 = 1 - t0; }
    const steps = s.shape === 'line' ? 1 : Math.max(2, Math.ceil(graph.length(s.id) * Math.abs(t1 - t0) / 4));
    for (let j = n === 0 ? 0 : 1; j <= steps; j++) {
      const [x, z] = graph.pointAt(s.id, t0 + (t1 - t0) * j / steps);
      points.push([x * units, z * units]);
    }
  }
  if (points.length < 2) return null;
  const along = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) along[i] = along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return along[points.length - 1] > 0 ? { points, along, length: along[points.length - 1], segments, fromT, toT } : null;
}

/** The quickest way by length from each node of a graph's arrays out of some starts, and the segment each was reached by */
function sweep(graph: RoadGraph, starts: Array<[number, number]>): { dist: Float64Array; via: Int32Array; from: Int32Array } {
  const net = roadNet(graph), n = net.nodeIds.length, dist = new Float64Array(n).fill(Infinity), via = new Int32Array(n).fill(-1);
  const from = new Int32Array(n).fill(-1), heap: Array<[number, number]> = [];
  // A binary heap of [cost, node], the cheapest on top
  const push = (cost: number, node: number): void => {
    heap.push([cost, node]);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let c = i;
        if (l < heap.length && heap[l][0] < heap[c][0]) c = l;
        if (r < heap.length && heap[r][0] < heap[c][0]) c = r;
        if (c === i) break;
        [heap[c], heap[i]] = [heap[i], heap[c]];
        i = c;
      }
    }
    return top;
  };
  for (const [node, cost] of starts) if (cost < dist[node]) { dist[node] = cost; push(cost, node); }
  while (heap.length) {
    const [cost, node] = pop();
    if (cost > dist[node]) continue;
    for (let w = net.offsets[node]; w < net.offsets[node + 1]; w++) {
      const next = net.wayTo[w], k = net.waySegment[w], c = cost + net.length[k];
      if (c < dist[next]) { dist[next] = c; via[next] = k; from[next] = node; push(c, next); }
    }
  }
  return { dist, via, from };
}

/** The shortest way along the graph from the point nearest a to the point nearest b (metres), or null */
export function wayBetween(graph: RoadGraph, a: WayPoint, b: WayPoint, units: number, reach = 40): Way | null {
  const start = graph.nearest(a, reach), end = graph.nearest(b, reach);
  if (!start || !end) return null;
  if (start.segment === end.segment) return wayOf(graph, [start.segment], start.t, end.t, units);
  const net = roadNet(graph), ks = net.segmentIndex.get(start.segment)!, ke = net.segmentIndex.get(end.segment)!;
  const ls = net.length[ks], { dist, via, from } = sweep(graph, [[net.segA[ks], start.t * ls], [net.segB[ks], (1 - start.t) * ls]]);
  const le = net.length[ke], viaA = dist[net.segA[ke]] + end.t * le, viaB = dist[net.segB[ke]] + (1 - end.t) * le;
  if (!Number.isFinite(Math.min(viaA, viaB))) return null;
  const segments: number[] = [end.segment];
  for (let node = viaA <= viaB ? net.segA[ke] : net.segB[ke]; via[node] >= 0; node = from[node]) segments.push(net.segmentIds[via[node]]);
  segments.push(start.segment);
  segments.reverse();
  return wayOf(graph, segments, start.t, end.t, units);
}

/** The longest way through the graph's biggest piece, about (from the far end of a sweep to the far end of another) */
export function longestWay(graph: RoadGraph, units: number): Way | null {
  const net = roadNet(graph);
  if (!net.nodeIds.length) return null;
  const far = (start: number): { node: number; dist: Float64Array; via: Int32Array; from: Int32Array } => {
    const s = sweep(graph, [[start, 0]]);
    let node = start;
    for (let i = 0; i < s.dist.length; i++) if (Number.isFinite(s.dist[i]) && s.dist[i] > s.dist[node]) node = i;
    return { node, ...s };
  };
  const first = far(0), second = far(first.node);
  const segments: number[] = [];
  for (let node = second.node; second.via[node] >= 0; node = second.from[node]) segments.push(net.segmentIds[second.via[node]]);
  if (!segments.length) return null;
  segments.reverse();
  const s0 = graph.segments.get(segments[0])!, startNode = net.nodeIds[first.node];
  const sl = graph.segments.get(segments[segments.length - 1])!, endNode = net.nodeIds[second.node];
  return wayOf(graph, segments, s0.a === startNode ? 0 : 1, sl.b === endNode ? 1 : 0, units);
}

/** Where along a way a distance from its start is, and the way it runs there */
export function pointAlong(way: Way, distance: number): { x: number; z: number; dx: number; dz: number } {
  const d = Math.max(0, Math.min(way.length, distance)), { along, points } = way;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (along[mid] <= d) lo = mid; else hi = mid; }
  const span = along[hi] - along[lo], f = span > 0 ? (d - along[lo]) / span : 0;
  const [ax, az] = points[lo], [bx, bz] = points[hi];
  return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, dx: bx - ax, dz: bz - az };
}
