/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute,
  Group, Material, Matrix4, Mesh, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { applyWorldUV, countTriangles, GeometryPart, mergeByMaterial } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';

export const point = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** Owned construction buffers, baked and merged into one mesh per library material. */
export class PlantBuilder {
  readonly parts: GeometryPart[] = [];
  leafCards = 0;
  variation?: { sizeScale: number; yaw: number; lean: readonly [number, number] };

  add(geometry: BufferGeometry, material: Material): void { this.parts.push({ geometry, material }); }

  tube(points: readonly Vector3[], radius: number, material: Material, segments = 5, sides = 5): void {
    const source = new TubeGeometry(new CatmullRomCurve3([...points]), segments, radius, sides, false);
    const geometry = applyWorldUV(source, 1); source.dispose(); this.add(geometry, material);
  }

  taper(points: readonly Vector3[], baseRadius: number, material: Material, segments = 6, sides = 6): CatmullRomCurve3 {
    const curve = new CatmullRomCurve3([...points]);
    const source = new TubeGeometry(curve, segments, baseRadius, sides, false);
    const positions = source.getAttribute('position');
    for (let segment = 0; segment <= segments; segment++) {
      const center = curve.getPointAt(segment / segments);
      const factor = 1 - segment / segments * 0.7;
      for (let side = 0; side <= sides; side++) {
        const index = segment * (sides + 1) + side;
        const p = new Vector3().fromBufferAttribute(positions, index).sub(center).multiplyScalar(factor).add(center);
        positions.setXYZ(index, p.x, p.y, p.z);
      }
    }
    source.computeVertexNormals();
    const geometry = applyWorldUV(source, 1); source.dispose(); this.add(geometry, material);
    return curve;
  }

  ellipsoid(center: Vector3, size: Vector3, material: Material, segments = 8, rows = 6): void {
    const source = new SphereGeometry(1, segments, rows).scale(size.x, size.y, size.z).translate(center.x, center.y, center.z);
    const geometry = applyWorldUV(source, 1); source.dispose(); this.add(geometry, material);
  }

  pole(start: Vector3, end: Vector3, radius: number, material: Material, sides = 6): void {
    const direction = end.clone().sub(start);
    const source = new CylinderGeometry(radius, radius, direction.length(), sides, 1);
    source.applyQuaternion(new Quaternion().setFromUnitVectors(point(0, 1, 0), direction.normalize()));
    source.translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    const geometry = applyWorldUV(source, 1); source.dispose(); this.add(geometry, material);
  }

  /** One leaf from the two-leaf CC0 atlas, folded through real 3D space.
   * Leaf UVs deliberately use an atlas instead of world projection; their size is botanical.
   */
  leaf(base: Vector3, direction: Vector3, length: number, width: number, material: Material,
    twist = 0, bend = 0.12, segments = 1, torn = false, reverse = false): void {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    const u0 = reverse ? 0.52 : 0.02, u1 = reverse ? 0.98 : 0.48;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      for (const side of [-1, 1]) {
        vertices.push(side * width / 2, t * length, bend * length * t * t + width * 0.07);
        uv.push(side < 0 ? u0 : u1, 0.1 + t * 0.81);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      // Missing edge triangles produce torn banana margins, not a painted tear.
      if (!torn || i % 3 !== 1) indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
    geometry.computeVertexNormals(); geometry.rotateY(twist);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(point(0, 1, 0), direction.clone().normalize()));
    geometry.translate(base.x, base.y, base.z); this.add(geometry, material); this.leafCards++;
  }

  flower(center: Vector3, radius: number, material: Material, angle = 0): void {
    const vertices: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = angle + i / 5 * Math.PI * 2, b = a + Math.PI * 2 / 5;
      vertices.push(center.x, center.y + radius * 0.2, center.z,
        center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius,
        center.x + Math.cos(b) * radius, center.y, center.z + Math.sin(b) * radius);
      vertices.push(center.x, center.y - radius * 0.06, center.z,
        center.x + Math.cos(b) * radius, center.y, center.z + Math.sin(b) * radius,
        center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius);
    }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); this.add(applyWorldUV(geometry, 1), material); geometry.dispose();
  }

  /** Keep tree height exact before the requested ±15% size variation; shear adds lean
   * without pushing roots below ground. Mangrove roots deliberately retain negative Y.
   */
  transformPlant(height: number, scale: number, yaw: number, leanX: number, leanZ: number, submergedRoots = false): void {
    const bounds = new Box3(); this.parts.forEach(part => {
      part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!);
    });
    const baseY = submergedRoots ? 0 : bounds.min.y;
    const normalize = new Matrix4().makeScale(1, height / (bounds.max.y - baseY), 1)
      .multiply(new Matrix4().makeTranslation(0, -baseY, 0));
    const shear = new Matrix4().set(1, leanX, 0, 0, 0, 1, 0, 0, 0, leanZ, 1, 0, 0, 0, 0, 1);
    const transform = new Matrix4().makeRotationY(yaw).multiply(shear)
      .multiply(new Matrix4().makeScale(scale, scale, scale)).multiply(normalize);
    this.parts.forEach(part => part.geometry.applyMatrix4(transform));
  }

  finish(id: string, category: string, footprint: readonly number[], tiles: readonly number[], options: ModelOptions): Group {
    const root = mergeByMaterial(id, this.parts); this.parts.forEach(part => part.geometry.dispose());
    root.userData = { id, category, footprint: [...footprint], tiles: [...tiles],
      triangles: countTriangles(root), regionTier: 'R3', region: options.region ?? 'central', leafCards: this.leafCards };
    root.traverse(object => { if (object instanceof Mesh) object.userData.part = object.material instanceof Material ? object.material.name : 'surface'; });
    return root;
  }
}
