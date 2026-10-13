/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, ConeGeometry } from 'three';
import { vertexFinish } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { PlotBuilder, weather } from './builder.js';
import { booth, forklift, frontFence, pallet, transformer } from './factories.js';
import { BIKES, CARS } from './homes.js';

/* The big factories of two-by-two lots (20 × 20 m, built inside ±9.5 m). Land value 0 is an old rusty works,
 * 1 a kept-up one, 2 a newer clean works, 3 a modern works with solar panels and planting. */

const LORRIES = [0x2f5f8a, 0xb23a32, 0xe0a92c, 0x3f7d4f, 0xe9e9e3] as const;

/** A glass panel laid on a roof slope that falls towards +Z (angle > 0) or −Z (angle < 0). */
function slopeGlass(b: PlotBuilder, w: number, d: number, x: number, y: number, z: number, angle: number): void {
  const source = new BoxGeometry(w, 0.04, d).rotateX(angle).translate(x, y, z);
  b.add(applyWorldUV(source, 1), b.glass); source.dispose();
}

/** lot.ind_3: a large portal-frame factory hall with two loading doors, skylights and a ridge vent, a two-storey
 * office, a boiler house and chimney (anchor_smoke_0), a lorry yard, a guard booth and a transformer. R3. */
export function factoryLot(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, worn = land === 0, modern = land === 3, roofKey = worn ? 'roof_metal_rusty' : 'roof_metal_corrugated', clad = vertexFinish(roofKey);
  const wall = b.vary([0xc6b9a0, 0xd8d4c8, 0xe6e8e4, 0xf0f2f1][land]), block = b.vary([0x8f8b81, 0x9c988f, 0x56606a, 0x2f6d8e][land]);
  const trim = b.vary([0x6d6a60, 0x7a7870, 0x4a6f86, 0x2f5f8a][land]), office = b.vary([0xcfc6b2, 0xdcd8cc, 0xe9eae6, 0xf2f3f0][land]);
  const HX = -2.2, HW = 14, front = 1.6, back = -9.0, HD = front - back, hz = (front + back) / 2, eave = 7.5, pitch = 12, a = pitch * Math.PI / 180;
  const top = [22, 24, 24, 26][land], stain = [0.3, 0.14, 0.03, 0][land];
  b.feature('hall', () => {
    b.body(block, HW, 1.6, HD, HX, 0, hz, worn ? 0.25 : 0);
    b.colored(wall, () => b.mass(HW - 0.04, eave - 1.6, HD - 0.04, HX, 1.6 + (eave - 1.6) / 2, hz, clad));
    if (stain) b.streak(b.parts.length - 1, 1.6, eave, stain);
    for (const x of [-7.0, -2.8]) {
      b.tone(0x242727, 3.8, 4.6, 0.04, x, 2.4, front + 0.02);
      const h = worn ? 3.4 : 1.6;
      b.tone(weather(0xa6aeaf, land), 3.8, h, 0.06, x, 4.7 - h / 2, front + 0.06, b.metal);
      b.colored(weather(0x8f9798, land), () => { for (let n = 1; n < 4; n++) b.box(3.8, 0.04, 0.03, x, 4.7 - h * n / 4, front + 0.1, b.metal); });
      b.tone(0x8d9495, 3.9, 0.34, 0.34, x, 4.9, front + 0.18, b.metal);
      b.tilt(wall, 4.0, 0.06, 1.6, x, 5.45, front + 0.8, 0.12, clad);
      for (const dx of [-1.5, 1.5]) b.tone(0x1d1f1f, 0.3, 0.45, 0.16, x + dx, 0.75, front + 0.08, b.fabric);
    }
    b.tone(0x3a3f40, 0.95, 2.1, 0.05, 1.6, 1.05, front + 0.025); b.tone(wall, 1.3, 0.08, 0.7, 1.6, 2.4, front + 0.35, clad); b.lamp(2.4, 2.3, front);
    b.box(HW - 1.2, 0.8, 0.05, HX, eave - 0.9, front + 0.03, b.glass);
    for (const side of [-1, 1]) b.box(0.05, 0.8, HD - 1.4, HX + side * (HW / 2 + 0.03), eave - 0.9, hz, b.glass);
    b.colored(trim, () => {
      for (const x of [-9.12, -4.9, -0.7, 4.72]) b.box(0.18, eave, 0.22, x, eave / 2, front + 0.05, b.paint);
      for (const side of [-1, 1]) for (const z of [-8.2, -5.4, -2.6, 0.2]) b.box(0.16, eave, 0.18, HX + side * (HW / 2 + 0.05), eave / 2, z, b.paint);
    });
    b.gutter(HW - 0.1, HX, eave - 0.05, front + 0.37, front + 0.25, weather(0x7d8486, land), [-9.15, -4.9, 4.6]);
    b.shopSign(b.pick(['โรงงานลานช่าง', 'โรงงานพลาสติกบ้านสวน', 'โรงงานเครื่องจักรริมทาง', 'โรงงานอะไหล่ลานทอง']), 4.6, 0.7, -4.9, 6.2, front + 0.06,
      { background: worn ? 0xe8e0c8 : 0x2e5a72, foreground: worn ? 0x3b3330 : 0xf3f0e6 });
  });
  b.feature('roof-skylights-and-vents', () => {
    b.ridgeRoof('gable', HW, HD, eave, hz, { pitch, overhang: 0.3, material: roofKey, wall, x: HX, surface: worn ? 0x8f6a4f : 0xa9b6b6 });
    const rise = Math.tan(a) * (HD / 2 + 0.3);
    for (const side of [-1, 1]) for (let n = 0; n < 4; n++) slopeGlass(b, 2.0, 1.4, HX - 5.1 + n * 3.4, eave + Math.tan(a) * (HD / 2 + 0.3 - 2.6) + 0.08, hz + side * 2.6, side * a);
    b.tone(wall, HW - 2.0, 0.35, 0.6, HX, eave + rise + 0.2, hz, clad);
    b.colored(0xc5cbcc, () => { for (const x of [-7.0, -3.2, 0.6, 3.6]) { b.cylinder(0.25, 0.36, x, eave + rise + 0.55, hz, b.metal, 8); b.cylinder(0.13, 0.1, x, eave + rise + 0.78, hz, b.metal, 6); } });
    if (modern) b.colored(0x2c3c52, () => {
      for (const row of [1.4, 3.8]) for (let n = 0; n < 5; n++) slopeGlass(b, 1.9, 1.3, HX - 5.4 + n * 2.7, eave + Math.tan(a) * (HD / 2 + 0.3 - row) + 0.16, hz - row, -a);
    });
  });
  b.feature('office-block', () => {
    b.body(office, 4.0, 7.2, 5.4, 7.2, 0, -1.1, stain);
    b.tone(trim, 4.1, 0.16, 5.5, 7.2, 3.6, -1.1);
    b.parapet(trim, 4.0, 5.4, 7.2, 7.32, -1.1, 0.6);
    b.tone(0x3a3f40, 0.9, 2.1, 0.05, 6.0, 1.05, front + 0.025); b.tone(trim, 1.3, 0.1, 0.8, 6.0, 2.4, front + 0.4);
    b.framed(1.5, 1.4, 7.9, 1.0, front, trim, { mullion: true });
    for (const x of [6.3, 8.1]) b.framed(1.2, 1.4, x, 4.6, front, trim, { mullion: true });
    for (const f of [0, 1]) for (const z of [-2.6, 0.0]) b.at(9.2, 0, z, Math.PI / 2, () => b.framed(1.2, 1.3, 0, 1.0 + f * 3.6, 0, trim));
    b.shopSign('สำนักงาน', 1.6, 0.4, 6.0, 2.95, front + 0.06, { background: 0xf3efe2, foreground: 0x2b3a44 });
    for (const x of [6.3, 8.0]) b.condenser(x, 7.32, -2.6, 0.9, 0.7, 0.6);
  });
  b.feature('boiler-house-and-chimney', () => {
    b.body(worn ? 0xa69d8a : 0xcfd2cd, 3.8, 4.2, 4.6, 7.3, 0, -6.7, stain);
    b.parapet(trim, 3.8, 4.6, 7.3, 4.32, -6.7, 0.35);
    b.tone(0x3a3f40, 0.9, 2.0, 0.05, 6.6, 1.0, -4.38);
    b.colored(trim, () => { for (let n = 0; n < 3; n++) b.box(0.8, 0.06, 0.08, 8.2, 2.3 + n * 0.3, -4.36, b.paint); });
    b.colored(0x7a8183, () => { b.pole(point(5.4, 3.4, -5.6), point(4.8, 3.4, -5.6), 0.16, b.metal, 6); b.pole(point(5.4, 2.8, -7.8), point(4.8, 2.8, -7.8), 0.12, b.metal, 6); });
    b.chimney(7.3, -7.0, top, 0.8, land < 2, land < 2 ? 0xb9b2a3 : 0xc9cfd0);
  });
  b.feature('lorry-yard', () => {
    b.tone(worn ? 0xae7552 : 0xbdb9b0, 18.8, 0.06, 9.4 - front, 0, 0.03, (front + 9.4) / 2, b.stone);
    b.colored(0xe8e4d6, () => { for (const x of [5.25, 7.2, 9.15]) b.box(0.08, 0.02, 4.4, x, 0.07, 4.5, b.paint); });
    b.lorry(-5.0, 4.6, b.pick(LORRIES), Math.PI / 2);
    forklift(b, 0.4, 3.4);
    for (const [x, z, n] of [[1.9, 2.7, 2], [3.15, 2.7, 1], [2.5, 3.95, 2]] as const) pallet(b, x, 0.06, z, worn ? 1 : n);
    b.auto(6.2, 4.5, b.pick(CARS), land % 2 ? 0 : Math.PI); b.auto(8.2, 4.5, b.pick(CARS), Math.PI);
    b.tilt(0x9aa3a6, 5.4, 0.06, 1.8, 3.8, 2.3, 8.2, 0.06, b.metal);
    for (const x of [1.3, 6.3]) b.tone(0x5d6466, 0.08, 2.3, 0.08, x, 1.15, 7.5, b.metal);
    for (let n = 0; n < 5; n++) b.scooter(1.7 + n * 1.05, 8.2, b.pick(BIKES), 0);
    frontFence(b, -1.9, 9.4, worn ? 0x9d988d : 0xd3d0c8, 9.3);
    booth(b, -1.2, 8.4, office); transformer(b, -8.6, 8.4);
    if (land >= 1) b.plant(-7.9, 6.9, 4.4, 0.8, 0.06, 1);
    if (modern) for (const x of [0.6, 2.2]) b.planter(1.2, 0.8, x, 0.06, 6.4);
  });
  return { floors: 1, officeFloors: 2, loadingDoors: 2, smoke: true, stackHeight: top, chimney: land < 2 ? 'concrete' : 'steel', solarPanels: modern ? 10 : 0 };
}

/** lot.ind_4: a processing plant: a gabled process hall with two chimneys (anchor_smoke_0/1), two silos with a bucket
 * elevator and gallery, a bunded tank farm, a horizontal tank, a pipe rack, an office, a weighbridge with a tanker,
 * a guard booth and a transformer. R3. */
export function plantLot(b: PlotBuilder): Record<string, unknown> {
  const land = b.land, worn = land === 0, roofKey = worn ? 'roof_metal_rusty' : 'roof_metal_corrugated', roof = vertexFinish(roofKey), seed = b.options.seed ?? 1;
  const wall = b.vary([0xbdb4a0, 0xd3cebf, 0xe6e7e2, 0xf0f1ee][land]), steel = b.vary(worn ? 0xe2d6c2 : 0xf2f4f3), tank = b.vary([0xb9a487, 0xd8d2c2, 0xeef0ec, 0xf4f5f2][land]);
  const trim = b.vary([0x6d6a60, 0x7a7870, 0x4a6f86, 0x2f5f8a][land]), frame = b.vary(worn ? 0x9a8f7e : 0xc9ccc8), stain = [0.3, 0.14, 0.03, 0][land];
  const hx = -6.1, hw = 6.2, back = -9.0, front = -1.0, hd = front - back, hz = (front + back) / 2, eave = 8.0, pitch = 18, rise = Math.tan(pitch * Math.PI / 180) * hw / 2;
  const tall = [26, 28, 30, 30][land], short = [16, 17, 18, 18][land];
  b.feature('process-hall', () => {
    b.body(wall, hw, eave, hd, hx, 0, hz, worn ? 0.3 : 0.04);
    for (const side of [-1, 1]) {
      const v = [point(hx - hw / 2, eave, hz + side * hd / 2), point(hx + hw / 2, eave, hz + side * hd / 2), point(hx, eave + rise, hz + side * hd / 2)];
      b.colored(wall, () => b.panel(side > 0 ? v : [...v].reverse(), point(0, 0, side), 0.08, b.paint));
    }
    b.take(b.dress(b.kit.roofs.gable([hw - 0.6, hd], { baseY: eave, pitch, overhang: 0.3, material: roofKey, ornaments: false, seed, detail: 'low',
      surfaceColor: worn ? 0x8f6a4f : 0xa9b6b6 }), roof), hx, 0, hz);
    b.tone(0x242727, 3.2, 4.5, 0.04, hx, 2.35, front + 0.02);
    b.tone(weather(0xa3abac, land), 3.2, worn ? 4.5 : 1.4, 0.06, hx, 4.6 - (worn ? 2.25 : 0.7), front + 0.06, b.metal);
    b.tone(0x8d9495, 3.3, 0.32, 0.32, hx, 4.75, front + 0.17, b.metal);
    b.box(hw - 0.8, 0.8, 0.05, hx, eave - 1.0, front + 0.03, b.glass);
    b.colored(trim, () => { for (const x of [hx - hw / 2 + 0.1, hx + hw / 2 - 0.1]) b.box(0.22, eave, 0.22, x, eave / 2, front + 0.05, b.paint); });
    b.colored(0x7d8486, () => { for (const side of [-1, 1]) { b.box(0.15, 0.13, hd + 0.5, hx + side * (hw / 2 + 0.06), eave - 0.05, hz, b.metal);
      b.box(0.09, eave - 0.3, 0.09, hx + side * (hw / 2 + 0.06), eave / 2, back + 0.15, b.metal); } });
    b.lamp(hx + 2.2, 4.2, front);
    b.shopSign(b.pick(['โรงงานอาหารสัตว์', 'โรงงานน้ำมันพืช', 'โรงสีลานทอง', 'โรงงานแปรรูปลานทุ่ง']), 4.6, 0.7, hx, 5.6, front + 0.06,
      { background: worn ? 0xe8e0c8 : 0x2f5b4c, foreground: worn ? 0x3b3330 : 0xf3f0e6 });
  });
  b.feature('chimneys', () => {
    b.chimney(-7.8, -7.8, tall, 0.8, land < 2, land < 2 ? 0xb3ab9c : 0xc5cbcc);
    b.chimney(-4.6, -8.2, short, 0.5, land < 2, land < 2 ? 0xb3ab9c : 0xc5cbcc);
  });
  b.feature('silos-elevator-and-gallery', () => {
    for (const x of [-1.2, 1.8]) {
      b.tone(0x9a968c, 2.7, 1.2, 2.7, x, 0.6, -7.4, b.stone);
      b.colored(steel, () => {
        b.cylinder(1.3, 11, x, 6.7, -7.4, roof, 12);
        const cone = new ConeGeometry(1.36, 1.2, 12).translate(x, 12.8, -7.4);
        b.add(applyWorldUV(cone, 1), roof); cone.dispose();
      });
      b.colored(0x5b6263, () => {
        for (const dx of [-0.25, 0.25]) b.box(0.06, 11, 0.06, x + dx, 6.7, -6.06, b.metal);
        for (let n = 0; n < 11; n++) b.box(0.5, 0.04, 0.04, x, 1.8 + n * 1.0, -6.06, b.metal);
      });
    }
    b.tone(frame, 0.9, 17, 0.9, 4.0, 8.5, -7.4);
    b.tone(frame, 1.6, 1.4, 1.6, 4.0, 17.4, -7.4);
    b.tone(frame, 5.6, 0.8, 1.0, 1.4, 13.8, -7.4);
    for (const side of [-1, 1]) b.railing(5.4, 1.4, 14.2, -7.4 + side * 0.46, 0x5b6263, 5, 0.9);
    b.colored(frame, () => { for (const x of [-1.2, 1.8]) b.box(0.5, 0.6, 0.5, x, 13.2, -7.4, b.paint); });
  });
  b.feature('tank-farm', () => {
    b.colored(0x9a968c, () => {
      for (const z of [-9.3, -1.9]) b.box(4.3, 0.8, 0.2, 7.05, 0.4, z, b.stone);
      for (const x of [5.0, 9.1]) b.box(0.2, 0.8, 7.4, x, 0.4, -5.6, b.stone);
    });
    for (const z of [-7.6, -3.8]) {
      b.colored(tank, () => { b.cylinder(1.6, 7, 7.05, 3.6, z, b.paint, 12); b.ellipsoid(point(7.05, 7.1, z), point(1.6, 0.4, 1.6), b.paint, 12, 3); });
      b.colored(0x5b6263, () => { for (const dz of [-0.2, 0.2]) b.box(0.05, 6.8, 0.05, 8.7, 3.6, z + dz, b.metal); for (let n = 0; n < 7; n++) b.box(0.04, 0.04, 0.4, 8.7, 0.8 + n * 0.95, z, b.metal); });
    }
    b.tone(0x5b6263, 0.8, 0.12, 0.8, 7.05, 7.4, -5.7, b.metal);
    b.colored(tank, () => {
      b.pole(point(-1.6, 1.6, -3.4), point(2.8, 1.6, -3.4), 0.95, b.paint, 12);
      for (const x of [-1.6, 2.8]) b.ellipsoid(point(x, 1.6, -3.4), point(0.35, 0.95, 0.95), b.paint, 8, 4);
    });
    b.colored(0x6d6a60, () => { for (const x of [-0.6, 1.8]) b.box(0.5, 0.7, 1.6, x, 0.35, -3.4, b.paint); });
  });
  b.feature('pipe-rack', () => {
    b.colored(0x5d6566, () => { for (const x of [-2.4, 0.3, 2.9]) b.box(0.25, 6.0, 0.25, x, 3.0, -5.3, b.metal); b.box(7.7, 0.16, 0.7, 0.85, 6.0, -5.3, b.metal); });
    b.colored(worn ? 0x8a6f58 : 0xb3b9ba, () => {
      for (const dz of [-0.2, 0, 0.2]) b.pole(point(-3.0, 6.25, -5.3 + dz), point(4.7, 6.25, -5.3 + dz), 0.09, b.metal, 6);
      b.pole(point(4.7, 6.25, -5.1), point(5.6, 4.0, -4.3), 0.09, b.metal, 6);
      b.pole(point(4.7, 6.25, -5.5), point(5.6, 4.0, -6.4), 0.09, b.metal, 6);
      for (const x of [-1.2, 1.6]) b.pole(point(x, 6.25, -5.5), point(x, 13.0, -6.6), 0.08, b.metal, 6);
    });
    b.colored(0xb3392f, () => { for (const x of [-1.8, 1.0, 3.6]) b.cylinder(0.16, 0.1, x, 6.25, -5.1, b.metal, 6, Math.PI / 2); });
  });
  b.feature('office-weighbridge-and-gate', () => {
    b.tone(worn ? 0xae7552 : 0xbdb9b0, 18.8, 0.06, 9.4 - front, 0, 0.03, (front + 9.4) / 2, b.stone);
    b.body(wall, 5.2, 3.8, 4.0, -6.6, 0, 4.0, stain);
    b.parapet(trim, 5.2, 4.0, -6.6, 3.92, 4.0, 0.5);
    for (const x of [-8.2, -6.6]) b.framed(1.2, 1.3, x, 1.0, 6.0, trim, { mullion: true });
    b.tone(0x3a3f40, 0.9, 2.1, 0.05, -4.9, 1.05, 6.025); b.tone(trim, 1.3, 0.1, 0.8, -4.9, 2.45, 6.4);
    b.shopSign('สำนักงานโรงงาน', 2.6, 0.45, -6.6, 3.2, 6.06, { background: 0xf3efe2, foreground: 0x2b3a44 });
    b.ac(-3.83, 2.4, 3.0, Math.PI / 2);
    b.tone(0x8c8a84, 7.2, 0.15, 3.2, 1.0, 0.1, 3.6, b.stone);
    b.colored(0xe2b23a, () => { for (const x of [-2.7, 4.7]) b.box(0.2, 0.9, 0.2, x, 0.5, 2.0, b.paint); });
    b.lorry(1.0, 3.6, b.pick(LORRIES), Math.PI / 2, true, 0.17);
    b.auto(7.05, 6.4, b.pick(CARS), Math.PI / 2); b.auto(7.05, 8.3, b.pick(CARS), -Math.PI / 2);
    frontFence(b, -9.4, -3.0, worn ? 0x9d988d : 0xd3d0c8, 9.3); frontFence(b, 4.6, 9.4, worn ? 0x9d988d : 0xd3d0c8, 9.3);
    booth(b, 3.6, 8.4, wall); transformer(b, -8.6, 8.2);
    if (land >= 1) b.plant(-5.4, 7.9, 4.0, 0.8, 0.06, 2);
    if (land === 3) for (const x of [-2.2, 4.0]) b.planter(1.4, 0.8, x, 0.06, 6.8);
  });
  return { floors: 1, silos: 2, tanks: 3, chimneys: 2, smoke: true, stackHeight: tall, chimney: land < 2 ? 'concrete' : 'steel', tanker: true };
}
