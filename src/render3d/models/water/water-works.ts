/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The water works (โรงผลิตน้ำประปา, docs/WATER_PLAN.md, RENDERER_SPEC 6C): tiles 956–964, centre 960 with ZONEBIT, a 3×3
// laid out like every 3×3 building. Raw water comes in from the back, falls down a cascade aerator, winds through a
// flocculation channel, settles in a round clarifier, runs through four sand filters and is stored in a covered
// clear-water tank; the pump house lifts it to the elevated tank and the town's mains. A chemical building doses alum
// and chlorine. Tier R3, front +Z (the gate). The sign says only what the place is: no real utility's name or emblem.

import { point } from '../../regional/geometry.js';
import { PAVING, STONE, shade, spread } from '../civic/builder.js';
import { CONCRETE, GLASS, LADDER, PIPE, RAIL, WaterBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const WATER_WORKS_ID = 'water.works';
export const WATER_WORKS_TILES = Array.from({ length: 9 }, (_, i) => 956 + i);
export const WATER_WORKS_SIGN = 'โรงผลิตน้ำประปา';
/** The elevated tank's top, for the far view and the camera */
export const WATER_WORKS_TOWER_TOP = 17.6;

/** The cascade aerator (หอเติมอากาศ): four stepped trays over a collecting basin, raw water rising up the middle. */
function aerator(b: WaterBuilder): void {
  b.bx(b.stone, CONCRETE, 5, 0.9, 5, 0, 0.45, 0);
  b.flat(4.4, 4.4, 0, 0, 0.92, b.water());
  [3.6, 2.8, 2, 1.2].forEach((w, i) => {
    const top = 1.4 + i * 0.55;
    b.bx(b.stone, shade(CONCRETE, -0.03 * i), w, 0.18, w, 0, top - 0.09, 0);
    b.flat(w - 0.2, w - 0.2, 0, 0, top + 0.01, b.water());
    b.colored(CONCRETE, () => { for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.14, 0.55, 0.14, x * (w / 2 - 0.2), top - 0.36, z * (w / 2 - 0.2), b.stone); });
  });
  b.pipe([point(0, 0.9, 0), point(0, 3.3, 0)], 0.16);
}

/** The flocculation channel (ถังกวนตะกอน) w × d along X: concrete walls, water, baffles that make it wind, a walkway. */
function flocculator(b: WaterBuilder, w: number, d: number): void {
  const h = 1.9;
  for (const s of [-1, 1]) {
    b.bx(b.stone, CONCRETE, w, h, 0.25, 0, h / 2, s * (d / 2 - 0.125));
    b.bx(b.stone, CONCRETE, 0.25, h, d - 0.5, s * (w / 2 - 0.125), h / 2, 0);
  }
  b.flat(w - 0.5, d - 0.5, 0, 0, h - 0.3, b.water());
  b.colored(shade(CONCRETE, -0.04), () => {
    spread(w - 1.4, 1.8, 0).forEach((x, i) => b.box(0.15, h - 0.2, d - 1.3, x, (h - 0.2) / 2, (i % 2 ? 0.4 : -0.4), b.stone));
  });
  b.bx(b.stone, STONE, w, 0.12, 0.9, 0, h + 0.06, -d / 2 + 0.45);
  b.guardRail(w - 0.2, 0, h + 0.12, -d / 2 + 0.85);
}

/** Four rapid sand filters (ถังกรองทราย) in a row along X, front +Z, with their pipe gallery in front and its sheet roof. */
function filters(b: WaterBuilder): void {
  const cell = 2.6, n = 4, w = cell * n + 0.25, d = 2.9, h = 2.2;
  b.colored(CONCRETE, () => {
    for (let i = 0; i <= n; i++) b.box(0.25, h, d, -w / 2 + 0.125 + i * cell, h / 2, -d / 2, b.stone);
    for (const z of [-d, 0]) b.box(w, h, 0.25, 0, h / 2, z + (z ? 0.125 : -0.125), b.stone);
  });
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.125 + (i + 0.5) * cell;
    b.flat(cell - 0.3, d - 0.5, x, -d / 2, h - 0.45, b.water(), undefined);
    b.flat(cell - 0.3, 0.5, x, -d + 0.4, h - 0.3, b.stone, 0x8f8a7c);
  }
  b.guardRail(w - 0.3, 0, h, 0.15);
  // The pipe gallery (ห้องท่อ) under the operating floor, open at the front, wheels on its face
  b.bx(b.stone, CONCRETE, w, h, 2.2, 0, h / 2, 1.1 + 0.02);
  b.quad(w - 1.2, 1.2, 0, 1.2, 2.24, GLASS);
  for (let i = 0; i < n; i++) b.valve(-w / 2 + 0.125 + (i + 0.5) * cell, 0.9, 2.25, 0, 0.16);
  // The filter beds stay open to the sky; a lean-to shelters the operating floor and its control desks
  b.colored(0xc9cdc9, () => b.panel([point(-w / 2 - 0.3, h + 2.4, 2.6), point(w / 2 + 0.3, h + 2.4, 2.6),
    point(w / 2 + 0.3, h + 2.9, -0.2), point(-w / 2 - 0.3, h + 2.9, -0.2)], point(0, 2.8, 0.5).normalize(), 0.06, b.sheet));
  b.colored(LADDER, () => {
    for (const x of [-w / 2 + 0.1, 0, w / 2 - 0.1]) for (const z of [0.1, 2.4]) b.box(0.12, z > 1 ? 2.4 : 2.85, 0.12, x, h + (z > 1 ? 1.2 : 1.42), z, b.paint);
  });
  b.colored(0x5a6466, () => { for (const x of [-2.6, 2.6]) b.box(1.2, 1, 0.5, x, h + 0.62, 1.6, b.paint); });
  b.label('ถังกรองน้ำ', 2.4, 0.4, w / 2 - 1.6, 1.9, 2.26, 0, 0x2f6fa8, 0xffffff);
}

/** The covered clear-water tank (ถังน้ำใส): a round concrete reservoir with a shallow domed roof, vents, a ladder. */
function clearWaterTank(b: WaterBuilder, r: number): void {
  const h = 3;
  b.shell([[r, 0], [r, h], [r + 0.15, h], [r + 0.15, h + 0.2], [r * 0.7, h + 0.5], [0.5, h + 0.75], [0.001, h + 0.76]], 0, 0, 0, 28, 0xc4c1b8);
  b.colored(0x9fa6a4, () => {
    for (const [x, z] of [[-1.8, -1.2], [1.6, 1.4]]) {
      b.cylinder(0.12, 0.8, x, h + 0.9, z, b.paint, 6);
      b.cylinder(0.32, 0.14, x, h + 1.32, z, b.paint, 8);
    }
  });
  b.ladder(0, -r - 0.05, 0.05, h + 0.2, Math.PI);
  b.at(0, 0, 0, () => b.guardRail(2, 0, h + 0.25, -r + 0.5));
  b.bx(b.stone, CONCRETE, 1.6, 0.8, 1.2, r * 0.45, h + 0.6, r * 0.2);
  b.label('ถังน้ำใส', 2.2, 0.45, 0, 1.9, r + 0.04, 0, 0x2f6fa8, 0xffffff);
}

/** The elevated tank (หอถังสูง): a fluted concrete shaft with a door, a balcony and a cone-bottomed tank with its sign. */
function elevatedTank(b: WaterBuilder): void {
  const shaft = 1.1, base = 11.5, top = WATER_WORKS_TOWER_TOP;
  b.bx(b.stone, STONE, 3.4, 0.4, 3.4, 0, 0.2, 0);
  b.shell([[shaft + 0.2, 0.4], [shaft, 1.2], [shaft, base], [3.1, base + 2.2], [3.1, base + 4.6], [3.2, base + 4.7],
    [2.6, top - 0.2], [0.6, top], [0.001, top + 0.02]], 0, 0, 0, 20, 0xd7d6cf);
  b.colored(0x2f6fa8, () => b.cylinder(3.13, 0.5, 0, base + 3.85, 0, b.paint, 20));
  b.colored(shade(CONCRETE, 0.05), () => b.cylinder(3.6, 0.15, 0, base + 2.3, 0, b.stone, 20));
  b.colored(RAIL, () => b.cylinder(3.58, 0.05, 0, base + 3.25, 0, b.paint, 20));
  b.colored(RAIL, () => { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.box(0.05, 0.95, 0.05, Math.sin(a) * 3.55, base + 2.8, Math.cos(a) * 3.55, b.paint); } });
  b.quad(1, 2.1, 0, 1.45, shaft + 0.02, 0x4f5f63);
  b.label('การประปา', 2.6, 0.62, 0, base + 3.85, 3.2, 0, 0x2f6fa8, 0xffffff);
  b.pipe([point(1.6, 0.4, 0), point(1.6, 0.4, 0.6), point(shaft + 0.25, 0.9, 0.6), point(shaft + 0.25, base + 1, 0.6)], 0.16);
}

/** The pump house (อาคารสูบน้ำ) with its high-lift pumps showing through the open side, mains in and out. */
function pumpHouse(b: WaterBuilder): void {
  const w = 6, d = 5, h = 4;
  b.utilityBuilding(w, d, h, 1.6, 'อาคารสูบน้ำ');
  // Two booster pumps on plinths outside its west wall, under a lean-to, and a louvred vent
  b.bx(b.stone, CONCRETE, 1.4, 0.2, 3.2, -w / 2 - 0.85, 0.1, -0.4);
  b.colored(0x3f6b55, () => { for (const z of [-1.2, 0.4]) b.box(1, 0.6, 0.6, -w / 2 - 0.85, 0.5, z, b.paint); });
  b.colored(PIPE, () => { for (const z of [-1.2, 0.4]) b.cylinder(0.26, 0.8, -w / 2 - 0.85, 1.05, z, b.paint, 10); });
  b.colored(0x7f8a88, () => b.panel([point(-w / 2 - 1.7, 2.4, 1.4), point(-w / 2, 2.8, 1.4), point(-w / 2, 2.8, -2.2), point(-w / 2 - 1.7, 2.4, -2.2)],
    point(-0.4, 1.7, 0).normalize(), 0.05, b.sheet));
  b.colored(0xd8d6ce, () => b.box(0.06, 0.8, 0.5, w / 2 + 0.03, 0.3 + h - 1.2, 1.4, b.paint));
}

/** The chemical building (อาคารจ่ายสารเคมี): two storeys, an outside stair, alum tanks and chlorine cylinders beside it. */
function chemicalBuilding(b: WaterBuilder): void {
  const w = 5.6, d = 6.4, h = 6.4;
  b.utilityBuilding(w, d, h, 1.4, 'อาคารสารเคมี', true);
  b.bx(b.paint, shade(b.wall, -0.08), w + 0.08, 0.22, d + 0.08, 0, 3.5, 0);
  b.colored(STONE, () => {
    b.slab([point(w / 2 + 0.1, 0.3, d / 2 - 0.2), point(w / 2 + 1.1, 0.3, d / 2 - 0.2), point(w / 2 + 1.1, 3.5, -d / 2 + 2.4), point(w / 2 + 0.1, 3.5, -d / 2 + 2.4)], 0.2);
    b.box(1.1, 0.2, 1.8, w / 2 + 0.6, 3.4, -d / 2 + 1.5, b.stone);
  });
  b.colored(RAIL, () => {
    b.pole(point(w / 2 + 1.12, 1.25, d / 2 - 0.2), point(w / 2 + 1.12, 4.45, -d / 2 + 2.4), 0.03, b.paint, 4);
    for (const t of [0, 0.5, 1]) b.box(0.05, 0.95, 0.05, w / 2 + 1.12, 0.78 + t * 3.2, d / 2 - 0.2 - t * (d - 2.6), b.paint);
  });
  b.at(w / 2, 0, Math.PI / 2, () => b.quad(0.9, 2.1, d / 2 - 1.5, 3.6 + 1.05, 0.02, 0x4f5f63));
  b.colored(0x3b7fb0, () => { for (const z of [-1.8, 0.2]) b.cylinder(0.72, 2.2, -w / 2 - 0.95, 1.1, z, b.paint, 12); });
  b.colored(0xd9d4c4, () => { for (const z of [-1.8, 0.2]) b.cylinder(0.74, 0.08, -w / 2 - 0.95, 2.24, z, b.paint, 12); });
  b.colored(0xe1c13a, () => { for (const x of [0.9, 1.6, 2.3]) b.cylinder(0.24, 1.3, x, 0.95, d / 2 + 0.6, b.paint, 8); });
  b.colored(0x6f7774, () => b.box(2.3, 0.08, 0.7, 1.6, 0.34, d / 2 + 0.6, b.paint));
}

/** The plain gate on the front fence: two plastered pillars, the sign on a beam between them, steel leaves slid open. */
function gate(b: WaterBuilder, x: number, opening: number): void {
  const z = 13.75, half = opening / 2 + 0.35, h = 2.6;
  for (const s of [-1, 1]) {
    b.bx(b.paint, b.wall, 0.6, h, 0.6, x + s * half, h / 2, z);
    b.bx(b.paint, 0x2f6fa8, 0.7, 0.14, 0.7, x + s * half, h + 0.07, z);
    b.lantern(x + s * half, z, 0.2, h + 0.14);
    b.at(x + s * (half + 0.4 + opening / 4), z - 0.35, 0, () => b.colored(0x6f7774, () => {
      for (const y of [0.15, 1.65]) b.box(opening / 2, 0.07, 0.06, 0, y, 0, b.paint);
      for (const px of spread(opening / 2, 0.4, 0.03)) b.box(0.04, 1.5, 0.04, px, 0.9, 0, b.paint);
    }));
  }
  b.bx(b.paint, 0x2f6fa8, opening + 1.4, 0.5, 0.36, x, h - 0.1, z);
  b.label(WATER_WORKS_SIGN, opening + 1, 0.4, x, h - 0.1, z + 0.2, 0, 0x2f6fa8, 0xffffff);
}

/** A chain-link fence (รั้วตาข่าย) on concrete posts round the works, open at the gate. */
function fence(b: WaterBuilder, gateX: number, opening: number, e = 14.1): void {
  const run = (length: number, x: number, z: number, yaw: number): void => b.at(x, z, yaw, () => {
    b.bx(b.stone, CONCRETE, length, 0.3, 0.16, 0, 0.15, 0);
    b.colored(0x8d9593, () => { for (const y of [0.9, 1.5, 2.05]) b.box(length, 0.03, 0.03, 0, y, 0, b.paint); });
    b.colored(CONCRETE, () => { for (const px of spread(length, 3, 0.1)) b.box(0.14, 2.2, 0.14, px, 1.1, 0, b.stone); });
  });
  const g0 = gateX - opening / 2 - 0.65, g1 = gateX + opening / 2 + 0.65;
  run(g0 + e, (g0 - e) / 2, e, 0); run(e - g1, (g1 + e) / 2, e, 0); run(2 * e, 0, -e, 0);
  for (const s of [-1, 1]) run(2 * e - 0.2, s * e, 0, Math.PI / 2);
}

/** water.works: the whole plant on one 3×3; the seed only tints the plaster and turns the trees. */
export function createWaterWorks(options: ModelOptions = {}) {
  const b = new WaterBuilder(options);
  b.feature('site', () => b.box(29, 0.06, 29, 0, 0.03, 0, b.grass));
  b.feature('roads', () => {
    b.bx(b.stone, PAVING, 3, 0.05, 9.3, 2.6, 0.085, 9.45);
    b.bx(b.stone, PAVING, 17.1, 0.05, 2.4, -4.45, 0.085, 3.6);
  });
  b.feature('raw-water-main', () => {
    b.pipe([point(-10.6, 0.5, -14.4), point(-10.6, 0.5, -11.2)], 0.24, 0x5b6a70);
    b.saddle(-10.6, -13.4, 0.3);
  });
  b.feature('aerator', () => b.at(-10.6, -10.9, 0, () => aerator(b)));
  b.feature('flocculation-channel', () => b.at(-2.4, -11.5, 0, () => flocculator(b, 9.4, 3.8)));
  b.feature('clarifier', () => {
    b.openTank(4.9, 2.2, 8.4, -8.6);
    b.colored(RAIL, () => b.box(0.06, 0.06, 4.6, 8.4, 3.15, -8.6 + 2.3, b.paint));
    b.bx(b.stone, STONE, 0.9, 0.12, 4.8, 8.4, 2.3, -8.6 + 2.4);
    b.bx(b.paint, 0x7f8a88, 1.2, 0.6, 1.2, 8.4, 2.1, -8.6);
    b.guardRail(4.6, 8.4 + 0.5, 2.36, -8.6 + 2.4, Math.PI / 2);
  });
  b.feature('filters', () => b.at(0, -1.3, 0, () => filters(b)));
  b.feature('clear-water-tank', () => b.at(9.2, 8.8, 0, () => clearWaterTank(b, 4.6)));
  b.feature('pump-house', () => b.at(-2.6, 8, 0, () => pumpHouse(b)));
  b.feature('chemical-building', () => b.at(-9.4, -3.6, 0, () => chemicalBuilding(b)));
  b.feature('elevated-tank', () => b.at(-10.4, 9.4, 0, () => elevatedTank(b)));
  b.feature('mains', () => {
    // aerator → channel → clarifier → filters → clear-water tank; under the road to the pumps; up the tower
    b.pipe([point(-7.1, 0.6, -11.4), point(-8.1, 0.6, -11.4)], 0.18);
    b.pipe([point(2.3, 0.6, -11.4), point(3.9, 0.6, -10.6)], 0.18);
    b.pipe([point(5.2, 0.6, -5.5), point(4.6, 0.6, -4.9), point(4.6, 0.6, -4.5)], 0.2);
    b.pipe([point(5, 0.6, 1), point(5.6, 0.6, 3.2), point(5.6, 0.6, 5.9)], 0.2);
    b.pipe([point(4.6, 0.6, 8.8), point(4.5, 0.6, 8.8), point(4.5, 0.12, 8.8)], 0.22);
    b.pipe([point(0.75, 0.12, 8), point(0.75, 0.6, 8), point(0.4, 0.6, 8)], 0.22);
    for (const [x, z] of [[4.5, 8.8], [0.75, 8]] as const) b.bx(b.stone, CONCRETE, 0.7, 0.16, 1, x, 0.08, z);
    b.pipe([point(-6.45, 0.6, 6.8), point(-8.8, 0.6, 6.8), point(-8.8, 0.4, 9.4)], 0.2);
    for (const [x, z] of [[4.6, -4.9], [5.6, 3.2], [-7.8, 6.8]] as const) b.saddle(x, z, 0.42);
    b.valve(5.6, 0.6, 4.6, -Math.PI / 2, 0.2);
    b.valve(-8.8, 0.6, 7.9, -Math.PI / 2, 0.2);
  });
  b.feature('gate', () => gate(b, 2.6, 4));
  b.feature('fence', () => fence(b, 2.6, 4));
  b.feature('trees', () => {
    b.shadeTree(0, -10.4, 12.9, 4.6, 1.1); b.shadeTree(1, 12.7, 0.8, 5, 1.1); b.shadeTree(2, -3.6, 12.6, 4.4, 0.9);
  });
  b.feature('hedge', () => b.at(-6.6, 13.2, 0, () => b.take(b.kit.gardenPlant('hedge', { seed: b.seed + 5 }))));
  return b.finishWater(WATER_WORKS_ID, [3, 3], WATER_WORKS_TILES, {
    centerTile: 960, signText: WATER_WORKS_SIGN, towerTop: WATER_WORKS_TOWER_TOP,
    stages: ['aerator', 'flocculation-channel', 'clarifier', 'filters', 'clear-water-tank', 'pump-house', 'elevated-tank'],
  });
}
