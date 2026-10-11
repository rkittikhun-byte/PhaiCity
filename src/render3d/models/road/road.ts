/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Group } from 'three';
import type { ModelOptions } from '../registry.js';
import { createBasicRoad } from './basic.js';
import { createCableBridge } from './cable-bridge.js';
import { createBridge, createDrawbridge, createPowerCrossing, createRailCrossing } from './special.js';

export const ROAD_KINDS = ['straight', 'corner', 't', 'cross', 'end', 'single', 'bridge', 'drawbridge', 'rail_crossing', 'power_crossing', 'bridge_cable_deck', 'bridge_cable_pylon'] as const;
export type RoadKind = typeof ROAD_KINDS[number];
export const ROAD_TILES: Readonly<Record<RoadKind, readonly number[]>> = Object.freeze({
  straight: [66, 67], corner: [68, 69, 70, 71], t: [72, 73, 74, 75], cross: [76],
  // The original game reuses straight tile numbers for zero/one connections.
  // These shapes are selected by neighbor masks rather than a unique tile value.
  end: [], single: [], bridge: [64, 65], drawbridge: [828, 829, 830, 831, 832, 948, 949, 950, 951],
  rail_crossing: [237, 238], power_crossing: [77, 78],
  // Selected by the renderer from long runs of ordinary 64/65 tiles.
  bridge_cable_deck: [], bridge_cable_pylon: [],
});

export function createRoad(kind: RoadKind, options: ModelOptions = {}): Group {
  const tiles = ROAD_TILES[kind];
  switch (kind) {
    case 'bridge': return createBridge(options, tiles);
    case 'drawbridge': return createDrawbridge(options, tiles);
    case 'rail_crossing': return createRailCrossing(options, tiles);
    case 'power_crossing': return createPowerCrossing(options, tiles);
    case 'bridge_cable_deck': return createCableBridge(false, options);
    case 'bridge_cable_pylon': return createCableBridge(true, options);
    default: return createBasicRoad(kind, options, tiles);
  }
}
