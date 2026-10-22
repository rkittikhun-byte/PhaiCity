/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Drawing roads in metres (src/roads/roadDraw.ts, the road and railway tools in src/game.js; docs/METRE_DRAWING_PLAN.md
// 1.5): the line the clicks make, the tiles the command will lay, the price by the metre and a road drawn too close
// alongside another.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { alongside, lineLength, lineOfPoints, linePrice, lineTiles, type Metres } from "../src/roads/roadDraw";
import { isRoadTile } from "../src/roadTiles";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city(funds = 1000000) {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(funds);
  return core;
}
const SIZE = { width: 60, height: 40, tileSizeM: 16 };

describe("drawing roads in metres", () => {
  test("two points make a straight road, three a curve bent towards the middle one, four an S", () => {
    expect(lineOfPoints([[10, 10]])).toBeNull();
    expect(lineOfPoints([[10.004, 10], [100, 50]])).toEqual({ from: [10, 10], to: [100, 50] });
    // The quadratic curve through (0, 0), (90, 0), (90, 90) as a cubic: the same curve
    const curve = lineOfPoints([[0, 0], [90, 0], [90, 90]])!;
    expect(curve.c1).toEqual([60, 0]);
    expect(curve.c2).toEqual([90, 30]);
    expect(lineOfPoints([[0, 0], [30, 0], [60, 90], [90, 90]])).toEqual({ from: [0, 0], to: [90, 90], c1: [30, 0], c2: [60, 90] });
  });

  test("the preview's tiles are the very tiles the road command lays", () => {
    for (const points of [[[3, 170], [701, 431]], [[40, 600], [300, 20], [880, 40]], [[8, 8], [400, 600], [500, 0], [900, 500]]] as Metres[][]) {
      const core = city(), line = lineOfPoints(points)!;
      core.apply({ type: "road", tool: "road", ...line, stroke: 1 });
      const laid: number[] = [];
      for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) if (isRoadTile(core.map.getTileValue(x, y))) laid.push(y * 60 + x);
      expect([...new Set(lineTiles(line, SIZE))].sort((a, b) => a - b)).toEqual(laid);
    }
  });

  test("a road costs by its length, not its staircase of tiles: a slanted one as much as a straight one as long", () => {
    // Laterite (฿10 a tile, 16 m): 800 m is 50 tiles' worth
    const straight = city(), slanted = city();
    const before = straight.simulation.budget.totalFunds;
    straight.apply({ type: "road", tool: "road", from: [24, 168], to: [824, 168], stroke: 1 });
    const along = before - straight.simulation.budget.totalFunds;
    const d = 800 / Math.SQRT2;
    slanted.apply({ type: "road", tool: "road", from: [40, 40], to: [40 + d, 40 + d], stroke: 1 });
    const across = before - slanted.simulation.budget.totalFunds;
    expect(along).toBe(500);
    expect(across).toBe(500);
    // ... far less than its tiles one by one, about one and a half as many
    let tiles = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) if (isRoadTile(slanted.map.getTileValue(x, y))) tiles++;
    expect(tiles * 10).toBeGreaterThan(across * 1.3);
    // ... and undo gives back what was paid
    slanted.apply({ type: "undo" });
    expect(slanted.simulation.budget.totalFunds).toBe(before);
  });

  test("the price by the metre: new ground at the tile price a tile's length, what a tile costs more on top", () => {
    expect(linePrice(10, 16, 160, Array(11).fill(10))).toBe(100);
    // A road across an old one (that tile free) pays for the share of its length on new ground
    expect(linePrice(10, 16, 160, [...Array(10).fill(10), 0])).toBe(91);
    // A bridge tile costs five times a tile
    expect(linePrice(10, 16, 160, [...Array(10).fill(10), 50])).toBe(140);
    expect(linePrice(10, 16, 0, [])).toBe(0);
  });

  test("a road drawn alongside another closer than a tile is too close; one crossing it or meeting it is not", () => {
    const old: Metres[][] = [[[0, 200], [900, 200]]];
    expect(alongside({ from: [100, 210], to: [800, 210] }, old, 16).length).toBeGreaterThan(0);
    expect(alongside({ from: [100, 230], to: [800, 230] }, old, 16)).toEqual([]);
    expect(alongside({ from: [400, 0], to: [400, 600] }, old, 16)).toEqual([]);
    expect(alongside({ from: [400, 600], to: [400, 200] }, old, 16)).toEqual([]);
    expect(lineLength({ from: [0, 0], to: [30, 40] })).toBeCloseTo(50);
  });

  test("a grid's rows and columns are lines of their own; a line drawn freely, road after road, is one", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [408, 168], stroke: 1, part: 0 });
    core.apply({ type: "road", tool: "road", from: [200, 40], to: [200, 400], stroke: 1, part: 1 });
    const graph = (core.map as any).roadGraph;
    const pieces = new Set([...graph.segments.values()].map((s: any) => s.piece));
    expect(pieces.size).toBe(2);
    const free = city();
    free.apply({ type: "road", tool: "road", from: [8, 168], to: [100, 168], stroke: 4 });
    free.apply({ type: "road", tool: "road", from: [100, 168], to: [190, 200], stroke: 4 });
    free.apply({ type: "road", tool: "road", from: [190, 200], to: [290, 200], stroke: 4 });
    const freeGraph = (free.map as any).roadGraph;
    expect(new Set([...freeGraph.segments.values()].map((s: any) => s.piece)).size).toBe(1);
    const paths = Object.values((free.map as any).roadPaths as Record<string, { shape?: string }>);
    expect(paths.map((p) => p.shape)).toEqual(["free"]);
  });
});
