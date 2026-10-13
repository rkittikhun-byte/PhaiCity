/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Land blocks (src/landBlocks.ts, docs/LAND.md): a province map cut into square blocks; a new city owns those round its
// town and buys the rest one by one, beside its land, dearer each time, as far as the ruler's rank allows.

import { CityCommands } from "../src/cityCommands";
import { layerPixels, UNOWNED_SHADE } from "../src/cityMap";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { decodePresetLayer, encodePresetLayer } from "../src/geo/presetMap";
import { hasKey } from "../src/i18n/index";
import {
  BLOCK_PRICE_STEP, BLOCK_SIZE, blockColumns, blockOutlineTile, blockPrice, blockRows, BLOCKS_BY_RANK, FIRST_BLOCK_PRICE,
  LAND_ALL_OPEN, LAND_LOCKED, LAND_NEEDS_RANK, LAND_NO_MONEY, LAND_NOT_BESIDE, LAND_OUTSIDE, LAND_OWNED, landProblem,
  ownsLand, startingBlocks,
} from "../src/landBlocks";
import { footprint } from "../src/cityCommands";
import { Simulation } from "../src/simulation.js";

const B = BLOCK_SIZE;

function province(rank = 5) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(8 * B, 6 * B);
  map.insideProvince = new Uint8Array(map.width * map.height).fill(1);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < B; x++) map.insideProvince[y * map.width + x] = 0; // first column outside
  map.town = { x: 4 * B + 5, y: 3 * B + 5 };
  map.landBlocks = startingBlocks(map, map.town);
  map.landBought = 0;
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => rank,
    ownsLand: (x: number, y: number) => ownsLand(map, x, y),
  } as any);
  return { map, sim, commands };
}

describe("land blocks", () => {
  test("a new city owns the three by three blocks round its town; a map without blocks owns everything", () => {
    const { map } = province();
    expect(ownsLand(map, map.town.x, map.town.y)).toBe(true);
    expect(ownsLand(map, 3 * B, 2 * B)).toBe(true); // the corner of the 3×3
    expect(ownsLand(map, 2 * B + 5, 3 * B)).toBe(false);
    expect(ownsLand({ width: 10, height: 10 }, 3, 3)).toBe(true);
    expect(map.landBlocks.length).toBe(blockColumns(map) * blockRows(map));
    for (const key of ["tool.land", "land.note.locked", "land.note.owned", "land.note.not_beside", "land.note.outside",
      "land.note.needs_rank", "land.note.no_money", "land.note.all_open", "about.building.land"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
  });

  test("tools take no land the city has not bought", () => {
    const { map, commands } = province();
    expect(commands.apply({ type: "tool", tool: "road", x: 2 * B + 5, y: 3 * B }))
      .toMatchObject({ accepted: false, reason: LAND_LOCKED });
    expect(commands.apply({ type: "tool", tool: "bulldozer", x: map.town.x + 3, y: map.town.y }).accepted).toBe(true);
  });

  test("blocks are bought beside owned land, inside the province, dearer each time, as far as the rank allows", () => {
    const { map, sim, commands } = province();
    const funds = sim.budget.totalFunds;
    expect(landProblem(map, map.town.x, map.town.y, 5, funds)).toBe(LAND_OWNED);
    expect(landProblem(map, 7 * B, 3 * B, 5, funds)).toBe(LAND_NOT_BESIDE);
    expect(landProblem(map, 5, 5, 5, funds)).toBe(LAND_OUTSIDE);
    expect(landProblem(map, 2 * B, 3 * B, 5, 10)).toBe(LAND_NO_MONEY);
    expect(landProblem({ width: 10, height: 10 }, 1, 1, 5, funds)).toBe(LAND_ALL_OPEN);
    expect(commands.apply({ type: "land", x: 2 * B + 3, y: 3 * B + 3 }).accepted).toBe(true);
    expect(funds - sim.budget.totalFunds).toBe(FIRST_BLOCK_PRICE);
    expect(ownsLand(map, 2 * B + 3, 3 * B + 3)).toBe(true);
    expect(blockPrice(map)).toBe(FIRST_BLOCK_PRICE + BLOCK_PRICE_STEP);
    // Now the block beyond it is beside owned land
    expect(landProblem(map, 1 * B + 3, 3 * B + 3, 5, funds)).toBeNull();
    // A new ruler may buy only so many
    const low = province(0);
    for (let k = 0; k < BLOCKS_BY_RANK[0]; k++) expect(low.commands.apply({ type: "land", x: (6 + k) * B, y: 3 * B }).accepted).toBe(true);
    expect(low.commands.apply({ type: "land", x: 7 * B, y: 2 * B })) // beside the last, but one too many
      .toMatchObject({ accepted: false, reason: LAND_NEEDS_RANK });
  });

  test("the land tool's outline covers its whole block; the city map shows unbought land darker; saves keep it", () => {
    const tile = blockOutlineTile(2 * B + 7, 3 * B + 11);
    const tiles = footprint(tile.x, tile.y, B);
    expect(tiles[0]).toEqual({ x: 2 * B, y: 3 * B });
    expect(tiles[tiles.length - 1]).toEqual({ x: 3 * B - 1, y: 4 * B - 1 });

    const { map } = province();
    const pixels = layerPixels("city", map, {} as any);
    const at = (x: number, y: number) => pixels[(y * map.width + x) * 4];
    const owned = at(map.town.x + 1, map.town.y + 1), unowned = at(2 * B + 1, map.town.y + 1);
    expect(unowned).toBeCloseTo(owned * UNOWNED_SHADE, 0);

    const saved = encodePresetLayer(map.landBlocks);
    expect(Array.from(decodePresetLayer(saved, blockColumns(map), blockRows(map)))).toEqual(Array.from(map.landBlocks));
  });
});
