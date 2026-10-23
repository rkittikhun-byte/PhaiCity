/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The moon (src/moon.ts) and the light of the sky (src/render3d/city/skyLight.ts; docs/GAME_DESIGN.md 20): its phase by
// the clock's days, its path across the night, the sun's light handed to the moon's at dusk without a jump, and no
// shadows in the rain.

import { DayClock } from "../src/dayClock";
import { DEFAULT_FEEL } from "../src/gameFeel";
import { lunarDay, moonAngle, moonDayAt, moonLit, moonPhase, SYNODIC_DAYS } from "../src/moon";
import { skyLight, weatherShadow } from "../src/render3d/city/skyLight";
import { CLEAR_LOOK, type WeatherLook } from "../src/render3d/city/weather";

const moon = DEFAULT_FEEL.moon;
const clear: WeatherLook = { ...CLEAR_LOOK };
const rain: WeatherLook = { cloud: 0.95, storm: 0, rain: 0.7, fog: 0, smoke: 0, wet: 0.5, flash: 0 };

describe("the moon's phase", () => {
  test("comes from the real sky for a city's first month: Loy Krathong's full moon of 15 November 2024", () => {
    expect(moonPhase(moonDayAt(2024, 10))).toBeCloseTo(0.5, 1);
    // ... and a new moon on 1 November 2024
    const early = moonPhase(moonDayAt(2024, 10) - 14);
    expect(Math.min(early, 1 - early)).toBeLessThan(0.05);
  });

  test("waxes to the full and wanes to the new in 29.5 of the clock's days", () => {
    expect(moonPhase(0)).toBe(0);
    expect(moonPhase(SYNODIC_DAYS / 2)).toBeCloseTo(0.5, 6);
    expect(moonLit(0)).toBeCloseTo(0, 6);
    expect(moonLit(0.5)).toBeCloseTo(1, 6);
    expect(lunarDay(0.5 - 1e-6)).toEqual({ waxing: true, day: 15 });
    expect(lunarDay(0.25).waxing).toBe(true);
    expect(lunarDay(0.75)).toEqual({ waxing: false, day: 7 });
  });

  test("the clock counts its days, and the phase moves a day's worth a day", () => {
    const clock = new DayClock(23, 10);
    const before = clock.moonPhase();
    for (let i = 0; i < 40; i++) clock.advance(0.25, 3, 3);
    expect(clock.days).toBe(11);
    expect(clock.moonPhase() - before).toBeGreaterThan(0);
    expect(clock.moonPhase() - before).toBeLessThan(1.5 / SYNODIC_DAYS);
  });
});

describe("the moon's path", () => {
  test("a full moon rises at dusk, is highest at midnight and sets at dawn", () => {
    expect(moonAngle(18, 0.5)).toBeCloseTo(0, 6);
    expect(moonAngle(0, 0.5)).toBeCloseTo(Math.PI / 2, 6);
    expect(moonAngle(6, 0.5)).toBeCloseTo(Math.PI, 6);
    expect(Math.sin(moonAngle(12, 0.5))).toBeLessThan(0);
  });

  test("a new moon keeps the sun's company, a first quarter is highest at dusk", () => {
    expect(Math.sin(moonAngle(12, 0))).toBeCloseTo(1, 6);
    expect(Math.sin(moonAngle(0, 0))).toBeLessThan(0);
    expect(moonAngle(18, 0.25)).toBeCloseTo(Math.PI / 2, 6);
  });

  test("it rises about 49 minutes later each day", () => {
    const riseHour = (phase: number): number => (6 + 24 * phase) % 24;
    const later = (riseHour(0.3 + 1 / SYNODIC_DAYS) - riseHour(0.3)) * 60;
    expect(later).toBeGreaterThan(48);
    expect(later).toBeLessThan(50);
  });
});

describe("the light of the sky", () => {
  test("by day the sun's, by a full-moon night the moon's, cooler and softer", () => {
    const noon = skyLight(Math.PI / 2, -Math.PI / 2, 0.5, clear, moon);
    expect(noon.moonShare).toBe(0);
    expect(noon.angle).toBeCloseTo(Math.PI / 2, 6);
    expect(noon.shadow).toBe(1);
    const midnight = skyLight(-Math.PI / 2, Math.PI / 2, 0.5, clear, moon);
    expect(midnight.moonShare).toBe(1);
    expect(midnight.angle).toBeCloseTo(Math.PI / 2, 6);
    expect(midnight.intensity).toBeCloseTo(moon.fullLight * (1 - 0.85 * 0), 1);
    expect(midnight.shadow).toBeCloseTo(moon.shadow, 6);
  });

  test("a new-moon night has no moonlight and no shadows", () => {
    const night = skyLight(-Math.PI / 2, -Math.PI / 2, 0, clear, moon);
    expect(night.intensity).toBe(0);
    expect(night.shadow).toBe(0);
  });

  test("goes over from the sun to the moon at dusk without a jump", () => {
    // A full moon rising in the east as the sun sets in the west: the sun's angle runs past π, the moon's past 0
    let last = skyLight(Math.PI * 0.9, Math.PI * -0.1, 0.5, clear, moon);
    // (800 steps over about an hour and a half of the clock: a step is about a twentieth of a second at 1x)
    for (let step = 1; step <= 800; step++) {
      const t = step / 800, sun = Math.PI * (0.9 + 0.3 * t), moonAt = Math.PI * (-0.1 + 0.3 * t);
      const now = skyLight(sun, moonAt, 0.5, clear, moon, last.angle);
      expect(Math.abs(now.intensity - last.intensity)).toBeLessThan(0.05);
      expect(Math.abs(now.shadow - last.shadow)).toBeLessThan(0.03);
      // (where the light comes from moves only a little a step, or not at all while it is dark)
      const turn = Math.abs(Math.atan2(Math.sin(now.angle - last.angle), Math.cos(now.angle - last.angle)));
      if (now.intensity > 0.02 && last.intensity > 0.02) expect(turn).toBeLessThan(0.01);
      last = now;
    }
    expect(last.moonShare).toBe(1);
  });

  test("rain, a storm, an overcast sky and thick fog take the shadows away", () => {
    expect(weatherShadow(clear)).toBe(1);
    expect(weatherShadow(rain)).toBe(0);
    expect(skyLight(Math.PI / 2, -Math.PI / 2, 0.5, rain, moon).shadow).toBe(0);
    expect(weatherShadow({ ...clear, cloud: 0.85 })).toBe(0);
    expect(weatherShadow({ ...clear, storm: 0.6 })).toBe(0);
    expect(weatherShadow({ ...clear, fog: 0.7 })).toBe(0);
    // ... and give them back as it clears, a little at a time
    expect(weatherShadow({ ...clear, cloud: 0.55 })).toBeGreaterThan(0);
    expect(weatherShadow({ ...clear, cloud: 0.55 })).toBeLessThan(1);
  });
});
