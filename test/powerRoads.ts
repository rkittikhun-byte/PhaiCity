/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Power runs along the roads, as water does (owner, 15 Oct 2026: "ไฟฟ้าไม่ต้องปักเสาเลย มีถนน แล้วก็มีไฟเลยได้ไหม แต่ต้อง
// สร้างเครื่องกำเนิดไฟ"): a plant beside a road powers the zones beside that road, with no power lines, and the road
// takes none of its power (src/powerManager.js).

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";
import { POWERBIT } from "../src/tileFlags";
import { PowerManager } from "../src/powerManager.js";

function city() {
  Random.seed(11);
  const map = (MapGenerator as any).fromPresetCells(120, 40, new Uint8Array(120 * 40));
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(100000);
  // A long road along row 20
  for (let x = 2; x < 118; x++) expect(core.apply({ type: "tool", tool: "road", x, y: 20 }).accepted).toBe(true);
  // A new city's first building is its office, beside a road
  expect(core.apply({ type: "tool", tool: "ruler_house" as any, x: 12, y: 18 }).accepted).toBe(true);
  return core;
}

const powered = (core: CityCore, x: number, y: number): boolean => (core.map.getTileFlags(x, y) & POWERBIT) !== 0;

describe("power along the roads", () => {
  test("a plant beside a road powers a zone beside it far away, with no power lines", () => {
    const core = city();
    // A coal plant at the road's west end, its tiles 17–20 down to the road's row less one: (4..7, 16..19)
    expect(core.apply({ type: "tool", tool: "coal", x: 5, y: 17 }).accepted).toBe(true);
    // Homes 100 tiles away, beside the road (centre (105, 18): tiles 104..106, 17..19)
    expect(core.apply({ type: "tool", tool: "residential", x: 105, y: 18 }).accepted).toBe(true);
    // ... and homes nowhere near a road
    expect(core.apply({ type: "tool", tool: "residential", x: 60, y: 5 }).accepted).toBe(true);
    core.run(200);
    expect(powered(core, 105, 18)).toBe(true);
    expect(powered(core, 60, 5)).toBe(false);
  });

  test("power crosses an opening bridge under heavy traffic (tile 207), as water does (owner, 20 Oct 2026)", () => {
    // A row of road with the busy bridge tile in its middle, the power coming in at its west end
    const map = (MapGenerator as any).fromPresetCells(30, 5, new Uint8Array(30 * 5));
    for (let x = 0; x < 30; x++) map.setTile(x, 2, x === 15 ? 207 : 66, 0);
    const power = new PowerManager(map);
    power.addSource(0, 2);
    power.doPowerScan({ plantPower: 1000, nuclearPowerPop: 0 });
    expect(power.powerGridMap.worldGet(14, 2)).toBe(1);
    expect(power.powerGridMap.worldGet(15, 2)).toBe(1);
    expect(power.powerGridMap.worldGet(29, 2)).toBe(1);
  });

  test("power runs along a road drawn in metres at a slant, its tiles a chain side to side (metre plan 1.5)", () => {
    // Along the tiles of a road drawn from (3, 2) to (100, 35) tiles, in metres on 16 m tiles, the power coming in at its start
    const map = (MapGenerator as any).fromPresetCells(120, 40, new Uint8Array(120 * 40));
    map.tileSizeM = 16;
    const core = new CityCore({ map, seed: 11 });
    core.simulation.budget.setFunds(100000);
    expect(core.apply({ type: "road", tool: "road", from: [3.5 * 16, 2.5 * 16], to: [100.5 * 16, 35.5 * 16], stroke: 1 }).toolResult).toBe(0);
    const power = new PowerManager(map);
    power.addSource(3, 2);
    power.doPowerScan({ plantPower: 1000, nuclearPowerPop: 0 });
    expect(power.powerGridMap.worldGet(100, 35)).toBe(1);
  });

  test("without a plant the road carries nothing", () => {
    const core = city();
    expect(core.apply({ type: "tool", tool: "residential", x: 105, y: 18 }).accepted).toBe(true);
    core.run(200);
    expect(powered(core, 105, 18)).toBe(false);
  });
});
