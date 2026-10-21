/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every ruler's building kept in a save as gameMap.buildings, with its kind and level, in place of the records kept by
// tile and the poses kept beside them (src/buildings/buildingRecords.ts; docs/METRE_DRAWING_PLAN.md 2.6); an older
// save's buildings taken from its tiles and poses once.

import type { PlacedBuildings } from "../src/buildings/placedBuildings";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}
const placed = (core: CityCore): PlacedBuildings => (core.map as any).buildings;
const reopen = (saved: Record<string, unknown>): CityCore =>
  new CityCore({ sandbox: true, map: new (GameMap as any)(60, 40), saved: JSON.parse(JSON.stringify({ ...saved, width: 60, height: 40 })) });
const at = (x: number, y: number): number => y * 60 + x;

describe("buildings kept in saves", () => {
  test("every building, put down in metres or by a tool, is kept with its kind and level, and nothing by tile", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    // A gas plant and a school by tool commands, the school's one with a pose (world units)
    expect(core.apply({ type: "tool", tool: "gas", x: 40, y: 10, stroke: 2 }).toolResult).toBe(0);
    expect(core.apply({ type: "tool", tool: "kindergarten", x: 10, y: 30, pose: [62.5, 190, 1.2], stroke: 3 }).toolResult).toBe(0);
    // ... and a fire post, the first level of a fire station
    expect(core.apply({ type: "tool", tool: "fire_post", x: 25, y: 20, stroke: 4 }).toolResult).toBe(0);
    const saved = core.save() as any;
    for (const field of ["powerKinds", "mineKinds", "civicKinds", "wasteKinds", "stationKinds", "buildingLevels", "buildingPoses"]) {
      expect(saved[field]).toBeUndefined();
    }
    expect(saved.buildings.all).toBe(true);
    const rows = saved.buildings.buildings.map((r: unknown[]) => [r[1], r[2], r[3], r[4], r[6], r[7], r[8]]);
    expect(rows).toEqual(expect.arrayContaining([
      // The police station still where it was put down
      ["police", 330.4, 251.7, 0.5, at(20, 15), "", 2],
      ["fire_post", 25 * 16 + 8, 20 * 16 + 8, null, at(25, 20), "", 1],
      // The gas plant at its block's middle, not yet turned (the view stands it against its road): an early era's
      // gas plant takes a 2 x 2, 39..40 x 9..10 (src/plantBlocks.ts)
      ["gas", 40 * 16, 10 * 16, null, at(40, 10), "gas", 0],
      ["kindergarten", 100, 304, 1.2, at(10, 30), "kindergarten", 0],
    ]));
    expect(rows).toHaveLength(4);
    // Opened again: the records by tile as they were
    const again = reopen(saved), map = again.map as any;
    expect(map.powerKinds).toEqual({ [at(40, 10)]: "gas" });
    expect(map.civicKinds).toEqual({ [at(10, 30)]: "kindergarten" });
    expect(map.buildingLevels).toEqual({ [at(20, 15)]: 2, [at(25, 20)]: 1 });
    expect(JSON.stringify(placed(again).toJSON())).toBe(JSON.stringify(placed(core).toJSON()));
  });

  test("undo takes a building put down by a tool away with its record", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    core.apply({ type: "tool", tool: "gas", x: 40, y: 10, stroke: 2 });
    expect(placed(core).atTile(at(40, 10))?.tool).toBe("gas");
    core.apply({ type: "undo" });
    expect(placed(core).all()).toEqual([{ id: 1, tool: "police", x: 330.4, z: 251.7, rot: 0.5, size: 3, tile: at(20, 15) }]);
  });

  test("an older save's buildings are taken from its tiles, kinds and poses, once", () => {
    const core = city();
    core.apply({ type: "tool", tool: "gas", x: 40, y: 10, stroke: 1 });
    core.apply({ type: "tool", tool: "landfill", x: 10, y: 30, stroke: 2 });
    core.apply({ type: "tool", tool: "fire_post", x: 25, y: 30, stroke: 3 });
    const saved = core.save() as any;
    // As a save from before step 2.6 kept them: no buildings, the records and poses by tile
    delete saved.buildings;
    Object.assign(saved, { powerKinds: { [at(40, 10)]: "gas" }, wasteKinds: { [at(10, 30)]: "landfill" },
      buildingLevels: { [at(25, 30)]: 1 }, buildingPoses: { [at(10, 30)]: [70, 195, 0.3] } });
    const again = reopen(saved);
    const got = placed(again).all().map((b) => [b.tool, b.x, b.z, b.rot, b.size, b.tile]);
    expect(got).toEqual(expect.arrayContaining([
      ["gas", 640, 160, null, 2, at(40, 10)],
      ["landfill", 112, 312, 0.3, 3, at(10, 30)],
      ["fire_post", 25 * 16 + 8, 30 * 16 + 8, null, 3, at(25, 30)],
    ]));
    expect(got).toHaveLength(3);
    expect((again.map as any).powerKinds).toEqual({ [at(40, 10)]: "gas" });
    // ... and saved again the new way
    expect((again.save() as any).buildings.all).toBe(true);
  });
});
