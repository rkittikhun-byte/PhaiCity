/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, Color, Group, LatheGeometry, Material, MeshStandardMaterial, Object3D, Vector2 } from 'three';
import { tint, vertexFinish } from '../../materials/library.js';
import type { MaterialKey } from '../../materials/library.js';
import { KitBuilder, point } from '../../regional/geometry.js';
import type { RoofForm } from '../../regional/contracts.js';
import { regionalLeafColor } from '../../regional/vegetation.js';
import type { RegionTier } from '../../regional/types.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { GeometryPart } from '../../util/geometry.js';
import { CommercialBuilder } from '../commercial/builder.js';
import type { ModelOptions } from '../registry.js';

export type PlotCategory = 'residential' | 'commercial' | 'industrial';
export const LAND_LABELS = {
  th: ['ที่ดินราคาต่ำ · เก่าทรุดโทรม', 'ที่ดินราคาปานกลาง · เรียบง่าย', 'ที่ดินราคาดี · ดูแลดี', 'ที่ดินราคาสูง · ตกแต่งดี'],
  en: ['Low land value · worn', 'Modest land value · plain', 'Good land value · well kept', 'High land value · fine finishes'],
} as const;
export const FACTORY_LABELS = { th: ['โรงงานเก่า · สนิมและคราบ', 'โรงงานใหม่ · สะอาด'], en: ['Older works · rust and stains', 'Newer works · clean'] } as const;
export const WORKS_LABELS = {
  th: ['โรงงานเก่า · สนิมและคราบ', 'โรงงานเก่า · ดูแลพอใช้', 'โรงงานใหม่ · สะอาด', 'โรงงานทันสมัย · โซลาร์และสวน'],
  en: ['Old works · rust and stains', 'Older works · kept up', 'Newer works · clean', 'Modern works · solar and planting'],
} as const;
const LAUNDRY = [0xc9504a, 0x4f7fb5, 0xe8e4d8, 0xd8b44c, 0x6f9a6a, 0xb57ab0, 0x3f4651, 0xe39a5c] as const;
const WORN_GREY = new Color(0x97938a);

/** Shades a colour towards a weathered grey by land value: 0 worn … 3 freshly painted. */
export function weather(color: number, land: number): number {
  return new Color(color).lerp(WORN_GREY, [0.38, 0.16, 0.04, 0][Math.max(0, Math.min(3, land))]).getHex();
}

/** One-tile plot buildings: shared plaster, steel, canvas, concrete and sign batches with baked colours,
 * so every land value and seed of a family shares the same few city batches. */
export class PlotBuilder extends CommercialBuilder {
  readonly metal = vertexFinish('metal_steel');
  /** Paving, kerbs and structural concrete share the concrete floor scan. */
  stone = vertexFinish('concrete_weathered');
  readonly leaves: MeshStandardMaterial;
  /** Land value class from `variant`, clamped to the family's range. */
  readonly land: number;
  readonly random: () => number;
  private readonly anchorPoints: [string, number, number, number][] = [];
  constructor(options: ModelOptions, top: number) {
    super(options);
    const variant = Math.trunc(Number(options.variant ?? 0));
    this.land = Number.isFinite(variant) ? Math.min(top, Math.max(0, variant)) : 0;
    this.random = seededRng(((options.seed ?? 1) ^ 0x2c9277b5) >>> 0);
    this.leaves = tint('foliage_tropical', regionalLeafColor(this.kit.id));
  }

  pick<T>(list: readonly T[]): T { return list[Math.floor(this.random() * list.length)]; }

  /** The seed's own shade of a finish colour, the same shift for every finish of one building. */
  vary(color: number, amount = 1): number {
    const r = seededRng(((this.options.seed ?? 1) ^ 0x6a09e667) >>> 0);
    return new Color(color).offsetHSL((r() - 0.5) * 0.04 * amount, (r() - 0.5) * 0.14 * amount, (r() - 0.5) * 0.1 * amount).getHex();
  }

  /** A box in one baked colour; the default finish is the shared plaster batch. */
  tone(color: number, w: number, h: number, d: number, x: number, y: number, z: number, mat: Material = this.paint, roll = 0): void {
    this.colored(color, () => this.box(w, h, d, x, y, z, mat, roll));
  }

  /** A box tilted about X (canopies, ramps), y and z at its centre. */
  tilt(color: number, w: number, h: number, d: number, x: number, y: number, z: number, angle: number, mat: Material = this.paint): void {
    const source = new BoxGeometry(w, h, d).rotateX(angle).translate(x, y, z);
    this.colored(color, () => this.add(applyWorldUV(source, 1), mat)); source.dispose();
  }

  /** Builds a fixture at the origin, then turns it about Y and moves it into place. */
  at(x: number, y: number, z: number, yaw: number, make: () => void): void {
    const first = this.parts.length; make();
    this.parts.slice(first).forEach(p => p.geometry.rotateY(yaw).translate(x, y, z));
  }

  /** A structural wall mass, bottom at y; worn lots darken towards the parapet like monsoon streaks. */
  body(color: number, w: number, h: number, d: number, x: number, y: number, z: number, stain = 0): void {
    const first = this.parts.length;
    this.colored(color, () => this.mass(w, h, d, x, y + h / 2, z, this.paint));
    if (stain > 0) this.streak(first, y, y + h, stain);
  }

  /** Darkens baked colours with height; cheap rain stains with no extra geometry or texture. */
  streak(first: number, y0: number, y1: number, amount: number): void {
    this.parts.slice(first).forEach(p => {
      const position = p.geometry.getAttribute('position'), color = p.geometry.getAttribute('color');
      if (!color) return;
      for (let i = 0; i < position.count; i++) {
        const t = Math.min(1, Math.max(0, (position.getY(i) - y0) / (y1 - y0))), k = 1 - amount * (0.3 + 0.7 * t * t);
        color.setXYZ(i, color.getX(i) * k, color.getY(i) * k, color.getZ(i) * k);
      }
    });
  }

  /** Regional kit parts join this plot's batches; their own colours become vertex colours. */
  dress(parts: GeometryPart[], roof: Material = this.paint): GeometryPart[] {
    parts.forEach(p => {
      const key = p.material.userData.materialKey as MaterialKey;
      if (key === 'foliage_tropical' || key === 'sign_thai' || p.material.userData.vertexFinish) return;
      const target = key.startsWith('roof_') || key.startsWith('thatch_') ? roof : key.startsWith('glass_') ? this.glass
        : key.startsWith('metal_') || key === 'roller_shutter' ? this.metal : key === 'fabric_canvas' ? this.fabric
          : key.startsWith('concrete_') ? this.stone : this.paint;
      const value = (p.material as MeshStandardMaterial).color.getHex();
      p.material = target;
      if (target.userData.vertexFinish) CommercialBuilder.color(p.geometry, value);
    });
    return parts;
  }

  /** A regional kit roof over a w (X) × d (Z) body with its ridge along X, so a row of plots reads as one
   * street front: the ends stay flush with the end walls, and gable ends are closed in the wall colour. */
  ridgeRoof(form: RoofForm, w: number, d: number, base: number, z: number, o: { pitch: number; overhang: number;
    material: MaterialKey; wall: number; ornaments?: boolean; trim?: number; surface?: number; x?: number }): void {
    const roof = vertexFinish(o.material), across = d + 2 * o.overhang, a = o.pitch * Math.PI / 180;
    const parts = this.kit.roofs[form]([d, w - 2 * o.overhang], { baseY: base, pitch: o.pitch, overhang: o.overhang,
      material: o.material, seed: this.options.seed, ornaments: o.ornaments ?? false, trimColor: o.trim, surfaceColor: o.surface, detail: 'low' });
    const ends = new KitBuilder();
    const gable = (half: number, bottom: number, angle: number, at: number, eave: number): void => {
      for (const side of [-1, 1]) {
        const rise = Math.tan(angle), v = eave > 0
          ? [point(-half, bottom, side * at), point(half, bottom, side * at), point(half, bottom + rise * eave, side * at),
            point(0, bottom + rise * (half + eave), side * at), point(-half, bottom + rise * eave, side * at)]
          : [point(-half, bottom, side * at), point(half, bottom, side * at), point(0, bottom + rise * half, side * at)];
        ends.panel(side > 0 ? v : [...v].reverse(), point(0, 0, side), 0.08, this.paint);
      }
    };
    if (form === 'gable') gable(d / 2, base - 0.02, a, w / 2, o.overhang);
    if (form === 'layeredGable') {
      gable(d / 2, base - 0.02, Math.min(a, 0.45), w / 2, o.overhang);
      gable(across * 0.365, base + across * 0.19, a, w * 0.385, 0);
    }
    this.colored(o.wall, () => this.take(ends.parts, o.x ?? 0, 0, z, Math.PI / 2));
    this.take(this.dress(parts, roof), o.x ?? 0, 0, z, Math.PI / 2);
  }

  /** Flat concrete roof deck with a parapet in the wall colour, top of the deck at y. */
  parapet(color: number, w: number, d: number, x: number, y: number, z: number, height = 0.8, mat: Material = this.paint): void {
    this.tone(new Color(color).lerp(new Color(0x9c9a94), 0.75).getHex(), w, 0.2, d, x, y - 0.1, z, this.stone);
    this.colored(color, () => {
      for (const side of [-1, 1]) {
        this.box(w, height, 0.16, x, y + height / 2, z + side * (d / 2 - 0.08), mat);
        this.box(0.16, height, d - 0.32, x + side * (w / 2 - 0.08), y + height / 2, z, mat);
      }
    });
  }

  /** A window facing ±Z with its bottom at y: frame, glass, sill and an optional steel grille (เหล็กดัด). */
  window(w: number, h: number, x: number, y: number, z: number, frame: number, grille = 0, facing = 1): void {
    this.tone(frame, w + 0.16, h + 0.16, 0.05, x, y + h / 2, z + facing * 0.025);
    this.box(w, h, 0.04, x, y + h / 2, z + facing * 0.06, this.glass);
    this.tone(frame, w + 0.26, 0.08, 0.16, x, y - 0.1, z + facing * 0.08);
    if (grille) this.bars(w, h, x, y, z + facing * 0.13, Math.max(2, Math.round(w / 0.32)), grille);
  }

  /** A window with a projecting frame (jambs, head and a deep sill) around set-back glass, an optional mullion and steel
   * grille; faces ±Z with the bottom of the glass at y. */
  framed(w: number, h: number, x: number, y: number, z: number, color: number, o: { grille?: number; mullion?: boolean; facing?: number; transom?: boolean } = {}): void {
    const f = o.facing ?? 1, d = 0.12, t = 0.08;
    this.colored(color, () => {
      for (const side of [-1, 1]) this.box(t, h + t, d, x + side * (w + t) / 2, y + (h + t) / 2, z + f * d / 2, this.paint);
      this.box(w + 2 * t, t, d, x, y + h + t / 2, z + f * d / 2, this.paint);
      this.box(w + 2 * t + 0.14, 0.07, d + 0.1, x, y - 0.035, z + f * (d + 0.1) / 2, this.paint);
      if (o.mullion) this.box(0.05, h, 0.05, x, y + h / 2, z + f * 0.06, this.paint);
      if (o.transom) this.box(w, 0.05, 0.05, x, y + h * 0.72, z + f * 0.06, this.paint);
    });
    this.box(w, h, 0.03, x, y + h / 2, z + f * 0.03, this.glass);
    if (o.grille) this.bars(w, h, x, y, z + f * (d + 0.03), Math.max(2, Math.round(w / 0.32)), o.grille);
  }

  /** A window on a back wall (-Z) at z, its bottom at y, which the game's camera seldom sees close: a plate of the
   * frame's colour with its glass on it, 14 triangles for the 72 of a framed one with a mullion (a 1-tile house
   * keeps to 3,000, MODEL_SPEC 4) */
  backWindow(w: number, h: number, x: number, y: number, z: number, color: number): void {
    this.tone(color, w + 0.16, h + 0.16, 0.04, x, y + h / 2, z - 0.02);
    this.pane(w, h, x, y + h / 2, z - 0.045, this.glass, Math.PI);
  }

  /** An eaves gutter along X at zGutter, and downpipes at the given X down the wall line zPipe, each with an offset
   * back to the wall and, when it reaches the ground, a shoe. */
  gutter(w: number, x: number, y: number, zGutter: number, zPipe: number, color: number, pipes: readonly number[], bottom = 0.25): void {
    const out = Math.sign(zGutter - zPipe) || 1;
    this.colored(color, () => {
      this.box(w, 0.13, 0.15, x, y, zGutter, this.metal);
      for (const px of pipes) {
        this.box(0.09, y - bottom, 0.09, px, (y + bottom) / 2, zPipe, this.metal);
        if (bottom < 0.5) this.box(0.09, 0.09, 0.3, px, 0.2, zPipe + out * 0.12, this.metal);
        if (Math.abs(zGutter - zPipe) > 0.1) this.box(0.09, 0.09, Math.abs(zGutter - zPipe), px, y - 0.12, (zGutter + zPipe) / 2, this.metal);
      }
    });
  }

  /** A railing along X: top and bottom rails with square posts. */
  railing(w: number, x: number, y: number, z: number, color: number, posts: number, h = 1.0): void {
    this.colored(color, () => {
      this.box(w, 0.06, 0.07, x, y + h, z, this.metal);
      this.box(w, 0.04, 0.04, x, y + 0.12, z, this.metal);
      for (let i = 0; i < posts; i++) this.box(0.05, h, 0.05, x - w / 2 + (i + 0.5) * w / posts, y + h / 2, z, this.metal);
    });
  }

  /** Satellite dish on a short mast, turned by yaw. */
  dish(x: number, y: number, z: number, yaw = 0): void {
    this.at(x, y, z, yaw, () => this.colored(0xd4d6d2, () => {
      this.cylinder(0.03, 0.7, 0, 0.35, 0, this.metal, 4);
      this.cylinder(0.32, 0.05, 0, 0.75, 0.05, this.paint, 8, Math.PI / 2 - 0.5);
    }));
  }

  /** A rooftop condenser or chiller: cabinet, top fan ring and a dark fan, base at y. */
  condenser(x: number, y: number, z: number, w = 1.1, d = 0.8, h = 0.75): void {
    this.tone(0xd9dad5, w, h, d, x, y + h / 2, z);
    this.colored(0x30363a, () => this.cylinder(Math.min(w, d) * 0.36, 0.04, x, y + h + 0.02, z, this.metal, 8));
    this.tone(0x8c9393, w + 0.06, 0.08, d + 0.06, x, y + 0.04, z, this.metal);
  }

  /** A planter box with leaf cards, base at y. */
  planter(w: number, d: number, x: number, y: number, z: number, color = 0x8c7f6c, leaves = 6): void {
    this.tone(color, w, 0.45, d, x, y + 0.225, z);
    for (let i = 0; i < leaves; i++) {
      const a = i * 2.4 + this.random() * 0.4, px = x + (i / Math.max(1, leaves - 1) - 0.5) * (w - 0.3);
      this.leaf(point(px, y + 0.42, z), point(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 0.55, 0.32, this.leaves, a);
    }
  }

  /** A small wall lamp facing ±Z. */
  lamp(x: number, y: number, z: number, facing = 1): void {
    this.tone(0x2f3436, 0.12, 0.08, 0.22, x, y, z + facing * 0.11, this.metal);
    this.tone(0xf1e6c8, 0.14, 0.14, 0.14, x, y - 0.1, z + facing * 0.18);
  }

  /** Steel bars between two rails: gates, grilles and railings, across X or along Z. */
  bars(w: number, h: number, x: number, y: number, z: number, n: number, color: number, alongZ = false, size = 0.05): void {
    this.colored(color, () => {
      for (const dy of [0.05, h - 0.05]) {
        if (alongZ) this.box(size, size, w, x, y + dy, z, this.metal); else this.box(w, size, size, x, y + dy, z, this.metal);
      }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n * w - w / 2;
        if (alongZ) this.box(size * 0.7, h, size * 0.7, x, y + h / 2, z + t, this.metal);
        else this.box(size * 0.7, h, size * 0.7, x + t, y + h / 2, z, this.metal);
      }
    });
  }

  /** Air-conditioner condenser hung on a wall; yaw 0 faces +Z. */
  ac(x: number, y: number, z: number, yaw = 0): void {
    this.at(x, y, z, yaw, () => {
      this.tone(0xe2e1da, 0.78, 0.52, 0.3, 0, 0, 0);
      this.tone(0x394043, 0.38, 0.38, 0.03, -0.13, 0, 0.16, this.metal);
    });
  }

  /** Rooftop or yard water tank (stainless or moulded plastic) on a low stand, base at y. */
  tank(x: number, y: number, z: number, r = 0.42, h = 1.05, color = 0xd3d8d9): void {
    this.colored(color, () => {
      this.cylinder(r, h, x, y + 0.32 + h / 2, z, this.paint, 10);
      this.box(r * 0.7, 0.08, r * 0.7, x, y + 0.36 + h, z, this.paint);
    });
    this.colored(0x585e5e, () => { for (const dx of [-1, 1]) this.box(0.07, 0.32, r * 1.7, x + dx * r * 0.55, y + 0.16, z, this.metal); });
  }

  /** A laundry line of seeded clothes, hung along X. */
  laundry(w: number, x: number, y: number, z: number, count = 3): void {
    this.tone(0x8c9292, w, 0.03, 0.03, x, y, z, this.metal);
    for (let i = 0; i < count; i++) {
      const h = 0.45 + this.random() * 0.25;
      this.tone(this.pick(LAUNDRY), w / count * 0.72, h, 0.03, x - w / 2 + (i + 0.5) * w / count, y - h / 2 - 0.03, z, this.fabric);
    }
  }

  /** Potted plant: a terracotta pot and four leaf cards from the region's foliage batch. */
  pot(x: number, z: number, y = 0.05, size = 1): void {
    this.colored(0xa45d3c, () => this.cylinder(0.2 * size, 0.34 * size, x, y + 0.17 * size, z, this.paint, 6));
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.5 + this.random() * 0.3;
      this.leaf(point(x, y + 0.3 * size, z), point(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55), 0.6 * size, 0.3 * size, this.leaves, a);
    }
  }

  /** A garden tree from the region's planting mix; bark joins the plaster batch. */
  plant(x: number, z: number, height: number, radius: number, y = 0.05, offset = 0, kind?: string): void {
    const mix = this.kit.vegetation.filter(p => !p.nearWaterOnly);
    const species = kind ?? mix[Math.abs(Math.trunc((this.options.seed ?? 1) + offset)) % mix.length].id.slice(4);
    this.take(this.dress(this.kit.gardenPlant(species, { seed: (this.options.seed ?? 1) + offset, height, radius })), x, y, z);
  }

  /** Scooter, the city's commonest vehicle; yaw 0 points +Z. */
  scooter(x: number, z: number, color: number, yaw = 0, y = 0.05): void {
    this.at(x, y, z, yaw, () => {
      this.colored(0x232727, () => { for (const dz of [-0.6, 0.6]) this.cylinder(0.25, 0.1, 0, 0.25, dz, this.fabric, 6, Math.PI / 2); });
      this.tone(color, 0.3, 0.3, 0.95, 0, 0.55, -0.05);
      this.tone(0x2b2f31, 0.26, 0.1, 0.55, 0, 0.75, -0.2, this.fabric);
      this.tone(color, 0.34, 0.5, 0.16, 0, 0.72, 0.48);
      this.tone(0x8a9191, 0.62, 0.05, 0.05, 0, 1.02, 0.46, this.metal);
    });
  }

  /** Small car (eco car or pickup); yaw 0 points +Z. */
  auto(x: number, z: number, color: number, yaw = 0, pickup = false, y = 0.05): void {
    this.at(x, y, z, yaw, () => {
      const long = pickup ? 4.9 : 4.1;
      this.tone(color, 1.7, 0.62, long, 0, 0.6, 0);
      this.box(1.5, 0.56, pickup ? 1.7 : 2.1, 0, 1.18, pickup ? 0.72 : -0.1, this.glass);
      this.tone(color, 1.52, 0.08, pickup ? 1.6 : 1.95, 0, 1.48, pickup ? 0.72 : -0.1);
      if (pickup) for (const side of [-1, 1]) this.tone(color, 0.06, 0.38, 2.1, side * 0.82, 1.08, -1.25);
      this.colored(0x1f2323, () => {
        for (const side of [-1, 1]) for (const dz of [-long * 0.32, long * 0.32]) this.cylinder(0.32, 0.2, side * 0.78, 0.32, dz, this.metal, 8, Math.PI / 2);
      });
    });
  }

  /** A six-wheeled lorry, box body or tanker, 7.2 m long; yaw 0 points +Z. */
  lorry(x: number, z: number, color: number, yaw = 0, tanker = false, y = 0.05): void {
    this.at(x, y, z, yaw, () => {
      this.tone(0x2c3032, 2.0, 0.35, 6.8, 0, 0.8, -0.2, this.metal);
      this.tone(color, 2.3, 1.9, 1.7, 0, 1.9, 2.75);
      this.box(2.1, 0.75, 0.04, 0, 2.35, 3.61, this.glass);
      this.tone(0x2c3032, 2.32, 0.25, 0.1, 0, 0.95, 3.62, this.metal);
      if (tanker) this.colored(0xd9dcdc, () => { this.pole(point(0, 2.0, -3.4), point(0, 2.0, 1.6), 1.0, this.metal, 12); this.box(0.5, 0.3, 4.6, 0, 3.1, -0.9, this.metal); });
      else this.tone(0xe9e9e3, 2.45, 2.7, 5.0, 0, 2.35, -1.0, this.paint);
      this.colored(0x1f2323, () => {
        for (const side of [-1, 1]) for (const dz of [2.6, -1.9, -3.0]) this.cylinder(0.48, 0.3, side * 1.0, 0.48, dz, this.fabric, 8, Math.PI / 2);
      });
    });
  }

  /** Open-topped chimney (stained concrete or painted steel) with a dark throat; the smoke anchor sits on the rim. */
  chimney(x: number, z: number, top: number, base: number, concrete: boolean, color: number): void {
    const mat = concrete ? this.stone : this.paint, first = this.parts.length;
    this.tone(0x8f8c84, base * 2.4, 0.5, base * 2.4, x, 0.25, z, this.stone);
    const source = new LatheGeometry([new Vector2(base, 0.5), new Vector2(base * 0.68, top - 0.25), new Vector2(base * 0.76, top - 0.25),
      new Vector2(base * 0.76, top), new Vector2(base * 0.5, top), new Vector2(base * 0.5, top - 1.2)], 10).translate(x, 0, z);
    this.colored(color, () => this.add(applyWorldUV(source, 1), mat)); source.dispose();
    if (concrete) this.streak(first, top * 0.5, top, 0.45);
    this.colored(0x262624, () => this.cylinder(base * 0.49, 0.06, x, top - 1.15, z, this.fabric, 10));
    if (!concrete) this.colored(0xb3392f, () => this.cylinder(base * 0.8, 0.9, x, top - 0.95, z, this.paint, 10));
    // Bands sit just proud of the tapering shaft (radius base at 0.5 m, 0.68 base under the rim).
    this.colored(0x50585a, () => { for (let y = 2.5; y < top - 1; y += 3) this.cylinder(base * (1 - 0.32 * (y - 0.5) / (top - 0.75)) + 0.05, 0.1, x, y, z, this.metal, 10); });
    this.anchor(`anchor_smoke_${this.anchorPoints.length}`, x, top, z);
  }

  /** A slatted park bench on two steel frames, base at y; yaw 0 faces +Z. */
  bench(x: number, y: number, z: number, yaw = 0, color = 0x8a6a4a): void {
    this.at(x, y, z, yaw, () => {
      this.tone(color, 1.6, 0.07, 0.42, 0, 0.45, 0);
      this.tone(color, 1.6, 0.32, 0.06, 0, 0.72, -0.2, this.paint, 0);
      this.colored(0x4f5658, () => { for (const dx of [-0.65, 0.65]) { this.box(0.07, 0.42, 0.4, dx, 0.21, 0, this.metal); this.box(0.07, 0.5, 0.06, dx, 0.68, -0.21, this.metal); } });
    });
  }

  /** A row of steel bicycle hoops, n of them 0.6 apart along X (or along Z), base at ground. */
  bikeRack(x: number, z: number, n: number, alongZ = false): void {
    this.colored(0x7a8285, () => {
      for (let i = 0; i < n; i++) {
        const t = (i - (n - 1) / 2) * 0.6, px = alongZ ? x : x + t, pz = alongZ ? z + t : z;
        for (const s of [-0.22, 0.22]) this.box(0.05, 0.75, 0.05, alongZ ? px + s : px, 0.43, alongZ ? pz : pz + s, this.metal);
        this.box(alongZ ? 0.5 : 0.05, 0.05, alongZ ? 0.05 : 0.5, px, 0.8, pz, this.metal);
      }
    });
  }

  /** A window-cleaning gantry (building maintenance unit) parked on a flat roof at y: two rails of length `len`
   * along X, a carriage, a mast and a jib reaching towards +Z (turned by yaw). */
  gantry(x: number, y: number, z: number, len: number, yaw = 0): void {
    this.at(x, y, z, yaw, () => {
      this.colored(0x6e7577, () => { for (const dz of [-0.45, 0.45]) this.box(len, 0.1, 0.12, 0, 0.05, dz, this.metal); });
      this.tone(0xa9aeab, 1.2, 0.8, 1.1, -len / 4, 0.5, 0);
      this.tone(0xa9aeab, 0.26, 1.5, 0.26, -len / 4, 1.65, 0);
      this.tone(0xc9b23e, 0.2, 0.2, 2.2, -len / 4, 2.35, 0.75);
      this.tone(0x4f5658, 0.05, 0.6, 0.05, -len / 4, 1.95, 1.75, this.metal);
      this.tone(0xd9d8d0, 1.0, 0.35, 0.45, -len / 4, 1.5, 1.75);
    });
  }

  /** Paving joints: a grid of fine dark lines `step` apart over a w × d slab whose top is at y. */
  paving(w: number, d: number, x: number, y: number, z: number, step = 1.5, color = 0x8f8b82): void {
    this.colored(color, () => {
      for (let u = -w / 2 + step; u < w / 2 - 0.05; u += step) this.box(0.04, 0.012, d, x + u, y + 0.006, z, this.stone);
      for (let v = -d / 2 + step; v < d / 2 - 0.05; v += step) this.box(w, 0.012, 0.04, x, y + 0.006, z + v, this.stone);
    });
  }

  /** Thin vertical mullions over a curtain wall between y0 and y1, at the given offsets along one face: the face
   * is across X at z = at (alongZ false) or across Z at x = at. */
  mullions(offsets: readonly number[], y0: number, y1: number, at: number, centre: number, color: number, alongZ = false, size = 0.05): void {
    this.colored(color, () => { for (const t of offsets) {
      if (alongZ) this.box(size * 1.6, y1 - y0, size, at, (y0 + y1) / 2, centre + t, this.metal);
      else this.box(size, y1 - y0, size * 1.6, centre + t, (y0 + y1) / 2, at, this.metal);
    } });
  }

  anchor(name: string, x: number, y: number, z: number): void { this.anchorPoints.push([name, x, y, z]); }

  finishPlot(id: string, category: PlotCategory, tier: RegionTier, level: number, labels: { th: readonly string[]; en: readonly string[] },
    metadata: Record<string, unknown> = {}, footprint: readonly [number, number] = [1, 1]): Group {
    if (this.signs.length) this.flushSigns();
    const root = this.finish(id, category, footprint, [], this.options);
    Object.assign(root.userData, { ...metadata, regionTier: tier, kit: this.kit.id, plot: true, level, landValue: this.land,
      variantLabel: labels.th[this.land], variantLabelEn: labels.en[this.land], entranceFacing: '+Z',
      components: this.components, structuralBodies: this.structuralBodies, signTexts: this.signs.map(s => s.text) });
    this.anchorPoints.forEach(([name, x, y, z]) => { const anchor = new Object3D(); anchor.name = name; anchor.position.set(x, y, z); root.add(anchor); });
    return root;
  }
}

