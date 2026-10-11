/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Group,
  Material, Matrix4, Object3D, Vector3,
} from 'three';
import { applyWorldUV, countTriangles, GeometryPart, mergeByMaterial } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import type { RegionTier } from '../../regional/types.js';

export const point = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export class VehicleBuilder {
  readonly parts: GeometryPart[] = [];
  readonly anchors: Object3D[] = [];
  readonly animNodes: Object3D[] = [];

  add(geometry: BufferGeometry, material: Material, transform?: Matrix4): void {
    this.parts.push({ geometry, material, transform });
  }

  box(center: Vector3, size: Vector3, material: Material, yaw = 0, pitch = 0, roll = 0): void {
    const geom = new BoxGeometry(size.x, size.y, size.z);
    if (roll !== 0) geom.rotateZ(roll);
    if (pitch !== 0) geom.rotateX(pitch);
    if (yaw !== 0) geom.rotateY(yaw);
    geom.translate(center.x, center.y, center.z);
    applyWorldUV(geom, 1);
    this.add(geom, material);
  }

  cylinder(center: Vector3, radius: number, height: number, material: Material, sides = 8, axis: 'x' | 'y' | 'z' = 'y'): void {
    const geom = new CylinderGeometry(radius, radius, height, sides);
    if (axis === 'x') geom.rotateZ(-Math.PI / 2);
    else if (axis === 'z') geom.rotateX(Math.PI / 2);
    geom.translate(center.x, center.y, center.z);
    applyWorldUV(geom, 1);
    this.add(geom, material);
  }

  taperedCylinder(
    center: Vector3, radiusTop: number, radiusBottom: number, height: number,
    material: Material, sides = 8, axis: 'x' | 'y' | 'z' = 'y',
  ): void {
    const geom = new CylinderGeometry(radiusTop, radiusBottom, height, sides);
    if (axis === 'x') geom.rotateZ(-Math.PI / 2);
    else if (axis === 'z') geom.rotateX(Math.PI / 2);
    geom.translate(center.x, center.y, center.z);
    applyWorldUV(geom, 1);
    this.add(geom, material);
  }

  wheel(center: Vector3, radius: number, width: number, tireMat: Material, rimMat: Material, sides = 10): void {
    // Tire cylinder oriented along X
    const tireGeom = new CylinderGeometry(radius, radius, width, sides);
    tireGeom.rotateZ(Math.PI / 2);
    tireGeom.translate(center.x, center.y, center.z);
    applyWorldUV(tireGeom, 1);
    this.add(tireGeom, tireMat);

    // Rim cylinder slightly proud on both sides
    const rimGeom = new CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.015, sides);
    rimGeom.rotateZ(Math.PI / 2);
    rimGeom.translate(center.x, center.y, center.z);
    applyWorldUV(rimGeom, 1);
    this.add(rimGeom, rimMat);
  }

  smokeAnchor(name: string, position: Vector3): void {
    const anchor = new Object3D();
    anchor.name = name;
    anchor.position.copy(position);
    this.anchors.push(anchor);
  }

  addAnimNode(node: Object3D): void {
    this.animNodes.push(node);
  }

  finish(
    id: string,
    footprint: readonly [number, number],
    options: ModelOptions,
    regionTier: RegionTier = 'R3',
  ): Group {
    const root = mergeByMaterial(id, this.parts);
    this.parts.forEach(part => part.geometry.dispose());

    for (const anchor of this.anchors) {
      root.add(anchor);
    }
    for (const animNode of this.animNodes) {
      root.add(animNode);
    }

    root.userData = {
      id,
      category: 'veh',
      footprint: [...footprint],
      tiles: [],
      triangles: countTriangles(root),
      regionTier,
      region: options.region ?? 'central',
    };

    return root;
  }
}
