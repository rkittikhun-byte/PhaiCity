/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const south = makeKit({ id: 'south', label: 'ภาคใต้ · ปั้นหยาและปูนปั้น', labelEn: 'South · Hip roofs and stucco',
  roofForm: 'hip', pitch: 30, overhang: 0.48, ridgeOrnament: 'malay_gable', roofMaterial: 'roof_clay_tile',
  wallForm: 'plaster', wallMaterial: 'plaster_tint', raisedFloor: 0.25,
  palette: regionalPalette([0xf1dcae, 0xe8b9b3, 0xb4d2c5, 0xc2d7e4, 0xead8be, 0xccbfda, 0xe8cd9f, 0xb9d1cb], 0xf4e9d4, 0x407d73, 0xd28661),
  ornaments: ['arch', 'pediment', 'malay_gable'], props: ['rubber_rack', 'dove_cage_pole', 'fishing_nets'],
});
