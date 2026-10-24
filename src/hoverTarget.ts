/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What one pixel of the view is, for the hover (src/hoverPick.ts): the building there, the road, railway, canal or field,
// as an identity and the tile the inspector reads it from. Open land, woods and water are not objects and give nothing.
// It only reads the map, a few lookups and no allocation beyond the answer.

import { isCanalAt } from "./canals.js";
import { isFieldValue } from "./farmZone.js";
import type { HoverClass } from "./hoverPick.js";
import type { CityObjects } from "./objects/cityObjects.js";
import { roadSegmentAt } from "./objects/roadSegment.js";
import { isRoadTile } from "./roadLevels.js";
import { LASTRAIL, RAILBASE } from "./tileValues.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

export interface HoverTarget {
  key: string;
  cls: HoverClass;
  /** The tile the inspector reads (a building's centre tile) */
  x: number;
  y: number;
}

/**
 * What stands at tile (x, y): `building` is the ruler's building found by its own outline at the pointer (the game's
 * buildingUnder), whose centre tile is its identity; else a community building on the tile; else the road's stretch,
 * the railway, canal or field tile.
 */
export function hoverTargetAt(map: Legacy, objects: CityObjects, x: number, y: number,
  building: { tile: number } | null): HoverTarget | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  if (building) {
    const bx = building.tile % map.width, by = Math.floor(building.tile / map.width);
    return { key: `b${bx},${by}`, cls: 0, x: bx, y: by };
  }
  const object = objects.at(x, y);
  if (object) return { key: `b${object.x},${object.y}`, cls: 0, x: object.x, y: object.y };
  const value = map.getTileValue(x, y);
  if (isRoadTile(value)) {
    const segment = roadSegmentAt(map, x, y);
    return { key: segment ? `r${segment.id}` : `t${x},${y}`, cls: 1, x, y };
  }
  if (value >= RAILBASE && value <= LASTRAIL) return { key: `t${x},${y}`, cls: 1, x, y };
  if (isFieldValue(value)) return { key: `f${x},${y}`, cls: 2, x, y };
  if (isCanalAt(map, x, y)) return { key: `c${x},${y}`, cls: 2, x, y };
  return null;
}
