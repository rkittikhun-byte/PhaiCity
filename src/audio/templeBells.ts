/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The temple bell at dawn and dusk (docs/GAME_DESIGN.md 9.5; owner, 21 Oct 2026: the temple bell sound is allowed): when
// the game's clock (src/dayClock.ts) passes sunrise or sunset with a temple on screen (src/temples.ts), the bell
// (event.temple_bell, CC0, assets/audio/CREDITS.md) rings softly, on about a third of the days, never more than once
// at each. It only listens: it reads the clock and the temples and never changes the city.

import { sunHours } from "../dayClock.js";

/** The share of dawns and dusks the bell rings on */
export const BELL_CHANCE = 1 / 3;
/** How loud, on top of the catalog's volume: soft, a bell from across the town */
export const BELL_VOLUME = 0.5;
/** Tiles round the view a temple may stand in and still be heard */
export const BELL_MARGIN = 4;

interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Whether a temple stands within the view (a few tiles round it): its centre tiles, as gameMap.temples keeps them */
export function templeInView(map: { width: number; temples?: { temples: ReadonlyArray<{ tile: number }> } | null },
  rect: Rect | null): boolean {
  if (!rect || !map.temples?.temples.length) return false;
  return map.temples.temples.some(({ tile }) => {
    const x = tile % map.width, y = Math.floor(tile / map.width);
    return x >= rect.x0 - BELL_MARGIN && x <= rect.x1 + BELL_MARGIN && y >= rect.y0 - BELL_MARGIN && y <= rect.y1 + BELL_MARGIN;
  });
}

/** Whether the clock went past `mark` (hours) going from `from` to `to`, round midnight too */
function passed(from: number, to: number, mark: number): boolean {
  if (to >= from) return from < mark && mark <= to;
  return from < mark || mark <= to;
}

/** Decides, each time it is asked with the clock's hour, whether the bell rings now */
export class TempleBells {
  private last: number | null = null;
  constructor(private readonly random: () => number = Math.random) {}

  /** The hour now (0-24) in month (0-11), and whether a temple is in view: true when the bell should ring */
  ring(hour: number, month: number, temple: boolean): boolean {
    const last = this.last;
    this.last = hour;
    if (last === null || last === hour) return false;
    // (the clock jumps no more than a few hours between two asks; a longer jump, a loaded save, rings nothing)
    const gone = ((hour - last) % 24 + 24) % 24;
    if (gone > 3) return false;
    const { rise, set } = sunHours(month);
    if (!passed(last, hour, rise) && !passed(last, hour, set)) return false;
    return temple && this.random() < BELL_CHANCE;
  }
}
