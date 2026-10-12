/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { vertexFinish } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { ServiceBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export function createFire(options: ModelOptions = {}) {
  const b = new ServiceBuilder(options), palette = b.kit.services.palette('fire', options.seed);
  const shutter = vertexFinish('roller_shutter');
  b.colored(0xb7bbb3, () => { b.site(b.stone); b.entrance(b.stone, 6.2); });
  b.feature('three-bay-garage', () => {
    b.colored(palette.wall, () => b.mass(19.4, 6, 10, -2, 3.18, -7, b.paint));
    for (const x of [-8.4, -2, 4.4]) {
      b.colored(palette.trim, () => b.box(5.4, 4.75, 0.16, x, 2.73, -1.89, b.paint));
      b.colored(0xaf342b, () => b.box(4.8, 4.3, 0.12, x, 2.51, -1.76, shutter));
      b.colored(0xd5d2bf, () => b.box(3.4, 0.13, 0.045, x, 1.11, -1.67, b.metal));
    }
    b.colored(palette.trim, () => {
      for (const x of [-11.35, -5.2, 1.2, 7.35]) b.box(0.33, 5.7, 0.4, x, 3.1, -1.8, b.paint);
      b.box(19.5, 0.35, 0.4, -2, 5.35, -1.8, b.paint);
    });
    b.civicRoof(10, 19.4, -2, 6.18, -7, Math.PI / 2);
    b.shopSign('สถานีดับเพลิง', 11.2, 1.25, -2, 5.78, -1.56, { background: palette.wall, foreground: 0x4b2019 });
  });
  b.feature('five-storey-training-tower', () => {
    b.colored(palette.wall, () => b.mass(4.5, 16.5, 5.4, 10.7, 8.43, -8.3, b.paint));
    for (let floor = 0; floor < 5; floor++) {
      const y = 1.85 + floor * 3.3;
      b.box(2.55, 2.1, 0.07, 10.7, y, -5.56, b.metal);
      b.pane(2.5, 2.1, 13, y, -8.3, b.glass, Math.PI / 2);
      b.colored(palette.trim, () => b.box(4.6, 0.18, 5.5, 10.7, 0.28 + floor * 3.3, -8.3, b.paint));
    }
    b.take(b.kitParts(b.kit.roofs.flatParapet([4.5, 5.4], { baseY: 16.7, overhang: 0.18,
      surfaceColor: palette.wall, ornaments: false })), 10.7, 0, -8.3);
    for (const x of [9.95, 11.45]) b.pole(point(x, 0.35, -5.5), point(x, 16.55, -5.5), 0.04, b.metal, 4);
  });
  for (const x of [-8.1, -1.6]) b.feature('red-fire-engine', () => b.fireEngine(x, 5.3));
  b.feature('training-yard', () => {
    b.colored(0x9eaaa4, () => b.box(7.2, 0.03, 12, 9.3, 0.085, 7.5, b.stone));
    b.colored(0xf0e7d3, () => {
      for (const x of [6.1, 12.5]) b.box(0.08, 0.012, 11, x, 0.111, 7.5, b.paint);
      for (const z of [2, 7.5, 13]) b.box(6.4, 0.012, 0.08, 9.3, 0.111, z, b.paint);
    });
    for (const x of [7, 8.1, 9.2]) b.colored(0xc35535, () => b.cylinder(0.16, 0.62, x, 0.41, 2.6, b.metal, 6));
    b.colored(0xbdae80, () => b.tube(Array.from({ length: 17 }, (_, i) => {
      const angle = i / 16 * Math.PI * 2;
      return point(10.8 + Math.cos(angle) * 0.67, 0.22, 3.7 + Math.sin(angle) * 0.67);
    }), 0.07, b.metal, 20, 5));
  });
  b.flushSigns();
  return b.finishZone('svc.fire', 'services', 765, 'R2', {
    garageBays: 3, garageDoorColor: 'red', trainingFloors: 5, signText: 'สถานีดับเพลิง',
    fireEngines: 2, trainingYard: true, roofForm: b.kit.services.roofForm,
    roofOrnament: b.kit.services.ornament, palette,
  });
}
