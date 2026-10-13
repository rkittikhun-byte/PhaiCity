/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { seededRng } from '../rng.js';
import type { RegionId } from './types.js';

export interface RegionalVehicleStyle {
  songthaewColor(seed?: number): number; etanColor(seed?: number): number;
  /** Southern coastal dress; factories still accept all regions for the shared gallery contract. */
  korlaeColors: readonly [number, number, number, number];
}
/** R2 road colors live with the region kit; the vehicle's national body stays identical. */
export function vehicleStyle(region: RegionId): RegionalVehicleStyle {
  const colors = region === 'north' ? [0xdc2626] : [0x1d4ed8, 0x15803d, 0xf8fafc];
  return Object.freeze({ songthaewColor: (seed = 1) => colors[Math.floor(seededRng(seed)() * colors.length)],
    etanColor: (seed = 1) => [0x2563eb, 0xdc2626, 0x16a34a][Math.floor(seededRng(seed)() * 3)],
    korlaeColors: Object.freeze([0xd97706, 0x2563eb, 0xdc2626, 0xf8fafc]) as readonly [number, number, number, number] });
}
