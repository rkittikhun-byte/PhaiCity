/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The sky now (src/showers.ts): the month's weather as showers by the clock's hour (owner, 21 Oct 2026: "ฝนตกบ่อย
// เกินไปมากๆ"). Rainy months rain some of the time, mostly in the afternoon and evening; the simulation keeps the month's.

import * as fs from "fs";
import * as path from "path";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { DayClock, isNight } from "../src/dayClock";
import { MapGenerator } from "../src/mapGenerator.js";
import { checkRulesData, resolveRules } from "../src/provinceRules";
import { Random } from "../src/random";
import { CLOUDS_BUILD, ShowerSky, showersOfDay, skyAt } from "../src/showers";
import { nextWeather, startingWeather, type Weather, type WeatherKind } from "../src/weather";

const month = (kind: WeatherKind, seed = 12345): Weather => Object.freeze({
  kind, seed, rain: kind === "storm" ? 0.9 : kind === "rain" ? 0.45 : 0,
  cloud: kind === "storm" ? 1 : kind === "rain" ? 0.9 : kind === "overcast" ? 0.75 : 0.2,
  fog: kind === "fog" ? 0.8 : 0, smoke: 0,
});

/**
 * The share of the time it rains on screen over many days of one kind of month in August, counted as the player sees
 * it: the night passes twice as fast as the day (src/dayClock.ts NIGHT_PACE), and the share of the rain after noon
 */
function rainShare(weather: Weather, days = 150): { share: number; afternoon: number; dryDays: number } {
  let wet = 0, all = 0, late = 0, rainy = 0, dryDays = 0;
  for (let day = 0; day < days; day++) {
    let any = false;
    for (let hour = 0; hour < 24; hour += 0.25) {
      const sky = skyAt(weather, day, hour, 7)!;
      const weight = isNight(hour, 7) ? 0.5 : 1;
      all += weight;
      if (sky.rain > 0) { wet += weight; rainy++; any = true; if (hour >= 12) late++; }
    }
    if (!any) dryDays++;
  }
  return { share: wet / all, afternoon: rainy ? late / rainy : 0, dryDays: dryDays / days };
}

describe("showers", () => {
  test("a rainy month rains 10–20% of the time and a stormy one 25–35%, mostly after noon, with dry days", () => {
    for (const seed of [1, 777, 12345]) {
      const rain = rainShare(month("rain", seed)), storm = rainShare(month("storm", seed));
      expect(rain.share).toBeGreaterThan(0.1);
      expect(rain.share).toBeLessThan(0.2);
      expect(storm.share).toBeGreaterThan(0.25);
      expect(storm.share).toBeLessThan(0.35);
      expect(rain.afternoon).toBeGreaterThan(0.75);
      expect(storm.afternoon).toBeGreaterThan(0.7);
      expect(rain.dryDays).toBeGreaterThan(0.05);
      expect(storm.dryDays).toBeLessThan(rain.dryDays);
    }
    for (const kind of ["sunny", "overcast", "fog"] as const) expect(rainShare(month(kind), 60).share).toBe(0);
  });

  test("the same day has the same showers, from the city's weather seed alone, and Random is left alone", () => {
    Random.seed(42);
    const before = Random.getState();
    expect(showersOfDay(9, 40, "rain")).toEqual(showersOfDay(9, 40, "rain"));
    expect(skyAt(month("storm", 9), 40, 15.5, 7)).toEqual(skyAt(month("storm", 9), 40, 15.5, 7));
    const days = (seed: number) => Array.from({ length: 30 }, (_, day) => showersOfDay(seed, day, "rain"));
    expect(days(9)).not.toEqual(days(10));
    expect(Random.getState()).toBe(before);
    // Each shower lasts an hour and a half to five, inside its day's slots
    for (const s of Array.from({ length: 200 }, (_, day) => showersOfDay(3, day, "storm")).flat()) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(1.5);
      expect(s.end - s.start).toBeLessThanOrEqual(5);
      expect(s.storm).toBe(true);
    }
  });

  test("it reads rain or storm only while a shower falls, lightning only in one; clouds build before and part after", () => {
    const storm = month("storm", 5);
    const shower = Array.from({ length: 50 }, (_, day) => showersOfDay(5, day, "storm")).flat()
      .find((s) => s.start % 24 > 14 && s.start % 24 < 16)!;
    const at = (time: number) => skyAt(storm, Math.floor(time / 24), time % 24, 7)!;
    const during = at(shower.start + 0.5);
    expect(during.kind).toBe("storm");
    expect(during.rain).toBeGreaterThan(0.5);
    expect(during.cloud).toBe(1);
    // An hour before, the clouds have built most of the way and it is not yet raining
    const building = at(shower.start - CLOUDS_BUILD * 0.3);
    expect(building.rain).toBe(0);
    expect(building.kind).toBe("overcast");
    expect(building.cloud).toBeGreaterThan(0.75);
    // Long before and long after, a fair sky
    for (let day = 0; day < 50; day++) {
      for (let hour = 0; hour < 24; hour += 0.5) {
        const sky = skyAt(storm, day, hour, 7)!;
        expect(sky.rain > 0).toBe(sky.kind === "rain" || sky.kind === "storm");
        expect(["sunny", "overcast", "storm"]).toContain(sky.kind);
      }
    }
    // The month itself is never changed
    expect(storm.kind).toBe("storm");
    // A rainy month's showers are rain, without thunder
    expect(Array.from({ length: 50 }, (_, day) => showersOfDay(5, day, "rain")).flat().every((s) => !s.storm)).toBe(true);
  });

  test("a foggy month's fog hangs at dawn and through the night, not at noon", () => {
    const fog = month("fog");
    expect(skyAt(fog, 3, 6.8, 0)!.kind).toBe("fog");
    expect(skyAt(fog, 3, 4, 0)!.kind).toBe("fog");
    expect(skyAt(fog, 3, 12, 0)!.kind).toBe("sunny");
    expect(skyAt(fog, 3, 12, 0)!.fog).toBe(0.8); // (the 3D view thins the month's fog by the hour itself)
    expect(skyAt(month("overcast"), 3, 12, 0)!.kind).toBe("overcast");
    expect(skyAt(month("sunny"), 3, 12, 0)!.kind).toBe("sunny");
    expect(skyAt(null, 3, 12, 0)).toBeNull();
  });

  test("a shower that has begun goes on when the month turns dry, and the clock set back starts afresh", () => {
    const rain = month("rain", 21), overcast = { ...month("overcast", 21) };
    const shower = Array.from({ length: 50 }, (_, day) => showersOfDay(21, day, "rain")).flat()
      .find((s) => s.end - s.start > 2)!;
    const day = Math.floor(shower.start / 24), hour = (time: number) => time - day * 24;
    const sky = new ShowerSky();
    expect(sky.now(rain, day, hour(shower.start + 0.2), 7)!.kind).toBe("rain");
    // The month turns overcast under the shower: it rains on to its end, then the clouds part
    expect(sky.now(overcast, day, hour(shower.start + 1), 7)!.kind).toBe("rain");
    expect(sky.now(overcast, day, hour(shower.end - 0.1), 7)!.rain).toBeGreaterThan(0);
    expect(sky.now(overcast, day, hour(shower.end + 0.1), 7)!.rain).toBe(0);
    // Read afresh (a city loaded), an overcast month has no shower to hold
    const fresh = new ShowerSky();
    expect(fresh.now(overcast, day, hour(shower.start + 1), 7)!.kind).toBe("overcast");
    // ... and nor has the first after the clock goes back
    expect(sky.now(overcast, day, hour(shower.start + 0.5), 7)!.kind).toBe("overcast");
  });

  test("the clock counts its days, and a day's end turns it over", () => {
    const clock = new DayClock(23.9, 4);
    for (let i = 0; i < 60; i++) clock.advance(0.5, 3, 7);
    expect(clock.day).toBe(5);
    expect(clock.hour).toBeLessThan(23.9);
    expect(new DayClock(8, -2).day).toBe(0);
    expect(new DayClock(8, 2.5).day).toBe(0);
  });

  test("the simulation keeps the month's weather: a city read by the sky every step is the same city", () => {
    const rulesFile = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "province-rules.json"), "utf8"));
    const rules = resolveRules(checkRulesData(rulesFile).data, "northeast", "TH-40");
    const city = () => new CityCore({ map: (MapGenerator as any).fromPresetCells(24, 24, new Uint8Array(24 * 24)), seed: 7, rules });
    const plain = city();
    plain.run(STEPS_PER_YEAR);
    const plainSave = JSON.stringify(plain.save()), plainRandom = Random.getState();
    const watched = city(), sky = new ShowerSky();
    for (let i = 0; i < STEPS_PER_YEAR; i++) {
      watched.step();
      sky.now(watched.map.weather, Math.floor(i / 20), (i % 20) * 1.2, i % 12);
    }
    expect(JSON.stringify(watched.save())).toBe(plainSave);
    expect(Random.getState()).toBe(plainRandom);
    // ... and the months' weather is what it was before the showers came (the same seed, the same two years)
    let weather = startingWeather(rules.weather, 0, 12345);
    const kinds: WeatherKind[] = [];
    for (let m = 0; m < 24; m++) kinds.push((weather = nextWeather(weather, rules.weather, m % 12, m)).kind);
    expect(kinds.join(" ")).toBe(GOLDEN_KINDS);
  });
});

/** Khon Kaen's first two years for seed 12345, as src/weather.ts chose them before the showers (21 Oct 2026) */
const GOLDEN_KINDS = "fog sunny sunny overcast rain sunny storm storm storm overcast fog sunny sunny sunny storm overcast storm rain rain rain storm rain sunny sunny";
