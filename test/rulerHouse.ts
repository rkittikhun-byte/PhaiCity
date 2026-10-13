/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's house (src/rulerHouse.ts, docs/RULER_HOUSE.md): a new city's first building, its levels by rank, its
// wings, and what it brings and costs.

import { BlockMapUtils } from "../src/blockMapUtils.js";
import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import * as Messages from "../src/messages";
import { BASE_PRICES } from "../src/provinceRules";
import {
  cultureNoise, HOUSE_AT_TOP, HOUSE_FIRST, HOUSE_KIND, HOUSE_SPECS, HOUSE_STANDS, HOUSE_TOOL, HOUSE_UPGRADE_TOOL,
  houseLandValue, houseUpgradeCost, houseUpkeep, MAX_HOUSE_LEVEL, NEEDS_RANK, NO_HOUSE, NO_WING_SLOT, readHouse,
  WING_SPECS, WING_WAITS, wingRows, WINGS,
} from "../src/rulerHouse";
import { Simulation } from "../src/simulation.js";

function city(options: { fresh?: boolean } = {}) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.rulerHouse = null;
  map.needsRulerHouse = options.fresh !== false;
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  let rank = 0;
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime,
    houseMap: map,
    rank: () => rank,
    setRulerHouse: (x: number, y: number) => {
      map.civicKinds[y * map.width + x] = HOUSE_KIND;
      map.rulerHouse = { x, y, level: 1, wings: [] };
    },
  } as any);
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  return { map, sim, commands, tool, setRank: (r: number) => { rank = r; } };
}

describe("the ruler's house", () => {
  test("comes first in a new city: every other tool but the bulldozer waits for it", () => {
    const { map, tool } = city();
    expect(tool("residential", 20, 20)).toMatchObject({ accepted: false, reason: HOUSE_FIRST });
    expect(tool("road", 5, 5)).toMatchObject({ accepted: false, reason: HOUSE_FIRST });
    expect(tool("bulldozer", 5, 5).accepted).toBe(true);
    expect(tool(HOUSE_TOOL, 10, 10)).toMatchObject({ accepted: true, toolResult: 0 });
    expect(map.rulerHouse).toEqual({ x: 10, y: 10, level: 1, wings: [] });
    expect(tool("residential", 20, 20)).toMatchObject({ accepted: true, toolResult: 0 });
  });

  test("does not hold back a city saved before it, and there is only one", () => {
    const { tool } = city({ fresh: false });
    expect(tool("residential", 20, 20).toolResult).toBe(0);
    expect(tool(HOUSE_TOOL, 10, 10).toolResult).toBe(0);
    expect(tool(HOUSE_TOOL, 30, 10)).toMatchObject({ accepted: false, reason: HOUSE_STANDS });
  });

  test("rises a level for each rank, paying the difference, never past the sixth, and is not undone", () => {
    const { map, sim, commands, tool, setRank } = city();
    // Nothing to raise: in a new city the upgrade waits for the house like every tool, in an older one it says so
    expect(tool(HOUSE_UPGRADE_TOOL, 10, 10)).toMatchObject({ accepted: false, reason: HOUSE_FIRST });
    expect(city({ fresh: false }).tool(HOUSE_UPGRADE_TOOL, 10, 10)).toMatchObject({ accepted: false, reason: NO_HOUSE });
    tool(HOUSE_TOOL, 10, 10);
    expect(tool(HOUSE_UPGRADE_TOOL, 10, 10)).toMatchObject({ accepted: false, reason: NEEDS_RANK });
    setRank(1);
    const funds = sim.budget.totalFunds;
    expect(tool(HOUSE_UPGRADE_TOOL, 11, 9)).toMatchObject({ accepted: true, toolResult: 0 });
    expect(map.rulerHouse.level).toBe(2);
    expect(funds - sim.budget.totalFunds).toBe(houseUpgradeCost(1));
    setRank(5);
    expect(tool(HOUSE_UPGRADE_TOOL, 30, 30).toolResult).toBe(1); // not on the house
    for (let k = 0; k < 10; k++) tool(HOUSE_UPGRADE_TOOL, 10, 10);
    expect(map.rulerHouse.level).toBe(MAX_HOUSE_LEVEL);
    expect(tool(HOUSE_UPGRADE_TOOL, 10, 10)).toMatchObject({ accepted: false, reason: HOUSE_AT_TOP });
    commands.apply({ type: "undo" });
    expect(map.rulerHouse.level).toBe(MAX_HOUSE_LEVEL);
  });

  test("costs more to build, raise and keep at each level; its prices follow the province's rules", () => {
    for (let level = 2; level <= MAX_HOUSE_LEVEL; level++) {
      expect(HOUSE_SPECS[level - 1].price).toBeGreaterThan(HOUSE_SPECS[level - 2].price);
      expect(HOUSE_SPECS[level - 1].upkeep).toBeGreaterThan(HOUSE_SPECS[level - 2].upkeep);
      expect(HOUSE_SPECS[level - 1].rank).toBe(level - 1);
      expect(HOUSE_SPECS[level - 1].wings).toBe(level - 1);
    }
    expect(BASE_PRICES.ruler_house).toBe(HOUSE_SPECS[0].price);
    expect(BASE_PRICES.ruler_house_upgrade).toBe(houseUpgradeCost(1));
    expect(houseUpkeep({ x: 0, y: 0, level: 3, wings: ["treasury", "granary"] }))
      .toBe(HOUSE_SPECS[2].upkeep + WING_SPECS.treasury.upkeep + WING_SPECS.granary.upkeep);
  });

  test("is the city's centre, makes the land near it dearer, and pays its upkeep each year", () => {
    const { map, sim, tool } = city();
    tool(HOUSE_TOOL, 40, 30);
    BlockMapUtils.populationDensityScan(map, sim.blockMaps, sim._house());
    expect([map.cityCentreX, map.cityCentreY]).toEqual([40, 30]);
    expect(houseLandValue(map.rulerHouse, 40, 30)).toBeGreaterThan(houseLandValue(map.rulerHouse, 44, 30));
    expect(houseLandValue(map.rulerHouse, 60, 30)).toBe(0);
    for (let step = 0; step < 16; step++) sim._simulate(sim._constructSimData());
    expect(sim._census.rulerHouseCount).toBe(1);
    expect(sim._census.rulerHouseUpkeep).toBe(HOUSE_SPECS[0].upkeep);
  });

  test("is forgotten with its wings when it falls, and the news hears of it", () => {
    const { map, sim, tool } = city();
    tool(HOUSE_TOOL, 10, 10);
    sim._houseMonth();
    expect(map.needsRulerHouse).toBe(false); // a house that stood a month frees the city for good
    const news: string[] = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (message: { subject: string }) => news.push(message.subject));
    tool("bulldozer", 10, 10);
    sim._houseMonth();
    expect(map.rulerHouse).toBeNull();
    expect(news).toContain(Messages.RULER_HOUSE_LOST);
    expect(tool("residential", 30, 20).toolResult).toBe(0); // no longer held back
  });

  test("reads a saved house carefully", () => {
    expect(readHouse({ x: 3, y: 4, level: 2, wings: ["treasury", "nope", "treasury"] }))
      .toEqual({ x: 3, y: 4, level: 2, wings: ["treasury"] });
    expect(readHouse({ x: 3, y: 4, level: 1, wings: ["treasury"] })).toEqual({ x: 3, y: 4, level: 1, wings: [] });
    expect(readHouse({ x: 3, y: 4, level: 9 })).toBeNull();
    expect(readHouse(null)).toBeNull();
  });
});

describe("the house's wings", () => {
  function raised(level: number) {
    const c = city();
    c.tool(HOUSE_TOOL, 10, 10);
    c.setRank(5);
    for (let k = 1; k < level; k++) c.tool(HOUSE_UPGRADE_TOOL, 10, 10);
    return c;
  }

  test("one more for each level from the second; each pays its price, comes off without a refund", () => {
    const { map, sim, commands } = raised(2);
    const funds = sim.budget.totalFunds;
    expect(commands.apply({ type: "wing", wing: "treasury", add: true }).accepted).toBe(true);
    expect(funds - sim.budget.totalFunds).toBe(WING_SPECS.treasury.price);
    expect(commands.apply({ type: "wing", wing: "granary", add: true })).toMatchObject({ accepted: false, reason: NO_WING_SLOT });
    expect(commands.apply({ type: "wing", wing: "treasury", add: false }).accepted).toBe(true);
    expect(sim.budget.totalFunds).toBe(funds - WING_SPECS.treasury.price);
    expect(map.rulerHouse.wings).toEqual([]);
  });

  test("the council hall is built for the policies; the trade office waits for the network mode", () => {
    const { commands } = raised(3);
    expect(commands.apply({ type: "wing", wing: "council_hall", add: true }).accepted).toBe(true);
    expect(commands.apply({ type: "wing", wing: "trade_office", add: true })).toMatchObject({ reason: WING_WAITS });
    expect(commands.apply({ type: "wing", wing: "nope" as any, add: true }).accepted).toBe(false);
  });

  test("bring their gains: taxes, the dry season, the seasons' disasters, visitors, the garden's land", () => {
    const { map, sim, commands } = raised(6);
    for (const wing of ["treasury", "granary", "warning_tower", "culture_court", "front_garden"] as const) {
      expect([wing, commands.apply({ type: "wing", wing, add: true }).accepted]).toEqual([wing, true]);
    }
    sim.rules = { ...sim.rules, drought: { months: [3, 4], share: 0.4 },
      seasons: [{ disaster: "flood", months: [9], chancePerMonth: 0.5 }] };
    expect(sim._drought().share).toBeCloseTo(0.2);
    const risk = sim._seasonalRisks(8)[0].chance;
    sim.rules = { ...sim.rules };
    map.rulerHouse.wings = [];
    expect(sim._seasonalRisks(8)[0].chance).toBeGreaterThan(risk);
    expect(houseLandValue({ ...map.rulerHouse, wings: ["front_garden"] }, 12, 10))
      .toBe(2 * houseLandValue({ ...map.rulerHouse, wings: [] }, 12, 10));
    expect(cultureNoise({ x: 10, y: 10, level: 6, wings: ["culture_court"] }, 11, 10)).toBeGreaterThan(0);
    expect(cultureNoise({ x: 10, y: 10, level: 6, wings: [] }, 11, 10)).toBe(0);
  });

  test("the window shows what each wing can do now", () => {
    const rows = wingRows({ x: 0, y: 0, level: 2, wings: ["treasury"] }, 100);
    expect(rows.find((row) => row.wing === "treasury")?.state).toBe("remove");
    expect(rows.find((row) => row.wing === "granary")?.state).toBe("no_room");
    expect(rows.find((row) => row.wing === "council_hall")?.state).toBe("no_room");
    expect(rows.find((row) => row.wing === "trade_office")?.state).toBe("waits_network");
    expect(wingRows({ x: 0, y: 0, level: 3, wings: [] }, 100).find((row) => row.wing === "granary")?.state)
      .toBe("no_money");
  });

  test("have their words in both languages", () => {
    for (const wing of WINGS) {
      for (const key of [`house.wing.${wing}`, `house.wing.${wing}.gain`, `house.wing.${wing}.cost`]) {
        expect([key, hasKey(key)]).toEqual([key, true]);
      }
    }
    for (let level = 1; level <= MAX_HOUSE_LEVEL; level++) expect(hasKey(`house.level.${level}`)).toBe(true);
    for (const key of ["tool.ruler_house", "tool.ruler_house_upgrade", "tool.ruler_house_wings", "choice.title.ruler_house",
      "budget.house", "msg.bad.ruler_house_lost", "goals.house", "about.building.ruler_house", "rules.cost.ruler_house"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
  });
});
