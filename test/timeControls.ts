/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time bar (src/timeControls.ts; owner, 20 Oct 2026): pause and 1x 2x 3x, each the game's speed command.

import { hasKey, t } from "../src/i18n/index";
import { currentSpeed, HAZE_SHOWN, setSpeed, skyOf, weatherTip } from "../src/timeControls";
import { WEATHER_KINDS, type Weather, type WeatherKind } from "../src/weather";

function game() {
  const commands: { type: "speed"; speed: number }[] = [];
  return { isPaused: false, defaultSpeed: 2, commands, applyCommand(c: { type: "speed"; speed: number }) { commands.push(c); } };
}
const noPage = { getElementById: () => null } as unknown as Document;

describe("time bar", () => {
  test("shows the speed the game runs at, 0 while paused", () => {
    const g = game();
    expect(currentSpeed(g)).toBe(2);
    g.isPaused = true;
    expect(currentSpeed(g)).toBe(0);
  });

  test("each button runs the game at its speed through the speed command, and pause keeps the speed to go on at", () => {
    const g = game();
    setSpeed(g, 3, noPage);
    expect(g).toMatchObject({ isPaused: false, defaultSpeed: 3 });
    setSpeed(g, 0, noPage);
    expect(g).toMatchObject({ isPaused: true, defaultSpeed: 3 });
    expect(currentSpeed({ ...g, isPaused: false })).toBe(3);
    setSpeed(g, 1, noPage);
    expect(g.commands.map(c => c.speed)).toEqual([3, 0, 1]);
    expect(g.commands.every(c => c.type === "speed")).toBe(true);
  });

  test("the clock shows the sky: the sun or moon when clear, else the weather, and haze when the fields burn", () => {
    const w = (kind: WeatherKind, smoke = 0): Weather => ({ kind, rain: 0, cloud: 0, fog: 0, smoke, seed: 1 });
    expect(skyOf(w("sunny"), false)).toEqual({ icon: "sun", word: "weather.kind.sunny" });
    expect(skyOf(w("sunny"), true)).toEqual({ icon: "moon", word: "weather.kind.clear" });
    expect(skyOf(w("sunny", HAZE_SHOWN), false)).toEqual({ icon: "smoke", word: "weather.kind.smoke" });
    expect(skyOf(w("overcast"), true).icon).toBe("cloud");
    expect(skyOf(w("storm"), false)).toEqual({ icon: "storm", word: "weather.kind.storm" });
    expect(skyOf(null, false).icon).toBe("sun");
    for (const kind of WEATHER_KINDS) {
      expect(hasKey(skyOf(w(kind), false).word)).toBe(true);
      expect(hasKey(`weather.effect.${kind}`)).toBe(true);
      expect(hasKey(`weather.month.${kind}`)).toBe(true);
      // The season and the sky now, then the month's character and what it does
      expect(weatherTip(w(kind), 7, undefined, false).split("\n")).toHaveLength(3);
    }
    expect(weatherTip(w("sunny", 0.5), 2, undefined, false).split("\n")).toHaveLength(4);
  });

  test("the word is the sky now, the tooltip also the month's character (src/showers.ts)", () => {
    const w = (kind: WeatherKind): Weather => ({ kind, rain: kind === "rain" ? 0.4 : 0, cloud: 0.3, fog: 0, smoke: 0, seed: 1 });
    // A rainy month between its showers: a clear sky now, and a rainy month when pointed at
    const tip = weatherTip(w("sunny"), 7, undefined, false, w("rain")).split("\n");
    expect(tip[0]).toContain(t("weather.kind.sunny"));
    expect(tip[1]).toBe(t("weather.month.rain"));
    expect(tip[2]).toBe(t("weather.effect.rain"));
  });
});
