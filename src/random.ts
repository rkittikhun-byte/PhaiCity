/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

// PhaiCity: one seedable generator for the whole game in place of Math.random, so a city's randomness can be
// seeded, saved with the city and carried on after a load (CLAUDE.md, "Online plan" rule 5: the server will hand
// out seeds). mulberry32 keeps 32 bits of state, which is plenty for a game. Sprites still draw from it once per
// animation frame, so a city is not yet replayable tick for tick; that comes when they move inside the
// simulation's tick.

interface MathGlobal {
  random(): number;
  floor(n: number): number;
}

let generatorState = (Date.now() ^ 0x9e3779b9) >>> 0;

/** The next number in [0, 1) from the seeded generator. */
function next(): number {
  generatorState = (generatorState + 0x6d2b79f5) >>> 0;
  let t = generatorState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Starts the generator over from a seed (any number; only its low 32 bits count). */
function seed(value: number): void {
  generatorState = value >>> 0;
}

/** The generator's state, for a save. */
function getState(): number {
  return generatorState;
}

/** Carries on from a saved state; anything that is not a 32-bit whole number is ignored. */
function setState(value: unknown): boolean {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffffff) return false;
  generatorState = value;
  return true;
}

const seeded: MathGlobal = { random: next, floor: Math.floor };

type UpperBoundedRNG = (maxValue: number) => number;

type SixteenBitRNG = () => number;

function getChance(chance: number, rng: SixteenBitRNG = getRandom16): boolean {
  // tslint:disable-next-line:no-bitwise
  return (rng() & chance) === 0;
}

function getERandom(max: number, rng: UpperBoundedRNG = getRandom): number {
  const firstCandidate = rng(max);
  const secondCandidate = rng(max);
  return Math.min(firstCandidate, secondCandidate);
}

function getRandom(max: number, mathGlobal: MathGlobal = seeded): number {
  return mathGlobal.floor(mathGlobal.random() * (max + 1));
}

function getRandom16(rng: UpperBoundedRNG = getRandom): number {
  return rng(65535);
}

function getRandom16Signed(rng: SixteenBitRNG = getRandom16) {
  const value = rng();

  if (value < 32768) {
    return value;
  } else {
    return -(2 ** 16) + value;
  }
}

const Random = {
  getChance,
  getERandom,
  getRandom,
  getRandom16,
  getRandom16Signed,
  getState,
  next,
  seed,
  setState,
};

export { Random };
