/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Trained people (คนที่มีความรู้, docs/GAME_DESIGN.md 6.1; owner, 21 Oct 2026): the city counts the people its own schools
// train, a class a year, and what needs them waits for them (src/unlocks.ts): no paved road without technicians, no
// provincial hospital without doctors, no solar farm without engineers.
// - Villagers who read and write (literate) come out of primary schools: a farming village becomes a market town only
//   once its first classes have finished (the era symbol "literate", src/eraRules.ts; docs/GAME_DESIGN.md 6.5).
// - Technicians come out of lower secondary schools and vocational colleges, nurses out of vocational colleges, engineers
//   and doctors out of universities, and only from a school that works (standing, finished, with power).
//   A market town becomes a factory town only once it has its first technicians (the era symbol "technicians").
// - Each working health centre (รพ.สต.) brings a nurse home a year: a young villager it sent to nursing college on the
//   district's grant, as Thailand's "nurses back home" scholarships do, so a market town's community hospital need not
//   wait for a vocational college (21 Oct 2026; the normal mode's towns had no nurse in ten years, docs/GAME_DESIGN.md 6.5).
// - A school fills as many of its seats as the city has children (secondary) or young people (colleges, universities)
//   for them, shared with the other schools of its field (src/services.ts), and a class is its filled seats over the
//   years of its course.
// - A school counts only once it has worked its first months (TRAINING wait, times the mode's schooling,
//   src/gameModes.ts): a new university gives its first graduates after four years.
// - Each year's class graduates when the year turns; then some leave: a few every year, and more while the city has
//   fewer jobs than workers.
// Plain code: no DOM and nothing random, so the same city trains the same people.

import { modeRule } from "./gameModes.js";
import { CHILDREN_SHARE, isServiceKind, SERVICE_SPECS, type ServiceKind, YOUNG_SHARE } from "./services.js";
import { POWERBIT } from "./tileFlags.js";
import { CIVIC } from "./tileValues.js";

export const TRAINED_KINDS = ["literate", "technician", "nurse", "engineer", "doctor"] as const;
export type TrainedKind = typeof TRAINED_KINDS[number];
export type TrainedCounts = Record<TrainedKind, number>;

export interface Training {
  /** Years of the course: a class is the filled seats over this */
  course: number;
  /** Months a new school works before its classes count: its first students are still studying */
  wait: number;
  /** The share of a class that becomes each kind of trained person */
  makes: Partial<TrainedCounts>;
  /** A class of this many a year, whatever the city's students (a health centre's nurses), in place of its seats */
  yearly?: number;
}

/** Which schools train whom (data, one place to tune it) */
export const TRAINING: Readonly<Partial<Record<ServiceKind, Training>>> = {
  // (six years of primary school: a sixth of its pupils finish each year, every one of them reading and writing)
  primary_school: { course: 6, wait: 12, makes: { literate: 1 } },
  secondary_school: { course: 3, wait: 12, makes: { technician: 0.12 } },
  vocational_college: { course: 3, wait: 12, makes: { technician: 0.5, nurse: 0.2 } },
  university: { course: 4, wait: 48, makes: { engineer: 0.25, doctor: 0.06 } },
  // (a nurse a year from each health centre, once its first scholar has studied two years)
  health_centre: { course: 1, wait: 24, makes: { nurse: 1 }, yearly: 1 },
};

/** The share of each kind that leaves every year, and the share more that leaves for each share of workers with no job */
export const LEAVE_EACH_YEAR = 0.03;
export const LEAVE_NO_JOBS = 0.5;

export interface TrainedState {
  counts: TrainedCounts;
  /** The class of the year so far, graduating when the year turns */
  cohort: TrainedCounts;
  /** Months each school has worked, by its centre tile */
  worked: Record<string, number>;
  /** The last year's graduates and leavers, for the news */
  last: { graduates: TrainedCounts; left: TrainedCounts } | null;
  /** The month last trained (the city's time in months), so a month opened again by a load is not trained twice */
  at: number;
}

export const noTrained = (): TrainedCounts => ({ literate: 0, technician: 0, nurse: 0, engineer: 0, doctor: 0 });

export function newTrainedState(): TrainedState {
  return { counts: noTrained(), cohort: noTrained(), worked: {}, last: null, at: -1 };
}

const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
const counts = (value: unknown): TrainedCounts => {
  const out = noTrained(), from = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  for (const kind of TRAINED_KINDS) out[kind] = count(from[kind]);
  return out;
};

/** A save's trained people (writeTrained), or none */
export function readTrained(saved: unknown): TrainedState {
  if (!saved || typeof saved !== "object") return newTrainedState();
  const s = saved as Record<string, unknown>, worked: Record<string, number> = {};
  for (const [tile, months] of Object.entries((s.worked && typeof s.worked === "object" ? s.worked : {}) as Record<string, unknown>)) {
    if (/^\d+$/.test(tile) && count(months)) worked[tile] = Math.floor(count(months));
  }
  const at = typeof s.at === "number" && Number.isInteger(s.at) ? s.at : -1;
  return { counts: counts(s.counts), cohort: counts(s.cohort), worked, last: null, at };
}

const rounded = (c: TrainedCounts): TrainedCounts => {
  const out = noTrained();
  for (const kind of TRAINED_KINDS) out[kind] = Math.round(c[kind] * 100) / 100;
  return out;
};

/** The trained people as a save keeps them; nothing while the city has none and trains none */
export function writeTrained(state: TrainedState | null | undefined): Record<string, unknown> | undefined {
  if (!state) return undefined;
  const any = (c: TrainedCounts) => TRAINED_KINDS.some((k) => c[k] > 0);
  if (!any(state.counts) && !any(state.cohort) && !Object.keys(state.worked).length) return undefined;
  return { counts: rounded(state.counts), cohort: rounded(state.cohort), worked: { ...state.worked }, at: state.at };
}

/** The whole people of each kind, as the game shows and the unlocks count them */
export function trainedOf(map: { trained?: TrainedState | null }): TrainedCounts {
  const out = noTrained(), state = map.trained;
  if (state) for (const kind of TRAINED_KINDS) out[kind] = Math.floor(state.counts[kind] + 1e-6);
  return out;
}

/** What the month needs of the map (src/gameMap.js, typed loosely) */
export interface TrainingMap {
  readonly width: number;
  readonly height: number;
  civicKinds?: Record<string, string> | null;
  sites?: Record<string, unknown> | null;
  trained?: TrainedState | null;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  getTile(x: number, y: number): { isZone(): boolean };
}

/** What the month needs of the city: its people, and its workers and jobs (src/valves.js census) */
export interface TrainingCity {
  people: number;
  /** Home and job figures of the census (the era score's jobs, src/eraScore.ts) */
  workers: number;
  jobs: number;
  /** Times each school's TRAINING wait (the mode's schooling, src/gameModes.ts); 1 when left out */
  schooling?: number;
}

/** The schools of a kind that train, working this month: standing on their centre, finished, with power */
function working(map: TrainingMap, tile: number): boolean {
  const x = tile % map.width, y = Math.floor(tile / map.width);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (map.getTileValue(x, y) !== CIVIC || !map.getTile(x, y).isZone()) return false;
  if (map.sites && tile in map.sites) return false;
  return (map.getTileFlags(x, y) & POWERBIT) !== 0;
}

/** What the year's turn did: who graduated and who left */
export interface TrainedYear { graduates: TrainedCounts; left: TrainedCounts }

/**
 * A month of training (the core's monthly "trained" system, src/core/cityCore.ts), the month being the city's time in
 * months: each working school adds its share of the year's class; when the year turns (January) the class graduates
 * and some leave. The year's news, or null.
 */
export function trainMonth(map: TrainingMap, city: TrainingCity, month: number): TrainedYear | null {
  const state = map.trained ??= newTrainedState();
  if (state.at === month) return null;
  state.at = month;
  const newYear = month % 12 === 0;
  const civic = map.civicKinds ?? {};
  // The seats each field has, the working schools' only, and the students the city has for them
  const schools: Array<{ tile: string; kind: ServiceKind }> = [];
  const seats = { basic: 0, higher: 0 };
  const worked: Record<string, number> = {};
  for (const [tile, kind] of Object.entries(civic)) {
    if (!isServiceKind(kind)) continue;
    const spec = SERVICE_SPECS[kind];
    if (!working(map, Number(tile))) continue;
    if (spec.field !== "health") seats[spec.field] += spec.places;
    if (!TRAINING[kind]) continue;
    worked[tile] = (state.worked[tile] ?? 0) + 1;
    schools.push({ tile, kind });
  }
  // (a school gone or without power for a month starts again: its students left)
  state.worked = worked;
  const people = Math.max(0, city.people);
  const fill = {
    basic: seats.basic > 0 ? Math.min(1, people * CHILDREN_SHARE / seats.basic) : 0,
    higher: seats.higher > 0 ? Math.min(1, people * YOUNG_SHARE / seats.higher) : 0,
  };
  for (const { tile, kind } of schools) {
    const training = TRAINING[kind]!, spec = SERVICE_SPECS[kind];
    if (worked[tile] <= Math.round(training.wait * (city.schooling ?? 1))) continue;
    const yearClass = training.yearly ?? spec.places * fill[spec.field as "basic" | "higher"] / training.course;
    for (const [trained, share] of Object.entries(training.makes) as [TrainedKind, number][]) {
      state.cohort[trained] += yearClass * share / 12;
    }
  }
  if (!newYear) return null;
  // The year turned: the class graduates, then some leave, more while there are fewer jobs than workers
  const short = city.workers > 0 ? Math.max(0, 1 - city.jobs / city.workers) : 0;
  const leave = Math.min(1, LEAVE_EACH_YEAR + LEAVE_NO_JOBS * short);
  const year: TrainedYear = { graduates: noTrained(), left: noTrained() };
  for (const kind of TRAINED_KINDS) {
    year.graduates[kind] = state.cohort[kind];
    const before = state.counts[kind] + state.cohort[kind];
    year.left[kind] = before * leave;
    state.counts[kind] = before - year.left[kind];
    state.cohort[kind] = 0;
  }
  state.last = year;
  return year;
}

/** The month's figures of a simulation (src/simulation.js), for trainMonth */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trainingCity(sim: any): TrainingCity {
  const census = sim?._census ?? {};
  return {
    people: sim?.evaluation?.cityPop ?? 0,
    workers: census.resHist10?.[0] ?? 0,
    jobs: (census.comHist10?.[0] ?? 0) + (census.indHist10?.[0] ?? 0),
    schooling: modeRule(sim?._gameLevel).schooling,
  };
}
