/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The wind (src/wind.ts): Thailand's monsoons set where it blows from, the province's wind level how hard.

import { seasonWind } from "../src/wind";

describe("the wind", () => {
  test("the northeast monsoon blows towards the southwest in the cool months, the southwest monsoon the other way", () => {
    const cool = seasonWind(0);
    expect(cool.season).toBe("northeast_monsoon");
    expect(cool.from).toBe(45);
    expect(cool.x).toBeCloseTo(-Math.SQRT1_2, 5); // westward
    expect(cool.y).toBeCloseTo(Math.SQRT1_2, 5); // southward (y grows down the map)
    const rains = seasonWind(7);
    expect(rains.season).toBe("southwest_monsoon");
    expect(rains.x).toBeGreaterThan(0);
    expect(rains.y).toBeLessThan(0);
    expect(seasonWind(3).season).toBe("hot_season");
  });

  test("a windier province blows harder, never past a gale, and any month number works", () => {
    for (let month = 0; month < 12; month++) {
      const calm = seasonWind(month, 0), windy = seasonWind(month, 5);
      expect(windy.strength).toBeGreaterThan(calm.strength);
      expect(windy.strength).toBeLessThanOrEqual(1);
      expect(Math.hypot(calm.x, calm.y)).toBeCloseTo(1, 5);
    }
    expect(seasonWind(13)).toEqual(seasonWind(1));
    expect(seasonWind(-1)).toEqual(seasonWind(11));
  });
});
