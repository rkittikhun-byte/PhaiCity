/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { ConeGeometry } from 'three';
import { tint } from '../../materials/library.js';
import { applyWorldUV } from '../../util/geometry.js';
import { chamferPrism } from '../commercial/geometry.js';
import { PlotBuilder, weather } from './builder.js';
import { booth } from './factories.js';
import { BIKES, CARS } from './homes.js';

/* Two-by-two lots (20 × 20 m, built inside ±9.5 m) for the big buildings that grow on joined plots. */

const SIGN_INK = 0xf6f1e3;

/** Fence of low wall and steel bars along the street edge between two X values. */
function streetFence(b: PlotBuilder, from: number, to: number, wall: number, steel: number, z = 9.3): void {
  b.tone(wall, to - from, 0.55, 0.2, (from + to) / 2, 0.33, z);
  b.bars(to - from - 0.1, 0.9, (from + to) / 2, 0.6, z, Math.round((to - from) / 0.5), steel);
  for (const x of [from + 0.15, to - 0.15]) b.tone(wall, 0.3, 1.6, 0.3, x, 0.8, z);
}

/** A street lamp on a slim pole, the lamp head reaching towards +Z. */
function lampPost(b: PlotBuilder, x: number, z: number, h = 4.2): void {
  b.tone(0x50585a, 0.1, h, 0.1, x, h / 2, z, b.metal);
  b.tone(0x50585a, 0.08, 0.08, 0.7, x, h - 0.05, z + 0.32, b.metal);
  b.tone(0xf0ead6, 0.22, 0.12, 0.42, x, h - 0.14, z + 0.58);
}

/** A sun lounger. */
function lounger(b: PlotBuilder, x: number, y: number, z: number, color: number): void {
  b.tone(color, 0.65, 0.12, 1.8, x, y + 0.35, z);
  b.tone(color, 0.65, 0.6, 0.12, x, y + 0.6, z - 0.85);
  b.tone(0x8a9294, 0.6, 0.3, 1.6, x, y + 0.15, z, b.metal);
}

/** lot.res_4: a large eight- to twelve-storey block of flats over pilotis, six balconied bays a floor, a central
 * stair-and-lift core at the back, a car park, a pool (or a motorbike shelter) and a guarded gate. R3. */
export function apartmentBlock(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [8, 9, 10, 12][land], ground = 3.6, storey = 3, plinth = 0.15, first = plinth + ground;
  const top = first + (floors - 1) * storey, palette = b.kit.neutralPalette(b.options.seed);
  const wall = b.vary([0xd2cab8, weather(palette.wall, 1), 0xe9e6de, 0xf2f0ea][land]), trim = b.vary([0x9a9384, 0xb3b0a7, 0x6f7e82, 0x546669][land]);
  const W = 17.2, back = -8.6, front = -0.6, D = front - back, bz = (front + back) / 2, stain = [0.3, 0.12, 0.03, 0][land];
  const bays = Array.from({ length: 6 }, (_, n) => -W / 2 + 1.433 + n * 2.867);
  const name = land < 2 ? b.pick(['แฟลตลานไม้', 'อาคารชุดลมเย็น', 'แฟลตริมบึง']) : b.pick(['คอนโดบ้านสวน', 'คอนโดลานไผ่', 'เรสซิเดนซ์ริมบึง']);
  b.feature('site', () => {
    b.tone(0xbab6ac, 4.2, 0.06, 9.4 - front, 0, 0.03, (front + 9.4) / 2, b.stone);
    for (const side of [-1, 1]) b.tone(0xa9a59c, 6.6, 0.05, 4.6, side * 5.6, 0.025, 3.3, b.stone);
    b.colored(0xe8e4d6, () => { for (const side of [-1, 1]) for (let n = 0; n <= 3; n++) b.box(0.08, 0.02, 4.2, side * (2.5 + n * 2.1), 0.065, 3.3, b.paint); });
  });
  b.feature('pilotis-lobby-and-shops', () => {
    b.body(wall, W, ground, 5.0, 0, plinth, back + 2.5, stain);
    for (const x of [-8.35, -5.0, -1.7, 1.7, 5.0, 8.35]) b.tone(wall, 0.45, ground, 0.45, x, plinth + ground / 2, front - 0.3);
    b.framed(3.0, 2.6, 0, plinth + 0.1, back + 5.0, 0x5a6264, { mullion: true, transom: true });
    b.shopSign(name, 4.2, 0.55, 0, first - 0.45, back + 5.06, { background: land < 2 ? 0xeee6cf : 0x2f4a4c, foreground: land < 2 ? 0x3b4a49 : SIGN_INK });
    for (const side of [-1, 1]) {
      b.box(4.4, 2.5, 0.05, side * 5.6, plinth + 1.35, back + 5.03, b.glass);
      b.colored(0x3c4446, () => { for (const dx of [-2.2, 0, 2.2]) b.box(0.07, 2.6, 0.08, side * 5.6 + dx, plinth + 1.35, back + 5.06, b.metal); });
      b.shopSign(land < 2 ? (side < 0 ? 'มินิมาร์ท' : 'ร้านซักรีด') : (side < 0 ? 'ห้องออกกำลังกาย' : 'ร้านกาแฟ'), 3.2, 0.45, side * 5.6, first - 0.45, back + 5.06,
        { background: side < 0 ? 0x2e6a4f : 0xf0c64a, foreground: side < 0 ? SIGN_INK : 0x2b2622 });
    }
    b.lamp(-2.2, 2.9, back + 5.0); b.lamp(2.2, 2.9, back + 5.0);
  });
  b.feature('block-and-core', () => {
    b.body(wall, W, top - first, D, 0, first, bz, stain);
    for (let f = 0; f < floors; f++) b.tone(trim, W + 0.12, 0.14, D + 0.12, 0, first + f * storey, bz);
    b.body(land < 2 ? 0xd9d4c6 : trim, 2.6, top + 3, 1.4, 0, 0, back - 0.1, stain);
    b.box(0.6, top - 1.0, 0.05, 0, top / 2 + 1.5, back - 0.82, b.glass);
    b.parapet(trim, 2.6, 1.4, 0, top + 3.12, back - 0.1, 0.4);
  });
  b.feature('balconies-laundry-and-air-conditioners', () => {
    for (let k = 0; k < floors - 1; k++) bays.forEach((x, n) => {
      const y = first + k * storey;
      b.tone(trim, 2.6, 0.14, 1.1, x, y + 0.07, front + 0.55);
      if (land < 2) { b.tone(wall, 2.6, 0.95, 0.1, x, y + 0.6, front + 1.05); b.tone(trim, 2.66, 0.07, 0.16, x, y + 1.1, front + 1.05); }
      else { b.box(2.55, 0.95, 0.04, x, y + 0.62, front + 1.07, b.glass); b.tone(0x8a9294, 2.55, 0.05, 0.07, x, y + 1.12, front + 1.07, b.metal); }
      b.box(1.4, 2.0, 0.04, x - 0.35, y + 1.15, front + 0.03, b.glass);
      b.tone(trim, 1.56, 0.08, 0.1, x - 0.35, y + 2.2, front + 0.06);
      if ((n + k) % 2 === 0 || land === 0) b.ac(x + 0.85, y + 0.42, front + 0.3);
      if (land === 0 && k < 3) b.bars(2.5, 1.75, x, y + 1.07, front + 1.07, 4, 0x4b5051);
      if (land < 2 && b.random() < (land === 0 ? 0.6 : 0.35)) b.laundry(2.2, x, y + 1.85, front + 1.08, 3);
    });
  });
  b.feature('back-and-sides', () => {
    for (let k = 0; k < floors - 1; k++) {
      const y = first + k * storey + 1.55;
      bays.forEach((x, n) => { if (Math.abs(x) < 1.6) return; b.pane(1.2, 1.2, x, y, back - 0.02, b.glass, Math.PI); if (n % 2 === 0) b.ac(x + 0.9, y - 1.1, back - 0.17, Math.PI); });
      for (const side of [-1, 1]) for (const dz of [-2.0, 1.5]) b.pane(1.0, 1.1, side * (W / 2 + 0.02), y, bz + dz, b.glass, side * Math.PI / 2);
    }
    b.colored(0x7d8486, () => { for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) b.box(0.1, top, 0.1, x, top / 2, back - 0.06, b.metal); });
  });
  b.feature('roof', () => {
    b.parapet(trim, W, D, 0, top + 0.15, bz, land < 2 ? 0.8 : 1.1);
    if (land < 2) for (const x of [-5.5, -3.9, 3.9]) b.tank(x, top + 0.15, bz - 2.2, 0.65, 1.5);
    for (const x of [5.6, 7.1]) b.condenser(x, top + 0.15, bz - 2.4);
    b.dish(-7.4, top + 0.15, bz + 2.6, 0.5); b.dish(6.8, top + 0.15, bz + 2.6, -0.4);
    b.colored(0x8e9596, () => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 1.6, 0.05, sx * (W / 2 - 0.25), top + 1.0, bz + sz * (D / 2 - 0.25), b.metal); });
    if (land >= 2) {
      for (const x of [-6.2, -2.4, 2.4, 6.2]) b.planter(1.8, 0.7, x, top + 0.15, bz + 2.8);
      b.plant(-6.2, bz + 1.6, 2.6, 0.7, top + 0.15, 2); b.plant(6.2, bz + 1.6, 2.6, 0.7, top + 0.15, 3);
      for (const dx of [-1.6, 0, 1.6]) b.tone(0x6f6457, 0.12, 2.3, 0.12, dx, top + 1.3, bz - 0.4);
      b.tone(0x6f6457, 3.6, 0.1, 2.2, 0, top + 2.45, bz - 0.4);
    }
  });
  b.feature('car-park-and-gate', () => {
    const slots = [-7.65, -5.55, -3.45, 3.45, 5.55, 7.65];
    for (let i = 0; i < [0, 2, 4, 5][land]; i++) b.auto(slots[(i * 5) % 6], 3.3, b.pick(CARS), i % 2 ? 0 : Math.PI);
    if (land < 2) {
      for (let n = 0; n < 7; n++) b.scooter(-7.8 + n * 0.85, -2.1, b.pick(BIKES), Math.PI + (b.random() - 0.5) * 0.3);
      b.tilt(0x9aa3a6, 5.8, 0.06, 2.4, 6.0, 2.3, 7.6, 0.06, b.metal);
      for (const [x, z] of [[3.3, 6.6], [8.7, 6.6], [3.3, 8.6], [8.7, 8.6]]) b.tone(0x5d6466, 0.08, 2.3, 0.08, x, 1.15, z, b.metal);
      for (let n = 0; n < 4; n++) b.scooter(3.9 + n * 1.3, 7.6, b.pick(BIKES), 0);
    } else {
      b.pool(6.6, 7.5, 4.0, 2.2, 0.08);
      for (const x of [2.9, 3.75]) lounger(b, x, 0.08, 7.5, 0xe7e2d4);
    }
    booth(b, -3.2, 8.4, wall);
    streetFence(b, -9.4, -2.3, wall, land < 2 ? 0x4b5051 : 0x2f3436); streetFence(b, 2.3, 9.4, wall, land < 2 ? 0x4b5051 : 0x2f3436);
    b.plant(-7.6, 7.4, 5.0, 0.9, 0.06, 1); b.plant(-5.4, 8.1, 4.2, 0.7, 0.06, 2);
    for (const x of [-2.4, 2.4]) lampPost(b, x, 1.2);
  });
  return { floors, floorHeight: storey, groundFloor: ground, bays: 6, balconies: (floors - 1) * 6, pool: land >= 2, parkedCars: [0, 2, 4, 5][land] };
}

/** lot.res_5: a 25–35 storey condominium tower over a four-level podium of lobby, shops and car park decks, with a
 * pool deck, a drop-off canopy, a sky lounge on dearer land and a lit crown. R3. */
export function condoTowerLot(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [25, 28, 31, 35][land], storey = 3, palette = b.kit.neutralPalette(b.options.seed);
  const podium = 0.15 + 4.5 + 3 * 3.0, top = podium + floors * storey, PW = 18, pz0 = -9.0, pz1 = 4.6, pz = (pz0 + pz1) / 2, PD = pz1 - pz0;
  const TW = 11, tz0 = -8.4, tz1 = 0.4, tz = (tz0 + tz1) / 2, TD = tz1 - tz0, glow = tint('emissive_window', 0xb3d5bf);
  const wall = b.vary([0xd7d1c2, palette.wall, 0xeceae4, 0xf3f1ec][land]), trim = b.vary([0xa29c8e, 0x9da3a4, 0x7d8a8d, 0x5d6f73][land]);
  const name = b.pick(['คอนโดยอดเมฆ', 'คอนโดฟ้าใส', 'คอนโดลานดาว', 'เรสซิเดนซ์สวนลม']);
  b.feature('podium', () => {
    b.body(trim, PW, podium, PD, 0, 0, pz, 0);
    b.box(5.6, 3.8, 0.05, -3.2, 2.1, pz1 + 0.03, b.glass);
    b.colored(0x3c4446, () => { for (const dx of [-5.9, -4.1, -2.3, -0.5]) b.box(0.08, 3.9, 0.1, dx, 2.1, pz1 + 0.06, b.metal); });
    for (const [x, shop] of [[3.0, 'ร้านกาแฟ'], [6.6, 'ร้านขายยา']] as const) {
      b.framed(2.8, 2.8, x, 0.3, pz1, 0x3c4446, { mullion: true });
      b.shopSign(shop, 2.8, 0.5, x, 3.65, pz1 + 0.06, { background: shop === 'ร้านขายยา' ? 0x2e7a50 : 0xf0c64a, foreground: shop === 'ร้านขายยา' ? SIGN_INK : 0x2b2622 });
    }
    // Car park decks: dark open bays behind horizontal louvres down the front and both sides.
    b.colored(0x2a2e30, () => {
      for (let d = 0; d < 3; d++) {
        const y = 4.65 + d * 3 + 1.45;
        b.box(PW - 0.8, 2.1, 0.04, 0, y, pz1 + 0.02, b.paint);
        for (const side of [-1, 1]) b.box(0.04, 2.1, PD - 0.8, side * (PW / 2 + 0.02), y, pz, b.paint);
      }
    });
    b.colored(wall, () => {
      for (let d = 0; d < 3; d++) for (let s = 0; s < 3; s++) {
        const y = 4.65 + d * 3 + 0.7 + s * 0.75;
        b.box(PW - 0.4, 0.12, 0.08, 0, y, pz1 + 0.05, b.paint);
        for (const side of [-1, 1]) b.box(0.08, 0.12, PD - 0.4, side * (PW / 2 + 0.05), y, pz, b.paint);
      }
    });
    b.tone(0x2c3032, 2.2, 2.6, 0.05, -8.0, 1.45, pz1 + 0.03);
    b.tone(trim, 7.0, 0.3, 3.0, -2.5, 4.35, pz1 + 1.5);
    b.colored(0x5d6466, () => { for (const x of [-5.6, -2.5, 0.6]) b.box(0.18, 4.2, 0.18, x, 2.1, pz1 + 2.8, b.metal); });
    b.shopSign(name, 4.6, 0.6, -2.5, 4.35, pz1 + 3.02, { background: 0x253537, foreground: 0xf3efe2, lit: land >= 2 });
  });
  b.feature('podium-deck', () => {
    b.parapet(trim, PW, PD, 0, podium + 0.05, pz, 1.0);
    b.pool(-3.0, 2.4, 8.0, 2.4, podium + 0.07);
    for (const x of [2.6, 3.7, 4.8, 5.9]) lounger(b, x, podium + 0.05, 2.4, 0xe7e2d4);
    for (const [x, z] of [[7.4, -6.5], [7.4, -2.6], [-7.4, -6.5], [-7.4, -2.6]]) { b.planter(1.4, 1.4, x, podium + 0.05, z); b.plant(x, z, 3.4, 0.8, podium + 0.5, x + z); }
  });
  b.feature('tower', () => {
    b.body(wall, TW, top - podium, TD, 0, podium, tz, [0.18, 0.06, 0, 0][land]);
    for (const side of [-1, 1]) for (const dz of [-2.2, 1.6]) b.box(0.05, top - podium - 1, 1.6, side * (TW / 2 + 0.03), (top + podium) / 2, tz + dz, b.glass);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tone(trim, 0.35, top - podium, 0.35, sx * (TW / 2 + 0.1), (top + podium) / 2, tz + sz * (TD / 2 + 0.1));
    for (let f = 0; f < floors; f++) {
      const y = podium + f * storey;
      b.tone(trim, TW + 0.16, 0.16, TD + 0.16, 0, y + 0.08, tz);
      for (const side of [-1, 1]) b.box(TW - 1.0, 1.7, 0.05, 0, y + 1.55, tz + side * (TD / 2 + 0.03), b.glass);
      if (f > 0) for (const dx of [-3.65, 0, 3.65]) {
        b.tone(trim, 3.3, 0.14, 1.2, dx, y + 0.09, tz1 + 0.6);
        if (land < 2) { b.tone(wall, 3.3, 0.9, 0.08, dx, y + 0.6, tz1 + 1.16); b.tone(trim, 3.35, 0.06, 0.14, dx, y + 1.08, tz1 + 1.16); }
        else { b.box(3.25, 0.95, 0.04, dx, y + 0.62, tz1 + 1.17, b.glass); b.tone(0x8a9294, 3.25, 0.05, 0.07, dx, y + 1.12, tz1 + 1.17, b.metal); }
        if (dx !== 0) b.ac(dx + (dx < 0 ? -1.15 : 1.15), y + 0.45, tz1 + 0.32);
      }
      b.ac(f % 2 ? -3.0 : 3.0, y + 1.0, tz0 - 0.17, Math.PI);
    }
  });
  b.feature('crown', () => {
    b.parapet(trim, TW + 0.3, TD + 0.3, 0, top + 0.2, tz, 1.3);
    b.body(wall, 5.0, 3.4, 3.4, -1.5, top + 0.2, tz - 1.6, 0);
    b.colored(trim, () => { for (let n = 0; n < 5; n++) b.box(5.1, 0.1, 0.12, -1.5, top + 0.7 + n * 0.5, tz + 0.16, b.paint); });
    b.box(TW + 0.34, 0.12, 0.06, 0, top + 1.3, tz + TD / 2 + 0.19, glow);
    b.box(5.1, 0.12, 0.06, -1.5, top + 3.4, tz + 0.12, glow);
    for (const x of [2.6, 4.2]) b.condenser(x, top + 0.2, tz - 2.6, 1.1, 0.9, 0.7);
    if (land >= 2) { b.mass(6.0, 2.8, 2.4, 1.2, top + 1.6, tz + 2.8, b.glass); b.tone(trim, 6.3, 0.15, 2.7, 1.2, top + 3.08, tz + 2.8); }
    b.tone(0x8e9596, 0.14, 5.0, 0.14, -1.5, top + 6.1, tz - 1.6, b.metal);
    b.anchor('anchor_light_0', -1.5, top + 8.6, tz - 1.6);
  });
  b.feature('forecourt', () => {
    b.tone(0xc9c4ba, PW + 0.8, 0.06, 9.4 - pz1, 0, 0.03, (pz1 + 9.4) / 2, b.stone);
    for (const x of [-8.2, 8.2]) { b.planter(1.6, 1.6, x, 0.05, 8.3); b.plant(x, 8.3, 5.2, 0.9, 0.5, x > 0 ? 1 : 0); }
    for (let n = 0; n < 6; n++) b.tone(0x8b8d88, 0.2, 0.8, 0.2, -6.0 + n * 2.4, 0.4, 9.25, b.stone);
    b.auto(-3.8, 6.1, b.pick(CARS), Math.PI / 2); b.auto(2.8, 8.2, b.pick(CARS), -Math.PI / 2);
    booth(b, 6.0, 8.3, wall);
    for (const x of [-6.2, 5.0]) lampPost(b, x, 7.6);
  });
  return { floors, podiumFloors: 4, floorHeight: storey, height: top + 8.6, poolDeck: true, skyLounge: land >= 2 };
}

/** lot.com_4: a three- or four-storey shopping arcade (ศูนย์การค้า): a glazed entrance atrium, shop fronts under
 * awnings, billboards, a rooftop car park (or roof garden on dear land) and a forecourt car park. R3. */
export function mall(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [3, 3, 4, 4][land], storey = 4.5, plinth = 0.2, top = plinth + floors * storey;
  const W = 18.4, back = -9.2, front = 2.2, D = front - back, bz = (front + back) / 2, palette = b.kit.neutralPalette(b.options.seed);
  const wall = b.vary([0xd8cfbd, weather(palette.wall, 1), 0xece9e2, 0xf1efea][land]), trim = b.vary([0x9a9384, 0xa9aba6, 0x6f7e82, 0x4d5e62][land]);
  const accent = b.pick([0xc9473b, 0x2f6d8e, 0x3f8a5c, 0xd8a33a]), stain = [0.25, 0.1, 0.02, 0][land];
  const name = b.pick(['ศูนย์การค้าลานเมือง', 'พลาซ่าริมทาง', 'ห้างลานทอง', 'ลานเมืองพลาซ่า']);
  b.feature('mall-body', () => {
    b.body(wall, W, top, D, 0, 0, bz, stain);
    for (let f = 1; f < floors; f++) b.tone(trim, W + 0.1, 0.2, D + 0.1, 0, plinth + f * storey, bz);
    b.tone(accent, W + 0.16, 0.5, D + 0.16, 0, top - 0.25, bz);
    for (const side of [-1, 1]) for (let f = 1; f < floors; f++) b.box(0.05, 1.4, D - 3.0, side * (W / 2 + 0.03), plinth + f * storey + 2.2, bz, b.glass);
    b.tone(0x2c3032, 3.2, 3.4, 0.05, 5.5, 1.9, back - 0.03); b.tone(trim, 4.0, 0.15, 0.3, 5.5, 3.8, back - 0.15);
    for (const side of [-1, 1]) b.tone(0x3a3f40, 0.05, 2.2, 1.0, side * (W / 2 + 0.03), 1.3, back + 2.0);
  });
  b.feature('glazed-atrium', () => {
    b.mass(6.4, top + 1.0, 2.2, 0, (top + 1.0) / 2, 3.3, b.glass);
    b.colored(trim, () => {
      for (let n = 0; n <= 6; n++) b.box(0.08, top + 1.0, 0.1, -3.2 + n * 1.067, (top + 1.0) / 2, 4.43, b.paint);
      for (let f = 1; f <= floors; f++) b.box(6.5, 0.1, 0.12, 0, plinth + f * storey - 0.1, 4.43, b.paint);
      for (const side of [-1, 1]) b.box(0.1, top + 1.0, 2.2, side * 3.22, (top + 1.0) / 2, 3.3, b.paint);
    });
    b.tone(accent, 6.8, 0.4, 2.6, 0, top + 1.2, 3.3);
    b.shopSign(name, 6.0, 1.0, 0, top + 0.1, 4.48, { background: accent, foreground: SIGN_INK, lit: land >= 2 });
    b.tone(trim, 7.0, 0.25, 2.0, 0, 4.1, 5.4);
    b.colored(0x5d6466, () => { for (const x of [-3.2, 3.2]) b.box(0.16, 4.0, 0.16, x, 2.0, 6.2, b.metal); });
    b.framed(3.0, 2.8, 0, plinth, 4.4, 0x3c4446, { mullion: true });
  });
  b.feature('shop-fronts', () => {
    const shops = ['ร้านทอง', 'ร้านมือถือ', 'ร้านแว่นตา', 'ร้านรองเท้า', 'ร้านเบเกอรี่', 'ร้านหนังสือ'];
    for (let n = 0; n < 6; n++) {
      const x = (n < 3 ? -1 : 1) * (4.25 + (n % 3) * 1.85), color = b.pick([0xc0563f, 0x3d6f8e, 0xd2a14a, 0x4f7f5c]);
      b.framed(1.55, 2.6, x, plinth + 0.05, front, 0x3c4446, { transom: true });
      b.awning(1.7, 0.9, x, plinth + 3.3, front + 0.5, color);
      b.shopSign(shops[n], 1.65, 0.45, x, plinth + 3.75, front + 0.06, { background: color, foreground: SIGN_INK });
    }
  });
  b.feature('billboards-and-fins', () => {
    for (const [x, text] of [[-6.2, b.pick(['ลดราคาทั้งร้าน', 'ของดีราคาถูก'])], [6.2, b.pick(['โรงภาพยนตร์', 'ศูนย์อาหาร'])]] as const) {
      b.shopSign(text, 4.8, 2.3, x < 0 ? -6.25 : 6.25, plinth + storey + 2.5, front + 0.08, { background: x < 0 ? 0xf2d24b : 0x2f5f8a, foreground: x < 0 ? 0x2a2523 : SIGN_INK, lit: land >= 2 });
      b.tone(0x3c4446, 5.0, 2.5, 0.06, x < 0 ? -6.25 : 6.25, plinth + storey + 2.5, front + 0.03, b.metal);
      // Flood lamps on short arms along the billboard's top edge.
      for (const dx of [-1.6, 0, 1.6]) {
        b.tone(0x3c4446, 0.06, 0.06, 0.5, (x < 0 ? -6.25 : 6.25) + dx, plinth + storey + 3.85, front + 0.3, b.metal);
        b.tone(0xf0ead6, 0.3, 0.12, 0.2, (x < 0 ? -6.25 : 6.25) + dx, plinth + storey + 3.8, front + 0.58);
      }
    }
    if (land >= 2) b.colored(accent, () => { for (const x of [-9.0, -3.5, 3.5, 9.0]) b.box(0.25, top - storey - 0.6, 0.4, x, (top + storey + plinth) / 2, front + 0.2, b.paint); });
  });
  b.feature('roof', () => {
    b.parapet(trim, W, D, 0, top + 0.12, bz, 1.0);
    for (const x of [-7.5, -6.0, -4.5]) b.condenser(x, top + 0.12, back + 1.4, 1.2, 1.0, 0.9);
    // Ridge skylights over the shop galleries.
    for (const x of [-5.4, -3.0, -0.6, 1.8, 4.2]) {
      b.tone(trim, 1.9, 0.3, 2.1, x, top + 0.27, back + 3.5);
      for (const side of [-1, 1]) b.box(1.0, 0.04, 2.0, x + side * 0.43, top + 0.62, back + 3.5, b.glass, -side * 0.5);
      b.tone(0x8a9294, 0.08, 0.08, 2.1, x, top + 0.84, back + 3.5, b.metal);
    }
    b.tank(-2.6, top + 0.12, back + 1.4, 0.6, 1.4); b.tank(-1.2, top + 0.12, back + 1.4, 0.6, 1.4);
    if (land < 3) {
      b.colored(0xe8e4d6, () => { for (let n = 0; n < 7; n++) b.box(0.08, 0.02, 4.4, -7.2 + n * 2.4, top + 0.14, bz + 1.9, b.paint); });
      for (let i = 0; i < [3, 5, 6][land]; i++) b.auto(-6.0 + i * 2.4, bz + 1.9, b.pick(CARS), i % 2 ? 0 : Math.PI, false, top + 0.12);
      b.body(trim, 3.2, 3.0, 3.0, 7.2, top + 0.12, back + 1.7, 0);
      b.shopSign('ทางลง', 1.6, 0.45, 7.2, top + 2.6, back + 3.26, { background: 0x2f5f8a, foreground: SIGN_INK });
      for (const x of [-7.6, 2.0]) lampPost(b, x, bz - 1.0, 3.6);
    } else {
      for (const x of [-6.4, -2.2, 2.2, 6.4]) { b.planter(2.4, 0.9, x, top + 0.12, bz + 3.2); b.colored(0xe8e2d0, () => b.cylinder(0.05, 2.2, x, top + 1.2, bz + 1.4, b.metal, 6)); b.colored(accent, () => b.cylinder(1.2, 0.3, x, top + 2.3, bz + 1.4, b.fabric, 8)); }
      b.plant(-7.6, bz - 0.8, 3.6, 0.9, top + 0.12, 2); b.plant(7.6, bz - 0.8, 3.6, 0.9, top + 0.12, 3);
    }
  });
  b.feature('forecourt-car-park', () => {
    b.tone(0xb9b5ab, W + 0.4, 0.06, 9.4 - front, 0, 0.03, (front + 9.4) / 2, b.stone);
    b.colored(0xe8e4d6, () => { for (const side of [-1, 1]) for (const x of [3.62, 5.57, 7.52, 9.36]) b.box(0.08, 0.02, 4.2, side * x, 0.07, 6.3, b.paint); });
    const slots = [-4.6, -6.55, 4.6, -8.5, 6.55, 8.5];
    for (let i = 0; i < [2, 4, 5, 6][land]; i++) b.auto(slots[i], 6.3, b.pick(CARS), i % 2 ? 0 : Math.PI);
    if (land === 0) for (let n = 0; n < 6; n++) b.scooter(4.2 + n * 0.85, 6.3, b.pick(BIKES), 0);
    for (const x of [-2.6, 2.6]) b.plant(x, 8.6, 4.4, 0.75, 0.06, x > 0 ? 1 : 0);
    // A coffee kiosk, a pylon sign and a bus shelter on the street edge.
    b.tone(0xe6e1d4, 1.6, 2.2, 1.2, 0, 1.15, 8.2); b.awning(1.9, 0.7, 0, 2.5, 9.0, accent);
    b.shopSign('กาแฟสด', 1.5, 0.4, 0, 1.95, 8.83, { background: 0x5a3a2a, foreground: SIGN_INK });
    b.tone(trim, 0.6, 7.0, 0.4, -9.0, 3.5, 9.0); b.shopSign(name, 0.5, 4.0, -9.0, 4.6, 9.23, { vertical: true, background: accent, foreground: SIGN_INK, lit: land >= 2 });
    b.tone(0x5d6466, 2.4, 0.1, 0.9, 8.1, 2.45, 9.0, b.metal); b.box(2.3, 1.6, 0.04, 8.1, 1.4, 8.6, b.glass);
    for (const x of [7.0, 9.2]) b.tone(0x5d6466, 0.08, 2.4, 0.08, x, 1.2, 9.3, b.metal);
    b.tone(0x8a9294, 1.8, 0.1, 0.4, 8.1, 0.5, 8.85, b.metal);
    for (const x of [-1.6, 1.6]) b.tone(0x8b8d88, 0.2, 0.8, 0.2, x, 0.4, 6.8, b.stone);
    // Benches and bins along the shop fronts, a trolley bay and joints in the walkway's paving.
    for (const x of [-7.3, -4.9, 4.9, 7.3]) b.bench(x, 0.06, 3.65);
    for (const x of [-6.1, 6.1]) { b.colored(0x3f7d4f, () => b.cylinder(0.24, 0.8, x, 0.46, 3.7, b.paint, 8)); b.tone(0x2f3436, 0.5, 0.05, 0.5, x, 0.88, 3.7, b.metal); }
    b.tone(0x5d6466, 2.2, 0.08, 1.0, -2.6, 2.2, 6.4, b.metal);
    for (const x of [-3.5, -1.7]) b.tone(0x5d6466, 0.07, 2.2, 0.07, x, 1.1, 6.0, b.metal);
    b.colored(0x9aa3a5, () => { for (let n = 0; n < 4; n++) b.box(0.45, 0.6, 0.85, -3.35 + n * 0.5, 0.42, 6.45, b.metal); });
    b.paving(W, 2.0, 0, 0.06, front + 1.1, 1.2);
  });
  return { floors, floorHeight: storey, mallName: name, rooftopParking: land < 3, roofGarden: land === 3, shopFronts: 6, parkedCars: [2, 4, 5, 6][land] };
}

/** lot.com_5: a 30–40 storey office tower on a three-storey retail podium: glass curtain wall with mullions, transoms
 * and sun fins, a stepped lit crown and spire (no logos), a podium roof garden and a drop-off plaza. R3. */
export function officeTowerLot(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [30, 33, 36, 40][land], storey = 3.5, plinth = 0.2, podium = plinth + 4.5 + 2 * 3.5;
  const top = podium + (floors - 3) * storey, TW = 12, TD = 10, tz = -3.4, cut = [0.4, 0.4, 1.4, 1.4][land], tiers = land < 2 || floors >= 40 ? 1 : 2;
  const PW = 18.4, pz0 = -9.2, pz1 = 4.6, pz = (pz0 + pz1) / 2, PD = pz1 - pz0;
  const frame = b.vary([0xc7bda9, 0xaeb4b5, 0xd9dcdc, 0xe4e6e5][land]), glow = tint('emissive_window', 0xa9d9d1), mull = land < 2 ? 0x5c6466 : 0x8c979b;
  const name = b.pick(['ทาวเวอร์ลานเมฆ', 'อาคารฟ้าใส', 'อาคารยอดเมฆ', 'อาคารริ้วฟ้า']);
  b.feature('retail-podium', () => {
    b.body(frame, PW, podium, PD, 0, 0, pz, 0);
    for (let f = 1; f < 3; f++) {
      const y = plinth + 4.5 + (f - 1) * 3.5;
      b.box(PW - 1.0, 2.2, 0.05, 0, y + 1.7, pz1 + 0.03, b.glass);
      for (const side of [-1, 1]) b.box(0.05, 2.2, PD - 1.0, side * (PW / 2 + 0.03), y + 1.7, pz, b.glass);
      b.colored(mull, () => { for (let n = 0; n < 9; n++) b.box(0.07, 2.2, 0.08, -8.0 + n * 2.0, y + 1.7, pz1 + 0.07, b.metal); });
    }
    const shops = ['ธนาคารลานเมือง', 'ร้านกาแฟ', 'ร้านอาหาร', 'ร้านหนังสือ'];
    for (let n = 0; n < 4; n++) {
      const x = [-7.6, -5.0, 5.0, 7.6][n];
      b.framed(2.2, 3.0, x, plinth + 0.05, pz1, 0x3c4446, { mullion: true, transom: true });
      b.shopSign(shops[n], 2.3, 0.45, x, plinth + 3.75, pz1 + 0.06, { background: n === 0 ? 0x2f5f8a : 0xece3c8, foreground: n === 0 ? SIGN_INK : 0x243e39 });
    }
    b.mass(6.0, 4.4, 0.6, 0, plinth + 2.2, pz1 + 0.2, b.glass);
    b.tone(0x9a9d9a, 8.0, 0.3, 3.0, 0, plinth + 4.8, pz1 + 1.5, b.stone);
    b.colored(0x5a6264, () => { for (const x of [-3.6, -1.2, 1.2, 3.6]) b.box(0.2, 4.7, 0.2, x, plinth + 2.35, pz1 + 2.8, b.metal); });
    b.shopSign(name, 5.6, 0.6, 0, plinth + 4.8, pz1 + 3.02, { background: 0x22302f, foreground: 0xeef3ea, lit: true });
  });
  b.feature('podium-roof-garden', () => {
    b.parapet(frame, PW, PD, 0, podium + 0.1, pz, 1.1);
    for (const x of [-6.8, -2.3, 2.3, 6.8]) b.planter(2.8, 0.9, x, podium + 0.1, 3.4);
    for (const [x, z] of [[-7.8, -6.0], [7.8, -6.0], [-7.8, -1.0], [7.8, -1.0]]) b.plant(x, z, 3.2, 0.8, podium + 0.1, x * z);
    for (const x of [-4.5, 4.5]) b.tone(0x6c5a45, 1.4, 0.42, 0.42, x, podium + 0.31, 2.3);
    // A timber pergola over the middle of the garden and café tables under umbrellas at the sides.
    b.colored(0x7a5a3e, () => {
      for (const x of [-1.4, 1.4]) for (const z of [1.95, 2.8]) b.box(0.16, 2.6, 0.16, x, podium + 1.4, z, b.paint);
      for (const z of [1.95, 2.8]) b.box(3.2, 0.16, 0.16, 0, podium + 2.75, z, b.paint);
      for (let n = 0; n < 7; n++) b.box(0.08, 0.1, 1.2, -1.5 + n * 0.5, podium + 2.88, 2.375, b.paint);
    });
    for (const x of [-7.6, 7.6]) {
      b.colored(0xe8e2d0, () => b.cylinder(0.05, 2.2, x, podium + 1.2, 1.9, b.metal, 6));
      b.colored(x < 0 ? 0x3f8a5c : 0xc9473b, () => b.cylinder(1.0, 0.25, x, podium + 2.3, 1.9, b.fabric, 8));
      b.colored(0xe6e1d4, () => b.cylinder(0.45, 0.06, x, podium + 0.85, 1.9, b.paint, 8));
    }
    b.paving(5.6, 2.6, 0, podium + 0.1, 3.0, 0.8, 0xa29d92);
  });
  b.feature('curtain-wall-tower', () => {
    chamferPrism(b, TW, TD, cut, podium, top, b.glass, 0, tz);
    b.colored(frame, () => { for (let k = 0; k <= floors - 3; k++) chamferPrism(b, TW + 0.14, TD + 0.14, cut + 0.04, podium + k * storey - 0.08, podium + k * storey + (land < 2 ? 0.55 : k % 3 ? 0.08 : 0.2), b.paint, 0, tz); });
    b.colored(mull, () => {
      for (const side of [-1, 1]) {
        for (let n = 0; n < 9; n++) b.box(0.09, top - podium, 0.2, -TW / 2 + cut + 0.6 + n * (TW - 2 * cut - 1.2) / 8, (podium + top) / 2, tz + side * (TD / 2 + 0.06), b.metal);
        for (let n = 0; n < 7; n++) b.box(0.2, top - podium, 0.09, side * (TW / 2 + 0.06), (podium + top) / 2, tz - TD / 2 + cut + 0.6 + n * (TD - 2 * cut - 1.2) / 6, b.metal);
      }
      for (let k = 0; k < floors - 3; k++) {
        const y = podium + k * storey + 1.15;
        for (const side of [-1, 1]) { b.box(TW - 2 * cut, 0.05, 0.07, 0, y, tz + side * (TD / 2 + 0.04), b.metal); b.box(0.07, 0.05, TD - 2 * cut, side * (TW / 2 + 0.04), y, tz, b.metal); }
      }
    });
    b.colored(frame, () => { for (let k = 3; k < floors - 4; k += 3) for (const side of [-1, 1]) b.box(TW - 2 * cut - 0.2, 0.08, 0.5, 0, podium + k * storey + 2.2, tz + side * (TD / 2 + 0.3), b.paint); });
    // Slim glazing bars halfway between the mullions, and on dear land a fin down the middle of each cut corner.
    const across = Array.from({ length: 8 }, (_, n) => -TW / 2 + cut + 0.6 + (n + 0.5) * (TW - 2 * cut - 1.2) / 8);
    const along = Array.from({ length: 6 }, (_, n) => -TD / 2 + cut + 0.6 + (n + 0.5) * (TD - 2 * cut - 1.2) / 6);
    for (const side of [-1, 1]) {
      b.mullions(across, podium, top, tz + side * (TD / 2 + 0.04), 0, mull);
      b.mullions(along, podium, top, side * (TW / 2 + 0.04), tz, mull, true);
    }
    if (land >= 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const mx = TW / 2 - cut / 2 + 0.12, mz = TD / 2 - cut / 2 + 0.12;
      b.at(sx * mx, (podium + top) / 2, tz + sz * mz, Math.atan2(sx, sz), () => b.tone(frame, 0.16, top - podium, 0.4, 0, 0, 0));
    }
  });
  b.feature('stepped-lit-crown', () => {
    let y = top;
    for (let tier = 0; tier < tiers; tier++) {
      const w = TW - 1.6 - tier * 2.0, d = TD - 1.6 - tier * 2.0, c = Math.max(0.2, cut - 0.3 * tier);
      chamferPrism(b, w, d, c, y, y + 3.4, tier ? b.glass : b.paint, 0, tz);
      b.colored(frame, () => chamferPrism(b, w + 0.2, d + 0.2, c + 0.04, y + 3.4, y + 3.7, b.paint, 0, tz));
      for (const side of [-1, 1]) { b.box(w - 2 * c + 0.1, 0.12, 0.06, 0, y + 3.2, tz + side * (d / 2 + 0.01), glow); b.box(0.06, 0.12, d - 2 * c + 0.1, side * (w / 2 + 0.01), y + 3.2, tz, glow); }
      if (!tier) b.colored(frame, () => { for (let n = 0; n < 4; n++) for (const side of [-1, 1]) {
        b.box(w - 2 * c - 0.2, 0.08, 0.1, 0, y + 0.6 + n * 0.6, tz + side * (d / 2 + 0.05), b.paint);
        b.box(0.1, 0.08, d - 2 * c - 0.2, side * (w / 2 + 0.05), y + 0.6 + n * 0.6, tz, b.paint);
      } });
      y += 3.7;
    }
    b.colored(frame, () => chamferPrism(b, TW + 0.3, TD + 0.3, cut + 0.1, top - 0.1, top + 0.25, b.paint, 0, tz));
    b.gantry(0, y, tz - 2.0, tiers > 1 ? 4.4 : 7.0);
    b.condenser(tiers > 1 ? -1.6 : -3.0, y, tz + 2.0); b.condenser(tiers > 1 ? 1.6 : 3.0, y, tz + 2.0);
    const spire = new ConeGeometry(0.35, 4.4, 6).translate(0, y + 2.2, tz);
    b.colored(0x9aa3a5, () => b.add(applyWorldUV(spire, 1), b.metal)); spire.dispose();
    b.anchor('anchor_light_0', 0, y + 4.4, tz);
  });
  b.feature('drop-off-plaza', () => {
    b.tone(0xcbc6bb, PW + 0.6, 0.06, 9.4 - pz1, 0, 0.03, (pz1 + 9.4) / 2, b.stone);
    for (const x of [-8.3, 8.3]) { b.planter(1.6, 1.6, x, 0.05, 8.4); b.plant(x, 8.4, 5.0, 0.9, 0.5, x > 0 ? 1 : 0); }
    b.auto(-1.6, 6.0, b.pick(CARS), Math.PI / 2); b.auto(3.4, 8.4, b.pick(CARS), -Math.PI / 2);
    for (let n = 0; n < 6; n++) b.tone(0x8b8d88, 0.2, 0.8, 0.2, -5.6 + n * 2.0, 0.4, 9.28, b.stone);
    for (const x of [-2.8, 6.4]) lampPost(b, x, 7.4);
    // The car park ramp down to the basement, between low walls.
    for (const side of [-1, 1]) b.tone(frame, 0.2, 0.9, 3.2, -5.6 + side * 1.4, 0.45, 6.4);
    b.tone(0x2a2d2e, 2.6, 0.04, 3.2, -5.6, 0.07, 6.4, b.stone);
    b.shopSign('ทางเข้าลานจอดรถ', 2.6, 0.4, -5.6, 1.25, 8.06, { background: 0x2f5f8a, foreground: SIGN_INK });
    // Benches under the canopy's edge, a bicycle rack, joints in the paving and a loading bay in the podium's side.
    for (const x of [2.2, 4.8]) b.bench(x, 0.06, 5.6);
    b.bikeRack(7.4, 5.6, 4);
    b.paving(PW + 0.6, 9.4 - pz1, 0, 0.06, (pz1 + 9.4) / 2, 1.6);
    b.tone(0x2a2d2e, 0.05, 3.6, 3.4, PW / 2 + 0.03, 1.9, -6.2);
    b.colored(weather(0xa6aeaf, 1), () => { for (let n = 0; n < 9; n++) b.box(0.04, 0.05, 3.3, PW / 2 + 0.07, 0.5 + n * 0.38, -6.2, b.metal); });
    b.tone(0x8c9293, 0.24, 0.3, 3.6, PW / 2 + 0.12, 3.85, -6.2, b.metal);
  });
  return { floors, podiumFloors: 3, floorHeight: [4.5, storey], height: top + 3.7 * tiers + 4.4, cutCorners: cut, buildingName: name, crownTiers: tiers };
}
