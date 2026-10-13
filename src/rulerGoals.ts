/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// "ภารกิจแรกของเจ้าเมือง": a short checklist that teaches a new ruler the basics (homes, power, roads, jobs) and
// ticks itself off as the city grows, followed by a chapter of tasks for each new rank up to พระ. It only reads the
// city, every couple of seconds; a ticked task stays ticked. The card slides away to a tab at the screen edge like
// the other panels (its own button does the same), and its progress is saved with the city.

import { type CityMapSource, powerCounts } from "./cityMap";
import { onLanguageChange, t } from "./i18n/index";
import { hide, show } from "./motion";
import { setPanelCollapsed } from "./panelCollapse";

/** What the tasks look at, read from the simulation's census and evaluation. */
export interface CityStats {
  resZones: number;
  comZones: number;
  indZones: number;
  powerPlants: number;
  poweredZones: number;
  roads: number;
  population: number;
  rails: number;
  policeStations: number;
  fireStations: number;
  stadiums: number;
  airports: number;
  /** Water works, and zones a road with water reaches (src/waterManager.ts) */
  waterWorks: number;
  wateredZones: number;
  /** Zones and buildings with and without power, read from the map's tiles rather than the census. */
  litZones: number;
  darkZones: number;
  pollution: number;
  crime: number;
}

export interface Goal {
  id: string;
  /** The tool button to point at while this is the current task. */
  tool: string | null;
  done(stats: CityStats): boolean;
}

export interface Chapter {
  id: string;
  /** The card's title while this chapter is on. */
  title: string;
  goals: Goal[];
}

// Each chapter ends where the next rank begins (src/rulerRank.ts)
export const CHAPTERS: Chapter[] = [
  {
    id: "first",
    title: "goals.title",
    goals: [
      { id: "homes", tool: "residential", done: (s) => s.resZones >= 1 },
      { id: "power", tool: "coal", done: (s) => s.powerPlants >= 1 },
      // Power plants are zones with power themselves, so at least one other zone must have it
      { id: "wires", tool: "wire", done: (s) => s.poweredZones - s.powerPlants >= 1 },
      { id: "roads", tool: "road", done: (s) => s.roads >= 10 },
      { id: "jobs", tool: "commercial", done: (s) => s.comZones >= 1 && s.indZones >= 1 },
      // Houses grow without water, but nothing bigger does
      { id: "water", tool: "waterworks", done: (s) => s.waterWorks >= 1 && s.wateredZones >= 1 },
      // A town (over 2,000 people) earns the rank ขุน
      { id: "town", tool: null, done: (s) => s.population > 2000 },
    ],
  },
  {
    id: "khun",
    title: "goals.title.khun",
    goals: [
      { id: "police", tool: "police", done: (s) => s.policeStations >= 1 },
      { id: "fire", tool: "fire", done: (s) => s.fireStations >= 1 },
      // Only counts once the city has enough zones for keeping them all lit to take some care
      { id: "lit", tool: "wire", done: (s) => s.litZones >= 20 && s.darkZones === 0 },
      { id: "rail", tool: "rail", done: (s) => s.rails >= 20 },
      { id: "stadium", tool: "stadium", done: (s) => s.stadiums >= 1 },
      // A city (over 10,000 people) earns the rank หลวง
      { id: "city", tool: null, done: (s) => s.population > 10000 },
    ],
  },
  {
    id: "luang",
    title: "goals.title.luang",
    goals: [
      { id: "airport", tool: "airport", done: (s) => s.airports >= 1 },
      // The game warns of pollution above 60 and crime above 100 (src/simulation.js); these ask for better
      { id: "clean", tool: null, done: (s) => s.population > 10000 && s.pollution < 50 },
      { id: "safe", tool: "police", done: (s) => s.population > 10000 && s.crime < 50 },
      // A capital (over 50,000 people) earns the rank พระ
      { id: "capital", tool: null, done: (s) => s.population > 50000 },
    ],
  },
];

export const GOALS: Goal[] = CHAPTERS.flatMap((chapter) => chapter.goals);

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

/** The first chapter with a task not yet done, or null when all are. */
export function currentChapter(done: ReadonlySet<string>): Chapter | null {
  return CHAPTERS.find((chapter) => chapter.goals.some((goal) => !done.has(goal.id))) ?? null;
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
    railTotal: number;
    policeStationPop: number;
    fireStationPop: number;
    stadiumPop: number;
    airportPop: number;
    waterWorksPop?: number;
    wateredZoneCount?: number;
    pollutionAverage: number;
    crimeAverage: number;
  };
  evaluation: { cityPop: number };
  _map?: CityMapSource;
}

export function readStats(simulation: SimulationLike): CityStats {
  const census = simulation._census;
  // The census is rebuilt during every scan of the map, so zones without power counted halfway through could miss
  // some; the tiles' own power flags are always whole
  const power = simulation._map ? powerCounts(simulation._map) : { powered: 0, unpowered: 0 };
  return {
    resZones: census.resZonePop,
    comZones: census.comZonePop,
    indZones: census.indZonePop,
    powerPlants: census.coalPowerPop + census.nuclearPowerPop,
    poweredZones: census.poweredZoneCount,
    roads: census.roadTotal,
    population: simulation.evaluation.cityPop,
    rails: census.railTotal,
    policeStations: census.policeStationPop,
    fireStations: census.fireStationPop,
    stadiums: census.stadiumPop,
    airports: census.airportPop,
    waterWorks: census.waterWorksPop ?? 0,
    wateredZones: census.wateredZoneCount ?? 0,
    litZones: power.powered,
    darkZones: power.unpowered,
    pollution: census.pollutionAverage,
    crime: census.crimeAverage,
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
const NEXT_CHAPTER_AFTER_MS = 8000;

export interface RulerGoals {
  /** For the save. */
  state(): GoalsState;
}

/**
 * Shows the task card (#rulerGoals in index.html) for this city. saved is the city's saved progress, if any.
 * A city that already has every task done never shows it; one whose ruler put the card away shows only its tab. When
 * a chapter is done the card says so for a few seconds, then moves on to the next chapter, or goes away after the last.
 */
export function installRulerGoals(simulation: SimulationLike, saved: unknown, doc: Document = document): RulerGoals {
  const restored = parseState(saved);
  let done = tickGoals(new Set(restored?.done ?? []), readStats(simulation));
  const putAway = restored?.dismissed ?? false;
  const result: RulerGoals = { state: () => ({ done: [...done], dismissed: true }) };

  const card = doc.getElementById("rulerGoals");
  const title = doc.getElementById("goalsTitle");
  const list = doc.getElementById("goalsList");
  const hint = doc.getElementById("goalsHint");
  const progress = doc.getElementById("goalsProgress");
  const close = doc.getElementById("goalsClose");
  if (!card || !title || !list || !hint || !progress || !close) return result;
  let chapter = currentChapter(done);
  if (chapter === null) return result;
  // Put away, the card waits as a tab at the screen edge (owner, 12 Oct 2026: it vanished with no way back);
  // the city remembers whether its card was put away, or that every chapter is done
  let finished = false;
  result.state = () => ({ done: [...done], dismissed: finished || card.classList.contains("collapsed") });
  if (putAway) setPanelCollapsed("rulerGoals", true);
  // The chapter on the card; when it is done it stays up for a moment before the next one comes
  let shown: Chapter = chapter;

  let timer: number | undefined;
  let pointedTool: Element | null = null;
  let turning = false;

  // The next task's tool glows in the tools, while the card is out
  const pointAt = (tool: string | null): void => {
    pointedTool?.classList.remove("goalHint");
    pointedTool = tool && !finished && !card.classList.contains("collapsed") ? doc.querySelector(`[data-tool="${tool}"]`) : null;
    pointedTool?.classList.add("goalHint");
  };
  const nextTool = (): string | null => shown.goals.find((goal) => !done.has(goal.id))?.tool ?? null;
  new MutationObserver(() => pointAt(nextTool())).observe(card, { attributes: true, attributeFilter: ["class"] });

  const render = (): void => {
    const current = shown.goals.find((goal) => !done.has(goal.id)) ?? null;
    title.textContent = t(shown.title);
    list.replaceChildren(...shown.goals.map((goal) => {
      const item = doc.createElement("li");
      item.textContent = t(`goals.${goal.id}`);
      item.classList.toggle("done", done.has(goal.id));
      item.classList.toggle("current", goal === current);
      return item;
    }));
    const ticked = shown.goals.filter((goal) => done.has(goal.id)).length;
    progress.textContent = t("goals.progress", { done: ticked, total: shown.goals.length });
    const finale = currentChapter(done) === null ? "goals.done_all" : "goals.done_chapter";
    hint.textContent = current ? t(`goals.${current.id}.hint`) : t(finale);
    pointAt(current?.tool ?? null);
  };

  const finish = (): void => {
    finished = true;
    window.clearInterval(timer);
    pointAt(null);
    hide(card, true);
  };

  close.addEventListener("click", () => setPanelCollapsed("rulerGoals", true));
  onLanguageChange(() => { if (!finished) render(); });
  timer = window.setInterval(() => {
    const next = tickGoals(done, readStats(simulation));
    if (next.size === done.size) return;
    done = next;
    render();
    if (turning || shown.goals.some((goal) => !done.has(goal.id))) return;
    // This chapter is done: celebrate for a moment, then the next one, or put the card away after the last
    turning = true;
    window.setTimeout(() => {
      turning = false;
      if (finished) return;
      chapter = currentChapter(done);
      if (chapter === null) {
        finish();
        return;
      }
      shown = chapter;
      render();
    }, NEXT_CHAPTER_AFTER_MS);
  }, CHECK_INTERVAL_MS);

  render();
  show(card);
  return result;
}
