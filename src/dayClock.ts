/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time of day (owner, 20 Oct 2026, design A of docs/GAME_DESIGN.md: "แสงเช้า-ค่ำเดินตามเกม หยุดตามปุ่มหยุด เร่งตาม
// ความเร็ว พระอาทิตย์ขึ้น-ตกตามเดือน และมีนาฬิกาในแถบเวลา"): a clock of its own, as Cities: Skylines keeps one, that
// runs only while the game runs, faster at a faster speed, the night passing quicker than the day so the city is seen
// in daylight most of the time; the sun rises and sets at the month's own hours. The calendar (months and years) is
// the simulation's and goes its own pace. The game owns the clock and tells the 3D view where the sun stands; the
// simulation never reads it. Plain code, no DOM.

/** The month's sunrise and sunset (0 January), hours of the day, Thai time, about as they are at Khon Kaen (16.4° N) */
export const SUN_HOURS: ReadonlyArray<readonly [number, number]> = [
  [6 + 43 / 60, 18 + 2 / 60], [6 + 40 / 60, 18 + 17 / 60], [6 + 27 / 60, 18 + 24 / 60], [6 + 9 / 60, 18 + 29 / 60],
  [5 + 56 / 60, 18 + 37 / 60], [5 + 53 / 60, 18 + 46 / 60], [5 + 59 / 60, 18 + 48 / 60], [6 + 6 / 60, 18 + 38 / 60],
  [6 + 9 / 60, 18 + 17 / 60], [6 + 13 / 60, 17 + 56 / 60], [6 + 22 / 60, 17 + 42 / 60], [6 + 36 / 60, 17 + 46 / 60],
];

/** Real seconds a whole day takes at each speed (1 slow, 2 normal, 3 fast): 8, 6 and 4 minutes (owner, 23 Oct 2026:
 * "ช่วงสลับ กลางวัน กลางคืน ... มันเร็วไป"; it was 4, 3 and 2) */
export const DAY_SECONDS: Readonly<Record<number, number>> = { 1: 480, 2: 360, 3: 240 };
/** The night goes this many times as fast as the day */
export const NIGHT_PACE = 2;
/** A new city's first morning */
export const FIRST_HOUR = 7;

const monthOf = (month: number): number => ((Math.floor(month) % 12) + 12) % 12;

/** The month's sunrise and sunset */
export function sunHours(month: number): { rise: number; set: number } {
  const [rise, set] = SUN_HOURS[monthOf(month)];
  return { rise, set };
}

/** Whether the hour is between sunset and sunrise */
export function isNight(hour: number, month: number): boolean {
  const { rise, set } = sunHours(month);
  return hour < rise || hour >= set;
}

/**
 * Where the sun stands at an hour, as the 3D view takes it (render3d/city/index.ts): 0 rising in the east, π/2 at
 * its highest, π setting in the west, and on round under the ground through the night to 2π at the next sunrise.
 */
export function sunAngle(hour: number, month: number): number {
  const { rise, set } = sunHours(month), day = set - rise;
  const h = ((hour % 24) + 24) % 24;
  // (a hair under sunrise is sunrise: the hours are sums of fractions)
  if (h >= rise - 1e-9 && h < set) return Math.PI * Math.max(0, h - rise) / day;
  const sinceSet = (h - set + 24) % 24;
  return Math.PI + Math.PI * sinceSet / (24 - day);
}

/** "06:42" */
export function clockText(hour: number): string {
  // (a hair under a minute is that minute: 6:42 is a sum of fractions)
  const minutes = Math.floor((((hour % 24) + 24) % 24) * 60 + 1e-6) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The game's clock: the hour of the day, which only moves while the game runs */
export class DayClock {
  hour: number;
  constructor(hour: number = FIRST_HOUR) {
    this.hour = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : FIRST_HOUR;
  }

  /** Moves the clock on by realSeconds at a game speed (0 paused: it stands), in the month of the calendar */
  advance(realSeconds: number, speed: number, month: number): void {
    const daySeconds = DAY_SECONDS[speed];
    if (!daySeconds || !(realSeconds > 0)) return;
    // A real second is worth more hours at night: the day's hours and the night's, as quick, make the whole day
    const { rise, set } = sunHours(month), dayHours = set - rise, nightHours = 24 - dayHours;
    const dayRate = (dayHours + nightHours / NIGHT_PACE) / daySeconds;
    // Never more than a few game minutes a frame, so a long stall does not jump the clock
    let left = Math.min(realSeconds, 1);
    while (left > 0) {
      const rate = isNight(this.hour, month) ? dayRate * NIGHT_PACE : dayRate;
      const step = Math.min(left, 0.25);
      this.hour = (this.hour + rate * step) % 24;
      left -= step;
    }
  }

  sunAngle(month: number): number { return sunAngle(this.hour, month); }
  text(): string { return clockText(this.hour); }
  night(month: number): boolean { return isNight(this.hour, month); }
}
