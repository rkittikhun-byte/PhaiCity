/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What grew from paint gives way to what the ruler builds (owner, 23 Oct 2026: a water tower refused again and again on
// painted homes' land, "วางไม่ติดสักที"; then "บริการของประชาชน จะวางได้ทุกที่ ถ้าไปชนกับ object ที่วาดสีนะ ยกเว้น object
// ที่ตั้งขึ้นเอง" and "ถนนก็ด้วยเหมือนกัน วาดได้หมด"). A home, shop or factory plot, painted or grown to any level, and a
// farm field of any level, are the ruler's own paint: a building tool or a road, railway or canal clears them as it
// clears rubble, free, and the command takes the painted cells off those tiles (src/cityCommands.ts). What stands by
// itself or was put down by the ruler (temples, the ruler's buildings, old 3 × 3 zones) still stands in the way. Plain
// code: no DOM, nothing random.

import { isFieldValue } from "./farmZone";
import { plotOf, type PlotMap } from "./plots";

/** Whether the tile at (x, y), of the value a tool sees there now, is paint or what grew from it */
export function paintAt(map: PlotMap | null | undefined, x: number, y: number, value: number): boolean {
  if (isFieldValue(value)) return true;
  if (!map || !map.paintedZones) return false;
  if (map.getTileValue(x, y) !== value) return false;
  return plotOf(map, x, y) !== null;
}
