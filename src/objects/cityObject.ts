/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's objects (วัตถุในเมือง, owner 13 Oct 2026: "เขียนเป็น class หรือ object กลางไว้ แล้ว อื่นๆ ก็แตก object
// ออกไป"; docs/GAME_PLAN.md phase 0). One base class, CityObject, for everything a player can click on the map;
// Building for what stands on it; and a class for each kind below them (src/objects/buildings.ts). Each object knows
// its place, what it is and what the card shows of it (facts), and later how content it is (satisfaction).
// The map's tiles stay the truth: objects are found on the tiles (src/objects/cityObjects.ts), and the few things the
// tiles cannot tell, such as when a building went up, are saved with the city. Plain code: no DOM, nothing random.

import { POWERBIT } from "../tileFlags.js";

/** What the objects read of the city: the map and the records kept beside its tiles */
export interface CityReader {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  /** Whether homes, shops and factories are painted a tile at a time here (src/plots.ts) */
  readonly paintedZones?: boolean;
  /** What each 3 × 3 of the newer buildings is, by its centre's index (src/powerPlants.ts, src/services.ts …) */
  readonly powerKinds?: Readonly<Record<string, string>> | null;
  readonly civicKinds?: Readonly<Record<string, string>> | null;
  readonly wasteKinds?: Readonly<Record<string, string>> | null;
  readonly mineKinds?: Readonly<Record<string, string>> | null;
  readonly stationKinds?: Readonly<Record<string, string>> | null;
  readonly rulerHouse?: { readonly x: number; readonly y: number; readonly level: number } | null;
  /** Where the water reaches (src/waterManager.ts WaterView): each zone's mark as last scanned */
  readonly water?: { zoneWater(x: number, y: number): number } | null;
}

/** One line of an object's card: an i18n key (`object.fact.*`) and what fills it */
export interface Fact {
  key: string;
  params?: Record<string, string | number>;
}

/** The kinds of object; each has its class and its i18n name `object.kind.<kind>` */
export type ObjectKind =
  | "home" | "shop" | "factory"
  | "power_plant" | "water_works" | "water_tower" | "waste"
  | "civic" | "police" | "fire"
  | "mine" | "farm" | "harbour"
  | "station" | "bus_stop" | "port" | "airport"
  | "stadium";

/**
 * The two sides of the city (owner, 13 Oct 2026: "แบ่งแยก ในส่วนของ ชุมชนกับ service ของส่วนกลาง"): the community's
 * buildings, which people and businesses own, grow by themselves and pay taxes on; and the central services, which
 * the ruler builds, pays the upkeep of and runs for everyone.
 */
export type Sector = "community" | "central";

/** What a save keeps of an object: only what the tiles cannot tell */
export interface SavedObject {
  id: number;
  /** When it went up, in the simulation's city time (0 if it stood before objects were recorded) */
  built: number;
}

/** Everything on the map a player can click. */
export abstract class CityObject {
  abstract readonly kind: ObjectKind;
  /**
   * @param id The map index (y * width + x) of its centre tile, or of its only tile
   * @param x, y Its centre tile
   * @param size Its side in tiles (1, 3, 4 or 6)
   */
  constructor(readonly id: number, readonly x: number, readonly y: number, readonly size: number) {}
  /** Its top-left tile: a zone's centre is at (1, 1) from its top-left whatever its size */
  get left(): number { return this.size === 1 ? this.x : this.x - 1; }
  get top(): number { return this.size === 1 ? this.y : this.y - 1; }
  /** Whether it covers this tile */
  covers(x: number, y: number): boolean {
    return x >= this.left && y >= this.top && x < this.left + this.size && y < this.top + this.size;
  }
  /** What sort of its kind it is (a lignite plant, a landfill, a school …), or "" if its kind has no sorts */
  sort(_city: CityReader): string { return ""; }
  /** The lines of its card, in order */
  facts(city: CityReader): Fact[] {
    const sort = this.sort(city);
    return sort ? [{ key: "object.fact.sort", params: { sort: `object.sort.${sort}` } }] : [];
  }
}

/** Something built: it went up at a time, may have power and water, and is saved. */
export abstract class Building extends CityObject {
  /** When it went up, in city time; 0 if it stood before the city recorded its objects */
  built = 0;
  powered(city: CityReader): boolean {
    return (city.getTileFlags(this.x, this.y) & POWERBIT) !== 0;
  }
  /** Whether water reaches it, as the water supply last marked its zone (src/waterManager.ts ZONE_WATERED) */
  watered(city: CityReader): boolean {
    return city.water?.zoneWater(this.x, this.y) === 1;
  }
  /** Whose it is: the community's or the ruler's (see Sector) */
  abstract readonly sector: Sector;
  /** Whether it takes power at all; parks, stops and the like do not */
  get needsPower(): boolean { return true; }
  override facts(city: CityReader): Fact[] {
    const facts = super.facts(city);
    if (this.needsPower) facts.push({ key: this.powered(city) ? "object.fact.powered" : "object.fact.unpowered" });
    return facts;
  }
  toJSON(): SavedObject { return { id: this.id, built: this.built }; }
}

/** The community's buildings: homes, shops and factories (and later hotels); people and owners live and work in them,
 * they grow and decline by themselves, and pay taxes. Their satisfaction is whether they are content to stay. */
export abstract class CommunityBuilding extends Building {
  readonly sector = "community";
}

/** The central services the ruler builds and pays for: power, water, rubbish, schools, hospitals, safety, transport
 * and the ruler's house. Their satisfaction is how well they serve: budget, staff, load and reach. */
export abstract class CentralService extends Building {
  readonly sector = "central";
}
