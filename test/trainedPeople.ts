/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Trained people (src/trainedPeople.ts, docs/GAME_DESIGN.md 6.1): counted from the city's own working schools, a class a
// year, the university's first after four years, and leaving when the city has no jobs for them.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { POWERBIT, ZONEBIT } from "../src/tileFlags";
import { CIVIC } from "../src/tileValues";
import {
  LEAVE_EACH_YEAR, newTrainedState, readTrained, trainedOf, type TrainingMap, trainMonth, writeTrained,
} from "../src/trainedPeople";

/** A map of 20 × 20 with schools on civic centres: kind by tile, powered unless said */
function schools(kinds: Record<number, string>, unpowered: number[] = []): TrainingMap {
  const width = 20;
  return {
    width, height: 20, civicKinds: { ...kinds }, sites: {}, trained: null,
    getTileValue: (x, y) => (kinds[y * width + x] ? CIVIC : 0),
    getTileFlags: (x, y) => (kinds[y * width + x] && !unpowered.includes(y * width + x) ? POWERBIT | ZONEBIT : 0),
    getTile: (x, y) => ({ isZone: () => Boolean(kinds[y * width + x]) }),
  };
}

const city = { people: 20000, workers: 100, jobs: 100 };

/** Trains n months from month `from`, returning the last year's news */
function months(map: TrainingMap, n: number, from = 1, c = city) {
  let last = null;
  for (let m = from; m < from + n; m++) last = trainMonth(map, c, m) ?? last;
  return last;
}

describe("trained people", () => {
  test("a secondary school trains technicians, a class a year once its first students finish", () => {
    const map = schools({ 45: "secondary_school" });
    months(map, 11);                       // months 1-11: the school's first year, still waiting
    expect(trainedOf(map).technician).toBe(0);
    months(map, 12, 12);                   // months 12-23; month 12 is January: the first class (none yet) graduates
    expect(trainedOf(map).technician).toBe(0);
    months(map, 1, 24);                    // the second January: a whole year's class, less those who left
    // 800 seats, all filled by a city of 20,000 (4,000 children), over 3 years, 12% of them technicians: months 13-24
    const yearClass = 800 / 3 * 0.12;
    expect(trainedOf(map).technician).toBe(Math.floor(yearClass * (1 - LEAVE_EACH_YEAR) + 1e-6));
  });

  test("a vocational college trains technicians and nurses; a university nothing for four years, then engineers and doctors", () => {
    const map = schools({ 45: "vocational_college", 105: "university" });
    months(map, 48);
    expect(trainedOf(map).nurse).toBeGreaterThan(0);
    expect(trainedOf(map).technician).toBeGreaterThan(trainedOf(map).nurse);
    expect(trainedOf(map).engineer).toBe(0);
    expect(trainedOf(map).doctor).toBe(0);
    months(map, 24, 49);
    expect(trainedOf(map).engineer).toBeGreaterThan(trainedOf(map).doctor);
    expect(trainedOf(map).doctor).toBeGreaterThan(0);
  });

  test("a school with no power, being built or gone trains nobody, and starts its wait again", () => {
    const dark = schools({ 45: "secondary_school" }, [45]);
    months(dark, 36);
    expect(trainedOf(dark).technician).toBe(0);
    const site = schools({ 45: "secondary_school" });
    site.sites = { 45: { tool: "secondary_school", ready: 1e9 } };
    months(site, 36);
    expect(trainedOf(site).technician).toBe(0);
    const gone = schools({ 45: "secondary_school" });
    months(gone, 10);
    expect(gone.trained!.worked["45"]).toBe(10);
    gone.civicKinds = {};
    months(gone, 1, 11);
    expect(gone.trained!.worked).toEqual({});
  });

  test("a small town fills only some seats; health buildings train nobody", () => {
    const big = schools({ 45: "secondary_school", 46: "community_hospital" });
    const small = schools({ 45: "secondary_school" });
    months(big, 36);
    months(small, 36, 1, { ...city, people: 1000 });
    expect(trainedOf(small).technician).toBeLessThan(trainedOf(big).technician);
    expect(trainedOf(big).nurse).toBe(0);
  });

  test("more leave when the city has fewer jobs than workers", () => {
    const working = schools({ 45: "vocational_college" }), idle = schools({ 45: "vocational_college" });
    months(working, 48);
    months(idle, 48, 1, { ...city, jobs: 40 });
    expect(trainedOf(idle).technician).toBeLessThan(trainedOf(working).technician * 0.8);
  });

  test("a month opened again by a load is not trained twice", () => {
    const map = schools({ 45: "secondary_school" });
    months(map, 30);
    const before = JSON.stringify(map.trained);
    expect(trainMonth(map, city, 30)).toBeNull();
    expect(JSON.stringify(map.trained)).toBe(before);
  });

  test("the trained people are saved and read back", () => {
    const map = schools({ 45: "vocational_college" });
    months(map, 40);
    const back = readTrained(JSON.parse(JSON.stringify(writeTrained(map.trained))));
    expect(back.worked).toEqual(map.trained!.worked);
    expect(back.at).toBe(40);
    for (const kind of ["technician", "nurse"] as const) {
      expect(back.counts[kind]).toBeCloseTo(map.trained!.counts[kind], 1);
      expect(back.cohort[kind]).toBeCloseTo(map.trained!.cohort[kind], 1);
    }
    expect(writeTrained(newTrainedState())).toBeUndefined();
    expect(readTrained({ counts: { technician: -5, nurse: "x" }, worked: { a: 3, 7: 2 } })).toMatchObject({
      counts: { technician: 0, nurse: 0 }, worked: { 7: 2 } });
  });

  test("the core trains them each month and keeps them in its save", () => {
    const core = new CityCore({ map: (MapGenerator as any)(), seed: 3 });
    expect(core.systemNames).toContain("trained");
    core.map.trained.counts.engineer = 12.5;
    const saved = core.save() as { trained?: { counts: Record<string, number> } };
    expect(saved.trained?.counts.engineer).toBe(12.5);
  });
});
