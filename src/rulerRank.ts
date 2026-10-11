/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's rank (ยศเจ้าเมือง, docs/ONLINE_PLAN.md section 4): an old Thai title for each size of city,
// from หมื่น for a village up to เจ้าพระยา for a megalopolis. It follows the game's own city classes
// (src/evaluation.js), so the population thresholds are the game's. A rank once earned is kept: a city that
// shrinks keeps its ruler's title. No DOM here; the words are "rank.<id>" in src/i18n.

export const RANKS = ["muen", "khun", "luang", "phra", "phraya", "chaophraya"] as const;
export type RankId = typeof RANKS[number];

/** Evaluation.CC_* in order of size, each with its rank. */
const CITY_CLASSES = ["VILLAGE", "TOWN", "CITY", "CAPITAL", "METROPOLIS", "MEGALOPOLIS"];

/** Above these populations a city reaches the next class (src/evaluation.js getCityClass). */
const CLASS_POPULATIONS = [2000, 10000, 50000, 100000, 500000];

export function isRank(value: unknown): value is RankId {
  return typeof value === "string" && (RANKS as readonly string[]).includes(value);
}

export function rankForCityClass(cityClass: string): RankId {
  return RANKS[Math.max(0, CITY_CLASSES.indexOf(cityClass))];
}

export function rankForPopulation(population: number): RankId {
  return RANKS[CLASS_POPULATIONS.filter((threshold) => population > threshold).length];
}

/** The higher of a kept rank (anything, for old saves) and the rank the city has just earned. */
export function keepHigherRank(kept: unknown, earned: RankId): RankId {
  if (!isRank(kept)) return earned;
  return RANKS.indexOf(kept) >= RANKS.indexOf(earned) ? kept : earned;
}
