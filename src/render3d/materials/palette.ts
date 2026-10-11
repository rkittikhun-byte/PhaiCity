/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { seededRng } from '../rng.js';

export const SHOPHOUSE_PASTELS = Object.freeze([
  { name: 'cream', label: 'ครีม', color: 0xf0e1bf },
  { name: 'shrimp_paste_pink', label: 'ชมพูกะปิ', color: 0xd8a7a3 },
  { name: 'faded_sky_blue', label: 'ฟ้าซีด', color: 0xa8c7d5 },
  { name: 'mint_green', label: 'เขียวมิ้นต์', color: 0xb6d2bd },
  { name: 'mustard_yellow', label: 'เหลืองมัสตาร์ด', color: 0xd8bd75 },
  { name: 'pandan_green', label: 'เขียวใบเตยอ่อน', color: 0xc5cf9c },
  { name: 'lotus_pink', label: 'ชมพูบัว', color: 0xe7bdc2 },
  { name: 'faded_turquoise', label: 'เขียวอมฟ้าซีด', color: 0x9fc6c0 },
  { name: 'tamarind_beige', label: 'เบจมะขาม', color: 0xcab69e },
  { name: 'soft_lilac', label: 'ม่วงอ่อน', color: 0xc6b8d3 },
  { name: 'terracotta_peach', label: 'ส้มดินเผาอ่อน', color: 0xe2b094 },
  { name: 'warm_off_white', label: 'ขาวนวล', color: 0xece9da },
].map(entry => Object.freeze(entry)));

/** Seed zero is valid. Geometry and massing are independent of this colour choice. */
export function shophousePastel(seed = 1): typeof SHOPHOUSE_PASTELS[number] {
  return SHOPHOUSE_PASTELS[Math.floor(seededRng(seed)() * SHOPHOUSE_PASTELS.length)];
}
