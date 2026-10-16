/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rubbish and wastewater (src/waste.ts, docs/WASTE.md): five buildings on one 3x3 of tiles take the month's rubbish,
// the cleanest first; landfills fill and seep, rubbish nobody takes lies in the streets, and untreated sewage spoils the
// water for harbours and visitors.

import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { POWERBIT } from "../src/tileFlags";
import { RESBASE, WASTE, WASTE_BASE } from "../src/tileValues";
import {
  LANDFILL_HOLDS, LANDFILL_WARN, OVERFLOW_RISE, OWN_RUBBISH, OWN_SEWAGE, RUBBISH_POLLUTION, rubbishOf, SEWAGE_FULL, Waste, WASTE_KINDS, WASTE_POWER,
  WASTE_SPECS, type WasteKind, wasteKindAt,
} from "../src/waste";

function city(resources: Record<string, number> | null = null) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.wasteKinds = {};
  map.rulerHouse = null;
  const sim: any = new (Simulation as any)(map, 0, 3, null, null, resources);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime,
    setWasteKind: (x: number, y: number, kind: string) => { map.wasteKinds[y * map.width + x] = kind; },
  } as any);
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  const run = (cycles: number) => { for (let step = 0; step < 16 * cycles; step++) sim._simulate(sim._constructSimData()); };
  return { map, sim, tool, run };
}

/** A Waste with these buildings working, as a scan would have found them, on a 40 × 40 map. */
function working(kinds: WasteKind[]): Waste {
  const waste = new Waste(40, 40);
  const map = { width: 40, getTileFlags: () => POWERBIT, wasteKinds: {} as Record<string, string> };
  kinds.forEach((kind, i) => {
    map.wasteKinds[String(5 * 40 + 4 + 4 * i)] = kind;
    waste.found(map, 4 + 4 * i, 5, { indPop: 0 });
  });
  return waste;
}

describe("rubbish and wastewater", () => {
  test("five kinds on the 992–1000 tiles, each with its price, strings and province price", () => {
    expect(WASTE_KINDS).toHaveLength(5);
    for (const kind of WASTE_KINDS) {
      expect([kind, BASE_PRICES[kind]]).toEqual([kind, WASTE_SPECS[kind].price]);
      expect([kind, hasKey(`tool.${kind}`), hasKey(`choice.${kind}`), hasKey(`rules.cost.${kind}`)])
        .toEqual([kind, true, true, true]);
    }
    for (const key of ["choice.title.landfill", "budget.waste", "budget.recycling", "msg.bad.rubbish_overflow",
      "msg.bad.landfill_full", "msg.bad.untreated_sewage", "map.key.waste", "about.building.waste", "status.waste",
      "status.waste_value", "status.waste_title"]) expect([key, hasKey(key)]).toEqual([key, true]);
    // The landfill is the cheapest, and the only one besides the waste power plant to need no power
    expect(Math.min(...WASTE_KINDS.map((kind) => WASTE_SPECS[kind].price))).toBe(WASTE_SPECS.landfill.price);
    expect(WASTE_KINDS.filter((kind) => !WASTE_SPECS[kind].needsPower).sort()).toEqual(["landfill", "waste_power_plant"]);
    expect(wasteKindAt({ "7": "incinerator" }, 7)).toBe("incinerator");
    expect(wasteKindAt({ "7": "church" }, 7)).toBe("landfill");
  });

  test("the tools build on the waste tiles, and the map records which stands where", () => {
    const { map, tool } = city();
    expect(tool("incinerator", 20, 20).toolResult).toBe(0);
    expect(map.getTileValue(20, 20)).toBe(WASTE);
    expect(map.getTileValue(19, 19)).toBe(WASTE_BASE);
    expect(map.wasteKinds[20 * map.width + 20]).toBe("incinerator");
    expect(tool("wastewater_plant", 30, 20).toolResult).toBe(0);
    expect(map.wasteKinds[20 * map.width + 30]).toBe("wastewater_plant");
  });

  test("the cleanest take the month's rubbish first, recycling sells, and what is left lies in the streets", () => {
    const waste = working(["landfill", "recycling_plant"]);
    const people = 20000; // 600 tonnes
    let month = waste.month(people, 0, new Uint8Array(1600));
    expect(month.rubbish).toBeCloseTo(600);
    expect(month.taken).toBeCloseTo(600);
    expect(month.sales).toBeCloseTo(WASTE_SPECS.recycling_plant.takes * WASTE_SPECS.recycling_plant.sales);
    expect(waste.fill[String(5 * 40 + 4)]).toBeCloseTo(600 - WASTE_SPECS.recycling_plant.takes);
    expect(month.overflow).toBe(0);
    expect(month.rubbishShare).toBe(100);
    // Twice the people: more than the two can take
    month = waste.month(40000, 0, new Uint8Array(1600));
    const left = rubbishOf(40000, 0) - WASTE_SPECS.landfill.takes - WASTE_SPECS.recycling_plant.takes;
    // The streets get dirtier a month at a time (OVERFLOW_RISE), up to what lies there
    const lying = (left - OWN_RUBBISH) / 600;
    expect(month.overflow).toBeCloseTo(Math.min(lying, OVERFLOW_RISE));
    for (let m = 0; m < 10; m++) month = waste.month(40000, 0, new Uint8Array(1600));
    expect(month.overflow).toBeCloseTo(lying);
    expect(month.rubbishShare).toBeLessThan(100);
  });

  test("a small town buries and burns its own; visitors make rubbish too", () => {
    const waste = new Waste(10, 10);
    const month = waste.month(1500, 0, new Uint8Array(100));
    expect(month.rubbish).toBeLessThan(OWN_RUBBISH);
    expect([month.overflow, month.rubbishShare, month.sewage]).toEqual([0, 100, 0]);
    expect(rubbishOf(0, 1000)).toBeGreaterThan(0);
  });

  test("the news hears once when a landfill is nearly full, while there is time to build another", () => {
    const waste = working(["landfill"]);
    const ground = new Uint8Array(1600);
    const key = String(5 * 40 + 4);
    waste.fill[key] = LANDFILL_HOLDS * LANDFILL_WARN - 100;
    expect(waste.month(20000, 0, ground).nearlyFull).toHaveLength(1);
    expect(waste.month(20000, 0, ground).nearlyFull).toHaveLength(0);
    expect(hasKey("msg.bad.landfill_nearly_full")).toBe(true);
  });

  test("a landfill fills for good, seeps into the ground, and is forgotten when gone", () => {
    const waste = working(["landfill"]);
    const ground = new Uint8Array(1600);
    const key = String(5 * 40 + 4);
    waste.fill[key] = LANDFILL_HOLDS - 100;
    const month = waste.month(20000, 0, ground);
    expect(month.filled).toHaveLength(1);
    expect(waste.fill[key]).toBe(LANDFILL_HOLDS);
    expect(ground[5 * 40 + 4]).toBeGreaterThan(0);
    // Full: it takes nothing more, and says so only once
    const next = waste.month(20000, 0, ground);
    expect(next.filled).toHaveLength(0);
    expect(next.taken).toBe(0);
    // Bulldozed: the next scan finds no landfill there
    waste.clearCycle();
    waste.month(20000, 0, ground);
    expect(waste.fill[key]).toBeUndefined();
  });

  test("a big town's sewage goes untreated until treatment plants take it", () => {
    const none = new Waste(10, 10);
    expect(none.month(OWN_SEWAGE, 0, new Uint8Array(100)).sewage).toBe(0);
    expect(none.month(30000, 0, new Uint8Array(100)).sewage).toBe(1);
    const one = working(["wastewater_plant"]);
    const month = one.month(30000, 0, new Uint8Array(1600));
    expect(month.sewage).toBeCloseTo((30000 - WASTE_SPECS.wastewater_plant.treats - OWN_SEWAGE) / SEWAGE_FULL);
    expect(month.sewageShare).toBe(Math.round(100 * (WASTE_SPECS.wastewater_plant.treats + OWN_SEWAGE) / 30000));
  });

  test("smoke while working and smell on their own tiles, and rubbish on homes and shops", () => {
    const map = { width: 40, getTileFlags: () => 0, wasteKinds: { [String(5 * 40 + 4)]: "landfill", [String(5 * 40 + 8)]: "incinerator" } };
    const waste = new Waste(40, 40);
    waste.found(map, 4, 5, { indPop: 0 });
    waste.found(map, 8, 5, { indPop: 0 }); // no power: it does not burn
    expect(waste.pollutionAt(map, 3, 4, WASTE_BASE)).toBe(WASTE_SPECS.landfill.smell);
    expect(waste.pollutionAt(map, 7, 4, WASTE_BASE)).toBe(0);
    waste.overflow = 1;
    expect(waste.pollutionAt(map, 20, 20, RESBASE + 10)).toBe(RUBBISH_POLLUTION);
    expect(waste.pollutionAt(map, 20, 20, 0)).toBe(0);
  });

  test("in a city: upkeep counted, power needed, and a waste power plant feeds the grid", () => {
    const { map, sim, tool, run } = city();
    tool("incinerator", 20, 20); // no power out here
    tool("waste_power_plant", 40, 20);
    sim._waste.powerShare = 1;
    run(8);
    expect(sim._census.wasteUpkeep).toBe(WASTE_SPECS.incinerator.upkeep + WASTE_SPECS.waste_power_plant.upkeep);
    expect(sim._waste.sites.map((site: { kind: string }) => site.kind)).toEqual(["waste_power_plant"]);
    expect(sim._waste.standing).toBe(2); // the status bar counts the idle incinerator too
    expect(map.getTileFlags(40, 20) & POWERBIT).toBe(POWERBIT);
    // An empty map makes next to no rubbish, so after a month the plant has almost nothing to burn
    expect(sim._waste.powerShare).toBeLessThan(0.05);
    expect(WASTE_POWER).toBeGreaterThan(0);
  });

  test("untreated sewage keeps visitors away", () => {
    const { sim } = city({ tourism: 4 });
    sim._census.comPop = 200;
    sim._census.totalPop = 100000;
    sim._census.landValueAverage = 100;
    const clean = sim._visitors(10).visitors;
    sim._waste.sewage = 1;
    const dirty = sim._visitors(10).visitors;
    expect(clean).toBeGreaterThan(0);
    expect(dirty).toBeLessThan(clean);
  });

  test("saves what the landfills hold and how last month went", () => {
    const waste = working(["landfill"]);
    waste.month(20000, 0, new Uint8Array(1600));
    const saved: Record<string, unknown> = {};
    waste.save(saved);
    const loaded = new Waste(40, 40);
    loaded.load(JSON.parse(JSON.stringify(saved)));
    expect(loaded.fill).toEqual(waste.fill);
    expect([loaded.powerShare, loaded.overflow, loaded.sewage]).toEqual([waste.powerShare, waste.overflow, waste.sewage]);
    loaded.load({});
    expect(loaded.fill).toEqual(waste.fill);
  });
});
