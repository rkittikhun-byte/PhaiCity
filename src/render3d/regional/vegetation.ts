/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { RegionId } from './types.js';
import type { TreeKind } from '../models/vegetation/trees.js';

export interface WeightedTree {
  readonly id: `veg.${TreeKind}`;
  readonly weight: number;
  /** The placement caller must omit this species away from water. */
  readonly nearWaterOnly?: true;
  /** Plantation species must be arranged on rows by the placement caller. */
  readonly placement?: 'rows';
}

const mixes: Record<RegionId, readonly WeightedTree[]> = {
  north: [{ id: 'veg.teak', weight: 35 }, { id: 'veg.pine', weight: 8 }, { id: 'veg.bamboo', weight: 25 }, { id: 'veg.mango', weight: 17 }, { id: 'veg.rain_tree', weight: 15 }],
  northeast: [{ id: 'veg.tamarind', weight: 30 }, { id: 'veg.eucalyptus', weight: 25, placement: 'rows' }, { id: 'veg.sugar_palm', weight: 20 }, { id: 'veg.mango', weight: 15 }, { id: 'veg.bamboo', weight: 10 }],
  central: [{ id: 'veg.mango', weight: 25 }, { id: 'veg.banana', weight: 20 }, { id: 'veg.coconut', weight: 20 }, { id: 'veg.rain_tree', weight: 20 }, { id: 'veg.bamboo', weight: 15 }],
  east: [{ id: 'veg.durian', weight: 40 }, { id: 'veg.coconut', weight: 25 }, { id: 'veg.mango', weight: 25 }, { id: 'veg.mangrove', weight: 10, nearWaterOnly: true }],
  west: [{ id: 'veg.sugar_palm', weight: 30 }, { id: 'veg.teak', weight: 30 }, { id: 'veg.bamboo', weight: 25 }, { id: 'veg.mango', weight: 15 }],
  south: [{ id: 'veg.rubber', weight: 40, placement: 'rows' }, { id: 'veg.oil_palm', weight: 25 }, { id: 'veg.coconut', weight: 25 }, { id: 'veg.mangrove', weight: 10, nearWaterOnly: true }],
};
Object.values(mixes).forEach(list => { list.forEach(Object.freeze); Object.freeze(list); });

/** Relative weights sum to 100; callers filter nearWaterOnly before sampling. */
export function vegetationMix(region: RegionId = 'central'): readonly WeightedTree[] {
  return mixes[region];
}

/** A small regional tint shift; species geometry is national (R3). */
export function regionalLeafColor(region: RegionId = 'central'): number {
  return { north: 0x608346, northeast: 0x758348, central: 0x668949,
    east: 0x537f41, west: 0x6f8448, south: 0x47783c }[region];
}
