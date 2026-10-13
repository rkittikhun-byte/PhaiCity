/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The wind (ลม, owner 13 Oct 2026: "ให้มันพริ้วๆ ตามกระแสลม เรามีแผนที่ ลม อยู่ไหม"): Thailand's seasons set where it
// comes from, the province's wind level how hard it blows. The northeast monsoon brings the cool, dry wind from
// November to February; the hot season a light southerly in March and April; the southwest monsoon the rains from May
// to October, strongest in August and September. The 3D view's trees sway with it (src/render3d/city/index.ts); later
// smoke and pollution will drift with it. Plain code, no DOM.

export interface Wind {
  /** Where it blows towards, a unit vector on the map: x east, y south */
  x: number;
  y: number;
  /** How hard, 0 (still) to 1 (a gale) */
  strength: number;
  /** Where it comes from, in degrees clockwise from north, as weather reports say */
  from: number;
  /** The season's string key (src/i18n) */
  season: "northeast_monsoon" | "hot_season" | "southwest_monsoon";
}

/** Each month's wind (0 January): where it comes from and how hard, before the province's level */
const MONTHS: ReadonlyArray<{ from: number; base: number; season: Wind["season"] }> = [
  { from: 45, base: 0.6, season: "northeast_monsoon" }, { from: 45, base: 0.55, season: "northeast_monsoon" },
  { from: 180, base: 0.3, season: "hot_season" }, { from: 190, base: 0.35, season: "hot_season" },
  { from: 225, base: 0.55, season: "southwest_monsoon" }, { from: 225, base: 0.6, season: "southwest_monsoon" },
  { from: 230, base: 0.65, season: "southwest_monsoon" }, { from: 230, base: 0.75, season: "southwest_monsoon" },
  { from: 225, base: 0.75, season: "southwest_monsoon" }, { from: 215, base: 0.6, season: "southwest_monsoon" },
  { from: 50, base: 0.55, season: "northeast_monsoon" }, { from: 45, base: 0.6, season: "northeast_monsoon" },
];

/** The wind of a month (0 January) in a province of this wind level (0–5, src/geo/provinceResources.ts). */
export function seasonWind(month: number, windLevel = 2): Wind {
  const m = MONTHS[((Math.floor(month) % 12) + 12) % 12];
  const level = Math.max(0, Math.min(5, windLevel));
  const strength = Math.min(1, m.base * (0.6 + 0.12 * level));
  // Blowing towards the opposite of where it comes from; north is up the map (y falls)
  const towards = (m.from + 180) * Math.PI / 180;
  return { x: Math.sin(towards), y: -Math.cos(towards), strength, from: m.from, season: m.season };
}
