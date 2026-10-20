/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Thai festivals as the ruler's choice (src/festivals.ts, docs/GAME_DESIGN.md section 5): which a region and a province
// keep and when, the festival command and its checks, what holding one modestly, grandly or not at all does to the
// city, that it is saved with the city, and that the same seed and commands make the same city.

import * as fs from "fs";
import * as path from "path";
import { Budget } from "../src/budget.js";
import { CityCommands, commandProblem, type Command } from "../src/cityCommands";
import { yearAccounts } from "../src/core/autoPlayer";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import {
  calendarOf, CHEER_KEEP, chooseFestival, COST_PEOPLE, type Festival, FESTIVAL_IDS, FESTIVAL_NO_CHOICE, FESTIVAL_NOT_HERE,
  FESTIVAL_SPECS, festivalCalendar, festivalCheer, festivalCost, festivalLandValue, festivalMonth, type FestivalNews,
  festivalProblem, festivalsIn, festivalsRun, festivalsShown, festivalTraffic, festivalVisits, festivalWaste, GLOW_RADIUS,
  GRAND_DRAW, MAX_CHEER, NATIONAL_FESTIVALS, newFestivalState, readFestivals, scaleOf, writeFestivals,
} from "../src/festivals";
import { GameMap } from "../src/gameMap.js";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { hasKey, setLanguage } from "../src/i18n/index";
import { festivalCosts, festivalNewsText, festivalThisYear } from "../src/festivalCard";
import { MapGenerator } from "../src/mapGenerator.js";
import { checkRulesData, DEFAULT_RULES, resolveRules, ruleEffects, type Rules } from "../src/provinceRules";
import { Random } from "../src/random";
import { scoreEra } from "../src/eraScore";
import { Simulation } from "../src/simulation.js";
import { tourismMonth } from "../src/tourism";
import { Waste } from "../src/waste";
import { weatherTraffic } from "../src/weather";
import { HOUSE_KIND } from "../src/rulerHouse";
import { CIVIC } from "../src/tileValues";

const root = path.join(__dirname, "..");
const rulesData = checkRulesData(JSON.parse(fs.readFileSync(path.join(root, "data", "province-rules.json"), "utf8")));
const rulesOf = (region: string | null, province: string | null): Rules => resolveRules(rulesData.data, region, province);
const ids = (calendar: readonly Festival[]): string[] => calendar.map((f) => f.id);
const PROVINCE = { tourism: 3 };

/** A small map with a simulation of a province (it has resources), as the simulation tests make one */
function city(rules: Rules | null = rulesOf("northeast", "TH-40"), resources: Record<string, number> = PROVINCE) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.rulerHouse = null;
  map.policies = [];
  map.town = { x: 30, y: 20 };
  map.festivals = newFestivalState();
  const sim: any = new (Simulation as any)(map, 0, 3, null, rules, resources);
  sim.budget.setFunds(50000);
  // No people yet, so each festival costs its own price
  sim._census.totalPop = 0;
  return { map, sim };
}

/** The simulation at the turn of a month (0–11) of its first year */
function atMonth(sim: any, month: number): void {
  sim._cityTime = month * 4;
}

describe("the festivals' calendar", () => {
  test("the rules file reads without a problem", () => {
    expect(rulesData.problems).toEqual([]);
  });

  test("every province keeps New Year, Songkran and Loy Krathong; the regions and Khon Kaen add their own", () => {
    expect(NATIONAL_FESTIVALS).toEqual(["new_year", "songkran", "loy_krathong"]);
    expect(ids(festivalCalendar(DEFAULT_RULES.festivals))).toEqual(["new_year", "songkran", "loy_krathong"]);
    expect(ids(festivalCalendar(rulesOf("central", "TH-10").festivals))).toEqual(["new_year", "songkran", "loy_krathong"]);
    // The North's sky lanterns rise with Loy Krathong, in November
    const north = festivalCalendar(rulesOf("north", "TH-50").festivals);
    expect(ids(festivalsIn(north, 10))).toEqual(["loy_krathong", "yi_peng"]);
    // The Northeast's rockets in May, at the start of the rains; Khon Kaen's silk in December, the province only
    const khonKaen = festivalCalendar(rulesOf("northeast", "TH-40").festivals);
    expect(ids(khonKaen)).toEqual(["new_year", "songkran", "bun_bang_fai", "loy_krathong", "silk"]);
    expect(ids(festivalsIn(khonKaen, 4))).toEqual(["bun_bang_fai"]);
    expect(ids(festivalsIn(khonKaen, 11))).toEqual(["silk"]);
    expect(ids(festivalCalendar(rulesOf("northeast", "TH-30").festivals))).not.toContain("silk");
    // The South's vegetarian festival in October
    expect(ids(festivalsIn(festivalCalendar(rulesOf("south", "TH-83").festivals), 9))).toEqual(["vegetarian"]);
    // A practice map, which has no province's resources, keeps none
    expect(calendarOf({ rules: rulesOf("north", "TH-50"), resources: {} })).toEqual([]);
    expect(ids(calendarOf({ rules: null, resources: PROVINCE }))).toEqual(["new_year", "songkran", "loy_krathong"]);
  });

  test("a layer may move, change or take away a festival, and a bad entry is reported and left out", () => {
    const { data, problems } = checkRulesData({ version: 1, regions: { north: { festivals: {
      yi_peng: { month: 12, draw: 2, cost: [100, 900] }, songkran: null, rockets: {}, loy_krathong: { month: 13, fire: [2, 0] },
    } } }, provinces: { "TH-50": { festivals: { songkran: { month: 4 }, yi_peng: { cheer: [1, 2] } } } } });
    expect(problems).toEqual([
      "regions.north.festivals.rockets: unknown festival (one of new_year, songkran, loy_krathong, yi_peng, bun_bang_fai, silk, vegetarian)",
      "regions.north.festivals.loy_krathong.month: must be a month 1–12",
      "regions.north.festivals.loy_krathong.fire: must be 2 numbers, each 0–1",
      "provinces.TH-50.festivals.yi_peng.cheer: must be 3 numbers, each -30–30",
    ]);
    const region = festivalCalendar(resolveRules(data, "north", null).festivals);
    expect(ids(region)).toEqual(["new_year", "loy_krathong", "yi_peng"]);
    expect(region.find((f) => f.id === "yi_peng")).toMatchObject({ month: 12, draw: 2, cost: [100, 900] });
    expect(region.find((f) => f.id === "loy_krathong")?.month).toBe(11);
    // The province brings back what its region took away, and keeps the region's changes to the rest
    const province = festivalCalendar(resolveRules(data, "north", "TH-50").festivals);
    expect(ids(province)).toEqual(["new_year", "songkran", "loy_krathong", "yi_peng"]);
    expect(province.find((f) => f.id === "yi_peng")?.draw).toBe(2);
  });

  test("the province card names the region's and the province's own festivals", () => {
    const keys = ruleEffects(rulesOf("northeast", "TH-40"), (key) => key).map((e) => e.key);
    expect(keys).toContain("rules.festival.bun_bang_fai");
    expect(keys).toContain("rules.festival.silk");
    expect(keys).not.toContain("rules.festival.songkran");
  });

  test("every festival has its words in both languages, and a choice where the ruler holds it", () => {
    for (const id of FESTIVAL_IDS) {
      expect([id, hasKey(`festival.${id}`)]).toEqual([id, true]);
      if (FESTIVAL_SPECS[id].choice) expect([id, hasKey(`festival.ask.${id}`)]).toEqual([id, true]);
    }
    for (const id of FESTIVAL_IDS.filter((f) => !(NATIONAL_FESTIVALS as readonly string[]).includes(f))) {
      expect([id, hasKey(`rules.festival.${id}`)]).toEqual([id, true]);
    }
    expect(FESTIVAL_SPECS.new_year.choice).toBe(false);
  });
});

describe("the festival command", () => {
  test("is checked like every other command", () => {
    expect(commandProblem({ type: "festival", id: "songkran", scale: "grand" }, 10, 10)).toBeNull();
    expect(commandProblem({ type: "festival", id: "songkran", scale: "none" }, 10, 10)).toBeNull();
    expect(commandProblem({ type: "festival", id: "halloween", scale: "grand" }, 10, 10)).toBe("unknown festival halloween");
    expect(commandProblem({ type: "festival", id: "songkran", scale: "huge" }, 10, 10)).toBe("unknown scale huge");
    expect(commandProblem({ type: "festival", id: "songkran" }, 10, 10)).toBe("unknown scale undefined");
  });

  test("keeps the ruler's answer for the province's own festivals only", () => {
    const calendar = festivalCalendar(rulesOf("northeast", "TH-40").festivals);
    expect(festivalProblem(calendar, "silk", "grand")).toBeNull();
    expect(festivalProblem(calendar, "yi_peng", "grand")).toBe(FESTIVAL_NOT_HERE);
    expect(festivalProblem(calendar, "new_year", "grand")).toBe(FESTIVAL_NO_CHOICE);
    const state = newFestivalState();
    const commands = new CityCommands({ width: 4, height: 4, festivals: { state, calendar: () => calendar } } as any);
    expect(commands.apply({ type: "festival", id: "silk", scale: "grand" })).toEqual({ accepted: true });
    expect(commands.apply({ type: "festival", id: "songkran", scale: "none" })).toEqual({ accepted: true });
    expect(commands.apply({ type: "festival", id: "yi_peng", scale: "grand" })).toEqual({ accepted: false, reason: FESTIVAL_NOT_HERE });
    expect(commands.apply({ type: "festival", id: "new_year", scale: "none" })).toEqual({ accepted: false, reason: FESTIVAL_NO_CHOICE });
    expect(state.choices).toEqual({ silk: "grand", songkran: "none" });
    // A festival never answered for is held modestly
    expect(scaleOf(state, calendar.find((f) => f.id === "bun_bang_fai")!)).toBe("modest");
    // A city with no festivals (a target without them) refuses
    expect(new CityCommands({ width: 4, height: 4 } as any).apply({ type: "festival", id: "silk", scale: "grand" }).accepted).toBe(false);
  });
});

describe("a festival's month", () => {
  test("costs more held grandly and in a bigger town, nothing not held", () => {
    const songkran = FESTIVAL_SPECS.songkran;
    expect(festivalCost(songkran, "none", 5000)).toBe(0);
    expect(festivalCost(songkran, "modest", 0)).toBe(200);
    expect(festivalCost(songkran, "grand", 0)).toBe(1200);
    expect(festivalCost(songkran, "grand", COST_PEOPLE)).toBe(2400);
    expect(festivalCost(songkran, "modest", 10000)).toBeGreaterThan(festivalCost(songkran, "modest", 1000));
  });

  test("is held as the ruler answered: paid for, the people cheered, the land round the venue raised, once a month", () => {
    const { map, sim } = city();
    atMonth(sim, 2); // March: Songkran is next month
    const asked = festivalMonth(map, sim);
    expect(asked).toEqual([{ type: "festivalAhead", id: "songkran", scale: "modest", costs: [200, 1200] }]);
    chooseFestival(map.festivals, "songkran", "grand");
    atMonth(sim, 3);
    const funds = sim.budget.totalFunds;
    const held = festivalMonth(map, sim);
    // ... and May's rockets are asked about
    expect(held).toEqual([{ type: "festival", id: "songkran", scale: "grand", cost: 1200, byPeople: false, downgraded: false },
      { type: "festivalAhead", id: "bun_bang_fai", scale: "modest", costs: [150, 1000] }]);
    expect(sim.budget.totalFunds).toBe(funds - 1200);
    expect(map.festivals.held).toEqual([{ id: "songkran", scale: "grand", cost: 1200 }]);
    expect(map.festivals.cheer).toBe(FESTIVAL_SPECS.songkran.cheer[2]);
    expect(map.festivals.glow).toBe(FESTIVAL_SPECS.songkran.land[1]);
    expect(map.festivals.venue).toEqual(map.town);
    expect(festivalsShown(map).map((h) => h.id)).toEqual(["songkran"]);
    // The same month again holds nothing more
    expect(festivalMonth(map, sim)).toEqual([]);
    expect(sim.budget.totalFunds).toBe(funds - 1200);
    // Next month the festival is over, and its cheer and land value fade
    atMonth(sim, 4);
    const may = festivalMonth(map, sim);
    expect(may.map((n) => n.type === "festival" ? n.id : n.type)).toEqual(["bun_bang_fai"]);
    expect(map.festivals.cheer).toBeCloseTo(FESTIVAL_SPECS.songkran.cheer[2] * CHEER_KEEP + FESTIVAL_SPECS.bun_bang_fai.cheer[1], 5);
    expect(map.festivals.held.map((h: any) => h.id)).toEqual(["bun_bang_fai"]);
    atMonth(sim, 5);
    festivalMonth(map, sim);
    expect(map.festivals.held).toEqual([]);
    for (let m = 6; m < 10; m++) { atMonth(sim, m); festivalMonth(map, sim); }
    expect(map.festivals.glow).toBeLessThan(2);
  });

  test("not held, costs nothing and lets the people down; a festival the treasury cannot pay is held more simply", () => {
    const { map, sim } = city();
    chooseFestival(map.festivals, "songkran", "none");
    atMonth(sim, 3);
    const funds = sim.budget.totalFunds;
    expect(festivalMonth(map, sim)[0]).toEqual({ type: "festival", id: "songkran", scale: "none", cost: 0, byPeople: false, downgraded: false });
    expect(sim.budget.totalFunds).toBe(funds);
    expect(map.festivals.cheer).toBe(FESTIVAL_SPECS.songkran.cheer[0]);
    expect(map.festivals.cheer).toBeLessThan(0);
    expect(map.festivals.glow).toBe(0);
    expect(festivalsShown(map)).toEqual([]);
    // A grand Bun Bang Fai with ฿500 in the treasury is held modestly; then with nothing, by the people themselves
    chooseFestival(map.festivals, "bun_bang_fai", "grand");
    sim.budget.setFunds(500);
    atMonth(sim, 4);
    expect(festivalMonth(map, sim)[0]).toEqual({ type: "festival", id: "bun_bang_fai", scale: "modest", cost: 150, byPeople: false, downgraded: true });
    expect(sim.budget.totalFunds).toBe(350);
    sim.budget.setFunds(0);
    const cheer = map.festivals.cheer;
    sim._cityTime = 4 * 16; // May of the next year
    expect(festivalMonth(map, sim)[0]).toEqual({ type: "festival", id: "bun_bang_fai", scale: "modest", cost: 0, byPeople: true, downgraded: true });
    expect(sim.budget.totalFunds).toBe(0);
    // ... which the people cheer as their own, not the ruler's
    expect(map.festivals.cheer).toBeCloseTo(cheer * CHEER_KEEP, 5);
  });

  test("what the year's festivals cost is counted for the budget window, apart from the taxes, and saved", () => {
    const { map, sim } = city();
    chooseFestival(map.festivals, "songkran", "grand");
    atMonth(sim, 3); festivalMonth(map, sim);
    atMonth(sim, 4); festivalMonth(map, sim);
    expect(sim.budget.festivalFund).toBe(1200 + 150);
    // ... nothing for one the people held themselves
    sim.budget.setFunds(0); atMonth(sim, 10); festivalMonth(map, sim);
    expect(map.festivals.held[0]).toMatchObject({ id: "loy_krathong", byPeople: true });
    expect(sim.budget.festivalFund).toBe(1350);
    const saved: Record<string, unknown> = {};
    sim.budget.save(saved);
    const reopened = new (Budget as any)(), plain = new (Budget as any)();
    reopened.load(JSON.parse(JSON.stringify(saved)));
    plain.load({ ...JSON.parse(JSON.stringify(saved)), festivalFund: 0 });
    expect(reopened.festivalFund).toBe(1350);
    // The year's taxes count them as the year's line and take nothing more for them: they were paid in their months
    const census = { ...sim._census, totalPop: 0 };
    reopened.collectTax(0, census); plain.collectTax(0, census);
    expect([reopened.festivalCost, reopened.festivalFund]).toEqual([1350, 0]);
    expect(reopened.taxFund).toBe(plain.taxFund);
    expect(reopened.totalFunds).toBe(plain.totalFunds);
    expect(yearAccounts(reopened).costs.festivals).toBe(1350);
    // A city saved before the line has none
    const old = new (Budget as any)();
    old.load({ ...saved, festivalFund: undefined, festivalCost: undefined });
    expect([old.festivalFund, old.festivalCost]).toEqual([0, 0]);
  });

  test("the cheer never goes past its bound", () => {
    const { map, sim } = city(rulesOf("north", "TH-50"));
    chooseFestival(map.festivals, "loy_krathong", "grand");
    chooseFestival(map.festivals, "yi_peng", "grand");
    map.festivals.cheer = MAX_CHEER - 1;
    atMonth(sim, 10);
    festivalMonth(map, sim);
    expect(map.festivals.cheer).toBe(MAX_CHEER);
  });

  test("lanterns and rockets may set a fire near the venue, only while disasters are on, with the city's Random", () => {
    const fires = (on: boolean, seed: number) => {
      Random.seed(seed);
      const { map, sim } = city(rulesOf("north", "TH-50"));
      const calls: number[][] = [];
      sim.disasterManager.disastersEnabled = on;
      sim.disasterManager.setFireNear = (x: number, y: number, r: number) => { calls.push([x, y, r]); return { x: x + 1, y }; };
      chooseFestival(map.festivals, "yi_peng", "grand");
      const news: FestivalNews[] = [];
      for (let year = 0; year < 20; year++) {
        sim._cityTime = (year * 12 + 10) * 4;
        news.push(...festivalMonth(map, sim));
      }
      return { calls, news: news.filter((n) => n.type === "festivalFire") };
    };
    expect(fires(false, 3).calls).toEqual([]);
    const lit = fires(true, 3);
    // Over twenty grand Yi Pengs (30% each) and Loy Krathongs (2%), some fires, near the town
    expect(lit.calls.length).toBeGreaterThan(1);
    expect(lit.calls.length).toBeLessThan(20);
    expect(lit.calls[0]).toEqual([30, 20, 4]);
    expect(lit.news.length).toBe(lit.calls.length);
    // The same seed, the same fires
    expect(fires(true, 3).calls.length).toBe(lit.calls.length);
  });

  test("a practice map keeps no festivals", () => {
    const { map, sim } = city(null, {});
    atMonth(sim, 3);
    expect(festivalMonth(map, sim)).toEqual([]);
    expect(map.festivals.held).toEqual([]);
  });
});

describe("what a festival does to the city", () => {
  const census = { totalPop: 400, comPop: 300, stadiumPop: 0, airportPop: 0, seaportPop: 0, landValueAverage: 80,
    pollutionAverage: 10, crimeAverage: 10 };

  test("held grandly it draws more visitors and uses more of Songkran's water; not held, only some come home", () => {
    const calendar = festivalCalendar(rulesOf("northeast", "TH-40").festivals);
    const visit = (scale: "none" | "modest" | "grand") => {
      const map: any = { festivals: { ...newFestivalState(), at: 3, held: [{ id: "songkran", scale, cost: 0 }] } };
      return tourismMonth(3, census, 3, true, festivalVisits(map, calendar));
    };
    const [none, modest, grand] = [visit("none"), visit("modest"), visit("grand")];
    expect(grand.wanted).toBeGreaterThan(modest.wanted);
    expect(modest.wanted).toBeGreaterThan(none.wanted);
    expect(none.wanted).toBeGreaterThan(tourismMonth(3, census, 2, true, []).wanted * 0.5);
    expect([none.festival, modest.festival, grand.festival]).toEqual([null, "songkran", "songkran"]);
    expect([none.waterUse, modest.waterUse]).toEqual([0, 0.15]);
    expect(grand.waterUse).toBeCloseTo(0.225, 5);
    // The same as the country's own Songkran held modestly before the festivals were the ruler's
    expect(modest.wanted).toBe(tourismMonth(3, census, 3).wanted);
    expect(GRAND_DRAW).toBeGreaterThan(1);
    // Two festivals in one month add their draws
    const north = festivalCalendar(rulesOf("north", "TH-50").festivals);
    const both: any = { festivals: { ...newFestivalState(), at: 10, held: [{ id: "loy_krathong", scale: "modest", cost: 0 },
      { id: "yi_peng", scale: "modest", cost: 0 }] } };
    const one: any = { festivals: { ...newFestivalState(), at: 10, held: [{ id: "loy_krathong", scale: "modest", cost: 0 }] } };
    expect(tourismMonth(3, census, 10, true, festivalVisits(both, north)).festivals).toEqual(["loy_krathong", "yi_peng"]);
    expect(tourismMonth(3, census, 10, true, festivalVisits(both, north)).wanted)
      .toBeGreaterThan(tourismMonth(3, census, 10, true, festivalVisits(one, north)).wanted);
  });

  test("before the core has held a month of them, the country's own are held modestly", () => {
    const map: any = { festivals: newFestivalState() };
    expect(festivalsRun(map)).toBe(false);
    expect(festivalVisits(map, [])).toBeUndefined();
    expect(festivalTraffic(map)).toBe(1);
  });

  test("brings traffic, rubbish and krathong in the water, and raises the land round the venue", () => {
    const calendar = festivalCalendar(rulesOf("north", "TH-50").festivals);
    const map: any = { festivals: { ...newFestivalState(), at: 10, glow: 10, venue: { x: 20, y: 20 },
      held: [{ id: "loy_krathong", scale: "grand", cost: 0 }, { id: "yi_peng", scale: "modest", cost: 0 }] } };
    expect(festivalTraffic(map)).toBeCloseTo(1.15, 5);
    const waste = festivalWaste(map, calendar, 10000);
    expect(waste.rubbish).toBeCloseTo((15 + 3) * 10, 5);
    expect(waste.dirt).toBeCloseTo(0.25, 5);
    expect(festivalLandValue(map, 20, 20)).toBe(10);
    expect(festivalLandValue(map, 23, 20)).toBe(5);
    expect(festivalLandValue(map, 20 + GLOW_RADIUS, 20)).toBe(0);
    // ... further on a real-scale city map, whose steps are longer
    expect(festivalLandValue(map, 20 + GLOW_RADIUS, 20, 3)).toBeGreaterThan(0);
    // The krathong dirty the water for the month, and the rubbish goes to the dump like any other
    const plain = new Waste(4, 4), festive = new Waste(4, 4), ground = new Uint8Array(16);
    const a = plain.month(1000, 0, ground), b = festive.month(1000, 0, ground, waste);
    expect(b.rubbish).toBeCloseTo(a.rubbish + waste.rubbish, 5);
    expect(b.sewage).toBeCloseTo(a.sewage + 0.25, 5);
  });

  test("its cheer counts in the era score's living, with the people's approval", () => {
    const { map, sim } = city();
    const objects = { all: () => [] };
    sim.evaluation.cityYes = 50;
    const before = scoreEra(map, sim, objects).factors.living.value;
    map.festivals.cheer = 10;
    expect(festivalCheer(map)).toBe(10);
    expect(scoreEra(map, sim, objects).factors.living.value).toBeCloseTo(before + 0.05, 5);
    map.festivals.cheer = -10;
    expect(scoreEra(map, sim, objects).factors.living.value).toBeCloseTo(before - 0.05, 5);
  });

  test("the simulation's month reads what is held: visitors, Songkran's water (still none with the water-wise policy) and traffic", () => {
    const { map, sim } = city();
    sim._census.comPop = 400;
    sim._census.totalPop = 2000;
    sim._census.landValueAverage = 100;
    const songkran = (scale: "none" | "modest" | "grand") => {
      map.festivals = { ...newFestivalState(), at: 3, held: [{ id: "songkran", scale, cost: 0 }] };
      const visit = sim._visitors(3);
      sim._setTourism(visit);
      return { wanted: visit.wanted, water: sim._waterManager.festivalUse };
    };
    const [none, modest, grand] = [songkran("none"), songkran("modest"), songkran("grand")];
    expect(grand.wanted).toBeGreaterThan(modest.wanted);
    expect(modest.wanted).toBeGreaterThan(none.wanted);
    expect([none.water, modest.water]).toEqual([0, 0.15]);
    expect(grand.water).toBeCloseTo(0.225, 5);
    // The water-wise Songkran policy still keeps all of the supply, however grand the festival (src/policies.ts)
    map.policies = ["songkran_saving"];
    expect(songkran("grand").water).toBeCloseTo(0.225, 5); // ... but only while the ruler's house stands
    map.setTile(10, 10, CIVIC, 0);
    map.civicKinds[10 * map.width + 10] = HOUSE_KIND;
    map.rulerHouse = { x: 10, y: 10, level: 1, wings: [] };
    expect(songkran("grand").water).toBe(0);
    expect(songkran("modest").water).toBe(0);
    songkran("grand");
    sim._weatherMonth();
    expect(sim._traffic.weatherLoad).toBeCloseTo(weatherTraffic(map.weather) * 1.15, 5);
  });
});

describe("the festival card", () => {
  test("names what each festival costs besides money", () => {
    expect(festivalCosts("songkran")).toEqual(["festival.cost.base", "festival.cost.water"]);
    expect(festivalCosts("loy_krathong")).toEqual(["festival.cost.base", "festival.cost.fire", "festival.cost.dirt"]);
    expect(festivalCosts("yi_peng")).toEqual(["festival.cost.base", "festival.cost.fire"]);
    expect(festivalCosts("bun_bang_fai")).toEqual(["festival.cost.base", "festival.cost.fire"]);
    expect(festivalCosts("silk")).toEqual(["festival.cost.base"]);
    for (const id of FESTIVAL_IDS) for (const key of festivalCosts(id)) expect([key, hasKey(key)]).toEqual([key, true]);
    for (const key of ["festival.card.title", "festival.card.close", "festival.free", "festival.short", "festival.note",
      "festival.news.fire", ...["grand", "modest", "none"].flatMap((s) => [`festival.scale.${s}`, `festival.gain.${s}`])]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
  });

  test("tells how the festival was held", () => {
    setLanguage("en");
    const news = (scale: "none" | "modest" | "grand", more: { byPeople?: boolean; downgraded?: boolean } = {}) =>
      festivalNewsText({ type: "festival", id: "songkran", scale, cost: 1200, byPeople: false, downgraded: false, ...more });
    expect(news("grand")).toBe("Songkran is held grandly (฿1200): visitors fill the town");
    expect(news("none")).toBe("The city holds no Songkran this year: the people are let down");
    expect(news("modest", { downgraded: true })).toContain("not enough money");
    expect(news("modest", { byPeople: true })).toContain("the temples and the people");
    // Once it has come, the card says how it was held, and that an answer now is for next year
    const held = (scale: "none" | "modest" | "grand", byPeople = false) =>
      festivalThisYear({ type: "festival", id: "silk", scale, cost: 250, byPeople, downgraded: false });
    expect(held("modest")).toBe("This year it is held modestly (฿250). An answer now counts from next year.");
    expect(held("modest", true)).toContain("the temples and the people");
    expect(held("none")).toContain("holds nothing");
    setLanguage("th");
    expect(news("grand")).toBe("สงกรานต์ จัดยิ่งใหญ่ (฿1200) นักท่องเที่ยวมาเต็มเมือง");
    expect(held("grand")).toBe("ปีนี้จัดยิ่งใหญ่ (฿250) คำตอบตอนนี้ใช้ตั้งแต่ปีหน้า");
    expect(hasKey("festival.card.now")).toBe(true);
  });
});

describe("the festivals are kept with the city", () => {
  test("a save keeps the answers, this month's festivals and their afterglow, and reads nothing it should not", () => {
    const state = { ...newFestivalState(), choices: { songkran: "grand" as const, silk: "none" as const }, cheer: 4.5, glow: 7,
      venue: { x: 3, y: 4 }, at: 17, held: [{ id: "songkran" as const, scale: "grand" as const, cost: 1200 }] };
    const saved = JSON.parse(JSON.stringify(writeFestivals(state)));
    expect(readFestivals(saved)).toEqual(state);
    expect(writeFestivals(newFestivalState())).toBeUndefined();
    expect(readFestivals(null)).toEqual(newFestivalState());
    expect(readFestivals({ choices: { songkran: "huge", party: "grand", silk: "modest" }, held: [{ id: "x" }, 4], cheer: 99,
      glow: -3, venue: { x: "a" }, at: 2.5 })).toEqual({ ...newFestivalState(), choices: { silk: "modest" }, cheer: MAX_CHEER });
  });
});

/** Khon Kaen's whole-province map as a new city gets it (src/splashScreen.js) */
function khonKaen() {
  const preset = JSON.parse(fs.readFileSync(path.join(root, "data", "maps", "TH-40.json"), "utf8"));
  const layer = (encoded?: string) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : undefined);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  map.insideProvince = layer(preset.inside) ?? null;
  map.nationalTransport = transport ?? null;
  map.town = preset.town ?? null;
  return map;
}

describe("a province city's festivals in the core", () => {
  jest.setTimeout(240000);

  /** A year of Khon Kaen with its rules, the commands at their steps; what the festivals told, and the city after */
  const play = (orders: { step: number; command: Command }[], seed = 9) => {
    const map = khonKaen();
    const core = new CityCore({ map, seed, rules: rulesOf("northeast", "TH-40"), resources: PROVINCE });
    map.landBlocks = null;
    core.simulation.budget.setFunds(20000);
    const news: FestivalNews[] = [];
    for (const type of ["festival", "festivalAhead", "festivalFire"] as const) core.on(type, (e) => news.push(e as FestivalNews));
    let next = 0;
    for (let step = 0; step < STEPS_PER_YEAR; step++) {
      while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
      core.step();
    }
    let tiles = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) tiles = (tiles * 31 + map.getTileValue(x, y)) >>> 0;
    return { core, map, news, tiles, funds: core.simulation.budget.totalFunds };
  };

  test("hold each festival of the year in its month, ask a month before, and replay the same", () => {
    const orders = [{ step: 10, command: { type: "festival", id: "songkran", scale: "grand" } as Command },
      { step: 300, command: { type: "festival", id: "silk", scale: "none" } as Command }];
    const first = play(orders);
    expect(first.core.systemNames).toEqual(["objects", "era", "festivals"]);
    const held = first.news.filter((n) => n.type === "festival").map((n) => n.type === "festival" ? `${n.id}:${n.scale}` : "");
    // ... the next New Year coming in the year's last steps
    expect(held).toEqual(["new_year:modest", "songkran:grand", "bun_bang_fai:modest", "loy_krathong:modest", "silk:none",
      "new_year:modest"]);
    const asked = first.news.filter((n) => n.type === "festivalAhead").map((n) => n.type === "festivalAhead" ? n.id : "");
    expect(asked).toEqual(["songkran", "bun_bang_fai", "loy_krathong", "silk"]);
    expect(first.map.festivals.choices).toEqual({ songkran: "grand", silk: "none" });
    // What they cost, paid in their months, is the budget's festivals line once the year's taxes come in
    const paid = first.news.reduce((sum, n) => sum + (n.type === "festival" ? n.cost : 0), 0);
    expect(paid).toBeGreaterThan(1000);
    expect(first.core.simulation.budget.festivalCost).toBe(paid);
    expect(yearAccounts(first.core.simulation.budget as never).costs.festivals).toBe(paid);
    // The same seed and the same commands at the same steps make the same city
    const again = play(first.core.log);
    expect(again.tiles).toBe(first.tiles);
    expect(again.funds).toBe(first.funds);
    expect(again.map.festivals).toEqual(first.map.festivals);
    // ... and a ruler who holds nothing grandly keeps more money
    const plain = play([]);
    expect(plain.funds).toBeGreaterThan(first.funds);
  });

  test("a saved city keeps its festivals, and holds no month twice when opened again", () => {
    const { core, map } = play([{ step: 10, command: { type: "festival", id: "bun_bang_fai", scale: "grand" } }]);
    const saved: any = core.save();
    expect(saved.festivals.choices).toEqual({ bun_bang_fai: "grand" });
    const reopened = new (GameMap as unknown as new (w: number, h: number) => any)(map.width, map.height);
    const again = new CityCore({ map: reopened, saved: JSON.parse(JSON.stringify(saved)), rules: rulesOf("northeast", "TH-40"),
      resources: PROVINCE });
    expect(reopened.festivals).toEqual(map.festivals);
    expect(again.simulation.budget.festivalCost).toBe(core.simulation.budget.festivalCost);
    expect(again.simulation.budget.festivalCost).toBeGreaterThan(0);
    const funds = again.simulation.budget.totalFunds;
    expect(festivalMonth(reopened, again.simulation)).toEqual([]);
    expect(again.simulation.budget.totalFunds).toBe(funds);
  });
});
