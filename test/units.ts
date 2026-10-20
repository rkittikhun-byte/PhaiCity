/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Metres, map tiles and world units in one place (src/units.ts, docs/METRE_DRAWING_PLAN.md 0.2).

import { CITY_TILE_M, DRAWN_TILE_M, isCityTileSize, metresPerUnit, TILE_UNITS, tileMetres, tileMiddleUnits, tileOfUnits,
  unitsOfTile, unitsPerMetre } from "../src/units";
import { realUnits } from "../src/roadGeometry";
import { isCityMap } from "../src/landBlocks";
import { TILE_M } from "../src/render3d/constants";

describe("units", () => {
  test("a tile is ten world units on every map, and the 3D view says the same", () => {
    expect(TILE_UNITS).toBe(10);
    expect(TILE_M).toBe(TILE_UNITS);
    expect(DRAWN_TILE_M).toBe(10);
    expect(tileOfUnits(0)).toBe(0);
    expect(tileOfUnits(9.99)).toBe(0);
    expect(tileOfUnits(10)).toBe(1);
    expect(tileOfUnits(-0.1)).toBe(-1);
    expect(unitsOfTile(3)).toBe(30);
    expect(tileMiddleUnits(3)).toBe(35);
  });

  test("a real-scale city map has tiles of 40 m or less; its metres turn into world units and back", () => {
    for (const size of [16, 40]) expect(isCityTileSize(size)).toBe(true);
    for (const size of [0, -16, 41, 400, null, undefined]) expect(isCityTileSize(size)).toBe(false);
    expect(unitsPerMetre(16)).toBeCloseTo(0.625);
    expect(metresPerUnit(16)).toBeCloseTo(1.6);
    expect(unitsPerMetre(16) * metresPerUnit(16)).toBeCloseTo(1);
    // The road geometry and land blocks read the same limit
    expect(realUnits(16)).toBeCloseTo(0.625);
    expect(realUnits(400)).toBeNull();
    expect(isCityMap({ tileSizeM: 16 })).toBe(true);
    expect(isCityMap({ tileSizeM: 400 })).toBe(false);
  });

  test("a map that does not say how big its tiles are counts as a city map's for the cell code", () => {
    expect(tileMetres({})).toBe(CITY_TILE_M);
    expect(tileMetres({ tileSizeM: null })).toBe(16);
    expect(tileMetres({ tileSizeM: 20 })).toBe(20);
  });
});
