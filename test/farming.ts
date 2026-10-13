/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Farms and fishing harbours (docs/FARMING.md): sales, what they ask for, the water and haze farms cost, the fish
// harbours use up, and the city running them.

import { CityCommands, NEEDS_WATER, NO_RESOURCE } from "../src/cityCommands";
import {
  besideWater3, BURNING_MONTHS, Farming, farmIncome, farmLevel, fisheryLevel, harbourIncome, HAZE, nextStock,
} from "../src/farming";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import * as Messages from "../src/messages";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { FARM, HARBOUR, RIVER } from "../src/tileValues";

const JANUARY = 0;
const MARCH = 2;
const JULY = 6;

describe("farms and fishing harbours", () => {
  test("farm only in a province with farmland and fish only in one with fishing; a practice map does both", () => {
    expect([farmLevel({ farmland: 0, fishery: 3 }), fisheryLevel({ farmland: 0, fishery: 3 })]).toEqual([0, 3]);
    expect([farmLevel({}), fisheryLevel({})]).toEqual([2, 2]);
    expect([BASE_PRICES.farm, BASE_PRICES.fishing]).toEqual([300, 1200]);
  });

  test("a farm sells more on wet ground and in a farming province, and less in the dry season", () => {
    expect(farmIncome(5, 1, JULY, [])).toBeGreaterThan(farmIncome(1, 1, JULY, []));
    expect(farmIncome(3, 1, JULY, [])).toBeGreaterThan(farmIncome(3, 0, JULY, []));
    expect(farmIncome(3, 1, JANUARY, [1, 2])).toBeLessThan(farmIncome(3, 1, JANUARY, []));
    expect(farmIncome(0, 1, JULY, [])).toBe(0);
  });

  test("a harbour's catch follows the fish, and dirty water halves it", () => {
    expect(harbourIncome(3, 1, false)).toBeGreaterThan(harbourIncome(3, 0.3, false));
    expect(harbourIncome(3, 1, true)).toBe(Math.round(harbourIncome(3, 1, false) / 2));
  });

  test("too many harbours empty the fish, which grow back slowly when left alone", () => {
    let stock = 1;
    for (let month = 0; month < 60; month++) stock = nextStock(stock, 1);
    const fewHarbours = stock;
    stock = 1;
    for (let month = 0; month < 60; month++) stock = nextStock(stock, 8);
    expect(stock).toBeLessThan(fewHarbours);
    expect(stock).toBeLessThan(1 / 3);
    const empty = stock;
    for (let month = 0; month < 24; month++) stock = nextStock(stock, 0);
    expect(stock).toBeGreaterThan(empty);
    expect(stock).toBeLessThan(1);
  });

  test("farms pump the ground, put chemicals in it and, in the burning months, haze in the air", () => {
    const farming = new Farming(20, 20, { farmland: 3 });
    farming.farms = [{ x: 10, y: 10 }];
    const stores = new Uint8Array(400).fill(128);
    const natural = new Uint8Array(400).fill(4);
    const poison = new Uint8Array(400);
    const july = farming.month(JULY, [], { stores, natural }, poison, () => 0);
    expect(july.income).toBeGreaterThan(0);
    expect(july.burning).toBe(false);
    expect(stores[10 * 20 + 10]).toBeLessThan(128);
    expect(poison[10 * 20 + 10]).toBeGreaterThan(0);
    expect(farming.hazeAt(10, 10)).toBe(0);
    expect(BURNING_MONTHS).toContain(MARCH);
    const march = farming.month(MARCH, [], { stores, natural }, poison, () => 0);
    expect(march.burning).toBe(true);
    expect(farming.hazeAt(10, 10)).toBe(HAZE);
    expect(farming.hazeAt(13, 10)).toBeGreaterThan(0);
    expect(farming.hazeAt(17, 10)).toBe(0);
  });

  test("harbours stand beside water", () => {
    expect(besideWater3(10, 10, (x, y) => x === 10 && y === 8)).toBe(true);
    expect(besideWater3(10, 10, (x, y) => x === 10 && y === 7)).toBe(false);
  });

  test("save the fish, and an older save starts with a full stock", () => {
    const farming = new Farming(8, 8);
    farming.fishStock = 0.4;
    const saved: Record<string, unknown> = {};
    farming.save(saved);
    const loaded = new Farming(8, 8);
    loaded.load(saved);
    expect(loaded.fishStock).toBe(0.4);
    const old = new Farming(8, 8);
    old.load({});
    expect(old.fishStock).toBe(1);
  });
});

describe("farms and harbours in the city", () => {
  const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);

  function city(resources: Record<string, number>) {
    const map = blank();
    const sim: any = new (Simulation as any)(map, 0, 3, null, null, resources);
    const tools: any = new (GameTools as any)(map);
    sim.budget.setFunds(50000);
    const commands = new CityCommands({
      width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
      disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
      resources: sim.resources,
      isWaterAt: (x: number, y: number) => map.testBounds(x, y) && map.getTileValue(x, y) === RIVER,
    } as any);
    return { map, sim, commands };
  }

  test("are refused where the province has none, and a harbour away from water", () => {
    const dry = city({ farmland: 0, fishery: 0 });
    expect(dry.commands.apply({ type: "tool", tool: "farm", x: 10, y: 10 }).reason).toBe(NO_RESOURCE);
    expect(dry.commands.apply({ type: "tool", tool: "fishing", x: 10, y: 10 }).reason).toBe(NO_RESOURCE);
    const wet = city({ farmland: 3, fishery: 3 });
    expect(wet.commands.apply({ type: "tool", tool: "fishing", x: 10, y: 10 }).reason).toBe(NEEDS_WATER);
    for (let x = 0; x < 30; x++) wet.map.setTile(x, 8, RIVER, 0);
    expect(wet.commands.apply({ type: "tool", tool: "fishing", x: 10, y: 10 }).toolResult).toBe(0);
    expect(wet.map.getTileValue(10, 10)).toBe(HARBOUR);
  });

  test("sell into the year's taxes, give work, and ask for factories and markets", () => {
    const { map, sim, commands } = city({ farmland: 4, fishery: 4 });
    for (let x = 0; x < 64; x++) map.setTile(x, 8, RIVER, 0);
    expect(commands.apply({ type: "tool", tool: "farm", x: 30, y: 20 }).toolResult).toBe(0);
    expect(commands.apply({ type: "tool", tool: "fishing", x: 10, y: 10 }).toolResult).toBe(0);
    expect(map.getTileValue(30, 20)).toBe(FARM);
    const news: string[] = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => news.push(m.subject));
    for (let step = 0; step < 16 * 16; step++) sim._simulate(sim._constructSimData()); // past March
    expect(sim.budget.farmFund).toBeGreaterThan(0);
    expect([sim._census.farmCount, sim._census.harbourCount]).toEqual([1, 1]);
    expect(sim._valves.farmFactories).toBeGreaterThan(0);
    expect(sim._valves.fishMarkets).toBeGreaterThan(0);
    expect(sim._farming.fishStock).toBeLessThan(1);
    expect(news).toContain(Messages.HAZE);
  });

  test("has its words in both languages", () => {
    for (const key of ["tool.farm", "tool.fishing", "tool.needs_water_harbour", "budget.farming", "msg.bad.haze",
      "msg.bad.few_fish", "msg.bad.dirty_harbour", "map.key.farm", "map.key.fishing", "rules.cost.farm",
      "rules.cost.fishing", "about.building.farm", "about.building.fishing"]) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});
