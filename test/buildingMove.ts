/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A building the player moves (the "move" command; docs/METRE_DRAWING_PLAN.md 2.5): slid or turned within the block it
// stands on, for a tenth of its price, and put back by undo with the money.

import type { PlacedBuildings } from "../src/buildings/placedBuildings";
import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";

function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(100000);
  (core.map as any).needsRulerHouse = false;
  return core;
}
const placed = (core: CityCore): PlacedBuildings => (core.map as any).buildings;
const funds = (core: CityCore): number => core.simulation.budget.totalFunds;

describe("moving a building", () => {
  test("slid and turned on its block for a tenth of its price; its tiles stay", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    const before = funds(core), tiles = [...Array(9)].map((_, i) => core.map.getTileValue(19 + i % 3, 14 + Math.floor(i / 3)));
    const out = core.apply({ type: "move", id: 1, x: 334, z: 250, rot: 1.25, stroke: 2 });
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    expect(placed(core).get(1)).toMatchObject({ x: 334, z: 250, rot: 1.25, tile: 15 * 60 + 20 });
    expect(before - funds(core)).toBe(50);
    expect([...Array(9)].map((_, i) => core.map.getTileValue(19 + i % 3, 14 + Math.floor(i / 3)))).toEqual(tiles);
    // Undo: where it was, and the money back
    core.apply({ type: "undo" });
    expect(placed(core).get(1)).toMatchObject({ x: 330.4, z: 251.7, rot: 0.5 });
    expect(funds(core)).toBe(before);
  });

  test("a move off its block, or of a building that is not there, is refused", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    expect(core.apply({ type: "move", id: 1, x: 400, z: 251.7, rot: 0.5 })).toMatchObject({ accepted: false, reason: "off its block" });
    expect(core.apply({ type: "move", id: 7, x: 330, z: 251, rot: 0 })).toMatchObject({ accepted: false });
    expect(placed(core).get(1)).toMatchObject({ x: 330.4, z: 251.7, rot: 0.5 });
  });

  test("moves replay into the same city and are saved", () => {
    const core = city();
    core.apply({ type: "build", tool: "fire", x: 600, z: 400, rot: 0, stroke: 1 });
    expect(core.apply({ type: "move", id: 1, x: 604.5, z: 402, rot: 3, stroke: 2 }).accepted).toBe(true);
    const again = city();
    for (const { command } of core.log) again.apply(command as any);
    expect(JSON.stringify(placed(again).toJSON())).toBe(JSON.stringify(placed(core).toJSON()));
    expect((core.save() as any).buildings.buildings[0].slice(1, 5)).toEqual(["fire", 604.5, 402, 3]);
  });
});
