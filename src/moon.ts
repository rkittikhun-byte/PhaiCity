/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The moon (owner, 23 Oct 2026: "กลางคืนจะมีเงาพระจันทร์ มีข้างขึ้น ข้างแรม และเงาเปลี่ยนองศาไปเรื่อยๆ"; docs/GAME_DESIGN.md 20):
// its phase and where it stands at an hour, for the 3D view's moonlight and the moon in its sky. It goes by the game's
// clock (src/dayClock.ts), not the calendar: the calendar turns a month in a few seconds while a day takes minutes, so
// a moon by the calendar would wax and wane within one night. A lunation is 29.53 of the clock's days and the moon
// rises about 49 minutes later each night; a new city's first night has the real moon of its starting month. Plain
// code, no DOM; the simulation never reads it.

/** Days from one new moon to the next */
export const SYNODIC_DAYS = 29.530588853;
/** A new moon: 6 January 2000, 18:14 UTC */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86400000;

const frac = (value: number): number => ((value % 1) + 1) % 1;

/** The days since the last new moon on the 15th of a month (0 January) of a year of the common era, as the sky had it */
export function moonDayAt(year: number, month: number): number {
  const days = (Date.UTC(year, month, 15, 12) - NEW_MOON_MS) / DAY_MS;
  return frac(days / SYNODIC_DAYS) * SYNODIC_DAYS;
}

/** The phase after `days` of the clock (with the hour's fraction), counted from a new moon: 0 new, 0.5 full, on to 1 */
export function moonPhase(days: number): number {
  return frac(days / SYNODIC_DAYS);
}

/** How much of the disc is lit: 0 new, 1 full */
export function moonLit(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** The Thai lunar day: waxing (ข้างขึ้น) or waning (ข้างแรม), and its day, 1–15 (ขึ้น 15 ค่ำ is the full moon) */
export function lunarDay(phase: number): { waxing: boolean; day: number } {
  const p = frac(phase), waxing = p < 0.5;
  const day = Math.min(15, Math.max(1, Math.round((waxing ? p : p - 0.5) * SYNODIC_DAYS)));
  return { waxing, day };
}

/**
 * Where the moon stands at an hour, as the sun's angle is taken (src/dayClock.ts sunAngle): 0 rising in the east, π/2
 * at its highest, π setting in the west, on under the ground to 2π. It keeps the sun's company at the new moon and
 * stands opposite it at the full: a full moon rises at six in the evening and is highest at midnight.
 */
export function moonAngle(hour: number, phase: number): number {
  const sinceRise = (((hour - 6 - 24 * frac(phase)) % 24) + 24) % 24;
  return sinceRise / 12 * Math.PI;
}
