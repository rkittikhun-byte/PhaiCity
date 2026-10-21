/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Building time (src/construction.ts, docs/GAME_DESIGN.md 6.1): a big building stands as a construction site for its
// months, giving no power, places or service and paying no upkeep, then works; undo, the bulldozer and a save know it.

import { CityCommands } from "../src/cityCommands";
import {
  isSite, monthsLeft, readSites, siteMonths, sitesMonth, startSite, TIME_PER_MONTH, writeSites,
} from "../src/construction";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { Simulation } from "../src/simulation.js";
import { ZONEBIT } from "../src/tileFlags";
import { STADIUM } from "../src/tileValues";

function city() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.powerKinds = {};
  map.sites = {};
  const sim: any = new (Simulation as any)(map, 1, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, rank: () => 5,
    setPowerKind: (x: number, y: number, kind: string) => { map.powerKinds[y * map.width + x] = kind; },
    setCivicKind: (x: number, y: number, kind: string) => { map.civicKinds[y * map.width + x] = kind; },
    startSite: (x: number, y: number, tool: string) => startSite(map, x, y, tool, sim._cityTime),
    houseMap: map,
    setRulerHouse: (x: number, y: number) => {
      map.civicKinds[y * map.width + x] = "ruler_house";
      map.rulerHouse = { x, y, level: 1, wings: [] };
    },
  } as any);
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  /** A whole cycle of the map scan, whose census counts what works */
  const scan = () => { for (let step = 0; step < 16; step++) sim._simulate(sim._constructSimData()); };
  return { map, sim, tool, commands, scan };
}

describe("construction sites", () => {
  test("a big building's months come from the unlock table, scaled by the mode", () => {
    expect(siteMonths("hydro")).toBe(12);
    expect(siteMonths("hydro", 0.5)).toBe(6);
    expect(siteMonths("provincial_hospital", 1.5)).toBe(9);
    expect(siteMonths("coal", 0.1)).toBe(1);
    expect(siteMonths("residential")).toBe(0);
    expect(siteMonths("primary_school")).toBe(0);
  });

  test("a power plant being built gives no power until its months are over", () => {
    const { map, sim, tool, scan } = city();
    expect(tool("coal", 10, 10).toolResult).toBe(0);
    const centre = 10 * map.width + 10;
    expect(isSite(map, centre)).toBe(true);
    expect(monthsLeft(map, centre, sim._cityTime)).toBe(2);
    scan();
    expect(sim._census.coalPowerPop).toBe(0);
    expect(sitesMonth(map, sim._cityTime + TIME_PER_MONTH)).toEqual([]);
    expect(sitesMonth(map, sim._cityTime + 2 * TIME_PER_MONTH)).toEqual([{ tool: "coal", x: 10, y: 10 }]);
    expect(isSite(map, centre)).toBe(false);
    scan();
    expect(sim._census.coalPowerPop).toBe(1);
  });

  test("a school being built gives no places and pays no upkeep", () => {
    const { map, sim, tool, scan } = city();
    // (a secondary school needs the ruler's house at its second level, beside a road)
    for (let y = 30; y < 37; y++) tool("road", 40, y);
    tool("ruler_house", 42, 33);
    tool("ruler_house_upgrade", 42, 33);
    tool("coal", 10, 10);
    map.sites = {};
    expect(tool("secondary_school", 14, 10).toolResult).toBe(0);
    expect(isSite(map, 10 * map.width + 14)).toBe(true);
    for (let i = 0; i < 6; i++) scan();
    expect(sim._services.places.basic).toBe(0);
    expect(sim._census.educationUpkeep ?? 0).toBe(0);
    map.sites = {};
    for (let i = 0; i < 6; i++) scan();
    expect(sim._services.places.basic).toBeGreaterThan(0);
  });

  test("undo takes the site away with its building, and a bulldozed site is forgotten", () => {
    const { map, tool, commands } = city();
    tool("gas", 10, 10);
    expect(Object.keys(map.sites)).toEqual([String(10 * map.width + 10)]);
    commands.apply({ type: "undo" });
    expect(map.sites).toEqual({});
    tool("gas", 20, 20);
    tool("bulldozer", 20, 20);
    expect(sitesMonth(map, 0)).toEqual([]);
    expect(map.sites).toEqual({});
  });

  test("the sites are saved and read back", () => {
    const sites = { 650: { tool: "hydro", ready: 96 } };
    expect(readSites(JSON.parse(JSON.stringify(writeSites(sites))))).toEqual(sites);
    expect(writeSites({})).toBeUndefined();
    expect(readSites({ x: { tool: "a", ready: 1 }, 5: { tool: 3 }, 6: { tool: "gas", ready: 8 } })).toEqual({ 6: { tool: "gas", ready: 8 } });
  });

  test("the core finishes its sites each month, tells it, and keeps the rest in its save", () => {
    const core = new CityCore({ map: (MapGenerator as any)(), seed: 3 });
    expect(core.systemNames).toContain("construction");
    const map = core.map, done: unknown[] = [];
    core.on("siteDone", (event) => done.push(event));
    // A stadium's centre, made a site by hand
    map.setTile(10, 10, STADIUM, ZONEBIT);
    const centre = 10 * map.width + 10;
    map.sites[centre] = { tool: "stadium", ready: core.simulation._cityTime + TIME_PER_MONTH };
    expect((core.save() as { sites?: unknown }).sites).toEqual({ [centre]: map.sites[centre] });
    core.run(16 * 4 * 2);
    expect(done).toEqual([{ type: "siteDone", tool: "stadium", x: centre % map.width, y: Math.floor(centre / map.width) }]);
  });
});
