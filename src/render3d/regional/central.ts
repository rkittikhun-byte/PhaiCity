/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const central = makeKit({ id: 'central', label: 'ภาคกลาง · เรือนไทย', labelEn: 'Central · Steep gable',
  roofForm: 'gable', pitch: 54, overhang: 0.65, ridgeOrnament: 'bargeboards', roofMaterial: 'roof_clay_tile',
  wallForm: 'paneled', wallMaterial: 'wood_teak', raisedFloor: 0.85,
  palette: regionalPalette([0x956347, 0xab7954, 0xb18a61, 0x886047, 0xa67d5a, 0xbd9670, 0x977754, 0xaf865f], 0x60432e, 0x6d8272, 0xcd7950),
  plasterColors: [0xebdcb9, 0xe0b4ac, 0xb8cdd8, 0xb8d0bc, 0xdcc17f, 0xd8c4db, 0xebcfaf, 0xc5d6cf],
  ornaments: ['bargeboards'], props: ['dragon_jar', 'rowing_boat', 'spirit_house'],
});
