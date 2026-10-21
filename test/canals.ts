/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals (src/canals.ts, docs/CANALS.md): dug like a road, they are water the bulldozer can fill in again, roads and
// railways they cross become bridges, the ground round them holds more water, and saves keep them.

import type { TilePoint } from "../src/cityView";
import { CityCore } from "../src/core/cityCore";
import { linePath } from "../src/drawPaths";
import { MapGenerator } from "../src/mapGenerator.js";
import { canalGraphLines } from "../src/roads/canalLines";
import type { RoadGraph } from "../src/roads/roadGraph";
import { Storage } from "../src/storage.js";
import { GameMap } from "../src/gameMap.js";
import { isRoadTile } from "../src/roadLevels";
import { CANAL_LAND_VALUE, CANAL_RISE_MONTHS, canalLandValues, canalMarkStands, canalTarget, growCanals, isCanalAt } from "../src/canals";
import { BULLBIT } from "../src/tileFlags";
import { DIRT, HBRIDGE, HRAIL, RIVER, VBRIDGE } from "../src/tileValues";

const SIZE = 60;

function newCity(saved: unknown = null) {
  const map = new (GameMap as unknown as new (w: number, h: number) => any)(SIZE, SIZE);
  const core = new CityCore({ sandbox: true, map, saved, seed: 5 });
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

  test("a road drawn across a canal bridges it rather than filling it in, and buildings never fill it", () => {
    const core = newCity();
    draw(core, { x: 15, y: 5 }, { x: 15, y: 20 }, "canal");
    draw(core, { x: 5, y: 12 }, { x: 25, y: 12 }, "road");
    expect(value(core, 15, 12)).toBe(HBRIDGE);
    core.apply({ type: "tool", tool: "park", x: 15, y: 8 });
    expect(value(core, 15, 8)).toBe(RIVER);
  });
});

describe("canals drawn in metres (docs/METRE_DRAWING_PLAN.md, step 1's leftovers)", () => {
  /** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
  function cityMap(saved: unknown = null) {
    const map = saved ? new (GameMap as any)(60, 40) : (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    if (!saved) { map.tileSizeM = 16; map.paintedZones = true; }
    const core = new CityCore({ map, saved, seed: 5 });
    core.simulation.budget.setFunds(500000);
    core.map.needsRulerHouse = false;
    return core;
  }
  const dig = (core: CityCore, from: [number, number], to: [number, number], stroke: number, c?: [[number, number], [number, number]]) =>
    core.apply({ type: "road", tool: "canal" as any, from, to, ...(c ? { c1: c[0], c2: c[1] } : {}), stroke });
  const canalGraph = (core: CityCore): RoadGraph => core.map.canalGraph;
  const sameOpen = (core: CityCore) => cityMap(JSON.parse(JSON.stringify({ ...core.save(), width: 60, height: 40,
    version: (Storage as any).CURRENT_VERSION })));

  test("a canal is dug on the tiles its line passes, priced by its length, and kept as dug in a graph of its own", () => {
    const core = cityMap(), before = funds(core);
    expect(dig(core, [8, 168], [904, 168], 1)).toEqual({ accepted: true, toolResult: 0 });
    for (let x = 0; x <= 56; x++) expect(isCanalAt(core.map, x, 10)).toBe(true);
    expect(value(core, 57, 10)).toBe(DIRT);
    // 896 m at ฿40 a 16 m tile, not the 57 tiles it lies on
    expect(before - funds(core)).toBe(Math.round(40 * 896 / 16));
    expect(canalGraph(core).segments.size).toBe(1);
    expect(core.map.roadGraph ?? null).toBeNull();
    // ... a slanted one is water joined side to side, which boats and the ground's water follow
    dig(core, [40.5, 220.25], [700.25, 600.5], 2);
    const wet: Array<[number, number]> = [];
    for (let y = 12; y < 40; y++) for (let x = 0; x < 60; x++) if (isCanalAt(core.map, x, y)) wet.push([x, y]);
    expect(wet.length).toBeGreaterThan(40);
    for (const [x, y] of wet) expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCanalAt(core.map, x + dx, y + dy))).toBe(true);
  });

  test("a road it crosses is bridged, the canal going on under it in its own graph and the road in the road graph", () => {
    const core = cityMap();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    expect(dig(core, [456, 8], [456, 600], 2)).toEqual({ accepted: true, toolResult: 0 });
    expect(value(core, 28, 10)).toBe(HBRIDGE);
    expect(canalGraph(core).segments.size).toBe(1);
    expect(core.map.roadGraph.segments.size).toBe(1);
  });

  test("one refused somewhere (a junction in the way) is dug where it can be and kept as its tiles alone", () => {
    const core = cityMap();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [456, 8], to: [456, 600], stroke: 2 });
    const junction = value(core, 28, 10);
    const out = dig(core, [400.5, 120.25], [520.25, 216.5], 3);
    expect(out.accepted).toBe(true);
    expect(out.toolResult).toBeNull();
    expect(value(core, 28, 10)).toBe(junction);
    expect(isCanalAt(core.map, 25, 7)).toBe(true);
    expect(canalGraph(core)?.segments.size ?? 0).toBe(0);
  });

  test("the bulldozer filling a tile cuts the canal there, the rest staying as dug; undo puts it back whole", () => {
    const core = cityMap();
    dig(core, [8, 168], [904, 168], 1);
    const json = JSON.stringify(canalGraph(core).toJSON());
    core.apply({ type: "tool", tool: "bulldozer", x: 28, y: 10, stroke: 2 });
    expect(value(core, 28, 10)).toBe(DIRT);
    expect(canalGraph(core).segments.size).toBe(2);
    core.apply({ type: "undo" });
    expect(JSON.stringify(canalGraph(core).toJSON())).toBe(json);
    expect(isCanalAt(core.map, 28, 10)).toBe(true);
  });

  test("saves keep the canals as dug, to the millimetre, and a canal dug after opening joins them the same", () => {
    const core = cityMap();
    dig(core, [8, 168], [904, 168], 1);
    dig(core, [60.5, 520.25], [880.75, 430.5], 2, [[250, 330], [520, 640]]);
    const again = sameOpen(core);
    expect(JSON.stringify(canalGraph(again).toJSON())).toBe(JSON.stringify(canalGraph(core).toJSON()));
    expect(isCanalAt(again.map, 20, 10)).toBe(true);
    dig(core, [456, 8], [456, 600], 9);
    dig(again, [456, 8], [456, 600], 9);
    expect(JSON.stringify(canalGraph(again).toJSON())).toBe(JSON.stringify(canalGraph(core).toJSON()));
    expect(canalGraph(again).segments.size).toBeGreaterThan(4);
  });

  test("the lines the view and the tool follow are the canal as dug: cut at a river, joined where canals meet", () => {
    const core = cityMap();
    // The land's own river down column 30
    for (let y = 0; y < 40; y++) core.map.setTile(30, y, RIVER, 0);
    dig(core, [8, 168], [904, 168], 1);
    dig(core, [200.5, 168], [200.5, 600], 2);
    const map = core.map, width = 60;
    const lines = canalGraphLines(canalGraph(core), { width, height: 40, tileSizeM: 16,
      canal: (i) => canalMarkStands(map, i % width, Math.floor(i / width)),
      wet: (i) => [2, 3, 4].includes(map.getTileValue(i % width, Math.floor(i / width))) || canalMarkStands(map, i % width, Math.floor(i / width)) });
    const U = 10 / 16;
    // The east-west canal in two lines either side of the river, at its edges; the T a junction
    const across = lines.lines.filter((l) => l.every((p) => Math.abs(p[1] - 168 * U) < 1e-6));
    expect(across.length).toBe(3);
    const xs = across.flatMap((l) => [l[0][0], l[l.length - 1][0]]).sort((p, q) => p - q);
    expect(xs.some((x) => Math.abs(x - 300) < 0.01)).toBe(true);
    expect(xs.some((x) => Math.abs(x - 310) < 0.01)).toBe(true);
    expect(lines.junctions).toHaveLength(1);
    expect(lines.junctions[0][0]).toBeCloseTo(200.5 * U, 6);
    // ... and the river's tile is the river's
    expect(lines.tiles.includes(10 * width + 30)).toBe(false);
  });
});

describe("canal levels", () => {
  test("a new canal is a ditch and becomes an earth canal within three months, and no more in an empty town", () => {
    const core = newCity();
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    expect(core.map.canals[9 * SIZE + 10]).toBe(1);
    core.run(4 * 16 * (CANAL_RISE_MONTHS + 1));
    expect(core.map.canals[9 * SIZE + 10]).toBe(2);
    core.run(4 * 16 * 12);
    expect(core.map.canals[9 * SIZE + 10]).toBe(2);
  });

  test("a canal earns its level from the city's people and the land value along it", () => {
    expect(canalTarget(0, 0)).toBe(2);
    expect(canalTarget(2000, 29)).toBe(2);
    expect(canalTarget(2000, 30)).toBe(3);
    expect(canalTarget(9999, 200)).toBe(3);
    expect(canalTarget(10000, 60)).toBe(4);
    expect(canalTarget(50000, 99)).toBe(4);
    expect(canalTarget(50000, 100)).toBe(5);
  });

  test("its tiles rise one level every three months together, up to what it has earned, and never fall", () => {
    const core = newCity();
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    const map = core.map, rich = () => 120;
    const levels = (): number[] => [5, 9, 14].map((y) => map.canals[y * SIZE + 10]);
    expect(growCanals(map, 1, 60000, rich)).toBe(false);
    for (let month = 3, expected = 2; expected <= 5; month += 3, expected++) {
      expect(growCanals(map, month, 60000, rich)).toBe(true);
      expect(levels()).toEqual([expected, expected, expected]);
    }
    expect(growCanals(map, 18, 60000, rich)).toBe(false);
    // A town that empties keeps its canal as it is
    growCanals(map, 21, 0, () => 0);
    expect(levels()).toEqual([5, 5, 5]);
  });

  test("a level adds to the land value nearby, in full close by and at half further out", () => {
    const core = newCity();
    draw(core, { x: 30, y: 20 }, { x: 30, y: 30 }, "canal");
    const map = core.map;
    expect(canalLandValues(map)).toBeNull();
    for (let y = 20; y <= 30; y++) map.canals[y * SIZE + 30] = 4;
    const bonus = canalLandValues(map)!;
    expect(bonus[25 * SIZE + 32]).toBe(CANAL_LAND_VALUE[4]);
    expect(bonus[25 * SIZE + 34]).toBe(CANAL_LAND_VALUE[4] / 2);
    expect(bonus[25 * SIZE + 35]).toBe(0);
  });

  test("saves keep each tile's level", () => {
    const core = newCity();
    draw(core, { x: 10, y: 5 }, { x: 10, y: 14 }, "canal");
    for (let y = 5; y <= 14; y++) core.map.canals[y * SIZE + 10] = 4;
    const again = newCity(JSON.parse(JSON.stringify(core.save())));
    expect(again.map.canals[9 * SIZE + 10]).toBe(4);
  });
});

