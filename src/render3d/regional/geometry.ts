/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Material, Vector3 } from 'three';
import { PlantBuilder, point } from '../models/vegetation/builder.js';
import { applyWorldUV, GeometryPart, mergeByMaterial, countTriangles } from '../util/geometry.js';

export { point };
export class KitBuilder extends PlantBuilder {
  /** Single-sided architectural face, vertices counterclockwise from the exterior. */
  face(vertices: readonly Vector3[], mat: Material): void {
    const values: number[] = [];
    for (let i = 1; i < vertices.length - 1; i++) values.push(...vertices[0].toArray(), ...vertices[i].toArray(), ...vertices[i + 1].toArray());
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
    geometry.computeVertexNormals(); this.add(applyWorldUV(geometry, 1), mat);
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: Material, roll = 0): void {
    const source = new BoxGeometry(w, h, d).rotateZ(roll).translate(x, y, z);
    this.add(applyWorldUV(source, 1), mat); source.dispose();
  }
  /** Closed thin panel; vertices arrive counterclockwise as viewed from outside. */
  panel(vertices: readonly Vector3[], normal: Vector3, thickness: number, mat: Material): void {
    const v: number[] = [], front = vertices.map(p => p.clone()), back = vertices.map(p => p.clone().addScaledVector(normal, -thickness));
    const triangle = (a: Vector3, b: Vector3, c: Vector3): void => { v.push(...a.toArray(), ...b.toArray(), ...c.toArray()); };
    for (let i = 1; i < vertices.length - 1; i++) { triangle(front[0], front[i], front[i + 1]); triangle(back[0], back[i + 1], back[i]); }
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      triangle(front[i], back[i], front[j]); triangle(front[j], back[i], back[j]);
    }
    const src = new BufferGeometry(); src.setAttribute('position', new Float32BufferAttribute(v, 3)); src.computeVertexNormals();
    this.add(applyWorldUV(src, 1), mat); src.dispose();
  }
}

/** Bakes placement so callers can merge an entire house in one batch per material. */
export function place(parts: readonly GeometryPart[], x: number, y: number, z: number, scale = 1): GeometryPart[] {
  return parts.map(part => ({ material: part.material, geometry: part.geometry.scale(scale, scale, scale).translate(x, y, z) }));
}

export function kitPreview(id: string, parts: readonly GeometryPart[]) {
  const root = mergeByMaterial(id, parts); parts.forEach(part => part.geometry.dispose());
  root.userData = { id, category: 'ui', footprint: [1, 1], tiles: [], triangles: countTriangles(root), regionTier: 'R3' };
  return root;
}
