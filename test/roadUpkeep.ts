/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Roads by level (docs/NO_GRID_PLAN.md 1.1): each level's lanes, speed and the cars it takes (src/roadLevels.ts), and on
// a real-scale city map a road's upkeep by its length in the road graph (src/sim/roadUpkeep.ts), so a slanted road costs
// what a straight one as long does.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { MAX_ROAD_LEVEL, roadCapacity, roadSpec, roadSpeed } from "../src/roadLevels";
import { roadUpkeepByLength } from "../src/sim/roadUpkeep";

function city() {
  const map = (MapGenerator as any).fromPresetCells(80, 80, new Uint8Array(80 * 80));
  map.tileSizeM = 16;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(10000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

const road = (core: CityCore, from: [number, number], to: [number, number], tool = "road_asphalt", stroke = core.log.length + 1) =>
  expect(core.apply({ type: "road", tool: tool as any, from, to, stroke })).toEqual({ accepted: true, toolResult: 0 });

describe("roads by level", () => {
  test("wider and faster as they go up, laterite one shared lane, a motorway three each way", () => {
    expect(roadSpec(1).lanes).toBe(1);
    expect(roadSpec(MAX_ROAD_LEVEL).lanes).toBe(6);
    for (let level = 2; level <= MAX_ROAD_LEVEL; level++) {
      expect(roadSpeed(level)).toBeGreaterThanOrEqual(roadSpeed(level - 1));
      if (level !== 7) expect(roadCapacity(level)).toBeGreaterThanOrEqual(roadCapacity(level - 1));
    }
    expect(roadSpeed(1) * 3.6).toBeCloseTo(30, 9);
    expect(roadSpeed(7) * 3.6).toBeCloseTo(100, 9);
  });

  test("a slanted road costs the upkeep a straight one as long does, a state road nothing", () => {
    const straight = city(), slanted = city();
    // 800 m each: east along a row, and at 45°, whose staircase is 1.4 times as many tiles
    road(straight, [100.5, 300.5], [900.5, 300.5]);
    const d = 800 / Math.SQRT2;
    road(slanted, [100.5, 100.5], [100.5 + d, 100.5 + d]);
    const a = roadUpkeepByLength(straight.map)!, b = roadUpkeepByLength(slanted.map)!;
    expect(a).toBeCloseTo(800 / 16 * roadSpec(2).upkeep, 1);
    expect(Math.abs(b - a) / a).toBeLessThan(0.01);
    const tiles = (core: CityCore) => {
      let n = 0;
      for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) { const v = core.map.getTileValue(x, y); if (v >= 64 && v < 208) n++; }
      return n;
    };
    expect(tiles(slanted) / tiles(straight)).toBeGreaterThan(1.3);
    // ... and the census the budget reads counts it so, whichever the map's scan finds
    slanted.run(16);
    expect(slanted.simulation._census.roadUpkeep).toBeCloseTo(b, 6);
    // The state's own roads cost the city nothing
    for (const s of (slanted.map as any).roadGraph.segments.values()) s.national = true;
    expect(roadUpkeepByLength(slanted.map)).toBe(0);
  });

  test("tiles raised by the upgrade tool cost their level's upkeep, a share of the road as long as theirs", () => {
    const core = city();
    road(core, [100.5, 300.5], [900.5, 300.5], "road");
    const laterite = roadUpkeepByLength(core.map)!;
    const levels = (core.map as any).roadLevels as Uint8Array;
    for (let x = 0; x < 80; x++) if (levels[18 * 80 + x]) levels[18 * 80 + x] = 4;
    expect(roadUpkeepByLength(core.map)! / laterite).toBeCloseTo(roadSpec(4).upkeep / roadSpec(1).upkeep, 1);
  });
});
