/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A home's, shop's or factory's level checklist (docs/GAME_DESIGN.md section 2; owner, 16 and 20 Oct 2026: the player
// always sees why a building does not grow): what its next level needs, each with a tick for what it has and a cross
// for what it lacks, and what the levels after it add. Read from what the simulation already weighs when it looks at a
// painted plot (src/plots.ts plotFound): a road within reach and a way along it, power, water from a house up, the
// city's demand for its kind, schools and health (which draw families), land value and pollution, the people round a
// home, and a lot of four plots for the top level. The row the simulation's last look found holding it back
// (map.plotWhy, PLOT_WHY) is marked. It only reads the city. Plain code: no DOM, i18n keys only.

import { DENSITY_GRADES, gradeAt, LAND_GRADES } from "./objects/satisfaction.js";
import {
  DENSITY_TO_RISE, LOT_LEVEL, lotOf, nearestRoad, PLOT_REACH, PLOT_TOP, PLOT_WHY, type PlotKind, type PlotMap, plotOf,
  type PlotWhy,
} from "./plots.js";
import { familyPull, pollutionShield, SERVICES_FROM, type ServiceLevels } from "./services.js";
import { POWERBIT } from "./tileFlags.js";
import { ZONE_WATERED } from "./waterManager.js";

/** What a level can need, in the order the card lists them */
export const PLOT_CHECKS = ["road", "power", "water", "demand", "services", "land", "pollution", "crowd", "lot"] as const;
export type PlotCheck = typeof PLOT_CHECKS[number];

/** The row each reason the simulation gives points at */
const WHY_ROW: Readonly<Partial<Record<PlotWhy, PlotCheck>>> = {
  power: "power", road: "road", water: "water", demand: "demand", pollution: "pollution", land: "land", quiet: "crowd",
  lot: "lot",
};
/** The order the simulation looks for what holds a plot (src/plots.ts plotWhyOf); schools and health only help */
const HOLD_ORDER: readonly PlotCheck[] = ["power", "road", "water", "demand", "pollution", "land", "crowd", "lot"];
/** A home's place score (demand, land value less pollution) below which it shrinks about as often as it grows
 * (src/plots.ts homeScore and shrinks) */
const HOME_HOLDS = 350;
/** Pollution above which a home does not grow at all (src/plots.ts plotFound) */
const HOME_POLLUTION = 128;

export interface PlotCheckRow {
  check: PlotCheck;
  ok: boolean;
  /** The line: an i18n key and what fills it (a grade is a key of its own) */
  key: string;
  params?: Record<string, string | number>;
  /** What the player can do about it, an i18n key, when it lacks it */
  hint?: string;
  /** The one that holds it back now */
  holds: boolean;
}

export interface PlotChecklist {
  kind: PlotKind;
  level: number;
  top: number;
  /** The level it grows toward; null at its top, where the rows are what keeps it there */
  target: number | null;
  rows: PlotCheckRow[];
  /** What the levels after the next add to what the next needs, levels in a row that add the same together */
  later: Array<{ from: number; to: number; checks: PlotCheck[] }>;
  /** What holds it back, or that it grows when its turn comes, or that it is at its top with all it needs */
  state: PlotCheck | "growing" | "top";
}

interface Grid { worldGet?(x: number, y: number): number }

/** What the checklist reads of the city: the map, the simulation's block maps, its demand and its services */
export interface ChecklistCity {
  map: PlotMap & { water?: { zoneWater(x: number, y: number): number } | null; plotWhy?: Uint8Array | null };
  blockMaps: { landValueMap?: Grid; pollutionDensityMap?: Grid; populationDensityMap?: Grid } | null;
  valves: { resValve?: number; comValve?: number; indValve?: number } | null;
  services: ServiceLevels | null;
}

const at = (grid: Grid | undefined, x: number, y: number): number => grid?.worldGet?.(x, y) ?? 0;

/** The level checklist of the plot at (x, y), or null where there is none (not a painted plot) */
export function plotChecklist(city: ChecklistCity, x: number, y: number): PlotChecklist | null {
  const { map } = city;
  const plot = plotOf(map, x, y);
  if (!plot) return null;
  const { kind, level } = plot, top = PLOT_TOP[kind];
  const target = level < top ? level + 1 : null;
  const maps = city.blockMaps;
  const code = map.plotWhy ? map.plotWhy[y * map.width + x] : undefined;
  const why: PlotWhy | null = code === undefined ? null : PLOT_WHY[code] ?? null;
  const rows: PlotCheckRow[] = [];
  const add = (check: PlotCheck, ok: boolean, key: string, params?: Record<string, string | number>, hint?: string): void => {
    const row: PlotCheckRow = { check, ok, key, holds: false };
    if (params) row.params = params;
    if (!ok && hint) row.hint = hint;
    rows.push(row);
  };

  // A road within reach, and a way along it to where its trips go (homes to shops, shops to factories, factories to
  // homes): the simulation finds the second only when a trip fails
  if (!nearestRoad(map, x, y)) add("road", false, "plot.check.road_none", { reach: PLOT_REACH }, "plot.hint.road");
  else if (why === "road") add("road", false, `plot.check.route.${kind}`, undefined, `plot.hint.route.${kind}`);
  else add("road", true, "plot.check.road");
  const powered = (map.getTileFlags(x, y) & POWERBIT) !== 0;
  add("power", powered, powered ? "plot.check.power" : "plot.check.power_none", undefined, "plot.hint.power");
  // Without water nothing grows past a house, or a shop's or factory's first size
  if (level >= 1) {
    const watered = !map.water || map.water.zoneWater(x, y) === ZONE_WATERED;
    add("water", watered, watered ? "plot.check.water" : "plot.check.water_none", undefined, "plot.hint.water");
  }
  if (target !== null) {
    const valve = (kind === "residential" ? city.valves?.resValve : kind === "commercial" ? city.valves?.comValve
      : city.valves?.indValve) ?? 0;
    add("demand", valve > 0, `plot.check.${valve > 0 ? "demand" : "demand_none"}.${kind}`, undefined, `plot.hint.demand.${kind}`);
    const services = city.services;
    const landGrade = `object.grade.${gradeAt(maps?.landValueMap, x, y, LAND_GRADES)}`;
    if (kind === "residential") {
      // Schools and hospitals draw families once the city counts them, and their lack holds a town back (a village
      // does not miss them yet: src/services.ts familyPull)
      if (services && services.people >= SERVICES_FROM) {
        const pull = familyPull(services);
        add("services", pull >= 0, pull > 0 ? "plot.check.services" : pull === 0 ? "plot.check.services_enough"
          : "plot.check.services_low", { school: services.basic, health: services.health }, "plot.hint.services");
      }
      // Its place: the land's value less its pollution (health takes some of that away), with the demand for homes
      const land = at(maps?.landValueMap, x, y), pollution = at(maps?.pollutionDensityMap, x, y);
      const place = Math.max(0, land - pollution * (1 - (services ? pollutionShield(services) : 0)));
      const fits = Math.max(0, valve) + Math.min(place * 32, 6000) - 3000 >= HOME_HOLDS;
      const dirty = pollution * 2 > land;
      add("land", fits || dirty, "plot.check.land", { grade: landGrade }, "plot.hint.land");
      add("pollution", pollution <= HOME_POLLUTION && (fits || !dirty), "plot.check.pollution",
        { grade: `object.grade.${gradeAt(maps?.pollutionDensityMap, x, y, DENSITY_GRADES)}` }, "plot.hint.pollution");
      // A taller home wants a busier neighbourhood round it
      if (level >= 1) {
        const ok = at(maps?.populationDensityMap, x, y) > DENSITY_TO_RISE[level];
        add("crowd", ok, ok ? "plot.check.crowd" : "plot.check.crowd_low", undefined, "plot.hint.crowd");
      }
    } else if (kind === "commercial" && level >= 1) {
      // A shop grows only as far as its land is worth
      add("land", level <= at(maps?.landValueMap, x, y) >> 5, "plot.check.land", { grade: landGrade }, "plot.hint.land_shop");
    }
    if (target === top) {
      const ok = lotOf(map, x, y) !== null;
      add("lot", ok, ok ? "plot.check.lot" : "plot.check.lot_none", { level: LOT_LEVEL[kind] }, "plot.hint.lot");
    }
  }

  // What the levels after the next add: water from the second, more people round a home or dearer land under a shop,
  // and a lot for the top
  const later: PlotChecklist["later"] = [];
  if (target !== null) {
    for (let next = target + 1; next <= top; next++) {
      const checks: PlotCheck[] = [];
      if (next === 2) checks.push("water");
      if (kind === "residential") checks.push("crowd");
      if (kind === "commercial") checks.push("land");
      if (next === top) checks.push("lot");
      const last = later[later.length - 1];
      if (last && last.to === next - 1 && last.checks.join() === checks.join()) last.to = next;
      else if (checks.length) later.push({ from: next, to: next, checks });
    }
  }

  // What holds it: what the simulation found, while the card still finds it lacking, else the first it lacks
  const lacking = (check: PlotCheck): boolean => rows.some(row => row.check === check && !row.ok);
  const found = why ? WHY_ROW[why] : undefined;
  const holds = found && lacking(found) ? found : HOLD_ORDER.find(lacking) ?? null;
  for (const row of rows) row.holds = row.check === holds;
  return { kind, level, top, target, rows, later, state: holds ?? (target === null ? "top" : "growing") };
}
