/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { point } from '../../regional/geometry.js';
import { IndustrialBuilder } from './builder.js';

export function warehouse(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('white-and-blue-warehouse', () => {
    b.hall(25, 8.2, 16, 0, -4, true);
    b.colored(0x466f8f, () => {
      b.box(25.08, 1.8, 0.12, 0, 2.2, 4.07, b.metal);
      for (const side of [-1, 1]) b.box(0.12, 1.8, 16, side * 12.56, 2.2, -4, b.metal);
    });
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4;
      b.colored(0x586464, () => b.box(3.15, 3.5, 0.06, x, 2.8, 4.15, b.metal));
      for (const dx of [-1.65, 1.65]) b.colored(0x303937, () => b.box(0.22, 3.65, 0.36, x + dx, 2.8, 4.3, b.goods));
      b.box(3.5, 0.38, 1.2, x, 0.86, 4.65, b.stone);
      b.colored(0xd4af58, () => { for (const dx of [-1.75, 1.75]) b.cylinder(0.1, 1.1, x + dx, 0.7, 5.4, b.metal, 6); });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) b.box(0.075, 6, 0.075, side * 12.55, 5.1, -11.5 + i * 1.25, b.metal);
  });
  b.feature('semi-trailers-at-loading-docks', () => { b.truck(-8, 9.2, 'semi', 0x7a8c91); b.truck(8, 9.2, 'semi', 0x618580); });
  b.factorySign('คลังสินค้าลานไผ่', -7.2, 2.8, 13.8);
  return { industry: 'modern-warehouse', smoke: false, loadingDocks: 6, semiTrailers: 2 };
}

export function electronics(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('clean-electronics-factory', () => {
    b.hall(24, 7.2, 17, 0, -3, true);
    b.colored(0xe9eae3, () => b.mass(21, 4.1, 4.6, 0, 2.23, 7.1, b.wall));
    b.box(20.2, 2.9, 0.08, 0, 2.58, 9.45, b.glass);
    for (let i = 0; i < 9; i++) b.box(0.08, 3.05, 0.13, -9.8 + i * 2.45, 2.55, 9.52, b.metal);
    b.box(21.4, 0.25, 5, 0, 4.4, 7.1, b.wall);
    b.box(2.4, 0.18, 2.3, 0, 0.23, 10.5, b.stone);
  });
  b.feature('rooftop-solar-panels', () => {
    for (const x of [-9.5, -6, -2.5, 2.5, 6, 9.5]) for (const z of [-8.5, -4, 0.5]) {
      const y = 7.38 + (12.2 - Math.abs(x)) * Math.tan(9 * Math.PI / 180) + 0.24, a = -Math.sign(x) * 9 * Math.PI / 180;
      b.box(3.05, 0.14, 3.2, x, y, z, b.metal, a);
      b.box(2.88, 0.06, 3.03, x, y + 0.105, z, b.glass, a);
      for (const dz of [-1, 0, 1]) b.box(2.86, 0.025, 0.025, x, y + 0.14, z + dz, b.metal, a);
    }
  });
  b.feature('staff-parking', () => { for (const x of [-10.8, 10.8]) b.colored(b.palette.trim, () => b.car(x, 11.3, b.metal)); });
  b.factorySign('โรงงานวงจรลานแสง', -7.2, 2.8, 13.8);
  return { industry: 'electronics', smoke: false, solarPanels: 18, glassOffice: true };
}

export function carAssembly(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('sawtooth-assembly-hall', () => {
    b.colored(b.palette.wall, () => b.mass(24, 7.5, 16, 0, 3.93, -5, b.wall));
    for (let n = 0; n < 4; n++) {
      const left = -12 + n * 6, right = left + 6, bottom = 7.68, top = 10.08;
      b.panel([point(left, bottom, 3.2), point(right, top, 3.2), point(right, top, -13.2), point(left, bottom, -13.2)],
        point(-0.3714, 0.9285, 0), 0.12, b.roof);
      b.box(0.08, 2.2, 16.4, right - 0.055, 8.88, -5, b.glass);
      b.box(0.18, 0.2, 16.4, right, 10.1, -5, b.metal);
      for (const z of [-13, 3]) {
        b.face([point(left, bottom, z), point(right, bottom, z), point(right, top, z)], b.wall);
        b.face([point(right, top, z), point(right, bottom, z), point(left, bottom, z)], b.wall);
      }
    }
    for (const x of [-8, 0, 8]) b.colored(0x59776d, () => b.box(5, 4.7, 0.06, x, 2.65, 3.04, b.metal));
  });
  b.feature('new-car-yard', () => { for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++)
    b.colored([0xe3e6dc, 0x8dabae, 0x748478][(i + row + Math.floor(b.random() * 3)) % 3], () => b.car(-10 + i * 4, 7 + row * 4.5, b.metal)); });
  b.chimney(0, -10, 22, false); b.factorySign('โรงประกอบรถลานช่าง', -7.2, 2.8, 13.8);
  return { industry: 'car-assembly', smoke: true, sawtoothBays: 4, newCars: 12, stackHeight: 22 };
}

export function foodProcessing(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('food-processing-hall', () => b.hall(16, 9, 13, -5.5, -4, true));
  b.feature('four-food-silos', () => {
    for (const x of [5, 10]) for (const z of [-2, 4]) {
      b.vessel(x, z, 1.95, 13, 1.1, 0xd2d8cc);
      b.colored(0xb7c5b8, () => b.ellipsoid(point(x, 1.2, z), point(1.8, 1, 1.8), b.metal, 12, 4));
      for (const dx of [-0.24, 0.24]) b.box(0.05, 12.6, 0.05, x + dx, 7.5, z + 2, b.metal);
      for (let n = 0; n < 15; n++) b.box(0.52, 0.06, 0.06, x, 1.9 + n * 0.8, z + 2, b.metal);
    }
  });
  b.feature('distillation-tower', () => {
    b.vessel(-10, 6, 1.05, 16, 0.5, 0xb6c3ba);
    for (const y of [5, 10, 15]) { b.box(3.8, 0.15, 3.7, -10, y, 6, b.metal);
      for (const side of [-1, 1]) b.box(3.8, 0.1, 0.09, -10, y + 1.1, 6 + side * 1.8, b.metal); }
    for (const x of [-11.7, -8.3]) b.box(0.18, 16.5, 0.18, x, 8.4, 7.6, b.metal);
  });
  b.feature('elevated-pipe-racks', () => {
    for (const x of [-12, -5, 2, 10]) b.box(0.25, 5.1, 0.25, x, 2.7, 8.2, b.metal);
    b.box(22, 0.3, 2.2, -1, 5.35, 8.2, b.metal);
    for (let n = 0; n < 5; n++) b.pipe([[-11, 5.7, 7.4 + n * 0.35], [5, 5.7, 7.4 + n * 0.35], [5, 9, 4]], 0.13);
    b.pipe([[-10, 16.5, 6], [-5, 16.5, 6], [-5, 11, 0]], 0.19);
  });
  b.chimney(10, -10, 29, false); b.factorySign('โรงอาหารแปรรูปลานสวน', -7.2, 2.8, 13.8);
  return { industry: 'food-processing', smoke: true, silos: 4, distillationTowers: 1, elevatedPipeRacks: true, stackHeight: 29 };
}
