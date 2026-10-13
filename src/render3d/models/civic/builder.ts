/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color, Material, Matrix4, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { tint } from '../../materials/library.js';
import type { MaterialKey } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { regionalLeafColor } from '../../regional/vegetation.js';
import type { PaletteChoice, RegionKit, RoofForm, RoofOptions, WallForm } from '../../regional/contracts.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { GeometryPart } from '../../util/geometry.js';
import { CommercialBuilder } from '../commercial/builder.js';
import { ServiceBuilder } from '../services/builder.js';
import type { ModelOptions } from '../registry.js';

/** The regional form of a government office compound, read from the region kit (MODEL_SPEC 6A, tier R1). */
export interface CivicForm {
  /** Undercroft height of the raised timber houses */
  floor: number;
  roof: RoofForm;
  wall: WallForm;
  roofKey: MaterialKey;
  /** Isan เกย: the front platform sits this much below the building's floor */
  drop: number;
  /** Lanna twin gables facing the front, with kalae */
  twin: boolean;
  /** A lean-to over the front terrace: Isan เกย, Mon veranda */
  lean: boolean;
  /** Eastern fretwork railings */
  fret: boolean;
  /** Southern arches and plastered upper storeys */
  arcade: boolean;
}

export function civicForm(kit: RegionKit): CivicForm {
  const house = kit.houses.traditional;
  return {
    floor: Math.min(2.2, Math.max(0.6, kit.houses.stilt.floor)), roof: house.roof, wall: house.wall,
    // A leaf-thatched office would read as a hut: the west keeps its tiled Mon roofs.
    roofKey: kit.defaults.roofMaterial.startsWith('thatch') ? house.roofMaterial : kit.defaults.roofMaterial,
    drop: house.terraceDrop ?? 0, twin: kit.id === 'north', lean: kit.id === 'northeast' || kit.id === 'west',
    fret: kit.id === 'east', arcade: kit.id === 'south',
  };
}

export interface RoofSpec {
  form?: RoofForm;
  /** Ridge along local X (gables at the sides) or Z (gables facing the front); default Z */
  ridge?: 'x' | 'z';
  twin?: boolean;
  /** The kit's applied civic crown (kit.services.roof) instead of the house roof */
  civic?: boolean;
  ornaments?: boolean;
  overhang?: number;
  pitch?: number;
  /** Gable infill colour, or false for none */
  fill?: number | false;
  /** Plain eave brackets (คันทวย) under the eaves; default on */
  brackets?: boolean;
  /** A tie beam and battens on a timber gable (หน้าจั่วลูกฟัก); default on, off for plain plastered gables */
  panels?: boolean;
}

export const STONE = 0xbab3a4;
export const PAVING = 0xcbc3b0;
export const LATERITE = 0xa9694c;
const DARK = 0x2e2822;

/** Evenly spaced positions across a length, inset from both ends. */
export function spread(length: number, step: number, inset = 0.12): number[] {
  const n = Math.max(1, Math.ceil((length - inset * 2) / step));
  return Array.from({ length: n + 1 }, (_, i) => -length / 2 + inset + i * (length - inset * 2) / n);
}

export function shade(color: number, amount: number): number {
  return new Color(color).offsetHSL(0, 0, amount).getHex();
}

/** Batches the whole compound into timber, plaster, stone, one roof, grass, leaves, water and one sign atlas. */
export class CivicBuilder extends ServiceBuilder {
  readonly seed: number;
  readonly form: CivicForm;
  readonly colors: PaletteChoice;
  /** Posts, decks, stairs and rails */
  readonly timber: number;
  /** Whitewash tinted by the region's plaster colours */
  readonly masonry: number;
  /** A kept lawn, greener than the dry scan */
  readonly grass = tint('grass', 0x8fbf6e);
  roofMaterial?: Material;
  /** Lantern glows, in model coordinates */
  readonly lights: Vector3[] = [];
  /** Fountain jets, in model coordinates */
  readonly jets: Vector3[] = [];
  private frame = new Matrix4();
  private frameYaw = 0;

  /** form: parts of the regional form to replace, e.g. a school's modern roof (models/civic/school-builder.ts) */
  constructor(options: ModelOptions, form: Partial<CivicForm> = {}) {
    super(options);
    this.seed = options.seed ?? 1;
    this.form = { ...civicForm(this.kit), ...form };
    this.colors = this.kit.palette.pick(this.seed);
    // Structural timber: the kit's trim, except Lanna's cream trim, where posts and decks stay dark teak.
    this.timber = this.kit.id === 'north' ? shade(this.colors.wall, -0.04) : this.colors.trim;
    this.masonry = new Color(this.kit.palette.pick(this.seed, 'plaster').wall).lerp(new Color(0xf4f0e4), 0.55).getHex();
  }

  water(): Material { return tint('water_river', 0x5d9a9c); }

  /** Kit parts join the shared batches; prop roofs and jars keep their colour on plaster. */
  adopt(parts: GeometryPart[], prop = false): GeometryPart[] {
    for (const part of parts) {
      const material = part.material as MeshStandardMaterial, key = String(material.userData.materialKey ?? '');
      if (material.userData.vertexFinish || material.userData.signAtlas || key === 'foliage_tropical' || key === 'grass'
        || key.startsWith('water_')) continue;
      if (!prop && (key.startsWith('roof_') || key.startsWith('thatch_'))) {
        this.roofMaterial ??= material; part.material = this.roofMaterial; continue;
      }
      CommercialBuilder.color(part.geometry, material.color.getHex());
      part.material = key.startsWith('wood_') || key.startsWith('bamboo_') ? this.wood
        : key.startsWith('concrete_') || key === 'sidewalk_tile' ? this.stone : this.paint;
    }
    return parts;
  }

  /** Builds in a local frame (front +Z) and bakes the placement into everything make() adds. */
  at(x: number, z: number, yaw: number, make: () => void, y = 0): void {
    const first = this.parts.length, local = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(yaw));
    const frame = this.frame, frameYaw = this.frameYaw;
    this.frame = frame.clone().multiply(local); this.frameYaw += yaw;
    try { make(); } finally { this.frame = frame; this.frameYaw = frameYaw; }
    this.parts.slice(first).forEach(part => part.geometry.applyMatrix4(local));
  }

  bx(material: Material, color: number, w: number, h: number, d: number, x: number, y: number, z: number, roll = 0): void {
    this.colored(color, () => this.box(w, h, d, x, y, z, material, roll));
  }

  /** A Thai sign in the current local frame, facing local +Z. */
  label(text: string, w: number, h: number, x: number, y: number, z: number, yaw = 0, background = 0xece2c6, foreground = 0x3b2414): void {
    const at = new Vector3(x, y, z).applyMatrix4(this.frame);
    this.shopSign(text, w, h, at.x, at.y, at.z, { background, foreground, yaw: this.frameYaw + yaw });
  }

  wallRun(width: number, height: number, x: number, y: number, z: number, yaw = 0, form = this.form.wall): void {
    this.take(this.adopt(this.kit.walls[form]({ width, height, seed: this.seed, detail: 'low' })), x, y, z, yaw);
  }

  /** A dark opening with two open shutters (louvred when asked) and a sill, on a wall plane facing local +Z. */
  window(x: number, y: number, z: number, yaw = 0, w = 0.9, h = 1.15, louvred = false): void {
    this.at(x, z, yaw, () => {
      this.bx(this.wood, DARK, w, h, 0.06, 0, y, 0.03);
      this.colored(this.colors.shutter, () => {
        for (const side of [-1, 1]) {
          const sx = side * (w * 0.75 + 0.03);
          this.box(w / 2, h, 0.05, sx, y, 0.06, this.wood);
          if (louvred) for (let i = 0; i < 4; i++) this.box(w / 2 - 0.08, 0.05, 0.05, sx, y - h * 0.36 + i * h * 0.24, 0.1, this.wood);
        }
      });
      this.bx(this.wood, shade(this.colors.trim, 0.05), w + 0.22, 0.07, 0.14, 0, y - h / 2 - 0.04, 0.07);
    });
  }

  door(x: number, y: number, z: number, yaw = 0, w = 1, h = 2.05): void {
    this.at(x, z, yaw, () => {
      this.bx(this.wood, 0x3c2b1f, w, h, 0.07, 0, y + h / 2, 0.035);
      this.bx(this.wood, this.colors.trim, w + 0.24, 0.14, 0.1, 0, y + h + 0.07, 0.05);
    });
  }

  /** Solid steps from a floor at z down toward +Z, with handrails when high; returns where they end. */
  stairs(width: number, height: number, x: number, z: number, material: Material = this.wood, color = this.timber): number {
    const n = Math.max(2, Math.ceil(height / 0.22)), run = 0.28, end = z + run * (n - 1);
    this.colored(color, () => {
      for (let i = 0; i < n - 1; i++) {
        const h = height * (n - 1 - i) / n;
        this.box(width, h, run, x, h / 2, z + run * (i + 0.5), material);
      }
    });
    if (height > 0.7) this.colored(this.timber, () => {
      for (const side of [-1, 1]) {
        const rx = x + side * (width / 2 + 0.04), foot = end - 0.08;
        this.box(0.11, 1, 0.11, rx, 0.5, foot, this.wood);
        this.pole(point(rx, height + 0.9, z), point(rx, 0.95, foot), 0.035, this.wood, 4);
        for (const t of [0.3, 0.6]) {
          const bz = z + (foot - z) * t, step = height * (1 - t);
          this.box(0.05, 0.86, 0.05, rx, step + 0.43, bz, this.wood);
        }
      }
    });
    return end;
  }

  posts(w: number, d: number, height: number, step = 2.6, size = 0.2): void {
    this.colored(shade(this.timber, -0.06), () => {
      for (const x of spread(w, step)) for (const z of spread(d, step)) this.box(size, height, size, x, height / 2, z, this.wood);
    });
  }

  /** Railing across a terrace front at z, open in the middle for the steps. */
  railing(w: number, y: number, z: number, fret = this.form.fret): void {
    const half = (w - 1.5) / 2;
    if (half < 0.4) return;
    for (const side of [-1, 1]) {
      const x = side * (0.75 + half / 2);
      if (fret) {
        this.take(this.adopt(this.kit.ornaments.fretwork({ width: half, height: 0.8, seed: this.seed, detail: 'low', color: this.colors.trim })), x, y, z);
      } else this.colored(this.timber, () => {
        this.box(half, 0.08, 0.08, x, y + 0.86, z, this.wood);
        this.box(half, 0.06, 0.06, x, y + 0.45, z, this.wood);
        for (const px of spread(half, 1.3, 0.04)) this.box(0.08, 0.86, 0.08, x + px, y + 0.43, z, this.wood);
      });
    }
  }

  /** A regional roof over a w × d body; twin splits the span into two parallel gables (Lanna). */
  roofOver(w: number, d: number, base: number, spec: RoofSpec = {}): void {
    const form = spec.civic ? this.kit.services.roofForm : spec.form ?? this.form.roof;
    // A hip roof always runs its ridge along the longer side.
    const ridgeX = form === 'hip' ? w > d : spec.ridge === 'x';
    const span = ridgeX ? d : w, length = ridgeX ? w : d;
    const overhang = spec.overhang ?? Math.min(0.6, this.kit.defaults.overhang), pitch = spec.pitch ?? this.kit.defaults.pitch;
    const pieces = spec.twin && form !== 'hip' ? [-span / 4, span / 4] : [0], pieceSpan = span / pieces.length;
    const options: RoofOptions = { baseY: base, seed: this.seed, material: form === 'flatParapet' ? 'concrete_weathered' : this.form.roofKey,
      ornaments: spec.ornaments ?? true, detail: 'low', overhang, pitch, trimColor: this.colors.trim };
    if (spec.brackets !== false && overhang >= 0.3 && form !== 'flatParapet') {
      this.brackets(w, d, base, form === 'hip' ? 'all' : ridgeX ? 'front' : 'side', overhang);
    }
    this.at(0, 0, ridgeX ? Math.PI / 2 : 0, () => {
      for (const offset of pieces) {
        const parts = spec.civic ? this.kit.services.roof([pieceSpan, length], options) : this.kit.roofs[form]([pieceSpan, length], options);
        this.take(this.adopt(parts), offset, 0, 0);
        if (spec.fill !== false) this.gableFill(form, pieceSpan, length, base, overhang, pitch, spec.fill ?? this.colors.wall, offset, !!spec.civic, spec.panels !== false);
      }
      if (pieces.length > 1) this.bx(this.wood, this.colors.trim, 0.32, 0.16, length + overhang * 2, 0, base + 0.08, 0);
    });
  }

  private gableFill(form: RoofForm, span: number, length: number, base: number, overhang: number, pitch: number,
    color: number, offset: number, civic: boolean, panels = true): void {
    if (form !== 'gable' && form !== 'layeredGable') return;
    const close = (vertices: Vector3[], side: number): void => this.colored(color, () =>
      this.panel(side > 0 ? vertices : [...vertices].reverse(), point(0, 0, side), 0.06, this.wood));
    const a = pitch * Math.PI / 180, low = Math.tan(form === 'layeredGable' ? Math.min(a, 0.45) : a);
    // The kit's civic crown closes its own gable; layered crowns still need the lower end closed.
    if (!civic || form === 'layeredGable') for (const side of [-1, 1]) {
      const z = side * (length / 2 - 0.02);
      close([point(offset - span / 2, base - 0.03, z), point(offset + span / 2, base - 0.03, z),
        point(offset + span / 2, base + low * overhang, z), point(offset, base + low * (span / 2 + overhang) - 0.1, z),
        point(offset - span / 2, base + low * overhang, z)], side);
      // Panelled gable (หน้าจั่วลูกฟัก): a tie beam and battens standing up to the roof line.
      if (!civic && panels && span >= 4) this.colored(this.colors.trim, () => {
        this.box(span, 0.12, 0.08, offset, base + 0.06, z + side * 0.05, this.wood);
        for (const t of [-0.3, -0.15, 0, 0.15, 0.3]) {
          const h = low * (span / 2 + overhang - Math.abs(t) * span) - 0.2;
          if (h > 0.3) this.box(0.07, h, 0.06, offset + t * span, base + h / 2, z + side * 0.05, this.wood);
        }
      });
    }
    if (form === 'layeredGable' && !civic) {
      const width = span + overhang * 2, upper = width * 0.73, deep = (length + overhang * 2) * 0.77, y = base + width * 0.19;
      const rise = upper / 2 * Math.tan(a);
      for (const side of [-1, 1]) {
        const z = side * (deep / 2 - 0.08);
        close([point(offset - upper / 2 + 0.07, y, z), point(offset + upper / 2 - 0.07, y, z), point(offset, y + rise - 0.07, z)], side);
      }
    }
  }

  /** Plain timber brackets under the eaves: 'front' along the ±Z walls, 'side' along ±X, or both. */
  brackets(w: number, d: number, top: number, eaves: 'front' | 'side' | 'all', overhang: number): void {
    const reach = overhang * 0.7;
    this.colored(shade(this.timber, 0.03), () => {
      if (eaves !== 'side') for (const x of spread(w, 1.9, 0.35)) for (const s of [-1, 1]) {
        this.pole(point(x, top - 0.6, s * d / 2), point(x, top - 0.02, s * (d / 2 + reach)), 0.045, this.wood, 4);
      }
      if (eaves !== 'front') for (const z of spread(d, 1.9, 0.35)) for (const s of [-1, 1]) {
        this.pole(point(s * w / 2, top - 0.6, z), point(s * (w / 2 + reach), top - 0.02, z), 0.045, this.wood, 4);
      }
    });
  }

  /** A shallow pent roof (กันสาด) on brackets over a wall facing local +Z at z; its high edge sits at y. */
  pentRoof(w: number, y: number, z: number, depth = 1): void {
    const pitch = 18, overhang = 0.1, rise = Math.tan(pitch * Math.PI / 180) * (depth + overhang * 2);
    const parts = this.kit.roofs.monoPitch([depth, w], { baseY: y - rise, seed: this.seed, material: this.form.roofKey, pitch,
      overhang, trimColor: this.colors.trim });
    this.at(0, z + depth / 2, Math.PI / 2, () => this.take(this.adopt(parts)));
    this.colored(shade(this.timber, 0.03), () => {
      for (const x of spread(w, 1.8, 0.3)) this.pole(point(x, y - 0.75, z), point(x, y - rise * 0.55, z + depth * 0.6), 0.04, this.wood, 4);
    });
  }

  /** A clay pot with a leafy plant. */
  potted(x: number, z: number, y = 0.06, scale = 1): void {
    this.colored(0xa45a3c, () => this.cylinder(0.2 * scale, 0.36 * scale, x, y + 0.18 * scale, z, this.paint, 8));
    const leaf = tint('foliage_tropical', regionalLeafColor(this.kit.id));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + x;
      this.leaf(point(x, y + 0.3 * scale, z), point(Math.cos(a) * 0.65, 1, Math.sin(a) * 0.65), 0.6 * scale, 0.24 * scale, leaf, a, 0.3);
    }
  }

  /** A post lantern; its glow is an anchor_light for the renderer. */
  lantern(x: number, z: number, height = 2.2, y = 0.06): void {
    this.bx(this.wood, DARK, 0.1, height, 0.1, x, y + height / 2, z);
    this.bx(this.paint, 0xf3e2b6, 0.3, 0.38, 0.3, x, y + height + 0.19, z);
    this.bx(this.wood, DARK, 0.44, 0.07, 0.44, x, y + height + 0.42, z);
    this.lights.push(new Vector3(x, y + height + 0.19, z).applyMatrix4(this.frame));
  }

  /** A white flagpole on a stone base flying the plain Thai national flag (MODEL_SPEC 6: government buildings). */
  flag(x: number, z: number, height = 9): void {
    this.bx(this.stone, STONE, 1, 0.35, 1, x, 0.175, z);
    this.bx(this.stone, shade(STONE, 0.04), 0.6, 0.2, 0.6, x, 0.45, z);
    this.colored(0xf2f0ea, () => {
      this.pole(point(x, 0.5, z), point(x, height, z), 0.065, this.paint, 8);
      this.ellipsoid(point(x, height + 0.09, z), point(0.12, 0.12, 0.12), this.paint, 6, 4);
    });
    let top = height - 0.2;
    for (const [color, h] of [[0xa51931, 0.25], [0xf4f5f8, 0.25], [0x2d2a4a, 0.5], [0xf4f5f8, 0.25], [0xa51931, 0.25]] as const) {
      const source = new PlaneGeometry(2.25, h, 8, 1), front = source.toNonIndexed(), p = front.getAttribute('position');
      source.dispose();
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 1.125) * 2.3) * 0.12);
      front.translate(x + 1.15, top - h / 2, z);
      const back = front.clone(), q = back.getAttribute('position');
      for (let i = 0; i < q.count; i += 3) {
        const a = point(q.getX(i + 1), q.getY(i + 1), q.getZ(i + 1));
        q.setXYZ(i + 1, q.getX(i + 2), q.getY(i + 2), q.getZ(i + 2)); q.setXYZ(i + 2, a.x, a.y, a.z);
      }
      front.computeVertexNormals(); back.computeVertexNormals();
      this.colored(color, () => { this.add(applyWorldUV(front, 1), this.paint); this.add(applyWorldUV(back, 1), this.paint); });
      top -= h;
    }
  }

  /** A parked saloon car facing local +Z, in the compound's own paint batch. */
  parkedCar(x: number, z: number, color: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, color, 1.74, 0.6, 4.3, 0, 0.66, 0);
      this.bx(this.paint, 0x2c3740, 1.54, 0.5, 2.15, 0, 1.2, -0.2);
      this.bx(this.paint, color, 1.6, 0.08, 1.8, 0, 1.49, -0.25);
      this.colored(0xf1ead2, () => { for (const s of [-1, 1]) this.box(0.34, 0.12, 0.04, s * 0.58, 0.78, 2.16, this.paint); });
      this.colored(0xb3302a, () => { for (const s of [-1, 1]) this.box(0.3, 0.1, 0.04, s * 0.6, 0.8, -2.16, this.paint); });
      this.colored(0x1f1f1f, () => {
        for (const sx of [-1, 1]) for (const sz of [-1.38, 1.38]) this.cylinder(0.33, 0.22, sx * 0.8, 0.33, sz, this.paint, 8, Math.PI / 2);
      });
    });
  }

  /** A parked motorbike facing local +Z. */
  parkedBike(x: number, z: number, color: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.colored(0x1f1f1f, () => { for (const dz of [-0.62, 0.62]) this.cylinder(0.28, 0.1, 0, 0.28, dz, this.paint, 8, Math.PI / 2); });
      this.bx(this.paint, color, 0.32, 0.3, 1.1, 0, 0.6, 0);
      this.bx(this.paint, 0x2a2a2a, 0.28, 0.1, 0.55, 0, 0.82, -0.2);
      this.colored(0x3a3a3a, () => {
        this.pole(point(0, 0.35, 0.6), point(0, 1.02, 0.45), 0.03, this.paint, 4);
        this.box(0.64, 0.05, 0.05, 0, 1.02, 0.45, this.paint);
      });
    });
  }

  /** A 1:8 ramp from a floor of the given height down toward +Z, with a handrail; returns where it ends. */
  ramp(width: number, height: number, x: number, z: number, rail = 1): number {
    const length = height * 8, edge = x + width / 2;
    this.colored(PAVING, () => this.panel([point(edge, 0.02, z), point(edge, 0.02, z + length), point(edge, height, z)], point(1, 0, 0), width, this.stone));
    this.colored(0xd9d6cc, () => {
      const rx = x + rail * (width / 2 + 0.05);
      this.pole(point(rx, height + 0.9, z), point(rx, 0.92, z + length), 0.035, this.paint, 4);
      for (const t of [0, 0.5, 1]) this.box(0.07, 0.9, 0.07, rx, height * (1 - t) + 0.45, z + length * t, this.paint);
    });
    return z + length;
  }

  /** An air-conditioner condenser on a wall facing local +Z (MODEL_SPEC 1: a Thai street detail). */
  condenser(x: number, y: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, 0xdedcd4, 0.82, 0.56, 0.3, 0, y, 0.17);
      this.bx(this.paint, 0x45494a, 0.42, 0.42, 0.02, -0.12, y, 0.33);
      this.bx(this.paint, 0x9a9c98, 0.86, 0.04, 0.34, 0, y - 0.3, 0.17);
    });
  }

  /** A band of windows on a plastered wall facing local +Z: glazing between piers, a sun shade and a sill. */
  windowBand(width: number, x: number, y: number, z: number, yaw = 0, h = 1.45, step = 2.1): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, 0x3e5462, width, h, 0.05, 0, y, 0.025);
      this.colored(shade(this.masonry, -0.04), () => {
        for (const px of spread(width, step, 0)) this.box(0.26, h + 0.06, 0.12, px, y, 0.06, this.paint);
      });
      this.bx(this.paint, shade(this.masonry, 0.03), width + 0.2, 0.09, 0.55, 0, y + h / 2 + 0.16, 0.27);
      this.bx(this.paint, shade(this.masonry, -0.07), width, 0.08, 0.14, 0, y - h / 2 - 0.06, 0.07);
    });
  }

  /** A shallow lean-to from under the eaves over a front terrace (Isan เกย, Mon veranda). */
  leanTo(w: number, depth: number, high: number, z: number, deck: number): void {
    const overhang = 0.25, pitch = 14, rise = Math.tan(pitch * Math.PI / 180) * (depth + overhang * 2), base = high - rise;
    const parts = this.kit.roofs.monoPitch([depth, w], { baseY: base, seed: this.seed, material: this.form.roofKey, pitch,
      overhang, trimColor: this.colors.trim });
    this.at(0, z + depth / 2, Math.PI / 2, () => this.take(this.adopt(parts)));
    const edge = base + rise * overhang / (depth + overhang * 2) - 0.06;
    this.colored(this.timber, () => {
      for (const x of spread(w, 2.6, 0.15)) this.box(0.15, edge - deck, 0.15, x, deck + (edge - deck) / 2, z + depth - 0.12, this.wood);
    });
  }

  /** A storey of regional walls (or plaster in the south) on a w × d plan from y. */
  storey(w: number, d: number, y: number, h: number, plaster = this.form.arcade, back = true): void {
    if (plaster) { this.bx(this.paint, this.masonry, w, h, d, 0, y + h / 2, 0); return; }
    this.bx(this.paint, shade(this.colors.wall, -0.12), w - 0.36, h, d - 0.36, 0, y + h / 2, 0);
    this.wallRun(w - 0.2, h, 0, y, d / 2 - 0.1);
    if (back) this.wallRun(w - 0.2, h, 0, y, -d / 2 + 0.1, Math.PI);
    for (const side of [-1, 1]) this.wallRun(d - 0.2, h, side * (w / 2 - 0.1), y, 0, side * Math.PI / 2);
    this.colored(this.timber, () => {
      for (const x of [-1, 1]) for (const z of back ? [-1, 1] : [1]) this.box(0.22, h, 0.22, x * (w / 2 - 0.1), y + h / 2, z * (d / 2 - 0.1), this.wood);
    });
  }

  plant(kind: string, x: number, z: number, height: number, radius: number, offset = 0): void {
    this.take(this.kit.gardenPlant(kind, { seed: this.seed + offset, height, radius, bark: this.wood }), x, 0.06, z);
  }

  /** A regional household prop from the kit, if this region has it. */
  prop(kind: string, x: number, z: number, scale = 1, yaw = 0, y = 0.06): void {
    const make = this.kit.props[kind];
    if (make) this.take(this.adopt(make({ seed: this.seed, detail: 'low' }), true), x, y, z, yaw, scale);
  }

  /** Regional species for garden trees, never the waterside ones. */
  species(i: number): string {
    const mix = this.kit.vegetation.filter(tree => !tree.nearWaterOnly && tree.placement !== 'rows');
    return mix[i % mix.length].id.slice(4);
  }
}
