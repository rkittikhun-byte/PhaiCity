/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which rules of the simulation a city is played with (docs/NO_GRID_PLAN.md 4.2, step 0.3). The steps that change the
// rules (fire that spreads, trips on the road graph, power and water along it, buildings as a list, distances in
// metres) change what the same seed and commands make; each raises this number, and a save says which rules it was
// last played with, so the server knows how to replay a city's commands. A city opened from an older save plays on
// with today's rules and is saved with today's number.

/** Today's rules */
export const SIM_VERSION = 3;

/** What each version of the rules changed */
export const SIM_VERSIONS: Readonly<Record<number, string>> = {
  1: "micropolisJS's simulation with PhaiCity's systems, up to 22 Oct 2026 (saves from before simVersion)",
  2: "the road graph has every road (NO_GRID_PLAN 0.1); fire spreads, floods spread onto bare ground, a plot's " +
    "environment looks as far as it says (0.4); a plot finds its road in metres (0.5); road upkeep by length (1.1)",
  3: "on a real-scale city map growth reads the month's trips on the road graph, not random walks over the tiles: a " +
    "plot cut off from where its trips go loses a level, a long commute lowers its score; the roads' traffic comes from " +
    "the trips (NO_GRID_PLAN 1.3)",
};

/** The rules a save was played with: its own number, or 1 for one from before the number was kept */
export function savedSimVersion(saved: { simVersion?: unknown } | null | undefined): number {
  const v = saved?.simVersion;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}
