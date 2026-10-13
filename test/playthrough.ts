/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A long game without a browser: a city built by player commands on a real province map, run for years, saved,
// loaded and run on. It catches crashes and broken saves that only show after a while of play, and proves the
// simulation runs in Node (CLAUDE.md, "Online plan" rule 3).

import * as fs from "fs";
import * as path from "path";
import { BaseTool } from "../src/baseTool.js";
import { CityCommands, Command } from "../src/cityCommands";
import { listCities, loadCity, saveCity } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { MapGenerator } from "../src/mapGenerator.js";
import * as Messages from "../src/messages";
import { Random } from "../src/random";
import { Simulation } from "../src/simulation.js";
import { DIRT } from "../src/tileValues";

const STEPS_PER_YEAR = 48 * 16; // 48 time units a year, 16 phases each

interface Sim {
  budget: { totalFunds: number; setFunds(n: number): void };
  evaluation: { cityPop: number; cityClass: string };
  spriteManager: { moveObjects(simData: unknown): void; spriteList: unknown[] };
  blockMaps: unknown;
  disasterManager: unknown;
  _census: Record<string, number>;
  getDate(): { month: number; year: number };
  addEventListener(event: string, listener: (value: any) => void): void;
  save(data: Record<string, unknown>): void;
  load(data: Record<string, unknown>): void;
  setSpeed(speed: number): void;
  _simulate(simData: unknown): void;
  _constructSimData(): unknown;
}

type Map = {
  width: number;
  height: number;
  getTileValue(x: number, y: number): number;
  town?: { x: number; y: number } | null;
  insideProvince?: Uint8Array | null;
};

const SimulationClass = Simulation as unknown as new (map: unknown, level: number, speed: number, saved: unknown) => Sim;
const constants = Simulation as unknown as { LEVEL_EASY: number; SPEED_FAST: number };

/** A province's whole map as a new city gets it (src/splashScreen.js): roads, railways, its own tiles and town. */
function provinceMap(id: string): Map {
  const preset = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "maps", `${id}.json`), "utf8"));
  const layer = (encoded?: string) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : undefined);
  const transport = layer(preset.transport);
  const map = (MapGenerator as unknown as {
    fromPresetCells(w: number, h: number, cells: Uint8Array, transport?: Uint8Array): Map & Record<string, unknown>;
  }).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  map.insideProvince = layer(preset.inside) ?? null;
  map.nationalTransport = transport ?? null;
  map.town = preset.town ?? null;
  return map;
}

/** The top-left of a w × h area of bare land in the province (no water, woods, roads or rails) nearest its town. */
function dryArea(map: Map, w: number, h: number): { x: number; y: number } {
  const dry = (x0: number, y0: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (map.getTileValue(x, y) !== DIRT) return false;
      if (map.insideProvince && !map.insideProvince[x + y * map.width]) return false;
    }
    return true;
  };
  const centre = map.town ?? { x: map.width / 2, y: map.height / 2 };
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (let y = 2; y + h < map.height - 2; y += 3) for (let x = 2; x + w < map.width - 2; x += 3) {
    const distance = Math.abs(x + w / 2 - centre.x) + Math.abs(y + h / 2 - centre.y);
    if (distance < bestDistance && dry(x, y)) {
      best = { x, y };
      bestDistance = distance;
    }
  }
  if (!best) throw new Error("no dry area");
  return best;
}

function newGame(map: Map, saved: unknown = null) {
  const sim = new SimulationClass(map, constants.LEVEL_EASY, constants.SPEED_FAST, saved);
  const tools = new (GameTools as unknown as new (map: unknown) => Record<string, any>)(map);
  const commands = new CityCommands({
    width: map.width,
    height: map.height,
    tools,
    get blockMaps() { return sim.blockMaps; },
    budget: sim.budget as any,
    disasters: sim.disasterManager as any,
    sprites: sim.spriteManager as any,
    setSpeed: (speed) => sim.setSpeed(speed),
    setAutoBulldoze: (on) => (BaseTool as any).setAutoBulldoze(on),
  });
  const messages: string[] = [];
  sim.addEventListener(Messages.FRONT_END_MESSAGE, (message: { subject: string }) => messages.push(message.subject));
  return { sim, commands, messages };
}

function play(sim: Sim, years: number): void {
  for (let step = 0; step < years * STEPS_PER_YEAR; step++) {
    const simData = sim._constructSimData();
    sim._simulate(simData);
    sim.spriteManager.moveObjects(simData); // what the game's animation frame does
  }
}

/** Lays out a small town with the same commands the mouse sends; returns how many were refused or failed. */
function buildTown(commands: CityCommands, x0: number, y0: number): { refused: number; failed: number } {
  const orders: Command[] = [
    { type: "setting", setting: "autoBudget", on: true },
    { type: "tool", tool: "coal", x: x0 + 1, y: y0 + 1 }, // plant on x0..x0+3, y0..y0+3
  ];
  // Homes in a row touching the plant (zones pass power on), shops and factories below, roads between the rows
  for (let k = 0; k < 8; k++) orders.push({ type: "tool", tool: "residential", x: x0 + 5 + 3 * k, y: y0 + 1 });
  for (let x = x0 + 5; x < x0 + 28; x++) orders.push({ type: "tool", tool: "road", x, y: y0 + 3 });
  orders.push({ type: "tool", tool: "wire", x: x0 + 4, y: y0 + 3 });
  for (let k = 0; k < 4; k++) orders.push({ type: "tool", tool: "commercial", x: x0 + 5 + 3 * k, y: y0 + 5 });
  for (let x = x0 + 5; x < x0 + 28; x++) orders.push({ type: "tool", tool: "road", x, y: y0 + 7 });
  orders.push({ type: "tool", tool: "wire", x: x0 + 4, y: y0 + 7 });
  for (let k = 0; k < 4; k++) orders.push({ type: "tool", tool: "industrial", x: x0 + 5 + 3 * k, y: y0 + 9 });
  orders.push({ type: "tool", tool: "police", x: x0 + 17, y: y0 + 5 }); // touching the shops, so powered
  orders.push({ type: "tool", tool: "fire", x: x0 + 20, y: y0 + 5 });
  // Water works touching the fire station (so powered) and both roads, which carry its water to every zone
  orders.push({ type: "tool", tool: "waterworks", x: x0 + 23, y: y0 + 5 });
  orders.push({ type: "tool", tool: "park", x: x0 + 26, y: y0 + 5 });

  let refused = 0;
  let failed = 0;
  for (const order of orders) {
    const outcome = commands.apply(order);
    if (!outcome.accepted) refused++;
    else if (outcome.toolResult !== undefined && outcome.toolResult !== 0) failed++;
  }
  return { refused, failed };
}

class MemoryStore {
  items: Record<string, string> = {};
  getItem(key: string): string | null { return this.items[key] ?? null; }
  setItem(key: string, value: string): void { this.items[key] = value; }
  removeItem(key: string): void { delete this.items[key]; }
}

describe("a long game on a real province map", () => {
  jest.setTimeout(240000);

  test("a town built by commands grows for ten years, saves, loads and plays on", () => {
    const map = provinceMap("TH-40"); // Khon Kaen: a wide plain round the town (Chiang Mai is mostly woods and hills)
    const { sim, commands, messages } = newGame(map);
    sim.budget.setFunds(60000);
    const area = dryArea(map, 32, 12);
    const built = buildTown(commands, area.x, area.y);
    expect(built).toEqual({ refused: 0, failed: 0 });
    const startYear = sim.getDate().year;

    play(sim, 10);

    expect(sim.getDate().year).toBe(startYear + 10);
    expect(sim.evaluation.cityPop).toBeGreaterThan(1000);
    expect(sim.evaluation.cityClass).not.toBe("VILLAGE");
    // the plant, 8 homes, 4 shops, 4 factories, police, fire, water works
    expect(sim._census.poweredZoneCount).toBe(20);
    expect(sim._census.waterWorksPop).toBe(1);
    expect(sim._census.wateredZoneCount + sim._census.dryZoneCount).toBe(16);
    expect(sim._census.wateredZoneCount).toBeGreaterThan(0);
    expect(sim._census.unpoweredZoneCount).toBe(0);
    expect(sim.budget.totalFunds).toBeGreaterThanOrEqual(0);
    expect(messages.length).toBeGreaterThan(0);

    // Save as the game does (src/game.js save), into the many-cities storage, and load it back
    const store = new MemoryStore();
    const saveData: Record<string, unknown> = { name: "ขอนแก่น", everClicked: true, provinceId: "TH-40", worldId: null, rulerRank: "muen" };
    (BaseTool as any).save(saveData);
    sim.save(saveData);
    const id = saveCity(saveData, { name: "ขอนแก่น", provinceId: "TH-40", worldId: null, population: sim.evaluation.cityPop,
      funds: sim.budget.totalFunds, year: sim.getDate().year, month: sim.getDate().month, rank: "muen" }, null, store as any);
    expect(listCities(store as any).map((c) => c.id)).toEqual([id]);

    const saved = loadCity(id, store as any)!;
    const loadedMap = new (GameMap as unknown as new (w: number, h: number) => Map)(saved.width as number, saved.height as number);
    const loaded = newGame(loadedMap, saved);
    for (let y = 0; y < map.height; y += 7) for (let x = 0; x < map.width; x += 7) {
      expect(loadedMap.getTileValue(x, y)).toBe(map.getTileValue(x, y));
    }
    expect(loaded.sim.getDate()).toEqual(sim.getDate());
    expect(loaded.sim.budget.totalFunds).toBe(sim.budget.totalFunds);

    play(loaded.sim, 2);
    expect(loaded.sim.getDate().year).toBe(startYear + 12);
    expect(loaded.sim.evaluation.cityPop).toBeGreaterThan(0);
  });

  test("a first power plant never brings a false brownouts warning", () => {
    // The warning is checked in the cycle where (cityTime & 63) is 32; a plant built just before it used to count
    // as an unpowered zone in its first scan
    for (let phase = 0; phase < 6; phase++) {
      const map = provinceMap("TH-90");
      const { sim, commands, messages } = newGame(map);
      for (let step = 0; step < 16 * 31 + phase; step++) sim._simulate(sim._constructSimData());
      const area = dryArea(map, 4, 4);
      expect(commands.apply({ type: "tool", tool: "coal", x: area.x + 1, y: area.y + 1 }).toolResult).toBe(0);
      for (let step = 0; step < 16 * 3; step++) sim._simulate(sim._constructSimData());
      expect(messages).not.toContain(Messages.BLACKOUTS_REPORTED);
    }
  });

  test("the same seed and the same commands make the same city", () => {
    const run = () => {
      Random.seed(2026);
      const map = provinceMap("TH-90");
      const { sim, commands } = newGame(map);
      sim.budget.setFunds(60000);
      const area = dryArea(map, 32, 12);
      buildTown(commands, area.x, area.y);
      play(sim, 2);
      const tiles: number[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) tiles.push(map.getTileValue(x, y));
      return { tiles: tiles.join(","), funds: sim.budget.totalFunds, population: sim.evaluation.cityPop };
    };
    const first = run();
    const second = run();
    expect(second.funds).toBe(first.funds);
    expect(second.population).toBe(first.population);
    expect(second.tiles === first.tiles).toBe(true);
  });

  test("disasters strike a living city without breaking the game", () => {
    const map = provinceMap("TH-11");
    const { sim, commands } = newGame(map);
    sim.budget.setFunds(60000);
    const area = dryArea(map, 32, 12);
    buildTown(commands, area.x, area.y);
    play(sim, 1);
    for (const disaster of ["fire", "flood", "tornado", "monster", "crash", "meltdown"] as const) {
      expect(commands.apply({ type: "disaster", disaster }).accepted).toBe(true);
      play(sim, 0.25);
    }
    expect(sim.getDate().year).toBeGreaterThan(1900);
  });
});
