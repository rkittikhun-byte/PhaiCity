/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The canal tool (docs/CANALS.md): digs one tile of a canal, drawn by the same modes as a road (src/drawModes.ts).
// Clear land and woods become water that the bulldozer can fill in again; a straight road or railway it crosses
// becomes a bridge; water already there is left as it is, so a canal can be dug on from a river or another canal.
// Buildings, junctions, corners and power lines are refused. Like every tool it only changes tile values through
// WorldEffects; the command records the canal (src/cityCommands.ts).

import { BaseTool } from "./baseTool.js";
import { CANAL_PRICE, CANAL_RAIL_BRIDGE, CANAL_ROAD_BRIDGE, isWaterTile } from "./canals";
import { BULLBIT } from "./tileFlags";
import { TileUtils } from "./tileUtils.js";
import { DIRT, HBRIDGE, HRAIL, LHRAIL, LVRAIL, RIVER, ROADS, ROADS2, VBRIDGE, VRAIL } from "./tileValues";

interface ToolThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  autoBulldoze: boolean;
  doAutoBulldoze(x: number, y: number): void;
  addCost(cost: number): void;
  toolCost: number;
  result: number | null;
  _worldEffects: { getTileValue(x: number, y: number): number; setTile(x: number, y: number, value: number, flags?: number): void };
  TOOLRESULT_OK: number;
  TOOLRESULT_FAILED: number;
  TOOLRESULT_NEEDS_BULLDOZE: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

export const CanalTool = makeTool(function(this: ToolThis, map: unknown) {
  this.init(CANAL_PRICE, map, true, true);
}) as unknown as { new(map: unknown): ToolThis; prototype: ToolThis & { doTool(x: number, y: number): void } };

/** What the canal makes of a road or railway it crosses: its bridge, with its price; null where it cannot cross */
function bridgeOver(value: number): { tile: number; cost: number } | null {
  switch (TileUtils.normalizeRoad(value)) {
    case ROADS: return { tile: HBRIDGE, cost: CANAL_ROAD_BRIDGE };
    case ROADS2: return { tile: VBRIDGE, cost: CANAL_ROAD_BRIDGE };
    case LHRAIL: return { tile: HRAIL, cost: CANAL_RAIL_BRIDGE };
    case LVRAIL: return { tile: VRAIL, cost: CANAL_RAIL_BRIDGE };
    default: return null;
  }
}

CanalTool.prototype.doTool = function(this: ToolThis, x: number, y: number): void {
  const effects = this._worldEffects;
  // Water already: nothing to dig, and nothing to pay
  if (isWaterTile(effects.getTileValue(x, y))) {
    this.result = this.TOOLRESULT_OK;
    return;
  }
  const bridge = bridgeOver(effects.getTileValue(x, y));
  if (bridge) {
    effects.setTile(x, y, bridge.tile, BULLBIT);
    this.addCost(bridge.cost);
    this.result = this.TOOLRESULT_OK;
    return;
  }
  // Woods and rubble are cleared first, the woods at the province's price (src/baseTool.js)
  if (this.autoBulldoze) this.doAutoBulldoze(x, y);
  if (effects.getTileValue(x, y) !== DIRT) {
    this.result = this.autoBulldoze ? this.TOOLRESULT_FAILED : this.TOOLRESULT_NEEDS_BULLDOZE;
    return;
  }
  effects.setTile(x, y, RIVER, BULLBIT);
  this.addCost(this.toolCost);
  this.result = this.TOOLRESULT_OK;
};
