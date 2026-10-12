/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { point } from '../../regional/geometry.js';
import { chamferPlan, chamferPrism } from './geometry.js';
import { CommercialBuilder } from './builder.js';

export function officeBuilding(b: CommercialBuilder, podium = false): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), floors = podium ? 30 : 12;
  b.site(b.stone); b.entrance();
  if (podium) b.feature('four-storey-office-podium', () => {
    b.colored(colors.wall, () => b.mass(24, 15.85, 21, 0, 8.125, -2.4, b.paint));
    b.box(22.4, 14.6, 0.065, 0, 7.84, 8.15, b.glass);
    for (const y of [4.2, 8.2, 12.2, 16.2]) b.box(24.35, 0.17, 21.35, 0, y, -2.4, b.stone);
  });
  const start = podium ? 16.3 : 4.2, count = podium ? 26 : 11, w = podium ? 14.5 : 18, d = podium ? 13 : 14, z = -2.4;
  const top = start + count * 3.5;
  b.feature(podium ? 'set-back-office-tower' : 'blue-green-glass-office', () => {
    if (!podium) { b.mass(18.7, 3.95, 14.7, 0, 2.225, z, b.glass); b.box(18.95, 0.22, 14.95, 0, 4.12, z, b.stone); }
    b.mass(w, count * 3.5 - 0.12, d, 0, (start + top) / 2, z, b.glass);
    b.colored(colors.trim, () => {
      for (let floor = 0; floor <= count; floor++) b.box(w + 0.18, 0.13, d + 0.18, 0, start + floor * 3.5, z, b.paint);
      for (const side of [-1, 1]) for (let n = 0; n <= 10; n++) b.box(0.13, top - start, 0.82, (n / 10 - 0.5) * (w - 0.5), (start + top) / 2, z + side * (d / 2 + 0.34), b.paint);
      b.box(w + 0.4, 0.25, d + 0.4, 0, top + 0.15, z, b.paint);
    });
  });
  if (podium) {
    b.feature('company-sign-frame', () => { for (const x of [-5.1, 5.1]) b.box(0.1, 2.2, 0.1, x, top + 1.2, z + d / 2, b.metal); });
    b.shopSign('ลานฟ้าธุรกิจ', 11.5, 1.6, 0, top + 1.2, z + d / 2 + 0.12, { lit: true, background: 0xe1e8e4 });
  } else b.shopSign('สำนักงานลานเมฆ', 9, 0.8, 0, 3.1, z + 7.48);
  b.parking(2, b.stone); b.gardens(2, 5.5, b.paint);
  return { floors, floorSpacing: podium ? [4, 3.5] : [4, 3.5], verticalSunFins: 22, glassColor: 'blue-green',
    podiumFloors: podium ? 4 : 0, setBackTower: podium, topCompanySign: podium };
}

export function gradeAOffice(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), bottom = 7.8, top = bottom + 24 * 3.5;
  b.site(b.stone); b.entrance();
  b.feature('chamfered-grade-A-office-and-tall-lobby', () => {
    chamferPrism(b, 20.6, 17.4, 2.5, 0.2, 7.72, b.glass, 0, -2.4);
    chamferPrism(b, 19.7, 16.5, 2.4, bottom, top, b.glass, 0, -2.4);
    const outline = chamferPlan(19.92, 16.72, 2.45, 0, -2.4);
    b.colored(colors.trim, () => {
      for (let floor = 0; floor <= 24; floor++) {
        const y = bottom + floor * 3.5;
        for (let i = 0; i < 8; i++) b.pole(outline[i].clone().setY(y), outline[(i + 1) % 8].clone().setY(y), 0.07, b.paint, 4);
      }
      outline.forEach(p => b.pole(p.clone().setY(0.3), p.clone().setY(top), 0.065, b.paint, 4));
      chamferPrism(b, 20.3, 17.1, 2.5, top + 0.04, top + 0.31, b.paint, 0, -2.4);
    });
    b.box(8.2, 0.22, 3.8, 0, 4.05, 7.05, b.stone);
    for (const x of [-3.7, 3.7]) b.pole(point(x, 0.18, 8.75), point(x, 3.95, 8.75), 0.055, b.metal, 6);
  });
  b.shopSign('ศูนย์ธุรกิจริ้วเมฆ', 11.2, 1.1, 0, 6.13, 6.4, { background: 0xe7e8df });
  b.parking(2, b.stone); b.gardens(2, 5.6, b.paint);
  return { floors: 25, floorSpacing: [3.5], chamferedCorners: 2.4, tallLobbyHeight: 7.5, upperOfficeFloors: 24 };
}
