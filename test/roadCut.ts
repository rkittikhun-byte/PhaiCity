/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bulldozer on roads drawn in metres (src/roads/roadCut.ts, docs/METRE_DRAWING_PLAN.md step 1's leftovers): a
// cleared tile is cut out of the drawn road, the rest staying exactly as drawn and still drawn from the graph; clearing
// all its tiles takes the road away; undo puts it back whole.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { graphLines } from "../src/roads/graphLines";
import type { RoadGraph } from "../src/roads/roadGraph";
import { isRoadTile } from "../src/roadTiles";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(100000);
  return core;
}
const graphOf = (core: CityCore): RoadGraph => (core.map as any).roadGraph;
/** The roads the 3D view draws from the graph (whole strokes only), in world units */
const drawnRuns = (core: CityCore) => {
  const map = core.map as any;
  return graphLines(graphOf(core), { width: 60, height: 40, tileSizeM: 16, value: (i) => map.getTileValue(i % 60, Math.floor(i / 60)),
    piece: (i) => map.roadPieces?.[i] ?? 0, level: (i) => map.roadLevels?.[i] ?? 1 }, false).runs;
};
const doze = (core: CityCore, x: number, y: number, stroke: number) => core.apply({ type: "tool", tool: "bulldozer", x, y, stroke });

describe("bulldozing roads drawn in metres", () => {
  test("a cleared tile is cut out: the two parts stay where they were drawn, their ends at its edges", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    expect(doze(core, 28, 10, 2).accepted).toBe(true);
    expect(isRoadTile(core.map.getTileValue(28, 10))).toBe(false);
    const graph = graphOf(core), segments = [...graph.segments.values()];
    expect(segments).toHaveLength(2);
    const ends = segments.flatMap((s) => [graph.node(s.a), graph.node(s.b)]).map((n) => [n.x, n.z]).sort((p, q) => p[0] - q[0]);
    // The road's own ends, and the cut ends just past the cleared tile's edges (448 m and 464 m)
    expect(ends[0]).toEqual([8, 168]);
    expect(ends[3]).toEqual([904, 168]);
    expect(ends[1][0]).toBeCloseTo(448 - 0.25, 2);
    expect(ends[2][0]).toBeCloseTo(464 + 0.25, 2);
    for (const end of ends) expect(end[1]).toBe(168);
    // ... and both parts are still drawn as drawn, from the graph
    const runs = drawnRuns(core);
    expect(runs).toHaveLength(2);
  });

  test("a curve keeps its shape either side of the cut", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [40, 300], c1: [300, 40], c2: [600, 600], to: [880, 300], stroke: 1 });
    const graph = graphOf(core), [id] = [...graph.segments.keys()];
    const before = graph.polyline(id, 0.1);
    // A tile the curve passes over, near its middle
    const [mx, mz] = graph.pointAt(id, 0.5), tx = Math.floor(mx / 16), ty = Math.floor(mz / 16);
    doze(core, tx, ty, 2);
    expect(graph.segments.size).toBe(2);
    const near = (p: [number, number]) => Math.min(...before.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
    for (const s of graph.segments.keys()) for (const p of graph.polyline(s, 2)) expect(near(p)).toBeLessThan(0.1);
  });

  test("clearing every tile takes the road away; undo puts it back whole", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [200, 168], stroke: 1 });
    const json = JSON.stringify(graphOf(core).toJSON());
    for (let x = 0; x <= 12; x++) doze(core, x, 10, 2);
    expect(graphOf(core).segments.size).toBe(0);
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(JSON.stringify(graphOf(core).toJSON())).toBe(json);
    for (let x = 0; x <= 12; x++) expect(isRoadTile(core.map.getTileValue(x, 10))).toBe(true);
  });

  test("a junction tile cleared cuts every road through it, and the cuts replay the same", () => {
    const play = (log?: Array<{ command: any }>) => {
      const core = city();
      const orders = log?.map((l) => l.command) ?? [
        { type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 },
        { type: "road", tool: "road", from: [456, 8], to: [456, 600], stroke: 2 },
        { type: "tool", tool: "bulldozer", x: 28, y: 10, stroke: 3 },
      ];
      for (const order of orders) core.apply(order);
      return core;
    };
    const first = play();
    expect(graphOf(first).segments.size).toBe(4);
    const again = play(first.log);
    expect(JSON.stringify(graphOf(again).toJSON())).toBe(JSON.stringify(graphOf(first).toJSON()));
  });
});

describe("roads drawn in metres that lose a tile some other way", () => {
  /** A tile lost as a flood or a tornado takes it: rubble, or a road fallen apart (src/road.js) */
  const lose = (core: CityCore, x: number, y: number) => core.map.setTile(x, y, 44, 0);

  test("are cut there once the city has stepped, the rest staying where it was drawn and drawn from the graph", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [8, 488], to: [904, 488], stroke: 2 });
    lose(core, 28, 10);
    // ... before the step, the stroke is left to its tiles
    expect(drawnRuns(core).map((run) => run.piece)).toEqual([2]);
    core.step();
    const graph = graphOf(core), ends = [...graph.segments.values()].filter((s) => s.piece === 1)
      .flatMap((s) => [graph.node(s.a), graph.node(s.b)]).map((n) => [n.x, n.z]).sort((p, q) => p[0] - q[0]);
    expect(ends).toHaveLength(4);
    expect(ends[0]).toEqual([8, 168]);
    expect(ends[1][0]).toBeCloseTo(448 - 0.25, 2);
    expect(ends[2][0]).toBeCloseTo(464 + 0.25, 2);
    expect(ends[3]).toEqual([904, 168]);
    expect(drawnRuns(core).map((run) => run.piece).sort()).toEqual([1, 1, 2]);
  });

  test("undone with a stroke drawn after the loss, a road cut there is cut there again", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [8, 488], to: [904, 488], stroke: 2 });
    lose(core, 28, 10);
    core.step();
    expect(graphOf(core).segments.size).toBe(3);
    // A third road is drawn, the first is cut where a tile is lost after it, and the third is undone: the graph goes
    // back to before the third, the first whole across the tile still lost, and it is cut there again at once
    core.apply({ type: "road", tool: "road", from: [8, 328], to: [904, 328], stroke: 3 });
    lose(core, 40, 10);
    core.step();
    expect(graphOf(core).segments.size).toBe(5);
    core.apply({ type: "undo" });
    const cut = JSON.stringify(graphOf(core).toJSON());
    expect(graphOf(core).segments.size).toBe(4);
    expect(drawnRuns(core).map((run) => run.piece).sort()).toEqual([1, 1, 1, 2]);
    core.step();
    expect(JSON.stringify(graphOf(core).toJSON())).toBe(cut);
  });

  test("a tile a road was never laid on is not cut for", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    // A road put straight into the graph over tiles never laid (as a save from before might hold one)
    graphOf(core).add({ from: [8, 328], to: [904, 328], level: 1, piece: 9 });
    const json = JSON.stringify(graphOf(core).toJSON());
    core.step();
    expect(JSON.stringify(graphOf(core).toJSON())).toBe(json);
  });
});
