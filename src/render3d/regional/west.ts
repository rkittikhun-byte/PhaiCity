/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { makeKit, regionalPalette } from './kit.js';
export const west = makeKit({ id: 'west', label: 'ภาคตะวันตก · มอญและไม้ไผ่', labelEn: 'West · Layered gables and bamboo',
  roofForm: 'layeredGable', pitch: 45, overhang: 0.65, ridgeOrnament: 'mon_trim', roofMaterial: 'thatch_grass',
  wallForm: 'splitBamboo', wallMaterial: 'bamboo_split', raisedFloor: 0.9,
  palette: regionalPalette([0xc7b079, 0xbca46d, 0xd0b981, 0xb29b69, 0xd7c28d, 0xc3a773, 0xbaaa7d, 0xceb382], 0x624a35, 0x667349, 0xcfb77e),
  plasterColors: [0xd7bf91, 0xdcb99d, 0xd6cea7, 0xc4ccaa, 0xe6d2ae, 0xc9bfae, 0xd0b7a1, 0xdac49f],
  ornaments: ['mon_trim'], props: ['palm_sugar_pots', 'palm_sugar_shed', 'bamboo_fence'],
});
