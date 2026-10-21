/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The numbers of the era score (docs/GAME_DESIGN.md section 1), one place for the owner to tune them: how many
// people each era wants, how much each side of life counts, what it must reach, and what each era must have.
// Plain data and plain checks: no DOM, so the simulation runs it anywhere.

import type { Era } from "./era.js";

/** The sides of life the quality is made of (docs/GAME_DESIGN.md 1.2) */
export const FACTORS = ["water", "power", "jobs", "education", "health", "safety", "clean", "living", "symbol"] as const;
export type Factor = typeof FACTORS[number];

/** What a city must have to leave an era: each one a check the era's symbol counts (docs/GAME_DESIGN.md 1.4) */
export type SymbolKey =
  | "ruler_house" | "shops" | "water_tower" | "literate" | "water_works" | "power_plant" | "school" | "hospital" | "secondary_school"
  | "paved_roads" | "university_or_metro" | "recycling" | "clean_power";

export interface EraRule {
  /** The people the era wants: progress is people / this, never above 1 */
  people: number;
  /** How much each side counts; they add up to 1 */
  weights: Readonly<Record<Factor, number>>;
  /** Where each side is full (1): a share of the people, 0-1 */
  targets: Readonly<Record<Exclude<Factor, "symbol">, number>>;
  /** Education: how much the children's seats and the youth's (higher) seats count, adding up to 1 */
  education: { basic: number; higher: number };
  /** What the era must have */
  symbols: readonly SymbolKey[];
}

const WEIGHTS: Readonly<Record<Factor, number>> = {
  water: 0.15, power: 0.15, jobs: 0.15, education: 0.1, health: 0.1, safety: 0.1, clean: 0.1, living: 0.1, symbol: 0.05,
};

/** By the era the city is in (1-5): what it takes to reach the next one (the fifth: how complete it is) */
export const ERA_RULES: Readonly<Record<Era, EraRule>> = {
  1: { people: 2000, weights: WEIGHTS, education: { basic: 1, higher: 0 },
    targets: { water: 0.6, power: 0.6, jobs: 0.8, education: 0.3, health: 0.2, safety: 0.6, clean: 0.6, living: 0.4 },
    // (a farming village's water is its tower's well: water works come with the market town, src/unlocks.ts)
    // ... and a market town needs villagers who read and write, its primary school's first classes (src/trainedPeople.ts;
    // owner, 21 Oct 2026: the first eras slower for a real reason, docs/GAME_DESIGN.md 6.5)
    symbols: ["ruler_house", "shops", "water_tower", "literate"] },
  2: { people: 10000, weights: WEIGHTS, education: { basic: 1, higher: 0 },
    targets: { water: 0.8, power: 0.8, jobs: 0.85, education: 0.5, health: 0.4, safety: 0.65, clean: 0.65, living: 0.5 },
    symbols: ["power_plant", "water_works", "school"] },
  3: { people: 50000, weights: WEIGHTS, education: { basic: 0.7, higher: 0.3 },
    targets: { water: 0.9, power: 0.9, jobs: 0.9, education: 0.7, health: 0.6, safety: 0.7, clean: 0.7, living: 0.6 },
    symbols: ["hospital", "secondary_school", "paved_roads"] },
  4: { people: 100000, weights: WEIGHTS, education: { basic: 0.5, higher: 0.5 },
    targets: { water: 0.95, power: 0.95, jobs: 0.9, education: 0.85, health: 0.8, safety: 0.75, clean: 0.75, living: 0.7 },
    symbols: ["university_or_metro", "recycling"] },
  5: { people: 500000, weights: WEIGHTS, education: { basic: 0.4, higher: 0.6 },
    targets: { water: 0.95, power: 0.98, jobs: 0.95, education: 0.95, health: 0.9, safety: 0.8, clean: 0.85, living: 0.8 },
    symbols: ["clean_power"] },
};

/** Below these shares of the people with water or power the score stays at TRANSITION_START less a little: a city
 * cannot move on while half its people go without (owner, 20 Oct 2026: "ถ้าเมืองไม่มีน้ำ ไฟ ใครจะอยู่ได้ล่ะ") */
export const FLOORS: Readonly<Partial<Record<Factor, number>>> = { water: 0.5, power: 0.5 };
/** From this score the city's buildings begin to take the next era's look; at 1 the city is in the next era */
export const TRANSITION_START = 0.8;
/** The score held below TRANSITION_START while a floor is not met */
export const FLOOR_CAP = 0.79;
/** The months the score is averaged over */
export const SCORE_MONTHS = 3;
/** A building of an older era renovates to the city's era with this chance a month (times its place's pull) */
export const RENOVATE_CHANCE = 0.03;
/** ... and in the transition, a building of the city's era takes the next one's look with this chance a month (times
 * how far the transition has gone and its place's pull) */
export const ADVANCE_CHANCE = 0.06;
/** The share of paved roads (level 2 and up) the paved_roads symbol wants, and of clean power for clean_power */
export const PAVED_SHARE = 0.5;
export const CLEAN_SHARE = 0.5;
/** The shops the shops symbol wants */
export const SHOPS_WANTED = 5;
/** The villagers who read and write (primary school graduates, src/trainedPeople.ts) the literate symbol wants in the
 * normal mode, times the mode's trained (src/gameModes.ts): a village school's first classes, two years or so of them */
export const LITERATE_WANTED = 50;
