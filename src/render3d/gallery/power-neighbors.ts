/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { createPower, POWER_KINDS, PowerKind, powerMask } from '../models/power/power.js';
import type { ModelOptions } from '../models/registry.js';
import { createTerrain } from '../models/terrain/terrain.js';

/** Adjacent poles expose matching wire terminals; diagonals provide terrain context. */
export function powerNeighbors(id: string, options: ModelOptions): Group {
  const root = new Group(); root.name = 'gallery/power-neighbors';
  const kind = id.slice(6) as PowerKind;
  if (!id.startsWith('power.') || !POWER_KINDS.includes(kind)) return root;
  const mask = powerMask(kind), water = kind === 'water';
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (!x && !z) continue;
    const direction = z < 0 ? 1 : x > 0 ? 2 : z > 0 ? 4 : 8;
    const connected = (!x || !z) && !!(mask & direction);
    const opts: ModelOptions = { ...options,
      worldOrigin: [(options.worldOrigin?.[0] ?? 0) + x * 10, (options.worldOrigin?.[1] ?? 0) + z * 10],
      worldRotationY: connected && x ? -Math.PI / 2 : 0 };
    const tile = connected ? createPower(water ? 'water' : 'straight', opts)
      : createTerrain(water ? 'water' : 'dirt', { ...opts, landMask: 0 });
    if (connected && x) tile.rotation.y = -Math.PI / 2;
    tile.position.set(x * 10, 0, z * 10); root.add(tile);
  }
  return root;
}
