/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Hospitals (สาธารณสุข, docs/SERVICES.md; owner, 13 Oct 2026) on the civic 3×3 (tiles 414–422), told apart by
// gameMap.civicKinds (RENDERER_SPEC 6H): a health-promoting hospital of the sub-district (รพ.สต.: a one-storey clinic, a
// sala to wait in, motorbikes), a community hospital (รพช.: outpatient block, three-storey ward, covered emergency porch
// with its ambulances, car park), a provincial hospital (รพ.จังหวัด: a six-storey tower and an outpatient wing, a helipad
// on the roof) and a regional hospital (รพ.ศูนย์: two towers on a podium, a car-park building, three ambulance bays).
// Tier R2: the same buildings in every region, dressed by the region kit. The city view places them from civicKinds
// (src/render3d/city/tileModels.ts), so they register no tiles of their own. Front +Z: the gate.
// NO RED CROSS: a Thai sign, a green cross on white, a blue "H"; the national flag flies over them (government).

import { TRIANGLE_BUDGETS } from '../../constants.js';
import { PAVING, STONE, shade } from './builder.js';
import { HospitalBuilder } from './hospital-builder.js';
import type { ModelOptions } from '../registry.js';

export const HOSPITAL_KINDS = ['health_centre', 'community_hospital', 'provincial_hospital', 'regional_hospital'] as const;
export type HospitalKind = typeof HOSPITAL_KINDS[number];
export const hospitalId = (kind: HospitalKind): string => `civic.${kind}`;
/** Triangle budgets (MODEL_SPEC 4): low-rise (≤ 4 floors) for the two small ones, high-rise for the two big ones */
export const HOSPITAL_BUDGETS: Readonly<Record<HospitalKind, number>> = {
  health_centre: TRIANGLE_BUDGETS.lowRise, community_hospital: TRIANGLE_BUDGETS.lowRise,
  provincial_hospital: TRIANGLE_BUDGETS.highRise, regional_hospital: TRIANGLE_BUDGETS.highRise,
};
/** The roof height of the tallest part of each, for the far view and the camera */
export const HOSPITAL_HEIGHTS: Readonly<Record<HospitalKind, number>> = {
  health_centre: 6, community_hospital: 14, provincial_hospital: 28, regional_hospital: 34,
};

/** Storeys of the tallest building of each (the regional hospital's towers stand on a two-storey podium) */
export const HOSPITAL_FLOORS: Readonly<Record<HospitalKind, number>> = {
  health_centre: 1, community_hospital: 3, provincial_hospital: 6, regional_hospital: 8,
};

/** Fictional hospital names; the seed picks one. */
export const HOSPITAL_NAMES: Readonly<Record<HospitalKind, readonly string[]>> = {
  health_centre: ['โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านโคกงาม', 'โรงพยาบาลส่งเสริมสุขภาพตำบลหนองน้ำใส',
    'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านทุ่งทอง', 'โรงพยาบาลส่งเสริมสุขภาพตำบลสวนใหม่'],
  community_hospital: ['โรงพยาบาลชุมชนเมืองใหม่', 'โรงพยาบาลชุมชนทุ่งทอง', 'โรงพยาบาลชุมชนริมน้ำ', 'โรงพยาบาลชุมชนสวนหลวง'],
  provincial_hospital: ['โรงพยาบาลเมืองใหม่', 'โรงพยาบาลลุ่มน้ำ', 'โรงพยาบาลทุ่งทอง'],
  regional_hospital: ['โรงพยาบาลศูนย์เมืองใหม่', 'โรงพยาบาลศูนย์ลุ่มน้ำ', 'โรงพยาบาลศูนย์ทุ่งทอง'],
};

const LABELS: Readonly<Record<HospitalKind, readonly [string, string]>> = {
  health_centre: ['โรงพยาบาลส่งเสริมสุขภาพตำบล', 'Sub-district health centre'], community_hospital: ['โรงพยาบาลชุมชน', 'Community hospital'],
  provincial_hospital: ['โรงพยาบาลจังหวัด', 'Provincial hospital'], regional_hospital: ['โรงพยาบาลศูนย์', 'Regional hospital'],
};

function site(b: HospitalBuilder): void {
  b.feature('site', () => b.box(29, 0.06, 29, 0, 0.03, 0, b.grass));
}

/** The gate on the front and the fence round the compound. */
function boundary(b: HospitalBuilder, gateX: number, name: string, opening = 4.4, roof = true): void {
  b.feature('gate', () => b.schoolGate(gateX, 13.75, opening, name, roof));
  b.feature('fence', () => b.schoolFence(gateX, opening));
}

// --- Sub-district health centre (โรงพยาบาลส่งเสริมสุขภาพตำบล) -------------------------------------------------------------

/** The clinic in the local frame: one storey, a deep veranda across the front with a ramp and steps, a double door, windows
 * with louvres above them, and the region's modern roof over all. */
function clinic(b: HospitalBuilder): void {
  const w = 15, body = 7.5, ver = 2.2, h = 3.3, p = 0.45, top = p + h, depth = body + ver, back = -depth / 2, wall = back + body;
  b.bx(b.stone, STONE, w + 0.4, p, depth + 0.4, 0, p / 2, 0);
  b.bx(b.paint, b.wall, w, h, body, 0, p + h / 2, back + body / 2);
  b.bx(b.paint, shade(b.wall, -0.1), w + 0.06, 0.5, body + 0.06, 0, p + 0.25, back + body / 2);
  b.bx(b.paint, b.accent, w + 0.1, 0.3, depth, 0, top - 0.15, 0);
  b.colored(shade(b.wall, 0.04), () => { for (const x of [-w / 2 + 0.25, -w / 4, 0, w / 4, w / 2 - 0.25]) b.box(0.3, h, 0.3, x, p + h / 2, depth / 2 - 0.2, b.paint); });
  b.bx(b.paint, shade(b.wall, -0.06), w - 0.4, 0.9, 0.12, 0, p + 0.45 + 0.02, depth / 2 - 0.1);
  b.quad(2, 2.1, 0, p + 1.05, wall + 0.04, 0x4f5f63);
  b.quad(0.07, 2.1, 0, p + 1.05, wall + 0.06, 0xeeede6);
  for (const x of [-5.6, -3.2, 3.2, 5.6]) {
    b.glazing(1.5, 1.3, x, p + 1.75, wall, 0.75);
    b.quad(1.5, 0.3, x, p + 2.8, wall + 0.02, 0xb7b0a0);
  }
  b.quad(1.2, 1.3, 0, p + 1.75 + 1.45, wall + 0.02, 0x4a8f6b);
  b.label('รพ.สต.', 2.4, 0.5, 0, top - 0.15, depth / 2 + 0.07, 0, b.accent, 0xffffff);
  b.at(0, 0, Math.PI, () => { b.glazing(w - 1.6, 1.3, 0, p + 1.75, depth / 2, 1.3); });
  for (const s of [-1, 1]) b.at(s * w / 2, back + body / 2, s * Math.PI / 2, () => {
    b.glazing(2, 1.3, -1.7, p + 1.75, 0, 1); b.glazing(2, 1.3, 1.7, p + 1.75, 0, 1);
    b.condenser(0, p + 2.7, 0, 0);
  });
  b.stairs(3.6, p, 0, depth / 2 + 0.05, b.stone, STONE);
  b.ramp(1.6, p, -w / 2 + 1.4, depth / 2 + 0.05, -1);
  b.waitingBench(-4.8, depth / 2 - 0.7); b.waitingBench(4.8, depth / 2 - 0.7);
  b.roofOver(w, depth, top, { ridge: 'x', pitch: Math.min(28, b.kit.defaults.pitch), overhang: 0.8, fill: b.wall, brackets: false, panels: false });
  b.blocks.push({ width: w, depth, top, floors: [p] });
}

/** The staff house (บ้านพักเจ้าหน้าที่): a one-storey house with a door, two windows, a step, an air-conditioner and the region's roof. */
function staffHouse(b: HospitalBuilder): void {
  const w = 6.4, d = 5, h = 2.9, p = 0.35;
  b.bx(b.stone, STONE, w + 0.3, p, d + 0.3, 0, p / 2, 0);
  b.bx(b.paint, shade(b.wall, 0.02), w, h, d, 0, p + h / 2, 0);
  b.bx(b.paint, b.accent, w + 0.08, 0.22, d + 0.08, 0, p + h - 0.11, 0);
  b.quad(0.95, 2.05, 1.2, p + 1.03, d / 2 + 0.02, 0x5b3c29);
  b.glazing(1.6, 1.2, -1.5, p + 1.6, d / 2, 0.8);
  b.at(0, 0, Math.PI, () => b.glazing(3.4, 1.2, 0, p + 1.6, d / 2, 1.1));
  for (const s of [-1, 1]) b.at(s * w / 2, 0, s * Math.PI / 2, () => b.glazing(1.6, 1.2, 0, p + 1.6, 0, 0.8));
  b.bx(b.stone, STONE, 1.8, 0.2, 1, 1.2, 0.1, d / 2 + 0.5);
  b.condenser(-w / 2 + 0.7, p + 2.2, d / 2, 0);
  b.roofOver(w, d, p + h, { ridge: 'x', pitch: Math.min(26, b.kit.defaults.pitch), overhang: 0.6, fill: b.wall, brackets: false, panels: false });
}

/** A carport (โรงจอดรถ) for the health centre's ambulance: four steel posts and a sheet leaning toward the front. */
function carport(b: HospitalBuilder): void {
  b.bx(b.stone, PAVING, 4.4, 0.06, 6.2, 0, 0.09, 0);
  b.colored(0x6f7774, () => { for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.12, 2.8, 0.12, x * 2, 1.4, z * 2.8, b.steel); });
  b.leanSheet(4.9, 6.6, 2.6, 3.1, b.accent);
  b.ambulance(0, 0.1, 0);
}

function healthCentre(b: HospitalBuilder, name: string): void {
  site(b);
  b.feature('clinic', () => b.at(-1.5, -6.9, 0, () => clinic(b)));
  b.feature('staff-house', () => b.at(10.2, -10.9, 0, () => staffHouse(b)));
  b.feature('sala', () => b.at(10.2, -4.6, 0, () => b.sala(3.8, 3)));
  b.feature('herb-garden', () => b.at(-11.9, -8.3, Math.PI / 2, () => b.herbBeds(5.6, 3.4)));
  b.feature('water-tank', () => b.at(-12, -12.6, 0, () => b.tankTower(3.2)));
  b.feature('ambulance-carport', () => b.at(4.7, 4.2, 0, () => carport(b)));
  b.feature('bike-shed', () => b.at(10.4, 8.8, 0, () => b.bikeShed(6, 6, 0)));
  b.feature('path', () => b.path(-1.5, -2, 13.75, 2.4));
  b.feature('sign', () => b.at(-7.5, 7.4, 0, () => b.pylon('รพ.สต.', 3.2)));
  b.feature('flagpole', () => b.flag(-11.8, 3.4, 8));
  boundary(b, -1.5, name);
  b.regionalProp(-12, 12.2);
  b.feature('trees', () => { b.shadeTree(1, 12.9, 0.4, 5.2, 1.1); b.shadeTree(2, 4.6, -13.2, 4.6, 1); b.shadeTree(3, 11.6, 12.4, 4.4, 0.9); b.shadeTree(4, -6.4, 2.6, 4.4, 0.9); });
}

// --- Community hospital (โรงพยาบาลชุมชน) -----------------------------------------------------------------------------

function communityHospital(b: HospitalBuilder, name: string): void {
  site(b);
  b.feature('opd-block', () => b.at(-4, -9.4, 0, () => {
    b.wing({ w: 19, d: 8, floors: 2, roof: 'kit', lobby: { x: -7.2, width: 3.4 }, sign: 'ผู้ป่วยนอก', signX: -7.2 });
  }));
  b.feature('ward-block', () => b.at(9.5, -4.2, 0, () => {
    b.wing({ w: 8, d: 18.4, floors: 3, roof: 'kit', step: 2.4, sign: 'ผู้ป่วยใน' });
  }));
  b.feature('emergency-porch', () => b.at(-4, -2.9, 0, () => b.porch(10, 5, 4.3, 'ห้องฉุกเฉิน')));
  b.feature('ambulances', () => { b.ambulance(-6.3, -2.4, 0); b.ambulance(-1.9, -2.4, 0); });
  b.feature('entrance-canopy', () => b.at(-11.2, -4.1, 0, () => b.porch(4.2, 2.6, 3.3, 'ทางเข้า')));
  b.feature('service-block', () => b.at(-9.4, 3.4, 0, () => {
    b.wing({ w: 7.6, d: 5, floors: 1, roof: 'flat', step: 2.4, rear: false, plant: false, sign: 'ซักฟอก โภชนาการ' });
  }));
  b.feature('walkway', () => b.at(-11.6, -1.2, Math.PI / 2, () => b.walkway(3.6)));
  b.feature('driveway', () => b.path(-4, -2.4, 13.75, 3.2, 0xbfb9aa));
  b.feature('parking', () => { b.carRow(-9.7, 10.4, 3, [true, true, false], 2.6, 0); b.carRow(1.7, 10.4, 3, [true, false, true], 2.6, 3); });
  b.feature('bike-shed', () => b.at(10.4, 9.8, 0, () => b.bikeShed(6.6, 6, 0)));
  b.feature('generator', () => b.at(9.6, 12.6, 0, () => b.generatorHouse(4, 2.4)));
  b.feature('sign', () => b.at(-11.7, 7.3, 0, () => b.pylon(name.replace('โรงพยาบาล', 'รพ.'), 3.4)));
  b.feature('flagpole', () => b.flag(6.8, 7.8, 9));
  boundary(b, -4, name);
  b.regionalProp(13, 5.2);
  b.feature('trees', () => { b.shadeTree(1, -13, -13, 5, 1.1); b.shadeTree(2, 3.6, 3.8, 4.4, 1); b.shadeTree(3, -13, 1.6, 4.4, 0.9); b.shadeTree(4, 3.8, 5.9, 4.4, 0.9); });
}

// --- Provincial hospital (โรงพยาบาลจังหวัด) ---------------------------------------------------------------------------

function provincialHospital(b: HospitalBuilder, name: string): void {
  site(b);
  b.feature('tower', () => b.at(-4, -8, 0, () => {
    const block = b.wing({ w: 19, d: 11, floors: 6, roof: 'flat', plant: false, sign: 'อาคารผู้ป่วยใน', signX: 2 });
    b.rooftop(19, 11, block.top + 0.2);
  }));
  b.feature('helipad', () => b.helipad(-9.8, 0.45 + 6 * 3.6 + 0.18, -7.5, 3.4));
  b.feature('opd-wing', () => b.at(9.65, -4.75, 0, () => {
    b.wing({ w: 8.3, d: 17.5, floors: 3, roof: 'flat', lobby: { x: 0, width: 4 }, step: 2.4, sign: 'ผู้ป่วยนอก' });
  }));
  b.feature('emergency-porch', () => b.at(-8.5, 0.1, 0, () => b.porch(10, 5.4, 4.4, 'ห้องฉุกเฉิน')));
  b.feature('ambulances', () => { b.ambulance(-11.2, 0.2, 0); b.ambulance(-6, 0.2, 0); });
  b.feature('entrance-canopy', () => b.at(9.65, 5.7, 0, () => b.porch(6, 3.4, 3.8, 'ทางเข้า')));
  b.feature('driveway', () => b.path(1, 2.4, 13.75, 4.2, 0xbfb9aa));
  b.feature('parking', () => { b.carRow(-8.4, 9.6, 4, [true, true, false, true], 2.7, 0); b.carRow(8.2, 11.2, 3, [true, false, true], 2.7, 4); });
  b.feature('bike-shed', () => b.at(-10.8, 5.2, 0, () => b.bikeShed(5.6, 5, 0)));
  b.feature('sign', () => b.at(-12.2, 13.2, 0, () => b.pylon(name, 3.4)));
  b.feature('flagpole', () => b.flag(5.2, 6.6, 9));
  boundary(b, 1, name, 4.4, false);
  b.regionalProp(-1.9, 5.4);
  b.feature('trees', () => { b.shadeTree(1, -13, 7.6, 4.6, 1); b.shadeTree(2, 13, 12.8, 4.4, 0.9); });
}

// --- Regional hospital (โรงพยาบาลศูนย์) ------------------------------------------------------------------------------

function regionalHospital(b: HospitalBuilder, name: string): void {
  site(b);
  b.feature('podium', () => b.at(0, -7.6, 0, () => {
    b.wing({ w: 27, d: 12.2, floors: 2, floor: 4.2, roof: 'flat', plant: false, lobby: { x: 6.5, width: 5 }, step: 2.6 });
  }));
  b.feature('tower-west', () => b.at(-5.5, -9.1, 0, () => {
    const block = b.wing({ w: 16, d: 8.6, floors: 6, floor: 3.4, plinth: 0.1, roof: 'flat', plant: false });
    b.rooftop(16, 8.6, block.top + 0.2);
  }, 8.85));
  b.feature('tower-east', () => b.at(9, -9.1, 0, () => {
    const block = b.wing({ w: 9, d: 8.6, floors: 4, floor: 3.4, plinth: 0.1, roof: 'flat', plant: false, sign: 'ศูนย์เฉพาะทาง' });
    b.rooftop(9, 8.6, block.top + 0.2);
  }, 8.85));
  // A glazed bridge (สะพานเชื่อมอาคาร) between the towers on the fourth floor
  b.feature('skybridge', () => b.at(3.5, -9.1, 0, () => {
    b.bx(b.paint, b.wall, 2.4, 2.8, 4.2, 0, 8.85 + 0.1 + 3 * 3.4 + 1.4, 0);
    b.quad(2.2, 1.1, 0, 8.85 + 0.1 + 3 * 3.4 + 1.6, 2.12, 0x33454d);
    b.bx(b.paint, b.accent, 2.5, 0.2, 4.3, 0, 8.85 + 0.1 + 3 * 3.4 + 2.9, 0);
  }));
  b.feature('helipad', () => b.helipad(-9.2, 8.85 + 0.1 + 6 * 3.4 + 0.18, -9, 3.1));
  b.feature('emergency-porch', () => b.at(-8.2, 1.1, 0, () => b.porch(10.4, 5.2, 4.4, 'ห้องฉุกเฉิน')));
  b.feature('ambulances', () => { b.ambulance(-11.4, 1.25, 0); b.ambulance(-8.2, 1.25, 0); b.ambulance(-5, 1.25, 0); });
  b.feature('entrance-canopy', () => b.at(6.5, 0.8, 0, () => b.porch(7.4, 4.6, 4.2, 'ผู้ป่วยนอก')));
  b.feature('driveway', () => b.path(-0.2, 3, 13.75, 4.2, 0xbfb9aa));
  b.feature('parking', () => { b.carRow(-8.8, 9.2, 4, [true, true, false, true], 2.7, 0); });
  b.feature('parking-building', () => b.at(9, 10, 0, () => b.parkingBuilding(9.6, 7.4, 2)));
  b.feature('sign', () => b.at(-8.5, 13, 0, () => b.pylon(name, 3.4)));
  b.feature('flagpole', () => b.flag(-3.4, 6.2, 9));
  boundary(b, -0.2, name, 4.4, false);
  b.regionalProp(-12.8, 6.4);
  b.feature('trees', () => { b.shadeTree(1, -13.4, 11.8, 4.6, 1); b.shadeTree(2, -3.2, 11.6, 4.4, 0.9); });
}

const LAYOUTS: Readonly<Record<HospitalKind, (b: HospitalBuilder, name: string) => void>> = {
  health_centre: healthCentre, community_hospital: communityHospital, provincial_hospital: provincialHospital, regional_hospital: regionalHospital,
};

/** civic.<kind>: one hospital compound; the seed picks its name, colours and small props, never its buildings. */
export function createHospitalCivic(kind: HospitalKind, options: ModelOptions = {}) {
  const b = new HospitalBuilder(options), name = b.choose(HOSPITAL_NAMES[kind]);
  LAYOUTS[kind](b, name);
  return b.finishHospital(hospitalId(kind), kind, {
    signText: name, building: kind, floors: HOSPITAL_FLOORS[kind],
    variantLabel: LABELS[kind][0], variantLabelEn: LABELS[kind][1],
  });
}
