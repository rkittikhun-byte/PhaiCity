/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals (src/canals.ts, docs/CANALS.md): dug like a road, they are water the bulldozer can fill in again, roads and
// railways they cross become bridges, the ground round them holds more water, and saves keep them.

import type { TilePoint } from "../src/cityView";
import { CityCore } from "../src/core/cityCore";
import { linePath } from "../src/drawPaths";
import { GameMap } from "../src/gameMap.js";
import { isRoadTile } from "../src/roadLevels";
import { canalMarkStands, isCanalAt } from "../src/canals";
import { BULLBIT } from "../src/tileFlags";
import { DIRT, HBRIDGE, HRAIL, RIVER, VBRIDGE } from "../src/tileValues";

const SIZE = 60;

function newCity(saved: unknown = null) {
  const map = new (GameMap as unknown as new (w: number, h: number) => any)(SIZE, SIZE);
  const core = new CityCore({ map, saved, seed: 5 });
  core.simulation.budget.setFunds(500000);
  core.map.needsRulerHouse = false;
  return core;
}

let stroke = 0;
function draw(core: CityCore, a: TilePoint, b: TilePoint, tool: string) {
  stroke++;
  return linePath(a, b).map(({ x, y }) => core.apply({ type: "tool", tool, x, y, stroke, shape: "straight",
    controls: [[a.x, a.y], [b.x, b.y]] } as any));
}
const value = (core: CityCore, x: number, y: number): number => core.map.getTileValue(x, y);
const raw = (core: CityCore, x: number, y: number): number => core.map.getTile(x, y).getRawValue();
const funds = (core: CityCore): number => core.simulation.budget.totalFunds;

describe("canals", () => {
  test("a canal is water the bulldozer can fill, at its price a tile", () => {
    const core = newCity();
    const before = funds(core);
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    for (let y = 5; y <= 14; y++) {
      expect(value(core, 10, y)).toBe(RIVER);
      expect(raw(core, 10, y) & BULLBIT).toBe(BULLBIT);
      expect(isCanalAt(core.map, 10, y)).toBe(true);
    }
    expect(before - funds(core)).toBe(10 * 40);
    // Digging on along water already there costs nothing more
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    expect(before - funds(core)).toBe(10 * 40);
    core.apply({ type: "tool", tool: "bulldozer", x: 10, y: 9 });
    expect(value(core, 10, 9)).toBe(DIRT);
    expect(isCanalAt(core.map, 10, 9)).toBe(false);
  });

  test("the land's own rivers stay out of the bulldozer's reach", () => {
    const core = newCity();
    core.map.setTile(30, 30, RIVER, 0);
    core.apply({ type: "tool", tool: "bulldozer", x: 30, y: 30 });
    expect(value(core, 30, 30)).toBe(RIVER);
    expect(isCanalAt(core.map, 30, 30)).toBe(false);
  });

  test("roads and railways it crosses become bridges, and a bulldozed bridge is the canal again", () => {
    const core = newCity();
    draw(core, { x: 5, y: 10 }, { x: 25, y: 10 }, "road");
    draw(core, { x: 5, y: 20 }, { x: 25, y: 20 }, "rail");
    draw(core, { x: 30, y: 5 }, { x: 30, y: 25 }, "road");
    const before = funds(core);
    draw(core, { x: 15, y: 5 }, { x: 15, y: 25 }, "canal");
    expect(value(core, 15, 10)).toBe(HBRIDGE);
    expect(isRoadTile(value(core, 15, 10))).toBe(true);
    expect(value(core, 15, 20)).toBe(HRAIL);
    expect(before - funds(core)).toBe(19 * 40 + 50 + 100);
    // ... a vertical road crossed by a canal running east-west
    draw(core, { x: 26, y: 15 }, { x: 34, y: 15 }, "canal");
    expect(value(core, 30, 15)).toBe(VBRIDGE);
    // A bridge bulldozed goes back to the canal's water, which can be filled in like the rest
    expect(canalMarkStands(core.map, 15, 10)).toBe(true);
    core.apply({ type: "tool", tool: "bulldozer", x: 15, y: 10 });
    expect(value(core, 15, 10)).toBe(RIVER);
    expect(raw(core, 15, 10) & BULLBIT).toBe(BULLBIT);
    core.apply({ type: "tool", tool: "bulldozer", x: 15, y: 10 });
    expect(value(core, 15, 10)).toBe(DIRT);
  });

  test("buildings and junctions are refused", () => {
    const core = newCity();
    draw(core, { x: 5, y: 10 }, { x: 25, y: 10 }, "road");
    draw(core, { x: 15, y: 5 }, { x: 15, y: 15 }, "road");
    core.apply({ type: "tool", tool: "residential", x: 40, y: 40 });
    const junction = value(core, 15, 10), house = value(core, 40, 40);
    const outcomes = [...draw(core, { x: 15, y: 8 }, { x: 15, y: 12 }, "canal"), ...draw(core, { x: 38, y: 40 }, { x: 42, y: 40 }, "canal")];
    expect(value(core, 15, 10)).toBe(junction);
    expect(value(core, 40, 40)).toBe(house);
    expect(outcomes.some((o) => o.toolResult !== 0)).toBe(true);
  });

  test("the ground round a new canal holds more water, and less again once it is filled in", () => {
    const core = newCity();
    const ground = (core.simulation as any)._waterManager;
    const at = (x: number, y: number): number => ground.natural[y * SIZE + x];
    const dry = at(14, 30);
    draw(core, { x: 10, y: 20 }, { x: 10, y: 40 }, "canal");
    core.run(2);
    expect(at(14, 30)).toBeGreaterThan(dry);
    for (let y = 20; y <= 40; y++) core.apply({ type: "tool", tool: "bulldozer", x: 10, y });
    core.run(2);
    expect(at(14, 30)).toBe(dry);
  });

  test("saves keep the canals, and undo takes a canal back with its money", () => {
    const core = newCity();
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    const again = newCity(JSON.parse(JSON.stringify(core.save())));
    expect(isCanalAt(again.map, 10, 9)).toBe(true);
    expect(raw(again, 10, 9) & BULLBIT).toBe(BULLBIT);

    const before = funds(core);
    draw(core, { x: 20, y: 5 }, { x: 20, y: 14 }, "canal");
    core.apply({ type: "undo" });
    expect(value(core, 20, 9)).toBe(DIRT);
    expect(funds(core)).toBe(before);
    // A mark left under land is not saved
    const saved = newCity(JSON.parse(JSON.stringify(core.save())));
    expect(saved.map.canals[9 * SIZE + 20]).toBe(0);
  });
});
