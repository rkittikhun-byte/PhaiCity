/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The road graph (src/roads/roadGraph.ts) as flat arrays for finding the way (docs/NO_GRID_PLAN.md 0.2): its nodes
// numbered 0 … n-1 in id order, its segments 0 … m-1 in id order, and each node's ways out of it one after another
// (compressed sparse rows: a node's ways are those from offsets[i] to offsets[i + 1]). Made again only when the graph
// changes (its version), as trips are found on it many times a month. Typed arrays, so it goes to a worker without
// copying. Plain code, no DOM, the same arrays from the same graph.

import type { RoadGraph } from "../roads/roadGraph";

export interface RoadNet {
  /** The graph's version it was made from */
  readonly version: number;
  /** Each node's id and where it is (metres), by its number here */
  readonly nodeIds: Int32Array;
  readonly x: Float64Array;
  readonly z: Float64Array;
  /** A node's number here by its id */
  readonly nodeIndex: Map<number, number>;
  /** Each segment's id, its two nodes' numbers here, its length (metres) and its level, by its number here */
  readonly segmentIds: Int32Array;
  readonly segA: Int32Array;
  readonly segB: Int32Array;
  readonly length: Float64Array;
  readonly level: Uint8Array;
  /** A segment's number here by its id */
  readonly segmentIndex: Map<number, number>;
  /** Each node's ways out: from offsets[i] to offsets[i + 1] in wayTo (the node it leads to) and waySegment (along) */
  readonly offsets: Int32Array;
  readonly wayTo: Int32Array;
  readonly waySegment: Int32Array;
}

const made = new WeakMap<RoadGraph, RoadNet>();

/** The graph's flat arrays, made again when it has changed since they were last asked for */
export function roadNet(graph: RoadGraph): RoadNet {
  const old = made.get(graph);
  if (old && old.version === graph.version) return old;
  const net = buildRoadNet(graph);
  made.set(graph, net);
  return net;
}

/** The graph's flat arrays, made now */
export function buildRoadNet(graph: RoadGraph): RoadNet {
  const ids = [...graph.nodes.keys()].sort((p, q) => p - q), n = ids.length;
  const nodeIds = Int32Array.from(ids), x = new Float64Array(n), z = new Float64Array(n), nodeIndex = new Map<number, number>();
  ids.forEach((id, i) => { const node = graph.node(id); x[i] = node.x; z[i] = node.z; nodeIndex.set(id, i); });
  const segs = [...graph.segments.keys()].sort((p, q) => p - q), m = segs.length;
  const segmentIds = Int32Array.from(segs), segA = new Int32Array(m), segB = new Int32Array(m);
  const length = new Float64Array(m), level = new Uint8Array(m), segmentIndex = new Map<number, number>();
  const count = new Int32Array(n + 1);
  segs.forEach((id, k) => {
    const s = graph.segment(id);
    segA[k] = nodeIndex.get(s.a)!; segB[k] = nodeIndex.get(s.b)!;
    length[k] = graph.length(id);
    level[k] = s.level;
    segmentIndex.set(id, k);
    count[segA[k]]++;
    if (segB[k] !== segA[k]) count[segB[k]]++;
  });
  const offsets = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + count[i];
  const fill = offsets.slice(0, n), wayTo = new Int32Array(offsets[n]), waySegment = new Int32Array(offsets[n]);
  // Each node's ways in the order of their segments' ids
  for (let k = 0; k < m; k++) {
    const a = segA[k], b = segB[k];
    wayTo[fill[a]] = b; waySegment[fill[a]++] = k;
    if (b !== a) { wayTo[fill[b]] = a; waySegment[fill[b]++] = k; }
  }
  return { version: graph.version, nodeIds, x, z, nodeIndex, segmentIds, segA, segB, length, level, segmentIndex,
    offsets, wayTo, waySegment };
}
