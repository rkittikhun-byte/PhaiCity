/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { vertexFinish } from '../../materials/library.js';
import { KitBuilder, point } from '../../regional/geometry.js';
import { CommercialBuilder } from './builder.js';

export function luxuryDepartmentStore(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), metal = vertexFinish('metal_painted');
  b.site(b.stone); b.entrance();
  b.feature('six-storey-luxury-department-store', () => {
    b.colored(colors.wall, () => b.mass(23.5, 21.9, 18, 0, 11.15, -4, b.paint));
    b.box(22.8, 20.8, 0.05, 0, 10.92, 5.06, b.glass);
    b.colored(colors.trim, () => {
      for (const y of [4.2, 7.7, 11.2, 14.7, 18.2, 21.7]) b.box(23.8, 0.14, 18.3, 0, y, -4, b.paint);
      b.box(24.1, 0.25, 18.6, 0, 22.28, -4, b.paint);
    });
  });
  b.feature('perforated-abstract-rice-leaf-metal-panels', () => {
    const panel = new KitBuilder();
    // Open diamonds and slits: actual holes through the metal, with a recessed glazed facade behind.
    for (const x of [-1.35, 0, 1.35]) panel.box(0.08, 3.1, 0.08, x, 1.55, 0, metal);
    for (const y of [0.08, 1.55, 3.02]) panel.box(2.7, 0.08, 0.08, 0, y, 0, metal);
    for (const x of [-0.68, 0.68]) for (const y of [0.78, 2.3]) {
      const points = [point(x, y - 0.55, 0), point(x + 0.45, y, 0), point(x, y + 0.55, 0), point(x - 0.45, y, 0)];
      for (let side = 0; side < 4; side++) panel.pole(points[side], points[(side + 1) % 4], 0.045, metal, 4);
    }
    panel.parts.forEach(p => CommercialBuilder.color(p.geometry, 0xb2a88f));
    for (let floor = 0; floor < 5; floor++) for (let col = 0; col < 8; col++) b.place(panel.parts, -10.15 + col * 2.9, 4.3 + floor * 3.5, 5.38);
    panel.parts.forEach(p => p.geometry.dispose());
  });
  b.feature('front-event-plaza', () => {
    b.box(12.5, 0.26, 4, 0, 0.27, 8.2, b.stone);
    for (const x of [-6.05, 6.05]) b.box(0.12, 3.8, 0.12, x, 2.02, 7, b.metal);
    b.box(12.2, 0.1, 0.12, 0, 3.93, 7, b.metal);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) b.colored(0xbbb09b, () => {
      b.box(0.48, 0.1, 0.5, -3.6 + col * 1.8, 0.53, 11.2 + row * 1.45, b.paint);
      b.box(0.48, 0.5, 0.09, -3.6 + col * 1.8, 0.83, 11.46 + row * 1.45, b.paint);
    });
  });
  b.shopSign('ห้างสวนริ้วเมฆ', 13, 1.1, 0, 3.08, 5.53);
  b.shopSign('ลานงานสร้างสรรค์', 10.4, 0.85, 0, 3.4, 7.13);
  b.gardens(2, 5.6, b.paint);
  return { floors: 6, floorSpacing: [4, 3.5], perforatedMetalPanels: 40, pattern: 'abstract-rice-leaf-diamonds', eventPlaza: true, eventSeats: 10 };
}
