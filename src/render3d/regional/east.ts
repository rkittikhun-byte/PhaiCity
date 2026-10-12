/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const east = makeKit({ id: 'east', label: 'ภาคตะวันออก · เรือนริมน้ำ', labelEn: 'East · Waterfront timber',
  roofForm: 'gable', pitch: 40, overhang: 0.55, ridgeOrnament: 'bargeboards', roofMaterial: 'roof_glazed_tile',
  wallForm: 'paneled', wallMaterial: 'wood_painted', raisedFloor: 1.3,
  palette: regionalPalette([0x8fb8bd, 0x9bbcab, 0xb0cbbb, 0x89b1c2, 0xb6cbc6, 0xa5bbb0, 0x9dbab5, 0xb1c6b0], 0xe0d7b9, 0x467f89, 0x497f89),
  plasterColors: [0xadd2ce, 0xa6c2d8, 0xbddcc5, 0xd5e0d6, 0xbacddd, 0xb8d3bd, 0xeadbc0, 0xcedbcc],
  ornaments: ['fretwork', 'bargeboards'], props: ['fishing_nets', 'fruit_crates'],
});
