/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A province's resources (ทรัพยากร, docs/PROVINCE_PROFILE.md): tourism, water, forest, farmland, fishing, energy,
// oil and gas, and minerals, each at a level from 0 (none) to 5 (among the richest). Every resource brings something
// and costs something (owner, 13 Oct 2026): the province card and the admin page say both.
//
// A level comes from, in order:
// 1. the owner's own value (data/province-profiles.json "levels", set on the admin page);
// 2. the game's inference (its "inferred"): for what the open map data does not show, such as minerals, oil and gas,
//    and rare earths, which are made up for the game and say so;
// 3. the measurements (data/geo/province-indicators.json, from OpenStreetMap and the province maps): the provinces
//    with any of it are ranked, and each fifth of them takes a level from 1 to 5.
//
// No imports and no DOM, so the dev server's admin endpoint (webpack.config.js) can check saves with it in Node.

export const RESOURCE_IDS = ["tourism", "water", "forest", "farmland", "fishery", "solar", "hydro", "wind", "lignite",
  "petroleum", "limestone", "potash", "tin", "zinc", "gold", "gems", "rareEarth"] as const;
export type ResourceId = typeof RESOURCE_IDS[number];

export const MAX_LEVEL = 5;

/** Resources that are the game's own invention, not geology: the card always says so */
export const MADE_UP: readonly ResourceId[] = ["rareEarth"];

/** What scripts/geo/indicators.mjs measured for one province (counts of mapped places, shares of its area). */
export interface Indicators {
  areaKm2?: number;
  coastKm?: number;
  tourism?: number;
  beaches?: number;
  islands?: number;
  protectedShare?: number;
  farmShare?: number;
  orchardShare?: number;
  industryShare?: number;
  urbanShare?: number;
  aquacultureShare?: number;
  saltPonds?: number;
  quarries?: number;
  oilSites?: number;
  solarPlants?: number;
  hydroPlants?: number;
  gasPlants?: number;
  coalPlants?: number;
  biomassPlants?: number;
  borderCrossings?: number;
  reservoirs?: number;
  /** From the province's game map (data/maps): shares of its own tiles, and its heights in metres */
  water?: number;
  woods?: number;
  land?: number;
  heightMin?: number;
  heightMax?: number;
}

/** How each measured resource is scored from the measurements; a resource left out is set by inference or by hand. */
const MEASURES: Partial<Record<ResourceId, (i: Indicators) => number>> = {
  // Places to stay and to see, and beaches (OpenStreetMap's islands count river islets too, so they are left out)
  tourism: (i) => (i.tourism ?? 0) + 3 * (i.beaches ?? 0),
  water: (i) => i.water ?? 0,
  forest: (i) => i.woods ?? 0,
  // Open land that is not town: Thailand's open country is mostly fields (OpenStreetMap maps too little farmland
  // to count it, but its towns well)
  farmland: (i) => Math.max(0, (i.land ?? 0) - 3 * (i.urbanShare ?? 0)),
  fishery: (i) => (i.coastKm ?? 0) + 2000 * (i.aquacultureShare ?? 0),
  solar: (i) => i.solarPlants ?? 0,
  // Dams and big reservoirs, and the fall of the land that feeds them
  hydro: (i) => ((i.hydroPlants ?? 0) * 3 + (i.reservoirs ?? 0)) * (1 + Math.max(0, (i.heightMax ?? 0) - (i.heightMin ?? 0)) / 1000),
  // Most of Thailand's quarries are limestone
  limestone: (i) => i.quarries ?? 0,
};

export function isMeasured(id: ResourceId): boolean {
  return MEASURES[id] !== undefined;
}

export type Levels = Partial<Record<ResourceId, number>>;

/** Each province's measured levels: the provinces with any of a resource ranked, each fifth taking a level 1–5. */
export function measuredLevels(indicators: Record<string, Indicators>): Record<string, Levels> {
  const levels: Record<string, Levels> = Object.fromEntries(Object.keys(indicators).map((id) => [id, {}]));
  for (const resource of RESOURCE_IDS) {
    const score = MEASURES[resource];
    if (!score) continue;
    const scored = Object.entries(indicators).map(([id, i]) => ({ id, value: score(i) }));
    const positive = scored.filter((s) => s.value > 0).sort((a, b) => a.value - b.value);
    for (const { id, value } of scored) {
      if (!(value > 0)) {
        levels[id][resource] = 0;
        continue;
      }
      // Equal values share the level of the first of them
      const rank = positive.findIndex((s) => s.value === value);
      levels[id][resource] = 1 + Math.floor(rank / positive.length * MAX_LEVEL);
    }
  }
  return levels;
}

/** One province's entry in data/province-profiles.json */
export interface ProfileEntry {
  /** The owner's own levels, set on the admin page; they win over everything */
  levels?: Levels;
  /** The game's inference where the open data says nothing */
  inferred?: Levels;
  /** The owner's note on the province */
  note?: string;
}

export interface ProfilesData {
  version: 1;
  provinces: Record<string, ProfileEntry>;
}

export type LevelSource = "owner" | "inferred" | "measured" | "none";

export interface ResourceLevel {
  id: ResourceId;
  level: number;
  source: LevelSource;
}

/** A province's resources, every one of them, with where each level comes from. */
export function provinceLevels(measured: Levels | undefined, entry: ProfileEntry | undefined): ResourceLevel[] {
  return RESOURCE_IDS.map((id): ResourceLevel => {
    const owner = entry?.levels?.[id];
    if (owner !== undefined) return { id, level: owner, source: "owner" };
    const inferred = entry?.inferred?.[id];
    if (inferred !== undefined) return { id, level: inferred, source: "inferred" };
    const value = measured?.[id];
    if (value !== undefined) return { id, level: value, source: "measured" };
    return { id, level: 0, source: "none" };
  });
}

const PROVINCE_ID = /^TH-\d{2}$/;
const NOTE_MAX = 2000;

function checkLevels(raw: unknown, where: string, problems: string[]): Levels | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push(`${where}: not an object`);
    return undefined;
  }
  const kept: Levels = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(RESOURCE_IDS as readonly string[]).includes(key)) problems.push(`${where}.${key}: unknown resource`);
    else if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_LEVEL) {
      problems.push(`${where}.${key}: must be a whole number 0–${MAX_LEVEL}`);
    } else kept[key as ResourceId] = value as number;
  }
  return kept;
}

/** The profiles file, checked: what is valid is kept, the rest reported. Keys starting with "_" are comments. */
export function checkProfilesData(raw: unknown): { data: ProfilesData; problems: string[] } {
  const problems: string[] = [];
  const data: ProfilesData = { version: 1, provinces: {} };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push("profiles: not an object");
    return { data, problems };
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) problems.push("profiles.version: must be 1");
  const provinces = r.provinces;
  if (provinces === undefined) return { data, problems };
  if (typeof provinces !== "object" || provinces === null || Array.isArray(provinces)) {
    problems.push("profiles.provinces: not an object");
    return { data, problems };
  }
  for (const [id, value] of Object.entries(provinces as Record<string, unknown>)) {
    if (id.startsWith("_")) continue;
    const where = `provinces.${id}`;
    if (!PROVINCE_ID.test(id)) {
      problems.push(`${where}: unknown province`);
      continue;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    const v = value as Record<string, unknown>;
    const entry: ProfileEntry = {};
    for (const key of Object.keys(v)) {
      if (!["levels", "inferred", "note"].includes(key) && !key.startsWith("_")) problems.push(`${where}.${key}: unknown`);
    }
    const levels = checkLevels(v.levels, `${where}.levels`, problems);
    if (levels) entry.levels = levels;
    const inferred = checkLevels(v.inferred, `${where}.inferred`, problems);
    if (inferred) entry.inferred = inferred;
    if (v.note !== undefined) {
      if (typeof v.note !== "string" || v.note.length > NOTE_MAX) problems.push(`${where}.note: must be text up to ${NOTE_MAX} characters`);
      else entry.note = v.note;
    }
    data.provinces[id] = entry;
  }
  return { data, problems };
}
