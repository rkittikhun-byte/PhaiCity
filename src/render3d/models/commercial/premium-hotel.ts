/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { CommercialBuilder } from './builder.js';

export function balconyHotel(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), top = 70.7;
  b.site(b.stone); b.entrance();
  b.feature('twenty-storey-balcony-hotel', () => {
    b.colored(colors.wall, () => b.mass(18.5, 66.4, 11.5, 0, 37.4, -2.8, b.paint));
    b.mass(18.9, 3.9, 11.9, 0, 2.15, -2.8, b.glass);
    b.facade(18.5, 11.5, 19, 5, 0, -2.8, b.paint, { floorY: 4.2, spacing: 3.5, balcony: true, glassRail: true });
    b.box(20.8, 0.28, 14.4, 0, top + 0.18, -2.8, b.stone);
    b.box(7.8, 0.22, 3.8, 0, 3.98, 4.83, b.stone);
    for (const x of [-3.5, 3.5]) b.box(0.15, 3.75, 0.15, x, 2.06, 6.5, b.metal);
  });
  b.feature('rooftop-pool-terrace', () => {
    b.pool(-2.2, -2.8, 9.4, 4.9, top + 0.46);
    for (const side of [-1, 1]) {
      b.box(20.5, 0.95, 0.055, 0, top + 0.98, -2.8 + side * 7.05, b.glass);
      b.box(0.055, 0.95, 14.05, side * 10.23, top + 0.98, -2.8, b.glass);
    }
    for (let i = 0; i < 4; i++) b.colored(0xced6d1, () => {
      b.box(0.85, 0.16, 1.95, 6.8, top + 0.49, -7 + i * 2.6, b.paint);
      b.box(0.85, 0.5, 0.12, 6.8, top + 0.79, -7.8 + i * 2.6, b.paint);
    });
  });
  b.shopSign('โรงแรมไผ่ใบเมฆ', 11, 1.2, 0, 3.2, 3.24, { background: 0xe7e2cd });
  b.parking(2, b.stone); b.gardens(2, 6.1, b.paint);
  return { floors: 20, floorSpacing: [4, 3.5], roomBalconies: 190, rooftopPool: true, rooftopPoolLevel: 20 };
}
