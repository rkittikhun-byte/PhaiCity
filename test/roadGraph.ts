/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads as drawn, in metres (src/roads/roadGraph.ts, docs/METRE_DRAWING_PLAN.md 1.1): what is drawn stays where
// it is drawn, crossings split both roads, ends join nodes or make a T.

import { bezierAt, MERGE_M, RoadGraph, splitBezier, type Vec } from "../src/roads/roadGraph";

const near = (p: Vec, q: Vec, eps = 1e-6) => expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(eps);

describe("road graph", () => {
  test("a road drawn alone is one segment between two new nodes, as long as it is", () => {
    const g = new RoadGraph();
    const r = g.add({ from: [10, 10], to: [110, 10], level: 2 });
    expect(r.segments).toHaveLength(1);
    expect(g.nodes.size).toBe(2);
    expect(g.length(r.segments[0])).toBeCloseTo(100);
    near(g.pointAt(r.segments[0], 0.5), [60, 10]);
  });

  test("two roads that cross split each other at the crossing: four segments meeting at one node", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 50], to: [100, 50], level: 2 });
    const r = g.add({ from: [50, 0], to: [50, 100], level: 3 });
    expect(r.split).toHaveLength(1);
    expect(g.segments.size).toBe(4);
    const middle = g.nodeNear([50, 50], 0.01)!;
    expect(middle).not.toBeNull();
    expect(g.segmentsAt(middle.id)).toHaveLength(4);
    // Each half keeps its road's level
    const levels = g.segmentsAt(middle.id).map(id => g.segment(id).level).sort();
    expect(levels).toEqual([2, 2, 3, 3]);
  });

  test("an end dropped near a node joins it, and one dropped on a road splits it into a T", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 0], to: [100, 0], level: 2 });
    g.add({ from: [100 + MERGE_M * 0.8, 0.1], to: [100, 80], level: 2 });
    expect(g.nodes.size).toBe(3);
    const t = g.add({ from: [40, 0.2], to: [40, -60], level: 2 });
    expect(t.split).toHaveLength(1);
    const joint = g.nodeNear([40, 0], 0.5)!;
    expect(g.segmentsAt(joint.id)).toHaveLength(3);
  });

  test("a crossed curve keeps exactly its shape, both halves together", () => {
    const g = new RoadGraph();
    const curve = g.add({ from: [0, 0], to: [200, 0], c1: [50, 120], c2: [150, 120], level: 2 });
    const id = curve.segments[0];
    const before = [0.1, 0.3, 0.5, 0.7, 0.9].map(t => g.pointAt(id, t));
    g.add({ from: [100, -20], to: [100, 200], level: 2 });
    expect(g.segments.has(id)).toBe(false);
    // Every old point still lies on the road, on one half or the other
    for (const p of before) expect(g.nearest(p, 1)!.distance).toBeLessThan(1e-6);
    // The split happened where the line crosses the curve's top
    expect(g.nodeNear([100, 90], 0.01)).not.toBeNull();
  });

  test("a new curve that crosses a road is cut into pieces of its own exact shape", () => {
    const g = new RoadGraph();
    g.add({ from: [100, -50], to: [100, 250], level: 2 });
    const drawn: Vec[] = [[0, 0], [50, 120], [150, 120], [200, 0]];
    const r = g.add({ from: drawn[0], to: drawn[3], c1: drawn[1], c2: drawn[2], level: 2 });
    expect(r.segments).toHaveLength(2);
    for (const t of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) expect(g.nearest(bezierAt(drawn, t), 1)!.distance).toBeLessThan(1e-3);
  });

  test("a curve drawn across a curve twice, or a line across a curve, is cut into pieces of exactly its own shape", () => {
    const g = new RoadGraph();
    const old: Vec[] = [[60, 520], [250, 330], [520, 640], [880, 430]];
    g.add({ from: old[0], to: old[3], c1: old[1], c2: old[2], level: 1, piece: 1 });
    const twice: Vec[] = [[120, 610], [300, 380], [600, 380], [800, 620]];
    const r = g.add({ from: twice[0], to: twice[3], c1: twice[1], c2: twice[2], level: 1, piece: 2 });
    expect(r.split).toHaveLength(2);
    expect(r.segments).toHaveLength(3);
    g.add({ from: [430, 380], to: [470, 630], level: 1, piece: 3 });
    // Every piece of each lies on the curve or line it was drawn as, to the millimetre a node is kept to
    const offCurve = (p: Vec, c: Vec[]) => {
      const alone = new RoadGraph(), [id] = alone.add({ from: c[0], to: c[3], c1: c[1], c2: c[2], level: 1 }).segments;
      return alone.nearestOn(id, p).distance;
    };
    const offLine = (p: Vec) => Math.abs((p[0] - 430) * 250 - (p[1] - 380) * 40) / Math.hypot(40, 250);
    for (const s of g.segments.values()) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = g.pointAt(s.id, t);
        expect(s.piece === 3 ? offLine(p) : offCurve(p, s.piece === 1 ? old : twice)).toBeLessThan(2e-3);
      }
    }
  });

  test("an S-bend crossing a straight road twice splits it twice, and itself into three", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 50], to: [300, 50], level: 2 });
    const r = g.add({ from: [0, 0], to: [300, 100], c1: [150, 250], c2: [150, -150], level: 2 });
    expect(r.split).toHaveLength(3);
    expect(r.segments.length).toBeGreaterThanOrEqual(3);
    // The straight road is in four pieces now, still along z = 50
    const straight = [...g.segments.values()].filter(s => s.shape === "line");
    expect(straight.length).toBe(4);
    for (const s of straight) for (const t of [0, 0.5, 1]) expect(g.pointAt(s.id, t)[1]).toBeCloseTo(50, 6);
  });

  test("de Casteljau's halves are the curve", () => {
    const p: Vec[] = [[0, 0], [10, 30], [40, 30], [50, 0]];
    const [a, b] = splitBezier(p, 0.3);
    near(bezierAt(a, 1), bezierAt(p, 0.3));
    near(bezierAt(a, 0.5), bezierAt(p, 0.15));
    near(bezierAt(b, 0.5), bezierAt(p, 0.65));
  });

  test("removing a road takes its lone nodes with it", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 50], to: [100, 50], level: 2 });
    g.add({ from: [50, 0], to: [50, 100], level: 2 });
    const top = g.segmentsAt(g.nodeNear([50, 0], 0.1)!.id)[0];
    g.remove(top);
    expect(g.nodeNear([50, 0], 0.1)).toBeNull();
    expect(g.segments.size).toBe(3);
  });

  test("the nearest road to a point, through the spatial index", () => {
    const g = new RoadGraph();
    g.add({ from: [0, 0], to: [1000, 0], level: 2 });
    g.add({ from: [0, 500], to: [1000, 500], level: 2 });
    const n = g.nearest([700, 30], 50)!;
    expect(n.distance).toBeCloseTo(30);
    near(n.point, [700, 0]);
    expect(g.nearest([700, 250], 50)).toBeNull();
  });

  test("the same calls make the same graph, and it comes back from its saved form", () => {
    const build = () => {
      const g = new RoadGraph();
      g.add({ from: [0, 50], to: [300, 50], level: 2, piece: 1 });
      g.add({ from: [0, 0], to: [300, 200], c1: [100, 150], c2: [200, -50], level: 4, piece: 2 });
      g.add({ from: [150, -20], to: [150, 260], level: 3, national: true });
      return g;
    };
    const a = build().toJSON(), b = build().toJSON();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const back = RoadGraph.fromJSON(JSON.parse(JSON.stringify(a)));
    expect(JSON.stringify(back.toJSON())).toBe(JSON.stringify(a));
    // ... and goes on numbering where it stopped
    back.add({ from: [10, 300], to: [20, 300], level: 1 });
    expect(Math.max(...back.segments.keys())).toBe(a.next[1]);
  });
});
