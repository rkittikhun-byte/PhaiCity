/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The upgrade tool's whole-road mode (src/roads/wholeRoad.ts, src/drawModes.ts; docs/METRE_DRAWING_PLAN.md step 1's
// leftovers): a click takes the road under it from junction to junction, its own mode kept apart from the roads'.

import { CityCore } from "../src/core/cityCore";
import { drawModeOf, isClickMode, isStraightMode, modesFor, POINTS_NEEDED, setDrawMode } from "../src/drawModes";
import { MapGenerator } from "../src/mapGenerator.js";
import { UPGRADE_TOOL } from "../src/roadLevels";
import { wholeRoadTiles } from "../src/roads/wholeRoad";

function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(100000);
  return core;
}

describe("the upgrade tool's whole road", () => {
  test("a drawn road from the junction to its end, every tile of it and none of the road it meets", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [456, 8], to: [456, 600], stroke: 2 });
    // East of the junction at x 456 m, on the first road
    const tiles = wholeRoadTiles(core.map as any, 700, 168, 43, 10);
    const xs = tiles.map((i) => i % 60).sort((p, q) => p - q);
    expect(tiles.every((i) => Math.floor(i / 60) === 10)).toBe(true);
    expect(xs[0]).toBe(28);
    expect(xs[xs.length - 1]).toBe(56);
    // ... and upgraded tile by tile, the whole of it rises
    for (const i of tiles) core.apply({ type: "tool", tool: UPGRADE_TOOL as any, x: i % 60, y: 10, stroke: 3 });
    expect(tiles.every((i) => (core.map as any).roadLevels[i] === 2)).toBe(true);
    expect((core.map as any).roadLevels[10 * 60 + 10]).toBe(1);
  });

  test("a road of tiles only: its stretch", () => {
    const core = city();
    for (let x = 5; x < 20; x++) core.apply({ type: "tool", tool: "road", x, y: 30 });
    const tiles = wholeRoadTiles(core.map as any, 10 * 16 + 8, 30 * 16 + 8, 10, 30);
    expect(tiles.map((i) => i % 60).sort((p, q) => p - q)).toEqual([...Array(15)].map((_, k) => 5 + k));
    expect(wholeRoadTiles(core.map as any, 8, 8, 0, 0)).toEqual([]);
  });

  test("its mode is its own: the roads never take the whole-road mode", () => {
    expect(modesFor(UPGRADE_TOOL)).toContain("fill");
    expect(modesFor("road")).not.toContain("fill");
    setDrawMode("road", "curve");
    setDrawMode(UPGRADE_TOOL, "fill");
    expect(drawModeOf(UPGRADE_TOOL)).toBe("fill");
    expect(drawModeOf("road")).toBe("curve");
    setDrawMode("road", "fill");
    expect(drawModeOf("road")).toBe("curve");
  });

  test("the roads, railways and canals draw a chain of straight lines too (metre plan 1.5), which the upgrade tool does not", () => {
    for (const tool of ["road", "rail", "canal"]) expect(modesFor(tool)).toContain("chain");
    expect(modesFor(UPGRADE_TOOL)).not.toContain("chain");
    expect(POINTS_NEEDED.chain).toBe(2);
    expect(isClickMode("chain") && isStraightMode("chain") && isStraightMode("straight") && !isStraightMode("curve")).toBe(true);
    setDrawMode(UPGRADE_TOOL, "chain");
    expect(drawModeOf(UPGRADE_TOOL)).toBe("fill");
  });
});
