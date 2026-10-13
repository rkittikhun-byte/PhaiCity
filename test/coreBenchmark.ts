/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How fast the core runs Khon Kaen's real-scale city map (400 × 400 tiles of 16 m, docs/CITY_SCALE.md), a year with
// no screen, for the speed budget of docs/GAME_PLAN.md section 6. Only when asked, as it takes a while:
//   CORE_BENCH=1 npx jest test/coreBenchmark.ts --coverage=false

import * as fs from "fs";
import * as path from "path";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { MapGenerator } from "../src/mapGenerator.js";

const run = process.env.CORE_BENCH ? test : test.skip;

run("a year of Khon Kaen's city map", () => {
  const preset = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "maps", "city", "TH-40.json"), "utf8"));
  const layer = (encoded?: string) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : undefined);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  map.insideProvince = layer(preset.inside) ?? null;
  map.nationalTransport = transport ?? null;
  map.town = preset.town ?? null;
  map.tileSizeM = preset.tileSizeM ?? 16;
  const started = Date.now();
  const core = new CityCore({ map, seed: 1 });
  const built = Date.now() - started;
  const months: number[] = [];
  let last = Date.now();
  core.addSystem({ name: "clock", monthly: () => { const now = Date.now(); months.push(now - last); last = now; } });
  core.run(STEPS_PER_YEAR);
  const scan = Date.now(); core.objects.scan(core.map, 0); const scanMs = Date.now() - scan;
  console.log(`map ${map.width}×${map.height}: build ${built} ms, a year ${months.reduce((a, b) => a + b, 0)} ms, ` +
    `a month ${Math.round(months.reduce((a, b) => a + b, 0) / months.length)} ms (slowest ${Math.max(...months)}), ` +
    `objects scan ${scanMs} ms`);
}, 600000);
