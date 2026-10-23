/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The department store (src/departmentStores.ts, docs/GAME_DESIGN.md 22): on a real-scale city map the shops wait for
// one past a cap that each store lifts, in the airport's place; elsewhere the airport's rule stands. A ruler's building on
// the civic 3 × 3 that costs its upkeep and adds land value, visitors and shoppers.

import { CityCommands } from "../src/cityCommands";
import { DepartmentStores, PEOPLE_A_SHOP_UNIT, shopCap, shopCapView, shopsHeld, STORE_KIND, STORE_RULES } from "../src/departmentStores";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { buildingAt } from "../src/objects/buildings";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { POWERBIT } from "../src/tileFlags";
import { CIVIC } from "../src/tileValues";
import { eraUnlocks, UNLOCKS } from "../src/unlocks";
import { eraKindFor } from "../src/render3d/city/eraBuildings";

function city(tileSizeM: number | null) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.rulerHouse = null;
  map.tileSizeM = tileSizeM;
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => 5,
    setCivicKind: (x: number, y: number, kind: string) => { map.civicKinds[y * map.width + x] = kind; },
  } as any);
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  return { map, sim, tool };
}

describe("the department store", () => {
  test("its price, words and unlock: a market town's building that needs power first", () => {
    expect(BASE_PRICES.department_store).toBe(STORE_RULES.price);
    for (const key of ["tool.department_store", "rules.cost.department_store", "msg.need.store", "budget.stores",
      "about.building.department_store", "object.fact.store_shops", "object.fact.store_held"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
    expect(UNLOCKS.department_store).toMatchObject({ era: 2, first: ["power_plant"] });
    expect(UNLOCKS.department_store.months).toBeGreaterThan(0);
    expect(eraUnlocks(2)).toContain("department_store");
  });

  test("on a real-scale city map the shops wait at the cap of the stores standing; elsewhere for the airport", () => {
    const metric = { tileSizeM: 16 }, province = { tileSizeM: 500 }, practice = {};
    expect(shopCap(0)).toBe(STORE_RULES.shopsFree);
    expect(shopCap(1)).toBe(STORE_RULES.shopsFree + STORE_RULES.shopsPerStore);
    expect(shopCap(2)).toBeGreaterThan(shopCap(1));
    expect(shopsHeld(metric, { comPop: STORE_RULES.shopsFree - 1, airportPop: 0 }, 0)).toBe(false);
    expect(shopsHeld(metric, { comPop: STORE_RULES.shopsFree, airportPop: 0 }, 0)).toBe(true);
    // ... an airport does not lift it there, a store does
    expect(shopsHeld(metric, { comPop: STORE_RULES.shopsFree, airportPop: 1 }, 0)).toBe(true);
    expect(shopsHeld(metric, { comPop: STORE_RULES.shopsFree, airportPop: 0 }, 1)).toBe(false);
    expect(shopsHeld(metric, { comPop: shopCap(1), airportPop: 0 }, 1)).toBe(true);
    for (const map of [province, practice]) {
      expect(shopsHeld(map, { comPop: 100, airportPop: 0 }, 0)).toBe(false);
      expect(shopsHeld(map, { comPop: 101, airportPop: 0 }, 3)).toBe(true);
      expect(shopsHeld(map, { comPop: 500, airportPop: 1 }, 0)).toBe(false);
    }
    expect(shopCapView(STORE_RULES.shopsFree, 0, true)).toEqual({ shops: STORE_RULES.shopsFree * PEOPLE_A_SHOP_UNIT,
      cap: STORE_RULES.shopsFree * PEOPLE_A_SHOP_UNIT, held: true });
  });

  test("a store pays its upkeep, counts once scanned, adds land value near it and visitors with power", () => {
    const stores = new DepartmentStores();
    const map = { width: 40, civicKinds: { [10 * 40 + 10]: STORE_KIND, [30 * 40 + 30]: "primary_school" } as Record<string, string>,
      getTileFlags: (x: number) => (x === 10 ? POWERBIT : 0) };
    const census: { storeUpkeep?: number } = {};
    expect(stores.found(map, 30, 30, census)).toBe(false);
    expect(stores.found(map, 10, 10, census)).toBe(true);
    expect(census.storeUpkeep).toBe(STORE_RULES.upkeep);
    expect(stores.count).toBe(0);
    stores.endCycle();
    expect(stores.count).toBe(1);
    expect(stores.appeal()).toBeCloseTo(STORE_RULES.appeal);
    expect(stores.landValueAt(10, 10)).toBe(STORE_RULES.landValue);
    expect(stores.landValueAt(12, 10)).toBeGreaterThan(0);
    expect(stores.landValueAt(10 + STORE_RULES.landReach, 10)).toBe(0);
    // (a further step of distance reaches further, as on a real-scale map)
    expect(stores.landValueAt(10 + STORE_RULES.landReach, 10, 2)).toBeGreaterThan(0);
    stores.clearCycle();
    stores.endCycle();
    expect(stores.count).toBe(0);
    expect(stores.appeal()).toBe(0);
  });

  test("the tool builds it on the civic 3 × 3; the scan counts it, its card says how far the shops may grow", () => {
    const { map, sim, tool } = city(16);
    expect(tool("department_store", 20, 20).toolResult).toBe(0);
    expect(map.getTileValue(20, 20)).toBe(CIVIC);
    expect(map.civicKinds[20 * map.width + 20]).toBe(STORE_KIND);
    // (the news and the caps come once in 64 of the city's steps)
    for (let step = 0; step < 16 * 64; step++) sim._simulate(sim._constructSimData());
    expect(sim._stores.count).toBe(1);
    expect(sim._census.storeUpkeep).toBe(STORE_RULES.upkeep);
    expect(sim._valves.comCap).toBe(false);
    expect(map.shopCap).toMatchObject({ cap: shopCap(1) * PEOPLE_A_SHOP_UNIT, held: false });
    const card = buildingAt(map, 20, 20)!;
    expect(card.sort(map)).toBe(STORE_KIND);
    expect(card.facts(map).map((f) => f.key)).toContain("object.fact.store_shops");
    // A province map says nothing of stores
    const province = city(500);
    province.tool("department_store", 20, 20);
    for (let step = 0; step < 16 * 64; step++) province.sim._simulate(province.sim._constructSimData());
    expect(province.map.shopCap).toBeNull();
  });

  test("the 3D view draws its era's model from the market town on", () => {
    expect(eraKindFor("civic.department_store", undefined, 1)).toBeNull();
    for (const era of [2, 3, 4, 5]) expect(eraKindFor("civic.department_store", undefined, era)).toBe("store");
  });
});
