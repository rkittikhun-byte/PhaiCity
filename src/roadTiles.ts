/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which tile values count as a road, for each thing that asks (docs/METRE_DRAWING_PLAN.md 0.3). The game grew several
// answers, each right for what reads it; they live here side by side, each saying what it counts, so a change to one
// is a choice and not an accident. test/roadTiles.ts pins every one tile by tile.
//
//   value          64-65   66-76  77-78    79-206  207  221-222  224-236  237-238   239  828-831  832  948-951
//                  bridge  road   road     road    *    rail     rail     road      **   opening  ***  opening
//                                 +wires                  +wires          +rail          bridge        bridge
//   isRoadTile       x       x      x        x      x
//   conductsPower    x       x      x        x                              x               x        x     x
//   carriesWater     x       x      x        x      x                       x               x              x
//   isDriveable      x       x      x        x           x        x         x
//   isLineRoad               x               x
//   isAnyRoad        x       x      x        x                              x         x     x        x     x
//
//   *   207 (BRWXXX7) a piece of the opening bridge;  ** 239 (ROADVPOWERH) a road under wires, "bogus?" in the original;
//   *** 832 is both HBRDG_END and RADAR0 (an airport radar tile): power counts it, water does not.

import {
  HBRDG0, HBRDG3, HBRDG_END, HRAILROAD, LASTRAIL, LASTROAD, POWERBASE, RAILHPOWERV, ROADBASE, VBRDG0, VBRDG3, VRAILROAD,
} from "./tileValues";

/** A road tile as the tools and the road levels see it: every value from the bridges to the last road piece before the
 * power lines (64-207). Not the level crossings or the opening bridges' moving parts. */
export function isRoadTile(value: number): boolean {
  return value >= ROADBASE && value < POWERBASE;
}

/** A tile power runs along (src/powerManager.js; owner, 15 Oct 2026: power runs along the roads): roads 64-206, the
 * level crossings and every opening-bridge tile up to HBRDG_END (832). */
export function conductsPower(value: number): boolean {
  return value >= ROADBASE && value <= LASTROAD || value === HRAILROAD || value === VRAILROAD ||
    value >= HBRDG0 && value <= HBRDG_END || value >= VBRDG0 && value <= VBRDG3;
}

/** A tile that carries a water main (src/waterManager.ts): roads 64-207, the level crossings and the opening bridges'
 * tiles (828-831, 948-951). */
export function carriesWater(value: number): boolean {
  return (value >= ROADBASE && value < POWERBASE) || value === HRAILROAD || value === VRAILROAD ||
    (value >= HBRDG0 && value <= HBRDG3) || (value >= VBRDG0 && value <= VBRDG3);
}

/** A tile a trip may go along (src/traffic.js through src/tileUtils.js isDriveable): roads 64-206 and every railway
 * tile from the rail-and-wires crossings on (221-238), as the original game's trips went by road or rail. */
export function isDriveableValue(value: number): boolean {
  return value >= ROADBASE && value <= LASTROAD || value >= RAILHPOWERV && value <= LASTRAIL;
}

/** A plain road tile, which lies on a smooth line rather than drawing its own tile (src/roadGeometry.ts): not a bridge,
 * nor a road under power lines, which keep their tiles */
export const isLineRoad = (v: number): boolean => v >= 66 && v <= 206 && v !== 77 && v !== 78;
/** A plain railway tile on a smooth line */
export const isLineRail = (v: number): boolean => v >= 226 && v <= 236;
/** A road tile with a power line over it (77, 78), which the road's line runs on through: only the wires keep their
 * tile's model (owner, 15 Oct 2026, a picture of a road widening into a block at each pole) */
export const isPowerCrossing = (v: number): boolean => v === 77 || v === 78;
/** Any road tile a drawn line runs up to: roads, bridges, level crossings, opening bridges and 239 */
export const isAnyRoad = (v: number): boolean => v >= 64 && v <= 206 || v === 237 || v === 238 || v >= 828 && v <= 832 ||
  v >= 948 && v <= 951 || v === 239;
/** Any railway tile a drawn line runs up to */
export const isAnyRail = (v: number): boolean => v >= 224 && v <= 238 || v === 221 || v === 222;
