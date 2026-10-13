/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A class for each kind of building (src/objects/cityObject.ts), and which one stands on a tile. Homes, shops and
// factories share their levels with the painted plots (src/plots.ts): a home is level 1 as a house and 2–5 as a
// zone building, a shop 1–5, a factory 1–4; the land class is 0–3 (factories 0–1). Plain code: no DOM.

import { readPlotValue } from "../plots.js";
import { ZONEBIT } from "../tileFlags.js";
import {
  AIRPORT, BUS_STOP, CIVIC, FARM, FIRESTATION, FULLSTADIUM, HARBOUR, HHTHR, LHTHR, MINE, NUCLEAR,
  POLICESTATION, PORT, POWERPLANT, STADIUM, STATION, WASTE, WATER_TOWER, WATER_WORKS,
} from "../tileValues.js";
import { Building, CentralService, CityReader, CommunityBuilding, Fact, ObjectKind } from "./cityObject.js";

/** A home, a shop or a factory: a 3 × 3 zone building, a house or a painted plot. */
export abstract class ZoneBuilding extends CommunityBuilding {
  /** Its level (0 for an empty zone or plot) and land class, read from its tile */
  level(city: CityReader): number { return readPlotValue(city.getTileValue(this.x, this.y))?.level ?? 0; }
  landClass(city: CityReader): number { return readPlotValue(city.getTileValue(this.x, this.y))?.value ?? 0; }
  override facts(city: CityReader): Fact[] {
    const facts = super.facts(city);
    facts.unshift({ key: "object.fact.level", params: { level: this.level(city) } },
      { key: "object.fact.land_class", params: { land: `object.land.${this.landClass(city)}` } });
    return facts;
  }
}
export class Home extends ZoneBuilding { readonly kind = "home"; }
export class Shop extends ZoneBuilding { readonly kind = "shop"; }
export class Factory extends ZoneBuilding { readonly kind = "factory"; }
/** Farms and fishing harbours are the villagers' own (owner, 13 Oct 2026): the community's, on land the ruler set aside
 * for them; mines stay central, as concessions the ruler grants for royalties (docs/GAME_PLAN.md decision 13) */
export class Farm extends CommunityBuilding { readonly kind = "farm"; }
export class Harbour extends CommunityBuilding { readonly kind = "harbour"; }

/** A building whose sort the map records beside its tiles, by its centre's index */
abstract class RecordedBuilding extends CentralService {
  protected abstract record(city: CityReader): Readonly<Record<string, string>> | null | undefined;
  protected fallback = "";
  override sort(city: CityReader): string { return this.record(city)?.[this.id] ?? this.fallback; }
}
export class PowerPlant extends RecordedBuilding {
  readonly kind = "power_plant";
  constructor(id: number, x: number, y: number, size: number, nuclear: boolean) {
    super(id, x, y, size);
    this.fallback = nuclear ? "nuclear" : "lignite";
  }
  protected record(city: CityReader) { return this.fallback === "nuclear" ? null : city.powerKinds; }
}
export class Civic extends RecordedBuilding {
  readonly kind = "civic";
  protected record(city: CityReader) { return city.civicKinds; }
}
export class WasteSite extends RecordedBuilding {
  readonly kind = "waste";
  protected record(city: CityReader) { return city.wasteKinds; }
}
export class Mine extends RecordedBuilding {
  readonly kind = "mine";
  protected record(city: CityReader) { return city.mineKinds; }
}
export class Station extends RecordedBuilding {
  readonly kind = "station";
  protected record(city: CityReader) { return city.stationKinds; }
}

class Plain extends CentralService {
  constructor(readonly kind: ObjectKind, id: number, x: number, y: number, size: number, private power = true) {
    super(id, x, y, size);
  }
  override get needsPower(): boolean { return this.power; }
}

/** The zone centres the map marks (ZONEBIT), with their size and class */
const CENTRES: ReadonlyArray<[number, number, (id: number, x: number, y: number) => Building]> = [
  [PORT, 4, (id, x, y) => new Plain("port", id, x, y, 4)],
  [AIRPORT, 6, (id, x, y) => new Plain("airport", id, x, y, 6)],
  [POWERPLANT, 4, (id, x, y) => new PowerPlant(id, x, y, 4, false)],
  [NUCLEAR, 4, (id, x, y) => new PowerPlant(id, x, y, 4, true)],
  [FIRESTATION, 3, (id, x, y) => new Plain("fire", id, x, y, 3)],
  [POLICESTATION, 3, (id, x, y) => new Plain("police", id, x, y, 3)],
  [STADIUM, 4, (id, x, y) => new Plain("stadium", id, x, y, 4)],
  [FULLSTADIUM, 4, (id, x, y) => new Plain("stadium", id, x, y, 4)],
  [CIVIC, 3, (id, x, y) => new Civic(id, x, y, 3)],
  [WATER_WORKS, 3, (id, x, y) => new Plain("water_works", id, x, y, 3)],
  [MINE, 3, (id, x, y) => new Mine(id, x, y, 3)],
  [FARM, 3, (id, x, y) => new Farm(id, x, y, 3)],
  [HARBOUR, 3, (id, x, y) => new Harbour(id, x, y, 3)],
  [WASTE, 3, (id, x, y) => new WasteSite(id, x, y, 3)],
  [STATION, 3, (id, x, y) => new Station(id, x, y, 3)],
];
const BY_CENTRE = new Map(CENTRES.map(([value, size, make]) => [value, { size, make }]));

/**
 * The building that has this tile as its centre (a zone centre, or a one-tile building), or null.
 * On a painted-zone map every home, shop or factory tile without the zone bit is a plot of its own.
 */
export function buildingAt(city: CityReader, x: number, y: number): Building | null {
  const value = city.getTileValue(x, y), flags = city.getTileFlags(x, y), id = y * city.width + x;
  if (flags & ZONEBIT) {
    const centre = BY_CENTRE.get(value);
    if (centre) return centre.make(id, x, y);
    const plot = readPlotValue(value);
    if (plot) {
      const make = plot.kind === "residential" ? Home : plot.kind === "commercial" ? Shop : Factory;
      return new make(id, x, y, 3);
    }
    return null;
  }
  if (value === WATER_TOWER) return new Plain("water_tower", id, x, y, 1);
  if (value === BUS_STOP) return new Plain("bus_stop", id, x, y, 1, false);
  if (value >= LHTHR && value <= HHTHR) return new Home(id, x, y, 1);
  // A painted plot: a home, shop or factory tile standing alone (not one of a zone's eight outer tiles)
  const plot = readPlotValue(value);
  if (plot && plot.level > 0 && city.paintedZones) {
    const make = plot.kind === "residential" ? Home : plot.kind === "commercial" ? Shop : Factory;
    return new make(id, x, y, 1);
  }
  return null;
}
