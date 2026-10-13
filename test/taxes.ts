/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Taxes by kind of zone and the two fees (src/budget.js; owner, 13 Oct 2026): each brings money and costs something.

import { Budget } from "../src/budget.js";
import { commandProblem } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { hasKey } from "../src/i18n/index";
import { Simulation } from "../src/simulation.js";
import { Valves } from "../src/valves.js";

const census = (over: Record<string, unknown> = {}) => ({
  resPop: 800, comPop: 40, indPop: 40, landValueAverage: 120, totalPop: 0,
  resHist10: [0, 100], comHist10: [0, 40], indHist10: [0, 40],
  policeStationPop: 0, fireStationPop: 0, roadTotal: 0, railTotal: 0, wateredZoneCount: 30, plantFuel: 0,
  ...over,
});

const valvesAfter = (budget: any) => {
  const valves: any = new (Valves as any)();
  valves.setValves(0, census(), budget);
  return valves;
};

describe("taxes by kind of zone", () => {
  test("each kind of zone feels only its own tax", () => {
    const low: any = new (Budget as any)();
    const high: any = new (Budget as any)();
    high.setTaxes({ commercial: 20 });
    const [a, b] = [valvesAfter(low), valvesAfter(high)];
    expect(b.comValve).toBeLessThan(a.comValve);
    expect(b.resValve).toBe(a.resValve);
    expect(b.indValve).toBe(a.indValve);
  });

  test("each kind pays its own rate, and the same rates pay as the one tax did", () => {
    const budget: any = new (Budget as any)();
    budget.collectTax(0, census({ wateredZoneCount: 0 }));
    const same = budget.taxFund;
    // The one tax's sum: the population index times the land value, times the rate, times the easy level's 1.4
    expect(same).toBe(Math.floor(Math.floor((800 / 8 + 40 + 40) * 120 / 120) * 7 * 1.4));
    budget.setTaxes({ industrial: 0 });
    budget.collectTax(0, census({ wateredZoneCount: 0 }));
    expect(budget.taxFund).toBeLessThan(same);
    expect(budget.averageTax()).toBeCloseTo(14 / 3);
  });

  test("the water fee pays for each zone with water, makes homes less wanted, and makes the water go further", () => {
    const budget: any = new (Budget as any)();
    budget.setTaxes({ water: 10 });
    budget.collectTax(0, census());
    expect(budget.waterIncome).toBe(300);
    expect(valvesAfter(budget).resValve).toBeLessThan(valvesAfter(new (Budget as any)()).resValve);

    const map = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
    const sim: any = new (Simulation as any)(map, 0, 3, null);
    sim.budget.setTaxes({ water: 10 });
    for (let step = 0; step < 16; step++) sim._simulate(sim._constructSimData());
    expect(sim._waterManager.saving).toBeCloseTo(0.3);
  });

  test("the visitors' fee keeps some away but takes a share of what the rest spend", () => {
    const map = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
    const sim: any = new (Simulation as any)(map, 0, 3, null, null, { tourism: 5 });
    sim._census.comPop = 50;
    sim._census.resPop = 2000;
    const free = sim._visitors(11);
    sim.budget.setTaxes({ tourist: 10 });
    const fee = sim._visitors(11);
    expect(free.visitors).toBeGreaterThan(0);
    expect(fee.visitors).toBeLessThan(free.visitors);
    expect(fee.income).toBeGreaterThan(free.income);
    expect(fee.shopsWanted).toBeLessThan(free.shopsWanted);
  });

  test("a city saved before them pays the same rate everywhere and no fees", () => {
    const budget: any = new (Budget as any)();
    budget.load({ cityTax: 11 });
    expect([budget.cityTax, budget.comTax, budget.indTax, budget.waterFee, budget.touristFee]).toEqual([11, 11, 11, 0, 0]);
  });

  test("are part of the budget command, checked like the rest", () => {
    const base = { type: "budget", tax: 7, road: 100, fire: 100, police: 100, yearEnd: false };
    expect(commandProblem({ ...base, comTax: 12, indTax: 3, waterFee: 5, touristFee: 10 }, 10, 10)).toBeNull();
    expect(commandProblem(base, 10, 10)).toBeNull();
    expect(commandProblem({ ...base, comTax: 21 }, 10, 10)).toBe("comTax out of range");
    expect(commandProblem({ ...base, waterFee: 11 }, 10, 10)).toBe("waterFee out of range");
    expect(commandProblem({ ...base, touristFee: -1 }, 10, 10)).toBe("touristFee out of range");
  });

  test("have their words in both languages", () => {
    for (const key of ["budget.tax", "budget.tax_commercial", "budget.tax_industrial", "budget.water_fee",
      "budget.water_fee_label", "budget.tourist_fee", "budget.tourist_fee_label", "budget.water_income"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
  });
});
