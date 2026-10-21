/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The sky as it is now, inside the month (owner, 21 Oct 2026: "ฝนตกบ่อยเกินไปมากๆ"; docs/GAME_DESIGN.md section 4.3).
// The simulation keeps one weather a month (src/weather.ts), and that month's kind and rain still fill the ground, flood
// low land, keep visitors away and slow the traffic. But Thailand's rainy season does not rain all month: it rains in
// showers of an hour or a few, mostly in the afternoon and the evening, with sun or cloud between, and even August has
// dry days. So what the player sees now comes from the month's weather, the day and the hour of the game's clock
// (src/dayClock.ts): a rainy month brings showers on some days, a stormy month more and heavier ones with thunder; an
// overcast or sunny month brings none, and a foggy month's fog hangs at dawn and through the night. The clouds build in
// the hour before a shower and part in the hour and a half after it.
//
// Each day's showers come from a hash of the city's weather seed and the day, never from the city's Random, so the same
// day always has the same showers and the sky never shifts the city's chances. A shower holds once it has begun, until
// it is over, even if the month turns dry under it (a month passes in a few seconds and a shower takes several:
// ShowerSky). The game asks once a frame, and the 3D view, the time bar and the sounds all show its answer; none of it
// reaches the simulation. Plain code: no DOM, no Math.random.

import { sunAngle } from "./dayClock.js";
import { type Weather, weatherRoll } from "./weather.js";

/** One shower, in hours from the start of the clock's first day (day × 24 + hour) */
export interface Shower {
  start: number;
  end: number;
  /** How hard it rains at its height, 0–1 */
  strength: number;
  /** A thunderstorm: darker, with lightning */
  storm: boolean;
}

type WetKind = "rain" | "storm";

/**
 * Where in the day a shower may come, and how likely in each kind of month: the afternoon's thunderheads, the evening's
 * rain and the small hours' (the first of each day decided first, so a stormy month's day has more)
 */
const SLOTS: ReadonlyArray<{ from: number; span: number; chance: Readonly<Record<WetKind, number>> }> = [
  { from: 13, span: 4, chance: { rain: 0.7, storm: 0.9 } },
  { from: 17.5, span: 4, chance: { rain: 0.5, storm: 0.75 } },
  { from: 1, span: 4.5, chance: { rain: 0.2, storm: 0.4 } },
];
/** How long a shower lasts, hours */
const LASTS: Readonly<Record<WetKind, readonly [number, number]>> = { rain: [1.5, 3.5], storm: [2.5, 5] };
/** How hard a shower rains against the month's rain: some lighter, some heavier */
const STRENGTH: Readonly<Record<WetKind, readonly [number, number]>> = { rain: [0.75, 1.25], storm: [0.85, 1.15] };
/** The clouds build over this many hours before a shower, and part over these after it */
export const CLOUDS_BUILD = 1.25, CLOUDS_PART = 1.5;
/** The clouds of a rainy or stormy month's dry hours: a fair sky with heaped clouds */
const DRY_HOURS_CLOUD: Readonly<Record<WetKind, number>> = { rain: 0.35, storm: 0.45 };
/** The clouds over a shower */
const SHOWER_CLOUD = 0.92, STORM_CLOUD = 1;
/** From this much cloud the sky reads as overcast (the time bar's word) */
export const OVERCAST_SHOWN = 0.6;
/** From this much fog at the hour the sky reads as foggy */
export const FOG_SHOWN = 0.35;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
/** A number in [0, 1) for one day of one city, the same every time, apart from the months' own chances */
const dayRoll = (seed: number, day: number, salt: number): number => weatherRoll((seed ^ 0x27d4eb2f) >>> 0, day, 50 + salt);

/** A day's showers in a rainy or stormy month (day × 24 + hour), by the city's weather seed */
export function showersOfDay(seed: number, day: number, kind: WetKind): Shower[] {
  const showers: Shower[] = [];
  SLOTS.forEach((slot, i) => {
    if (dayRoll(seed, day, i * 5) >= slot.chance[kind]) return;
    const [shortest, longest] = LASTS[kind], [weak, strong] = STRENGTH[kind];
    const start = day * 24 + slot.from + slot.span * dayRoll(seed, day, i * 5 + 1);
    const hours = shortest + (longest - shortest) * dayRoll(seed, day, i * 5 + 2);
    showers.push({ start, end: start + hours, strength: weak + (strong - weak) * dayRoll(seed, day, i * 5 + 3), storm: kind === "storm" });
  });
  return showers;
}

/** The showers that may touch an hour (the day before's may run past midnight; the next day's clouds may build) */
function showersNear(weather: Weather | null, day: number): Shower[] {
  if (!weather || (weather.kind !== "rain" && weather.kind !== "storm")) return [];
  return [day - 1, day, day + 1].flatMap((d) => showersOfDay(weather.seed, d, weather.kind as WetKind));
}

/** How hard a shower rains through its course, 0–1: a quick start, a downpour, then lighter until it stops */
export function showerShape(progress: number): number {
  if (progress < 0 || progress >= 1) return 0;
  if (progress < 0.15) return 0.6 + 0.4 * progress / 0.15;
  if (progress < 0.55) return 1;
  return 1 - 0.6 * (progress - 0.55) / 0.45;
}

/**
 * How much of the month's fog hangs at an hour (the sun's angle, src/dayClock.ts sunAngle: 0 rising, π setting, on to
 * 2π through the night): thick at dawn, thinning through the morning, thin by day, gathering again through the night.
 */
export function fogAtHour(angle: number): number {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a <= Math.PI) {
    const day = a / Math.PI;
    return day < 0.35 ? 1 - 0.7 * (day / 0.35) : 0.3;
  }
  return 0.5 + 0.5 * (a - Math.PI) / Math.PI;
}

/** The shower raining at a time, if any (the held ones first) */
function rainingAt(showers: readonly Shower[], time: number): Shower | null {
  return showers.find((s) => time >= s.start && time < s.end) ?? null;
}

/**
 * The sky now, as a Weather the 3D view and the time bar read in place of the month's: its kind is what is seen now
 * (rain or storm only while a shower falls; overcast, sunny or fog by the clouds and the hour), its rain how hard it
 * rains now, its cloud the clouds now; its fog and smoke are the month's (the 3D view thins the fog by the hour).
 * held: showers already begun (ShowerSky), which go on whatever the month has turned to.
 */
export function skyAt(weather: Weather | null, day: number, hour: number, month: number,
    held: readonly Shower[] = []): Weather | null {
  if (!weather) return null;
  const time = day * 24 + hour, showers = [...held, ...showersNear(weather, day)];
  const shower = rainingAt(showers, time);
  const wet = weather.kind === "rain" || weather.kind === "storm";
  // The clouds: the month's (a wet month's dry hours fair), heaping up before a shower and parting after it
  let cloud = wet ? DRY_HOURS_CLOUD[weather.kind as WetKind] : weather.cloud;
  for (const s of showers) {
    const top = s.storm ? STORM_CLOUD : SHOWER_CLOUD;
    const near = time < s.start ? 1 - (s.start - time) / CLOUDS_BUILD : time < s.end ? 1 : 1 - (time - s.end) / CLOUDS_PART;
    if (near > 0) cloud = Math.max(cloud, cloud + (top - cloud) * clamp01(near));
  }
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  if (shower) {
    const rain = clamp01(weather.rain > 0 ? weather.rain * shower.strength : shower.strength * (shower.storm ? 0.9 : 0.45));
    return { ...weather, kind: shower.storm ? "storm" : "rain", cloud: round(cloud),
      rain: round(Math.max(0.05, rain * showerShape((time - shower.start) / (shower.end - shower.start)))) };
  }
  const fog = weather.fog * fogAtHour(sunAngle(hour, month));
  const kind = fog >= FOG_SHOWN ? "fog" : cloud >= OVERCAST_SHOWN ? "overcast" : "sunny";
  return { ...weather, kind, rain: 0, cloud: round(cloud) };
}

/**
 * The game's sky, asked once a frame (src/game.js): skyAt, holding each shower from when it begins until its clouds
 * have parted, so a shower the month began goes on to its end. Starting over (a city loaded, the clock set back) it
 * holds nothing and reads the sky afresh.
 */
export class ShowerSky {
  private held: Shower[] = [];
  private last = -Infinity;
  now(weather: Weather | null, day: number, hour: number, month: number): Weather | null {
    const time = day * 24 + hour;
    if (time < this.last) this.held = [];
    this.last = time;
    this.held = this.held.filter((s) => time < s.end + CLOUDS_PART);
    const begun = rainingAt(showersNear(weather, day), time);
    if (begun && !this.held.some((s) => s.start === begun.start)) this.held.push(begun);
    return skyAt(weather, day, hour, month, this.held);
  }
}
