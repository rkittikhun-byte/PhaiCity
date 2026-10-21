/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A building the player moves (the "move" command; docs/METRE_DRAWING_PLAN.md 2.5): slid or turned on the block it
// stands on, or taken with its tiles and everything kept by its centre tile to another block where it could be built,
// for a tenth of its price, and put back by undo with the money.

import type { PlacedBuildings } from "../src/buildings/placedBuildings";
import { NEEDS_ROAD_BESIDE } from "../src/cityCommands";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { buildingAt, MOVE_BLOCKED, movePrice, NO_BUILDING } from "../src/moveTool";
import { houseStanding, NEEDS_ROAD } from "../src/rulerHouse";
import { DIRT, RIVER, WOODS } from "../src/tileValues";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(100000);
  (core.map as any).needsRulerHouse = false;
  return core;
}
const placed = (core: CityCore): PlacedBuildings => (core.map as any).buildings;
const funds = (core: CityCore): number => core.simulation.budget.totalFunds;
const mapOf = (core: CityCore): any => core.map;
const at = (x: number, y: number): number => y * 60 + x;
/** The tiles (value and flags) of the block size tiles a side whose top left is (left, top), row by row */
const block = (core: CityCore, left: number, top: number, size: number): number[] =>
  [...Array(size * size)].map((_, i) => core.map.getTile(left + i % size, top + Math.floor(i / size)).getRawValue());
const bare = (size: number): number[] => Array(size * size).fill(DIRT);
/** Every tile of the map */
const allTiles = (core: CityCore): number[] => [...Array(60 * 40)].map((_, i) => core.map.getTile(i % 60, Math.floor(i / 60)).getRawValue());
const reopen = (saved: Record<string, unknown>): CityCore =>
  new CityCore({ sandbox: true, map: new (GameMap as any)(60, 40), saved: JSON.parse(JSON.stringify({ ...saved, width: 60, height: 40 })) });
/** What a move changes, to tell two cities apart */
const state = (core: CityCore) => {
  const m = mapOf(core);
  return { tiles: allTiles(core), buildings: JSON.stringify(placed(core).toJSON()),
    powerKinds: m.powerKinds, civicKinds: m.civicKinds, wasteKinds: m.wasteKinds, buildingLevels: m.buildingLevels,
    rulerHouse: m.rulerHouse, town: m.town };
};
/** A road along row y, from x0 up to x1 */
const road = (core: CityCore, y: number, x0: number, x1: number): void => {
  for (let x = x0; x <= x1; x++) core.apply({ type: "tool", tool: "road", x, y });
};

describe("moving a building on its block", () => {
  test("slid and turned on its block for a tenth of its price; its tiles stay", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    const before = funds(core), tiles = block(core, 19, 14, 3);
    const out = core.apply({ type: "move", id: 1, x: 334, z: 250, rot: 1.25, stroke: 2 });
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    expect(placed(core).get(1)).toMatchObject({ x: 334, z: 250, rot: 1.25, tile: 15 * 60 + 20 });
    expect(before - funds(core)).toBe(50);
    expect(block(core, 19, 14, 3)).toEqual(tiles);
    // Undo: where it was, and the money back
    core.apply({ type: "undo" });
    expect(placed(core).get(1)).toMatchObject({ x: 330.4, z: 251.7, rot: 0.5 });
    expect(funds(core)).toBe(before);
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

describe("moving a building to another block", () => {
  test("a power plant takes its tiles, its kind and its era along, and one undo puts it all back", () => {
    const core = city(), m = mapOf(core);
    // A gas plant on the block 39-42 x 9-12, its centre (40, 10), in the third era
    core.apply({ type: "build", tool: "gas", x: 656, z: 176, rot: 0, stroke: 1 });
    const from = at(40, 10), to = at(49, 10), tiles = block(core, 39, 9, 4);
    expect(m.powerKinds).toEqual({ [from]: "gas" });
    m.buildingEras = new Uint8Array(60 * 40);
    m.buildingEras[from] = 3;
    const before = funds(core);
    // ... to the block 48-51 x 9-12
    const out = core.apply({ type: "move", id: 1, x: 800, z: 180, rot: 1.5, stroke: 2 });
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    expect(before - funds(core)).toBe(movePrice(core.tools.gas));
    expect(block(core, 48, 9, 4)).toEqual(tiles);
    expect(block(core, 39, 9, 4)).toEqual(bare(4));
    expect(placed(core).get(1)).toMatchObject({ x: 800, z: 180, rot: 1.5, tile: to });
    expect(placed(core).atTile(from)).toBeUndefined();
    expect(placed(core).atTile(to)?.id).toBe(1);
    expect(m.powerKinds).toEqual({ [to]: "gas" });
    expect([m.buildingEras[from], m.buildingEras[to]]).toEqual([0, 3]);
    // Undo: the tiles, the records, where it stood and the money
    expect(core.apply({ type: "undo" })).toMatchObject({ undone: true });
    expect(block(core, 39, 9, 4)).toEqual(tiles);
    expect(block(core, 48, 9, 4)).toEqual(bare(4));
    expect(placed(core).get(1)).toMatchObject({ x: 656, z: 176, rot: 0, tile: from });
    expect(placed(core).atTile(to)).toBeUndefined();
    expect(m.powerKinds).toEqual({ [from]: "gas" });
    expect([m.buildingEras[from], m.buildingEras[to]]).toEqual([3, 0]);
    expect(funds(core)).toBe(before);
  });

  test("a move a tile over, onto its own tiles, lifts them first", () => {
    const core = city();
    core.apply({ type: "build", tool: "gas", x: 656, z: 176, rot: 0, stroke: 1 });
    const tiles = block(core, 39, 9, 4), before = block(core, 39, 9, 5);
    expect(core.apply({ type: "move", id: 1, x: 672, z: 176, rot: 0, stroke: 2 }).accepted).toBe(true);
    expect(block(core, 40, 9, 4)).toEqual(tiles);
    expect([9, 10, 11, 12].map((y) => core.map.getTile(39, y).getRawValue())).toEqual([DIRT, DIRT, DIRT, DIRT]);
    core.apply({ type: "undo" });
    expect(block(core, 39, 9, 5)).toEqual(before);
  });

  test("a school and a fire post take their kind and level along, and stay the same objects", () => {
    const core = city(), m = mapOf(core);
    // A kindergarten centred on (10, 30) and a fire post centred on (25, 20)
    core.apply({ type: "build", tool: "kindergarten", x: 168, z: 488, rot: 0, stroke: 1 });
    core.apply({ type: "build", tool: "fire_post", x: 408, z: 328, rot: 0, stroke: 2 });
    expect(m.civicKinds).toEqual({ [at(10, 30)]: "kindergarten" });
    expect(m.buildingLevels).toEqual({ [at(25, 20)]: 1 });
    core.objects.scan(core.map, 5);
    const school = block(core, 9, 29, 3);
    expect(core.apply({ type: "move", id: 1, x: 264, z: 488, rot: 0.7, stroke: 3 }).accepted).toBe(true);
    expect(core.apply({ type: "move", id: 2, x: 408, z: 520, rot: 0, stroke: 4 }).accepted).toBe(true);
    expect(block(core, 15, 29, 3)).toEqual(school);
    expect(m.civicKinds).toEqual({ [at(16, 30)]: "kindergarten" });
    expect(m.buildingLevels).toEqual({ [at(25, 32)]: 1 });
    // The same buildings, built when they were: nothing new, nothing gone
    const { added, removed } = core.objects.scan(core.map, 9);
    expect([added, removed]).toEqual([[], []]);
    expect(core.objects.at(16, 30)).toMatchObject({ built: 5, kind: "civic", id: at(16, 30) });
    expect(core.objects.at(16, 30)?.placed?.id).toBe(1);
    expect(core.objects.at(25, 32)?.built).toBe(5);
    expect(core.objects.at(10, 30)).toBeNull();
    // Each move is a step of its own
    core.apply({ type: "undo" });
    expect(m.buildingLevels).toEqual({ [at(25, 20)]: 1 });
    expect(m.civicKinds).toEqual({ [at(16, 30)]: "kindergarten" });
    core.apply({ type: "undo" });
    expect(m.civicKinds).toEqual({ [at(10, 30)]: "kindergarten" });
    expect(block(core, 9, 29, 3)).toEqual(school);
  });

  test("the ruler's house takes its wings, the town and the camera's home along, and keeps to its road", () => {
    const homes: Array<[number, number]> = [];
    const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    map.tileSizeM = 16;
    const core = new CityCore({ sandbox: true, map, seed: 11, hooks: { houseBuilt: (x, y) => homes.push([x, y]) } });
    core.simulation.budget.setFunds(100000);
    const m = mapOf(core);
    road(core, 20, 5, 40);
    // The house centred on (10, 18), its block 9-11 x 17-19 against the road on row 20
    expect(core.apply({ type: "build", tool: "ruler_house", x: 168, z: 296, rot: 0, stroke: 1 }).toolResult).toBe(0);
    expect(houseStanding(m)).toBe(true);
    m.rulerHouse.level = 3;
    m.rulerHouse.wings = ["treasury", "granary"];
    expect(m.town).toEqual({ x: 10, y: 18 });
    // Away from the road it may not go
    expect(core.apply({ type: "move", id: 1, x: 488, z: 100, rot: 0 })).toMatchObject({ accepted: false, reason: NEEDS_ROAD });
    // ... along it, it may
    expect(core.apply({ type: "move", id: 1, x: 488, z: 296, rot: 0, stroke: 2 }).accepted).toBe(true);
    expect(m.rulerHouse).toEqual({ x: 30, y: 18, level: 3, wings: ["treasury", "granary"] });
    expect(m.town).toEqual({ x: 30, y: 18 });
    expect(m.civicKinds).toEqual({ [at(30, 18)]: "ruler_house" });
    expect(houseStanding(m)).toBe(true);
    expect(homes).toEqual([[10, 18], [30, 18]]);
    core.apply({ type: "undo" });
    expect(m.rulerHouse).toEqual({ x: 10, y: 18, level: 3, wings: ["treasury", "granary"] });
    expect(m.town).toEqual({ x: 10, y: 18 });
    expect(m.civicKinds).toEqual({ [at(10, 18)]: "ruler_house" });
    expect(houseStanding(m)).toBe(true);
    expect(homes).toEqual([[10, 18], [30, 18], [10, 18]]);
  });

  test("moved buildings are saved where they went, with everything kept by their centre, and run on", () => {
    const core = city(), m = mapOf(core);
    road(core, 20, 5, 45);
    core.apply({ type: "build", tool: "ruler_house", x: 168, z: 296, rot: 0, stroke: 1 });
    core.apply({ type: "build", tool: "gas", x: 656, z: 176, rot: 0, stroke: 2 });
    core.apply({ type: "build", tool: "kindergarten", x: 168, z: 488, rot: 0, stroke: 3 });
    core.apply({ type: "build", tool: "landfill", x: 408, z: 488, rot: 0, stroke: 4 });
    m.rulerHouse.wings = [];
    m.buildingEras = new Uint8Array(60 * 40);
    m.buildingEras[at(40, 10)] = 2;
    (core.simulation as any)._waste.fill[at(25, 30)] = 500;
    for (const [id, x, z] of [[1, 488, 296], [2, 800, 180], [3, 264, 488], [4, 600, 488]]) {
      expect(core.apply({ type: "move", id, x, z, rot: 0.25, stroke: 10 + id }).accepted).toBe(true);
    }
    expect((core.simulation as any)._waste.fill).toEqual({ [at(37, 30)]: 500 });
    const saved = core.save() as any, again = reopen(saved), a = mapOf(again);
    expect(JSON.stringify(placed(again).toJSON())).toBe(JSON.stringify(placed(core).toJSON()));
    expect(placed(again).all().map((b) => b.tile)).toEqual([at(30, 18), at(49, 10), at(16, 30), at(37, 30)]);
    expect(a.powerKinds).toEqual({ [at(49, 10)]: "gas" });
    expect(a.civicKinds).toEqual({ [at(30, 18)]: "ruler_house", [at(16, 30)]: "kindergarten" });
    expect(a.wasteKinds).toEqual({ [at(37, 30)]: "landfill" });
    expect(a.rulerHouse).toMatchObject({ x: 30, y: 18 });
    expect(a.town).toEqual({ x: 30, y: 18 });
    expect(houseStanding(a)).toBe(true);
    expect(a.buildingEras[at(49, 10)]).toBe(2);
    expect((again.simulation as any)._waste.fill).toEqual({ [at(37, 30)]: 500 });
    expect(allTiles(again)).toEqual(allTiles(core));
    // A few months on, every one still stands where it went, the gas plant in its era
    again.run(16 * 12);
    expect(placed(again).all().map((b) => again.objects.get(b.tile)?.kind)).toEqual(["civic", "power_plant", "civic", "waste"]);
    expect(a.buildingEras[at(49, 10)]).toBeGreaterThanOrEqual(2);
  });

  test("moves across blocks replay into the same city", () => {
    const core = city();
    road(core, 20, 5, 45);
    core.apply({ type: "build", tool: "ruler_house", x: 168, z: 296, rot: 0, stroke: 1 });
    core.apply({ type: "build", tool: "gas", x: 656, z: 176, rot: 0, stroke: 2 });
    core.apply({ type: "build", tool: "fire_post", x: 408, z: 488, rot: 0, stroke: 3 });
    core.apply({ type: "move", id: 1, x: 488, z: 296, rot: 0, stroke: 4 });
    core.run(40);
    core.apply({ type: "move", id: 2, x: 800, z: 180, rot: 1, stroke: 5 });
    core.apply({ type: "move", id: 3, x: 200, z: 488, rot: 2, stroke: 6 });
    core.apply({ type: "undo" });
    core.apply({ type: "move", id: 3, x: 216, z: 520, rot: 2, stroke: 7 });
    const again = city();
    let step = 0;
    for (const { step: at, command } of core.log) {
      if (at > step) { again.run(at - step); step = at; }
      again.apply(command as any);
    }
    again.run(core.steps - step);
    expect(state(again)).toEqual(state(core));
  });

  test("refused where its new block is not clear, off the map or with no road beside it, as a build is", () => {
    const core = city(), m = mapOf(core);
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    core.apply({ type: "build", tool: "fire", x: 600, z: 400, rot: 0, stroke: 2 });
    const move = (x: number, z: number) => core.apply({ type: "move", id: 1, x, z, rot: 0 });
    // Onto the fire station, over the map's edge, a building that is not there
    expect(move(600, 400)).toMatchObject({ accepted: false, reason: MOVE_BLOCKED });
    expect(move(955, 400)).toMatchObject({ accepted: false, reason: "outside the map" });
    expect(core.apply({ type: "move", id: 7, x: 330, z: 251, rot: 0 })).toMatchObject({ accepted: false, reason: NO_BUILDING });
    // ... onto water, which is never cleared
    core.map.setTile(30, 15, RIVER, 0);
    expect(move(488, 248)).toMatchObject({ accepted: false, reason: MOVE_BLOCKED });
    // ... onto woods, cleared at the province's price, unless nothing may be cleared
    core.map.setTile(41, 15, WOODS, 0);
    core.map.setTile(42, 16, WOODS, 0);
    const quote = core.commands.quoteMove({ type: "move", id: 1, x: 664, z: 248, rot: 0 });
    expect(quote).toEqual({ reason: null, cost: movePrice(core.tools.police) + 2 * (core.tools.police as any).clearWoodsCost });
    core.apply({ type: "setting", setting: "autoBulldoze", on: false });
    expect(move(664, 248)).toMatchObject({ accepted: false, reason: MOVE_BLOCKED });
    core.apply({ type: "setting", setting: "autoBulldoze", on: true });
    const before = funds(core);
    expect(move(664, 248).accepted).toBe(true);
    expect(before - funds(core)).toBe(quote.cost);
    // On a map painted a cell at a time it stands beside a road there, as everywhere
    m.cellZones = true;
    expect(move(200, 120)).toMatchObject({ accepted: false, reason: NEEDS_ROAD_BESIDE });
    road(core, 9, 5, 20);
    expect(core.commands.quoteMove({ type: "move", id: 1, x: 200, z: 120, rot: 0 }).reason).toBeNull();
    expect(placed(core).get(1)?.tile).toBe(at(41, 15));
  });

  test("the move tool finds the building under the mouse, what it costs and where it may go", () => {
    const core = city();
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    // Its block is tiles 19-21 x 14-16
    expect(buildingAt(placed(core), 60, 19, 16)?.id).toBe(1);
    expect(buildingAt(placed(core), 60, 22, 15)).toBeNull();
    expect(buildingAt(placed(core), 60, 20, 15, () => false)).toBeNull();
    expect(movePrice(core.tools.police)).toBe(50);
    expect(core.commands.quoteMove({ type: "move", id: 1, x: 334, z: 250, rot: 0 })).toEqual({ reason: null, cost: 50 });
    expect(core.commands.quoteMove({ type: "move", id: 1, x: 400, z: 250, rot: 0 })).toEqual({ reason: null, cost: 50 });
    expect(core.commands.quoteMove({ type: "move", id: 2, x: 400, z: 250, rot: 0 }).reason).toBe(NO_BUILDING);
  });
});
