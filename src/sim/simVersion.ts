/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which rules of the simulation a city is played with (docs/NO_GRID_PLAN.md 4.2, step 0.3). The steps that change the
// rules (fire that spreads, trips on the road graph, power and water along it, buildings as a list, distances in
// metres) change what the same seed and commands make; each raises this number, and a save says which rules it was
// last played with, so the server knows how to replay a city's commands. A city opened from an older save plays on
// with today's rules and is saved with today's number.

/** Today's rules */
export const SIM_VERSION = 17;

/** What each version of the rules changed */
export const SIM_VERSIONS: Readonly<Record<number, string>> = {
  1: "micropolisJS's simulation with PhaiCity's systems, up to 22 Oct 2026 (saves from before simVersion)",
  2: "the road graph has every road (NO_GRID_PLAN 0.1); fire spreads, floods spread onto bare ground, a plot's " +
    "environment looks as far as it says (0.4); a plot finds its road in metres (0.5); road upkeep by length (1.1)",
  3: "on a real-scale city map growth reads the month's trips on the road graph, not random walks over the tiles: a " +
    "plot cut off from where its trips go loses a level, a long commute lowers its score; the roads' traffic comes from " +
    "the trips (NO_GRID_PLAN 1.3)",
  4: "on a real-scale city map power and water run along the road graph: each plant or works feeds the roads it meets, " +
    "each building takes by its kind and level, the nearest by road first, and the far ends go without when short; no " +
    "power from plot to plot, roads within 17 m joined by a short cable (NO_GRID_PLAN 2.2, 2.3)",
  5: "on a map painted a cell at a time the plots are a list: runs of painted columns along a road, a shop a bay, a home " +
    "12 m, a factory 16 m, counted by their area, each growing with its own luck when the scan comes to the tile it is " +
    "counted at, two grown ones beside each other joining for the top level (NO_GRID_PLAN 3B)",
  6: "on a real-scale city map land value and the shops' nearness count the straight-line distance from the centre, " +
    "measured at each block's middle, not the Manhattan distance to its corner (NO_GRID_PLAN 4.2)",
  7: "on a map painted a cell at a time the farm zone is painted in 4 m cells, a field counting as much of its tile as " +
    "is painted; a field's way to a road is measured in metres, diagonally too, as far as the reach x 16 m (NO_GRID_PLAN 3C)",
  8: "on a real-scale city map the city is counted from its lists: a home, shop or factory object a plot (its era kept " +
    "at the tile it is counted at), the unlocks' buildings from the buildings' list, paved roads and railways from the " +
    "graphs (NO_GRID_PLAN 5.2)",
  9: "on a real-scale city map each polluting tile is a source in metres whose plume falls smoothly to nothing 64 m off " +
    "and drifts with the month's wind, the pollution block map its sum at each block's middle (NO_GRID_PLAN 4.1)",
  10: "on a real-scale city map the open land round a block adds to its land value by its share in squares 32, 64 and " +
    "96 m round the block's middle, not by the 64 m block it lies in, and what the ruler's house, the metro, the canals, " +
    "the fields and the festivals add is measured at the block's middle (NO_GRID_PLAN 4.2)",
  11: "on a real-scale city map the police's and the fire brigade's cover runs along the roads from each station, falling " +
    "to nothing 320 m along them, in blocks of 2 tiles; schools' seats and hospitals' care go to the homes along the roads, " +
    "the nearest first, none past 3 km (basic), 6 km (higher) or 4 km (health) (NO_GRID_PLAN 4.3)",
  12: "on a real-scale city map a fire catches the eight tiles round it, more downwind; a flood runs onto land no higher " +
    "than its own by 0.5 m; an unpaid road wears along its length and slows its traffic, never breaking into rubble " +
    "(NO_GRID_PLAN 4.4)",
  13: "the home a school's seats or a hospital's care run out at gets what was left of them, so a city whose homes are all " +
    "within reach scores as by its places and people (NO_GRID_PLAN 4.3)",
  14: "on a real-scale city map a storm keeps to a way and wrecks a band round its path, not the one tile under it " +
    "(NO_GRID_PLAN 4.4)",
  15: "a building whose laid tiles are its square block is never mended over a road, railway or power line on that " +
    "block (one put down against a slanted road kept a corner of it road, which its first mending took, cutting the road)",
  16: "on a real-scale city map, short of power, the ruler's services (police and fire stations, the water works, the " +
    "ruler's house, schools and hospitals, not temples) take theirs before every home, shop and factory on their roads, " +
    "the nearest of them first; the roads go short from the nearest building that went without (GAME_DESIGN 16)",
  17: "on a real-scale city map whose zones are painted in cells a flood reads the ground levelled under each building " +
    "and grown plot, at its road's height where its front meets it (src/terrain/groundGrade.ts, GAME_DESIGN 17)",
};

/** The rules a save was played with: its own number, or 1 for one from before the number was kept */
export function savedSimVersion(saved: { simVersion?: unknown } | null | undefined): number {
  const v = saved?.simVersion;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}
