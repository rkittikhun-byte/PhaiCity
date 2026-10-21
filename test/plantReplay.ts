/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The power plants on the tiles their model covers (src/plantBlocks.ts) replay the same, as test/cityCore.ts replays a
// town: the same seed and the same commands at the same steps make the same city, a village's 3 x 3 lignite plant, a
// 2 x 2 solar farm bulldozed from one of its tiles and a 2 x 2 dam and all.

import * as fs from "fs";
import * as path from "path";
import type { Command } from "../src/cityCommands";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { MapGenerator } from "../src/mapGenerator.js";
import { DIRT, PLANT2, PLANT3 } from "../src/tileValues";

/** Khon Kaen's whole-province map as a new city gets it (as test/cityCore.ts) */
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

test("power plants on the tiles their model covers replay into the same city", () => {
  jest.setTimeout(240000);
  let built: { x: number; y: number } = { x: 0, y: 0 };
  const play = (replay?: { step: number; command: Command }[]) => {
    const map = khonKaen();
    const core = new CityCore({ sandbox: true, map, seed: 5 });
    core.simulation.budget.setFunds(80000);
    (core.map as any).needsRulerHouse = false;
    const a = dryArea(map, 20, 8);
    built = a;
    const orders = replay ?? ([
      { type: "setting", setting: "autoBudget", on: true },
      { type: "tool", tool: "coal", x: a.x + 2, y: a.y + 2 }, // a village's 3 x 3 on a.x+1..a.x+3
      { type: "tool", tool: "residential", x: a.x + 5, y: a.y + 2 }, // touching it
      { type: "tool", tool: "solar", x: a.x + 10, y: a.y + 2 }, // a 2 x 2 on a.x+9..a.x+10
      { type: "tool", tool: "bulldozer", x: a.x + 9, y: a.y + 1 }, // taken down from its top left
      { type: "tool", tool: "solar", x: a.x + 14, y: a.y + 6 },
    ] as Command[]).map((command, i) => ({ step: i * 40, command }));
    let next = 0;
    for (let step = 0; step < STEPS_PER_YEAR / 2; step++) {
      while (next < orders.length && orders[next].step === core.steps) core.apply(orders[next++].command);
      core.step();
    }
    let tiles = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) tiles = (tiles * 31 + map.getTileValue(x, y)) >>> 0;
    return { core, map, tiles, funds: core.simulation.budget.totalFunds, people: core.simulation.evaluation.cityPop };
  };
  const first = play();
  const again = play(first.core.log);
  expect(again.tiles).toBe(first.tiles);
  expect(again.funds).toBe(first.funds);
  expect(again.people).toBe(first.people);
  expect(first.map.getTileValue(built.x + 2, built.y + 2)).toBe(PLANT3);
  expect(first.map.getTileValue(built.x + 10, built.y + 2)).not.toBe(PLANT2);
  expect(first.map.getTileValue(built.x + 14, built.y + 6)).toBe(PLANT2);
});
