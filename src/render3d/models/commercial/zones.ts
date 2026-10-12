/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { TRIANGLE_BUDGETS } from '../../constants.js';
import type { RegionTier } from '../../regional/types.js';
import type { ModelOptions } from '../registry.js';
import { CommercialBuilder } from './builder.js';
import { emptyLot, freshMarket, nightMarket, woodenShop } from './markets.js';
import { shophouses } from './shophouses.js';
import { communityMall, convenienceAndFuel, newCommercialRow } from './modern.js';
import { departmentStore, hotel } from './high-rise.js';
import { Object3D } from 'three';
import { gardenCafe, glassShoppingCenter, carShowroom, lifestyleMall } from './premium-lowrise.js';
import { officeBuilding, gradeAOffice } from './offices.js';
import { balconyHotel } from './premium-hotel.js';
import { luxuryDepartmentStore } from './luxury-store.js';
import { buildLandmark, finishLandmark } from './landmarks.js';

// The owner retained 3.5 m commercial floors and approved about 40, rather than 60, for block_3_4.
const FLOORS = [0, 2, 1, 3, 4, 1, 4, 2, 8, 5, 1, 3, 12, 20, 30, 2, 2, 25, 6, 40] as const;
const TIERS: readonly RegionTier[] = ['R1', 'R2', 'R2', 'R1', 'R1', 'R2', 'R2', 'R2', 'R3', 'R3',
  'R2', 'R3', 'R3', 'R3', 'R3', 'R3', 'R2', 'R3', 'R3', 'R3'];
export const COM_ZONE_SPECS = Object.freeze(FLOORS.map((floors, i) => {
  const landValue = Math.floor(i / 5), density = i % 5, center = 436 + i * 9;
  return Object.freeze({ id: `com.block_${landValue}_${density}`, landValue, density, center, floors,
    tiles: Array.from({ length: 9 }, (_, n) => center - 4 + n), regionTier: TIERS[i],
    budget: floors <= 4 ? TRIANGLE_BUDGETS.lowRise : TRIANGLE_BUDGETS.highRise });
}));
export function createCommercialBlock(landValue: number, density: number, options: ModelOptions = {}) {
  if (!Number.isInteger(landValue) || landValue < 0 || landValue > 3 || !Number.isInteger(density) || density < 0 || density > 4) throw new RangeError('Commercial land value must be 0–3 and density 0–4');
  const spec = COM_ZONE_SPECS[landValue * 5 + density], b = new CommercialBuilder(options);
  const builders = [nightMarket, woodenShop, freshMarket, (builder: CommercialBuilder) => shophouses(builder, false),
    (builder: CommercialBuilder) => shophouses(builder, true), convenienceAndFuel, newCommercialRow, communityMall, hotel, departmentStore,
    gardenCafe, glassShoppingCenter, (builder: CommercialBuilder) => officeBuilding(builder), balconyHotel,
    (builder: CommercialBuilder) => officeBuilding(builder, true), carShowroom, lifestyleMall, gradeAOffice, luxuryDepartmentStore, buildLandmark];
  const metadata = builders[landValue * 5 + density](b); b.flushSigns();
  const root = b.finishZone(spec.id, 'commercial', spec.center, spec.regionTier, { ...metadata, landValue, density, signTexts: b.signs.map(s => s.text) });
  if (spec.id === 'com.block_3_4') finishLandmark(root);
  if (metadata.waterAnchor) { const anchor = new Object3D(); anchor.name = 'anchor_water_0'; anchor.position.fromArray(metadata.waterAnchor as number[]); root.add(anchor); }
  return root;
}
export function createEmptyCommercialZone(options: ModelOptions = {}) {
  const b = new CommercialBuilder(options), metadata = emptyLot(b); b.flushSigns();
  return b.finishZone('com.zone_empty', 'commercial', 427, 'R2', { ...metadata, signTexts: b.signs.map(s => s.text) });
}
