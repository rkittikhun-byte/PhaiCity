/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone painted in cells on a real-scale city map (docs/NO_GRID_PLAN.md 3C; src/farmZone.ts): the brush paints
// the cells it goes over, about 4 m a side, not whole 16 m tiles; a field is the shape its cells make and counts as
// much as it covers; undo, saves and the tile brush keep its cells; and the way a field needs to a road is measured in
// metres, round about the road, not in the diamond of tile steps it once was.

import { BaseTool } from "../src/baseTool.js";
import { CityCommands, NOTHING_TO_PAINT } from "../src/cityCommands";
import { readCityLayers, writeCityLayers } from "../src/core/cityLayers";
import {
  cellCount, FARM_ERASE_TOOL, FARM_PAINT_TOOL, FarmFields, farmCellKey, farmCellsInRect, farmCellsNear, farmSide,
  fieldCells, fieldLevelOf, fieldShare, fieldTile, FIELD_FLAGS, fullCells, isFieldValue, kindCode, wayField, wayToRoad,
} from "../src/farmZone";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { newRoadLevels } from "../src/roadLevels";
import { Simulation } from "../src/simulation.js";
import { DIRT, WOODS } from "../src/tileValues";

const ROAD_Y = 8, W = 64, H = 40, M = 16;

/** A real-scale city map (its zones go a cell at a time) with a road along ROAD_Y from x = 2 to 40, money in the bank */
function city() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(W, H);
  map.paintedZones = true;
  map.cellZones = true;
  map.tileSizeM = M;
  map.roadLevels = newRoadLevels(map.width, map.height);
  const sim: any = new (Simulation as any)(map, 0, 3, null, null, { farmland: 3 });
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  (BaseTool as any).setAutoBulldoze(true);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => 5, resources: { farmland: 3 },
    setRoadLevel: (x: number, y: number, level: number) => { map.roadLevels[y * map.width + x] = level; },
  } as any);
  for (let x = 2; x <= 40; x++) commands.apply({ type: "tool", tool: "road", x, y: ROAD_Y, stroke: 1 });
  return { map, sim, tools, commands };
}

const tile = (x: number, y: number) => y * W + x;
/** The keys of the cells of tile (x, y) in the given rows and columns (0-3) */
const cellsOf = (x: number, y: number, rows: number[], columns: number[]) =>
  rows.flatMap((r) => columns.map((c) => farmCellKey(tile(x, y), r * 4 + c)));

describe("the farm zone painted in cells", () => {
  test("a city map's tile has 4 x 4 cells; elsewhere a field is its whole tile", () => {
    expect(farmSide({ cellZones: true, tileSizeM: 16 })).toBe(4);
    expect(farmSide({ cellZones: false, tileSizeM: 16 })).toBe(1);
    expect(fullCells(4)).toBe(0xffff);
    expect(cellCount(0b1011)).toBe(3);
  });

  test("paints the cells it is given: a tile with any painted is a field, as much of one as is painted", () => {
    const { map, sim, commands } = city();
    const funds = sim.budget.totalFunds;
    // the top two rows of a tile beside the road, then two more rows
    expect(commands.apply({ type: "farmCells", erase: false, cells: cellsOf(10, 9, [0, 1], [0, 1, 2, 3]), stroke: 5 })).toMatchObject({ accepted: true });
    expect(isFieldValue(map.getTileValue(10, 9))).toBe(true);
    expect(map.getTileValue(10, 9)).toBe(fieldTile(0));
    expect(fieldCells(map, tile(10, 9))).toBe(0x00ff);
    expect(fieldShare(map, tile(10, 9))).toBe(0.5);
    const half = funds - sim.budget.totalFunds;
    // ... priced by the share of a tile: half a tile, half the brush's price (FARM_ZONE.price 3, rounded)
    expect(half).toBe(Math.round(3 * 0.5));
    expect(commands.apply({ type: "farmCells", erase: false, cells: cellsOf(10, 9, [2, 3], [0, 1, 2, 3]), stroke: 5 })).toMatchObject({ accepted: true });
    // whole now: kept as none, every cell
    expect(map.farmCells[tile(10, 9)]).toBe(0);
    expect(fieldShare(map, tile(10, 9))).toBe(1);
    // the same cells again: nothing to paint
    expect(commands.apply({ type: "farmCells", erase: false, cells: cellsOf(10, 9, [0], [0]), stroke: 6 })).toMatchObject({ accepted: false, reason: NOTHING_TO_PAINT });
  });

  test("rubs cells out, the last of a field leaving bare ground; undo puts tiles and cells back", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(12, 9, [0, 1, 2, 3], [0, 1, 2, 3]), stroke: 5 });
    expect(commands.apply({ type: "farmCells", erase: true, cells: cellsOf(12, 9, [0, 1, 2, 3], [0, 1]), stroke: 6 })).toMatchObject({ accepted: true });
    expect(fieldCells(map, tile(12, 9))).toBe(0xcccc);
    expect(commands.apply({ type: "farmCells", erase: true, cells: cellsOf(12, 9, [0, 1, 2, 3], [2, 3]), stroke: 7 })).toMatchObject({ accepted: true });
    expect(map.getTileValue(12, 9)).toBe(DIRT);
    // undo, a stroke at a time
    commands.apply({ type: "undo" });
    expect(isFieldValue(map.getTileValue(12, 9))).toBe(true);
    expect(fieldCells(map, tile(12, 9))).toBe(0xcccc);
    commands.apply({ type: "undo" });
    expect(fieldCells(map, tile(12, 9))).toBe(0xffff);
    commands.apply({ type: "undo" });
    expect(map.getTileValue(12, 9)).toBe(DIRT);
  });

  test("the tile brush over a field painted in part paints the rest of it; a whole new one is every cell", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(14, 9, [0], [0, 1]), stroke: 5 });
    expect(commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 14, y: 9, stroke: 6 })).toMatchObject({ accepted: true, toolResult: 0 });
    expect(fieldCells(map, tile(14, 9))).toBe(0xffff);
    // a stale part kept for a tile the bulldozer cleared does not come back with a new field painted whole there
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(16, 9, [3], [3]), stroke: 7 });
    commands.apply({ type: "tool", tool: FARM_ERASE_TOOL as never, x: 16, y: 9, stroke: 8 });
    expect(map.getTileValue(16, 9)).toBe(DIRT);
    commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 16, y: 9, stroke: 9 });
    expect(fieldCells(map, tile(16, 9))).toBe(0xffff);
  });

  test("woods take the province's clearing price, and land with no way to a road takes no paint", () => {
    const { map, sim, commands } = city();
    map.setTile(18, 9, WOODS, 0);
    const before = sim.budget.totalFunds;
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(18, 9, [0], [0]), stroke: 5 });
    expect(isFieldValue(map.getTileValue(18, 9))).toBe(true);
    expect(before - sim.budget.totalFunds).toBeGreaterThanOrEqual(1);
    // 30 tiles (480 m) from the road
    expect(commands.apply({ type: "farmCells", erase: false, cells: cellsOf(20, 38, [0], [0]), stroke: 6 })).toMatchObject({ accepted: false });
    expect(map.getTileValue(20, 38)).toBe(DIRT);
  });

  test("a field in part works and sells as much as it covers", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(10, 9, [0, 1, 2, 3], [0, 1, 2, 3]), stroke: 5 });
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(11, 9, [0], [0, 1, 2, 3]), stroke: 6 });
    map.setTile(10, 9, fieldTile(2), FIELD_FLAGS);
    map.setTile(11, 9, fieldTile(2), FIELD_FLAGS);
    map.farmKinds = new Uint8Array(W * H);
    map.farmKinds[tile(10, 9)] = kindCode("paddy");
    map.farmKinds[tile(11, 9)] = kindCode("paddy");
    const fields = new FarmFields(W, H), census: any = {};
    fields.fieldFound(map, 10, 9, census);
    const whole = census.farmPop;
    fields.fieldFound(map, 11, 9, census);
    expect(census.farmPop - whole).toBeCloseTo(whole / 4, 6);
    const month = fields.month(map, 6, false, 0, [], null);
    expect(month.levels).toBeCloseTo(2 + 2 / 4, 6);
  });

  test("its cells are saved with the city, only where a field covers part of its tile", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: cellsOf(10, 9, [1, 2], [1, 2]), stroke: 5 });
    commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 11, y: 9, stroke: 6 });
    const saved = JSON.parse(JSON.stringify(writeCityLayers(map)));
    expect(saved.farmCells).toEqual({ [tile(10, 9)]: 0x0660 });
    const again: any = new (GameMap as unknown as new (w: number, h: number) => any)(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) again.setTile(x, y, map.getTileValue(x, y), map.getTileFlags(x, y));
    readCityLayers(again, saved);
    expect(fieldCells(again, tile(10, 9))).toBe(0x0660);
    expect(fieldCells(again, tile(11, 9))).toBe(0xffff);
  });

  test("the brush paints the cells round where the mouse went, a rectangle the cells inside it", () => {
    const map = { width: W, height: H, cellZones: true, tileSizeM: M } as any;
    // a round brush 7 m about the middle of tile (10, 9): the cells whose middles lie within it, a round of 12
    const round = farmCellsNear(map, null, [168, 152], 7);
    expect(round).toHaveLength(12);
    for (const key of round) {
      const t = Math.floor(key / 16), bit = key % 16;
      const x = (t % W) * M + (bit % 4 + 0.5) * 4, z = Math.floor(t / W) * M + (Math.floor(bit / 4) + 0.5) * 4;
      expect(Math.hypot(x - 168, z - 152)).toBeLessThanOrEqual(7);
    }
    // a stroke is the round brush dragged: more cells, across two tiles
    expect(farmCellsNear(map, [160, 152], [200, 152], 7).length).toBeGreaterThan(round.length);
    // a rectangle 8 x 12 m: two columns and three rows of cells
    expect(farmCellsInRect(map, [160, 144], [168, 156])).toHaveLength(2 * 3);
  });
});

describe("the way a field needs to a road, in metres", () => {
  test("reaches round about the road, diagonally too, as far as the province's reach (8 tiles, 128 m)", () => {
    const { map } = city();
    const reach = 8;
    // straight out from the road: 8 tiles' worth, the 9th not
    expect(wayToRoad(map, 20, ROAD_Y + 8, reach)).toBe(8);
    expect(wayToRoad(map, 20, ROAD_Y + 9, reach)).toBe(-1);
    // past the road's end, diagonally: from the tile below its last, 5 across and 4 down is a step and 4 diagonals,
    // 16 + 16 + 4 x 22.6 = 122.5 m, within 128 m, where the tile steps took 10 and refused it
    expect(wayToRoad(map, 45, ROAD_Y + 5, reach)).toBe(8);
    expect(wayToRoad(map, 46, ROAD_Y + 6, reach)).toBe(-1);
    const ways = wayField(map, reach);
    expect(ways[tile(45, ROAD_Y + 5)]).toBe(8);
    expect(ways[tile(20, ROAD_Y + 8)]).toBe(8);
    expect(ways[tile(20, ROAD_Y + 9)]).toBe(0);
    // the whole field and the one tile's ask agree
    for (const [x, y] of [[44, 10], [46, 14], [30, 3], [41, 2]]) {
      const one = wayToRoad(map, x, y, reach);
      expect([x, y, ways[tile(x, y)]]).toEqual([x, y, one < 0 ? 0 : one]);
    }
  });

  test("never squeezes between two things in the way at their corners", () => {
    const { map } = city();
    // a wall of woods-free buildings with a corner gap, two tiles out from the road
    for (let x = 0; x < W; x++) map.setTile(x, ROAD_Y + 2, 1000, 0);
    map.setTile(25, ROAD_Y + 2, DIRT, 0);
    // straight through the gap: open
    expect(wayToRoad(map, 25, ROAD_Y + 3, 8)).toBe(3);
    // closed again but for a diagonal step between two corners
    map.setTile(25, ROAD_Y + 2, 1000, 0);
    map.setTile(26, ROAD_Y + 3, DIRT, 0);
    expect(wayToRoad(map, 25, ROAD_Y + 3, 8)).toBe(-1);
    void fieldLevelOf;
  });
});
