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

import { besideWater3, farmLevel, fisheryLevel } from "./farming";
import { canDig, MINE_KINDS } from "./mining";
import { isRoadTile } from "./roadLevels";
import { besideWater, canBuildKind, POWER_KINDS } from "./powerPlants";
import { changeWing, type HouseMap, houseProblem, houseStanding, WINGS, wingProblem } from "./rulerHouse";
import { changePolicy, POLICIES, type PolicyMap, policyProblem, trimPolicies } from "./policies";
import { STATION_KINDS, transitProblem } from "./transit";
import { serviceProblem } from "./services";
import { ALLBITS, BIT_MASK } from "./tileFlags";
import { UndoHistory } from "./undoHistory";

export const TOOL_NAMES = [
  "residential", "commercial", "industrial", "road", "rail", "wire", "park", "bulldozer",
  "police", "fire", "coal", "nuclear", "stadium", "port", "airport", "waterworks", "watertower", "gas", "hydro", "solar",
  "wind", "limestone_mine", "potash_mine", "tin_mine", "zinc_mine", "gold_mine", "gem_mine", "rare_earth_mine", "lignite_mine",
  "oil_well", "farm", "fishing", "road_asphalt", "road_concrete2", "road_concrete4", "road_concrete6", "road_concrete8",
  "motorway", "tollway", "road_upgrade", "ruler_house", "ruler_house_upgrade", "kindergarten", "primary_school",
  "secondary_school", "vocational_college", "university", "health_centre", "community_hospital", "provincial_hospital",
  "regional_hospital", "landfill", "incinerator", "recycling_plant", "waste_power_plant", "wastewater_plant", "bus_stop", "train_station", "metro_station", "hsr_station",
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

export type Command =
  /** stroke: the same number for every command of one press of the mouse, so they undo together. */
  | { type: "tool"; tool: ToolName; x: number; y: number; stroke?: number }
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
  /** Records the station just built at (x, y), its centre (src/transit.ts). */
  setStationKind?(x: number, y: number, kind: string): void;
}

/** Why a tool may not be used at (x, y): outside the province, or null when it may. */
export function placeProblem(city: Pick<CommandTarget, "canBuildAt">, x: number, y: number,
                             size: number): string | null {
  const canBuildAt = city.canBuildAt;
  return canBuildAt && footprint(x, y, size).some((t) => !canBuildAt(t.x, t.y)) ? OUTSIDE_PROVINCE : null;
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

const isInteger = (value: unknown, min: number, max: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Why a command cannot be applied to a map of this size, or null when it can. Commands may come from anywhere. */
export function commandProblem(command: unknown, width: number, height: number): string | null {
  if (typeof command !== "object" || command === null) return "not a command";
  const c = command as Record<string, unknown>;
  switch (c.type) {
    case "tool":
      if (!isOneOf(TOOL_NAMES, c.tool)) return `unknown tool ${String(c.tool)}`;
      if (!isInteger(c.x, 0, width - 1) || !isInteger(c.y, 0, height - 1)) return "outside the map";
      if (c.stroke !== undefined && !isInteger(c.stroke, 0, Number.MAX_SAFE_INTEGER)) return "bad stroke";
      return null;
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
    case "policy":
      if (!isOneOf(POLICIES, c.policy)) return `unknown policy ${String(c.policy)}`;
      return typeof c.on === "boolean" ? null : "on missing";
    case "debugFunds":
      return null;
    default:
      return `unknown command type ${String(c.type)}`;
  }
}

export class CityCommands {
  private readonly history = new UndoHistory();

  constructor(private readonly city: CommandTarget) {}

  /** Whether "undo" would take something back now. */
  canUndo(): boolean {
    return this.city.map !== undefined && this.history.canUndo(this.city.cityTime?.() ?? 0);
  }

  apply(command: Command): CommandOutcome {
    const problem = commandProblem(command, this.city.width, this.city.height);
    if (problem) return { accepted: false, reason: problem };
    const city = this.city;

    switch (command.type) {
      case "tool": {
        const tool = city.tools[command.tool];
        if (!tool) return { accepted: false, reason: `no ${command.tool} tool` };
        const houseMap = city.houseMap;
        const houseLevel = houseMap && houseStanding(houseMap) ? houseMap.rulerHouse?.level ?? 0 : 0;
        const refused = houseProblem(houseMap, command.tool, city.rank?.() ?? 0) ??
          serviceProblem(command.tool, houseLevel) ??
          transitProblem(command.tool, command.x, command.y, city.rank?.() ?? 5, city.isRailAt ?? (() => true),
            (houseMap as unknown as Parameters<typeof transitProblem>[5]) ?? null) ??
          placeProblem(city, command.x, command.y, tool.size ?? 1) ??
          plantProblem(city, tool.powerKind, command.x, command.y) ?? mineProblem(city, tool.mineKind) ??
          farmProblem(city, command.tool, command.x, command.y);
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
        if (applied && tool.transitKind && isOneOf(STATION_KINDS, tool.transitKind)) {
          city.setStationKind?.(command.x, command.y, tool.transitKind);
        }
        // Roads laid where there were none take the tool's level; roads already there keep theirs
        if (applied && map && tool.roadLevel) {
          for (const c of before) {
            if (!isRoadTile(c.before & BIT_MASK) && isRoadTile(map.getTile(c.x, c.y).getRawValue() & BIT_MASK)) {
              city.setRoadLevel?.(c.x, c.y, tool.roadLevel);
            }
          }
        }
        if (applied && map && !tool.noUndo) {
          const changes = before.map((c) => ({ ...c, after: map.getTile(c.x, c.y).getRawValue() }))
            .filter((c) => c.after !== c.before);
          const cost = fundsBefore - city.budget.totalFunds;
          this.history.record(command.stroke ?? null, changes, cost, city.cityTime?.() ?? 0);
        }
        return { accepted: true, toolResult: tool.result };
      }
      case "undo": {
        const map = city.map;
        const step = map ? this.history.take(city.cityTime?.() ?? 0) : null;
        if (!map || !step) return { accepted: true, undone: false };
        for (const change of [...step.changes].reverse()) {
          map.setTile(change.x, change.y, change.before & BIT_MASK, change.before & ALLBITS);
        }
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
