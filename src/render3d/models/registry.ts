/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Group } from 'three';
import { TRIANGLE_BUDGETS } from '../constants.js';
import { createDebugBox } from './debug/box.js';

export interface ModelOptions {
  seed?: number;
  variant?: number;
  state?: string;
}
export type ModelFactory = (opts?: ModelOptions) => Group;
export type ModelCategory = 'terrain' | 'vegetation' | 'road' | 'rail' | 'power'
  | 'residential' | 'commercial' | 'industrial' | 'services' | 'transport'
  | 'veh' | 'fx' | 'ui' | 'debug';

export interface ModelRegistration {
  factory: ModelFactory;
  category: ModelCategory;
  /** Footprint in tiles; root origin is at its center at y = 0. */
  footprint: readonly [number, number];
  tiles: readonly number[];
  budget: number;
  /** Full tile coverage without the building margin. */
  tiling?: boolean;
  ground?: 'land' | 'water' | 'bridge' | 'shore';
  variants?: readonly number[];
  states?: readonly string[];
}

export const registry: Readonly<Record<string, ModelRegistration>> = Object.freeze({
  'debug.box_3x3': {
    factory: createDebugBox,
    category: 'debug',
    footprint: [3, 3],
    tiles: [], // Debug assets never map to simulation tiles.
    budget: TRIANGLE_BUDGETS.lowRise,
    variants: [0, 1, 2, 3],
    states: ['solid', 'lit'],
  },
});
