/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { getMaterial } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { CommercialBuilder } from './builder.js';

export function convenienceAndFuel(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed);
  b.site(b.stone); b.entrance();
  b.feature('neutral-green-white-convenience-shop', () => {
    b.colored(colors.wall, () => b.mass(12, 3.85, 8.2, -6, 2.125, -4, b.paint));
    b.box(10.7, 2.65, 0.08, -6, 1.67, 0.16, b.glass);
    b.colored(0x8fab9c, () => { b.box(12.1, 0.6, 0.15, -6, 3.35, 0.25, b.paint);
      for (const x of [-11.1, -6, -0.9]) b.box(0.12, 2.65, 0.18, x, 1.67, 0.3, b.paint); });
    b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([12, 8.2], { baseY: 4.05, pitch: 20, overhang: 0.32,
      seed: b.options.seed, detail: 'low', ornaments: false }), ['wood_painted'], b.paint), -6, 0, -4);
    b.shopSign('ร้านชำลานสวน', 7.8, 0.65, -6, 3.35, 0.36, { background: 0xe8efe8, foreground: 0x476e5d });
  });
  b.feature('two-pump-small-fuel-canopy', () => {
    b.colored(0xe8ebe3, () => b.box(9.2, 0.25, 7.2, 7.4, 4.05, 0.7, b.paint));
    for (const x of [3.5, 11.3]) for (const z of [-2.25, 3.65]) b.box(0.13, 3.75, 0.13, x, 2, z, b.metal);
    for (const x of [5.2, 9.5]) {
      b.colored(0xa8b5ae, () => b.box(1.05, 1.65, 0.7, x, 1.01, 0.7, b.paint));
      b.box(0.58, 0.35, 0.035, x, 1.38, 1.075, b.glass);
      b.tube([point(x + 0.5, 1.52, 0.7), point(x + 0.82, 0.56, 0.85), point(x + 0.55, 0.65, 1.17), point(x + 0.58, 1.22, 1.17)], 0.035, b.metal, 8, 4);
      b.box(0.15, 0.32, 0.13, x + 0.58, 1.23, 1.17, b.metal);
    }
    b.shopSign('จุดเติมเชื้อเพลิง', 6, 0.63, 7.4, 3.95, 4.36, { background: 0xe8e9dd, foreground: 0x526559 });
  });
  b.parking(2, b.stone); b.gardens(2, 4.6, b.paint);
  return { floors: 1, fuelPumps: 2, shopColors: ['neutral-green', 'white'], realBrand: false, floorSpacing: [4] };
}

export function newCommercialRow(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), shutter = getMaterial('roller_shutter');
  b.site(b.stone); b.entrance();
  b.feature('five-four-storey-commercial-units', () => {
    for (let i = 0; i < 5; i++) {
      const x = -9.1 + i * 4.55;
      b.colored(colors.wall, () => b.mass(4.5, 14.45, 10.5, x, 7.425, -3.7, b.paint));
      b.colored(colors.trim, () => {
        b.box(0.14, 14.5, 0.15, x - 2.17, 7.45, 1.6, b.paint);
        for (let f = 0; f < 3; f++) b.box(4.5, 0.16, 0.4, x, 4.16 + f * 3.5, 1.6, b.paint);
      });
      b.box(3.15, 2.7, 0.06, x, 1.68, 1.6, i === 4 ? shutter : b.glass);
      b.facade(4.5, 10.5, 3, 2, x, -3.7, b.paint, { floorY: 4.2, spacing: 3.5, ac: true });
      b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([4.5, 10.5], { baseY: 14.68, pitch: 22, overhang: 0.18,
        seed: b.options.seed, detail: 'low', ornaments: false }), ['wood_painted'], b.paint), x, 0, -3.7);
      b.shopSign(['คลินิกบ้านสวน', 'ยาลานไม้', 'ซ่อมโทรศัพท์', 'กาแฟลมเย็น', 'เครื่องเขียนริมลาน'][i], 4.1, 0.8, x, 3.4, 1.74,
        { background: i === 1 ? 0x527c63 : 0xe4e8df, foreground: i === 1 ? 0xffffff : 0x314b49 });
    }
  });
  b.parking(3, b.stone, true); b.gardens(2, 5.5, b.paint);
  return { floors: 4, floorSpacing: [4, 3.5], units: 5, shops: ['clinic', 'pharmacy', 'phone', 'coffee', 'stationery'], pharmacySign: 'green' };
}

export function communityMall(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed);
  b.site(b.stone); b.entrance();
  b.feature('U-shaped-two-storey-mall', () => {
    b.colored(colors.wall, () => {
      for (const x of [-9.55, 9.55]) b.mass(6.1, 7.45, 19.5, x, 3.925, -3.1, b.paint);
      b.mass(24.9, 7.45, 5.9, 0, 3.925, -10.15, b.paint);
    });
    for (const x of [-9.55, 9.55]) b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([6.1, 19.5],
      { baseY: 7.7, pitch: 22, overhang: 0.24, seed: b.options.seed, detail: 'low', ornaments: false }), ['wood_painted'], b.paint), x, 0, -3.1);
    for (const x of [-8.2, 0, 8.2]) b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([8.2, 5.9],
      { baseY: 7.7, pitch: 22, overhang: 0.24, seed: b.options.seed, detail: 'low', ornaments: false }), ['wood_painted'], b.paint), x, 0, -10.15);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = side * 6.46, z = -7 + i * 5.3, yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const y of [1.85, 5.55]) b.pane(3.6, 2.45, x, y, z, b.glass, yaw);
      b.shopSign(['ครัวลานไม้', 'กาแฟบ้านลม', 'ข้าวหอมริมสวน'][i], 3.6, 0.65, x - side * 0.06, 3.5, z, { yaw });
    }
    for (const x of [-7.5, 0, 7.5]) {
      for (const y of [1.85, 5.55]) b.pane(5.2, 2.45, x, y, -7.15, b.glass);
      b.shopSign(x ? 'อาหารบ้านอุ่น' : 'ขนมลานเย็น', 5.4, 0.7, x, 3.45, -7.08);
    }
    b.colored(colors.trim, () => {
      for (const side of [-1, 1]) b.box(0.16, 0.22, 19.3, side * 6.4, 4.14, -3.1, b.paint);
      b.box(24.5, 0.22, 0.22, 0, 4.14, -7.12, b.paint);
    });
  });
  b.feature('central-parking-court', () => {
    for (const x of [-3.6, 0, 3.6]) { b.car(x, 2.7, b.stone);
      b.colored(0xebeadc, () => b.box(0.08, 0.03, 4.6, x - 1.5, 0.13, 2.7, b.paint)); }
  });
  b.feature('coffee-and-restaurant-tables', () => { b.plasticFurniture(-10, 10.3, 0x91a9a2); b.plasticFurniture(10, 10.3, 0xbea873); });
  b.gardens(2, 4.3, b.paint);
  return { floors: 2, floorSpacing: [4, 3.5], plan: 'U', shopCount: 9, centralParkingCars: 3, coffeeShop: true, restaurants: true };
}
