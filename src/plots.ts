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
import type { RoadGraph } from "./roads/roadGraph";
import { isCityTileSize } from "./units";
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
  /** The roads in metres, every road of a real-scale city map among them (src/roads/roadCover.ts), and metres a tile */
  roadGraph?: RoadGraph | null;
  tileSizeM?: number | null;
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

/** How much further than its reach a road's middle line may lie from a tile's middle (metres): a line smoothed from a
 * staircase of tiles strays a little off the tiles' middles */
const REACH_SLACK_M = 2;

/** A road near a tile: where it comes nearest the tile's middle (metres), how far off, its segment and how far along */
type NearRoad = [x: number, z: number, distance: number, segment: number, t: number];

/** The roads near each tile, nearest first, while the graph stays as it is */
const nearby = new WeakMap<RoadGraph, { version: number; size: number; at: Map<number, NearRoad[]> }>();

/** The roads of the graph within PLOT_REACH of the middle of tile (x, y), nearest first */
function roadsNear(graph: RoadGraph, size: number, width: number, x: number, y: number): NearRoad[] {
  let known = nearby.get(graph);
  if (!known || known.version !== graph.version || known.size !== size) nearby.set(graph, known = { version: graph.version, size, at: new Map() });
  const key = y * width + x, had = known.at.get(key);
  if (had) return had;
  const p: [number, number] = [(x + 0.5) * size, (y + 0.5) * size], reach = PLOT_REACH * size + REACH_SLACK_M;
  const out: NearRoad[] = [];
  for (const id of graph.segmentsNear(p, reach)) {
    const near = graph.nearestOn(id, p);
    if (near.distance <= reach) out.push([near.point[0], near.point[1], near.distance, id, near.t]);
  }
  out.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1] || a[3] - b[3]);
  known.at.set(key, out);
  return out;
}

/** Whether a plot finds its road by the roads in metres (a real-scale city map's every road is in its graph) */
const byGraph = (map: PlotMap, x: number, y: number, reach: number): boolean =>
  Boolean(map.roadGraph?.segments.size) && isCityTileSize(map.tileSizeM) && reach <= PLOT_REACH && inside(map, x, y);

/**
 * Where a tile's way in meets its road, on a real-scale city map: the segment of the road graph, how far along it (0 at
 * its node a, 1 at b), and the road tile there, as nearestRoad finds it; null with none, or on any other map. The trips
 * start and end there (src/sim/trips.ts).
 */
export function plotAccess(map: PlotMap, x: number, y: number): { segment: number; t: number; x: number; y: number } | null {
  if (!byGraph(map, x, y, PLOT_REACH)) return null;
  const size = map.tileSizeM!, most = PLOT_REACH * size + REACH_SLACK_M;
  for (const [px, pz, d, segment, t] of roadsNear(map.roadGraph!, size, map.width, x, y)) {
    if (d > most) break;
    const tile = drivewayNear(map, size, px, pz);
    if (tile && (tile.x !== x || tile.y !== y)) return { segment, t, x: tile.x, y: tile.y };
  }
  return null;
}

/** The road tile a way in at (px, pz) metres lies on: the tile there, or the nearest beside it that is a road with a
 * way in for plots (drivewayAt), or null */
function drivewayNear(map: PlotMap, size: number, px: number, pz: number): { x: number; y: number } | null {
  const tx = Math.floor(px / size), ty = Math.floor(pz / size);
  if (drivewayAt(map, tx, ty)) return { x: tx, y: ty };
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = tx + dx, ny = ty + dy;
    if ((!dx && !dy) || !drivewayAt(map, nx, ny)) continue;
    const d = Math.hypot((nx + 0.5) * size - px, (ny + 0.5) * size - pz);
    if (d < bestD) { best = { x: nx, y: ny }; bestD = d; }
  }
  return best;
}

/**
 * The road a tile reaches, or null. On a real-scale city map (docs/NO_GRID_PLAN.md 0.5): the nearest road in any way,
 * a slanted one too, whose middle line comes within PLOT_REACH tiles (48 m) of the tile's middle, by the roads in metres
 * (src/roads/roadGraph.ts, which has every road of the map: src/roads/roadCover.ts); the road tile there is given. On
 * any other map, the nearest one straight north, east, south or west, within reach. So the plots along a road make a
 * band three deep on each side, as Cities: Skylines' zone cells do.
 */
export function nearestRoad(map: PlotMap, x: number, y: number, reach = PLOT_REACH): { x: number; y: number } | null {
  if (byGraph(map, x, y, reach)) {
    const size = map.tileSizeM!, most = reach * size + REACH_SLACK_M;
    for (const [px, pz, d] of roadsNear(map.roadGraph!, size, map.width, x, y)) {
      if (d > most) break;
      const tile = drivewayNear(map, size, px, pz);
      if (tile && (tile.x !== x || tile.y !== y)) return tile;
    }
    return null;
  }
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
  /** Why each plot is not growing, by tile (PLOT_WHY), as the last scan found it; made on the first scan, not saved */
  plotWhy?: Uint8Array | null;
  /** On a real-scale city map, what the month's trips on the road graph found (src/sim/cityTrips.ts): minutes from each
   * home tile to work, and from each shop or factory tile to the homes (NaN not known, Infinity none within reach) */
  trips?: { homeToWork: Float32Array; jobToHome: Float32Array } | null;
}

/** A commute this long or shorter (minutes) costs a place nothing; each minute more takes COMMUTE_COST off its score,
 * up to the trips' reach (src/sim/trips.ts TRIP_MINUTES, 30 minutes): a lenient start (docs/NO_GRID_PLAN.md 1.3, 8.1) */
export const COMMUTE_EASY = 10;
export const COMMUTE_COST = 40;

/**
 * How far a plot's trips go, on a real-scale city map (docs/NO_GRID_PLAN.md 1.3): from a home to the nearest work,
 * from a shop or factory to the nearest homes, in minutes along the roads as busy as the month's trips made them; NaN
 * when not known yet (a city just opened) or when the city has nowhere of that kind yet, Infinity when none is within
 * reach (cut off); null on any other map, whose trips still walk the tiles (src/traffic.js)
 */
export function tripMinutes(map: PlotScanMap, x: number, y: number, kind: PlotKind): number | null {
  if (!map.roadGraph?.segments.size || !isCityTileSize(map.tileSizeM)) return null;
  const trips = map.trips;
  if (!trips) return NaN;
  const i = y * map.width + x;
  return kind === "residential" ? trips.homeToWork[i] : trips.jobToHome[i];
}

/** What a commute this long takes off a place's score (none when not known) */
export const commuteCost = (minutes: number | null): number =>
  minutes !== null && Number.isFinite(minutes) && minutes > COMMUTE_EASY ? (minutes - COMMUTE_EASY) * COMMUTE_COST : 0;

/**
 * Why a plot does not grow, the first that holds it back (owner, 16 Oct 2026, docs/MUEANG_CS_PLAN.md M1.1: "the player
 * always knows why"): what the inspector says and the view shows over it. 0 is nothing: it grows when its turn comes.
 */
export const PLOT_WHY = ["none", "power", "water", "road", "pollution", "land", "demand", "quiet", "lot", "top"] as const;
export type PlotWhy = typeof PLOT_WHY[number];
const WHY = (why: PlotWhy): number => PLOT_WHY.indexOf(why);

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

/** Architectural branch codes by environmental class (0 = A basic, 1 = B standard, 2 = C good, 3 = D prime/luxury). */
export const PLOT_BRANCHES = ["A", "B", "C", "D"] as const;
export type PlotBranch = typeof PLOT_BRANCHES[number];

/** Returns a plot's branch & level code such as "A1", "B2", "C2", "D3", or "A0" when empty. */
export function plotBranchCode(plot: Plot): string {
  const branch = PLOT_BRANCHES[Math.max(0, Math.min(3, plot.value | 0))] ?? "A";
  return `${branch}${plot.level}`;
}

/**
 * Evaluates the surrounding environment of a plot at (x, y) to determine its architectural branch (0=A, 1=B, 2=C, 3=D).
 * Considers land value, pollution, nearby parks/trees/water (within 4 tiles), civic services (schools/hospitals/district
 * office within 6 tiles, counted along the streets' grid), and road level, so a building that starts as A1 automatically
 * upgrades to C2 or D3 when the surrounding environment improves. (The civic buildings were only looked for 4 tiles out
 * until docs/NO_GRID_PLAN.md 0.4.)
 */
export function plotEnvironmentClass(map: PlotMap, sim: PlotSimData, x: number, y: number, kind: PlotKind): number {
  const shield = sim.pollutionShield ?? 0;
  let score = sim.blockMaps.landValueMap.worldGet(x, y) - sim.blockMaps.pollutionDensityMap.worldGet(x, y) * (1 - shield);
  let natureBonus = 0;
  let civicBonus = 0;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy, dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 6 || !inside(map, nx, ny)) continue;
      const v = map.getTileValue(nx, ny);
      // Water (2..20), woods/trees (21..39), or park/fountain (840..849) within Manhattan distance 4
      if (dist <= 4 && ((v >= 2 && v <= 39) || (v >= 840 && v <= 849))) {
        natureBonus = Math.min(64, natureBonus + 16);
      }
      // Civic buildings (hospital, police, fire, school, ruler's house: 405..422, 761..778)
      if (dist <= 6 && ((v >= 405 && v <= 422) || (v >= 761 && v <= 778))) {
        civicBonus = Math.min(48, civicBonus + 24);
      }
    }
  }
  const road = nearestRoad(map, x, y);
  const roadBonus = road && roadLevelAt(map, road.x, road.y) >= 3 ? 20 : 0;
  score += natureBonus + civicBonus + roadBonus;
  if (kind === "industrial") {
    return score >= 85 ? 1 : (Random.getRandom16() & 1);
  }
  if (score < 30) return 0;
  if (score < 80) return 1;
  if (score < 140) return 2;
  return 3;
}

/** Whether a plot may grow a level: the top level only on a lot (lotOf). */
export function mayRise(map: PlotMap, x: number, y: number, plot: Plot): boolean {
  return plot.level + 1 < PLOT_TOP[plot.kind] || lotOf(map, x, y) !== null;
}

function setLevel(map: PlotScanMap, x: number, y: number, sim: PlotSimData, plot: Plot, level: number): void {
  if (level < 0 || level > PLOT_TOP[plot.kind]) return;
  const value = level === 0 ? 0 : plotEnvironmentClass(map, sim, x, y, plot.kind);
  if (level === plot.level && value <= plot.value) return;
  const powered = map.getTile(x, y).isPowered();
  map.setTile(x, y, plotTile(plot.kind, level, value, Random.getRandom(2)), BLBNCNBIT | (powered ? POWERBIT : 0));
  if (level !== plot.level) {
    ZoneUtils.incRateOfGrowth(sim.blockMaps, x, y, level > plot.level ? 1 : -1);
  }
}

/** What holds a plot back now (PLOT_WHY), from what plotFound weighs */
function plotWhyOf(map: PlotMap, x: number, y: number, sim: PlotSimData, plot: Plot, powered: boolean, watered: boolean,
                   noRoad: boolean): PlotWhy {
  const { kind, level } = plot, bm = sim.blockMaps;
  if (!powered) return "power";
  if (noRoad) return "road";
  if (!watered && level >= 1) return "water";
  if (level >= PLOT_TOP[kind]) return "top";
  const valve = kind === "residential" ? sim.valves.resValve : kind === "commercial" ? sim.valves.comValve : sim.valves.indValve;
  if (valve <= 0) return "demand";
  if (kind === "residential") {
    if (bm.pollutionDensityMap.worldGet(x, y) > 128) return "pollution";
    // A home whose place scores too low shrinks about as often as it grows (grows, shrinks)
    if (valve + homeScore(sim, x, y, ROUTE_FOUND) < 350) {
      return bm.pollutionDensityMap.worldGet(x, y) * 2 > bm.landValueMap.worldGet(x, y) ? "pollution" : "land";
    }
    if (level > 0 && bm.populationDensityMap.worldGet(x, y) <= DENSITY_TO_RISE[level]) return "quiet";
  } else if (kind === "commercial" && level > bm.landValueMap.worldGet(x, y) >> 5) {
    return "land";
  }
  return mayRise(map, x, y, plot) ? "none" : "lot";
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

  // Now and then, more often the bigger it is, it sends out a trip; with no road at all, its people move out. On a
  // real-scale city map the month's trips on the road graph say where they get and how long it takes (src/sim/trips.ts):
  // cut off from where its trips go (work for a home, homes for a shop or factory), it loses a level and scores as
  // without a road, and a long way there lowers its score (commuteCost)
  const minutes = tripMinutes(map, x, y, kind);
  const cutOff = minutes === Infinity;
  let traffic = road ? ROUTE_FOUND : NO_ROAD_FOUND;
  const trips = kind === "commercial" && level > 0 ? level + (sim.touristTrips ?? 0) : level;
  if (trips > Random.getRandom(kind === "residential" ? 35 : 40)) {
    if (minutes !== null) traffic = road ? ROUTE_FOUND : NO_ROAD_FOUND;
    else traffic = road && sim.trafficManager ?
      sim.trafficManager.makeTrafficFrom(road.x, road.y, x, y, sim.blockMaps, DESTINATIONS[kind]) : NO_ROAD_FOUND;
    if (traffic === NO_ROAD_FOUND || (road && cutOff)) {
      setLevel(map, x, y, sim, plot, level - 1);
      return true;
    }
  }

  // Why it does not grow, without a draw of the random numbers, so the city is the same with or without it
  if (map.plotWhy !== undefined) {
    const why = map.plotWhy ?? (map.plotWhy = new Uint8Array(map.width * map.height));
    why[y * map.width + x] = WHY(plotWhyOf(map, x, y, sim, plot, powered, watered, traffic === NO_ROAD_FOUND || cutOff));
  }

  if (kind === "residential") {
    // An empty lot and a house are looked at every time, as a zone of houses is
    if (level > 1 && !Random.getChance(7)) return true;
    let score = sim.valves.resValve + homeScore(sim, x, y, cutOff ? NO_ROAD_FOUND : traffic) - commuteCost(minutes);
    // Without power nothing grows, and without water nothing grows past a house
    if (!powered || (!watered && level >= 1)) score = -500;
    if (grows(score)) {
      const crowd = sim.blockMaps.populationDensityMap.worldGet(x, y);
      if (sim.blockMaps.pollutionDensityMap.worldGet(x, y) <= 128 && (level === 0 || crowd > DENSITY_TO_RISE[level]) &&
          mayRise(map, x, y, plot))
        setLevel(map, x, y, sim, plot, level + 1);
      else if (level >= 1 && sim.blockMaps.pollutionDensityMap.worldGet(x, y) <= 128)
        setLevel(map, x, y, sim, plot, level);
    } else if (shrinks(score)) {
      setLevel(map, x, y, sim, plot, level - 1);
    }
    return true;
  }

  if (!Random.getChance(7)) return true;
  // (cut off from where its trips go, it scores as with no road: src/sim/trips.ts)
  const stuck = traffic === NO_ROAD_FOUND || cutOff;
  let score = (kind === "commercial" ?
    sim.valves.comValve + (stuck ? -3000 : sim.blockMaps.cityCentreDistScoreMap.worldGet(x, y)) :
    sim.valves.indValve + (stuck ? -1000 : 0)) - commuteCost(minutes);
  if (!powered || (!watered && level > 1)) score = -500;
  if ((watered || level === 0) && grows(score)) {
    // A shop grows only as far as the land is worth (src/commercial.js)
    if ((kind !== "commercial" || level <= sim.blockMaps.landValueMap.worldGet(x, y) >> 5) && mayRise(map, x, y, plot))
      setLevel(map, x, y, sim, plot, level + 1);
    else if (level >= 1)
      setLevel(map, x, y, sim, plot, level);
  } else if (shrinks(score)) {
    setLevel(map, x, y, sim, plot, level - 1);
  }
  return true;
}
