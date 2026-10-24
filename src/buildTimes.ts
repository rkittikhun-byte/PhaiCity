/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How long a building takes to go up (เวลาก่อสร้าง; owner, 24 Oct 2026: "ยิ่งบ้านใหญ่ขึ้น ยิ่งสร้างนาน"), in game months, the one
// table for every build the 3D view shows as a construction site: a home, shop or factory of the plot list going up or
// rising a level (src/plotBuildings.ts), and every building rebuilt in the next era's look (src/eraScore.ts eraRebuilds),
// which takes as long as building that level fresh. The ruler's big buildings keep their own months as sites, during
// which they do not work (src/unlocks.ts months, src/construction.ts); their era rebuild takes those months too, or the
// table's. The numbers are in docs/GAME_DESIGN.md 23. Plain data, no DOM.

/** Months by level (1 first) for homes, shops and factories: a one-storey stilt house a month, a shophouse two, a
 * level-3 home three, a tower or a big factory a year */
export const BUILD_MONTHS: Readonly<Record<"home" | "shop" | "factory", readonly number[]>> = {
  home: [1, 2, 3, 6, 10],
  shop: [2, 3, 5, 8, 12],
  factory: [3, 5, 8, 12],
};

/** Months for a building the table does not list by level: a temple's hall, a power plant, a service */
export const OTHER_MONTHS: Readonly<Record<string, number>> = { temple: 12, power_plant: 10, civic: 6, waste: 6, mine: 6, station: 8 };
export const DEFAULT_MONTHS = 6;

/** The months a building of a kind (the city objects' kind, src/objects/buildings.ts) and level (1 first) takes */
export function buildMonthsOf(kind: string, level: number): number {
  const byLevel = (BUILD_MONTHS as Record<string, readonly number[]>)[kind];
  if (byLevel) return byLevel[Math.max(0, Math.min(byLevel.length - 1, Math.round(level) - 1))];
  return OTHER_MONTHS[kind] ?? DEFAULT_MONTHS;
}
