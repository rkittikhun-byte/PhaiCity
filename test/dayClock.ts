/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time of day (src/dayClock.ts; owner, 20 Oct 2026, design A): it runs with the game, stands when paused, goes
// faster at a faster speed, the night quicker than the day, and the sun rises and sets at the month's hours.

import { clockText, DAY_SECONDS, DayClock, isNight, NIGHT_PACE, sunAngle, sunHours } from "../src/dayClock";

describe("time of day", () => {
  test("the sun rises earlier and sets later in the hot months than in the cool ones, as in Thailand", () => {
    const june = sunHours(5), december = sunHours(11);
    expect(june.rise).toBeLessThan(december.rise);
    expect(june.set).toBeGreaterThan(december.set);
    for (let month = 0; month < 12; month++) {
      const { rise, set } = sunHours(month);
      expect(rise).toBeGreaterThan(5.5); expect(rise).toBeLessThan(7);
      expect(set).toBeGreaterThan(17.5); expect(set).toBeLessThan(19);
    }
  });

  test("the sun stands at 0 when it rises, highest at midday, at π when it sets, under the ground at night", () => {
    const { rise, set } = sunHours(3);
    expect(sunAngle(rise, 3)).toBeCloseTo(0, 6);
    expect(sunAngle((rise + set) / 2, 3)).toBeCloseTo(Math.PI / 2, 6);
    expect(sunAngle(set, 3)).toBeCloseTo(Math.PI, 6);
    expect(Math.sin(sunAngle(0, 3))).toBeLessThan(0);
    expect(isNight(0, 3)).toBe(true);
    expect(isNight(12, 3)).toBe(false);
  });

  test("stands while the game is paused and runs faster at a faster speed", () => {
    const clock = new DayClock(9);
    clock.advance(10, 0, 3);
    expect(clock.hour).toBe(9);
    const slow = new DayClock(9), fast = new DayClock(9);
    slow.advance(10, 1, 3);
    fast.advance(10, 3, 3);
    expect(fast.hour - 9).toBeCloseTo((slow.hour - 9) * DAY_SECONDS[1] / DAY_SECONDS[3], 6);
  });

  test("a whole day takes its speed's real seconds, the night going by quicker than the day", () => {
    const clock = new DayClock(0), seconds = DAY_SECONDS[2];
    let spent = 0, night = 0;
    for (let i = 0; i < seconds * 10 - 1; i++) {
      if (clock.night(3)) night++;
      clock.advance(0.1, 2, 3);
      spent += 0.1;
    }
    // Back round to near midnight after the day's seconds
    expect(Math.min(clock.hour, 24 - clock.hour)).toBeLessThan(0.1);
    // The night is about half the hours but takes far less than half the time
    const { rise, set } = sunHours(3), nightHours = 24 - (set - rise);
    expect(night / (seconds * 10)).toBeCloseTo((nightHours / NIGHT_PACE) / ((set - rise) + nightHours / NIGHT_PACE), 1);
    expect(spent).toBeCloseTo(seconds, 0);
  });

  test("reads as a clock", () => {
    expect(clockText(6 + 42 / 60)).toBe("06:42");
    expect(clockText(23.999)).toBe("23:59");
    expect(new DayClock(30).text()).toBe("06:00");
  });
});
