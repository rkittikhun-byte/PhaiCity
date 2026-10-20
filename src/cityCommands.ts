/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every change a player makes to a city is a plain, serializable command applied here, through one entry
// point (docs/ONLINE_PLAN.md section 13, rule 1). The mouse and the windows only describe what the player
// asked for; CityCommands checks it and changes the city. In the online game a server can receive, check
// and replay the same commands. No DOM, jQuery or window here, so this also runs in Node.
// Looking at the city (the query tool, opening windows) is not a change, so it is not a command.
// Building can be undone (src/undoHistory.ts): tool commands of one stroke form one step, and "undo" takes the last
// step back, tiles and money.
// On a province map only the province's own tiles can be built on (docs/geo/GEO_SPEC.md section 10): a tool whose
// footprint touches a tile outside it is refused, the bulldozer included. The roads and railways the map starts
// with are the state's (owner, 12 Oct 2026): the state pays for them and they never wear out (src/road.js), but the
// player may build over them and widen them like any road.
// A new city builds its ruler's house before anything else (src/rulerHouse.ts, owner 13 Oct 2026): until it stands
// only the house and the bulldozer are allowed; there is one house, and its next level needs the ruler's rank.

import { CANAL_TOOL, isWaterTile } from "./canals";
import { besideWater3, farmLevel, fisheryLevel } from "./farming";
import { canDig, MINE_KINDS } from "./mining";
import { isRoadTile } from "./roadLevels";
import { RoadGraph } from "./roads/roadGraph";
import { segmentTiles } from "./roads/roadRaster";
import { cutTile } from "./roads/roadCut";
import { isAnyRail, isAnyRoad } from "./roadTiles";
import { linePrice } from "./roads/roadDraw";
import { tileMetres, tileOfUnits, unitsPerMetre } from "./units";
import { blockOf, PlacedBuildings } from "./buildings/placedBuildings";
import type { BuildingMap } from "./buildings/buildingRecords";
import { movePrice, moveProblem } from "./moveTool";
import { LINE_SHAPES, type LineShape, MAX_ROAD_PIECE, type RoadPath } from "./roadPieces";
import { besideWater, canBuildKind, POWER_KINDS } from "./powerPlants";
import { changeWing, type HouseMap, houseProblem, houseRoadProblem, houseStanding, WINGS, wingProblem } from "./rulerHouse";
import { changePolicy, POLICIES, type PolicyMap, policyProblem, trimPolicies } from "./policies";
import { STATION_KINDS, transitProblem } from "./transit";
import { buyBlock, LAND_ALL_OPEN, LAND_LOCKED, type LandMap, landProblem } from "./landBlocks";
import { serviceProblem } from "./services";
import { type CellMap, type CellPlotMap, CELL_ZONES, type CellZone, cellPrice, cellsOf, paintNear, plotTileOfCell, syncCellPlots, tileRasterKeys, zoneCode } from "./zoneCells";
import { PAINT_PRICE_SHARE } from "./plots";
import { BUILDING_UPGRADE_TOOL, levelProblem } from "./buildingLevels";
import { upgradeProblem } from "./buildingUpgradeTool";
import { ALLBITS, BIT_MASK, BULLBIT } from "./tileFlags";
import { LASTRAIL, RAILBASE } from "./tileValues";
import { UndoHistory, type UndoStep } from "./undoHistory";
import { placesBuilding } from "./gameTools.js";

export const TOOL_NAMES = [
  "residential", "commercial", "industrial", "road", "rail", "wire", "park", "bulldozer",
  "police", "fire", "coal", "nuclear", "stadium", "port", "airport", "waterworks", "watertower", "gas", "hydro", "solar",
  "wind", "limestone_mine", "potash_mine", "tin_mine", "zinc_mine", "gold_mine", "gem_mine", "rare_earth_mine", "lignite_mine",
  "oil_well", "farm", "fishing", "road_asphalt", "road_concrete2", "road_concrete4", "road_concrete6", "road_concrete8",
  "motorway", "tollway", "road_upgrade", "ruler_house", "ruler_house_upgrade", "kindergarten", "primary_school",
  "secondary_school", "vocational_college", "university", "health_centre", "community_hospital", "provincial_hospital",
  "regional_hospital", "landfill", "incinerator", "recycling_plant", "waste_power_plant", "wastewater_plant", "bus_stop", "train_station", "metro_station", "hsr_station",
  "zone_residential", "zone_commercial", "zone_industrial", "zone_erase",
  "police_box", "police_large", "police_hq", "fire_post", "fire_centre", "building_upgrade", "canal",
] as const;
export type ToolName = typeof TOOL_NAMES[number];

export const DISASTERS = ["fire", "flood", "tornado", "monster", "crash", "meltdown"] as const;
export type DisasterName = typeof DISASTERS[number];

export const SETTINGS = ["autoBudget", "autoBulldoze", "disasters"] as const;
export type SettingName = typeof SETTINGS[number];

/** The simulation's speeds: 0 paused, 1 slow, 2 medium, 3 fast. */
export const MAX_SPEED = 3;
export const MAX_TAX = 20;
/** The water fee in baht a year for each zone the water reaches, and the visitors' fee in percent (src/budget.js) */
export const MAX_WATER_FEE = 10;
export const MAX_TOURIST_FEE = 20;
/** What the debug window's "add funds" gives. */
export const DEBUG_FUNDS = 20000;
/** Why a tool was refused on a tile outside the province. */
export const OUTSIDE_PROVINCE = "outside the province";
/** Why a kind of power plant was refused: the province lacks what it runs on (src/powerPlants.ts). */
export const NO_RESOURCE = "not in this province";
/** Why a dam was refused: no river or lake beside it. */
export const NEEDS_WATER = "needs water beside it";
/** Why zone cells were refused: the map's zones go a tile at a time, every cell was already so, or too little money */
export const NO_CELL_ZONES = "zones are painted a tile at a time here";
export const NOTHING_TO_PAINT = "nothing to paint";
export const NO_MONEY_FOR_CELLS = "not enough money";
/** Why a building was refused on a map painted a cell at a time: every building there stands beside a road */
export const NEEDS_ROAD_BESIDE = "needs a road beside it";
/** The most cells one command paints */
export const MAX_CELLS = 4000;

export type Command =
  /** stroke: the same number for every command of one press of the mouse, so they undo together. */
  | { type: "tool"; tool: ToolName; x: number; y: number; stroke?: number;
      /** Where a building beside a road is drawn, slid along it a cell at a time: x, z (world units), turn (radians) */
      pose?: [number, number, number];
      /** A road or railway: which line of the stroke it is (a grid's rows and columns are lines of their own), and how
       * that line was drawn, with the points a clicked one was drawn through (src/roadPieces.ts RoadPath) */
      part?: number; shape?: LineShape; controls?: Array<[number, number]> }
  /**
   * A road or railway drawn in metres (docs/METRE_DRAWING_PLAN.md 1.3): from one end to the other, a curve through its
   * two inner control points (x east, z south, metres from the map's corner). It is laid on the tiles its middle line
   * passes (src/roads/roadRaster.ts) as the tool lays a tile, and kept as drawn in the map's road graph
   * (src/roads/roadGraph.ts) once every one of those tiles is a road; a stroke undoes with the tiles. Priced by the
   * metre (src/roads/roadDraw.ts linePrice). part: which line of the stroke it is (a grid's rows and columns); the
   * roads of one line drawn freely, one after another, are one drawn line.
   */
  | { type: "road"; tool: ToolName; from: [number, number]; to: [number, number]; c1?: [number, number];
      c2?: [number, number]; stroke: number; part?: number }
  /**
   * A building put down in metres (docs/METRE_DRAWING_PLAN.md 2.1): its middle (x east, z south, metres from the map's
   * corner) and its turn (radians), as its outline showed it. Its tiles are the block round the tile its middle lies on
   * (src/buildings/placedBuildings.ts blockOf), never another place, laid as the tool lays a building, and it is kept
   * where it was put (gameMap.buildings, where the 3D view reads it).
   */
  | { type: "build"; tool: ToolName; x: number; z: number; rot: number; stroke?: number }
  /**
   * A building the player moves (docs/METRE_DRAWING_PLAN.md 2.5): slid along its road or turned, to the middle (metres)
   * and turn the move tool showed, the building being gameMap.buildings' id. For now it stays on the block of tiles it
   * stands on, as the simulation counts it there. A tenth of its price; undo puts it back, and the money.
   */
  | { type: "move"; id: number; x: number; z: number; rot: number; stroke?: number }
  | { type: "undo" }
  /**
   * Tax rate in percent (0-20; the homes', and the shops' and factories' unless given) and the share of each service's
   * request funded (0-100). yearEnd answers the yearly budget. PhaiCity (src/budget.js): comTax and indTax (0-20), the
   * water fee in baht a year a watered zone (0-10) and the visitors' fee in percent (0-20); any left out stay as they are.
   */
  | { type: "budget"; tax: number; road: number; fire: number; police: number; yearEnd: boolean; comTax?: number;
      indTax?: number; waterFee?: number; touristFee?: number }
  | { type: "disaster"; disaster: DisasterName }
  | { type: "setting"; setting: SettingName; on: boolean }
  | { type: "speed"; speed: number }
  /** A wing of the ruler's house built (add) or taken off (src/rulerHouse.ts) */
  | { type: "wing"; wing: typeof WINGS[number]; add: boolean }
  /** One of the ruler's policies switched on or off (src/policies.ts) */
  | { type: "policy"; policy: typeof POLICIES[number]; on: boolean }
  /** The block of land at (x, y) bought (src/landBlocks.ts) */
  | { type: "land"; x: number; y: number }
  /** Zone cells painted (zone) or cleared (zone null) on a map whose zones go a cell at a time (src/zoneCells.ts) */
  | { type: "zoneCells"; zone: CellZone | null; cells: number[] }
  | { type: "debugFunds" };

export interface CommandOutcome {
  accepted: boolean;
  /** Why a command was refused. */
  reason?: string;
  /** For tools: the tool's result code (BaseTool TOOLRESULT_*). */
  toolResult?: number | null;
  /** For undo: whether there was a recent step to take back. */
  undone?: boolean;
}

interface CommandTool {
  result: number | null;
  /** Buildings: the side of their square, centred one tile in from its top-left corner; other tools cover one tile */
  size?: number;
  doTool(x: number, y: number, blockMaps: unknown): void;
  modifyIfEnoughFunding(budget: unknown): boolean;
  /** The tiles the tool is about to change (src/baseTool.js), for undo. */
  pendingTiles?(): Array<{ x: number; y: number }>;
  /** The kind of power plant it builds (src/gameTools.js, src/powerPlants.ts) */
  powerKind?: string;
  /** Puts a bus down on the road (src/busStopTool.ts) */
  busTool?: boolean;
  /** The kind of mine it digs (src/mining.ts) */
  mineKind?: string;
  /** The level of the roads it lays (src/roadLevels.ts) */
  roadLevel?: number;
  /** It changes what undo cannot put back (the road upgrade tool) */
  noUndo?: boolean;
  /** It builds the ruler's house (src/rulerHouse.ts) */
  rulerHouse?: boolean;
  /** The school or hospital it builds on the civic tiles (src/services.ts) */
  civicKind?: string;
  /** The rubbish or wastewater building it builds (src/waste.ts) */
  wasteKind?: string;
  /** Its price before the province's factor, and that factor (src/baseTool.js) */
  toolCost?: number;
  costFactor?: number;
  /** The level of a building it builds (src/buildingLevels.ts) */
  buildingLevel?: { group: string; level: number } | null;
  /** The stop or station it builds (src/transit.ts) */
  transitKind?: string;
}

/** The map, for undo: reading tiles before and after a tool, and putting them back. */
interface CommandMap {
  getTile(x: number, y: number): { getRawValue(): number };
  setTile(x: number, y: number, value: number, flags: number): void;
}

/** The parts of a city that commands change; game.js builds it from the simulation. */
export interface CommandTarget {
  readonly width: number;
  readonly height: number;
  readonly tools: Partial<Record<string, CommandTool>>;
  readonly blockMaps: unknown;
  readonly budget: {
    roadPercent: number;
    firePercent: number;
    policePercent: number;
    setTax(tax: number): void;
    /** The shops' and factories' taxes and the two fees; any left undefined stay as they are (src/budget.js) */
    setTaxes?(rates: { commercial?: number; industrial?: number; water?: number; tourist?: number }): void;
    doBudgetWindow(): void;
    updateFundEffects(): void;
    setAutoBudget(on: boolean): void;
    spend(amount: number): void;
    readonly totalFunds: number;
  };
  readonly disasters: {
    disastersEnabled: boolean;
    makeFire(): void;
    makeFlood(): void;
    makeCrash(): void;
    makeMeltdown(): void;
  };
  readonly sprites: { makeMonster(): void; makeTornado(): void };
  setSpeed(speed: number): void;
  setAutoBulldoze(on: boolean): void;
  /** For undo; without it, nothing can be undone. */
  readonly map?: CommandMap;
  /** The simulation's cityTime (4 a month), so only recent building can be undone. */
  cityTime?(): number;
  /** Whether a tile may be built on: false outside the province on a province map. Without it, every tile may. */
  canBuildAt?(x: number, y: number): boolean;
  /** Whether the city owns the land at (x, y) (src/landBlocks.ts). Without it, all the land is the city's. */
  ownsLand?(x: number, y: number): boolean;
  /** The province's resource levels, which decide its kinds of power plant; none on a practice map. */
  resources?: Readonly<Record<string, number>> | null;
  /** Whether a tile is open water, for dams. Without it, a dam may stand anywhere. */
  isWaterAt?(x: number, y: number): boolean;
  /** Whether a tile is a railway, for train stations (src/transit.ts). Without it, a station may stand anywhere. */
  isRailAt?(x: number, y: number): boolean;
  /** Records the kind of power plant built at (x, y), its centre (src/powerPlants.ts). */
  setPowerKind?(x: number, y: number, kind: string): void;
  /** Records the kind of mine dug at (x, y), its centre (src/mining.ts). */
  setMineKind?(x: number, y: number, kind: string): void;
  /** Records the level of a road just laid at (x, y) (src/roadLevels.ts). */
  setRoadLevel?(x: number, y: number, level: number): void;
  /** A new drawn line's number, and the line a road just laid at (x, y) belongs to (src/roadPieces.ts). */
  newRoadPiece?(): number;
  setRoadPiece?(x: number, y: number, piece: number): void;
  /** The piece of the road or railway at (x, y), and a piece's tiles in the order they were drawn (src/roadPieces.ts) */
  roadPieceAt?(x: number, y: number): number;
  setRoadPath?(piece: number, path: RoadPath | null): void;
  /** The map's ruler's house and whether the city is new (src/rulerHouse.ts). Without it, no house is asked for. */
  readonly houseMap?: HouseMap;
  /** The ruler's rank, 0 (หมื่น) to 5 (เจ้าพระยา) (src/rulerRank.ts) */
  rank?(): number;
  /** Records the ruler's house just built at (x, y), its centre. */
  setRulerHouse?(x: number, y: number): void;
  /** Records the school or hospital just built at (x, y), its centre (src/services.ts). */
  setCivicKind?(x: number, y: number, kind: string): void;
  /** Records the rubbish or wastewater building just built at (x, y), its centre (src/waste.ts). */
  setWasteKind?(x: number, y: number, kind: string): void;
  setBuildingLevel?(x: number, y: number, level: number): void;
  /** A bus put down on the road at (x, y) (src/busStopTool.ts) */
  addBus?(x: number, y: number): void;
  /** Records the station just built at (x, y), its centre (src/transit.ts). */
  setStationKind?(x: number, y: number, kind: string): void;
  /** Records a canal just dug at (x, y), and whether (x, y) was dug as one and is still its water or a bridge over it
   * (src/canals.ts) */
  setCanal?(x: number, y: number): void;
  canalAt?(x: number, y: number): boolean;
  /** Water came or went somewhere, so the ground's water is worked out again (src/waterManager.ts refreshGround) */
  waterChanged?(): void;
}

/** Why a tool may not be used at (x, y): outside the province, or null when it may. */
export function placeProblem(city: Pick<CommandTarget, "canBuildAt" | "ownsLand">, x: number, y: number,
                             size: number): string | null {
  const canBuildAt = city.canBuildAt;
  const tiles = footprint(x, y, size);
  if (canBuildAt && tiles.some((t) => !canBuildAt(t.x, t.y))) return OUTSIDE_PROVINCE;
  // ... and land the city has not bought (src/landBlocks.ts)
  const ownsLand = city.ownsLand;
  return ownsLand && tiles.some((t) => !ownsLand(t.x, t.y)) ? LAND_LOCKED : null;
}

/** Why a kind of power plant may not be built at (x, y): the province lacks its resource, or a dam has no water. */
export function plantProblem(city: Pick<CommandTarget, "resources" | "isWaterAt">, kind: string | undefined,
                             x: number, y: number): string | null {
  if (!kind || !isOneOf(POWER_KINDS, kind)) return null;
  if (!canBuildKind(kind, city.resources ?? {})) return NO_RESOURCE;
  const isWaterAt = city.isWaterAt;
  if (kind === "hydro" && isWaterAt && !besideWater(x, y, isWaterAt)) return NEEDS_WATER;
  return null;
}

/** Why a kind of mine may not be dug: the province has none of that ore (src/mining.ts). */
export function mineProblem(city: Pick<CommandTarget, "resources">, kind: string | undefined): string | null {
  if (!kind || !isOneOf(MINE_KINDS, kind)) return null;
  return canDig(kind, city.resources ?? {}) ? null : NO_RESOURCE;
}

/** Why a farm or a fishing harbour may not be built: no farmland or fishing in the province, or no water beside it. */
export function farmProblem(city: Pick<CommandTarget, "resources" | "isWaterAt">, tool: string, x: number,
                            y: number): string | null {
  const resources = city.resources ?? {};
  if (tool === "farm") return farmLevel(resources) >= 1 ? null : NO_RESOURCE;
  if (tool !== "fishing") return null;
  if (fisheryLevel(resources) < 1) return NO_RESOURCE;
  const isWaterAt = city.isWaterAt;
  return isWaterAt && !besideWater3(x, y, isWaterAt) ? NEEDS_WATER : null;
}

/** The tiles a tool covers when used at (x, y), as src/cityView.ts toolFootprint and src/buildingTool.js see it. */
export function footprint(x: number, y: number, size: number): Array<{ x: number; y: number }> {
  const offset = size > 2 ? 1 : 0;
  const tiles = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) tiles.push({ x: x - offset + dx, y: y - offset + dy });
  }
  return tiles;
}

/** A line's point (src/roadPieces.ts controls) on a map size tiles across: a tile, or where a road was joined between
 * tiles' middles, so as far as half a tile before the first */
const onMap = (value: unknown, size: number): boolean => typeof value === "number" && Number.isFinite(value) && value >= -0.5 && value <= size - 0.5;
const isInteger = (value: unknown, min: number, max: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Why a command cannot be applied to a map of this size, or null when it can. Commands may come from anywhere. */
/**
 * On a map painted a cell at a time (src/zoneCells.ts), every building of 3 × 3 tiles and up stands beside a road, as in
 * Cities: Skylines, and the 3D view sets it against the road's edge (owner, 14 Oct 2026: "ตั้งให้ แต่ละ object ต้อง snap
 * กับถนน เท่านั้น"); the ruler's house has its own check (houseRoadProblem)
 */
function roadBesideProblem(city: CommandTarget, toolName: string, size: number, x: number, y: number): string | null {
  const map = city.map as unknown as { cellZones?: boolean } | undefined;
  const isBuilding = size >= 3 || placesBuilding(toolName, city.tools[toolName]);
  if (!map?.cellZones || !isBuilding || toolName === "ruler_house" || isOneOf(["residential", "commercial", "industrial"], toolName)) {
    return null;
  }
  return besideRoad(city.width, city.height, (rx, ry) => isRoadTile(city.map!.getTile(rx, ry).getRawValue() & BIT_MASK), x, y, size)
    ? null : NEEDS_ROAD_BESIDE;
}

const isRailTile = (value: number): boolean => value >= RAILBASE && value <= LASTRAIL;

/** Whether a building of size tiles centred at (x, y) has a road tile along one of its sides (isRoad(x, y)) */
export function besideRoad(width: number, height: number, isRoad: (x: number, y: number) => boolean,
  x: number, y: number, size: number): boolean {
  const offset = size > 1 ? 1 : 0;
  const left = x - offset, top = y - offset, right = left + size - 1, bottom = top + size - 1;
  const road = (rx: number, ry: number): boolean => rx >= 0 && ry >= 0 && rx < width && ry < height && isRoad(rx, ry);
  for (let k = left; k <= right; k++) if (road(k, top - 1) || road(k, bottom + 1)) return true;
  for (let k = top; k <= bottom; k++) if (road(left - 1, k) || road(right + 1, k)) return true;
  return false;
}

export function commandProblem(command: unknown, width: number, height: number): string | null {
  if (typeof command !== "object" || command === null) return "not a command";
  const c = command as Record<string, unknown>;
  switch (c.type) {
    case "tool":
      if (!isOneOf(TOOL_NAMES, c.tool)) return `unknown tool ${String(c.tool)}`;
      if (!isInteger(c.x, 0, width - 1) || !isInteger(c.y, 0, height - 1)) return "outside the map";
      if (c.stroke !== undefined && !isInteger(c.stroke, 0, Number.MAX_SAFE_INTEGER)) return "bad stroke";
      if (c.pose !== undefined && !(Array.isArray(c.pose) && c.pose.length === 3 && c.pose.every((n) => Number.isFinite(n)))) {
        return "bad pose";
      }
      if (c.part !== undefined && !isInteger(c.part, 0, 100000)) return "bad part";
      if (c.shape !== undefined && !isOneOf(LINE_SHAPES, c.shape)) return "bad shape";
      if (c.controls !== undefined && !(Array.isArray(c.controls) && c.controls.length >= 2 && c.controls.length <= 4 &&
        c.controls.every((p) => Array.isArray(p) && p.length === 2 && onMap(p[0], width) && onMap(p[1], height)))) {
        return "bad controls";
      }
      return null;
    case "road": {
      if (!isOneOf(TOOL_NAMES, c.tool)) return `unknown tool ${String(c.tool)}`;
      if (!isInteger(c.stroke, 0, Number.MAX_SAFE_INTEGER)) return "bad stroke";
      const point = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" &&
        Number.isFinite(n) && n >= 0);
      if (!point(c.from) || !point(c.to)) return "bad ends";
      if ((c.c1 === undefined) !== (c.c2 === undefined)) return "a curve needs both control points";
      if (c.c1 !== undefined && (!point(c.c1) || !point(c.c2))) return "bad controls";
      if (c.part !== undefined && !isInteger(c.part, 0, 10000)) return "bad part";
      return null;
    }
    case "build": {
      if (!isOneOf(TOOL_NAMES, c.tool)) return `unknown tool ${String(c.tool)}`;
      const metres = (n: unknown): boolean => typeof n === "number" && Number.isFinite(n) && n >= 0;
      if (!metres(c.x) || !metres(c.z)) return "outside the map";
      if (typeof c.rot !== "number" || !Number.isFinite(c.rot)) return "bad turn";
      if (c.stroke !== undefined && !isInteger(c.stroke, 0, Number.MAX_SAFE_INTEGER)) return "bad stroke";
      return null;
    }
    case "move": {
      if (!isInteger(c.id, 1, Number.MAX_SAFE_INTEGER)) return "bad building";
      const metres = (n: unknown): boolean => typeof n === "number" && Number.isFinite(n) && n >= 0;
      if (!metres(c.x) || !metres(c.z)) return "outside the map";
      if (typeof c.rot !== "number" || !Number.isFinite(c.rot)) return "bad turn";
      if (c.stroke !== undefined && !isInteger(c.stroke, 0, Number.MAX_SAFE_INTEGER)) return "bad stroke";
      return null;
    }
    case "undo":
      return null;
    case "budget":
      if (!isInteger(c.tax, 0, MAX_TAX)) return "tax out of range";
      for (const service of ["road", "fire", "police"]) {
        if (!isInteger(c[service], 0, 100)) return `${service} funding out of range`;
      }
      for (const [rate, max] of [["comTax", MAX_TAX], ["indTax", MAX_TAX], ["waterFee", MAX_WATER_FEE],
        ["touristFee", MAX_TOURIST_FEE]] as const) {
        if (c[rate] !== undefined && !isInteger(c[rate], 0, max)) return `${rate} out of range`;
      }
      return typeof c.yearEnd === "boolean" ? null : "yearEnd missing";
    case "disaster":
      return isOneOf(DISASTERS, c.disaster) ? null : `unknown disaster ${String(c.disaster)}`;
    case "setting":
      if (!isOneOf(SETTINGS, c.setting)) return `unknown setting ${String(c.setting)}`;
      return typeof c.on === "boolean" ? null : "setting value missing";
    case "speed":
      return isInteger(c.speed, 0, MAX_SPEED) ? null : "speed out of range";
    case "wing":
      if (!isOneOf(WINGS, c.wing)) return `unknown wing ${String(c.wing)}`;
      return typeof c.add === "boolean" ? null : "add missing";
    case "land":
      return isInteger(c.x, 0, width - 1) && isInteger(c.y, 0, height - 1) ? null : "outside the map";
    case "policy":
      if (!isOneOf(POLICIES, c.policy)) return `unknown policy ${String(c.policy)}`;
      return typeof c.on === "boolean" ? null : "on missing";
    case "zoneCells":
      if (c.zone !== null && !isOneOf(CELL_ZONES, c.zone)) return `unknown zone ${String(c.zone)}`;
      if (!Array.isArray(c.cells) || c.cells.length > MAX_CELLS || !c.cells.every((k) => isInteger(k, 0, Number.MAX_SAFE_INTEGER))) {
        return "bad cells";
      }
      return null;
    case "debugFunds":
      return null;
    default:
      return `unknown command type ${String(c.type)}`;
  }
}

export class CityCommands {
  private readonly history = new UndoHistory();
  /** The graph the latest stroke of road commands drew in, marked for undo before its first road (road) */
  private graphMark: { stroke: number; graph: RoadGraph; step: UndoStep } | null = null;
  /** The drawn line the latest stroke of a road tool lays (src/roadPieces.ts) */
  private roadPiece: { stroke: string; piece: number } | null = null;
  /** ... and the tiles of that line in the order drawn, a path while each is beside the last and none comes twice */
  private roadPath: { stroke: string; path: RoadPath; valid: boolean } | null = null;
  /** The tiles a stroke of a road, railway, canal or the bulldozer changed on a map painted a cell at a time, whose
   * plots are worked out again once, when the stroke is done (settle), not after each of its tiles: the cells along
   * every road of a city map are laid again each time, about 300 ms, so an 18-tile road held the game for 5 s */
  private cellsPending: { stroke: string; tiles: Set<number> } | null = null;

  /** A road or railway stroke's next tile, kept so the line's shape is worked out once from them (src/roadPieces.ts) */
  private followPath(stroke: string, x: number, y: number, shape?: LineShape, controls?: Array<[number, number]>): void {
    const city = this.city, width = city.width, index = y * width + x;
    const value = city.map!.getTile(x, y).getRawValue() & BIT_MASK;
    const piece = isRoadTile(value) || isRailTile(value) ? city.roadPieceAt?.(x, y) ?? 0 : 0;
    if (this.roadPath?.stroke !== stroke) this.roadPath = { stroke, path: { from: piece, to: 0, tiles: [] }, valid: true };
    const record = this.roadPath, tiles = record.path.tiles, last = tiles[tiles.length - 1];
    if (shape) record.path.shape = shape;
    if (controls) record.path.controls = controls.map(([cx, cy]) => [cx, cy]);
    if (last === index) return;
    if (last !== undefined) {
      const lx = last % width, ly = (last - lx) / width;
      if (Math.abs(lx - x) + Math.abs(ly - y) !== 1 || tiles.includes(index)) record.valid = false;
    }
    tiles.push(index);
    record.path.to = piece;
  }

  constructor(private readonly city: CommandTarget) {}

  /** A road drawn in metres (the "road" command): its tiles laid one by one as the tool lays them, then the road kept as
   * drawn in the road graph when every one of them is a road */
  private road(command: Extract<Command, { type: "road" }>): CommandOutcome {
    const city = this.city, map = city.map, tool = city.tools[command.tool];
    if (!map || !tool) return { accepted: false, reason: `no ${command.tool} tool` };
    const rail = command.tool === "rail";
    if (!tool.roadLevel && !rail) return { accepted: false, reason: "not a road or railway tool" };
    const size = tileMetres(map as { tileSizeM?: number | null }), width = city.width, height = city.height;
    const ends = [command.from, command.to, command.c1, command.c2].filter((p): p is [number, number] => p !== undefined);
    if (ends.some(([x, z]) => x > width * size || z > height * size)) return { accepted: false, reason: "outside the map" };
    const drawn = { from: command.from, to: command.to, c1: command.c1, c2: command.c2, level: tool.roadLevel ?? 1 };
    // Its tiles, from one end to the other, worked out on a graph of its own so nothing is split yet
    const draft = new RoadGraph(), made = draft.add(drawn).segments;
    if (!made.length) return { accepted: false, reason: "too short" };
    const tiles = made.flatMap((id) => segmentTiles(draft, id, { width, height, tileSizeM: size }));
    if (!tiles.length) return { accepted: false, reason: "outside the map" };
    // The line as the tiles' road pieces keep it (src/roadPieces.ts), in tiles: each point half a tile back, so a tile's
    // middle is its point
    const inTiles = (p: [number, number]): [number, number] =>
      [Math.round((p[0] / size - 0.5) * 100) / 100, Math.round((p[1] / size - 0.5) * 100) / 100];
    // ... a line drawn freely, road after road in one line of a stroke, keeps its tiles smoothed
    const line = `${command.stroke}:${command.part ?? 0}`, more = this.roadPath?.stroke === line && this.roadPath.path.tiles.length > 0;
    const shape: LineShape = more ? "free" : command.c1 ? "curve" : "straight";
    const controls = more ? undefined : (command.c1 && command.c2 ? [command.from, command.c1, command.c2, command.to] :
      [command.from, command.to]).map(inTiles);
    let laid = 0, reason: string | undefined;
    const costs: number[] = [];
    for (const i of tiles) {
      const x = i % width, y = (i - x) / width, funds = city.budget.totalFunds;
      const out = this.apply({ type: "tool", tool: command.tool, x, y, stroke: command.stroke, part: command.part, shape,
        ...(controls ? { controls } : {}) });
      costs.push(funds - city.budget.totalFunds);
      if (out.accepted && out.toolResult === 0) laid++;
      else if (!out.accepted && reason === undefined) reason = out.reason;
    }
    const isLine = rail ? isRailTile : isRoadTile;
    const whole = tiles.every((i) => isLine(map.getTile(i % width, Math.floor(i / width)).getRawValue() & BIT_MASK));
    if (whole) {
      // Railways in a graph of their own: a railway crossing a road is a level crossing, not a junction
      const graphs = map as { roadGraph?: RoadGraph; railGraph?: RoadGraph };
      const graph = rail ? graphs.railGraph ??= new RoadGraph() : graphs.roadGraph ??= new RoadGraph();
      // ... taken back whole with its stroke's tiles on undo (docs/METRE_DRAWING_PLAN.md 1.7): marked where the graph
      // stood before the stroke's first road
      const marked = this.graphMark;
      if (!marked || marked.stroke !== command.stroke || marked.graph !== graph || marked.step !== this.history.last()) {
        const mark = graph.mark();
        const step = this.history.attach(command.stroke, () => graph.undo(mark), city.cityTime?.() ?? 0);
        this.graphMark = { stroke: command.stroke, graph, step };
      }
      // ... with the piece its stroke laid (none when every tile was a road already)
      const piece = this.roadPiece?.stroke === line ? this.roadPiece.piece : 0;
      graph.add({ ...drawn, ...(piece ? { piece } : {}) });
      // Priced by the metre: the tiles' costs put right to the road's length (undone with the stroke)
      const each = Math.round((tool.toolCost ?? 0) * (tool.costFactor ?? 1));
      const length = made.reduce((sum, id) => sum + draft.length(id), 0);
      const spent = costs.reduce((sum, cost) => sum + cost, 0), price = linePrice(each, size, length, costs);
      if (price !== spent) {
        city.budget.spend(price - spent);
        this.history.record(command.stroke, [], price - spent, city.cityTime?.() ?? 0);
      }
    }
    if (!laid && !whole) return { accepted: false, reason: reason ?? "nothing laid" };
    return { accepted: true, toolResult: whole ? 0 : null, ...(whole ? {} : { reason: reason ?? "partly laid" }) };
  }

  /** A building put down in metres (the "build" command): laid on the block round the tile its middle lies on, as the
   * tool lays it, and kept as put down (gameMap.buildings, which the 3D view reads) until undone */
  private build(command: Extract<Command, { type: "build" }>): CommandOutcome {
    const city = this.city, map = city.map, tool = city.tools[command.tool];
    if (!map || !tool) return { accepted: false, reason: `no ${command.tool} tool` };
    if (!placesBuilding(command.tool, tool)) return { accepted: false, reason: "not a building" };
    const size = tool.size ?? 1, metres = tileMetres(map as { tileSizeM?: number | null });
    const { cx, cy } = blockOf(command.x, command.z, size, metres);
    if (cx < 0 || cy < 0 || cx >= city.width || cy >= city.height) return { accepted: false, reason: "outside the map" };
    // Laid by the tool, which keeps it in gameMap.buildings where it was put down (keepBuilding), and the 3D view reads
    // it there (step 2.4); undo takes it away with its tiles
    this.placing = { x: command.x, z: command.z, rot: command.rot };
    try {
      return this.apply({ type: "tool", tool: command.tool, x: cx, y: cy,
        ...(command.stroke !== undefined ? { stroke: command.stroke } : {}) });
    } finally {
      this.placing = null;
    }
  }
  /** A building moved by the player (the "move" command), within the block it stands on, for a tenth of its price */
  private move(command: Extract<Command, { type: "move" }>): CommandOutcome {
    const city = this.city, map = city.map as unknown as BuildingMap | undefined;
    const placed = map?.buildings, b = placed?.get(command.id);
    if (!map || !placed || !b) return { accepted: false, reason: "no such building" };
    const x = b.tile % map.width, y = Math.floor(b.tile / map.width), tool = city.tools[b.tool];
    if (!tool || !map.getTile(x, y).isZone() && b.size > 1) return { accepted: false, reason: "no such building" };
    const problem = moveProblem(b, command.x, command.z, map.width, tileMetres(map));
    if (problem) return { accepted: false, reason: problem };
    const cost = movePrice(tool);
    if (city.budget.totalFunds < cost) return { accepted: false, reason: "not enough money" };
    city.budget.spend(cost);
    placed.setPose(b.id, command.x, command.z, command.rot);
    const time = city.cityTime?.() ?? 0;
    this.history.record(command.stroke ?? null, [], cost, time);
    (this.history.last()!.also ??= []).push(() => placed.restore(b));
    return { accepted: true, toolResult: 0 };
  }

  /**
   * The roads and railways drawn in metres cut where the bulldozer cleared their tiles (src/roads/roadCut.ts), so what is
   * left of them is still drawn as drawn (docs/METRE_DRAWING_PLAN.md, step 1's leftovers); what undoes each cut.
   */
  private cutGraphs(before: ReadonlyArray<{ x: number; y: number; before: number }>): Array<() => void> {
    const map = this.city.map! as unknown as { roadGraph?: RoadGraph | null; railGraph?: RoadGraph | null; tileSizeM?: number | null;
      getTile(x: number, y: number): { getRawValue(): number } };
    const metres = tileMetres(map), backs: Array<() => void> = [];
    for (const [graph, was] of [[map.roadGraph, isAnyRoad], [map.railGraph, isAnyRail]] as const) {
      if (!graph?.segments.size) continue;
      const cleared = before.filter((c) => was(c.before & BIT_MASK) && !was(map.getTile(c.x, c.y).getRawValue() & BIT_MASK));
      if (!cleared.length) continue;
      const mark = graph.mark();
      let cut = false;
      for (const c of cleared) cut = cutTile(graph, c.x, c.y, metres) || cut;
      if (cut) backs.push(() => graph.undo(mark));
    }
    return backs;
  }

  /** Where the build command in hand puts its building down, in metres */
  private placing: { x: number; z: number; rot: number } | null = null;

  /**
   * A building a tool put down, kept in gameMap.buildings (docs/METRE_DRAWING_PLAN.md 2.6): where the build command
   * put it down, else where the pose given with it says (world units), else where the one it was built over stood (a
   * level built on its tiles), else at its block's middle, not yet turned (the 3D view stands it against its road).
   * What undoes it.
   */
  private keepBuilding(command: Extract<Command, { type: "tool" }>, size: number): () => void {
    const map = this.city.map as unknown as BuildingMap;
    const placed = map.buildings ??= new PlacedBuildings();
    const tile = command.y * map.width + command.x, old = placed.atTile(tile), kept = old && old.size === size ? old : null;
    const metres = tileMetres(map), units = unitsPerMetre(metres), corner = size > 1 ? 1 : 0, pose = command.pose;
    const at = this.placing ?? (pose ? { x: pose[0] / units, z: pose[1] / units, rot: pose[2] } : kept);
    const building = placed.add({ tool: command.tool, size, tile,
      x: at ? at.x : (command.x - corner + size / 2) * metres, z: at ? at.z : (command.y - corner + size / 2) * metres,
      rot: at ? at.rot : null });
    return () => { if (old) placed.restore(old); else placed.remove(building.id); };
  }

  /** After a tool: the canal tool's new water is a canal, a bridge over a canal bulldozed back to water can be filled in
   * again like the rest of it, and the ground's water is worked out again when water came or went */
  private afterWater(before: ReadonlyArray<{ x: number; y: number; before: number }>, toolName: string): void {
    const city = this.city, map = city.map!;
    let changed = false;
    for (const c of before) {
      const raw = map.getTile(c.x, c.y).getRawValue(), wasWater = isWaterTile(c.before & BIT_MASK), water = isWaterTile(raw & BIT_MASK);
      // The canal's water and the bridges it put over roads and railways it crossed
      if (toolName === CANAL_TOOL && raw !== c.before) city.setCanal?.(c.x, c.y);
      if (wasWater === water) continue;
      changed = true;
      if (water && toolName !== CANAL_TOOL && !(raw & BULLBIT) && city.canalAt?.(c.x, c.y)) {
        map.setTile(c.x, c.y, raw & BIT_MASK, (raw & ALLBITS) | BULLBIT);
      }
    }
    if (changed) city.waterChanged?.();
  }

  /** Whether "undo" would take something back now. */
  canUndo(): boolean {
    return this.city.map !== undefined && this.history.canUndo(this.city.cityTime?.() ?? 0);
  }

  /**
   * The plots round the tiles the stroke in hand changed, worked out from the painted cells (src/zoneCells.ts
   * syncCellPlots), skipped when no painted cell or plot lies near them. The next command of another stroke, the next
   * step of the simulation and a save call it first (cityCore.ts), so the same commands at the same steps still make
   * the same city.
   */
  settle(): void {
    const pending = this.cellsPending, city = this.city;
    this.cellsPending = null;
    const cellMap = city.map as unknown as (CellMap & CellPlotMap) | undefined;
    if (!pending || !cellMap?.cellZones || !paintNear(cellMap, pending.tiles)) return;
    const layout = cellsOf(cellMap, (x, y) => (city.ownsLand?.(x, y) ?? true) && (city.canBuildAt?.(x, y) ?? true));
    syncCellPlots(cellMap, layout, pending.tiles);
  }

  apply(command: Command): CommandOutcome {
    const problem = commandProblem(command, this.city.width, this.city.height);
    if (problem) return { accepted: false, reason: problem };
    const city = this.city;
    if (this.cellsPending && !(command.type === "tool" && command.stroke !== undefined &&
      this.cellsPending.stroke === String(command.stroke))) this.settle();

    switch (command.type) {
      case "tool": {
        const tool = city.tools[command.tool];
        if (!tool) return { accepted: false, reason: `no ${command.tool} tool` };
        // A road or railway stroke's tiles, in the order drawn (src/roadPieces.ts RoadPath)
        const lays = tool.roadLevel ? isRoadTile : command.tool === "rail" ? isRailTile : null;
        const line = command.stroke === undefined ? null : `${command.stroke}:${command.part ?? 0}`;
        if (lays && line !== null && city.map) this.followPath(line, command.x, command.y, command.shape, command.controls);
        const houseMap = city.houseMap;
        const houseLevel = houseMap && houseStanding(houseMap) ? houseMap.rulerHouse?.level ?? 0 : 0;
        const refused = houseProblem(houseMap, command.tool, city.rank?.() ?? 0) ??
          serviceProblem(command.tool, houseLevel) ?? levelProblem(command.tool, houseLevel) ??
          (command.tool === BUILDING_UPGRADE_TOOL && city.map ? upgradeProblem(city.map as unknown as Parameters<typeof upgradeProblem>[0],
            command.x, command.y, houseLevel) : null) ??
          transitProblem(command.tool, command.x, command.y, city.rank?.() ?? 5, city.isRailAt ?? (() => true),
            (houseMap as unknown as Parameters<typeof transitProblem>[5]) ?? null) ??
          placeProblem(city, command.x, command.y, tool.size ?? 1) ??
          plantProblem(city, tool.powerKind, command.x, command.y) ?? mineProblem(city, tool.mineKind) ??
          farmProblem(city, command.tool, command.x, command.y) ?? roadBesideProblem(city, command.tool, tool.size ?? 1, command.x, command.y) ??
          (tool.rulerHouse && city.map ? houseRoadProblem({ width: city.width, height: city.height,
            getTileValue: (x, y) => city.map!.getTile(x, y).getRawValue() & BIT_MASK }, command.x, command.y) : null);
        if (refused) return { accepted: false, reason: refused, toolResult: null };
        const map = city.map;
        const fundsBefore = city.budget.totalFunds;
        tool.doTool(command.x, command.y, city.blockMaps);
        const before = map && tool.pendingTiles
          ? tool.pendingTiles().map(({ x, y }) => ({ x, y, before: map.getTile(x, y).getRawValue() }))
          : [];
        const applied = tool.modifyIfEnoughFunding(city.budget);
        if (applied && tool.powerKind) city.setPowerKind?.(command.x, command.y, tool.powerKind);
        if (applied && tool.mineKind) city.setMineKind?.(command.x, command.y, tool.mineKind);
        if (applied && tool.rulerHouse) city.setRulerHouse?.(command.x, command.y);
        if (applied && tool.civicKind) city.setCivicKind?.(command.x, command.y, tool.civicKind);
        if (applied && tool.wasteKind) city.setWasteKind?.(command.x, command.y, tool.wasteKind);
        if (applied && tool.buildingLevel) city.setBuildingLevel?.(command.x, command.y, tool.buildingLevel.level);
        // (a city with no map of its own, as some tests drive, keeps no list)
        const keptBack = applied && map && placesBuilding(command.tool, tool) ? this.keepBuilding(command, tool.size ?? 1) : null;
        // A road or railway drawn in metres loses what ran over a tile the bulldozer cleared (src/roads/roadCut.ts)
        const cutBack = applied && map && command.tool === "bulldozer" ? this.cutGraphs(before) : [];
        if (applied && tool.busTool) city.addBus?.(command.x, command.y);
        if (applied && tool.transitKind && isOneOf(STATION_KINDS, tool.transitKind)) {
          city.setStationKind?.(command.x, command.y, tool.transitKind);
        }
        // Roads laid where there were none take the tool's level; roads already there keep theirs
        const after = (c: { x: number; y: number }): number => map!.getTile(c.x, c.y).getRawValue() & BIT_MASK;
        if (applied && map && tool.roadLevel) {
          for (const c of before) if (!isRoadTile(c.before & BIT_MASK) && isRoadTile(after(c))) city.setRoadLevel?.(c.x, c.y, tool.roadLevel);
        }
        // ... and roads and railways laid where there was neither take the drawn line's piece, one a stroke
        // (src/roadPieces.ts); a crossing keeps the piece of the line that was there
        if (applied && map && lays && line !== null && city.newRoadPiece && city.setRoadPiece) {
          const laid = before.filter((c) => !isRoadTile(c.before & BIT_MASK) && !isRailTile(c.before & BIT_MASK) && lays(after(c)));
          if (laid.length && this.roadPiece?.stroke !== line) this.roadPiece = { stroke: line, piece: city.newRoadPiece() };
          for (const c of laid) city.setRoadPiece(c.x, c.y, this.roadPiece!.piece);
        }
        // ... and the piece's path, the tiles drawn so far (a piece shared past the last number keeps none)
        if (lays && line !== null && this.roadPiece?.stroke === line && this.roadPath?.stroke === line) {
          const piece = this.roadPiece.piece, record = this.roadPath;
          city.setRoadPath?.(piece, record.valid && piece < MAX_ROAD_PIECE ? record.path : null);
        }
        // When a road or railway cuts through painted zoneCells / plots, clear painted cells on the road tiles and re-sync plots
        const cellMap = map as unknown as (CellMap & CellPlotMap) | undefined;
        if (applied && cellMap?.cellZones && (tool.roadLevel || command.tool === "rail" || command.tool === CANAL_TOOL ||
          command.tool === "bulldozer") && before.length) {
          const stroke = command.stroke === undefined ? "" : String(command.stroke);
          if (this.cellsPending?.stroke !== stroke) { this.settle(); this.cellsPending = { stroke, tiles: new Set() }; }
          const touched = this.cellsPending!.tiles;
          for (const c of before) {
            const tileIdx = c.y * city.width + c.x;
            touched.add(tileIdx);
            const now = map!.getTile(c.x, c.y).getRawValue() & BIT_MASK;
            // The cells whose middles lie on the tile, by their keys on the 1 m raster (zoneCells.ts rasterKey); four a
            // side, as here before 20 Oct 2026, missed every key on a 16 m tile (docs/METRE_DRAWING_PLAN.md 0.1)
            if ((isRoadTile(now) || isWaterTile(now)) && cellMap.zoneCells) {
              for (const key of tileRasterKeys(cellMap, c.x, c.y)) cellMap.zoneCells.delete(key);
            }
          }
          cellMap.zoneCellsVersion = (cellMap.zoneCellsVersion ?? 0) + 1;
          // A command of no stroke stands alone: its plots at once
          if (command.stroke === undefined) this.settle();
        }
        // A canal dug, and the groundwater round any water that came or went (src/canals.ts)
        if (applied && map) this.afterWater(before, command.tool);
        if (applied && map && !tool.noUndo) {
          const changes = before.map((c) => ({ ...c, after: map.getTile(c.x, c.y).getRawValue() }))
            .filter((c) => c.after !== c.before);
          const cost = fundsBefore - city.budget.totalFunds;
          this.history.record(command.stroke ?? null, changes, cost, city.cityTime?.() ?? 0);
          if (keptBack) (this.history.last()!.also ??= []).push(keptBack);
          if (cutBack.length) (this.history.last()!.also ??= []).push(...cutBack);
        }
        return { accepted: true, toolResult: tool.result };
      }
      case "road":
        return this.road(command);
      case "build":
        return this.build(command);
      case "move":
        return this.move(command);
      case "undo": {
        const map = city.map;
        const step = map ? this.history.take(city.cityTime?.() ?? 0) : null;
        if (!map || !step) return { accepted: true, undone: false };
        for (const change of [...step.changes].reverse()) {
          map.setTile(change.x, change.y, change.before & BIT_MASK, change.before & ALLBITS);
        }
        // ... and the roads as drawn with them (src/roads/roadGraph.ts)
        for (const back of [...(step.also ?? [])].reverse()) back();
        this.graphMark = null;
        if (step.changes.some((c) => isWaterTile(c.before & BIT_MASK) !== isWaterTile(c.after & BIT_MASK))) city.waterChanged?.();
        city.budget.spend(-step.cost);
        return { accepted: true, undone: true };
      }
      case "budget":
        city.budget.roadPercent = command.road / 100;
        city.budget.firePercent = command.fire / 100;
        city.budget.policePercent = command.police / 100;
        city.budget.setTax(command.tax);
        city.budget.setTaxes?.({ commercial: command.comTax, industrial: command.indTax, water: command.waterFee,
          tourist: command.touristFee });
        if (command.yearEnd) city.budget.doBudgetWindow();
        else city.budget.updateFundEffects();
        break;
      case "disaster":
        if (command.disaster === "monster") city.sprites.makeMonster();
        else if (command.disaster === "tornado") city.sprites.makeTornado();
        else if (command.disaster === "fire") city.disasters.makeFire();
        else if (command.disaster === "flood") city.disasters.makeFlood();
        else if (command.disaster === "crash") city.disasters.makeCrash();
        else city.disasters.makeMeltdown();
        break;
      case "setting":
        if (command.setting === "autoBudget") city.budget.setAutoBudget(command.on);
        else if (command.setting === "autoBulldoze") city.setAutoBulldoze(command.on);
        else city.disasters.disastersEnabled = command.on;
        break;
      case "speed":
        city.setSpeed(command.speed);
        break;
      case "wing": {
        const refused = wingProblem(city.houseMap, command.wing, command.add, city.budget.totalFunds);
        if (refused || !city.houseMap) return { accepted: false, reason: refused ?? "no house" };
        changeWing(city.houseMap, command.wing, command.add, city.budget);
        // Without the council hall there may be less room for policies (src/policies.ts)
        if (!command.add && command.wing === "council_hall") trimPolicies(city.houseMap as PolicyMap);
        break;
      }
      case "land": {
        const land = city.houseMap as unknown as LandMap | undefined;
        const refused = land ? landProblem(land, command.x, command.y, city.rank?.() ?? 5, city.budget.totalFunds) : LAND_ALL_OPEN;
        if (refused || !land) return { accepted: false, reason: refused ?? LAND_ALL_OPEN };
        buyBlock(land, command.x, command.y, city.budget);
        break;
      }
      case "zoneCells": {
        const map = city.map as unknown as CellMap | undefined;
        if (!map || !map.cellZones) return { accepted: false, reason: NO_CELL_ZONES };
        // A new city builds the ruler's house first, as with every other zone tool (src/rulerHouse.ts)
        const houseFirst = houseProblem(city.houseMap, "zone_residential", city.rank?.() ?? 0);
        if (houseFirst) return { accepted: false, reason: houseFirst };
        const layout = cellsOf(map, (x, y) => (city.ownsLand?.(x, y) ?? true) && (city.canBuildAt?.(x, y) ?? true));
        const code = command.zone ? zoneCode(command.zone) : 0, painted = map.zoneCells ?? (map.zoneCells = new Map());
        const cells = [...new Set(command.cells)].filter((key) => layout.byKey.has(key) && (painted.get(key) ?? 0) !== code);
        if (!cells.length) return { accepted: false, reason: NOTHING_TO_PAINT };
        // Paint costs a share of its zone's price, by the cell (src/plots.ts PAINT_PRICE_SHARE); clearing is free
        const tool = command.zone ? city.tools[command.zone] : null;
        const each = tool ? cellPrice(tool.toolCost ?? 100, PAINT_PRICE_SHARE, tileMetres(map)) * (tool.costFactor ?? 1) : 0;
        const cost = Math.ceil(cells.length * each);
        if (city.budget.totalFunds < cost) return { accepted: false, reason: NO_MONEY_FOR_CELLS };
        for (const key of cells) if (code) painted.set(key, code); else painted.delete(key);
        if (cost) city.budget.spend(cost);
        // The tiles the paint covers enough become plots, which grow buildings (src/zoneCells.ts syncCellPlots)
        const touched = new Set<number>();
        for (const key of cells) {
          const cell = layout.cells[layout.byKey.get(key)!];
          touched.add(tileOfUnits(cell.z) * map.width + tileOfUnits(cell.x));
          const pt = plotTileOfCell(map, cell);
          if (pt >= 0) touched.add(pt);
        }
        syncCellPlots(map as unknown as CellPlotMap, layout, touched);
        map.zoneCellsVersion = (map.zoneCellsVersion ?? 0) + 1;
        return { accepted: true };
      }
      case "policy": {
        const map = city.houseMap as PolicyMap | undefined;
        const refused = policyProblem(map, command.policy, command.on);
        if (refused || !map) return { accepted: false, reason: refused ?? "no house" };
        changePolicy(map, command.policy, command.on);
        break;
      }
      case "debugFunds":
        city.budget.spend(-DEBUG_FUNDS);
        break;
    }
    return { accepted: true };
  }
}
