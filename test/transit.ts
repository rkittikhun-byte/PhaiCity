/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Public transport (src/transit.ts, docs/TRANSIT.md): a bus put down on a road and three stations that carry a share of the trips near
// them, rescue trips with no way by road where rail reaches, and bring visitors, trade and land value, for upkeep,
// power, a railway beside them and the ruler's rank.

import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { POWERBIT } from "../src/tileFlags";
import { STATION } from "../src/tileValues";
import { Traffic } from "../src/traffic.js";
import {
  HSR_TRADE, MOST_RIDERS, NEEDS_RAIL, ONE_HSR, Transit, TRANSIT_KINDS, TRANSIT_NEEDS_RANK, TRANSIT_SPECS, transitProblem,
} from "../src/transit";

function city(rank = 5) {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.stationKinds = {};
  map.buses = [];
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(200000);
  const rail = new Set<number>();
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, rank: () => rank, houseMap: map,
    isRailAt: (x: number, y: number) => rail.has(y * map.width + x),
    setStationKind: (x: number, y: number, kind: string) => { map.stationKinds[y * map.width + x] = kind; },
    addBus: (x: number, y: number) => { map.buses.push(y * map.width + x); },
  } as any);
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  return { map, sim, tool, rail };
}

const powered = { width: 40, getTileFlags: () => POWERBIT, stationKinds: {} as Record<string, string> };
const site = (transit: Transit, kind: string, x: number, y: number) => {
  if (kind === "bus_stop") transit.stopFound(x, y, {}, true);
  else {
    powered.stationKinds[String(y * 40 + x)] = kind;
    transit.stationFound(powered, x, y, {});
  }
};

describe("public transport", () => {
  test("a bus and three stations, each with its price and words", () => {
    expect(TRANSIT_KINDS).toHaveLength(4);
    for (const kind of TRANSIT_KINDS) {
      expect([kind, BASE_PRICES[kind]]).toEqual([kind, TRANSIT_SPECS[kind].price]);
      expect([kind, hasKey(`tool.${kind}`), hasKey(`choice.${kind}`), hasKey(`rules.cost.${kind}`)]).toEqual([kind, true, true, true]);
    }
    for (const key of ["choice.title.bus_stop", "transit.note.needs_rail", "transit.note.one_hsr", "transit.note.needs_rank",
      "budget.transit", "map.key.transit", "about.building.transit"]) expect([key, hasKey(key)]).toEqual([key, true]);
  });

  test("stations stand beside a railway, the metro and high-speed rail wait for the rank, and one high-speed station", () => {
    const { map, tool, rail } = city();
    // A bus goes on a road, changing no tile, and nowhere else
    expect(tool("bus_stop", 5, 5).toolResult).not.toBe(0);
    expect(map.buses).toEqual([]);
    map.setTile(5, 5, 66, 0);
    expect(tool("bus_stop", 5, 5).toolResult).toBe(0);
    expect(map.getTileValue(5, 5)).toBe(66);
    expect(map.buses).toEqual([5 * map.width + 5]);
    expect(tool("train_station", 20, 20)).toMatchObject({ accepted: false, reason: NEEDS_RAIL });
    rail.add(20 * map.width + 22); // just beside its east side
    expect(tool("train_station", 20, 20).toolResult).toBe(0);
    expect(map.getTileValue(20, 20)).toBe(STATION);
    expect(map.stationKinds[20 * map.width + 20]).toBe("train_station");
    rail.add(30 * map.width + 42);
    expect(tool("hsr_station", 40, 30).toolResult).toBe(0);
    rail.add(10 * map.width + 52);
    expect(tool("hsr_station", 50, 10)).toMatchObject({ accepted: false, reason: ONE_HSR });
    const low = city(1);
    expect(low.tool("metro_station", 20, 20)).toMatchObject({ accepted: false, reason: TRANSIT_NEEDS_RANK });
    expect(transitProblem("metro_station", 0, 0, 2, () => false, null)).toBeNull();
  });

  test("riders near a stop add less traffic; rail carries a trip that finds no road route", () => {
    const transit = new Transit(40, 40);
    site(transit, "bus_stop", 10, 10);
    site(transit, "train_station", 30, 30);
    transit.endCycle();
    expect(transit.ridersAt(10, 10)).toBeCloseTo(TRANSIT_SPECS.bus_stop.riders);
    expect(transit.ridersAt(0, 39)).toBe(0);
    expect(transit.railAt(30, 30)).toBe(true);
    expect(transit.railAt(10, 10)).toBe(false);

    // A zone beside a dead-end road with nowhere to go
    const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(40, 40);
    for (let x = 26; x <= 34; x++) map.setTile(x, 32, 66, 0);
    const traffic: any = new (Traffic as any)(map, { getSprite: () => null });
    const blockMaps = { trafficDensityMap: { worldGet: () => 0, worldSet: () => undefined } };
    expect(traffic.makeTraffic(30, 30, blockMaps, () => false)).toBe(0); // Traffic.NO_ROUTE_FOUND
    traffic.transit = transit;
    expect(traffic.makeTraffic(30, 30, blockMaps, () => false)).toBe(1); // Traffic.ROUTE_FOUND
  });

  test("riders never pass the most; the metro needs a second station for its line", () => {
    const transit = new Transit(40, 40);
    for (const kind of ["bus_stop", "bus_stop", "bus_stop", "train_station"]) site(transit, kind, 10, 10);
    site(transit, "metro_station", 30, 30);
    transit.endCycle();
    expect(transit.ridersAt(10, 10)).toBeCloseTo(MOST_RIDERS);
    expect(transit.railAt(30, 30)).toBe(false);
    expect(transit.landValueAt(30, 30)).toBe(0);
    site(transit, "metro_station", 30, 30);
    site(transit, "metro_station", 34, 34);
    transit.endCycle();
    expect(transit.railAt(30, 30)).toBe(true);
    expect(transit.landValueAt(30, 30)).toBeGreaterThan(0);
  });

  test("train and high-speed stations bring visitors, the high-speed station trade and noise", () => {
    const transit = new Transit(40, 40);
    expect([transit.visitorFactor(), transit.tradeFactor()]).toEqual([1, 1]);
    for (let i = 0; i < 3; i++) site(transit, "train_station", 5 + 4 * i, 5);
    site(transit, "hsr_station", 30, 30);
    transit.endCycle();
    expect(transit.visitorFactor()).toBeCloseTo(1 + 2 * 0.1 + 0.25);
    expect(transit.tradeFactor()).toBe(HSR_TRADE);
    expect(transit.pollutionAt(powered, 29, 29, STATION - 4)).toBeGreaterThan(0);
  });

  test("in a city: upkeep counted, an unpowered station idle, a bus on its road working", () => {
    const { map, sim, tool, rail } = city();
    for (let x = 0; x < 20; x++) map.setTile(x, 6, 66, 0); // a road
    tool("bus_stop", 5, 6);
    rail.add(20 * map.width + 22);
    tool("train_station", 20, 20); // no power
    for (let step = 0; step < 16 * 3; step++) sim._simulate(sim._constructSimData());
    expect(sim._census.transitUpkeep).toBe(TRANSIT_SPECS.bus_stop.upkeep + TRANSIT_SPECS.train_station.upkeep);
    expect(sim._transit.working.map((s: { kind: string }) => s.kind)).toEqual(["bus_stop"]);
  });
});
