/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The weather (src/weather.ts; owner, 20 Oct 2026): chosen by the simulation month by month from the Thai seasons as
// the region and province have them, changing gradually, the same for the same city every time, saved with it, and
// doing a little to the ground's water, floods, visitors and traffic.

import * as fs from "fs";
import * as path from "path";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { checkRulesData, type Climate, DEFAULT_CLIMATE, resolveRules } from "../src/provinceRules";
import { Random } from "../src/random";
import {
  nextKind, nextWeather, rainRecharge, readWeather, startingWeather, thaiSeason, type Weather, WEATHER_KINDS,
  type WeatherKind, weatherFlood, weatherTraffic, weatherVisitors,
} from "../src/weather";

const rulesFile = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "province-rules.json"), "utf8"));
const { data: rulesData } = checkRulesData(rulesFile);
const climateOf = (region: string, province: string): Climate => resolveRules(rulesData, region, province).weather;
const KHON_KAEN = climateOf("northeast", "TH-40");

/** Years of a city's weather, a list of the twelve months' kinds a year */
function years(climate: Climate, seed: number, count: number): WeatherKind[][] {
  let weather = startingWeather(climate, 0, seed);
  const out: WeatherKind[][] = [];
  for (let year = 0; year < count; year++) {
    const months: WeatherKind[] = [];
    for (let month = 0; month < 12; month++) {
      weather = nextWeather(weather, climate, month, year * 12 + month);
      months.push(weather.kind);
    }
    out.push(months);
  }
  return out;
}

/** The share of the months (0 January) that took one of these kinds */
function share(record: WeatherKind[][], months: number[], kinds: WeatherKind[]): number {
  let hit = 0, all = 0;
  for (const year of record) for (const m of months) { all++; if (kinds.includes(year[m])) hit++; }
  return hit / all;
}

describe("weather", () => {
  test("every region of the rules file has a whole climate, and the Andaman coast its own rains", () => {
    expect(checkRulesData(rulesFile).problems).toEqual([]);
    for (const region of ["north", "northeast", "central", "east", "west", "south"]) {
      const climate = rulesData.regions[region].weather as Climate;
      for (const list of ["rain", "storm", "fog", "smoke"] as const) expect(climate[list]).toHaveLength(12);
      expect(climate.flood).toBeGreaterThan(0);
    }
    // A province that gives some lists keeps the region's others
    const phuket = climateOf("south", "TH-83"), songkhla = climateOf("south", "TH-90");
    expect(phuket.rain).not.toEqual(songkhla.rain);
    expect(phuket.fog).toEqual(songkhla.fog);
  });

  test("a bad climate is reported and left out", () => {
    const { data, problems } = checkRulesData({ version: 1, regions: { north: { weather: {
      rain: [1, 2], fog: Array(12).fill(0.1), flood: 3, hail: [] } } } });
    expect(problems).toEqual([
      "regions.north.weather.rain: must list 12 months, each 0–1",
      "regions.north.weather.flood: must be 0–1",
      "regions.north.weather.hail: unknown",
    ]);
    expect(resolveRules(data, "north", null).weather.rain).toEqual(DEFAULT_CLIMATE.rain);
    expect(resolveRules(data, "north", null).weather.fog).toEqual(Array(12).fill(0.1));
  });

  test("Khon Kaen's year goes through the Thai seasons", () => {
    const record = years(KHON_KAEN, 12345, 400);
    const wet: WeatherKind[] = ["rain", "storm"];
    // The hot season, March and April: mostly sun, a few storms
    expect(share(record, [2, 3], ["sunny"])).toBeGreaterThan(0.6);
    expect(share(record, [2, 3], ["storm"])).toBeGreaterThan(0.03);
    expect(share(record, [2, 3], wet)).toBeLessThan(0.2);
    // The rains, June to September, heaviest in August and September
    expect(share(record, [5, 6, 7, 8], wet)).toBeGreaterThan(0.6);
    expect(share(record, [7, 8], ["storm"])).toBeGreaterThan(0.2);
    expect(share(record, [7, 8], ["storm"])).toBeGreaterThan(share(record, [5, 6], ["storm"]));
    // The cool season, December and January: clear or foggy, hardly ever rain
    expect(share(record, [11, 0], ["sunny", "fog"])).toBeGreaterThan(0.85);
    expect(share(record, [11, 0], ["fog"])).toBeGreaterThan(0.2);
    expect(share(record, [11, 0], wet)).toBeLessThan(0.05);
    // ... and every kind comes in its season
    for (const kind of WEATHER_KINDS) expect(share(record, [...Array(12).keys()], [kind])).toBeGreaterThan(0.02);
    expect(thaiSeason(3, KHON_KAEN)).toBe("hot");
    expect(thaiSeason(7, KHON_KAEN)).toBe("rainy");
    expect(thaiSeason(11, KHON_KAEN)).toBe("cool");
  });

  test("the south's east coast is wettest at the year's end, the Andaman coast in the southwest monsoon", () => {
    const wet: WeatherKind[] = ["rain", "storm"];
    const songkhla = years(climateOf("south", "TH-90"), 7, 300), phuket = years(climateOf("south", "TH-83"), 7, 300);
    expect(share(songkhla, [9, 10, 11], wet)).toBeGreaterThan(share(songkhla, [5, 6, 7], wet));
    expect(share(phuket, [5, 6, 7], wet)).toBeGreaterThan(share(phuket, [9, 10, 11], wet));
  });

  test("it changes gradually: clouds build before the rains, and a storm breaks up into cloud", () => {
    const record = years(KHON_KAEN, 99, 200).flat();
    for (let i = 1; i < record.length; i++) {
      const [before, now] = [record[i - 1], record[i]];
      if (before === "sunny" || before === "fog") expect(now).not.toBe("rain");
      if (before === "storm") expect(["rain", "storm", "overcast"]).toContain(now);
    }
    // Wet draws from a clear sky cloud over, but for a thunderstorm; from cloud they rain
    expect(nextKind("sunny", KHON_KAEN, 7, 0, 0.9)).toBe("overcast");
    expect(nextKind("sunny", KHON_KAEN, 3, 0, 0)).toBe("storm");
    expect(nextKind("overcast", KHON_KAEN, 7, 0, 0.9)).toBe("rain");
    expect(nextKind("overcast", KHON_KAEN, 7, 0, 0)).toBe("storm");
    expect(nextKind("storm", KHON_KAEN, 0, 0.99, 0)).toBe("overcast");
  });

  test("the same city has the same weather, from a stream of its own that leaves Random alone", () => {
    expect(years(KHON_KAEN, 5, 30)).toEqual(years(KHON_KAEN, 5, 30));
    expect(years(KHON_KAEN, 5, 30)).not.toEqual(years(KHON_KAEN, 6, 30));
    Random.seed(42);
    const before = Random.getState();
    years(KHON_KAEN, 5, 5);
    expect(Random.getState()).toBe(before);
    // Each kind's rain, cloud and fog stay in their ranges, and rain washes the smoke out
    let weather = startingWeather(KHON_KAEN, 0, 3);
    for (let i = 0; i < 600; i++) {
      weather = nextWeather(weather, KHON_KAEN, i % 12, i, 0.2);
      for (const value of [weather.rain, weather.cloud, weather.fog, weather.smoke]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(weather.rain > 0).toBe(weather.kind === "rain" || weather.kind === "storm");
      if (weather.kind === "storm") expect(weather.smoke).toBeLessThan(0.05);
      if (weather.kind === "fog") expect(weather.fog).toBeGreaterThan(0.5);
    }
  });

  test("rain fills the ground, a storm floods low land, keeps visitors away and slows the traffic", () => {
    const of = (kind: WeatherKind): Weather => ({ kind, rain: 0, cloud: 0, fog: 0, smoke: 0, seed: 1 });
    const order = WEATHER_KINDS.map(kind => rainRecharge(of(kind), false));
    expect(rainRecharge(of("storm"), false)).toBe(Math.max(...order));
    expect(rainRecharge(of("rain"), false)).toBeGreaterThan(1);
    expect(rainRecharge(of("sunny"), false)).toBeLessThan(rainRecharge(of("overcast"), false));
    // In the dry season only rain or a storm fills it, a little
    expect(rainRecharge(of("overcast"), true)).toBe(0);
    expect(rainRecharge(of("storm"), true)).toBeGreaterThan(0);
    expect(rainRecharge(of("storm"), true)).toBeLessThan(rainRecharge(of("storm"), false));
    expect(weatherFlood(of("storm"), KHON_KAEN)).toBe(KHON_KAEN.flood);
    expect(weatherFlood(of("rain"), KHON_KAEN)).toBe(0);
    expect(weatherVisitors(of("storm"))).toBeLessThan(weatherVisitors(of("rain")));
    expect(weatherVisitors(of("sunny"))).toBe(1);
    expect(weatherTraffic(of("storm"))).toBeGreaterThan(weatherTraffic(of("rain")));
    expect(weatherTraffic(of("sunny"))).toBe(1);
    expect(weatherVisitors(null)).toBe(1);
  });

  test("a saved city's weather is checked as it is read", () => {
    expect(readWeather({ kind: "rain", rain: 0.5, cloud: 0.9, fog: 0, smoke: 0, seed: 7 })).toEqual(
      { kind: "rain", rain: 0.5, cloud: 0.9, fog: 0, smoke: 0, seed: 7 });
    expect(readWeather({ kind: "hail", seed: 7 })).toBeNull();
    expect(readWeather({ kind: "rain", seed: 1.5 })).toBeNull();
    expect(readWeather(null)).toBeNull();
    expect(readWeather({ kind: "fog", rain: "x", cloud: 4, seed: 3 })).toEqual(
      { kind: "fog", rain: 0, cloud: 1, fog: 0, smoke: 0, seed: 3 });
  });

  test("a city chooses its weather each month, saves it and goes on with the same after a load", () => {
    const rules = resolveRules(rulesData, "northeast", "TH-40");
    const map = (MapGenerator as any).fromPresetCells(30, 30, new Uint8Array(30 * 30));
    const core = new CityCore({ map, seed: 11, rules });
    expect(WEATHER_KINDS).toContain(core.map.weather.kind);
    // Each month's weather, read after the step that turned the month (the simulation's listeners are shared by every
    // city, src/eventEmitter.js, so two cities in one test do not listen for their months)
    const kinds = (city: CityCore, steps: number): WeatherKind[] => {
      const out: WeatherKind[] = [];
      let month = city.simulation._cityTime >> 2;
      for (let i = 0; i < steps; i++) {
        city.step();
        if (city.simulation._cityTime >> 2 !== month && (city.simulation._cityTime & 3) === 0 &&
            city.simulation._phaseCycle > 9) {
          month = city.simulation._cityTime >> 2;
          out.push(city.map.weather.kind);
        }
      }
      return out;
    };
    expect(kinds(core, STEPS_PER_YEAR).length).toBeGreaterThanOrEqual(11);
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: 30, height: 30 }));
    expect(saved.weather).toEqual(core.map.weather);

    const first = kinds(core, 2 * STEPS_PER_YEAR);
    const again = new CityCore({ map: new (GameMap as any)(30, 30), saved, rules });
    expect(again.map.weather).toEqual(saved.weather);
    const second = kinds(again, 2 * STEPS_PER_YEAR);
    expect(second).toEqual(first);
    // Two years of Khon Kaen's weather are not one kind
    expect(new Set(first).size).toBeGreaterThan(2);
  });
});
