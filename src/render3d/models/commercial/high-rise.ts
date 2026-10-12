/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { CommercialBuilder } from './builder.js';

export function hotel(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed);
  b.site(b.stone); b.entrance();
  b.feature('eight-storey-hotel-and-glass-lobby', () => {
    b.colored(colors.wall, () => b.mass(20, 24.45, 10.8, 0, 16.475, -2.8, b.paint));
    b.box(20, 3.6, 10.8, 0, 2.2, -2.8, b.glass);
    b.colored(colors.trim, () => {
      for (const x of [-9.3, -4.65, 0, 4.65, 9.3]) b.box(0.25, 3.7, 0.26, x, 2.15, 2.72, b.paint);
      for (let f = 0; f < 8; f++) b.box(20.3, 0.15, 11.1, 0, 4.12 + f * 3.5, -2.8, b.paint);
      b.box(20.6, 0.24, 11.4, 0, 28.85, -2.8, b.paint);
    });
    b.facade(20, 10.8, 7, 8, 0, -2.8, b.paint, { floorY: 4.2, spacing: 3.5, ac: true });
    b.box(8.6, 0.2, 3.4, 0, 3.9, 4.25, b.stone);
    for (const x of [-3.9, 3.9]) b.box(0.12, 3.7, 0.12, x, 1.96, 5.5, b.metal);
  });
  b.feature('rooftop-name-support', () => { for (const x of [-5, 5]) b.box(0.11, 2.9, 0.11, x, 30.1, 2.45, b.metal); });
  b.shopSign('โรงแรมลานลม', 12, 1.8, 0, 30.05, 2.5, { background: 0xe9e3cc, foreground: 0x405b60, lit: true });
  b.shopSign('ยินดีต้อนรับ', 4.2, 0.65, 0, 3.1, 2.76);
  b.parking(3, b.stone); b.gardens(2, 5.3, b.paint);
  return { floors: 8, floorSpacing: [4, 3.5], rooftopHotelSign: true, glassLobby: true, hotelName: 'โรงแรมลานลม' };
}

export function departmentStore(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed);
  b.site(b.stone); b.entrance();
  b.feature('five-storey-blank-wall-department-store', () => {
    b.colored(colors.wall, () => b.mass(24, 19.7, 20.6, 0, 10.05, -2.35, b.paint));
    b.box(13.5, 3.25, 0.09, 0, 1.94, 8.02, b.glass);
    b.colored(colors.trim, () => {
      for (let floor = 1; floor <= 5; floor++) b.box(24.2, 0.2, 20.8, 0, floor * 4 + 0.13, -2.35, b.paint);
      b.box(24.5, 0.3, 21.1, 0, 20.45, -2.35, b.paint);
    });
    b.box(15, 0.23, 2.4, 0, 3.8, 8.8, b.stone);
  });
  b.feature('rooftop-parking-and-access-core', () => {
    b.colored(colors.trim, () => b.mass(4, 3.7, 5, 9.5, 22.39, -8.5, b.paint));
    for (const side of [-1, 1]) { b.box(0.14, 0.95, 20.4, side * 11.9, 20.98, -2.35, b.stone);
      b.box(23.7, 0.95, 0.14, 0, 20.98, -2.35 + side * 10.2, b.stone); }
    for (let i = 0; i < 5; i++) {
      b.car(-8 + i * 3.5, -2.8, b.stone, 0, 20.62);
      b.colored(0xf3eee0, () => b.box(0.08, 0.035, 4.4, -9.45 + i * 3.5, 20.64, -2.8, b.paint));
    }
    b.shopSign('ทางขึ้นลานจอด', 3.4, 0.65, 9.5, 21.85, -5.94, { background: 0xdadfd8 });
  });
  b.shopSign('ห้างลานสวน', 13.5, 1.4, 0, 3.26, 8.14, { background: 0xdce7df });
  b.shopSign('ของใช้บ้านอุ่น\nครบในที่เดียว', 8, 7.2, -6.1, 12.4, 8.12, { background: 0xc7d9d8, foreground: 0x405657 });
  b.shopSign('เสื้อผ้าและผ้าทอ\nตลาดช่างท้องถิ่น', 8, 7.2, 6.1, 12.4, 8.12, { background: 0xe4caa0, foreground: 0x66523b });
  b.gardens(2, 5.1, b.paint);
  return { floors: 5, floorSpacing: [4], blankWalls: true, billboards: 2, rooftopParkingCars: 5, accessCore: true };
}
