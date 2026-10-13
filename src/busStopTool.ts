/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bus or songthaew stop (ป้ายรถเมล์/สองแถว, docs/TRANSIT.md): one tile, which works beside a road (src/transit.ts).
// Like the water tower, it only changes a tile value through WorldEffects and draws nothing.

import { BaseTool } from "./baseTool.js";
import { BULLBIT, BURNBIT } from "./tileFlags";
import { BUS_STOP, DIRT } from "./tileValues";
import { TRANSIT_SPECS } from "./transit";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean): void;
  autoBulldoze: boolean;
  doAutoBulldoze(x: number, y: number): void;
  addCost(cost: number): void;
  toolCost: number;
  result: number | null;
  _worldEffects: { getTileValue(x: number, y: number): number; setTile(x: number, y: number, value: number, flags?: number): void };
  TOOLRESULT_OK: number;
  TOOLRESULT_NEEDS_BULLDOZE: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

export const BusStopTool = makeTool(function(this: ToolThis, map: unknown) {
  this.init(TRANSIT_SPECS.bus_stop.price, map, true);
}) as unknown as { new(map: unknown): ToolThis; prototype: ToolThis & { doTool(x: number, y: number): void } };

BusStopTool.prototype.doTool = function(this: ToolThis, x: number, y: number): void {
  if (this.autoBulldoze) this.doAutoBulldoze(x, y);
  if (this._worldEffects.getTileValue(x, y) !== DIRT) {
    this.result = this.TOOLRESULT_NEEDS_BULLDOZE;
    return;
  }
  this._worldEffects.setTile(x, y, BUS_STOP, BURNBIT | BULLBIT);
  this.addCost(this.toolCost);
  this.result = this.TOOLRESULT_OK;
};
