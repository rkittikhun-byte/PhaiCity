/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Zone cells along the roads (src/zoneCells.ts): 2 m cells in rows beside each road, along its line whatever its
// slant, never on the road; painted a cell at a time by the zoneCells command, paid for, and kept with the city.

import { NEEDS_ROAD_BESIDE } from "../src/cityCommands";
import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";
import { PLOT_WHY, plotOf } from "../src/plots";
import { hasKey } from "../src/i18n/index";
import { STEPS_PER_YEAR } from "../src/core/cityCore";
import { CELL_DEPTH, cellAt, cellLayout, cellsAlong, cellsOf, PLOT_ROWS, plotTileOfCell, rasterKey, tileRasterKeys } from "../src/zoneCells";
import { nearestOnLines, networkOf, roadLines } from "../src/roadGeometry";

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
  test("rows of 4 m cells lie beside the roads, along them, and never on them", () => {
    const core = city(), layout = cellLayout(core.map);
    expect(layout.cellUnits).toBeCloseTo(2.5);
    expect(layout.cells.length).toBeGreaterThan(250);
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
    expect(slanted.length).toBeGreaterThan(10);
    const heading = Math.atan2(2, 1);
    expect(slanted.filter(c => Math.abs(Math.abs(c.angle) - heading) < 0.15 || Math.abs(Math.abs(c.angle) - (Math.PI - heading)) < 0.15).length)
      .toBeGreaterThan(slanted.length * 0.8);
    // A point finds its cell, and a stroke the cells it crosses
    const first = beside[0];
    expect(cellAt(layout, core.map.width, first.x + 0.5, first.z - 0.5)?.key).toBe(first.key);
    expect(cellsAlong(layout, core.map.width, [150, 95], [250, 95]).length).toBeGreaterThan(15);
  });

  test("rows beside a straight road are whole: a cell every 4 m, none missing (owner: \"ทำไมไม่เรียงกันสวยๆ\")", () => {
    const core = city(), layout = cellLayout(core.map);
    // The straight road's own cells (its stretch's id), not the slanted road's rows that reach up near it
    const road = layout.cells.find(c => c.row === 0 && Math.abs(c.x - 300) < 3 && Math.abs(c.z - 105) < 6)!.road;
    for (const row of [0, 3, CELL_DEPTH - 1]) for (const side of [-1, 1]) {
      const xs = layout.cells.filter(c => c.road === road && c.row === row && Math.sign(c.z - 105) === side && c.x > 100 && c.x < 500)
        .map(c => c.x).sort((a, b) => a - b);
      expect(xs.length).toBeGreaterThan(150);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(layout.cellUnits);
    }
  });

  test("painted cells make plots that grow buildings, and clearing them takes the plot and its building back", () => {
    // Owner, 15 Oct 2026: "ทำให้อาคารงอกบนช่องที่ทาในอำเภอเมืองก่อน เมืองจะได้โตได้"
    Random.seed(4);
    const core = city();
    // A power plant beside the road: power runs along it to the plots (src/powerManager.js)
    expect(core.apply({ type: "tool", tool: "coal" as any, x: 45, y: 7 }).accepted).toBe(true);
    // Homes along the road's south side, tiles 10..30 (x 100..310), rows 11..13 (z 110..140)
    const layout = cellsOf(core.map);
    const keys = layout.cells.filter(c => c.x > 100 && c.x < 310 && c.z > 106 && c.z < 140).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: keys }).accepted).toBe(true);
    expect(plotOf(core.map, 15, 11)).toMatchObject({ kind: "residential", level: 0 });
    // ... and none behind it: the cells are one plot deep, 16 m (owner, 18 Oct 2026: "ไม่มีแปลงหลัง มีแค่แปลงเดียวติดถนน")
    expect(plotOf(core.map, 15, 12)).toBeNull();
    // ... and the jobs homes need: shops and factories across the road (z 70..104), as a player paints them
    const across = (x0: number, x1: number) => layout.cells.filter(c => c.x > x0 && c.x < x1 && c.z > 70 && c.z < 104).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: across(100, 220) }).accepted).toBe(true);
    expect(core.apply({ type: "zoneCells", zone: "industrial", cells: across(230, 420) }).accepted).toBe(true);
    // The cells on a plot stay, to be painted over or cleared
    expect(cellsOf(core.map).cells.filter(c => Math.floor(c.x / 10) === 15 && Math.floor(c.z / 10) === 11).length).toBeGreaterThan(8);
    core.run(2 * STEPS_PER_YEAR);
    const grown = [];
    for (let y = 11; y <= 13; y++) for (let x = 10; x <= 30; x++) { const plot = plotOf(core.map, x, y); if (plot && plot.level > 0) grown.push(plot); }
    expect(grown.length).toBeGreaterThan(5);
    expect(core.simulation.evaluation.cityPop).toBeGreaterThan(0);
    // Clearing a tile's cells takes its plot back, building and all
    const built = (() => { for (let x = 10; x <= 30; x++) { const p = plotOf(core.map, x, 11); if (p && p.level > 0) return x; } return -1; })();
    expect(built).toBeGreaterThan(0);
    const there = cellsOf(core.map).cells.filter(c => Math.floor(c.x / 10) === built && Math.floor(c.z / 10) === 11).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: null, cells: there }).accepted).toBe(true);
    expect(plotOf(core.map, built, 11)).toBeNull();
    expect(core.map.getTileValue(built, 11)).toBe(0);
  });

  test("each plot says why it does not grow, in both languages (docs/MUEANG_CS_PLAN.md M1.1)", () => {
    Random.seed(4);
    const core = city();
    const layout = cellsOf(core.map);
    const keys = layout.cells.filter(c => c.x > 100 && c.x < 310 && c.z > 106 && c.z < 140).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: keys }).accepted).toBe(true);
    core.run(16 * 4);
    const whys = () => {
      const found = new Set<string>();
      for (let y = 11; y <= 13; y++) for (let x = 10; x <= 30; x++) {
        if (plotOf(core.map, x, y)) found.add(PLOT_WHY[core.map.plotWhy[y * core.map.width + x]]);
      }
      return found;
    };
    // No power plant yet: every home says so
    expect([...whys()]).toEqual(["power"]);
    expect(core.apply({ type: "tool", tool: "coal" as any, x: 45, y: 7 }).accepted).toBe(true);
    core.run(16 * 8);
    expect(whys().has("power")).toBe(false);
    for (const why of PLOT_WHY) expect([why, hasKey(`object.fact.why.${why}`)]).toEqual([why, true]);
  });

  test("a road laid over painted cells clears the cells on its tiles (docs/METRE_DRAWING_PLAN.md 0.1)", () => {
    const core = city(), map = core.map;
    // A 16 m tile holds 16 x 16 keys of the 1 m raster, among them its middle's
    const keys = tileRasterKeys(map, 20, 12);
    expect(keys.length).toBe(256);
    expect(keys).toContain(rasterKey(map, 205, 125));
    expect(keys).not.toContain(rasterKey(map, 215, 125));
    // Homes painted along the road's south side, then a road along it over them on row 11, tiles 18..23
    const painted = cellsOf(map).cells.filter(c => c.x > 150 && c.x < 260 && c.z > 106 && c.z < 140).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: painted }).accepted).toBe(true);
    const under = new Set<number>();
    for (let x = 18; x <= 23; x++) for (const key of tileRasterKeys(map, x, 11)) under.add(key);
    const kept = () => [...(map as any).zoneCells.keys()].filter((key: number) => under.has(key));
    expect(kept().length).toBeGreaterThan(10);
    for (let x = 18; x <= 23; x++) core.apply({ type: "tool", tool: "road", x, y: 11, stroke: 7 });
    expect(kept()).toEqual([]);
    // ... and the cells beside it, off the new road's tiles, stay painted
    expect([...(map as any).zoneCells.keys()].filter((key: number) => painted.includes(key)).length).toBeGreaterThan(0);
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

  test("the cells are one plot deep, 16 m: four rows, all of the tile beside the road, none behind it", () => {
    // Owner, 18 Oct 2026: "ไม่มีแปลงหลัง มีแค่แปลงเดียวติดถนน"
    const core = city(), layout = cellLayout(core.map);
    expect(CELL_DEPTH).toBe(PLOT_ROWS);
    const south = layout.cells.filter(c => c.x > 250 && c.x < 350 && c.z > 105 && c.z < 140 && Math.abs(c.nz - 1) < 0.01);
    expect(new Set(south.map(c => c.row))).toEqual(new Set([0, 1, 2, 3]));
    for (const cell of south) expect(Math.floor(plotTileOfCell(core.map, cell) / core.map.width)).toBe(11);
    // Nothing lies further from the road than the plot's own 16 m (10 world units) and its edge
    expect(Math.max(...south.map(c => c.z)) - 105).toBeLessThan(16);
  });

  test("a junction's corners go to one road, its rows running on to the other's edge, with no gaps (owner, 18 Oct 2026)", () => {
    // A road along row 20 and one crossing it at a slant, two down for each one along
    const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    map.tileSizeM = 16;
    map.paintedZones = true;
    map.cellZones = true;
    const core = new CityCore({ map, seed: 3 });
    core.simulation.budget.setFunds(50000);
    for (let x = 2; x < 58; x++) core.apply({ type: "tool", tool: "road", x, y: 20 });
    let x = 20, y = 4;
    for (let step = 0; step < 12; step++) for (const [dx, dy] of [[0, 1], [0, 1], [1, 0]]) {
      core.apply({ type: "tool", tool: "road", x, y });
      x += dx; y += dy;
    }
    const layout = cellLayout(core.map), half = layout.cellUnits / 2;
    const covered = (px: number, pz: number): number => layout.cells.filter((c) => {
      const sin = Math.sin(c.angle), cos = Math.cos(c.angle), ox = px - c.x, oz = pz - c.z;
      return Math.abs(ox * cos - oz * sin) <= half && Math.abs(ox * sin + oz * cos) <= half * (c.span ?? 1);
    }).length;
    // The ground round the junction from 4 to 11 world units off the roads' middles as drawn, a point a metre apart:
    // each under a cell, and seldom under two (a point on the edge between two cells is under both)
    const W = core.map.width, value = (i: number): number => core.map.getTileValue(i % W, Math.floor(i / W));
    const drawn = roadLines(networkOf({ width: W, height: core.map.height, value, level: () => 1 }, false));
    const junction = drawn.junctions.find((j) => j.arms.length === 4)!.at;
    const offRoad = (px: number, pz: number): number => Math.min(...drawn.lines.map((line) => {
      const near = nearestOnLines([line.points], px, pz, 100);
      return near ? Math.hypot(near[0] - px, near[1] - pz) : Infinity;
    }));
    let points = 0, bare = 0, twice = 0;
    for (let pz = junction[1] - 22; pz <= junction[1] + 22; pz += 0.625) for (let px = junction[0] - 22; px <= junction[0] + 22; px += 0.625) {
      const off = offRoad(px, pz);
      if (off < 4 || off > 11) continue;
      points++;
      const n = covered(px, pz);
      if (n === 0) bare++;
      if (n > 2) twice++;
    }
    expect(points).toBeGreaterThan(1000);
    // ... where, with each road's rows meeting the other's on a jagged diagonal, 7% of it was bare
    expect(bare / points).toBeLessThan(0.05);
    expect(twice).toBe(0);
  });

  test("a map painted a tile at a time refuses cells", () => {
    const map = (MapGenerator as any).fromPresetCells(20, 20, new Uint8Array(400));
    const core = new CityCore({ map, seed: 1 });
    expect(core.apply({ type: "zoneCells", zone: "industrial", cells: [1] }).accepted).toBe(false);
  });
});
