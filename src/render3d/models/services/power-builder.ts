/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { LatheGeometry, Object3D, Vector2 } from 'three';
import { vertexFinish } from '../../materials/library.js';
import { applyWorldUV } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import { ServiceBuilder } from './builder.js';

/** National industrial shapes; only paint hues follow the region kit. */
export class PowerPlantBuilder extends ServiceBuilder {
  readonly roof = vertexFinish('roof_metal_sheet');
  readonly palette = this.kit.neutralPalette(this.options.seed);
  readonly anchors: Object3D[] = [];

  anchor(name: string, x: number, y: number, z: number): void {
    const anchor = new Object3D(); anchor.name = name; anchor.position.set(x, y, z); this.anchors.push(anchor);
  }
  shell(profile: readonly [number, number][], x: number, z: number, sides = 32): void {
    const source = new LatheGeometry(profile.map(p => new Vector2(...p)), sides).translate(x, 0, z);
    this.add(applyWorldUV(source, 1), this.stone); source.dispose();
  }
  plantSite(): void {
    this.colored(0xb6b8af, () => this.box(39, 0.08, 39, 0, 0.04, 0, this.stone));
  }
  hall(w: number, d: number, h: number, x: number, z: number): void {
    this.colored(this.palette.wall, () => this.mass(w, h, d, x, h / 2 + 0.1, z, this.paint));
    this.colored(0x879b9a, () => this.box(w + 0.16, 0.18, d + 0.16, x, h + 0.19, z, this.roof));
    for (const dx of [-w / 2 + 0.25, w / 2 - 0.25])
      this.box(0.25, h, 0.2, x + dx, h / 2 + 0.1, z + d / 2 + 0.05, this.metal);
    for (let i = 0; i < 5; i++) this.box(w * 0.12, 0.85, 0.07, x + (i - 2) * w / 6, h - 1.4, z + d / 2 + 0.07, this.glass);
  }
  fence(half: number, height = 2.6): void {
    // Explicit sparse wire lattice reads as a security mesh without alpha sorting.
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 12; i++) {
        const a = -half + i * half / 6;
        this.box(0.09, height + 0.18, 0.09, side * half, height / 2 + 0.19, a, this.metal);
        if (side < 0 || Math.abs(a) > 3.3) this.box(0.09, height + 0.18, 0.09, a, height / 2 + 0.19, side * half, this.metal);
      }
      for (const y of [0.65, 1.3, 1.95, height + 0.12]) {
        this.box(0.045, 0.045, 2 * half, side * half, y, 0, this.metal);
        if (side < 0) this.box(2 * half, 0.045, 0.045, 0, y, -half, this.metal);
        else for (const x of [-1, 1]) this.box(half - 3.4, 0.045, 0.045, x * (half + 3.4) / 2, y, half, this.metal);
      }
    }
  }
  switchyard(x: number, z: number): void {
    this.feature('high-voltage-switchyard', () => {
      this.colored(0xa4a79f, () => this.box(7, 0.2, 9, x, 0.18, z, this.stone));
      for (const dz of [-2.4, 2.4]) {
        this.colored(0x75837b, () => this.mass(3.7, 2.2, 1.7, x, 1.42, z + dz, this.metal));
        for (let i = 0; i < 7; i++) this.box(0.06, 1.7, 1.88, x - 1.5 + i * 0.5, 1.5, z + dz, this.metal);
        for (const dx of [-1.1, 0, 1.1]) {
          this.colored(0xd4c7a9, () => {
            this.cylinder(0.17, 1.8, x + dx, 3.35, z + dz, this.stone, 8);
            for (let n = 0; n < 5; n++) this.cylinder(0.26, 0.1, x + dx, 2.7 + n * 0.29, z + dz, this.stone, 8);
          });
          this.pole(point(x + dx, 4.3, z - 2.4), point(x + dx, 4.3, z + 2.4), 0.035, this.metal, 4);
        }
      }
      for (const dx of [-3, 3]) this.box(0.16, 6.2, 0.16, x + dx, 3.2, z, this.metal);
      this.box(6.4, 0.18, 0.18, x, 6.3, z, this.metal);
    });
  }
  transmissionTower(x: number, z: number): void {
    this.feature('transmission-tower', () => {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        this.pole(point(x + dx * 1.3, 0.1, z + dz * 1.3), point(x + dx * 0.38, 21, z + dz * 0.38), 0.075, this.metal, 4);
        for (let n = 0; n < 5; n++) {
          const y = 0.4 + n * 3.9, a = 1.3 - n * 0.17, c = a - 0.17;
          this.pole(point(x + dx * a, y, z - a), point(x + dx * c, y + 3.9, z + c), 0.035, this.metal, 4);
          this.pole(point(x - a, y, z + dz * a), point(x + c, y + 3.9, z + dz * c), 0.035, this.metal, 4);
        }
      }
      for (const y of [14.5, 18.5]) {
        this.box(5.3, 0.18, 0.32, x, y, z, this.metal);
        for (const dx of [-2.25, 2.25]) this.colored(0xc7c0a8, () => this.cylinder(0.17, 1.1, x + dx, y - 0.55, z, this.stone, 8));
      }
    });
  }
  /** The plant's root on the 4 × 4 round its centre tile; `tiles` are those it is drawn for, none for a kind picked
   * from gameMap.powerKinds on another plant's tiles (RENDERER_SPEC 6D) */
  finishPlant(id: string, center: number, metadata: Record<string, unknown> = {},
    tiles: readonly number[] = Array.from({ length: 16 }, (_, i) => center - 5 + i)) {
    this.flushSigns();
    const root = this.finish(id, 'services', [4, 4], [...tiles], this.options);
    root.add(...this.anchors);
    Object.assign(root.userData, { centerTile: center, components: this.components, structuralBodies: this.structuralBodies,
      palette: this.palette, entranceFacing: '+Z', ...metadata });
    return root;
  }
}
