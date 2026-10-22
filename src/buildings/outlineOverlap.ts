/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Buildings meet by their outlines, not their tiles (docs/NO_GRID_PLAN.md 3A.2): two of the ruler's buildings, each a
// square turned as it was put down (src/buildings/turnedFootprint.ts Outline), stand clear of each other when a line
// can be drawn between them (the separating axis test of two rectangles). Until now only their tiles kept them apart,
// so a building turned to a slanted road could reach half a tile into the next one's lot. Plain code, no DOM.

import { laidOutline, outlineOf, type FootprintMap, type Outline } from "./turnedFootprint";
import type { PlacedBuilding } from "./placedBuildings";

/** How far two outlines may run into each other and still stand clear (metres): their edges meeting, a little off */
export const OVERLAP_SLACK_M = 0.5;

/** How far apart two outlines are along an axis (unit vector): positive when a gap lies between them there */
function gapAlong(a: Outline, b: Outline, nx: number, nz: number): number {
  const reach = (o: Outline): number => o.half * (Math.abs(o.ux * nx + o.uz * nz) + Math.abs(o.vx * nx + o.vz * nz));
  return Math.abs((b.x - a.x) * nx + (b.z - a.z) * nz) - reach(a) - reach(b);
}

/** How far two outlines run into each other (metres; 0 or less where they stand clear) */
export function overlapDepth(a: Outline, b: Outline): number {
  let least = Infinity;
  for (const [nx, nz] of [[a.ux, a.uz], [a.vx, a.vz], [b.ux, b.uz], [b.vx, b.vz]]) {
    const gap = gapAlong(a, b, nx, nz);
    if (gap >= 0) return -gap;
    least = Math.min(least, -gap);
  }
  return least;
}

/** Whether two outlines run into each other by more than the slack */
export const outlinesOverlap = (a: Outline, b: Outline, slack = OVERLAP_SLACK_M): boolean => overlapDepth(a, b) > slack;

/** A placed building's outline as it stands: turned as laid, else its square block round its centre tile */
export function standingOutline(map: FootprintMap, b: PlacedBuilding): Outline {
  const turned = laidOutline(map, b);
  if (turned) return turned;
  const t = map.tileSizeM || 16, corner = b.size > 1 ? 1 : 0;
  const left = b.tile % map.width - corner, top = Math.floor(b.tile / map.width) - corner;
  return outlineOf((left + b.size / 2) * t, (top + b.size / 2) * t, 0, b.size, t);
}

/** The building of the ruler's whose outline a new one would run into, or null; `except` (an id) is left out, the one
 * being moved */
export function buildingInTheWay(map: FootprintMap, outline: Outline, except: number | null = null): PlacedBuilding | null {
  const reach = outline.half * Math.SQRT2;
  for (const b of map.buildings?.all() ?? []) {
    if (b.id === except) continue;
    const o = standingOutline(map, b), far = reach + o.half * Math.SQRT2;
    if (Math.abs(o.x - outline.x) > far || Math.abs(o.z - outline.z) > far) continue;
    if (outlinesOverlap(outline, o)) return b;
  }
  return null;
}
