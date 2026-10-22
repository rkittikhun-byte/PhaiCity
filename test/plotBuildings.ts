/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Plots as buildings, one at a time (src/plotBuildings.ts, docs/NO_GRID_PLAN.md 3B): on a map painted a cell at a time a
// plot is a run of painted columns along its road, as wide as its kind builds, with an id that stays; one row of paint
// is enough; it is counted by its area, grows with its own luck, joins the plot beside it for the top level, shows on
// the tiles for the old readers, is saved, and an older save's tile plots are taken in at their levels.

import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";
import { plotOf, plotTile } from "../src/plots";
import {
  cutRun, formPlots, joinNeighbour, LOT_COLUMNS, needColumns, PLOT_FRONTAGE, PlotBuildings, plotMayRise, plotShare,
  putPlotLevel, TILE_COLUMNS, usesPlotList,
} from "../src/plotBuildings";
import { cellsOf, PLOT_ROWS, syncCellPlots } from "../src/zoneCells";
import { BLBNCNBIT } from "../src/tileFlags";

/** A bare 16 m map whose zones go a cell at a time, with a straight road along row 10 and the ruler's house */
function city(seed = 3) {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ sandbox: true, map, seed });
  core.simulation.budget.setFunds(500000);
  for (let x = 2; x < 58; x++) core.apply({ type: "tool", tool: "road", x, y: 10 });
  expect(core.apply({ type: "tool", tool: "ruler_house" as any, x: 4, y: 8 }).accepted).toBe(true);
  return core;
}

/** The columns of cells south of the straight road between x0 and x1 (world units), left to right as the road's south
 * side sees them, each its cells from the road back; rows: how many of each column's rows */
function columns(core: CityCore, x0: number, x1: number, rows = PLOT_ROWS): number[][] {
  const layout = cellsOf(core.map), byX = new Map<number, Array<[number, number]>>();
  for (const c of layout.cells) {
    if (c.x <= x0 || c.x >= x1 || c.z < 105 || c.z > 140) continue;
    const k = Math.round(c.x * 10);
    byX.set(k, [...(byX.get(k) ?? []), [c.row, c.key]]);
  }
  // (the road's south side faces north, so its left is east: right to left in x)
  return [...byX].sort((a, b) => b[0] - a[0]).map(([, cells]) => cells.sort((a, b) => a[0] - b[0]).slice(0, rows).map(([, key]) => key));
}

const list = (core: CityCore): PlotBuildings => core.map.plotBuildings;

describe("plots as buildings (docs/NO_GRID_PLAN.md 3B)", () => {
  test("a map painted a cell at a time keeps its plots as a list; one painted a tile at a time does not", () => {
    const core = city();
    expect(usesPlotList(core.map)).toBe(true);
    expect(list(core)).toBeInstanceOf(PlotBuildings);
    expect(usesPlotList({ cellZones: false, tileSizeM: 16 })).toBe(false);
    expect(usesPlotList({ cellZones: true, tileSizeM: 200 })).toBe(false);
  });

  test("a run of columns is cut into its kind's frontage, as evenly as it goes", () => {
    expect(PLOT_FRONTAGE).toEqual({ residential: 3, commercial: 1, industrial: 4 });
    expect([cutRun(1, 3), cutRun(3, 3), cutRun(4, 3), cutRun(5, 3), cutRun(7, 3), cutRun(9, 4)])
      .toEqual([[1], [3], [2, 2], [3, 2], [3, 2, 2], [3, 3, 3]]);
  });

  test("one row of paint along the road is enough: a shop on each bay, a house on three, where the paint is", () => {
    const core = city(), cols = columns(core, 100, 400);
    expect(cols.length).toBeGreaterThanOrEqual(12);
    // Only the front row of six columns: six shophouse bays
    expect(core.apply({ type: "zoneCells", zone: "commercial", cells: cols.slice(0, 6).map((c) => c[0]) }).accepted).toBe(true);
    let plots = list(core).all();
    expect(plots.map((p) => [p.kind, p.columns.length])).toEqual(Array(6).fill(["commercial", 1]));
    // ... each on the tile its column lies on, which shows it to the old readers
    for (const p of plots) {
      const place = list(core).places.get(p.id)!;
      const t = place.anchor, x = t % core.map.width, y = Math.floor(t / core.map.width);
      expect(plotOf(core.map, x, y)).toMatchObject({ kind: "commercial", level: 0 });
      expect(y).toBe(11);
    }
    // Six columns of homes, the plot's whole depth: two houses of three
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: cols.slice(6, 12).flat() }).accepted).toBe(true);
    plots = list(core).all();
    expect(plots.filter((p) => p.kind === "residential").map((p) => p.columns.length)).toEqual([3, 3]);
    // Painting elsewhere leaves them, their ids and all
    const before = list(core).all().map((p) => `${p.id}:${p.columns.join()}`);
    const far = columns(core, 500, 560);
    expect(core.apply({ type: "zoneCells", zone: "industrial", cells: far.flat() }).accepted).toBe(true);
    const after = list(core).all().map((p) => `${p.id}:${p.columns.join()}`);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(list(core).all().filter((p) => p.kind === "industrial").map((p) => p.columns.length)).toEqual(cutRun(far.length, 4));
  });

  test("an empty plot narrower than its kind takes the columns painted beside it; a column cleared takes its plot", () => {
    const core = city(), cols = columns(core, 100, 400);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: cols[0] }).accepted).toBe(true);
    const first = list(core).all()[0];
    expect(first.columns.length).toBe(1);
    expect(core.apply({ type: "zoneCells", zone: "residential", cells: [...cols[1], ...cols[2], ...cols[3]] }).accepted).toBe(true);
    const plots = list(core).all();
    expect(plots[0].id).toBe(first.id);
    expect(plots.map((p) => p.columns.length)).toEqual([3, 1]);
    // Clearing a column of the house: the house goes, the column left of it makes a new plot
    expect(core.apply({ type: "zoneCells", zone: null, cells: cols[1] }).accepted).toBe(true);
    expect(list(core).get(first.id)).toBeUndefined();
    expect(list(core).all().map((p) => p.columns.length).sort()).toEqual([1, 2]);
  });

  test("plots grow with power, water and work, counted by their area; the same seed makes the same plots", () => {
    const grow = (seed: number) => {
      Random.seed(seed);
      const core = city(seed);
      expect(core.apply({ type: "tool", tool: "coal" as any, x: 45, y: 8 }).accepted).toBe(true);
      const south = columns(core, 100, 420);
      expect(core.apply({ type: "zoneCells", zone: "residential", cells: south.flat() }).accepted).toBe(true);
      const layout = cellsOf(core.map);
      const north = (x0: number, x1: number) => layout.cells.filter((c) => c.x > x0 && c.x < x1 && c.z > 70 && c.z < 104).map((c) => c.key);
      expect(core.apply({ type: "zoneCells", zone: "commercial", cells: north(100, 220) }).accepted).toBe(true);
      expect(core.apply({ type: "zoneCells", zone: "industrial", cells: north(230, 420) }).accepted).toBe(true);
      core.run(2 * STEPS_PER_YEAR);
      return core;
    };
    const core = grow(4);
    const plots = list(core).all(), grown = plots.filter((p) => p.level > 0);
    expect(grown.length).toBeGreaterThan(4);
    // the census counts each by its area: a home's 20 people a level a tile's worth of ground
    const people = plots.filter((p) => p.kind === "residential").reduce((sum, p) => sum + p.level * plotShare(core.map, p), 0);
    expect(people).toBeGreaterThan(0);
    // every tile a plot shows holds its building's tile
    for (const [tile, id] of list(core).shownBy) {
      const p = list(core).get(id)!, x = tile % core.map.width, y = Math.floor(tile / core.map.width);
      expect(core.map.getTileValue(x, y)).toBe(plotTile(p.kind, p.level, p.value, p.style));
    }
    const again = grow(4);
    expect(list(again).all()).toEqual(plots);
  });

  test("a city's plots are saved and come back as they were", () => {
    Random.seed(5);
    const core = city(5), cols = columns(core, 100, 400);
    core.apply({ type: "zoneCells", zone: "residential", cells: cols.slice(0, 9).flat() });
    core.apply({ type: "zoneCells", zone: "commercial", cells: cols.slice(9, 12).map((c) => c[0]) });
    const plots = list(core).all();
    plots[0].level = 2;
    const saved = JSON.parse(JSON.stringify(core.save()));
    expect(saved.plots.plots.length).toBe(plots.length);
    const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    map.tileSizeM = 16;
    const opened = new CityCore({ sandbox: true, map, saved });
    expect(list(opened).all().map((p) => [p.id, p.kind, p.level, p.columns.length]))
      .toEqual(plots.map((p) => [p.id, p.kind, p.level, p.columns.length]));
  });

  test("an older save's tile plots are taken in at their levels, and tiles no plot took go bare (3B.4)", () => {
    const core = city(), cols = columns(core, 100, 400);
    // The city as it was before the list: its painted tiles made plots, grown since
    const map: any = core.map;
    core.apply({ type: "zoneCells", zone: "residential", cells: cols.slice(0, 8).flat() });
    map.plotBuildings = null;
    for (let x = 0; x < map.width; x++) if (plotOf(map, x, 11)) map.setTile(x, 11, 0, 0);
    syncCellPlots(map, cellsOf(map));
    const tiles: number[] = [];
    for (let x = 0; x < map.width; x++) if (plotOf(map, x, 11)) { map.setTile(x, 11, plotTile("residential", 3, 1), BLBNCNBIT); tiles.push(x); }
    expect(tiles.length).toBeGreaterThan(0);
    formPlots(map, cellsOf(map));
    const plots = map.plotBuildings.all();
    expect(plots.length).toBe(cutRun(8, 3).length);
    expect(plots.every((p: any) => p.level === 3 && p.value === 1)).toBe(true);
  });

  test("a plot too narrow for its next building takes in the plot beside it, keeping its id and time", () => {
    // a 12 m house is three columns; a building of a whole tile four, the top level eight (an old lot's side)
    expect([needColumns("residential", 2, 1), needColumns("residential", 4, 3), needColumns("residential", 5, 3)])
      .toEqual([3, TILE_COLUMNS, LOT_COLUMNS]);
    expect([needColumns("commercial", 2, 4), needColumns("commercial", 3, 4), needColumns("commercial", 3, 3)]).toEqual([1, 4, 1]);
    const core = city(), cols = columns(core, 100, 400);
    core.apply({ type: "zoneCells", zone: "residential", cells: cols.slice(0, 9).flat() });
    const [a, b, c] = list(core).all();
    expect([a, b, c].map((p) => p.columns.length)).toEqual([3, 3, 3]);
    for (const p of [a, b, c]) putPlotLevel(core.map, p, 4);
    a.born = -5;
    expect(plotMayRise(a, 3)).toBe(false);
    expect(joinNeighbour(core.map, list(core), a)).toBe(true);
    const joined = list(core).all();
    expect(joined.map((p) => [p.id, p.columns.length, p.level])).toEqual([[a.id, 6, 4], [c.id, 3, 4]]);
    expect(joined[0].born).toBe(-5);
    expect(plotMayRise(joined[0], 3)).toBe(false);
    expect(joinNeighbour(core.map, list(core), joined[0])).toBe(true);
    expect(list(core).all().map((p) => p.columns.length)).toEqual([9]);
    expect(plotMayRise(list(core).all()[0], 3)).toBe(true);
    // ... never a taller one, and an empty plot takes in nothing
    const other = city(), more = columns(other, 100, 400);
    other.apply({ type: "zoneCells", zone: "residential", cells: more.slice(0, 6).flat() });
    const [d, e] = list(other).all();
    expect(joinNeighbour(other.map, list(other), d)).toBe(false);
    putPlotLevel(other.map, d, 2);
    putPlotLevel(other.map, e, 3);
    expect(joinNeighbour(other.map, list(other), d)).toBe(false);
    expect(joinNeighbour(other.map, list(other), e)).toBe(true);
  });

  test("a plot whose tile the bulldozer takes is gone; its paint makes an empty plot once the ground is clear", () => {
    const core = city(), cols = columns(core, 100, 400);
    core.apply({ type: "zoneCells", zone: "residential", cells: cols.slice(0, 3).flat() });
    const [house] = list(core).all();
    house.level = 2;
    formPlots(core.map, cellsOf(core.map));
    const anchor = list(core).places.get(house.id)!.anchor, x = anchor % core.map.width, y = Math.floor(anchor / core.map.width);
    expect(core.apply({ type: "tool", tool: "bulldozer", x, y }).accepted).toBe(true);
    expect(list(core).get(house.id)).toBeUndefined();
    core.run(STEPS_PER_YEAR / 4);
    expect(list(core).all().some((p) => p.level === 0)).toBe(true);
  });
});
