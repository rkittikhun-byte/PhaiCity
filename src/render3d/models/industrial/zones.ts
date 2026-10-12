/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Object3D } from 'three';
import { TRIANGLE_BUDGETS } from '../../constants.js';
import { point } from '../../regional/geometry.js';
import type { RegionTier } from '../../regional/types.js';
import type { ModelOptions } from '../registry.js';
import { IndustrialBuilder } from './builder.js';
import { traditionalIndustry, repairGarage, heavyIndustry } from './traditional.js';
import { warehouse, electronics, carAssembly, foodProcessing } from './modern.js';

const TIERS: readonly RegionTier[] = ['R1', 'R2', 'R1', 'R3', 'R3', 'R3', 'R3', 'R3'];
const SMOKE: readonly (readonly [number, number] | null)[] = [[-10, -10], null, [10, -10], [0, -10], null, null, [0, -10], [10, -10]];
export const IND_ZONE_SPECS = Object.freeze(TIERS.map((regionTier, i) => {
  const type = Math.floor(i / 4), size = i % 4, center = 625 + i * 9;
  return Object.freeze({ id: `ind.block_${type}_${size}`, type, size, center, regionTier,
    tiles: Array.from({ length: 9 }, (_, n) => center - 4 + n), budget: TRIANGLE_BUDGETS.lowRise, smoke: SMOKE[i] });
}));

export function createIndustrialBlock(type: number, size: number, options: ModelOptions = {}) {
  if (!Number.isInteger(type) || type < 0 || type > 1 || !Number.isInteger(size) || size < 0 || size > 3)
    throw new RangeError('Industrial type must be 0–1 and size 0–3');
  const spec = IND_ZONE_SPECS[type * 4 + size], b = new IndustrialBuilder(options, spec.regionTier === 'R1' ? size as 0 | 2 : undefined, type === 1);
  const builders = [(builder: IndustrialBuilder) => traditionalIndustry(builder, 0), repairGarage,
    (builder: IndustrialBuilder) => traditionalIndustry(builder, 2), heavyIndustry, warehouse, electronics, carAssembly, foodProcessing];
  const metadata = builders[type * 4 + size](b); b.flushSigns();
  const root = b.finishZone(spec.id, 'industrial', spec.center, spec.regionTier, { ...metadata, type, size, signTexts: b.signs.map(s => s.text) });
  if (spec.smoke) { const anchor = new Object3D(); anchor.name = 'anchor_smoke_0';
    anchor.position.set(spec.smoke[0], metadata.stackHeight as number, spec.smoke[1]); root.add(anchor); }
  return root;
}

export function createEmptyIndustrialZone(options: ModelOptions = {}) {
  const b = new IndustrialBuilder(options); b.industrialSite(true);
  b.feature('concrete-power-poles', () => {
    for (const x of [-11.6, 11.6]) {
      b.box(0.35, 12, 0.35, x, 6.06, -11.5, b.stone);
      for (const y of [9.8, 11]) { b.box(2.6, 0.13, 0.13, x, y, -11.5, b.metal);
        for (const dx of [-0.9, 0, 0.9]) b.cylinder(0.13, 0.32, x + dx, y + 0.2, -11.5, b.goods, 6); }
    }
    for (const dz of [-0.7, 0, 0.7]) b.tube([point(-11.6, 11.3, -11.5 + dz), point(0, 10.8, -11.5 + dz), point(11.6, 11.3, -11.5 + dz)], 0.025, b.metal, 8, 4);
  });
  b.feature('regional-lot-dress', () => { b.regionalProp(b.kit.modernHouseProp, -9.4, 7.2, 0.65);
    for (const x of [-11.5, 11.5]) { const mix = b.kit.vegetation.filter(p => !p.nearWaterOnly);
      b.take(b.kitParts(b.kit.gardenPlant(mix[0].id.slice(4), { height: 3.7, radius: 1, seed: b.options.seed })), x, 0.1, 10.6); }
  });
  b.factorySign('ขาย/ให้เช่าที่ดิน', -7.2, 3.1, 13.8); b.flushSigns();
  return b.finishZone('ind.zone_empty', 'industrial', 616, 'R2', { industry: 'empty-lot', smoke: false, powerPoles: 2,
    saleText: 'ขาย/ให้เช่าที่ดิน', signTexts: b.signs.map(s => s.text) });
}
