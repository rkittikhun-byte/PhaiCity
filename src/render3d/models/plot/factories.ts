/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { ConeGeometry } from 'three';
import { vertexFinish } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { PlotBuilder, weather } from './builder.js';
import { CARS } from './homes.js';

const DRUMS = [0x2f5c9a, 0xb33a2e, 0x3f7d4f, 0xd6a23c] as const;
const GOODS = [0xc9a46b, 0xd8cdb5, 0x9b7a55, 0x7e9aa6] as const;

/** Precast concrete panels between posts along the front edge, with a gap for the gate. */
export function frontFence(b: PlotBuilder, from: number, to: number, color: number, z = 4.33): void {
  const w = to - from, posts = Math.max(1, Math.round(w / 1.8)), inset = w - 0.22;
  b.tone(color, w - 0.1, 1.6, 0.1, (from + to) / 2, 0.85, z);
  for (let n = 0; n <= posts; n++) b.tone(weather(color, 0), 0.22, 1.85, 0.22, from + 0.11 + n * inset / posts, 0.925, z);
}

/** A pole-mounted transformer (เสาหม้อแปลง): two concrete poles, a platform, the tank and its insulators. */
export function transformer(b: PlotBuilder, x: number, z: number): void {
  b.colored(0xb8b5ac, () => { for (const dx of [-0.45, 0.45]) b.cylinder(0.11, 7.2, x + dx, 3.6, z, b.stone, 8); });
  b.tone(0x6b7172, 1.3, 0.1, 0.5, x, 4.2, z, b.metal);
  b.tone(0x8e9a95, 0.62, 0.85, 0.5, x, 4.68, z);
  b.tone(0x6b7172, 1.2, 0.1, 0.1, x, 6.9, z, b.metal);
  b.colored(0x5b4636, () => { for (const dx of [-0.18, 0, 0.18]) b.cylinder(0.05, 0.3, x + dx, 5.25, z, b.paint, 6); });
}

/** A gate guard booth (ป้อมยาม) with a window to the street and a slab roof. */
export function booth(b: PlotBuilder, x: number, z: number, color: number): void {
  b.body(color, 1.1, 2.2, 0.9, x, 0.06, z, 0);
  b.tone(0x7d8486, 1.4, 0.1, 1.0, x, 2.32, z);
  b.box(0.8, 0.7, 0.04, x, 1.45, z + 0.47, b.glass);
  b.tone(0x3a3f40, 0.04, 1.8, 0.6, x - 0.57, 0.96, z);
}

/** A forklift, forks to −Z at yaw 0. */
export function forklift(b: PlotBuilder, x: number, z: number, yaw = 0): void {
  b.at(x, 0.06, z, yaw, () => {
    b.tone(0xe0a92c, 1.1, 1.0, 1.7, 0, 0.75, 0.2, b.metal);
    b.tone(0x2b2f30, 0.9, 0.08, 0.9, 0, 2.15, 0.4, b.metal);
    for (const dx of [-0.42, 0.42]) b.tone(0x2b2f30, 0.07, 2.05, 0.07, dx, 1.12, 0.62, b.metal);
    for (const dx of [-0.42, 0.42]) b.tone(0x3b3f40, 0.1, 2.3, 0.1, dx, 1.2, -0.72, b.metal);
    for (const dx of [-0.25, 0.25]) b.tone(0x5b6061, 0.1, 0.05, 1.0, dx, 0.1, -1.2, b.metal);
    b.colored(0x1f2222, () => { for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.75]) b.cylinder(0.24, 0.18, dx, 0.24, dz, b.fabric, 7, Math.PI / 2); });
  });
}

/** Pallets stacked with sacks or boxes. */
export function pallet(b: PlotBuilder, x: number, y: number, z: number, layers = 2): void {
  b.tone(0x8a6e4e, 1.1, 0.14, 1.1, x, y + 0.07, z);
  for (let n = 0; n < layers; n++) b.tone(b.pick(GOODS), 1.0, 0.4, 1.0, x, y + 0.34 + n * 0.42, z, b.fabric);
}

/** Level 1: a car-repair garage (อู่ซ่อมรถ): two bays under the kit's regional roof, a service canopy over the yard,
 * a car on the forecourt, tyres and oil drums. R2. Variant 0 is an old laterite-yard workshop, 1 a tidy one. */
export function garage(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, land = b.land, worn = land === 0, seed = b.options.seed ?? 1, palette = kit.neutralPalette(seed);
  const W = 8.6, back = -4.0, front = 0.9, sd = front - back, sz = (front + back) / 2, eave = 4.4;
  const wall = worn ? b.vary(0xbfb7a3) : palette.wall, trim = worn ? 0x6d6a60 : weather(palette.trim, 1), roofKey = worn ? 'roof_metal_rusty' : 'roof_metal_corrugated';
  const name = b.pick(['อู่ช่างเล็ก', 'อู่ซ่อมรถบ้านสวน', 'อู่ลานช่าง', 'ศูนย์ซ่อมรถริมทาง']);
  b.feature('workshop-shed', () => {
    b.body(wall, W, eave, sd, 0, 0, sz, worn ? 0.32 : 0.06);
    b.tone(trim, W + 0.04, 0.32, 0.12, 0, 3.6, front + 0.06);
    for (const x of [-2.5, 1.1]) b.tone(0x252827, 3.2, 3.3, 0.04, x, 1.75, front + 0.02);
    b.tone(weather(0x9fa7a8, land), 3.2, 1.4, 0.06, 1.1, 2.7, front + 0.06, b.metal);
    b.tone(0x8a9192, 3.3, 0.3, 0.3, 1.1, 3.4, front + 0.16, b.metal);
    b.colored(weather(0x8f9798, land), () => { for (const y of [2.3, 2.75, 3.15]) b.box(3.2, 0.04, 0.03, 1.1, y, front + 0.1, b.metal); });
    b.framed(0.5, 1.0, 3.98, 1.2, front, trim, { grille: worn ? 0x3a3e3f : 0 });
    b.tone(0x3a3f40, 0.8, 2.0, 0.05, 3.2, 1.0, front + 0.025);
    b.lamp(-4.0, 3.25, front); b.lamp(2.95, 3.25, front);
    b.gutter(W - 0.1, 0, eave - 0.06, front + 0.37, front + 0.08, weather(0x7d8486, land), [-4.2, 4.36]);
    for (const x of [-2.5, 2.5]) b.pane(1.4, 0.9, x, 3.0, back - 0.02, b.glass, Math.PI);
  });
  b.feature('regional-roof', () => b.ridgeRoof(kit.defaults.roofForm, W, sd, eave, sz, { pitch: Math.min(26, kit.defaults.pitch / 2),
    overhang: 0.3, material: roofKey, wall, trim }));
  b.feature('service-canopy', () => {
    b.tilt(worn ? 0x9b8a76 : 0xc4cbcc, 5.4, 0.06, 2.6, -1.4, 3.42, front + 1.3, 0.12, vertexFinish(roofKey));
    for (const x of [-3.9, 1.1]) b.tone(0x6b7172, 0.1, 3.25, 0.1, x, 1.625, front + 2.5, b.metal);
  });
  b.feature('yard-and-cars', () => {
    b.tone(worn ? 0xb47452 : 0xb9b5ab, 8.8, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
    const car = b.pick(CARS);
    if (worn) {
      b.auto(-2.2, front + 1.25, car, Math.PI / 2);
      // Bonnet up over the engine, nose to the street side of the bay.
      b.at(-2.2, 0.05, front + 1.25, Math.PI / 2, () => { b.tilt(car, 1.5, 0.05, 1.05, 0, 1.55, 1.75, -0.95, b.metal); b.tone(0x3a3f40, 1.1, 0.35, 0.9, 0, 1.0, 1.4, b.metal); });
    } else b.auto(-1.9, front + 1.25, car, Math.PI / 2, true);
    b.scooter(1.7, 2.5, b.pick([0xb23a32, 0x2f5f9a, 0x2b2d2e]), 0.1);
    b.colored(0x6b5a46, () => { b.box(0.8, 0.06, 0.5, 3.85, 0.85, 1.55, b.paint); for (const dx of [-0.35, 0.35]) b.box(0.06, 0.8, 0.45, 3.85 + dx, 0.42, 1.55, b.paint); });
    b.tone(0x2f5f9a, 0.14, 0.14, 0.22, 3.6, 0.95, 1.5, b.metal);
    b.colored(0xb2392f, () => b.cylinder(0.18, 0.7, 2.9, 1.2, front + 0.5, b.metal, 8, Math.PI / 2));
    for (let stack = 0; stack < 2; stack++) b.colored(0x1f2222, () => {
      for (let n = 0; n < 4 - stack; n++) b.cylinder(0.33, 0.21, 2.35 + stack * 0.72, 0.16 + n * 0.22, 3.95, b.fabric, 7);
    });
    for (let n = 0; n < 3; n++) b.colored(b.pick(DRUMS), () => b.cylinder(0.29, 0.88, 0.5 + n * 0.6, 0.5, 3.95, b.metal, 8));
    b.tone(0xb2392f, 0.8, 0.9, 0.5, 2.9, 0.5, front + 0.5, b.metal);
    b.take(b.dress(kit.props[kit.modernHouseProp]({ seed, detail: 'low' })), -1.4, 0.06, 3.9, 0, 0.45);
  });
  b.feature('road-sign', () => {
    for (const x of [-4.15, -3.05]) b.tone(0x6b7172, 0.08, 2.4, 0.08, x, 1.2, 4.3, b.metal);
    b.shopSign(b.pick(['ซ่อมรถ-ปะยาง', 'ซ่อมรถทุกชนิด', 'ปะยาง-เปลี่ยนน้ำมันเครื่อง']), 1.5, 0.62, -3.6, 2.05, 4.36, { background: 0xf2d24b, foreground: 0x2a2523 });
    b.shopSign(name, 4.4, 0.52, -0.9, 4.0, front + 0.06, { background: worn ? 0xe9e1cb : 0x2e4e6e, foreground: worn ? 0x8a2f25 : 0xf6f1e3 });
  });
  b.feature('greenery', () => b.plant(3.85, 3.15, 3.2, 0.45, 0.06, 0));
  return { floors: 1, bays: 2, workshopName: name, yard: worn ? 'laterite' : 'concrete', tyres: 7, oilDrums: 3 };
}

/** Level 2: a small warehouse: block wall below, metal cladding above, a low gable roof with skylights facing the
 * street, a raised loading dock with its own canopy, pallets and a forklift. R3. */
export function warehouse(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, worn = land === 0, seed = b.options.seed ?? 1, W = 8.6, back = -4.1, front = 1.4, sd = front - back, sz = (front + back) / 2;
  const eave = 5.6, pitch = 12, rise = Math.tan(pitch * Math.PI / 180) * (W / 2), roofKey = worn ? 'roof_metal_rusty' : 'roof_metal_corrugated';
  const clad = vertexFinish(roofKey), cladColor = b.vary(worn ? 0xc2ad94 : 0xeef1f0), block = b.vary(worn ? 0x8f8b81 : b.pick([0x3f6f9a, 0x4a7d5c, 0x8c3b34, 0x56606a]));
  b.feature('walls-and-cladding', () => {
    b.body(block, W, 1.4, sd, 0, 0, sz, worn ? 0.25 : 0);
    b.colored(cladColor, () => b.mass(W - 0.04, eave - 1.4, sd - 0.04, 0, 1.4 + (eave - 1.4) / 2, sz, clad));
    for (const side of [-1, 1]) {
      const v = [point(-W / 2, eave, side * sd / 2 + sz), point(W / 2, eave, side * sd / 2 + sz), point(0, eave + rise, side * sd / 2 + sz)];
      b.colored(cladColor, () => b.panel(side > 0 ? v : [...v].reverse(), point(0, 0, side), 0.08, clad));
      if (side < 0) b.box(W - 1.2, 0.5, 0.05, 0, eave - 0.6, sz - sd / 2 - 0.03, b.glass); else b.box(2.9, 0.5, 0.05, 2.45, eave - 0.6, sz + sd / 2 + 0.03, b.glass);
    }
    for (const side of [-1, 1]) b.box(0.05, 0.5, sd - 1.2, side * (W / 2 + 0.03), eave - 0.6, sz, b.glass);
    // Steel portal columns down the long walls, eaves gutters and downpipes at the back corners.
    b.colored(worn ? 0x6d655a : 0x5a6a78, () => {
      for (const side of [-1, 1]) for (let n = 0; n < 5; n++) b.box(0.1, eave, 0.16, side * (W / 2 + 0.04), eave / 2, back + 0.3 + n * (sd - 0.6) / 4, b.metal);
      for (const side of [-1, 1]) { b.box(0.15, 0.13, sd + 0.5, side * (W / 2 + 0.07), eave - 0.05, sz, b.metal);
        b.box(0.09, eave - 0.3, 0.09, side * (W / 2 + 0.06), eave / 2, back + 0.12, b.metal); }
    });
    // A wall fan in each long wall and a louvred vent high in the street gable.
    for (const side of [-1, 1]) {
      b.tone(weather(0x8f9798, land), 0.06, 0.95, 0.95, side * (W / 2 + 0.03), 3.5, sz - 0.615, b.metal);
      b.colored(0x2a2e30, () => b.cylinder(0.38, 0.04, side * (W / 2 + 0.07), 3.5, sz - 0.615, b.metal, 10, Math.PI / 2));
      b.colored(0x7d8486, () => { b.box(0.03, 0.85, 0.04, side * (W / 2 + 0.1), 3.5, sz - 0.615, b.metal); b.box(0.03, 0.04, 0.85, side * (W / 2 + 0.1), 3.5, sz - 0.615, b.metal); });
    }
    b.tone(weather(0x8f9798, land), 1.05, 0.5, 0.05, 0, eave + rise * 0.42, front + 0.07, b.metal);
    b.colored(0x2a2e30, () => { for (const dy of [-0.13, 0, 0.13]) b.box(0.95, 0.05, 0.05, 0, eave + rise * 0.42 + dy, front + 0.1, b.metal); });
  });
  b.feature('steel-roof-and-skylights', () => {
    b.take(b.dress(b.kit.roofs.gable([W - 0.6, sd], { baseY: eave, pitch, overhang: 0.3, material: roofKey, ornaments: false, seed, detail: 'low',
      surfaceColor: worn ? 0x8f6a4f : 0xa9b6b6 }), clad), 0, 0, sz);
    const a = pitch * Math.PI / 180;
    for (const side of [-1, 1]) b.box(1.0, 0.04, sd - 1.2, side * 2.2, eave + Math.tan(a) * (W / 2 - 2.2) + 0.1, sz, b.glass, -side * a);
    b.tone(cladColor, 0.6, 0.3, sd - 1.4, 0, eave + rise + 0.18, sz, clad);
    b.colored(0xc5cbcc, () => { for (const dz of [-1.6, 0, 1.6]) { b.cylinder(0.22, 0.32, 0, eave + rise + 0.48, sz + dz, b.metal, 8); b.cylinder(0.12, 0.1, 0, eave + rise + 0.7, sz + dz, b.metal, 6); } });
  });
  b.feature('loading-dock', () => {
    b.tone(0x242727, 3.6, 3.9, 0.04, -1.2, 1.1 + 1.95, front + 0.02);
    b.tone(weather(0xa6aeaf, land), 3.6, worn ? 3.9 : 1.3, 0.06, -1.2, 1.1 + 3.9 - (worn ? 3.9 : 1.3) / 2, front + 0.06, b.metal);
    b.tone(0x949a9b, 3.7, 0.32, 0.32, -1.2, 5.15, front + 0.17, b.metal);
    b.colored(weather(0x8f9798, land), () => { for (let y = worn ? 1.4 : 3.95; y < 4.95; y += 0.3) b.box(3.5, 0.04, 0.03, -1.2, y, front + 0.1, b.metal); });
    b.tone(0xb8352d, 0.4, 0.7, 0.14, 3.95, 1.2, front + 0.08);
    b.tone(0xf2ead2, 0.26, 0.12, 0.02, 3.95, 1.38, front + 0.16);
    b.tone(0xa9a59b, 5.2, 1.1, 1.6, -1.2, 0.55, front + 0.8, b.stone);
    for (const x of [-2.6, 0.2]) b.tone(0x1d1f1f, 0.3, 0.45, 0.14, x, 0.7, front + 1.67, b.fabric);
    for (let n = 0; n < 3; n++) b.tone(0xa9a59b, 0.7, 0.37 * (n + 1), 0.4, 1.75, 0.185 * (n + 1), front + 1.4 - n * 0.4, b.stone);
    b.tilt(cladColor, 5.4, 0.06, 1.9, -1.2, 5.35, front + 0.95, 0.1, clad);
    pallet(b, -2.4, 1.1, front + 0.75, 2); pallet(b, -0.9, 1.1, front + 0.75, 1);
    b.tone(0x3a3f40, 0.95, 2.1, 0.05, 3.1, 1.05, front + 0.025);
    b.tone(cladColor, 1.3, 0.08, 0.7, 3.1, 2.4, front + 0.35); b.lamp(3.85, 2.3, front);
    b.tone(0x8c9293, 3.0, 0.03, 0.5, -1.2, 1.11, front + 0.25, b.metal);
    for (const x of [-3.2, 0.8]) b.lamp(x, 5.05, front);
    b.framed(0.9, 0.9, 1.85, 1.7, front, worn ? 0x7a7166 : 0x5a6a78, { grille: worn ? 0x3a3e3f : 0 });
    b.colored(0xe2b23a, () => { for (const x of [-3.15, 0.75]) b.cylinder(0.12, 1.0, x, 0.5, front + 1.85, b.paint, 8); });
  });
  b.feature('yard', () => {
    b.tone(worn ? 0x938e84 : 0xbdb9b0, 8.8, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
    if (worn) { b.tone(0x50595a, 0.6, 0.12, 1.2, 0.9, 0.12, 3.6, b.metal); b.tone(0x50595a, 0.1, 1.0, 0.1, 0.9, 0.6, 4.1, b.metal); }
    else forklift(b, 2.75, 3.15);
    frontFence(b, 1.9, 4.4, worn ? 0x9d988d : 0xd3d0c8);
    for (const x of [-4.4, 4.4]) b.bars(2.75, 1.8, x, 0.05, front + 1.5, 5, worn ? 0x6d6a60 : 0x4f5a5e, true, 0.06);
    pallet(b, -0.55, 0.06, 3.9, worn ? 1 : 2);
    for (const dx of [0, 0.65]) b.colored(dx ? 0x3d7a4a : 0x2f5e8e, () => b.cylinder(0.28, 0.85, -2.2 + dx, 0.48, 3.9, b.paint, 8));
    b.shopSign(b.pick(['คลังสินค้าริมทาง', 'โกดังบ้านสวน', 'คลังสินค้าลานไผ่', 'โกดังลานทอง']), 2.4, 0.6, 2.95, 3.9, front + 0.06,
      { background: worn ? 0xe8e0c8 : 0x2f5f8a, foreground: worn ? 0x3b3330 : 0xf3f0e6 });
  });
  b.feature('greenery', () => b.plant(-3.85, 3.8, 3.3, 0.45, 0.06, 1));
  return { floors: 1, loadingDocks: 1, skylights: 2, forklift: !worn, cladding: worn ? 'rusty' : 'painted' };
}

/** Level 3: a small factory hall under a north-light sawtooth roof, a boiler house and an open-topped chimney (its
 * smoke anchor on the rim), behind a precast fence. R3. */
export function smallFactory(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, worn = land === 0, W = 6.3, hx = -1.15, back = -4.1, front = 1.3, hd = front - back, hz = (front + back) / 2, eave = 5.2;
  const wall = b.vary(worn ? 0xc4bba6 : 0xe4e5e0), trim = b.vary(worn ? 0x77705f : 0x4a6f86), roof = vertexFinish(worn ? 'roof_metal_rusty' : 'roof_metal_corrugated');
  const top = worn ? 15 : 16, cx = 3.3, cz = -2.85, teeth = 3, tooth = hd / teeth;
  b.feature('factory-hall', () => {
    b.body(wall, W, eave, hd, hx, 0, hz, worn ? 0.3 : 0.04);
    b.tone(0x242727, 3.0, 3.4, 0.04, hx - 1.3, 1.7, front + 0.02);
    b.tone(weather(0xa3abac, land), 3.0, worn ? 1.2 : 2.0, 0.06, hx - 1.3, 3.4 - (worn ? 0.6 : 1.0), front + 0.06, b.metal);
    b.tone(0x3a3f40, 0.9, 2.1, 0.05, hx + 1.7, 1.05, front + 0.025);
    b.box(W - 0.8, 0.7, 0.05, hx, eave - 0.75, front + 0.03, b.glass);
    for (const side of [-1, 1]) b.box(0.05, 0.7, hd - 1.0, hx + side * (W / 2 + 0.03), eave - 0.75, hz, b.glass);
    b.colored(trim, () => {
      for (const sx of [-1, 1]) b.box(0.24, eave, 0.24, hx + sx * (W / 2 - 0.02), eave / 2, front - 0.02, b.paint);
      for (const z of [-3.0, -1.4, 0.2]) b.box(0.18, eave, 0.2, hx - W / 2 - 0.02, eave / 2, z, b.paint);
    });
    // Exhaust fans in the west wall, downpipes from the sawtooth valleys.
    for (const z of [-2.2, -0.6]) { b.tone(0x4a5254, 0.1, 0.9, 0.9, hx - W / 2 - 0.05, 2.6, z, b.metal); b.colored(0x2a2f31, () => b.cylinder(0.36, 0.04, hx - W / 2 - 0.1, 2.6, z, b.metal, 8, Math.PI / 2)); }
    b.colored(0x7d8486, () => { for (const [x, z] of [[hx - W / 2 - 0.07, -2.3], [hx - W / 2 - 0.07, -0.5], [hx + W / 2 + 0.07, -0.5]] as const) b.box(0.09, eave - 0.2, 0.09, x, eave / 2, z, b.metal); });
    b.lamp(hx - 1.3, 3.75, front); b.lamp(hx + 1.7, 2.45, front);
  });
  b.feature('sawtooth-roof', () => {
    const angle = Math.atan2(1.2, tooth), length = Math.hypot(1.2, tooth);
    for (let n = 0; n < teeth; n++) {
      const z0 = back + n * tooth;
      b.tilt(worn ? 0x9b7d63 : 0xb8c3c4, W + 0.2, 0.1, length + 0.1, hx, eave + 0.6, z0 + tooth / 2, angle, roof);
      b.box(W, 1.15, 0.05, hx, eave + 0.6, z0 + 0.03, b.glass);
      for (const side of [-1, 1]) {
        const v = [point(hx + side * W / 2, eave, z0), point(hx + side * W / 2, eave, z0 + tooth), point(hx + side * W / 2, eave + 1.2, z0)];
        b.colored(wall, () => b.panel(side > 0 ? [...v].reverse() : v, point(side, 0, 0), 0.08, b.paint));
      }
      b.colored(0xc5cbcc, () => { b.cylinder(0.2, 0.36, hx + (n - 1) * 1.8, eave + 0.95, z0 + 0.65, b.metal, 8); b.cylinder(0.1, 0.1, hx + (n - 1) * 1.8, eave + 1.18, z0 + 0.65, b.metal, 6); });
    }
  });
  b.feature('boiler-house', () => {
    b.body(worn ? 0xa69d8a : 0xcfd2cd, 2.2, 3.4, 2.5, 3.3, 0, -2.85, worn ? 0.3 : 0.05);
    b.parapet(trim, 2.2, 2.5, 3.3, 3.52, -2.85, 0.35);
    b.tone(0x3a3f40, 0.9, 2.0, 0.05, 3.3, 1.0, -1.58);
    b.colored(trim, () => { for (let n = 0; n < 3; n++) b.box(0.6, 0.06, 0.08, 3.95, 2.3 + n * 0.25, -1.56, b.paint); });
    b.colored(0x7a8183, () => {
      b.pole(point(2.2, 4.3, -1.75), point(2.2, 4.3, 0.9), 0.14, b.metal, 6);
      b.pole(point(2.2, 4.3, 0.9), point(2.2, 0.1, 0.9), 0.14, b.metal, 6);
      b.pole(point(4.0, 3.5, -2.0), point(4.0, 5.2, -2.0), 0.1, b.metal, 6);
    });
  });
  b.feature('chimney', () => b.chimney(cx, cz, top, 0.55, worn, worn ? 0xb9b2a3 : 0xc9cfd0));
  b.feature('yard-and-fence', () => {
    b.tone(worn ? 0x938e84 : 0xbdb9b0, 8.8, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
    b.tone(worn ? 0x938e84 : 0xbdb9b0, 2.2, 0.06, 2.9, 3.3, 0.03, -0.15, b.stone);
    if (!worn) b.auto(-1.4, 2.6, b.pick(CARS), Math.PI / 2, true);
    else { pallet(b, -2.6, 0, 2.4, 2); pallet(b, -1.3, 0, 2.4, 1); }
    for (let n = 0; n < 3; n++) b.colored(b.pick(DRUMS), () => b.cylinder(0.29, 0.88, 1.5 + n * 0.62, 0.5, 2.0, b.metal, 8));
    frontFence(b, -4.4, -3.0, worn ? 0x9d988d : 0xd3d0c8); frontFence(b, 0.6, 4.4, worn ? 0x9d988d : 0xd3d0c8);
    b.bars(1.9, 1.5, -2.0, 0.05, 4.2, 6, worn ? 0x5d5348 : 0x34383a);
    transformer(b, -3.4, 3.75); booth(b, 0.0, 3.85, wall);
    for (const x of [3.0, 3.8]) b.scooter(x, -0.6, b.pick([0xb23a32, 0x2f5f9a, 0x2b2d2e, 0xd9d6cc]), 0);
    b.shopSign(b.pick(['โรงงานลานช่าง', 'โรงงานบ้านสวน', 'โรงงานริมทาง', 'โรงงานใบไม้']), 2.6, 0.55, hx + 1.4, 3.85, front + 0.06,
      { background: worn ? 0xe8e0c8 : 0x2e5a72, foreground: worn ? 0x3b3330 : 0xf3f0e6 });
  });
  b.feature('greenery', () => { if (!worn) b.plant(3.85, 3.55, 3.2, 0.45, 0.06, 2); });
  return { floors: 1, sawtoothBays: teeth, smoke: true, stackHeight: top, chimney: worn ? 'concrete' : 'steel' };
}

/** Level 4: a processing works (a feed or oil mill): a gabled hall, two silos with a bucket elevator and a conveyor
 * gallery, process tanks on a pipe rack and a tall chimney with its smoke anchor. R3. */
export function processingWorks(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, worn = land === 0, seed = b.options.seed ?? 1, back = -4.1, front = 1.5, hd = front - back, hz = (front + back) / 2;
  const hx = -2.5, hw = 3.6, eave = 6.0, pitch = 18, roofKey = worn ? 'roof_metal_rusty' : 'roof_metal_corrugated', roof = vertexFinish(roofKey);
  const wall = b.vary(worn ? 0xbdb4a0 : 0xe6e7e2), steel = b.vary(worn ? 0xe2d6c2 : 0xf2f4f3), top = worn ? 20 : 22, rise = Math.tan(pitch * Math.PI / 180) * hw / 2;
  b.feature('process-hall', () => {
    b.body(wall, hw, eave, hd, hx, 0, hz, worn ? 0.3 : 0.04);
    for (const side of [-1, 1]) {
      const v = [point(hx - hw / 2, eave, hz + side * hd / 2), point(hx + hw / 2, eave, hz + side * hd / 2), point(hx, eave + rise, hz + side * hd / 2)];
      b.colored(wall, () => b.panel(side > 0 ? v : [...v].reverse(), point(0, 0, side), 0.08, b.paint));
    }
    b.take(b.dress(b.kit.roofs.gable([hw - 0.6, hd], { baseY: eave, pitch, overhang: 0.3, material: roofKey, ornaments: false, seed, detail: 'low',
      surfaceColor: worn ? 0x8f6a4f : 0xa9b6b6 }), roof), hx, 0, hz);
    b.tone(0x242727, 2.4, 3.2, 0.04, hx, 1.6, front + 0.02);
    b.tone(weather(0xa3abac, land), 2.4, worn ? 3.2 : 1.1, 0.06, hx, 3.2 - (worn ? 1.6 : 0.55), front + 0.06, b.metal);
    b.box(hw - 0.6, 0.7, 0.05, hx, eave - 0.8, front + 0.03, b.glass);
    b.box(0.05, 0.7, hd - 1.0, hx - hw / 2 - 0.03, eave - 0.8, hz, b.glass);
    b.colored(0x7d8486, () => { for (const side of [-1, 1]) { b.box(0.15, 0.13, hd + 0.5, hx + side * (hw / 2 + 0.06), eave - 0.05, hz, b.metal);
      b.box(0.09, eave - 0.3, 0.09, hx + side * (hw / 2 + 0.06), eave / 2, back + 0.15, b.metal); } });
    b.tone(0x7d8486, 2.8, 0.1, 0.8, hx, 3.45, front + 0.4); b.lamp(hx + 1.5, 3.1, front);
  });
  b.feature('silos-elevator-and-gallery', () => {
    for (const x of [1.55, 3.5]) {
      b.tone(0x9a968c, 1.9, 1.0, 1.9, x, 0.5, -2.6, b.stone);
      b.colored(steel, () => {
        b.cylinder(0.92, 9.0, x, 5.5, -2.6, roof, 12);
        const cone = new ConeGeometry(0.98, 1.1, 12).translate(x, 10.55, -2.6);
        b.add(applyWorldUV(cone, 1), roof); cone.dispose();
      });
      b.colored(0x5b6263, () => {
        for (const dx of [-0.25, 0.25]) b.box(0.06, 9.0, 0.06, x + dx, 5.5, -1.66, b.metal);
        for (let n = 0; n < 9; n++) b.box(0.5, 0.04, 0.04, x, 1.6 + n * 1.0, -1.66, b.metal);
      });
    }
    const frame = b.vary(worn ? 0x9a8f7e : 0xc9ccc8);
    b.tone(frame, 0.7, 13.2, 0.7, 2.55, 6.6, -0.95);
    b.tone(frame, 3.0, 0.7, 0.9, 2.55, 11.55, -2.6);
    b.tone(frame, 1.2, 0.9, 1.2, 2.55, 13.3, -0.95);
    b.tone(frame, 0.6, 0.6, 1.4, 2.55, 12.2, -1.75);
    for (const side of [-1, 1]) b.railing(3.0, 2.55, 11.9, -2.6 + side * 0.42, 0x5b6263, 4, 0.9);
  });
  b.feature('tanks-and-pipe-rack', () => {
    for (const [x, r, h] of [[1.6, 0.62, 3.4], [3.55, 0.72, 4.0]] as const) b.colored(b.vary(worn ? 0xb9a487 : 0xeef0ec), () => {
      b.cylinder(r, h, x, 0.2 + h / 2, 0.75, b.paint, 10);
      b.ellipsoid(point(x, 0.2 + h, 0.75), point(r, r * 0.35, r), b.paint, 10, 3);
    });
    for (const x of [-0.5, 2.55]) b.tone(0x5d6566, 0.18, 5.0, 0.18, x, 2.5, 0.0, b.metal);
    b.tone(0x5d6566, 3.4, 0.16, 0.6, 1.0, 5.0, 0.0, b.metal);
    b.colored(worn ? 0x8a6f58 : 0xb3b9ba, () => {
      for (const dz of [-0.18, 0.18]) b.pole(point(hx + hw / 2, 5.2, dz), point(3.55, 5.2, dz), 0.1, b.metal, 6);
      b.pole(point(3.55, 5.2, 0.18), point(3.55, 4.3, 0.75), 0.1, b.metal, 6);
      for (const x of [0.2, 1.6, 2.9]) for (const dz of [-0.18, 0.18]) b.cylinder(0.15, 0.08, x, 5.2, dz, b.metal, 6, Math.PI / 2);
    });
    b.colored(0xb3392f, () => { for (const x of [1.6, 3.55]) b.cylinder(0.14, 0.08, x, 1.0, 0.75 + (x > 2 ? 0.72 : 0.62) + 0.04, b.metal, 6, Math.PI / 2); });
    b.colored(0x5b6263, () => { for (const dx of [-0.2, 0.2]) b.box(0.05, 4.0, 0.05, 3.55 + dx, 2.2, 1.5, b.metal); for (let n = 0; n < 4; n++) b.box(0.4, 0.04, 0.04, 3.55, 1.0 + n * 0.9, 1.5, b.metal); });
  });
  b.feature('chimney', () => b.chimney(-3.6, -3.35, top, 0.62, worn, worn ? 0xb3ab9c : 0xc5cbcc));
  b.feature('yard-and-fence', () => {
    b.tone(worn ? 0x938e84 : 0xbdb9b0, 8.8, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
    b.tone(worn ? 0x938e84 : 0xbdb9b0, 4.5, 0.06, hd - 0.2, 2.2, 0.03, hz, b.stone);
    b.auto(-1.6, 2.65, b.pick(CARS), Math.PI / 2, true);
    pallet(b, 1.9, 0.06, 2.6, worn ? 1 : 2);
    transformer(b, -3.8, 3.8); booth(b, 0.45, 3.98, wall);
    frontFence(b, -4.4, -3.2, worn ? 0x9d988d : 0xd3d0c8); frontFence(b, 1.0, 4.4, worn ? 0x9d988d : 0xd3d0c8);
    b.shopSign(b.pick(['โรงงานอาหารสัตว์', 'โรงงานน้ำมันพืช', 'โรงสีลานทอง', 'โรงงานแปรรูปลานทุ่ง']), 3.2, 0.6, hx, 4.4, front + 0.06,
      { background: worn ? 0xe8e0c8 : 0x2f5b4c, foreground: worn ? 0x3b3330 : 0xf3f0e6 });
  });
  b.feature('greenery', () => { if (!worn) b.plant(3.85, 3.55, 3.3, 0.45, 0.06, 3); });
  return { floors: 1, silos: 2, tanks: 2, smoke: true, stackHeight: top, chimney: worn ? 'concrete' : 'steel' };
}
