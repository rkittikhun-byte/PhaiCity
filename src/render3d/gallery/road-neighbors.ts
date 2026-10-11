/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import type { ModelOptions } from '../models/registry.js';
import { BASIC_MASKS, BasicRoadKind } from '../models/road/interfaces.js';
import { createRoad } from '../models/road/road.js';
import { createTerrain } from '../models/terrain/terrain.js';

/** Join canonical road arms to neighboring roads; measurements count the center tile only. */
export function roadNeighbors(id: string, options: ModelOptions): Group {
  const root = new Group(); root.name = 'gallery/road-neighbors';
  if (!id.startsWith('road.')) return root;
  const kind = id.slice(5), mask = BASIC_MASKS[kind as BasicRoadKind] ?? 5;
  const bridge = kind.includes('bridge');
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (!x && !z) continue;
    const direction = z < 0 ? 1 : x > 0 ? 2 : z > 0 ? 4 : 8;
    const connected = (!x || !z) && (mask & direction);
    const opts: ModelOptions = { ...options, seed: ((options.seed ?? 1) + (x + 2) * 131 + (z + 2) * 389) >>> 0,
      worldOrigin: [(options.worldOrigin?.[0] ?? 0) + x * 10, (options.worldOrigin?.[1] ?? 0) + z * 10] };
    const tile = connected ? createRoad(kind.startsWith('bridge_cable') ? 'bridge_cable_deck' : 'straight', opts)
      : createTerrain(bridge ? 'water' : 'dirt', { ...opts, landMask: 0 });
    if (connected && x) tile.rotation.y = -Math.PI / 2;
    tile.position.set(x * 10, 0, z * 10); root.add(tile);
  }
  return root;
}
