/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import type { GeometryPart } from '../util/geometry.js';
import { KitBuilder, point } from './geometry.js';
import type { RoofBuilder, RoofForm, RegionStyle, RoofOptions, PartBuilder } from './contracts.js';

export function makeRoof(style: RegionStyle, form: RoofForm, trim: PartBuilder): RoofBuilder {
  return (footprint, options: RoofOptions = {}): GeometryPart[] => {
    const pitch = options.pitch ?? style.pitch, overhang = options.overhang ?? style.overhang;
    if (!footprint.every(n => Number.isFinite(n) && n >= 1) || !Number.isFinite(pitch) || pitch < 5 || pitch > 65 ||
      !Number.isFinite(overhang) || overhang < 0 || overhang > 1.5 || !Number.isFinite(options.baseY ?? 0.2) || (options.baseY ?? 0.2) < 0.2) {
      throw new RangeError('Roof dimensions, base, pitch and overhang are outside supported ranges');
    }
    const b = new KitBuilder(), palette = style.palette[Math.floor(seededRng(options.seed ?? 1)() * style.palette.length)];
    const roofKey = options.material ?? (form === 'flatParapet' ? 'concrete_weathered' :
      style.id === 'south' && form === 'monoPitch' ? 'thatch_nipa' : style.roofMaterial);
    // Bare zinc, cement and leaf thatch retain their natural finish rather than inheriting a glazed-tile color.
    const natural: Partial<Record<typeof roofKey, number>> = { roof_cement_tile: 0x9da4a0, roof_metal_corrugated: 0xaab0b1,
      roof_metal_rusty: 0x986e4d, thatch_grass: 0xbba477, thatch_nipa: 0xa99974 };
    const material = tint(roofKey, options.surfaceColor ?? (form === 'flatParapet' ? 0xbdbbb2 : natural[roofKey] ?? palette.roof)), edge = tint('wood_painted', options.trimColor ?? palette.trim);
    const w = footprint[0] + overhang * 2, d = footprint[1] + overhang * 2, y = options.baseY ?? 0.2;
    const a = pitch * Math.PI / 180;
    const gable = (width: number, depth: number, base: number, angle: number, decorate: boolean): void => {
      const half = width / 2, rise = Math.tan(angle) * half, length = Math.hypot(half, rise);
      for (const side of [-1, 1]) {
        b.box(length, 0.12, depth, side * half / 2, base + rise / 2, 0, material, -side * angle);
        // Lapped wood / broad thatch courses give these finishes a real stepped silhouette.
        if (roofKey === 'roof_wood_shingle' || roofKey.startsWith('thatch')) {
          const rows = Math.min(options.detail === 'low' ? 4 : 8, Math.ceil(length / 0.45));
          for (let i = 0; i < rows; i++) {
            const t = (i + 0.5) / rows;
            b.box(length / rows + 0.07, 0.05, depth, side * half * t, base + rise * (1 - t) + 0.07, 0, material, -side * angle);
          }
        }
      }
      b.box(0.14, 0.14, depth, 0, base + rise + 0.025, 0, material);
      if (decorate && options.ornaments !== false) {
        const pieces = trim({ width, height: rise, depth, seed: options.seed, color: options.trimColor });
        pieces.forEach(part => part.geometry.translate(0, base, 0)); b.parts.push(...pieces);
      }
    };
    if (form === 'gable') gable(w, d, y, a, true);
    else if (form === 'layeredGable') {
      gable(w, d, y, Math.min(a, 0.45), false);
      gable(w * 0.73, d * 0.77, y + w * 0.19, a, true);
    } else if (form === 'hip') {
      const x = w / 2, z = d / 2, rise = Math.min(x, z) * Math.tan(a), ridge = Math.max(0.12, z - x);
      const nw = point(-x, y, -z), ne = point(x, y, -z), se = point(x, y, z), sw = point(-x, y, z);
      const n = point(0, y + rise, -ridge), s = point(0, y + rise, ridge);
      b.panel([sw, s, n, nw], point(-Math.sin(a), Math.cos(a), 0), 0.09, material);
      b.panel([ne, n, s, se], point(Math.sin(a), Math.cos(a), 0), 0.09, material);
      b.panel([nw, n, ne], point(0, Math.cos(a), -Math.sin(a)), 0.09, material);
      b.panel([se, s, sw], point(0, Math.cos(a), Math.sin(a)), 0.09, material);
      b.box(0.13, 0.13, ridge * 2 + 0.15, 0, y + rise, 0, material);
    } else if (form === 'monoPitch') {
      const angle = Math.min(a, 0.45), rise = Math.tan(angle) * w;
      b.box(w / Math.cos(angle), 0.12, d, 0, y + rise / 2, 0, material, angle);
      b.box(0.12, 0.15, d, -w / 2, y, 0, edge);
    } else {
      b.box(w, 0.18, d, 0, y + 0.09, 0, material);
      for (const side of [-1, 1]) {
        b.box(w, 0.45, 0.16, 0, y + 0.4, side * (d / 2 - 0.08), material);
        b.box(0.16, 0.45, d - 0.32, side * (w / 2 - 0.08), y + 0.4, 0, material);
      }
    }
    return b.parts;
  };
}
