/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Schools (การศึกษา, docs/SERVICES.md; owner, 13 Oct 2026) on the civic 3×3 (tiles 414–422), told apart by
// gameMap.civicKinds (RENDERER_SPEC 6H): a kindergarten round its playground, a primary and a secondary school with the
// flagpole of the morning assembly and a pitch, a vocational college with its workshops, a university campus round a
// lawn. Tier R2: the same buildings in every region, dressed by the region kit. The city view places them from
// civicKinds (src/render3d/city/tileModels.ts), so they register no tiles of their own. Front +Z: the gate.

import { CircleGeometry } from 'three';
import { TRIANGLE_BUDGETS } from '../../constants.js';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { PAVING, STONE, shade, spread } from './builder.js';
import { FRAME, GLASS, SchoolBuilder } from './school-builder.js';
import type { ModelOptions } from '../registry.js';

export const SCHOOL_KINDS = ['kindergarten', 'primary_school', 'secondary_school', 'vocational_college', 'university'] as const;
export type SchoolKind = typeof SCHOOL_KINDS[number];
export const schoolId = (kind: SchoolKind): string => `civic.${kind}`;
/** Triangle budgets (MODEL_SPEC 4): a 3×3 of low-rise buildings (≤ 4 floors) */
export const SCHOOL_BUDGETS: Readonly<Record<SchoolKind, number>> = {
  kindergarten: TRIANGLE_BUDGETS.lowRise, primary_school: TRIANGLE_BUDGETS.lowRise, secondary_school: TRIANGLE_BUDGETS.lowRise,
  vocational_college: TRIANGLE_BUDGETS.lowRise, university: TRIANGLE_BUDGETS.lowRise,
};

/** Fictional school names; the seed picks one. */
export const SCHOOL_NAMES: Readonly<Record<SchoolKind, readonly string[]>> = {
  kindergarten: ['โรงเรียนอนุบาลดอกแก้ว', 'โรงเรียนอนุบาลสายรุ้ง', 'โรงเรียนอนุบาลลูกเป็ดน้อย', 'ศูนย์พัฒนาเด็กเล็กบ้านสวน'],
  primary_school: ['โรงเรียนบ้านหนองน้ำใส', 'โรงเรียนบ้านโคกงาม', 'โรงเรียนชุมชนบ้านทุ่งทอง', 'โรงเรียนบ้านสวนใหม่'],
  secondary_school: ['โรงเรียนเมืองใหม่วิทยา', 'โรงเรียนทุ่งทองพิทยาคม', 'โรงเรียนริมน้ำวิทยาคาร', 'โรงเรียนสวนหลวงวิทยา'],
  vocational_college: ['วิทยาลัยการอาชีพเมืองใหม่', 'วิทยาลัยเทคนิคทุ่งทอง', 'วิทยาลัยการอาชีพริมน้ำ'],
  university: ['มหาวิทยาลัยเมืองใหม่', 'มหาวิทยาลัยทุ่งทอง', 'มหาวิทยาลัยลุ่มน้ำ'],
};

const LABELS: Readonly<Record<SchoolKind, readonly [string, string]>> = {
  kindergarten: ['โรงเรียนอนุบาล', 'Kindergarten'], primary_school: ['โรงเรียนประถมศึกษา', 'Primary school'],
  secondary_school: ['โรงเรียนมัธยมศึกษา', 'Secondary school'], vocational_college: ['วิทยาลัยอาชีวศึกษา', 'Vocational college'],
  university: ['มหาวิทยาลัย', 'University'],
};

/** Bright classroom walls for the kindergarten, in a seeded order. */
const KINDER_COLORS = [0xf3c84b, 0xf19ab0, 0x8cc8e8, 0x9bd38a, 0xf5a35c] as const;

function site(b: SchoolBuilder): void {
  b.feature('site', () => b.box(29, 0.06, 29, 0, 0.03, 0, b.grass));
}

/** A concrete ring seat round a shade tree (ม้านั่งรอบต้นไม้). */
function ringSeat(b: SchoolBuilder, i: number, x: number, z: number, height: number, radius: number): void {
  b.colored(STONE, () => b.cylinder(1.05, 0.45, x, 0.255, z, b.stone, 12));
  b.colored(shade(STONE, 0.05), () => b.cylinder(1.12, 0.06, x, 0.5, z, b.stone, 12));
  b.colored(0x6f5a43, () => b.cylinder(0.85, 0.05, x, 0.545, z, b.paint, 10));
  b.plant(b.species(i), x, z, height, radius, i + 11);
  b.plant(b.species(i), x + 0.3, z - 0.2, height * 0.85, radius * 0.85, i + 61);
}

function bench(b: SchoolBuilder, x: number, z: number, yaw = 0): void {
  b.at(x, z, yaw, () => b.colored(shade(b.timber, 0.05), () => {
    b.box(1.6, 0.07, 0.42, 0, 0.5, 0, b.wood);
    b.box(1.6, 0.36, 0.06, 0, 0.75, -0.2, b.wood);
    for (const s of [-1, 1]) b.box(0.07, 0.44, 0.4, s * 0.7, 0.28, 0, b.wood);
  }));
}

/** A spring rider (ม้าโยก) for small children: a bright body on a coil. */
function springRider(b: SchoolBuilder, x: number, z: number, color: number): void {
  b.colored(0x3b3b3b, () => b.cylinder(0.08, 0.5, x, 0.3, z, b.steel, 6));
  b.colored(color, () => {
    b.ellipsoid(point(x, 0.75, z), point(0.22, 0.22, 0.45), b.paint, 8, 5);
    b.ellipsoid(point(x, 1.02, z + 0.35), point(0.14, 0.16, 0.16), b.paint, 6, 4);
  });
  b.bx(b.steel, 0xe9b93a, 0.4, 0.04, 0.04, x, 1.05, z + 0.2);
}

/** A little play house (บ้านตุ๊กตา) with a door and a window and a sheet roof. */
function playHouse(b: SchoolBuilder, color: number): void {
  b.bx(b.paint, color, 1.6, 1.3, 1.4, 0, 0.7, 0);
  b.quad(0.55, 0.95, -0.35, 0.53, 0.71, 0x6b4a33);
  b.quad(0.45, 0.4, 0.4, 0.85, 0.71, GLASS);
  b.sheetRoof(1.9, 1.8, 1.35, 0.55, 0xd8493a);
}

// --- Kindergarten (โรงเรียนอนุบาล) ----------------------------------------------------------------------------------

function kindergarten(b: SchoolBuilder, name: string): void {
  const offset = Math.floor(b.pick() * KINDER_COLORS.length);
  const colors = KINDER_COLORS.map((_, i) => KINDER_COLORS[(i + offset) % KINDER_COLORS.length]);
  site(b);
  b.feature('classroom-block', () => b.at(-2.6, -9.5, 0, () => b.classroomBlock({ rooms: 3, room: 5.8, storeys: 1, body: 6,
    corridor: 2.4, floor: 3.3, roomColors: colors, sign: 'ห้องเรียนอนุบาล' })));
  b.feature('office', () => b.at(10.8, -9.4, 0, () => b.classroomBlock({ rooms: 1, room: 5, storeys: 1, body: 4.4, corridor: 1.8,
    floor: 3.1, sign: 'ห้องพยาบาล' })));
  b.feature('veranda', () => {
    b.bx(b.stone, PAVING, 26, 0.05, 1.4, 0, 0.085, -4.4);
    for (const x of [-10.6, -6.2, 1.2, 5.4]) b.potted(x, -4.2, 0.11, 0.9);
  });
  b.feature('flagpole', () => b.assemblyFlag(-10.4, -1.6, 7.5));
  b.feature('playground', () => b.at(7.2, 1.6, 0, () => {
    b.sandPit(13.2, 7.4);
    b.at(-4.6, -1.2, Math.PI / 2, () => b.slide(1.3, colors[1]));
    b.at(1.2, -2, 0, () => b.swings(2.6, 1.9));
    b.at(4.6, 1.4, Math.PI / 2, () => b.seesaw(colors[2]));
    b.at(-3.2, 2.3, 0, () => b.climbingFrame(2.4, 1.6));
    springRider(b, 0.4, 1.6, colors[3]); springRider(b, 1.8, 2.2, colors[4]);
  }));
  b.feature('play-house', () => b.at(-10.6, 3.2, Math.PI / 2, () => playHouse(b, colors[0])));
  b.feature('shade-tree', () => ringSeat(b, 0, -5.6, 2.4, 5.4, 1.5));
  b.feature('handwash', () => b.at(-11.2, 9.2, Math.PI / 2, () => b.drinkingWater()));
  b.feature('garden', () => {
    for (const x of [-7.4, -3.8]) b.hedge(x, 7.6);
    b.colored(0xd8628a, () => { for (let i = 0; i < 8; i++) b.box(0.22, 0.14, 0.22, -7.4 + i * 0.5, 0.2, 8.4 + (i % 2) * 0.25, b.paint); });
    bench(b, -5.6, 5.4, Math.PI);
  });
  b.feature('path', () => b.path(-1, -3.7, 14.1, 2.2));
  b.feature('parking', () => {
    b.bx(b.stone, PAVING, 5.4, 0.05, 2.6, 7.8, 0.085, 12.2);
    [5.8, 7.2, 8.6].forEach((x, i) => b.parkedBike(x, 12.2, [0xb33a2e, 0x2f5f8a, 0xd8d4c8][(i + b.seed) % 3], Math.PI));
  });
  b.feature('gate', () => b.schoolGate(-1, 13.75, 3.2, name));
  b.feature('fence', () => b.schoolFence(-1, 3.2));
  b.regionalProp(12.6, 12.4);
  b.feature('trees', () => {
    b.shadeTree(1, -12.9, -3, 4.6, 1); b.shadeTree(2, 12.9, 8.4, 4.6, 1); b.shadeTree(3, -12.8, 13, 4.2, 0.9);
  });
}

// --- Primary school (โรงเรียนประถมศึกษา) ------------------------------------------------------------------------------

function primary(b: SchoolBuilder, name: string): void {
  site(b);
  b.feature('classroom-block', () => b.at(-1.2, -9.2, 0, () => b.classroomBlock({ rooms: 3, storeys: 2, stair: 1, sign: 'อาคารเรียน ๑' })));
  b.feature('apron', () => b.bx(b.stone, PAVING, 24.2, 0.05, 1.2, -1.2, 0.085, -4.3));
  b.feature('assembly-yard', () => b.bx(b.stone, PAVING, 9.2, 0.05, 9.4, -9, 0.085, 1));
  b.feature('flagpole', () => b.assemblyFlag(-9.6, -1.6, 9));
  b.feature('pitch', () => b.at(4.6, 1.6, 0, () => b.pitch(15, 9)));
  b.feature('shade-tree', () => ringSeat(b, 0, -6.3, 2.6, 6, 1.6));
  b.feature('drinking-water', () => b.at(-11.4, 4.8, Math.PI, () => b.drinkingWater()));
  b.feature('canteen', () => b.at(-9.6, 10.4, 0, () => b.canteen(8, 5.5)));
  b.feature('path', () => b.path(-2.6, -3.7, 14.1, 2));
  b.feature('playground', () => b.at(4.6, 10.4, 0, () => {
    b.sandPit(6.8, 5.4);
    b.at(-2.3, -1.1, Math.PI / 2, () => b.slide(1.3));
    b.at(2, -1.3, 0, () => b.swings());
    b.at(1.5, 1.7, 0, () => b.seesaw());
    b.at(-1.9, 1.7, 0, () => b.climbingFrame());
  }));
  b.feature('bike-shed', () => b.at(11.4, 10.4, 0, () => b.bikeShed(4.4, 1, 3)));
  b.feature('gate', () => b.schoolGate(-2.6, 13.75, 3.6, name));
  b.feature('fence', () => b.schoolFence(-2.6, 3.6));
  b.regionalProp(-12.8, -2.9);
  b.feature('trees', () => {
    b.shadeTree(1, 12.7, -10.4, 6, 1.4, true); b.shadeTree(2, 12.9, -3.2, 5, 1.1); b.shadeTree(3, 13, 6.9, 4.6, 1);
  });
}

// --- Secondary school (โรงเรียนมัธยมศึกษา) ----------------------------------------------------------------------------

function secondary(b: SchoolBuilder, name: string): void {
  site(b);
  b.feature('classroom-block', () => b.at(1.6, -9.2, 0, () => b.classroomBlock({ rooms: 3, room: 6.6, storeys: 4, stair: -1, sign: 'อาคารเรียน ๑' })));
  // The second block's open ground floor is the canteen (โรงอาหารใต้อาคาร), classrooms above; its corridor faces the pitch.
  b.feature('canteen-block', () => b.at(-9.4, 4.6, Math.PI / 2, () => {
    const block = b.classroomBlock({ rooms: 2, room: 6.6, storeys: 2, stair: 1, open: true, sign: 'อาคาร ๒' });
    const back = -block.depth / 2, body = 6.4;
    b.at(-1.6, back + body / 2, 0, () => { b.tables(12.4, 4.2, 0.45, 0.8); b.servery(5, -2.6, 0.45); });
    b.label('โรงอาหาร', 2.4, 0.4, -1.6, block.floors[1] + 0.45, block.depth / 2 + 0.02, 0, 0xf4efe0, 0x3a2a1c);
  }));
  b.feature('apron', () => b.bx(b.stone, PAVING, 23, 0.05, 1.2, 1.6, 0.085, -4.3));
  b.feature('track', () => b.at(4.6, 4.2, 0, () => { b.track(7, 3.9, 1.5); b.pitch(10.6, 6); }));
  b.feature('flagpole', () => b.assemblyFlag(4.6, -3, 10));
  b.feature('drinking-water', () => b.at(10.6, -3.1, 0, () => b.drinkingWater()));
  b.feature('path', () => b.path(-1, 9.6, 14.1, 2.2));
  b.feature('guard-booth', () => b.at(3.4, 12.2, 0, () => b.guardBooth()));
  b.feature('bike-shed', () => b.at(9.8, 11.8, 0, () => b.bikeShed(6.6, 3, 3)));
  b.feature('gate', () => b.schoolGate(-1, 13.75, 4, name));
  b.feature('fence', () => b.schoolFence(-1, 4));
  b.regionalProp(-12.6, -13);
  b.feature('trees', () => {
    b.shadeTree(1, -12.2, -9.6, 6, 1.5, true); b.shadeTree(2, -12.4, -5.8, 4.8, 1);
    b.shadeTree(3, 13.3, 8.9, 4.8, 1); b.shadeTree(4, -3.4, 11, 4.4, 0.9);
  });
}

// --- Vocational college (วิทยาลัยการอาชีพ) ----------------------------------------------------------------------------

/** A workshop hall (โรงฝึกงาน) w × d, front +Z: a steel portal frame on a block wall with sheet cladding above, a
 * low sheet gable whose ridge runs front to back, a wide opening with its roller shutter rolled up, and its sign. */
function workshop(b: SchoolBuilder, w: number, d: number, h: number, door: number, sign: string): void {
  const clad = 0xc9cdc9, rise = w * 0.16;
  b.bx(b.stone, 0xb3b1aa, w, 0.15, d, 0, 0.075, 0);
  for (const s of [-1, 1]) {
    b.bx(b.paint, b.wall, 0.2, 1.2, d, s * (w / 2 - 0.1), 0.75, 0);
    b.bx(b.steel, clad, 0.08, h - 1.35, d, s * (w / 2 - 0.1), 1.35 + (h - 1.35) / 2, 0);
    b.at(s * (w / 2 + 0.01), 0, s * Math.PI / 2, () => b.quad(d - 1, 0.6, 0, h - 0.7, 0.02, GLASS));
  }
  b.bx(b.paint, b.wall, w, 1.2, 0.2, 0, 0.75, -d / 2 + 0.1);
  b.bx(b.steel, clad, w, h - 1.35, 0.08, 0, 1.35 + (h - 1.35) / 2, -d / 2 + 0.1);
  const pier = (w - door) / 2;
  for (const s of [-1, 1]) b.bx(b.steel, clad, pier, h, 0.08, s * (w / 2 - pier / 2), h / 2 + 0.15, d / 2 - 0.1);
  b.bx(b.steel, clad, door, 0.9, 0.08, 0, h - 0.3, d / 2 - 0.1);
  b.colored(0x9aa3a6, () => b.cylinder(0.28, door, 0, h - 1.0, d / 2 - 0.25, b.steel, 8, Math.PI / 2));
  b.colored(b.accent, () => {
    for (const z of spread(d, 3.2, 0.1)) for (const s of [-1, 1]) b.box(0.22, h, 0.22, s * (w / 2 - 0.3), h / 2 + 0.15, z, b.steel);
  });
  b.at(0, 0, Math.PI / 2, () => b.sheetRoof(d + 0.6, w + 0.6, h + 0.15, rise, 0x8a9696));
  for (const s of [-1, 1]) b.colored(clad, () => b.panel(
    s > 0 ? [point(-w / 2, h + 0.15, s * d / 2), point(w / 2, h + 0.15, s * d / 2), point(0, h + 0.15 + rise, s * d / 2)]
      : [point(w / 2, h + 0.15, s * d / 2), point(-w / 2, h + 0.15, s * d / 2), point(0, h + 0.15 + rise, s * d / 2)],
    point(0, 0, s), 0.06, b.steel));
  b.label(sign, Math.min(door, 3.6), 0.5, 0, h + 0.55, d / 2 + 0.02, 0, 0x2f5f8a, 0xffffff);
}

/** The motor workshop's floor: a two-post lift with a car raised on it, a pickup with its bonnet up, tyres, a tool chest. */
function motorShop(b: SchoolBuilder): void {
  b.colored(0x3d6fa8, () => { for (const s of [-1, 1]) b.box(0.32, 2.6, 0.32, s * 1.6, 1.45, -1.6, b.steel); });
  b.colored(0xe9b93a, () => { for (const s of [-1, 1]) for (const z of [-2.6, -0.6]) b.box(1.3, 0.08, 0.14, s * 1, 1.5, z, b.steel); });
  b.at(0, -1.6, 0, () => b.parkedCar(0, 0, 0xd8d4c8), 1.0);
  b.at(-0.2, 2.1, 0, () => {
    b.parkedCar(0, 0, 0x9a2c25);
    b.bx(b.paint, 0x2a2a2a, 1.4, 0.04, 1.1, 0, 0.97, 1.5);
    b.colored(0x9a2c25, () => b.slab([point(-0.76, 0.98, 0.95), point(0.76, 0.98, 0.95), point(0.76, 1.8, 1.4), point(-0.76, 1.8, 1.4)], 0.04, b.paint));
  });
  b.colored(0x232323, () => { for (let i = 0; i < 3; i++) b.cylinder(0.34, 0.22, 3, 0.26 + i * 0.23, 2.6, b.steel, 10); });
  b.bx(b.steel, 0xc23b2f, 0.9, 1.1, 0.5, -3.2, 0.7, 3);
}

/** The machine shop's floor: two lathes, a pillar drill, a welding bench behind a screen and a rack of steel stock. */
function machineShop(b: SchoolBuilder): void {
  for (const z of [-1.4, 1.2]) b.at(-1.4, z, 0, () => {
    b.bx(b.steel, 0x4d6f6a, 2.2, 0.3, 0.5, 0, 0.95, 0);
    b.bx(b.steel, 0x4d6f6a, 0.6, 0.55, 0.55, -0.9, 1.35, 0);
    b.colored(0x383d3c, () => { for (const s of [-1, 1]) b.box(0.3, 0.8, 0.4, s * 0.8, 0.55, 0, b.steel); });
  });
  b.colored(0x4d6f6a, () => { b.box(0.4, 0.1, 0.4, 1.4, 0.2, -2.6, b.steel); b.box(0.12, 1.7, 0.12, 1.4, 1.0, -2.75, b.steel); b.box(0.35, 0.4, 0.5, 1.4, 1.65, -2.6, b.steel); });
  b.bx(b.steel, 0x5a5f5e, 1.6, 0.9, 0.8, 2.2, 0.6, 0.6);
  b.bx(b.paint, 0x2f6b45, 0.05, 1.6, 1.4, 1.2, 0.95, 0.6);
  b.colored(0x7b4a2e, () => { for (const x of [-0.6, 0.6]) b.box(0.08, 1.4, 0.4, 2.4 + x, 0.85, 2.6, b.steel); });
  b.colored(0x8f9493, () => { for (let i = 0; i < 4; i++) b.box(1.6, 0.06, 0.06, 2.4, 0.5 + i * 0.25, 2.55 + (i % 2) * 0.1, b.steel); });
}

function vocational(b: SchoolBuilder, name: string): void {
  site(b);
  b.feature('classroom-block', () => b.at(-4.9, -9.2, 0, () => b.classroomBlock({ rooms: 2, storeys: 3, stair: -1, sign: 'อาคารเรียนและสำนักงาน' })));
  b.feature('motor-workshop', () => b.at(9.2, -9.2, 0, () => { workshop(b, 9, 9, 5.2, 5.2, 'แผนกช่างยนต์'); motorShop(b); }));
  b.feature('machine-workshop', () => b.at(9.2, 1.1, -Math.PI / 2, () => { workshop(b, 8, 9, 5, 4.6, 'แผนกช่างกลโรงงาน'); machineShop(b); }));
  b.feature('yard', () => b.bx(b.stone, 0xb9b6ad, 8.8, 0.05, 17.6, 0.2, 0.085, 4.5));
  b.feature('flagpole', () => b.assemblyFlag(-4.6, -3.2, 9.5));
  b.feature('court', () => b.at(-9.1, 3.2, 0, () => b.court(8.2, 5.2)));
  b.feature('canteen', () => b.at(-9.8, 10.8, 0, () => b.canteen(7.6, 4.6)));
  b.feature('guard-booth', () => b.at(-3.6, 12, 0, () => b.guardBooth()));
  b.feature('parking', () => { b.at(9.6, 11.4, 0, () => b.bikeShed(7, 4, 0)); b.parkedCar(5.4, 7.6, 0x5d6b4a, Math.PI); });
  b.feature('gate', () => b.schoolGate(0.8, 13.75, 4.4, name));
  b.feature('fence', () => b.schoolFence(0.8, 4.4));
  b.regionalProp(13, -3.9);
  b.feature('trees', () => { b.shadeTree(1, -12.6, -2.6, 5, 1); b.shadeTree(2, 13, 7.6, 4.6, 1); b.shadeTree(3, -4.4, 7.4, 4.4, 0.9); });
}

// --- University (มหาวิทยาลัย) -----------------------------------------------------------------------------------------

/** The great hall (หอประชุม) w × d, front +Z: a tall plastered hall on a high base, tall windows down its sides, a portico
 * of round columns carrying the university's name, wide steps, and the region's civic crown over it. */
function greatHall(b: SchoolBuilder, name: string): void {
  const w = 10, d = 7, p = 0.9, h = 7.6, pd = 2.4;
  b.bx(b.stone, STONE, w + 0.6, p, d + 0.6, 0, p / 2, 0);
  b.bx(b.paint, b.wall, w, h, d, 0, p + h / 2, 0);
  b.bx(b.paint, b.accent, w + 0.12, 0.4, d + 0.12, 0, p + h - 0.2, 0);
  for (const s of [-1, 1]) b.at(s * w / 2, 0, s * Math.PI / 2, () => {
    for (const z of [-2.2, 0, 2.2]) b.glazing(1.2, 4.6, z, p + 3.4, 0, 0.6);
  });
  b.at(0, -d / 2, Math.PI, () => { for (const x of [-3, 0, 3]) b.glazing(1.2, 4.2, x, p + 3.3, 0, 0.6); });
  // One crown over the hall and its portico
  b.at(0, pd / 2, 0, () => b.roofOver(w, d + pd, p + h, { civic: true, ridge: 'x', overhang: 0.5, pitch: Math.min(34, b.kit.defaults.pitch), brackets: false }));
  b.at(0, d / 2 + pd / 2, 0, () => {
    b.bx(b.stone, STONE, w, p, pd + 0.1, 0, p / 2, 0.05);
    b.colored(shade(b.wall, 0.04), () => {
      for (const x of spread(w - 0.6, 1.9, 0)) {
        b.cylinder(0.26, h - 0.5, x, p + (h - 0.5) / 2, pd / 2 - 0.35, b.paint, 10);
        b.box(0.62, 0.24, 0.62, x, p + 0.12, pd / 2 - 0.35, b.paint);
      }
    });
    b.bx(b.paint, b.wall, w, 0.6, pd, 0, p + h - 0.2, 0);
    b.label(name, 6.2, 0.46, 0, p + h - 0.2, pd / 2 + 0.03, 0, 0xf4efe0, b.accent);
    b.quad(2.6, 3, 0, p + 1.5, -pd / 2 + 0.03, 0x4b3324);
    for (const x of [-2.6, 2.6]) b.quad(1.4, 2.6, x, p + 1.3, -pd / 2 + 0.03, 0x4b3324);
    b.stairs(5, p, 0, pd / 2 + 0.05, b.stone, STONE);
  });
}

/** The library (หอสมุด) in the local frame, front +Z: a three-storey block with a glazed front between deep fins, an
 * entrance canopy, plain windows round the other sides and the region's roof. */
function library(b: SchoolBuilder, entrance: number): void {
  const w = 14, d = 7, p = 0.45, h = 3.6, n = 3, top = p + n * h;
  b.bx(b.stone, STONE, w + 0.4, p, d + 0.4, 0, p / 2, 0);
  b.bx(b.paint, b.wall, w, n * h, d, 0, p + n * h / 2, 0);
  b.quad(w - 2, n * h - 1, 0, p + n * h / 2 + 0.2, d / 2 + 0.02, GLASS);
  b.colored(FRAME, () => { for (let i = 1; i < n; i++) b.box(w - 2, 0.12, 0.12, 0, p + i * h, d / 2 + 0.08, b.paint); });
  b.colored(shade(b.wall, 0.03), () => { for (const x of spread(w - 2, 1.5, 0)) b.box(0.18, n * h - 0.6, 0.7, x, p + n * h / 2 + 0.1, d / 2 + 0.35, b.paint); });
  for (let i = 0; i < n; i++) {
    b.at(0, -d / 2, Math.PI, () => b.glazing(w - 2, 1.5, 0, p + i * h + 1.6, 0, 1.6));
    for (const s of [-1, 1]) b.at(s * w / 2, 0, s * Math.PI / 2, () => b.glazing(4, 1.5, 0, p + i * h + 1.6, 0, 1));
  }
  b.bx(b.paint, b.accent, w + 0.1, 0.36, d + 0.1, 0, top - 0.18, 0);
  b.bx(b.paint, shade(b.wall, -0.05), 5, 0.22, 1.4, entrance, p + 3.1, d / 2 + 0.7);
  b.colored(shade(b.wall, 0.04), () => { for (const s of [-1, 1]) b.box(0.24, 3.1, 0.24, entrance + s * 2.3, p + 1.55, d / 2 + 1.25, b.paint); });
  b.label('หอสมุด', 2.4, 0.42, entrance, p + 3.42, d / 2 + 1.42, 0, 0xf4efe0, 0x3a2a1c);
  b.bx(b.stone, STONE, 5, p, 1.45, entrance, p / 2, d / 2 + 0.72);
  b.stairs(3, p, entrance, d / 2 + 1.45, b.stone, STONE);
  b.roofOver(w, d, top, { ridge: 'x', overhang: 0.6, pitch: Math.min(26, b.kit.defaults.pitch), fill: b.wall, brackets: false, panels: false });
}

/** A round pond with a low stone kerb and a jet in the middle, at the crossing of the campus paths. */
function pond(b: SchoolBuilder, x: number, z: number, r: number): void {
  b.colored(PAVING, () => b.cylinder(r + 1.3, 0.05, x, 0.085, z, b.stone, 24));
  b.colored(STONE, () => b.cylinder(r + 0.2, 0.4, x, 0.2, z, b.stone, 20));
  const water = new CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(x, 0.36, z);
  b.add(applyWorldUV(water, 1), b.water()); water.dispose();
  b.colored(STONE, () => { b.cylinder(0.25, 0.9, x, 0.6, z, b.stone, 8); b.cylinder(0.6, 0.12, x, 1.1, z, b.stone, 12); });
  b.jets.push(point(x, 1.4, z));
}

function university(b: SchoolBuilder, name: string): void {
  b.steel = b.paint;
  site(b);
  b.feature('great-hall', () => b.at(0, -10.1, 0, () => greatHall(b, name)));
  // Its entrance faces the lawn, toward the front end of the block (local −X is world +Z)
  b.feature('library', () => b.at(-10.1, -6, Math.PI / 2, () => library(b, -4.5)));
  b.feature('classroom-block', () => b.at(9.7, -4.6, -Math.PI / 2, () => b.classroomBlock({ rooms: 2, storeys: 4, body: 5.6,
    corridor: 2, stair: 1, sign: 'อาคารเรียนรวม' })));
  b.feature('paths', () => {
    b.path(0, -4.2, 14.1, 2.6);
    b.bx(b.stone, PAVING, 11.6, 0.05, 2.2, 0, 0.085, 2.6);
  });
  b.feature('pond', () => pond(b, 0, 2.6, 1.6));
  b.feature('flagpole', () => b.assemblyFlag(-4, -2.4, 10));
  b.feature('lamps', () => { for (const z of [-1.2, 7.4]) for (const s of [-1, 1]) b.lantern(s * 1.8, z, 2.6); });
  b.feature('benches', () => { for (const s of [-1, 1]) for (const z of [0, 6.2]) bench(b, s * 3.6, z, -s * Math.PI / 2); });
  b.feature('sala', () => b.at(-10.4, 8.6, 0, () => b.sala(3.6, 2.8)));
  b.feature('parking', () => {
    b.bx(b.stone, 0x8f8d86, 6.2, 0.05, 5.2, 10, 0.085, 9.8);
    b.parkedCar(8.6, 9.8, 0xe8e6df, Math.PI); b.parkedCar(11.4, 9.8, 0x2b3f5a, Math.PI);
  });
  b.feature('gate', () => b.schoolGate(0, 13.75, 4.8, name, true));
  b.feature('fence', () => b.schoolFence(0, 4.8));
  b.regionalProp(-12.6, 12.6);
  b.feature('trees', () => {
    b.shadeTree(0, -4, 9.6, 6.4, 1.6); b.shadeTree(1, 4, 9.6, 6.4, 1.6);
    b.shadeTree(2, -4.2, 4.6, 5.2, 1.1); b.shadeTree(3, 4.2, 4.6, 5.2, 1.1);
    b.shadeTree(4, -12.4, 3.6, 5, 1.1); b.shadeTree(5, 12.6, 6, 5, 1);
  });
}

const LAYOUTS: Readonly<Record<SchoolKind, (b: SchoolBuilder, name: string) => void>> = {
  kindergarten, primary_school: primary, secondary_school: secondary, vocational_college: vocational, university,
};

/** civic.<kind>: one school compound; the seed picks its name, colours and small props, never its buildings. */
export function createSchool(kind: SchoolKind, options: ModelOptions = {}) {
  const b = new SchoolBuilder(options), name = b.choose(SCHOOL_NAMES[kind]);
  LAYOUTS[kind](b, name);
  return b.finishSchool(schoolId(kind), kind, {
    signText: name, building: kind, floors: Math.max(...b.blocks.map(block => block.floors.length)),
    variantLabel: LABELS[kind][0], variantLabelEn: LABELS[kind][1], nationalFlag: 'Thai',
  });
}
