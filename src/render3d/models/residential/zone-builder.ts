/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BoxGeometry, CylinderGeometry, Material, Matrix4, PlaneGeometry, Vector3 } from 'three';
import { getMaterial, roadConcrete, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { KitBuilder, point } from '../../regional/geometry.js';
import { getRegionKit } from '../../regional/index.js';
import { applyWorldUV, beveledBox, GeometryPart } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import type { RegionTier } from '../../regional/types.js';

export interface ZoneComponent { role: string; min: number[]; max: number[]; triangles: number }
export class ZoneBuilder extends KitBuilder {
  readonly components: ZoneComponent[] = [];
  readonly structuralBodies: { min: number[]; max: number[] }[] = [];
  readonly kit;
  stone = roadConcrete();
  readonly metal = tint('metal_steel', 0x343a3b);
  readonly glass = getMaterial('glass_tinted');
  readonly wood = tint('wood_painted', 0x725a42);
  constructor(readonly options: ModelOptions) { super(); this.kit = getRegionKit(options.region); }

  feature(role: string, make: () => void): void {
    const first = this.parts.length; make(); const bounds = new Box3(); let triangles = 0;
    this.parts.slice(first).forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!);
      triangles += (p.geometry.index?.count ?? p.geometry.getAttribute('position').count) / 3; });
    if (this.parts.length > first) this.components.push({ role, min: bounds.min.toArray(), max: bounds.max.toArray(), triangles });
  }

  place(parts: readonly GeometryPart[], x: number, y: number, z: number, yaw = 0, scale = 1): void {
    const matrix = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(yaw)).multiply(new Matrix4().makeScale(scale, scale, scale));
    parts.forEach(p => {
      const geometry = p.geometry.clone().applyMatrix4(matrix);
      if (geometry.userData.structuralBody) { geometry.computeBoundingBox(); this.structuralBodies.push({ min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray() }); }
      this.add(['foliage_tropical', 'sign_thai'].includes(p.material.userData.materialKey) ? geometry : applyWorldUV(geometry, 1), p.material);
    });
  }

  take(parts: readonly GeometryPart[], x = 0, y = 0, z = 0, yaw = 0, scale = 1): void {
    this.place(parts, x, y, z, yaw, scale); parts.forEach(p => p.geometry.dispose());
  }

  mass(w: number, h: number, d: number, x: number, y: number, z: number, material: Material): void {
    const geometry = beveledBox(w, h, d, 0.06).translate(x, y, z); geometry.computeBoundingBox();
    this.structuralBodies.push({ min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray() }); this.add(geometry, material);
  }

  pane(w: number, h: number, x: number, y: number, z: number, material: Material, yaw = 0): void {
    const src = new PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z);
    this.add(applyWorldUV(src, 1), material); src.dispose();
  }

  sign(text: string, w: number, h: number, x: number, y: number, z: number, background = 0xe4ddc3, foreground = 0x173f35): void {
    this.atlas(thaiSign(text, background, foreground, [w, h]), w, h, x, y, z);
  }

  atlas(material: Material, w: number, h: number, x: number, y: number, z: number,
    range: readonly [number, number, number, number] = [0, 0, 1, 1], yaw = 0): void {
    const geometry = new BoxGeometry(w, h, 0.05), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, range[0] + uv.getX(i) * (range[2] - range[0]), range[1] + uv.getY(i) * (range[3] - range[1]));
    geometry.rotateY(yaw).translate(x, y, z); this.add(geometry, material);
  }

  cylinder(radius: number, height: number, x: number, y: number, z: number, material: Material, sides = 8, roll = 0): void {
    const src = new CylinderGeometry(radius, radius, height, sides).rotateZ(roll).translate(x, y, z);
    this.add(applyWorldUV(src, 1), material); src.dispose();
  }

  site(ground: Material = getMaterial('grass'), boundary: Material = this.stone): void {
    this.feature('site', () => {
      this.box(29, 0.06, 29, 0, 0.03, 0, ground);
      for (const x of [-14.25, 14.25]) this.box(0.13, 0.24, 28.5, x, 0.16, 0, boundary);
      this.box(28.5, 0.24, 0.13, 0, 0.16, -14.25, boundary);
      for (const side of [-1, 1]) this.box(11.5, 0.24, 0.13, side * 8.5, 0.16, 14.25, boundary);
    });
  }

  entrance(surface: Material = this.stone, width = 4.6): void {
    this.feature('entrance', () => this.box(width, 0.05, 4.5, 0, 0.09, 12.2, surface));
  }

  tree(kind: string, x: number, z: number, height = 4.5, radius = 1.1, y = 0.06, bark: Material = this.wood, seedOffset = 0): void {
    this.take(this.kit.gardenPlant(kind, { seed: (this.options.seed ?? 1) + seedOffset, height, radius, bark }), x, y, z);
  }

  gardens(count = 3, height = 4.5, bark: Material = this.wood): void {
    this.feature('trees', () => {
      const mix = this.kit.vegetation.filter(p => !p.nearWaterOnly);
      const positions = [[-12.2, -11.7], [12.2, -11.7], [-12.1, 11.5], [12.1, 11.5]];
      for (let i = 0; i < count; i++) this.tree(mix[i % mix.length].id.slice(4), positions[i][0], positions[i][1], height, 1.05, 0.06, bark, i);
    });
  }

  car(x: number, z: number, body: Material, yaw = 0, y = 0.12): void {
    const prototype = new KitBuilder();
    prototype.box(1.6, 0.6, 3.45, 0, 0.64, 0, body);
    prototype.box(1.38, 0.62, 1.8, 0, 1.2, -0.15, this.glass);
    for (const side of [-1, 1]) for (const dz of [-1.12, 1.12]) {
      const src = new CylinderGeometry(0.29, 0.29, 0.17, 6).rotateZ(Math.PI / 2).translate(side * 0.76, 0.34, dz);
      prototype.add(applyWorldUV(src, 1), this.metal); src.dispose();
    }
    prototype.box(1.45, 0.14, 0.1, 0, 0.66, 1.76, this.metal);
    this.take(prototype.parts, x, y, z, yaw);
  }

  motorcycle(x: number, z: number, body: Material, yaw = 0): void {
    const prototype = new KitBuilder();
    for (const dz of [-0.64, 0.64]) {
      const src = new CylinderGeometry(0.25, 0.25, 0.1, 6).rotateZ(Math.PI / 2).translate(0, 0.3, dz);
      prototype.add(applyWorldUV(src, 1), this.metal); src.dispose();
    }
    prototype.box(0.22, 0.13, 1.25, 0, 0.54, 0, this.metal);
    prototype.box(0.34, 0.26, 0.43, 0, 0.76, 0.28, body);
    prototype.box(0.32, 0.11, 0.6, 0, 0.8, -0.25, this.metal);
    prototype.pole(point(0, 0.34, 0.64), point(0, 1.05, 0.5), 0.035, this.metal, 4);
    prototype.box(0.66, 0.06, 0.06, 0, 1.04, 0.5, this.metal);
    this.take(prototype.parts, x, 0.12, z, yaw);
  }

  parking(count: number, body: Material, bikes = false, z = 11.7): void {
    this.feature('parking', () => {
      this.box(17.5, 0.035, 4.25, 0, 0.085, z, this.stone);
      for (let i = 0; i < count; i++) {
        const x = -6.3 + i * (bikes ? 1.4 : 3.6);
        this.box(0.07, 0.02, 3.3, x - (bikes ? 0.5 : 1.1), 0.12, z, body);
        if (bikes) this.motorcycle(x, z, body); else this.car(x, z, body);
      }
    });
  }

  /** Reusable window / balcony / AC module; clone the prototype before one final material merge. */
  facade(width: number, depth: number, floors: number, columns: number, x: number, z: number, wall: Material,
    options: { floorY?: number; spacing?: number; balcony?: boolean; glassRail?: boolean; ac?: boolean; laundry?: boolean; both?: boolean } = {}): void {
    const step = options.spacing ?? 3, bottom = options.floorY ?? 0.14, pitch = (width - 1.4) / columns;
    const prototype = new KitBuilder(), pane = new PlaneGeometry(Math.min(1.65, pitch * 0.62), 1.6).translate(0, 1.55, 0.055);
    prototype.add(applyWorldUV(pane, 1), this.glass); pane.dispose();
    if (options.balcony) {
      prototype.box(Math.min(2.25, pitch - 0.14), 0.12, 1.03, 0, 0.15, 0.47, wall);
      prototype.box(Math.min(2.25, pitch - 0.14), options.glassRail ? 0.85 : 0.26, 0.06, 0,
        options.glassRail ? 0.64 : 0.33, 0.98, options.glassRail ? this.glass : wall);
      for (const side of [-1, 1]) prototype.box(0.06, 0.95, 1.03, side * Math.min(1.11, pitch / 2 - 0.12), 0.64, 0.47, this.metal);
      prototype.box(Math.min(2.25, pitch - 0.14), 0.07, 0.09, 0, 1.11, 0.98, this.metal);
    }
    if (options.ac) { prototype.box(0.63, 0.45, 0.32, pitch * 0.31, 1.82, 0.25, wall);
      prototype.box(0.5, 0.25, 0.035, pitch * 0.31, 1.82, 0.43, this.metal); }
    for (const side of options.both === false ? [1] : [-1, 1]) for (let floor = 0; floor < floors; floor++) for (let col = 0; col < columns; col++) {
      const cx = x + (col - (columns - 1) / 2) * pitch, y = bottom + floor * step, cz = z + side * (depth / 2 + 0.025);
      this.place(prototype.parts, cx, y, cz, side < 0 ? Math.PI : 0);
      if (options.laundry && (floor + col) % 4 === 0) this.box(0.7, 0.68, 0.03, cx, y + 1.05, cz + side * 1.03, tint('fabric_canvas', 0xb6c6b8));
    }
    prototype.parts.forEach(p => p.geometry.dispose());
  }

  pool(x: number, z: number, w: number, d: number, y = 0.12, border: Material = this.stone): void {
    this.box(w, 0.07, d, x, y, z, tint('water_river', 0x65bac4));
    for (const side of [-1, 1]) {
      this.box(w + 0.35, 0.16, 0.18, x, y + 0.04, z + side * (d / 2 + 0.09), border);
      this.box(0.18, 0.16, d, x + side * (w / 2 + 0.09), y + 0.04, z, border);
    }
  }

  finishZone(id: string, category: 'residential' | 'services' | 'commercial' | 'industrial', center: number, tier: RegionTier, metadata: Record<string, unknown> = {}) {
    const root = this.finish(id, category, [3, 3], Array.from({ length: 9 }, (_, i) => center - 4 + i), this.options);
    Object.assign(root.userData, { ...metadata, regionTier: tier, kit: this.kit.id, centerTile: center, components: this.components,
      structuralBodies: this.structuralBodies, entranceFacing: '+Z' });
    return root;
  }
}

export function boundsOfParts(parts: readonly GeometryPart[]): Box3 {
  const bounds = new Box3(); parts.forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); }); return bounds;
}

export const v = (x: number, y: number, z: number): Vector3 => point(x, y, z);
