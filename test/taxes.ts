/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Taxes by kind of zone and the two fees (src/budget.js; owner, 13 Oct 2026): each brings money and costs something.

import { BlockMapUtils } from "../src/blockMapUtils.js";
import { Budget, TAX_YIELD } from "../src/budget.js";
import { houseLandValue } from "../src/rulerHouse";
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
    // (the state's grant for the people comes in with the taxes, a line of its own, src/gameModes.ts)
    expect(budget.grantIncome).toBeGreaterThan(0);
    const same = budget.taxFund - budget.grantIncome;
    // The one tax's sum: the population index times the land value, times the rate, times the easy level's 1.4, and
    // the game's yield (src/budget.js TAX_YIELD)
    expect(same).toBe(Math.floor(Math.floor((800 / 8 + 40 + 40) * 120 / 120) * 7 * 1.4 * TAX_YIELD));
    expect(budget.taxIncome).toBe(same);
    budget.setTaxes({ industrial: 0 });
    budget.collectTax(0, census({ wateredZoneCount: 0 }));
    expect(budget.taxFund - budget.grantIncome).toBeLessThan(same);
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

describe("land value for the taxes", () => {
  // Owner, 15 Oct 2026: "หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี": a district's thousands of state roads far from the town made
  // its average land value, and so its taxes, a tenth of its own blocks'
  test("the state's roads alone are not the city's land, the city's own roads are", () => {
    const average = (national: boolean) => {
      const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(40, 40);
      for (let x = 0; x < 40; x++) map.setTile(x, 20, 66, 0);
      map.nationalTransport = national ? new Uint8Array(40 * 40).fill(1) : null;
      const sim: any = new (Simulation as any)(map, 0, 3, null);
      BlockMapUtils.pollutionTerrainLandValueScan(map, sim._census, sim.blockMaps, 1);
      return sim._census.landValueAverage;
    };
    expect(average(true)).toBe(0);
    expect(average(false)).toBeGreaterThan(0);
  });

  // Owner, 16 Oct 2026: "แก้ราคาที่ดินต่ำ ให้บ้านกับร้านค้าโตได้สูงขึ้น"
  /** The land value of a road tile 30 tiles east of the centre, on a map of tileSizeM metres a tile (null: original) */
  const valueAt = (tileSizeM: number | null, cover: number) => {
    const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(80, 40);
    map.tileSizeM = tileSizeM;
    for (let x = 0; x < 80; x++) map.setTile(x, 20, 66, 0);
    // What covers the open land round it (scripts/geo/lib/landCover.mjs COVER: 1 paddy, 6 village, 7 town)
    map.landCover = new Uint8Array(80 * 40).fill(cover);
    const sim: any = new (Simulation as any)(map, 0, 3, null);
    // The simulation starts its centre in the middle of the map; this one stands at the west end
    map.cityCentreX = 10; map.cityCentreY = 20;
    BlockMapUtils.pollutionTerrainLandValueScan(map, sim._census, sim.blockMaps, 1);
    return sim.blockMaps.landValueMap.worldGet(40, 20);
  };

  test("on a city map the land is worth less only some 3 km from the centre, not 1 km", () => {
    expect(BlockMapUtils.nearnessStep({ tileSizeM: 16 })).toBe(3);
    expect(BlockMapUtils.nearnessStep({ tileSizeM: 600 })).toBe(1);
    expect(BlockMapUtils.nearnessStep({})).toBe(1);
    expect(valueAt(16, 7)).toBeGreaterThan(valueAt(null, 7) + 30);
  });

  test("paddy, fields, orchards, grass and wetland round the land are open land, as woods are; a town is not", () => {
    expect(valueAt(16, 1)).toBeGreaterThan(valueAt(16, 7) + 30);
    expect(valueAt(16, 6)).toBe(valueAt(16, 7)); // a village is built land too
  });

  test("the ruler's house raises the land three times as far on a city map", () => {
    const house = { x: 0, y: 0, level: 2, wings: [] };
    expect(houseLandValue(house, 10, 0)).toBe(0);
    expect(houseLandValue(house, 10, 0, 3)).toBeGreaterThan(0);
    expect(houseLandValue(house, 0, 0, 3)).toBe(houseLandValue(house, 0, 0));
  });
});
