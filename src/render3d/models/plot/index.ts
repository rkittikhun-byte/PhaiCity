/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Group } from 'three';
import { TRIANGLE_BUDGETS } from '../../constants.js';
import type { RegionTier } from '../../regional/types.js';
import type { ModelOptions } from '../registry.js';
import { FACTORY_LABELS, LAND_LABELS, PlotBuilder, PlotCategory, WORKS_LABELS } from './builder.js';
import { condoTower, flats, townhouse, walkup } from './homes.js';
import { cornerShop, mixedUse, office, officeTower, shophouse } from './shops.js';
import { garage, processingWorks, smallFactory, warehouse } from './factories.js';
import { apartmentBlock, condoTowerLot, mall, officeTowerLot } from './lots.js';
import { factoryLot, plantLot } from './lots-industry.js';

/** One-tile painted zones ("plots", แปลง) grow one of these per tile, level by level, and joined plots grow the
 * two-by-two "lots". They claim no tile values: the city view places them from its plots layer and turns each to face
 * its road (front +Z). `variant` is the land value class (0–3; one-tile factories 0–1) and may change the massing;
 * the seed never does. */
export interface PlotSpec {
  id: string; category: PlotCategory; level: number; regionTier: RegionTier; budget: number; footprint: readonly [number, number];
  variants: readonly number[]; labels: { th: readonly string[]; en: readonly string[] }; build: (b: PlotBuilder) => Record<string, unknown>;
}
const LAND = [0, 1, 2, 3] as const, WORKS = [0, 1] as const, ONE = [1, 1] as const, TWO = [2, 2] as const;
const spec = (id: string, category: PlotCategory, level: number, regionTier: RegionTier, budget: number, build: PlotSpec['build'],
  footprint: readonly [number, number] = ONE): PlotSpec => {
  const works = category === 'industrial', lot = footprint[0] > 1;
  return Object.freeze({ id, category, level, regionTier, budget, footprint, build, variants: works && !lot ? WORKS : LAND,
    labels: works ? (lot ? WORKS_LABELS : FACTORY_LABELS) : LAND_LABELS });
};

export const PLOT_SPECS: readonly PlotSpec[] = Object.freeze([
  spec('plot.res_2', 'residential', 2, 'R2', TRIANGLE_BUDGETS.house, townhouse),
  spec('plot.res_3', 'residential', 3, 'R2', TRIANGLE_BUDGETS.house, walkup),
  spec('plot.res_4', 'residential', 4, 'R3', TRIANGLE_BUDGETS.lowRise, flats),
  spec('plot.res_5', 'residential', 5, 'R3', TRIANGLE_BUDGETS.lowRise, condoTower),
  spec('plot.com_1', 'commercial', 1, 'R2', TRIANGLE_BUDGETS.house, cornerShop),
  spec('plot.com_2', 'commercial', 2, 'R2', TRIANGLE_BUDGETS.house, shophouse),
  spec('plot.com_3', 'commercial', 3, 'R2', TRIANGLE_BUDGETS.house, mixedUse),
  spec('plot.com_4', 'commercial', 4, 'R3', TRIANGLE_BUDGETS.lowRise, office),
  spec('plot.com_5', 'commercial', 5, 'R3', TRIANGLE_BUDGETS.lowRise, officeTower),
  spec('plot.ind_1', 'industrial', 1, 'R2', TRIANGLE_BUDGETS.house, garage),
  spec('plot.ind_2', 'industrial', 2, 'R3', TRIANGLE_BUDGETS.house, warehouse),
  spec('plot.ind_3', 'industrial', 3, 'R3', TRIANGLE_BUDGETS.house, smallFactory),
  spec('plot.ind_4', 'industrial', 4, 'R3', TRIANGLE_BUDGETS.house, processingWorks),
  spec('lot.res_4', 'residential', 4, 'R3', TRIANGLE_BUDGETS.highRise, apartmentBlock, TWO),
  spec('lot.res_5', 'residential', 5, 'R3', TRIANGLE_BUDGETS.highRise, condoTowerLot, TWO),
  spec('lot.com_4', 'commercial', 4, 'R3', TRIANGLE_BUDGETS.lowRise, mall, TWO),
  spec('lot.com_5', 'commercial', 5, 'R3', TRIANGLE_BUDGETS.highRise, officeTowerLot, TWO),
  spec('lot.ind_3', 'industrial', 3, 'R3', TRIANGLE_BUDGETS.lowRise, factoryLot, TWO),
  spec('lot.ind_4', 'industrial', 4, 'R3', TRIANGLE_BUDGETS.lowRise, plantLot, TWO),
]);
export const PLOT_IDS = PLOT_SPECS.map(s => s.id);

export function createPlot(id: string, options: ModelOptions = {}): Group {
  const plot = PLOT_SPECS.find(s => s.id === id);
  if (!plot) throw new RangeError(`Unknown plot model: ${id}`);
  const b = new PlotBuilder(options, plot.variants.length - 1), metadata = plot.build(b);
  return b.finishPlot(plot.id, plot.category, plot.regionTier, plot.level, plot.labels, metadata, plot.footprint);
}
