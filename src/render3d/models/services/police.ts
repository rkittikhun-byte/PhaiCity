/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { ServiceBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export function createPolice(options: ModelOptions = {}) {
  const b = new ServiceBuilder(options), palette = b.kit.services.palette('police', options.seed);
  b.colored(0xbfbfb3, () => { b.site(b.stone); b.entrance(b.stone, 6.2); });
  b.feature('three-storey-station', () => {
    b.colored(palette.wall, () => b.mass(21, 9.9, 12, 0, 5.13, -5, b.paint));
    b.colored(palette.trim, () => {
      b.facade(21, 12, 3, 7, 0, -5, b.paint, { spacing: 3.3, ac: true });
      for (const y of [0.72, 3.48, 6.78, 9.98]) b.box(21.12, 0.23, 12.12, 0, y, -5, b.paint);
      for (const x of [-9.8, -3.5, 3.5, 9.8]) b.box(0.33, 9.6, 0.16, x, 5.1, 1.09, b.paint);
    });
    for (const side of [-1, 1]) for (let floor = 0; floor < 3; floor++) for (const z of [-8.8, -5, -1.2])
      b.pane(1.6, 1.6, side * 10.55, 1.85 + floor * 3.3, z, b.glass, side * Math.PI / 2);
    b.take(b.kitParts(b.kit.roofs.flatParapet([21, 12], { baseY: 10.08, overhang: 0.14,
      surfaceColor: palette.wall, ornaments: false })), 0, 0, -5);
  });
  b.feature('regional-applied-Thai-roof', () => b.civicRoof(9, 12, 0, 10.25, -5));
  b.feature('entrance-portico', () => {
    b.colored(palette.wall, () => {
      b.box(7.2, 0.26, 4.8, 0, 3.4, 3.15, b.paint);
      for (const x of [-3.2, 3.2]) b.box(0.35, 3.2, 0.35, x, 1.8, 5.15, b.paint);
      for (let i = 0; i < 3; i++) b.box(6.8, 0.12, 1.1 + i * 0.8, 0, 0.24 + (2 - i) * 0.12, 4.75, b.stone);
    });
    b.box(3.2, 2.4, 0.08, 0, 1.5, 1.08, b.glass);
    b.colored(palette.trim, () => b.box(0.1, 2.4, 0.12, 0, 1.5, 1.15, b.paint));
    b.shopSign('สถานีตำรวจ', 7.1, 1.45, 0, 4.2, 5.61, { background: palette.wall, foreground: 0x211b16 });
  });
  b.feature('entrance-guard-booth', () => {
    b.colored(palette.wall, () => b.mass(2.7, 2.5, 2.4, 10.25, 1.43, 10.8, b.paint));
    b.pane(2.2, 1.05, 10.25, 1.75, 12.03, b.glass);
    b.pane(1.55, 1.05, 8.87, 1.75, 10.8, b.glass, -Math.PI / 2);
    b.civicRoof(2.7, 2.4, 10.25, 2.68, 10.8);
    b.colored(palette.trim, () => b.box(3.1, 0.25, 2.8, 10.25, 0.2, 10.8, b.paint));
  });
  b.feature('Thai-national-flag', () => b.thaiFlag(-12.2, 8.3));
  for (const x of [-7.6, -3.8]) b.feature('white-striped-patrol-car', () => b.patrolCar(x, 9.8));
  for (const x of [4.3, 6.4]) b.feature('police-motorbike', () => b.patrolBike(x, 10.2));
  b.feature('parking-bays', () => b.colored(0xf2ecd8, () => {
    for (const x of [-9.3, -5.7, -2]) b.box(0.08, 0.018, 4.2, x, 0.11, 9.8, b.paint);
  }));
  b.gardens(2, 4.4, b.wood);
  b.flushSigns();
  return b.finishZone('svc.police', 'services', 774, 'R2', {
    floors: 3, signText: 'สถานีตำรวจ', roofForm: b.kit.services.roofForm,
    roofOrnament: b.kit.services.ornament, palette, patrolCars: 2, policeMotorbikes: 2,
    nationalFlag: 'Thai', guardBooths: 1,
  });
}
