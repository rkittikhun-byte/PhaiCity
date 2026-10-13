/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Public transport (ขนส่งสาธารณะ, docs/TRANSIT.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 5). A bus or songthaew
// stop is one tile beside a road (tile 1021); the stations are one 3 × 3 (tiles 1001–1009, centre 1005) told apart by
// the map's record of what was built where (gameMap.stationKinds, saved as stationKinds): a train station, a metro
// station and a high-speed rail station.
// Each working one reaches the zones around it. A share of the trips from there ride instead of drive, so they add
// that much less traffic to the roads (src/traffic.js); where a train or metro reaches, a trip that finds no way by
// road still gets there by rail. Train stations and the high-speed station bring visitors, the high-speed station
// trade, and the metro raises the land's value around it. The costs: each costs its upkeep, the stations need power,
// the metro needs a second station for its line and the ruler's rank, the high-speed station a higher rank and makes
// noise, and only one may stand. No DOM, nothing random.

import { POWERBIT } from "./tileFlags";
import { STATION, STATION_BASE, STATION_LAST } from "./tileValues";

export const TRANSIT_KINDS = ["bus_stop", "train_station", "metro_station", "hsr_station"] as const;
export type TransitKind = typeof TRANSIT_KINDS[number];
export type StationKind = Exclude<TransitKind, "bus_stop">;
export const STATION_KINDS: readonly StationKind[] = ["train_station", "metro_station", "hsr_station"];

export interface TransitSpec {
  price: number;
  /** Upkeep a year, in baht */
  upkeep: number;
  /** How far it reaches, in tiles */
  reach: number;
  /** The share of the trips from where it reaches that ride, 0–1 */
  riders: number;
  /** Whether a trip with no way by road still gets there by rail */
  rail: boolean;
  /** The ruler's rank it needs (src/rulerRank.ts: 0 หมื่น … 5 เจ้าพระยา) */
  rank: number;
  /** Whether it must touch a railway */
  byRail: boolean;
}

export const TRANSIT_SPECS: Readonly<Record<TransitKind, TransitSpec>> = {
  bus_stop: { price: 150, upkeep: 30, reach: 6, riders: 0.3, rail: false, rank: 0, byRail: false },
  train_station: { price: 2500, upkeep: 150, reach: 12, riders: 0.25, rail: true, rank: 0, byRail: true },
  metro_station: { price: 6000, upkeep: 400, reach: 8, riders: 0.5, rail: true, rank: 2, byRail: false },
  hsr_station: { price: 20000, upkeep: 1000, reach: 15, riders: 0.2, rail: true, rank: 3, byRail: true },
};

/** Visitors: this many more for each train station (at most two count), and for the high-speed station */
export const TRAIN_VISITORS = 0.1;
export const HSR_VISITORS = 0.25;
/** Shops wanted this much more with the high-speed station's trade (src/valves.js) */
export const HSR_TRADE = 1.1;
/** Land value the metro adds near its stations, less further out */
export const METRO_LAND_VALUE = 15;
/** Noise on the high-speed station's tiles */
export const HSR_NOISE = 30;
/** The most riders anywhere, however many stops and stations reach it */
export const MOST_RIDERS = 0.7;

/** Why a transit tool was refused */
export const NEEDS_RAIL = "the station must touch a railway";
export const ONE_HSR = "the city has its high-speed rail station";
export const TRANSIT_NEEDS_RANK = "this needs a higher rank";

export function isTransitKind(tool: string): tool is TransitKind {
  return (TRANSIT_KINDS as readonly string[]).includes(tool);
}

/** A station's kind as the map records it at its centre tile; one without a record is a train station. */
export function stationKindAt(kinds: Readonly<Record<string, string>> | null | undefined, index: number): StationKind {
  const kind = kinds?.[String(index)] ?? "";
  return (STATION_KINDS as readonly string[]).includes(kind) ? kind as StationKind : "train_station";
}

interface PlaceMap {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;
  stationKinds?: Record<string, string>;
}

/**
 * Why a transit tool may not be used at (x, y) now, or null. rank: the ruler's; isRail tells a railway tile; for a
 * station (x, y) is its centre.
 */
export function transitProblem(tool: string, x: number, y: number, rank: number, isRail: (x: number, y: number) => boolean,
    map: PlaceMap | null): string | null {
  if (!isTransitKind(tool)) return null;
  const spec = TRANSIT_SPECS[tool];
  if (rank < spec.rank) return TRANSIT_NEEDS_RANK;
  if (tool === "hsr_station" && map && hasHsr(map)) return ONE_HSR;
  if (spec.byRail) {
    let touches = false;
    for (let d = -2; d <= 2 && !touches; d++) {
      touches = isRail(x + d, y - 2) || isRail(x + d, y + 2) || isRail(x - 2, y + d) || isRail(x + 2, y + d);
    }
    if (!touches) return NEEDS_RAIL;
  }
  return null;
}

/** Whether a high-speed rail station stands on the map. */
export function hasHsr(map: PlaceMap): boolean {
  for (const [index, kind] of Object.entries(map.stationKinds ?? {})) {
    if (kind !== "hsr_station") continue;
    const i = Number(index);
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (x >= 0 && y >= 0 && x < map.width && y < map.height && map.getTileValue(x, y) === STATION) return true;
  }
  return false;
}

export interface TransitSite {
  x: number;
  y: number;
  kind: TransitKind;
}

interface ScanMap {
  readonly width: number;
  getTileFlags(x: number, y: number): number;
  stationKinds?: Record<string, string>;
}

interface CensusLike {
  transitUpkeep?: number;
}

/** Tiles to a block of the reach grid */
const BLOCK = 4;

/**
 * A city's public transport: the working stops and stations this cycle's scan found, and the reach of last cycle's,
 * which the zones' trips read.
 */
export class Transit {
  sites: TransitSite[] = [];
  /** Last cycle's: the share that rides from each block (0–100), and whether rail reaches it */
  private riders: Uint8Array;
  private rail: Uint8Array;
  private readonly columns: number;
  private readonly rows: number;
  /** Last cycle's working sites, for the land value, the visitors and the trade */
  working: TransitSite[] = [];

  constructor(width: number, height: number) {
    this.columns = Math.ceil(width / BLOCK);
    this.rows = Math.ceil(height / BLOCK);
    this.riders = new Uint8Array(this.columns * this.rows);
    this.rail = new Uint8Array(this.columns * this.rows);
  }

  /** A stop's tile: it costs its upkeep and works beside a road. */
  stopFound(x: number, y: number, census: CensusLike, besideRoad: boolean): void {
    census.transitUpkeep = (census.transitUpkeep ?? 0) + TRANSIT_SPECS.bus_stop.upkeep;
    if (besideRoad) this.sites.push({ x, y, kind: "bus_stop" });
  }

  /** A station's centre: it costs its upkeep and works with power. */
  stationFound(map: ScanMap, x: number, y: number, census: CensusLike): void {
    const kind = stationKindAt(map.stationKinds, y * map.width + x);
    census.transitUpkeep = (census.transitUpkeep ?? 0) + TRANSIT_SPECS[kind].upkeep;
    if (map.getTileFlags(x, y) & POWERBIT) this.sites.push({ x, y, kind });
  }

  /**
   * The end of a cycle's scan: the reach of the sites it found becomes what the next cycle's trips read. A metro
   * station works only with another for its line.
   */
  endCycle(): void {
    const metros = this.sites.filter((site) => site.kind === "metro_station").length;
    this.working = this.sites.filter((site) => site.kind !== "metro_station" || metros >= 2);
    this.riders.fill(0);
    this.rail.fill(0);
    for (const site of this.working) {
      const spec = TRANSIT_SPECS[site.kind];
      const reach = spec.reach;
      for (let by = Math.floor((site.y - reach) / BLOCK); by <= Math.floor((site.y + reach) / BLOCK); by++) {
        for (let bx = Math.floor((site.x - reach) / BLOCK); bx <= Math.floor((site.x + reach) / BLOCK); bx++) {
          if (bx < 0 || by < 0 || bx >= this.columns || by >= this.rows) continue;
          const cx = bx * BLOCK + BLOCK / 2;
          const cy = by * BLOCK + BLOCK / 2;
          if (Math.hypot(cx - site.x, cy - site.y) > reach) continue;
          const i = by * this.columns + bx;
          // Riders from several kinds add up, but never past the most
          this.riders[i] = Math.min(Math.round(100 * MOST_RIDERS), this.riders[i] + Math.round(100 * spec.riders));
          if (spec.rail) this.rail[i] = 1;
        }
      }
    }
    this.sites = [];
  }

  /** The share of the trips from (x, y) that ride, 0–MOST_RIDERS. */
  ridersAt(x: number, y: number): number {
    const i = this.block(x, y);
    return i < 0 ? 0 : this.riders[i] / 100;
  }

  /** Whether a train or metro reaches (x, y), so a trip with no way by road still gets there. */
  railAt(x: number, y: number): boolean {
    const i = this.block(x, y);
    return i >= 0 && this.rail[i] === 1;
  }

  /** How many more visitors come, as a factor: the train stations (two at most) and the high-speed station. */
  visitorFactor(): number {
    const trains = Math.min(2, this.working.filter((site) => site.kind === "train_station").length);
    const hsr = this.working.some((site) => site.kind === "hsr_station");
    return 1 + trains * TRAIN_VISITORS + (hsr ? HSR_VISITORS : 0);
  }

  /** The shops' demand factor: the high-speed station's trade. */
  tradeFactor(): number {
    return this.working.some((site) => site.kind === "hsr_station") ? HSR_TRADE : 1;
  }

  /** Land value the metro adds at (x, y), less further out. */
  landValueAt(x: number, y: number): number {
    let best = 0;
    for (const site of this.working) {
      if (site.kind !== "metro_station") continue;
      const reach = TRANSIT_SPECS.metro_station.reach;
      const distance = Math.hypot(x - site.x, y - site.y);
      if (distance < reach) best = Math.max(best, Math.round(METRO_LAND_VALUE * (1 - distance / reach)));
    }
    return best;
  }

  /** Noise added to a tile: the high-speed station's own. */
  pollutionAt(map: { stationKinds?: Record<string, string>; readonly width: number }, x: number, y: number,
      tileValue: number): number {
    if (tileValue < STATION_BASE || tileValue > STATION_LAST) return 0;
    const index = tileValue - STATION_BASE;
    const centre = (y - Math.floor(index / 3) + 1) * map.width + (x - (index % 3) + 1);
    return stationKindAt(map.stationKinds, centre) === "hsr_station" ? HSR_NOISE : 0;
  }

  private block(x: number, y: number): number {
    const bx = Math.floor(x / BLOCK);
    const by = Math.floor(y / BLOCK);
    return bx < 0 || by < 0 || bx >= this.columns || by >= this.rows ? -1 : by * this.columns + bx;
  }
}
