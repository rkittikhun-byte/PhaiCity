/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { MaterialKey } from '../materials/library.js';
import type { RegionStyle, RoofForm, WallForm } from './contracts.js';

export const HOUSE_STYLE_IDS = ['shack', 'stilt', 'mixed', 'concrete', 'traditional', 'heritage'] as const;
export type HouseStyleId = typeof HOUSE_STYLE_IDS[number];
export interface HouseProp { kind: string; x: number; z: number; scale: number; y?: number }
export interface HouseStyle {
  width: number; depth: number; floor: number; storeys: number;
  roof: RoofForm; roofMaterial: MaterialKey; wall: WallForm; wallMaterial: MaterialKey;
  finish: 'default' | 'plaster'; wallColor?: number; shutterColor?: number; trimColor?: number;
  props: readonly HouseProp[]; plants: readonly string[];
  balcony?: 'fretwork' | 'open'; openGround?: boolean; wrapVeranda?: boolean;
  layeredHip?: boolean; cluster?: boolean; laundry?: boolean; hedge?: boolean;
  arches?: boolean; pediments?: boolean; ventPanel?: boolean; fretEaves?: boolean;
  terraceDrop?: number; postMaterial?: MaterialKey; grilleFence?: boolean; windowFret?: boolean; malayGable?: boolean;
}

/** Prompt 7's regional cells live beside the kits, never in the building factory. */
export function houseStyles(s: RegionStyle): Readonly<Record<HouseStyleId, HouseStyle>> {
  const prop = (kind: string, x = -3.25, z = 1.9, scale = 0.5, y = 0.08): HouseProp => ({ kind, x, z, scale, y });
  const base: HouseStyle = { width: 4.8, depth: 3.8, floor: s.raisedFloor, storeys: 1,
    roof: s.roofForm, roofMaterial: s.roofMaterial, wall: s.wallForm, wallMaterial: s.wallMaterial,
    finish: 'default', props: [], plants: ['mango'], balcony: 'open' };
  const shack: HouseStyle = { ...base, width: 3.9, depth: 3.3, floor: 0.55, roof: 'gable', roofMaterial: 'roof_metal_rusty', wall: 'paneled', wallMaterial: 'wood_painted' };
  const stilt: HouseStyle = { ...base, floor: 1.8, roofMaterial: 'roof_clay_tile', props: [] };
  const mixed: HouseStyle = { ...base, floor: 0.15, storeys: 2, roofMaterial: 'roof_clay_tile' };
  const concrete: HouseStyle = { ...base, width: 5.1, depth: 4.1, floor: 0.16, wall: 'plaster', wallMaterial: 'plaster_tint', finish: 'plaster', balcony: undefined };
  const traditional: HouseStyle = { ...base, width: 5.4, depth: 4.1, floor: 1.2, roofMaterial: 'roof_clay_tile' };
  const heritage: HouseStyle = { ...base, width: 5.6, depth: 4.2, floor: 0.15, storeys: 2, wall: 'plaster', wallMaterial: 'plaster_tint', finish: 'plaster', roof: 'hip', roofMaterial: 'roof_clay_tile', balcony: 'open' };
  switch (s.id) {
    case 'north':
      Object.assign(shack, { wall: 'splitBamboo', wallMaterial: 'bamboo_split', roofMaterial: 'thatch_grass' });
      Object.assign(stilt, { floor: 2.1, wall: 'slidingVents', wallMaterial: 'wood_teak', roof: 'gable', props: [prop('rice_granary', -3.2, 1.85, 0.48)] });
      Object.assign(mixed, { wall: 'slidingVents', wallMaterial: 'wood_teak', roof: 'gable' });
      Object.assign(concrete, { wallColor: 0xf2ebda, roofMaterial: 'roof_clay_tile', ventPanel: true, windowFret: true });
      Object.assign(traditional, { floor: 1.4, wall: 'slidingVents', wallMaterial: 'wood_teak', props: [prop('paper_umbrella', -3.25, 2.4, 0.55)] });
      Object.assign(heritage, { wall: 'paneled', wallMaterial: 'wood_teak', finish: 'default', wrapVeranda: true, layeredHip: true });
      break;
    case 'northeast':
      Object.assign(shack, { roofMaterial: 'roof_metal_corrugated', props: [prop('rice_barn', -3.15, 0.6, 0.52)] });
      Object.assign(stilt, { floor: 2.25, terraceDrop: 0.42, roofMaterial: 'roof_metal_corrugated', props: [prop('weaving_loom', 0.7, -0.5, 0.85), prop('rice_barn', -3.3, 1.8, 0.5)] });
      Object.assign(mixed, { openGround: true, roofMaterial: 'roof_metal_corrugated', props: [prop('bamboo_daybed', -2.9, 2.15, 0.6), prop('dragon_jar', 3.25, 2.2, 0.65)] });
      Object.assign(concrete, { grilleFence: true, roofMaterial: 'roof_metal_corrugated', props: [prop('bamboo_daybed', -3.2, 2.45, 0.5)] });
      Object.assign(traditional, { floor: 2.3, terraceDrop: 0.42, roofMaterial: 'roof_metal_corrugated', props: [prop('bamboo_daybed', 0, -0.55, 0.9), prop('weaving_loom', -1.35, -0.5, 0.65)] });
      Object.assign(heritage, { wallColor: 0xe7cb78, roof: 'gable', ventPanel: true });
      break;
    case 'central':
      Object.assign(shack, { floor: 1.2, props: [prop('dragon_jar', -2.7, 2.05, 0.72), prop('dragon_jar', 2.7, 2.05, 0.72)], laundry: true });
      Object.assign(stilt, { floor: 1.55, roof: 'gable', wall: 'paneled', wallMaterial: 'wood_teak', props: [prop('dragon_jar', -3.2, 2.05, 0.75)] });
      Object.assign(mixed, { roofMaterial: 'roof_cement_tile', wall: 'paneled', wallMaterial: 'wood_teak' });
      Object.assign(concrete, { roofMaterial: 'roof_glazed_tile', hedge: true, props: [prop('spirit_house', -3.15, 2.5, 0.6)] });
      Object.assign(traditional, { cluster: true, width: 5.8, floor: 1.4, wall: 'paneled', wallMaterial: 'wood_teak', props: [prop('dragon_jar', -3.3, 2.6, 0.65)] });
      Object.assign(heritage, { roof: 'gable', wallColor: 0xf0eedd, shutterColor: 0x376e54, trimColor: 0x376e54, fretEaves: true, balcony: 'fretwork' });
      break;
    case 'east':
      Object.assign(shack, { floor: 1.65, props: [prop('fishing_nets', -2.6, 2.5, 0.75)], plants: ['mango'] });
      Object.assign(stilt, { floor: 1.9, roof: 'gable', roofMaterial: 'roof_glazed_tile', balcony: 'fretwork', shutterColor: 0x397eaa });
      Object.assign(mixed, { roofMaterial: 'roof_glazed_tile', wallColor: 0x6b9eaf, balcony: 'fretwork' });
      Object.assign(concrete, { wallColor: 0xb0d8e3, plants: ['durian', 'mangosteen'] });
      Object.assign(traditional, { floor: 1.8, roof: 'gable', roofMaterial: 'roof_glazed_tile', balcony: 'fretwork', props: [prop('fishing_nets', -3.25, 2.5, 0.55)] });
      Object.assign(heritage, { floor: 0.65, wall: 'paneled', wallMaterial: 'wood_painted', finish: 'default', roof: 'gable', roofMaterial: 'roof_glazed_tile', balcony: 'fretwork', pediments: true });
      break;
    case 'west':
      Object.assign(shack, { roofMaterial: 'thatch_grass', wall: 'splitBamboo', wallMaterial: 'bamboo_split', plants: ['bamboo'] });
      Object.assign(stilt, { roof: 'layeredGable', roofMaterial: 'roof_clay_tile', wall: 'paneled', wallMaterial: 'wood_painted' });
      Object.assign(mixed, { roof: 'layeredGable', roofMaterial: 'roof_clay_tile', wall: 'paneled', wallMaterial: 'wood_painted', plants: ['sugar_palm'] });
      Object.assign(concrete, { wallColor: 0xe5d6ac, roofMaterial: 'roof_cement_tile', props: [prop('sugar_stove', -3.2, 2.2, 0.65)] });
      Object.assign(traditional, { roof: 'layeredGable', wall: 'paneled', wallMaterial: 'wood_painted', plants: ['bamboo', 'bamboo'] });
      Object.assign(heritage, { wallColor: 0x345c46, roof: 'gable', fretEaves: true, balcony: 'fretwork', plants: ['sugar_palm', 'sugar_palm', 'sugar_palm'] });
      break;
    case 'south':
      Object.assign(shack, { roof: 'gable', roofMaterial: 'thatch_nipa', wall: 'paneled', wallMaterial: 'wood_painted', props: [prop('rubber_rack', -3.05, 2.5, 0.65)] });
      Object.assign(stilt, { floor: 0.55, postMaterial: 'concrete_raw', wall: 'paneled', wallMaterial: 'wood_painted', roof: 'hip', props: [prop('dove_cage_pole', -3.5, 2.15, 0.85)] });
      Object.assign(mixed, { wall: 'louvered', wallMaterial: 'wood_painted', roof: 'hip', props: [prop('rubber_rack', 0, -3.6, 0.7)] });
      Object.assign(concrete, { roof: 'hip', plants: ['coconut', 'coconut'], props: [prop('dove_cage_pole', -3.6, 0, 0.9)] });
      Object.assign(traditional, { floor: 0.5, roof: 'hip', width: 5.8, wall: 'louvered', wallMaterial: 'wood_painted', ventPanel: true, malayGable: true });
      Object.assign(heritage, { roof: 'hip', arches: true, pediments: true, ventPanel: true });
      break;
  }
  return Object.freeze({ shack: Object.freeze(shack), stilt: Object.freeze(stilt), mixed: Object.freeze(mixed),
    concrete: Object.freeze(concrete), traditional: Object.freeze(traditional), heritage: Object.freeze(heritage) });
}
