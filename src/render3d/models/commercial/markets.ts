/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { point } from '../../regional/geometry.js';
import { CommercialBuilder } from './builder.js';

export function emptyLot(b: CommercialBuilder): Record<string, unknown> {
  b.site(b.stone); b.entrance();
  const count = seededRng(b.options.seed)() < 0.5 ? 1 : 2;
  b.feature('street-food-carts', () => {
    b.cart(-7, 5.5, 'ข้าวแกงริมลาน'); if (count === 2) b.cart(7, 5.5, 'ชาเย็นบ้านลม');
    b.take(b.kit.marketGoods({ seed: b.options.seed }), -7, 0.26, 5.5);
    if (count === 2) b.take(b.kit.marketGoods({ seed: (b.options.seed ?? 1) + 1 }), 7, 0.26, 5.5);
    b.plasticFurniture(-7, 9.8); b.plasticFurniture(7, 9.8);
  });
  b.shopSign('ให้เช่า', 5.4, 1.4, 0, 3.4, -8.5);
  b.feature('rental-sign-posts', () => { for (const x of [-2.5, 2.5]) b.box(0.09, 3.7, 0.09, x, 1.91, -8.5, b.metal); });
  b.gardens(2, 4.8);
  return { floors: 0, cartCount: count, rentalText: 'ให้เช่า' };
}

export function nightMarket(b: CommercialBuilder): Record<string, unknown> {
  b.site(b.stone); b.entrance();
  b.feature('sixteen-regional-market-stalls', () => {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const n = row * 4 + col, x = -10 + col * 6.6, z = -10 + row * 5.7;
      b.take(b.kit.marketStall({ seed: (b.options.seed ?? 1) + n, color: n % 2 ? 0x568cae : 0xe18a4d }), x, 0.08, z);
      b.take(b.kit.marketGoods({ seed: (b.options.seed ?? 1) + n }), x, 0.08, z);
      b.shopSign(b.kit.commercial.marketNames[n % 4], 2.5, 0.46, x, 0.88, z + 0.79);
    }
  });
  b.feature('pickup-selling-goods', () => b.pickup(10.7, 11));
  b.feature('plastic-tables-and-stools', () => { b.plasticFurniture(-9, 11.5, 0xdda765); b.plasticFurniture(-4.5, 11.5); });
  b.gardens(2, 4.3);
  return { floors: 0, stallCount: 16, umbrellaColors: ['orange', 'blue'], regionalGoods: b.kit.commercial.goods, marketNames: b.kit.commercial.marketNames,
    woodenStalls: true, paperUmbrellas: b.kit.id === 'north', sellingPickup: true };
}

export function woodenShop(b: CommercialBuilder): Record<string, unknown> {
  const wall = tint(b.kit.zoneStyle.timber, b.kit.palette.pick(b.options.seed).wall);
  b.site(b.stone); b.entrance();
  b.feature('four-unit-wooden-row', () => {
    b.mass(21, 7.45, 8, 0, 3.9, -3, wall);
    b.facade(21, 8, 1, 8, 0, -3, wall, { floorY: 4.12, spacing: 3.5 });
    for (let i = 0; i < 4; i++) b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([5.2, 8], { baseY: 7.65, pitch: 22, overhang: 0.18,
      seed: b.options.seed, detail: 'low', ornaments: true }), ['wood_painted'], wall), -7.8 + i * 5.2, 0, -3);
    for (let i = 0; i < 4; i++) {
      const x = -7.8 + i * 5.2;
      b.box(3.7, 3, 0.05, x, 1.67, 1.05, b.glass);
      b.box(0.13, 7.4, 0.17, x - 2.55, 3.9, 1.1, wall);
      b.shopSign(['ของชำบ้านไม้', 'เครื่องเขียนริมสวน', 'ข้าวสารบ้านคลอง', 'ของใช้หน้าซอย'][i], 4.65, 0.75, x, 3.43, 1.13);
    }
  });
  b.feature('noodle-lean-to-and-coolers', () => {
    b.awning(10.5, 3.3, -4.8, 3.4, 3.1, 0xc4a474);
    for (const x of [-9.7, 0.1]) b.box(0.09, 2.96, 0.09, x, 1.57, 4.6, b.metal);
    b.cart(-7.5, 4, 'ก๋วยเตี๋ยวบ้านไม้'); b.plasticFurniture(-3.2, 5.5);
    for (const x of [4, 6.5]) b.colored(0x84a8b0, () => { b.box(1.55, 1.05, 0.9, x, 0.72, 2.4, b.fabric); b.box(1.65, 0.12, 1, x, 1.29, 2.4, b.fabric); });
  });
  b.parking(3, wall, true); b.gardens(2, 5.3, wall);
  return { floors: 2, units: 4, woodenBuilding: true, noodleLeanTo: true, drinkCoolers: 2, floorSpacing: [4, 3.5] };
}

export function freshMarket(b: CommercialBuilder): Record<string, unknown> {
  b.site(b.stone); b.entrance();
  b.feature('open-steel-market-hall', () => {
    b.box(23.5, 0.15, 20.5, 0, 0.18, -2, b.stone);
    for (const x of [-11, 0, 11]) for (const z of [-11, -2, 7]) b.box(0.15, 4.8, 0.15, x, 2.61, z, b.metal);
    for (const z of [-11, -2, 7]) {
      b.pole(point(-11, 4.95, z), point(0, 6.3, z), 0.065, b.metal, 4);
      b.pole(point(0, 6.3, z), point(11, 4.95, z), 0.065, b.metal, 4);
      b.box(22.2, 0.12, 0.12, 0, 4.95, z, b.metal);
    }
    b.take(b.remap(b.kit.roofs.gable([23.5, 20.5], { baseY: 4.95, pitch: 7, overhang: 0.25,
      material: 'roof_metal_corrugated', seed: b.options.seed, ornaments: false, detail: 'low' }), ['wood_painted'], b.wood), 0, 0, -2);
  });
  b.feature('vegetable-meat-stalls-and-ice', () => {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const x = -8.4 + col * 5.6, z = -8.6 + row * 5.4;
      b.box(3.4, 0.75, 1.8, x, 0.64, z, b.stone);
      b.colored(row % 2 ? 0xc8857a : 0x77a653, () => {
        for (let i = 0; i < 4; i++) b.ellipsoid(point(x - 1.05 + i * 0.68, 1.16, z), point(0.24, 0.11, 0.34), b.fabric, 6, 4);
      });
      b.colored(0xb59c73, () => { b.cylinder(0.36, 0.54, x + 1.15, 0.4, z + 1.25, b.fabric, 8); });
      if (col % 2 === 0) { b.cylinder(0.35, 0.55, x - 1.1, 0.43, z + 1.25, b.metal, 8);
        b.colored(0xd8e4e4, () => b.box(0.4, 0.12, 0.3, x - 1.1, 0.74, z + 1.25, b.fabric)); }
    }
  });
  b.feature('regional-market-entrance-roof', () => {
    for (const x of [-2.5, 2.5]) b.box(0.12, 3.3, 0.12, x, 1.8, 10.2, b.wood);
    b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([5.6, 2.2], { baseY: 3.45, pitch: 25, overhang: 0.22,
      material: 'roof_metal_corrugated', seed: b.options.seed, detail: 'low' }), ['wood_painted'], b.wood), 0, 0, 10.2);
  });
  b.shopSign('ตลาดสดลานสวน', 10, 1.1, 0, 4.35, 8.65);
  b.parking(3, b.stone, true); b.gardens(2, 4.3);
  return { floors: 1, openSteelFrame: true, zincRoof: true, stallCount: 12, vegetableStalls: 8, meatStalls: 4, iceBuckets: 6 };
}
