/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era card's rows (src/eraReport.ts, docs/GAME_DESIGN.md 1.5): the month's era score taken apart into what the
// player reads: each side against its aim with a tick or a cross, what finishing it adds, what to do, what holds the
// score, and what the next era must have.

import type { Era } from "../src/era";
import { ERA_RULES, FACTORS, type Factor, type SymbolKey } from "../src/eraRules";
import type { EraScore } from "../src/eraScore";
import { eraReport, percentOf } from "../src/eraReport";
import { hasKey } from "../src/i18n/index";

/** A month's score: every side at its aim unless given, the era's symbols all had unless named missing */
function score(over: { era?: Era; score?: number; peopleDone?: number; values?: Partial<Record<Factor, number>>;
                       missing?: SymbolKey[]; heldBy?: Factor | null } = {}): EraScore {
  const era = over.era ?? 2, rule = ERA_RULES[era];
  const symbols = rule.symbols.map(key => ({ key, has: !(over.missing ?? []).includes(key) }));
  const factors = {} as EraScore["factors"];
  let quality = 0;
  for (const factor of FACTORS) {
    const target = factor === "symbol" ? 1 : rule.targets[factor];
    const value = factor === "symbol" ? symbols.filter(s => s.has).length / symbols.length : over.values?.[factor] ?? target;
    const done = Math.min(1, value / target);
    factors[factor] = { value, target, done, weight: rule.weights[factor] };
    quality += rule.weights[factor] * done;
  }
  const peopleDone = over.peopleDone ?? 1;
  return { era, score: over.score ?? peopleDone * quality, month: peopleDone * quality, people: peopleDone * rule.people,
    peopleWanted: rule.people, peopleDone, quality, factors, symbols, heldBy: over.heldBy ?? null };
}

describe("the era card's rows", () => {
  test("a share reads as a whole percent rounded down, so nothing shows an aim it has not reached", () => {
    expect([percentOf(0.599), percentOf(0.6), percentOf(1.2), percentOf(-1), percentOf(NaN)]).toEqual([59, 60, 100, 0, 0]);
    const report = eraReport(score({ values: { water: 0.799 } }));
    expect(report.factors.find(f => f.factor === "water")).toMatchObject({ value: 79, target: 80, met: false });
    expect(report.factors.find(f => f.factor === "power")).toMatchObject({ value: 80, target: 80, met: true, gain: 0, hint: null });
  });

  test("a row for every side that counts, in the rules' order, each with its weight", () => {
    const report = eraReport(score());
    expect(report.factors.map(f => f.factor)).toEqual([...FACTORS]);
    expect(report.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
    // The symbols' row counts them
    expect(report.factors.find(f => f.factor === "symbol")?.count).toEqual({ has: 3, all: 3 });
  });

  test("what finishing a side adds: people's progress × its weight × what it lacks", () => {
    // Half the people; power at a quarter of its aim (0.2 of 0.8): 0.5 × 0.15 × 0.75 = 5.6 points
    const month = score({ peopleDone: 0.5, values: { power: 0.2 } });
    const report = eraReport(month);
    const power = report.factors.find(f => f.factor === "power")!;
    expect(power).toMatchObject({ met: false, gain: 5, hint: "era.hint.power" });
    // ... and the people: what they lack × how well they live
    expect(report.people).toMatchObject({ percent: 50, met: false, hint: "era.hint.people", gain: percentOf(0.5 * month.quality) });
    // What to do next is the row that would add most: here the people
    expect(report.best).toEqual({ hint: "era.hint.people", gain: report.people.gain });
  });

  test("a side below half its people shows as a floor; one that held the score this month comes first", () => {
    const low = eraReport(score({ peopleDone: 0.3, values: { water: 0.4 } }));
    expect(low.floors).toEqual([{ factor: "water", value: 40, floor: 50, holding: false }]);
    expect(low.cap).toBe(79);
    const held = eraReport(score({ score: 0.79, values: { power: 0.3 }, heldBy: "power" }));
    expect(held.floors).toEqual([{ factor: "power", value: 30, floor: 50, holding: true }]);
    expect(held.best).toEqual({ hint: "era.hint.power", gain: 0 });
    // The month's own figure before the floor held it
    expect(held.raw).toBeGreaterThan(held.cap);
  });

  test("the stage: still growing, changing to the next era's look from 80%, or the last era", () => {
    expect(eraReport(score({ score: 0.5 }))).toMatchObject({ stage: "growing", nextEra: 3, transition: 80, score: 50 });
    expect(eraReport(score({ score: 0.85 }))).toMatchObject({ stage: "changing", nextEra: 3 });
    expect(eraReport(score({ era: 5, score: 0.85 }))).toMatchObject({ stage: "last", nextEra: null });
  });

  test("the symbols the era wants, the missing ones with how to get them", () => {
    const report = eraReport(score({ missing: ["school"] }));
    expect(report.symbols).toEqual([
      { key: "power_plant", has: true, hint: null }, { key: "water_works", has: true, hint: null },
      { key: "school", has: false, hint: "era.symbol_hint.school" },
    ]);
    expect(report.factors.find(f => f.factor === "symbol")).toMatchObject({ met: false, count: { has: 2, all: 3 },
      hint: "era.hint.symbol" });
  });

  test("everything met: nothing to do but wait for the average", () => {
    expect(eraReport(score({ score: 0.9 })).best).toBeNull();
  });

  test("education's hint asks for colleges once the era counts the young's seats", () => {
    expect(eraReport(score({ era: 2, values: { education: 0 } })).factors.find(f => f.factor === "education")?.hint)
      .toBe("era.hint.education");
    expect(eraReport(score({ era: 3, values: { education: 0 } })).factors.find(f => f.factor === "education")?.hint)
      .toBe("era.hint.education_higher");
  });

  test("every hint, side and symbol it names is translated", () => {
    const keys = ["era.hint.people", "era.hint.education_higher"];
    for (const era of [1, 2, 3, 4, 5] as Era[]) {
      const report = eraReport(score({ era, peopleDone: 0.1, values: Object.fromEntries(FACTORS.map(f => [f, 0])),
        missing: [...ERA_RULES[era].symbols] }));
      for (const row of report.factors) keys.push(`era.factor.${row.factor}`, row.hint!);
      for (const symbol of report.symbols) keys.push(`era.symbol.${symbol.key}`, symbol.hint!);
      keys.push(`era.name.${era}`);
    }
    expect(keys.filter(key => !hasKey(key))).toEqual([]);
  });
});
