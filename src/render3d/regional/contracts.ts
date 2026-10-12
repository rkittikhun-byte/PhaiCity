/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { MaterialKey } from '../materials/library.js';
import type { GeometryPart } from '../util/geometry.js';
import type { RegionId } from './types.js';
import type { vegetationMix } from './vegetation.js';
import type { HouseStyle, HouseStyleId } from './house-styles.js';
import type { GardenPlantBuilder } from './garden-plants.js';
import type { CommunityHouseBuilder, ZoneStyle } from './residential-parts.js';
import type { CommercialStyle } from './commercial-parts.js';

export const ROOF_FORMS = ['gable', 'layeredGable', 'hip', 'monoPitch', 'flatParapet'] as const;
export type RoofForm = typeof ROOF_FORMS[number];
export const WALL_FORMS = ['slidingVents', 'paneled', 'splitBamboo', 'louvered', 'plaster'] as const;
export type WallForm = typeof WALL_FORMS[number];
export interface PaletteChoice { wall: number; trim: number; shutter: number; roof: number }
export interface RegionalPalette {
  wall: readonly number[]; trim: readonly number[]; shutter: readonly number[]; roof: readonly number[];
  /** Modern R2 plaster finishes share the same eight coordinated trim / shutter / roof choices. */
  plaster: readonly number[];
  pick(seed?: number, finish?: 'default' | 'plaster'): PaletteChoice;
}
export interface PartOptions { seed?: number; nearWater?: boolean; width?: number; height?: number; depth?: number; detail?: 'low' | 'full'; color?: number }
export type PartBuilder = (options?: PartOptions) => GeometryPart[];
export interface RoofOptions { baseY?: number; pitch?: number; overhang?: number; seed?: number; ornaments?: boolean; material?: MaterialKey; trimColor?: number; surfaceColor?: number; detail?: 'low' | 'full' }
/** Width/depth in metres, centered on X/Z. baseY is the top of the support walls. */
export type RoofBuilder = (footprint: readonly [number, number], options?: RoofOptions) => GeometryPart[];
export interface RegionStyle {
  id: RegionId; label: string; labelEn: string;
  roofForm: RoofForm; pitch: number; overhang: number; ridgeOrnament: string; roofMaterial: MaterialKey;
  wallForm: WallForm; wallMaterial: MaterialKey; raisedFloor: number;
  palette: readonly PaletteChoice[];
  plasterColors?: readonly number[];
  props: readonly string[]; ornaments: readonly string[];
}
export interface RegionKit {
  id: RegionId; label: string; labelEn: string;
  defaults: Readonly<Omit<RegionStyle, 'palette' | 'plasterColors' | 'props' | 'ornaments' | 'label' | 'labelEn'>>;
  roofs: Readonly<Record<RoofForm, RoofBuilder>>;
  palette: RegionalPalette;
  ornaments: Readonly<Record<string, PartBuilder>>;
  walls: Readonly<Record<WallForm, PartBuilder>>;
  props: Readonly<Record<string, PartBuilder>>;
  vegetation: ReturnType<typeof vegetationMix>;
  houses: Readonly<Record<HouseStyleId, HouseStyle>>;
  gardenPlant: GardenPlantBuilder;
  bigGardenTree: GardenPlantBuilder;
  modernHouseProp: string;
  housePalette(style: HouseStyleId, seed?: number): PaletteChoice;
  zoneStyle: ZoneStyle;
  communityHouse: CommunityHouseBuilder;
  neutralPalette(seed?: number): PaletteChoice;
  civicPalette(seed?: number): PaletteChoice;
  commercial: CommercialStyle;
  marketStall: PartBuilder;
  marketGoods: PartBuilder;
  bakeryDisplay: PartBuilder;
  curvedRoof: RoofBuilder;
}
