/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone's brush and its eraser (docs/GAME_DESIGN.md section 7, src/farmZone.ts): on a map with painted zones
// the brush paints a 16 m tile of open land with a way to a road within reach as an empty field, which the simulation
// grows into a paddy, a crop field, an orchard or a pond by the land; woods are cleared at the province's price. The
// eraser takes a field back to bare ground, a grown one at the bulldozer's price. Like every tool, it only changes tile
// values through WorldEffects and draws nothing; how the mouse spreads it (a brush, a rectangle, a fill) is the game's.

import { BaseTool } from "./baseTool.js";
import { FARM_ZONE } from "./provinceRules";
import { fieldLevelOf, FIELD_FLAGS, fieldOutcome, fieldTile, isFieldValue } from "./farmZone";
import { isWoodsValue, type PlotMap } from "./plots";
import { DIRT } from "./tileValues";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  addCost(cost: number): void;
  addBulldozeCost(tileValue: number, cost?: number): void;
  toolCost: number;
  result: number | null;
  /** Whether it rubs fields out */
  erases: boolean;
  /** Tiles from a road a field may lie (the province's rules, src/provinceRules.ts FarmZoneSpec.reach) */
  reach: number;
  _map: PlotMap;
  _worldEffects: { getTileValue(x: number, y: number): number; setTile(x: number, y: number, value: number, flags?: number): void };
  TOOLRESULT_OK: number;
  TOOLRESULT_FAILED: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

/** erases: the eraser, which is free; price: baht a tile painted (the province's FarmZoneSpec.price) */
export const FarmTool = makeTool(function(this: ToolThis, map: unknown, erases: boolean, price: number = FARM_ZONE.price,
                                          reach: number = FARM_ZONE.reach) {
  this.init(erases ? 0 : price, map, false, true);
  this.erases = erases;
  this.reach = reach;
}) as unknown as {
  new(map: unknown, erases: boolean, price?: number, reach?: number): ToolThis;
  prototype: ToolThis & { doTool(x: number, y: number): void };
};

FarmTool.prototype.doTool = function(this: ToolThis, x: number, y: number): void {
  const value = this._worldEffects.getTileValue(x, y);
  if (this.erases) {
    if (!isFieldValue(value)) {
      this.result = this.TOOLRESULT_FAILED;
      return;
    }
    // A grown field is cleared at the bulldozer's price, an empty one for nothing
    if (fieldLevelOf(value) > 0) this.addCost(1);
    this._worldEffects.setTile(x, y, DIRT, 0);
    this.result = this.TOOLRESULT_OK;
    return;
  }
  const outcome = fieldOutcome(this._map, x, y, this.reach);
  if (outcome === "same") {
    // A field already: nothing changes and nothing is paid, so a brush can go over it again
    this.result = this.TOOLRESULT_OK;
    return;
  }
  if (outcome !== "paint") {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  if (isWoodsValue(value)) this.addBulldozeCost(value, 1);
  else if (value !== DIRT) this.addCost(1);
  this._worldEffects.setTile(x, y, fieldTile(0), FIELD_FLAGS);
  this.addCost(this.toolCost);
  this.result = this.TOOLRESULT_OK;
};
