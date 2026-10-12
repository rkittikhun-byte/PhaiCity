/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material } from 'three';
import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import { regionalLeafColor } from './vegetation.js';
import { KitBuilder, point } from './geometry.js';
import type { GeometryPart } from '../util/geometry.js';
import type { RegionStyle } from './contracts.js';

export interface GardenPlantOptions { seed?: number; height?: number; radius?: number; bark?: Material }
export type GardenPlantBuilder = (kind: string, options?: GardenPlantOptions) => GeometryPart[];

/** Young garden specimens: true alpha foliage, fixed envelope, inexpensive species silhouettes. */
export function gardenPlantBuilder(style: RegionStyle): GardenPlantBuilder {
  return (kind, options = {}) => {
    const b = new KitBuilder(), rng = seededRng(options.seed), bark = options.bark ?? tint('wood_painted', style.palette[0].trim);
    const leaf = tint('foliage_tropical', regionalLeafColor(style.id));
    if (kind === 'hedge') {
      for (let i = 0; i < 64; i++) b.leaf(point((i % 16 - 7.5) * 0.19, 0.2 + Math.floor(i / 16) * 0.16, (rng() - 0.5) * 0.2),
        point(0.15, 1, (rng() - 0.5) * 0.2), 0.45, 0.32, leaf, i);
      return b.parts;
    }
    const palm = kind === 'coconut' || kind === 'sugar_palm' || kind === 'oil_palm';
    if (kind === 'bamboo') {
      for (let i = 0; i < 4; i++) {
        const a = i * 2.4, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2;
        b.taper([point(x, 0, z), point(x, 2.4, z), point(x * 3, 4.5, z * 3)], 0.06, bark, 3, 3);
      }
    } else b.taper([point(0, 0, 0), point(palm ? -0.2 : 0, 2, 0), point(palm ? 0.3 : 0, palm ? 4.3 : 3, 0)], palm ? 0.1 : 0.13, bark, 3, 4);
    if (palm) {
      const crown = point(0.3, 4.3, 0);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + rng() * 0.1;
        const curve = b.taper([crown, crown.clone().add(point(Math.cos(a) * 0.75, 0.2, Math.sin(a) * 0.75)),
          crown.clone().add(point(Math.cos(a) * 1.6, -0.9, Math.sin(a) * 1.6))], 0.025, bark, 2, 3);
        for (let pair = 0; pair < 4; pair++) for (const side of [-1, 1]) {
          const fan = kind === 'sugar_palm';
          b.leaf(curve.getPointAt(fan ? 0.6 : (pair + 1) / 5), point(Math.cos(a + side * (fan ? pair * 0.19 : 0.8)), -0.2, Math.sin(a + side * (fan ? pair * 0.19 : 0.8))),
            fan ? 0.8 : 0.65, fan ? 0.25 : 0.16, leaf, a);
        }
      }
    } else for (let i = 0; i < 52; i++) {
      const t = (i + 0.5) / 52, a = i * 2.399963 + rng() * 0.15;
      const cone = kind === 'durian' || kind === 'pine', narrow = kind === 'bamboo' || kind === 'eucalyptus';
      const r = (cone ? t : Math.sqrt(t)) * (narrow ? 0.7 : 1.25);
      const y = 4.5 - t * (cone ? 2.2 : 1.2);
      b.leaf(point(Math.cos(a) * r, y, Math.sin(a) * r), point(Math.cos(a + 0.6), 0.3, Math.sin(a + 0.6)),
        narrow ? 0.6 : 0.9, narrow ? 0.12 : kind === 'mangosteen' ? 0.48 : 0.36, leaf, a, 0.1, 1, false, i % 2 === 0);
    }
    b.transformPlant(options.height ?? 3.2, 1, rng() * Math.PI * 2, (rng() - 0.5) * 0.025, (rng() - 0.5) * 0.025);
    const bounds = new Box3(); b.parts.forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); });
    const scale = (options.radius ?? 0.72) / Math.max(Math.abs(bounds.min.x), bounds.max.x, Math.abs(bounds.min.z), bounds.max.z);
    b.parts.forEach(p => p.geometry.scale(scale, 1, scale));
    return b.parts;
  };
}
