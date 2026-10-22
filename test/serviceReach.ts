/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The police's and the fire brigade's cover by the distance along the roads from their station (src/sim/serviceReach.ts,
// docs/NO_GRID_PLAN.md 4.3): strongest on the station's own road, falling along it to nothing 320 m away, none across
// to a road the station's roads do not lead to, several stations adding up; and a real-scale city's police map holds it
// in blocks of 2 tiles.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { BlockMap } from "../src/blockMap";
import { COVER_REACH_M, coverAlongRoads, coverAt } from "../src/sim/serviceReach";

const W = 80, H = 50, M = 16;

/** A bare 16 m city map with a road along z = 200 m from x = 40 to 1240 m, and one not joined to it along z = 400 m */
function city() {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M; map.paintedZones = true; map.cellZones = true;
  const core = new CityCore({ map, seed: 3, sandbox: true });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  core.apply({ type: "road", tool: "road", from: [40, 200], to: [1240, 200], stroke: 1 } as any);
  core.apply({ type: "road", tool: "road", from: [40, 424], to: [1240, 424], stroke: 2 } as any);
  return { core, map: core.map as any };
}

describe("cover along the roads", () => {
  test("falls smoothly from the station's road to nothing at its reach", () => {
    expect(coverAt(0)).toBeGreaterThan(coverAt(100));
    expect(coverAt(100)).toBeGreaterThan(coverAt(200));
    expect(coverAt(COVER_REACH_M)).toBe(0);
  });

  test("runs along the station's road, not across to a road it does not lead to", () => {
    const { map } = city();
    // a station's centre tile beside the first road, x = 20 tiles (320 m)
    const centre = 14 * W + 20, blocks = new BlockMap(W, H, 2);
    coverAlongRoads(map, [{ centre, size: 3, effect: 1000 }], blocks);
    const at = (xm: number, zm: number) => blocks.worldGet(Math.floor(xm / M), Math.floor(zm / M));
    expect(at(328, 216)).toBeGreaterThan(0);
    // along the road: less further off, none past the reach
    expect(at(328 + 160, 216)).toBeLessThan(at(328, 216));
    expect(at(328 + 160, 216)).toBeGreaterThan(0);
    expect(at(328 + COVER_REACH_M + 64, 216)).toBe(0);
    // the other road, 224 m off as the crow flies but joined to nothing: none (the old 128 m blocks smoothed reached it)
    expect(at(328, 440)).toBe(0);
    // ... until a road joins them, which the cover then runs along
    const joined = city();
    joined.core.apply({ type: "road", tool: "road", from: [360, 200], to: [360, 424], stroke: 3 } as any);
    const again = new BlockMap(W, H, 2);
    coverAlongRoads(joined.map, [{ centre, size: 3, effect: 1000 }], again);
    expect(again.worldGet(Math.floor(360 / M), Math.floor(440 / M))).toBeGreaterThan(0);
  });

  test("two stations' cover adds up", () => {
    const { map } = city();
    const one = new BlockMap(W, H, 2), two = new BlockMap(W, H, 2);
    coverAlongRoads(map, [{ centre: 14 * W + 20, size: 3, effect: 1000 }], one);
    coverAlongRoads(map, [{ centre: 14 * W + 20, size: 3, effect: 1000 }, { centre: 14 * W + 30, size: 3, effect: 1000 }], two);
    expect(two.worldGet(25, 13)).toBeGreaterThan(one.worldGet(25, 13));
  });

  test("a real-scale city keeps its police and fire cover in blocks of 2 tiles", () => {
    const { core } = city();
    const maps = core.simulation.blockMaps as any;
    expect(maps.policeStationMap.blockSize).toBe(2);
    expect(maps.fireStationEffectMap.blockSize).toBe(2);
  });
});
