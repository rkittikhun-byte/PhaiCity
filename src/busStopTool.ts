/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bus or songthaew (รถเมล์/สองแถว, docs/TRANSIT.md): put down on a road, it drives along it picking people up, with
// no stop to build (owner, 15 Oct 2026: "ป้ายรถเมล์ ไม่ต้องมีตั้งนะ แค่วาง รถเมล์ ก็ไปรับได้เลย"). It changes no tile: the
// city keeps where each bus runs (gameMap.buses, src/cityCommands.ts busTool). An old city's stop tiles still work.

import { BaseTool } from "./baseTool.js";
import { isRoadTile } from "./roadLevels";
import { TRANSIT_SPECS } from "./transit";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean): void;
  autoBulldoze: boolean;
  busTool: boolean;
  TOOLRESULT_FAILED: number;
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
  this.init(TRANSIT_SPECS.bus_stop.price, map, false);
  this.busTool = true;
}) as unknown as { new(map: unknown): ToolThis; prototype: ToolThis & { doTool(x: number, y: number): void } };

BusStopTool.prototype.doTool = function(this: ToolThis, x: number, y: number): void {
  // Only on a road
  if (!isRoadTile(this._worldEffects.getTileValue(x, y))) {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  this.addCost(this.toolCost);
  this.result = this.TOOLRESULT_OK;
};
