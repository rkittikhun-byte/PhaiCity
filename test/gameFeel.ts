/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How the game feels (src/gameFeel.ts, docs/GAME_DESIGN.md 19): the owner's numbers in data/game-feel.json, checked, with
// the game's own where the file is missing or wrong; and the player's length of a day (src/dayLength.ts), which turns
// the clock faster or slower and leaves the calendar alone.

import * as fs from "fs";
import * as path from "path";
import { CityCore } from "../src/core/cityCore";
import { DAY_SECONDS, DayClock, daySeconds, NIGHT_PACE } from "../src/dayClock";
import { bindDayLengthSetting, DAY_LENGTHS, dayLengthFactor, getDayLength, setDayLength } from "../src/dayLength";
import { edgeBand, edgeScroll } from "../src/edgeScroll";
import {
  checkFeelData, DEFAULT_FEEL, FEEL_FIELDS, feelValue, gameFeel, loadGameFeel, resetGameFeel, setGameFeel,
} from "../src/gameFeel";
import { MapGenerator } from "../src/mapGenerator.js";
import { easeLook, CLEAR_LOOK } from "../src/render3d/city/weather";
import { nearPose, presetOf } from "../src/smartCamera";

const root = path.join(__dirname, "..");

afterEach(() => {
  resetGameFeel();
  setDayLength("normal");
});

describe("the feel file", () => {
  test("data/game-feel.json passes the check and holds every number", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(root, "data/game-feel.json"), "utf8"));
    expect(checkFeelData(raw).problems).toEqual([]);
    for (const f of FEEL_FIELDS) expect(typeof feelValue(raw, f.path)).toBe("number");
  });

  test("the game's own numbers lie in their ranges, and the clock's old names are them", () => {
    expect(checkFeelData(DEFAULT_FEEL).problems).toEqual([]);
    expect(DAY_SECONDS).toEqual({ 1: 480, 2: 360, 3: 240 });
    expect(NIGHT_PACE).toBe(2);
    for (const f of FEEL_FIELDS) expect(f.min).toBeLessThan(f.max);
  });

  test("a missing or bad file plays as the game comes", () => {
    for (const raw of [null, undefined, 3, "x", [1, 2]]) {
      const { data, problems } = checkFeelData(raw);
      expect(problems.length).toBe(1);
      expect(data).toEqual(DEFAULT_FEEL);
    }
    expect(checkFeelData({})).toEqual({ data: DEFAULT_FEEL, problems: [] });
  });

  test("a wrong number names itself and stays the game's own; the rest is used", () => {
    const { data, problems } = checkFeelData({
      _note: "notes are fine",
      day: { seconds1x: 600, seconds2x: -5, nightPace: "fast" },
      weather: { fog: 99 },
      camera: { paint: { widthM: 500 }, lens: 3 },
      edge: 4,
      extra: { a: 1 },
    });
    expect(data.day.seconds1x).toBe(600);
    expect(data.camera.paint.widthM).toBe(500);
    expect(data.day.seconds2x).toBe(DEFAULT_FEEL.day.seconds2x);
    expect(data.day.nightPace).toBe(DEFAULT_FEEL.day.nightPace);
    expect(data.weather.fog).toBe(DEFAULT_FEEL.weather.fog);
    expect(data.edge).toEqual(DEFAULT_FEEL.edge);
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining("day.seconds2x"), expect.stringContaining("day.nightPace"),
      expect.stringContaining("weather.fog"), expect.stringContaining("camera.lens"), expect.stringContaining("edge:"),
      expect.stringContaining("extra"),
    ]));
    expect(problems.length).toBe(6);
  });

  test("the game reads the file when it opens, and keeps its own when it cannot", async () => {
    const realFetch = (global as any).fetch, warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      (global as any).fetch = async () => ({ ok: true, json: async () => ({ day: { seconds1x: 900 }, edge: { bandPx: 999 } }) });
      await loadGameFeel();
      expect(gameFeel().day.seconds1x).toBe(900);
      expect(gameFeel().edge.bandPx).toBe(DEFAULT_FEEL.edge.bandPx);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("edge.bandPx"));
      resetGameFeel();
      (global as any).fetch = async () => ({ ok: false, status: 404 });
      await loadGameFeel();
      expect(gameFeel()).toEqual(DEFAULT_FEEL);
      (global as any).fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } });
      await loadGameFeel();
      expect(gameFeel()).toEqual(DEFAULT_FEEL);
    } finally {
      (global as any).fetch = realFetch;
      warn.mockRestore();
    }
  });

  test("the admin endpoint saves through the same check", () => {
    const server = fs.readFileSync(path.join(root, "scripts/admin/adminServer.mjs"), "utf8");
    expect(server).toContain("checkFeelData");
    expect(server).toContain("game-feel.json");
  });
});

describe("the feel in play", () => {
  test("the day's length and the night's pace move the clock", () => {
    const at = (feel: unknown): number => {
      setGameFeel(feel);
      const clock = new DayClock(9);
      clock.advance(1, 1, 3);
      return clock.hour - 9;
    };
    const normal = at({}), twice = at({ day: { seconds1x: 960 } });
    expect(twice).toBeCloseTo(normal / 2, 6);
    // A faster night leaves less of the day's seconds to the night, so the daylight hours go slower
    expect(at({ day: { nightPace: 4 } })).toBeLessThan(normal);
  });

  test("the weather eases at the owner's rates", () => {
    const after = (feel: unknown): number => {
      setGameFeel(feel);
      const look = { ...CLEAR_LOOK };
      easeLook(look, { kind: "rain", cloud: 0.9, rain: 0.8, fog: 0, smoke: 0 } as any, 1, Math.PI / 2);
      return look.cloud;
    };
    expect(after({ weather: { cloud: 1 } })).toBeGreaterThan(after({}));
  });

  test("the camera's presets, its stillness and the edge follow the feel", () => {
    setGameFeel({ camera: { build: { pitchDeg: 30, widthM: 1000 }, stillPitchDeg: 20 }, edge: { bandPx: 30, edgePx: 0 } });
    expect(presetOf("build")).toEqual({ pitchDeg: 30, widthM: 1000 });
    expect(presetOf("paint").alongRoad).toBe(true);
    const pose = { heading: 0, pitch: 0.5, distance: 100, x: 0, z: 0 };
    expect(nearPose(pose, { pitch: 0.5 + 15 * Math.PI / 180 })).toBe(true);
    expect(edgeBand(20, 300, 1000, 600, 0.05).dx).toBeGreaterThan(0);
    expect(edgeScroll(1, 300, 1000, 600, 0.05)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("the player's length of a day", () => {
  test("short, normal and long are half, once and twice the owner's day", () => {
    expect(DAY_LENGTHS).toEqual({ short: 0.5, normal: 1, long: 2 });
    expect(getDayLength()).toBe("normal");
    setDayLength("long");
    expect(dayLengthFactor()).toBe(2);
    expect(daySeconds(1)).toBe(DEFAULT_FEEL.day.seconds1x * 2);
    setDayLength("nonsense" as any);
    expect(getDayLength()).toBe("long");
  });

  test("turns the clock faster or slower", () => {
    const hours = (length: "short" | "normal" | "long"): number => {
      setDayLength(length);
      const clock = new DayClock(9);
      clock.advance(1, 2, 3);
      return clock.hour - 9;
    };
    const normal = hours("normal");
    expect(hours("short")).toBeCloseTo(normal * 2, 6);
    expect(hours("long")).toBeCloseTo(normal / 2, 6);
  });

  test("leaves the calendar alone", () => {
    const calendar = (length: "short" | "long"): { year: number; month: number } => {
      setDayLength(length);
      const map = (MapGenerator as any).fromPresetCells(41, 33, new Uint8Array(41 * 33));
      const core = new CityCore({ sandbox: true, map, seed: 5 });
      const clock = new DayClock(9);
      for (let i = 0; i < 60; i++) {
        core.step();
        clock.advance(0.05, 2, core.simulation.getDate().month);
      }
      const { year, month } = core.simulation.getDate();
      return { year, month };
    };
    expect(calendar("short")).toEqual(calendar("long"));
  });

  test("the settings window's choices show it and change it", () => {
    const inputs = ["short", "normal", "long"].map((value) => {
      const handlers: (() => void)[] = [];
      return { value, checked: false, addEventListener: (_: string, handler: () => void) => handlers.push(handler), handlers };
    });
    const doc = { querySelectorAll: () => inputs } as unknown as Document;
    bindDayLengthSetting(doc);
    expect(inputs.map((input) => input.checked)).toEqual([false, true, false]);
    inputs[2].checked = true;
    inputs[2].handlers.forEach((handler) => handler());
    expect(getDayLength()).toBe("long");
    setDayLength("short");
    expect(inputs.map((input) => input.checked)).toEqual([true, false, false]);
  });
});
