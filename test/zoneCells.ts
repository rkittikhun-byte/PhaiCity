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
import { BRUSH_RADIUS_M, CELL_DEPTH, cellAt, cellLayout, cellPlotPose, cellsAlong, cellsInStrip, cellsNear, cellsOf, layoutSignature, STRIP_CELLS, PLOT_ROWS,
  plotTileOfCell, rasterKey, tileRasterKeys } from "../src/zoneCells";
import { blockAt, blockColumns, blockRows, buildableTest } from "../src/landBlocks";
import { nearestOnLines, networkOf, roadLines } from "../src/roadGeometry";

/** A bare 16 m map whose zones go a cell at a time, with a straight road and a slanted one */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 3 });
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
    // (a village's 3 x 3 on rows 7..9, beside the road on row 10: src/plantBlocks.ts)
    expect(core.apply({ type: "tool", tool: "coal" as any, x: 45, y: 8 }).accepted).toBe(true);
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
    // Clearing a plot's cells takes it back, building and all (its plots a list on this map: src/plotBuildings.ts)
    const list = core.map.plotBuildings, grownPlot = list.all().find((p: any) => p.level > 0 && p.kind === "residential");
    expect(grownPlot).toBeDefined();
    const place = list.places.get(grownPlot.id), fronts = place.cols.map((i: number) => list.columns[i]), cu = cellsOf(core.map).cellUnits;
    const there = cellsOf(core.map).cells.filter(c => fronts.some((f: any) =>
      Math.hypot(c.x - c.nx * c.row * cu - f.x, c.z - c.nz * c.row * cu - f.z) < 0.3 * cu)).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: null, cells: there }).accepted).toBe(true);
    expect(list.get(grownPlot.id)).toBeUndefined();
    for (const tile of place.tiles) {
      if (list.shownBy.has(tile)) continue;
      expect(core.map.getTileValue(tile % core.map.width, Math.floor(tile / core.map.width))).toBe(0);
    }
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
    expect(core.apply({ type: "tool", tool: "coal" as any, x: 45, y: 8 }).accepted).toBe(true);
    core.run(16 * 8);
    expect(whys().has("power")).toBe(false);
    // ... and the level checklist (src/plotChecklist.ts) names each reason in both languages
    const words: Record<string, string> = { none: "plot.status.growing", top: "plot.status.top", quiet: "plot.name.crowd" };
    for (const why of PLOT_WHY) expect([why, hasKey(words[why] ?? `plot.name.${why}`)]).toEqual([why, true]);
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
    const again = new CityCore({ sandbox: true, map: new (GameMap as any)(60, 40), saved });
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
    const core = new CityCore({ sandbox: true, map, seed: 3 });
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

  test("the cells are laid again only when a tile, a road's level or the land bought changed (docs/NO_GRID_PLAN.md 5.4)", () => {
    const core = city(), map = core.map as any;
    map.landBlocks = new Uint8Array(blockColumns(map) * blockRows(map)).fill(1);
    // The land test read inline gives the signature a test asked tile by tile gives
    const test = buildableTest(map);
    expect(layoutSignature(map, test)).toBe(layoutSignature(map, (x, y) => test(x, y)));
    // Asked again with nothing changed (the brush's every frame): the same layout, not laid or signed again
    const first = cellsOf(map, buildableTest(map));
    expect(cellsOf(map, buildableTest(map))).toBe(first);
    // A road raised a level, with no tile changed
    map.roadLevels[10 * map.width + 30] = 3;
    const raised = cellsOf(map, buildableTest(map));
    expect(raised).not.toBe(first);
    expect(cellsOf(map, buildableTest(map))).toBe(raised);
    // A block of land given back: its tiles are not the city's, and their cells go
    map.landBlocks[blockAt(map, 30, 12)] = 0;
    const sold = cellsOf(map, buildableTest(map));
    expect(sold).not.toBe(raised);
    expect(sold.cells.length).toBeLessThan(raised.cells.length);
    // A tile changed
    core.apply({ type: "tool", tool: "road", x: 40, y: 20 });
    expect(cellsOf(map, buildableTest(map))).not.toBe(sold);
  });

  test("a map painted a tile at a time refuses cells", () => {
    const map = (MapGenerator as any).fromPresetCells(20, 20, new Uint8Array(400));
    const core = new CityCore({ sandbox: true, map, seed: 1 });
    expect(core.apply({ type: "zoneCells", zone: "industrial", cells: [1] }).accepted).toBe(false);
  });

  test("one column of cells as deep as the plot is a plot, and its pose says how many cells along the road (3.3)", () => {
    // docs/METRE_DRAWING_PLAN.md 3.3: "ตึกแถว 1×4 ช่อง, บ้าน 3×4 ช่อง", a building as wide as the cells painted
    const core = city(), w = core.map.width;
    // Tile (15, 11)'s cells beside the straight road, column by column along it
    const layout = cellsOf(core.map), byX = new Map<number, number[]>();
    for (const i of layout.byPlotTile.get(11 * w + 15) ?? []) {
      const c = layout.cells[i];
      if (c.z > 105) byX.set(Math.round(c.x * 10), [...(byX.get(Math.round(c.x * 10)) ?? []), c.key]);
    }
    const columns = [...byX].sort((a, b) => a[0] - b[0]).map(([, keys]) => keys);
    expect(columns.length).toBe(4);
    for (const column of columns) expect(column.length).toBe(PLOT_ROWS);
    const pose = () => cellPlotPose(core.map as any, 15, 11, 1, 10 / 16);
    // One column, 4 m along the road and 16 m deep: a shophouse bay's plot
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: columns[0] }).accepted).toBe(true);
    expect(plotOf(core.map, 15, 11)).toMatchObject({ kind: "commercial" });
    expect(pose()?.cells).toBe(1);
    const one = pose()!;
    // ... standing on that column, not in the middle of the tile
    const first = layout.cells[layout.byKey.get(columns[0][0])!];
    expect(one.x).toBeCloseTo(first.x, 1);
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: [...columns[1], ...columns[2]] }).accepted).toBe(true);
    expect(pose()?.cells).toBe(3);
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: columns[3] }).accepted).toBe(true);
    expect(pose()?.cells).toBe(4);
    // Three cells of one column are a plot too: where the plots are a list one row of paint is enough
    // (docs/NO_GRID_PLAN.md 3B.1, src/plotBuildings.ts)
    const next = layout.byPlotTile.get(11 * w + 25)!.map(i => layout.cells[i]).filter(c => c.z > 105);
    const column = next.filter(c => Math.abs(c.x - next[0].x) < 0.01).slice(0, 3).map(c => c.key);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: column }).accepted).toBe(true);
    expect(plotOf(core.map, 25, 11)).toMatchObject({ kind: "residential", level: 0 });
  });

  describe("along roads drawn in metres (docs/METRE_DRAWING_PLAN.md 3.1)", () => {
    /** A bare 16 m city map with a slanted road drawn in metres, none of whose cells lie on a tile road's line */
    function metreCity() {
      const map = (MapGenerator as any).fromPresetCells(80, 60, new Uint8Array(80 * 60));
      map.tileSizeM = 16;
      map.paintedZones = true;
      map.cellZones = true;
      const core = new CityCore({ sandbox: true, map, seed: 3 });
      core.simulation.budget.setFunds(500000);
      (core.map as any).needsRulerHouse = false;
      expect(core.apply({ type: "road", tool: "road", from: [100, 300], to: [1100, 520], stroke: 1 }).accepted).toBe(true);
      return core;
    }
    const U = 10 / 16;
    const cellsBeside = (core: CityCore) => new Map(cellLayout(core.map as any).cells.map((c) => [c.key, [c.x, c.z, c.row]]));

    test("its cells' first row lies along the road as drawn, at the road's edge", () => {
      const core = metreCity(), layout = cellLayout(core.map as any);
      const [ax, az, bx, bz] = [100 * U, 300 * U, 1100 * U, 520 * U], length = Math.hypot(bx - ax, bz - az);
      const near = layout.cells.filter((c) => c.row === 0);
      expect(near.length).toBeGreaterThan(40);
      // Each one's distance from the drawn line
      const distances = near.map((c) => Math.abs((bx - ax) * (c.z - az) - (bz - az) * (c.x - ax)) / length);
      // Every first-row cell the same way from the drawn line, whatever the tiles under it
      expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.05);
    });

    test("the round brush paints every cell within its metres of where the mouse went (3.2)", () => {
      const core = metreCity(), layout = cellLayout(core.map as any), radius = BRUSH_RADIUS_M * U;
      // A point beside the road, then a stroke along it
      const at: [number, number] = [600 * U, (410 + 12) * U];
      const one = cellsNear(layout, 80, null, at, radius);
      expect(one.length).toBeGreaterThan(4);
      for (const key of one) {
        const c = layout.cells[layout.byKey.get(key)!];
        expect(Math.hypot(c.x - at[0], c.z - at[1])).toBeLessThanOrEqual(radius);
      }
      // ... and none left out
      const outside = layout.cells.filter((c) => Math.hypot(c.x - at[0], c.z - at[1]) <= radius).map((c) => c.key).sort((p, q) => p - q);
      expect(one).toEqual(outside);
      const stroke = cellsNear(layout, 80, [300 * U, 360 * U], [900 * U, 490 * U], radius);
      expect(stroke.length).toBeGreaterThan(one.length * 5);
      // Painted by the command, every one of them
      expect(core.apply({ type: "zoneCells", zone: "residential", cells: stroke }).accepted).toBe(true);
      expect(stroke.every((key) => (core.map as any).zoneCells.get(key) === 1)).toBe(true);
    });

    test("the strip brush paints against the road a few cells either way of the stroke, the plot's whole depth, on its side only", () => {
      // Owner, 21 Oct 2026: "การวาดสีให้วาด ทีละ 6 แถว กับพื้นถนน"; on a straight (slanted) road and a curved one
      const straight = metreCity();
      expect(straight.apply({ type: "road", tool: "road", from: [200, 800], to: [1000, 800], c1: [450, 600], c2: [750, 600], stroke: 2 }).accepted).toBe(true);
      const layout = cellLayout(straight.map as any), u = layout.cellUnits;
      for (const [label, a, b] of [["straight", [500, 395], [800, 461]], ["curved", [520, 655], [700, 664]]] as const) {
        const from: [number, number] = [a[0] * U, a[1] * U], to: [number, number] = [b[0] * U, b[1] * U];
        const start = cellAt(layout, 80, ...from)!;
        expect([label, start]).not.toEqual([label, null]);
        const keys = cellsInStrip(layout, 80, from, to), cells = keys.map((k) => layout.cells[layout.byKey.get(k)!]);
        expect([label, cells.length > STRIP_CELLS * CELL_DEPTH]).toEqual([label, true]);
        for (const c of cells) {
          // ... on the stroke's side of its road, never across it
          expect([label, c.nx * start.nx + c.nz * start.nz > 0, c.road === start.road]).toEqual([label, true, true]);
        }
        // Every row from the road's edge to the plot's back
        expect(new Set(cells.map((c) => c.row))).toEqual(new Set(Array.from({ length: CELL_DEPTH }, (_, r) => r)));
        // ... the stroke's whole length, and no further than half the strip past its ends
        const foot = (c: typeof cells[number]) => [c.x - c.nx * c.row * u, c.z - c.nz * c.row * u];
        const along = (c: typeof cells[number], p: readonly number[]) => {
          const [fx, fz] = foot(c);
          return Math.abs((p[0] - fx) * Math.sin(c.angle) + (p[1] - fz) * Math.cos(c.angle));
        };
        for (const c of cells) expect(Math.min(along(c, from), along(c, to), ...Array.from({ length: 41 }, (_, k) => k / 40).map((t) =>
          along(c, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])))).toBeLessThanOrEqual(STRIP_CELLS * u / 2 + u);
        // ... and none of that road's cells beside the stroke left out
        const beside = layout.cells.filter((c) => c.road === start.road && c.nx * start.nx + c.nz * start.nz > 0 &&
          along(c, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]) <= u);
        for (const c of beside) expect(keys).toContain(c.key);
        expect(straight.apply({ type: "zoneCells", zone: "commercial", cells: keys }).accepted).toBe(true);
      }
      // A press without a drag: a strip STRIP_CELLS cells long
      const one = cellsInStrip(layout, 80, null, [650 * U, 428 * U]);
      expect(one.length).toBeGreaterThanOrEqual((STRIP_CELLS - 1) * CELL_DEPTH);
      expect(one.length).toBeLessThanOrEqual((STRIP_CELLS + 2) * CELL_DEPTH);
    });

    test("a road drawn across it, one built on from its end and a part raised a level leave its cells where they were", () => {
      const core = metreCity(), before = cellsBeside(core);
      core.apply({ type: "road", tool: "road", from: [600, 100], to: [600, 800], stroke: 2 });
      core.apply({ type: "road", tool: "road", from: [1100, 520], to: [1250, 700], stroke: 3 });
      core.apply({ type: "tool", tool: "road_upgrade" as any, x: 20, y: 24, stroke: 4 });
      const after = cellsBeside(core);
      // Most cells are still there, where they were (those on the new road's ground and round the new junctions are
      // gone; at a corner the other road's cell may take a key, its middle within half a metre)
      let kept = 0, same = 0;
      for (const [key, where] of before) {
        const now = after.get(key);
        if (!now) continue;
        kept++;
        if (now[0] === where[0] && now[1] === where[1] && now[2] === where[2]) same++;
        expect(Math.hypot(now[0] - where[0], now[1] - where[1])).toBeLessThan(0.5 * U);
      }
      expect(kept).toBeGreaterThan(before.size * 0.7);
      expect(same).toBeGreaterThan(kept - 5);
    });
  });
});
