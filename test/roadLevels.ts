/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Road levels and the upgrade tool (docs/ROADS.md), and the traffic that makes them matter (the port's broken drive,
// fixed in src/traffic.js).

import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { BASE_PRICES } from "../src/provinceRules";
import {
  MAX_ROAD_LEVEL, newRoadLevels, ROAD_SPECS, ROAD_TOOLS, roadLevelAt, roadSpec, servesZones, tollsThisMonth,
  upgradeCost, UPGRADE_TOOL,
} from "../src/roadLevels";
import { Simulation } from "../src/simulation.js";
import { FREEZ, ROADS } from "../src/tileValues";
import { Traffic } from "../src/traffic.js";

const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);

function city() {
  const map = blank();
  map.roadLevels = newRoadLevels(map.width, map.height);
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime,
    setRoadLevel: (x: number, y: number, level: number) => { map.roadLevels[y * map.width + x] = level; },
  } as any);
  return { map, sim, commands };
}

describe("road levels", () => {
  test("are eight, from laterite to a tollway, dearer and roomier as they go", () => {
    expect(ROAD_TOOLS.length).toBe(MAX_ROAD_LEVEL);
    expect(ROAD_TOOLS[0]).toBe("road");
    for (let level = 2; level <= MAX_ROAD_LEVEL; level++) {
      expect(roadSpec(level).price).toBeGreaterThanOrEqual(roadSpec(level - 1).price);
      expect(roadSpec(level).load).toBeLessThanOrEqual(roadSpec(level - 1).load);
      expect(BASE_PRICES[ROAD_TOOLS[level - 1] as keyof typeof BASE_PRICES]).toBe(roadSpec(level).price);
    }
    expect(ROAD_SPECS[0].price).toBe(10); // the old road's price
  });

  test("motorways and tollways serve no zones; upgrades cost the difference", () => {
    expect([servesZones(6), servesZones(7), servesZones(8)]).toEqual([true, false, false]);
    expect(upgradeCost(1)).toBe(10);
    expect(upgradeCost(6)).toBe(80);
    expect(upgradeCost(8)).toBe(0);
  });

  test("an unrecorded road is laterite", () => {
    expect(roadLevelAt({ width: 4, height: 4 }, 1, 1)).toBe(1);
    expect(roadLevelAt({ width: 4, height: 4, roadLevels: new Uint8Array(16) }, 1, 1)).toBe(1);
  });

  test("a road is laid at the tool's level, and roads already there keep theirs", () => {
    const { map, commands } = city();
    expect(commands.apply({ type: "tool", tool: "road_concrete4", x: 10, y: 10 }).toolResult).toBe(0);
    expect(roadLevelAt(map, 10, 10)).toBe(4);
    expect(commands.apply({ type: "tool", tool: "road", x: 11, y: 10 }).toolResult).toBe(0);
    expect(roadLevelAt(map, 11, 10)).toBe(1);
    expect(roadLevelAt(map, 10, 10)).toBe(4);
  });

  test("the upgrade tool raises a road one level for the difference, never past a tollway, and is not undone", () => {
    const { map, sim, commands } = city();
    commands.apply({ type: "tool", tool: "road", x: 10, y: 10 });
    const funds = sim.budget.totalFunds;
    expect(commands.apply({ type: "tool", tool: UPGRADE_TOOL, x: 10, y: 10 }).toolResult).toBe(0);
    expect(roadLevelAt(map, 10, 10)).toBe(2);
    expect(funds - sim.budget.totalFunds).toBe(upgradeCost(1));
    for (let k = 0; k < 10; k++) commands.apply({ type: "tool", tool: UPGRADE_TOOL, x: 10, y: 10 });
    expect(roadLevelAt(map, 10, 10)).toBe(MAX_ROAD_LEVEL);
    expect(commands.apply({ type: "tool", tool: UPGRADE_TOOL, x: 20, y: 20 }).toolResult).toBe(1); // no road there
    expect(commands.canUndo()).toBe(true); // the road itself can still be undone, the upgrades cannot
  });
});

describe("traffic", () => {
  function street(level: number) {
    const map = blank();
    map.roadLevels = newRoadLevels(map.width, map.height);
    for (let x = 2; x < 40; x++) {
      map.setTile(x, 8, ROADS, 0);
      map.roadLevels[8 * map.width + x] = level;
    }
    map.setTile(20, 9, FREEZ, 0); // something to drive to, beside the road
    let density = 0;
    const blockMaps = {
      trafficDensityMap: { worldGet: () => density, worldSet: (_x: number, _y: number, value: number) => { density = value; } },
    };
    return { map, blockMaps, density: () => density };
  }

  test("cars leave their zone and reach a destination along a road (the port never let them)", () => {
    const { map, blockMaps, density } = street(1);
    const traffic: any = new (Traffic as any)(map, { getSprite: () => null });
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      found = traffic.makeTraffic(5, 10, blockMaps, (value: number) => value === FREEZ) === 1;
    }
    expect(found).toBe(true);
    expect(density()).toBeGreaterThan(0);
  });

  test("a wider road fills more slowly, and a motorway is no driveway", () => {
    // One trip that gets there, on a traffic map kept tile by tile: what it added in all
    const fill = (level: number) => {
      const { map } = street(level);
      const tiles = new Map<string, number>();
      const blockMaps = { trafficDensityMap: {
        worldGet: (x: number, y: number) => tiles.get(`${x},${y}`) ?? 0,
        worldSet: (x: number, y: number, value: number) => { tiles.set(`${x},${y}`, value); },
      } };
      const traffic: any = new (Traffic as any)(map, { getSprite: () => null });
      for (let attempt = 0; attempt < 30; attempt++) {
        if (traffic.makeTraffic(5, 10, blockMaps, (value: number) => value === FREEZ) === 1) break;
      }
      return [...tiles.values()].reduce((sum, value) => sum + value, 0) / Math.max(1, tiles.size);
    };
    expect(fill(4)).toBeLessThan(fill(1));
    const { map, blockMaps } = street(7);
    const traffic: any = new (Traffic as any)(map, { getSprite: () => null });
    expect(traffic.makeTraffic(5, 10, blockMaps, () => true)).toBe(-1); // NO_ROAD_FOUND
  });

  test("tollways take tolls from their traffic", () => {
    const map = blank();
    map.roadLevels = newRoadLevels(map.width, map.height);
    for (let x = 2; x < 12; x++) {
      map.setTile(x, 8, ROADS, 0);
      map.roadLevels[8 * map.width + x] = 8;
    }
    expect(tollsThisMonth(map, { worldGet: () => 200 })).toBeGreaterThan(0);
    expect(tollsThisMonth(map, { worldGet: () => 0 })).toBe(0);
  });

  test("the roads' upkeep follows their levels", () => {
    const { map, sim, commands } = city();
    for (let x = 10; x < 30; x++) commands.apply({ type: "tool", tool: "road", x, y: 10 });
    for (let step = 0; step < 16; step++) sim._simulate(sim._constructSimData());
    const laterite = sim._census.roadUpkeep;
    for (let x = 10; x < 30; x++) map.roadLevels[10 * map.width + x] = 6;
    for (let step = 0; step < 16; step++) sim._simulate(sim._constructSimData());
    expect(sim._census.roadUpkeep).toBeGreaterThan(laterite * 5);
  });

  test("has its words in both languages", () => {
    for (const tool of [...ROAD_TOOLS, UPGRADE_TOOL]) {
      expect([tool, hasKey(`tool.${tool}`), hasKey(`choice.${tool}`)]).toEqual([tool, true, true]);
    }
    for (const key of ["choice.title.road", "choice.upgrade_note", "budget.tolls", "about.infra.road_levels",
      "rules.cost.tollway", "rules.cost.road_upgrade"]) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});
