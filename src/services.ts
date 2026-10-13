/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Schools and hospitals (การศึกษาและสาธารณสุข, docs/SERVICES.md; owner, 13 Oct 2026): nine buildings on the civic 3x3
// the ruler's house stands on too (tiles 414–422), told apart by gameMap.civicKinds. The higher kinds need a higher
// ruler's house (src/rulerHouse.ts). With power, each gives places: seats for children (kindergartens, primary and
// secondary schools), seats for the young (vocational colleges, universities), or care for people (hospitals).
// - Gains: from 500 people, schools and hospitals draw families (the homes' demand, src/valves.js); higher education
//   draws factories and shops and makes the factories cleaner; health halves at best what pollution does to homes
//   (src/residential.js).
// - Costs: each one's upkeep a year, two budget lines; the news hears when a town of 2,000 lacks schools or hospitals.
// No DOM, nothing random.

import { POWERBIT } from "./tileFlags";

export const SERVICE_KINDS = ["kindergarten", "primary_school", "secondary_school", "vocational_college", "university",
  "health_centre", "community_hospital", "provincial_hospital", "regional_hospital"] as const;
export type ServiceKind = typeof SERVICE_KINDS[number];

/** basic: seats for children; higher: seats for the young; health: people a hospital cares for */
export type ServiceField = "basic" | "higher" | "health";

export interface ServiceSpec {
  field: ServiceField;
  price: number;
  /** Upkeep a year */
  upkeep: number;
  /** Seats, or people cared for */
  places: number;
  /** The ruler's house's level it needs (0: none) */
  house: number;
}

/** The tool that builds each kind has the kind's name (src/gameTools.js) */
export const SERVICE_SPECS: Readonly<Record<ServiceKind, ServiceSpec>> = {
  kindergarten: { field: "basic", price: 400, upkeep: 30, places: 200, house: 0 },
  primary_school: { field: "basic", price: 800, upkeep: 60, places: 500, house: 0 },
  secondary_school: { field: "basic", price: 1500, upkeep: 120, places: 800, house: 2 },
  vocational_college: { field: "higher", price: 2500, upkeep: 200, places: 600, house: 3 },
  university: { field: "higher", price: 6000, upkeep: 500, places: 1500, house: 4 },
  health_centre: { field: "health", price: 500, upkeep: 40, places: 2000, house: 0 },
  community_hospital: { field: "health", price: 1500, upkeep: 120, places: 8000, house: 2 },
  provincial_hospital: { field: "health", price: 4000, upkeep: 350, places: 30000, house: 3 },
  regional_hospital: { field: "health", price: 8000, upkeep: 700, places: 80000, house: 4 },
};

export const EDUCATION_TOOLS: readonly ServiceKind[] = SERVICE_KINDS.filter((k) => SERVICE_SPECS[k].field !== "health");
export const HEALTH_TOOLS: readonly ServiceKind[] = SERVICE_KINDS.filter((k) => SERVICE_SPECS[k].field === "health");

/** Children of school age, and the young of college age, as shares of the people */
export const CHILDREN_SHARE = 0.2;
export const YOUNG_SHARE = 0.06;
/** People from which the schools and hospitals count, and from which the news hears of too few */
export const SERVICES_FROM = 500;
export const WARN_FROM = 2000;
/** The most the homes' demand moves for schools and for health, either way */
export const FAMILY_PULL = 0.05;
/** Higher education, at its fullest: factories and shops wanted this much more, factory smoke this much less */
export const SKILLED_INDUSTRY = 0.1;
export const SKILLED_SHOPS = 0.05;
export const SKILLED_SMOKE = 0.3;
/** Health, at its fullest: this share of pollution's harm to homes taken away */
export const HEALTH_SHIELD = 0.5;

/** Why a service was refused: it needs a higher ruler's house */
export const NEEDS_HOUSE_LEVEL = "needs a higher ruler's house";

export function isServiceKind(value: unknown): value is ServiceKind {
  return typeof value === "string" && (SERVICE_KINDS as readonly string[]).includes(value);
}

/** Why a tool may not be used for want of the ruler's house's level (houseLevel 0 without a house), or null. */
export function serviceProblem(tool: string, houseLevel: number): string | null {
  return isServiceKind(tool) && SERVICE_SPECS[tool].house > houseLevel ? NEEDS_HOUSE_LEVEL : null;
}

export interface ServiceLevels {
  /** 0–100 each */
  basic: number;
  higher: number;
  health: number;
  people: number;
}

export const NO_SERVICES: ServiceLevels = { basic: 0, higher: 0, health: 0, people: 0 };

/** The city's people, as the game's evaluation counts them (src/evaluation.js). */
export function peopleOf(census: { resPop: number; comPop: number; indPop: number }): number {
  return (census.resPop + (census.comPop + census.indPop) * 8) * 20;
}

const share = (places: number, wanted: number): number =>
  wanted <= 0 ? 100 : Math.round(100 * Math.min(1, places / wanted));

/** The levels a city's places give its people. */
export function serviceLevels(places: Readonly<Record<ServiceField, number>>, people: number): ServiceLevels {
  return {
    basic: share(places.basic, people * CHILDREN_SHARE),
    higher: share(places.higher, people * YOUNG_SHARE),
    health: share(places.health, people),
    people,
  };
}

/**
 * What schools and hospitals do to the homes' demand: ±FAMILY_PULL each. Nothing below SERVICES_FROM people, and a
 * village (below WARN_FROM) only gains from them: lacking them holds a city back from the town on, when the news warns.
 */
export function familyPull(levels: ServiceLevels): number {
  if (levels.people < SERVICES_FROM) return 0;
  const pull = FAMILY_PULL * (levels.basic - 50) / 50 + FAMILY_PULL * (levels.health - 50) / 50;
  return levels.people < WARN_FROM ? Math.max(0, pull) : pull;
}

/** Higher education, 0–1, once the city counts. */
export function skilled(levels: ServiceLevels): number {
  return levels.people < SERVICES_FROM ? 0 : levels.higher / 100;
}

/** The share of pollution's harm to homes health takes away, 0–HEALTH_SHIELD. */
export function pollutionShield(levels: ServiceLevels): number {
  return levels.people < SERVICES_FROM ? 0 : HEALTH_SHIELD * levels.health / 100;
}

interface CivicMap {
  readonly width: number;
  civicKinds?: Record<string, string>;
  getTileFlags(x: number, y: number): number;
}

interface CensusLike {
  educationUpkeep?: number;
  healthUpkeep?: number;
}

/** The schools and hospitals this cycle's scan found, and the places of those with power. */
export class Services {
  places: Record<ServiceField, number> = { basic: 0, higher: 0, health: 0 };
  counts: Partial<Record<ServiceKind, number>> = {};

  clearCycle(): void {
    this.places = { basic: 0, higher: 0, health: 0 };
    this.counts = {};
  }

  /** A civic building's centre: a school or hospital pays its upkeep, and gives its places when it has power. */
  found(map: CivicMap, x: number, y: number, census: CensusLike): boolean {
    const kind = map.civicKinds?.[y * map.width + x];
    if (!isServiceKind(kind)) return false;
    const spec = SERVICE_SPECS[kind];
    if (spec.field === "health") census.healthUpkeep = (census.healthUpkeep ?? 0) + spec.upkeep;
    else census.educationUpkeep = (census.educationUpkeep ?? 0) + spec.upkeep;
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    if ((map.getTileFlags(x, y) & POWERBIT) !== 0) this.places[spec.field] += spec.places;
    return true;
  }
}
