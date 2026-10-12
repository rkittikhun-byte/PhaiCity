/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, PlaneGeometry, Vector3 } from 'three';
import { point } from '../../regional/geometry.js';
import type { CommercialBuilder } from './builder.js';

/** An eight-sided plan with genuinely cut corners, rather than a surface decoration. */
export function chamferPlan(w: number, d: number, corner: number, x = 0, z = 0): Vector3[] {
  return [[-w / 2 + corner, -d / 2], [w / 2 - corner, -d / 2], [w / 2, -d / 2 + corner],
    [w / 2, d / 2 - corner], [w / 2 - corner, d / 2], [-w / 2 + corner, d / 2],
    [-w / 2, d / 2 - corner], [-w / 2, -d / 2 + corner]].map(([px, pz]) => point(x + px, 0, z + pz));
}
export function chamferPrism(b: CommercialBuilder, w: number, d: number, corner: number, bottom: number, top: number,
  material: Material, x = 0, z = 0): void {
  const first = b.parts.length, low = chamferPlan(w, d, corner, x, z).map(p => p.setY(bottom)), high = low.map(p => p.clone().setY(top));
  b.face(low, material); b.face([...high].reverse(), material);
  for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; b.face([low[j], low[i], high[i], high[j]], material); }
  const bounds = new Box3(); b.parts.slice(first).forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); });
  b.structuralBodies.push({ min: bounds.min.toArray(), max: bounds.max.toArray() });
}
/** Display UVs describe a screen, so they remain normalized rather than using world projection. */
export function displayPanel(b: CommercialBuilder, w: number, h: number, x: number, y: number, z: number, material: Material): void {
  b.add(new PlaneGeometry(w, h).translate(x, y, z), material);
}
