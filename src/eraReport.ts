/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the era card shows (docs/GAME_DESIGN.md 1.5; owner, 20 Oct 2026: the player always sees why the city is not
// moving on): the month's era score (map.eraScore, src/eraScore.ts) taken apart into rows. The score against the
// transition and the next era; people's progress times how well they live; each side of life against its aim, with
// what finishing it would add to the score and one thing the player can do; the floors that hold the score below the
// transition; and the symbols the era wants. The card (src/eraCard.ts) translates and draws it. Plain code: no DOM,
// i18n keys only.

import type { Era } from "./era.js";
import { ERA_RULES, type Factor, FACTORS, FLOOR_CAP, FLOORS, type SymbolKey, TRANSITION_START } from "./eraRules.js";
import type { EraScore } from "./eraScore.js";

/** A share, 0-1, as the whole percent the card shows: rounded down, so nothing reads as an aim it has not reached */
export function percentOf(share: number): number {
  return Math.floor(Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0)) * 100 + 1e-6);
}

export interface EraFactorRow {
  factor: Factor;
  /** Where it is and its aim, whole percents of the people (the symbols: how many the city has, of all) */
  value: number;
  target: number;
  /** For the symbols: how many the city has and of how many */
  count?: { has: number; all: number };
  /** Its share of how well people live, percent */
  weight: number;
  met: boolean;
  /** The era score points finishing it would add this month */
  gain: number;
  /** What the player can do about it, an i18n key; null when it is met */
  hint: string | null;
}

/** A side below its floor: while it is, the score stays below the transition (FLOOR_CAP) */
export interface EraFloorRow { factor: Factor; value: number; floor: number; holding: boolean }

export interface EraSymbolRow { key: SymbolKey; has: boolean; hint: string | null }

export interface EraReport {
  era: Era;
  /** The era it moves on to, or null in the last one */
  nextEra: Era | null;
  /** The averaged score that moves the city on, and this month's own, whole percents */
  score: number;
  month: number;
  /** This month's people times how well they live, before a floor holds it */
  raw: number;
  /** Where its buildings begin to change, and the score held while a floor is not met, percent */
  transition: number;
  cap: number;
  /** Still in its era, its buildings changing to the next one's look, or in the last era */
  stage: "growing" | "changing" | "last";
  people: { count: number; wanted: number; percent: number; met: boolean; gain: number; hint: string | null };
  /** How well the people live, percent */
  quality: number;
  factors: EraFactorRow[];
  floors: EraFloorRow[];
  symbols: EraSymbolRow[];
  /** What would help most now: the floor holding the score, else the unmet row that would add most */
  best: { hint: string; gain: number } | null;
}

/** What the player can do for a side that is short (one plain line each, docs/i18n/UI_STRINGS.md era.hint.*) */
function factorHint(factor: Factor, era: Era): string {
  if (factor === "education" && ERA_RULES[era].education.higher > 0) return "era.hint.education_higher";
  return `era.hint.${factor}`;
}

/** The era card's rows, from the month's era score */
export function eraReport(score: EraScore): EraReport {
  const era = score.era;
  const factors: EraFactorRow[] = [];
  for (const factor of FACTORS) {
    const f = score.factors[factor];
    if (!f || f.weight <= 0) continue;
    const met = f.done >= 1 - 1e-9;
    const row: EraFactorRow = {
      factor, value: percentOf(f.value), target: Math.round(f.target * 100), weight: Math.round(f.weight * 100), met,
      gain: met ? 0 : percentOf(score.peopleDone * f.weight * (1 - f.done)), hint: met ? null : factorHint(factor, era),
    };
    if (factor === "symbol") row.count = { has: score.symbols.filter(s => s.has).length, all: score.symbols.length };
    factors.push(row);
  }
  const peopleMet = score.peopleDone >= 1 - 1e-9;
  const people = {
    count: Math.round(score.people), wanted: score.peopleWanted, percent: percentOf(score.peopleDone), met: peopleMet,
    gain: peopleMet ? 0 : percentOf((1 - score.peopleDone) * score.quality), hint: peopleMet ? null : "era.hint.people",
  };
  const floors: EraFloorRow[] = [];
  for (const [factor, floor] of Object.entries(FLOORS) as [Factor, number][]) {
    const value = score.factors[factor]?.value ?? 0;
    if (value < floor) floors.push({ factor, value: percentOf(value), floor: Math.round(floor * 100), holding: score.heldBy !== null });
  }
  const symbols = score.symbols.map(s => ({ key: s.key, has: s.has, hint: s.has ? null : `era.symbol_hint.${s.key}` }));
  // The floor that holds the score comes first: nothing else lifts it past the transition
  const held = floors.find(f => f.holding);
  const candidates = [people, ...factors].filter(row => row.hint !== null && row.gain > 0).sort((a, b) => b.gain - a.gain);
  const best = held ? { hint: factorHint(held.factor, era), gain: 0 }
    : candidates.length ? { hint: candidates[0].hint as string, gain: candidates[0].gain } : null;
  return {
    era, nextEra: era < 5 ? (era + 1) as Era : null, score: percentOf(score.score), month: percentOf(score.month),
    raw: percentOf(score.peopleDone * score.quality),
    transition: Math.round(TRANSITION_START * 100), cap: Math.round(FLOOR_CAP * 100),
    stage: era >= 5 ? "last" : score.score >= TRANSITION_START ? "changing" : "growing",
    people, quality: percentOf(score.quality), factors, floors, symbols, best,
  };
}
