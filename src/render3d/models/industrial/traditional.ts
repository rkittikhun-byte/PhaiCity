/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { TorusGeometry } from 'three';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { IndustrialBuilder } from './builder.js';

export function traditionalIndustry(b: IndustrialBuilder, size: 0 | 2): Record<string, unknown> {
  const spec = b.kit.industrial.traditional[size];
  b.industrialSite();
  b.feature('regional-industrial-halls', () => b.take(b.kitParts(b.kit.industrial.hall(size, b.options.seed))));
  b.feature('production-yard', () => {
    switch (spec.kind) {
      case 'rice-mill':
        b.colored(0xd2b77b, () => { b.box(8.5, 0.07, 4.2, -5, 0.13, 8.3, b.goods);
          for (let n = 0; n < 9; n++) b.box(7.8, 0.03, 0.04, -5, 0.18, 6.5 + n * 0.4, b.goods); });
        b.sackPile(-9, 3); b.sackPile(7.5, 6.4, 2);
        b.vessel(10.8, -4, 1.3, 5.4, 0.2, 0xb1a697);
        b.pipe([[10.8, 5.7, -4], [10.8, 8.4, -4], [8.4, 8.4, -4]], 0.22);
        b.truck(9.7, 10, 'etan', b.palette.trim);
        break;
      case 'tobacco-barns':
        for (const x of [-3.8, 4.6]) for (let row = 0; row < 3; row++) b.sackPile(x, 6.2 + row * 1.7, 1, 0x9c7c45);
        b.truck(10.3, 8.5, 'etan', b.palette.trim);
        break;
      case 'fish-sauce':
        for (const x of [-8, -2, 4]) for (const z of [2.1, 7.3]) {
          b.colored(0xb99b75, () => b.cylinder(1.7, 2.1, x, 1.25, z, b.goods, 12));
          b.cylinder(1.75, 0.16, x, 2.34, z, b.stone, 12);
          b.colored(0x555340, () => b.cylinder(0.26, 0.04, x, 2.44, z, b.goods, 8));
        }
        b.vessel(-7.4, -9.5, 1.3, 4.5); b.truck(10.5, 7.5, 'pickup', b.palette.trim);
        break;
      case 'palm-sugar-sheds':
        for (const x of [-3.5, 5]) for (const z of [-5.8, -1.8]) {
          b.cylinder(0.96, 1.05, x, 0.69, z, b.brick, 10);
          b.colored(0x5f6559, () => b.ellipsoid(point(x, 1.29, z), point(1.2, 0.25, 1.2), b.metal, 10, 4));
        }
        b.regionalProp('sugar_stove', -6, 8, 0.85); b.truck(10, 9.7, 'etan', b.palette.trim);
        break;
      case 'rubber-smoking-house':
        for (const x of [-8, -2, 4]) b.regionalProp('rubber_rack', x, 6.5, 0.92);
        for (const x of [-8, -2, 4]) b.sackPile(x, 10, 1, 0xd8bb88);
        b.truck(10.8, 8.7, 'pickup', b.palette.trim);
        break;
      case 'longan-kilns':
        for (const x of [-7, 0]) for (const z of [2, 6]) {
          b.box(3.8, 0.3, 2.7, x, 0.34, z, b.metal);
          b.colored(0xc49d52, () => { for (let n = 0; n < 10; n++) b.ellipsoid(point(x - 1.4 + n % 5 * 0.67, 0.63, z - 0.65 + Math.floor(n / 5) * 1.3), point(0.28, 0.13, 0.28), b.goods, 6, 3); });
        }
        b.vessel(5.5, -5, 1.25, 4); b.truck(8.8, 8.8, 'cane', b.palette.trim);
        break;
      case 'seafood-canning':
        for (const x of [-9, -5]) { b.box(2.7, 1.2, 2.5, x, 0.79, 7, b.stone);
          b.colored(0x7e9c97, () => { for (let n = 0; n < 6; n++) b.box(0.75, 0.55, 0.9, x - 0.78 + n % 3 * 0.78, 1.6 + Math.floor(n / 3) * 0.56, 7, b.goods); }); }
        b.vessel(10.5, 1, 1.4, 4); b.truck(7, 9, 'pickup', b.palette.trim);
        break;
      case 'palm-oil-mill':
        // Horizontal sterilizer pressure vessels with rounded ends and a loading gantry.
        for (const z of [1, 5]) {
          b.pole(point(6.3, 2.5, z), point(11, 2.5, z), 1.15, b.metal, 12);
          for (const x of [6.3, 11]) b.ellipsoid(point(x, 2.5, z), point(0.55, 1.15, 1.15), b.metal, 8, 6);
          for (const x of [7, 10]) b.box(0.8, 1.6, 1.5, x, 1, z, b.stone);
        }
        for (let i = 0; i < 4; i++) b.sackPile(-6 + i * 3.5, 9.8, 1, 0x9f6540);
        b.box(17, 0.28, 0.3, 0, 6.1, 5, b.metal);
        for (const x of [-8, 8]) b.box(0.26, 5.8, 0.26, x, 3.2, 5, b.metal);
        break;
      default:
        b.vessel(-8, 6, 1.6, 4.7); b.vessel(-3.6, 6, 1.6, 4.7);
        b.canePile(3, 8.4); b.canePile(-8, 10.5, 0.45, 4, 2);
        b.truck(9.5, 5.6, 'cane', b.palette.trim);
        b.pipe([[-8, 4.8, 6], [-8, 5.8, 1], [0, 5.8, 1], [0, 6.8, -2]], 0.23);
    }
    if (spec.prop && !['rubber_rack', 'palm_sugar_pots'].includes(spec.prop)) b.regionalProp(spec.prop, -11.5, 10.8, 0.55);
    if (spec.prop === 'palm_sugar_pots') b.regionalProp(spec.prop, -11.5, 7.5, 0.7);
  });
  b.chimney(size === 0 ? -10 : 10, -10, size === 0 ? 25 : 26);
  b.factorySign(spec.label, -7.2, 2.85, 13.8);
  return { industry: spec.kind, regionalHalls: spec.halls, smoke: true, stackHeight: size === 0 ? 25 : 26,
    riceDryingYard: spec.kind === 'rice-mill', fermentationVats: spec.kind === 'fish-sauce' ? 6 : 0,
    rubberRacks: spec.kind === 'rubber-smoking-house' ? 3 : 0, sterilizerVessels: spec.kind === 'palm-oil-mill' ? 2 : 0 };
}

export function repairGarage(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('garage-and-zinc-warehouse', () => {
    b.hall(12, 5, 12, -5, -5); b.hall(8, 7, 17, 8, -3);
    for (const x of [-8.3, -4.8, -1.3]) {
      b.colored(0x242e2d, () => b.box(3, 3.7, 0.08, x, 2.1, 1.04, b.metal));
      b.box(0.17, 4.1, 0.17, x - 1.6, 2.25, 1.15, b.stone);
      b.box(0.18, 3.1, 0.18, x - 1, 1.75, 3.2, b.metal);
    }
    // Regional roof dress follows the kit; the two structural shells remain fixed.
    b.take(b.kitParts(b.kit.roofs[b.kit.defaults.roofForm]([11.6, 3.8], { baseY: 4.4, pitch: Math.min(26, b.kit.defaults.pitch / 2),
      overhang: 0.18, material: 'roof_metal_corrugated', ornaments: false, seed: b.options.seed, detail: 'low' })), -5, 0, 3.1);
  });
  b.feature('repair-pickups', () => { b.truck(-8.4, 4.1, 'pickup', b.palette.trim); b.truck(-3.8, 6.7, 'pickup', 0x967f62); });
  b.feature('scrap-metal-and-old-tires', () => {
    for (let n = 0; n < 14; n++) b.box(1.4 + b.random() * 1.2, 0.16, 0.6, 7 + b.random() * 4, 0.55 + n / 14 * 1.2, 9 + b.random() * 2.6, b.metal, (b.random() - 0.5) * 0.6);
    b.colored(0x222928, () => { for (let n = 0; n < 9; n++) {
      const src = new TorusGeometry(0.31, 0.12, 6, 8).rotateX(Math.PI / 2)
        .translate(-10.8 + n % 3 * 0.9, 0.32 + Math.floor(n / 3) * 0.24, 9.7);
      b.add(applyWorldUV(src, 1), b.goods); src.dispose();
    } });
  });
  b.feature('regional-yard-prop', () => b.regionalProp(b.kit.modernHouseProp, 10.7, 6, 0.55));
  b.factorySign('อู่ซ่อมรถลานช่าง', -7.2, 2.8, 13.8);
  return { industry: 'repair-garage', smoke: false, repairPickups: 2, scrapPiles: 1, oldTires: 9 };
}

export function heavyIndustry(b: IndustrialBuilder): Record<string, unknown> {
  b.industrialSite();
  b.feature('rusty-processing-hall', () => b.hall(12, 7, 13, -7, -1));
  b.feature('spherical-storage-tanks', () => {
    for (const [x, z] of [[5, -2], [10.1, 4.8], [3.5, 8.5]]) {
      for (const dx of [-1.45, 1.45]) for (const dz of [-1.45, 1.45]) b.box(0.26, 2.7, 0.26, x + dx, 1.55, z + dz, b.metal);
      b.colored(0x9ca29a, () => b.ellipsoid(point(x, 4.5, z), point(2.65, 2.65, 2.65), b.metal, 12, 8));
      b.cylinder(0.3, 0.4, x, 7.2, z, b.metal, 8);
      b.colored(0x805341, () => { for (let i = 0; i < 4; i++) b.box(0.12, 1.15 + i * 0.1, 0.05, x - 0.9 + i * 0.6, 5.1 - i * 0.15, z + 2.4, b.goods); });
    }
  });
  b.feature('tangled-pipework', () => {
    for (let n = 0; n < 8; n++) b.pipe([[-11, 3 + n * 0.3, 6 + n * 0.5], [-8, 4 + n * 0.2, 6 + n * 0.5],
      [0, 4 + n * 0.2, 3 + n * 0.5], [5, 3.5 + n * 0.3, -2]], 0.11 + n % 3 * 0.035);
    for (const x of [-10, -3, 4]) b.box(0.25, 5.8, 0.25, x, 3.1, 7.5, b.metal);
    b.box(16, 0.35, 1.5, -3, 5.9, 7.5, b.metal);
  });
  b.chimney(0, -10, 33, false); b.factorySign('โรงงานโลหะลานเหล็ก', -7.2, 2.8, 13.8);
  return { industry: 'heavy-industry', smoke: true, sphericalTanks: 3, stackHeight: 33 };
}
