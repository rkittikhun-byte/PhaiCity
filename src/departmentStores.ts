/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The department store (ห้างสรรพสินค้า, docs/GAME_DESIGN.md 22; owner, 23 Oct 2026: "ห้างก็ได้"). On a real-scale city
// map the shops grow only so far before they wait for a department store, as the homes wait for the stadium; each store
// lifts that cap. It stands in for the original game's airport there, which needed a university's engineers a town of
// ten years never has; province and practice maps keep the airport (docs/NO_GRID_PLAN.md 5.6), where the store is only a
// store. A ruler's building on the civic 3 × 3 (tiles 414–422, gameMap.civicKinds "department_store"), from the market
// town on (src/unlocks.ts).
// - Gains: the shops' cap; land value near it; visitors (the city's appeal, src/tourism.ts); shoppers drive to it (the
//   month's trips, src/sim/tripPlaces.ts) and it gives work.
// - Costs: its price, months as a construction site, and its upkeep a year, a budget line.
// No DOM, nothing random.

import { POWERBIT } from "./tileFlags";
import { isCityTileSize } from "./units";

export const STORE_KIND = "department_store";

/** Every number of the department store, in one place (docs/GAME_DESIGN.md 22) */
export const STORE_RULES = {
  /** Its price and its upkeep a year, in baht (beside a stadium's ฿5,000 and a provincial hospital's ฿4,000 and ฿350) */
  price: 4000,
  upkeep: 250,
  /** The shops' units (census.comPop: a shop plot of level L counts L / 8) a real-scale city's shops reach with no
   * store: a market town's worth, about 6,400 of the census's people, which the auto player's Khon Kaen reaches in its
   * second or third year as a market town */
  shopsFree: 40,
  /** ... and how far each store lifts that: one makes it 100 (the original game's airport's), two 160, three 220 */
  shopsPerStore: 60,
  /** Land value it adds round it, less further out, and how far it reaches in steps of distance
   * (BlockMapUtils.nearnessStep: about 100 m on a real-scale map) */
  landValue: 20,
  landReach: 8,
  /** What the first store adds to the city's appeal to visitors, and each one after it (src/tourism.ts) */
  appeal: 0.1,
  moreAppeal: 0.03,
  /** The shoppers it draws, as the people of shop plots would (src/sim/tripPlaces.ts), and the people who work in it */
  shoppers: 400,
  staff: 120,
} as const;

/** The shops' cap on a real-scale city map with this many stores standing, in the census's units */
export function shopCap(stores: number): number {
  return STORE_RULES.shopsFree + STORE_RULES.shopsPerStore * Math.max(0, stores);
}

/** Whether the department stores rule the shops' cap on this map (a real-scale city map) rather than the airport */
export function storesCapShops(map: { tileSizeM?: number | null }): boolean {
  return isCityTileSize(map.tileSizeM);
}

/**
 * Whether the shops are held back this cycle: on a real-scale city map when they have reached the cap of the stores
 * standing, elsewhere as in the original game, past 100 units with no airport.
 */
export function shopsHeld(map: { tileSizeM?: number | null }, census: { comPop: number; airportPop: number },
  stores: number): boolean {
  if (storesCapShops(map)) return census.comPop >= shopCap(stores);
  return census.comPop > 100 && census.airportPop === 0;
}

/** The census's people a unit of shops counts (a shop plot of level L counts L / 8 units and 20 L people) */
export const PEOPLE_A_SHOP_UNIT = 160;

/** What a store's card shows of the cap (src/objects/buildings.ts): the shops' jobs and the cap as the census's people,
 * the jobs to the nearest hundred */
export function shopCapView(comPop: number, stores: number, held: boolean): { shops: number; cap: number; held: boolean } {
  return { shops: Math.round(comPop * PEOPLE_A_SHOP_UNIT / 100) * 100, cap: shopCap(stores) * PEOPLE_A_SHOP_UNIT, held };
}

export interface StoreSite {
  /** Its centre tile */
  centre: number;
  x: number;
  y: number;
  powered: boolean;
}

interface StoreMap {
  readonly width: number;
  civicKinds?: Record<string, string> | null;
  getTileFlags(x: number, y: number): number;
}

interface CensusLike {
  storeUpkeep?: number;
}

/** The stores this cycle's scan found, and last cycle's, which the cap, the land value, the visitors and the trips read */
export class DepartmentStores {
  sites: StoreSite[] = [];
  /** Last cycle's stores */
  standing: StoreSite[] = [];

  clearCycle(): void {
    this.sites = [];
  }

  /** The end of a cycle's scan: what it found is what the month reads */
  endCycle(): void {
    this.standing = this.sites;
  }

  /** A civic building's centre: a store pays its upkeep; finished (the scan passes construction sites by), it counts. */
  found(map: StoreMap, x: number, y: number, census: CensusLike): boolean {
    const centre = y * map.width + x;
    if (map.civicKinds?.[centre] !== STORE_KIND) return false;
    census.storeUpkeep = (census.storeUpkeep ?? 0) + STORE_RULES.upkeep;
    this.sites.push({ centre, x, y, powered: (map.getTileFlags(x, y) & POWERBIT) !== 0 });
    return true;
  }

  /** The stores standing (last cycle's scan), powered or not: each lifts the shops' cap */
  get count(): number {
    return this.standing.length;
  }

  /** What the stores add to the city's appeal to visitors: the first the most, each after it a little */
  appeal(): number {
    const n = this.standing.filter((s) => s.powered).length;
    return n ? STORE_RULES.appeal + STORE_RULES.moreAppeal * (n - 1) : 0;
  }

  /** Land value the stores add at (x, y), the nearest's; step: tiles to a step of distance */
  landValueAt(x: number, y: number, step = 1): number {
    let best = 0;
    const reach = STORE_RULES.landReach * step;
    for (const s of this.standing) {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < reach) best = Math.max(best, Math.round(STORE_RULES.landValue * (1 - d / reach)));
    }
    return best;
  }
}
