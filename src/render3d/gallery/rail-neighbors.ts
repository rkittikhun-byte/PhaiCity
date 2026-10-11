/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import type { ModelOptions } from '../models/registry.js';
import { createRail } from '../models/rail/rail.js';
import { CURVE_RADIUS, RAIL_MASKS, TrackKind } from '../models/rail/track.js';
import { createTerrain } from '../models/terrain/terrain.js';

/** Edge continuity preview; the center model alone supplies inspector counts. */
export function railNeighbors(id: string, options: ModelOptions): Group {
  const root = new Group(); root.name = 'gallery/rail-neighbors';
  if (!id.startsWith('rail.')) return root;
  const kind = id.slice(5), mask = RAIL_MASKS[kind as TrackKind] ?? 5, bridge = kind === 'bridge';
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (!x && !z) continue;
    const direction = z < 0 ? 1 : x > 0 ? 2 : z > 0 ? 4 : 8;
    const connected = (!x || !z) && (mask & direction);
    const opts: ModelOptions = { ...options, worldOrigin: [(options.worldOrigin?.[0] ?? 0) + x * 10, (options.worldOrigin?.[1] ?? 0) + z * 10],
      worldRotationY: connected && x ? -Math.PI / 2 : 0 };
    if (connected) {
      const start = options.sleeperOffset ?? (options.worldOrigin?.[x && kind === 'cross' ? 0 : 1] ?? 0) - 5;
      // Rotated E/W neighbors run in the reverse direction, preserving the station lattice.
      const length = x && ['corner', 't'].includes(kind) ? CURVE_RADIUS * Math.PI / 2 : 10;
      opts.sleeperOffset = x ? (x > 0 ? -(start + length + 10) : -start) : start + z * 10;
    }
    const tile = connected ? createRail(bridge ? 'bridge' : 'straight', opts)
      : createTerrain(bridge ? 'water' : 'dirt', { ...opts, landMask: 0 });
    if (connected && x) tile.rotation.y = -Math.PI / 2;
    tile.position.set(x * 10, 0, z * 10); root.add(tile);
  }
  return root;
}
