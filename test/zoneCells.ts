/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Zone cells along the roads (src/zoneCells.ts): 2 m cells in rows beside each road, along its line whatever its
// slant, never on the road; painted a cell at a time by the zoneCells command, paid for, and kept with the city.

import { NEEDS_ROAD_BESIDE } from "../src/cityCommands";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { CELL_DEPTH, cellAt, cellLayout, cellsAlong, cellsOf } from "../src/zoneCells";

/** A bare 16 m map whose zones go a cell at a time, with a straight road and a slanted one */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ map, seed: 3 });
  core.simulation.budget.setFunds(50000);
  for (let x = 2; x < 58; x++) core.apply({ type: "tool", tool: "road", x, y: 10 });
  // A new city builds its ruler's house first
  expect(core.apply({ type: "tool", tool: "ruler_house" as any, x: 4, y: 8 }).accepted).toBe(true);
  // Two along, one down: a slanted road from (10, 20)
  let x = 10, y = 20;
  for (let step = 0; step < 12; step++) for (const [dx, dy] of [[1, 0], [1, 0], [0, 1]]) {
    core.apply({ type: "tool", tool: "road", x, y });
    x += dx; y += dy;
  }
  return core;
}

describe("zone cells", () => {
  test("rows of 2 m cells lie beside the roads, along them, and never on them", () => {
    const core = city(), layout = cellLayout(core.map);
    expect(layout.cellUnits).toBeCloseTo(1.25);
    expect(layout.cells.length).toBeGreaterThan(500);
    // Along the straight road (its middle at z = 105) the cells face it, in rows from 0 to CELL_DEPTH - 1
    const beside = layout.cells.filter(c => c.x > 100 && c.x < 500 && Math.abs(c.z - 105) < 30);
    expect(new Set(beside.map(c => c.row)).size).toBe(CELL_DEPTH);
    for (const cell of beside) {
      expect(Math.abs(Math.sin(cell.angle))).toBeGreaterThan(0.99);
      // Clear of the laterite road, 5 m wide on a 16 m map (src/roadGeometry.ts), and its edge
      expect(Math.abs(cell.z - 105)).toBeGreaterThan(2.5 * 10 / 16);
    }
    // Along the slanted one they turn with it (two along, one down)
    const slanted = layout.cells.filter(c => c.z > 220 && c.z < 290 && c.x > 150 && c.x < 400);
    expect(slanted.length).toBeGreaterThan(20);
    const heading = Math.atan2(2, 1);
    expect(slanted.filter(c => Math.abs(Math.abs(c.angle) - heading) < 0.15 || Math.abs(Math.abs(c.angle) - (Math.PI - heading)) < 0.15).length)
      .toBeGreaterThan(slanted.length * 0.8);
    // A point finds its cell, and a stroke the cells it crosses
    const first = beside[0];
    expect(cellAt(layout, core.map.width, first.x + 0.5, first.z - 0.5)?.key).toBe(first.key);
    expect(cellsAlong(layout, core.map.width, [150, 95], [250, 95]).length).toBeGreaterThan(30);
  });

  test("rows beside a straight road are whole: a cell every 2 m, none missing (owner: \"ทำไมไม่เรียงกันสวยๆ\")", () => {
    const core = city(), layout = cellLayout(core.map);
    // The straight road's own cells (its stretch's id), not the slanted road's rows that reach up near it
    const road = layout.cells.find(c => c.row === 0 && Math.abs(c.x - 300) < 2 && Math.abs(c.z - 105) < 5)!.road;
    for (const row of [0, 5, CELL_DEPTH - 1]) for (const side of [-1, 1]) {
      const xs = layout.cells.filter(c => c.road === road && c.row === row && Math.sign(c.z - 105) === side && c.x > 100 && c.x < 500)
        .map(c => c.x).sort((a, b) => a - b);
      expect(xs.length).toBeGreaterThan(300);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(layout.cellUnits);
    }
  });

  test("painting cells costs a share of the zone's price; clearing is free; the cells stay with the city", () => {
    const core = city(), layout = cellsOf(core.map);
    const keys = cellsAlong(layout, core.map.width, [150, 95], [250, 95]);
    const funds = core.simulation.budget.totalFunds;
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: keys })).toMatchObject({ accepted: true });
    expect(core.map.zoneCells.size).toBe(keys.length);
    const paid = funds - core.simulation.budget.totalFunds;
    expect(paid).toBeGreaterThan(0);
    expect(paid).toBeLessThan(keys.length);
    // Painting them again is nothing; a key that is no cell is ignored
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: keys }).accepted).toBe(false);
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: [123456789] }).accepted).toBe(false);
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: 60, height: 40 }));
    expect(saved.cellZones).toBe(true);
    const again = new CityCore({ map: new (GameMap as any)(60, 40), saved });
    expect([...again.map.zoneCells.keys()].sort()).toEqual([...keys].sort());
    const before = again.simulation.budget.totalFunds;
    expect(again.apply({ type: "zoneCells", zone: null, cells: keys.slice(0, 5) }).accepted).toBe(true);
    expect(again.map.zoneCells.size).toBe(keys.length - 5);
    expect(again.simulation.budget.totalFunds).toBe(before);
  });

  test("every building stands beside a road", () => {
    const core = city();
    expect(core.apply({ type: "tool", tool: "police", x: 40, y: 30 })).toMatchObject({ accepted: false, reason: NEEDS_ROAD_BESIDE });
    expect(core.apply({ type: "tool", tool: "police", x: 40, y: 8 }).accepted).toBe(true);
  });

  test("a map painted a tile at a time refuses cells", () => {
    const map = (MapGenerator as any).fromPresetCells(20, 20, new Uint8Array(400));
    const core = new CityCore({ map, seed: 1 });
    expect(core.apply({ type: "zoneCells", zone: "industrial", cells: [1] }).accepted).toBe(false);
  });
});
