/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The zone brushes (ระบายเขต, docs/ZONE_PAINT.md): on a map with painted zones (src/plots.ts) the home, shop and
// factory buttons paint one tile at a time, and the eraser rubs out paint where nothing has been built yet. A tile can
// be painted on bare land within reach of a road; woods are cleared at the province's price. Like every tool, it only
// changes a tile value through WorldEffects and draws nothing; how the mouse spreads it (a brush, a rectangle, a fill)
// is the game's (src/drawModes.ts).

import { BaseTool } from "./baseTool.js";
import { isWoodsValue, PAINT_PRICE_SHARE, paintOutcome, type PlotKind, type PlotMap, plotOf, plotTile } from "./plots";
import { BLBNCNBIT } from "./tileFlags";
import { DIRT } from "./tileValues";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  addCost(cost: number): void;
  addBulldozeCost(tileValue: number, cost?: number): void;
  toolCost: number;
  result: number | null;
  plotKind: PlotKind | null;
  _map: PlotMap;
  _worldEffects: { getTileValue(x: number, y: number): number; setTile(x: number, y: number, value: number, flags?: number): void };
  TOOLRESULT_OK: number;
  TOOLRESULT_FAILED: number;
  TOOLRESULT_NEEDS_BULLDOZE: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

/** The zone tool's price for a whole 3 × 3 zone, before the province's price rules (src/gameTools.js) */
export const ZONE_PRICE = 100;

/** kind: what it paints, or null for the eraser, which is free. */
export const PlotTool = makeTool(function(this: ToolThis, map: unknown, kind: PlotKind | null) {
  this.init(kind ? Math.round(ZONE_PRICE * PAINT_PRICE_SHARE) : 0, map, false, true);
  this.plotKind = kind;
}) as unknown as { new(map: unknown, kind: PlotKind | null): ToolThis; prototype: ToolThis & { doTool(x: number, y: number): void } };

PlotTool.prototype.doTool = function(this: ToolThis, x: number, y: number): void {
  const kind = this.plotKind;
  if (kind === null) {
    // Rubbing out takes the paint off an empty plot; a building has to be bulldozed
    const plot = plotOf(this._map, x, y);
    if (!plot) {
      this.result = this.TOOLRESULT_FAILED;
      return;
    }
    // ... and off a built one, its building pulled down with it (owner, 15 Oct 2026: "วาดทับได้ เอา tool ล่าสุด
    // เท่านั้น แต่ต้องไม่มี object ไหนค้างอยู่"), at the bulldozer's price
    if (plot.level > 0) this.addCost(1);
    this._worldEffects.setTile(x, y, DIRT, 0);
    this.result = this.TOOLRESULT_OK;
    return;
  }

  const outcome = paintOutcome(this._map, kind, x, y);
  if (outcome === "same") {
    // Already painted so: nothing changes and nothing is paid, so a brush can go over it again
    this.result = this.TOOLRESULT_OK;
    return;
  }
  // A plot of another zone, built or not, takes the new paint: the latest brush wins, and its building goes with it
  if (outcome !== "paint" && outcome !== "built") {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  const value = this._worldEffects.getTileValue(x, y);
  if (outcome === "built") this.addCost(1);
  else if (isWoodsValue(value)) this.addBulldozeCost(value, 1);
  else if (value !== DIRT && plotOf(this._map, x, y) === null) this.addCost(1);
  this._worldEffects.setTile(x, y, plotTile(kind, 0), BLBNCNBIT);
  this.addCost(this.toolCost);
  this.result = this.TOOLRESULT_OK;
};
