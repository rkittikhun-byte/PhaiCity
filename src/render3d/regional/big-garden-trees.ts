/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Color, Float32BufferAttribute, Vector3 } from 'three';
import { vertexFinish } from '../materials/library.js';
import { treeParts, TreeKind } from '../models/vegetation/trees.js';
import type { GardenPlantBuilder } from './garden-plants.js';
import type { RegionStyle } from './contracts.js';

/** Mature branched canopies with clustered alpha cards, in a fixed garden envelope. */
export function bigGardenTreeBuilder(style: RegionStyle): GardenPlantBuilder {
  return (kind, options = {}) => {
    const palm = ['coconut', 'sugar_palm', 'oil_palm'].includes(kind);
    const plant = treeParts(kind as TreeKind, { seed: options.seed, region: style.id, density: palm ? 0.8 : 0.55 });
    plant.parts.forEach(p => {
      if (p.material.userData.materialKey !== 'foliage_tropical') return;
      p.geometry.computeBoundingBox();
      const center = p.geometry.boundingBox!.getCenter(new Vector3());
      p.geometry.translate(-center.x, -center.y, -center.z).scale(1.4, 1.4, 1.4).translate(center.x, center.y, center.z);
    });
    const bounds = new Box3(); plant.parts.forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); });
    const radius = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.min.z), bounds.max.x, bounds.max.z);
    const scale = (options.radius ?? 3.5) / radius, height = (options.height ?? 11.5) / (bounds.max.y - bounds.min.y);
    const foliage = vertexFinish('foliage_tropical'), wood = options.bark ?? vertexFinish(style.id === 'north' ? 'wood_teak' : 'wood_painted');
    plant.parts.forEach(p => {
      const rgb = (p.material as typeof foliage).color ?? new Color(0x725a42);
      const values = new Float32Array(p.geometry.getAttribute('position').count * 3);
      for (let i = 0; i < values.length; i += 3) { values[i] = rgb.r; values[i + 1] = rgb.g; values[i + 2] = rgb.b; }
      p.geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
      p.geometry.translate(0, -bounds.min.y, 0).scale(scale, height, scale);
      p.material = p.material.userData.materialKey === 'foliage_tropical' ? foliage : wood;
    });
    return plant.parts;
  };
}
