/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { CylinderGeometry, LatheGeometry, Vector2 } from 'three';
import { tint } from '../materials/library.js';
import { applyWorldUV } from '../util/geometry.js';
import { seededRng } from '../rng.js';
import { KitBuilder, point } from './geometry.js';
import { makeRoof } from './roofs.js';
import { ornamentBuilder } from './ornaments.js';
import type { PartBuilder, RegionStyle } from './contracts.js';

export function propBuilder(style: RegionStyle, kind: string): PartBuilder {
  return (options = {}) => {
    const b = new KitBuilder(), colors = style.palette[Math.floor(seededRng(options.seed ?? 1)() * style.palette.length)];
    const wood = tint('wood_painted', colors.trim), bamboo = tint('bamboo_split', 0xc7ac75);
    const cloth = tint('fabric_canvas', colors.shutter), clay = tint('roof_glazed_tile', 0x8d5837);
    const dark = tint('metal_steel', 0x42413b);
    const jar = (x: number, z: number, scale = 1): void => {
      const profile = [[0, 0.05], [0.28, 0.05], [0.38, 0.16], [0.49, 0.55], [0.44, 0.85], [0.29, 1.05], [0.29, 1.1], [0.24, 1.1], [0.24, 1.02]];
      const src = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 12).scale(scale, scale, scale).translate(x, 0, z);
      b.add(applyWorldUV(src, 1), clay); src.dispose();
    };
    const roof = (footprint: readonly [number, number], y: number): void => {
      b.parts.push(...makeRoof(style, kind === 'spirit_house' ? 'hip' : style.roofForm,
        ornamentBuilder(style, style.ridgeOrnament))(footprint, { baseY: y, overhang: 0.18, pitch: Math.min(style.pitch, 42), seed: options.seed, ornaments: false }));
    };
    const nets = (): void => {
      for (const x of [-1.35, 1.35]) b.pole(point(x, 0, 0), point(x, 2.2, 0), 0.045, bamboo, 5);
      for (let i = 0; i < 11; i++) b.pole(point(-1.27 + i * 0.254, 0.5, 0.08), point(-1.27 + i * 0.254, 2.05, 0), 0.009, cloth, 3);
      for (let i = 0; i < 8; i++) b.pole(point(-1.27, 0.5 + i * 0.22, 0.08), point(1.27, 0.5 + i * 0.22, 0.08), 0.009, cloth, 3);
      b.pole(point(-1.4, 2.12, 0), point(1.4, 2.12, 0), 0.025, wood, 4);
    };
    if (kind === 'rowing_boat') {
      if (!options.nearWater) return []; // Callers must explicitly confirm a waterside site.
      const a = point(-0.34, 0.16, -1.45), c = point(0.34, 0.16, -1.45), bow = point(0, 0.44, 1.5);
      b.panel([a, c, bow], point(0, 1, 0), 0.06, wood);
      for (const side of [-1, 1]) {
        b.panel([point(side * 0.36, 0.52, -1.4), point(side * 0.43, 0.48, 0.55), bow,
          point(side * 0.3, 0.17, 0.4), point(side * 0.25, 0.18, -1.3)], point(side, 0, 0), 0.05, wood);
      }
      for (const z of [-0.75, 0.3]) b.box(0.75, 0.07, 0.28, 0, 0.47, z, wood);
      b.pole(point(0.85, 0, 1), point(0.85, 0.75, 1), 0.065, bamboo);
      b.tube([point(0, 0.44, 1.45), point(0.45, 0.3, 1.12), point(0.85, 0.58, 1)], 0.017, cloth, 4, 3);
    } else if (kind === 'rice_granary' || kind === 'rice_barn' || kind === 'palm_sugar_shed') {
      const y = kind === 'rice_granary' ? 1.05 : kind === 'rice_barn' ? 0.8 : 0.12;
      for (const x of [-0.8, 0.8]) for (const z of [-0.6, 0.6]) b.box(0.15, y + 1.5, 0.15, x, (y + 1.5) / 2, z, wood);
      b.box(1.85, 0.13, 1.45, 0, y, 0, wood);
      if (kind !== 'palm_sugar_shed') {
        const mat = kind === 'rice_granary' ? wood : bamboo;
        b.box(1.8, 1.4, 0.08, 0, y + 0.75, -0.65, mat);
        for (const x of [-0.86, 0.86]) b.box(0.08, 1.4, 1.35, x, y + 0.75, 0, mat);
        b.box(1.8, 1.4, 0.08, 0, y + 0.75, 0.65, mat);
        b.box(0.55, 0.75, 0.1, 0, y + 0.6, 0.71, wood);
        for (const h of [y + 0.13, y + 1.4]) b.box(1.9, 0.09, 1.5, 0, h, 0, wood);
      } else { jar(-0.5, 0, 0.5); jar(0.5, 0.25, 0.5); }
      roof([2, 1.65], y + 1.5);
    } else if (kind === 'paper_umbrella') {
      b.pole(point(0, 0.06, 0), point(0, 2.55, 0), 0.032, bamboo);
      const src = new CylinderGeometry(0, 1.2, 0.42, 12, 1, true).translate(0, 2.31, 0);
      b.add(applyWorldUV(src, 1), cloth); src.dispose();
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        b.pole(point(0, 2.49, 0), point(Math.cos(a) * 1.17, 2.1, Math.sin(a) * 1.17), 0.012, bamboo, 3);
      }
      b.box(0.65, 0.1, 0.65, 0, 0.06, 0, wood);
    } else if (kind === 'weaving_loom') {
      for (const x of [-0.8, 0.8]) for (const z of [-0.65, 0.65]) b.box(0.09, 1.65, 0.09, x, 0.825, z, wood);
      for (const z of [-0.65, 0.65]) for (const y of [0.4, 1.4]) b.box(1.75, 0.09, 0.09, 0, y, z, wood);
      for (let i = 0; i < 14; i++) b.pole(point(-0.67 + i * 0.103, 1.2, -0.65), point(-0.67 + i * 0.103, 1, 0.65), 0.006, cloth, 3);
      b.box(1.35, 0.025, 0.65, 0, 1.05, 0.45, cloth); b.box(1.5, 0.1, 0.3, 0, 0.55, 0.8, wood);
      for (const x of [-0.45, 0.45]) b.box(0.12, 0.06, 0.9, x, 0.2, 0.15, wood);
    } else if (kind === 'bamboo_daybed') {
      for (const x of [-0.85, 0.85]) for (const z of [-0.45, 0.45]) b.pole(point(x, 0, z), point(x, 0.55, z), 0.055, bamboo);
      for (let i = 0; i < 16; i++) b.pole(point(-0.83 + i * 0.111, 0.6, -0.52), point(-0.83 + i * 0.111, 0.6, 0.52), 0.035, bamboo, 5);
      b.pole(point(-0.9, 0.52, 0), point(0.9, 0.52, 0), 0.045, bamboo);
    } else if (kind === 'dragon_jar') {
      jar(0, 0);
      // A simple curling household-pot relief, with no religious or royal imagery.
      b.tube([point(-0.25, 0.45, 0.42), point(-0.12, 0.65, 0.47), point(0.18, 0.6, 0.47), point(0.26, 0.4, 0.43), point(0.06, 0.3, 0.46)], 0.025, bamboo, 8, 4);
    } else if (kind === 'spirit_house') {
      b.box(0.9, 0.16, 0.9, 0, 0.08, 0, wood); b.box(0.2, 1.2, 0.2, 0, 0.75, 0, wood);
      b.box(0.95, 0.13, 0.8, 0, 1.38, 0, wood);
      for (const x of [-0.35, 0.35]) for (const z of [-0.28, 0.28]) b.box(0.07, 0.55, 0.07, x, 1.68, z, wood);
      roof([1, 1], 1.98); // Unadorned household prop: empty interior, no figures.
    } else if (kind === 'fishing_nets') nets();
    else if (kind === 'fruit_crates') {
      for (const [x, z, y] of [[-0.55, 0, 0.3], [0.55, 0, 0.3], [0, 0.4, 0.8]]) {
        b.box(0.85, 0.07, 0.65, x, y - 0.23, z, wood);
        for (const dz of [-0.3, 0.3]) for (const dy of [-0.1, 0.15]) b.box(0.85, 0.1, 0.06, x, y + dy, z + dz, wood);
        for (const dx of [-0.4, 0.4]) b.box(0.06, 0.48, 0.65, x + dx, y, z, wood);
        for (let i = 0; i < 4; i++) b.ellipsoid(point(x + (i % 2 - 0.5) * 0.32, y + 0.1, z + (Math.floor(i / 2) - 0.5) * 0.26), point(0.14, 0.18, 0.14), bamboo, 6, 4);
      }
    } else if (kind === 'sugar_stove') {
      const stove = tint('concrete_weathered', colors.trim);
      b.box(1.2, 0.7, 1, 0, 0.35, 0, stove);
      b.box(0.48, 0.32, 0.04, 0, 0.24, 0.52, dark);
      const pan = new CylinderGeometry(0.68, 0.58, 0.13, 10).translate(0, 0.77, 0);
      b.add(applyWorldUV(pan, 1), dark); pan.dispose();
      for (const x of [-0.88, 0.88]) b.box(0.09, 1.9, 0.09, x, 0.95, -0.6, wood);
      roof([2.1, 1.65], 1.9);
    } else if (kind === 'palm_sugar_pots') { jar(-0.6, 0, 0.6); jar(0.55, 0, 0.7); jar(0, 0.65, 0.45); }
    else if (kind === 'bamboo_fence') {
      for (let i = 0; i < 18; i++) b.pole(point(-1.5 + i * 3 / 17, 0, 0), point(-1.5 + i * 3 / 17, 1.1, 0), 0.035, bamboo, 5);
      for (const h of [0.35, 0.85]) b.pole(point(-1.6, h, 0.045), point(1.6, h, 0.045), 0.035, bamboo, 5);
    } else if (kind === 'rubber_rack') {
      for (const x of [-1.2, 1.2]) b.box(0.1, 2, 0.1, x, 1, 0, wood);
      for (const h of [0.6, 1.75]) b.box(2.6, 0.08, 0.09, 0, h, 0, wood);
      const rubber = tint('fabric_canvas', 0xbd9060);
      for (let i = 0; i < 4; i++) b.box(0.45, 1.1, 0.035, -0.87 + i * 0.58, 1.17, 0.06, rubber);
    } else if (kind === 'dove_cage_pole') {
      b.pole(point(0, 0, 0), point(0, 4.2, 0), 0.05, bamboo, 6);
      b.pole(point(0, 4.13, 0), point(0.55, 4.13, 0), 0.035, bamboo, 5);
      b.pole(point(0.55, 4.13, 0), point(0.55, 3.85, 0), 0.01, dark, 4);
      const center = point(0.55, 3.4, 0);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, x = Math.cos(a) * 0.28, z = Math.sin(a) * 0.28;
        b.tube([point(center.x + x, 3.13, z), point(center.x + x, 3.62, z), point(center.x, 3.85, 0)], 0.012, bamboo, 4, 3);
      }
      b.box(0.58, 0.04, 0.58, center.x, 3.12, 0, bamboo);
      b.pole(point(0.3, 3.35, 0), point(0.8, 3.35, 0), 0.018, bamboo, 4); // Empty cage and perch, not a bird model.
    } else throw new Error(`Unknown regional prop: ${kind}`);
    return b.parts;
  };
}
