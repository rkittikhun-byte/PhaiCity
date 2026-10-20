/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The water supply (ระบบประปา, docs/WATER_PLAN.md), beside the power network of src/powerManager.js:
// - the map scan finds the water works and water towers and counts them in the census;
// - once a cycle the water runs from every powered water works along the roads it touches: pipes lie under roads;
// - a works gives as much as the groundwater under it allows (src/groundwater.ts), less in a month of the province's
//   dry season, and the towers on the pipes make up some of what the dry season takes;
// - each zone the next scan reaches takes one share when a road with water touches it, until the supply runs out;
// - once a month the rain fills the ground again (not in a dry month) and each works draws from the ground around it
//   as much as the city took, so a works pumped hard runs its ground low.
// No DOM, jQuery or window here (CLAUDE.md, "Online plan" rule 3), and nothing random.

import { BlockMap } from "./blockMap";
import { decodePresetLayer, encodePresetLayer } from "./geo/presetMap";
import {
  computeGroundwater, drawGroundwater, fullStores, GROUNDWATER_FULL, pumpFactor, rechargeGroundwater,
} from "./groundwater";
import { GROUNDWATER_LOW, NOT_ENOUGH_WATER } from "./messages";
import { PLOT_SHARE } from "./plots";
import { POWERBIT } from "./tileFlags";
import {
  WATER_TOWER, WATER_WORKS,
} from "./tileValues";

/** Zones a water works serves with full ground under it */
export const WORKS_SUPPLY = 80;
/** Zones' worth of the dry season's loss that each water tower on the pipes makes up */
export const TOWER_STORE = 10;
/** What a works pumping its fullest takes from the ground under its centre in a month (src/groundwater.ts units) */
export const DRAW_PER_MONTH = 10;
/** A works whose ground holds less than this share of what its land holds sends the news a warning */
const LOW_SHARE = 0.5;
const MONTHS_BETWEEN_WARNINGS = 12;

/** The months of a province's dry season (1–12) and how much less a water works gives in them (0–0.9) */
export interface Drought {
  months: readonly number[];
  share: number;
}

export const NO_DROUGHT: Drought = { months: [], share: 0 };

interface MapLike {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  /** Metres a tile, which sets how far from water the ground holds it (src/groundwater.ts) */
  readonly tileSizeM?: number | null;
}

interface CensusLike {
  waterWorksPop: number;
  waterTowerPop: number;
  wateredZoneCount: number;
  dryZoneCount: number;
}

interface Source {
  x: number;
  y: number;
  tower: boolean;
  powered: boolean;
}

/** Whether a tile carries a water main: every kind of road, bridge and level crossing (src/roadTiles.ts) */
export { carriesWater } from "./roadTiles";
import { carriesWater } from "./roadTiles";

/** What the last full scan found on a zone's tiles: water; none, but the zone needs none at its size; or none, and it
 * is held back or shrinking for want of it (the renderer's no-water icon) */
export const ZONE_WATERED = 1;
export const ZONE_DRY = 2;
export const ZONE_THIRSTY = 3;

/** What the renderer and the city map may read (src/cityView.ts: renderers never write) */
export interface WaterView {
  /** ZONE_WATERED, ZONE_DRY or ZONE_THIRSTY on a zone's tiles as last scanned, 0 elsewhere */
  zoneWater(x: number, y: number): number;
  /** Whether a road carries water */
  hasWater(x: number, y: number): boolean;
  /** What is in the ground under a tile now, 0 to GROUNDWATER_FULL (null before a city has ground) */
  groundwater(x: number, y: number): number | null;
}

type Listener = (value?: unknown) => void;

export class WaterManager {
  /** Each tile's natural groundwater level and what is in the ground now (src/groundwater.ts) */
  natural: Uint8Array | null = null;
  stores: Uint8Array | null = null;
  /** As full as each tile's land holds, for the warnings */
  private full: Uint8Array | null = null;
  drought: Drought = NO_DROUGHT;
  /** The poisoned ground (src/mining.ts): a works on it gives less water fit to use */
  poison: { cleanWater(x: number, y: number): number } | null = null;
  /** The share of the supply this month's festival uses up: Songkran's water fights (src/tourism.ts) */
  festivalUse = 0;
  /** How much further the water goes because people pay for it and save it: the water fee (src/budget.js), 0–0.3,
   * and the ruler's water saving (src/policies.ts) */
  saving = 0;
  /** How much faster the rain fills the ground: the ruler's green zoning (src/policies.ts) */
  recharge = 1;
  /** Zones the water reaching the pipes can serve this cycle */
  supply = 0;
  readonly view: WaterView;

  private readonly grid: BlockMap;
  // The zone marks being made by this cycle's scan, and the last complete ones
  private zonesNext: BlockMap;
  private zonesDone: BlockMap;
  private sources: Source[] = [];
  private used = 0;
  private short = false;
  private monthsSinceWarning = MONTHS_BETWEEN_WARNINGS;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(private readonly map: MapLike) {
    this.grid = new BlockMap(map.width, map.height, 1);
    this.zonesNext = new BlockMap(map.width, map.height, 1);
    this.zonesDone = new BlockMap(map.width, map.height, 1);
    this.view = {
      zoneWater: (x, y) => this.inBounds(x, y) ? this.zonesDone.worldGet(x, y) : 0,
      hasWater: (x, y) => this.inBounds(x, y) && this.grid.worldGet(x, y) > 0,
      groundwater: (x, y) => this.stores && this.inBounds(x, y) ? this.stores[y * this.map.width + x] : null,
    };
  }

  addEventListener(event: string, listener: Listener): void {
    const list = this.listeners.get(event) ?? [];
    if (!list.includes(listener)) list.push(listener);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, listener: Listener): void {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter((l) => l !== listener));
  }

  private emit(event: string, value?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  /**
   * Works the land's natural levels out from the map as it is now (and its heights, when known) and fills the ground
   * unless a save brought what was in it. Call once the map is loaded.
   */
  prepareGround(heights: ArrayLike<number> | null): void {
    this.natural = computeGroundwater(this.map, heights);
    this.full = fullStores(this.natural);
    if (!this.stores || this.stores.length !== this.natural.length) {
      this.stores = this.full.slice();
      return;
    }
    // Land that holds less than before (built over its water) cannot keep more than it holds
    for (let i = 0; i < this.stores.length; i++) this.stores[i] = Math.min(this.stores[i], this.full[i]);
  }

  /**
   * Works the natural levels out again after water came or went (a canal dug or filled in, src/canals.ts): the ground
   * round new water fills by as much more as it now holds, and ground that holds less keeps no more than it holds.
   */
  refreshGround(heights: ArrayLike<number> | null): void {
    const oldFull = this.full;
    this.natural = computeGroundwater(this.map, heights);
    this.full = fullStores(this.natural);
    if (!this.stores || !oldFull || this.stores.length !== this.full.length) {
      this.stores = this.full.slice();
      return;
    }
    for (let i = 0; i < this.stores.length; i++) {
      this.stores[i] = Math.min(this.full[i], this.stores[i] + Math.max(0, this.full[i] - oldFull[i]));
    }
  }

  save(saveData: Record<string, unknown>): void {
    if (this.stores) saveData.groundwater = encodePresetLayer(this.stores);
  }

  load(saveData: Record<string, unknown>): void {
    // A save from before the water supply, or a broken layer, starts the ground full again
    this.stores = this.full ? this.full.slice() : null;
    if (typeof saveData.groundwater !== "string") return;
    try {
      this.stores = decodePresetLayer(saveData.groundwater, this.map.width, this.map.height);
    } catch (e) {
      // Keep the full ground
    }
  }

  /** A new cycle: the scan finds the sources again and the zones take their shares afresh. */
  clearCycle(): void {
    this.sources = [];
    this.used = 0;
    this.short = false;
    const done = this.zonesDone;
    this.zonesDone = this.zonesNext;
    this.zonesNext = done;
    this.zonesNext.clear();
  }

  /** The map scan reached a water works (its centre tile). */
  waterWorksFound(map: MapLike, x: number, y: number, simData: { census: CensusLike }): void {
    simData.census.waterWorksPop += 1;
    this.sources.push({ x, y, tower: false, powered: (map.getTileFlags(x, y) & POWERBIT) !== 0 });
  }

  /** The map scan reached a water tower. */
  waterTowerFound(_map: MapLike, x: number, y: number, simData: { census: CensusLike }): void {
    simData.census.waterTowerPop += 1;
    this.sources.push({ x, y, tower: true, powered: true });
  }

  /** Finds the sources straight from the map, for a city's first scan, when the zones have not been scanned yet. */
  findSources(): void {
    this.sources = [];
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const value = this.map.getTileValue(x, y);
        if (value === WATER_WORKS) {
          this.sources.push({ x, y, tower: false, powered: (this.map.getTileFlags(x, y) & POWERBIT) !== 0 });
        } else if (value === WATER_TOWER) {
          this.sources.push({ x, y, tower: true, powered: true });
        }
      }
    }
  }

  isDryMonth(month: number): boolean {
    return this.drought.months.includes(month + 1);
  }

  /** How much of its full output a works gives now: its ground, less in a dry month. */
  worksFactor(x: number, y: number, month: number): number {
    const ground = this.stores ? pumpFactor(this.stores, this.map.width, this.map.height, x, y, 3) : 0.5;
    return ground * (this.isDryMonth(month) ? 1 - this.drought.share : 1);
  }

  /**
   * The cycle's water: on the first cycle of a month the ground changes first (rain, then what the works drew while
   * the zones took the last supply); then the supply for the next cycle, and the water runs along the roads.
   * month is 0–11, as the game counts it.
   */
  doWaterScan(month: number, newMonth: boolean): void {
    if (newMonth) this.updateGround(month);

    const dry = this.isDryMonth(month);
    let works = 0;
    let lost = 0;
    for (const source of this.sources) {
      if (source.tower || !source.powered) continue;
      const ground = this.stores ? pumpFactor(this.stores, this.map.width, this.map.height, source.x, source.y, 3) : 0.5;
      const clean = this.poison ? this.poison.cleanWater(source.x, source.y) : 1;
      works += WORKS_SUPPLY * ground * clean * (dry ? 1 - this.drought.share : 1);
      if (dry) lost += WORKS_SUPPLY * ground * clean * this.drought.share;
    }

    // Along the roads from every powered works: a road touching a works' side is where the water enters
    this.grid.clear();
    const { width } = this.map;
    const queue: number[] = [];
    const reach = (x: number, y: number): void => {
      if (!this.inBounds(x, y) || this.grid.worldGet(x, y) || !carriesWater(this.map.getTileValue(x, y))) return;
      this.grid.worldSet(x, y, 1);
      queue.push(y * width + x);
    };
    for (const source of this.sources) {
      if (source.tower || !source.powered) continue;
      for (let k = -1; k <= 1; k++) {
        reach(source.x + k, source.y - 2);
        reach(source.x + k, source.y + 2);
        reach(source.x - 2, source.y + k);
        reach(source.x + 2, source.y + k);
      }
    }
    while (queue.length) {
      const i = queue.pop() as number;
      const x = i % width;
      const y = (i - x) / width;
      reach(x + 1, y);
      reach(x - 1, y);
      reach(x, y + 1);
      reach(x, y - 1);
    }

    // The towers on the pipes give back what they stored through the rains
    let stored = 0;
    if (lost > 0) {
      for (const source of this.sources) {
        if (!source.tower) continue;
        const { x, y } = source;
        if (this.view.hasWater(x + 1, y) || this.view.hasWater(x - 1, y) || this.view.hasWater(x, y + 1) ||
            this.view.hasWater(x, y - 1)) stored += TOWER_STORE;
      }
    }
    this.supply = Math.floor((works + Math.min(lost, stored)) * (1 - this.festivalUse) * (1 + this.saving));
  }

  /** A month of the ground: the rain fills it (not in a dry month), and each works draws as much as was used. */
  private updateGround(month: number): void {
    const { stores, natural, full } = this;
    if (!stores || !natural || !full) return;
    const { width, height } = this.map;
    // The share of the last supply the zones took: every works pumped that share of what it could
    const taken = this.supply > 0 ? Math.min(1, this.used / this.supply) : 0;
    if (!this.isDryMonth(month)) rechargeGroundwater(stores, natural, this.recharge);

    let low: Source | null = null;
    for (const source of this.sources) {
      if (source.tower || !source.powered) continue;
      const pumped = this.worksFactor(source.x, source.y, month) * taken;
      if (pumped > 0) drawGroundwater(stores, natural, width, height, source.x, source.y, DRAW_PER_MONTH * pumped);
      const now = pumpFactor(stores, width, height, source.x, source.y, 3);
      const before = pumpFactor(full, width, height, source.x, source.y, 3);
      if (low === null && before > 0 && now < before * LOW_SHARE) low = source;
    }

    this.monthsSinceWarning++;
    if (low !== null && this.monthsSinceWarning >= MONTHS_BETWEEN_WARNINGS) {
      this.monthsSinceWarning = 0;
      this.emit(GROUNDWATER_LOW, { x: low.x, y: low.y });
    }
  }

  /**
   * Whether the 3 × 3 zone centred on (x, y) has water this cycle: a road with water touches its side and some supply
   * is left, which it then takes. When the supply runs out the news hears of it, once a cycle. needsWater: the zone
   * is as big as it can be without water, so going without holds it back.
   */
  supplyZone(x: number, y: number, census: CensusLike | null = null, needsWater = true): boolean {
    let piped = false;
    for (let k = -1; k <= 1 && !piped; k++) {
      piped = this.view.hasWater(x + k, y - 2) || this.view.hasWater(x + k, y + 2) ||
        this.view.hasWater(x - 2, y + k) || this.view.hasWater(x + 2, y + k);
    }
    const watered = piped && this.used < this.supply;
    if (watered) this.used++;
    if (piped && !watered && !this.short) {
      this.short = true;
      this.emit(NOT_ENOUGH_WATER);
    }
    const state = watered ? ZONE_WATERED : needsWater ? ZONE_THIRSTY : ZONE_DRY;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.inBounds(x + dx, y + dy)) this.zonesNext.worldSet(x + dx, y + dy, state);
      }
    }
    if (census) {
      if (watered) census.wateredZoneCount += 1;
      else census.dryZoneCount += 1;
    }
    return watered;
  }

  /**
   * The same for a one-tile plot of painted zones (src/plots.ts): the water comes along the road it reaches, at
   * (roadX, roadY) (-1 with none), and it takes an eighth of a zone's share. needsWater false is an empty lot, which
   * takes none and is not counted (owner, 15 Oct 2026: "แก้เมืองหยุดโต": the empty lots of a growing town took the water
   * its buildings needed, and the factories, scanned last, never had any).
   */
  supplyPlot(x: number, y: number, roadX: number, roadY: number, census: CensusLike | null = null,
             needsWater = true): boolean {
    const piped = roadX >= 0 && this.view.hasWater(roadX, roadY);
    const watered = piped && (!needsWater || this.used < this.supply);
    if (watered && needsWater) this.used += PLOT_SHARE;
    if (piped && !watered && !this.short) {
      this.short = true;
      this.emit(NOT_ENOUGH_WATER);
    }
    if (this.inBounds(x, y)) this.zonesNext.worldSet(x, y, watered ? ZONE_WATERED : needsWater ? ZONE_THIRSTY : ZONE_DRY);
    if (census && needsWater) {
      if (watered) census.wateredZoneCount += PLOT_SHARE;
      else census.dryZoneCount += PLOT_SHARE;
    }
    return watered;
  }

  registerHandlers(mapScanner: { addAction(criterion: unknown,
      action: (map: MapLike, x: number, y: number, simData: { census: CensusLike }) => void): void },
  repairManager: { addAction(criterion: unknown, period: number, zoneSize: number): void }): void {
    mapScanner.addAction(WATER_WORKS, this.waterWorksFound.bind(this));
    mapScanner.addAction(WATER_TOWER, this.waterTowerFound.bind(this));
    repairManager.addAction(WATER_WORKS, 15, 3);
  }
}

/** The full share of a tile's ground, for the city map: 0 (dry) to 1 (as full as open water). */
export function groundShare(amount: number): number {
  return Math.max(0, Math.min(1, amount / GROUNDWATER_FULL));
}
