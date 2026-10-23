/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The full-moon festivals' night (owner, 23 Oct 2026: "ก็เต็มดวงวันไหน ก็เอาเป็นวันนั้น ลอยกระทงสิ"; docs/GAME_DESIGN.md 20).
// Loy Krathong and Yi Peng are held in their calendar month as before (src/festivals.ts: visitors, cheer, costs, the
// card), but the calendar turns a month in seconds while the moon goes by the clock's days (src/moon.ts), so their
// picture waits for the moon: a festival the town made an event of is owed to the first full-moon night of the clock
// after its month, and shown from dusk until midnight, then fades. The festivals the people hold quietly owe nothing,
// as they show nothing now. The game keeps this beside its clock and tells the 3D view; the simulation never reads it,
// and nothing pops up (owner's taste): only the time bar's moon glows that night. Plain code, no DOM.

import { moonPhase, SYNODIC_DAYS } from "./moon.js";
import { sunHours } from "./dayClock.js";

/** The festivals whose picture is the full moon's night */
export const MOON_FESTIVALS: readonly string[] = ["loy_krathong", "yi_peng"];
/** The night begins this many hours before the month's sunset */
export const NIGHT_BEGINS_BEFORE_SUNSET = 0.25;

export interface MoonShow { id: string; scale: string }

/**
 * Whether the night that begins on the evening of the clock's day `day` is the full moon's: the moon is nearest full at
 * its midnight, within half a day of it. One night in each lunation.
 */
export function isFullMoonEvening(day: number): boolean {
  const phase = moonPhase(Math.floor(day) + 1);
  return Math.abs(phase - 0.5) <= 0.5 / SYNODIC_DAYS;
}

/** The first full-moon evening on or after a clock day */
export function nextFullMoonEvening(day: number): number {
  for (let d = Math.floor(day); d < day + 31; d++) if (isFullMoonEvening(d)) return d;
  return Math.floor(day);
}

/** Whether the hour of a clock day is inside the full-moon night's show: from just before sunset to midnight */
export function inFestivalNight(day: number, hour: number, month: number): boolean {
  return isFullMoonEvening(day) && hour >= sunHours(month).set - NIGHT_BEGINS_BEFORE_SUNSET;
}

/** What the full-moon festivals owe and show, kept by the game beside its clock (saved with the city as moonFestivals) */
export class MoonFestivals {
  /** Festivals held and waiting for their night, by id: the scale they were held at */
  private owed = new Map<string, string>();
  /** The night showing them now (its clock day), and what it shows */
  private night: { day: number; shows: MoonShow[] } | null = null;
  /** The calendar month (year × 12 + month) each festival was last taken from, so a month owes it once */
  private takenFrom = new Map<string, number>();

  /**
   * Each frame: held, the festivals held this calendar month (gameMap.festivals.held); monthKey, the calendar's year × 12
   * + month; the clock's day and hour. Returns the festivals to show now.
   */
  update(held: ReadonlyArray<{ id: string; scale: string; quiet?: boolean }> | null | undefined, monthKey: number,
         day: number, hour: number, month: number): MoonShow[] {
    for (const h of held ?? []) {
      if (!MOON_FESTIVALS.includes(h.id) || h.quiet || h.scale === "none" || this.takenFrom.get(h.id) === monthKey) continue;
      this.takenFrom.set(h.id, monthKey);
      this.owed.set(h.id, h.scale);
    }
    // The night ends at midnight, when the clock's day turns
    if (this.night && this.night.day !== Math.floor(day)) this.night = null;
    if (this.owed.size && inFestivalNight(day, hour, month)) {
      if (!this.night) this.night = { day: Math.floor(day), shows: [] };
      for (const [id, scale] of this.owed) {
        const shown = this.night.shows.find((s) => s.id === id);
        if (shown) shown.scale = scale; else this.night.shows.push({ id, scale });
      }
      this.owed.clear();
    }
    return this.night ? this.night.shows : [];
  }

  /** Whether a full-moon festival is shown now (the time bar's moon glows) */
  get showing(): boolean { return this.night !== null && this.night.shows.length > 0; }

  toJSON(): { owed: [string, string][]; night: { day: number; shows: MoonShow[] } | null } {
    return { owed: [...this.owed], night: this.night };
  }

  static fromJSON(raw: unknown): MoonFestivals {
    const festivals = new MoonFestivals(), data = raw as { owed?: unknown; night?: unknown } | null;
    if (data && Array.isArray(data.owed)) {
      for (const pair of data.owed) {
        if (Array.isArray(pair) && MOON_FESTIVALS.includes(pair[0]) && typeof pair[1] === "string") festivals.owed.set(pair[0], pair[1]);
      }
    }
    const night = data?.night as { day?: unknown; shows?: unknown } | null | undefined;
    if (night && typeof night.day === "number" && Array.isArray(night.shows)) {
      festivals.night = { day: night.day, shows: night.shows.filter((s): s is MoonShow =>
        !!s && MOON_FESTIVALS.includes((s as MoonShow).id) && typeof (s as MoonShow).scale === "string") };
    }
    return festivals;
  }
}
