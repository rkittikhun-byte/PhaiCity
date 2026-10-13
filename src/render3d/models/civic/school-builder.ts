/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The shared parts of the school compounds (การศึกษา, docs/SERVICES.md, RENDERER_SPEC 6H) on the civic 3×3: Thai
// classroom blocks (อาคารเรียน) with an open corridor along the classrooms on every floor, pitches, the flagpole of the
// morning assembly, canteens, playgrounds, gates and fences. Tier R2: the massing is the same in every region; the
// roof's form and finish (kit.houses.concrete), the plaster tint, the props and the trees come from the region kit
// (MODEL_SPEC 6A). No temple or palace ornament, no real school's name or emblem: fictional Thai signs and the plain
// national flag that a school flies at its morning assembly.

import { Color, Group, Material, Object3D, RingGeometry, Vector3 } from 'three';
import { point } from '../../regional/geometry.js';
import { getRegionKit } from '../../regional/index.js';
import type { RegionKit } from '../../regional/contracts.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV } from '../../util/geometry.js';
import { CivicBuilder, PAVING, STONE, shade, spread } from './builder.js';
import type { CivicForm } from './builder.js';
import type { ModelOptions } from '../registry.js';

/** School colours (สีประจำโรงเรียน) for the trim, railings and gate; the seed picks one. */
export const SCHOOL_ACCENTS = [0x7d2b2b, 0x2c4f86, 0x2f6a43, 0xb8582a, 0x5a3f78, 0x1f6f78] as const;
export const GLASS = 0x33454d;
export const FRAME = 0xeeede6;
export const DOOR = 0x5b3c29;
export const VENT = 0xb7b0a0;
export const LINE = 0xf3f1ea;
export const SAND = 0xd9c9a0;
export const STEEL = 0x6f7774;

/** A school's regional prop: Bo Sang umbrellas from the crafts class, the school's rice barn (ธนาคารข้าว), a spirit
 * house, a coastal school's fishing nets, Ratchaburi water jars, a southern dove-cage pole. */
export const SCHOOL_PROPS: Readonly<Record<string, string>> = { north: 'paper_umbrella', northeast: 'rice_barn',
  central: 'spirit_house', east: 'fishing_nets', west: 'dragon_jar', south: 'dove_cage_pole' };

/** A modern regional roof for the classroom blocks: the kit's concrete-house roof, never leaf thatch. */
function schoolForm(kit: RegionKit): Partial<CivicForm> {
  const modern = kit.houses.concrete;
  return { roof: modern.roof, roofKey: modern.roofMaterial.startsWith('thatch') ? 'roof_cement_tile' : modern.roofMaterial };
}

export interface BlockSpec {
  /** Classrooms on each floor */
  rooms: number;
  /** A classroom's width along the block, metres (default 7) */
  room?: number;
  storeys: number;
  /** Classroom depth (default 6.4) and the open corridor in front of them (default 2.2) */
  body?: number;
  corridor?: number;
  /** An open stairwell at the −X (−1) or +X (1) end */
  stair?: -1 | 0 | 1;
  /** Floor to floor (default 3.4) and the plinth (default 0.45) */
  floor?: number;
  plinth?: number;
  /** The ground floor left open on columns (ใต้ถุนโล่ง), e.g. for the canteen's tables */
  open?: boolean;
  /** A colour for each classroom's walls (a kindergarten's), else the school's plaster */
  roomColors?: readonly number[];
  /** The building's name on its front eave beam */
  sign?: string;
  /** The kit's civic crown (kit.services.roof) instead of the modern house roof */
  civic?: boolean;
}

export interface ClassroomBlock { width: number; depth: number; top: number; floors: number[] }

/** Batches a school compound like the civic builder (timber, plaster, stone, one roof, grass, leaves, one sign atlas),
 * plus painted steel for railings, goals and play equipment. */
export class SchoolBuilder extends CivicBuilder {
  /** Classroom walls: the region's plaster washed toward school cream */
  readonly wall: number;
  /** The school's colour */
  readonly accent: number;
  /** Seeded choices that never change the massing: names, colours, small props */
  readonly pick: () => number;
  /** The classroom blocks built, for the massing checks (MODEL_SPEC 6A, R2) */
  readonly blocks: ClassroomBlock[] = [];
  /** Painted steel: railings, goals, play equipment, sheet roofs. A campus with a pond paints them on plaster instead,
   * to keep its water within eight draw calls. */
  steel: Material = this.metal;

  constructor(options: ModelOptions) {
    super(options, schoolForm(getRegionKit(options.region)));
    this.pick = seededRng((Math.imul(this.seed, 0x2c1b3c6d) ^ 0x51ed270b) >>> 0);
    this.wall = new Color(this.kit.palette.pick(this.seed, 'plaster').wall).lerp(new Color(0xf5edd3), 0.6).getHex();
    this.accent = SCHOOL_ACCENTS[Math.floor(this.pick() * SCHOOL_ACCENTS.length)];
  }

  /** One of the given names, by seed. */
  choose<T>(list: readonly T[]): T { return list[Math.floor(this.pick() * list.length)]; }

  /** A flat panel facing local +Z (two triangles): glazing, doors, vents, painted signs. */
  quad(w: number, h: number, x: number, y: number, z: number, color: number, material = this.paint): void {
    this.colored(color, () => this.face([point(x - w / 2, y - h / 2, z), point(x + w / 2, y - h / 2, z),
      point(x + w / 2, y + h / 2, z), point(x - w / 2, y + h / 2, z)], material));
  }

  /** A flat panel lying on the ground at height y: painted lines, mats, beds. */
  flat(w: number, d: number, x: number, z: number, y: number, color: number, material = this.paint): void {
    this.colored(color, () => this.face([point(x - w / 2, y, z + d / 2), point(x + w / 2, y, z + d / 2),
      point(x + w / 2, y, z - d / 2), point(x - w / 2, y, z - d / 2)], material));
  }

  /** A thin slab through a flat outline (flights, chutes), wound so its top faces up whatever the order given. */
  slab(vertices: readonly Vector3[], thickness: number, material: Material = this.stone): void {
    const normal = new Vector3().subVectors(vertices[1], vertices[0]).cross(new Vector3().subVectors(vertices[2], vertices[0])).normalize();
    const up = normal.y >= 0;
    this.panel(up ? vertices : [...vertices].reverse(), up ? normal : normal.negate(), thickness, material);
  }

  /** Any flat convex outline on the ground, wound to face up. */
  private flatOutline(points: readonly Vector3[], color: number, material = this.paint): void {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      area += a.x * b.z - b.x * a.z;
    }
    // Seen from above (+Y), x right and z down: a negative shoelace sum is counterclockwise.
    this.colored(color, () => this.face(area < 0 ? points : [...points].reverse(), material));
  }

  /** A row of classroom windows on a wall facing local +Z at z: dark glazing, aluminium mullions and a transom, a sill. */
  glazing(width: number, height: number, x: number, y: number, z: number, step = 1.1): void {
    this.quad(width, height, x, y, z + 0.02, GLASS);
    for (const px of spread(width, step, 0)) this.quad(0.07, height, x + px, y, z + 0.035, FRAME);
    this.quad(width, 0.06, x, y + height * 0.22, z + 0.036, FRAME);
    this.bx(this.paint, FRAME, width + 0.12, 0.07, 0.16, x, y - height / 2 - 0.035, z + 0.08);
  }

  /** A Thai classroom block (อาคารเรียน) in the local frame, front +Z: classrooms in a plastered concrete frame, an open
   * corridor with a parapet in front of them on every floor, an open stairwell at one end, the region's roof over the
   * whole. The block's size never depends on the region or the seed. */
  classroomBlock(spec: BlockSpec): ClassroomBlock {
    const room = spec.room ?? 7, n = spec.storeys, h = spec.floor ?? 3.4, p = spec.plinth ?? 0.45;
    const body = spec.body ?? 6.4, c = spec.corridor ?? 2.2, sw = spec.stair ? 3.2 : 0;
    const rooms = spec.rooms * room, width = rooms + sw, depth = body + c, top = p + n * h;
    const back = -depth / 2, face = back + body, edge = depth / 2;
    const rx = spec.stair === -1 ? sw / 2 : spec.stair === 1 ? -sw / 2 : 0;
    const floors = Array.from({ length: n }, (_, i) => p + i * h), from = spec.open ? p + h : p;
    this.bx(this.stone, STONE, width + 0.4, p, depth + 0.4, 0, p / 2, 0);
    if (spec.roomColors?.length) for (let r = 0; r < spec.rooms; r++) {
      this.bx(this.paint, spec.roomColors[r % spec.roomColors.length], room, top - from, body, rx - rooms / 2 + room * (r + 0.5), (top + from) / 2, back + body / 2);
    } else this.bx(this.paint, this.wall, rooms, top - from, body, rx, (top + from) / 2, back + body / 2);
    this.colored(shade(this.wall, -0.08), () => {
      for (const y of floors.slice(1)) this.box(rooms + 0.08, 0.24, body + 0.08, rx, y - 0.02, back + body / 2, this.paint);
    });
    this.colored(shade(STONE, 0.03), () => {
      for (const y of floors.slice(1)) this.box(width, 0.22, c, 0, y - 0.11, face + c / 2, this.stone);
    });
    // The ring beam under the eaves, in the school's colour
    this.bx(this.paint, this.accent, width + 0.1, 0.34, depth + 0.1, 0, top - 0.17, 0);
    for (const y of floors.slice(1)) {
      this.bx(this.paint, this.wall, width, 0.9, 0.14, 0, y + 0.45, edge - 0.07);
      this.bx(this.paint, this.accent, width + 0.04, 0.08, 0.24, 0, y + 0.94, edge - 0.07);
    }
    this.colored(shade(this.wall, 0.04), () => {
      for (const x of spread(width, 4, 0.16)) this.box(0.32, top - p, 0.32, x, (top + p) / 2, edge - 0.16, this.paint);
      if (spec.open) for (const x of spread(rooms, 4, 0.16)) this.box(0.32, h, 0.32, rx + x, p + h / 2, back + 0.16, this.paint);
    });
    for (const [i, y] of floors.entries()) {
      if (spec.open && i === 0) continue;
      for (let r = 0; r < spec.rooms; r++) {
        const x = rx - rooms / 2 + room * (r + 0.5);
        for (const s of [-1, 1]) this.quad(0.95, 2.1, x + s * (room / 2 - 0.9), y + 1.05, face + 0.02, DOOR);
        this.glazing(room - 3.6, 1.15, x, y + 1.45, face, 1.05);
        this.quad(room - 0.6, 0.32, x, y + 2.78, face + 0.02, VENT);
      }
      this.at(rx, back, Math.PI, () => this.glazing(rooms - 0.8, 1.5, 0, y + 1.55, 0, 1.4));
      this.bx(this.paint, shade(this.wall, -0.04), rooms, 0.08, 0.6, rx, y + 2.45, back - 0.3);
      for (const s of [-1, 1]) if (spec.stair !== s) {
        this.at(rx + s * rooms / 2, back + body / 2, s * Math.PI / 2, () => this.glazing(2.6, 1.2, 0, y + 1.5, 0, 0.9));
      }
    }
    if (spec.stair) this.stairwell(spec.stair * (width / 2 - sw / 2), spec.stair, sw, back, edge, floors, h, top);
    if (spec.sign) this.label(spec.sign, Math.min(4.2, width * 0.3), 0.3, rx, top - 0.17, edge + 0.08, 0, 0xf4efe0, 0x3a2a1c);
    this.roofOver(width, depth, top, { ridge: 'x', civic: spec.civic, pitch: Math.min(spec.civic ? 34 : 28, this.kit.defaults.pitch),
      overhang: 0.7, fill: this.wall, brackets: false, panels: false });
    const block = { width, depth, top, floors };
    this.blocks.push(block);
    return block;
  }

  /** The open stairwell at the block's end: a back wall, a perforated outer wall, two flights and a landing a floor. */
  private stairwell(x: number, side: number, sw: number, back: number, edge: number, floors: readonly number[], h: number, top: number): void {
    const p = floors[0], outer = x + side * (sw / 2 - 0.1);
    this.bx(this.paint, this.wall, sw, top - p, 0.2, x, (top + p) / 2, back + 0.1);
    this.bx(this.paint, this.wall, 0.2, top - p, edge - back - 0.3, outer, (top + p) / 2, (back + edge - 0.3) / 2);
    for (const y of floors) this.at(outer, (back + edge) / 2, side * Math.PI / 2, () => this.quad(4, 1.6, 0, y + 1.7, 0.11, VENT));
    const front = edge - 0.4, run = 2.8, half = sw / 2 - 0.1;
    // Each flight is a sloping slab; a steel handrail runs along the well between the two flights.
    const flight = (x0: number, x1: number, y0: number, z0: number, y1: number, z1: number): void => {
      this.colored(shade(STONE, -0.04), () => this.slab([point(x0, y0, z0), point(x1, y0, z0), point(x1, y1, z1), point(x0, y1, z1)], 0.18));
      this.colored(this.accent, () => this.pole(point(x, y0 + 0.9, z0), point(x, y1 + 0.9, z1), 0.03, this.steel, 4));
    };
    for (let i = 0; i < floors.length - 1; i++) {
      const y = floors[i], mid = y + h / 2, landing = front - run;
      flight(x + side * 0.05, x + side * half, y, front, mid, landing);
      this.bx(this.stone, shade(STONE, -0.02), sw - 0.2, 0.18, 1.3, x, mid - 0.09, landing - 0.65);
      flight(x - side * half, x - side * 0.05, mid, landing, floors[i + 1], front);
    }
  }

  /** A low-pitched sheet-metal gable (canteens, sheds) over w × d with its ridge along X, eaves at y. */
  sheetRoof(w: number, d: number, y: number, rise: number, color: number): void {
    this.colored(color, () => {
      this.panel([point(-w / 2, y, d / 2), point(w / 2, y, d / 2), point(w / 2, y + rise, 0), point(-w / 2, y + rise, 0)],
        point(0, d / 2, rise).normalize(), 0.05, this.steel);
      this.panel([point(w / 2, y, -d / 2), point(-w / 2, y, -d / 2), point(-w / 2, y + rise, 0), point(w / 2, y + rise, 0)],
        point(0, d / 2, -rise).normalize(), 0.05, this.steel);
      this.box(w, 0.1, 0.3, 0, y + rise + 0.02, 0, this.steel);
    });
  }

  /** A single sheet sloping down toward +Z (sheds, the drinking-water stand), high edge at the back. */
  leanSheet(w: number, d: number, low: number, high: number, color: number): void {
    this.colored(color, () => this.panel([point(-w / 2, low, d / 2), point(w / 2, low, d / 2), point(w / 2, high, -d / 2),
      point(-w / 2, high, -d / 2)], point(0, d, high - low).normalize(), 0.05, this.steel));
  }

  /** A football pitch (สนามฟุตบอล) w × d, its length along local X: the white lines and two goals. */
  pitch(w: number, d: number): void {
    const y = 0.072, t = 0.08, line = (lw: number, ld: number, x: number, z: number): void => this.flat(lw, ld, x, z, y, LINE);
    line(w, t, 0, -d / 2); line(w, t, 0, d / 2); line(t, d, -w / 2, 0); line(t, d, w / 2, 0); line(t, d, 0, 0);
    const ring = new RingGeometry(d * 0.15 - t / 2, d * 0.15 + t / 2, 24).rotateX(-Math.PI / 2).translate(0, y, 0);
    this.colored(LINE, () => this.add(applyWorldUV(ring, 1), this.paint)); ring.dispose();
    for (const s of [-1, 1]) {
      const bw = w * 0.13, bd = d * 0.5;
      line(t, bd, s * (w / 2 - bw), 0); line(bw, t, s * (w / 2 - bw / 2), -bd / 2); line(bw, t, s * (w / 2 - bw / 2), bd / 2);
      this.goal(s * (w / 2 + 0.05), 0, s, Math.min(3.6, d * 0.4));
    }
  }

  /** A goal on the pitch's end at local x, its mouth toward the pitch: white posts and bar, a net of a few cords. */
  goal(x: number, z: number, end: number, width = 3.6, height = 1.8): void {
    this.at(x, z, end > 0 ? -Math.PI / 2 : Math.PI / 2, () => {
      this.colored(LINE, () => {
        for (const s of [-1, 1]) this.box(0.1, height, 0.1, s * width / 2, height / 2, 0, this.steel);
        this.box(width + 0.1, 0.1, 0.1, 0, height, 0, this.steel);
      });
      this.colored(0xc9ccc8, () => {
        for (const s of [-1, 1]) this.pole(point(s * width / 2, height, 0), point(s * width / 2, 0.05, -1.1), 0.025, this.steel, 4);
        this.box(width, 0.04, 0.04, 0, 0.05, -1.1, this.steel);
        for (const t of [-0.25, 0, 0.25]) this.pole(point(t * width, height, 0), point(t * width, 0.05, -1.1), 0.012, this.steel, 3);
        this.pole(point(-width / 2, height * 0.5, -0.55), point(width / 2, height * 0.5, -0.55), 0.012, this.steel, 3);
      });
    });
  }

  /** A running track (ลู่วิ่ง) round a pitch: a stadium-shaped ring of red-brown surface and one white lane line. */
  track(straight: number, inner: number, width: number): void {
    const loop = (r: number): Vector3[] => {
      const out: Vector3[] = [];
      for (const s of [1, -1]) for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + i / 8 * Math.PI;
        out.push(point(s * (straight / 2 + Math.cos(a) * r), 0, s * Math.sin(a) * r));
      }
      return out;
    };
    const ring = (r0: number, r1: number, y: number, color: number, material = this.stone): void => {
      const a = loop(r0), b = loop(r1);
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        this.flatOutline([a[i], a[j], b[j], b[i]].map(v => v.clone().setY(y)), color, material);
      }
    };
    ring(inner, inner + width, 0.07, 0xa4553f);
    ring(inner + width * 0.5 - 0.035, inner + width * 0.5 + 0.035, 0.08, LINE, this.paint);
    ring(inner - 0.05, inner + 0.03, 0.08, LINE, this.paint);
  }

  /** A raised flagpole platform (ลานเสาธง) with three steps, the plain national flag on the pole. */
  assemblyFlag(x: number, z: number, height = 9): void {
    this.bx(this.stone, shade(STONE, -0.05), 2.2, 0.16, 2.2, x, 0.08, z);
    this.bx(this.stone, STONE, 1.5, 0.16, 1.5, x, 0.24, z);
    this.flag(x, z, height);
  }

  /** An open-sided canteen (โรงอาหาร) w × d, front +Z: steel posts, a sheet-metal gable, long tables with benches, a
   * serving counter with pots at the back and the sign on the front beam. */
  canteen(w: number, d: number, sign = 'โรงอาหาร'): void {
    const h = 3.1;
    this.bx(this.stone, PAVING, w, 0.15, d, 0, 0.075, 0);
    this.colored(STEEL, () => {
      for (const x of spread(w, 3.4, 0.12)) for (const s of [-1, 1]) this.box(0.16, h, 0.16, x, 0.15 + h / 2, s * (d / 2 - 0.12), this.steel);
      for (const s of [-1, 1]) this.box(w, 0.22, 0.12, 0, 0.15 + h - 0.11, s * (d / 2 - 0.12), this.steel);
    });
    this.sheetRoof(w + 0.8, d + 0.9, 0.15 + h, Math.min(1.2, d * 0.18), 0x8e3b2c);
    this.tables(w - 0.8, d - 1.6, 0.15, 0.6);
    this.servery(Math.min(w - 1, 5), -d / 2 + 0.55, 0.15);
    this.label(sign, 2.2, 0.36, 0, 0.15 + h - 0.11, d / 2 - 0.04, 0, 0xf4efe0, 0x3a2a1c);
  }

  /** Canteen tables (stainless tops, benches in the school's colour) filling a w × d area from its front (+Z), at y. */
  tables(w: number, d: number, y = 0.15, z = 0): void {
    const rows = Math.max(1, Math.floor(d / 1.9)), cols = Math.max(1, Math.floor(w / 2.9));
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = -w / 2 + (k + 0.5) * w / cols, tz = z + d / 2 - 0.95 - r * 1.9;
      this.bx(this.paint, 0xd6d9d6, 2.2, 0.06, 0.72, x, y + 0.75, tz);
      this.bx(this.paint, 0x8a8f8c, 0.5, 0.72, 0.3, x, y + 0.36, tz);
      this.colored(this.accent, () => { for (const s of [-1, 1]) this.box(2.2, 0.06, 0.28, x, y + 0.45, tz + s * 0.58, this.paint); });
    }
  }

  /** A serving counter (ร้านค้าในโรงอาหาร) with three pots, along X at z, standing on a floor at y. */
  servery(w: number, z: number, y = 0.15): void {
    this.bx(this.stone, 0xcfcbc1, w, 0.9, 0.6, 0, y + 0.45, z);
    this.bx(this.paint, 0xd6d9d6, w + 0.1, 0.05, 0.7, 0, y + 0.93, z);
    this.colored(0xb8bcbb, () => { for (const x of [-w * 0.28, 0, w * 0.28]) this.cylinder(0.26, 0.34, x, y + 1.13, z, this.paint, 8); });
  }

  /** A drinking-water point (จุดบริการน้ำดื่ม): a tiled trough on a low wall, a row of taps, a filter tank, a sheet roof. */
  drinkingWater(): void {
    this.bx(this.stone, 0xc9c6bd, 2.6, 0.75, 0.55, 0, 0.375, 0);
    this.bx(this.paint, 0x9fc3c9, 2.4, 0.06, 0.4, 0, 0.78, 0);
    this.bx(this.paint, this.wall, 2.6, 1.1, 0.14, 0, 1.3, -0.22);
    this.colored(0xc8ccc9, () => {
      this.box(2.2, 0.05, 0.05, 0, 1.12, -0.1, this.steel);
      for (const x of spread(2, 0.5, 0)) this.box(0.05, 0.16, 0.12, x, 1.05, -0.04, this.steel);
    });
    this.colored(0x3b7fb0, () => this.cylinder(0.3, 1.1, 1.75, 0.61, -0.05, this.paint, 10));
    this.colored(STEEL, () => { for (const s of [-1, 1]) for (const z of [-0.35, 0.6]) this.box(0.08, 2.4, 0.08, s * 1.3, 1.2, z, this.steel); });
    this.leanSheet(3.2, 1.6, 2.3, 2.55, 0x3d6f8f);
    this.label('น้ำดื่ม', 1, 0.3, -0.6, 1.62, -0.14, 0, 0x2f6f9a, 0xffffff);
  }

  /** A pupil's bicycle, parked facing local −Z. */
  bicycle(x: number, z: number, color: number, yaw = Math.PI): void {
    this.at(x, z, yaw, () => {
      this.colored(0x272727, () => { for (const dz of [-0.5, 0.5]) this.cylinder(0.32, 0.04, 0, 0.34, dz, this.steel, 6, Math.PI / 2); });
      this.colored(color, () => {
        this.pole(point(0, 0.36, -0.48), point(0, 0.8, 0.12), 0.025, this.steel, 3);
        this.pole(point(0, 0.8, -0.3), point(0, 0.8, 0.42), 0.025, this.steel, 3);
      });
      this.bx(this.steel, 0x222222, 0.12, 0.05, 0.26, 0, 0.88, -0.3);
      this.bx(this.steel, 0x777777, 0.5, 0.03, 0.03, 0, 0.98, 0.42);
    });
  }

  /** A parking shed (โรงจอดรถ) w wide and 2.6 deep, front +Z, with motorbikes and bicycles nose in. */
  bikeShed(w: number, bikes: number, bicycles: number): void {
    this.bx(this.stone, PAVING, w, 0.1, 2.8, 0, 0.05, 0);
    this.colored(STEEL, () => { for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) for (const z of [-1.2, 1.2]) this.box(0.1, 2.5, 0.1, x, 1.25, z, this.steel); });
    this.leanSheet(w + 0.4, 3.1, 2.2, 2.6, 0x7f8a88);
    const n = bikes + bicycles, colors = [0xb33a2e, 0x2f5f8a, 0x2a2a2a, 0xd8d4c8, 0x5b7f3b];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n, color = colors[(i + this.seed) % colors.length];
      if (i < bikes) this.parkedBike(x, -0.1, color, Math.PI);
      else this.bicycle(x, -0.2, color);
    }
  }

  /** A slide (กระดานลื่น): a platform on posts, a ladder at the back and a chute toward local +Z. */
  slide(height = 1.5, color = 0xd8493a): void {
    this.colored(0xe9b93a, () => {
      for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) this.box(0.09, height + 0.9, 0.09, x, (height + 0.9) / 2, z, this.steel);
      this.box(1, 0.08, 1, 0, height, 0, this.steel);
    });
    this.colored(0x2f6fb0, () => {
      for (const x of [-0.3, 0.3]) this.pole(point(x, 0.02, -1.2), point(x, height + 0.4, -0.5), 0.035, this.steel, 4);
      for (let i = 1; i < 4; i++) this.box(0.6, 0.04, 0.04, 0, i / 4 * (height + 0.4), -1.2 + i / 4 * 0.7, this.steel);
    });
    const end = 0.5 + height * 1.6;
    this.colored(color, () => {
      this.slab([point(-0.32, height, 0.5), point(0.32, height, 0.5), point(0.32, 0.25, end), point(-0.32, 0.25, end)], 0.05, this.paint);
      for (const s of [-1, 1]) this.pole(point(s * 0.34, height + 0.2, 0.5), point(s * 0.34, 0.45, end), 0.03, this.paint, 4);
    });
  }

  /** A swing frame (ชิงช้า) along local X with two seats. */
  swings(width = 2.6, height = 2.1): void {
    this.colored(0x3f8f5a, () => {
      for (const s of [-1, 1]) for (const d of [-1, 1]) this.pole(point(s * width / 2, 0.05, d * 0.7), point(s * width / 2, height, 0), 0.04, this.steel, 4);
      this.box(width + 0.1, 0.08, 0.08, 0, height, 0, this.steel);
    });
    for (const x of [-width / 4, width / 4]) {
      this.colored(0x9a9e9a, () => { for (const s of [-1, 1]) this.box(0.02, height - 0.5, 0.02, x + s * 0.22, 0.5 + (height - 0.5) / 2, 0, this.steel); });
      this.bx(this.paint, 0xe1b23c, 0.5, 0.05, 0.22, x, 0.5, 0);
    }
  }

  /** A seesaw (กระดานหก) along local X. */
  seesaw(color = 0x2f6fb0): void {
    this.bx(this.steel, 0xe9b93a, 0.2, 0.45, 0.3, 0, 0.225, 0);
    this.colored(color, () => this.box(3, 0.06, 0.28, 0, 0.5, 0, this.paint, 0.12));
    this.colored(0xd8493a, () => { for (const s of [-1, 1]) this.box(0.05, 0.3, 0.3, s * 1.3, 0.5 + s * 0.16 + 0.15, 0, this.steel); });
  }

  /** A climbing frame with monkey bars (ราวโหน) along local X. */
  climbingFrame(length = 2.6, height = 1.9): void {
    this.colored(0xd8493a, () => {
      for (const s of [-1, 1]) for (const z of [-0.4, 0.4]) this.box(0.07, height, 0.07, s * length / 2, height / 2, z, this.steel);
      for (const z of [-0.4, 0.4]) this.box(length, 0.06, 0.06, 0, height, z, this.steel);
    });
    this.colored(0xe9b93a, () => { for (const x of spread(length, 0.45, 0.2)) this.box(0.04, 0.04, 0.8, x, height, 0, this.steel); });
  }

  /** A sand pit (บ่อทราย) with a low timber edge. */
  sandPit(w: number, d: number): void {
    this.bx(this.stone, SAND, w, 0.1, d, 0, 0.1, 0);
    this.colored(shade(this.timber, 0.08), () => {
      for (const s of [-1, 1]) {
        this.box(w + 0.2, 0.2, 0.12, 0, 0.12, s * (d / 2 + 0.04), this.wood);
        this.box(0.12, 0.2, d, s * (w / 2 + 0.04), 0.12, 0, this.wood);
      }
    });
  }

  /** The school gate (ประตูโรงเรียน) at local z on the front: two plastered pillars, a beam carrying the school's name
   * under a small regional roof, lanterns, and two sliding steel leaves standing open along the fence. */
  schoolGate(x: number, z: number, opening: number, name: string, roof = true): void {
    const half = opening / 2 + 0.35, h = 2.8;
    for (const s of [-1, 1]) {
      this.bx(this.paint, this.wall, 0.7, h, 0.7, x + s * half, h / 2, z);
      this.bx(this.paint, this.accent, 0.82, 0.16, 0.82, x + s * half, h + 0.08, z);
      this.lantern(x + s * half, z, 0.2, h + 0.16);
      this.at(x + s * (half + 0.45 + opening / 4), z - 0.35, 0, () => this.colored(this.accent, () => {
        const lw = opening / 2;
        for (const y of [0.15, 1.75]) this.box(lw, 0.07, 0.06, 0, y, 0, this.steel);
        for (const px of spread(lw, 0.45, 0.03)) this.box(0.04, 1.6, 0.04, px, 0.95, 0, this.steel);
      }));
    }
    this.bx(this.paint, this.accent, opening + 1.5, 0.5, 0.42, x, h - 0.15, z);
    this.label(name, opening + 1.1, 0.4, x, h - 0.15, z + 0.23, 0, 0xf4efe0, this.accent);
    if (roof) this.at(x, z, 0, () => this.roofOver(opening + 1.6, 1, h + 0.12, { overhang: 0.15, pitch: Math.min(32, this.kit.defaults.pitch),
      fill: this.accent, brackets: false, panels: false }));
  }

  /** The fence round the compound at ±e: concrete posts, a low wall and two steel rails in the school's colour; the front
   * leaves the gate's opening (gate pillars stand at gateX ± (opening / 2 + 0.35)). */
  schoolFence(gateX: number, opening: number, e = 14.1): void {
    const g0 = gateX - opening / 2 - 0.7, g1 = gateX + opening / 2 + 0.7;
    const run = (length: number, x: number, z: number, yaw: number): void => {
      if (length < 0.4) return;
      this.at(x, z, yaw, () => {
        this.bx(this.paint, this.wall, length, 0.55, 0.18, 0, 0.275, 0);
        this.colored(this.accent, () => { for (const y of [0.95, 1.5]) this.box(length, 0.05, 0.05, 0, y, 0, this.steel); });
        this.colored(shade(this.wall, -0.05), () => { for (const px of spread(length, 3.4, 0.12)) this.box(0.2, 1.65, 0.2, px, 0.825, 0, this.paint); });
      });
    };
    run(g0 + e, (g0 - e) / 2, e, 0);
    run(e - g1, (g1 + e) / 2, e, 0);
    run(2 * e, 0, -e, 0);
    for (const s of [-1, 1]) run(2 * e - 0.2, s * e, 0, Math.PI / 2);
  }

  /** A small rest pavilion (ศาลาพักร้อน) under the region's roof: a raised floor, four posts and benches. */
  sala(w = 3.2, d = 2.6): void {
    this.bx(this.stone, STONE, w + 0.2, 0.3, d + 0.2, 0, 0.15, 0);
    this.colored(this.timber, () => {
      for (const x of [-1, 1]) for (const z of [-1, 1]) this.box(0.16, 2.4, 0.16, x * (w / 2 - 0.1), 1.5, z * (d / 2 - 0.1), this.wood);
      for (const s of [-1, 1]) this.box(w - 0.4, 0.06, 0.36, 0, 0.72, s * (d / 2 - 0.3), this.wood);
    });
    this.roofOver(w, d, 2.7, { ridge: 'x', overhang: 0.35, pitch: Math.min(38, this.kit.defaults.pitch), fill: this.colors.trim, brackets: false });
  }

  /** A guard booth (ป้อมยาม) at the gate. */
  guardBooth(): void {
    this.bx(this.stone, STONE, 1.9, 0.2, 1.9, 0, 0.1, 0);
    this.bx(this.paint, this.wall, 1.6, 2.3, 1.6, 0, 1.35, 0);
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2]) this.at(0, 0, yaw, () => this.glazing(1.1, 0.8, 0, 1.6, 0.8, 0.55));
    this.bx(this.paint, this.accent, 2.1, 0.16, 2.1, 0, 2.58, 0);
  }

  /** A basketball court (สนามบาสเกตบอล) w × d along local X: a painted slab, lines and two hoops. */
  court(w: number, d: number): void {
    this.bx(this.stone, 0x5f8b8f, w, 0.06, d, 0, 0.06, 0);
    const y = 0.1, t = 0.06;
    for (const s of [-1, 1]) { this.flat(w, t, 0, s * d / 2, y, LINE); this.flat(t, d, s * w / 2, 0, y, LINE); }
    this.flat(t, d, 0, 0, y, LINE);
    for (const s of [-1, 1]) {
      this.flat(w * 0.18, t, s * (w / 2 - w * 0.09), -d * 0.2, y, LINE);
      this.flat(w * 0.18, t, s * (w / 2 - w * 0.09), d * 0.2, y, LINE);
      this.flat(t, d * 0.4, s * (w / 2 - w * 0.18), 0, y, LINE);
      this.bx(this.steel, STEEL, 0.12, 3.05, 0.12, s * (w / 2 + 0.3), 1.6, 0);
      this.bx(this.paint, 0xf2f0ea, 0.06, 1, 1.6, s * (w / 2 + 0.1), 2.95, 0);
      this.bx(this.steel, 0xd8582a, 0.4, 0.03, 0.4, s * (w / 2 - 0.15), 2.7, 0);
    }
  }

  /** A garden tree of the region; a full one gets a second, offset crown (rain trees, shade trees). */
  shadeTree(i: number, x: number, z: number, height: number, radius: number, full = false): void {
    this.plant(this.species(i), x, z, height, radius, i + 11);
    if (full) this.plant(this.species(i), x + 0.25, z - 0.2, height * 0.82, radius * 0.85, i + 61);
  }

  hedge(x: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => this.take(this.kit.gardenPlant('hedge', { seed: this.seed + Math.round(x * 7 + z * 3) })));
  }

  /** The region's prop from the kit (SCHOOL_PROPS), in its own component. */
  regionalProp(x: number, z: number, yaw = 0): void {
    this.feature('regional-prop', () => this.prop(SCHOOL_PROPS[this.kit.id], x, z, 0.9, yaw + (this.kit.id === 'central' ? Math.PI : 0)));
  }

  /** A paved path on the ground between two z values, along local Z. */
  path(x: number, z0: number, z1: number, width: number, color = PAVING): void {
    if (z1 - z0 > 0.05) this.bx(this.stone, color, width, 0.05, z1 - z0, x, 0.085, (z0 + z1) / 2);
  }

  /** Closes the compound: the sign atlas, the lantern anchors (`anchor_light_<n>`) and the school's userData. */
  finishSchool(id: string, kind: string, metadata: Record<string, unknown>): Group {
    this.flushSigns();
    const root = this.finish(id, 'services', [3, 3], [], this.options);
    const anchors = (kind: string, points: readonly Vector3[]): void => points.forEach((at, i) => {
      const anchor = new Object3D();
      anchor.name = `anchor_${kind}_${i}`; anchor.position.copy(at); root.add(anchor);
    });
    anchors('light', this.lights);
    anchors('water', this.jets);
    Object.assign(root.userData, { regionTier: 'R2', kit: this.kit.id, kind, entranceFacing: '+Z', components: this.components,
      blocks: this.blocks.map(block => ({ ...block, floors: [...block.floors] })), roofForm: this.form.roof,
      roofMaterial: this.form.roofKey, accent: this.accent, wallColor: this.wall, ...metadata });
    return root;
  }
}
