/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rubbish and wastewater plants (ขยะและน้ำเสีย, docs/WASTE.md, RENDERER_SPEC 6I) on the 3×3 of tiles 992–1000, told apart by
// gameMap.wasteKinds: a landfill (บ่อฝังกลบขยะ: lined cell with its heap, a capped mound with gas wells, a leachate pond, the
// compactor, trucks, a litter fence), an incinerator (โรงเผาขยะ: tipping hall, furnace hall, bag filter, a tall stack, an ash
// bay), a recycling plant (โรงคัดแยกขยะรีไซเคิล: sorting shed with its belts, bale yard, sorted-glass bays), a waste power plant
// (โรงไฟฟ้าขยะ: bunker, boiler house, turbine hall, air-cooled condenser, a stack, a small switchyard) and a wastewater plant
// (โรงบำบัดน้ำเสีย: screens, round clarifiers, an aeration basin, a contact tank, a digester, drying beds). Tier R3. The
// city view places them from wasteKinds (src/render3d/city/tileModels.ts), so they register no tiles of their own.
// Front +Z: the gate and the weighbridge. Generic Thai signs only; no real company's name or livery.

import { point } from '../../regional/geometry.js';
import { TRIANGLE_BUDGETS } from '../../constants.js';
import { LATERITE, STONE, shade } from '../civic/builder.js';
import { CONCRETE, GLASS, LADDER, PIPE, RAIL } from '../water/builder.js';
import { BIN_COLORS, DARK, SOIL, WASTE_GREEN, WasteBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const WASTE_KINDS = ['landfill', 'incinerator', 'recycling_plant', 'waste_power_plant', 'wastewater_plant'] as const;
export type WasteModelKind = typeof WASTE_KINDS[number];
export const wasteId = (kind: WasteModelKind): string => `waste.${kind}`;
/** Triangle budgets (MODEL_SPEC 4): the sheds and basins are low-rise; the two plants with a boiler hall and a tall stack are high-rise */
export const WASTE_BUDGETS: Readonly<Record<WasteModelKind, number>> = {
  landfill: TRIANGLE_BUDGETS.lowRise, incinerator: TRIANGLE_BUDGETS.highRise, recycling_plant: TRIANGLE_BUDGETS.lowRise,
  waste_power_plant: TRIANGLE_BUDGETS.highRise, wastewater_plant: TRIANGLE_BUDGETS.lowRise,
};
/** The tallest point of each, for the far view and the camera */
export const WASTE_HEIGHTS: Readonly<Record<WasteModelKind, number>> = {
  landfill: 7, incinerator: 33, recycling_plant: 8, waste_power_plant: 38, wastewater_plant: 9,
};
/** Storeys of the tallest building of each, for the gallery's label */
export const WASTE_FLOORS: Readonly<Record<WasteModelKind, number>> = {
  landfill: 1, incinerator: 4, recycling_plant: 1, waste_power_plant: 6, wastewater_plant: 1,
};
export const WASTE_SIGNS: Readonly<Record<WasteModelKind, string>> = {
  landfill: 'บ่อฝังกลบขยะ', incinerator: 'โรงเผาขยะ', recycling_plant: 'โรงคัดแยกขยะรีไซเคิล', waste_power_plant: 'โรงไฟฟ้าขยะ',
  wastewater_plant: 'โรงบำบัดน้ำเสีย',
};
const LABELS: Readonly<Record<WasteModelKind, readonly [string, string]>> = {
  landfill: ['บ่อฝังกลบขยะ', 'Landfill'], incinerator: ['โรงเผาขยะ', 'Incinerator'], recycling_plant: ['โรงคัดแยกขยะรีไซเคิล', 'Recycling plant'],
  waste_power_plant: ['โรงไฟฟ้าขยะ', 'Waste power plant'], wastewater_plant: ['โรงบำบัดน้ำเสีย', 'Wastewater plant'],
};

const YELLOW = 0xd9a82c;
const HALL_GREY = 0x9fb0ab;

/** The plant's front: the lawn, the gate, the fence and the road in from the gate with its weighbridge. */
function frontage(b: WasteBuilder, kind: WasteModelKind, gateX: number, roadEnd: number, weighbridgeZ = 8.8, length = 7): void {
  b.feature('road', () => b.road(gateX, roadEnd, 13.75, 3.4));
  b.feature('weighbridge', () => b.at(gateX, weighbridgeZ, 0, () => b.weighbridge('ชั่งน้ำหนัก', length)));
  b.feature('gate', () => b.gate(gateX, 4, WASTE_SIGNS[kind]));
  b.feature('fence', () => b.fence(gateX, 4));
}

/** A tracked-wheel landfill compactor (รถบดอัดขยะ) facing local +Z: drums, a body, a cab, a blade. */
function compactor(b: WasteBuilder): void {
  b.bx(b.paint, YELLOW, 2.6, 1.3, 4.2, 0, 1.9, -0.4);
  b.bx(b.paint, YELLOW, 2.4, 1.4, 1.8, 0, 3.0, -1.3);
  b.quad(2, 0.8, 0, 3.15, -0.39, GLASS);
  b.bx(b.paint, 0x6f7774, 3.4, 1.0, 0.25, 0, 1.0, 2.9);
  b.colored(0x6f7774, () => { for (const s of [-1, 1]) b.pole(point(s * 1.1, 1.3, 1.6), point(s * 1.3, 1.1, 2.8), 0.08, b.paint, 4); });
  b.colored(0x4a4f50, () => { for (const s of [-1, 1]) for (const z of [-1.9, 1.7]) b.cylinder(0.95, 1.0, s * 1.3, 0.95, z, b.paint, 12, Math.PI / 2); });
  b.colored(DARK, () => b.pole(point(0.9, 3.6, -1.8), point(0.9, 4.7, -1.8), 0.07, b.paint, 5));
}

/** A low earth bund (คันดิน) round one side of the cell, two steps wide, along local X. */
function bund(b: WasteBuilder, length: number, x: number, z: number, yaw = 0): void {
  b.at(x, z, yaw, () => {
    b.bx(b.paint, shade(SOIL, -0.06), length, 0.55, 2.6, 0, 0.275, 0);
    b.bx(b.paint, shade(SOIL, 0.02), length - 0.8, 0.55, 1.4, 0, 0.82, 0);
  });
}

// --- Landfill (บ่อฝังกลบขยะ) ------------------------------------------------------------------------------------------

function landfill(b: WasteBuilder): void {
  b.site();
  b.feature('soil', () => b.bx(b.paint, SOIL, 26.4, 0.04, 22.3, 0, 0.08, -2.15));
  frontage(b, 'landfill', 3, -6.6, 8.8, 7);
  b.feature('haul-road', () => b.bx(b.stone, LATERITE, 8, 0.05, 3.2, -0.9, 0.1, -6.3));
  // The working cell: a dark liner in a low earth bund, open on the east for the trucks, with the heap on it
  b.feature('active-cell', () => {
    const cx = -6.7, cz = -8.6;
    b.flat(8.6, 5.4, cx, cz, 0.105, b.paint, 0x25282a);
    bund(b, 13.2, cx, cz - 5 + 1.3);
    bund(b, 13.2, cx, cz + 5 - 1.3);
    bund(b, 10, cx - 6.6 + 1.3, cz, Math.PI / 2);
    bund(b, 2.9, cx + 6.6 - 1.3, cz - 3.6, Math.PI / 2);
    bund(b, 2.9, cx + 6.6 - 1.3, cz + 3.6, Math.PI / 2);
    const heaps: readonly (readonly [number, number, number, number, number, number])[] = [
      [-8.5, -9.1, 3.8, 2.4, 2.2, 0x6b6253], [-5.4, -9.9, 3.2, 1.9, 1.9, 0x5a5348], [-9.9, -7.5, 2.2, 1.0, 1.3, 0x8a7a5a]];
    for (const [x, z, rx, ry, rz, color] of heaps) b.heap(x, 0.1, z, rx, ry, rz, color);
    // Bags and bottles in the heap, in a fixed scatter
    const speck = [0x3f78a8, 0xe6e6e0, 0xc9622b, 0x4f8f5a, 0xd9a82c, 0x3f78a8, 0xe6e6e0, 0xb8792a];
    for (let i = 0; i < 16; i++) {
      const [x, z, rx, ry, rz] = heaps[i % 3], a = i * 2.4, r = 0.25 + (i * 0.37) % 0.55;
      const dx = Math.cos(a) * r * rx, dz = Math.sin(a) * r * rz, top = ry * Math.sqrt(Math.max(0.05, 1 - (dx / rx) ** 2 - (dz / rz) ** 2));
      b.bx(b.paint, speck[i % speck.length], 0.5, 0.3, 0.4, x + dx, 0.1 + top - 0.05, z + dz, (i % 4) * 0.3);
    }
  });
  b.feature('compactor', () => b.at(-5.2, -7.2, -Math.PI / 2 + 0.2, () => compactor(b)));
  b.feature('tipping-truck', () => b.truck(3.2, -6.3, -Math.PI / 2, b.truckColor(0)));
  b.feature('queued-truck', () => b.truck(3, -0.2, Math.PI, b.truckColor(2)));
  // The closed cell: a grassed mound capped with soil, its gas wells and collection main
  b.feature('capped-cell', () => {
    const cx = 9, cz = -9.4, rx = 4.4, ry = 3.4, rz = 3.8;
    b.colored(0x8fbf6e, () => b.ellipsoid(point(cx, 0.08, cz), point(rx, ry, rz), b.grass, 12, 6));
    const geometry = b.parts[b.parts.length - 1].geometry, p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0.09, p.getY(i)));
    geometry.computeVertexNormals();
    const surface = (x: number, z: number): number => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((z - cz) / rz) ** 2));
    for (const [x, z] of [[7.3, -10.4], [9, -10.8], [10.8, -10.4], [7.8, -8.2], [10, -8.2]] as const) {
      const y = 0.08 + surface(x, z);
      b.colored(0x5a5f5e, () => { b.pole(point(x, y - 0.2, z), point(x, y + 1.6, z), 0.07, b.paint, 5); b.cylinder(0.16, 0.12, x, y + 1.66, z, b.paint, 6); });
    }
    b.pipe([point(5.4, 0.35, -7.4), point(8, 0.35, -6.2), point(12, 0.35, -6.2), point(13.2, 0.35, -8.2)], 0.1, 0x3a3f40);
    b.bx(b.stone, CONCRETE, 0.8, 0.9, 0.8, 13, 0.45, -3.4);
    b.colored(LADDER, () => b.pole(point(13, 0.9, -3.4), point(13, 2.2, -3.4), 0.06, b.paint, 5));
  });
  // The leachate pond (บ่อน้ำชะขยะ), black-lined, with its pump house and a wheel wash on the haul road
  b.feature('leachate-pond', () => {
    b.flat(7.2, 4.2, -8.8, 3.6, 0.22, b.paint, 0x3d3226);
    b.colored(0x25282a, () => {
      for (const s of [-1, 1]) { b.box(7.8, 0.4, 0.3, -8.8, 0.2, 3.6 + s * 2.25, b.paint); b.box(0.3, 0.4, 4.2, -8.8 + s * 3.75, 0.2, 3.6, b.paint); }
    });
    b.pipe([point(-5.1, 0.45, 3.6), point(-3.4, 0.45, 3.6)], 0.14, 0x3a3f40);
    b.at(-1.6, 3.6, -Math.PI / 2, () => b.utilityBuilding(2.8, 2.4, 2.6, 1, 'สถานีสูบ', true));
  });
  b.feature('wheel-wash', () => b.at(3, 2.2, 0, () => {
    b.bx(b.stone, CONCRETE, 3.4, 0.4, 4, 0, 0.2, 0);
    b.flat(2.6, 3.2, 0, 0, 0.42, b.water());
  }));
  b.feature('gas-flare', () => b.at(-12.2, -1.6, 0, () => {
    b.bx(b.stone, CONCRETE, 1.4, 0.3, 1.4, 0, 0.15, 0);
    b.colored(0x9a9e9a, () => b.cylinder(0.22, 5.2, 0, 2.9, 0, b.paint, 8));
    b.colored(0x3a3f40, () => b.cylinder(0.4, 0.7, 0, 5.7, 0, b.paint, 8));
    b.bx(b.paint, 0x2f6fa8, 0.5, 0.9, 0.5, 0.9, 0.55, 0.2);
  }));
  b.fire.push(point(-12.2, 6.3, -1.6));
  b.feature('litter-fence', () => {
    for (const z of [-12.8, -9.8, -6.8, -3.8]) b.bx(b.paint, 0x6f7774, 0.14, 4.6, 0.14, -13.6, 2.3, z);
    b.colored(0xc2bfae, () => { for (const z of [-11.3, -8.3, -5.3]) b.box(0.04, 2.4, 2.9, -13.6, 3.3, z, b.paint); });
  });
  b.feature('office', () => b.at(10.4, 8.6, 0, () => b.utilityBuilding(5.4, 4, 3, 1.2, 'สำนักงาน')));
  b.feature('bins', () => { BIN_COLORS.forEach((color, i) => b.bin(7.6 + i * 0.9, 4.4, color)); });
  b.feature('trees', () => { b.shadeTree(0, 12.6, 2.6, 5, 1.2); b.shadeTree(1, -12.8, 10.6, 5, 1.2); b.shadeTree(2, -3.6, 11.8, 4.4, 1); b.shadeTree(3, 12.8, 12.4, 4.6, 1); });
}

// --- Incinerator (โรงเผาขยะ) -------------------------------------------------------------------------------------------

function incinerator(b: WasteBuilder): void {
  b.site();
  b.feature('yard', () => b.yard(27.6, 20, 0, 3.6));
  frontage(b, 'incinerator', 3, 2.4);
  b.feature('tipping-hall', () => b.at(3, -0.7, 0, () => b.hall(11, 7.4, 8.5, HALL_GREY, { door: 6.2, doorH: 5.6, sign: 'อาคารรับขยะ' })));
  b.feature('furnace-hall', () => b.at(3, -8.2, 0, () => {
    b.hall(11, 7.6, 13.5, 0xa7b3ad, { roof: 'flat' });
    // The steam drum and the flue riser on the furnace hall's roof
    b.colored(0x8a8f94, () => { b.cylinder(0.9, 7, -1.5, 15.2, 0, b.paint, 10, Math.PI / 2); b.cylinder(0.7, 3, 2.4, 15.4, -1.2, b.paint, 10); });
    b.colored(0x6f7774, () => { for (const x of [-4.5, 1.5]) b.box(0.3, 1.4, 0.3, x, 14.5, 0, b.paint); });
  }));
  b.feature('bag-filter', () => b.at(11.4, -6.9, 0, () => {
    b.colored(0x6f7774, () => { for (const x of [-1.2, 1.2]) for (const z of [-3, 3]) b.box(0.2, 1.8, 0.2, x, 0.9, z, b.paint); });
    b.bx(b.paint, 0x8a9696, 3.4, 4, 7.2, 0, 3.8, 0);
    b.colored(0x7f8a8a, () => { for (const z of [-2.4, 0, 2.4]) b.cylinder(0.9, 1.4, 0, 1.45, z, b.paint, 8); });
    b.bx(b.paint, 0x6f7774, 3.6, 0.3, 7.4, 0, 6, 0);
    b.guardRail(7, 0, 6.1, 0, Math.PI / 2);
  }));
  b.feature('flue-duct', () => {
    b.pipe([point(8.5, 9.8, -8.6), point(11.4, 9.8, -8.6), point(11.4, 7, -8.6)], 0.65, 0x8a8f94);
    b.at(11.4, -2.6, 0, () => { b.bx(b.paint, 0x6f7774, 1.8, 1.6, 1.8, 0, 1.2, 0); b.colored(0x5a5f5e, () => b.cylinder(0.7, 0.4, 0, 1.2, 1.0, b.paint, 10, Math.PI / 2)); });
    b.pipe([point(11.4, 1.0, -3.8), point(11.4, 1.0, -9.2), point(12.6, 1.0, -11.8)], 0.5, 0x8a8f94);
  });
  b.feature('stack', () => b.stack(12.6, -12.4, 32, 1.4, 0.85));
  b.feature('ash-bay', () => b.at(-8.4, -8.6, 0, () => {
    b.shed(6.4, 6.2, 4.2, { back: true, left: true });
    b.heap(0, 0.15, -0.4, 2, 1.4, 1.7, 0x8a8f90);
    b.heap(1.4, 0.15, 0.6, 1.2, 0.8, 1.0, 0x6f7678);
    b.label('ห้องเถ้า', 1.8, 0.4, 0, 4.0, 3.15, 0, WASTE_GREEN, 0xffffff);
  }));
  b.feature('ash-containers', () => { b.rolloff(-11.6, -2.6, 0, 0x4a6b86, 0x8a8f90); b.rolloff(-8.6, -2.2, 0, 0x6f7774, 0x8a8f90); });
  b.feature('control-building', () => b.at(-8.6, 6, 0, () => b.utilityBuilding(6, 4.6, 3.4, 1.4, 'ห้องควบคุม', true)));
  b.feature('fire-water-tank', () => b.at(11.4, 3.4, 0, () => {
    b.shell([[2.1, 0.25], [2.1, 4.6], [0.4, 5.4], [0.001, 5.45]], 0, 0, 0, 18, 0xc9ccc8);
    b.ladder(0, -2.15, 0.3, 4.8, Math.PI, false);
    b.label('ถังน้ำดับเพลิง', 2.4, 0.45, 0, 2.4, 2.16, 0, 0x2f6fa8, 0xffffff);
  }));
  b.feature('trucks', () => { b.truck(3, 8.8, Math.PI, b.truckColor(0)); b.truck(-2.5, 11.4, Math.PI / 2, b.truckColor(3)); });
  b.feature('staff-parking', () => { b.parkedCar(9.6, 10.8, 0xe8e6df, Math.PI); b.parkedCar(12.2, 10.8, 0x2b3f5a, Math.PI); b.parkedBike(13.4, 7.4, 0xb33a2e, Math.PI); });
  b.feature('trees', () => { b.shadeTree(0, -12.8, 12.4, 4.8, 1.1); b.shadeTree(1, -4.4, 12.8, 4.4, 1); b.shadeTree(2, 13, 7.6, 4.4, 1); });
}

// --- Recycling plant (โรงคัดแยกขยะรีไซเคิล) ----------------------------------------------------------------------------

/** A wheel loader (รถตักล้อยาง) facing local +Z: a bucket, a boom, a cab, four big wheels. */
function loader(b: WasteBuilder): void {
  b.bx(b.paint, YELLOW, 2.4, 1.1, 3.4, 0, 1.3, -0.3);
  b.bx(b.paint, YELLOW, 2.0, 1.5, 1.7, 0, 2.3, -0.8);
  b.quad(1.7, 0.8, 0, 2.5, 0.06, GLASS);
  b.bx(b.paint, 0x4a4f50, 2.7, 0.9, 1.0, 0, 0.75, 2.6);
  b.colored(0x6f7774, () => { for (const s of [-1, 1]) b.pole(point(s * 0.9, 1.7, 1.2), point(s * 1.0, 1.0, 2.5), 0.1, b.paint, 4); });
  b.colored(DARK, () => { for (const s of [-1, 1]) for (const z of [-1.5, 1.4]) b.cylinder(0.85, 0.7, s * 1.2, 0.85, z, b.paint, 10, Math.PI / 2); });
}

/** A forklift (รถยก) facing local +Z: a mast with its forks, a cab frame, a counterweight. */
function forklift(b: WasteBuilder): void {
  b.bx(b.paint, 0xe58a2c, 1.3, 0.9, 1.9, 0, 0.85, -0.2);
  b.bx(b.paint, 0xe58a2c, 1.3, 0.5, 0.6, 0, 0.7, -1.2);
  b.colored(DARK, () => { for (const s of [-1, 1]) { b.box(0.08, 1.2, 0.08, s * 0.5, 1.9, 0.5, b.paint); b.box(0.08, 1.2, 0.08, s * 0.5, 1.9, -0.7, b.paint); } b.box(1.2, 0.07, 1.4, 0, 2.5, -0.1, b.paint); });
  b.colored(0x6f7774, () => { for (const s of [-1, 1]) { b.box(0.1, 2.4, 0.1, s * 0.4, 1.3, 1.0, b.paint); b.box(0.12, 0.08, 1.2, s * 0.35, 0.25, 1.6, b.paint); } });
  b.colored(DARK, () => { for (const s of [-1, 1]) for (const z of [0.5, -0.9]) b.cylinder(0.32, 0.25, s * 0.7, 0.32, z, b.paint, 8, Math.PI / 2); });
}

function recyclingPlant(b: WasteBuilder): void {
  b.site();
  b.feature('yard', () => { b.yard(27.4, 8.4, 0, 0.1); b.yard(9, 12, 9.2, -8.4); });
  frontage(b, 'recycling_plant', 2.2, 1.6);
  b.feature('sorting-shed', () => b.at(-5.6, -8.4, 0, () => b.shed(16, 10, 6, { back: true, left: true })));
  b.feature('sorting-lines', () => {
    b.conveyor(point(-12, 1, -6.4), point(-2.4, 1, -6.4), 0.9);
    b.conveyor(point(-12, 1, -9.6), point(-2.4, 1, -9.6), 0.9);
    b.conveyor(point(-8, 0.3, -2.4), point(-8, 3.2, -5.4), 1.1);
    b.bx(b.paint, 0x8a9696, 4.2, 2.4, 3.4, -9.6, 3.1, -12.2);
    b.bx(b.paint, shade(b.wall, -0.05), 4.2, 0.2, 3.4, -9.6, 4.4, -12.2);
    b.quad(3.4, 1.0, -9.6, 3.3, -10.45, GLASS);
    b.colored(0x6f7774, () => { for (const x of [-11.2, -8]) for (const z of [-13.4, -11]) b.box(0.15, 1.9, 0.15, x, 0.95, z, b.paint); });
    b.colored(0x3f6b55, () => b.box(2.8, 2, 2.2, 0.6, 1.0, -8.4, b.paint));
    b.colored(0x6f7774, () => b.box(1.2, 0.5, 2.2, -1.2, 1.7, -8.4, b.paint));
    b.label('คัดแยก', 1.6, 0.4, -9.6, 4.9, -10.45, 0, WASTE_GREEN, 0xffffff);
  });
  b.feature('tipping-floor', () => {
    b.heap(-9.8, 0.1, 0.2, 3.4, 2.1, 2.2, 0x8a7a5a);
    b.heap(-6.2, 0.1, 1.4, 2.6, 1.5, 1.8, 0x6f7774);
    b.heap(-11.4, 0.1, 2.4, 1.8, 1.0, 1.3, 0x9a6b4a);
    const crate = [0x3f78a8, 0xe6e6e0, 0xc9622b, 0x4f8f5a, 0xd9a82c, 0xb98f5a];
    for (let i = 0; i < 12; i++) b.bx(b.paint, crate[i % crate.length], 0.55, 0.4, 0.45, -11.2 + (i * 1.13) % 6.4, 1.6 + (i % 3) * 0.3 - (i % 2) * 0.5, -0.4 + (i * 0.71) % 3.2, i * 0.4);
  });
  b.feature('loader', () => b.at(-4.2, 3.3, -Math.PI / 2 + 0.5, () => loader(b)));
  b.feature('bale-yard', () => {
    const stacks: readonly (readonly [number, number, number[]])[] = [
      [7.2, -11.6, [0xb98f5a, 0xc4a06a]], [7.2, -7.4, [0x3f78a8, 0xe6e6e0]], [11.4, -11.6, [0xb0b6b8, 0x9aa1a3]], [11.4, -7.4, [0xd8d2c0, 0xe6e2d6]]];
    stacks.forEach(([x, z, colors]) => b.at(x, z, 0, () => b.baleStack(2, 2, 3, colors, 0.1)));
    b.at(9.4, -3.9, Math.PI, () => forklift(b));
  });
  b.feature('glass-bays', () => b.at(8.8, 2.9, 0, () => {
    b.bx(b.stone, 0xa9a69e, 8.4, 0.12, 3.4, 0, 0.06, 0);
    b.colored(CONCRETE, () => { for (const x of [-4.2, -1.4, 1.4, 4.2]) b.box(0.3, 2, 3.4, x, 1.1, 0, b.stone); b.box(8.4, 2, 0.3, 0, 1.1, -1.6, b.stone); });
    for (const [x, c] of [[-2.8, 0xdfe6e6], [0, 0x3f78a8], [2.8, 0x4f8f5a]] as const) b.heap(x, 0.12, 0.1, 1.2, 1.1, 1.3, c);
    b.label('ขวดแก้ว', 2, 0.4, 0, 2.4, 1.7, 0, WASTE_GREEN, 0xffffff);
  }));
  b.feature('trailer', () => b.at(12.4, 9.4, 0, () => {
    b.bx(b.paint, 0x3a3f40, 2.2, 0.35, 9.8, 0, 1.0, 0);
    b.bx(b.paint, 0x3f78a8, 2.5, 2.7, 8.6, 0, 2.55, -0.4);
    b.bx(b.paint, shade(0x3f78a8, -0.15), 2.55, 0.2, 8.7, 0, 3.95, -0.4);
    b.colored(DARK, () => { for (const s of [-1, 1]) for (const z of [-3.6, -2.4, -1.2]) b.box(0.3, 0.9, 0.9, s * 1.1, 0.5, z, b.paint); });
    b.label('ขนส่งวัสดุรีไซเคิล', 3.6, 0.5, -1.28, 2.8, -0.4, -Math.PI / 2, WASTE_GREEN, 0xffffff);
  }));
  b.feature('truck', () => b.truck(2.2, 8.8, Math.PI, b.truckColor(1)));
  b.feature('office', () => b.at(-9.6, 9.8, 0, () => b.utilityBuilding(6, 4.6, 3.2, 1.4, 'สำนักงาน')));
  b.feature('bins', () => { BIN_COLORS.forEach((color, i) => { b.bin(-3.6 + i * 0.95, 8.2, color); b.bin(-3.6 + i * 0.95, 9.1, color); }); });
  b.feature('trees', () => { b.shadeTree(0, -13, 3.4, 4.8, 1.1); b.shadeTree(1, 13, 13, 4.4, 1); b.shadeTree(2, -13, -13.2, 4.8, 1.1); });
}

// --- Waste power plant (โรงไฟฟ้าขยะ) ----------------------------------------------------------------------------------

/** The air-cooled condenser (เครื่องควบแน่นระบายความร้อนด้วยอากาศ): an A-frame of finned panels on a raised deck, a fan on top of each bay. */
function condenser(b: WasteBuilder): void {
  const w = 9, d = 6.4, deck = 5.2;
  b.colored(0x6f7774, () => { for (const x of [-w / 2 + 0.3, 0, w / 2 - 0.3]) for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) b.box(0.32, deck, 0.32, x, deck / 2, z, b.paint); });
  b.bx(b.paint, 0x8a9696, w, 0.3, d, 0, deck, 0);
  for (const s of [-1, 1]) b.colored(0xa9b1b3, () => b.slab([point(-w / 2, deck + 0.15, s * d / 2), point(w / 2, deck + 0.15, s * d / 2),
    point(w / 2, deck + 3.2, s * 0.3), point(-w / 2, deck + 3.2, s * 0.3)], 0.12, b.paint));
  b.colored(0x8a9696, () => { for (const x of [-w / 3, 0, w / 3]) b.box(w / 3 - 0.3, 0.5, 1, x, deck + 3.45, 0, b.paint); });
  b.colored(0x4a4f50, () => { for (const x of [-w / 3, 0, w / 3]) b.cylinder(1.25, 0.12, x, deck + 3.78, 0, b.paint, 12); });
  b.bx(b.stone, CONCRETE, w + 1, 0.15, d + 1, 0, 0.075, 0);
}

function wastePowerPlant(b: WasteBuilder): void {
  b.site();
  b.feature('yard', () => b.yard(14.4, 13, -6.8, 7.6));
  frontage(b, 'waste_power_plant', -2.2, 3.4, 9, 7);
  b.feature('bunker-hall', () => b.at(-8.5, -1, 0, () => b.hall(10, 7, 14, HALL_GREY, { door: 6, doorH: 6, doorX: 1.5, sign: 'ลานรับขยะ' })));
  b.feature('boiler-house', () => b.at(-8.5, -9, 0, () => {
    b.hall(10, 8, 23, 0xa7b3ad, { roof: 'flat' });
    b.colored(0x8a8f94, () => { b.cylinder(1, 7, -1, 24.6, 0, b.paint, 10, Math.PI / 2); b.cylinder(0.8, 3, 2.2, 24.7, 1.5, b.paint, 10); });
    b.colored(0x6f7774, () => { for (const x of [-3.5, 1.5]) b.box(0.3, 1.4, 0.3, x, 23.8, 0, b.paint); });
    b.guardRail(9, 0, 23.6, 4.3);
  }));
  b.feature('turbine-hall', () => b.at(3.2, -9.5, 0, () => {
    b.hall(13, 7, 10, 0xb3bfb9, { roof: 'gable', sign: 'อาคารกังหันไอน้ำ', signColor: 0x2f6fa8 });
    b.colored(0x6f7774, () => { b.cylinder(0.7, 5, 1, 10.2, 0, b.paint, 8, Math.PI / 2); });
  }));
  b.feature('condenser', () => b.at(6, -2.4, 0, () => condenser(b)));
  b.steam.push(point(3, 11, -2.4), point(9, 11, -2.4));
  b.feature('bag-filter', () => b.at(12.6, -9.6, 0, () => {
    b.colored(0x6f7774, () => { for (const z of [-3, 3]) b.box(0.2, 1.6, 0.2, 0, 0.8, z, b.paint); });
    b.bx(b.paint, 0x8a9696, 2.6, 4.4, 7, 0, 3.8, 0);
    b.colored(0x7f8a8a, () => { for (const z of [-2.2, 0, 2.2]) b.cylinder(0.8, 1.3, 0, 1.45, z, b.paint, 8); });
    b.bx(b.paint, 0x6f7774, 2.8, 0.3, 7.2, 0, 6.15, 0);
  }));
  b.feature('flue-duct', () => b.pipe([point(8.5, 10.4, -9.6), point(12.6, 10.4, -9.6)], 0.55, 0x8a8f94));
  b.feature('flue-to-stack', () => b.pipe([point(12.6, 6.3, -9), point(12.6, 6.3, -4.2), point(12.8, 1.2, -3.6)], 0.5, 0x8a8f94));
  b.feature('stack', () => b.stack(12.8, -3.2, 36, 1.5, 0.95));
  b.feature('lime-silo', () => b.silo(13, 2.8, 1.2, 8, 0xe6e2d6));
  b.feature('switchyard', () => b.at(9.2, 9.2, 0, () => {
    b.bx(b.stone, 0xa9a69e, 9.4, 0.06, 8.4, 0, 0.09, 0);
    b.transformer(-2.4, -1.6, 0); b.transformer(2.4, -1.6, 0);
    b.colored(0x8d9593, () => { for (const x of [-3.6, 0, 3.6]) b.box(0.22, 6.2, 0.22, x, 3.1, 1.8, b.paint); b.box(7.6, 0.2, 0.2, 0, 6.2, 1.8, b.paint); b.box(7.6, 0.14, 0.14, 0, 5.2, 1.8, b.paint); });
    b.colored(0xb9b4a6, () => { for (const x of [-2.4, 0, 2.4]) b.cylinder(0.1, 0.8, x, 5.6, 1.8, b.paint, 6); });
    b.colored(0x3a3f40, () => { for (const x of [-2.4, 0, 2.4]) b.pole(point(x, 5.2, 1.8), point(x * 0.9, 3.4, -1.0), 0.02, b.paint, 3); });
    b.guardRail(9.2, 0, 0, 4.1);
  }));
  b.feature('control-building', () => b.at(-10.6, 9.6, 0, () => b.utilityBuilding(6, 4.6, 3.6, 1.4, 'ห้องควบคุม', true)));
  b.feature('trucks', () => { b.truck(-2.2, 9, Math.PI, b.truckColor(4)); b.truck(-7, 6.5, 0, b.truckColor(0)); });
  b.feature('trees', () => { b.shadeTree(0, -13, 12.8, 4.8, 1.1); b.shadeTree(1, 4.8, 12.8, 4.4, 1); b.shadeTree(2, 13.2, 13.2, 4.4, 0.9); });
}

// --- Wastewater plant (โรงบำบัดน้ำเสีย) --------------------------------------------------------------------------------

/** A round settling tank (ถังตกตะกอน) of radius r with its scraper bridge, centre drive and the outlet launder. */
function clarifier(b: WasteBuilder, r: number, x: number, z: number): void {
  b.openTank(r, 2.4, x, z);
  b.colored(0x6f7774, () => {
    b.box(r * 2 + 0.4, 0.14, 0.8, x, 2.9, z, b.paint);
    b.box(r * 2 + 0.4, 0.05, 0.05, x, 3.45, z + 0.38, b.paint);
    b.box(r * 2 + 0.4, 0.05, 0.05, x, 3.45, z - 0.38, b.paint);
  });
  b.colored(LADDER, () => { for (const s of [-1, 1]) b.cylinder(0.2, 1, x + s * (r + 0.1), 2.6, z, b.paint, 6); });
  b.bx(b.paint, 0x3f6b55, 1.3, 0.7, 1.3, x, 3.35, z);
  b.colored(0xc9622b, () => b.cylinder(0.16, 0.6, x, 2.7, z, b.paint, 6));
}

/** An aeration basin (ถังเติมอากาศ) w × d: concrete walls, water, a walkway across and rows of surface aerators. */
function basin(b: WasteBuilder, w: number, d: number, h: number, x: number, z: number): void {
  b.colored(CONCRETE, () => {
    for (const s of [-1, 1]) { b.box(w, h, 0.3, x, h / 2, z + s * (d / 2 - 0.15), b.stone); b.box(0.3, h, d - 0.6, x + s * (w / 2 - 0.15), h / 2, z, b.stone); }
  });
  b.flat(w - 0.6, d - 0.6, x, z, h - 0.45, b.water());
  b.bx(b.stone, STONE, 1.2, 0.14, d, x - w * 0.18, h + 0.07, z);
  b.guardRail(d, x - w * 0.18 - 0.55, h + 0.14, z, Math.PI / 2);
  b.guardRail(d, x - w * 0.18 + 0.55, h + 0.14, z, Math.PI / 2);
  b.colored(0x3f6b55, () => { for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const ax = x + w * 0.1 + i * (w * 0.2), az = z + s * d * 0.22;
    b.cylinder(0.5, 0.25, ax, h - 0.25, az, b.paint, 10); b.cylinder(0.12, 0.5, ax, h + 0.05, az, b.paint, 6);
  } });
  b.colored(0xe9e5d6, () => { for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.cylinder(0.3, 0.06, x + w * 0.1 + i * (w * 0.2), h - 0.1, z + s * d * 0.22, b.paint, 8); });
}

/** The screening channel (ห้องดักขยะ) w long along X: walls, water, three bar screens leaning in it, a rake gantry, a skip. */
function screens(b: WasteBuilder, w: number): void {
  b.colored(CONCRETE, () => { for (const s of [-1, 1]) b.box(w, 1.8, 0.3, 0, 0.9, s * 0.85, b.stone); b.box(0.3, 1.8, 1.7, -w / 2, 0.9, 0, b.stone); });
  b.flat(w - 0.3, 1.4, 0.1, 0, 1.2, b.water());
  b.colored(0x6f7774, () => { for (const x of [-w * 0.25, 0, w * 0.25]) { b.pole(point(x, 1.9, -0.7), point(x + 0.5, 1.2, 0.7), 0.04, b.paint, 4); b.pole(point(x - 0.15, 1.9, -0.7), point(x + 0.35, 1.2, 0.7), 0.04, b.paint, 4); } });
  b.colored(RAIL, () => b.box(w - 0.4, 0.07, 0.07, 0.1, 2.35, 0.95, b.paint));
  b.bx(b.paint, 0x3f6b55, 0.9, 0.6, 1.1, -w * 0.25, 2.4, 0);
  b.at(w / 2 + 1.5, 0, 0, () => b.skip(0, 0, 0, 0x4a6b86));
}

/** The chlorine contact tank (ถังสัมผัสคลอรีน): a serpentine channel of two baffles under a plank walkway. */
function contactTank(b: WasteBuilder, w: number, d: number, x: number, z: number): void {
  b.colored(CONCRETE, () => {
    for (const s of [-1, 1]) { b.box(w, 1.7, 0.3, x, 0.85, z + s * (d / 2 - 0.15), b.stone); b.box(0.3, 1.7, d - 0.6, x + s * (w / 2 - 0.15), 0.85, z, b.stone); }
    b.box(w * 0.7, 1.7, 0.2, x + w * 0.12, 0.85, z - d * 0.16, b.stone); b.box(w * 0.7, 1.7, 0.2, x - w * 0.12, 0.85, z + d * 0.16, b.stone);
  });
  b.flat(w - 0.6, d - 0.6, x, z, 1.3, b.water());
  b.guardRail(w, x, 1.7, z + d / 2 - 0.1);
  b.label('สัมผัสคลอรีน', 2.2, 0.4, x - w / 2 + 1.7, 1.2, z + d / 2 + 0.2, 0, 0x2f6fa8, 0xffffff);
}

/** The sludge digester (ถังหมักตะกอน) of radius r: a cylinder under a gas dome, a ladder, a gas pipe to the flare. */
function digester(b: WasteBuilder, r: number, h: number, x: number, z: number): void {
  b.shell([[r, 0.25], [r, h], [r * 0.7, h + r * 0.35], [r * 0.3, h + r * 0.5], [0.001, h + r * 0.52]], x, 0, z, 20, 0xd9d6cc);
  b.colored(0x9fa6a4, () => { b.cylinder(r + 0.05, 0.2, x, 0.35, z, b.stone, 20); b.cylinder(r + 0.05, 0.16, x, h * 0.55, z, b.stone, 20); });
  b.ladder(x, z - r - 0.05, 0.3, h + 0.2, Math.PI, false);
  b.pipe([point(x + r * 0.5, h + r * 0.4, z), point(x + r * 1.1, h + r * 0.4, z), point(x + r * 1.1, 0.5, z)], 0.12, 0x3a3f40);
  b.label('ถังหมัก', 1.6, 0.4, x, h * 0.55 - 0.7, z + r + 0.04, 0, 0x4f7f3d, 0xffffff);
}

/** Sludge drying beds (ลานตากตะกอน): n sand beds in brick edges under one low sheet roof, open on the front. */
function dryingBeds(b: WasteBuilder, n: number): void {
  const bed = 3.6, w = n * bed + 0.3, d = 5;
  b.bx(b.stone, 0xa9a69e, w, 0.12, d, 0, 0.06, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.15 + (i + 0.5) * bed;
    b.colored(0x9a5a3c, () => { b.box(bed - 0.1, 0.4, 0.16, x, 0.3, -d / 2 + 0.3, b.paint); b.box(bed - 0.1, 0.4, 0.16, x, 0.3, d / 2 - 0.3, b.paint); });
    b.flat(bed - 0.4, d - 0.9, x, 0, 0.36, b.paint, i % 2 ? 0x8a7a5a : 0xb7aa86);
  }
  b.colored(0x9a5a3c, () => { for (let i = 0; i <= n; i++) b.box(0.16, 0.4, d - 0.6, -w / 2 + 0.15 + i * bed, 0.3, 0, b.paint); });
  b.colored(0x6f7774, () => { for (let i = 0; i <= n; i++) for (const s of [-1, 1]) b.box(0.12, 2.6, 0.12, -w / 2 + 0.15 + i * bed, 1.4, s * (d / 2 - 0.15), b.paint); });
  b.sheetGable(w + 0.6, d + 0.6, 2.7, 0.9, 0xc9cdc9);
}

function wastewaterPlant(b: WasteBuilder): void {
  b.site();
  b.feature('yard', () => b.yard(10, 24, -0.6, 1.2, 0xa9a69e));
  frontage(b, 'wastewater_plant', -0.5, -2.4, 9.2, 7);
  b.feature('screens', () => b.at(-8.4, 2.4, 0, () => screens(b, 6.4)));
  b.feature('grit-chamber', () => b.at(-3.8, 3.6, 0, () => { b.openTank(1.5, 1.6, 0, 0); b.guardRail(2.6, 0, 1.6, 0); }));
  b.feature('primary-clarifier', () => clarifier(b, 4.2, -9.2, -8.2));
  b.feature('aeration-basin', () => basin(b, 14.6, 7.4, 3, 3.8, -10.2));
  b.feature('secondary-clarifier', () => clarifier(b, 4.4, 9, -1.4));
  b.feature('contact-tank', () => contactTank(b, 6.4, 3.4, 4.2, 5.4));
  b.feature('digester', () => digester(b, 2.5, 6, 11, 10.6));
  b.feature('drying-beds', () => b.at(-7.6, 9.8, 0, () => dryingBeds(b, 3)));
  b.feature('blower-house', () => b.at(-3.6, -2.6, 0, () => b.utilityBuilding(4.4, 3.6, 3.2, 1.2, 'ห้องเป่าลม')));
  b.feature('lab-building', () => b.at(5.4, 10.6, 0, () => b.utilityBuilding(5.4, 4.2, 3.4, 1.4, 'ห้องปฏิบัติการ', true)));
  b.feature('pipes', () => {
    const brown = 0x6b4a33;
    b.pipe([point(-5.2, 0.55, 2.4), point(-5.2, 0.55, -0.4), point(-9.2, 0.55, -3.6)], 0.22, brown);
    b.pipe([point(-4.9, 0.55, -8.2), point(-4.1, 0.55, -8.2), point(-3.5, 0.55, -8.2)], 0.2, brown);
    b.pipe([point(11.2, 0.55, -10.2), point(11.6, 0.55, -6.6), point(10.4, 0.55, -5.4)], 0.2, brown);
    b.pipe([point(9, 0.55, 3.2), point(8.2, 0.55, 5.4), point(7.5, 0.55, 5.4)], 0.2, PIPE);
    b.pipe([point(1, 0.55, 6), point(-0.4, 0.55, 8.6), point(-0.4, 0.55, 12)], 0.22, PIPE);
    for (const [x, z] of [[-5.2, 1.2], [11.4, -8.4], [8.4, 4.4]] as const) b.saddle(x, z, 0.4);
    b.valve(-0.4, 0.6, 10.2, Math.PI, 0.18);
  });
  b.feature('outfall', () => b.at(-9.4, 12.6, 0, () => {
    b.flat(4.4, 1.6, 0, 0, 0.2, b.water());
    b.colored(0x7a6850, () => { for (const s of [-1, 1]) b.box(4.8, 0.3, 0.3, 0, 0.15, s * 0.95, b.paint); });
  }));
  b.feature('car-park', () => { b.parkedCar(9, 6.3, 0xe8e6df, Math.PI); b.parkedBike(11.8, 5.8, 0x2f5f8a, Math.PI); });
  b.feature('trees', () => { b.shadeTree(0, -13, -13, 5, 1.1); b.shadeTree(1, 13, 13.2, 4.6, 1); b.shadeTree(2, 13.2, -13, 4.8, 1.1); });
}

const LAYOUTS: Readonly<Record<WasteModelKind, (b: WasteBuilder) => void>> = {
  landfill, incinerator, recycling_plant: recyclingPlant, waste_power_plant: wastePowerPlant, wastewater_plant: wastewaterPlant,
};

/** waste.<kind>: one plant; the seed tints the plaster, picks the truck paint and turns the trees, never the buildings. */
export function createWaste(kind: WasteModelKind, options: ModelOptions = {}) {
  const b = new WasteBuilder(options);
  LAYOUTS[kind](b);
  return b.finishWaste(wasteId(kind), kind, {
    signText: WASTE_SIGNS[kind], building: kind, floors: WASTE_FLOORS[kind], variantLabel: LABELS[kind][0], variantLabelEn: LABELS[kind][1],
    smokeAnchors: b.smoke.length, steamAnchors: b.steam.length, fireAnchors: b.fire.length,
  });
}
