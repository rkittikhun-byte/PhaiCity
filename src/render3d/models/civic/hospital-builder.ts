/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The shared parts of the hospitals (สาธารณสุข, docs/SERVICES.md, RENDERER_SPEC 6H) on the civic 3×3: wards and
// outpatient blocks with ribbon windows and sun shades on every floor, covered emergency porches, ambulances, helipads,
// car parks full of cars and motorbikes, a pylon with the hospital's green cross and its Thai name, covered walkways,
// the flagpole of a government building. Tier R2: the massing is the same in every region; the roof's form and finish,
// the plaster tint, the props and the trees come from the region kit (MODEL_SPEC 6A). No temple or palace ornament and
// no real hospital's name or emblem. NO RED CROSS (MODEL_SPEC 6): the sign is the word "โรงพยาบาล", an "H" on blue and
// a green cross on white, and the ambulances carry a green stripe and a green cross.

import { point } from '../../regional/geometry.js';
import { PAVING, STONE, shade, spread } from './builder.js';
import { DOOR, FRAME, GLASS, SchoolBuilder } from './school-builder.js';
import type { ClassroomBlock } from './school-builder.js';
import type { ModelOptions } from '../registry.js';

/** Hospital colours for the ring beams, hoods, fascias and gate; the seed picks one. Greens and blues, never red. */
export const HOSPITAL_ACCENTS = [0x1f7a5a, 0x2b7d92, 0x2f6f9a, 0x3b8a62, 0x1f6f78, 0x4b8a3c] as const;
/** The green of the hospital cross and the ambulance stripe */
export const CROSS_GREEN = 0x1f7a5a;
export const AMBULANCE_WHITE = 0xf3f2ec;
export const SIGN_BLUE = 0x2f6fa8;
const VENT_DARK = 0x4a4f4e;
const CAR_COLORS = [0xe8e6df, 0x2b3f5a, 0x8a8f94, 0x1f1f1f, 0xb9b4a6, 0x5d6b4a, 0x7a8fa8, 0x9a7b4f] as const;

export interface WingSpec {
  w: number;
  d: number;
  floors: number;
  /** Floor to floor (default 3.6) and the plinth (default 0.45) */
  floor?: number;
  plinth?: number;
  /** A flat roof with a parapet and a plant on top, or the region's modern roof */
  roof: 'flat' | 'kit';
  /** The glazed entrance on the ground floor's front: centre x and width */
  lobby?: { x: number; width: number };
  /** Window bay (default 2.2) */
  step?: number;
  /** Windows at the back and on the ends (default on) */
  rear?: boolean;
  ends?: boolean;
  /** Rooftop plant on a flat roof (default on) */
  plant?: boolean;
  /** The block's name on its front ring beam, at x (default 0) */
  sign?: string;
  signX?: number;
}

/** Batches a hospital compound like the school builder (timber, plaster, stone, one roof, grass, leaves, one sign atlas,
 * painted steel); a compound with a pond paints its steel on plaster, to stay within eight draw calls. */
export class HospitalBuilder extends SchoolBuilder {
  constructor(options: ModelOptions) { super(options, HOSPITAL_ACCENTS); }

  /** The fixed car colour of a slot: the seed turns the palette, never the layout. */
  carColor(i: number): number { return CAR_COLORS[(i + this.seed) % CAR_COLORS.length]; }

  // --- Buildings ---------------------------------------------------------------------------------------------------

  /** A run of ribbon windows from x0 to x1 on the wall facing local +Z at z, with its sun shade. */
  private windowRun(x0: number, x1: number, y: number, z: number, bay: number): void {
    const width = x1 - x0;
    if (width < 1.2) return;
    const x = (x0 + x1) / 2;
    this.glazing(width, 1.6, x, y, z, bay);
    this.bx(this.paint, FRAME, width + 0.3, 0.12, 0.66, x, y + 1.05, z + 0.33);
  }

  /** A hospital block in the local frame, front +Z: a stone plinth, plastered walls with floor bands, a ribbon of windows
   * on every floor of every side, a ring beam in the hospital's colour, then a flat roof with its plant or the region's
   * roof. The block's size never depends on the region or the seed. */
  wing(spec: WingSpec): ClassroomBlock {
    const { w, d, floors: n } = spec, h = spec.floor ?? 3.6, p = spec.plinth ?? 0.45, top = p + n * h, step = spec.step ?? 2.2;
    const levels = Array.from({ length: n }, (_, i) => p + i * h);
    this.bx(this.stone, STONE, w + 0.4, p, d + 0.4, 0, p / 2, 0);
    this.bx(this.paint, this.wall, w, top - p, d, 0, (top + p) / 2, 0);
    this.colored(shade(this.wall, -0.07), () => { for (const y of levels.slice(1)) this.box(w + 0.1, 0.26, d + 0.1, 0, y, 0, this.paint); });
    this.bx(this.paint, this.accent, w + 0.1, 0.5, d + 0.1, 0, top - 0.25, 0);
    if (spec.sign) this.label(spec.sign, Math.min(5, w * 0.4), 0.4, spec.signX ?? 0, top - 0.25, d / 2 + 0.08, 0, this.accent, 0xffffff);
    const lobby = spec.lobby;
    levels.forEach((y, i) => {
      const cy = y + 1.75, edge = w / 2 - 0.7;
      if (i === 0 && lobby) {
        this.windowRun(-edge, lobby.x - lobby.width / 2 - 0.5, cy, d / 2, step);
        this.windowRun(lobby.x + lobby.width / 2 + 0.5, edge, cy, d / 2, step);
        this.quad(lobby.width, 2.7, lobby.x, p + 1.4, d / 2 + 0.02, GLASS);
        for (const s of [-1, 0, 1]) this.quad(0.08, 2.7, lobby.x + s * lobby.width * 0.32, p + 1.4, d / 2 + 0.035, FRAME);
        this.quad(lobby.width, 0.07, lobby.x, p + 2.25, d / 2 + 0.036, FRAME);
        this.quad(0.9, 2.1, lobby.x - 0.5, p + 1.05, d / 2 + 0.05, DOOR);
        this.quad(0.9, 2.1, lobby.x + 0.5, p + 1.05, d / 2 + 0.05, DOOR);
      } else this.windowRun(-edge, edge, cy, d / 2, step);
      if (spec.rear !== false) this.at(0, 0, Math.PI, () => this.windowRun(-edge, edge, cy, d / 2, step));
      if (spec.ends !== false) for (const s of [-1, 1]) this.at(0, 0, s * Math.PI / 2, () => this.windowRun(-(d / 2 - 1), d / 2 - 1, cy, w / 2, 2.4));
    });
    if (spec.roof === 'flat') {
      this.roofOver(w, d, top, { form: 'flatParapet', overhang: 0.15, ornaments: false, brackets: false });
      if (spec.plant !== false) this.rooftop(w, d, top + 0.2);
    } else {
      this.roofOver(w, d, top, { ridge: w >= d ? 'x' : 'z', pitch: Math.min(26, this.kit.defaults.pitch), overhang: 0.7, fill: this.wall,
        brackets: false, panels: false });
    }
    const block = { width: w, depth: d, top, floors: levels };
    this.blocks.push(block);
    return block;
  }

  /** The plant on a flat roof at height y: two water tanks on a stand, air-handling boxes, a lift motor room with its door,
   * vents and an aerial. Placed from the block's centre outward, so it fits any block over 10 × 8 m. */
  rooftop(w: number, d: number, y: number): void {
    const x = w / 2 - 2.4, lift = w / 2 - 6.3;
    this.bx(this.stone, STONE, 2.6, 0.4, d * 0.5 + 0.4, x, y + 0.2, 0);
    this.colored(0x3b7fb0, () => { for (const s of [-1, 1]) this.cylinder(0.85, 1.7, x, y + 1.25, s * d * 0.18, this.paint, 10); });
    this.colored(shade(0x3b7fb0, -0.15), () => { for (const s of [-1, 1]) this.cylinder(0.87, 0.1, x, y + 2.15, s * d * 0.18, this.paint, 10); });
    const units = Array.from({ length: Math.min(3, Math.max(1, Math.floor((w - 1.4) / 3.1))) }, (_, k) => -w / 2 + 2.6 + k * 3.1);
    this.colored(0xc9ccc8, () => { for (const ux of units) this.box(2.4, 1.2, 1.3, ux, y + 0.6, -d / 2 + 1.5, this.paint); });
    this.colored(0x8f9493, () => { for (const ux of units) this.box(1.6, 0.06, 0.9, ux, y + 1.23, -d / 2 + 1.5, this.paint); });
    this.bx(this.paint, shade(this.wall, -0.05), 3.2, 2.7, 2.6, lift, y + 1.35, 0.4);
    this.bx(this.paint, this.accent, 3.4, 0.16, 2.8, lift, y + 2.78, 0.4);
    this.quad(0.9, 1.9, lift, y + 0.95, 1.72, DOOR);
    this.colored(0x9a9e9a, () => {
      for (const px of [-w / 2 + 1.2, w / 2 - 1.2]) this.pole(point(px, y, d / 2 - 1.4), point(px, y + 1.3, d / 2 - 1.4), 0.07, this.steel, 5);
      this.pole(point(2.2, y, -d / 2 + 1.2), point(2.2, y + 5, -d / 2 + 1.2), 0.03, this.steel, 4);
    });
  }

  /** A covered porch (ทางเข้ามีหลังคา) of width w and depth d with its front edge at local +z: pavers, a plastered slab on square
   * columns at height h, a fascia in the hospital's colour carrying the sign, and two lamp posts at the kerb. */
  porch(w: number, d: number, h: number, sign: string, signColor = this.accent): void {
    this.bx(this.stone, PAVING, w + 0.6, 0.05, d + 0.6, 0, 0.085, 0.3);
    this.bx(this.paint, this.wall, w, 0.28, d, 0, h, 0);
    this.bx(this.paint, signColor, w + 0.16, 0.7, 0.32, 0, h + 0.05, d / 2);
    this.colored(shade(this.wall, 0.03), () => {
      for (const x of spread(w - 1, 4.2, 0.2)) this.box(0.4, h - 0.1, 0.4, x, h / 2 + 0.05, d / 2 - 0.4, this.paint);
    });
    this.label(sign, Math.min(w - 1.6, 5.4), 0.5, 0, h + 0.05, d / 2 + 0.18, 0, signColor, 0xffffff);
    for (const s of [-1, 1]) this.lantern(s * (w / 2 + 0.2), d / 2 + 0.7, 2.2);
  }

  /** An ambulance (รถพยาบาล) facing local +Z: a white van with a cab, a green stripe and a green cross on each side, an
   * amber and blue light bar, four wheels. No red cross and no real fleet's livery. */
  ambulance(x: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, AMBULANCE_WHITE, 2, 1.5, 3.4, 0, 1.45, -0.6);
      this.bx(this.paint, AMBULANCE_WHITE, 2, 1.1, 1.5, 0, 1.2, 1.6);
      this.bx(this.paint, 0x2c3740, 1.7, 0.55, 0.06, 0, 1.45, 2.36);
      this.bx(this.paint, 0x8a8f94, 2.05, 0.18, 0.18, 0, 0.75, 2.4);
      this.bx(this.paint, 0xd9a82c, 0.55, 0.14, 0.3, -0.45, 2.28, 0.25);
      this.bx(this.paint, SIGN_BLUE, 0.55, 0.14, 0.3, 0.45, 2.28, 0.25);
      this.colored(0x1f1f1f, () => { for (const s of [-1, 1]) for (const dz of [-1.5, 1.6]) this.box(0.24, 0.7, 0.7, s * 0.95, 0.38, dz, this.paint); });
      for (const s of [-1, 1]) this.at(s * 1.011, -0.6, s * Math.PI / 2, () => {
        this.quad(3.3, 0.26, 0, 1.2, 0, CROSS_GREEN);
        this.quad(0.2, 0.72, -0.5, 1.8, 0.004, CROSS_GREEN);
        this.quad(0.72, 0.2, -0.5, 1.8, 0.004, CROSS_GREEN);
      });
    });
  }

  /** A car in the car park, 48 triangles: body, cabin and a dark skirt standing for the wheels; facing local +Z. */
  lowCar(x: number, z: number, color: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, color, 1.74, 0.6, 4.2, 0, 0.62, 0);
      this.bx(this.paint, 0x2c3740, 1.5, 0.5, 2.1, 0, 1.17, -0.2);
      this.colored(0x1c1c1c, () => { for (const s of [-1, 1]) this.box(0.1, 0.5, 3.3, s * 0.82, 0.25, 0, this.paint); });
    });
  }

  /** A row of parking bays across local X at z, nose to the building (+Z), each cars[i] filled or not; the layout never
   * depends on the seed, only the paint. Paved, with a white line between bays. */
  carRow(x: number, z: number, bays: number, filled: readonly boolean[], pitch = 2.7, startIndex = 0): void {
    const width = bays * pitch;
    this.bx(this.stone, 0x8f8d86, width + 0.4, 0.05, 5.2, x, 0.085, z);
    for (let i = 0; i <= bays; i++) this.flat(0.1, 4.6, x - width / 2 + i * pitch, z, 0.115, 0xf3f1ea);
    for (let i = 0; i < bays; i++) if (filled[i % filled.length]) this.lowCar(x - width / 2 + (i + 0.5) * pitch, z, this.carColor(startIndex + i), Math.PI);
  }

  // --- Signs and marks ---------------------------------------------------------------------------------------------

  /** The hospital's green cross on a white square facing local +Z: two bars, never red. */
  greenCross(size: number, x: number, y: number, z: number): void {
    this.quad(size, size, x, y, z, 0xf4f4ef);
    this.quad(size * 0.26, size * 0.72, x, y, z + 0.012, CROSS_GREEN);
    this.quad(size * 0.72, size * 0.26, x, y, z + 0.012, CROSS_GREEN);
  }

  /** The hospital's sign on the street: a concrete plinth, two steel posts, a board in the hospital's colour carrying its
   * name, a green cross above it and a blue "H". */
  pylon(name: string, width = 3.8): void {
    this.bx(this.stone, STONE, width + 0.4, 0.45, 0.8, 0, 0.225, 0);
    this.colored(0x6f7774, () => { for (const s of [-1, 1]) this.box(0.14, 2.6, 0.14, s * (width / 2 - 0.3), 1.75, 0, this.steel); });
    this.bx(this.paint, this.accent, width, 1.1, 0.22, 0, 2.2, 0);
    this.label(name, width - 0.3, 0.9, 0, 2.2, 0.13, 0, this.accent, 0xffffff);
    this.greenCross(1.2, -width / 2 + 0.9, 3.45, 0.04);
    this.label('H', 1.1, 1.1, width / 2 - 0.9, 3.45, 0.04, 0, SIGN_BLUE, 0xffffff);
    this.bx(this.paint, this.accent, width, 0.12, 0.3, 0, 2.82, 0);
  }

  /** A helipad (ลานจอดเฮลิคอปเตอร์) of radius r at height y: a green disc, a white ring, a white "H" and four corner lights. */
  helipad(x: number, y: number, z: number, r: number): void {
    this.colored(0x4c6b5a, () => this.cylinder(r, 0.2, x, y + 0.1, z, this.paint, 20));
    this.colored(0xf3f1ea, () => this.cylinder(r - 0.4, 0.03, x, y + 0.215, z, this.paint, 20));
    this.colored(0x4c6b5a, () => this.cylinder(r - 0.75, 0.03, x, y + 0.23, z, this.paint, 20));
    const t = 0.22, hh = r * 0.7, at = y + 0.255;
    this.flat(t, hh, x - r * 0.22, z, at, 0xf3f1ea); this.flat(t, hh, x + r * 0.22, z, at, 0xf3f1ea);
    this.flat(r * 0.44 + t, t, x, z, at, 0xf3f1ea);
    this.colored(0xe9b93a, () => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.18, 0.2, 0.18, x + sx * (r - 0.1), y + 0.3, z + sz * (r - 0.1), this.paint); });
  }

  // --- Yard --------------------------------------------------------------------------------------------------------

  /** A covered walkway (ทางเดินมีหลังคา) of the given length along local X: pavers, steel posts, a sheet roof in the
   * hospital's colour. */
  walkway(length: number): void {
    this.bx(this.stone, PAVING, length, 0.06, 2.4, 0, 0.09, 0);
    this.colored(0x6f7774, () => { for (const x of spread(length, 3, 0.15)) for (const s of [-1, 1]) this.box(0.12, 2.7, 0.12, x, 1.45, s * 1.05, this.steel); });
    this.bx(this.paint, this.accent, length + 0.4, 0.1, 2.9, 0, 2.85, 0);
  }

  /** An open car-park building (อาคารจอดรถ) w × d with the given decks: slabs on columns, a solid parapet in the hospital's
   * colour round each deck, a boom barrier at the front of the ground deck, cars on the top deck and on the ground. */
  parkingBuilding(w: number, d: number, decks: number): void {
    const h = 3.2, top = decks * h;
    this.bx(this.stone, 0x8f8d86, w, 0.14, d, 0, 0.07, 0);
    this.colored(shade(STONE, 0.03), () => {
      for (const x of [-w / 2 + 0.4, 0, w / 2 - 0.4]) for (const z of [-d / 2 + 0.4, 0, d / 2 - 0.4]) this.box(0.5, top, 0.5, x, top / 2, z, this.stone);
    });
    for (let k = 1; k <= decks; k++) {
      this.bx(this.stone, shade(STONE, -0.04), w, 0.3, d, 0, k * h, 0);
      this.colored(this.wall, () => {
        this.box(w, 0.9, 0.2, 0, k * h + 0.6, d / 2 - 0.1, this.paint);
        this.box(w, 0.9, 0.2, 0, k * h + 0.6, -d / 2 + 0.1, this.paint);
        for (const s of [-1, 1]) this.box(0.2, 0.9, d - 0.4, s * (w / 2 - 0.1), k * h + 0.6, 0, this.paint);
      });
      this.bx(this.paint, this.accent, w + 0.1, 0.16, d + 0.1, 0, k * h + 1.1, 0);
    }
    this.label('ที่จอดรถ', 2.6, 0.5, 0, h + 0.6, d / 2 + 0.03, 0, SIGN_BLUE, 0xffffff);
    this.colored(0xe9b93a, () => this.box(2.4, 0.1, 0.1, -w / 4, 1.0, d / 2 - 0.5, this.paint));
    // Cars lie along X on the deck (rotated a quarter turn), two to a row
    const cars = (deck: number, slots: readonly (readonly [number, number])[]): void => this.at(0, 0, 0, () =>
      slots.forEach(([x, z], i) => this.lowCar(x, z, this.carColor(i + deck * 3), Math.PI / 2)), deck === 0 ? 0.14 : deck * h + 0.15);
    cars(0, [[-w / 4, -d / 4], [w / 4, -d / 4]]);
    cars(decks, [[-w / 4, -d / 4 + 0.3], [w / 4, -d / 4 + 0.3], [-w / 4, d / 4 - 0.5]]);
  }

  /** A raised tank on a steel frame (ถังเก็บน้ำ) of four posts: a blue tank, a ladder and a pipe down to the ground. */
  tankTower(height = 3.6): void {
    this.colored(0x6f7774, () => {
      for (const x of [-1, 1]) for (const z of [-1, 1]) this.box(0.14, height, 0.14, x * 0.75, height / 2, z * 0.75, this.steel);
      for (const s of [-1, 1]) { this.box(1.5, 0.1, 0.1, 0, height * 0.5, s * 0.75, this.steel); this.box(0.1, 0.1, 1.5, s * 0.75, height * 0.5, 0, this.steel); }
    });
    this.bx(this.stone, STONE, 2, 0.14, 2, 0, height + 0.07, 0);
    this.colored(0x3b7fb0, () => this.cylinder(0.95, 1.7, 0, height + 1, 0, this.paint, 12));
    this.colored(shade(0x3b7fb0, -0.15), () => this.cylinder(0.97, 0.12, 0, height + 1.9, 0, this.paint, 12));
    this.colored(0x9a9e9a, () => this.pole(point(0.4, 0.1, 0.9), point(0.4, height + 1, 0.9), 0.05, this.steel, 4));
  }

  /** A generator house (ห้องเครื่องกำเนิดไฟฟ้า) w × d: a block shed with a louvred door, an exhaust pipe and a fuel tank. */
  generatorHouse(w = 4.4, d = 3.4): void {
    this.bx(this.stone, STONE, w + 0.3, 0.2, d + 0.3, 0, 0.1, 0);
    this.bx(this.paint, shade(this.wall, -0.1), w, 2.8, d, 0, 1.6, 0);
    this.quad(1.5, 2.1, -w / 4, 1.25, d / 2 + 0.02, VENT_DARK);
    this.quad(0.9, 1.3, w / 4, 1.7, d / 2 + 0.02, VENT_DARK);
    this.bx(this.paint, this.accent, w + 0.2, 0.16, d + 0.2, 0, 3.08, 0);
    this.colored(0x5a5f5e, () => this.pole(point(w / 2 - 0.4, 3, -d / 2 + 0.5), point(w / 2 - 0.4, 4.6, -d / 2 + 0.5), 0.1, this.steel, 6));
    this.colored(0xd9d4c4, () => this.cylinder(0.5, 1.8, w / 2 + 1, 0.9, 0.2, this.paint, 10, Math.PI / 2));
    this.label('ห้องไฟฟ้าสำรอง', 2.6, 0.4, 0, 3.3, d / 2 + 0.02, 0, this.accent, 0xffffff);
  }

  /** A waiting bench (ม้านั่งรอ) along local X. */
  waitingBench(x: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => this.colored(shade(this.timber, 0.05), () => {
      this.box(2, 0.07, 0.45, 0, 0.5, 0, this.wood);
      this.box(2, 0.4, 0.06, 0, 0.78, -0.22, this.wood);
      for (const s of [-1, 1]) this.box(0.07, 0.46, 0.4, s * 0.9, 0.27, 0, this.wood);
    }));
  }

  /** Raised herb beds (สวนสมุนไพร) w × d: timber frames filled with soil, rows of leafy plants in two greens. */
  herbBeds(w: number, d: number): void {
    const rows = Math.max(1, Math.floor(d / 1.5));
    for (let r = 0; r < rows; r++) {
      const z = -d / 2 + (r + 0.5) * d / rows;
      this.bx(this.wood, shade(this.timber, 0.04), w, 0.3, 0.9, 0, 0.15, z);
      this.bx(this.paint, 0x5a4330, w - 0.2, 0.06, 0.7, 0, 0.32, z);
      this.colored(r % 2 ? 0x6aa14d : 0x4f9141, () => { for (const x of spread(w - 0.6, 0.55, 0.1)) this.box(0.4, 0.34, 0.4, x, 0.5, z, this.paint); });
    }
    this.label('สวนสมุนไพร', 2.2, 0.4, 0, 1.5, d / 2 + 0.1, 0, 0x4f7f3d, 0xffffff);
    this.colored(this.timber, () => { for (const s of [-1, 1]) this.box(0.08, 1.5, 0.08, s * 0.95, 0.75, d / 2 + 0.08, this.wood); });
  }

  /** Closes the compound as a hospital: the school builder's closing, with the hospital's metadata. */
  finishHospital(id: string, kind: string, metadata: Record<string, unknown>) {
    return this.finishSchool(id, kind, { mark: 'H', markColor: 'green', nationalFlag: 'Thai', ...metadata });
  }
}
