/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone painted in cells on a real-scale city map (docs/NO_GRID_PLAN.md 3C; src/farmZone.ts, src/farmGrid.ts):
// the brush paints the cells it goes over, about 4 m a side and laid in rows along the road, not whole 16 m tiles; a
// field is the shape its cells make and counts as much as it covers; undo, saves and the tile brush keep its squares;
// and the way a field needs to a road is measured in metres, round about the road, not in the diamond of tile steps it
// once was.

import { BaseTool } from "../src/baseTool.js";
import { CityCommands, NOTHING_TO_PAINT } from "../src/cityCommands";
import { readCityLayers, writeCityLayers } from "../src/core/cityLayers";
import {
  FARM_ERASE_TOOL, FARM_PAINT_TOOL, FarmFields, farmSide, fieldLevelOf, fieldShare, fieldTile, FIELD_FLAGS, isFieldValue,
  kindCode, wayField, wayToRoad,
} from "../src/farmZone";
import { ALL_SQUARES, cellPainted, cellSquares, farmCellAt, farmCellsInRect, farmCellsNear, farmCellsOfTiles, farmCellsOnTiles,
  farmRows, paintedSquares } from "../src/farmGrid";
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
/** The road-aligned farm cells whose middles lie on tile (x, y) (src/farmGrid.ts), in rows from the road */
const cellsOn = (map: any, x: number, y: number) => farmCellsOfTiles(map, [tile(x, y)]).sort((p, q) => p.row - q.row || p.key - q.key);
const keysOf = (cells: Array<{ key: number }>) => cells.map((c) => c.key);
const squares = (map: any, x: number, y: number) => paintedSquares(map, tile(x, y));

describe("the farm zone painted in cells along the road", () => {
  test("a city map's fields are painted a cell at a time; elsewhere a field is its whole tile", () => {
    expect(farmSide({ cellZones: true, tileSizeM: 16 })).toBe(4);
    expect(farmSide({ cellZones: false, tileSizeM: 16 })).toBe(1);
    expect(farmRows({ tileSizeM: 16 }, 8)).toBe(33);
  });

  test("paints the cells it is given: a tile with any painted is a field, as much of one as is painted", () => {
    const { map, sim, commands } = city();
    const funds = sim.budget.totalFunds, cells = cellsOn(map, 10, 10);
    expect(cells.length).toBeGreaterThanOrEqual(12);
    // every cell runs along the road (east-west here), in rows parallel to it
    for (const c of cells) expect(Math.abs(Math.sin(c.angle))).toBeCloseTo(1, 6);
    const half = cells.slice(0, Math.floor(cells.length / 2));
    expect(commands.apply({ type: "farmCells", erase: false, cells: keysOf(half), stroke: 5 })).toMatchObject({ accepted: true });
    expect(map.getTileValue(10, 10)).toBe(fieldTile(0));
    const share = fieldShare(map, tile(10, 10));
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
    expect(share).toBe(squares(map, 10, 10) / ALL_SQUARES);
    // ... priced by the share of the tiles painted (FARM_ZONE.price 3, rounded; a cell may reach over the next tile)
    expect(funds - sim.budget.totalFunds).toBeGreaterThanOrEqual(Math.round(3 * share));
    expect(funds - sim.budget.totalFunds).toBeLessThanOrEqual(Math.round(3 * share) + 1);
    for (const c of half) expect(cellPainted(map, c)).toBe(true);
    for (const c of cells.slice(half.length)) expect(cellPainted(map, c)).toBe(false);
    // the same cells again: nothing to paint
    expect(commands.apply({ type: "farmCells", erase: false, cells: keysOf(half.slice(0, 1)), stroke: 6 })).toMatchObject({ accepted: false, reason: NOTHING_TO_PAINT });
  });

  test("rubs cells out, the last of a field leaving bare ground; undo puts tiles and squares back", () => {
    const { map, commands } = city();
    const cells = cellsOn(map, 12, 11);
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cells), stroke: 5 });
    const whole = squares(map, 12, 11);
    expect(commands.apply({ type: "farmCells", erase: true, cells: keysOf(cells.slice(0, 4)), stroke: 6 })).toMatchObject({ accepted: true });
    const some = squares(map, 12, 11);
    expect(some).toBeLessThan(whole);
    for (const c of cells.slice(0, 4)) expect(cellPainted(map, c)).toBe(false);
    // (every square of the tile rubbed out, those of the cells beside it reaching over too)
    const round = farmCellsOnTiles(map, 11, 10, 13, 12).filter((c) => cellSquares(map, c, 2.5).has(tile(12, 11)));
    expect(commands.apply({ type: "farmCells", erase: true, cells: keysOf(round), stroke: 7 })).toMatchObject({ accepted: true });
    expect(map.getTileValue(12, 11)).toBe(DIRT);
    // undo, a stroke at a time
    commands.apply({ type: "undo" });
    expect(isFieldValue(map.getTileValue(12, 11))).toBe(true);
    expect(squares(map, 12, 11)).toBe(some);
    commands.apply({ type: "undo" });
    expect(squares(map, 12, 11)).toBe(whole);
    commands.apply({ type: "undo" });
    expect(map.getTileValue(12, 11)).toBe(DIRT);
  });

  test("the tile brush paints the road-aligned cells on its tile; a stale part of a cleared field does not come back", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cellsOn(map, 14, 10).slice(0, 2)), stroke: 5 });
    expect(commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 14, y: 10, stroke: 6 })).toMatchObject({ accepted: true, toolResult: 0 });
    for (const c of cellsOn(map, 14, 10)) expect(cellPainted(map, c)).toBe(true);
    // painted again: nothing more to do
    expect(commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 14, y: 10, stroke: 7 })).toMatchObject({ accepted: true, toolResult: 0 });
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cellsOn(map, 16, 12).slice(-1)), stroke: 8 });
    commands.apply({ type: "tool", tool: FARM_ERASE_TOOL as never, x: 16, y: 12, stroke: 9 });
    expect(map.getTileValue(16, 12)).toBe(DIRT);
    const first = cellsOn(map, 16, 12)[0];
    commands.apply({ type: "farmCells", erase: false, cells: [first.key], stroke: 10 });
    expect(cellPainted(map, cellsOn(map, 16, 12).slice(-1)[0])).toBe(false);
  });

  test("woods take the province's clearing price, and land with no way to a road takes no paint", () => {
    const { map, sim, commands } = city();
    map.setTile(18, 10, WOODS, 0);
    const before = sim.budget.totalFunds;
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cellsOn(map, 18, 10).slice(0, 1)), stroke: 5 });
    expect(isFieldValue(map.getTileValue(18, 10))).toBe(true);
    expect(before - sim.budget.totalFunds).toBeGreaterThanOrEqual(1);
    // 30 tiles (480 m) from the road there are no farm cells at all
    expect(cellsOn(map, 20, 38)).toHaveLength(0);
    expect(map.getTileValue(20, 38)).toBe(DIRT);
  });

  test("a field in part works and sells as much as it covers", () => {
    const { map, commands } = city();
    commands.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x: 10, y: 11, stroke: 5 });
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cellsOn(map, 12, 11).slice(0, 4)), stroke: 6 });
    map.setTile(10, 11, fieldTile(2), FIELD_FLAGS);
    map.setTile(12, 11, fieldTile(2), FIELD_FLAGS);
    map.farmKinds = new Uint8Array(W * H);
    map.farmKinds[tile(10, 11)] = kindCode("paddy");
    map.farmKinds[tile(12, 11)] = kindCode("paddy");
    const fields = new FarmFields(W, H), census: any = {};
    fields.fieldFound(map, 10, 11, census);
    const one = census.farmPop;
    fields.fieldFound(map, 12, 11, census);
    const shareA = fieldShare(map, tile(10, 11)), shareB = fieldShare(map, tile(12, 11));
    expect(shareB).toBeLessThan(shareA);
    expect((census.farmPop - one) / one).toBeCloseTo(shareB / shareA, 6);
    const month = fields.month(map, 6, false, 0, [], null);
    expect(month.levels).toBeCloseTo(2 * shareA + 2 * shareB, 6);
  });

  test("its squares are saved with the city, only where a field covers part of its tile", () => {
    const { map, commands } = city();
    commands.apply({ type: "farmCells", erase: false, cells: keysOf(cellsOn(map, 10, 12).slice(0, 3)), stroke: 5 });
    const saved = JSON.parse(JSON.stringify(writeCityLayers(map)));
    expect(saved.farmCells).toBeUndefined();
    expect(Object.keys(saved.farmSquares).length).toBeGreaterThanOrEqual(1);
    const again: any = new (GameMap as unknown as new (w: number, h: number) => any)(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) again.setTile(x, y, map.getTileValue(x, y), map.getTileFlags(x, y));
    readCityLayers(again, saved);
    expect([...again.farmSquares]).toEqual([...map.farmSquares]);
  });

  test("an older save's 4 m cells of 4 x 4 become squares of the same share", () => {
    const { map } = city();
    map.setTile(10, 12, fieldTile(1), FIELD_FLAGS);
    const again: any = new (GameMap as unknown as new (w: number, h: number) => any)(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) again.setTile(x, y, map.getTileValue(x, y), map.getTileFlags(x, y));
    readCityLayers(again, { farmCells: { [tile(10, 12)]: 0x0660 } } as any);
    expect(paintedSquares(again, tile(10, 12))).toBe(16);
    again.cellZones = true;
    again.tileSizeM = 16;
    expect(fieldShare(again, tile(10, 12))).toBe(0.25);
    expect(again.farmSquaresOld).toEqual([tile(10, 12)]);
  });

  test("the brush paints the cells round where the mouse went, a rectangle the cells inside it along the road", () => {
    const { map } = city();
    const at: [number, number] = [105, 105];
    const round = farmCellsNear(map, null, at, 7 * 10 / 16);
    expect(round.length).toBeGreaterThan(4);
    for (const c of round) expect(Math.hypot(c.x - at[0], c.z - at[1])).toBeLessThanOrEqual(7 * 10 / 16 + 1e-9);
    expect(farmCellsNear(map, [100, 105], [125, 105], 7 * 10 / 16).length).toBeGreaterThan(round.length);
    // a rectangle 5 cells along the road and 3 rows deep, started on a cell
    const first = farmCellAt(map, 102, 100)!;
    const rect = farmCellsInRect(map, [first.x, first.z], [first.x + 4 * 2.5, first.z + 2 * 2.5]);
    expect(rect.cells).toHaveLength(15);
    for (const c of rect.cells) expect(c.angle).toBeCloseTo(first.angle, 6);
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
