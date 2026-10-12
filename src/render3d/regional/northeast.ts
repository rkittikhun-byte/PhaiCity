/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const northeast = makeKit({ id: 'northeast', label: 'ภาคอีสาน · เรือนเกย', labelEn: 'Northeast · Raised timber',
  roofForm: 'gable', pitch: 35, overhang: 0.3, ridgeOrnament: 'plain_trim', roofMaterial: 'roof_metal_corrugated',
  wallForm: 'paneled', wallMaterial: 'wood_painted', raisedFloor: 1.7,
  palette: regionalPalette([0x9c9a8d, 0xa8a492, 0x92998e, 0xb1aa9a, 0xaf9798, 0xa29baa, 0x9fae93, 0xb4a997], 0x665e52, 0x526f72, 0xb9bcbb),
  plasterColors: [0xe7a9bb, 0xa6c995, 0xb6a0cc, 0xebc96f, 0x86b9c7, 0xddaa91, 0xc5d1ab, 0xe3bad4],
  ornaments: ['plain_trim'], props: ['rice_barn', 'weaving_loom', 'bamboo_daybed'],
});
