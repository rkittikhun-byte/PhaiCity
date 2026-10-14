/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The buildings' upgrade (ยกระดับอาคาร, src/buildingLevels.ts): a click on a building with levels raises it one level
// for the difference in price, as the roads' upgrade does. The ruler's house it needs is checked by CityCommands
// (upgradeProblem), which knows the house. It changes no tile, so it cannot be undone.

import { BaseTool } from "./baseTool.js";
import { buildingAt, buildingLevelAt, levelSpec, levelUpgradeCost, type LevelGroupName, type LevelMap } from "./buildingLevels";
import { NEEDS_HOUSE_LEVEL } from "./services";

interface TileMap extends LevelMap {
  getTileValue(x: number, y: number): number;
  testBounds(x: number, y: number): boolean;
}

interface UpgradeThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  _map: TileMap;
  _raise: { index: number; level: number } | null;
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

/** The building a click at (x, y) would raise, its next level and the price, or null */
export function upgradeAt(map: TileMap, x: number, y: number):
    { x: number; y: number; group: LevelGroupName; level: number; cost: number } | null {
  const building = buildingAt(map, x, y);
  if (!building) return null;
  const level = buildingLevelAt(map, building.x, building.y, building.group);
  const cost = levelUpgradeCost(building.group, level);
  return cost === null ? null : { ...building, level: level + 1, cost };
}

/** Why a click at (x, y) may not raise the building there, or null: its next level may need a higher ruler's house */
export function upgradeProblem(map: TileMap, x: number, y: number, houseLevel: number): string | null {
  const next = upgradeAt(map, x, y);
  return next && levelSpec(next.group, next.level).house > houseLevel ? NEEDS_HOUSE_LEVEL : null;
}

export const BuildingUpgradeTool = makeTool(function(this: UpgradeThis, map: unknown) {
  // Its listed price is a police box's step; each raise is charged its own
  this.init(250, map, false, false);
  this._raise = null;
}) as unknown as { new(map: unknown): UpgradeThis; prototype: Record<string, unknown> };

BuildingUpgradeTool.prototype.noUndo = true;

BuildingUpgradeTool.prototype.doTool = function(this: UpgradeThis, x: number, y: number): void {
  const next = upgradeAt(this._map, x, y);
  if (!next) {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  this._raise = { index: next.y * this._map.width + next.x, level: next.level };
  this.addCost(next.cost);
  this.result = this.TOOLRESULT_OK;
};

BuildingUpgradeTool.prototype.clear = function(this: UpgradeThis): void {
  this._raise = null;
  this._applicationCost = 0;
  this._clearingCost = 0;
};

BuildingUpgradeTool.prototype.modifyIfEnoughFunding = function(this: UpgradeThis,
    budget: { totalFunds: number; spend(amount: number): void }): boolean {
  if (this.result !== this.TOOLRESULT_OK || !this._raise) {
    this.clear();
    return false;
  }
  const cost = this.totalCost();
  if (budget.totalFunds < cost) {
    this.result = this.TOOLRESULT_NO_MONEY;
    this.clear();
    return false;
  }
  this._map.buildingLevels = this._map.buildingLevels ?? {};
  this._map.buildingLevels[this._raise.index] = this._raise.level;
  budget.spend(cost);
  this.clear();
  return true;
};

BuildingUpgradeTool.prototype.pendingTiles = function(): Array<{ x: number; y: number }> {
  return [];
};
