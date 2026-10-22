/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Disasters by the land and the wind, and roads that wear rather than break (src/sim/disasterLand.ts,
// docs/NO_GRID_PLAN.md 4.4): a fire runs downwind, a flood stops at a rise, an unpaid road wears along its length and
// slows its traffic, and a real-scale city's roads no longer break into holes of rubble.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";
import { ANIMBIT, BULLBIT, BURNBIT } from "../src/tileFlags";
import { FIRE, LASTFIRE, RUBBLE, LASTRUBBLE, WOODS } from "../src/tileValues";
import { fireChance, floodsOnto, readRoadWear, roadWearMonth, WEAR_MONTH, wornSpeed, WORN_SPEED, writeRoadWear } from "../src/sim/disasterLand";
import { RoadGraph } from "../src/roads/roadGraph";

describe("disasters by the land and the wind", () => {
  test("a fire catches a tile downwind more, upwind less, a corner half as often", () => {
    const east = { x: 1, y: 0, strength: 1 };
    expect(fireChance(1, 0, east)).toBeGreaterThan(fireChance(0, 1, east));
    expect(fireChance(0, 1, east)).toBeGreaterThan(fireChance(-1, 0, east));
    expect(fireChance(1, 1, null)).toBe(fireChance(1, 0, null) / 2);
    expect(fireChance(1, 0, null)).toBe(1 / 8);
  });

  test("a flood runs onto land no higher than its own a little, any land where the heights are not known", () => {
    const heights = [5, 5.3, 6.5];
    expect(floodsOnto(heights, 0, 1)).toBe(true);
    expect(floodsOnto(heights, 0, 2)).toBe(false);
    expect(floodsOnto(null, 0, 2)).toBe(true);
  });

  test("an unpaid road wears along its whole length, slows its traffic, and is mended when paid for", () => {
    const graph = new RoadGraph();
    const own = graph.add({ from: [0, 0], to: [100, 0], level: 2 }).segments[0];
    const state = graph.add({ from: [500, 0], to: [700, 0], level: 2, national: true }).segments[0];
    const wear = new Map<number, number>();
    roadWearMonth(graph, wear, 0);
    expect(wear.get(own)).toBeCloseTo(WEAR_MONTH, 6);
    expect(wear.has(state)).toBe(false);
    for (let m = 0; m < 40; m++) roadWearMonth(graph, wear, 0.5);
    expect(wear.get(own)).toBeLessThanOrEqual(1);
    expect(wornSpeed(20, 1)).toBeCloseTo(20 * WORN_SPEED, 6);
    for (let m = 0; m < 12; m++) roadWearMonth(graph, wear, 1);
    expect(wear.has(own)).toBe(false);
    // ... kept with the city
    wear.set(own, 0.25);
    expect(readRoadWear(JSON.parse(JSON.stringify(writeRoadWear(wear))))).toEqual(wear);
  });
});

describe("on a real-scale city map", () => {
  function city() {
    const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    map.tileSizeM = 16;
    const core = new CityCore({ sandbox: true, map, seed: 5 });
    (core.map as any).needsRulerHouse = false;
    return core;
  }

  test("an unpaid road wears instead of breaking into rubble", () => {
    const core = city(), map = core.map as any;
    core.apply({ type: "road", tool: "road", from: [40, 200], to: [900, 200], stroke: 1 } as any);
    core.simulation.budget.roadEffect = 0;
    (core.simulation.budget as any).shouldDegradeRoad = () => true;
    core.run(16 * 4 * 6);
    let rubble = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const v = map.getTileValue(x, y);
      if (v >= RUBBLE && v <= LASTRUBBLE) rubble++;
    }
    expect(rubble).toBe(0);
    expect(map.roadWear.size).toBeGreaterThan(0);
  });

  test("a fire with the wind behind it runs downwind further than upwind", () => {
    let down = 0, up = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const core = city(), map = core.map as any;
      for (let y = 5; y < 35; y++) for (let x = 5; x < 55; x++) map.setTile(x, y, WOODS, BURNBIT | BULLBIT);
      map.setTile(30, 20, FIRE, ANIMBIT);
      // the northeast monsoon of December and January blows towards the southwest
      Random.seed(seed);
      core.run(16 * 4 * 2);
      for (let y = 5; y < 35; y++) for (let x = 5; x < 55; x++) {
        const v = map.getTileValue(x, y);
        if (v === WOODS) continue;
        if (x < 30 && y > 20) down++;
        if (x > 30 && y < 20) up++;
        void FIRE; void LASTFIRE;
      }
    }
    expect(down).toBeGreaterThan(up);
  });
});
