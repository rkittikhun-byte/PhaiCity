/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Painted zones (ระบายเขต, owner 13 Oct 2026, docs/ZONE_PAINT.md): on a real-scale city map (16 m a tile,
// docs/CITY_SCALE.md) homes, shops and factories are painted tile by tile, as in Cities: Skylines, instead of laid as
// 3 × 3 zones ("3x3 จริงๆ มันเยอะไป เอา 1 ช่องเลย"). A painted tile within reach of a road is a plot (แปลง) that grows
// its own building, level by level: a house to a tower, a corner shop to an office tower, a workshop to a factory.
//
// The tile value says it all: on such a map every home, shop or factory tile that is not part of a 3 × 3 zone is a
// plot, its kind the range its value lies in and its level the block of tiles the value comes from (plotTile, plotOf).
// So undo, saves, the bulldozer and fire need nothing new, and the rest of the simulation sees a plot as it sees a
// zone's tiles: traffic finds its shops and factories, factories pollute, fire burns them. In the census a plot counts
// as an eighth of a zone (PLOT_SHARE). Plain code, no DOM: it runs in the simulation.

import { Random } from "./random";
import { isRoadTile, roadLevelAt, servesZones } from "./roadLevels";
import { BLBNCNBIT, POWERBIT, ZONEBIT } from "./tileFlags";
import { COMBASE, CZB, DIRT, HOUSE, INDBASE, IZB, LASTRUBBLE, PORTBASE, RESBASE, RUBBLE, RZB, TREEBASE,
  WOODS2 } from "./tileValues";
import { ZoneUtils } from "./zoneUtils.js";

export const PLOT_KINDS = ["residential", "commercial", "industrial"] as const;
export type PlotKind = typeof PLOT_KINDS[number];

/** The highest level of each kind: five sizes of home and of shop, four of factory */
export const PLOT_TOP: Readonly<Record<PlotKind, number>> = { residential: 5, commercial: 5, industrial: 4 };
/** How far from a road, in tiles, a tile may be painted: 48 m, Cities: Skylines' six cells of 8 m */
export const PLOT_REACH = 3;
/** A plot's part of a 3 × 3 zone in the census's counts (zones, power, water): an eighth, which adds up exactly */
export const PLOT_SHARE = 1 / 8;
/** A painted tile costs a ninth of the zone tool's price, as nine tiles make a zone */
export const PAINT_PRICE_SHARE = 1 / 9;
/** The tools that paint each kind, and the one that rubs paint out (src/plotTool.ts) */
export const PAINT_TOOLS: Readonly<Record<PlotKind, string>> = {
  residential: "zone_residential", commercial: "zone_commercial", industrial: "zone_industrial",
};
export const ERASE_TOOL = "zone_erase";
/** The most tiles one fill paints */
export const MAX_FILL = 2000;

export interface Plot {
  kind: PlotKind;
  level: number;
  /** The land and pollution class its building was put up for: 0–3 (0–1 for factories) */
  value: number;
}

/** A map that may have painted zones */
export interface PlotMap {
  readonly width: number;
  readonly height: number;
  /** Whether homes, shops and factories are painted tile by tile here (a real-scale city map) */
  paintedZones?: boolean;
  roadLevels?: Uint8Array | null;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
}

const HOME_BLOCKS = RZB - 4;
const SHOP_BLOCKS = CZB - 4;
const FACTORY_BLOCKS = IZB - 4;

/** The tile a plot shows: the empty lot, a house, or the top-left tile of the 3 × 3 zone building of that size. */
export function plotTile(kind: PlotKind, level: number, value = 0, style = 0): number {
  const lp = Math.max(0, Math.min(3, value | 0));
  if (kind === "residential") {
    if (level <= 0) return RESBASE;
    if (level === 1) return HOUSE + lp * 3 + Math.abs(style | 0) % 3;
    return HOME_BLOCKS + (lp * 4 + Math.min(level, PLOT_TOP.residential) - 2) * 9;
  }
  if (kind === "commercial") return level <= 0 ? COMBASE : SHOP_BLOCKS + (lp * 5 + Math.min(level, 5) - 1) * 9;
  return level <= 0 ? INDBASE : FACTORY_BLOCKS + ((lp & 1) * 4 + Math.min(level, 4) - 1) * 9;
}

/** The kind of plot a tile value belongs to, by its range, or null. */
export function plotKindOfValue(value: number): PlotKind | null {
  if (value >= RESBASE && value < HOME_BLOCKS + 16 * 9) return "residential";
  if (value >= COMBASE && value < INDBASE) return "commercial";
  if (value >= INDBASE && value < PORTBASE) return "industrial";
  return null;
}

/** A tile value read as a plot: its kind, level and land class (whatever tile of the zone building it is). */
export function readPlotValue(value: number): Plot | null {
  const kind = plotKindOfValue(value);
  if (kind === "residential") {
    if (value < HOUSE) return { kind, level: 0, value: 0 };
    if (value < HOME_BLOCKS) return { kind, level: 1, value: Math.floor((value - HOUSE) / 3) };
    const block = Math.floor((value - HOME_BLOCKS) / 9);
    return { kind, level: 2 + block % 4, value: Math.floor(block / 4) };
  }
  if (kind === "commercial") {
    if (value < SHOP_BLOCKS) return { kind, level: 0, value: 0 };
    const block = Math.floor((value - SHOP_BLOCKS) / 9);
    return { kind, level: 1 + block % 5, value: Math.floor(block / 5) };
  }
  if (kind === "industrial") {
    if (value < FACTORY_BLOCKS) return { kind, level: 0, value: 0 };
    const block = Math.floor((value - FACTORY_BLOCKS) / 9);
    return { kind, level: 1 + block % 4, value: Math.floor(block / 4) };
  }
  return null;
}

const inside = (map: { width: number; height: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < map.width && y < map.height;

/**
 * The plot at (x, y), or null: none on a map without painted zones, and none on a tile of a 3 × 3 zone, which a
 * city laid before its map had painted zones may still have (its centre, or a tile beside a zone's centre).
 */
export function plotOf(map: PlotMap, x: number, y: number): Plot | null {
  if (!map.paintedZones || !inside(map, x, y)) return null;
  const value = map.getTileValue(x, y);
  if (plotKindOfValue(value) === null || map.getTileFlags(x, y) & ZONEBIT) return null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && inside(map, nx, ny) && map.getTileFlags(nx, ny) & ZONEBIT) {
        const centre = map.getTileValue(nx, ny);
        if (centre >= RESBASE && centre < PORTBASE) return null;
      }
    }
  }
  return readPlotValue(value);
}

/** Whether a road at (x, y) gives the plots beside it a way in: motorways and tollways do not (src/roadLevels.ts). */
export function drivewayAt(map: PlotMap, x: number, y: number): boolean {
  return inside(map, x, y) && isRoadTile(map.getTileValue(x, y)) && servesZones(roadLevelAt(map, x, y));
}

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/**
 * The road a tile reaches: the nearest one straight north, east, south or west, within PLOT_REACH tiles, or null.
 * So the plots along a road make a band three deep on each side, as Cities: Skylines' zone cells do.
 */
export function nearestRoad(map: PlotMap, x: number, y: number, reach = PLOT_REACH): { x: number; y: number } | null {
  for (let d = 1; d <= reach; d++) {
    for (const [dx, dy] of SIDES) {
      if (drivewayAt(map, x + dx * d, y + dy * d)) return { x: x + dx * d, y: y + dy * d };
    }
  }
  return null;
}

/** Which way a plot's building faces: the side its road is on, 0 north, 1 east, 2 south, 3 west (south with none). */
export function plotFacing(map: PlotMap, x: number, y: number): number {
  const road = nearestRoad(map, x, y);
  if (!road) return 2;
  return road.y < y ? 0 : road.x > x ? 1 : road.y > y ? 2 : 3;
}

/** Bare land a plot can be painted on: open ground, woods (cleared at the province's price) or rubble. */
export function isOpenLand(value: number): boolean {
  return value === DIRT || value >= TREEBASE && value < WOODS2 || value >= RUBBLE && value <= LASTRUBBLE;
}

/** Whether a tile is woods, which painting clears at the province's price. */
export function isWoodsValue(value: number): boolean {
  return value >= TREEBASE && value < WOODS2;
}

/** Where paint can go: within reach of a road, on bare land or an empty plot. */
export function zonable(map: PlotMap, x: number, y: number): boolean {
  if (!map.paintedZones || !inside(map, x, y)) return false;
  const value = map.getTileValue(x, y);
  const plot = isOpenLand(value) ? null : plotOf(map, x, y);
  if (!isOpenLand(value) && (!plot || plot.level > 0)) return false;
  return nearestRoad(map, x, y) !== null;
}

/** What painting kind at (x, y) would do: "paint", "same" (already that kind), or why it cannot. */
export type PaintOutcome = "paint" | "same" | "built" | "not_land" | "no_road" | "no_zones";

export function paintOutcome(map: PlotMap, kind: PlotKind, x: number, y: number): PaintOutcome {
  if (!map.paintedZones || !inside(map, x, y)) return "no_zones";
  const value = map.getTileValue(x, y);
  const plot = isOpenLand(value) ? null : plotOf(map, x, y);
  if (plot && plot.kind === kind) return "same";
  if (plot && plot.level > 0) return "built";
  if (!plot && !isOpenLand(value)) return "not_land";
  return nearestRoad(map, x, y) ? "paint" : "no_road";
}

/**
 * The tiles one fill reaches from (x, y): every tile joined to it, side by side, that paint can reach and that is
 * like it (bare land, or an empty plot of the same kind), so a fill stops at roads, buildings and other zones.
 * Erasing (kind null) fills the empty plots of the kind clicked.
 */
export function fillRegion(map: PlotMap, x: number, y: number, kind: PlotKind | null,
                           limit = MAX_FILL): Array<{ x: number; y: number }> {
  if (!map.paintedZones || !inside(map, x, y)) return [];
  const classOf = (cx: number, cy: number): string | null => {
    const value = map.getTileValue(cx, cy);
    if (isOpenLand(value)) return "land";
    const plot = plotOf(map, cx, cy);
    return plot && plot.level === 0 ? plot.kind : null;
  };
  const start = classOf(x, y);
  if (start === null || (kind === null && start === "land") || start === kind) return [];
  if (nearestRoad(map, x, y) === null) return [];
  const seen = new Uint8Array(map.width * map.height);
  const found: Array<{ x: number; y: number }> = [];
  const queue = [[x, y]];
  seen[y * map.width + x] = 1;
  while (queue.length > 0 && found.length < limit) {
    const [cx, cy] = queue.shift()!;
    found.push({ x: cx, y: cy });
    for (const [dx, dy] of SIDES) {
      const nx = cx + dx, ny = cy + dy;
      if (!inside(map, nx, ny) || seen[ny * map.width + nx]) continue;
      seen[ny * map.width + nx] = 1;
      if (classOf(nx, ny) === start && nearestRoad(map, nx, ny) !== null) queue.push([nx, ny]);
    }
  }
  return found;
}

// Lots (แปลงรวม, owner 13 Oct 2026): four plots of one kind in a square on even tiles, all grown far enough, join into
// one bigger building, as Cities: Skylines' big buildings take several cells. The top level grows only on a lot.

/** The level from which four plots of a kind join into a lot */
export const LOT_LEVEL: Readonly<Record<PlotKind, number>> = { residential: 4, commercial: 4, industrial: 3 };
/** Tiles a side of a lot */
export const LOT_SIZE = 2;

export interface Lot {
  /** Its top-left tile, on even coordinates */
  x: number;
  y: number;
  kind: PlotKind;
  /** The lowest level of its four plots, which its building shows */
  level: number;
  /** The richest land class among them */
  value: number;
}

/** The lot the plot at (x, y) belongs to, or null: the square of four on even tiles round it, all of one kind and grown. */
export function lotOf(map: PlotMap, x: number, y: number): Lot | null {
  if (!map.paintedZones || !inside(map, x, y)) return null;
  const left = x - (x % LOT_SIZE), top = y - (y % LOT_SIZE);
  let kind: PlotKind | null = null, level = Infinity, value = 0;
  for (let dy = 0; dy < LOT_SIZE; dy++) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      const plot = plotOf(map, left + dx, top + dy);
      if (!plot || (kind !== null && plot.kind !== kind) || plot.level < LOT_LEVEL[plot.kind]) return null;
      kind = plot.kind;
      level = Math.min(level, plot.level);
      value = Math.max(value, plot.value);
    }
  }
  return kind === null ? null : { x: left, y: top, kind, level, value };
}

/** Which way a lot's building faces: to the road nearest any of its plots (as plotFacing). */
export function lotFacing(map: PlotMap, lot: Lot): number {
  let best: { facing: number; distance: number } | null = null;
  for (let dy = 0; dy < LOT_SIZE; dy++) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      const x = lot.x + dx, y = lot.y + dy, road = nearestRoad(map, x, y);
      if (!road) continue;
      const distance = Math.abs(road.x - x) + Math.abs(road.y - y);
      if (!best || distance < best.distance) best = { facing: plotFacing(map, x, y), distance };
    }
  }
  return best ? best.facing : 2;
}

/** What a plot adds to the population density scan (src/blockMapUtils.js): four house plots match a zone of houses. */
export function plotDensity(map: PlotMap, x: number, y: number): number {
  const plot = plotOf(map, x, y);
  if (!plot) return 0;
  return plot.kind === "residential" ? plot.level * 16 : plot.level * 8;
}

// The simulation, as a plot sees it

const ROUTE_FOUND = 1;
const NO_ROAD_FOUND = -1;

interface BlockMapLike {
  worldGet(x: number, y: number): number;
}

export interface PlotCensus {
  resZonePop: number;
  comZonePop: number;
  indZonePop: number;
  resPop: number;
  comPop: number;
  indPop: number;
  poweredZoneCount: number;
  unpoweredZoneCount: number;
}

export interface PlotScanMap extends PlotMap {
  getTile(x: number, y: number): { isPowered(): boolean };
  setTile(x: number, y: number, value: number, flags: number): void;
}

export interface PlotSimData {
  blockMaps: {
    landValueMap: BlockMapLike;
    pollutionDensityMap: BlockMapLike;
    populationDensityMap: BlockMapLike;
    cityCentreDistScoreMap: BlockMapLike;
  };
  census: PlotCensus;
  valves: { resValve: number; comValve: number; indValve: number };
  trafficManager?: {
    makeTrafficFrom(roadX: number, roadY: number, x: number, y: number, blockMaps: unknown,
                    destination: (value: number) => boolean): number;
  } | null;
  waterManager?: {
    supplyPlot(x: number, y: number, roadX: number, roadY: number, census: unknown, needsWater: boolean): boolean;
  } | null;
  /** How much of pollution's harm to homes health takes away, 0–0.5 (src/services.ts) */
  pollutionShield?: number;
  /** Visitors' trips, which send shoppers out more often (src/tourism.ts) */
  touristTrips?: number;
}

/** Where each kind's trips go, as for zones: homes to shops, shops to factories, factories to homes */
const DESTINATIONS: Readonly<Record<PlotKind, (value: number) => boolean>> = {
  residential: (value) => value >= COMBASE && value < INDBASE,
  commercial: (value) => value >= INDBASE && value < PORTBASE,
  industrial: (value) => value >= RESBASE && value < COMBASE,
};

// The chances a zone grows or shrinks, as src/residential.js explains: about 9% a look when the score is good
const grows = (score: number): boolean => score > -350 && score - 26380 > Random.getRandom16Signed();
const shrinks = (score: number): boolean => score < 350 && score + 26380 < Random.getRandom16Signed();

/** A home's score for its place, -3000–3000, as a zone's (src/residential.js evalResidential) */
function homeScore(sim: PlotSimData, x: number, y: number, traffic: number): number {
  if (traffic === NO_ROAD_FOUND) return -3000;
  const shield = sim.pollutionShield ?? 0;
  let land = sim.blockMaps.landValueMap.worldGet(x, y) - sim.blockMaps.pollutionDensityMap.worldGet(x, y) * (1 - shield);
  land = land < 0 ? 0 : Math.min(land * 32, 6000);
  return land - 3000;
}

/** How crowded the neighbourhood must be for a home to rise past each level: towers want a busy town round them */
export const DENSITY_TO_RISE = [0, 32, 64, 96, 128];

/** Whether a plot may grow a level: the top level only on a lot (lotOf). */
export function mayRise(map: PlotMap, x: number, y: number, plot: Plot): boolean {
  return plot.level + 1 < PLOT_TOP[plot.kind] || lotOf(map, x, y) !== null;
}

function setLevel(map: PlotScanMap, x: number, y: number, sim: PlotSimData, plot: Plot, level: number): void {
  if (level < 0 || level > PLOT_TOP[plot.kind] || level === plot.level) return;
  const value = plot.kind === "industrial" ? Random.getRandom16() & 1 :
    ZoneUtils.getLandPollutionValue(sim.blockMaps, x, y);
  const powered = map.getTile(x, y).isPowered();
  map.setTile(x, y, plotTile(plot.kind, level, value, Random.getRandom(2)), BLBNCNBIT | (powered ? POWERBIT : 0));
  ZoneUtils.incRateOfGrowth(sim.blockMaps, x, y, level > plot.level ? 1 : -1);
}

/**
 * The map scanner found a tile of a home, shop or factory on a map with painted zones (src/mapScanner.js). Returns
 * false when it is not a plot (a tile of an old 3 × 3 zone), which then goes on as before. A plot is counted, takes
 * its water, now and then sends out traffic, and grows or shrinks by a level as a zone grows or shrinks by a size.
 */
export function plotFound(map: PlotScanMap, x: number, y: number, sim: PlotSimData): boolean {
  const plot = plotOf(map, x, y);
  if (!plot) return false;
  const { kind, level } = plot;
  const census = sim.census;
  const powered = map.getTile(x, y).isPowered();
  if (powered) census.poweredZoneCount += PLOT_SHARE;
  else census.unpoweredZoneCount += PLOT_SHARE;
  if (kind === "residential") {
    census.resZonePop += PLOT_SHARE;
    census.resPop += level;
  } else if (kind === "commercial") {
    census.comZonePop += PLOT_SHARE;
    census.comPop += level * PLOT_SHARE;
  } else {
    census.indZonePop += PLOT_SHARE;
    census.indPop += level * PLOT_SHARE;
  }

  // Water comes along the road the plot reaches (src/waterManager.ts); a house or the first size needs none
  const road = nearestRoad(map, x, y);
  const watered = sim.waterManager ?
    sim.waterManager.supplyPlot(x, y, road ? road.x : -1, road ? road.y : -1, census, level >= 1) : true;

  // Now and then, more often the bigger it is, it sends out a trip; with no road at all, its people move out
  let traffic = road ? ROUTE_FOUND : NO_ROAD_FOUND;
  const trips = kind === "commercial" && level > 0 ? level + (sim.touristTrips ?? 0) : level;
  if (trips > Random.getRandom(kind === "residential" ? 35 : 40)) {
    traffic = road && sim.trafficManager ?
      sim.trafficManager.makeTrafficFrom(road.x, road.y, x, y, sim.blockMaps, DESTINATIONS[kind]) : NO_ROAD_FOUND;
    if (traffic === NO_ROAD_FOUND) {
      setLevel(map, x, y, sim, plot, level - 1);
      return true;
    }
  }

  if (kind === "residential") {
    // An empty lot and a house are looked at every time, as a zone of houses is
    if (level > 1 && !Random.getChance(7)) return true;
    let score = sim.valves.resValve + homeScore(sim, x, y, traffic);
    // Without power nothing grows, and without water nothing grows past a house
    if (!powered || (!watered && level >= 1)) score = -500;
    if (grows(score)) {
      const crowd = sim.blockMaps.populationDensityMap.worldGet(x, y);
      if (sim.blockMaps.pollutionDensityMap.worldGet(x, y) <= 128 && (level === 0 || crowd > DENSITY_TO_RISE[level]) &&
          mayRise(map, x, y, plot))
        setLevel(map, x, y, sim, plot, level + 1);
    } else if (shrinks(score)) {
      setLevel(map, x, y, sim, plot, level - 1);
    }
    return true;
  }

  if (!Random.getChance(7)) return true;
  let score = kind === "commercial" ?
    sim.valves.comValve + (traffic === NO_ROAD_FOUND ? -3000 : sim.blockMaps.cityCentreDistScoreMap.worldGet(x, y)) :
    sim.valves.indValve + (traffic === NO_ROAD_FOUND ? -1000 : 0);
  if (!powered || (!watered && level > 1)) score = -500;
  if ((watered || level === 0) && grows(score)) {
    // A shop grows only as far as the land is worth (src/commercial.js)
    if ((kind !== "commercial" || level <= sim.blockMaps.landValueMap.worldGet(x, y) >> 5) && mayRise(map, x, y, plot))
      setLevel(map, x, y, sim, plot, level + 1);
  } else if (shrinks(score)) {
    setLevel(map, x, y, sim, plot, level - 1);
  }
  return true;
}
