/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Road levels (ชนิดถนน, docs/ROADS.md; owner, 13 Oct 2026): every road tile is one of eight levels, from laterite to
// a tollway, recorded by the map (gameMap.roadLevels, one byte a tile, 0 meaning laterite; saved as roadLevels).
// A road is built at the level chosen above the road button, and the upgrade tool raises roads one level at a time
// for the difference in price ("จาก 1 เป็น 2 เป็น 3 เป็น 4 ไปเรื่อยๆ"). Each level:
// - takes traffic: a wider road fills up more slowly (src/traffic.js), so it jams later;
// - costs upkeep a year in proportion (src/budget.js): concrete costs more to keep than laterite;
// - makes noise or dust (pollution on its tiles): laterite raises dust, wide roads and motorways roar;
// - motorways and tollways do not serve the zones beside them (no driveway: a zone needs another road), and a
//   tollway takes tolls from its traffic every month.
// No DOM, nothing random.

import { BaseTool } from "./baseTool.js";
import { POWERBASE, ROADBASE } from "./tileValues";

export const ROAD_LEVELS = ["laterite", "asphalt", "concrete2", "concrete4", "concrete6", "concrete8", "motorway",
  "tollway"] as const;
export type RoadLevel = typeof ROAD_LEVELS[number];

/** The tool that builds each level (src/gameTools.js); the old road tool builds laterite, as R5 draws every road */
export const ROAD_TOOLS: readonly string[] = ["road", "road_asphalt", "road_concrete2", "road_concrete4",
  "road_concrete6", "road_concrete8", "motorway", "tollway"];
export const UPGRADE_TOOL = "road_upgrade";

interface Spec {
  /** Baht a tile */
  price: number;
  /** Upkeep a tile, as a share of the game's own road upkeep */
  upkeep: number;
  /** Traffic a car adds to the tile, as a share of the game's own: wider roads fill more slowly */
  load: number;
  /** Pollution on each tile: dust or noise */
  noise: number;
}

/** By level, 1 to 8 (index 0 is level 1) */
export const ROAD_SPECS: readonly Spec[] = [
  { price: 10, upkeep: 0.5, load: 1.5, noise: 10 },
  { price: 20, upkeep: 1, load: 1, noise: 0 },
  { price: 30, upkeep: 1.5, load: 0.8, noise: 0 },
  { price: 50, upkeep: 2.5, load: 0.5, noise: 5 },
  { price: 80, upkeep: 3.5, load: 0.35, noise: 10 },
  { price: 120, upkeep: 4.5, load: 0.25, noise: 15 },
  { price: 200, upkeep: 6, load: 0.2, noise: 25 },
  { price: 250, upkeep: 6, load: 0.2, noise: 25 },
];

export const MAX_ROAD_LEVEL = ROAD_SPECS.length;
export const MOTORWAY_LEVEL = 7;
export const TOLLWAY_LEVEL = 8;
/** Baht a tollway tile takes a month for each unit of the traffic on it (the traffic map's 0–240) */
export const TOLL_PER_TRAFFIC = 0.002;

export function isRoadTile(value: number): boolean {
  return value >= ROADBASE && value < POWERBASE;
}

interface LevelMap {
  readonly width: number;
  readonly height: number;
  roadLevels?: Uint8Array | null;
}

/** A tile's road level, 1–8; an unrecorded road is laterite. */
export function roadLevelAt(map: LevelMap, x: number, y: number): number {
  const level = map.roadLevels?.[y * map.width + x] ?? 0;
  return level >= 1 && level <= MAX_ROAD_LEVEL ? level : 1;
}

export function roadSpec(level: number): Spec {
  return ROAD_SPECS[Math.max(1, Math.min(MAX_ROAD_LEVEL, level)) - 1];
}

/** Whether a road at this level gives the zones beside it a way in: motorways and tollways do not. */
export function servesZones(level: number): boolean {
  return level < MOTORWAY_LEVEL;
}

/** What raising a road from level to level + 1 costs, before the province's price rules. */
export function upgradeCost(level: number): number {
  return level >= MAX_ROAD_LEVEL ? 0 : roadSpec(level + 1).price - roadSpec(level).price;
}

/** The level-by-level map for a new city: every tile laterite. */
export function newRoadLevels(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height).fill(1);
}

interface UpgradeThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  _map: LevelMap & { getTileValue(x: number, y: number): number; testBounds(x: number, y: number): boolean };
  _upgrades: Array<{ index: number; level: number }>;
  _applicationCost: number;
  _clearingCost: number;
  result: number | null;
  addCost(cost: number): void;
  clear(): void;
  totalCost(): number;
  TOOLRESULT_OK: number;
  TOOLRESULT_FAILED: number;
  TOOLRESULT_NO_MONEY: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

/**
 * The upgrade tool (ปุ่มอัปเกรดถนน): each road tile it is dragged over goes up one level, for the difference in price.
 * It changes no tile, only the map's levels, so it cannot be undone.
 */
export const RoadUpgradeTool = makeTool(function(this: UpgradeThis, map: unknown) {
  // Its listed price is the first step's, laterite to asphalt; each road is charged its own step
  this.init(upgradeCost(1), map, false, true);
  this._upgrades = [];
}) as unknown as { new(map: unknown): UpgradeThis; prototype: Record<string, unknown> };

RoadUpgradeTool.prototype.noUndo = true;

RoadUpgradeTool.prototype.doTool = function(this: UpgradeThis, x: number, y: number): void {
  const map = this._map;
  if (!map.testBounds(x, y) || !isRoadTile(map.getTileValue(x, y))) {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  const index = y * map.width + x;
  const level = roadLevelAt(map, x, y);
  if (level >= MAX_ROAD_LEVEL || this._upgrades.some((u) => u.index === index)) {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  this._upgrades.push({ index, level: level + 1 });
  this.addCost(upgradeCost(level));
  this.result = this.TOOLRESULT_OK;
};

RoadUpgradeTool.prototype.clear = function(this: UpgradeThis): void {
  this._upgrades = [];
  this._applicationCost = 0;
  this._clearingCost = 0;
};

RoadUpgradeTool.prototype.modifyIfEnoughFunding = function(this: UpgradeThis,
    budget: { totalFunds: number; spend(amount: number): void }): boolean {
  if (this.result !== this.TOOLRESULT_OK) {
    this.clear();
    return false;
  }
  const cost = this.totalCost();
  if (budget.totalFunds < cost) {
    this.result = this.TOOLRESULT_NO_MONEY;
    this.clear();
    return false;
  }
  const map = this._map;
  if (!map.roadLevels) map.roadLevels = newRoadLevels(map.width, map.height);
  for (const upgrade of this._upgrades) map.roadLevels[upgrade.index] = upgrade.level;
  budget.spend(cost);
  this.clear();
  return true;
};

RoadUpgradeTool.prototype.pendingTiles = function(): Array<{ x: number; y: number }> {
  return [];
};

/** What the tollways took this month: their traffic times the toll. */
export function tollsThisMonth(map: LevelMap & { getTileValue(x: number, y: number): number },
    traffic: { worldGet(x: number, y: number): number }): number {
  const levels = map.roadLevels;
  if (!levels) return 0;
  let total = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] !== TOLLWAY_LEVEL) continue;
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (isRoadTile(map.getTileValue(x, y))) total += traffic.worldGet(x, y) * TOLL_PER_TRAFFIC;
  }
  return total;
}
