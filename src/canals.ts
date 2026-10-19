/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals (คลอง, docs/CANALS.md, owner 19 Oct 2026): the player digs them with a line tool, as roads and railways are
// drawn. A canal is plain water on the map (RIVER), so everything water does it does at once: land value, dams and
// fishing harbours beside it, bridges, boats, and the groundwater round it (src/groundwater.ts). Unlike a natural
// river it can be filled in again with the bulldozer. The map remembers which tiles were dug (gameMap.canals, saved as
// canals) so the views can tell a canal from a river; a mark counts only while its tile is still water or a bridge
// over it, so undo and the bulldozer need not clear it. Plain code: no DOM.

import { BIT_MASK } from "./tileFlags";
import {
  BRWH, BRWV, HBRDG0, HBRDG3, HBRIDGE, HRAIL, VBRDG0, VBRDG3, VBRIDGE, VRAIL, WATER_HIGH, WATER_LOW,
} from "./tileValues";

export const CANAL_TOOL = "canal";
/** A canal tile's price before the province's factor: digging costs more than a road, so lining every street with
 * water for its land value does not pay */
export const CANAL_PRICE = 40;
/** ... a road it crosses becomes a bridge, which costs five of the road's tiles, as the road tool's do */
export const CANAL_ROAD_BRIDGE = 50;
/** ... and a railway's bridge, as the rail tool's */
export const CANAL_RAIL_BRIDGE = 100;

interface CanalMap {
  width: number;
  height: number;
  canals?: Uint8Array | null;
  testBounds(x: number, y: number): boolean;
  getTileValue(x: number, y: number): number;
}

export const isWaterTile = (value: number): boolean => value >= WATER_LOW && value <= WATER_HIGH;

/** A road or railway bridge, which stands over water (src/bulldozerTool.js turns each back into water) */
export function isBridgeTile(value: number): boolean {
  return value === HBRIDGE || value === VBRIDGE || value === BRWH || value === BRWV || value === HRAIL ||
    value === VRAIL || value >= HBRDG0 && value <= HBRDG3 || value >= VBRDG0 && value <= VBRDG3;
}

/** A fresh layer: no canals */
export function newCanals(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

/** Whether a tile is a dug canal's water (not a bridge over it) */
export function isCanalAt(map: CanalMap, x: number, y: number): boolean {
  if (!map.canals || !map.testBounds(x, y) || !map.canals[y * map.width + x]) return false;
  return isWaterTile(map.getTileValue(x, y) & BIT_MASK);
}

/** Whether a tile was dug as a canal and still is, its water or a bridge over it */
export function canalMarkStands(map: CanalMap, x: number, y: number): boolean {
  if (!map.canals || !map.testBounds(x, y) || !map.canals[y * map.width + x]) return false;
  const value = map.getTileValue(x, y) & BIT_MASK;
  return isWaterTile(value) || isBridgeTile(value);
}

/** The layer as a save keeps it: the marks that still stand, or null when there are none */
export function canalsKept(map: CanalMap): Uint8Array | null {
  const layer = map.canals;
  if (!layer) return null;
  const kept = new Uint8Array(layer.length);
  let any = false;
  for (let i = 0; i < layer.length; i++) {
    if (layer[i] && canalMarkStands(map, i % map.width, Math.floor(i / map.width))) {
      kept[i] = 1;
      any = true;
    }
  }
  return any ? kept : null;
}
