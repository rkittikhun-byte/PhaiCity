/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Easy, normal and hard (โหมด ง่าย / ปกติ / ยาก, docs/GAME_DESIGN.md 6.3; owner, 21 Oct 2026: "มี mode ให้เลือกเล่นไหม easy
// - normal - hard แต่ถ้า online จะเป็น normal เสมอ ไม่มีให้เลือก mode"). A mode is the game's old level (Simulation.LEVEL_*:
// the taxes' multiplier, the roads' upkeep and the chance of disasters in src/budget.js and src/disasterManager.js), and
// it also scales, from this one table: the trained people a building needs (src/unlocks.ts), its months as a
// construction site (src/construction.ts), the treasury a new city starts with and the people each era wants
// (src/eraRules.ts). The level is saved with the city (src/simulation.js) and no command changes it. A city of an online
// world is always normal: the province card offers no choice there, and the server refuses any other
// (server/src/validate.ts).
// Plain data: no DOM.

export const MODES = ["easy", "normal", "hard"] as const;
export type Mode = typeof MODES[number];

export interface ModeRule {
  /** The simulation's level (Simulation.LEVEL_EASY 0, LEVEL_MED 1, LEVEL_HARD 2) */
  level: 0 | 1 | 2;
  /** Times the trained people each building needs */
  trained: number;
  /** Times the months it stands as a construction site */
  buildTime: number;
  /** Times the treasury a new city starts with */
  funds: number;
  /** Times the people each era wants */
  people: number;
}

export const MODE_RULES: Readonly<Record<Mode, ModeRule>> = {
  easy: { level: 0, trained: 0.5, buildTime: 0.5, funds: 1.5, people: 0.75 },
  normal: { level: 1, trained: 1, buildTime: 1, funds: 1, people: 1 },
  hard: { level: 2, trained: 1.5, buildTime: 1.5, funds: 0.7, people: 1.25 },
};

/** The mode of a new city when nobody chose, and always online */
export const DEFAULT_MODE: Mode = "normal";
export const ONLINE_MODE: Mode = "normal";

/** The mode of a simulation level; anything else is normal */
export function modeOfLevel(level: unknown): Mode {
  return MODES.find((mode) => MODE_RULES[mode].level === level) ?? DEFAULT_MODE;
}

/** The rule of a simulation level */
export function modeRule(level: unknown): ModeRule {
  return MODE_RULES[modeOfLevel(level)];
}

/** Whether a city may choose its mode: not one of an online world, which is always normal */
export function modeChoosable(worldId: unknown): boolean {
  return worldId === null || worldId === undefined || worldId === "";
}

/** The levels a new city may start at: all three, or online only normal */
export function levelsFor(worldId: unknown): Array<ModeRule["level"]> {
  return modeChoosable(worldId) ? MODES.map((mode) => MODE_RULES[mode].level) : [MODE_RULES[ONLINE_MODE].level];
}

/** A new city's treasury in a mode */
export function startingFundsIn(base: number, level: unknown): number {
  return Math.round(base * modeRule(level).funds);
}
