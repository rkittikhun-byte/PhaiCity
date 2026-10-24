/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The rules that make each region and province play differently (ONLINE_PLAN 5.2): how much the people want homes,
// shops and factories, what building costs, how much the factories pollute, how much a power plant gives, the dry
// season (when the water works give less and no rain fills the ground) and disasters that come with the seasons, and
// the weather of each month (src/weather.ts). They are data, not code: data/province-rules.json today, the server's
// database once the game is online, edited from an admin page. Three layers, each only saying what it changes:
// the game's defaults, then the region's, then the province's.
//
// Every number is checked before use, so a bad edit is reported and ignored rather than breaking the game.
// The festivals each region and province keeps are rules too (FESTIVAL_SPECS below, src/festivals.ts): the country's
// own are the defaults. This file imports nothing, so the admin page's server can run its checks in Node as they are.

export const TOOL_COSTS = ["residential", "commercial", "industrial", "road", "rail", "wire", "park", "police", "fire",
  "coal", "nuclear", "stadium", "port", "airport", "bulldozer", "waterworks", "watertower", "gas", "hydro", "solar",
  "wind", "limestone_mine", "potash_mine", "tin_mine", "zinc_mine", "gold_mine", "gem_mine", "rare_earth_mine", "lignite_mine",
  "oil_well", "farm", "fishing", "road_asphalt", "road_concrete2", "road_concrete4", "road_concrete6", "road_concrete8",
  "motorway", "tollway", "road_upgrade", "ruler_house", "ruler_house_upgrade", "kindergarten", "primary_school",
  "secondary_school", "vocational_college", "university", "health_centre", "community_hospital", "provincial_hospital",
  "regional_hospital", "landfill", "incinerator", "recycling_plant", "waste_power_plant", "wastewater_plant", "bus_stop", "train_station", "metro_station", "hsr_station",
  "police_box", "police_large", "police_hq", "fire_post", "fire_centre", "building_upgrade", "canal", "department_store"] as const;
export type CostTool = typeof TOOL_COSTS[number];

/**
 * A region's or province's climate (data/province-rules.json "weather"): twelve numbers a list, January first, and
 * the chance a storm floods.
 */
export interface Climate {
  /** The chance a month is wet (rain or a storm), 0–1 */
  rain: number[];
  /** Of the wet months, the share that are storms, 0–1 */
  storm: number[];
  /** Of the dry months, the share that are foggy, 0–1 */
  fog: number[];
  /** Smoke in the air from burning fields and forests, 0–1 */
  smoke: number[];
  /** The chance a storm month floods low land beside the water, 0–1 (only while disasters are switched on) */
  flood: number;
}

export const CLIMATE_LISTS = ["rain", "storm", "fog", "smoke"] as const;

/** The game's own climate (DEFAULT_RULES), before the region's: Thailand's monsoon on the central plains. A practice
 * map has this. */
export const DEFAULT_CLIMATE: Climate = {
  rain: [0.05, 0.08, 0.18, 0.35, 0.75, 0.82, 0.82, 0.88, 0.92, 0.75, 0.25, 0.05],
  storm: [0, 0, 0.3, 0.35, 0.25, 0.15, 0.15, 0.35, 0.4, 0.25, 0.1, 0],
  fog: [0.25, 0.15, 0.05, 0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.3],
  smoke: [0, 0.05, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0],
  flood: 0.15,
};

export const ZONES = ["residential", "commercial", "industrial"] as const;
export type Zone = typeof ZONES[number];

export const SEASON_DISASTERS = ["fire", "flood", "tornado"] as const;
export type SeasonDisaster = typeof SEASON_DISASTERS[number];

export interface Season {
  disaster: SeasonDisaster;
  /** Months of the year, 1 (January) to 12. */
  months: number[];
  /** The chance, 0–1, that it strikes in each of those months (when random disasters are on). */
  chancePerMonth: number;
}

/** The dry season (src/waterManager.ts): its months, 1–12, and how much less a water works gives in them, 0–0.9. */
export interface Drought {
  months: number[];
  share: number;
}

export interface Rules {
  /** Multiplies how much each kind of zone is wanted. */
  demand: Record<Zone, number>;
  /** Multiplies each tool's price. */
  cost: Record<CostTool, number>;
  /** Baht to clear one tile of woods, when building over it or bulldozing it (the game's own price is 1). */
  clearWoodsCost: number;
  /** Multiplies the smoke from factories. */
  industryPollution: number;
  /** Multiplies the power each power plant gives. */
  powerPlantOutput: number;
  /** No rain fills the ground in these months, and the water works give less. */
  drought: Drought;
  seasons: Season[];
  /** The weather month by month: the chances of rain, storms, fog and smoke, and of a storm's flood (src/weather.ts) */
  weather: Climate;
  /** The festivals kept, by id, with whatever of each festival's numbers the layers change (src/festivals.ts) */
  festivals: Partial<Record<FestivalId, FestivalEntry>>;
  /** The farm zone's numbers (src/farmZone.ts, docs/GAME_DESIGN.md section 7) */
  farmZone: FarmZoneSpec;
}

/** What one layer changes; anything left out comes from the layer below. */
export interface RulesPatch {
  demand?: Partial<Record<Zone, number>>;
  cost?: Partial<Record<CostTool, number>>;
  clearWoodsCost?: number;
  industryPollution?: number;
  powerPlantOutput?: number;
  drought?: Drought;
  seasons?: Season[];
  /** Any of the climate's lists or its flood chance; the rest comes from the layer below */
  weather?: Partial<Climate>;
  /** Festivals added or changed, or taken away (null); the rest come from the layer below */
  festivals?: FestivalsPatch;
  /** Any of the farm zone's numbers, and of each kind of field's; the rest comes from the layer below */
  farmZone?: FarmZonePatch;
}

// --- The farm zone (src/farmZone.ts, docs/GAME_DESIGN.md section 7) -------------------------------------------------

/** The kinds of field the game grows where the farm zone is painted, chosen by the land */
export const FARM_KINDS = ["paddy", "field", "orchard", "pond"] as const;
export type FarmKind = typeof FARM_KINDS[number];

/** What one kind of field is like, a 16 m tile at a time */
export interface FarmKindSpec {
  /** Baht a month a level sells, before the province's farmland, the ground's water and the season */
  sale: number;
  /** Work a level gives, in the census's units of jobs (a factory plot's level gives an eighth): the era score's jobs
   * side counts it, but neither the people nor the demand for homes do (src/census.js farmPop; docs/GAME_DESIGN.md 7.4) */
  jobs: number;
  /** Groundwater a level draws from under it a month (src/groundwater.ts units; more in the dry season) */
  draw: number;
  /** Chemicals a level puts into the poisoned ground a month (src/mining.ts, which cleans 1 a month away) */
  chemicals: number;
  /** Whether its stubble is burned in the burning months, February to April */
  burns: boolean;
  /** Mud a month it puts into the water beside it, as pollution there */
  mud: number;
  /** The ground's water (0–1 of full) it needs to rise past level 2 */
  ground: number;
}

export interface FarmZoneSpec {
  /** Baht to paint a 16 m tile */
  price: number;
  /** Tiles a field may lie from a road, along a way over open land and fields (a cart track, the dikes) */
  reach: number;
  /** The highest level a field reaches in each era, eras 1 to 5 */
  eraTop: number[];
  /** People a level of fields feeds: the town's own food */
  feeds: number;
  /** Levels the market beyond the town takes for each level of the province's farmland (0–5) */
  exportPerLevel: number;
  /** Ponds lie this many tiles from water or nearer; paddies this many, at most paddyRise metres above it, or where the
   * ground holds paddyGround of its water; orchards where it holds orchardGround; fields elsewhere */
  pondReach: number;
  paddyReach: number;
  paddyRise: number;
  paddyGround: number;
  orchardGround: number;
  /** What the dry season leaves of a field's sales, and how much more groundwater it draws then */
  dryYield: number;
  dryDraw: number;
  /** A cooperative, rice mill or cold store (the 3 × 3 farm building) raises the sales of the fields this many tiles round
   * it by hubBonus (0.5: half as much again) */
  hubReach: number;
  hubBonus: number;
  /** Land value added within two tiles of a grown field, and visitors a month a level brings (agro-tourism) */
  landValue: number;
  visitors: number;
  /** Haze of a burning field on the tiles round it */
  haze: number;
  /** Farm-goods factories a level of fields asks for */
  factoriesPerLevel: number;
  kinds: Record<FarmKind, FarmKindSpec>;
  crops: Record<FarmCropId, FarmCropSpec>;
}

/** The eighteen crops grown across the four kinds of field (src/farmCrops.ts, docs/GAME_DESIGN.md section 7.6) */
export const FARM_CROP_IDS = [
  "glutinous_rice", "jasmine_rice",
  "maize", "sugarcane", "cassava", "vegetables", "pineapple",
  "mango", "papaya", "banana", "longan", "durian", "mangosteen", "rubber", "coconut", "oil_palm",
  "fish", "shrimp",
] as const;
export type FarmCropId = typeof FARM_CROP_IDS[number];

/** What one crop is like in the rules: its kind of field, how much the province grows it, and the land it likes best */
export interface FarmCropSpec {
  /** Which of the four kinds of field grows this crop */
  kind: FarmKind;
  /** How much the province grows it, 0–1 (0: not grown there) */
  weight: number;
  /** Height above water in metres [min, max] it likes best, 0–500 */
  rise: readonly [number, number];
  /** Local slope in metres a tile [min, max] it likes best, 0–100 */
  slope: readonly [number, number];
  /** The ground's water [min, max] (0–1 of full) it likes best */
  ground: readonly [number, number];
  /** Distance to water in tiles [min, max] it likes best, 0–128 */
  water: readonly [number, number];
  /** Distance to town in tiles [min, max] it likes best, 0–128 */
  town: readonly [number, number];
}

export type FarmCropsPatch = Partial<Record<FarmCropId, Partial<FarmCropSpec>>>;

export interface FarmZonePatch extends Partial<Omit<FarmZoneSpec, "kinds" | "crops">> {
  kinds?: Partial<Record<FarmKind, Partial<FarmKindSpec>>>;
  crops?: FarmCropsPatch;
}

/** The game's own crops, before the region's and the province's (durian, mangosteen and coastal shrimp start at 0) */
export const FARM_CROPS: Readonly<Record<FarmCropId, FarmCropSpec>> = {
  glutinous_rice: { kind: "paddy", weight: 0.15, rise: [0, 6], slope: [0, 2], ground: [0.4, 0.95], water: [0, 14], town: [0, 64] },
  jasmine_rice: { kind: "paddy", weight: 0.85, rise: [0, 4], slope: [0, 1.5], ground: [0.5, 1], water: [0, 10], town: [0, 64] },
  maize: { kind: "field", weight: 0.5, rise: [5, 120], slope: [1, 20], ground: [0.2, 0.55], water: [3, 48], town: [4, 64] },
  sugarcane: { kind: "field", weight: 0.6, rise: [3, 45], slope: [0, 6], ground: [0.1, 0.4], water: [3, 48], town: [4, 64] },
  cassava: { kind: "field", weight: 0.5, rise: [6, 80], slope: [0, 12], ground: [0, 0.32], water: [5, 64], town: [6, 64] },
  vegetables: { kind: "field", weight: 0.45, rise: [0, 8], slope: [0, 3], ground: [0.35, 1], water: [0, 6], town: [0, 12] },
  pineapple: { kind: "field", weight: 0.2, rise: [4, 60], slope: [1, 12], ground: [0.15, 0.45], water: [2, 40], town: [3, 64] },
  mango: { kind: "orchard", weight: 0.7, rise: [2, 50], slope: [0, 10], ground: [0.2, 0.6], water: [2, 48], town: [1, 48] },
  papaya: { kind: "orchard", weight: 0.5, rise: [2, 30], slope: [0, 6], ground: [0.3, 0.7], water: [1, 20], town: [0, 18] },
  banana: { kind: "orchard", weight: 0.6, rise: [1, 25], slope: [0, 6], ground: [0.4, 0.9], water: [0, 12], town: [0, 24] },
  longan: { kind: "orchard", weight: 0.1, rise: [4, 50], slope: [0, 10], ground: [0.4, 0.85], water: [1, 20], town: [1, 40] },
  durian: { kind: "orchard", weight: 0, rise: [6, 60], slope: [1, 12], ground: [0.45, 0.9], water: [2, 24], town: [2, 48] },
  mangosteen: { kind: "orchard", weight: 0, rise: [5, 50], slope: [0.5, 10], ground: [0.5, 0.95], water: [1, 20], town: [2, 48] },
  rubber: { kind: "orchard", weight: 0.05, rise: [8, 120], slope: [2, 25], ground: [0.3, 0.75], water: [3, 64], town: [4, 64] },
  coconut: { kind: "orchard", weight: 0.45, rise: [0, 10], slope: [0, 4], ground: [0.35, 0.95], water: [0, 8], town: [0, 48] },
  oil_palm: { kind: "orchard", weight: 0.05, rise: [1, 35], slope: [0, 8], ground: [0.45, 0.95], water: [1, 32], town: [3, 64] },
  fish: { kind: "pond", weight: 0.9, rise: [0, 6], slope: [0, 2], ground: [0.3, 1], water: [0, 2], town: [0, 48] },
  shrimp: { kind: "pond", weight: 0, rise: [0, 3], slope: [0, 1.5], ground: [0.4, 1], water: [0, 2], town: [0, 64] },
};

/** The game's own farm zone, before the region's and the province's */
export const FARM_ZONE: FarmZoneSpec = {
  price: 3, reach: 8, eraTop: [2, 3, 4, 5, 5], feeds: 12, exportPerLevel: 25,
  pondReach: 1, paddyReach: 10, paddyRise: 5, paddyGround: 0.55, orchardGround: 0.35,
  dryYield: 0.5, dryDraw: 2, hubReach: 12, hubBonus: 0.5, landValue: 6, visitors: 0.3, haze: 30, factoriesPerLevel: 0.004,
  kinds: {
    paddy: { sale: 0.06, jobs: 0.02, draw: 1, chemicals: 0.5, burns: true, mud: 0, ground: 0.4 },
    field: { sale: 0.05, jobs: 0.015, draw: 1, chemicals: 0.6, burns: true, mud: 0, ground: 0.15 },
    orchard: { sale: 0.08, jobs: 0.018, draw: 1, chemicals: 0.4, burns: false, mud: 0, ground: 0.25 },
    pond: { sale: 0.1, jobs: 0.015, draw: 0, chemicals: 0.2, burns: false, mud: 12, ground: 0 },
  },
  crops: { ...FARM_CROPS },
};

/** The range each farm zone number may take (whole: a whole number) */
const FARM_RANGES: Readonly<Record<string, { min: number; max: number; whole?: boolean }>> = {
  price: { min: 0, max: 1000 }, reach: { min: 1, max: 32, whole: true }, feeds: { min: 1, max: 1000 },
  exportPerLevel: { min: 0, max: 1000 }, pondReach: { min: 0, max: 4, whole: true }, paddyReach: { min: 0, max: 64, whole: true },
  paddyRise: { min: 0, max: 100 }, paddyGround: { min: 0, max: 1 }, orchardGround: { min: 0, max: 1 },
  dryYield: { min: 0, max: 1 }, dryDraw: { min: 0, max: 5 }, hubReach: { min: 0, max: 64, whole: true },
  hubBonus: { min: 0, max: 5 }, landValue: { min: 0, max: 100 }, visitors: { min: 0, max: 100 },
  haze: { min: 0, max: 255, whole: true }, factoriesPerLevel: { min: 0, max: 1 },
};
const FARM_KIND_RANGES: Readonly<Record<string, { min: number; max: number }>> = {
  sale: { min: 0, max: 10 }, jobs: { min: 0, max: 1 }, draw: { min: 0, max: 32 }, chemicals: { min: 0, max: 32 },
  mud: { min: 0, max: 255 }, ground: { min: 0, max: 1 },
};
const FARM_CROP_PAIR_RANGES: Readonly<Record<string, { min: number; max: number }>> = {
  rise: { min: 0, max: 500 }, slope: { min: 0, max: 100 }, ground: { min: 0, max: 1 },
  water: { min: 0, max: 128 }, town: { min: 0, max: 128 },
};

/** A layer's farm zone, checked: what is valid is kept, the rest is reported in problems */
export function checkFarmZonePatch(raw: unknown, where: string, problems: string[]): FarmZonePatch {
  const patch: Record<string, unknown> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push(`${where}: not an object`);
    return patch;
  }
  const inRange = (value: unknown, range: { min: number; max: number; whole?: boolean }): boolean =>
    typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max &&
    (!range.whole || Number.isInteger(value));
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith("_")) continue;
    const at = `${where}.${key}`;
    if (key === "eraTop") {
      if (Array.isArray(value) && value.length === 5 && value.every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) patch.eraTop = [...value];
      else problems.push(`${at}: must list 5 levels, each 1–5`);
    } else if (key === "kinds") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) { problems.push(`${at}: not an object`); continue; }
      const kinds: Record<string, Record<string, unknown>> = {};
      for (const [kind, entry] of Object.entries(value as Record<string, unknown>)) {
        if (kind.startsWith("_")) continue;
        if (!(FARM_KINDS as readonly string[]).includes(kind)) { problems.push(`${at}.${kind}: unknown kind (one of ${FARM_KINDS.join(", ")})`); continue; }
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) { problems.push(`${at}.${kind}: not an object`); continue; }
        const kept: Record<string, unknown> = {};
        for (const [name, number] of Object.entries(entry as Record<string, unknown>)) {
          if (name.startsWith("_")) continue;
          if (name === "burns") {
            if (typeof number === "boolean") kept.burns = number;
            else problems.push(`${at}.${kind}.burns: must be true or false`);
          } else if (FARM_KIND_RANGES[name]) {
            if (inRange(number, FARM_KIND_RANGES[name])) kept[name] = number;
            else problems.push(`${at}.${kind}.${name}: must be ${FARM_KIND_RANGES[name].min}–${FARM_KIND_RANGES[name].max}`);
          } else {
            problems.push(`${at}.${kind}.${name}: unknown`);
          }
        }
        kinds[kind] = kept;
      }
      patch.kinds = kinds;
    } else if (key === "crops") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) { problems.push(`${at}: not an object`); continue; }
      const crops: Record<string, Record<string, unknown>> = {};
      for (const [crop, entry] of Object.entries(value as Record<string, unknown>)) {
        if (crop.startsWith("_")) continue;
        if (!(FARM_CROP_IDS as readonly string[]).includes(crop)) {
          problems.push(`${at}.${crop}: unknown crop (one of ${FARM_CROP_IDS.join(", ")})`);
          continue;
        }
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) { problems.push(`${at}.${crop}: not an object`); continue; }
        const kept: Record<string, unknown> = {};
        const ownKind = FARM_CROPS[crop as FarmCropId].kind;
        for (const [name, field] of Object.entries(entry as Record<string, unknown>)) {
          if (name.startsWith("_")) continue;
          if (name === "kind") {
            if (field === ownKind) kept.kind = field;
            else problems.push(`${at}.${crop}.kind: must be ${ownKind}`);
          } else if (name === "weight") {
            if (inRange(field, { min: 0, max: 1 })) kept.weight = field;
            else problems.push(`${at}.${crop}.weight: must be 0–1`);
          } else if (FARM_CROP_PAIR_RANGES[name]) {
            const r = FARM_CROP_PAIR_RANGES[name];
            if (Array.isArray(field) && field.length === 2 && inRange(field[0], r) && inRange(field[1], r) && field[0] <= field[1]) {
              kept[name] = [field[0], field[1]];
            } else {
              problems.push(`${at}.${crop}.${name}: must be 2 numbers, each ${r.min}–${r.max}`);
            }
          } else {
            problems.push(`${at}.${crop}.${name}: unknown`);
          }
        }
        crops[crop] = kept;
      }
      patch.crops = crops;
    } else if (FARM_RANGES[key]) {
      const range = FARM_RANGES[key];
      if (inRange(value, range)) patch[key] = value;
      else problems.push(`${at}: must be ${range.whole ? "a whole number " : ""}${range.min}–${range.max}`);
    } else {
      problems.push(`${at}: unknown`);
    }
  }
  return patch as FarmZonePatch;
}

/** A layer's farm zone over the one below: the numbers it gives, each kind's numbers, and each crop's numbers */
export function applyFarmZone(below: FarmZoneSpec, patch: FarmZonePatch | undefined): FarmZoneSpec {
  if (!patch) return below;
  const kinds = { ...below.kinds };
  for (const kind of FARM_KINDS) if (patch.kinds?.[kind]) kinds[kind] = { ...kinds[kind], ...patch.kinds[kind] };
  const crops = { ...below.crops };
  for (const id of FARM_CROP_IDS) if (patch.crops?.[id]) crops[id] = { ...crops[id], ...patch.crops[id] };
  return { ...below, ...patch, kinds, crops };
}

export interface RulesData {
  version: 1;
  regions: Record<string, RulesPatch>;
  provinces: Record<string, RulesPatch>;
}

export const DEFAULT_RULES: Rules = {
  demand: { residential: 1, commercial: 1, industrial: 1 },
  cost: Object.fromEntries(TOOL_COSTS.map((tool) => [tool, 1])) as Record<CostTool, number>,
  clearWoodsCost: 1,
  industryPollution: 1,
  powerPlantOutput: 1,
  drought: { months: [], share: 0 },
  seasons: [],
  weather: DEFAULT_CLIMATE,
  // The country's own festivals, kept in every province
  festivals: { new_year: {}, songkran: {}, loy_krathong: {} },
  farmZone: FARM_ZONE,
};

// The range each kind of number may take
const MULTIPLIER = { min: 0.1, max: 5 };
const CLEAR_WOODS = { min: 0, max: 100 };
const DROUGHT_SHARE = { min: 0, max: 0.9 };
const SHARE = { min: 0, max: 1 };

const REGION_IDS = ["north", "northeast", "central", "east", "west", "south"];
const PROVINCE_ID = /^TH-\d{2}$/;

function isNumberIn(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max;
}

/** One layer, checked: what is valid is kept, the rest is reported in problems (prefixed with where it was). */
export function checkPatch(raw: unknown, where: string, problems: string[]): RulesPatch {
  const patch: RulesPatch = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push(`${where}: not an object`);
    return patch;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    switch (key) {
      case "demand":
      case "cost": {
        const names: readonly string[] = key === "demand" ? ZONES : TOOL_COSTS;
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          problems.push(`${where}.${key}: not an object`);
          break;
        }
        const kept: Record<string, number> = {};
        for (const [name, factor] of Object.entries(value as Record<string, unknown>)) {
          if (!names.includes(name)) problems.push(`${where}.${key}.${name}: unknown`);
          else if (!isNumberIn(factor, MULTIPLIER)) problems.push(`${where}.${key}.${name}: must be ${MULTIPLIER.min}–${MULTIPLIER.max}`);
          else kept[name] = factor;
        }
        if (key === "demand") patch.demand = kept;
        else patch.cost = kept;
        break;
      }
      case "clearWoodsCost":
        if (isNumberIn(value, CLEAR_WOODS) && Number.isInteger(value)) patch.clearWoodsCost = value;
        else problems.push(`${where}.clearWoodsCost: must be a whole number ${CLEAR_WOODS.min}–${CLEAR_WOODS.max}`);
        break;
      case "industryPollution":
      case "powerPlantOutput":
        if (isNumberIn(value, MULTIPLIER)) patch[key] = value;
        else problems.push(`${where}.${key}: must be ${MULTIPLIER.min}–${MULTIPLIER.max}`);
        break;
      case "drought": {
        const d = value as Partial<Drought> | null;
        if (typeof d !== "object" || d === null || Array.isArray(d)) {
          problems.push(`${where}.drought: not an object`);
          break;
        }
        const months = Array.isArray(d.months) ? d.months : null;
        if (!months || !months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) {
          problems.push(`${where}.drought.months: must list months 1–12`);
          break;
        }
        if (!isNumberIn(d.share, DROUGHT_SHARE)) {
          problems.push(`${where}.drought.share: must be ${DROUGHT_SHARE.min}–${DROUGHT_SHARE.max}`);
          break;
        }
        patch.drought = { months: [...new Set(months)].sort((a, b) => a - b), share: d.share };
        break;
      }
      case "weather": {
        const w = value as Record<string, unknown> | null;
        if (typeof w !== "object" || w === null || Array.isArray(w)) {
          problems.push(`${where}.weather: not an object`);
          break;
        }
        const climate: Partial<Climate> = {};
        for (const [name, entry] of Object.entries(w)) {
          if ((CLIMATE_LISTS as readonly string[]).includes(name)) {
            if (Array.isArray(entry) && entry.length === 12 && entry.every((v) => isNumberIn(v, SHARE))) {
              climate[name as typeof CLIMATE_LISTS[number]] = [...entry];
            } else {
              problems.push(`${where}.weather.${name}: must list 12 months, each 0–1`);
            }
          } else if (name === "flood") {
            if (isNumberIn(entry, SHARE)) climate.flood = entry;
            else problems.push(`${where}.weather.flood: must be 0–1`);
          } else if (!name.startsWith("_")) {
            problems.push(`${where}.weather.${name}: unknown`);
          }
        }
        patch.weather = climate;
        break;
      }
      case "festivals":
        patch.festivals = checkFestivalsPatch(value, `${where}.festivals`, problems);
        break;
      case "farmZone":
        patch.farmZone = checkFarmZonePatch(value, `${where}.farmZone`, problems);
        break;
      case "seasons":
        if (!Array.isArray(value)) {
          problems.push(`${where}.seasons: not a list`);
          break;
        }
        patch.seasons = value.flatMap((season: unknown, i): Season[] => {
          const s = season as Partial<Season> | null;
          const at = `${where}.seasons[${i}]`;
          if (typeof s !== "object" || s === null) {
            problems.push(`${at}: not an object`);
            return [];
          }
          if (!SEASON_DISASTERS.includes(s.disaster as SeasonDisaster)) {
            problems.push(`${at}.disaster: must be one of ${SEASON_DISASTERS.join(", ")}`);
            return [];
          }
          const months = Array.isArray(s.months) ? s.months : [];
          if (months.length === 0 || !months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) {
            problems.push(`${at}.months: must list months 1–12`);
            return [];
          }
          if (!isNumberIn(s.chancePerMonth, { min: 0, max: 1 })) {
            problems.push(`${at}.chancePerMonth: must be 0–1`);
            return [];
          }
          return [{ disaster: s.disaster as SeasonDisaster, months: [...new Set(months)].sort((a, b) => a - b),
            chancePerMonth: s.chancePerMonth }];
        });
        break;
      default:
        if (!key.startsWith("_")) problems.push(`${where}.${key}: unknown`); // "_note" and the like are comments
    }
  }
  return patch;
}

/** The whole rules file, checked. Unknown regions and provinces are reported and dropped. */
export function checkRulesData(raw: unknown): { data: RulesData; problems: string[] } {
  const problems: string[] = [];
  const data: RulesData = { version: 1, regions: {}, provinces: {} };
  if (typeof raw !== "object" || raw === null) {
    problems.push("rules: not an object");
    return { data, problems };
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) problems.push("rules.version: must be 1");
  for (const [layer, valid] of [["regions", (id: string) => REGION_IDS.includes(id)],
    ["provinces", (id: string) => PROVINCE_ID.test(id)]] as const) {
    const entries = r[layer];
    if (entries === undefined) continue;
    if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
      problems.push(`rules.${layer}: not an object`);
      continue;
    }
    for (const [id, patch] of Object.entries(entries as Record<string, unknown>)) {
      if (id.startsWith("_")) continue;
      if (!valid(id)) problems.push(`rules.${layer}.${id}: unknown ${layer === "regions" ? "region" : "province"}`);
      else data[layer][id] = checkPatch(patch, `${layer}.${id}`, problems);
    }
  }
  return { data, problems };
}

function apply(rules: Rules, patch: RulesPatch | undefined): Rules {
  if (!patch) return rules;
  return {
    demand: { ...rules.demand, ...patch.demand },
    cost: { ...rules.cost, ...patch.cost },
    clearWoodsCost: patch.clearWoodsCost ?? rules.clearWoodsCost,
    industryPollution: patch.industryPollution ?? rules.industryPollution,
    powerPlantOutput: patch.powerPlantOutput ?? rules.powerPlantOutput,
    drought: patch.drought ?? rules.drought,
    // A province that lists seasons replaces its region's list
    seasons: patch.seasons ?? rules.seasons,
    // ... but its weather only the lists it gives
    weather: { ...rules.weather, ...patch.weather },
    // ... and its festivals only those it names
    festivals: applyFestivals(rules.festivals, patch.festivals),
    // ... and its farm zone only the numbers it gives
    farmZone: applyFarmZone(rules.farmZone ?? FARM_ZONE, patch.farmZone),
  };
}

/** The rules for one city: the defaults, then its region's, then its province's. A practice map has neither. */
export function resolveRules(data: RulesData | null, regionId: string | null, provinceId: string | null): Rules {
  let rules = DEFAULT_RULES;
  if (data && regionId) rules = apply(rules, data.regions[regionId]);
  if (data && provinceId) rules = apply(rules, data.provinces[provinceId]);
  return rules;
}

/** Where each of a province's rules comes from, for the admin page: its own, its region's, or the game's. */
export function ruleSource(data: RulesData, regionId: string, provinceId: string,
    pick: (patch: RulesPatch) => unknown): "province" | "region" | "default" {
  if (pick(data.provinces[provinceId] ?? {}) !== undefined) return "province";
  if (pick(data.regions[regionId] ?? {}) !== undefined) return "region";
  return "default";
}

// The simulation decides disasters once per cycle, four cycles a month (src/simulation.js)
const CYCLES_PER_MONTH = 4;

/** The chance per simulation cycle that gives chancePerMonth over a month. */
export function chancePerCycle(chancePerMonth: number): number {
  if (chancePerMonth <= 0) return 0;
  if (chancePerMonth >= 1) return 1;
  return 1 - Math.pow(1 - chancePerMonth, 1 / CYCLES_PER_MONTH);
}

/** The disasters a season brings this month (0–11, as the game counts them), with their chance per cycle. */
export function seasonalRisks(rules: Rules, month: number): Array<{ disaster: SeasonDisaster; chance: number }> {
  return rules.seasons.filter((season) => season.months.includes(month + 1))
    .map((season) => ({ disaster: season.disaster, chance: chancePerCycle(season.chancePerMonth) }));
}

/** The game's own price of each tool (src/gameTools.js): a zone or building, or one tile of a line or of bulldozing. */
export const BASE_PRICES: Record<CostTool, number> = {
  residential: 100, commercial: 100, industrial: 100, road: 10, rail: 20, wire: 5, park: 10, police: 500, fire: 500,
  coal: 3000, nuclear: 5000, stadium: 5000, port: 3000, airport: 10000, bulldozer: 1, waterworks: 1500, watertower: 300,
  gas: 4000, hydro: 6000, solar: 2500, wind: 3500,
  limestone_mine: 1500, potash_mine: 2500, tin_mine: 2000, zinc_mine: 2500, gold_mine: 3000, gem_mine: 1500,
  rare_earth_mine: 4000, lignite_mine: 2500, oil_well: 3500, farm: 300, fishing: 1200,
  road_asphalt: 20, road_concrete2: 30, road_concrete4: 50, road_concrete6: 80, road_concrete8: 120, motorway: 200,
  tollway: 250, road_upgrade: 10, ruler_house: 500, ruler_house_upgrade: 1000,
  kindergarten: 400, primary_school: 800, secondary_school: 1500, vocational_college: 2500, university: 6000,
  health_centre: 500, community_hospital: 1500, provincial_hospital: 4000, regional_hospital: 8000,
  landfill: 300, incinerator: 2000, recycling_plant: 3000, waste_power_plant: 6000, wastewater_plant: 4000,
  bus_stop: 300, train_station: 2500, metro_station: 6000, hsr_station: 20000,
  police_box: 250, police_large: 1200, police_hq: 2500, fire_post: 250, fire_centre: 1500, building_upgrade: 250,
  canal: 40,
  // (STORE_RULES.price, src/departmentStores.ts: this file imports nothing)
  department_store: 4000,
};

/** A tool's price under these rules, as its button shows it: whole baht, never below 1. */
export function toolPrice(rules: Rules, tool: CostTool): number {
  return Math.max(1, Math.round(BASE_PRICES[tool] * rules.cost[tool]));
}

export function toolPrices(rules: Rules): Record<CostTool, number> {
  return Object.fromEntries(TOOL_COSTS.map((tool) => [tool, toolPrice(rules, tool)])) as Record<CostTool, number>;
}

/** A price as short as a tool button needs: ฿100, ฿3K, ฿2.1K. */
export function formatPrice(price: number): string {
  if (price < 1000) return `฿${price}`;
  return `฿${Number((price / 1000).toFixed(1))}K`;
}

export interface Effect {
  /** A string key (src/i18n), with its params. */
  key: string;
  params: Record<string, string>;
  /** Good for the player, or a hardship. */
  good: boolean;
}

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function percent(factor: number): string {
  const change = Math.round((factor - 1) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

/**
 * Months in words: a run reads as "Sep–Nov", even one that goes round the new year ("Dec–Apr"); anything else is
 * listed. monthName turns a month key ("sep") into words.
 */
export function monthsText(months: readonly number[], monthName: (key: string) => string): string {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const follows = (m: number, previous: number): boolean => m === (previous % 12) + 1;
  // Start after the first gap, so a run round the new year stays in one piece
  let start = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (!follows(sorted[i], sorted[(i - 1 + sorted.length) % sorted.length])) {
      start = i;
      break;
    }
  }
  const ordered = [...sorted.slice(start), ...sorted.slice(0, start)];
  const names = ordered.map((m) => monthName(MONTH_KEYS[m - 1]));
  const run = ordered.every((m, i) => i === 0 || follows(m, ordered[i - 1]));
  return names.length > 2 && run ? `${names[0]}–${names[names.length - 1]}` : names.join(", ");
}

/**
 * What these rules change, in words for the province card: one entry per number that differs from the game's own.
 * monthName turns a month key ("sep") into words in the current language.
 */
export function ruleEffects(rules: Rules, monthName: (key: string) => string): Effect[] {
  const effects: Effect[] = [];
  for (const zone of ZONES) {
    const factor = rules.demand[zone];
    if (factor !== 1) effects.push({ key: `rules.demand.${zone}`, params: { change: percent(factor) }, good: factor > 1 });
  }
  for (const tool of TOOL_COSTS) {
    const factor = rules.cost[tool];
    if (factor !== 1) effects.push({ key: `rules.cost.${tool}`, params: { change: percent(factor) }, good: factor < 1 });
  }
  if (rules.clearWoodsCost !== DEFAULT_RULES.clearWoodsCost) {
    effects.push({ key: "rules.clear_woods", params: { price: String(rules.clearWoodsCost) },
      good: rules.clearWoodsCost < DEFAULT_RULES.clearWoodsCost });
  }
  if (rules.industryPollution !== 1) {
    effects.push({ key: "rules.industry_pollution", params: { change: percent(rules.industryPollution) },
      good: rules.industryPollution < 1 });
  }
  if (rules.powerPlantOutput !== 1) {
    effects.push({ key: "rules.power_output", params: { change: percent(rules.powerPlantOutput) },
      good: rules.powerPlantOutput > 1 });
  }
  if (rules.drought.months.length > 0) {
    effects.push({ key: "rules.drought", params: { months: monthsText(rules.drought.months, monthName),
      change: `-${Math.round(rules.drought.share * 100)}%` }, good: false });
  }
  for (const season of rules.seasons) {
    if (season.chancePerMonth <= 0) continue;
    effects.push({ key: `rules.season.${season.disaster}`,
      params: { months: monthsText(season.months, monthName), chance: `${Math.round(season.chancePerMonth * 100)}%` },
      good: false });
  }
  // The festivals of the region and province, beyond the country's own
  for (const festival of festivalCalendar(rules.festivals)) {
    if (festival.id in DEFAULT_RULES.festivals) continue;
    effects.push({ key: `rules.festival.${festival.id}`, params: { months: monthsText([festival.month], monthName) }, good: true });
  }
  return effects;
}

// --- Festivals (src/festivals.ts, docs/GAME_DESIGN.md section 5) ---------------------------------------------------

export const FESTIVAL_IDS = ["new_year", "songkran", "loy_krathong", "yi_peng", "bun_bang_fai", "silk", "vegetarian"] as const;
export type FestivalId = typeof FESTIVAL_IDS[number];

/** What a festival is like. Pairs are [held modestly, held grandly]; cheer has "not held" first. */
export interface FestivalSpec {
  /** The month it falls in, 1 (January) to 12, as the rules file counts months */
  month: number;
  /** Whether the ruler chooses how it is held; New Year's holidays come whatever the ruler does */
  choice: boolean;
  /** How much more the province's tourism draws, held modestly (src/tourism.ts) */
  draw: number;
  /** People coming home for it, a month, to a well-known city */
  homecoming: number;
  /** The share of the water supply it uses up, held modestly (Songkran's water fights) */
  waterUse: number;
  /** Baht to hold it, for a town of src/festivals.ts COST_PEOPLE people (a bigger town's costs more) */
  cost: readonly [number, number];
  /** The people's approval, in points of a hundred: not held, held modestly, held grandly */
  cheer: readonly [number, number, number];
  /** Land value added round the venue */
  land: readonly [number, number];
  /** The chance of a fire near the venue (only while disasters are on): lanterns, rockets, firecrackers */
  fire: readonly [number, number];
  /** Rubbish it leaves, tonnes for every thousand people (src/waste.ts) */
  rubbish: readonly [number, number];
  /** How much it dirties the rivers and canals, 0–1: krathong left in the water (src/waste.ts sewage) */
  dirt: readonly [number, number];
  /** How likely it is to be the town's festival of the season when one is due, 0–1 (src/festivals.ts festivalEvents):
   * the big ones (Songkran, Loy Krathong, a region's own) most; New Year, which the ruler does not hold, never */
  event: number;
}

/** The game's own numbers for each festival, as BASE_PRICES is each tool's. The months are the usual ones; whether a
 * province keeps a festival is in its rules (DEFAULT_RULES.festivals and data/province-rules.json). */
export const FESTIVAL_SPECS: Readonly<Record<FestivalId, FestivalSpec>> = {
  // The country travels home and to the sea; the ruler holds nothing
  new_year: { month: 1, choice: false, draw: 1.5, homecoming: 200, waterUse: 0, cost: [0, 0], cheer: [0, 0, 0],
    land: [0, 0], fire: [0, 0], rubbish: [0, 0], dirt: [0, 0], event: 0 },
  // 13–15 April: people come home, water fights in the middle of the dry season
  songkran: { month: 4, choice: true, draw: 1.6, homecoming: 300, waterUse: 0.15, cost: [200, 1200], cheer: [-5, 3, 8],
    land: [4, 12], fire: [0, 0], rubbish: [5, 12], dirt: [0, 0], event: 1 },
  // The full moon of November: krathong on the water, fireworks
  loy_krathong: { month: 11, choice: true, draw: 1.4, homecoming: 100, waterUse: 0, cost: [150, 1000], cheer: [-4, 3, 7],
    land: [3, 10], fire: [0.02, 0.06], rubbish: [6, 15], dirt: [0.1, 0.25], event: 1 },
  // The North's sky lanterns, with Loy Krathong
  yi_peng: { month: 11, choice: true, draw: 1.5, homecoming: 0, waterUse: 0, cost: [200, 1500], cheer: [-3, 3, 8],
    land: [3, 12], fire: [0.1, 0.3], rubbish: [3, 8], dirt: [0, 0], event: 0.9 },
  // The Northeast's rocket festival, asking the sky for the rains, in May
  bun_bang_fai: { month: 5, choice: true, draw: 1.3, homecoming: 150, waterUse: 0, cost: [150, 1000], cheer: [-4, 3, 8],
    land: [2, 8], fire: [0.08, 0.25], rubbish: [3, 8], dirt: [0, 0], event: 0.9 },
  // Khon Kaen's silk festival and Phuk Siao, late November into December, counted in December
  silk: { month: 12, choice: true, draw: 1.3, homecoming: 100, waterUse: 0, cost: [250, 1500], cheer: [-2, 2, 6],
    land: [5, 15], fire: [0, 0], rubbish: [3, 8], dirt: [0, 0], event: 0.6 },
  // The South's vegetarian festival, the ninth lunar month, about October: processions and firecrackers
  vegetarian: { month: 10, choice: true, draw: 1.4, homecoming: 50, waterUse: 0, cost: [150, 1000], cheer: [-3, 3, 7],
    land: [2, 8], fire: [0.03, 0.08], rubbish: [2, 6], dirt: [0, 0], event: 0.9 },
};

/** How often a town makes an event of a festival (owner, 21 Oct 2026: "ทุกอย่างมันเร็วไป ทั้งฝนตก เทศกาล เอาในแต่ละยุค มี 2-3
 * ครั้งกำลังดี"): about this many in an era of eraMonths months (normal mode, about three years); after one, the next may
 * come no sooner than the gap less `spread` of it, and no later than the gap plus it, at the first festival then due whose
 * `event` the city's dice allow (src/festivals.ts festivalEvents) */
export const FESTIVAL_EVENTS = { perEra: 2.5, eraMonths: 36, spread: 0.3 } as const;

/** What the rules keep of a festival: anything of its spec they change (an empty entry keeps the game's own) */
export type FestivalEntry = Partial<FestivalSpec>;
/** A layer of the rules' festivals: an entry adds or changes one, null takes it away */
export type FestivalsPatch = Partial<Record<FestivalId, FestivalEntry | null>>;
/** A festival a province keeps, with its numbers as its rules make them */
export interface Festival extends FestivalSpec { id: FestivalId }

export const isFestivalId = (value: unknown): value is FestivalId =>
  typeof value === "string" && (FESTIVAL_IDS as readonly string[]).includes(value);

/** The festivals a province keeps (Rules.festivals), in the order of the year */
export function festivalCalendar(festivals: Readonly<Partial<Record<string, FestivalEntry>>> | null | undefined): Festival[] {
  const out: Festival[] = [];
  for (const id of FESTIVAL_IDS) {
    const entry = festivals?.[id];
    if (entry) out.push({ ...FESTIVAL_SPECS[id], ...entry, id });
  }
  return out.sort((a, b) => a.month - b.month);
}

/** The range each number of a festival's entry may take; pairs and the triple are checked number by number */
const FESTIVAL_RANGES: Readonly<Record<string, { min: number; max: number; size: number }>> = {
  draw: { min: 1, max: 5, size: 1 }, homecoming: { min: 0, max: 5000, size: 1 }, waterUse: { min: 0, max: 0.5, size: 1 },
  cost: { min: 0, max: 100000, size: 2 }, cheer: { min: -30, max: 30, size: 3 }, land: { min: 0, max: 100, size: 2 },
  fire: { min: 0, max: 1, size: 2 }, rubbish: { min: 0, max: 100, size: 2 }, dirt: { min: 0, max: 1, size: 2 },
  event: { min: 0, max: 1, size: 1 },
};

/** A layer's festivals, checked: what is valid is kept, the rest is reported in problems */
export function checkFestivalsPatch(raw: unknown, where: string, problems: string[]): FestivalsPatch {
  const patch: FestivalsPatch = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push(`${where}: not an object`);
    return patch;
  }
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (id.startsWith("_")) continue;
    if (!isFestivalId(id)) {
      problems.push(`${where}.${id}: unknown festival (one of ${FESTIVAL_IDS.join(", ")})`);
      continue;
    }
    if (value === null || value === false) {
      patch[id] = null;
      continue;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      problems.push(`${where}.${id}: not an object`);
      continue;
    }
    const entry: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
      const at = `${where}.${id}.${key}`;
      if (key.startsWith("_")) continue;
      const range = FESTIVAL_RANGES[key];
      if (key === "month") {
        if (Number.isInteger(field) && (field as number) >= 1 && (field as number) <= 12) entry.month = field;
        else problems.push(`${at}: must be a month 1–12`);
      } else if (key === "choice") {
        if (typeof field === "boolean") entry.choice = field;
        else problems.push(`${at}: must be true or false`);
      } else if (range) {
        const numbers = range.size === 1 ? [field] : Array.isArray(field) && field.length === range.size ? field : null;
        if (numbers && numbers.every((n) => typeof n === "number" && Number.isFinite(n) && n >= range.min && n <= range.max)) {
          entry[key] = range.size === 1 ? field : [...numbers];
        } else {
          problems.push(`${at}: must be ${range.size === 1 ? "" : `${range.size} numbers, each `}${range.min}–${range.max}`);
        }
      } else {
        problems.push(`${at}: unknown`);
      }
    }
    patch[id] = entry as FestivalEntry;
  }
  return patch;
}

/** A layer's festivals over the ones below: an entry changes or adds one, null takes it away */
export function applyFestivals(below: Readonly<Partial<Record<FestivalId, FestivalEntry>>>,
                               patch: FestivalsPatch | undefined): Partial<Record<FestivalId, FestivalEntry>> {
  const out: Partial<Record<FestivalId, FestivalEntry>> = { ...below };
  if (!patch) return out;
  for (const id of FESTIVAL_IDS) {
    if (!(id in patch)) continue;
    const entry = patch[id];
    if (entry === null || entry === undefined) delete out[id];
    else out[id] = { ...out[id], ...entry };
  }
  return out;
}
