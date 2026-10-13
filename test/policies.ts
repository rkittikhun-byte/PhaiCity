/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's policies (src/policies.ts, docs/POLICIES.md): room by the house's level and its council hall, switched
// as commands, each with what it brings and what it costs.

import { CityCommands } from "../src/cityCommands";
import { Farming } from "../src/farming";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { rechargeGroundwater } from "../src/groundwater";
import { hasKey } from "../src/i18n/index";
import {
  CLOSED_MONTHS, GREEN_DEMAND, GREEN_LAND_VALUE, hasPolicy, NO_BURNING_YIELD, NO_POLICY_SLOT, POLICIES, POLICY_NO_HOUSE,
  POLICY_UPKEEP, policiesInForce, policyRows, policySlots, policyUpkeep, POLLUTION_TAX_DEMAND, POLLUTION_TAX_RATE,
  readPolicies, SONGKRAN_VISITORS, WATER_SAVING,
} from "../src/policies";
import { HOUSE_KIND, HOUSE_TOOL, HOUSE_UPGRADE_TOOL } from "../src/rulerHouse";
import { Simulation } from "../src/simulation.js";

function city(resources: Record<string, number> | null = null) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.rulerHouse = null;
  map.policies = [];
  const sim: any = new (Simulation as any)(map, 0, 3, null, null, resources);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(200000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => 5,
    setRulerHouse: (x: number, y: number) => {
      map.civicKinds[y * map.width + x] = HOUSE_KIND;
      map.rulerHouse = { x, y, level: 1, wings: [] };
    },
  } as any);
  // The house stands beside a road (src/rulerHouse.ts): roads under the places the tests build it
  for (const [x0, y] of [[7, 12], [27, 12], [37, 32]]) {
    for (let x = x0; x < x0 + 7; x++) commands.apply({ type: "tool", tool: "road", x, y });
  }
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  const policy = (name: string, on = true) => commands.apply({ type: "policy", policy: name as any, on });
  return { map, sim, commands, tool, policy };
}

function withHouse(level: number, resources: Record<string, number> | null = null) {
  const c = city(resources);
  c.tool(HOUSE_TOOL, 10, 10);
  for (let k = 1; k < level; k++) c.tool(HOUSE_UPGRADE_TOOL, 10, 10);
  return c;
}

describe("the ruler's policies", () => {
  test("seven, each with its yearly cost and its words in both languages", () => {
    expect(POLICIES).toHaveLength(7);
    for (const policy of POLICIES) {
      expect(POLICY_UPKEEP[policy]).toBeGreaterThan(0);
      for (const key of [`policy.${policy}`, `policy.${policy}.gain`, `policy.${policy}.cost`]) expect([key, hasKey(key)]).toEqual([key, true]);
    }
    for (const key of ["policy.window.title", "policy.window.none", "policy.window.summary", "policy.money", "policy.state.on",
      "policy.state.off", "policy.state.no_room", "policy.state.no_house", "budget.policies", "budget.pollution_tax",
      "tool.ruler_house_policies", "choice.ruler_house_policies", "about.building.ruler_policies"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
    expect(readPolicies(["water_saving", "nope", "water_saving", 3])).toEqual(["water_saving"]);
  });

  test("need the house; room grows with its level, and the council hall gives one more", () => {
    const none = city();
    expect(none.policy("water_saving")).toMatchObject({ accepted: false, reason: POLICY_NO_HOUSE });
    expect(none.commands.apply({ type: "policy", policy: "nope" as any, on: true }).accepted).toBe(false);
    const { map, commands, policy } = withHouse(3);
    expect(policySlots(map)).toBe(2);
    expect(policy("water_saving").accepted).toBe(true);
    expect(policy("pollution_tax").accepted).toBe(true);
    expect(policy("green_zoning")).toMatchObject({ accepted: false, reason: NO_POLICY_SLOT });
    expect(policyRows(map).find((row) => row.policy === "green_zoning")?.state).toBe("no_room");
    expect(commands.apply({ type: "wing", wing: "council_hall", add: true }).accepted).toBe(true);
    expect(policySlots(map)).toBe(3);
    expect(policy("green_zoning").accepted).toBe(true);
    expect(policyUpkeep(map)).toBe(POLICY_UPKEEP.water_saving + POLICY_UPKEEP.pollution_tax + POLICY_UPKEEP.green_zoning);
    // Without the hall, the last one switched on goes
    expect(commands.apply({ type: "wing", wing: "council_hall", add: false }).accepted).toBe(true);
    expect(map.policies).toEqual(["water_saving", "pollution_tax"]);
    expect(policy("water_saving", false).accepted).toBe(true);
    expect(policiesInForce(map)).toEqual(["pollution_tax"]);
  });

  test("are forgotten when the house falls", () => {
    const { map, sim, tool, policy } = withHouse(1);
    expect(policy("songkran_saving").accepted).toBe(true);
    tool("bulldozer", 10, 10);
    expect(hasPolicy(map, "songkran_saving")).toBe(false);
    sim._houseMonth();
    expect(map.policies).toEqual([]);
  });

  test("set the month's demand, water, ground, fields and harbours", () => {
    const { map, sim, policy } = withHouse(6);
    for (const p of ["water_saving", "green_zoning", "pollution_tax"]) expect(policy(p).accepted).toBe(true);
    sim._policiesMonth();
    expect(sim._valves.policyPull).toBeLessThan(0);
    expect(sim._valves.policyDemand.residential).toBe(GREEN_DEMAND);
    expect(sim._valves.policyDemand.industrial).toBeCloseTo(GREEN_DEMAND * POLLUTION_TAX_DEMAND);
    expect(sim._waterManager.recharge).toBeGreaterThan(1);
    sim._simulate(sim._constructSimData()); // phase 0 of a cycle; the water's saving is set in phase 11
    for (let phase = 1; phase < 12; phase++) sim._simulate(sim._constructSimData());
    expect(sim._waterManager.saving).toBeCloseTo(WATER_SAVING);
    expect(map.policies).toHaveLength(3);
  });

  test("no field burning: no haze, but a smaller crop; a closed season: no catch, and the fish recover", () => {
    const farming = new Farming(20, 20, { farmland: 3, fishery: 3 });
    farming.farms = [{ x: 5, y: 5 }];
    farming.harbours = [{ x: 15, y: 15 }];
    const clean = () => 0;
    const burning = farming.month(1, [], null, null, clean);
    expect(burning.burning).toBe(true);
    farming.noBurning = true;
    const kept = farming.month(1, [], null, null, clean);
    expect(kept.burning).toBe(false);
    expect(farming.hazeAt(5, 5)).toBe(0);
    expect(kept.income).toBeLessThan(burning.income);
    expect(NO_BURNING_YIELD).toBeLessThan(1);
    farming.fishStock = 0.5;
    farming.closedSeason = true;
    const closed = farming.month(CLOSED_MONTHS[0], [], null, null, clean);
    expect(farming.fishStock).toBeGreaterThan(0.5);
    farming.noBurning = false;
    farming.farms = [];
    expect(closed.income).toBeGreaterThan(0); // the farm still sells
    expect(farming.month(CLOSED_MONTHS[0], [], null, null, clean).income).toBe(0);
  });

  test("green zoning fills the ground faster without overfilling it", () => {
    const natural = new Uint8Array([3, 3]);
    const slow = new Uint8Array([0, 0]);
    const fast = new Uint8Array([0, 0]);
    rechargeGroundwater(slow, natural);
    rechargeGroundwater(fast, natural, 1.3);
    expect(fast[0]).toBeGreaterThanOrEqual(slow[0]);
    for (let month = 0; month < 200; month++) rechargeGroundwater(fast, natural, 1.3);
    const full = new Uint8Array([0]);
    for (let month = 0; month < 200; month++) rechargeGroundwater(full, natural);
    expect(fast[0]).toBe(full[0]);
    expect(GREEN_LAND_VALUE).toBeGreaterThan(0);
  });

  test("a water-wise Songkran keeps the water but draws fewer visitors; the pollution tax is paid at the year's end", () => {
    const { sim, policy } = withHouse(2, { tourism: 4 });
    sim._census.comPop = 400;
    sim._census.totalPop = 200000;
    sim._census.landValueAverage = 100;
    const wet = sim._visitors(3); // April: Songkran
    sim._setTourism(wet);
    expect(wet.festival).toBe("songkran");
    expect(sim._waterManager.festivalUse).toBeGreaterThan(0);
    expect(policy("songkran_saving").accepted).toBe(true);
    const dry = sim._visitors(3);
    sim._setTourism(dry);
    expect(sim._waterManager.festivalUse).toBe(0);
    expect(dry.visitors).toBeCloseTo(wet.visitors * SONGKRAN_VISITORS, -1);

    sim.budget.policyCost = 300;
    sim.budget.pollutionTaxRate = POLLUTION_TAX_RATE;
    sim._census.indPop = 50;
    sim.budget.collectTax(0, sim._census);
    expect(sim.budget.pollutionTaxIncome).toBe(50 * POLLUTION_TAX_RATE);
  });
});
