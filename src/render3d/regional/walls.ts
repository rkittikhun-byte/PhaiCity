/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import { KitBuilder } from './geometry.js';
import type { PartBuilder, RegionStyle, WallForm } from './contracts.js';

export function wallBuilder(style: RegionStyle, kind: WallForm): PartBuilder {
  return (options = {}) => {
    const w = options.width ?? 3, h = options.height ?? 2.4;
    if (!Number.isFinite(w) || w <= 0.3 || w > 59 || !Number.isFinite(h) || h <= 0.3 || h > 12) {
      throw new RangeError('Wall width must be 0.3–59 m; height must be 0.3–12 m');
    }
    const b = new KitBuilder(), choice = Math.floor(seededRng(options.seed ?? 1)() * style.palette.length), colors = style.palette[choice];
    const wood = tint('wood_painted', colors.trim), face = tint(kind === 'splitBamboo' ? 'bamboo_split' : kind === 'plaster' ? 'plaster_tint' :
      kind !== 'louvered' && ['north', 'central'].includes(style.id) ? 'wood_teak' : 'wood_painted', kind === 'louvered' ? colors.shutter :
      kind === 'plaster' ? style.plasterColors?.[choice] ?? colors.wall : colors.wall);
    if (kind === 'plaster') b.box(w, h, 0.18, 0, h / 2, 0, face);
    else if (kind === 'splitBamboo') {
      const n = Math.ceil(w / 0.24);
      for (let i = 0; i < n; i++) b.box(w / n - 0.01, h, 0.07, (i + 0.5) * w / n - w / 2, h / 2, 0, face);
      for (const y of [0.15, h * 0.5, h - 0.15]) b.box(w, 0.08, 0.11, 0, y, 0.05, wood);
    } else if (kind === 'louvered' || kind === 'slidingVents') {
      const slats = Math.ceil(h / (options.detail === 'low' ? 0.45 : 0.24)), panels = kind === 'slidingVents' ? 2 : 1;
      for (let j = 0; j < panels; j++) for (let i = 0; i < slats; i++) {
        b.box(w / panels - 0.12, h / slats * 0.72, 0.12, (j + 0.5) * w / panels - w / 2,
          (i + 0.5) * h / slats, j === 1 ? 0.05 : 0, face);
      }
      for (const y of [0.06, h - 0.06]) b.box(w, 0.12, 0.17, 0, y, 0, wood);
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05, ...(panels === 2 ? [0] : [])]) b.box(0.1, h, 0.17, x, h / 2, 0, wood);
      if (panels === 2) b.box(w, 0.07, 0.24, 0, h + 0.035, 0, wood); // Sliding track above two offset vent panels.
    } else {
      b.box(w, h, 0.12, 0, h / 2, -0.04, face);
      const n = Math.max(2, Math.round(w / 0.7));
      for (let i = 0; i <= n; i++) b.box(0.065, h, 0.12, i * w / n - w / 2, h / 2, 0.07, wood);
      for (const y of [0.05, h / 2, h - 0.05]) b.box(w, 0.075, 0.12, 0, y, 0.07, wood);
    }
    return b.parts;
  };
}
