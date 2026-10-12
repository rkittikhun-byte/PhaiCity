/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { tint } from '../materials/library.js';
import { seededRng } from '../rng.js';
import { KitBuilder } from './geometry.js';
import { makeRoof } from './roofs.js';
import { ornamentBuilder } from './ornaments.js';
import { wallBuilder } from './walls.js';
import type { GeometryPart } from '../util/geometry.js';
import type { MaterialKey } from '../materials/library.js';
import type { HouseStyle } from './house-styles.js';
import type { RegionStyle, RoofForm, WallForm } from './contracts.js';

export interface ZoneStyle {
  timber: MaterialKey; rowWall: MaterialKey; rowRoof: RoofForm; rowRoofMaterial: MaterialKey; rowPanel: WallForm;
  rowOrnaments: boolean; rowFretwork: boolean; arcade: boolean; canalCommunity: boolean;
}
export interface CommunityHouseOptions { seed?: number; twoStoreys?: boolean }
export type CommunityHouseBuilder = (kind: 'shack' | 'stilt', options?: CommunityHouseOptions) => GeometryPart[];

export function zoneStyle(style: RegionStyle): ZoneStyle {
  const timber: MaterialKey = ['north', 'central'].includes(style.id) ? 'wood_teak' : 'wood_painted';
  return Object.freeze({ timber, rowWall: style.id === 'south' ? 'plaster_tint' : timber,
    rowRoof: style.id === 'south' ? 'hip' : 'gable', rowRoofMaterial: style.id === 'north' ? 'roof_wood_shingle' :
      style.id === 'south' ? 'roof_clay_tile' : 'roof_metal_rusty',
    rowPanel: style.id === 'north' ? 'slidingVents' : style.id === 'south' ? 'plaster' : 'paneled',
    rowOrnaments: style.id === 'north' || style.id === 'central', rowFretwork: style.id === 'east',
    arcade: style.id === 'south', canalCommunity: style.id === 'central' || style.id === 'east' });
}

/** Reduced Prompt 7 shack / stilt components for an entire nine-house community budget. */
export function communityHouseParts(style: RegionStyle, profile: HouseStyle, options: CommunityHouseOptions = {}): GeometryPart[] {
  const color = style.palette[Math.floor(seededRng(options.seed ?? 1)() * style.palette.length)], b = new KitBuilder();
  const wood = tint(zoneStyle(style).timber, color.wall), face = profile.wallMaterial === 'bamboo_split' ? tint('bamboo_split', color.wall) : wood;
  const w = 3.7, d = 4.3, floor = options.twoStoreys ? 3 : Math.min(profile.floor, 1.5), y = floor + 0.14;
  b.box(w, 0.15, d, 0, y, 0, wood);
  for (const x of [-1.68, 1.68]) for (const z of [-1.95, 1.95]) b.box(0.13, y, 0.13, x, y / 2, z, wood);
  if (options.twoStoreys) b.box(w, 2.8, d, 0, 1.55, 0, wood);
  b.box(w, 2.65, d, 0, y + 1.33, 0, face);
  const panel = wallBuilder(style, profile.wall)({ seed: options.seed, width: w - 0.2, height: 2.65, detail: 'low' });
  panel.forEach(p => { p.material = p.material.userData.materialKey === 'bamboo_split' ? face : wood; p.geometry.translate(0, y, d / 2 + 0.03); });
  b.parts.push(...panel);
  for (const x of [-1.12, 1.12]) { b.box(0.75, 0.94, 0.07, x, y + 1.55, d / 2 + 0.18, wood); b.box(0.86, 0.08, 0.16, x, y + 1.05, d / 2 + 0.22, face); }
  b.box(0.7, 1.95, 0.09, 0, y + 1, d / 2 + 0.13, wood);
  b.box(2.6, 0.12, 0.65, 0, y, d / 2 + 0.42, wood);
  const top = y + 2.65;
  b.parts.push(...makeRoof(style, profile.roof, ornamentBuilder(style, style.ridgeOrnament))([w, d],
    { baseY: top, pitch: options.twoStoreys ? 10 : Math.min(style.pitch, 28), overhang: 0.18, seed: options.seed, material: profile.roofMaterial, ornaments: false, detail: 'low' }));
  return b.parts;
}
