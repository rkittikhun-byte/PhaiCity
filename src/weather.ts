/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The weather (สภาพอากาศ, owner 20 Oct 2026: "มีฝนที่ฝนตก ตกหนัก แดดออก ฟ้ามืดด้วย ก็น่าจะดี"; docs/GAME_DESIGN.md
// section 4). Each month the simulation chooses the month's weather from Thailand's seasons as the region and province
// have them (data/province-rules.json "weather", src/provinceRules.ts): the hot season's sun, the rains from May to
// October with their heaviest storms in August and September (the south's east coast from October to January), and the
// cool season's clear skies and morning fog. It changes gradually: a clear sky clouds over before the rains set in, and
// a storm breaks up into cloud before the sun comes out; only a thunderstorm, as the hot season's are, comes out of a
// clear sky, its clouds building within the month (the 3D view builds them before the rain falls). Five kinds: sunny, overcast, rain, storm (heavy rain with thunder) and
// fog, with how hard it rains, how much cloud and fog there is, and the smoke of burning fields in the air.
//
// The month's weather lives on the map (gameMap.weather) and is saved with the city (src/core/cityLayers.ts); the 3D
// view only reads it (src/render3d/city/weather.ts) and the time bar shows it (src/timeControls.ts). It does a little:
// rain fills the ground's water (src/waterManager.ts), a storm floods low land by the water now and then
// (src/disasterManager.js), keeps some visitors away (src/simulation.js _visitors) and slows the traffic a little
// (src/traffic.js). Its chances come from a stream of its own, seeded once from the city's Random (src/random.ts), so
// the same city has the same weather whatever its ruler does, and the weather never shifts the city's other chances.
// Plain code: no DOM, no Math.random.

import { type Climate, DEFAULT_CLIMATE } from "./provinceRules.js";

export type { Climate };

export const WEATHER_KINDS = ["sunny", "overcast", "rain", "storm", "fog"] as const;
export type WeatherKind = typeof WEATHER_KINDS[number];

/** A month's weather, as the map keeps it and the renderers read it */
export interface Weather {
  kind: WeatherKind;
  /** How hard it rains, 0 (dry) to 1 (a downpour) */
  rain: number;
  /** How much of the sky the clouds cover, 0–1 */
  cloud: number;
  /** How thick the fog is, 0–1 (thickest in the morning: the 3D view thins it through the day) */
  fog: number;
  /** Smoke in the air from burning fields and forests, 0–1 (the north's and northeast's hot season) */
  smoke: number;
  /** The weather's own stream of chances (see above) */
  seed: number;
}

/** How each kind looks: the range its rain, cloud and fog take, chosen within it month by month */
const LOOKS: Readonly<Record<WeatherKind, { rain: [number, number]; cloud: [number, number]; fog: [number, number] }>> = {
  sunny: { rain: [0, 0], cloud: [0.05, 0.3], fog: [0, 0] },
  overcast: { rain: [0, 0], cloud: [0.65, 0.85], fog: [0, 0.1] },
  rain: { rain: [0.35, 0.6], cloud: [0.85, 0.95], fog: [0, 0.1] },
  storm: { rain: [0.8, 1], cloud: [1, 1], fog: [0, 0.05] },
  fog: { rain: [0, 0], cloud: [0.15, 0.4], fog: [0.55, 0.9] },
};

const monthOf = (month: number): number => ((Math.floor(month) % 12) + 12) % 12;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number): number => Math.round(value * 1000) / 1000;

/** A number in [0, 1) for one month of one city, the same every time (mulberry32's mix of the three) */
export function weatherRoll(seed: number, monthIndex: number, salt: number): number {
  let t = (seed ^ Math.imul(monthIndex + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The kind of weather a month takes after the last one: wet by the month's chance of rain (a storm by its share of
 * the wet months), else foggy or clear; never in one jump from a clear sky to steady rain, nor from a storm to the sun.
 */
export function nextKind(previous: WeatherKind, climate: Climate, month: number, wetRoll: number,
    kindRoll: number): WeatherKind {
  const m = monthOf(month);
  if (wetRoll < climate.rain[m]) {
    const storm = kindRoll < climate.storm[m];
    // Clouds build before the rains set in; a thunderstorm builds its own
    if (!storm && (previous === "sunny" || previous === "fog")) return "overcast";
    return storm ? "storm" : "rain";
  }
  // ... and a storm breaks up into cloud before the sun comes out
  if (previous === "storm") return "overcast";
  return kindRoll < climate.fog[m] ? "fog" : "sunny";
}

/** A month's weather of a kind: its rain, cloud and fog within the kind's ranges, and the smoke in the air */
function weatherOf(kind: WeatherKind, climate: Climate, month: number, seed: number, monthIndex: number,
    burning: number): Weather {
  const look = LOOKS[kind];
  const pick = ([low, high]: [number, number], salt: number): number => round(low + (high - low) * weatherRoll(seed, monthIndex, salt));
  const rain = pick(look.rain, 3);
  // Rain washes the smoke out of the air
  const smoke = round(clamp01(climate.smoke[monthOf(month)] + burning) * (1 - rain) * (1 - rain));
  return { kind, rain, cloud: pick(look.cloud, 4), fog: pick(look.fog, 5), smoke, seed: seed >>> 0 };
}

/**
 * The month's weather after the last month's. monthIndex counts the city's months from its first (the simulation's
 * city time / 4), so each month of each city has chances of its own. burning: smoke the city's own fields add while
 * their stubble burns, 0–1 (src/farming.ts).
 */
export function nextWeather(previous: Weather, climate: Climate, month: number, monthIndex: number,
    burning = 0): Weather {
  const seed = previous.seed >>> 0;
  const kind = nextKind(previous.kind, climate, month, weatherRoll(seed, monthIndex, 1), weatherRoll(seed, monthIndex, 2));
  return weatherOf(kind, climate, month, seed, monthIndex, burning);
}

/** A new city's first weather: the likeliest of its month, and the seed of its stream of chances */
export function startingWeather(climate: Climate, month: number, seed: number, monthIndex = 0): Weather {
  const m = monthOf(month);
  const kind: WeatherKind = climate.rain[m] >= 0.5 ? climate.storm[m] >= 0.5 ? "storm" : "rain"
    : climate.fog[m] >= 0.5 ? "fog" : "sunny";
  return weatherOf(kind, climate, month, seed, monthIndex, 0);
}

/** A saved city's weather, checked; null if it has none or it is broken */
export function readWeather(raw: unknown): Weather | null {
  if (typeof raw !== "object" || raw === null) return null;
  const w = raw as Partial<Weather>;
  if (!WEATHER_KINDS.includes(w.kind as WeatherKind) || !Number.isInteger(w.seed)) return null;
  const share = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? clamp01(value) : 0;
  return { kind: w.kind as WeatherKind, rain: share(w.rain), cloud: share(w.cloud), fog: share(w.fog),
    smoke: share(w.smoke), seed: (w.seed as number) >>> 0 };
}

// --- What the weather does -----------------------------------------------------------------------------------------

/** How much a month of each kind fills the ground's water, against a month of the old steady rain (1) */
const RECHARGE: Readonly<Record<WeatherKind, number>> = { sunny: 0.25, fog: 0.3, overcast: 0.6, rain: 1.25, storm: 1.6 };
/** ... in a month of the dry season, when only rain or a storm fills it, a little */
const DRY_RECHARGE = 0.5;

/** How much this month's rain fills the ground (src/groundwater.ts rechargeGroundwater's factor) */
export function rainRecharge(weather: Weather, dryMonth: boolean): number {
  if (dryMonth) return weather.kind === "rain" || weather.kind === "storm" ? RECHARGE[weather.kind] * DRY_RECHARGE : 0;
  return RECHARGE[weather.kind];
}

/** The share of the month's visitors who still come: a storm keeps some away, rain a few */
export function weatherVisitors(weather: Weather | null): number {
  if (!weather) return 1;
  return weather.kind === "storm" ? 0.85 : weather.kind === "rain" ? 0.95 : 1;
}

/** How much more each trip crowds the roads: traffic goes slower in rain, a storm and fog */
export function weatherTraffic(weather: Weather | null): number {
  if (!weather) return 1;
  return weather.kind === "storm" ? 1.15 : weather.kind === "rain" ? 1.07 : weather.kind === "fog" ? 1.05 : 1;
}

/** The chance this month's weather floods low land beside the water (src/provinceRules.ts seasonalRisks) */
export function weatherFlood(weather: Weather | null, climate: Climate): number {
  return weather?.kind === "storm" ? climate.flood : 0;
}

/** The season a month falls in, for the time bar (string key weather.season.*) */
export type ThaiSeason = "hot" | "rainy" | "cool";
export function thaiSeason(month: number, climate: Climate = DEFAULT_CLIMATE): ThaiSeason {
  const m = monthOf(month);
  if (climate.rain[m] >= 0.5) return "rainy";
  return m >= 2 && m <= 4 ? "hot" : "cool";
}
