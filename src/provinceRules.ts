/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The rules that make each region and province play differently (ONLINE_PLAN 5.2): how much the people want homes,
// shops and factories, what building costs, how much the factories pollute, how much a power plant gives, the dry
// season (when the water works give less and no rain fills the ground) and disasters that come with the seasons. They are data, not code: data/province-rules.json today, the server's
// database once the game is online, edited from an admin page. Three layers, each only saying what it changes:
// the game's defaults, then the region's, then the province's.
//
// Every number is checked before use, so a bad edit is reported and ignored rather than breaking the game.

export const TOOL_COSTS = ["residential", "commercial", "industrial", "road", "rail", "wire", "park", "police", "fire",
  "coal", "nuclear", "stadium", "port", "airport", "bulldozer", "waterworks", "watertower", "gas", "hydro", "solar",
  "wind"] as const;
export type CostTool = typeof TOOL_COSTS[number];

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
};

// The range each kind of number may take
const MULTIPLIER = { min: 0.1, max: 5 };
const CLEAR_WOODS = { min: 0, max: 100 };
const DROUGHT_SHARE = { min: 0, max: 0.9 };

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
  return effects;
}
