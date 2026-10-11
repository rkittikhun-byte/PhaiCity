/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Group } from 'three';
import { TRIANGLE_BUDGETS } from '../constants.js';
import { createDebugBox } from './debug/box.js';
import type { RegionId, RegionTier } from '../regional/types.js';
import { createTree, TREE_FOOTPRINTS, TREE_KINDS } from './vegetation/trees.js';
import { createPark, PARK_IDS, PARK_TILES } from './vegetation/parks.js';
import { createTerrain, TERRAIN_KINDS, TERRAIN_TILES } from './terrain/terrain.js';
import { createRoad, ROAD_KINDS, ROAD_TILES } from './road/road.js';
import { createRail, RAIL_KINDS, RAIL_TILES } from './rail/rail.js';

export interface ModelOptions {
  seed?: number;
  variant?: number;
  state?: string;
  region?: RegionId;
  /** Neighbor masks: bit0 N, bit1 E, bit2 S, bit3 W. Shore/woods use variant. */
  landMask?: number;
  waterMask?: number;
  bankStyle?: 'earth' | 'concrete' | 'brick';
  /** Tile center in world X/Z; required when baking adjacent terrain UVs. */
  worldOrigin?: readonly [number, number];
  /** World-space yaw used to bake rail UVs before the caller rotates the canonical model. */
  worldRotationY?: number;
  /** Distance along a connected rail route at its canonical start; preserves 0.6 m sleeper phase on curves. */
  sleeperOffset?: number;
}
export type ModelFactory = (opts?: ModelOptions) => Group;
export type ModelCategory = 'terrain' | 'vegetation' | 'veg' | 'park' | 'road' | 'rail' | 'power'
  | 'residential' | 'commercial' | 'industrial' | 'services' | 'transport'
  | 'veh' | 'fx' | 'ui' | 'debug';

export interface ModelRegistration {
  factory: ModelFactory;
  category: ModelCategory;
  /** Footprint in tiles; root origin is at its center at y = 0. */
  footprint: readonly [number, number];
  tiles: readonly number[];
  budget: number;
  regionTier: RegionTier;
  /** Prompt 2 explicitly permits seeded size, lean and crown variation for plants. */
  seededVegetation?: boolean;
  /** Full tile coverage without the building margin. */
  tiling?: boolean;
  ground?: 'land' | 'water' | 'bridge' | 'shore';
  variants?: readonly number[];
  states?: readonly string[];
}

export const registry: Readonly<Record<string, ModelRegistration>> = Object.freeze({
  ...Object.fromEntries(RAIL_KINDS.map(kind => [`rail.${kind}`, {
    factory: (options?: ModelOptions) => createRail(kind, options), category: 'rail', footprint: [1, 1],
    tiles: RAIL_TILES[kind], budget: TRIANGLE_BUDGETS.tile, regionTier: 'R3', tiling: true,
    ...(kind === 'bridge' ? { ground: 'bridge' } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(ROAD_KINDS.map(kind => [`road.${kind}`, {
    factory: (options?: ModelOptions) => createRoad(kind, options),
    category: 'road', footprint: [1, 1], tiles: ROAD_TILES[kind], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true,
    ...(kind.includes('bridge') ? { ground: 'bridge' } : {}),
    ...(['drawbridge', 'rail_crossing'].includes(kind) ? { states: ['closed', 'open'] } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(TERRAIN_KINDS.map(kind => [`terrain.${kind}`, {
    factory: (options?: ModelOptions) => createTerrain(kind, options),
    category: 'terrain', footprint: [1, 1], tiles: TERRAIN_TILES[kind], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true,
    ...(['water', 'shore'].includes(kind) ? { ground: kind } : {}),
    ...(kind === 'woods' ? { seededVegetation: true } : {}),
    variants: ['shore', 'woods'].includes(kind) ? Array.from({ length: 16 }, (_, i) => i) :
      ['dirt', 'rubble', 'flood'].includes(kind) ? [0, 1, 2, 3] : [0],
  } as ModelRegistration])),
  ...Object.fromEntries(TREE_KINDS.map(kind => [`veg.${kind}`, {
    factory: (options?: ModelOptions) => createTree(kind, options),
    category: 'veg', footprint: TREE_FOOTPRINTS[kind], tiles: [], budget: TRIANGLE_BUDGETS.tree,
    regionTier: 'R3', seededVegetation: true,
    ...(kind === 'hedge' ? { tiling: true } : {}),
    ...(kind === 'mangrove' ? { ground: 'shore' } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(PARK_IDS.map((id, index) => [id, {
    factory: (options?: ModelOptions) => createPark(index, options),
    category: 'park', footprint: [1, 1], tiles: PARK_TILES[index], budget: TRIANGLE_BUDGETS.prop,
    regionTier: 'R3', seededVegetation: index !== 4,
    ...(index === 4 ? { states: ['on', 'off'] } : {}),
  } as ModelRegistration])),
  'debug.box_3x3': {
    factory: createDebugBox,
    category: 'debug',
    footprint: [3, 3],
    tiles: [], // Debug assets never map to simulation tiles.
    budget: TRIANGLE_BUDGETS.lowRise,
    regionTier: 'R3',
    variants: [0, 1, 2, 3],
    states: ['solid', 'lit'],
  },
});
