/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The light the city's one shadow-casting lamp gives (owner, 23 Oct 2026: "กลางวันมันจะมีเงาพระอาทิตย์ และกลางคืนจะมีเงา
// พระจันทร์ ... ถ้าฝนตกจะไม่มีเงา"; RENDERER_SPEC 8C, docs/GAME_DESIGN.md 20): the sun by day and the moon by night, from
// where each stands. At twilight the light goes over from one to the other through the dusk: the sun's fades out as it
// reaches the horizon, and only then does the moon's fade in, so the lamp turns round while it gives no light and its
// shadows never jump; with neither up it stays dark. Overcast, rain, storm and
// thick fog take the shadows away as the weather's look eases in (weather.ts), and give them back as it clears. Plain
// numbers: the view (index.ts) puts them on its light.

import { moonLit } from '../../moon.js';
import type { WeatherLook } from './weather.js';

/** The sun's light at its height on a clear day (three.js units) */
export const SUN_LIGHT = 3.3;

/** What the moon gives at the full (data/game-feel.json "moon", src/gameFeel.ts) */
export interface MoonFeel { fullLight: number; shadow: number }

export interface SkyLight {
  /** Where the light comes from, as the sun's angle is taken: 0 east on the horizon, π/2 overhead, π west */
  angle: number;
  /** Its strength (three.js units), after the clouds, fog and smoke dim it */
  intensity: number;
  /** How much of it is the moon's: 0 the sun's colour, 1 the moonlight's */
  moonShare: number;
  /** How dark its shadows are: 1 full, 0 none */
  shadow: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smooth = (edge0: number, edge1: number, value: number): number => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** How much of the shadows the weather leaves: none under an overcast sky, in rain, a storm or thick fog */
export function weatherShadow(look: Readonly<WeatherLook>): number {
  const overcast = clamp01((look.cloud - 0.35) / 0.45);
  return clamp01(1 - overcast) * clamp01(1 - look.rain * 4) * clamp01(1 - look.storm * 2)
    * clamp01(1 - Math.max(0, look.fog - 0.2) * 2.5) * (1 - 0.5 * look.smoke);
}

/**
 * The light now, from the sun's and the moon's angles (src/dayClock.ts, src/moon.ts), the moon's phase and the weather's
 * look. `lastAngle` is kept when neither gives any light, so the lamp does not swing about unseen.
 */
export function skyLight(sunAngle: number, moonAngle: number, phase: number, look: Readonly<WeatherLook>, moon: MoonFeel,
    lastAngle = Math.PI / 2): SkyLight {
  const sunHigh = Math.sin(sunAngle), moonHigh = Math.sin(moonAngle);
  // The sun's light fades to nothing at the horizon; the moon's shows once the sun is under it
  const sunUp = smooth(0, 0.14, sunHigh);
  const moonUp = smooth(-0.04, 0.12, moonHigh) * moonLit(phase) * (1 - smooth(-0.12, 0, sunHigh));
  const sunE = SUN_LIGHT * sunUp, moonE = moon.fullLight * moonUp, total = sunE + moonE;
  let angle = lastAngle;
  if (total > 1e-4) {
    // From whichever gives light (between the two, by their light, should both ever give some)
    const x = (Math.cos(sunAngle) * sunE + Math.cos(moonAngle) * moonE) / total;
    const y = (sunHigh * sunE + moonHigh * moonE) / total;
    angle = Math.atan2(y, x);
  }
  // The clouds, fog and smoke dim it, as the sun goes behind them
  const shows = Math.max(0.1, 1 - 0.85 * clamp01((look.cloud - 0.35) / 0.6) - 0.3 * look.fog - 0.35 * look.smoke);
  const shadow = weatherShadow(look) * clamp01(sunUp + moon.shadow * (moon.fullLight > 0 ? moonE / moon.fullLight : 0));
  return { angle, intensity: total * shows, moonShare: total > 1e-4 ? moonE / total : 1, shadow };
}
