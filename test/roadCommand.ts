/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A road drawn in metres (the "road" command, src/cityCommands.ts; docs/METRE_DRAWING_PLAN.md 1.3): laid on the
// tiles its middle line passes, as the road tool lays them, and kept as drawn in the map's road graph.

import { commandProblem } from "../src/cityCommands";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { isRoadTile } from "../src/roadTiles";
import type { RoadGraph } from "../src/roads/roadGraph";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city(funds = 100000) {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(funds);
  return core;
}

const roadAt = (core: CityCore, x: number, y: number): boolean => isRoadTile(core.map.getTileValue(x, y));
const graphOf = (core: CityCore): RoadGraph => (core.map as any).roadGraph;

describe("road command", () => {
  test("a straight road in metres lays the row of tiles under it and is kept as drawn", () => {
    const core = city();
    const out = core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    expect(out.accepted).toBe(true);
    for (let x = 0; x <= 56; x++) expect(roadAt(core, x, 10)).toBe(true);
    expect(roadAt(core, 57, 10)).toBe(false);
    expect(graphOf(core).segments.size).toBe(1);
    // ... and its piece keeps the line as drawn for when it is drawn from its tiles (bulldozed in part)
    const paths = Object.values((core.map as any).roadPaths as Record<string, { shape?: string; controls?: number[][] }>);
    expect(paths.some(p => p.shape === "straight" && p.controls?.[0][0] === 0 && p.controls?.[1][0] === 56)).toBe(true);
  });

  test("a slanted road is a chain of road tiles joined side to side", () => {
    const core = city();
    expect(core.apply({ type: "road", tool: "road", from: [40, 40], to: [700, 420], stroke: 2 }).accepted).toBe(true);
    const tiles: [number, number][] = [];
    for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) if (roadAt(core, x, y)) tiles.push([x, y]);
    expect(tiles.length).toBeGreaterThan(60);
    // Each road tile has a road beside it, north, east, south or west
    for (const [x, y] of tiles) {
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => roadAt(core, x + dx, y + dy))).toBe(true);
    }
  });

  test("a road across another splits both in the graph and lays the crossing", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    expect(core.apply({ type: "road", tool: "road", from: [312, 8], to: [312, 600], stroke: 2 }).accepted).toBe(true);
    expect(graphOf(core).segments.size).toBe(4);
    expect(roadAt(core, 19, 10)).toBe(true);
  });

  test("a road the money runs out on is laid as far as it goes and not kept as drawn", () => {
    const core = city(60);
    const out = core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    expect(out.accepted).toBe(true);
    expect(out.reason).toBeDefined();
    expect(roadAt(core, 0, 10)).toBe(true);
    expect(roadAt(core, 56, 10)).toBe(false);
    // ... its tiles are in the graph as a road of tiles (docs/NO_GRID_PLAN.md 0.1), not as the road drawn
    expect([...(graphOf(core)?.segments.values() ?? [])].filter((s) => !s.traced)).toHaveLength(0);
  });

  test("bad roads are refused before anything is laid", () => {
    expect(commandProblem({ type: "road", tool: "road", from: [0, 0], to: [10, 10] }, 60, 40)).toBe("bad stroke");
    expect(commandProblem({ type: "road", tool: "road", from: [0, -1], to: [10, 10], stroke: 1 }, 60, 40)).toBe("bad ends");
    expect(commandProblem({ type: "road", tool: "road", from: [0, 0], to: [10, 10], c1: [5, 5], stroke: 1 }, 60, 40))
      .toBe("a curve needs both control points");
    const core = city();
    expect(core.apply({ type: "road", tool: "road", from: [8, 8], to: [5000, 8], stroke: 1 }).accepted).toBe(false);
    expect(core.apply({ type: "road", tool: "police", from: [8, 8], to: [200, 8], stroke: 1 }).accepted).toBe(false);
  });

  test("the same road commands replay into the same city", () => {
    const play = (log?: { step: number; command: any }[]) => {
      const core = city();
      const orders = log ?? [
        { step: 0, command: { type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 } },
        { step: 3, command: { type: "road", tool: "road", from: [40, 600], to: [880, 40], c1: [300, 0], c2: [600, 640], stroke: 2 } },
        { step: 9, command: { type: "road", tool: "road", from: [312, 8], to: [312, 600], stroke: 3 } },
      ];
      let next = 0;
      for (let step = 0; step < STEPS_PER_YEAR / 4; step++) {
        while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
        core.step();
      }
      let tiles = 0;
      for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) tiles = (tiles * 31 + core.map.getTileValue(x, y)) >>> 0;
      return { core, tiles, graph: JSON.stringify(graphOf(core).toJSON()), funds: core.simulation.budget.totalFunds };
    };
    const first = play();
    expect(first.core.log.map(l => l.command.type)).toEqual(["road", "road", "road"]);
    const again = play(first.core.log);
    expect(again.tiles).toBe(first.tiles);
    expect(again.graph).toBe(first.graph);
    expect(again.funds).toBe(first.funds);
  });
});

describe("undoing a road drawn in metres (metre plan 1.7)", () => {
  const json = (core: CityCore): string => JSON.stringify((core.map as any).roadGraph?.toJSON() ?? null);
  const tiles = (core: CityCore): number => {
    let hash = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) hash = (hash * 31 + core.map.getTileValue(x, y)) >>> 0;
    return hash;
  };

  test("undo takes a road back whole: its tiles, its money and the graph as it was, the road it crossed whole again", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    const graph1 = json(core), tiles1 = tiles(core), funds1 = core.simulation.budget.totalFunds;
    core.apply({ type: "road", tool: "road", from: [40, 600], to: [880, 40], c1: [300, 0], c2: [600, 640], stroke: 2 });
    expect(graphOf(core).segments.size).toBeGreaterThan(3);
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(json(core)).toBe(graph1);
    expect(tiles(core)).toBe(tiles1);
    expect(core.simulation.budget.totalFunds).toBe(funds1);
    // ... and the first one too, back to no roads at all
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(graphOf(core).segments.size).toBe(0);
    expect(graphOf(core).nodes.size).toBe(0);
    // A road drawn again after undo takes the ids the first had (its stroke's piece is a new one)
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 3 });
    const again = graphOf(core);
    expect([...again.nodes.values()].map((n) => [n.id, n.x, n.z])).toEqual([[1, 8, 168], [2, 904, 168]]);
    expect([...again.segments.keys()]).toEqual([1]);
  });

  test("a road drawn freely, road after road in one stroke, is undone as one, and a bulldozed tile between does not upset it", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    const graph1 = json(core);
    core.apply({ type: "road", tool: "road", from: [100, 40], to: [120, 300], stroke: 2 });
    core.apply({ type: "road", tool: "road", from: [120, 300], to: [200, 500], stroke: 2 });
    core.apply({ type: "road", tool: "road", from: [200, 500], to: [400, 520], stroke: 2 });
    core.apply({ type: "tool", tool: "bulldozer", x: 50, y: 10, stroke: 3 });
    core.apply({ type: "road", tool: "road", from: [600, 40], to: [600, 600], stroke: 1 });
    // The last road (stroke 1 again), the bulldozer, then the free one, each its own step
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(json(core)).toBe(graph1);
  });

  test("undo in a replay comes out the same", () => {
    const play = (log?: { step: number; command: any }[]) => {
      const core = city();
      const orders = log ?? [
        { step: 0, command: { type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 } },
        { step: 2, command: { type: "road", tool: "road", from: [312, 8], to: [312, 600], stroke: 2 } },
        { step: 4, command: { type: "undo" } },
        { step: 6, command: { type: "road", tool: "road", from: [500, 8], to: [520, 600], stroke: 3 } },
      ];
      let next = 0;
      for (let step = 0; step < 40; step++) {
        while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
        core.step();
      }
      return { core, graph: json(core), tiles: tiles(core) };
    };
    const first = play(), again = play(first.core.log);
    expect(again.graph).toBe(first.graph);
    expect(again.tiles).toBe(first.tiles);
    // The first road split by the third, the second gone
    expect(graphOf(first.core).segments.size).toBe(4);
    expect([...graphOf(first.core).nodes.values()].some((n) => n.x === 312)).toBe(false);
  });
});
