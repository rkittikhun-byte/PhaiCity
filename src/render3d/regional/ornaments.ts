/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import { KitBuilder, point } from './geometry.js';
import type { PartBuilder, RegionStyle } from './contracts.js';

/** Domestic carved boards only. Arches are segmented open bands, not solid cutout imitations. */
export function ornamentBuilder(style: RegionStyle, kind: string): PartBuilder {
  return (options = {}) => {
    const b = new KitBuilder(), w = options.width ?? 3, h = options.height ?? 1.25, d = options.depth ?? 0.15;
    const colors = style.palette[Math.floor(seededRng(options.seed ?? 1)() * style.palette.length)];
    const wood = tint('wood_painted', options.color ?? colors.trim), stucco = tint('stucco_ornament', options.color ?? colors.trim);
    if (kind === 'arch' || kind === 'pediment') {
      const mat = stucco, rise = kind === 'arch' ? w * 0.35 : w * 0.18, base = kind === 'arch' ? h : 0.18;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 12, c = (i + 1) * Math.PI / 12;
        b.pole(point(Math.cos(a) * w / 2, base + Math.sin(a) * rise, 0),
          point(Math.cos(c) * w / 2, base + Math.sin(c) * rise, 0), 0.09, mat, 4);
      }
      if (kind === 'arch') for (const side of [-1, 1]) b.box(0.2, h, 0.23, side * w / 2, h / 2, 0, mat);
      else { b.box(w + 0.24, 0.14, 0.2, 0, 0.1, 0, mat); b.box(0.3, 0.2, 0.22, 0, rise + 0.18, 0, mat); }
    } else if (kind === 'fretwork') {
      b.box(w, 0.12, 0.14, 0, 0.1, 0, wood); b.box(w, 0.12, 0.14, 0, h, 0, wood);
      const columns = Math.max(2, Math.floor(w / (options.detail === 'low' ? 0.72 : 0.38)));
      for (let i = 0; i < columns; i++) {
        const x = (i + 0.5) / columns * w - w / 2, span = w / columns * 0.35;
        for (const side of [-1, 1]) {
          b.pole(point(x, 0.22, 0), point(x + side * span, h / 2, 0), 0.03, wood, options.detail === 'low' ? 3 : 4);
          b.pole(point(x + side * span, h / 2, 0), point(x, h - 0.06, 0), 0.03, wood, options.detail === 'low' ? 3 : 4);
        }
      }
    } else {
      // Gable decorations are repeated at both ends, including north-facing rear.
      for (const z of [-d / 2, d / 2]) {
        for (const side of [-1, 1]) b.pole(point(side * w / 2, 0.12, z), point(0, h + 0.1, z), 0.055, wood, 4);
        if (kind === 'kalae') {
          for (const side of [-1, 1]) {
            b.box(0.16, 1.05, 0.09, side * 0.15, h + 0.23, z, wood, side * -0.53);
            b.box(0.25, 0.2, 0.09, side * 0.4, h + 0.6, z, wood, side * -0.53);
          }
        } else if (kind === 'mon_trim') {
          for (const side of [-1, 1]) b.pole(point(side * w * 0.46, 0.07, z), point(0, h - 0.18, z), 0.06, wood, 4);
          b.box(w * 0.8, 0.12, 0.14, 0, 0.18, z, wood);
        } else if (kind === 'bargeboards' || kind === 'malay_gable') {
          for (let i = 1; i <= 7; i++) {
            const x = (i / 8 - 0.5) * w, y = (1 - Math.abs(x) * 2 / w) * h;
            b.box(0.1, kind === 'malay_gable' ? 0.42 : 0.2, 0.08, x, y, z, wood);
          }
        }
      }
    }
    return b.parts;
  };
}
