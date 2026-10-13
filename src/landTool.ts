/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The land tool (ซื้อที่ดิน, docs/LAND.md): in hand, a click buys the block of land under it. Buying is a command of its
// own ({ type: "land", x, y }, src/cityCommands.ts) that the game sends (src/game.js handleTool), so the tool itself
// changes nothing; it only gives the mouse a tool to hold.

import { BaseTool } from "./baseTool.js";
import { FIRST_BLOCK_PRICE } from "./landBlocks";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  result: number | null;
  TOOLRESULT_FAILED: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

export const LandTool = makeTool(function(this: ToolThis, map: unknown) {
  this.init(FIRST_BLOCK_PRICE, map, false, false);
}) as unknown as { new(map: unknown): ToolThis; prototype: ToolThis & { noUndo: boolean; doTool(x: number, y: number): void } };

LandTool.prototype.noUndo = true;

LandTool.prototype.doTool = function(this: ToolThis): void {
  this.result = this.TOOLRESULT_FAILED;
};
