/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's buildings put down in metres (the "build" command, src/buildings/placedBuildings.ts;
// docs/METRE_DRAWING_PLAN.md 2.1): its tiles the block round the tile its middle lies on, never another place, kept
// where it was put, saved, and taken away again by undo.

import { blockOf, PlacedBuildings } from "../src/buildings/placedBuildings";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}
const placed = (core: CityCore): PlacedBuildings => (core.map as any).buildings;

describe("buildings put down in metres", () => {
  test("a building's block is the one round the tile its middle lies on", () => {
    expect(blockOf(10.2 * 16, 7.9 * 16, 3, 16)).toEqual({ left: 9, top: 6, cx: 10, cy: 7 });
    // An even block's middle is a tile corner: the nearest
    expect(blockOf(10.2 * 16, 7.9 * 16, 4, 16)).toEqual({ left: 8, top: 6, cx: 9, cy: 7 });
    expect(blockOf(10.2 * 16, 7.9 * 16, 1, 16)).toEqual({ left: 10, top: 7, cx: 10, cy: 7 });
  });

  test("a police station put down in metres stands on the block under its middle, kept to the centimetre with its pose", () => {
    const core = city();
    const out = core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    // Middle (20.65, 15.73) tiles: the block round tile (20, 15), 19–21 × 14–16
    const { cx, cy } = blockOf(330.4, 251.7, 3, 16);
    expect([cx, cy]).toEqual([20, 15]);
    expect(core.map.getTile(cx, cy).isZone()).toBe(true);
    expect(placed(core).all()).toEqual([{ id: 1, tool: "police", x: 330.4, z: 251.7, rot: 0.5, size: 3, tile: 15 * 60 + 20 }]);
    // ... and the 3D view's pose for it, in world units (10 a 16 m tile)
    expect((core.map as any).buildingPoses[15 * 60 + 20]).toEqual([206.5, 157.31, 0.5]);
  });

  test("a building whose block is taken is refused there, not moved to another", () => {
    const core = city();
    for (let x = 10; x < 30; x++) core.apply({ type: "tool", tool: "road", x, y: 15 });
    const out = core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0, stroke: 1 });
    expect(out.toolResult).not.toBe(0);
    expect(placed(core)?.size ?? 0).toBe(0);
    for (let x = 10; x < 30; x++) expect(core.map.getTileValue(x, 14)).toBe(0);
  });

  test("undo takes the building away with its tiles; a save keeps the ones standing", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    core.apply({ type: "build", tool: "fire", x: 600, z: 400, rot: 1, stroke: 2 });
    expect(placed(core).size).toBe(2);
    expect(core.apply({ type: "undo" }).undone).toBe(true);
    expect(placed(core).all().map((b) => b.tool)).toEqual(["police"]);
    expect(core.map.getTileValue(...[blockOf(600, 400, 3, 16)].map((b) => [b.cx, b.cy])[0] as [number, number])).toBe(0);
    core.apply({ type: "build", tool: "fire", x: 600, z: 400, rot: 1, stroke: 3 });
    // The police station bulldozed: not kept
    core.apply({ type: "tool", tool: "bulldozer", x: 20, y: 15 });
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: 60, height: 40 }));
    const again = new CityCore({ map: new (GameMap as any)(60, 40), saved });
    expect(placed(again).all().map((b) => [b.tool, b.x, b.z, b.rot])).toEqual([["fire", 600, 400, 1]]);
  });

  test("the same build commands replay into the same city", () => {
    const play = (log?: { step: number; command: any }[]) => {
      const core = city();
      const orders = log ?? [
        { step: 0, command: { type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 } },
        { step: 2, command: { type: "build", tool: "police", x: 330.4, z: 210.2, rot: 0, stroke: 2 } },
        { step: 5, command: { type: "build", tool: "coal", x: 700.5, z: 216, rot: 0, stroke: 3 } },
      ];
      let next = 0;
      for (let step = 0; step < 60; step++) {
        while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
        core.step();
      }
      let tiles = 0;
      for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) tiles = (tiles * 31 + core.map.getTileValue(x, y)) >>> 0;
      return { core, tiles, buildings: JSON.stringify(placed(core).toJSON()) };
    };
    const first = play(), again = play(first.core.log);
    expect(placed(first.core).size).toBe(2);
    expect(again.tiles).toBe(first.tiles);
    expect(again.buildings).toBe(first.buildings);
  });
});
