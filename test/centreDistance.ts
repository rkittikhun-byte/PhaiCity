/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Land value by the straight-line distance from the city centre on a real-scale city map (docs/NO_GRID_PLAN.md 4.2,
// src/blockMapUtils.js): a neighbourhood off the centre's diagonal is worth as much as one as far along a street north of
// it; a province or practice map keeps the original Manhattan distance.

import { BlockMapUtils } from "../src/blockMapUtils.js";

const centre = { cityCentreX: 100, cityCentreY: 100 };

describe("the distance from the city centre", () => {
  test("is straight on a real-scale city map: as far diagonally as straight is as far", () => {
    const city = { ...centre, tileSizeM: 16 }, step = BlockMapUtils.nearnessStep(city);
    expect(step).toBe(3);
    // 30 tiles north, or 21 and 21 diagonally (29.7 tiles): the same steps
    expect(BlockMapUtils.centreDistance(city, 100, 70)).toBe(10);
    expect(BlockMapUtils.centreDistance(city, 121, 121)).toBe(9);
    // ... and never past 64
    expect(BlockMapUtils.centreDistance(city, 400, 400)).toBe(64);
  });

  test("is the original Manhattan distance on any other map", () => {
    const province = { ...centre, tileSizeM: 200 };
    expect(BlockMapUtils.centreDistance(province, 121, 121)).toBe(42);
    expect(BlockMapUtils.centreDistance({ ...centre }, 110, 105)).toBe(15);
  });
});
