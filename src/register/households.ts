/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The households of a home (docs/GAME_DESIGN.md 20.1): who lives there, worked out from the home's own number (its plot's
// id and when it was formed, mixed with the city's) and how many people the census counts for it, never saved and never
// drawn from the game's Random. Each household's kind, members, names and ages come from the home's number and the
// household's place in it, so the same city has the same people every time it is asked, and a home that grows only adds
// people at the end: its last household fills up to its kind's size, then a new one moves in. Plain code: no DOM.

import { agentRandom, mix } from "../sim/agentRandom";
import { givenCount, givenName, type Name, surname, SURNAMES, title } from "./names";
import { HOUSEHOLD_KINDS, type HouseholdKind } from "./registerRules";

export type Relation = "head" | "spouse" | "child" | "elder";

export interface Member {
  /** Its place in the household, 0 the head */
  slot: number;
  relation: Relation;
  male: boolean;
  age: number;
  married: boolean;
  given: Name;
  title: Name;
  /** The person's own number in [0, 1), for what the city decides about them (school, work, pay) */
  u: number;
}

export interface Household {
  /** Its place in the home, 0 the first */
  index: number;
  kind: HouseholdKind;
  surname: Name;
  /** Its surname's number (src/register/names.ts surname), for the names its businesses take */
  family: number;
  /** The members it would have when full; members is a prefix of them */
  size: number;
  members: Member[];
  /** The household's own number in [0, 1), for its money and vehicles */
  u: number;
}

const between = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

/** The full household number h of a home: its kind and every member it has when full */
export function fullHousehold(key: number, h: number): Household {
  const r = agentRandom(key, h, 0x484f4d45);
  const total = HOUSEHOLD_KINDS.reduce((sum, k) => sum + k.weight, 0);
  let pick = r() * total, spec: typeof HOUSEHOLD_KINDS[number] = HOUSEHOLD_KINDS[0];
  for (const k of HOUSEHOLD_KINDS) { pick -= k.weight; if (pick < 0) { spec = k; break; } }
  const familyNumber = Math.floor(r() * SURNAMES), family = surname(familyNumber);
  const adults = between(r, spec.adults[0], spec.adults[1]), children = between(r, spec.children[0], spec.children[1]);
  const elders = between(r, spec.elders[0], spec.elders[1]);
  const members: Member[] = [];
  const used = new Set<string>();
  const add = (relation: Relation, male: boolean, age: number, married: boolean): void => {
    // (a name nobody else in the household has: the next on the list when it is taken)
    const count = givenCount(male, age);
    let n = Math.floor(r() * count), given = givenName(male, age, n);
    for (let tries = 0; used.has(given.th) && tries < count; tries++) given = givenName(male, age, ++n);
    used.add(given.th);
    members.push({ slot: members.length, relation, male, age, married, given, title: title(male, age, married), u: r() });
  };
  // The head and the spouse
  let headAge = 0;
  if (adults > 0) {
    const ages: Record<HouseholdKind, [number, number]> = {
      single: [20, 50], couple: [23, 65], family: [24, 55], parent: [22, 50], extended: [28, 50], elders: [60, 85],
    };
    const maleHead = spec.kind === "single" ? r() < 0.5 : spec.kind === "parent" ? r() < 0.25 : r() < 0.65;
    headAge = between(r, ages[spec.kind][0], ages[spec.kind][1]);
    const married = adults === 2 || (spec.kind === "parent" && headAge >= 30);
    add("head", maleHead, headAge, married);
    if (adults === 2) add("spouse", !maleHead, Math.max(20, headAge + between(r, -6, 3)), true);
  }
  // ... the children, the eldest first
  let age = Math.min(17, Math.max(0, headAge - 19));
  age = between(r, 0, age);
  for (let c = 0; c < children; c++) {
    add("child", r() < 0.5, age, false);
    age = Math.max(0, age - between(r, 1, 4));
  }
  // ... and the grandparents (or, in a household of elders, the elders themselves)
  for (let e = 0; e < elders; e++) {
    const elderAge = Math.min(92, Math.max(60, adults > 0 ? headAge + between(r, 22, 32) : between(r, 60, 88)));
    const male = elders === 2 ? e === 0 : r() < 0.4;
    add(adults > 0 ? "elder" : e === 0 ? "head" : "spouse", male, elderAge, elders === 2 || !male);
  }
  return { index: h, kind: spec.kind, surname: family, family: familyNumber, size: members.length, members, u: r() };
}

/** The home's number: its own id and when it was formed, mixed with the city's */
export function homeKey(city: number, id: number, born: number): number {
  return mix(mix(city, id), born);
}

const cache = new Map<number, Household[]>();
const CACHE_HOMES = 20000;

/**
 * The households of a home with `people` people: full households in order, the last one as full as the people left
 * allow. The full ones are kept for each home (by its number), so asking again costs nothing.
 */
export function householdsOf(key: number, people: number): Household[] {
  const out: Household[] = [];
  if (people <= 0) return out;
  let known = cache.get(key);
  if (!known) {
    if (cache.size >= CACHE_HOMES) cache.clear();
    cache.set(key, known = []);
  }
  let left = people;
  for (let h = 0; left > 0; h++) {
    const full = known[h] ?? (known[h] = fullHousehold(key, h));
    // (a household of nobody, which no kind has, would never end)
    if (!full.size) continue;
    out.push(left >= full.size ? full : { ...full, members: full.members.slice(0, left) });
    left -= full.size;
  }
  return out;
}
