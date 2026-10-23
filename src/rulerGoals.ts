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
import { plotKindOfValue } from "./plots";
import { CONDBIT, POWERBIT, ZONEBIT } from "./tileFlags";
import { HOSPITALBASE, RESBASE } from "./tileValues";

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
  /** Water towers: a village's own wells, before the water works come with the second era (src/unlocks.ts) */
  waterTowers?: number;
  wateredZones: number;
  /** Zones and buildings with and without power, read from the map's tiles rather than the census. */
  litZones: number;
  darkZones: number;
  /** Homes with power: home zones and plots whose tiles have it, read from the map (left out: any zone but a plant) */
  litHomes?: number;
  pollution: number;
  crime: number;
  /** The ruler's house standing (src/rulerHouse.ts): 1 or 0 */
  rulerHouse: number;
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
      // A new city builds its ruler's house before anything else (src/rulerHouse.ts)
      // The first road, as the house stands beside one (src/rulerHouse.ts); a city with its house has done it
      { id: "street", tool: "road", done: (s) => s.roads >= 1 || s.rulerHouse >= 1 },
      { id: "house", tool: "ruler_house", done: (s) => s.rulerHouse >= 1 },
      // (on a real-scale city map a painted plot counts as an eighth of a zone, a share of that by its size: any home
      // counts; playtest, 23 Oct 2026: 68 cells of homes along a road were 0.3 of a zone and never ticked it)
      { id: "homes", tool: "residential", done: (s) => s.resZones > 0 },
      { id: "power", tool: "coal", done: (s) => s.powerPlants >= 1 },
      // A home with power, read from the map's tiles (the census counts every zone with power, the plant and the
      // ruler's house too); it runs along the roads (src/powerManager.js)
      { id: "wires", tool: "road", done: (s) => (s.litHomes ?? s.poweredZones - s.powerPlants) >= 1 },
      { id: "roads", tool: "road", done: (s) => s.roads >= 10 },
      { id: "jobs", tool: "commercial", done: (s) => s.comZones > 0 && s.indZones > 0 },
      // Houses grow without water, but nothing bigger does; a village's water tower pumps its own well (src/unlocks.ts
      // TOWER_WELL), the water works come with the second era
      { id: "water", tool: "waterworks", done: (s) => s.waterWorks + (s.waterTowers ?? 0) >= 1 && s.wateredZones > 0 },
      // A town (over 2,000 people) earns the rank ขุน
      { id: "town", tool: null, done: (s) => s.population > 2000 },
    ],
  },
  {
    id: "khun",
    title: "goals.title.khun",
    goals: [
      { id: "police", tool: "police", done: (s) => s.policeStations >= 1 },
      // The fire station is chosen above the safety (police) button (src/toolLevels.ts)
      { id: "fire", tool: "police", done: (s) => s.fireStations >= 1 },
      // Only counts once the city has enough zones for keeping them all lit to take some care
      { id: "lit", tool: "coal", done: (s) => s.litZones >= 20 && s.darkZones === 0 },
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
      // ... and the airport above the port's
      { id: "airport", tool: "port", done: (s) => s.airports >= 1 },
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
    waterTowerPop?: number;
    wateredZoneCount?: number;
    pollutionAverage: number;
    crimeAverage: number;
    rulerHouseCount?: number;
  };
  evaluation: { cityPop: number };
  _map?: (CityMapSource & { paintedZones?: boolean }) | null;
}

/** The homes with power, and the painted plots with and without it, from the map's tiles: a home zone's or plot's tile
 * (240-404) with power, and on a map painted a tile or cell at a time every plot tile, which is no zone's centre */
export function plotPower(map: CityMapSource & { paintedZones?: boolean }): { litHomes: number; lit: number; dark: number } {
  let litHomes = 0, lit = 0, dark = 0;
  const painted = Boolean(map.paintedZones);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const value = map.getTileValue(x, y), flags = map.getTileFlags(x, y);
    if (value >= RESBASE && value < HOSPITALBASE && flags & POWERBIT) litHomes++;
    if (!painted || flags & ZONEBIT || !(flags & CONDBIT) || plotKindOfValue(value) === null) continue;
    if (flags & POWERBIT) lit++;
    else dark++;
  }
  return { litHomes, lit, dark };
}

export function readStats(simulation: SimulationLike): CityStats {
  const census = simulation._census;
  // The census is rebuilt during every scan of the map, so zones without power counted halfway through could miss
  // some; the tiles' own power flags are always whole
  const power = simulation._map ? powerCounts(simulation._map) : { powered: 0, unpowered: 0 };
  const plots = simulation._map ? plotPower(simulation._map) : null;
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
    waterTowers: census.waterTowerPop ?? 0,
    wateredZones: census.wateredZoneCount ?? 0,
    litZones: power.powered + (plots?.lit ?? 0),
    darkZones: power.unpowered + (plots?.dark ?? 0),
    ...(plots ? { litHomes: plots.litHomes } : {}),
    pollution: census.pollutionAverage,
    crime: census.crimeAverage,
    rulerHouse: census.rulerHouseCount ?? 0,
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
