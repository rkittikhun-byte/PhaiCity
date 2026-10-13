/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Shared parts of the rubbish and wastewater buildings (ขยะและน้ำเสีย, docs/WASTE.md, RENDERER_SPEC 6I) on the 3×3 of tiles
// 992–1000: weighbridges and gates, refuse trucks, skips, steel sheds and clad halls, chimney stacks, silos, bales,
// conveyors, heaps, transformers and a chain-link fence, on top of the water supply's tanks, pipes, ladders and rails
// (models/water/builder.ts, the same family of plant). Tier R3: the same everywhere; only the plaster tint and the
// trees follow the region kit. Every part shares eight batches at most: concrete, plaster (painted steel too, by vertex
// colour), sheet roofing, water, lawn, leaves, bark and one sign atlas. Generic Thai signs only: no real company's name,
// livery or emblem on a building or a truck.

import { Object3D, Vector3 } from 'three';
import { point } from '../../regional/geometry.js';
import { STONE, shade, spread } from '../civic/builder.js';
import { CONCRETE, GLASS, LADDER, WaterBuilder } from '../water/builder.js';
import type { ModelOptions } from '../registry.js';

export const ASPHALT = 0x575c5d;
export const SOIL = 0x7a6850;
export const WASTE_GREEN = 0x2f7d4f;
export const DARK = 0x2b2f30;
/** Refuse-truck bodies (green, amber, white, blue, orange); the seed turns the list, never the truck */
export const TRUCK_COLORS = [0x3f8f5a, 0xd9a82c, 0xe8e6df, 0x2f6fa8, 0xc9622b] as const;
/** Bin lids by what goes in: general (blue-grey), wet (green), recycling (yellow), hazardous (orange) */
export const BIN_COLORS = [0x4a6b86, 0x2f7d4f, 0xd9a82c, 0xc9622b] as const;

export class WasteBuilder extends WaterBuilder {
  /** Where smoke, steam and flames rise, in model coordinates (anchor_smoke_<n>, anchor_steam_<n>, anchor_fire_<n>) */
  readonly smoke: Vector3[] = [];
  readonly steam: Vector3[] = [];
  readonly fire: Vector3[] = [];

  constructor(options: ModelOptions) { super(options); }

  truckColor(i: number): number { return TRUCK_COLORS[(i + this.seed) % TRUCK_COLORS.length]; }

  // --- Ground ------------------------------------------------------------------------------------------------------

  /** The lawn under the plant. */
  site(): void { this.feature('site', () => this.box(29, 0.06, 29, 0, 0.03, 0, this.grass)); }

  /** A road of the given width along Z from z0 to z1 at x: dark paving and a dashed centre line. */
  road(x: number, z0: number, z1: number, w = 3.4): void {
    this.bx(this.stone, ASPHALT, w, 0.05, z1 - z0, x, 0.1, (z0 + z1) / 2);
    for (let z = z0 + 1; z < z1 - 1; z += 3) this.flat(0.14, 1.4, x, z, 0.13, this.paint, 0xe9e5d6);
  }

  /** A concrete working yard w × d. */
  yard(w: number, d: number, x: number, z: number, color = 0x9a978f): void {
    this.bx(this.stone, color, w, 0.05, d, x, 0.085, z);
  }

  /** A chain-link fence (รั้วตาข่าย) on concrete posts round the plant, open at the gate (the gate's pillars stand at
   * gateX ± (opening / 2 + 0.4)). */
  fence(gateX: number, opening: number, e = 14.1): void {
    const run = (length: number, x: number, z: number, yaw: number): void => {
      if (length < 0.4) return;
      this.at(x, z, yaw, () => {
        this.bx(this.stone, CONCRETE, length, 0.3, 0.16, 0, 0.15, 0);
        this.colored(0x8d9593, () => { for (const y of [0.9, 1.5, 2.05]) this.box(length, 0.03, 0.03, 0, y, 0, this.paint); });
        this.colored(CONCRETE, () => { for (const px of spread(length, 3, 0.1)) this.box(0.14, 2.2, 0.14, px, 1.1, 0, this.stone); });
      });
    };
    const g0 = gateX - opening / 2 - 0.65, g1 = gateX + opening / 2 + 0.65;
    run(g0 + e, (g0 - e) / 2, e, 0); run(e - g1, (g1 + e) / 2, e, 0); run(2 * e, 0, -e, 0);
    for (const s of [-1, 1]) run(2 * e - 0.2, s * e, 0, Math.PI / 2);
  }

  /** The plant's gate on the front fence: two plastered pillars with lamps, the sign on a beam between them, steel leaves
   * slid open along the fence. */
  gate(x: number, opening: number, sign: string, color = WASTE_GREEN): void {
    const z = 13.75, half = opening / 2 + 0.4, h = 2.6;
    for (const s of [-1, 1]) {
      this.bx(this.paint, this.wall, 0.6, h, 0.6, x + s * half, h / 2, z);
      this.bx(this.paint, color, 0.7, 0.14, 0.7, x + s * half, h + 0.07, z);
      this.lantern(x + s * half, z, 0.2, h + 0.14);
      this.at(x + s * (half + 0.4 + opening / 4), z - 0.35, 0, () => this.colored(0x6f7774, () => {
        for (const y of [0.15, 1.65]) this.box(opening / 2, 0.07, 0.06, 0, y, 0, this.paint);
        for (const px of spread(opening / 2, 0.4, 0.03)) this.box(0.04, 1.5, 0.04, px, 0.9, 0, this.paint);
      }));
    }
    this.bx(this.paint, color, opening + 1.6, 0.5, 0.36, x, h - 0.1, z);
    this.label(sign, opening + 1.2, 0.4, x, h - 0.1, z + 0.2, 0, color, 0xffffff);
  }

  // --- Vehicles and containers ---------------------------------------------------------------------------------------

  /** A refuse truck (รถเก็บขยะ) facing local +Z: a cab, a tall compactor body with its tail hopper and lip, six wheels. A plain
   * body colour and no markings. */
  truck(x: number, z: number, yaw = 0, color = this.truckColor(0)): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, 0x3a3f40, 2.2, 0.45, 7.4, 0, 0.95, 0);
      this.bx(this.paint, color, 2.35, 1.85, 1.9, 0, 1.95, 2.7);
      this.quad(2, 0.75, 0, 2.3, 3.66, GLASS);
      this.bx(this.paint, 0x8a8f94, 2.4, 0.2, 0.2, 0, 0.75, 3.7);
      this.bx(this.paint, color, 2.5, 2.3, 4.8, 0, 2.3, -1.1);
      this.bx(this.paint, shade(color, -0.18), 2.5, 1.1, 1.2, 0, 1.6, -3.85);
      this.bx(this.paint, 0x4a4f50, 2.6, 0.22, 1.5, 0, 3.0, -3.5);
      this.colored(DARK, () => { for (const s of [-1, 1]) for (const dz of [2.7, -1.9, -3.1]) this.box(0.34, 1.0, 1.0, s * 1.12, 0.5, dz, this.paint); });
    });
  }

  /** An open skip (ถังขยะขนาดใหญ่), 3 m long: four plates and a floor, the rubbish heaped in it, facing local +Z. */
  skip(x: number, z: number, yaw = 0, color: number = BIN_COLORS[this.seed % BIN_COLORS.length]): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, color, 2.1, 0.12, 3, 0, 0.35, 0);
      this.bx(this.paint, color, 2.1, 1.1, 0.1, 0, 0.9, 1.45);
      this.bx(this.paint, color, 2.1, 1.1, 0.1, 0, 0.9, -1.45);
      for (const s of [-1, 1]) this.bx(this.paint, shade(color, -0.1), 0.1, 1.1, 3, s * 1.0, 0.9, 0);
      this.bx(this.paint, 0x6b6253, 1.8, 0.5, 2.6, 0, 1.2, 0);
      this.colored(DARK, () => { for (const s of [-1, 1]) this.box(0.2, 0.2, 2.8, s * 0.9, 0.2, 0, this.paint); });
    });
  }

  /** A wheelie bin (ถังขยะล้อเลื่อน) with its lid. */
  bin(x: number, z: number, color: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, shade(color, -0.25), 0.62, 0.95, 0.72, 0, 0.5, 0);
      this.bx(this.paint, color, 0.68, 0.1, 0.78, 0, 1.0, 0);
    });
  }

  /** A weighbridge (ตาชั่งรถบรรทุก) along local Z with its booth, a boom barrier and a sign: a steel deck on a concrete bed. */
  weighbridge(sign = 'ชั่งน้ำหนัก', length = 7): void {
    this.bx(this.stone, 0x6b7274, 3.6, 0.28, length, 0, 0.14, 0);
    this.colored(0x4f5658, () => { for (const s of [-1, 1]) this.box(0.12, 0.1, length, s * 1.7, 0.3, 0, this.paint); });
    this.bx(this.paint, this.wall, 2.2, 2.6, 2.2, 3.5, 1.3, 0.4);
    this.bx(this.paint, WASTE_GREEN, 2.6, 0.18, 2.6, 3.5, 2.7, 0.4);
    this.at(3.5 - 1.1, 0.4, -Math.PI / 2, () => this.quad(1.6, 0.9, 0, 1.7, 0.02, GLASS));
    this.quad(0.8, 1.9, 3.5, 0.95, 1.52, 0x5b3c29);
    this.label(sign, 1.8, 0.4, 3.5, 2.35, 1.52, 0, WASTE_GREEN, 0xffffff);
    const boom = length / 2 + 0.8;
    this.bx(this.paint, 0x6f7774, 0.3, 1.2, 0.3, 2.1, 0.6, boom);
    this.bx(this.paint, 0xf3f1ea, 3.4, 0.12, 0.12, 0.4, 1.1, boom);
    this.colored(0xd8582a, () => { for (const x of [-0.5, 0.7, 1.7]) this.box(0.4, 0.13, 0.13, x, 1.1, boom, this.paint); });
  }

  /** A roll-off container (ตู้คอนเทนเนอร์เปิดฝา), a plain steel box on its frame, the load heaped in it. */
  rolloff(x: number, z: number, yaw: number, color: number, load = 0x6b6253): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, color, 2.4, 1.5, 5.2, 0, 1.15, 0);
      this.bx(this.paint, shade(color, -0.2), 2.5, 0.12, 5.3, 0, 1.92, 0);
      this.bx(this.paint, load, 2.0, 0.4, 4.7, 0, 1.95, 0);
      this.colored(DARK, () => { for (const s of [-1, 1]) this.box(0.18, 0.3, 5.4, s * 1.0, 0.3, 0, this.paint); });
    });
  }

  // --- Tall things -------------------------------------------------------------------------------------------------

  /** A concrete chimney stack (ปล่องควัน) of height h from radius r0 to r1, bands in a darker grey, a caged ladder up the
   * back and an orange warning band at the top; its smoke rises from the top (anchor_smoke_<n>), in model coordinates. */
  stack(x: number, z: number, h: number, r0: number, r1: number, smoke = true): void {
    this.shell([[r0, 0.2], [r1, h], [r1 + 0.12, h], [r1 + 0.12, h + 0.35], [r1 - 0.3, h + 0.35], [r1 - 0.3, h - 0.4]], x, 0, z, 16, 0xc7c4bb);
    const radius = (y: number): number => r0 + (r1 - r0) * y / h;
    this.colored(0x9a978f, () => { for (const f of [0.18, 0.4, 0.62]) this.cylinder(radius(f * h) + 0.04, 0.5, x, f * h, z, this.stone, 14); });
    this.colored(0xc8452c, () => { for (const f of [0.84, 0.94]) this.cylinder(radius(f * h) + 0.05, h * 0.07, x, f * h, z, this.stone, 14); });
    this.longLadder(x, z - (r0 + r1) / 2 - 0.1, 0.3, h - 0.3);
    if (smoke) this.smoke.push(point(x, h + 0.4, z));
  }

  /** A tall ladder (บันไดขึ้นปล่อง), rungs every metre, on the −Z side of the wall at (x, z) with its rails 0.18 m out (yaw π). */
  longLadder(x: number, z: number, y0: number, y1: number): void {
    this.at(x, z, Math.PI, () => this.colored(LADDER, () => {
      for (const s of [-1, 1]) this.box(0.05, y1 - y0, 0.05, s * 0.22, (y0 + y1) / 2, 0.18, this.paint);
      for (let y = y0 + 0.5; y < y1; y += 1) this.box(0.44, 0.03, 0.03, 0, y, 0.18, this.paint);
    }));
  }

  /** A storage silo (ไซโล) of radius r and height h with a conical roof, a ladder and a filling pipe. */
  silo(x: number, z: number, r: number, h: number, color = 0xd9d6cc): void {
    this.shell([[r, 0.25], [r, h], [0.4, h + r * 0.55], [0.001, h + r * 0.58]], x, 0, z, 18, color);
    this.colored(shade(color, -0.12), () => { this.cylinder(r + 0.04, 0.18, x, 0.3, z, this.stone, 18); this.cylinder(r + 0.04, 0.14, x, h - 0.1, z, this.stone, 18); });
    this.ladder(x, z - r - 0.05, 0.3, h + 0.2, Math.PI, h > 5);
    this.pipe([point(x + r * 0.6, h + r * 0.22, z), point(x + r * 0.6, h + r * 0.6, z), point(x + r * 0.2, h + r * 0.6, z)], 0.1);
  }

  // --- Material ----------------------------------------------------------------------------------------------------

  /** A heap (กองขยะ), an ellipsoid sitting on the ground at y with its lower half cut flat: angular, in one colour. */
  heap(x: number, y: number, z: number, rx: number, ry: number, rz: number, color: number): void {
    this.colored(color, () => {
      this.ellipsoid(point(x, y, z), point(rx, ry, rz), this.paint, 9, 5);
      const geometry = this.parts[this.parts.length - 1].geometry, p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setY(i, Math.max(y + 0.01, p.getY(i)));
      geometry.computeVertexNormals();
    });
  }

  /** A stack of baled material (ก้อนวัสดุอัด): cols × rows bales a level, levels high, each 1.1 × 0.9 × 1.1 in the colours given
   * in turn, a darker strap round every second. Along local X, standing on the ground at y. */
  baleStack(cols: number, rows: number, levels: number, colors: readonly number[], y = 0): void {
    let n = 0;
    for (let l = 0; l < levels; l++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const color = colors[n++ % colors.length], x = (c - (cols - 1) / 2) * 1.14, z = (r - (rows - 1) / 2) * 1.14;
      this.bx(this.paint, color, 1.1, 0.9, 1.1, x, y + 0.45 + l * 0.92, z);
      if (n % 2) this.bx(this.paint, shade(color, -0.2), 1.12, 0.92, 0.07, x, y + 0.45 + l * 0.92, z);
    }
  }

  /** An inclined belt conveyor (สายพานลำเลียง) between two points: a rubber belt on side rails, legs every 3 m, a drive at
   * the top. The belt is w wide. */
  conveyor(from: Vector3, to: Vector3, w = 0.9): void {
    const along = to.clone().sub(from), length = along.length(), yaw = Math.atan2(along.x, along.z);
    const side = point(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(w / 2 + 0.06);
    this.colored(0x2b2f30, () => this.slab([from.clone().sub(side), from.clone().add(side), to.clone().add(side), to.clone().sub(side)]
      .map(v => v.clone().setY(v.y + 0.02)), 0.08, this.paint));
    this.colored(0x6f7774, () => {
      for (const s of [-1, 1]) this.pole(from.clone().addScaledVector(side, s * 1.04).setY(from.y + 0.08), to.clone().addScaledVector(side, s * 1.04).setY(to.y + 0.08), 0.05, this.paint, 4);
      const n = Math.max(2, Math.ceil(length / 3));
      for (let i = 0; i <= n; i++) {
        const p = from.clone().lerp(to, i / n);
        for (const s of [-1, 1]) this.pole(point(p.x + side.x * s * 1.04, 0.1, p.z + side.z * s * 1.04), point(p.x + side.x * s * 1.04, p.y, p.z + side.z * s * 1.04), 0.04, this.paint, 4);
      }
      this.box(w + 0.5, 0.5, 0.6, to.x, to.y + 0.3, to.z, this.paint);
    });
  }

  // --- Buildings ---------------------------------------------------------------------------------------------------

  /** A steel shed (โรงเรือนโครงเหล็ก) w × d, front +Z, eaves at h: a slab, portal columns every 4 m, a low sheet gable, the back
   * and left walls clad to the eaves, the right side and the front left open (or clad to a block wall when asked). */
  shed(w: number, d: number, h: number, clad: { back?: boolean; left?: boolean; right?: boolean; front?: boolean } = {}, color = 0xc9cdc9): void {
    this.bx(this.stone, 0xa9a69e, w, 0.15, d, 0, 0.075, 0);
    this.colored(0x6f7774, () => {
      for (const x of spread(w, 4, 0.2)) for (const s of [-1, 1]) this.box(0.24, h, 0.24, x, 0.15 + h / 2, s * (d / 2 - 0.2), this.paint);
      for (const s of [-1, 1]) this.box(w, 0.28, 0.2, 0, 0.15 + h, s * (d / 2 - 0.2), this.paint);
    });
    const wall = (length: number, x: number, z: number, yaw: number, full: boolean): void => this.at(x, z, yaw, () => {
      this.bx(this.stone, CONCRETE, length, 1.2, 0.2, 0, 0.75, 0);
      if (full) this.bx(this.paint, color, length, h - 1.4, 0.1, 0, 0.15 + 1.35 + (h - 1.4) / 2, 0);
    });
    wall(w, 0, -d / 2 + 0.1, 0, clad.back !== false);
    wall(d, -w / 2 + 0.1, 0, Math.PI / 2, clad.left !== false);
    if (clad.right) wall(d, w / 2 - 0.1, 0, Math.PI / 2, true);
    if (clad.front) wall(w, 0, d / 2 - 0.1, 0, false);
    this.sheetGable(w + 0.8, d + 0.8, 0.15 + h, Math.min(1.8, w * 0.12), 0x8a9696);
  }

  /** A clad industrial hall (อาคารโรงงาน) w × d × h, front +Z: a concrete plinth and block base, painted sheet cladding with
   * ribs, a window band under the eaves on every side, a flat parapet or a sheet gable, and a wide opening on the front when
   * `door` is given (its width; height `doorH`, centred at `doorX`). */
  hall(w: number, d: number, h: number, color: number, spec: { roof?: 'gable' | 'flat'; door?: number; doorH?: number; doorX?: number; sign?: string; signColor?: number } = {}): void {
    this.bx(this.stone, STONE, w + 0.3, 0.3, d + 0.3, 0, 0.15, 0);
    this.bx(this.stone, CONCRETE, w, 1.3, d, 0, 0.95, 0);
    this.bx(this.paint, color, w + 0.04, h - 1.3, d + 0.04, 0, 0.3 + 1.0 + (h - 1.3) / 2, 0);
    this.colored(shade(color, -0.1), () => {
      for (const x of spread(w, 3.2, 0.3)) for (const s of [-1, 1]) this.box(0.14, h - 1.3, 0.1, x, 1.3 + (h - 1.3) / 2, s * (d / 2 + 0.05), this.paint);
      for (const z of spread(d, 3.2, 0.3)) for (const s of [-1, 1]) this.box(0.1, h - 1.3, 0.14, s * (w / 2 + 0.05), 1.3 + (h - 1.3) / 2, z, this.paint);
    });
    const band = h - 1.5;
    this.quad(w - 1.6, 0.8, 0, band, d / 2 + 0.07, GLASS);
    this.at(0, 0, Math.PI, () => this.quad(w - 1.6, 0.8, 0, band, d / 2 + 0.07, GLASS));
    for (const s of [-1, 1]) this.at(s * w / 2, 0, s * Math.PI / 2, () => this.quad(d - 1.6, 0.8, 0, band, 0.07, GLASS));
    if (spec.door) {
      const door = spec.door, dh = spec.doorH ?? 5, dx = spec.doorX ?? 0;
      this.quad(door, dh, dx, 0.3 + dh / 2, d / 2 + 0.08, DARK);
      this.colored(0x6f7774, () => { for (const s of [-1, 1]) this.box(0.22, dh, 0.22, dx + s * (door / 2 + 0.11), 0.3 + dh / 2, d / 2 + 0.1, this.paint); this.box(door + 0.44, 0.3, 0.22, dx, 0.3 + dh + 0.1, d / 2 + 0.1, this.paint); });
    }
    if (spec.roof === 'flat') {
      this.bx(this.stone, CONCRETE, w + 0.4, 0.28, d + 0.4, 0, h + 0.14, 0);
      this.colored(shade(color, -0.15), () => {
        for (const s of [-1, 1]) { this.box(w + 0.4, 0.6, 0.14, 0, h + 0.5, s * (d / 2 + 0.2), this.paint); this.box(0.14, 0.6, d + 0.4, s * (w / 2 + 0.2), h + 0.5, 0, this.paint); }
      });
    } else this.sheetGable(w + 0.8, d + 0.8, h, Math.min(2.2, d * 0.2), 0x8a9696);
    if (spec.sign) this.label(spec.sign, Math.min(w * 0.7, 5.4), 0.55, spec.doorX ?? 0, h - 0.45, d / 2 + 0.1, 0, spec.signColor ?? WASTE_GREEN, 0xffffff);
  }

  /** A power transformer (หม้อแปลงไฟฟ้า) on its plinth, facing local +Z: tank, radiators, conservator, three bushings. */
  transformer(x: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.stone, CONCRETE, 3.4, 0.3, 2.6, 0, 0.15, 0);
      this.bx(this.paint, 0x7f8c88, 2.6, 1.9, 1.7, 0, 1.25, 0);
      this.bx(this.paint, 0x6f7a76, 2.2, 0.16, 1.5, 0, 2.28, 0);
      this.colored(0x6f7a76, () => { for (const s of [-1, 1]) for (let i = 0; i < 4; i++) this.box(0.1, 1.5, 0.5, s * (1.45 + 0.0), 1.2, -0.75 + i * 0.5, this.paint); });
      this.colored(0x7f8c88, () => this.cylinder(0.34, 2.2, 0, 2.7, -0.2, this.paint, 8, Math.PI / 2));
      this.colored(0xb77a3d, () => { for (const bx of [-0.7, 0, 0.7]) this.cylinder(0.12, 0.9, bx, 2.8, 0.45, this.paint, 6); });
    });
  }

  /** Closes the plant: the water builder's closing, plus the smoke, steam and flame anchors (`anchor_smoke_<n>` …). */
  finishWaste(id: string, kind: string, metadata: Record<string, unknown>) {
    const root = this.finishWater(id, [3, 3], [], { kind, ...metadata });
    const anchors = (name: string, list: readonly Vector3[]): void => list.forEach((at, i) => {
      const anchor = new Object3D();
      anchor.name = `anchor_${name}_${i}`; anchor.position.copy(at); root.add(anchor);
    });
    anchors('smoke', this.smoke); anchors('steam', this.steam); anchors('fire', this.fire);
    return root;
  }
}
