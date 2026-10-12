/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { TRIANGLE_BUDGETS } from '../../constants.js';
import type { RegionTier } from '../../regional/types.js';
import type { ModelOptions } from '../registry.js';
import { ZoneBuilder } from './zone-builder.js';
import { buildApartmentL, buildCommunity, buildEstate, buildRows, buildTraditionalEstate, createEmptyParts } from './low-rise.js';
import { buildBudgetCondo, buildDormitory, buildLuxuryCondo, buildLuxuryTower, buildPodiumTower, buildPoolCondo, buildPublicHousing, buildWalkup } from './high-rise.js';

const FLOORS = [2, 2, 5, 10, 2, 4, 7, 15, 2, 3, 8, 30, 2, 1, 15, 45] as const;
// The owner explicitly raised block_2_2's limit to 25 m to preserve 3 m residential floors.
const HEIGHTS = [7, 8, 17, 32, 8, 14, 23, 48, 9, 11, 25, 100, 9, 12, 55, 150] as const;
const TIERS: readonly RegionTier[] = ['R1', 'R1', 'R3', 'R3', 'R2', 'R2', 'R3', 'R3', 'R2', 'R2', 'R3', 'R3', 'R2', 'R1', 'R3', 'R3'];

export const RES_ZONE_SPECS = Object.freeze(FLOORS.map((floors, i) => {
  const landValue = Math.floor(i / 4), density = i % 4, center = 265 + i * 9;
  return Object.freeze({ id: `res.block_${landValue}_${density}`, landValue, density, center,
    tiles: Array.from({ length: 9 }, (_, n) => center - 4 + n), floors, maxHeight: HEIGHTS[i], regionTier: TIERS[i],
    budget: floors <= 4 ? TRIANGLE_BUDGETS.lowRise : TRIANGLE_BUDGETS.highRise });
}));

export function createResidentialBlock(landValue: number, density: number, options: ModelOptions = {}) {
  if (![landValue, density].every(n => Number.isInteger(n) && n >= 0 && n <= 3)) throw new RangeError('Residential land value and density must be 0–3');
  const index = landValue * 4 + density, spec = RES_ZONE_SPECS[index], b = new ZoneBuilder(options);
  const builders: (() => Record<string, unknown>)[] = [
    () => buildCommunity(b), () => buildRows(b, 2, true), () => buildWalkup(b), () => buildPublicHousing(b),
    () => buildRows(b, 2, false), () => buildApartmentL(b), () => buildDormitory(b), () => buildBudgetCondo(b),
    () => buildEstate(b, false), () => buildRows(b, 3, false), () => buildPoolCondo(b), () => buildPodiumTower(b),
    () => buildEstate(b, true), () => buildTraditionalEstate(b), () => buildLuxuryCondo(b), () => buildLuxuryTower(b),
  ];
  const details = builders[index]();
  return b.finishZone(spec.id, 'residential', spec.center, spec.regionTier, { ...details, landValue, density, maxHeight: spec.maxHeight });
}

export function createEmptyResidentialZone(options: ModelOptions = {}) {
  const b = new ZoneBuilder(options); createEmptyParts(b);
  return b.finishZone('res.zone_empty', 'residential', 244, 'R2', { maxHeight: 4, subdividedLot: true, landSaleText: 'ขายที่ดิน' });
}
