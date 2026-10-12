/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city map (src/mapWindow.js): the whole city at one pixel per tile, coloured by what stands there, or one of the
// simulation's overlays laid over a dimmed city: power, traffic, pollution, crime, land value, population, and police
// and fire cover. Pure functions over a read-only view of the map and the block maps, so they run in Node tests.

import { CONDBIT, POWERBIT, ZONEBIT } from "./tileFlags";
import {
  COALBASE, COALSMOKE1, COMBASE, FIRE, FIRESTBASE, FLOOD, FOOTBALLGAME1, FOUNTAIN, HBRDG0, INDBASE, LASTFIRE, LASTFLOOD,
  LASTPOWER, LASTRAIL, LASTRIVEDGE, LASTROAD, LASTRUBBLE, LASTTREE, LASTZONE, NUCLEARBASE, NUKESWIRL1, PORTBASE,
  POWERBASE, RADAR0, RADTILE, RAILBASE, RESBASE, RIVER, ROADBASE, RUBBLE, TELEBASE, TINYEXP, TINYEXPLAST, TREEBASE,
  VBRDG0, WOODS, WOODS2, WOODS5,
} from "./tileValues";

export const MAP_LAYERS = ["city", "power", "traffic", "pollution", "crime", "landValue", "population", "police",
  "fire"] as const;
export type MapLayer = typeof MAP_LAYERS[number];

export function isMapLayer(value: unknown): value is MapLayer {
  return typeof value === "string" && (MAP_LAYERS as readonly string[]).includes(value);
}

export type TileKind = "dirt" | "water" | "woods" | "park" | "rubble" | "fire" | "flood" | "radiation" | "road" |
  "rail" | "powerLine" | "residential" | "commercial" | "industrial" | "service" | "powerPlant";

export type Rgb = readonly [number, number, number];

// Close to the tool buttons' colours, so the map reads like the toolbox
export const KIND_COLOURS: Record<TileKind, Rgb> = {
  dirt: [181, 158, 116],
  water: [42, 100, 176],
  woods: [47, 107, 52],
  park: [124, 195, 107],
  rubble: [141, 141, 141],
  fire: [255, 87, 34],
  flood: [111, 168, 220],
  radiation: [198, 255, 0],
  road: [58, 58, 58],
  rail: [122, 75, 42],
  powerLine: [255, 213, 79],
  residential: [60, 207, 78],
  commercial: [47, 107, 255],
  industrial: [242, 194, 0],
  service: [196, 92, 255],
  powerPlant: [255, 143, 0],
};

/** What a tile is, for the map. Animated tiles count as the building they belong to. */
export function tileKind(value: number): TileKind {
  if (value < RIVER) return "dirt";
  if (value <= LASTRIVEDGE) return "water";
  if (value >= TREEBASE && value <= LASTTREE) return "woods";
  if (value >= WOODS && value < WOODS2) return "woods";
  if (value >= WOODS2 && value <= WOODS5) return "park"; // the park tool plants these, or a fountain
  if (value >= RUBBLE && value <= LASTRUBBLE) return "rubble";
  if (value >= FLOOD && value <= LASTFLOOD) return "flood";
  if (value >= RADTILE && value < FIRE) return "radiation";
  if (value >= FIRE && value <= LASTFIRE) return "fire";
  if (value >= ROADBASE && value <= LASTROAD) return "road";
  if (value >= POWERBASE && value <= LASTPOWER) return "powerLine";
  if (value >= RAILBASE && value <= LASTRAIL) return "rail";
  if (value >= RESBASE && value < COMBASE) return "residential";
  if (value >= COMBASE && value < INDBASE) return "commercial";
  if (value >= INDBASE && value < PORTBASE) return "industrial";
  if (value >= PORTBASE && value < COALBASE) return "service"; // seaport and airport
  if (value >= COALBASE && value < FIRESTBASE) return "powerPlant";
  if (value >= FIRESTBASE && value < NUCLEARBASE) return "service"; // fire and police stations, stadium
  if (value >= NUCLEARBASE && value <= LASTZONE) return "powerPlant";
  if (value >= HBRDG0 && value < RADAR0) return "road"; // the opening bridge
  if (value >= RADAR0 && value < FOUNTAIN) return "service"; // the airport's radar
  if (value >= FOUNTAIN && value < TELEBASE) return "park";
  if (value >= TINYEXP && value <= TINYEXPLAST) return "fire";
  if (value >= TELEBASE && value < COALSMOKE1) return "industrial"; // factory animations
  if (value >= COALSMOKE1 && value < FOOTBALLGAME1) return "powerPlant"; // coal plant smoke
  if (value >= FOOTBALLGAME1 && value < VBRDG0) return "service"; // a game at the stadium
  if (value >= VBRDG0 && value < NUKESWIRL1) return "road";
  if (value >= NUKESWIRL1 && value < NUKESWIRL1 + 4) return "powerPlant";
  if (value >= NUKESWIRL1 + 4 && value < 1020) return "residential"; // the extended residential buildings
  return "dirt";
}

/** A layer or kind as named in the strings table, which uses snake_case ("landValue" → "land_value"). */
export function stringId(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** The legend of the whole-city layer, in drawing order. */
export const CITY_KEYS: readonly TileKind[] = ["residential", "commercial", "industrial", "service", "powerPlant",
  "road", "rail", "powerLine", "water", "woods", "park", "fire"];

export interface BlockMapLike {
  worldGet(x: number, y: number): number;
}

export interface CityMapSource {
  readonly width: number;
  readonly height: number;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  /** On a whole-province map, 1 for the province's own tiles; the land around it is drawn darker (GEO_SPEC 10) */
  readonly insideProvince?: Uint8Array | null;
}

/** How bright the land outside the province is drawn, as in the province picker (src/geo/presetMap.ts) */
export const OUTSIDE_SHADE = 0.45;

export type Overlays = Record<"trafficDensityMap" | "pollutionDensityMap" | "crimeRateMap" | "landValueMap" |
  "populationDensityMap" | "policeStationEffectMap" | "fireStationEffectMap", BlockMapLike>;

export type HeatLayer = Exclude<MapLayer, "city" | "power">;

// Each overlay's block map, the top of its range (src/simulation.js) and its colour at the top
export const HEAT: Record<HeatLayer, { map: keyof Overlays; max: number; colour: Rgb }> = {
  traffic: { map: "trafficDensityMap", max: 240, colour: [255, 64, 32] },
  pollution: { map: "pollutionDensityMap", max: 255, colour: [196, 120, 32] },
  crime: { map: "crimeRateMap", max: 250, colour: [230, 32, 90] },
  landValue: { map: "landValueMap", max: 250, colour: [64, 220, 120] },
  population: { map: "populationDensityMap", max: 510, colour: [170, 110, 255] },
  police: { map: "policeStationEffectMap", max: 1000, colour: [64, 150, 255] },
  fire: { map: "fireStationEffectMap", max: 1000, colour: [255, 120, 40] },
};

export const POWERED: Rgb = [255, 213, 0];
export const UNPOWERED: Rgb = [229, 57, 53];

/** The city in grey and darkened, for an overlay to stand out on. */
export function dimmed([r, g, b]: Rgb): Rgb {
  const grey = 0.3 * r + 0.59 * g + 0.11 * b;
  const value = Math.round(34 + grey * 0.34);
  return [value, value, value];
}

/** How strongly an overlay value shows, 0–1; a square root so that thin cover or light traffic still shows. */
export function heatLevel(value: number, max: number): number {
  if (!(value > 0)) return 0;
  return Math.sqrt(Math.min(1, value / max));
}

function mix(base: Rgb, top: Rgb, amount: number): Rgb {
  return [
    Math.round(base[0] + (top[0] - base[0]) * amount),
    Math.round(base[1] + (top[1] - base[1]) * amount),
    Math.round(base[2] + (top[2] - base[2]) * amount),
  ];
}

/** The colours at the bottom and the top of an overlay's scale, over empty land, for the legend. */
export function heatRamp(layer: HeatLayer): [Rgb, Rgb] {
  const base = dimmed(KIND_COLOURS.dirt);
  return [base, mix(base, HEAT[layer].colour, 0.9)];
}

/** The colour of one tile on a layer. */
export function tileColour(layer: MapLayer, value: number, flags: number, overlays: Overlays, x: number, y: number): Rgb {
  const city = KIND_COLOURS[tileKind(value)];
  if (layer === "city") return city;
  if (layer === "power") {
    const kind = tileKind(value);
    if (kind === "powerPlant") return POWERED;
    if (flags & CONDBIT) return flags & POWERBIT ? POWERED : UNPOWERED;
    return dimmed(city);
  }
  const heat = HEAT[layer];
  return mix(dimmed(city), heat.colour, 0.9 * heatLevel(overlays[heat.map].worldGet(x, y), heat.max));
}

/** The whole map as RGBA pixels, one per tile, row by row (ready for an ImageData). */
export function layerPixels(layer: MapLayer, map: CityMapSource, overlays: Overlays): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(map.width * map.height * 4);
  const inside = map.insideProvince ?? null;
  let i = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const [r, g, b] = tileColour(layer, map.getTileValue(x, y), map.getTileFlags(x, y), overlays, x, y);
      const shade = inside && !inside[y * map.width + x] ? OUTSIDE_SHADE : 1;
      pixels[i++] = r * shade;
      pixels[i++] = g * shade;
      pixels[i++] = b * shade;
      pixels[i++] = 255;
    }
  }
  return pixels;
}

/** How many canvas pixels each tile gets, so the map is about 600 pixels across. */
export function mapScale(width: number, height: number): number {
  return Math.max(1, Math.floor(600 / Math.max(width, height)));
}

/** The tile under a point on the drawn map, given the map's on-screen box, or null outside it. */
export function tileAtPoint(clientX: number, clientY: number,
    box: { left: number; top: number; width: number; height: number },
    width: number, height: number): { x: number; y: number } | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const x = Math.floor((clientX - box.left) / box.width * width);
  const y = Math.floor((clientY - box.top) / box.height * height);
  return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
}

/** How many zones and buildings have power and how many do not (power plants aside), for the power layer's legend. */
export function powerCounts(map: CityMapSource): { powered: number; unpowered: number } {
  let powered = 0;
  let unpowered = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const flags = map.getTileFlags(x, y);
      // A zone or building is counted once, at its centre tile
      if (!(flags & ZONEBIT) || !(flags & CONDBIT) || tileKind(map.getTileValue(x, y)) === "powerPlant") continue;
      if (flags & POWERBIT) powered++;
      else unpowered++;
    }
  }
  return { powered, unpowered };
}
