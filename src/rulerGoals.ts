/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// "ภารกิจแรกของเจ้าเมือง": a short checklist that teaches a new ruler the basics (homes, power, roads, jobs) and
// ticks itself off as the city grows. It only reads the city, every couple of seconds; a ticked task stays ticked.
// The card can be collapsed like the other panels or closed, and its progress is saved with the city.

import { onLanguageChange, t } from "./i18n/index";
import { hide, show } from "./motion";

/** What the tasks look at, read from the simulation's census and evaluation. */
export interface CityStats {
  resZones: number;
  comZones: number;
  indZones: number;
  powerPlants: number;
  poweredZones: number;
  roads: number;
  population: number;
}

export interface Goal {
  id: string;
  /** The tool button to point at while this is the current task. */
  tool: string | null;
  done(stats: CityStats): boolean;
}

export const GOALS: Goal[] = [
  { id: "homes", tool: "residential", done: (s) => s.resZones >= 1 },
  { id: "power", tool: "coal", done: (s) => s.powerPlants >= 1 },
  // Power plants are zones with power themselves, so at least one other zone must have it
  { id: "wires", tool: "wire", done: (s) => s.poweredZones - s.powerPlants >= 1 },
  { id: "roads", tool: "road", done: (s) => s.roads >= 10 },
  { id: "jobs", tool: "commercial", done: (s) => s.comZones >= 1 && s.indZones >= 1 },
  // A town (over 2,000 people) earns the rank ขุน (src/rulerRank.ts)
  { id: "town", tool: null, done: (s) => s.population > 2000 },
];

export interface GoalsState {
  done: string[];
  dismissed: boolean;
}

/** The tasks done so far: what was done before, plus whatever the city shows now. */
export function tickGoals(done: ReadonlySet<string>, stats: CityStats): Set<string> {
  const next = new Set(done);
  for (const goal of GOALS) if (goal.done(stats)) next.add(goal.id);
  return next;
}

/** The first task not yet done, or null when all are. */
export function currentGoal(done: ReadonlySet<string>): Goal | null {
  return GOALS.find((goal) => !done.has(goal.id)) ?? null;
}

interface SimulationLike {
  _census: {
    resZonePop: number;
    comZonePop: number;
    indZonePop: number;
    coalPowerPop: number;
    nuclearPowerPop: number;
    poweredZoneCount: number;
    roadTotal: number;
  };
  evaluation: { cityPop: number };
}

export function readStats(simulation: SimulationLike): CityStats {
  const census = simulation._census;
  return {
    resZones: census.resZonePop,
    comZones: census.comZonePop,
    indZones: census.indZonePop,
    powerPlants: census.coalPowerPop + census.nuclearPowerPop,
    poweredZones: census.poweredZoneCount,
    roads: census.roadTotal,
    population: simulation.evaluation.cityPop,
  };
}

function parseState(saved: unknown): GoalsState | null {
  if (typeof saved !== "object" || saved === null) return null;
  const s = saved as Partial<GoalsState>;
  return {
    done: Array.isArray(s.done) ? s.done.filter((id): id is string => typeof id === "string") : [],
    dismissed: s.dismissed === true,
  };
}

const CHECK_INTERVAL_MS = 2000;
const HIDE_AFTER_DONE_MS = 8000;

export interface RulerGoals {
  /** For the save. */
  state(): GoalsState;
}

/**
 * Shows the task card (#rulerGoals in index.html) for this city. saved is the city's saved progress, if any.
 * A city that already has every task done, or whose ruler closed the card, never shows it.
 */
export function installRulerGoals(simulation: SimulationLike, saved: unknown, doc: Document = document): RulerGoals {
  const restored = parseState(saved);
  let done = tickGoals(new Set(restored?.done ?? []), readStats(simulation));
  let dismissed = restored?.dismissed ?? false;
  const result: RulerGoals = { state: () => ({ done: [...done], dismissed }) };

  const card = doc.getElementById("rulerGoals");
  const list = doc.getElementById("goalsList");
  const hint = doc.getElementById("goalsHint");
  const progress = doc.getElementById("goalsProgress");
  const close = doc.getElementById("goalsClose");
  if (!card || !list || !hint || !progress || !close) return result;
  if (dismissed || currentGoal(done) === null) {
    dismissed = true;
    return result;
  }

  let timer: number | undefined;
  let pointedTool: Element | null = null;

  const pointAt = (tool: string | null): void => {
    pointedTool?.classList.remove("goalHint");
    pointedTool = tool ? doc.querySelector(`[data-tool="${tool}"]`) : null;
    pointedTool?.classList.add("goalHint");
  };

  const render = (): void => {
    const current = currentGoal(done);
    list.replaceChildren(...GOALS.map((goal) => {
      const item = doc.createElement("li");
      item.textContent = t(`goals.${goal.id}`);
      item.classList.toggle("done", done.has(goal.id));
      item.classList.toggle("current", goal === current);
      return item;
    }));
    progress.textContent = t("goals.progress", { done: done.size, total: GOALS.length });
    hint.textContent = current ? t(`goals.${current.id}.hint`) : t("goals.done_all");
    pointAt(current?.tool ?? null);
  };

  const finish = (): void => {
    dismissed = true;
    window.clearInterval(timer);
    pointAt(null);
    hide(card, true);
  };

  close.addEventListener("click", finish);
  onLanguageChange(() => { if (!dismissed) render(); });
  timer = window.setInterval(() => {
    const next = tickGoals(done, readStats(simulation));
    if (next.size === done.size) return;
    done = next;
    render();
    if (currentGoal(done) === null) {
      window.clearInterval(timer);
      window.setTimeout(finish, HIDE_AFTER_DONE_MS);
    }
  }, CHECK_INTERVAL_MS);

  render();
  show(card);
  return result;
}
