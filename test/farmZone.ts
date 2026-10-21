/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone (src/farmZone.ts, docs/GAME_DESIGN.md section 7): painted a 16 m tile at a time on open land with a way
// to a road within reach, through the tool command, saved with the city, and grown by the land into paddies, fields,
// orchards and ponds.

import { BaseTool } from "../src/baseTool.js";
import { CityCommands } from "../src/cityCommands";
import { readCityLayers, writeCityLayers } from "../src/core/cityLayers";
import { drawModeOf, isFarmTool, isPaintTool, showsZoneGrid } from "../src/drawModes";
import {
  FARM_ERASE_TOOL, FARM_PAINT_TOOL, FarmFields, fieldFillRegion, fieldLevelOf, fieldOutcome, fieldTile, FIELD_FLAGS,
  isFieldValue, kindCode, pickKind, wayField, wayToRoad,
} from "../src/farmZone";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { checkRulesData, DEFAULT_RULES, FARM_ZONE, resolveRules } from "../src/provinceRules";
import { Random } from "../src/random";
import { newRoadLevels } from "../src/roadLevels";
import { Simulation } from "../src/simulation.js";
import { BULLBIT, BURNBIT } from "../src/tileFlags";
import { DIRT, FIELD_BASE, FIELD_LAST, RIVER, WOODS } from "../src/tileValues";

const ROAD_Y = 8;

/** A painted city map with a road along ROAD_Y from x = 2 to 40, money in the bank, in a province with farmland */
function city() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.paintedZones = true;
  map.tileSizeM = 16;
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

const paint = (commands: CityCommands, x: number, y: number, tool = FARM_PAINT_TOOL, stroke = 2) =>
  commands.apply({ type: "tool", tool: tool as any, x, y, stroke });

describe("the farm zone", () => {
  test("a field's tile says its level, from the seventh 3 × 3's first six tiles", () => {
    expect(FIELD_BASE).toBe(1010);
    expect(FIELD_LAST).toBe(1015);
    for (let level = 0; level <= 5; level++) {
      expect(isFieldValue(fieldTile(level))).toBe(true);
      expect(fieldLevelOf(fieldTile(level))).toBe(level);
    }
    expect(fieldLevelOf(DIRT)).toBe(-1);
    expect(FIELD_FLAGS).toBe(BULLBIT | BURNBIT);
  });

  test("needs a way to a road within reach, not a road beside it", () => {
    const { map } = city();
    expect(wayToRoad(map, 10, ROAD_Y + 1, 8)).toBe(1);
    expect(wayToRoad(map, 10, ROAD_Y + 8, 8)).toBe(8);
    expect(wayToRoad(map, 10, ROAD_Y + 9, 8)).toBe(-1);
    // A building in the way: the track goes round it
    for (let x = 5; x <= 15; x++) map.setTile(x, ROAD_Y + 2, RIVER, 0);
    expect(wayToRoad(map, 10, ROAD_Y + 3, 8)).toBe(-1);
    expect(wayToRoad(map, 10, ROAD_Y + 3, 12)).toBe(9);
    // The field of every tile agrees with the search from one tile
    const ways = wayField(map, 8);
    for (const [x, y] of [[10, ROAD_Y + 1], [10, ROAD_Y + 3], [20, ROAD_Y + 7], [50, ROAD_Y + 1], [3, 30]]) {
      expect(ways[y * map.width + x] || -1).toBe(wayToRoad(map, x, y, 8));
    }
  });

  test("is painted by the tool command, on open land and woods, and rubbed out by its eraser", () => {
    const { map, sim, commands } = city();
    const funds = sim.budget.totalFunds;
    expect(paint(commands, 10, ROAD_Y + 5).accepted).toBe(true);
    expect(map.getTileValue(10, ROAD_Y + 5)).toBe(fieldTile(0));
    expect(funds - sim.budget.totalFunds).toBe(FARM_ZONE.price);
    // Too far, on the road, already a field
    expect(paint(commands, 10, ROAD_Y + 20).toolResult).toBe(1);
    expect(fieldOutcome(map, 10, ROAD_Y + 20)).toBe("no_way");
    expect(fieldOutcome(map, 10, ROAD_Y)).toBe("not_land");
    expect(fieldOutcome(map, 10, ROAD_Y + 5)).toBe("same");
    // Woods are cleared at the province's price
    map.setTile(12, ROAD_Y + 2, WOODS, BULLBIT);
    expect(paint(commands, 12, ROAD_Y + 2).accepted).toBe(true);
    expect(map.getTileValue(12, ROAD_Y + 2)).toBe(fieldTile(0));
    // The eraser leaves bare ground, free while the field is empty
    const before = sim.budget.totalFunds;
    expect(paint(commands, 10, ROAD_Y + 5, FARM_ERASE_TOOL, 3).accepted).toBe(true);
    expect(map.getTileValue(10, ROAD_Y + 5)).toBe(DIRT);
    expect(sim.budget.totalFunds).toBe(before);
    // ... and undo puts the field back
    commands.apply({ type: "undo" });
    expect(map.getTileValue(10, ROAD_Y + 5)).toBe(fieldTile(0));
  });

  test("is refused where the province has no farmland", () => {
    const { commands } = city();
    (commands as any).city.resources = { farmland: 0 };
    expect(paint(commands, 10, ROAD_Y + 5)).toMatchObject({ accepted: false });
  });

  test("a fill paints the open land with a way to a road, and stops at the reach", () => {
    const { map } = city();
    const tiles = fieldFillRegion(map, 10, ROAD_Y + 2, false, 8);
    expect(tiles.length).toBeGreaterThan(100);
    expect(tiles.every(({ x, y }) => wayToRoad(map, x, y, 8) > 0)).toBe(true);
    // The eraser's fill takes only fields
    expect(fieldFillRegion(map, 10, ROAD_Y + 2, true, 8)).toEqual([]);
  });

  test("the brush paints whole tiles, with the zone brushes' modes but not their grid of cells", () => {
    expect(isPaintTool(FARM_PAINT_TOOL)).toBe(true);
    expect(isFarmTool(FARM_ERASE_TOOL)).toBe(true);
    expect(showsZoneGrid(FARM_PAINT_TOOL)).toBe(false);
    expect(drawModeOf(FARM_PAINT_TOOL)).toBe(drawModeOf("zone_residential"));
    for (const key of ["tool.zone_farm", "tool.farm_erase", "choice.zone_farm", "dock.group.zone_farm", "about.zone.farm",
      "tool.needs_way", "farm.kind.paddy", "farm.kind.field", "farm.kind.orchard", "farm.kind.pond"]) {
      expect(hasKey(key)).toBe(true);
    }
  });

  test("its fields and their kinds are saved with the city", () => {
    const { map } = city();
    map.setTile(10, ROAD_Y + 2, fieldTile(3), FIELD_FLAGS);
    map.setTile(11, ROAD_Y + 2, fieldTile(0), FIELD_FLAGS);
    map.farmKinds = new Uint8Array(map.width * map.height);
    map.farmKinds[(ROAD_Y + 2) * map.width + 10] = kindCode("orchard");
    // A kind left where the field was rubbed out is not kept
    map.farmKinds[(ROAD_Y + 3) * map.width + 10] = kindCode("pond");
    const saved = writeCityLayers(map);
    expect(typeof saved.farmKinds).toBe("string");
    const again: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
    readCityLayers(again, saved);
    expect(again.farmKinds[(ROAD_Y + 2) * map.width + 10]).toBe(kindCode("orchard"));
    expect(again.farmKinds[(ROAD_Y + 3) * map.width + 10]).toBe(0);
  });

  test("the rules carry its numbers, which the region and province may change", () => {
    expect(DEFAULT_RULES.farmZone).toBe(FARM_ZONE);
    const { data, problems } = checkRulesData({ version: 1, regions: { south: { farmZone: { reach: 10, kinds: { orchard: { sale: 0.2 } } } } },
      provinces: { "TH-90": { farmZone: { price: 5, kinds: { pond: { burns: true } } } } } });
    expect(problems).toEqual([]);
    const rules = resolveRules(data, "south", "TH-90");
    expect(rules.farmZone).toMatchObject({ reach: 10, price: 5 });
    expect(rules.farmZone.kinds.orchard).toMatchObject({ sale: 0.2, jobs: FARM_ZONE.kinds.orchard.jobs });
    expect(rules.farmZone.kinds.pond.burns).toBe(true);
    expect(checkRulesData({ version: 1, regions: { north: { farmZone: { reach: 0, eraTop: [1, 2], kinds: { rice: {} } } } },
      provinces: {} }).problems).toHaveLength(3);
  });
});

describe("the land's choice of field", () => {
  const land = () => {
    const { map } = city();
    map.heights = new Float32Array(map.width * map.height).fill(150);
    for (let x = 0; x < map.width; x++) map.setTile(x, 16, RIVER, 0);
    return map;
  };

  test("a pond beside the water, a paddy on low land near it, an orchard on good ground, a field on dry upland", () => {
    const map = land();
    expect(pickKind(map, 20, 15, FARM_ZONE, 0.3)).toBe("pond");
    expect(pickKind(map, 20, 12, FARM_ZONE, 0.3)).toBe("paddy");
    // Raised above the water, the same place is an orchard on good ground or a field on dry
    for (let y = 9; y < 16; y++) map.heights[y * map.width + 20] = 160;
    expect(pickKind(map, 20, 12, FARM_ZONE, 0.4)).toBe("orchard");
    expect(pickKind(map, 20, 12, FARM_ZONE, 0.1)).toBe("field");
    // Far from water, wet ground still makes paddies
    expect(pickKind(map, 20, 30, FARM_ZONE, 0.7)).toBe("paddy");
  });

  test("a field grows by the land, and is kept as it first grew", () => {
    const map = land();
    const fields = new FarmFields(map.width, map.height);
    fields.room = 1000;
    map.setTile(20, 15, fieldTile(0), FIELD_FLAGS);
    Random.seed(4);
    const census = { indPop: 0 };
    for (let i = 0; i < 200 && fieldLevelOf(map.getTileValue(20, 15)) < 1; i++) fields.fieldFound(map, 20, 15, census);
    expect(fieldLevelOf(map.getTileValue(20, 15))).toBe(1);
    expect(map.farmKinds[15 * map.width + 20]).toBe(kindCode("pond"));
    // ... and counts its work
    fields.fieldFound(map, 20, 15, census);
    expect(census.indPop).toBeCloseTo(FARM_ZONE.kinds.pond.jobs);
  });
});
