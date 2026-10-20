/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every "is this a road" test (src/roadTiles.ts, docs/METRE_DRAWING_PLAN.md 0.3), pinned tile by tile, so changing
// what one counts is a choice made here and not an accident.

import { carriesWater, conductsPower, isAnyRail, isAnyRoad, isDriveableValue, isLineRail, isLineRoad, isPowerCrossing,
  isRoadTile } from "../src/roadTiles";
import { isRoadTile as levelsRoadTile } from "../src/roadLevels";
import { carriesWater as waterMains } from "../src/waterManager";
import { isAnyRoad as geometryAnyRoad, isLineRoad as geometryLineRoad } from "../src/roadGeometry";
import { TileUtils } from "../src/tileUtils.js";
import { isRoad as viewRoad } from "../src/render3d/city/tileModels";

/** The values from 0 to 1023 a test counts, as ranges [from, to] */
const counted = (test: (v: number) => boolean): [number, number][] => {
  const ranges: [number, number][] = [];
  for (let v = 0; v < 1024; v++) {
    if (!test(v)) continue;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === v - 1) last[1] = v; else ranges.push([v, v]);
  }
  return ranges;
};

describe("road tiles", () => {
  test("each test counts the tiles it says", () => {
    expect(counted(isRoadTile)).toEqual([[64, 207]]);
    expect(counted(conductsPower)).toEqual([[64, 207], [237, 238], [828, 831], [948, 951]]);
    expect(counted(carriesWater)).toEqual([[64, 207], [237, 238], [828, 831], [948, 951]]);
    expect(counted(isDriveableValue)).toEqual([[64, 206], [221, 238]]);
    expect(counted(isLineRoad)).toEqual([[66, 76], [79, 206]]);
    expect(counted(isLineRail)).toEqual([[226, 236]]);
    expect(counted(isPowerCrossing)).toEqual([[77, 78]]);
    expect(counted(isAnyRoad)).toEqual([[64, 206], [237, 239], [828, 832], [948, 951]]);
    expect(counted(isAnyRail)).toEqual([[221, 222], [224, 238]]);
  });

  test("power and water count the same road tiles (owner, 20 Oct 2026)", () => {
    for (let v = 0; v < 1024; v++) expect(conductsPower(v)).toBe(carriesWater(v));
    // An opening bridge under heavy traffic is a road for both; the airport's radar for neither
    expect(conductsPower(207)).toBe(true);
    expect(conductsPower(832)).toBe(false);
  });

  test("the modules that read them read these same tests", () => {
    expect(levelsRoadTile).toBe(isRoadTile);
    expect(waterMains).toBe(carriesWater);
    expect(geometryAnyRoad).toBe(isAnyRoad);
    expect(geometryLineRoad).toBe(isLineRoad);
    expect(viewRoad).toBe(isAnyRoad);
    // The traffic's test takes a tile or its value
    for (let v = 0; v < 1024; v++) expect(TileUtils.isDriveable(v)).toBe(isDriveableValue(v));
  });
});
