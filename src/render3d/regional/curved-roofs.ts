/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import { KitBuilder, point } from './geometry.js';
import type { RegionStyle, RoofBuilder } from './contracts.js';

/** A modern curved canopy; each kit supplies camber, finish and exposed timber edge ribs. */
export function curvedRoofBuilder(style: RegionStyle): RoofBuilder {
  return (footprint, options = {}) => {
    const overhang = options.overhang ?? 0.3, y = options.baseY ?? 4;
    if (!footprint.every(n => Number.isFinite(n) && n >= 1) || !Number.isFinite(y) || y < 0.2 ||
      !Number.isFinite(overhang) || overhang < 0 || overhang > 1.5) throw new RangeError('Curved roof dimensions are outside supported ranges');
    const b = new KitBuilder(), c = style.palette[Math.floor(seededRng(options.seed)() * style.palette.length)];
    const roof = tint(options.material ?? style.roofMaterial, options.surfaceColor ?? c.roof), edge = tint('wood_painted', options.trimColor ?? c.trim);
    const w = footprint[0] + overhang * 2, d = footprint[1] + overhang * 2;
    const camber = { north: 0.19, northeast: 0.10, central: 0.15, east: 0.12, west: 0.21, south: 0.085 }[style.id] * w;
    for (let i = 0; i < 12; i++) {
      const a = i / 12, z = (i + 1) / 12, x1 = (a - 0.5) * w, x2 = (z - 0.5) * w;
      const y1 = y + Math.sin(a * Math.PI) * camber, y2 = y + Math.sin(z * Math.PI) * camber;
      b.panel([point(x1, y1, d / 2), point(x2, y2, d / 2), point(x2, y2, -d / 2), point(x1, y1, -d / 2)],
        point(-(y2 - y1) / (x2 - x1), 1, 0).normalize(), 0.09, roof);
      for (const side of [-1, 1]) b.pole(point(x1, y1 - 0.04, side * d / 2), point(x2, y2 - 0.04, side * d / 2), 0.055, edge, 4);
    }
    return b.parts;
  };
}
