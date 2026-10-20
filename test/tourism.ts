/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Tourism (docs/TOURISM.md): who comes and when, what they bring (money, shops wanted) and what they cost (traffic,
// rubbish, dearer living).

import { Budget } from "../src/budget.js";
import { BlockMapUtils } from "../src/blockMapUtils.js";
import { GameMap } from "../src/gameMap.js";
import { hasKey } from "../src/i18n/index";
import * as Messages from "../src/messages";
import { Simulation } from "../src/simulation.js";
import { COMBASE } from "../src/tileValues";
import {
  FESTIVALS, festivalIn, festivalWaterUse, livingCostFactor, NO_TOURISM, shopRubbish, SPEND_PER_VISITOR, TOURISM_SEASON,
  tourismMonth, touristTrips, VISITORS_AT_LEVEL, VISITORS_PER_SHOP,
} from "../src/tourism";
import { Valves } from "../src/valves.js";

const town = {
  totalPop: 300, comPop: 200, stadiumPop: 0, airportPop: 0, seaportPop: 0, landValueAverage: 100, pollutionAverage: 20,
  crimeAverage: 20,
};
const JANUARY = 0;
const MARCH = 2;
const APRIL = 3;
const JULY = 6;
const NOVEMBER = 10;

describe("visitors", () => {
  test("none come to a province without tourism, out of the festivals", () => {
    expect(tourismMonth(0, town, MARCH)).toBe(NO_TOURISM);
  });

  test("come by the province's level and the season: most in the cool dry months, fewest in the rains", () => {
    const levels = [1, 2, 3, 4, 5].map((level) => tourismMonth(level, town, JANUARY).visitors);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(tourismMonth(5, town, NOVEMBER).visitors).toBeGreaterThan(tourismMonth(5, town, JULY).visitors);
    expect(TOURISM_SEASON.length).toBe(12);
    const month = tourismMonth(5, town, JULY);
    expect(month.wanted).toBe(Math.round(VISITORS_AT_LEVEL[5] * month.appeal * TOURISM_SEASON[JULY]));
  });

  test("only as many as the shops can take in, and only a few to a town nobody knows yet", () => {
    const fewShops = tourismMonth(5, { ...town, comPop: 4 }, JANUARY);
    expect(fewShops.visitors).toBe(4 * VISITORS_PER_SHOP);
    expect(fewShops.busy).toBe(1);
    expect(fewShops.shopsWanted).toBeGreaterThan(4);
    expect(tourismMonth(5, { ...town, comPop: 0 }, JANUARY).visitors).toBe(0);
    expect(tourismMonth(5, { ...town, totalPop: 10 }, JANUARY).wanted)
      .toBeLessThan(tourismMonth(5, town, JANUARY).wanted / 4);
  });

  test("like an airport and a stadium, and stay away from pollution and crime", () => {
    const plain = tourismMonth(4, town, JANUARY);
    expect(tourismMonth(4, { ...town, airportPop: 1, stadiumPop: 1 }, JANUARY).visitors).toBeGreaterThan(plain.visitors);
    const dirty = tourismMonth(4, { ...town, pollutionAverage: 100 }, JANUARY);
    expect(dirty.pollutionPenalty).toBe(1);
    expect(dirty.visitors).toBeLessThan(plain.visitors / 2);
    expect(tourismMonth(4, { ...town, crimeAverage: 120 }, JANUARY).crimePenalty).toBe(1);
  });

  test("spend money, and cost traffic, rubbish and dearer living when the shops are full of them", () => {
    const month = tourismMonth(5, { ...town, comPop: 10 }, JANUARY);
    expect(month.income).toBe(Math.round(month.visitors * SPEND_PER_VISITOR));
    expect(touristTrips(month)).toBe(2);
    expect(shopRubbish(month)).toBe(20);
    expect(livingCostFactor(month)).toBeLessThan(1);
    expect(livingCostFactor(NO_TOURISM)).toBe(1);
    expect([touristTrips(NO_TOURISM), shopRubbish(NO_TOURISM)]).toEqual([0, 0]);
  });
});

describe("the country's festivals", () => {
  test("are New Year in January, Songkran in April and Loy Krathong in November (src/festivals.ts)", () => {
    expect(festivalIn(JANUARY)?.id).toBe("new_year");
    expect(festivalIn(APRIL)?.id).toBe("songkran");
    expect(festivalIn(10)?.id).toBe("loy_krathong");
    expect(festivalIn(MARCH)).toBeNull();
    expect(FESTIVALS.map((f) => f.id)).toEqual(["new_year", "songkran", "loy_krathong"]);
  });

  test("bring far more visitors than the month before, and people home even where there is no tourism", () => {
    expect(tourismMonth(3, town, APRIL).wanted).toBeGreaterThan(tourismMonth(3, town, MARCH).wanted * 1.5);
    const home = tourismMonth(0, town, APRIL);
    expect(home.festival).toBe("songkran");
    expect(home.level).toBe(0);
    expect(home.visitors).toBeGreaterThan(0);
    expect(tourismMonth(0, town, MARCH)).toBe(NO_TOURISM);
    // A practice map is no province: no festival comes to it
    expect(tourismMonth(0, town, APRIL, false)).toBe(NO_TOURISM);
  });

  test("put the whole country on the road, and Songkran's water fights use up water", () => {
    const songkran = tourismMonth(1, town, APRIL);
    expect(touristTrips(songkran)).toBeGreaterThanOrEqual(1);
    expect(festivalWaterUse(songkran)).toBe(0.15);
    expect(festivalWaterUse(tourismMonth(1, town, JANUARY))).toBe(0);
    expect(festivalWaterUse(NO_TOURISM)).toBe(0);
  });

  test("tell the news, and take water from the supply in April", () => {
    const sim: any = new (Simulation as any)(new (GameMap as unknown as new (w: number, h: number) => any)(120, 100),
      0, 3, null, null, { tourism: 0 });
    const news: string[] = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => news.push(m.subject));
    Object.assign(sim._census, town);
    sim._cityTime = APRIL * 4;
    sim._tourismMonth();
    expect(news).toEqual([Messages.SONGKRAN]);
    expect(sim.budget.tourismFund).toBeGreaterThan(0);
    expect(sim._waterManager.festivalUse).toBe(0.15);
    sim._cityTime = JANUARY * 4 + 48;
    sim._tourismMonth();
    expect(news).toEqual([Messages.SONGKRAN, Messages.NEW_YEAR_HOLIDAYS]);
    expect(sim._waterManager.festivalUse).toBe(0);
    expect(hasKey("msg.good.songkran") && hasKey("msg.good.new_year") && hasKey("festival.songkran") &&
      hasKey("festival.new_year") && hasKey("status.tourists_festival")).toBe(true);
  });
});

describe("tourism in the city", () => {
  const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(120, 100);

  test("a month's visitors pay into the year's taxes, ask for shops, and tell the status and the news", () => {
    const sim: any = new (Simulation as any)(blank(), 0, 3, null, null, { tourism: 5 });
    const updates: unknown[] = [];
    const news: string[] = [];
    sim.addEventListener(Messages.TOURISM_UPDATED, (month: unknown) => updates.push(month));
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => news.push(m.subject));
    Object.assign(sim._census, town);
    sim._cityTime = 10 * 4; // November
    sim._tourismMonth();
    expect(sim.budget.tourismFund).toBeGreaterThan(0);
    expect(sim._valves.touristShops).toBeGreaterThan(0);
    expect(updates.length).toBe(1);
    expect(news).toContain(Messages.TOURIST_SEASON);

    const spent = sim.budget.tourismFund;
    sim.budget.collectTax(0, sim._census);
    expect(sim.budget.tourismIncome).toBe(spent);
    expect(sim.budget.tourismFund).toBe(0);

    // A dirty city hears that the visitors stay away, once a year at most
    sim._census.pollutionAverage = 90;
    news.length = 0;
    sim._tourismMonth();
    sim._tourismMonth();
    expect(news.filter((s) => s === Messages.TOURISTS_AVOID_POLLUTION).length).toBe(1);
  });

  test("a province without tourism, or a practice map, has none", () => {
    const sim: any = new (Simulation as any)(blank(), 0, 3, null);
    Object.assign(sim._census, town);
    sim._tourismMonth();
    expect(sim.budget.tourismFund).toBe(0);
    expect(sim._tourism.level).toBe(0);
  });

  test("visitors raise the demand for shops and lower it a little for homes", () => {
    const census: any = {
      resPop: 800, comPop: 60, indPop: 20, comHist10: [0, 60], indHist10: [0, 20], resHist10: [0, 100], totalPop: 0,
    };
    const budget = { cityTax: 7 };
    const plain: any = new (Valves as any)();
    plain.setValves(0, { ...census }, budget);
    const visited: any = new (Valves as any)();
    visited.touristShops = 30;
    visited.livingCost = 0.9;
    visited.setValves(0, { ...census }, budget);
    expect(visited.comValve).toBeGreaterThan(plain.comValve);
    expect(visited.resValve).toBeLessThan(plain.resValve);
  });

  test("busy shops gather rubbish", () => {
    const pollutionWith = (rubbish: number) => {
      const map = blank();
      for (let y = 20; y < 26; y++) for (let x = 20; x < 26; x++) map.setTile(x, y, COMBASE + 4, 0);
      const sim: any = new (Simulation as any)(map, 0, 3, null);
      BlockMapUtils.pollutionTerrainLandValueScan(map, sim._census, sim.blockMaps, 1, rubbish);
      return sim.blockMaps.pollutionDensityMap.worldGet(22, 22);
    };
    expect(pollutionWith(20)).toBeGreaterThan(pollutionWith(0));
  });

  test("saves what visitors spent so far this year, and older saves start at none", () => {
    const budget: any = new (Budget as any)();
    budget.tourismFund = 123;
    const saved: Record<string, unknown> = {};
    budget.save(saved);
    const loaded: any = new (Budget as any)();
    loaded.load(saved);
    expect(loaded.tourismFund).toBe(123);
    const old: any = new (Budget as any)();
    const oldSave: Record<string, unknown> = { ...saved };
    delete oldSave.tourismFund;
    delete oldSave.tourismIncome;
    old.load(oldSave);
    expect([old.tourismFund, old.tourismIncome]).toEqual([0, 0]);
  });

  test("has its words in both languages", () => {
    for (const key of ["status.tourists", "status.tourists_value", "status.tourists_title", "status.tourists_high",
      "status.tourists_low", "budget.tourism", "msg.good.tourist_season", "msg.bad.tourists_pollution",
      "msg.bad.tourists_crime"]) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});
