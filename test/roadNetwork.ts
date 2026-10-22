/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The road graph as flat arrays for finding the way (src/sim/roadNetwork.ts) and each thing's own random numbers
// (src/sim/agentRandom.ts): docs/NO_GRID_PLAN.md 0.2.

import { Random } from "../src/random";
import { RoadGraph } from "../src/roads/roadGraph";
import { agentRandom, monthSeed } from "../src/sim/agentRandom";
import { buildRoadNet, roadNet } from "../src/sim/roadNetwork";

describe("the road graph as flat arrays", () => {
  test("every segment is a way out of both its nodes, in id order, and the arrays are made again only when it changes", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 50], to: [300, 50], level: 2 });
    g.add({ from: [150, 0], to: [150, 200], level: 3 });
    g.add({ from: [0, 0], to: [300, 200], c1: [100, 150], c2: [200, -50], level: 4 });
    const net = roadNet(g);
    expect(roadNet(g)).toBe(net);
    expect(net.nodeIds.length).toBe(g.nodes.size);
    expect(net.segmentIds.length).toBe(g.segments.size);
    for (let i = 0; i < net.nodeIds.length; i++) {
      const id = net.nodeIds[i];
      const ways = [];
      for (let w = net.offsets[i]; w < net.offsets[i + 1]; w++) ways.push(net.segmentIds[net.waySegment[w]]);
      expect(ways).toEqual(g.segmentsAt(id));
      for (let w = net.offsets[i]; w < net.offsets[i + 1]; w++) {
        const k = net.waySegment[w], other = net.segA[k] === i ? net.segB[k] : net.segA[k];
        expect(net.wayTo[w]).toBe(other);
        expect(net.length[k]).toBeCloseTo(g.length(net.segmentIds[k]), 9);
      }
    }
    g.add({ from: [10, 190], to: [290, 190], level: 1 });
    const again = roadNet(g);
    expect(again).not.toBe(net);
    expect(JSON.stringify(Array.from(buildRoadNet(g).wayTo))).toBe(JSON.stringify(Array.from(again.wayTo)));
  });
});

describe("each thing's own random numbers", () => {
  test("the same month and id give the same numbers; another id or month others; spread evenly", () => {
    const a = agentRandom(1234, 7), b = agentRandom(1234, 7), c = agentRandom(1234, 8), d = agentRandom(1235, 7);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(xs);
    expect(Array.from({ length: 5 }, () => d())).not.toEqual(xs);
    // Over many ids the first numbers fill [0, 1) evenly
    const buckets = new Array(10).fill(0);
    for (let id = 0; id < 20000; id++) buckets[Math.floor(agentRandom(99, id)() * 10)]++;
    for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(200);
  });

  test("the month's number comes from Random, so a replay from the same seed draws the same", () => {
    Random.seed(42);
    const first = [monthSeed(), monthSeed()];
    Random.seed(42);
    expect([monthSeed(), monthSeed()]).toEqual(first);
    expect(first[0]).not.toBe(first[1]);
  });
});
