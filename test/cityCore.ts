/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's core (src/core/): a city with no screen, built and run by commands, the same every time it is replayed,
// saved and opened again, with its objects kept up month by month.

import * as fs from "fs";
import * as path from "path";
import type { Command } from "../src/cityCommands";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { MapGenerator } from "../src/mapGenerator.js";
import { DIRT } from "../src/tileValues";

/** Khon Kaen's whole-province map as a new city gets it (src/splashScreen.js) */
function khonKaen() {
  const preset = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "maps", "TH-40.json"), "utf8"));
  const layer = (encoded?: string) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : undefined);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  map.insideProvince = layer(preset.inside) ?? null;
  map.nationalTransport = transport ?? null;
  map.town = preset.town ?? null;
  return map;
}

/** Bare land of w × h inside the province, nearest its town */
function dryArea(map: any, w: number, h: number): { x: number; y: number } {
  let best: { x: number; y: number } | null = null, bestDistance = Infinity;
  for (let y = 2; y < map.height - h - 2; y++) for (let x = 2; x < map.width - w - 2; x++) {
    const distance = Math.hypot(x - map.town.x, y - map.town.y);
    if (distance >= bestDistance) continue;
    let dry = true;
    for (let yy = y; yy < y + h && dry; yy++) for (let xx = x; xx < x + w && dry; xx++) {
      dry = map.getTileValue(xx, yy) === DIRT && (!map.insideProvince || map.insideProvince[xx + yy * map.width] === 1);
    }
    if (dry) { best = { x, y }; bestDistance = distance; }
  }
  if (!best) throw new Error("no dry area");
  return best;
}

/** A small town by commands: the ruler's house, a gas plant, homes, shops, roads and wires */
function townOrders(x0: number, y0: number): Command[] {
  const orders: Command[] = [{ type: "setting", setting: "autoBudget", on: true }];
  for (let x = x0; x < x0 + 26; x++) orders.push({ type: "tool", tool: "road", x, y: y0 + 3 });
  orders.push({ type: "tool", tool: "ruler_house" as any, x: x0 + 1, y: y0 + 1 });
  orders.push({ type: "tool", tool: "gas" as any, x: x0 + 5, y: y0 + 5 });
  for (let k = 0; k < 5; k++) orders.push({ type: "tool", tool: "residential", x: x0 + 9 + 3 * k, y: y0 + 1 });
  for (let k = 0; k < 3; k++) orders.push({ type: "tool", tool: "commercial", x: x0 + 9 + 3 * k, y: y0 + 5 });
  orders.push({ type: "tool", tool: "wire", x: x0 + 7, y: y0 + 3 });
  return orders;
}

describe("the game's core", () => {
  jest.setTimeout(240000);

  test("a city with no screen is built by commands, runs, keeps its objects and its log", () => {
    const map = khonKaen();
    const core = new CityCore({ map, seed: 11 });
    map.landBlocks = null; // own all the land, as a practice map does (src/landBlocks.ts)
    const heard: string[] = [];
    core.on("built", e => heard.push(`built ${e.object.kind}`));
    core.on("month", e => heard.push(`month ${e.month}`));
    let commandsHeard = 0;
    const stop = core.on("command", () => commandsHeard++);
    core.simulation.budget.setFunds(80000);
    const area = dryArea(map, 26, 8);
    const outcomes = townOrders(area.x, area.y).map(order => core.apply(order));
    expect(outcomes.map((o, i) => o.accepted ? null : [i, o.reason]).filter(Boolean)).toEqual([]);
    expect(core.log.length).toBe(outcomes.length);
    expect(commandsHeard).toBe(outcomes.length);
    stop();
    core.apply({ type: "setting", setting: "autoBudget", on: true });
    expect(commandsHeard).toBe(outcomes.length);
    // The kinds the game records are recorded here too: the plant is gas, the house is the ruler's
    expect(Object.values(map.powerKinds)).toEqual(["gas"]);
    expect(map.rulerHouse).toMatchObject({ x: area.x + 1, y: area.y + 1, level: 1 });

    const start = core.simulation.getDate().year;
    core.run(STEPS_PER_YEAR);
    expect(core.systemNames).toEqual(["objects"]);
    const kinds = core.objects.all().map(o => o.kind);
    expect(kinds).toContain("power_plant");
    expect(kinds).toContain("civic");
    expect(core.objects.all().find(o => o.kind === "power_plant")!.sort(map)).toBe("gas");
    expect(kinds.filter(k => k === "home")).toHaveLength(5);
    // The first month's look found what the commands built; every month turned once
    expect(heard.filter(h => h.startsWith("built")).sort()).toEqual(
      ["built civic", "built home", "built home", "built home", "built home", "built home", "built power_plant",
        "built shop", "built shop", "built shop"]);
    // The first step reports the month the city starts in, then twelve months turn
    expect(heard.filter(h => h.startsWith("month"))).toHaveLength(13);
    expect(core.simulation.getDate().year).toBe(start + 1);
  });

  test("the same seed and the same commands at the same steps make the same city", () => {
    const play = (replay?: { step: number; command: Command }[]) => {
      const map = khonKaen();
      const core = new CityCore({ map, seed: 5 });
      core.simulation.budget.setFunds(80000);
      const area = dryArea(map, 26, 8);
      const orders = replay ?? townOrders(area.x, area.y).map((command, i) => ({ step: i * 40, command }));
      let next = 0;
      for (let step = 0; step < STEPS_PER_YEAR; step++) {
        while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
        core.step();
      }
      let tiles = 0;
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) tiles = (tiles * 31 + map.getTileValue(x, y)) >>> 0;
      return { core, tiles, funds: core.simulation.budget.totalFunds, people: core.simulation.evaluation.cityPop };
    };
    const first = play();
    const again = play(first.core.log);
    expect(again.tiles).toBe(first.tiles);
    expect(again.funds).toBe(first.funds);
    expect(again.people).toBe(first.people);
  });

  test("a saved city opens again with its records, objects and when each went up", () => {
    const map = khonKaen();
    const core = new CityCore({ map, seed: 3 });
    core.simulation.budget.setFunds(80000);
    const area = dryArea(map, 26, 8);
    townOrders(area.x, area.y).forEach(order => core.apply(order));
    core.run(STEPS_PER_YEAR / 2);
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: map.width, height: map.height }));
    expect(saved.powerKinds).toEqual(core.map.powerKinds);

    const again = new CityCore({ map: new (GameMap as any)(saved.width, saved.height), saved });
    expect(again.map.rulerHouse).toEqual(core.map.rulerHouse);
    expect(again.simulation.budget.totalFunds).toBe(core.simulation.budget.totalFunds);
    const built = (c: CityCore) => c.objects.all().map(o => [o.id, o.kind, o.built]).sort();
    expect(built(again)).toEqual(built(core));
    again.run(STEPS_PER_YEAR / 4);
    expect(again.simulation.getDate().year).toBeGreaterThanOrEqual(core.simulation.getDate().year);
  });

  test("a map an odd number of tiles across, as most whole districts are, starts and runs", () => {
    const map = (MapGenerator as any).fromPresetCells(41, 33, new Uint8Array(41 * 33));
    const core = new CityCore({ map, seed: 5 });
    townOrders(4, 4).forEach(order => core.apply(order));
    expect(() => core.run(STEPS_PER_YEAR / 4)).not.toThrow();
  });
});
