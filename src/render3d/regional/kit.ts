/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color } from 'three';
import { seededRng } from '../rng.js';
import { vegetationMix } from './vegetation.js';
import { ROOF_FORMS, WALL_FORMS, PaletteChoice, RegionKit, RegionStyle, RoofBuilder, PartBuilder, WallForm, RoofForm } from './contracts.js';
import { makeRoof } from './roofs.js';
import { ornamentBuilder } from './ornaments.js';
import { wallBuilder } from './walls.js';
import { propBuilder } from './props.js';
import { houseStyles, HouseStyleId } from './house-styles.js';
import { gardenPlantBuilder } from './garden-plants.js';
import { communityHouseParts, CommunityHouseOptions, zoneStyle } from './residential-parts.js';
import { commercialStyle, marketStallParts, marketGoodsParts, bakeryDisplayParts } from './commercial-parts.js';
import { curvedRoofBuilder } from './curved-roofs.js';
import { bigGardenTreeBuilder } from './big-garden-trees.js';
import { makeIndustrialKit } from './industrial-parts.js';
import { serviceStyle } from './service-style.js';

/** Eight coordinated choices per region; shade changes never change a building's shape. */
export function regionalPalette(walls: readonly number[], trim: number, shutter: number, roof: number): readonly PaletteChoice[] {
  if (walls.length !== 8) throw new Error('Region palettes require eight choices');
  const shade = (color: number, i: number): number => new Color(color).offsetHSL(0, 0, (i - 3.5) * 0.014).getHex();
  return Object.freeze(walls.map((wall, i) => Object.freeze({ wall, trim: shade(trim, i), shutter: shade(shutter, i), roof: shade(roof, i) })));
}

export function makeKit(style: RegionStyle): RegionKit {
  const plaster = style.palette.map((color, i) => Object.freeze({ ...color, wall: style.plasterColors?.[i] ?? color.wall }));
  const pick = (seed = 1, finish: 'default' | 'plaster' = 'default'): PaletteChoice =>
    (finish === 'plaster' ? plaster : style.palette)[Math.floor(seededRng(seed)() * style.palette.length)];
  const { palette: choices, plasterColors: _plasterColors, props, ornaments, label, labelEn, ...defaults } = style;
  const houses = houseStyles(style);
  const roofs = Object.freeze(Object.fromEntries(ROOF_FORMS.map(form => [form, makeRoof(style, form,
    ornamentBuilder(style, style.ridgeOrnament))])) as Record<RoofForm, RoofBuilder>);
  return Object.freeze({ id: style.id, label, labelEn, defaults: Object.freeze(defaults),
    palette: Object.freeze({ wall: choices.map(c => c.wall), trim: choices.map(c => c.trim),
      shutter: choices.map(c => c.shutter), roof: choices.map(c => c.roof), plaster: plaster.map(c => c.wall), pick }),
    roofs,
    industrial: makeIndustrialKit(style, roofs),
    services: serviceStyle(style, roofs),
    walls: Object.freeze(Object.fromEntries(WALL_FORMS.map(form => [form, wallBuilder(style, form)])) as Record<WallForm, PartBuilder>),
    ornaments: Object.freeze(Object.fromEntries([...new Set([...ornaments, 'fretwork', ...(style.id === 'east' ? ['pediment'] : [])])].map(kind => [kind, ornamentBuilder(style, kind)]))),
    props: Object.freeze(Object.fromEntries([...new Set([...props, 'dragon_jar', ...(style.id === 'west' ? ['sugar_stove'] : [])])].map(kind => [kind, propBuilder(style, kind)]))),
    vegetation: vegetationMix(style.id),
    houses, gardenPlant: gardenPlantBuilder(style), bigGardenTree: bigGardenTreeBuilder(style),
    housePalette: (kind: HouseStyleId, seed = 1) => {
      const house = houses[kind], palette = pick(seed, house.finish);
      const shift = (value: number): number => new Color(value).offsetHSL(0, 0, (seededRng(seed)() - 0.5) * 0.035).getHex();
      return { ...palette, wall: house.wallColor === undefined ? palette.wall : shift(house.wallColor),
        trim: house.trimColor === undefined ? palette.trim : shift(house.trimColor),
        shutter: house.shutterColor === undefined ? palette.shutter : shift(house.shutterColor) };
    },
    modernHouseProp: { north: 'paper_umbrella', northeast: 'bamboo_daybed', central: 'dragon_jar', east: 'fishing_nets', west: 'palm_sugar_pots', south: 'rubber_rack' }[style.id],
    zoneStyle: zoneStyle(style),
    commercial: commercialStyle(style), marketStall: (options = {}) => marketStallParts(style, options),
    marketGoods: (options = {}) => marketGoodsParts(style, options),
    bakeryDisplay: () => bakeryDisplayParts(style),
    curvedRoof: curvedRoofBuilder(style),
    communityHouse: (kind: 'shack' | 'stilt', options: CommunityHouseOptions = {}) => communityHouseParts(style, houses[kind], options),
    neutralPalette: (seed = 1) => {
      const color = pick(seed, 'plaster');
      return { ...color, wall: new Color(color.wall).lerp(new Color(0xf0efea), 0.93).getHex(), trim: new Color(color.trim).lerp(new Color(0x7c8384), 0.92).getHex() };
    },
    civicPalette: (seed = 1) => {
      const color = pick(seed, 'plaster');
      return { ...color, wall: new Color(color.wall).lerp(new Color(0xf5f4eb), 0.93).getHex(), trim: new Color(color.shutter).lerp(new Color(0xa2ccdd), 0.88).getHex() };
    },
  });
}
