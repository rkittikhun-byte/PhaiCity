/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

/** Shared boundaries for the later road, railway and power renderers. */
export const ROAD_SECTION = Object.freeze({ tile: 10, carriageway: 7, sidewalk: 1.5, sidewalkY: 0.15 });
export const RAIL_INTERFACE = Object.freeze({ gauge: 1, railWidth: 0.08, headY: 0.42, ballastWidth: 3.2, ballastY: 0.3, sleeperSpacing: 0.6 });
export const POWER_INTERFACE = Object.freeze({ powerY: 11, telecomY: 6, offsets: Object.freeze([-0.8, 0, 0.8]) });

export const BASIC_MASKS = Object.freeze({ straight: 5, corner: 3, t: 7, cross: 15, end: 1, single: 0 });
export type BasicRoadKind = keyof typeof BASIC_MASKS;

/** Canonical models rotate clockwise in map space (negative rotation around Y). */
export function roadForMask(value: number, level: 1 | 2 | 3 = 2): { id: string; quarterTurns: number; rotationY: number } {
  const mask = Number.isFinite(value) ? Math.trunc(value) & 15 : 0;
  for (const [kind, canonical] of Object.entries(BASIC_MASKS)) {
    for (let turn = 0; turn < 4; turn++) {
      const rotated = ((canonical << turn) | (canonical >> (4 - turn))) & 15;
      if (rotated === mask) return { id: `road.${level===1?'laterite_':''}${kind}`, quarterTurns: turn, rotationY: -turn * Math.PI / 2 };
    }
  }
  throw new Error('Unreachable four-bit road mask');
}
