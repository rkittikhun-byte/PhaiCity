/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the province picker tells a player about a province before they rule it: the starting treasury,
// how hard the map is to build on, and its resources. Everything comes from the real geography already in
// data/ (preset map stats and province tags). Pure functions, no DOM.
//
// Balance rule (owner decision, 11 Oct 2026): every province should be equally fun to rule, so provinces
// with less buildable land (more water or forest) start with more money. Regional traits
// (docs/ONLINE_PLAN.md 5.2) are shown as information only for now.

export interface MapStats {
  land: number;
  water: number;
  woods: number;
}

/** The treasury of a random map (Simulation sets 20000 for every difficulty). */
export const BASE_FUNDS = 20000;
const WATER_WEIGHT = 0.8;
const WOODS_WEIGHT = 0.5;
const MAX_BONUS = 0.5;
const FUNDS_STEP = 500;

/** Extra starting money as a share of BASE_FUNDS, 0 to 0.5. Water costs more than forest, which can be cleared. */
export function fundsBonus(stats: MapStats): number {
  const bonus = stats.water * WATER_WEIGHT + stats.woods * WOODS_WEIGHT;
  return Math.min(MAX_BONUS, Math.max(0, bonus));
}

export function startingFunds(stats: MapStats): number {
  return Math.round((BASE_FUNDS * (1 + fundsBonus(stats))) / FUNDS_STEP) * FUNDS_STEP;
}

/**
 * 1 (easy) to 3 (hard), from the share of open land that can be built on straight away. A whole province has far
 * more forest than the old 2 × 2 km town maps (half the provinces are under 81% open land), so the steps are lower
 * than they were.
 */
export function difficultyStars(stats: MapStats): 1 | 2 | 3 {
  if (stats.land >= 0.85) return 1;
  if (stats.land >= 0.6) return 2;
  return 3;
}

// Province tags (data/thailand-provinces.json) that players see; others, such as "sensitive", stay internal.
const RESOURCE_TAGS = ["coast_andaman", "coast_gulf", "island", "river_mekong", "river_chao_phraya"];

export interface Resource {
  /** i18n key, e.g. "resource.coast_gulf" */
  key: string;
  /** Percentage of the starting map, for the share-based resources */
  pct?: number;
}

const percent = (share: number): number => Math.round(share * 100);

export function provinceResources(tags: readonly string[], stats: MapStats): Resource[] {
  const resources: Resource[] = RESOURCE_TAGS.filter((tag) => tags.includes(tag)).map((tag) => ({ key: `resource.${tag}` }));
  resources.push({ key: "resource.flat", pct: percent(stats.land) });
  if (stats.woods >= 0.05) resources.push({ key: "resource.forest", pct: percent(stats.woods) });
  if (stats.water >= 0.05) resources.push({ key: "resource.water", pct: percent(stats.water) });
  return resources;
}

/** Short notes (i18n keys) on what the land means for building, in order of importance. */
export function resourceNotes(tags: readonly string[], stats: MapStats): string[] {
  const notes: string[] = [];
  if (tags.some((tag) => tag.startsWith("coast_"))) notes.push("resource.note.coast");
  if (tags.includes("island")) notes.push("resource.note.island");
  if (tags.some((tag) => tag.startsWith("river_"))) notes.push("resource.note.river");
  if (stats.woods >= 0.15) notes.push("resource.note.forest");
  if (stats.water >= 0.15) notes.push("resource.note.water");
  if (stats.land >= 0.85) notes.push("resource.note.flat");
  return notes;
}
