/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { LatheGeometry, Material, Matrix4, Vector2 } from 'three';
import { vertexFinish } from '../../materials/library.js';
import type { MaterialKey } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import type { GeometryPart } from '../../util/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { CommercialBuilder } from '../commercial/builder.js';
import { seededRng } from '../../rng.js';

/** Reuses the zone batching and padded Thai-sign atlas; equipment shares eight finishes at most. */
export class IndustrialBuilder extends CommercialBuilder {
  stone = vertexFinish('concrete_weathered');
  readonly metal = vertexFinish('metal_steel');
  readonly goods = vertexFinish('fabric_canvas');
  readonly brick = vertexFinish('brick_red');
  readonly roof: Material;
  readonly wall: Material;
  readonly random;
  readonly palette;
  constructor(options: ModelOptions, traditional?: 0 | 2, modern = false) {
    super(options); this.random = seededRng(options.seed); this.palette = this.kit.neutralPalette(options.seed);
    const style = traditional === undefined ? undefined : this.kit.industrial.traditional[traditional];
    this.roof = vertexFinish(style?.roof ?? (modern ? 'roof_metal_sheet' : 'roof_metal_rusty'));
    this.wall = vertexFinish(style?.wall ?? (modern ? 'plaster_tint' : 'wood_painted'));
  }
  /** Keeps kit silhouettes/finishes but merges colored variations into the same material batch. */
  kitParts(parts: GeometryPart[]): GeometryPart[] {
    for (const p of parts) {
      const key = p.material.userData.materialKey as MaterialKey;
      let target: Material;
      if (key === 'foliage_tropical') continue;
      if (key.startsWith('roof_') || key.startsWith('thatch_')) target = this.roof;
      else if (key === 'brick_red') target = this.wall.userData.materialKey === 'brick_red' ? this.wall : this.brick;
      else if (key.startsWith('concrete_')) target = this.stone;
      else if (key.startsWith('metal_')) target = this.metal;
      else if (key === 'fabric_canvas') target = this.goods;
      else target = this.wall;
      const color = (p.material as Material & { color?: { getHex(): number } }).color?.getHex() ?? 0xffffff;
      p.material = target; CommercialBuilder.color(p.geometry, color);
    }
    return parts;
  }
  industrialSite(laterite = false): void {
    this.colored(laterite ? 0xba8258 : 0xc0bbb0, () => this.site(laterite ? vertexFinish('dirt_laterite') : this.stone));
    this.entrance(this.stone, 6.2);
    this.feature('precast-fence', () => {
      for (const side of [-1, 1]) {
        this.box(0.17, 1.85, 27.5, side * 14.1, 1.06, -0.25, this.stone);
        this.box(10.6, 1.85, 0.17, side * 8.5, 1.06, 14.1, this.stone);
      }
      this.box(28.2, 1.85, 0.17, 0, 1.06, -14.1, this.stone);
      for (let i = 0; i < 9; i++) for (const side of [-1, 1]) this.box(0.32, 2.06, 0.32, side * 14.1, 1.13, -13.7 + i * 3.4, this.stone);
      for (let i = 0; i < 9; i++) this.box(0.32, 2.06, 0.32, -13.6 + i * 3.4, 1.13, -14.1, this.stone);
    });
  }
  industrialRoof(w: number, d: number, x: number, baseY: number, z: number, modern = false, form: 'gable' | 'hip' | 'monoPitch' = 'gable'): void {
    this.take(this.kitParts(this.kit.roofs[form]([w, d], { baseY, pitch: modern ? 9 : 17, overhang: 0.2,
      material: this.roof.userData.materialKey, surfaceColor: modern ? 0xa7b5b5 : 0x957257,
      ornaments: false, detail: 'low', seed: this.options.seed })), x, 0, z);
  }
  hall(w: number, h: number, d: number, x: number, z: number, modern = false): void {
    this.colored(this.palette.wall, () => this.mass(w, h, d, x, h / 2 + 0.18, z, this.wall));
    this.industrialRoof(w, d, x, h + 0.18, z, modern);
    this.box(w + 0.05, 0.65, 0.18, x, 0.55, z + d / 2, this.stone);
  }
  chimney(x: number, z: number, top: number, brick = true): void {
    this.feature('chimney', () => {
      const mat = brick ? this.brick : this.metal;
      this.box(3.4, 0.65, 3.4, x, 0.385, z, this.stone);
      // Thick open rim, with an inside wall and dark throat; never a capped pipe.
      const src = new LatheGeometry([new Vector2(1.12, 0.65), new Vector2(0.71, top - 0.3),
        new Vector2(0.79, top - 0.3), new Vector2(0.79, top), new Vector2(0.51, top),
        new Vector2(0.51, top - 1.6)], 12).translate(x, 0, z);
      this.add(applyWorldUV(src, 1), mat); src.dispose();
      this.colored(0x292925, () => this.cylinder(0.5, 0.08, x, top - 1.55, z, this.goods, 12));
      for (let y = 3; y < top - 1; y += 3.5) this.cylinder(0.99 - y / top * 0.26, 0.12, x, y, z, this.metal, 12);
      for (const dx of [-0.24, 0.24]) this.box(0.055, top - 1, 0.055, x + dx, top / 2, z + 0.86, this.metal);
      for (let y = 1; y < top - 0.4; y += 0.8) this.box(0.5, 0.045, 0.05, x, y, z + 0.86, this.metal);
    });
  }
  pipe(points: readonly [number, number, number][], radius = 0.16): void { this.tube(points.map(p => point(...p)), radius, this.metal, Math.max(4, points.length * 2), 6); }
  vessel(x: number, z: number, radius: number, height: number, y = 0.16, color = 0x969f99): void {
    this.colored(color, () => {
      this.cylinder(radius, height, x, y + height / 2, z, this.metal, 12);
      this.ellipsoid(point(x, y + height, z), point(radius, radius * 0.4, radius), this.metal, 12, 4);
      for (const side of [-1, 1]) this.box(0.23, 0.7, 0.23, x + side * radius * 0.7, y + 0.35, z, this.metal);
    });
  }
  sackPile(x: number, z: number, rows = 3, color = 0xcdb888): void {
    this.colored(color, () => {
      this.box(3, 0.15, 2.7, x, 0.2, z, this.wall);
      for (let row = 0; row < rows; row++) for (let n = 0; n < 6 - row; n++)
        this.ellipsoid(point(x - 1 + n % 3 * 0.82 + row * 0.09, 0.46 + row * 0.38, z - 0.65 + Math.floor(n / 3) * 0.9), point(0.42, 0.24, 0.58), this.goods, 6, 4);
    });
  }
  truck(x: number, z: number, style: 'pickup' | 'etan' | 'cane' | 'semi', color = 0x7a9682, yaw = 0): void {
    const first = this.parts.length, long = style === 'semi' ? 9.6 : style === 'cane' ? 6.6 : style === 'etan' ? 4.6 : 4.8;
    const w = style === 'semi' ? 2.5 : style === 'etan' ? 1.75 : 2.05;
    this.colored(color, () => {
      this.box(w, 0.45, long, 0, 0.9, 0, this.metal);
      if (style === 'etan') {
        this.box(0.88, 0.55, 1.1, 0, 1.35, long / 2 - 0.6, this.metal);
        this.box(1.6, 0.15, 3.1, 0, 1.24, -0.5, this.wall);
        this.box(0.7, 0.16, 0.5, 0, 1.4, 0.6, this.goods);
      } else {
        this.box(w * 0.95, 1.28, 1.9, 0, 1.71, long / 2 - 1, this.metal);
        this.box(w * 0.83, 0.67, 0.04, 0, 1.98, long / 2 - 0.025, this.glass);
      }
      if (style === 'semi') this.box(2.45, 2.45, 6.8, 0, 2.25, -1.3, this.wall);
      else for (const side of [-1, 1]) this.box(0.07, style === 'cane' ? 1.4 : 0.65, long - 2.1, side * (w / 2 - 0.04), style === 'cane' ? 1.84 : 1.46, -1, this.metal);
    });
    for (const side of [-1, 1]) for (const dz of [long / 2 - 1.1, -long / 2 + 1.1, ...(style === 'semi' ? [-long / 2 + 2] : [])])
      this.colored(0x262b2a, () => this.cylinder(0.45, 0.2, side * w / 2, 0.6, dz, this.goods, 8, Math.PI / 2));
    if (style === 'cane') this.canePile(0, -1.5, 2.4, 2, 3.5);
    const transform = new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeRotationY(yaw));
    this.parts.slice(first).forEach(p => p.geometry.applyMatrix4(transform));
  }
  canePile(x: number, z: number, y = 0.45, w = 5, d = 3): void {
    this.colored(0x9d9865, () => { for (let n = 0; n < 18; n++) {
      const dx = (n % 6 - 2.5) / 6 * w, dy = Math.floor(n / 6) * 0.17;
      this.pole(point(x + dx, y + dy, z - d / 2), point(x + dx + 0.12, y + dy + 0.12, z + d / 2), 0.105, this.goods, 5);
    } });
  }
  regionalProp(kind: string, x: number, z: number, scale = 1): void {
    const prop = this.kit.props[kind];
    if (!prop) throw new Error(`Missing industrial prop ${kind} in ${this.kit.id}`);
    this.take(this.kitParts(prop({ seed: this.options.seed, detail: 'low' })), x, 0.15, z, 0, scale);
  }
  factorySign(text: string, x = 0, y = 2.7, z = 14): void {
    this.feature('gate-sign-supports', () => { for (const dx of [-2.7, 2.7]) this.box(0.1, y + 0.6, 0.1, x + dx, (y + 0.6) / 2 + 0.12, z, this.metal); });
    this.shopSign(text, 5.8, 1.05, x, y, z + 0.09, { background: 0xe6e1ca, foreground: 0x254842 });
  }
}
