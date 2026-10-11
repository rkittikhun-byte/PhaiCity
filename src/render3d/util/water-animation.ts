/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Mesh, MeshStandardMaterial, Object3D, Texture } from 'three';

/** Scroll shared normal maps once per frame, never once per tile. Absolute time avoids drift. */
export function scrollWaterNormals(roots: readonly Object3D[], seconds: number): void {
  const updated = new Set<Texture>();
  for (const root of roots) {
    const animation = root.getObjectByName('anim_water');
    if (animation?.userData.kind !== 'normal-scroll') continue;
    const velocity: readonly number[] = animation.userData.velocity;
    animation.traverseVisible(object => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const normal = material instanceof MeshStandardMaterial ? material.normalMap : null;
        if (!normal || updated.has(normal)) continue;
        normal.offset.set((seconds * velocity[0]) % 1, (seconds * velocity[1]) % 1); updated.add(normal);
      }
    });
  }
}
