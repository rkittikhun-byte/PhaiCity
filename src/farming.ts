/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Farms and fishing harbours (เกษตรและประมง, docs/FARMING.md; owner, 13 Oct 2026), the last two of the province's
// resources to count in the game (docs/PROVINCE_PROFILE.md). Both are 3 × 3 buildings: a farm (tiles 974–982, centre
// 978) on open land in a province with farmland, a fishing harbour (983–991, centre 987) beside water in a province
// with fishing. Each month:
// - a farm sells its crop, more on wet ground (the groundwater under it, src/groundwater.ts) and in a richer farming
//   province, less in the dry season; it asks for factories that process farm goods, and gives work. It pumps the
//   groundwater around it, in competition with the water works; farm chemicals seep into the ground (the mines'
//   poison layer, src/mining.ts); and in the burning months (February to April) its stubble fires spread haze
//   (pollution around it, which also keeps visitors away);
// - a harbour sells its catch, as much as the province's fish allow: the stock falls with each harbour's catch and
//   grows back slowly when left alone, and polluted water near the harbour halves the catch. It asks for markets and
//   eating places (shops), and gives work.
// No DOM, nothing random: the simulation's census and saved state only.

import { drawGroundwater, pumpFactor } from "./groundwater";
import { FARM_BASE, FARM_LAST } from "./tileValues";

/** Baht a farm or a harbour sells a month at level 3, with full ground or full fish */
export const FARM_VALUE = 6;
export const HARBOUR_VALUE = 12;
/** Groundwater a farm draws from under its centre each month (src/groundwater.ts units) */
export const FARM_DRAW = 4;
/** Chemicals a farm puts into the ground under it each month */
const FARM_CHEMICALS = 3;
const CHEMICALS_RADIUS = 2;
/** Haze from a farm's stubble fires on the tiles around it, in the burning months */
export const HAZE = 40;
const HAZE_RADIUS = 4;
/** February to April, 0-based: the burning season of the fields */
export const BURNING_MONTHS: readonly number[] = [1, 2, 3];
/** Work each gives, as industrial population, and what it asks for: farm-goods factories, fish markets */
export const FARM_JOBS = 1;
export const HARBOUR_JOBS = 1;
export const FACTORIES_PER_FARM = 1.5;
export const SHOPS_PER_HARBOUR = 1;
/** What one harbour's catch takes from the province's fish each month, and how fast they grow back */
const CATCH_SHARE = 0.007;
const REGROWTH = 0.04;
/** Pollution near a harbour above which the catch is halved */
export const DIRTY_WATER = 80;
/** A practice map, which is no province, farms and fishes at level 2 */
const PRACTICE_LEVEL = 2;

export type Resources = Readonly<Record<string, number>>;

export function farmLevel(resources: Resources): number {
  return levelOf("farmland", resources);
}

export function fisheryLevel(resources: Resources): number {
  return levelOf("fishery", resources);
}

function levelOf(id: string, resources: Resources): number {
  if (Object.keys(resources).length === 0) return PRACTICE_LEVEL;
  const level = resources[id];
  return typeof level === "number" ? Math.max(0, Math.min(5, Math.round(level))) : 0;
}

const levelFactor = (level: number): number => 0.6 + 0.2 * level;

/** A farm's sales this month: the province's farmland, the ground's water under it (0–1), the season. */
export function farmIncome(level: number, groundShare: number, month: number, dryMonths: readonly number[]): number {
  if (level <= 0) return 0;
  const dry = dryMonths.includes(month + 1);
  return Math.round(FARM_VALUE * levelFactor(level) * (0.5 + 0.5 * groundShare) * (dry ? 0.5 : 1));
}

/** A harbour's catch this month: the province's fishing, its fish stock (0–1), and whether its water is dirty. */
export function harbourIncome(level: number, stock: number, dirty: boolean): number {
  if (level <= 0) return 0;
  return Math.round(HARBOUR_VALUE * levelFactor(level) * stock * (dirty ? 0.5 : 1));
}

/**
 * The fish a month later: each harbour takes its share, and what is left grows back toward a full stock. One harbour
 * leaves about nine tenths for good; five bring them below a third in about nine years, eight in two and a half.
 */
export function nextStock(stock: number, harbours: number): number {
  const fished = Math.max(0, stock - harbours * CATCH_SHARE * stock);
  return Math.min(1, fished + REGROWTH * fished * (1 - fished) + 0.002);
}

/** Whether a 3 × 3 building centred on (x, y) has water beside it. */
export function besideWater3(x: number, y: number, isWater: (x: number, y: number) => boolean): boolean {
  for (let k = -1; k <= 1; k++) {
    if (isWater(x + k, y - 2) || isWater(x + k, y + 2) || isWater(x - 2, y + k) || isWater(x + 2, y + k)) return true;
  }
  return false;
}

interface Place {
  x: number;
  y: number;
}

interface CensusLike {
  indPop: number;
  farmCount?: number;
  harbourCount?: number;
}

export interface FarmingMonth {
  income: number;
  burning: boolean;
  /** The fish fell below a third this month */
  fewFish: boolean;
  /** A harbour whose catch dirty water halved */
  dirty: Place | null;
}

/** A city's farms and harbours: those this cycle's scan found, the province's fish, and the haze in the air. */
export class Farming {
  farms: Place[] = [];
  harbours: Place[] = [];
  /** The province's fish, 0–1 of a full stock (saved) */
  fishStock = 1;
  /** Haze on each tile this month, from stubble fires */
  haze: Uint8Array;

  constructor(private readonly width: number, private readonly height: number, private resources: Resources = {}) {
    this.haze = new Uint8Array(width * height);
  }

  setResources(resources: Resources): void {
    this.resources = resources;
  }

  save(saveData: Record<string, unknown>): void {
    saveData.farming = { fishStock: this.fishStock };
  }

  load(saveData: Record<string, unknown>): void {
    const saved = saveData.farming as { fishStock?: unknown } | undefined;
    if (saved && typeof saved.fishStock === "number" && saved.fishStock >= 0 && saved.fishStock <= 1) {
      this.fishStock = saved.fishStock;
    }
  }

  clearCycle(): void {
    this.farms = [];
    this.harbours = [];
  }

  farmFound(_map: unknown, x: number, y: number, simData: { census: CensusLike }): void {
    if (farmLevel(this.resources) <= 0) return;
    simData.census.indPop += FARM_JOBS;
    simData.census.farmCount = (simData.census.farmCount ?? 0) + 1;
    this.farms.push({ x, y });
  }

  harbourFound(_map: unknown, x: number, y: number, simData: { census: CensusLike }): void {
    if (fisheryLevel(this.resources) <= 0) return;
    simData.census.indPop += HARBOUR_JOBS;
    simData.census.harbourCount = (simData.census.harbourCount ?? 0) + 1;
    this.harbours.push({ x, y });
  }

  /**
   * A month of the farms and harbours. ground: the water manager's stores and natural levels (null before a city has
   * ground); poison: the mines' poisoned ground; pollutionAt: the pollution near a place.
   */
  month(month: number, dryMonths: readonly number[], ground: { stores: Uint8Array; natural: Uint8Array } | null,
      poison: Uint8Array | null, pollutionAt: (x: number, y: number) => number): FarmingMonth {
    const result: FarmingMonth = { income: 0, burning: false, fewFish: false, dirty: null };
    const level = farmLevel(this.resources);
    this.haze.fill(0);
    const burning = BURNING_MONTHS.includes(month) && this.farms.length > 0;
    for (const farm of this.farms) {
      const share = ground ? pumpFactor(ground.stores, this.width, this.height, farm.x, farm.y, 3) : 0.5;
      result.income += farmIncome(level, share, month, dryMonths);
      if (ground) drawGroundwater(ground.stores, ground.natural, this.width, this.height, farm.x, farm.y, FARM_DRAW);
      if (poison) stamp(poison, this.width, this.height, farm.x, farm.y, FARM_CHEMICALS, CHEMICALS_RADIUS, true);
      if (burning) stamp(this.haze, this.width, this.height, farm.x, farm.y, HAZE, HAZE_RADIUS, false);
    }
    result.burning = burning;

    const fishing = fisheryLevel(this.resources);
    const wasPlenty = this.fishStock >= 1 / 3;
    for (const harbour of this.harbours) {
      const dirty = pollutionAt(harbour.x, harbour.y) > DIRTY_WATER;
      if (dirty && !result.dirty) result.dirty = harbour;
      result.income += harbourIncome(fishing, this.fishStock, dirty);
    }
    this.fishStock = nextStock(this.fishStock, this.harbours.length);
    result.fewFish = wasPlenty && this.fishStock < 1 / 3;
    return result;
  }

  /** Haze on a tile this month, for the pollution scan (src/blockMapUtils.js) */
  hazeAt(x: number, y: number): number {
    return this.haze[y * this.width + x];
  }
}

/** Adds amount at (x, y), less further out, as far as radius; adding to what is there, or keeping the larger. */
function stamp(layer: Uint8Array, width: number, height: number, x: number, y: number, amount: number, radius: number,
    add: boolean): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const tx = x + dx;
      const ty = y + dy;
      if (distance > radius || tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      const i = ty * width + tx;
      const value = Math.round(amount * (radius + 1 - distance) / (radius + 1));
      layer[i] = add ? Math.min(255, layer[i] + value) : Math.max(layer[i], value);
    }
  }
}

/** Whether a tile is part of a farm, which the renderer draws by the province's region (wet paddy, cane, rubber…) */
export function isFarmTile(value: number): boolean {
  return value >= FARM_BASE && value <= FARM_LAST;
}
