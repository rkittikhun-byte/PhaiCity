/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

export const REGIONS = ['north', 'northeast', 'central', 'east', 'west', 'south'] as const;
export type RegionId = typeof REGIONS[number];
export type RegionTier = 'R1' | 'R2' | 'R3';
