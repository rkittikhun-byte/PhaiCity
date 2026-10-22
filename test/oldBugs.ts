/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Old bugs of the port fixed (docs/NO_GRID_PLAN.md 0.4): a fire spreads to what burns beside it (it read the burning
// tile itself, then called an undefined tileUtils), a storm's flood comes onto bare ground beside the water (it compared
// the tile with DIRT and never called isCombustible), and a plot's surroundings count the civic buildings as far out as
// they say (6 tiles, the loop went 4).

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { plotEnvironmentClass } from "../src/plots";
import { Random } from "../src/random";
import { ANIMBIT, BULLBIT, BURNBIT } from "../src/tileFlags";
import { DIRT, FIRE, FIRSTRIVEDGE, FLOOD, LASTFIRE, LASTFLOOD, WOODS } from "../src/tileValues";

function city(width = 40, height = 40) {
  const map = (MapGenerator as any).fromPresetCells(width, height, new Uint8Array(width * height));
  map.tileSizeM = 16;
  const core = new CityCore({ sandbox: true, map, seed: 5 });
  (core.map as any).needsRulerHouse = false;
  return core;
}

describe("old bugs of the port", () => {
  test("a fire spreads to the woods beside it", () => {
    // (a fire may go out before it catches the woods, as one in eleven does each time the scan comes by: over a few
    // cities most spread, whatever else draws on the city's chances first, such as the pollution scan, docs/NO_GRID_PLAN.md 4.1)
    let spread = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const core = city(), map = core.map;
      for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) map.setTile(x, y, WOODS, BURNBIT | BULLBIT);
      map.setTile(20, 20, FIRE, ANIMBIT);
      Random.seed(seed);
      let most = 0, burnt = 0;
      for (let step = 0; step < 64 * 4; step++) {
        core.step();
        let fires = 0;
        for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) {
          const v = map.getTileValue(x, y);
          if (v >= FIRE && v <= LASTFIRE) fires++;
        }
        most = Math.max(most, fires);
      }
      for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) if (map.getTileValue(x, y) !== WOODS) burnt++;
      // More than the one tile it started on caught fire, and burnt out
      if (most > 1 && burnt > 1) spread++;
    }
    expect(spread).toBeGreaterThanOrEqual(4);
  });

  test("a flood comes out of the water onto the bare ground beside it", () => {
    const core = city(), map = core.map;
    // River banks everywhere but a strip of bare ground (a flood starts at the water's edge, past the channel)
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) map.setTile(x, y, x === 20 ? DIRT : FIRSTRIVEDGE, 0);
    Random.seed(3);
    core.simulation.disasterManager.makeFlood(false);
    let flooded = 0;
    for (let y = 0; y < 40; y++) {
      const v = map.getTileValue(20, y);
      if (v >= FLOOD && v <= LASTFLOOD) flooded++;
    }
    expect(flooded).toBe(1);
  });

  test("a plot's surroundings count a civic building five or six tiles away", () => {
    const tiles = new Map<string, number>([["10,15", 410]]);
    const map = { width: 30, height: 30, paintedZones: true, roadLevels: null,
      getTileValue: (x: number, y: number) => tiles.get(`${x},${y}`) ?? 0, getTileFlags: () => 0 };
    const flat = { worldGet: () => 70 };
    const sim = { blockMaps: { landValueMap: flat, pollutionDensityMap: { worldGet: () => 10 } } };
    // Land value 70 less pollution 10 is class 1; the civic building (Manhattan 5 away) lifts it to class 2
    expect(plotEnvironmentClass(map as never, sim as never, 10, 10, "residential")).toBe(2);
    tiles.clear();
    expect(plotEnvironmentClass(map as never, sim as never, 10, 10, "residential")).toBe(1);
  });
});
