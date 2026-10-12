/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color } from 'three';
import { tint } from '../materials/library.js';
import type { MaterialKey } from '../materials/library.js';
import type { GeometryPart } from '../util/geometry.js';
import { KitBuilder, point } from './geometry.js';
import type { RegionId } from './types.js';
import type { RegionStyle, RoofBuilder, RoofForm } from './contracts.js';

export interface IndustrialHall { width: number; depth: number; height: number; x: number; z: number; roof: RoofForm; pitch: number }
export interface TraditionalIndustry {
  kind: string; label: string; wall: MaterialKey; roof: MaterialKey; halls: readonly IndustrialHall[]; prop?: string;
}
export interface IndustrialKit {
  traditional: Readonly<Record<0 | 2, TraditionalIndustry>>;
  hall(size: 0 | 2, seed?: number): GeometryPart[];
}
const hall = (width: number, depth: number, height: number, x: number, z: number, roof: RoofForm = 'gable', pitch = 24): IndustrialHall =>
  ({ width, depth, height, x, z, roof, pitch });
const rice: TraditionalIndustry = { kind: 'rice-mill', label: 'โรงสีข้าวลานทุ่ง', wall: 'wood_painted', roof: 'roof_metal_rusty',
  halls: [hall(11, 14, 11, 3, -3, 'gable', 28), hall(6, 9, 4, -6, 1, 'monoPitch', 12)], prop: 'dragon_jar' };
const sugar: TraditionalIndustry = { kind: 'sugar-mill', label: 'โรงงานน้ำตาลลานอ้อย', wall: 'concrete_weathered', roof: 'roof_metal_rusty',
  halls: [hall(17, 13, 8, -3, -4, 'gable', 18), hall(5, 8, 4, 9, 4, 'monoPitch', 10)] };
const styles: Record<RegionId, Readonly<Record<0 | 2, TraditionalIndustry>>> = {
  north: {
    0: { kind: 'tobacco-barns', label: 'โรงบ่มใบยาสูบลานเหนือ', wall: 'brick_red', roof: 'roof_clay_tile',
      halls: [hall(7, 13, 10, -3.8, -2, 'gable', 35), hall(7, 13, 10, 4.6, -2, 'gable', 35)], prop: 'rice_granary' },
    2: { kind: 'longan-kilns', label: 'โรงอบลำไยบ้านสวน', wall: 'brick_red', roof: 'roof_metal_corrugated',
      halls: [hall(6, 16, 5.8, -7, -2, 'gable', 30), hall(6, 16, 5.8, 0, -2, 'gable', 30)], prop: 'rice_granary' },
  },
  northeast: { 0: { ...rice, prop: 'rice_barn' }, 2: sugar }, central: { 0: rice, 2: sugar },
  east: {
    0: { kind: 'fish-sauce', label: 'โรงน้ำปลาลานทะเล', wall: 'plaster_tint', roof: 'roof_cement_tile',
      halls: [hall(18, 9, 5.5, 1, -6, 'hip', 23)], prop: 'fishing_nets' },
    2: { kind: 'seafood-canning', label: 'โรงแปรรูปอาหารทะเลบ้านอ่าว', wall: 'plaster_tint', roof: 'roof_cement_tile',
      halls: [hall(20, 13, 7, -1, -4, 'hip', 18), hall(7, 5, 3.5, -8, 7, 'monoPitch', 12)], prop: 'fruit_crates' },
  },
  west: {
    0: { kind: 'palm-sugar-sheds', label: 'โรงเคี่ยวน้ำตาลบ้านตาล', wall: 'wood_painted', roof: 'roof_metal_rusty',
      halls: [hall(7, 12, 3.8, -3.5, -3, 'layeredGable', 28), hall(7, 12, 3.8, 5, -3, 'gable', 28)], prop: 'palm_sugar_pots' },
    2: { ...sugar, prop: 'palm_sugar_pots' },
  },
  south: {
    0: { kind: 'rubber-smoking-house', label: 'โรงรมยางลานใต้', wall: 'wood_painted', roof: 'roof_cement_tile',
      halls: [hall(20, 10, 6.5, 1, -5, 'hip', 28)], prop: 'rubber_rack' },
    2: { kind: 'palm-oil-mill', label: 'โรงน้ำมันปาล์มบ้านสวน', wall: 'concrete_weathered', roof: 'roof_metal_sheet',
      halls: [hall(18, 12, 8.5, -2, -4, 'gable', 18), hall(6, 5, 4, -8, 7, 'monoPitch', 12)], prop: 'rubber_rack' },
  },
};

/** Industrial vernacular stays in the kit; factories only supply equipment and yards. */
export function makeIndustrialKit(style: RegionStyle, roofs: Readonly<Record<RoofForm, RoofBuilder>>): IndustrialKit {
  const traditional = styles[style.id];
  return { traditional, hall(size, seed = 1) {
    const spec = traditional[size], palette = style.palette[(seed >>> 0) % style.palette.length], b = new KitBuilder();
    const wall = tint(spec.wall, spec.wall === 'brick_red' ? 0xb56e4d : spec.wall === 'plaster_tint' ? 0xd7daca :
      new Color(palette.wall).lerp(new Color(0x8b7659), 0.78).getHex());
    const timber = tint('wood_painted', new Color(palette.trim).lerp(new Color(0x615948), 0.65).getHex());
    for (const h of spec.halls) {
      const base = 0.18, top = base + h.height;
      b.box(h.width, 0.14, h.depth, h.x, 0.14, h.z, tint('concrete_raw', 0xa8a496));
      if (spec.kind === 'palm-sugar-sheds') {
        for (const dx of [-h.width / 2 + 0.16, h.width / 2 - 0.16]) for (const dz of [-h.depth / 2 + 0.18, 0, h.depth / 2 - 0.18])
          b.box(0.24, h.height, 0.24, h.x + dx, base + h.height / 2, h.z + dz, timber);
        b.box(h.width, h.height * 0.45, 0.12, h.x, base + h.height * 0.225, h.z - h.depth / 2, wall);
      } else {
        for (const side of [-1, 1]) b.box(0.2, h.height, h.depth, h.x + side * (h.width / 2 - 0.1), base + h.height / 2, h.z, wall);
        b.box(h.width, h.height, 0.18, h.x, base + h.height / 2, h.z - h.depth / 2 + 0.09, wall);
        // A real open loading aperture, rather than a dark rectangle on a solid wall.
        const door = Math.min(3.7, h.width * 0.55), doorH = Math.min(3.6, h.height * 0.7), flank = (h.width - door) / 2;
        for (const side of [-1, 1]) b.box(flank, h.height, 0.18, h.x + side * (door + flank) / 2, base + h.height / 2, h.z + h.depth / 2 - 0.09, wall);
        b.box(door, h.height - doorH, 0.18, h.x, base + doorH + (h.height - doorH) / 2, h.z + h.depth / 2 - 0.09, wall);
        // Broad timber louvers and buttresses read at the gameplay camera height.
        for (let i = 0; i < 3; i++) b.box(h.width * 0.7, 0.18, 0.23, h.x, top - 0.65 - i * 0.3, h.z + h.depth / 2 + 0.04, timber);
        if (spec.wall === 'brick_red') for (const dx of [-h.width / 2, h.width / 2])
          b.box(0.45, h.height, 0.6, h.x + dx, base + h.height / 2, h.z - 1, wall);
      }
      const pieces = roofs[h.roof]([h.width, h.depth], { baseY: top, pitch: h.pitch, overhang: 0.25,
        material: spec.roof, ...(spec.roof === 'roof_metal_sheet' ? { surfaceColor: 0xa4b3ad } : {}), seed, ornaments: false, detail: 'low' });
      pieces.forEach(p => p.geometry.translate(h.x, 0, h.z)); b.parts.push(...pieces);
      if (h.roof === 'gable') for (const z of [h.z - h.depth / 2, h.z + h.depth / 2]) {
        const rise = Math.tan(h.pitch * Math.PI / 180) * h.width / 2;
        b.face([point(h.x - h.width / 2, top, z), point(h.x + h.width / 2, top, z), point(h.x, top + rise, z)], wall);
        b.face([point(h.x + h.width / 2, top, z), point(h.x - h.width / 2, top, z), point(h.x, top + rise, z)], wall);
      }
    }
    return b.parts;
  } };
}
