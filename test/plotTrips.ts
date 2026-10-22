/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Growth by the month's trips (docs/NO_GRID_PLAN.md 1.3, src/plots.ts plotFound): on a real-scale city map a plot cut off
// from where its trips go loses a level as one with no road does, a long commute lowers its score, and the checklist
// says so; not known yet (a city just opened, or nowhere of that kind in the city) changes nothing.

import { plotChecklist } from "../src/plotChecklist";
import { COMMUTE_COST, COMMUTE_EASY, commuteCost, PLOT_WHY, plotFound, plotOf, plotTile, tripMinutes } from "../src/plots";
import { Random } from "../src/random";
import { RoadGraph } from "../src/roads/roadGraph";
import { POWERBIT } from "../src/tileFlags";
import { ROADS } from "../src/tileValues";
import { TRIP_MINUTES } from "../src/sim/trips";

/** A 16 m city map with a road along row 4, in tiles and in the road graph, and the month's trips' minutes */
function world(minutes: number, job = minutes) {
  const width = 16, height = 16, values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
  const roadGraph = new RoadGraph();
  roadGraph.add({ from: [0, 4.5 * 16], to: [16 * 16, 4.5 * 16], level: 2, traced: true });
  const map: any = {
    width, height, tileSizeM: 16, paintedZones: true, roadLevels: null, plotWhy: null, roadGraph,
    trips: { homeToWork: new Float32Array(width * height).fill(minutes), jobToHome: new Float32Array(width * height).fill(job) },
    water: { zoneWater: () => 1 },
    getTileValue: (x: number, y: number) => values[y * width + x],
    getTileFlags: (x: number, y: number) => flags[y * width + x],
    getTile: (x: number, y: number) => ({ isPowered: () => (flags[y * width + x] & POWERBIT) !== 0 }),
    setTile(x: number, y: number, value: number, flag: number) { values[y * width + x] = value; flags[y * width + x] = flag; },
  };
  for (let x = 0; x < width; x++) map.setTile(x, 4, ROADS, 0);
  const grid = (value: number) => ({ worldGet: () => value, worldSet: () => undefined });
  const blockMaps = { landValueMap: grid(150), pollutionDensityMap: grid(10), populationDensityMap: grid(200),
    cityCentreDistScoreMap: grid(0), rateOfGrowthMap: grid(0) };
  return { map, blockMaps };
}

const census = () => ({ resZonePop: 0, comZonePop: 0, indZonePop: 0, resPop: 0, comPop: 0, indPop: 0, poweredZoneCount: 0,
  unpoweredZoneCount: 0 });

/** A plot looked at by the map scanner `times` times, its level after each, and whether the walk of tiles was ever asked */
function look(w: ReturnType<typeof world>, kind: "residential" | "commercial" | "industrial", level: number, times: number,
  valve = 1500) {
  w.map.setTile(5, 5, plotTile(kind, level), POWERBIT);
  let walked = false;
  const sim: any = { blockMaps: w.blockMaps, valves: { resValve: valve, comValve: valve, indValve: valve },
    trafficManager: { makeTrafficFrom: () => { walked = true; return 1; } }, waterManager: { supplyPlot: () => true } };
  const levels: number[] = [];
  for (let k = 0; k < times; k++) {
    sim.census = census();
    plotFound(w.map, 5, 5, sim);
    levels.push(plotOf(w.map, 5, 5)?.level ?? -1);
  }
  return { levels, walked };
}

describe("growth by the month's trips", () => {
  test("a home cut off from work loses its levels as one with no road would; one with work near keeps them", () => {
    Random.seed(3);
    const cut = look(world(Infinity), "residential", 3, 600);
    expect(cut.levels.slice(-100).every((l) => l < 3)).toBe(true);
    expect(cut.walked).toBe(false);
    Random.seed(3);
    const near = look(world(4), "residential", 3, 600);
    expect(Math.min(...near.levels)).toBeGreaterThanOrEqual(3);
    // ... and a shop or factory with no homes within reach the same
    Random.seed(4);
    expect(look(world(4, Infinity), "commercial", 3, 600).levels.pop()).toBeLessThan(3);
    Random.seed(4);
    expect(look(world(4, Infinity), "industrial", 3, 600).levels.pop()).toBeLessThan(3);
  });

  test("not known yet, or nowhere of that kind in the city, changes nothing", () => {
    Random.seed(5);
    const unknown = look(world(NaN), "residential", 3, 600);
    expect(Math.min(...unknown.levels)).toBeGreaterThanOrEqual(3);
    expect(tripMinutes({ ...world(NaN).map, trips: null }, 5, 5, "residential")).toBeNaN();
    // A map that is not real-scale still walks the tiles
    const province = world(Infinity);
    province.map.tileSizeM = 200;
    expect(tripMinutes(province.map, 5, 5, "residential")).toBeNull();
    Random.seed(6);
    expect(look(province, "residential", 3, 300).walked).toBe(true);
  });

  test("a long commute lowers a place's score, and a short one costs nothing", () => {
    expect(commuteCost(COMMUTE_EASY)).toBe(0);
    expect(commuteCost(TRIP_MINUTES)).toBe((TRIP_MINUTES - COMMUTE_EASY) * COMMUTE_COST);
    expect(commuteCost(NaN)).toBe(0);
    expect(commuteCost(null)).toBe(0);
    // Homes on the edge of growing: those a long way from work grow less often than those near it
    const grown = (minutes: number) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) {
        Random.seed(seed);
        const w = world(minutes);
        n += look(w, "residential", 0, 1, -400).levels[0] > 0 ? 1 : 0;
      }
      return n;
    };
    expect(grown(28)).toBeLessThan(grown(5));
  });

  test("the checklist says a home is cut off from work, and what to do", () => {
    const w = world(Infinity);
    Random.seed(7);
    look(w, "residential", 2, 1);
    w.map.plotWhy ??= new Uint8Array(16 * 16);
    w.map.plotWhy[5 * 16 + 5] = PLOT_WHY.indexOf("road");
    const list = plotChecklist({ map: w.map, blockMaps: w.blockMaps, valves: { resValve: 1, comValve: 1, indValve: 1 }, services: null }, 5, 5)!;
    expect(list.rows[0]).toMatchObject({ check: "road", ok: false, key: "plot.check.route.residential",
      params: { minutes: TRIP_MINUTES }, hint: "plot.hint.route.residential" });
  });
});
