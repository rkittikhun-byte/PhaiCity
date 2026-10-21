/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rain spells: the rain the player sees and hears (owner, 21 Oct 2026: "ฝนตกบ่อยเกินไปมากๆ", then "ทุกอย่างมันเร็วไป
// ทั้งฝนตก เทศกาล เอาในแต่ละยุค มี 2-3 ครั้งกำลังดี"; docs/GAME_DESIGN.md section 4.3). The simulation keeps one weather
// a month (src/weather.ts), and that month's kind and rain still fill the ground, keep visitors away and slow the
// traffic. But a month passes in a few seconds, so a rainy month a few seconds long, month after month, reads as rain
// all the time. What the player sees instead is a rain spell now and then: two or three in each three years, about an
// era's length in normal mode, mostly in the rainy season, each a few weeks of the calendar with its clouds gathering
// before and parting after; at most one of them in each three years is a storm, with thunder and lightning. Between
// spells the sky is dry: sunny, cloudy in a wet month, foggy at dawn in a foggy one.
//
// The spells come from a hash of the city's weather seed and the calendar (the simulation's city time, a week a unit),
// never from the city's Random, so the same city has the same spells whatever its ruler does. The simulation reads them
// only for the news of a spell and for floods, which come only with a storm spell (src/simulation.js); the game asks
// for the sky now once a frame, and the 3D view, the time bar and the sounds all show its answer. Plain code: no DOM, no
// Math.random.

import { sunAngle } from "./dayClock.js";
import type { Climate } from "./provinceRules.js";
import { type Weather, weatherRoll } from "./weather.js";

/** How often it rains on screen: the numbers to tune */
export const RAIN_SPELLS = {
  /** Spells are counted in blocks of this many years, about an era in normal mode (docs/GAME_DESIGN.md section 1) */
  years: 3,
  /** The fewest and the most spells in a block */
  fewest: 2, most: 3,
  /** The chance that one spell of a block is a storm (never more than one) */
  storm: 0.6,
  /** How long a spell rains, weeks of the calendar (four a month; a month is about four seconds at 2×) */
  weeks: [4, 7] as readonly [number, number],
  /** The clouds gather this many weeks before a spell and part over these after it */
  build: 1, part: 1.5,
  /** How hard a spell rains at its height: a rain spell, a storm */
  rain: [0.4, 0.6] as readonly [number, number], stormRain: [0.85, 1] as readonly [number, number],
} as const;

/** Weeks in a year of the calendar (src/simulation.js: city time counts 48 a year) */
const WEEKS_A_YEAR = 48;

/** One spell, in weeks of the city time */
export interface RainSpell {
  start: number;
  end: number;
  /** How hard it rains at its height, 0–1 */
  strength: number;
  /** A storm: darker, with thunder and lightning */
  storm: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const monthOfWeek = (week: number): number => Math.floor(week / 4) % 12;
/** A number in [0, 1) for one block of one city, the same every time, apart from the months' own chances */
const blockRoll = (seed: number, block: number, salt: number): number => weatherRoll((seed ^ 0x27d4eb2f) >>> 0, block, 50 + salt);

/**
 * A block's spells: its years cut into as many even stretches as it has spells, each spell beginning in its stretch at
 * a week drawn by the chance of rain in the week's month (squared, so nearly all in the rainy season)
 */
export function spellsOfBlock(seed: number, block: number, climate: Climate): RainSpell[] {
  const { years, fewest, most } = RAIN_SPELLS;
  const count = fewest + Math.min(most - fewest, Math.floor(blockRoll(seed, block, 0) * (most - fewest + 1)));
  const span = (years * WEEKS_A_YEAR) / count, first = block * years * WEEKS_A_YEAR;
  const storm = blockRoll(seed, block, 1) < RAIN_SPELLS.storm ? Math.floor(blockRoll(seed, block, 2) * count) : -1;
  const spells: RainSpell[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor(first + i * span), to = Math.floor(first + (i + 1) * span);
    const weights: number[] = [];
    let total = 0;
    for (let week = from; week < to; week++) {
      const chance = climate.rain[monthOfWeek(week)] ?? 0;
      total += chance * chance;
      weights.push(total);
    }
    const pick = blockRoll(seed, block, 10 + i * 4) * total;
    const start = from + Math.max(0, weights.findIndex((w) => w > pick));
    const [shortest, longest] = RAIN_SPELLS.weeks;
    const [weak, strong] = i === storm ? RAIN_SPELLS.stormRain : RAIN_SPELLS.rain;
    spells.push({ start, end: start + shortest + (longest - shortest) * blockRoll(seed, block, 11 + i * 4),
      strength: weak + (strong - weak) * blockRoll(seed, block, 12 + i * 4), storm: i === storm });
  }
  return spells;
}

/** The spells near a week (the block before's last may run into this one) */
export function spellsNear(seed: number, week: number, climate: Climate): RainSpell[] {
  const block = Math.floor(week / (RAIN_SPELLS.years * WEEKS_A_YEAR));
  return [block - 1, block, block + 1].flatMap((b) => spellsOfBlock(seed, b, climate));
}

/** The spell that begins within these weeks, if any (the simulation's news of it) */
export function spellBeginning(seed: number, climate: Climate, from: number, to: number): RainSpell | null {
  return spellsNear(seed, from, climate).find((s) => s.start >= from && s.start < to) ?? null;
}

/** Whether a storm spell rains within these weeks (the simulation's floods) */
export function stormDuring(seed: number, climate: Climate, from: number, to: number): boolean {
  return spellsNear(seed, from, climate).some((s) => s.storm && s.start < to && s.end > from);
}

/**
 * How hard a spell rains through its course, 0–1: a quick start, rain, a break of cloud halfway through a long spell,
 * rain again, then lighter until it stops
 */
export function spellShape(progress: number, weeks: number): number {
  if (progress < 0 || progress >= 1) return 0;
  if (weeks >= 5 && progress >= 0.45 && progress < 0.58) return 0;
  if (progress < 0.1) return 0.6 + 0.4 * progress / 0.1;
  if (progress < 0.7) return 1;
  return 1 - 0.6 * (progress - 0.7) / 0.3;
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

/** The clouds of a wet month's dry weeks: a fair sky in a rainy one, an overcast one in a stormy one */
const DRY_CLOUD = { rain: 0.45, storm: 0.65 } as const;
/** The clouds over a spell */
const SPELL_CLOUD = 0.92, STORM_CLOUD = 1;
/** From this much cloud the sky reads as overcast (the time bar's word) */
export const OVERCAST_SHOWN = 0.6;
/** From this much fog at the hour the sky reads as foggy */
export const FOG_SHOWN = 0.35;

/**
 * The sky now, as a Weather the 3D view, the time bar and the sounds read in place of the month's: its kind is what is
 * seen now (rain or storm only while a spell rains; overcast, sunny or fog by the clouds and the hour), its rain how
 * hard it rains now, its cloud the clouds now; its fog and smoke are the month's (the 3D view thins the fog by the hour).
 * week: the city time with its fraction (src/simulation.js _cityTime and _phaseCycle / 16); hour and month: the game's
 * clock and the calendar's month, for the fog.
 */
export function skyAt(weather: Weather | null, climate: Climate, week: number, hour: number, month: number): Weather | null {
  if (!weather) return null;
  const spells = spellsNear(weather.seed, week, climate);
  let cloud = weather.kind === "rain" || weather.kind === "storm" ? DRY_CLOUD[weather.kind] : weather.cloud;
  let raining: RainSpell | null = null, rain = 0;
  for (const s of spells) {
    const top = s.storm ? STORM_CLOUD : SPELL_CLOUD;
    const near = week < s.start ? 1 - (s.start - week) / RAIN_SPELLS.build
      : week < s.end ? 1 : 1 - (week - s.end) / RAIN_SPELLS.part;
    if (near > 0) cloud = Math.max(cloud, cloud + (top - cloud) * clamp01(near));
    const shape = spellShape((week - s.start) / (s.end - s.start), s.end - s.start);
    if (shape > 0) { raining = s; rain = Math.max(0.05, s.strength * shape); }
  }
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  if (raining) return { ...weather, kind: raining.storm ? "storm" : "rain", cloud: round(cloud), rain: round(rain) };
  const fog = weather.fog * fogAtHour(sunAngle(hour, month));
  const kind = fog >= FOG_SHOWN ? "fog" : cloud >= OVERCAST_SHOWN ? "overcast" : "sunny";
  return { ...weather, kind, rain: 0, cloud: round(cloud) };
}
