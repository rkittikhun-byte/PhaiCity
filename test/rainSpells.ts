/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rain spells (src/rainSpells.ts): the rain the player sees, two or three spells an era (owner, 21 Oct 2026: "ทุกอย่าง
// มันเร็วไป ทั้งฝนตก เทศกาล เอาในแต่ละยุค มี 2-3 ครั้งกำลังดี"), while the simulation keeps the month's weather.

import * as fs from "fs";
import * as path from "path";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import * as Messages from "../src/messages";
import { checkRulesData, type Climate, resolveRules } from "../src/provinceRules";
import { Random } from "../src/random";
import { RAIN_SPELLS, skyAt, spellBeginning, spellsOfBlock, stormDuring } from "../src/rainSpells";
import { nextWeather, startingWeather, type Weather, type WeatherKind } from "../src/weather";

const rulesFile = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "province-rules.json"), "utf8"));
const rules = resolveRules(checkRulesData(rulesFile).data, "northeast", "TH-40");
const KHON_KAEN: Climate = rules.weather;
const BLOCK_WEEKS = RAIN_SPELLS.years * 48;

const month = (kind: WeatherKind, seed = 12345): Weather => Object.freeze({
  kind, seed, rain: kind === "storm" ? 0.9 : kind === "rain" ? 0.45 : 0,
  cloud: kind === "storm" ? 1 : kind === "rain" ? 0.9 : kind === "overcast" ? 0.75 : 0.2,
  fog: kind === "fog" ? 0.8 : 0, smoke: 0,
});

describe("rain spells", () => {
  test("two or three spells in each era's three years, at most one a storm, nearly all in the rainy season", () => {
    let spells = 0, rainy = 0, stormBlocks = 0;
    for (const seed of [1, 777, 12345]) {
      for (let block = 0; block < 200; block++) {
        const list = spellsOfBlock(seed, block, KHON_KAEN);
        expect(list.length).toBeGreaterThanOrEqual(2);
        expect(list.length).toBeLessThanOrEqual(3);
        const storms = list.filter((s) => s.storm).length;
        expect(storms).toBeLessThanOrEqual(1);
        stormBlocks += storms;
        for (const s of list) {
          expect(s.start).toBeGreaterThanOrEqual(block * BLOCK_WEEKS);
          expect(s.start).toBeLessThan((block + 1) * BLOCK_WEEKS);
          expect(s.end - s.start).toBeGreaterThanOrEqual(4);
          expect(s.end - s.start).toBeLessThanOrEqual(7);
          const m = Math.floor(s.start / 4) % 12;
          spells++;
          if (m >= 4 && m <= 9) rainy++;
        }
      }
    }
    expect(spells / 600).toBeGreaterThan(2.3);
    expect(spells / 600).toBeLessThan(2.7);
    expect(rainy / spells).toBeGreaterThan(0.85);
    expect(stormBlocks / 600).toBeGreaterThan(0.5);
    expect(stormBlocks / 600).toBeLessThan(0.7);
  });

  test("the sky rains only in a spell: a few weeks in each three years, whatever the month's weather", () => {
    for (const kind of ["rain", "storm", "sunny", "overcast"] as const) {
      let wet = 0, all = 0;
      for (let week = 0; week < 30 * 48; week += 0.25) {
        const sky = skyAt(month(kind, 9), KHON_KAEN, week, 14, Math.floor(week / 4) % 12)!;
        all++;
        if (sky.rain > 0) wet++;
        expect(sky.rain > 0).toBe(sky.kind === "rain" || sky.kind === "storm");
      }
      expect(wet / all).toBeGreaterThan(0.03);
      expect(wet / all).toBeLessThan(0.1);
    }
  });

  test("the same city has the same spells, from its weather seed alone, and Random is left alone", () => {
    Random.seed(42);
    const before = Random.getState();
    expect(spellsOfBlock(9, 4, KHON_KAEN)).toEqual(spellsOfBlock(9, 4, KHON_KAEN));
    expect(skyAt(month("storm", 9), KHON_KAEN, 300.5, 15, 3)).toEqual(skyAt(month("storm", 9), KHON_KAEN, 300.5, 15, 3));
    const blocks = (seed: number) => Array.from({ length: 10 }, (_, b) => spellsOfBlock(seed, b, KHON_KAEN));
    expect(blocks(9)).not.toEqual(blocks(10));
    expect(Random.getState()).toBe(before);
  });

  test("clouds gather before a spell and part after; a storm spell storms, and floods come only with it", () => {
    const seed = 5, spells = Array.from({ length: 20 }, (_, b) => spellsOfBlock(seed, b, KHON_KAEN)).flat();
    const storm = spells.find((s) => s.storm)!, rain = spells.find((s) => !s.storm)!;
    const at = (week: number) => skyAt(month("sunny", seed), KHON_KAEN, week, 12, Math.floor(week / 4) % 12)!;
    expect(at(storm.start + 0.5).kind).toBe("storm");
    expect(at(storm.start + 0.5).cloud).toBe(1);
    expect(at(rain.start + 0.5).kind).toBe("rain");
    // A quarter of a week before, the clouds have gathered and it is not yet raining; long before, a fair sky
    const gathering = at(rain.start - RAIN_SPELLS.build * 0.25);
    expect(gathering.rain).toBe(0);
    expect(gathering.kind).toBe("overcast");
    expect(at(rain.start - 6).cloud).toBe(0.2);
    expect(at(rain.end + 0.2).rain).toBe(0);
    expect(at(rain.end + 0.2).cloud).toBeGreaterThan(0.6);
    // Floods: only in the weeks of a storm spell
    expect(stormDuring(seed, KHON_KAEN, storm.start, storm.start + 1)).toBe(true);
    expect(stormDuring(seed, KHON_KAEN, rain.start, rain.start + 1)).toBe(rain.start < storm.end && rain.end > storm.start);
    expect(spellBeginning(seed, KHON_KAEN, rain.start, rain.start + 1)).toEqual(rain);
  });

  test("a foggy month's fog hangs at dawn and through the night; a wet month's dry weeks are fair or cloudy", () => {
    const quiet = 2000 * 48; // (a week far from any spell is found below)
    let week = quiet;
    while (skyAt(month("rain"), KHON_KAEN, week, 12, 0)!.cloud !== 0.45) week += 1;
    expect(skyAt(month("fog"), KHON_KAEN, week, 6.8, 0)!.kind).toBe("fog");
    expect(skyAt(month("fog"), KHON_KAEN, week, 12, 0)!.kind).toBe("sunny");
    expect(skyAt(month("rain"), KHON_KAEN, week, 12, 0)!.kind).toBe("sunny");
    expect(skyAt(month("storm"), KHON_KAEN, week, 12, 0)!.kind).toBe("overcast");
    expect(skyAt(month("overcast"), KHON_KAEN, week, 12, 0)!.kind).toBe("overcast");
    expect(skyAt(null, KHON_KAEN, week, 12, 0)).toBeNull();
  });

  test("the weather news comes only with a spell, and the months' weather is what it was", () => {
    const core = new CityCore({ map: (MapGenerator as any).fromPresetCells(24, 24, new Uint8Array(24 * 24)), seed: 7, rules });
    const news: { subject: string; week: number }[] = [];
    core.simulation.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => {
      if (m.subject === Messages.HEAVY_STORM || m.subject === Messages.FIRST_RAINS) {
        news.push({ subject: m.subject, week: (core.simulation._cityTime >> 2) * 4 });
      }
    });
    const from = core.simulation._cityTime;
    core.run(6 * STEPS_PER_YEAR);
    const seed = core.map.weather.seed;
    let begun = 0;
    for (let week = Math.ceil(from / 4) * 4; week < core.simulation._cityTime; week += 4) {
      if (spellBeginning(seed, KHON_KAEN, week, week + 4)) begun++;
    }
    expect(news.length).toBeGreaterThan(0);
    expect(news.length).toBeLessThanOrEqual(begun);
    for (const item of news) {
      const spell = spellBeginning(seed, KHON_KAEN, item.week, item.week + 4);
      expect(spell).not.toBeNull();
      expect(item.subject).toBe(spell!.storm ? Messages.HEAVY_STORM : Messages.FIRST_RAINS);
    }
    // The months' weather for the same seed, as src/weather.ts chose it before the spells
    let weather = startingWeather(KHON_KAEN, 0, 12345);
    const kinds: WeatherKind[] = [];
    for (let m = 0; m < 24; m++) kinds.push((weather = nextWeather(weather, KHON_KAEN, m % 12, m)).kind);
    expect(kinds.join(" ")).toBe(GOLDEN_KINDS);
  });
});

/** Khon Kaen's first two years for seed 12345, as src/weather.ts chose them before the rain spells (21 Oct 2026) */
const GOLDEN_KINDS = "fog sunny sunny overcast rain sunny storm storm storm overcast fog sunny sunny sunny storm overcast storm rain rain rain storm rain sunny sunny";
