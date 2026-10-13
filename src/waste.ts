/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rubbish and wastewater (ขยะและน้ำเสีย, docs/WASTE.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 3). Five kinds of
// building, all the same 3 × 3 (tiles 992–1000, centre 996), told apart by the map's record of what was built where
// (gameMap.wasteKinds, saved as wasteKinds). Each month the city makes rubbish, by its people and its visitors, and the
// working buildings take it, the cleanest first:
// - a recycling plant sorts a little and sells it, and gives work; it is dear to build;
// - a waste power plant burns it into electricity (the more rubbish it gets, the more power), with some smoke;
// - an incinerator burns it, never fills, and smokes;
// - a landfill takes the most and costs the least, but smells, seeps poison into the ground (the mines' layer,
//   src/mining.ts, which spoils water works' water) and fills up for good.
// A small town buries and burns its own; beyond that, rubbish nobody takes lies in the streets, as pollution on homes
// and shops, and the news says so. Wastewater treatment plants clean the sewage of so many people; a big town's
// untreated sewage dirties the water, spoiling fishing harbours' catch and keeping visitors away.
// Every building but the landfill needs power, and all cost upkeep. No DOM, nothing random.

import { poison } from "./mining";
import { POWERBIT } from "./tileFlags";
import { INDBASE, RESBASE, WASTE_BASE, WASTE_LAST } from "./tileValues";

export const WASTE_KINDS = ["landfill", "incinerator", "recycling_plant", "waste_power_plant", "wastewater_plant"] as const;
export type WasteKind = typeof WASTE_KINDS[number];

export interface WasteSpec {
  price: number;
  /** Upkeep a year, in baht */
  upkeep: number;
  /** Tonnes of rubbish it takes a month */
  takes: number;
  /** People whose sewage it treats */
  treats: number;
  /** Smoke on each of its tiles while it works, and smell whether it works or not */
  smoke: number;
  smell: number;
  /** Work it gives, as industrial population */
  jobs: number;
  /** Baht a tonne of what it sorts sells for */
  sales: number;
  /** Whether it works only with power */
  needsPower: boolean;
}

export const WASTE_SPECS: Readonly<Record<WasteKind, WasteSpec>> = {
  landfill: { price: 300, upkeep: 20, takes: 800, treats: 0, smoke: 0, smell: 40, jobs: 0, sales: 0, needsPower: false },
  incinerator: { price: 2000, upkeep: 150, takes: 600, treats: 0, smoke: 90, smell: 0, jobs: 1, sales: 0, needsPower: true },
  recycling_plant: { price: 3000, upkeep: 250, takes: 200, treats: 0, smoke: 0, smell: 0, jobs: 2, sales: 0.1, needsPower: true },
  waste_power_plant: { price: 6000, upkeep: 300, takes: 600, treats: 0, smoke: 50, smell: 0, jobs: 1, sales: 0, needsPower: false },
  wastewater_plant: { price: 4000, upkeep: 300, takes: 0, treats: 20000, smoke: 0, smell: 15, jobs: 1, sales: 0, needsPower: true },
};

/** Who takes the month's rubbish first: the cleanest, the landfill last */
const TAKING_ORDER: readonly WasteKind[] = ["recycling_plant", "waste_power_plant", "incinerator", "landfill"];
/** Rubbish a month: tonnes for each person (src/services.ts peopleOf) and each visitor */
export const RUBBISH_PER_PERSON = 0.03;
export const RUBBISH_PER_VISITOR = 0.01;
/** Tonnes a month a small town buries and burns itself (about 2,000 people's) */
export const OWN_RUBBISH = 60;
/** Tonnes a month left lying at which the streets are as dirty as they get, and that pollution on homes and shops */
export const OVERFLOW_FULL = 600;
export const RUBBISH_POLLUTION = 40;
/** What a landfill holds before it is full for good, and the poison it seeps each month */
export const LANDFILL_HOLDS = 40000;
const LANDFILL_SEEP = 4;
const SEEP_RADIUS = 3;
/** Power a waste power plant gives with all the rubbish it can burn (the coal plant's tiles give 700) */
export const WASTE_POWER = 300;
/** People whose sewage the land takes without harm; untreated sewage of this many more is as dirty as it gets */
export const OWN_SEWAGE = 5000;
export const SEWAGE_FULL = 20000;
/** How much untreated sewage adds to the pollution a fishing harbour measures (src/farming.ts DIRTY_WATER is 80) */
export const SEWAGE_DIRT = 100;
/** The share of visitors untreated sewage keeps away at its worst */
export const SEWAGE_AWAY = 0.25;
/** From this many people (or with any of these buildings) the status bar shows how the city copes */
export const WASTE_FROM = 2000;

export function isWasteKind(tool: string): tool is WasteKind {
  return (WASTE_KINDS as readonly string[]).includes(tool);
}

/** A building's kind as the map records it at its centre tile; one without a record is a landfill. */
export function wasteKindAt(kinds: Readonly<Record<string, string>> | null | undefined, index: number): WasteKind {
  const kind = kinds?.[String(index)] ?? "";
  return isWasteKind(kind) ? kind : "landfill";
}

/** The month's rubbish, in tonnes. */
export function rubbishOf(people: number, visitors: number): number {
  return Math.max(0, people) * RUBBISH_PER_PERSON + Math.max(0, visitors) * RUBBISH_PER_VISITOR;
}

export interface WasteSite {
  x: number;
  y: number;
  kind: WasteKind;
  /** Its centre tile, y * width + x */
  index: number;
}

export interface WasteMonth {
  /** People counted, the month's rubbish in tonnes, and how much the buildings took */
  people: number;
  rubbish: number;
  taken: number;
  /** Shares of the rubbish taken (or buried and burned at home) and of the sewage treated, 0–100 */
  rubbishShare: number;
  sewageShare: number;
  /** How bad the rubbish in the streets and the untreated sewage are, 0–1 */
  overflow: number;
  sewage: number;
  /** What recycling sold, in baht */
  sales: number;
  /** Landfills that filled up this month */
  filled: WasteSite[];
  /** How many of these buildings stand, working or not */
  buildings: number;
}

export const NO_WASTE: WasteMonth = {
  people: 0, rubbish: 0, taken: 0, rubbishShare: 100, sewageShare: 100, overflow: 0, sewage: 0, sales: 0, filled: [], buildings: 0,
};

interface MapLike {
  readonly width: number;
  getTileFlags(x: number, y: number): number;
  wasteKinds?: Record<string, string>;
}

interface CensusLike {
  indPop: number;
  wasteUpkeep?: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A city's rubbish and sewage: the working buildings this cycle's scan found, the landfills' fill, last month's state. */
export class Waste {
  /** The buildings working this cycle, and how many stand */
  sites: WasteSite[] = [];
  standing = 0;
  /** Tonnes in each landfill, by its centre tile */
  fill: Record<string, number> = {};
  /** How much of what it can burn a waste power plant got last month, 0–1 */
  powerShare = 0;
  /** How bad the streets' rubbish and the untreated sewage were last month, 0–1 */
  overflow = 0;
  sewage = 0;
  private working = new Set<number>();

  constructor(private readonly width: number, private readonly height: number) {}

  save(saveData: Record<string, unknown>): void {
    saveData.waste = { fill: { ...this.fill }, powerShare: this.powerShare, overflow: this.overflow, sewage: this.sewage };
  }

  load(saveData: Record<string, unknown>): void {
    const saved = saveData.waste as { fill?: Record<string, unknown>; powerShare?: unknown; overflow?: unknown; sewage?: unknown } | undefined;
    if (!saved || typeof saved !== "object") return;
    this.fill = {};
    for (const [index, tonnes] of Object.entries(saved.fill ?? {})) {
      if (typeof tonnes === "number" && tonnes >= 0) this.fill[index] = Math.min(LANDFILL_HOLDS, tonnes);
    }
    const share = (value: unknown): number => typeof value === "number" ? clamp01(value) : 0;
    this.powerShare = share(saved.powerShare);
    this.overflow = share(saved.overflow);
    this.sewage = share(saved.sewage);
  }

  clearCycle(): void {
    this.sites = [];
    this.standing = 0;
    this.working.clear();
  }

  /**
   * The map scan reached a building's centre: it costs its upkeep; with power (a landfill or waste power plant needs
   * none) it works and gives work. Returns the power it gives (a waste power plant), 0 for the others.
   */
  found(map: MapLike, x: number, y: number, census: CensusLike): number {
    const index = y * map.width + x;
    const kind = wasteKindAt(map.wasteKinds, index);
    const spec = WASTE_SPECS[kind];
    census.wasteUpkeep = (census.wasteUpkeep ?? 0) + spec.upkeep;
    this.standing++;
    if (spec.needsPower && (map.getTileFlags(x, y) & POWERBIT) === 0) return 0;
    census.indPop += spec.jobs;
    this.sites.push({ x, y, kind, index });
    this.working.add(index);
    return kind === "waste_power_plant" ? Math.round(WASTE_POWER * this.powerShare) : 0;
  }

  /**
   * A month: the rubbish of `people` and `visitors` shared out among the working buildings, the cleanest first; the
   * landfills fill and seep into `ground` (changed in place); the sewage treated; what is left over in the streets
   * and the water.
   */
  month(people: number, visitors: number, ground: Uint8Array): WasteMonth {
    const rubbish = rubbishOf(people, visitors);
    // Landfills no longer standing are forgotten, so one built again starts empty
    const landfills = new Set(this.sites.filter((site) => site.kind === "landfill").map((site) => String(site.index)));
    for (const index of Object.keys(this.fill)) if (!landfills.has(index)) delete this.fill[index];

    let left = rubbish;
    let sales = 0;
    let burnt = 0;
    let burning = 0;
    let beforeBurning = rubbish;
    const filled: WasteSite[] = [];
    for (const kind of TAKING_ORDER) {
      if (kind === "waste_power_plant") beforeBurning = left;
      for (const site of this.sites) {
        if (site.kind !== kind) continue;
        const spec = WASTE_SPECS[kind];
        const key = String(site.index);
        const room = kind === "landfill" ? Math.min(spec.takes, LANDFILL_HOLDS - (this.fill[key] ?? 0)) : spec.takes;
        const take = Math.max(0, Math.min(left, room));
        left -= take;
        sales += take * spec.sales;
        if (kind === "waste_power_plant") {
          burnt += take;
          burning += spec.takes;
        }
        if (kind === "landfill" && take > 0) {
          const before = this.fill[key] ?? 0;
          this.fill[key] = before + take;
          if (this.fill[key] >= LANDFILL_HOLDS && before < LANDFILL_HOLDS) filled.push(site);
        }
      }
    }
    for (const site of this.sites) {
      if (site.kind === "landfill" && (this.fill[String(site.index)] ?? 0) > 0) {
        poison(ground, this.width, this.height, site.x, site.y, LANDFILL_SEEP, SEEP_RADIUS);
      }
    }
    // A plant built since gets what one plant would have had, so it gives power from its first month
    const powerTakes = WASTE_SPECS.waste_power_plant.takes;
    this.powerShare = clamp01(burning > 0 ? burnt / burning : beforeBurning / powerTakes);

    const taken = rubbish - left;
    const atHome = Math.min(left, OWN_RUBBISH);
    this.overflow = clamp01((left - atHome) / OVERFLOW_FULL);
    const treated = this.sites.reduce((sum, site) => sum + WASTE_SPECS[site.kind].treats, 0);
    this.sewage = clamp01((people - treated - OWN_SEWAGE) / SEWAGE_FULL);
    return {
      people,
      rubbish,
      taken,
      rubbishShare: rubbish > 0 ? Math.round(100 * Math.min(1, (taken + atHome) / rubbish)) : 100,
      sewageShare: people > 0 ? Math.round(100 * Math.min(1, (treated + OWN_SEWAGE) / people)) : 100,
      overflow: this.overflow,
      sewage: this.sewage,
      sales,
      filled,
      buildings: this.standing,
    };
  }

  /**
   * Pollution added to a tile (src/blockMapUtils.js): a building's smoke while it works and its smell, on its own
   * tiles; and the rubbish nobody takes, on homes and shops.
   */
  pollutionAt(map: MapLike, x: number, y: number, tileValue: number): number {
    if (tileValue >= WASTE_BASE && tileValue <= WASTE_LAST) {
      const index = tileValue - WASTE_BASE;
      const centre = (y - Math.floor(index / 3) + 1) * map.width + (x - (index % 3) + 1);
      const spec = WASTE_SPECS[wasteKindAt(map.wasteKinds, centre)];
      return spec.smell + (this.working.has(centre) ? spec.smoke : 0);
    }
    if (this.overflow > 0 && tileValue >= RESBASE && tileValue < INDBASE) return Math.round(RUBBISH_POLLUTION * this.overflow);
    return 0;
  }
}

