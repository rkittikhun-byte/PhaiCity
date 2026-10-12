/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const north = makeKit({ id: 'north', label: 'ภาคเหนือ · ล้านนา', labelEn: 'North · Lanna',
  roofForm: 'gable', pitch: 43, overhang: 0.65, ridgeOrnament: 'kalae', roofMaterial: 'roof_wood_shingle',
  wallForm: 'slidingVents', wallMaterial: 'wood_teak', raisedFloor: 1.2,
  palette: regionalPalette([0x65452f, 0x71543b, 0x7d6046, 0x563e30, 0x887056, 0x6b5343, 0x96785b, 0x60493b], 0xe4d6b9, 0x5c6546, 0x876644),
  plasterColors: [0xf1e8d6, 0xe4dcc8, 0xede4d6, 0xd6d1c1, 0xe3d4b8, 0xd0d9cc, 0xe9d5c6, 0xdddccb],
  ornaments: ['kalae'], props: ['rice_granary', 'paper_umbrella'],
});
