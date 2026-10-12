/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Material, Matrix4, PlaneGeometry } from 'three';
import { serviceConcreteMaterial, vertexFinish } from '../../materials/library.js';
import type { MaterialKey } from '../../materials/library.js';
import { CommercialBuilder } from '../commercial/builder.js';
import { point } from '../../regional/geometry.js';
import type { GeometryPart } from '../../util/geometry.js';

/** Colored civic details and vehicles share finishes; kit roofs keep their own scanned material. */
export class ServiceBuilder extends CommercialBuilder {
  stone = serviceConcreteMaterial();
  readonly metal = vertexFinish('metal_painted');
  readonly wood = vertexFinish('wood_painted');

  add(geometry: BufferGeometry, material: Material): void {
    if (material.userData.vertexFinish && !geometry.hasAttribute('color')) {
      CommercialBuilder.color(geometry, material === this.metal ? 0x363f3e : material === this.wood ? 0x735640 : 0xffffff);
    }
    super.add(geometry, material);
  }

  kitParts(parts: GeometryPart[]): GeometryPart[] {
    for (const part of parts) {
      const key = part.material.userData.materialKey as MaterialKey;
      const target = key === 'wood_painted' || key === 'wood_teak' ? this.wood
        : key.startsWith('concrete_') ? this.stone : key === 'plaster_tint' ? this.paint : undefined;
      if (target) {
        const color = (part.material as Material & { color: { getHex(): number } }).color.getHex();
        CommercialBuilder.color(part.geometry, color); part.material = target;
      }
    }
    return parts;
  }

  civicRoof(w: number, d: number, x: number, baseY: number, z: number, yaw = 0): void {
    this.take(this.kitParts(this.kit.services.roof([w, d], { baseY, seed: this.options.seed,
      overhang: 0.35, detail: 'low' })), x, 0, z, yaw);
  }

  patrolCar(x: number, z: number): void {
    this.car(x, z, this.paint);
    for (const side of [-1, 1]) this.colored(0x294b65, () => this.box(0.025, 0.18, 2.9, x + side * 0.81, 0.84, z, this.metal));
    this.colored(0xf4f1e7, () => this.box(1.12, 0.12, 0.3, x, 1.65, z, this.metal));
    for (const side of [-1, 1]) this.colored(side < 0 ? 0xb83e39 : 0x3869a4,
      () => this.box(0.4, 0.13, 0.3, x + side * 0.34, 1.75, z, this.metal));
  }

  patrolBike(x: number, z: number): void {
    this.motorcycle(x, z, this.paint);
    for (const side of [-1, 1]) {
      this.colored(0xf3f2e9, () => this.box(0.18, 0.3, 0.48, x + side * 0.26, 0.73, z - 0.46, this.metal));
      this.colored(0x294b65, () => this.box(0.025, 0.1, 0.42, x + side * 0.36, 0.77, z - 0.46, this.metal));
    }
  }

  fireEngine(x: number, z: number): void {
    const first = this.parts.length;
    this.colored(0xb93229, () => {
      this.box(2.25, 1.35, 6.6, 0, 1.43, 0, this.metal);
      this.box(2.2, 1.03, 1.65, 0, 2.23, 2.35, this.metal);
    });
    this.box(1.92, 0.65, 0.04, 0, 2.33, 3.2, this.glass);
    for (const side of [-1, 1]) {
      this.box(0.035, 0.62, 1.05, side * 1.12, 2.31, 2.3, this.glass);
      this.colored(0xe4e5db, () => this.box(0.035, 0.22, 6.25, side * 1.14, 1.55, 0, this.metal));
      for (const dz of [-2.2, 2.2]) this.cylinder(0.45, 0.24, side * 1.1, 0.59, dz, this.metal, 8, Math.PI / 2);
      for (const dz of [-1.65, -0.2, 1.25]) this.colored(0xb9c0ba,
        () => this.box(0.035, 0.6, 1.12, side * 1.14, 1.1, dz, this.metal));
    }
    this.colored(0xb9c0ba, () => {
      for (const dx of [-0.42, 0.42]) this.box(0.08, 0.1, 4.6, dx, 2.17, -0.8, this.metal);
      for (let i = 0; i < 12; i++) this.box(0.9, 0.08, 0.07, 0, 2.17, -2.9 + i * 0.39, this.metal);
      this.box(2.1, 0.15, 0.12, 0, 0.97, 3.35, this.metal);
    });
    this.colored(0xe45b43, () => this.box(1.35, 0.15, 0.3, 0, 2.83, 2.4, this.metal));
    const transform = new Matrix4().makeTranslation(x, 0.08, z);
    this.parts.slice(first).forEach(part => part.geometry.applyMatrix4(transform));
  }

  thaiFlag(x: number, z: number): void {
    this.pole(point(x, 0.1, z), point(x, 9.6, z), 0.055, this.metal, 8);
    this.colored(0xd1c8b4, () => this.cylinder(0.46, 0.18, x, 0.15, z, this.stone, 12));
    const colors = [0xa51931, 0xf4f5f8, 0x2d2a4a, 0xf4f5f8, 0xa51931], heights = [0.25, 0.25, 0.5, 0.25, 0.25];
    let top = 9.3;
    colors.forEach((color, band) => {
      const height = heights[band], source = new PlaneGeometry(2.2, height, 8, 1), front = source.toNonIndexed();
      source.dispose();
      const position = front.getAttribute('position');
      for (let i = 0; i < position.count; i++) position.setZ(i, Math.sin((position.getX(i) + 1.1) * 2.4) * 0.12);
      front.computeVertexNormals(); front.translate(x + 1.1, top - height / 2, z);
      const back = front.clone(), p = back.getAttribute('position');
      for (let i = 0; i < p.count; i += 3) {
        const a = point(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
        p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, a.x, a.y, a.z);
      }
      back.computeVertexNormals(); CommercialBuilder.color(front, color); CommercialBuilder.color(back, color);
      this.add(front, this.metal); this.add(back, this.metal); top -= height;
    });
  }
}
