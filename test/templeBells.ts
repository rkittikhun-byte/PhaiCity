/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The temple bell (src/audio/templeBells.ts, docs/GAME_DESIGN.md 9.5): at dawn and dusk, with a temple on screen, on
// about a third of the days, once each; never at other hours, never with no temple in view.

import { BELL_CHANCE, TempleBells, templeInView } from "../src/audio/templeBells";
import { sunHours } from "../src/dayClock";
import { SOUNDS } from "../src/audio/catalog";

/** Rings over `days` days of the clock asked every 0.2 hours, in June, with a temple in view or not */
function rings(random: () => number, days: number, temple = true): number[] {
  const bells = new TempleBells(random), at: number[] = [];
  for (let k = 0; k < days * 24 * 5; k++) {
    const hour = (7 + k * 0.2) % 24;
    if (bells.ring(hour, 5, temple)) at.push(hour);
  }
  return at;
}

test("rings only as the sun rises or sets, with a temple in view", () => {
  const { rise, set } = sunHours(5);
  const all = rings(() => 0, 3);
  expect(all).toHaveLength(6);
  for (const hour of all) expect(Math.min(Math.abs(hour - rise), Math.abs(hour - set))).toBeLessThan(0.21);
  expect(rings(() => 0, 3, false)).toEqual([]);
});

test("on about a third of the dawns and dusks", () => {
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = rings(random, 300).length;
  expect(n / 600).toBeGreaterThan(BELL_CHANCE - 0.07);
  expect(n / 600).toBeLessThan(BELL_CHANCE + 0.07);
});

test("a jump of the clock (a loaded city) rings nothing", () => {
  const bells = new TempleBells(() => 0), { rise } = sunHours(0);
  expect(bells.ring(rise - 5, 0, true)).toBe(false);
  expect(bells.ring(rise + 1, 0, true)).toBe(false);
});

test("hears a temple on screen or a few tiles past its edge", () => {
  const map = { width: 100, temples: { temples: [{ tile: 50 * 100 + 50 }] } };
  expect(templeInView(map, { x0: 40, y0: 40, x1: 60, y1: 60 })).toBe(true);
  expect(templeInView(map, { x0: 53, y0: 40, x1: 70, y1: 60 })).toBe(true);
  expect(templeInView(map, { x0: 60, y0: 40, x1: 80, y1: 60 })).toBe(false);
  expect(templeInView({ width: 100, temples: null }, { x0: 0, y0: 0, x1: 99, y1: 99 })).toBe(false);
});

test("the bell is in the catalog", () => {
  expect(SOUNDS["event.temple_bell"].file).toBe("temple-bell.ogg");
});
