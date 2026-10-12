/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { Census } from "../src/census.js";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import * as Messages from "../src/messages";
import {
  BASE_PRICES, chancePerCycle, checkRulesData, DEFAULT_RULES, formatPrice, resolveRules, ruleEffects, Rules,
  seasonalRisks, TOOL_COSTS, toolPrices, ZONES,
} from "../src/provinceRules";
import { Random } from "../src/random";
import { Simulation } from "../src/simulation.js";
import { WOODS } from "../src/tileValues";
import { Valves } from "../src/valves.js";

const root = path.join(__dirname, "..");
const rulesFile = JSON.parse(fs.readFileSync(path.join(root, "data", "province-rules.json"), "utf8"));
const provinces = JSON.parse(fs.readFileSync(path.join(root, "data", "thailand-provinces.json"), "utf8"));
const month = (key: string) => key;

describe("province rules", () => {
  test("the rules file is valid and covers every region", () => {
    const { data, problems } = checkRulesData(rulesFile);
    expect(problems).toEqual([]);
    expect(Object.keys(data.regions).sort()).toEqual(provinces.regions.map((r: { id: string }) => r.id).sort());
    // Each region has something good and something hard
    for (const region of Object.keys(data.regions)) {
      const effects = ruleEffects(resolveRules(data, region, null), month);
      expect({ region, good: effects.some((e) => e.good), hard: effects.some((e) => !e.good) })
        .toEqual({ region, good: true, hard: true });
    }
  });

  test("report and drop anything wrong, keeping the rest", () => {
    const { data, problems } = checkRulesData({
      version: 1,
      regions: {
        north: { demand: { commercial: 1.4, farms: 2, industrial: 9 }, clearWoodsCost: 2.5, colour: "red", _note: "ok" },
        atlantis: { powerPlantOutput: 2 },
      },
      provinces: {
        "TH-50": { seasons: [{ disaster: "flood", months: [9, 10], chancePerMonth: 0.2 },
          { disaster: "volcano", months: [1], chancePerMonth: 0.1 }, { disaster: "fire", months: [13], chancePerMonth: 0.1 },
          { disaster: "fire", months: [3], chancePerMonth: 2 }] },
        "Bangkok": { demand: { commercial: 2 } },
        "_note": "comments are fine",
      },
    });
    expect(data.regions).toEqual({ north: { demand: { commercial: 1.4 } } });
    expect(data.provinces).toEqual({ "TH-50": { seasons: [{ disaster: "flood", months: [9, 10], chancePerMonth: 0.2 }] } });
    expect(problems).toEqual([
      "regions.north.demand.farms: unknown",
      "regions.north.demand.industrial: must be 0.1–5",
      "regions.north.clearWoodsCost: must be a whole number 0–100",
      "regions.north.colour: unknown",
      "rules.regions.atlantis: unknown region",
      "provinces.TH-50.seasons[1].disaster: must be one of fire, flood, tornado",
      "provinces.TH-50.seasons[2].months: must list months 1–12",
      "provinces.TH-50.seasons[3].chancePerMonth: must be 0–1",
      "rules.provinces.Bangkok: unknown province",
    ]);
    expect(checkRulesData("nope").problems).toEqual(["rules: not an object"]);
    expect(checkRulesData({ version: 2 }).problems).toEqual(["rules.version: must be 1"]);
  });

  test("layer the game's rules, the region's and the province's", () => {
    const data = checkRulesData({
      version: 1,
      regions: { central: { demand: { commercial: 1.4 }, cost: { road: 1.2 },
        seasons: [{ disaster: "flood", months: [9, 10, 11], chancePerMonth: 0.3 }] } },
      provinces: { "TH-14": { demand: { commercial: 1.6 }, seasons: [{ disaster: "flood", months: [8, 9, 10, 11], chancePerMonth: 0.5 }] } },
    }).data;
    const ayutthaya = resolveRules(data, "central", "TH-14");
    expect(ayutthaya.demand).toEqual({ residential: 1, commercial: 1.6, industrial: 1 });
    expect(ayutthaya.cost.road).toBe(1.2); // from the region
    expect(ayutthaya.seasons).toEqual([{ disaster: "flood", months: [8, 9, 10, 11], chancePerMonth: 0.5 }]);
    expect(resolveRules(data, "central", "TH-10").demand.commercial).toBe(1.4); // no rules of its own
    expect(resolveRules(data, null, null)).toEqual(DEFAULT_RULES); // a practice map
    expect(resolveRules(null, "central", "TH-14")).toEqual(DEFAULT_RULES);
  });

  test("say what the rules change, in words with numbers", () => {
    const rules: Rules = { ...DEFAULT_RULES, demand: { ...DEFAULT_RULES.demand, commercial: 1.4 },
      cost: { ...DEFAULT_RULES.cost, residential: 0.6 }, clearWoodsCost: 5, powerPlantOutput: 1.5,
      seasons: [{ disaster: "flood", months: [9, 10, 11], chancePerMonth: 0.3 },
        { disaster: "fire", months: [3, 5], chancePerMonth: 0.25 }] };
    expect(ruleEffects(rules, month)).toEqual([
      { key: "rules.demand.commercial", params: { change: "+40%" }, good: true },
      { key: "rules.cost.residential", params: { change: "-40%" }, good: true },
      { key: "rules.clear_woods", params: { price: "5" }, good: false },
      { key: "rules.power_output", params: { change: "+50%" }, good: true },
      { key: "rules.season.flood", params: { months: "sep–nov", chance: "30%" }, good: false },
      { key: "rules.season.fire", params: { months: "mar, may", chance: "25%" }, good: false },
    ]);
    expect(ruleEffects(DEFAULT_RULES, month)).toEqual([]);
  });

  test("have words for every rule in both languages", () => {
    const keys = [...ZONES.map((z) => `rules.demand.${z}`), ...TOOL_COSTS.map((tool) => `rules.cost.${tool}`),
      "rules.clear_woods", "rules.industry_pollution", "rules.power_output", "rules.season.fire", "rules.season.flood",
      "rules.season.tornado", "picker.rules"];
    expect(keys.filter((key) => !hasKey(key))).toEqual([]);
    for (const tool of TOOL_COSTS) expect(hasKey(`tool.${tool}`)).toBe(true);
  });

  test("spread a month's chance over the month's four cycles, only in its season", () => {
    const perCycle = chancePerCycle(0.3);
    expect(1 - Math.pow(1 - perCycle, 4)).toBeCloseTo(0.3, 10);
    expect([chancePerCycle(0), chancePerCycle(1)]).toEqual([0, 1]);
    const rules = { ...DEFAULT_RULES, seasons: [{ disaster: "tornado" as const, months: [10, 11, 12], chancePerMonth: 0.25 }] };
    expect(seasonalRisks(rules, 8)).toEqual([]); // September
    expect(seasonalRisks(rules, 11)).toEqual([{ disaster: "tornado", chance: chancePerCycle(0.25) }]); // December
  });

  test("price the tools as the buttons show them", () => {
    expect(formatPrice(5)).toBe("฿5");
    expect(formatPrice(100)).toBe("฿100");
    expect(formatPrice(3000)).toBe("฿3K");
    expect(formatPrice(2100)).toBe("฿2.1K");
    expect(formatPrice(10000)).toBe("฿10K");
    const northeast = toolPrices(resolveRules(checkRulesData(rulesFile).data, "northeast", "TH-30"));
    expect([northeast.residential, northeast.road]).toEqual([60, 10]);
    // The display prices are the tools' own
    const tools: any = new (GameTools as any)(new (GameMap as any)(20, 20));
    for (const tool of TOOL_COSTS) {
      const own = tool === "bulldozer" ? tools[tool].bulldozerCost : tools[tool].toolCost;
      expect([tool, BASE_PRICES[tool]]).toEqual([tool, own]);
    }
  });
});

describe("province rules in a city", () => {
  const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(120, 100);
  const build = (tools: any, sim: any, tool: string, x: number, y: number) => {
    const before = sim.budget.totalFunds;
    tools[tool].doTool(x, y, sim.blockMaps);
    tools[tool].modifyIfEnoughFunding(sim.budget);
    expect(tools[tool].result).toBe(0);
    return before - sim.budget.totalFunds;
  };
  const rulesWith = (patch: Partial<Rules>): Rules => ({ ...DEFAULT_RULES, ...patch });

  test("charge the province's prices, and its price for clearing woods", () => {
    const map = blank();
    const rules = rulesWith({ cost: { ...DEFAULT_RULES.cost, residential: 0.6, road: 1.5 }, clearWoodsCost: 5 });
    const sim: any = new (Simulation as any)(map, 0, 3, null, rules);
    const tools: any = new (GameTools as any)(map, rules);
    expect(build(tools, sim, "residential", 10, 10)).toBe(60);
    expect(build(tools, sim, "road", 20, 10)).toBe(15);
    // A zone over woods: the zone, plus nine tiles of woods cleared
    for (let y = 29; y <= 31; y++) for (let x = 29; x <= 31; x++) map.setTile(x, y, WOODS, 0);
    expect(build(tools, sim, "residential", 30, 30)).toBe(60 + 9 * 5);
    // The game's own rules: woods cost the old ฿1 a tile
    const plain: any = new (GameTools as any)(map);
    for (let y = 49; y <= 51; y++) for (let x = 49; x <= 51; x++) map.setTile(x, y, WOODS, 0);
    expect(build(plain, sim, "residential", 50, 50)).toBe(100 + 9);
  });

  test("hand the demand and power rules to the simulation", () => {
    const rules = rulesWith({ demand: { residential: 1, commercial: 1.4, industrial: 0.7 }, powerPlantOutput: 1.5 });
    const sim: any = new (Simulation as any)(blank(), 0, 3, null, rules);
    expect(sim._valves.demand).toEqual({ residential: 1, commercial: 1.4, industrial: 0.7 });
    expect(sim._powerManager.outputFactor).toBe(1.5);
    expect(new (Simulation as any)(blank(), 0, 3, null).rules).toEqual(DEFAULT_RULES);
  });

  // The same town built twice under different rules, from the same seed
  const town = (rules: Rules, years: number) => {
    Random.seed(42);
    const map = blank();
    const sim: any = new (Simulation as any)(map, 0, 3, null, rules);
    sim.budget.setFunds(100000);
    const tools: any = new (GameTools as any)(map);
    build(tools, sim, "coal", 10, 10); // tiles 9–12
    for (let k = 0; k < 6; k++) build(tools, sim, "residential", 14 + 3 * k, 10); // rows 9–11, touching the plant
    for (let x = 13; x < 34; x++) build(tools, sim, "road", x, 12);
    for (let k = 0; k < 4; k++) build(tools, sim, "commercial", 14 + 3 * k, 14); // rows 13–15
    for (let x = 13; x < 34; x++) build(tools, sim, "road", x, 16);
    for (let k = 0; k < 4; k++) build(tools, sim, "industrial", 14 + 3 * k, 18); // rows 17–19
    for (let y = 13; y <= 17; y++) build(tools, sim, "wire", 12, y); // down the plant's side to the shops and factories
    for (let step = 0; step < years * 768; step++) {
      const simData = sim._constructSimData();
      sim._simulate(simData);
    }
    return sim;
  };

  test("make each kind of zone wanted more or less where the rules say so", () => {
    // A city whose shops and factories are wanted a little more than it has: 800 people, 40 shops, 40 factories
    const valvesAfterOneUpdate = (demand: Rules["demand"]) => {
      const census = new (Census as any)();
      Object.assign(census, { resPop: 800, comPop: 40, indPop: 40 });
      census.resHist10[1] = 100;
      census.comHist10[1] = 40;
      census.indHist10[1] = 40;
      const valves = new (Valves as any)();
      valves.demand = demand;
      valves.setValves(0, census, { cityTax: 7 });
      return { res: valves.resValve, com: valves.comValve, ind: valves.indValve };
    };
    const plain = valvesAfterOneUpdate(DEFAULT_RULES.demand);
    const keen = valvesAfterOneUpdate({ residential: 1, commercial: 1.4, industrial: 0.7 });
    expect(plain.com).toBeGreaterThan(0);
    expect(keen.com).toBeGreaterThan(plain.com);
    expect(keen.ind).toBeLessThan(plain.ind);
    expect(keen.res).toBe(plain.res);
  });

  test("make factories smoke more where the rules say so", () => {
    const pollutionAt = (sim: any) => {
      let total = 0;
      for (let y = 16; y < 22; y += 2) for (let x = 12; x < 28; x += 2) total += sim.blockMaps.pollutionDensityMap.worldGet(x, y);
      return total;
    };
    const plain = town(DEFAULT_RULES, 3);
    const smoky = town(rulesWith({ industryPollution: 2 }), 3);
    expect(plain._census.indPop).toBeGreaterThan(0);
    expect(pollutionAt(smoky)).toBeGreaterThan(pollutionAt(plain));
  });

  test("bring the season's disasters while disasters are on, and none while they are off", () => {
    const fires = (enabled: boolean) => {
      Random.seed(7);
      const map = blank();
      for (let y = 30; y < 90; y++) for (let x = 30; x < 110; x++) map.setTile(x, y, WOODS, 0x2000); // burnable woods
      const rules = rulesWith({ seasons: [{ disaster: "fire", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], chancePerMonth: 1 }] });
      const sim: any = new (Simulation as any)(map, 0, 3, null, rules);
      sim.disasterManager.disastersEnabled = enabled;
      const messages: string[] = [];
      sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => messages.push(m.subject));
      for (let step = 0; step < 16 * 8; step++) sim._simulate(sim._constructSimData());
      return messages.filter((subject) => subject === Messages.FIRE_REPORTED).length;
    };
    expect(fires(true)).toBeGreaterThan(0);
    expect(fires(false)).toBe(0);
  });
});
