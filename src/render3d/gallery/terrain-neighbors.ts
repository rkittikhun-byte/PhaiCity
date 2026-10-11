/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import type { ModelOptions } from '../models/registry.js';
import { createTerrain, TerrainKind } from '../models/terrain/terrain.js';
import { mask4, SIDES } from '../models/terrain/helpers.js';

/** Diagnostic surroundings only; these are excluded from the inspected model's metrics. */
export function terrainNeighbors(id: string, options: ModelOptions): Group {
  const root = new Group(); root.name = 'gallery/terrain-neighbors';
  if (!id.startsWith('terrain.')) return root;
  const kind = id.slice(8) as TerrainKind, land = mask4(kind === 'shore' ? options.variant : options.landMask);
  const woods = mask4(options.variant), water = mask4(options.waterMask);
  const directionMask = (x: number, z: number): number => (z < 0 ? 1 : 0) | (x > 0 ? 2 : 0) | (z > 0 ? 4 : 0) | (x < 0 ? 8 : 0);
  const typeAt = (x: number, z: number): TerrainKind => {
    if (x === 0 && z === 0) return kind;
    const direction = directionMask(x, z);
    if (kind === 'water' || kind === 'shore') return direction & land ? 'dirt' : 'water';
    if (kind === 'woods') {
      if (direction & water) return 'water';
      return (direction & woods) === direction ? 'woods' : 'dirt';
    }
    return kind;
  };
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (!x && !z) continue;
    const type = typeAt(x, z);
    const neighborMask = (target: 'land' | 'water' | 'woods'): number => SIDES.reduce((mask, side) => {
      const adjacent = typeAt(x + side.x, z + side.z);
      const matches = target === 'land' ? adjacent !== 'water' && adjacent !== 'shore' : adjacent === target;
      return matches ? mask | side.bit : mask;
    }, 0);
    const tile = createTerrain(type, { ...options, seed: ((options.seed ?? 1) + (x + 2) * 371 + (z + 2) * 1297) >>> 0,
      variant: type === 'woods' ? neighborMask('woods') : options.variant,
      landMask: neighborMask('land'), waterMask: neighborMask('water'),
      worldOrigin: [x * 10, z * 10] });
    tile.position.set(x * 10, 0, z * 10); root.add(tile);
  }
  return root;
}
