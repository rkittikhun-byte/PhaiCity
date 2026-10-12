/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { vertexFinish } from '../../materials/library.js';
import { CommercialBuilder } from './builder.js';

export function shophouses(b: CommercialBuilder, wholesale: boolean): Record<string, unknown> {
  const style = b.kit.commercial, floors = style.floors[wholesale ? 1 : 0], wall = vertexFinish(style.wall);
  const ornament = style.arcade ? vertexFinish('stucco_ornament') : wall;
  const top = 0.2 + 4 + (floors - 1) * 3.5, colors = b.kit.palette.pick(b.options.seed, 'plaster');
  const shutters = vertexFinish('roller_shutter');
  b.site(b.stone); b.entrance();
  b.feature('six-regional-shop-units', () => {
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4, color = b.kit.palette.pick((b.options.seed ?? 1) + i, style.wall.startsWith('wood') ? 'default' : 'plaster');
      b.colored(color.wall, () => b.mass(3.96, top - 0.2, 9.4, x, (top + 0.2) / 2, -2.8, wall));
      if (style.timberUpper) b.box(3.95, 3.92, 0.07, x, 2.17, 1.93, b.stone);
      b.box(3.32, 2.65, 0.08, x, 1.58, 1.96, shutters);
      b.colored(color.trim, () => {
        b.box(0.16, top - 0.2, 0.2, x - 1.93, (top + 0.2) / 2, 2.03, wall);
        for (let f = 1; f < floors; f++) b.box(4, 0.14, 0.22, x, 4.16 + (f - 1) * 3.5, 2.04, wall);
      });
      for (let f = 1; f < floors; f++) {
        const y = 4.2 + (f - 1) * 3.5;
        b.pane(2.1, 1.8, x, y + 1.65, 2.08, b.glass);
        if (style.arcade) b.take(b.remap(b.kit.ornaments.pediment({ seed: b.options.seed, width: 2.28, detail: 'low', color: color.trim }), ['stucco_ornament'], ornament), x, y + 2.62, 2.15);
        if (style.balcony) {
          b.colored(color.trim, () => {
            b.box(3.75, 0.13, 1.15, x, y + 0.02, 2.45, wall);
            b.box(3.65, 0.09, 0.1, x, y + 1.06, 2.96, wall);
            for (let post = 0; post < 5; post++) b.box(0.07, 0.9, 0.08, x - 1.65 + post * 0.825, y + 0.55, 2.96, wall);
          });
          if (style.fretwork) b.take(b.remap(b.kit.ornaments.fretwork({ seed: b.options.seed, width: 3.3, height: 0.82, detail: 'low', color: color.trim }), ['wood_painted'], wall), x, y + 0.18, 3);
        }
      }
      b.take(b.remap(b.kit.roofs[style.roof]([3.98, 9.4], { baseY: top, pitch: 24, overhang: 0.18,
        seed: b.options.seed, material: style.roofMaterial, detail: 'low', ornaments: !style.arcade }), ['wood_painted'], wall), x, 0, -2.8);
      const name = style.bakery ? ['ขนมปังริมทุ่ง', 'อาหารเช้าบ้านลม', 'กาแฟบ้านไม้', 'ร้านผ้าลานสวน', 'ของใช้หน้าซอย', 'ซ่อมนาฬิกา'][i] :
        ['ข้าวแกงบ้านอุ่น', 'ร้านผ้าลานไม้', 'อะไหล่ริมคลอง', 'ของใช้บ้านสวน', 'ขนมลานเย็น', 'เครื่องเขียนใบไม้'][i];
      b.shopSign(name, 3.5, 0.8, x, 3.36, style.arcade ? 4.2 : 2.16,
        { background: wholesale ? [0xd1ab54, 0x9ba9c1, 0x9dbfa9][i % 3] : 0xeee3c6 });
      if (wholesale) for (let n = 0; n < 2; n++) {
        const y = floors === 2 ? 5.25 + n * 1.75 : 5.8 + n * 2.75, z = style.arcade ? 4.32 : 3.22;
        b.box(0.08, 0.08, style.arcade ? 2.25 : 1.15, x + 1.25, y, style.arcade ? 3.17 : 2.64, b.metal);
        b.shopSign(['ขายส่ง', 'ร้านผ้า', 'อะไหล่', 'ของใช้', 'ขนมไทย', 'กระดาษ'][i], 0.65, floors === 2 ? 1.55 : 2.45,
          x + 1.25, y, z, { vertical: true, background: n ? 0xd5b565 : 0x95b2c5, foreground: 0x263e47 });
      }
    }
  });
  if (style.arcade) b.feature('covered-five-foot-way', () => {
    b.colored(colors.trim, () => { b.box(24.4, 0.14, 2.6, 0, 3.98, 3.1, ornament); b.box(24.4, 0.09, 2.6, 0, 0.2, 3.1, ornament); });
    for (let i = 0; i < 6; i++) b.take(b.remap(b.kit.ornaments.arch({ width: 3.85, height: 2.4, seed: b.options.seed, color: colors.trim }),
      ['stucco_ornament'], ornament), -10 + i * 4, 0.22, 4.15);
  });
  else b.feature('canvas-awning-row', () => {
    for (let i = 0; i < 6; i++) b.awning(3.85, 1.7, -10 + i * 4, 3.2, 3.02, i % 2 ? 0x8da8ad : 0xbda66a);
  });
  if (style.waterfront) b.feature('waterfront-plank-walkway', () => {
    for (let i = 0; i < 24; i++) b.colored(colors.trim, () => b.box(0.9, 0.1, 1.4, -11.5 + i, 0.33, 4.15, wall));
    for (const x of [-11.7, 11.7]) b.box(0.1, 1, 0.1, x, 0.75, 4.8, wall);
  });
  b.feature('shopfront-goods', () => {
    for (const x of [-9.7, 10.1]) for (let n = 0; n < 3; n++) b.box(0.7, 0.55, 0.7, x, 0.48 + n * 0.55, 5.3, b.stone);
    if (style.bakery) { b.box(2.4, 0.8, 1.65, -10, 0.6, 4.9, b.stone); b.take(b.kit.bakeryDisplay(), -10, 0.16, 4.9); }
  });
  b.parking(4, b.stone, true);
  // North/east/west timber frames share garden bark; southern arcades need no canvas batch.
  b.gardens(2, 4.8, wall);
  b.remap(b.parts, ['metal_steel'], shutters);
  return { floors, floorSpacing: [4, 3.5], units: 6, wholesale, verticalSigns: wholesale ? 12 : 0,
    horizontalSigns: 6, regionalWall: style.wall, woodenBalconies: style.balcony, coveredArcade: style.arcade,
    stuccoPediments: style.arcade, waterfrontWalkway: style.waterfront, bakery: style.bakery };
}
