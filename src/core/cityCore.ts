/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's core (docs/CORE_DESIGN.md, docs/GAME_PLAN.md phase 0): one city with no screen. It holds the world (the
// map, the simulation, the city's objects), takes player commands as plain data and keeps a log of them, runs the
// simulation a step at a time and then its systems in a fixed order, and saves the city. The game builds its city
// with it; tests, the headless runner and later a Web Worker and the server run the same city the same way, so the
// same seed and the same commands at the same steps make the same city. Plain code: no DOM, nothing random but Random.

import { BaseTool } from "../baseTool.js";
import { CityCommands, type Command, type CommandOutcome } from "../cityCommands.js";
import { GameTools } from "../gameTools.js";
import * as Messages from "../messages.js";
import { CityObjects } from "../objects/cityObjects.js";
import type { Building } from "../objects/cityObject.js";
import { Random } from "../random.js";
import { Simulation } from "../simulation.js";
import { canBuildIn, type CityHooks, commandTarget, ensureCityLayers, readCityLayers, writeCityLayers } from "./cityLayers.js";
import { cellsOf, syncCellPlots } from "../zoneCells.js";
import { ownsLand } from "../landBlocks.js";
import { eraMonth } from "../eraScore.js";
import type { Era } from "../era.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

/** A rule of the city that runs after the simulation (docs/CORE_DESIGN.md "Systems"), in the order they were added */
export interface CitySystem {
  readonly name: string;
  /** Once a game month, when the month turns */
  monthly?(core: CityCore): void;
}

/** What the core tells whoever listens (the screen, the sound, the news), as plain data (docs/CORE_DESIGN.md) */
export type CoreEvent =
  /** A month turned (0 January) */
  | { type: "month"; month: number; year: number }
  /** The monthly look over the map found a new building, or one gone (burned, flooded, bulldozed) */
  | { type: "built"; object: Building }
  | { type: "removed"; object: Building }
  /** A player's command was accepted */
  | { type: "command"; step: number; command: Command }
  /** The era score reached the transition: the city's buildings begin to take the next era's look (src/eraScore.ts) */
  | { type: "eraDawn"; era: Era }
  /** The era score reached 1: the city is in a new era */
  | { type: "era"; era: Era };
type Listener<T extends CoreEvent["type"]> = (event: Extract<CoreEvent, { type: T }>) => void;

/** A command the city accepted, and the step it came at: replaying them makes the same city */
export interface LoggedCommand {
  step: number;
  command: Command;
}

export interface CoreSetup {
  /** The map: a new city's from MapGenerator, or an empty GameMap of the save's size for a saved city */
  map: Legacy;
  /** A saved city (src/storage.js format), or null for a new one */
  saved?: Legacy | null;
  /** Difficulty (Simulation.LEVEL_*) and speed (Simulation.SPEED_*) */
  level?: number;
  speed?: number;
  /** The province's rules (src/provinceRules.ts) and resource levels, or null for the game's own */
  rules?: Legacy | null;
  resources?: Legacy | null;
  /** The tools to build with; the game passes its own, which its input also uses for the preview */
  tools?: Legacy;
  /** Seeds Random for a new city, so a test or the server can make the same city again */
  seed?: number;
  hooks?: CityHooks;
}

const SimulationClass = Simulation as unknown as new (map: Legacy, level: number, speed: number, saved: Legacy,
  rules: Legacy, resources: Legacy) => Legacy;
const SimulationStatics = Simulation as unknown as { LEVEL_EASY: number; SPEED_MED: number; SPEED_PAUSED: number;
  SPEED_SLOW: number; SPEED_FAST: number };
const Tools = BaseTool as unknown as { save(data: Legacy): void; load(data: Legacy): void; setAutoBulldoze(on: boolean): void };

export class CityCore {
  readonly map: Legacy;
  readonly simulation: Legacy;
  readonly tools: Legacy;
  readonly commands: CityCommands;
  readonly objects: CityObjects;
  /** The commands accepted since the city opened, with the step each came at */
  readonly log: LoggedCommand[] = [];
  /** Simulation steps run since the city opened (16 make one of the city's time units, 48 units a year) */
  steps = 0;
  private systems: CitySystem[] = [];
  private listeners = new Map<string, Array<(event: CoreEvent) => void>>();

  constructor(setup: CoreSetup) {
    const saved = setup.saved ?? null;
    if (setup.seed !== undefined && !saved) Random.seed(setup.seed);
    this.map = setup.map;
    readCityLayers(this.map, saved);
    this.simulation = new SimulationClass(this.map, setup.level ?? SimulationStatics.LEVEL_EASY,
      setup.speed ?? SimulationStatics.SPEED_MED, saved, setup.rules ?? null, setup.resources ?? null);
    if (saved) {
      Tools.load(saved);
      this.simulation.load(saved);
    }
    ensureCityLayers(this.map);
    // A city painted a cell at a time before its cells made plots (15 Oct 2026) gets its plots now, so it grows
    if (saved && this.map.cellZones && this.map.zoneCells?.size) {
      const owns = canBuildIn(this.map);
      syncCellPlots(this.map, cellsOf(this.map, (x, y) => ownsLand(this.map, x, y) && owns(x, y)));
    }
    this.tools = setup.tools ?? new (GameTools as unknown as new (map: Legacy, rules: Legacy) => Legacy)(this.map,
      this.simulation.rules ?? null);
    this.commands = new CityCommands(commandTarget(this.map, this.simulation, this.tools,
      on => Tools.setAutoBulldoze(on), setup.hooks));
    // Every building as an object of its own (src/objects/), found on the tiles again each month
    this.objects = CityObjects.restore(this.map, saved ? saved.objects : null);
    this.addSystem({ name: "objects", monthly: core => {
      const { added, removed } = core.objects.scan(core.map, core.simulation._cityTime);
      for (const object of added) core.emit({ type: "built", object });
      for (const object of removed) core.emit({ type: "removed", object });
    } });
    // The city's era from its score, and each building's era (docs/GAME_DESIGN.md section 1)
    const eraLevels = { stamps: null as Uint8Array | null };
    this.addSystem({ name: "era", monthly: core => {
      for (const news of eraMonth(core.map, core.simulation, core.objects, eraLevels)) {
        core.emit(news.type === "era" ? { type: "era", era: news.era } : { type: "eraDawn", era: news.era });
      }
    } });
    this.simulation.addEventListener(Messages.DATE_UPDATED, (date: { month: number; year: number }) => {
      for (const system of this.systems) system.monthly?.(this);
      this.emit({ type: "month", month: date.month, year: date.year });
    });
  }

  /** Listens for one kind of event; returns the way to stop */
  on<T extends CoreEvent["type"]>(type: T, listener: Listener<T>): () => void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener as (event: CoreEvent) => void);
    this.listeners.set(type, list);
    return () => { const at = list.indexOf(listener as (event: CoreEvent) => void); if (at >= 0) list.splice(at, 1); };
  }
  /** Tells the listeners; systems call it for what they do */
  emit(event: CoreEvent): void {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }

  /** Adds a rule that runs after the ones already added */
  addSystem(system: CitySystem): void { this.systems.push(system); }
  get systemNames(): string[] { return this.systems.map(s => s.name); }

  /** A player's command, checked and applied (src/cityCommands.ts); accepted ones are logged */
  apply(command: Command): CommandOutcome {
    const outcome = this.commands.apply(command);
    if (outcome.accepted) {
      this.log.push({ step: this.steps, command });
      this.emit({ type: "command", step: this.steps, command });
    }
    return outcome;
  }

  /** One step of the simulation, then the city's time, which turns the months and runs the monthly systems */
  step(): void {
    this.commands.settle();
    this.simulation._simulate(this.simulation._constructSimData());
    this.steps++;
    this.simulation._updateTime();
  }

  /** Many steps; a year is 48 × 16 */
  run(steps: number): void {
    for (let i = 0; i < steps; i++) this.step();
  }

  /** The browser's loop: a step when the speed's time has passed by the clock, else only the time */
  tick(now: number = Date.now()): void {
    this.commands.settle();
    const sim = this.simulation, speed = sim._speed;
    const threshold = speed === SimulationStatics.SPEED_FAST ? 10 : speed === SimulationStatics.SPEED_MED ? 50 : 100;
    if (!sim.budget.awaitingValues && speed !== SimulationStatics.SPEED_PAUSED && now - sim._lastTickTime >= threshold) {
      sim._simulate(sim._constructSimData());
      this.steps++;
      sim._lastTickTime = new Date(now);
    }
    sim._updateTime();
  }

  /** The city as a save keeps it, apart from what only the game knows (its name, the ruler's rank, the news …) */
  save(): Record<string, unknown> {
    this.commands.settle();
    this.objects.scan(this.map, this.simulation._cityTime);
    const data: Record<string, unknown> = { ...writeCityLayers(this.map), objects: this.objects.toJSON() };
    Tools.save(data);
    this.simulation.save(data);
    return data;
  }
}

/** A year of the simulation, in steps */
export const STEPS_PER_YEAR = 48 * 16;
