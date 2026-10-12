/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Color, Float32BufferAttribute, Material } from 'three';
import { vertexFinish } from '../../materials/library.js';
import { thaiSignAtlas, AtlasSign, ThaiSignAtlas } from '../../materials/signs.js';
import { ZoneBuilder } from '../residential/zone-builder.js';
import { point } from '../../regional/geometry.js';
import type { GeometryPart } from '../../util/geometry.js';
import type { MaterialKey } from '../../materials/library.js';

export class CommercialBuilder extends ZoneBuilder {
  readonly fabric = vertexFinish('fabric_canvas');
  readonly paint = vertexFinish('plaster_tint');
  readonly signs: AtlasSign[] = [];
  private placements: { index: number; w: number; h: number; x: number; y: number; z: number; yaw: number }[] = [];
  add(geometry: BufferGeometry, material: Material): void {
    if (material.userData.vertexFinish && !geometry.hasAttribute('color')) CommercialBuilder.color(geometry, 0xffffff);
    super.add(geometry, material);
  }
  static color(geometry: BufferGeometry, value: number): void {
    const c = new Color(value), values = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
    geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
  }
  colored(value: number, make: () => void): void {
    const first = this.parts.length; make(); this.parts.slice(first).forEach(p => CommercialBuilder.color(p.geometry, value));
  }
  remap(parts: GeometryPart[], keys: readonly MaterialKey[], target: Material): GeometryPart[] {
    parts.forEach(p => { if (keys.includes(p.material.userData.materialKey)) {
      const value = (p.material as Material & { color: Color }).color.getHex();
      p.material = target; CommercialBuilder.color(p.geometry, value);
    } }); return parts;
  }
  shopSign(text: string, w: number, h: number, x: number, y: number, z: number,
    options: { background?: number; foreground?: number; vertical?: boolean; lit?: boolean; yaw?: number } = {}): void {
    const index = this.signs.length;
    this.signs.push({ text, size: [w, h], background: options.background ?? 0xece3c8, foreground: options.foreground ?? 0x243e39,
      layout: options.vertical ? 'vertical' : 'horizontal', lit: options.lit });
    this.placements.push({ index, w, h, x, y, z, yaw: options.yaw ?? 0 });
  }
  flushSigns(): ThaiSignAtlas {
    const atlas = thaiSignAtlas(this.signs);
    this.feature('Thai-shop-signs', () => this.placements.forEach(p => this.atlas(atlas.material, p.w, p.h, p.x, p.y, p.z, atlas.rects[p.index], p.yaw)));
    return atlas;
  }
  awning(w: number, d: number, x: number, y: number, z: number, color: number): void {
    this.colored(color, () => {
      this.panel([point(x - w / 2, y, z - d / 2), point(x + w / 2, y, z - d / 2),
        point(x + w / 2, y - 0.35, z + d / 2), point(x - w / 2, y - 0.35, z + d / 2)], point(0, 1, 0), 0.04, this.fabric);
      this.box(w, 0.22, 0.04, x, y - 0.45, z + d / 2, this.fabric);
    });
  }
  cart(x: number, z: number, label: string): void {
    this.box(1.95, 0.65, 1.05, x, 0.84, z, this.stone); this.box(2.1, 0.08, 1.2, x, 1.23, z, this.metal);
    for (const side of [-1, 1]) { this.cylinder(0.29, 0.09, x + side * 0.98, 0.35, z, this.metal, 8, Math.PI / 2);
      this.box(0.055, 1.4, 0.055, x + side * 0.88, 1.9, z - 0.35, this.metal); }
    this.awning(2.45, 1.65, x, 2.68, z, 0xd2ab6a);
    this.cylinder(0.27, 0.3, x - 0.45, 1.4, z, this.stone, 8);
    this.shopSign(label, 1.75, 0.48, x, 1.1, z + 0.56);
  }
  plasticFurniture(x: number, z: number, color = 0x638ca2): void {
    this.colored(color, () => {
      this.box(1.35, 0.09, 1.1, x, 0.84, z, this.fabric);
      for (const dx of [-0.5, 0.5]) for (const dz of [-0.4, 0.4]) this.box(0.075, 0.77, 0.075, x + dx, 0.43, z + dz, this.fabric);
      for (const dx of [-1, 1]) { this.box(0.43, 0.08, 0.43, x + dx, 0.45, z, this.fabric);
        for (const sx of [-0.15, 0.15]) for (const sz of [-0.15, 0.15]) this.box(0.055, 0.35, 0.055, x + dx + sx, 0.23, z + sz, this.fabric); }
    });
  }
  pickup(x: number, z: number): void {
    this.box(1.85, 0.45, 4.8, x, 0.76, z, this.stone);
    this.box(1.75, 1.05, 1.8, x, 1.46, z + 0.98, this.stone);
    this.box(1.56, 0.65, 0.04, x, 1.7, z + 1.91, this.glass);
    for (const side of [-1, 1]) { this.box(0.06, 0.56, 2.3, x + side * 0.88, 1.25, z - 1, this.stone);
      for (const dz of [-1.55, 1.55]) this.cylinder(0.36, 0.18, x + side * 0.88, 0.46, z + dz, this.metal, 8, Math.PI / 2); }
    for (let i = 0; i < 3; i++) this.colored(0xca9f59, () => this.box(0.7, 0.45, 0.75, x - 0.45 + i * 0.45, 1.23, z - 1.5 + i * 0.6, this.fabric));
  }
}
