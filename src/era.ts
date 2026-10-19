/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's era (ยุค, owner 19 Oct 2026): a city moves up through five eras as it grows, and what is drawn follows
// the era it has reached: its people (art/people, src/render3d/city/people3d.ts) and, next, its buildings. It lives
// on the map as gameMap.era (1-5) so every renderer reads the same value and none works it out for itself.
//
//   1 farming village, 2 market town, 3 factory town, 4 modern city, 5 future city
//   (the concept sheets assets/concept/era<n>_*.jpg and people_era<n>_v3.jpg)
//
// For now the era follows the ruler's rank, which only rises (src/rulerRank.ts), so an era once reached is kept.
// The rule is here alone: change eraForRank to change when a city moves on.

import type { RankId } from './rulerRank.ts';

export const ERAS = [1, 2, 3, 4, 5] as const;
export type Era = typeof ERAS[number];

/** หมื่น 1, ขุน 2, หลวง 3, พระ 4, พระยา and เจ้าพระยา 5. */
const ERA_OF_RANK: Readonly<Record<RankId, Era>> = {
  muen: 1, khun: 2, luang: 3, phra: 4, phraya: 5, chaophraya: 5,
};

export function isEra(value: unknown): value is Era {
  return typeof value === 'number' && (ERAS as readonly number[]).includes(value);
}

export function eraForRank(rank: RankId): Era {
  return ERA_OF_RANK[rank] ?? 1;
}

/** The era of a map, 1 when it has none (old saves, tests, practice maps before a rank is known). */
export function mapEra(map: { era?: unknown } | null | undefined): Era {
  return map && isEra(map.era) ? map.era : 1;
}

