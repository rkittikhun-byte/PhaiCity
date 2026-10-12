/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Checks on everything a client sends. Anything that fails is a 400 with the reason as its code.

import { HttpError } from "./http.ts";
import type { CityStats } from "./types.ts";

export const NAME_MAX = 40;
export const SAVE_MAX_BYTES = 2 * 1024 * 1024;
export const RANKS = ["muen", "khun", "luang", "phra", "phraya", "chaophraya"];

export function positiveId(value: string, code = "bad_id"): number {
  if (!/^[1-9][0-9]{0,15}$/.test(value)) throw new HttpError(400, code);
  return Number(value);
}

export function provinceId(value: unknown): string {
  if (typeof value !== "string" || !/^TH-[0-9]{2}$/.test(value)) throw new HttpError(400, "bad_province");
  return value;
}

/** A name shown to other players: trimmed, 1–40 characters, no control characters. */
export function name(value: unknown, code: string): string {
  if (typeof value !== "string") throw new HttpError(400, code);
  const trimmed = value.normalize("NFC").trim().replace(/\s+/g, " ");
  // eslint-disable-next-line no-control-regex
  if (trimmed.length < 1 || [...trimmed].length > NAME_MAX || /[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) {
    throw new HttpError(400, code);
  }
  return trimmed;
}

const isCount = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= max;

/** The public figures of a save, as the game reports them (src/game.js save meta). */
export function stats(value: unknown): CityStats {
  const s = value as Partial<CityStats> | null;
  if (!s || typeof s !== "object") throw new HttpError(400, "bad_stats");
  if (!isCount(s.population, 100_000_000) || !isCount(s.funds, 2_000_000_000) || !isCount(s.year, 100_000) ||
      !isCount(s.month, 11) || typeof s.rank !== "string" || !RANKS.includes(s.rank)) {
    throw new HttpError(400, "bad_stats");
  }
  return { population: s.population, funds: s.funds, year: s.year, month: s.month, rank: s.rank };
}

/** A save body: { revision, data, stats } with data a JSON object (the game's save). */
export function saveBody(value: unknown): { revision: number; data: Record<string, unknown>; stats: CityStats } {
  const body = value as { revision?: unknown; data?: unknown; stats?: unknown } | null;
  if (!body || typeof body !== "object") throw new HttpError(400, "bad_save");
  if (!isCount(body.revision, 2_000_000_000)) throw new HttpError(400, "bad_revision");
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new HttpError(400, "bad_save");
  return { revision: body.revision, data: body.data as Record<string, unknown>, stats: stats(body.stats) };
}
