/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Random numbers of each thing of the city of its own (docs/NO_GRID_PLAN.md 4.3, step 0.2). The game's one Random is
// drawn in the order the map is scanned, so adding a building changes the luck of every building scanned after it. The
// systems that work on things rather than tiles (trips on the road graph, buildings as a list) draw Random once at the
// start of the month (monthSeed) and give each thing its own numbers from that and its id (agentRandom): a building
// added or bulldozed leaves the others' numbers as they were, and a replay still makes the same city, as the month's
// number comes from the Random a save keeps. Plain code, no DOM.

import { Random } from "../random";

/** The month's number, drawn once from Random */
export function monthSeed(): number {
  return Math.floor(Random.next() * 4294967296) >>> 0;
}

/** Mixes two 32-bit numbers into one well spread (the finaliser of MurmurHash3 over both) */
export function mix(a: number, b: number): number {
  let h = (Math.imul(a >>> 0, 0x9e3779b1) ^ (b >>> 0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A thing's own numbers this month: a generator of numbers in [0, 1) from the month's number and its id (and, where
 * one thing draws for several purposes, a salt), the same every time it is asked again (mulberry32) */
export function agentRandom(seed: number, id: number, salt = 0): () => number {
  let state = mix(mix(seed, id), salt);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
