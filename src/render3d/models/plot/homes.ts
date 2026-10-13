/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../../materials/library.js';
import { PlotBuilder, weather } from './builder.js';

export const BIKES = [0xb23a32, 0x2f5f9a, 0x2b2d2e, 0xd9d6cc, 0x6e7f42, 0xc4882f] as const;
export const CARS = [0xe4e5e1, 0x8d9396, 0x2d3133, 0x7d2a27, 0x3e5873, 0xb8b2a1] as const;

/** Level 2: two-storey townhouse row (ทาวน์เฮาส์), three narrow units on cheap land and two wider ones on dear land,
 * each with a paved front yard behind its own gate. R2: the kit's modern concrete house gives roof, colours and props. */
export function townhouse(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, s = kit.houses.concrete, land = b.land, seed = b.options.seed ?? 1;
  const units = land < 2 ? 3 : 2, W = 8.8, unit = W / units, front = land < 2 ? 1.25 : 0.55, back = -3.95;
  const depth = front - back, zc = (front + back) / 2, plinth = 0.3, storey = 3.1, top = plinth + storey * 2, stain = [0.24, 0.1, 0.03, 0][land];
  const colors = Array.from({ length: units }, (_, i) => kit.housePalette('concrete', land < 2 ? seed + i * 31 : seed));
  const wall = (i: number): number => weather(colors[i].wall, land), trim = (i: number): number => weather(colors[i].trim, land);
  const xs = Array.from({ length: units }, (_, i) => -W / 2 + unit * (i + 0.5)), edge = (i: number): number => -W / 2 + i * unit;
  const gate = land === 0 ? 0x5b4a3c : land === 3 ? 0x2c3032 : weather(colors[0].shutter, land), yardEnd = 4.4, yardMid = (front + yardEnd) / 2;
  const tankAt = Math.floor(b.random() * units), propAt = (tankAt + 1) % units, laundryAt = (tankAt + 2) % units, hedgeAt = units - 1;
  b.feature('body', () => {
    xs.forEach((x, i) => b.body(wall(i), unit - 0.04, top, depth, x, 0, zc, stain));
    // Party walls stand proud of the front and rise as short fire walls between the units.
    for (let i = 0; i <= units; i++) b.tone(trim(Math.min(i, units - 1)), 0.2, top + 0.3, 0.3, edge(i) + (i === 0 ? 0.1 : i === units ? -0.1 : 0), (top + 0.3) / 2, front + 0.1);
    b.tone(trim(0), W - 0.2, 0.16, 0.3, 0, plinth + storey, front + 0.1);
  });
  b.feature('roof', () => b.ridgeRoof(s.roof, W, depth, top, zc, { pitch: kit.defaults.pitch * 0.6, overhang: 0.35,
    material: s.roofMaterial, wall: wall(0), ornaments: true, trim: trim(0) }));
  b.feature('gutters-and-downpipes', () => b.gutter(W - 0.1, 0, top - 0.08, front + 0.42, front + 0.3, weather(0x7d8486, land),
    units === 3 ? [edge(1), edge(2)] : [0], 1.0));
  b.feature('ground-floor', () => xs.forEach((x, i) => {
    if (units === 3) {
      // A narrow unit's whole front is a folding steel gate (ประตูเหล็กยืด) over a dark doorway, under a concrete canopy.
      b.tone(0x2d302f, unit - 0.7, 2.4, 0.04, x, plinth + 1.2, front + 0.02);
      b.bars(unit - 0.7, 2.4, x, plinth, front + 0.07, 6, weather(0x6d7471, land));
      b.tilt(trim(i), unit - 0.14, 0.07, 1.05, x, plinth + storey - 0.2, front + 0.5, 0.22);
    } else {
      b.tone(0xb9bcb8, 1.9, 2.45, 0.05, x - 1.0, plinth + 1.22, front + 0.025, b.metal);
      b.box(1.74, 2.3, 0.04, x - 1.0, plinth + 1.17, front + 0.06, b.glass);
      b.framed(1.5, 1.25, x + 1.15, plinth + 0.95, front, trim(i), { grille: land < 3 ? 0x3b3f40 : 0, mullion: true });
      b.tone(trim(i), 1.25, 0.08, 0.7, x - 1.0, plinth + 2.62, front + 0.35);
    }
    b.lamp(edge(i) + 0.3, plinth + 2.3, front + 0.25);
    b.pane(1.1, 1.1, x, plinth + 1.6, back - 0.02, b.glass, Math.PI);
  }));
  b.feature('upper-floor', () => xs.forEach((x, i) => {
    const y = plinth + storey + 0.95;
    if (units === 3) {
      b.window(1.35, 1.35, x - 0.25, y, front, trim(i), land === 0 ? 0x3b3f40 : 0);
      b.ac(x + 0.95, y + 0.25, front + 0.17);
    } else {
      // Wider units: a balcony over the front door with a sliding door and a side window.
      b.tone(trim(i), unit - 0.5, 0.14, 0.9, x, plinth + storey + 0.05, front + 0.45);
      b.tone(0xb9bcb8, 2.0, 2.2, 0.05, x - 0.7, y + 0.15, front + 0.025, b.metal);
      b.box(1.86, 2.08, 0.04, x - 0.7, y + 0.13, front + 0.06, b.glass);
      if (land === 3) b.box(unit - 0.5, 0.9, 0.04, x, plinth + storey + 0.6, front + 0.88, b.glass);
      else b.bars(unit - 0.5, 0.95, x, plinth + storey + 0.12, front + 0.86, 9, gate);
      b.framed(0.95, 1.3, x + 1.3, y, front, trim(i), { transom: true });
      b.ac(x + 1.3, plinth + storey + 0.45, front + 0.55);
      if (land === 3) b.planter(1.0, 0.35, x - 1.45, plinth + storey + 0.12, front + 0.62);
      if (s.windowFret) b.take(b.dress(kit.ornaments.fretwork({ width: 2.0, height: 0.3, seed, color: colors[i].trim, detail: 'low' })), x - 0.7, y + 1.95, front + 0.1);
    }
    if (s.ventPanel) for (let n = 0; n < 3; n++) b.tone(trim(i), 0.9, 0.06, 0.06, x + (units === 3 ? -0.25 : 1.3), top - 0.5 + n * 0.12, front + 0.04);
    b.pane(1.2, 1.2, x, y + 0.65, back - 0.02, b.glass, Math.PI);
  }));
  b.feature('front-yards-and-gates', () => {
    const pave = [0x8f8a80, 0xb3afa6, 0xc9c6bf, 0xd8d3c8][land];
    xs.forEach(x => b.tone(pave, unit - 0.12, 0.06, yardEnd - front, x, 0.03, yardMid, b.stone));
    for (let i = 1; i < units; i++) b.tone(wall(i), 0.12, 0.95, yardEnd - front - 0.1, edge(i), 0.475, yardMid);
    for (let i = 0; i <= units; i++) b.tone(trim(Math.min(i, units - 1)), 0.3, 1.45, 0.3, edge(i) + (i === 0 ? 0.15 : i === units ? -0.15 : 0), 0.725, yardEnd - 0.15);
    xs.forEach(x => b.bars(unit - 0.3, 1.25, x, 0.06, yardEnd - 0.12, units === 3 ? 6 : 9, gate));
  });
  b.feature('yard-life', () => {
    xs.forEach((x, i) => {
      if (!(land === 3 && i === propAt) && (b.random() < 0.75 || land < 2)) b.scooter(x - unit * 0.18, yardMid - 0.1, b.pick(BIKES), b.random() < 0.5 ? 0 : Math.PI);
      if (land >= 1 && !(s.hedge && i === hedgeAt) && !(land < 2 && i === laundryAt) && !(land === 3 && i === propAt)) b.pot(x + unit / 2 - 0.62, yardEnd - 0.62);
    });
    b.tank(xs[tankAt] + unit / 2 - 0.62, 0.06, front + 0.62, 0.4, 1.0, land === 0 ? 0x3c6ea7 : 0xd3d8d9);
    if (land === 3) {
      b.auto(xs[propAt], yardMid + 0.05, b.pick(CARS), Math.PI / 2);
      // A sheet-metal carport over the car, on two slim posts at the gate.
      b.tilt(0x9aa3a6, unit - 0.3, 0.05, yardEnd - front - 0.35, xs[propAt], 2.55, yardMid - 0.1, -0.08, b.metal);
      for (const dx of [-1, 1]) b.tone(0x5d6466, 0.08, 2.62, 0.08, xs[propAt] + dx * (unit / 2 - 0.3), 1.33, yardEnd - 0.45, b.metal);
    }
    if (land >= 2) xs.forEach(x => b.tone(0xb83a2e, 0.32, 0.26, 0.16, x + unit / 2 - 0.42, 1.25, yardEnd - 0.06, b.metal));
    else if (s.props.length) {
      const p = s.props[0];
      b.take(b.dress(kit.props[p.kind]({ seed, detail: 'low' })), xs[propAt] + unit / 2 - 0.75, 0.06, yardMid + 0.2, 0, Math.min(0.55, p.scale));
    }
    if (land < 2) {
      const x = xs[laundryAt];
      for (const dx of [-0.95, 0.95]) b.tone(0x7c8282, 0.05, 1.6, 0.05, x + dx, 0.86, yardEnd - 0.75, b.metal);
      b.laundry(1.9, x, 1.62, yardEnd - 0.75, 3);
    }
    if (land === 0) b.shopSign('ให้เช่า', 0.95, 0.45, xs[tankAt], 1.05, yardEnd - 0.06, { background: 0xd94f3c, foreground: 0xfff8e6 });
  });
  b.feature('greenery', () => {
    if (s.hedge && land >= 1) b.take(b.dress(kit.gardenPlant('hedge', { seed })), xs[hedgeAt], 0.06, yardEnd - 0.42, 0, 0.85);
    b.plant(edge(0) + 0.75, yardEnd - 0.7, 3.2, 0.55, 0.06, 0, s.plants[0]);
  });
  return { floors: 2, floorHeight: storey, units, unitWidth: unit, frontYard: yardEnd - front, roofForm: s.roof, roofMaterial: s.roofMaterial };
}

/** Level 3: a three- or four-storey walk-up (อพาร์ตเมนต์เล็ก) with front balconies, laundry, air conditioners and a
 * stair tower carrying the water tanks. R2: roof and colours come from the kit's modern concrete house. */
export function walkup(b: PlotBuilder): Record<string, unknown> {
  const kit = b.kit, s = kit.houses.concrete, land = b.land, seed = b.options.seed ?? 1, floors = land === 0 ? 3 : 4, storey = 3, plinth = 0.2;
  const top = plinth + floors * storey, color = kit.housePalette('concrete', seed), wall = weather(color.wall, land), trim = weather(color.trim, land);
  const stain = [0.26, 0.12, 0.04, 0][land], mx = -0.95, mw = 6.9, back = -4.1, front = 2.1, md = front - back, mz = (front + back) / 2;
  const cx = 3.45, cw = 1.9, cz = -0.8, cd = 4.6, coreTop = top + 2.4, rail = land === 0 ? 0x4f5556 : weather(color.shutter, land), open = land < 2;
  b.feature('body', () => {
    if (open) {
      // The ground floor stands back under the first floor, leaving covered motorbike parking at the front.
      b.body(wall, mw, plinth + storey, md - 1.9, mx, 0, mz - 0.95, stain);
      b.body(wall, mw, top - plinth - storey, md, mx, plinth + storey, mz, stain);
    } else b.body(wall, mw, top, md, mx, 0, mz, stain);
    b.body(weather(0xe2ded4, land), cw, coreTop, cd, cx, 0, cz, stain);
    for (let f = 1; f < floors; f++) b.tone(trim, mw + 0.1, 0.16, md + 0.1, mx, plinth + f * storey, mz);
  });
  b.feature('roof', () => b.ridgeRoof(s.roof, mw, md, top, mz, { pitch: kit.defaults.pitch * 0.42, overhang: 0.3,
    material: s.roofMaterial, wall, trim: color.trim, x: mx }));
  b.feature('gutters-and-downpipes', () => b.gutter(mw - 0.1, mx, top - 0.08, front + 0.37, front + 0.08, weather(0x7d8486, land), [mx - mw / 2 + 0.02, mx + mw / 2 - 0.08]));
  b.feature('balconies-laundry-and-air-conditioners', () => {
    for (let f = 1; f < floors; f++) for (const side of [-1, 1]) {
      const x = mx + side * 1.72, y = plinth + f * storey;
      b.tone(trim, 3.2, 0.14, 1.0, x, y + 0.05, front + 0.5);
      if (land < 2) {
        b.tone(wall, 3.2, 0.95, 0.1, x, y + 0.55, front + 0.95);
        for (const dx of [-1.55, 1.55]) b.tone(wall, 0.1, 0.95, 0.9, x + dx, y + 0.55, front + 0.5);
      } else if (land === 2) b.bars(3.1, 1.0, x, y + 0.12, front + 0.96, 8, rail);
      else b.box(3.1, 0.95, 0.04, x, y + 0.6, front + 0.96, b.glass);
      b.tone(0xbfc2bd, 1.9, 2.15, 0.05, x - 0.45, y + 1.2, front + 0.025, b.metal);
      b.box(1.76, 2.0, 0.04, x - 0.45, y + 1.15, front + 0.06, b.glass);
      b.ac(x + 1.05, y + 0.42, front + 0.3);
      if (land < 3 && b.random() < [0.95, 0.75, 0.5][land]) b.laundry(2.6, x, y + 1.6, front + 0.98, 3);
      if (land === 3) { b.tone(0x8a9294, 3.1, 0.06, 0.08, x, y + 1.1, front + 0.96, b.metal); b.planter(0.9, 0.3, x + 1.05, y + 0.12, front + 0.75, 0x9a8a72, 4); }
      if (land === 0 && f === 1) b.bars(3.1, 1.85, x, y + 1.0, front + 0.98, 6, rail);
    }
  });
  b.feature('stair-tower', () => {
    b.box(0.7, coreTop - 3.6, 0.05, cx - 0.35, (coreTop - 3.6) / 2 + 3.0, cz + cd / 2 + 0.02, b.glass);
    b.tone(0x3a3f40, 0.9, 2.1, 0.05, cx + 0.4, plinth + 1.05, cz + cd / 2 + 0.025);
    b.tone(trim, 1.1, 0.1, 0.8, cx + 0.4, plinth + 2.45, cz + cd / 2 + 0.4); b.lamp(cx - 0.45, plinth + 2.2, cz + cd / 2);
    for (let f = 0; f <= floors; f++) for (let n = 0; n < 2; n++) b.tone(trim, 0.95, 0.07, 0.16, cx - 0.35, plinth + 1.1 + f * storey + n * 0.75, cz + cd / 2 + 0.08);
    b.parapet(weather(0xd0ccc2, land), cw, cd, cx, coreTop + 0.12, cz, 0.6);
    for (const dz of [-1.1, 0.4]) b.tank(cx, coreTop + 0.12, cz + dz, 0.45, 1.05, land === 0 ? 0x3c6ea7 : 0xd3d8d9);
    if (land < 3) b.dish(cx + 0.45, coreTop + 0.12, cz + 1.55, 0.6);
    b.shopSign(b.pick(['อพาร์ตเมนต์ลมเย็น', 'หอพักบ้านสวน', 'แมนชั่นใบไม้', 'อพาร์ตเมนต์ริมคลอง']), 0.62, 3.4, cx + 0.55, top - 2.2, cz + cd / 2 + 0.06,
      { vertical: true, background: 0xf1ead8, foreground: 0x8c3b2e });
  });
  b.feature('ground-floor', () => {
    if (open) {
      b.tone(0x34393a, 3.0, 2.3, 0.04, mx - 1.6, plinth + 1.2, front - 1.88);
      b.box(1.2, 2.1, 0.04, mx + 1.4, plinth + 1.1, front - 1.88, b.glass);
      for (const x of [mx - 3.3, mx, mx + 3.3]) b.tone(wall, 0.3, storey - 0.1, 0.3, x, plinth + (storey - 0.1) / 2, front - 0.16);
      for (let n = 0; n < 4; n++) b.scooter(mx - 2.4 + n * 1.45, front - 0.85, b.pick(BIKES), Math.PI + (b.random() - 0.5) * 0.3);
      b.shopSign('ห้องว่าง', 1.5, 0.45, mx + 1.6, plinth + storey - 0.3, front + 0.06, { background: 0xe4473b, foreground: 0xffffff });
    } else {
      // A coin laundry or coffee corner on the ground floor of better-off blocks.
      b.tone(0x5d6566, mw - 0.4, 2.35, 0.06, mx, plinth + 1.2, front + 0.03, b.metal);
      b.box(mw - 0.6, 2.2, 0.04, mx, plinth + 1.18, front + 0.07, b.glass);
      b.shopSign(b.pick(['ร้านซักรีด', 'กาแฟหน้าหอ', 'ซักผ้าหยอดเหรียญ', 'ข้าวแกงหน้าหอ']), 3.4, 0.45, mx, plinth + 2.62, front + 0.07,
        { background: land === 3 ? 0x2f5d50 : 0xf4efe0, foreground: land === 3 ? 0xf4efe0 : 0x23413c });
      for (let n = 0; n < 2; n++) b.scooter(mx - 2.2 + n * 1.4, front + 1.2, b.pick(BIKES), Math.PI);
      b.pot(mx + 2.6, front + 0.5); b.pot(mx + 1.9, front + 0.5, 0.05, 0.8);
    }
    b.tone(land === 0 ? 0x8d8880 : 0xbcb8af, 8.8, 0.06, 4.45 - front, 0, 0.03, (front + 4.45) / 2, b.stone);
  });
  b.feature('back-and-sides', () => {
    for (let f = 0; f < floors; f++) {
      for (const dx of [-1.7, 1.7]) {
        if (land === 3) b.framed(1.1, 1.15, mx + dx, plinth + f * storey + 1.0, back, trim, { facing: -1, mullion: true });
        else b.pane(1.1, 1.1, mx + dx, plinth + f * storey + 1.6, back - 0.02, b.glass, Math.PI);
      }
      for (const dz of [-1.2, 1.4]) if (!(open && f === 0 && dz > 0)) b.pane(0.85, 1.0, mx - mw / 2 - 0.02, plinth + f * storey + 1.6, mz + dz, b.glass, -Math.PI / 2);
      if (f > 0) b.ac(mx + (f % 2 ? -0.2 : 0.4), plinth + f * storey + 0.6, back - 0.17, Math.PI);
    }
  });
  b.feature('greenery', () => { if (land >= 1) b.plant(-3.7, 3.8, 3.4, 0.55, 0.06, 1, s.plants[0]); });
  return { floors, floorHeight: storey, balconies: (floors - 1) * 2, stairTower: true, waterTanks: 2, roofForm: s.roof, openGroundFloor: open };
}

/** Level 4: a six- to eight-storey block of flats (แฟลต) or low-rise condominium on columns, with a stair-and-lift core
 * above the roof. R3: only the palette and planting follow the region. */
export function flats(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [6, 7, 8, 8][land], ground = 3.4, storey = 3, plinth = 0.15, palette = b.kit.neutralPalette(b.options.seed);
  const first = plinth + ground, top = first + (floors - 1) * storey, wall = b.vary([0xcfc8b6, weather(palette.wall, 1), 0xe8e6df, 0xf0eee8][land]);
  const trim = b.vary([0x9d9788, 0xb9b6ad, 0x6d7c80, 0x5a6b6e][land]), stain = [0.3, 0.12, 0.03, 0][land];
  const back = -4.05, front = 2.3, mx = -0.7, mw = 7.2, mz = (front + back) / 2, md = front - back, cx = 3.65, cz = -1.2;
  b.feature('pilotis-and-lobby', () => {
    b.tone(0xb9b5ab, 7.4, 0.08, 4.45 - back, -0.6, 0.04, (back + 4.45) / 2, b.stone);
    b.body(wall, mw, ground, 3.4, mx, plinth, back + 1.7, stain);
    for (const x of [mx - 3.4, mx - 1.13, mx + 1.13, mx + 3.4]) b.tone(wall, 0.4, ground, 0.4, x, plinth + ground / 2, front - 0.3);
    b.box(2.6, 2.6, 0.05, mx - 1.6, plinth + 1.35, back + 3.42, b.glass);
    b.tone(trim, 7.4, 0.25, 1.6, mx, first - 0.3, front + 0.6);
    b.shopSign(land < 2 ? b.pick(['แฟลตลานไม้', 'อาคารชุดลมเย็น', 'แฟลตริมทุ่ง']) : b.pick(['คอนโดบ้านสวน', 'คอนโดลานไผ่', 'คอนโดริมบึง']),
      3.6, 0.5, mx - 1.2, first - 0.3, front + 1.42, { background: land < 2 ? 0xeee6cf : 0x2f4a4c, foreground: land < 2 ? 0x3b4a49 : 0xf2efe6 });
    if (land < 2) for (let n = 0; n < 5; n++) b.scooter(mx - 3.0 + n * 1.25, 0.6, b.pick(BIKES), Math.PI + (b.random() - 0.5) * 0.3);
    else { b.auto(mx - 1.3, 0.75, b.pick(CARS), Math.PI / 2); b.scooter(mx + 1.9, 0.6, b.pick(BIKES), Math.PI); b.scooter(mx + 2.9, 0.6, b.pick(BIKES), Math.PI); }
  });
  b.feature('body-and-core', () => {
    b.body(wall, mw, top - first, md, mx, first, mz, stain);
    for (let f = 0; f < floors; f++) b.tone(trim, mw + 0.12, 0.14, md + 0.12, mx, first + f * storey, mz);
    b.body(land < 2 ? 0xd9d4c6 : trim, 1.5, top + 3, 4.8, cx, 0, cz, stain);
    b.box(0.5, top - 1.5, 0.05, cx, top / 2 + 0.4, cz + 2.42, b.glass);
    b.parapet(trim, 1.5, 4.8, cx, top + 3.12, cz, 0.4);
  });
  b.feature('balconies', () => {
    for (let k = 0; k < floors - 1; k++) for (let n = 0; n < 3; n++) {
      const x = mx - 2.4 + n * 2.4, y = first + k * storey;
      b.tone(trim, 2.25, 0.14, 1.0, x, y + 0.07, front + 0.5);
      if (land < 2) b.tone(wall, 2.25, 0.95, 0.1, x, y + 0.6, front + 0.95);
      else b.box(2.2, 0.95, 0.04, x, y + 0.62, front + 0.96, b.glass);
      b.box(1.5, 2.0, 0.04, x - 0.2, y + 1.15, front + 0.04, b.glass);
      b.colored(trim, () => { for (const dx of [-0.8, 0.4]) b.box(0.08, 2.1, 0.1, x + dx, y + 1.2, front + 0.06, b.paint); b.box(1.28, 0.08, 0.1, x - 0.2, y + 2.24, front + 0.06, b.paint); });
      if (land >= 2) b.tone(0x8a9294, 2.2, 0.06, 0.08, x, y + 1.12, front + 0.96, b.metal); else b.tone(trim, 2.3, 0.07, 0.16, x, y + 1.1, front + 0.95);
      if ((n + k) % 2 === 0 || land === 0) b.ac(x + 0.72, y + 0.42, front + 0.3);
      if (land === 0 && k < 3) b.bars(2.2, 1.75, x, y + 1.07, front + 0.97, 5, 0x4b5051);
      if (land < 2 && b.random() < (land === 0 ? 0.7 : 0.4)) b.laundry(2.0, x, y + 1.85, front + 0.98, 3);
    }
  });
  b.feature('back-and-sides', () => {
    for (let k = 0; k < floors - 1; k++) {
      const y = first + k * storey + 1.55;
      for (const dx of [-2.4, 0, 2.4]) b.window(1.2, 1.2, mx + dx, y - 0.6, back, trim, land === 0 && k < 2 ? 0x4b5051 : 0, -1);
      b.at(mx - mw / 2, 0, mz, -Math.PI / 2, () => b.window(1.0, 1.1, 0, y - 0.55, 0, trim));
      b.at(mx + mw / 2, 0, front - 0.55, Math.PI / 2, () => b.window(1.0, 1.1, 0, y - 0.55, 0, trim));
      if (k % 2 === 0) b.ac(mx - 1.2, y - 1.1, back - 0.17, Math.PI); else b.ac(mx + 1.2, y - 1.1, back - 0.17, Math.PI);
    }
    b.colored(0x7d8486, () => { for (const x of [mx - mw / 2 + 0.08, mx + mw / 2 - 0.08]) { b.box(0.1, top, 0.1, x, top / 2, back - 0.06, b.metal); b.box(0.1, 0.1, 0.3, x, 0.2, back - 0.2, b.metal); } });
  });
  b.feature('roof', () => {
    b.parapet(trim, mw, md, mx, top + 0.15, mz, land < 2 ? 0.7 : 1.0);
    for (const dx of [0.6, 2.0]) b.condenser(mx + dx, top + 0.15, mz + 0.9);
    b.colored(0x8e9596, () => { for (const dx of [-3.45, 3.45]) b.box(0.05, 1.6, 0.05, mx + dx, top + 1.0, mz + 2.6, b.metal); });
    if (land < 2) {
      b.tank(mx - 2.0, top + 0.15, mz - 1.5, 0.6, 1.4); b.tank(mx - 0.4, top + 0.15, mz - 1.5, 0.6, 1.4);
      b.colored(0x9aa0a0, () => { b.cylinder(0.03, 1.2, mx + 1.5, top + 0.6, mz - 1.0, b.metal, 4); b.cylinder(0.4, 0.06, mx + 1.5, top + 1.25, mz - 0.9, b.metal, 8, 0.6); });
    } else {
      for (const dx of [-2.4, 0, 2.4]) b.tone(0x8c7f6c, 1.6, 0.45, 0.8, mx + dx, top + 0.22, front - 0.9);
      b.plant(mx - 2.4, front - 0.9, 2.4, 0.6, top + 0.44, 2); b.plant(mx + 2.4, front - 0.9, 2.4, 0.6, top + 0.44, 3);
      for (const dx of [-1.6, 0, 1.6]) b.tone(0x6f6457, 0.12, 2.3, 0.12, mx + dx, top + 1.15, mz - 1.0);
      b.tone(0x6f6457, 3.6, 0.1, 2.2, mx, top + 2.3, mz - 1.0);
    }
  });
  b.feature('gate-booth-and-fence', () => {
    b.body(0xe6e3da, 1.3, 2.3, 1.3, 3.65, 0.08, 2.95, 0);
    b.tone(trim, 1.6, 0.12, 1.6, 3.65, 2.44, 2.95);
    b.box(1.0, 0.8, 0.04, 3.65, 1.5, 3.62, b.glass); b.tone(0x3a3f40, 0.04, 1.9, 0.7, 2.98, 1.05, 2.95);
    for (const [from, to] of [[-4.4, -1.7], [2.3, 4.4]] as const) {
      b.tone(wall, to - from, 0.6, 0.18, (from + to) / 2, 0.38, 4.36);
      b.bars(to - from - 0.1, 0.8, (from + to) / 2, 0.68, 4.36, Math.round((to - from) / 0.45), land < 2 ? 0x4b5051 : 0x2f3436);
    }
    for (const dx of [0, 0.7]) b.colored(dx ? 0x3d7a4a : 0x2f5e8e, () => b.cylinder(0.3, 0.85, -1.2 + dx, 0.5, 3.85, b.paint, 8));
    b.plant(-3.85, 3.6, 3.6, 0.5, 0.08, 1);
    b.lamp(mx - 3.0, first - 0.75, back + 3.4); b.lamp(mx, first - 0.75, back + 3.4);
  });
  return { floors, floorHeight: storey, groundFloor: ground, liftCore: true, balconies: (floors - 1) * 3, cagedBalconies: land === 0 ? 9 : 0 };
}

/** Level 5: a slender condominium tower of 18–25 storeys on a one- or two-storey podium with a planted deck,
 * glass-railed balconies and a lit crown. R3: only the palette and planting follow the region. */
export function condoTower(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, floors = [18, 20, 22, 25][land], podiumFloors = land < 2 ? 1 : 2, storey = 3, palette = b.kit.neutralPalette(b.options.seed);
  const podium = 0.15 + podiumFloors * 3.6, top = podium + floors * storey, tz = -1.4, tw = 6.6, td = 5.8, tf = tz + td / 2;
  const wall = b.vary([0xd7d1c2, palette.wall, 0xeceae4, 0xf3f1ec][land]), trim = b.vary([0xa29c8e, 0x9da3a4, 0x7d8a8d, 0x5d6f73][land]);
  const glow = tint('emissive_window', 0xb3d5bf);
  b.feature('podium', () => {
    b.body(trim, 8.8, podium, 7.4, 0, 0, -0.6, 0);
    b.box(6.2, podium - 0.6, 0.05, -1.0, (podium - 0.3) / 2 + 0.15, 3.12, b.glass);
    b.tone(0x2f3433, 2.2, 2.6, 0.05, 3.0, 1.45, 3.12);
    b.tone(trim, 8.9, 0.25, 1.4, 0, podium - 0.3, 3.7);
    b.tone(0xc9c4ba, 8.9, 0.06, 1.35, 0, 0.03, 3.78, b.stone);
    b.shopSign(b.pick(['คอนโดยอดเมฆ', 'คอนโดฟ้าใส', 'คอนโดลานดาว', 'คอนโดสวนลม']), 3.4, 0.55, -1.0, podium - 0.3, 4.42,
      { background: 0x253537, foreground: 0xf3efe2, lit: land >= 2 });
    b.colored(0x3c4446, () => { for (const dx of [-3.0, -1.0, 1.0]) b.box(0.08, podium - 0.7, 0.1, dx, (podium - 0.5) / 2 + 0.15, 3.16, b.metal); });
    // Car park louvres down the side of the podium, a slot of light between each slat.
    b.colored(trim, () => { for (let n = 0; n < 5; n++) b.box(0.08, 0.14, 5.4, -4.44, 1.0 + n * (podium - 1.4) / 4, -1.2, b.paint); });
    for (const x of [-4.1, 2.2]) b.tone(0x8b8d88, 0.22, 0.85, 0.22, x, 0.43, 4.25, b.stone);
    b.lamp(-3.95, 2.6, 3.12); b.lamp(1.95, 2.6, 3.12);
  });
  b.feature('podium-deck', () => {
    b.parapet(trim, 8.8, 7.4, 0, podium + 0.05, -0.6, 0.9, b.paint);
    for (const x of [-2.6, 0, 2.6]) b.tone(0x8c7f6c, 1.8, 0.45, 0.7, x, podium + 0.22, 2.55);
    for (const x of [-2.6, 2.6]) b.plant(x, 2.55, 2.6, 0.6, podium + 0.44, x > 0 ? 1 : 0);
    for (const z of [-3.2, 0.2]) b.plant(3.85, z, 3.0, 0.5, podium, z > 0 ? 2 : 3);
  });
  b.feature('tower', () => {
    b.body(wall, tw, top - podium, td, 0, podium, tz, [0.18, 0.06, 0, 0][land]);
    for (let f = 0; f < floors; f++) {
      const y = podium + f * storey;
      b.tone(trim, tw + 0.16, 0.16, td + 0.16, 0, y + 0.08, tz);
      for (const side of [-1, 1]) b.box(5.6, 1.7, 0.05, -0.3, y + 1.55, tz + side * (td / 2 + 0.03), b.glass);
      if (f > 0) for (const dx of [-1.65, 1.65]) {
        b.tone(trim, 2.8, 0.14, 1.1, dx, y + 0.09, tf + 0.55);
        if (land < 2) { b.tone(wall, 2.8, 0.9, 0.08, dx, y + 0.6, tf + 1.06); b.tone(trim, 2.85, 0.06, 0.14, dx, y + 1.08, tf + 1.06); }
        else { b.box(2.75, 0.95, 0.04, dx, y + 0.62, tf + 1.07, b.glass); b.tone(0x8a9294, 2.75, 0.05, 0.07, dx, y + 1.12, tf + 1.07, b.metal); }
        b.ac(dx + (dx < 0 ? -0.95 : 0.95), y + 0.45, tf + 0.32);
      }
      // A service ledge on the side for the kitchen condenser, clear of the planted podium deck below.
      if (f > 1) { b.tone(trim, 0.55, 0.12, 1.4, tw / 2 + 0.27, y + 0.4, -3.0); b.ac(tw / 2 + 0.2, y + 0.74, -3.0, Math.PI / 2); }
    }
    for (const side of [-1, 1]) b.box(0.05, top - podium - 1, 1.6, side * (tw / 2 + 0.03), (top + podium) / 2, tz + 0.8, b.glass);
    b.colored(trim, () => { for (const side of [-1, 1]) for (const dx of [-1.7, 1.1]) b.box(0.07, top - podium - 0.6, 0.07, dx, (top + podium) / 2, tz + side * (td / 2 + 0.06), b.paint); });
    for (const side of [-1, 1]) b.tone(trim, 0.35, top - podium, 0.35, side * (tw / 2 + 0.1), (top + podium) / 2, tf + 0.1);
  });
  b.feature('crown', () => {
    b.parapet(trim, tw + 0.3, td + 0.3, 0, top + 0.2, tz, 1.2);
    b.body(wall, 3.6, 3.2, 3.0, -0.8, top + 0.2, tz - 1.2, 0);
    b.colored(trim, () => { for (let n = 0; n < 5; n++) b.box(3.7, 0.1, 0.12, -0.8, top + 0.7 + n * 0.5, tz + 0.36, b.paint); });
    b.condenser(-2.4, top + 0.2, tz + 1.5, 0.9, 0.9, 0.7); b.condenser(2.6, top + 0.2, tz - 1.6, 0.9, 0.9, 0.7);
    b.box(3.7, 0.12, 0.08, -0.8, top + 3.0, tz + 0.34, glow);
    b.box(tw + 0.34, 0.12, 0.06, 0, top + 1.2, tf + 0.19, glow);
    if (land === 3) b.pool(1.0, tz + 1.5, 3.2, 1.6, top + 0.22);
    else {
      for (const side of [-1, 1]) b.tone(trim, 0.2, 2.6, 0.2, 1.6 + side * 0.7, top + 1.5, tz + 1.6);
      b.tone(trim, 2.2, 0.15, 1.0, 1.6, top + 2.85, tz + 1.6);
    }
    b.tone(0x8e9596, 0.12, 4.0, 0.12, -0.8, top + 5.2, tz - 1.2, b.metal);
    b.anchor('anchor_light_0', -0.8, top + 7.2, tz - 1.2);
  });
  return { floors, podiumFloors, floorHeight: storey, height: top + 7.2, glassRails: land >= 2, rooftopPool: land === 3 };
}
