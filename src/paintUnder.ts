/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Painted land that has grown nothing yet gives way to a building put down on it (owner, 23 Oct 2026: a water tower
// tried again and again on painted homes' land beside a road, "วางไม่ติดสักที"). A home, shop or factory plot of level 0
// or a farm field of level 0 is only paint: a building tool clears it as it clears rubble, free, and the command takes
// the painted cells off those tiles (src/cityCommands.ts). A plot or field that has grown something still needs the
// bulldozer first. Plain code: no DOM, nothing random.

import { fieldLevelOf, isFieldValue } from "./farmZone";
import { plotOf, type PlotMap } from "./plots";

/** Whether the tile at (x, y), of the value a tool sees there now, is paint with nothing grown on it yet */
export function emptyPaintAt(map: PlotMap | null | undefined, x: number, y: number, value: number): boolean {
  if (isFieldValue(value)) return fieldLevelOf(value) === 0;
  if (!map || !map.paintedZones) return false;
  if (map.getTileValue(x, y) !== value) return false;
  const plot = plotOf(map, x, y);
  return plot !== null && plot.level === 0;
}
