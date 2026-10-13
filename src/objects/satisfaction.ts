/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How content each object is (ความพอใจ, owner 13 Oct 2026: "ทุกอย่างแล้วสรุปพอใจ หรือไม่พอใจที่จะอยู่ ... ในแต่ละ
// object มันจะแตกต่างกันออกไป"; docs/INSPECTOR.md "ความพอใจของแต่ละชนิด"; docs/GAME_PLAN.md phase 7 step 2). A score
// of 0–100 is 50 plus each factor's points, each factor an i18n key the card names. This first form reads only what the
// game already knows (power, water, the block maps, the city's schools and hospitals, taxes, demand, budgets) and is
// shown on the card only: it does not yet steer growth. Whole numbers only, so every machine gets the same.

/** What the scores read of the city besides the map */
export interface SatisfactionContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockMaps: any;
  /** src/budget.js: cityTax, comTax, indTax (0–20), firePercent, policePercent, roadPercent (0–1) */
  budget: { cityTax?: number; comTax?: number; indTax?: number; firePercent?: number; policePercent?: number; roadPercent?: number } | null;
  /** src/valves.js: demand for homes, shops and factories, −2000…2000 */
  valves: { resValve?: number; comValve?: number; indValve?: number } | null;
  /** src/services.ts serviceLevels: 0–100 each, and the people they count */
  services: { basic: number; higher: number; health: number; people: number } | null;
}

export interface SatisfactionFactor {
  /** satisfaction.<name> */
  key: string;
  points: number;
}

export interface Satisfaction {
  /** 0–100 */
  score: number;
  /** Biggest first; those worth nothing left out */
  factors: SatisfactionFactor[];
}

/** 50 plus the factors' points, kept to 0–100 */
export function settle(factors: SatisfactionFactor[]): Satisfaction {
  const kept = factors.filter(f => f.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.key.localeCompare(b.key));
  const sum = kept.reduce((total, f) => total + f.points, 0);
  return { score: Math.max(0, Math.min(100, 50 + sum)), factors: kept };
}

const clampInt = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, Math.round(value)));

/** A block map's value at a tile in four grades (0 low … 3 very high) */
export function gradeAt(map: { worldGet?(x: number, y: number): number } | null | undefined, x: number, y: number,
  thresholds: readonly [number, number, number]): number {
  const value = map?.worldGet?.(x, y) ?? 0;
  return value >= thresholds[2] ? 3 : value >= thresholds[1] ? 2 : value >= thresholds[0] ? 1 : 0;
}
export const LAND_GRADES = [30, 80, 150] as const;
export const DENSITY_GRADES = [64, 128, 192] as const;

/** The area's factors at a tile: each list gives the points for grades 0–3 */
export function areaFactors(context: SatisfactionContext, x: number, y: number, points: {
  pollution?: readonly number[]; crime?: readonly number[]; land?: readonly number[]; traffic?: readonly number[];
}): SatisfactionFactor[] {
  const maps = context.blockMaps, factors: SatisfactionFactor[] = [];
  if (!maps) return factors;
  if (points.pollution) factors.push({ key: "satisfaction.pollution", points: points.pollution[gradeAt(maps.pollutionDensityMap, x, y, DENSITY_GRADES)] });
  if (points.crime) factors.push({ key: "satisfaction.crime", points: points.crime[gradeAt(maps.crimeRateMap, x, y, DENSITY_GRADES)] });
  if (points.land) factors.push({ key: "satisfaction.land", points: points.land[gradeAt(maps.landValueMap, x, y, LAND_GRADES)] });
  if (points.traffic) factors.push({ key: "satisfaction.traffic", points: points.traffic[gradeAt(maps.trafficDensityMap, x, y, DENSITY_GRADES)] });
  return factors;
}

/** A tax's factor: the game's usual 7% is nothing, lower pleases, higher does not */
export const taxFactor = (rate: number | undefined, limit = 4): SatisfactionFactor =>
  ({ key: "satisfaction.taxes", points: clampInt((7 - (rate ?? 7)) / 2, limit) });

/** Demand for the kind's buildings (src/valves.js): a busy market pleases owners */
export const demandFactor = (valve: number | undefined, limit = 10): SatisfactionFactor =>
  ({ key: "satisfaction.demand", points: clampInt((valve ?? 0) / 200, limit) });

/** The city's schools and hospitals, once it is big enough to need them (src/services.ts, from 500 people) */
export function serviceFactors(context: SatisfactionContext): SatisfactionFactor[] {
  const services = context.services;
  if (!services || services.people < 500) return [];
  return [
    { key: "satisfaction.schools", points: clampInt((services.basic - 50) / 10, 5) },
    { key: "satisfaction.health", points: clampInt((services.health - 50) / 12.5, 4) },
  ];
}
