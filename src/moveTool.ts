/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The move tool (ย้ายอาคาร, docs/METRE_DRAWING_PLAN.md 2.5), chosen above the bulldozer: a click picks a ruler's
// building up, its outline then slides along its road with the mouse, and a second click puts it down there with the
// "move" command (src/cityCommands.ts). A building stays on the block of tiles it stands on, as the simulation counts it
// there, and a move costs a tenth of its price. The tool itself changes nothing; it only gives the mouse a tool to hold.

import { BaseTool } from "./baseTool.js";
import { blockOf, type PlacedBuilding } from "./buildings/placedBuildings";

/** The move tool's name, chosen above the bulldozer */
export const MOVE_TOOL = "building_move";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  result: number | null;
  TOOLRESULT_FAILED: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

export const MoveTool = makeTool(function(this: ToolThis, map: unknown) {
  this.init(0, map, false, false);
}) as unknown as { new(map: unknown): ToolThis; prototype: ToolThis & { noUndo: boolean; doTool(x: number, y: number): void } };

MoveTool.prototype.noUndo = true;

MoveTool.prototype.doTool = function(this: ToolThis): void {
  this.result = this.TOOLRESULT_FAILED;
};

/** What a move costs: a tenth of the price of the tool that built it, at the province's prices */
export function movePrice(tool: { toolCost?: number; costFactor?: number } | undefined): number {
  return Math.round((tool?.toolCost ?? 0) * (tool?.costFactor ?? 1) / 10);
}

/** Why a building may not be moved to the middle (x, z) metres: off the block it stands on; null when it may */
export function moveProblem(b: PlacedBuilding, x: number, z: number, width: number, tileSizeM: number): "off its block" | null {
  const { cx, cy } = blockOf(x, z, b.size, tileSizeM);
  return cy * width + cx === b.tile ? null : "off its block";
}

/** The ruler's building standing (stands) whose block of tiles covers (x, y), if any */
export function buildingAt(buildings: { all(): PlacedBuilding[] } | null | undefined, width: number, x: number, y: number,
  stands: (b: PlacedBuilding) => boolean = () => true): PlacedBuilding | null {
  if (!buildings) return null;
  for (const b of buildings.all()) {
    if (!stands(b)) continue;
    const corner = b.size > 1 ? 1 : 0, left = b.tile % width - corner, top = Math.floor(b.tile / width) - corner;
    if (x >= left && x < left + b.size && y >= top && y < top + b.size) return b;
  }
  return null;
}
