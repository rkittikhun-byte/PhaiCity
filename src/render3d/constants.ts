/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

export const TILE_M = 10;
export const BUILDING_MARGIN_M = 0.5;
export const GROUND_Y = 0;
export const WATER_Y = -0.6;
export const RIVERBED_Y = -3;
export const MAX_BUILDING_HEIGHT_M = 150;
export const MAX_MODEL_DRAW_CALLS = 8;
export const CONNECTION = { N: 1, E: 2, S: 4, W: 8 } as const;
export const TRIANGLE_BUDGETS = {
  house: 3000,
  tree: 3000,
  prop: 3000,
  tile: 1500,
  lowRise: 8000,
  highRise: 15000,
  special: 25000,
  smallVehicle: 4000,
  largeVehicle: 8000,
  naga: 20000,
} as const;
