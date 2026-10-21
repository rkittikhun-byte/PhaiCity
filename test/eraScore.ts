/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's era from its score (owner, 20 Oct 2026; docs/GAME_DESIGN.md section 1): people's progress times how well
// they live, counted per person; from 0.8 its buildings begin to change, at 1 the city is in the next era.

import { ERA_RULES, FACTORS, FLOOR_CAP, LITERATE_WANTED, TECHNICIANS_WANTED } from "../src/eraRules";
import { eraMonth, literateCount, scoreEra, techniciansCount } from "../src/eraScore";
import { noTrained } from "../src/trainedPeople";
import { Random } from "../src/random";
import { readCityLayers, writeCityLayers } from "../src/core/cityLayers";

/** A home, shop or other building as the objects layer gives it */
function building(kind: string, id: number, powered = true, level = 2) {
  return { kind, id, x: id % 20, y: Math.floor(id / 20), powered: () => powered, level: () => level };
}

/** A small map whose homes have water (or not) and the records the era symbols read, with the villagers who read and
 * write its primary school taught (src/trainedPeople.ts) */
function city(watered = true, literate = LITERATE_WANTED, technician = TECHNICIANS_WANTED) {
  return {
    width: 20, height: 20, era: 1 as number | undefined,
    trained: { counts: { ...noTrained(), literate, technician }, cohort: noTrained(), worked: {}, last: null, at: -1 },
    getTileValue: () => 0, getTileFlags: () => 0,
    water: { zoneWater: () => (watered ? 1 : 3) },
    civicKinds: {}, wasteKinds: {}, stationKinds: {}, powerKinds: {},
    rulerHouse: null,
  } as any;
}

/** A simulation that counted a city doing well: jobs for all, schools, health, little crime or smoke, rich land */
function sim(people: number, over: Partial<{ jobs: number; crime: number }> = {}) {
  return {
    evaluation: { cityPop: people, cityYes: 80 },
    _census: { resHist10: [100], comHist10: [(over.jobs ?? 1) * 60], indHist10: [(over.jobs ?? 1) * 40],
      crimeAverage: over.crime ?? 20, pollutionAverage: 20, landValueAverage: 200 },
    _serviceLevels: { basic: 90, higher: 60, health: 80 },
    _waste: { overflow: 0 },
    blockMaps: { landValueMap: { worldGet: () => 200 } },
  } as any;
}

function objects(list: any[]) { return { all: () => list }; }

/** Homes, the five shops era 1 wants and a water tower (a village's water, src/unlocks.ts) */
function wellBuilt(powered = true) {
  const list: any[] = [];
  for (let i = 0; i < 40; i++) list.push(building("home", i, powered));
  for (let i = 40; i < 46; i++) list.push(building("shop", i, powered));
  list.push(building("water_tower", 50, powered, 0));
  return list;
}

describe("era score", () => {
  test("each era's sides weigh 1 in all, with aims between 0 and 1", () => {
    for (const era of [1, 2, 3, 4, 5] as const) {
      const rule = ERA_RULES[era];
      expect(FACTORS.reduce((sum, f) => sum + rule.weights[f], 0)).toBeCloseTo(1, 6);
      for (const target of Object.values(rule.targets)) { expect(target).toBeGreaterThan(0); expect(target).toBeLessThanOrEqual(1); }
      expect(rule.education.basic + rule.education.higher).toBeCloseTo(1, 6);
    }
    // ... and each era wants more people than the one before
    expect(ERA_RULES[2].people).toBeGreaterThan(ERA_RULES[1].people);
    expect(ERA_RULES[5].people).toBeGreaterThan(ERA_RULES[4].people);
  });

  test("is people's progress times how well they live, never above 1", () => {
    const map = city();
    const full = scoreEra(map, sim(4000), objects(wellBuilt()), 1);
    expect(full.peopleDone).toBe(1);
    expect(full.quality).toBeCloseTo(1, 6);
    expect(full.month).toBeCloseTo(1, 6);
    // Half the people the era wants: half the score, however well they live
    const half = scoreEra(map, sim(1000), objects(wellBuilt()), 1);
    expect(half.peopleDone).toBeCloseTo(0.5, 6);
    expect(half.month).toBeCloseTo(0.5, 6);
  });

  test("a city of homes alone, with no jobs, cannot do well", () => {
    // Owner, 20 Oct 2026: "ถ้าสร้างแต่พื้นที่อยู่อาศัยอย่างเดียว มันจะได้เหรอ"
    const homesOnly = scoreEra(city(), sim(4000, { jobs: 0 }), objects(wellBuilt()), 1);
    expect(homesOnly.factors.jobs.done).toBe(0);
    expect(homesOnly.month).toBeLessThan(0.86);
  });

  test("a city whose people go without water or power is held below the transition", () => {
    // Owner, 20 Oct 2026: "ถ้าเมืองไม่มีน้ำ ไฟ ใครจะอยู่ได้ล่ะ"
    const dry = scoreEra(city(false), sim(4000), objects(wellBuilt()), 1);
    expect(dry.month).toBe(FLOOR_CAP);
    expect(dry.heldBy).toBe("water");
    const dark = scoreEra(city(), sim(4000), objects(wellBuilt(false)), 1);
    expect(dark.month).toBeLessThanOrEqual(FLOOR_CAP);
    expect(dark.heldBy).toBe("power");
  });

  test("names what the era still needs", () => {
    const score = scoreEra(city(), sim(4000), objects(wellBuilt().filter(b => b.kind !== "water_tower")), 1);
    expect(score.symbols).toEqual(expect.arrayContaining([{ key: "water_tower", has: false }, { key: "shops", has: true }]));
    expect(score.factors.symbol.done).toBeLessThan(1);
  });

  test("a farming village moves on only once its primary school's first classes read and write (6.5)", () => {
    // Owner, 21 Oct 2026: eras 1 and 2 slower for a real reason
    const few = scoreEra(city(true, LITERATE_WANTED - 1), sim(4000), objects(wellBuilt()), 1);
    expect(few.symbols).toContainEqual({ key: "literate", has: false, count: { have: LITERATE_WANTED - 1, need: LITERATE_WANTED } });
    expect(few.month).toBeLessThan(1);
    const enough = scoreEra(city(true, LITERATE_WANTED), sim(4000), objects(wellBuilt()), 1);
    expect(enough.symbols).toContainEqual({ key: "literate", has: true, count: { have: LITERATE_WANTED, need: LITERATE_WANTED } });
    // ... as many as the mode's trained people ask: half in the easy mode, half again in the hard one
    expect(literateCount(city(), 0).need).toBe(Math.ceil(LITERATE_WANTED * 0.5));
    expect(literateCount(city(), 2).need).toBe(Math.ceil(LITERATE_WANTED * 1.5));
    // ... and only the farming village asks it
    expect(ERA_RULES[2].symbols).not.toContain("literate");
  });

  test("a market town moves on only once its secondary school's first classes bring technicians (6.6)", () => {
    // Owner, 21 Oct 2026: the eras should not rush, though the town has power and water on time
    const few = scoreEra(city(true, LITERATE_WANTED, TECHNICIANS_WANTED - 1), sim(12000), objects(wellBuilt()), 2);
    expect(few.symbols).toContainEqual({ key: "technicians", has: false,
      count: { have: TECHNICIANS_WANTED - 1, need: TECHNICIANS_WANTED } });
    const enough = scoreEra(city(true, LITERATE_WANTED, TECHNICIANS_WANTED), sim(12000), objects(wellBuilt()), 2);
    expect(enough.symbols).toContainEqual({ key: "technicians", has: true,
      count: { have: TECHNICIANS_WANTED, need: TECHNICIANS_WANTED } });
    expect(techniciansCount(city(), 0).need).toBe(Math.ceil(TECHNICIANS_WANTED * 0.5));
    expect(ERA_RULES[1].symbols).not.toContain("technicians");
  });
});

describe("eras moving on", () => {
  test("a city doing well enters the next era once its averaged score reaches 1, then counts afresh", () => {
    Random.seed(7);
    const map = city(), list = wellBuilt(), levels = { stamps: null as Uint8Array | null };
    const news = [];
    for (let month = 0; month < 3; month++) news.push(...eraMonth(map, sim(4000), objects(list), levels));
    expect(map.era).toBe(2);
    expect(news.map(n => n.type)).toEqual(["dawn", "era"]);
    // Every building got an era the first month, the city's
    expect(map.buildingEras[0]).toBeGreaterThanOrEqual(1);
    // ... and the next month counts against era 2's numbers: far from 1 with 4,000 people
    eraMonth(map, sim(4000), objects(list), levels);
    expect(map.eraScore.era).toBe(2);
    expect(map.eraScore.score).toBeLessThan(0.8);
  });

  test("in the transition buildings take the next era's look a few at a time, the city's era never going back", () => {
    Random.seed(11);
    const map = city(), list = wellBuilt(), levels = { stamps: null as Uint8Array | null };
    // A city at 90%: people at 90% of what era 1 wants, living well
    for (let month = 0; month < 24; month++) eraMonth(map, sim(1800), objects(list), levels);
    expect(map.era).toBe(1);
    const eras = Array.from(map.buildingEras as Uint8Array).filter(e => e > 0);
    const ahead = eras.filter(e => e === 2).length;
    expect(ahead).toBeGreaterThan(0);
    expect(ahead).toBeLessThan(eras.length);
    // A bad year does not take the city or its buildings back
    for (let month = 0; month < 6; month++) eraMonth(map, sim(100), objects(list), levels);
    expect(map.era).toBe(1);
    expect(Array.from(map.buildingEras as Uint8Array).filter(e => e === 2).length).toBeGreaterThanOrEqual(ahead);
  });

  test("no more of the buildings take the next era's look than the transition has gone, however long it lasts", () => {
    // The 10-year Khon Kaen play held at 90% for years had turned nearly all its buildings to the next era's look
    Random.seed(5);
    const map = city(), list = wellBuilt(), levels = { stamps: null as Uint8Array | null };
    // 90%: half the way from 0.8 to 1, for ten years
    for (let month = 0; month < 120; month++) eraMonth(map, sim(1800), objects(list), levels);
    expect(map.era).toBe(1);
    const eras = Array.from(map.buildingEras as Uint8Array).filter(e => e > 0);
    const ahead = eras.filter(e => e === 2).length;
    expect(ahead).toBeGreaterThan(0);
    expect(ahead).toBeLessThanOrEqual(Math.ceil(eras.length / 2));
  });

  test("the same seed makes the same eras", () => {
    const run = () => {
      Random.seed(3);
      const map = city(), list = wellBuilt(), levels = { stamps: null as Uint8Array | null };
      for (let month = 0; month < 12; month++) eraMonth(map, sim(1800), objects(list), levels);
      return Array.from(map.buildingEras as Uint8Array).join(",");
    };
    expect(run()).toBe(run());
  });

  test("a building gone leaves no era behind", () => {
    const map = city(), list = wellBuilt(), levels = { stamps: null as Uint8Array | null };
    eraMonth(map, sim(1000), objects(list), levels);
    expect(map.buildingEras[3]).toBe(1);
    eraMonth(map, sim(1000), objects(list.filter(b => b.id !== 3)), levels);
    expect(map.buildingEras[3]).toBe(0);
  });

  test("the era, its last scores and each building's era are kept with the city", () => {
    const map = city(), levels = { stamps: null as Uint8Array | null };
    Object.assign(map, { insideProvince: null, roadLevels: null, roadPieces: null, canals: null, buildingLevels: {},
      buildingPoses: {}, buses: [], policies: [], mineKinds: {} });
    for (let month = 0; month < 2; month++) eraMonth(map, sim(1800), objects(wellBuilt()), levels);
    map.era = 3;
    const saved = JSON.parse(JSON.stringify(writeCityLayers(map)));
    expect(saved.era).toBe(3);
    const loaded = { width: 20, height: 20 } as any;
    readCityLayers(loaded, saved);
    expect(loaded.era).toBe(3);
    expect(loaded.eraHistory.length).toBe(2);
    expect(Array.from(loaded.buildingEras as Uint8Array)).toEqual(Array.from(map.buildingEras as Uint8Array));
  });
});
