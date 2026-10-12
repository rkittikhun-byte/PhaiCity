/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color } from 'three';
import { seededRng } from '../rng.js';
import { tint } from '../materials/library.js';
import { KitBuilder, point } from './geometry.js';
import type { PaletteChoice, RegionStyle, RoofBuilder, RoofForm, RoofOptions } from './contracts.js';

export interface ServiceStyle {
  roofForm: RoofForm;
  ornament: string;
  roof: RoofBuilder;
  palette(kind: 'police' | 'fire', seed?: number): PaletteChoice;
}

/** Applied Thai civic crowns retain the kit's ordinary bargeboards or kalae, never temple ornaments. */
export function serviceStyle(style: RegionStyle, roofs: Readonly<Record<RoofForm, RoofBuilder>>): ServiceStyle {
  const roofForm = style.id === 'south' ? 'hip' : ['central', 'east', 'west'].includes(style.id) ? 'layeredGable' : 'gable';
  return Object.freeze({
    roofForm,
    ornament: roofForm === 'hip' ? 'none' : style.ridgeOrnament,
    roof: (footprint: readonly [number, number], options: RoofOptions = {}) => {
      const parts = roofs[roofForm](footprint, options);
      if (roofForm === 'hip') return parts;
      // Close the civic crown's attic ends; the regional roof builder supplies the edge carving.
      const width = footprint[0] + (options.overhang ?? style.overhang) * 2;
      const depth = footprint[1] + (options.overhang ?? style.overhang) * 2;
      const layered = roofForm === 'layeredGable', w = width * (layered ? 0.73 : 1), d = depth * (layered ? 0.77 : 1);
      const base = (options.baseY ?? 0.2) + (layered ? width * 0.19 : 0), rise = w / 2 * Math.tan((options.pitch ?? style.pitch) * Math.PI / 180);
      const palette = style.palette[Math.floor(seededRng(options.seed ?? 1)() * style.palette.length)];
      const material = tint('wood_painted', options.trimColor ?? palette.trim), b = new KitBuilder();
      for (const side of [-1, 1]) {
        const triangle = [point(-w / 2 + 0.07, base, side * (d / 2 - 0.08)),
          point(w / 2 - 0.07, base, side * (d / 2 - 0.08)), point(0, base + rise - 0.07, side * (d / 2 - 0.08))];
        b.face(side < 0 ? triangle.reverse() : triangle, material);
      }
      return [...parts, ...b.parts];
    },
    palette: (kind: 'police' | 'fire', seed = 1) => {
      const index = Math.floor(seededRng(seed)() * style.palette.length), color = style.palette[index];
      return { ...color,
        wall: new Color(style.plasterColors?.[index] ?? color.wall).lerp(new Color(0xf0e4cf), 0.88).getHex(),
        trim: new Color(color.trim).lerp(new Color(kind === 'police' ? 0x71523c : 0x737d78), 0.82).getHex(),
      };
    },
  });
}
