/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Pollution as sources in metres drifting with the wind (src/sim/pollutionField.ts, docs/NO_GRID_PLAN.md 4.1): a
// source's plume is highest at its middle and falls smoothly to nothing 64 m away, as far as micropolisJS's two
// smoothing passes reached, with about as much pollution in all; the wind carries it downwind; and a real-scale city
// map's pollution block map is the plumes' sum at each block's middle.

import { DRIFT_M, OPEN_LAND_FULL, openLandField, POLLUTION_PEAK, POLLUTION_REACH_M, pollutionField, roundedWind } from "../src/sim/pollutionField";
import { BlockMapUtils } from "../src/blockMapUtils.js";
import { BlockMap } from "../src/blockMap";
import { GameMap } from "../src/gameMap.js";
import { seasonWind } from "../src/wind";

const W = 40, H = 40, M = 16, B = 2;
const at = (x: number, y: number) => y * W + x;
const blocks = Math.ceil(W / B);

describe("pollution as sources in metres", () => {
  test("a source's plume: highest at it, falling smoothly to nothing 64 m away, the same every way in still air", () => {
    const field = pollutionField(W, H, M, B, [[at(20, 20), 200]], null);
    const value = (bx: number, bz: number) => field[bz * blocks + bx];
    // the block whose middle is nearest the tile's middle holds the most
    expect(value(10, 10)).toBe(Math.max(...field));
    expect(value(10, 10)).toBeLessThanOrEqual(Math.round(200 * POLLUTION_PEAK));
    // the same either way, and less further off, none past the reach
    expect(value(9, 10)).toBe(value(10, 9));
    let last = Infinity;
    for (let bx = 10; bx < blocks; bx++) {
      expect(value(bx, 10)).toBeLessThanOrEqual(last);
      last = value(bx, 10);
      if (((bx + 0.5) * B * M - 20.5 * M) >= POLLUTION_REACH_M) expect(value(bx, 10)).toBe(0);
    }
  });

  test("about as much pollution in all as the old two smoothing passes spread", () => {
    const field = pollutionField(W, H, M, B, [[at(20, 20), 100], [at(21, 20), 100], [at(20, 21), 100], [at(21, 21), 100]], null);
    const total = field.reduce((a, b) => a + b, 0);
    // micropolisJS: a block of 4 x 100 clamped to 255, then two passes of (self + 4 neighbours) / 4: 25/16 of it
    expect(total / (255 * 25 / 16)).toBeGreaterThan(0.75);
    expect(total / (255 * 25 / 16)).toBeLessThan(1.5);
  });

  test("the wind carries the plume downwind and draws it out along the way it blows", () => {
    const east = { x: 1, y: 0, strength: 1 };
    const field = pollutionField(W, H, M, B, [[at(20, 20), 200]], east);
    const value = (bx: number, bz: number) => field[bz * blocks + bx];
    // as far east of the source as west, more to the east
    expect(value(12, 10)).toBeGreaterThan(value(8, 10));
    // ... and further east than the still air's reach
    const still = pollutionField(W, H, M, B, [[at(20, 20), 200]], null);
    const reachOf = (f: Uint8Array) => { let far = 10; for (let bx = 10; bx < blocks; bx++) if (f[10 * blocks + bx] > 0) far = bx; return far; };
    expect(reachOf(field)).toBeGreaterThan(reachOf(still));
    expect(DRIFT_M).toBeGreaterThan(0);
    // the month's wind, rounded so every machine sees the same (src/wind.ts)
    const wind = roundedWind(seasonWind(7, 2));
    expect(wind.x * 256 % 1).toBe(0);
    expect(wind.strength).toBeGreaterThan(0);
  });

  test("a real-scale city map's pollution block map is the plumes' sum at each block's middle", () => {
    const map: any = new (GameMap as any)(W, H);
    map.tileSizeM = M;
    // a block of factory tiles (one of micropolisJS's industrial zone tiles)
    for (const [x, y] of [[20, 20], [21, 20], [20, 21], [21, 21]]) map.setTile(x, y, 625, 0);
    const blockMaps: any = {};
    for (const [name, size] of [["landValueMap", 2], ["terrainDensityMap", 4], ["pollutionDensityMap", 2], ["crimeRateMap", 2],
      ["tempMap1", 2], ["tempMap2", 2], ["tempMap3", 4]] as const) blockMaps[name] = new BlockMap(W, H, size);
    const census: any = {};
    BlockMapUtils.pollutionTerrainLandValueScan(map, census, blockMaps, 1, 0, null, null, null, { x: 0, y: 1, strength: 1 });
    const pollution = blockMaps.pollutionDensityMap;
    expect(pollution.worldGet(20, 20)).toBeGreaterThan(0);
    // carried south by the wind: more two blocks south than two north
    expect(pollution.worldGet(20, 24)).toBeGreaterThan(pollution.worldGet(20, 16));
    expect(census.pollutionAverage).toBeGreaterThan(0);
  });

  test("open land adds to a block's value by how much lies round its middle, falling off smoothly (4.2)", () => {
    // open land west of x = 20, built land east of it
    const map = { width: W, height: H, tileSizeM: M, getTileValue: (x: number) => (x < 20 ? 0 : 500) };
    const field = openLandField(map, B, (value) => value === 0);
    const value = (bx: number) => field[10 * blocks + bx];
    expect(value(2)).toBe(OPEN_LAND_FULL);
    expect(value(blocks - 2)).toBe(0);
    // from the open land into the town: down a little at a time, never up, through more than micropolisJS's 64 m steps
    const seen = new Set<number>();
    for (let bx = 1; bx < blocks; bx++) { expect(value(bx)).toBeLessThanOrEqual(value(bx - 1)); seen.add(value(bx)); }
    expect(seen.size).toBeGreaterThan(5);
  });
});
