/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { ConeGeometry } from 'three';
import { tint } from '../../materials/library.js';
import { applyWorldUV } from '../../util/geometry.js';
import { chamferPrism } from '../commercial/geometry.js';
import { PlotBuilder, weather } from './builder.js';
import { BIKES } from './homes.js';

const CRATES = [0xc23b33, 0xe2b13c, 0x2f63a3, 0x3f8a52, 0xe6e1d3] as const;
const GAS = [0xb8352d, 0x2f7d4a, 0x2d5f9e, 0xd8a33a] as const;
const AWNINGS = [0xc0563f, 0x3d6f8e, 0xd2a14a, 0x4f7f5c, 0x8f4a6a, 0xd8d2c0] as const;
const SIGN_BACKS = [0xf2ead2, 0xd8463a, 0x2f5f8a, 0xf0c64a, 0x2e6a4f, 0xffffff] as const;
const signInk = (background: number): number => [0xd8463a, 0x2f5f8a, 0x2e6a4f].includes(background) ? 0xfff8ea : 0x2b2622;

/** Level 1: a corner grocery (ร้านโชห่วย) of one or two floors: folding shutters pushed back, a deep canvas awning,
 * crates, gas cylinders, a drinks cooler and the region's own goods on a table out front. R2. */
export function cornerShop(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, s = kit.houses.concrete, land = b.land, seed = b.options.seed ?? 1, floors = land < 2 ? 1 : 2;
  const color = kit.housePalette('concrete', seed), wall = weather(color.wall, land), trim = weather(color.trim, land), stain = [0.26, 0.12, 0.04, 0][land];
  const bx = -0.7, bw = 7.2, back = -4.0, front = 1.2, bd = front - back, bz = (front + back) / 2, ground = 3.9, top = 0.2 + ground + (floors - 1) * 3;
  const name = b.pick(['ร้านค้า', 'ของชำหน้าซอย', 'ร้านชำบ้านสวน', 'ร้านค้ามุมถนน']), signBack = b.pick(SIGN_BACKS);
  b.feature('body', () => {
    b.body(wall, bw, top, bd, bx, 0, bz, stain);
    if (floors > 1) b.tone(trim, bw + 0.1, 0.16, bd + 0.1, bx, 0.2 + ground, bz);
  });
  b.feature('roof', () => b.ridgeRoof(s.roof, bw, bd, top, bz, { pitch: kit.defaults.pitch * 0.5, overhang: 0.3,
    material: s.roofMaterial, wall, trim: color.trim, x: bx }));
  b.feature('gutters-and-downpipes', () => b.gutter(bw - 0.1, bx, top - 0.08, front + 0.37, front + 0.08, weather(0x7d8486, land), [bx - bw / 2 - 0.03, bx + bw / 2 - 0.04]));
  b.feature('open-shop-front', () => {
    b.tone(0x2a2d2c, 5.8, 2.75, 0.04, bx - 0.3, 1.575, front + 0.02);
    for (const dx of [-3.35, 2.75]) b.tone(weather(0x9aa2a3, land), 0.4, 2.75, 0.12, bx + dx, 1.575, front + 0.08, b.metal);
    // Shelving pushed out to the doorway, stacked with packets, bottles and tins.
    for (const dx of [-2.35, 1.9]) {
      b.tone(0x6f7576, 1.3, 2.2, 0.45, bx + dx, 1.3, front + 0.28, b.metal);
      for (let n = 0; n < 4; n++) b.tone(b.pick(CRATES), 1.2, 0.3, 0.2, bx + dx, 0.55 + n * 0.5, front + 0.52, b.fabric);
    }
    b.tone(0xd7d2c4, 1.0, 0.95, 0.6, bx - 0.9, 0.68, front + 0.55);
    b.box(0.9, 0.06, 0.5, bx - 0.9, 1.18, front + 0.55, b.glass);
    b.awning(bw - 0.2, 2.6, bx, 3.2, front + 1.3, weather(b.pick(AWNINGS), land));
    for (const dx of [-3.4, 3.4]) b.tone(0x7e8585, 0.07, 2.9, 0.07, bx + dx, 1.45, front + 2.55, b.metal);
    b.shopSign(name, 4.6, 0.62, bx - 0.3, 3.58, front + 0.06, { background: signBack, foreground: signInk(signBack) });
    // Strings of snack packets hang from the awning frame, as on every grocery front.
    for (let n = 0; n < 6; n++) b.tone(b.pick(CRATES), 0.22, 0.8, 0.05, bx - 2.9 + n * 1.0, 2.35, front + 2.45, b.fabric);
    b.tone(0xb9bcb6, bw - 0.4, 0.07, 0.07, bx, 2.78, front + 2.45, b.metal);
  });
  b.feature('goods-out-front', () => {
    for (let stack = 0; stack < 2; stack++) for (let n = 0; n < 3; n++) b.tone(b.pick(CRATES), 0.48, 0.3, 0.36, -4.05 + stack * 0.52, 0.2 + n * 0.31, front + 0.7, b.fabric);
    for (let n = 0; n < 3; n++) b.colored(b.pick(GAS), () => b.cylinder(0.17, 0.62, bx + 2.5 + n * 0.36, 0.36, front + 2.15, b.metal, 8));
    b.tone(0xe8e3d4, 1.4, 0.36, 0.55, -3.6, 0.23, front + 1.65, b.fabric, 0.06);
    b.tone(0xe6e2d6, 1.3, 0.36, 0.5, -3.6, 0.55, front + 1.65, b.fabric, -0.05);
    // A table of the region's own goods: fruit in the east, sticky rice in Isan, palm sugar in the west.
    b.tone(0x8a6f52, 2.4, 0.08, 0.95, bx - 0.4, 0.94, front + 1.75);
    for (const dx of [-1.05, 1.05]) b.tone(0x6c5a45, 0.08, 0.9, 0.8, bx - 0.4 + dx, 0.47, front + 1.75);
    b.take(kit.marketGoods({ seed }), bx - 0.4, 0, front + 1.75);
    b.tone(b.pick([0xd8d6d0, 0xc8443a, 0x3b6ea5]), 0.8, 1.85, 0.7, bx + 0.7, 1.0, front + 0.62);
    b.box(0.66, 1.4, 0.04, bx + 0.7, 1.15, front + 0.99, b.glass);
    b.tone(0x5c7f9a, 1.4, 0.08, 0.4, bx + 2.0, 0.46, front + 2.95, b.fabric);
    for (const dx of [-0.6, 0.6]) b.tone(0x5c7f9a, 0.06, 0.42, 0.36, bx + 2.0 + dx, 0.23, front + 2.95, b.fabric);
    b.tone(land === 0 ? 0x8d887f : 0xbab6ad, 8.7, 0.06, 4.45 - front, 0.0, 0.03, (front + 4.45) / 2, b.stone);
  });
  b.feature('side-yard', () => {
    b.tone(0xb2aea4, 1.45, 0.05, 5.2, 3.65, 0.03, -1.4, b.stone);
    b.tank(3.7, 0.06, -3.4, 0.42, 1.0, land === 0 ? 0x3c6ea7 : 0xd3d8d9);
    if (b.random() < 0.7) b.scooter(3.7, -1.2, b.pick(BIKES), b.random() < 0.5 ? 0 : Math.PI);
    b.take(b.dress(kit.props[kit.modernHouseProp]({ seed, detail: 'low' })), 3.65, 0.06, 0.9, Math.PI / 2, 0.45);
    b.at(bx + bw / 2, 0, -2.2, Math.PI / 2, () => b.framed(1.0, 1.1, 0, 1.3, 0, trim, { grille: land < 3 ? 0x3b3f40 : 0 }));
    b.ac(bx + bw / 2 + 0.17, 2.6, -0.6, Math.PI / 2);
    b.tone(0xc9ccc6, 0.14, 0.42, 0.3, bx + bw / 2 + 0.07, 1.7, 0.45, b.metal);
    // A folding table and stools where the shopkeeper sits.
    b.colored(0xd9d4c8, () => { b.cylinder(0.4, 0.06, 3.65, 0.75, 2.35, b.fabric, 8); b.cylinder(0.06, 0.72, 3.65, 0.37, 2.35, b.fabric, 6); });
    b.colored(0xc0473b, () => { for (const dz of [-0.6, 0.6]) b.cylinder(0.17, 0.45, 3.65, 0.23, 2.35 + dz, b.fabric, 6); });
  });
  b.feature('upper-floor', () => {
    if (floors > 1) {
      const y = 0.2 + ground + 0.9;
      for (const dx of [-2.2, 1.0]) b.framed(1.4, 1.3, bx + dx, y, front, trim, { grille: land === 2 ? 0x3b3f40 : 0, mullion: true });
      b.ac(bx + 2.65, y + 0.2, front + 0.17);
      if (land === 3) { b.pot(bx - 2.2, front + 0.35, y - 0.4, 0.8); b.pot(bx + 1.0, front + 0.35, y - 0.4, 0.8); }
    }
    b.tone(0x4b4239, 0.86, 2.05, 0.05, bx - 0.35, 1.225, back - 0.025);
    for (let f = 0; f < floors; f++) for (const dx of [-2.1, 1.45]) {
      b.framed(1.1, 1.15, bx + dx, 1.2 + f * 3.1, back, trim, { facing: -1, mullion: true });
    }
  });
  b.feature('greenery', () => { if (land >= 1) b.plant(3.7, 3.85, 3.0, 0.55, 0.06, 0, s.plants[0]); });
  return { floors, floorHeight: [ground, 3], shopName: name, awning: true, gasCylinders: 3, regionalGoods: kit.commercial.goods };
}

/** Level 2: a pair of three-storey shophouses (ตึกแถว) with roller shutters and shop signs; neighbouring plots
 * continue the row. R2: the kit's shophouse style dresses it (timber balconies in the north, east and west, eastern
 * fretwork, Isan timber fronts, the southern five-foot way under stucco arches), on the same massing everywhere. */
export function shophouse(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, style = kit.commercial, land = b.land, seed = b.options.seed ?? 1;
  const W = 8.92, unit = W / 2, back = -4.15, line = 1.8, front = 3.6, ground = 4.0, upper = 3.5, plinth = 0.2, first = plinth + ground;
  const top = first + 2 * upper, stain = [0.28, 0.12, 0.04, 0][land], arcade = style.arcade, shopZ = arcade ? line : front;
  const xs = [-unit / 2, unit / 2], picks = xs.map((_, i) => kit.palette.pick(seed + i * 17, 'plaster'));
  const wall = (i: number): number => weather(picks[i].wall, land), trim = (i: number): number => weather(picks[i].trim, land);
  const timber = (i: number): number => weather(kit.palette.pick(seed + i * 17).wall, land), winZ = front + (style.timberUpper ? 0.06 : 0);
  const names = ['ร้านขายยา', 'ร้านทอง', 'ร้านอะไหล่', 'ข้าวมันไก่', 'ร้านตัดผม', 'วัสดุก่อสร้าง', 'ร้านผ้า', 'ซ่อมโทรศัพท์', 'ก๋วยเตี๋ยวเรือ', 'เครื่องเขียน'];
  const first0 = Math.floor(b.random() * names.length), shops = [names[first0], names[(first0 + 1 + Math.floor(b.random() * (names.length - 1))) % names.length]];
  const backs = xs.map(() => b.pick(SIGN_BACKS));
  b.feature('shophouse-bodies', () => xs.forEach((x, i) => {
    b.body(wall(i), unit - 0.04, top, line - back, x, 0, (back + line) / 2, stain);
    b.body(wall(i), unit - 0.04, top - first, front - line, x, first, (line + front) / 2, stain);
  }));
  b.feature('party-walls-and-floor-bands', () => {
    for (let i = 0; i <= 2; i++) {
      const x = -W / 2 + i * unit + (i === 0 ? 0.12 : i === 2 ? -0.12 : 0), color = trim(Math.min(i, 1));
      if (!arcade) b.tone(wall(Math.min(i, 1)), 0.24, ground, front - line, x, plinth + ground / 2, (line + front) / 2);
      b.tone(color, 0.24, top - first + 0.4, 0.12, x, first + (top - first + 0.4) / 2, front + 0.06);
    }
    xs.forEach((x, i) => {
      for (let f = 0; f < 2; f++) {
        b.tone(trim(i), unit - 0.1, 0.16, 0.14, x, first + f * upper, front + 0.07);
        b.tone(trim(i), unit - 0.1, 0.16, 0.14, x, first + f * upper, back - 0.05);
      }
    });
  });
  b.feature('shop-fronts', () => xs.forEach((x, i) => {
    const gw = unit - 0.6;
    if (land < 2) {
      // Roller shutters (ประตูเหล็กม้วน): one shop may still be shut, the other rolled most of the way up.
      const shut = b.random() < 0.25, h = shut ? 2.9 : 0.85;
      b.tone(0x262928, gw, 2.9, 0.04, x, plinth + 1.45, shopZ + 0.02);
      b.tone(weather(0xa8afb0, land), gw, h, 0.05, x, plinth + 2.9 - h / 2, shopZ + 0.05, b.metal);
      b.tone(0x8d9495, gw + 0.12, 0.3, 0.3, x, plinth + 3.05, shopZ + 0.15, b.metal);
      b.colored(weather(0x8f9798, land), () => { for (let n = 1; n < 3; n++) b.box(gw, 0.04, 0.03, x, plinth + 2.9 - h * n / 3, shopZ + 0.09, b.metal); });
      if (!shut) for (let n = 0; n < 2; n++) b.tone(b.pick(CRATES), 0.9 - n * 0.1, 0.3, 0.5 - n * 0.06, x + 1.3, (arcade ? plinth + 0.06 : 0.06) + 0.15 + n * 0.3, shopZ + 0.42, b.fabric);
    } else {
      b.tone(0x3a4244, gw + 0.12, 3.0, 0.06, x, plinth + 1.5, shopZ + 0.03, b.metal);
      b.box(gw - 0.1, 2.8, 0.04, x, plinth + 1.45, shopZ + 0.07, b.glass);
      b.tone(0x3a4244, 0.06, 2.8, 0.08, x - 0.4, plinth + 1.45, shopZ + 0.1, b.metal);
      // Shelves and a counter seen through the shop window.
      b.tone(0xd8d0bf, gw - 0.6, 1.9, 0.35, x, plinth + 0.95, shopZ - 1.0); b.tone(b.pick(CRATES), gw - 1.4, 0.9, 0.5, x + 0.4, plinth + 0.45, shopZ - 0.5);
    }
    b.shopSign(shops[i], unit - 0.5, 0.72, x, arcade ? first + 0.42 : plinth + ground - 0.5, front + 0.06, { background: backs[i], foreground: signInk(backs[i]) });
    if (!arcade) b.awning(unit - 0.55, 0.76, x, plinth + 3.05, front + 0.4, weather(b.pick(AWNINGS), land));
    if (!arcade) b.tone(0x9a958b, unit - 0.04, plinth, 0.3, x, plinth / 2, front - 0.15);
  }));
  if (arcade) b.feature('five-foot-way-arches', () => {
    xs.forEach((x, i) => b.take(b.dress(kit.ornaments.arch({ width: 4.2, height: 2.35, seed, color: picks[i].trim })), x, plinth, front - 0.12));
    b.tone(0xc9b9a0, W, plinth + 0.06, front - line, 0, (plinth + 0.06) / 2, (line + front) / 2, b.stone);
  });
  b.feature('upper-floors', () => xs.forEach((x, i) => {
    b.tone(0x4b4239, 0.86, 2.05, 0.05, x + 0.6, plinth + 1.025, back - 0.025);
    for (let f = 0; f < 2; f++) {
      const y = first + f * upper + 0.95;
      if (style.timberUpper && f === 0) {
        b.tone(timber(i), unit - 0.3, upper - 0.3, 0.05, x, first + upper / 2, front + 0.03);
        for (let n = 0; n < 3; n++) b.tone(weather(picks[i].shutter, land), unit - 0.3, 0.05, 0.04, x, first + 0.5 + n * 1.0, front + 0.07);
      }
      if (arcade || land === 3) {
        b.framed(arcade ? 2.0 : 3.0, 1.8, x, y - 0.1, winZ, trim(i), { mullion: true, transom: true });
        if (arcade) for (const side of [-1, 1]) b.tone(weather(picks[i].shutter, land), 0.5, 1.8, 0.05, x + side * 1.3, y + 0.8, front + 0.06);
        if (arcade && f === 0) b.take(b.dress(kit.ornaments.pediment({ width: 2.4, seed, color: picks[i].trim })), x, y + 1.85, front + 0.1);
      } else for (const dx of [-1.1, 1.1]) b.framed(1.1, 1.6, x + dx, y, winZ, trim(i), { grille: land === 0 || (land === 1 && f === 0) ? 0x3d4243 : 0, transom: true });
      // Over the arcade the shop signs hang where a second-floor unit would go.
      if (b.random() < 0.8 && !(arcade && f === 0)) {
        if (arcade || land === 3) b.ac(x + 0.6, y - 0.55, front + 0.17); else b.ac(x, y - 0.45, front + 0.17);
      }
      b.backWindow(1.2, 1.4, x, y, back, trim(i));
    }
    if (style.balcony) {
      b.tone(timber(i), unit - 0.3, 0.12, 0.78, x, first + 0.06, front + 0.39);
      if (style.fretwork) b.take(b.dress(kit.ornaments.fretwork({ width: unit - 0.5, height: 0.85, seed, color: picks[i].trim, detail: 'low' })), x, first + 0.1, front + 0.72);
      else {
        b.tone(timber(i), unit - 0.35, 0.08, 0.08, x, first + 1.0, front + 0.74);
        for (let n = 0; n < 6; n++) b.tone(timber(i), 0.06, 0.88, 0.06, x - 1.85 + n * 0.74, first + 0.55, front + 0.74);
      }
    }
  }));
  b.feature('roof', () => {
    if (style.roof === 'flatParapet') {
      b.parapet(trim(0), W, front - back, 0, top + 0.12, (back + front) / 2, 0.9);
      b.tone(trim(0), W, 0.5, 0.2, 0, top + 1.25, front - 0.1);
      b.tank(-2.6, top + 0.12, -2.8, 0.5, 1.2, land === 0 ? 0x3c6ea7 : 0xd3d8d9); b.tank(2.4, top + 0.12, -2.8, 0.5, 1.2);
      b.tone(weather(0xd6d1c6, land), 1.6, 2.2, 1.8, 2.4, top + 1.22, 0.6);
    } else b.ridgeRoof(style.roof, W, front - back, top, (back + front) / 2, { pitch: kit.defaults.pitch * 0.4, overhang: 0.22,
      material: style.roofMaterial ?? kit.defaults.roofMaterial, wall: wall(0), trim: picks[0].trim });
  });
  b.feature('gutters-and-downpipes', () => {
    if (style.roof === 'flatParapet') b.gutter(0.3, 0.2, top + 0.9, front + 0.1, front + 0.08, weather(0x7d8486, land), [0.2]);
    else b.gutter(W - 0.1, 0, top - 0.08, front + 0.29, front + 0.08, weather(0x7d8486, land), [0.2]);
  });
  b.feature('pavement-life', () => {
    b.tone(land === 0 ? 0x8f8a80 : 0xc4bdb0, W, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
    if (land < 2) {
      b.scooter(xs[0] - 0.6, front + 0.42, b.pick(BIKES), Math.PI / 2);
      for (let n = 0; n < 2; n++) b.tone(b.pick(CRATES), 0.5, 0.32, 0.4, xs[1] - 1.4, 0.22 + n * 0.33, front + 0.45, b.fabric);
    } else {
      b.pot(xs[0] - 1.6, front + 0.45); b.pot(xs[1] + 1.6, front + 0.45);
      b.tone(0x6c5a45, 1.2, 0.42, 0.36, xs[1] - 0.6, 0.26, front + 0.42);
    }
    if (land >= 1 && b.random() < 0.6) b.shopSign(b.pick(['ขายส่ง', 'ร้านยา', 'ร้านทอง', 'ข้าวแกง']), 0.45, 1.9, -0.27, first + upper + 1.6, front + 0.1,
      { vertical: true, background: 0xd84a3b, foreground: 0xfff4dc });
  });
  return { floors: 3, floorHeight: [ground, upper], units: 2, shopNames: shops, shutters: land < 2, coveredArcade: arcade,
    woodenBalconies: style.balcony, fretwork: style.balcony && style.fretwork, timberFront: style.timberUpper, roofForm: style.roof };
}

/** Level 3: a four- or five-storey mixed-use building, a shop on the ground floor under a concrete canopy and offices
 * (cheaper land) or a small hotel (dearer land) above. R2: roof form and colours come from the kit. */
export function mixedUse(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, style = kit.commercial, land = b.land, seed = b.options.seed ?? 1, floors = land < 2 ? 4 : 5, hotel = land >= 2;
  const ground = 4.0, upper = 3.5, plinth = 0.2, first = plinth + ground, top = first + (floors - 1) * upper;
  const W = 8.8, back = -4.1, front = 2.6, bd = front - back, bz = (front + back) / 2, stain = [0.28, 0.12, 0.04, 0][land];
  const tone = hotel ? kit.palette.pick(seed, 'plaster') : kit.neutralPalette(seed), wall = weather(tone.wall, land), trim = weather(tone.trim, land);
  const shop = b.pick(['ร้านขายยา', 'มินิมาร์ท', 'ร้านกาแฟ', 'ร้านเบเกอรี่']), signBack = shop === 'ร้านขายยา' ? 0x2e7a50 : b.pick(SIGN_BACKS);
  const upperName = hotel ? b.pick(['โรงแรมบ้านสวน', 'โรงแรมลมเย็น', 'โรงแรมใบไม้', 'เกสต์เฮาส์ริมทาง']) : b.pick(['โรงเรียนกวดวิชา', 'สำนักงานบัญชี', 'บริษัททัวร์', 'สำนักงานทนายความ']);
  b.feature('body', () => {
    b.body(wall, W, top, bd, 0, 0, bz, stain);
    for (let f = 1; f < floors; f++) b.tone(trim, W + 0.1, 0.18, bd + 0.1, 0, first + (f - 1) * upper, bz);
  });
  b.feature('shop-and-canopy', () => {
    b.tone(0x3a4244, 6.6, 3.0, 0.06, -0.9, plinth + 1.5, front + 0.03, b.metal);
    b.box(6.4, 2.85, 0.04, -0.9, plinth + 1.45, front + 0.07, b.glass);
    b.tone(0x30343a, 1.1, 2.6, 0.05, 3.3, plinth + 1.3, front + 0.03);
    b.tone(trim, W, 0.28, 1.35, 0, first - 0.3, front + 0.66);
    b.shopSign(shop, 4.4, 0.45, -0.9, first - 0.3, front + 1.36, { background: signBack, foreground: signInk(signBack) });
    b.tone(land === 0 ? 0x8f8a80 : 0xc4bdb0, W, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
  });
  b.feature(hotel ? 'hotel-balconies' : 'office-ribbon-windows', () => {
    for (let f = 1; f < floors; f++) {
      const y = first + (f - 1) * upper;
      if (hotel) {
        for (let n = 0; n < 2; n++) {
          const x = -2.7 + n * 3.0;
          b.tone(trim, 2.7, 0.14, 0.9, x, y + 0.07, front + 0.45);
          if (land === 3) b.box(2.65, 0.95, 0.04, x, y + 0.62, front + 0.87, b.glass); else b.bars(2.65, 1.0, x, y + 0.12, front + 0.86, 7, 0x3f4547);
          b.tone(0xc0c3bf, 1.8, 2.25, 0.05, x - 0.25, y + 1.25, front + 0.025, b.metal);
          b.box(1.66, 2.1, 0.04, x - 0.25, y + 1.2, front + 0.06, b.glass);
          if ((n + f) % 2) b.pot(x + 0.9, front + 0.5, y + 0.14, 0.7);
          else b.ac(x + 0.95, y + 0.42, front + 0.3);
          if (land === 3) b.tone(0x8a9294, 2.65, 0.05, 0.07, x, y + 1.12, front + 0.87, b.metal);
        }
        b.framed(0.85, 1.5, 2.85, y + 1.0, front, trim, { transom: true });
      } else {
        b.box(W - 0.9, 1.6, 0.05, 0, y + 1.75, front + 0.03, b.glass);
        b.colored(trim, () => {
          for (let n = 0; n < 7; n++) if (n !== 1 && n !== 5) b.box(0.06, 1.6, 0.08, -3.3 + n * 1.1, y + 1.75, front + 0.07, b.paint);
          b.box(W - 0.8, 0.08, 0.3, 0, y + 0.92, front + 0.15, b.paint); b.box(W - 0.8, 0.07, 0.6, 0, y + 2.62, front + 0.3, b.paint);
        });
        if (b.random() < 0.7) b.ac(b.pick([-2.2, 0, 2.2]), y + 0.55, front + 0.17);
      }
      if (hotel) b.pane(W - 2.0, 1.4, 0, y + 1.75, back - 0.02, b.glass, Math.PI);
      else for (const dx of [-2.2, 0, 2.2]) b.framed(1.6, 1.3, dx, y + 1.1, back, trim, { facing: -1, mullion: true });
      for (const side of [-1, 1]) b.pane(1.6, 1.3, side * (W / 2 + 0.02), y + 1.75, bz - 1.2, b.glass, side * Math.PI / 2);
    }
    if (!hotel) for (const x of [-3.3, -1.1, 1.1, 3.3]) b.tone(trim, 0.14, top - first, 0.45, x, (first + top) / 2, front + 0.24);
    b.shopSign(upperName, hotel ? 0.7 : 0.6, hotel ? 4.4 : 3.6, 4.08, first + (hotel ? 3.4 : 2.6), front + 0.32, { vertical: true, lit: hotel,
      background: hotel ? 0x22443f : 0xf3eedf, foreground: hotel ? 0xf6e7b6 : 0x2c3e4f });
    b.tone(0x7d8485, 0.08, 0.08, 0.3, 4.08, first + (hotel ? 5.6 : 4.4), front + 0.15, b.metal);
  });
  b.feature('roof', () => {
    if (style.roof === 'flatParapet') {
      b.parapet(trim, W, bd, 0, top + 0.12, bz, 1.0);
      b.tank(-2.8, top + 0.12, bz - 1.6, 0.55, 1.3); b.tank(-1.5, top + 0.12, bz - 1.6, 0.55, 1.3);
      for (const dx of [1.4, 2.6]) b.ac(dx, top + 0.45, bz - 1.9);
      b.tone(weather(0xd6d1c6, land), 2.0, 2.3, 2.2, 2.6, top + 1.27, bz + 1.2);
    } else b.ridgeRoof(style.roof, W, bd, top, bz, { pitch: kit.defaults.pitch * 0.35, overhang: 0.3,
      material: style.roofMaterial ?? kit.defaults.roofMaterial, wall, trim: tone.trim });
  });
  b.feature('entrance-and-downpipes', () => {
    b.colored(0x3a4244, () => { for (const dx of [-0.55, 0.55]) b.box(0.07, 2.6, 0.08, 3.3 + dx, plinth + 1.3, front + 0.06, b.metal); b.box(1.17, 0.08, 0.08, 3.3, plinth + 2.62, front + 0.06, b.metal); });
    b.lamp(2.55, plinth + 2.6, front); b.lamp(-4.1, plinth + 2.6, front);
    for (const x of [-3.6, -1.8, 0]) b.tone(0x8b8d88, 0.2, 0.8, 0.2, x, 0.4, 4.3, b.stone);
    if (style.roof === 'flatParapet') b.gutter(0.3, -W / 2 + 0.2, top + 0.9, back - 0.1, back - 0.08, weather(0x7d8486, land), [-W / 2 + 0.2]);
    else b.gutter(W - 0.1, 0, top - 0.08, back - 0.3, back - 0.08, weather(0x7d8486, land), [-W / 2 + 0.2, W / 2 - 0.2]);
  });
  b.feature('street-front', () => {
    if (hotel) { b.pot(-3.8, front + 1.35); b.pot(2.3, front + 1.35); b.plant(3.85, 3.85, 3.0, 0.45, 0.06, 1); }
    else for (let n = 0; n < 3; n++) b.scooter(-3.2 + n * 1.2, front + 0.95, b.pick(BIKES), Math.PI + (b.random() - 0.5) * 0.3);
  });
  return { floors, floorHeight: [ground, upper], upperUse: hotel ? 'hotel' : 'offices', shopName: shop, upperName, roofForm: style.roof };
}

/** Level 4: an eight- to twelve-storey office block: a concrete frame of corner piers and spandrel bands around
 * a glass core, a double-height lobby under a canopy and plant rooms on the roof. R3. */
export function office(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [8, 9, 10, 12][land], lobby = 4.5, storey = 3.5, plinth = 0.2, first = plinth + lobby;
  const top = first + (floors - 1) * storey, W = 8.4, D = 7.0, bz = -0.6, front = bz + D / 2, back = bz - D / 2;
  const frame = b.vary([0xc9bea6, 0xb7b9b4, 0xe3e4e0, 0xd2d6d6][land]), band = land === 3 ? 0.35 : 0.9, glow = tint('emissive_window', 0xb6d9e4);
  const name = b.pick(['อาคารลานฟ้า', 'อาคารใบหยก', 'อาคารเมฆขาว', 'อาคารสายลม']);
  b.feature('glass-core-and-frame', () => {
    b.mass(W - 0.5, top - first + 0.4, D - 0.5, 0, (first + top) / 2, bz, b.glass);
    b.mass(W - 1.2, lobby, D - 1.2, 0, plinth + lobby / 2, bz, b.glass);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tone(frame, 0.62, top - plinth + 0.2, 0.62, sx * (W / 2 - 0.31), (top + plinth) / 2 + 0.1, bz + sz * (D / 2 - 0.31));
    for (let k = 0; k < floors; k++) b.tone(frame, W, band, D, 0, first + k * storey - band / 2 + 0.1, bz);
    b.streak(b.parts.length - floors, plinth, top, [0.22, 0.08, 0, 0][land]);
    if (land >= 2) for (const side of [-1, 1]) for (let n = 0; n < (land === 3 ? 7 : 4); n++) {
      const x = -W / 2 + 0.9 + n * (W - 1.8) / (land === 3 ? 6 : 3);
      b.tone(0xaab2b4, 0.1, top - first, 0.35, x, (first + top) / 2, bz + side * (D / 2 + 0.17), b.metal);
    }
    if (land === 0) for (let k = 1; k < floors; k++) for (const dx of [-2.2, 1.6]) b.ac(dx, first + k * storey - 0.15, front + 0.17);
    if (land < 2) for (let k = 1; k < floors; k++) for (const dx of [-1.6, 2.2]) b.ac(dx, first + k * storey - 0.15, back - 0.17, Math.PI);
  });
  b.feature('mullions-ledges-and-transoms', () => {
    const glass = D / 2 - 0.25, side = W / 2 - 0.25, h = top - first;
    b.colored(land < 2 ? 0x5c6466 : 0x9aa4a7, () => {
      for (const sz of [-1, 1]) for (let n = 0; n < 7; n++) b.box(0.06, h, 0.1, -3.3 + n * 1.1, (first + top) / 2, bz + sz * (glass + 0.05), b.metal);
      for (const sx of [-1, 1]) for (let n = 0; n < 5; n++) b.box(0.1, h, 0.06, sx * (side + 0.05), (first + top) / 2, bz - 2.6 + n * 1.3, b.metal);
      for (let k = 0; k < floors - 1; k++) {
        const y = first + k * storey + storey * 0.72;
        for (const sz of [-1, 1]) b.box(W - 1.3, 0.05, 0.06, 0, y, bz + sz * (glass + 0.05), b.metal);
        for (const sx of [-1, 1]) b.box(0.06, 0.05, D - 1.3, sx * (side + 0.05), y, bz, b.metal);
      }
    });
    // Sun ledges along each floor of the street and back faces.
    b.colored(frame, () => { for (let k = 1; k < floors; k++) {
      for (const sz of [-1, 1]) b.box(W - 1.24, 0.08, sz > 0 ? 0.45 : 0.28, 0, first + k * storey + 0.5, bz + sz * (D / 2 + (sz > 0 ? 0.2 : 0.12)), b.paint);
      for (const sx of [-1, 1]) b.box(0.28, 0.08, D - 1.24, sx * (W / 2 + 0.12), first + k * storey + 0.5, bz, b.paint);
    } });
  });
  b.feature('lobby-canopy-and-forecourt', () => {
    b.tone(0x9a9d9a, 4.6, 0.25, 1.5, 0, plinth + lobby - 0.35, front + 0.75, b.stone);
    for (const dx of [-2.1, 2.1]) b.tone(0x6c7374, 0.12, lobby - 0.5, 0.12, dx, plinth + (lobby - 0.5) / 2, front + 1.4, b.metal);
    b.shopSign(name, 4.0, 0.45, 0, plinth + lobby - 0.35, front + 1.53, { background: 0x2c3a3d, foreground: 0xf0ead8, lit: land >= 2 });
    b.tone(0xc8c3b8, 8.9, 0.06, 4.45 - back, 0, 0.03, (back + 4.45) / 2, b.stone);
    for (const x of [-3.7, 3.7]) { b.tone(0x8c7f6c, 1.2, 0.5, 1.2, x, 0.25, 3.75); b.plant(x, 3.75, 3.4, 0.5, 0.5, x > 0 ? 1 : 0); }
    b.framed(1.8, 2.6, 0, plinth + 0.05, bz + D / 2 - 0.6, 0x5a6264, { mullion: true, transom: true });
    for (const x of [-2.4, -1.7, 1.7, 2.4]) b.tone(0x8b8d88, 0.2, 0.75, 0.2, x, 0.4, 4.32, b.stone);
    for (const x of [-4.2, 4.2]) { b.tone(0x50585a, 0.08, 3.6, 0.08, x, 1.8, 2.75, b.metal); b.tone(0xf0ead6, 0.3, 0.16, 0.3, x, 3.6, 2.75); }
    b.tone(0x6c5a45, 1.3, 0.42, 0.4, -2.0, 0.26, 3.9); b.tone(0x6c5a45, 1.3, 0.42, 0.4, 2.0, 0.26, 3.9);
    b.bikeRack(4.0, -0.8, 4, true);
    b.paving(8.9, 4.45 - back, 0, 0.06, (back + 4.45) / 2, 1.45);
  });
  b.feature('roof-plant', () => {
    b.parapet(frame, W, D, 0, top + 0.12, bz, 1.1);
    b.body(frame, 3.4, 3.0, 2.8, -1.6, top + 0.12, bz - 1.4, 0);
    b.colored(0x9fa6a6, () => b.cylinder(0.85, 1.6, 2.3, top + 0.92, bz - 1.6, b.metal, 10));
    b.tank(2.3, top + 0.12, bz + 1.3, 0.5, 1.2); b.tank(1.1, top + 0.12, bz + 1.3, 0.5, 1.2);
    for (const dx of [-2.6, -1.3, 0]) b.condenser(dx, top + 0.12, bz + 1.6);
    b.colored(0x8a9192, () => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.06, 1.7, 0.06, sx * (W / 2 - 0.3), top + 1.0, bz + sz * (D / 2 - 0.3), b.metal);
      for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) b.box(0.1, 0.6, 0.1, 2.3 + dx, top + 0.42, bz - 1.6 + dz, b.metal); });
    b.tone(0x8a9192, 0.1, 5.0, 0.1, -2.6, top + 5.6, bz - 1.4, b.metal);
    b.dish(-1.2, top + 3.12, bz - 1.2, 0.8); b.dish(-0.4, top + 3.12, bz - 2.2, -0.4);
    // A roof hatch on the plant room and the cat ladder up its side.
    b.tone(0x8c9393, 0.9, 0.25, 0.9, -2.6, top + 3.25, bz - 2.2, b.metal);
    b.colored(0x6e7577, () => {
      for (const dz of [-0.2, 0.2]) b.box(0.05, 3.0, 0.05, -3.36, top + 1.62, bz - 2.0 + dz, b.metal);
      for (let n = 0; n < 8; n++) b.box(0.04, 0.04, 0.44, -3.36, top + 0.4 + n * 0.36, bz - 2.0, b.metal);
    });
    b.tone(0x3a3f40, 0.9, 2.0, 0.05, -1.0, top + 1.12, bz - 1.4 + 1.42);
    if (land >= 2) for (const side of [-1, 1]) b.box(W + 0.04, 0.12, 0.06, 0, top + 1.1, bz + side * (D / 2 + 0.01), glow);
    else b.box(3.5, 0.12, 0.06, -1.6, top + 2.9, bz + 0.03, glow);
  });
  return { floors, floorHeight: [lobby, storey], height: top + 8.1, buildingName: name, sunFins: land === 3 ? 14 : land === 2 ? 8 : 0, hungAirConditioners: land === 0 };
}

/** Level 5: a 20–30 storey office tower in a glass curtain wall with a stepped, lit crown and a mast (no logos);
 * on dearer land its corners are cut. R3. */
export function officeTower(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [20, 23, 26, 30][land], lobby = 6.0, storey = 3.6, plinth = 0.2, first = plinth + lobby;
  const top = first + (floors - 2) * storey, T = 7.4, tz = -0.6, cut = land < 2 ? 0.3 : 1.1, front = tz + T / 2;
  const frame = b.vary([0xc7bda9, 0xaeb4b5, 0xd9dcdc, 0xe4e6e5][land]), glow = tint('emissive_window', 0xa9d9d1);
  const name = b.pick(['ทาวเวอร์ลานเมฆ', 'อาคารฟ้าใส', 'อาคารยอดเมฆ', 'อาคารริ้วฟ้า']);
  b.feature('curtain-wall-tower', () => {
    chamferPrism(b, T, T, cut, first, top, b.glass, 0, tz);
    b.colored(frame, () => {
      for (let k = 0; k <= floors - 2; k++) chamferPrism(b, T + 0.14, T + 0.14, cut + 0.04, first + k * storey - 0.08, first + k * storey + (land < 2 ? 0.55 : k % 3 ? 0.08 : 0.2), b.paint, 0, tz);
    });
    // Sun fins every third floor on the street and back faces.
    b.colored(frame, () => { for (let k = 3; k < floors - 2; k += 3) b.box(T - 2 * cut - 0.2, 0.08, 0.5, 0, first + k * storey + 2.2, tz + T / 2 + 0.3, b.paint); });
    // A slim transom on every floor of every face.
    b.colored(0x7f8a8e, () => { for (let k = 0; k < floors - 2; k++) {
      const y = first + k * storey + 1.15;
      for (const side of [-1, 1]) { b.box(T - 2 * cut, 0.05, 0.07, 0, y, tz + side * (T / 2 + 0.04), b.metal); b.box(0.07, 0.05, T - 2 * cut, side * (T / 2 + 0.04), y, tz, b.metal); }
    } });
    for (const side of [-1, 1]) for (const d of [-T / 2 + cut + 0.9, -1.8, -0.6, 0.6, 1.8, T / 2 - cut - 0.9]) {
      b.tone(0x8c979b, 0.09, top - first, 0.22, d, (first + top) / 2, tz + side * (T / 2 + 0.06), b.metal);
      b.tone(0x8c979b, 0.22, top - first, 0.09, side * (T / 2 + 0.06), (first + top) / 2, tz + d, b.metal);
    }
    // Slim glazing bars between the fins, and on dear land a fin down the middle of each cut corner.
    for (const side of [-1, 1]) {
      b.mullions([-1.2, 0, 1.2], first, top, tz + side * (T / 2 + 0.04), 0, 0x7f8a8e);
      b.mullions([-1.2, 0, 1.2], first, top, side * (T / 2 + 0.04), tz, 0x7f8a8e, true);
    }
    if (land >= 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const m = T / 2 - cut / 2 + 0.12;
      b.at(sx * m, (first + top) / 2, tz + sz * m, Math.atan2(sx, sz), () => b.tone(frame, 0.14, top - first, 0.36, 0, 0, 0));
    }
  });
  b.feature('lobby', () => {
    chamferPrism(b, T - 0.8, T - 0.8, Math.max(0.2, cut - 0.3), plinth, first, b.glass, 0, tz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tone(frame, 0.45, lobby, 0.45, sx * (T / 2 - cut - 0.25), plinth + lobby / 2, tz + sz * (T / 2 - 0.25));
    b.tone(0x9a9d9a, 5.0, 0.25, 1.4, 0, plinth + lobby - 1.2, front + 0.55, b.stone);
    b.shopSign(name, 4.2, 0.45, 0, plinth + lobby - 1.2, front + 1.27, { background: 0x22302f, foreground: 0xeef3ea, lit: true });
    b.tone(0xcbc6bb, 8.9, 0.06, 8.9, 0, 0.03, 0, b.stone);
    for (const x of [-3.75, 3.75]) { b.tone(0x8c7f6c, 1.1, 0.5, 1.1, x, 0.25, 3.75); b.plant(x, 3.75, 3.6, 0.48, 0.5, x > 0 ? 1 : 0); }
    b.framed(2.2, 3.2, 0, plinth + 0.05, tz + (T - 0.8) / 2, 0x4c5557, { mullion: true, transom: true });
    b.colored(0x5a6264, () => { for (const dx of [-2.2, 2.2]) b.box(0.08, lobby - 0.4, 0.08, dx, plinth + (lobby - 0.4) / 2, tz + (T - 0.8) / 2 + 0.06, b.metal); });
    for (const x of [-4.25, 4.25]) { b.tone(0x50585a, 0.08, 3.6, 0.08, x, 1.8, 2.2, b.metal); b.tone(0xf0ead6, 0.3, 0.16, 0.3, x, 3.6, 2.2); }
    for (const x of [-4.25, 4.25]) b.tone(0x6c5a45, 0.4, 0.42, 1.4, x, 0.26, -1.2);
    // A revolving door in the entrance, a bicycle rack under the tower's edge and joints in the paving.
    const door = tz + (T - 0.8) / 2;
    b.colored(0x5a6264, () => { b.cylinder(0.9, 0.16, 0, plinth + 2.68, door, b.metal, 12); for (const r of [0, Math.PI / 2]) b.at(0, plinth + 1.3, door, r, () => b.box(1.7, 2.5, 0.05, 0, 0, 0, b.metal)); });
    b.cylinder(0.88, 2.5, 0, plinth + 1.3, door, b.glass, 12);
    b.bikeRack(-4.05, 0.6, 4, true);
    b.paving(8.9, 8.9, 0, 0.06, 0, 1.48);
  });
  b.feature('stepped-lit-crown', () => {
    let y = top;
    for (let tier = 0; tier < (land < 2 ? 1 : 2); tier++) {
      const w = T - 1.4 - tier * 1.6;
      chamferPrism(b, w, w, Math.max(0.2, cut - 0.2 * tier), y, y + 3.4, tier ? b.glass : b.paint, 0, tz);
      b.colored(frame, () => chamferPrism(b, w + 0.2, w + 0.2, Math.max(0.24, cut - 0.2 * tier + 0.04), y + 3.4, y + 3.7, b.paint, 0, tz));
      for (const side of [-1, 1]) { b.box(w - 2 * cut + 0.1, 0.12, 0.06, 0, y + 3.2, tz + side * (w / 2 + 0.01), glow); b.box(0.06, 0.12, w - 2 * cut + 0.1, side * (w / 2 + 0.01), y + 3.2, tz, glow); }
      // Louvred plant-room screens below each lit band.
      if (!tier) b.colored(frame, () => { for (let n = 0; n < 4; n++) for (const side of [-1, 1]) {
        b.box(w - 2 * cut - 0.2, 0.08, 0.1, 0, y + 0.6 + n * 0.6, tz + side * (w / 2 + 0.05), b.paint);
        b.box(0.1, 0.08, w - 2 * cut - 0.2, side * (w / 2 + 0.05), y + 0.6 + n * 0.6, tz, b.paint);
      } });
      y += 3.7;
    }
    b.colored(frame, () => chamferPrism(b, T + 0.3, T + 0.3, cut + 0.1, top - 0.1, top + 0.25, b.paint, 0, tz));
    b.gantry(0, y, tz - 1.3, land < 2 ? 4.6 : 3.2);
    const spire = new ConeGeometry(0.35, 5.5, 6).translate(0, y + 2.75, tz);
    b.colored(0x9aa3a5, () => b.add(applyWorldUV(spire, 1), b.metal)); spire.dispose();
    b.anchor('anchor_light_0', 0, y + 5.5, tz);
  });
  b.feature('forecourt', () => {
    for (const x of [-2.4, -1.6, 1.6, 2.4]) b.tone(0x7d8485, 0.14, 0.8, 0.14, x, 0.42, 4.25, b.metal);
    b.tone(0x6c5a45, 0.42, 0.42, 1.4, -4.15, 0.25, 0.5);
  });
  return { floors, floorHeight: [lobby, storey], height: top + (land < 2 ? 3.7 : 7.4) + 5.5, cutCorners: cut, buildingName: name, litCrown: true };
}
