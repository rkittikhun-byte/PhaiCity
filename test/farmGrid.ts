/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone's grid along every road (src/farmGrid.ts; owner, 23 Oct 2026: "ทำตารางโซนเกษตรให้ขนานกับถนนทุกเส้นเลย"):
// beside a slanted or a curved road the farm cells run along it in rows from its edge, the nearer road's where two meet,
// none on a road; a chunk at a time they are the whole map's; a rectangle is turned with its road; the fields are drawn
// on the cells painted with no axis staircase; the paint stays when the road is upgraded in place; an older save's cells
// show through the new ones; and the same commands make the same fields.

import { MeshStandardMaterial, type BufferAttribute, type Mesh } from "three";
import { CityCore } from "../src/core/cityCore";
import { ALL_SQUARES, cellPainted, FARM_CHUNK, farmCellsInRect, farmCellsOnTiles, farmRows, homeSquare, paintedCells,
  paintedSquares, SQUARES, squareAt } from "../src/farmGrid";
import { fieldShare, fieldTile, FIELD_FLAGS, isFieldValue, kindCode } from "../src/farmZone";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { CityFarmFields } from "../src/render3d/city/farmFields";
import { UPGRADE_TOOL, isRoadTile } from "../src/roadLevels";
import { SIM_VERSION } from "../src/sim/simVersion";
import { Storage } from "../src/storage.js";
import { cellLayout, CELL_M, type Cell } from "../src/zoneCells";
import { isOpenLand } from "../src/plots";

const W = 60, H = 40, M = 16, CELL = 10 * CELL_M / M;

/** A bare 16 m city map with a road drawn in metres from one point to another (and through c1, c2 when curved) */
function city(from: [number, number], to: [number, number], c?: [[number, number], [number, number]]) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  Object.assign(map, { tileSizeM: M, paintedZones: true, cellZones: true });
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  expect(core.apply({ type: "road", tool: "road" as never, from, to, ...(c ? { c1: c[0], c2: c[1] } : {}), stroke: 1 }).accepted).toBe(true);
  return core;
}

/** Where on a line (world units) the point nearest p lies, how far off it, and the way the line runs there */
function foot(line: Array<[number, number]>, p: [number, number]) {
  let best = { d: Infinity, angle: 0 };
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / l2));
    const d = Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]);
    if (d < best.d) best = { d, angle: Math.atan2(dx, dz) };
  }
  return best;
}

/** The road's middle line in world units, from the core's graph */
function roadLine(core: CityCore): Array<[number, number]> {
  const graph = (core.map as any).roadGraph, out: Array<[number, number]> = [];
  for (const id of graph.segments.keys()) for (const [x, z] of graph.polyline(id, 2)) out.push([x * 10 / M, z * 10 / M]);
  return out;
}

/** The difference of two ways a line runs, ignoring which end is which (0 - π/2) */
const turnBetween = (a: number, b: number) => Math.abs(((a - b) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);

const allCells = (core: CityCore) => farmCellsOnTiles(core.map as any, 0, 0, W - 1, H - 1);

describe("the farm grid along every road", () => {
  test("beside a slanted road the cells run along it in rows from its edge, none on it and none overlapping", () => {
    const core = city([80, 80], [880, 520]);
    const line = roadLine(core), cells = allCells(core);
    expect(cells.length).toBeGreaterThan(1000);
    const offsets: number[] = [], some = cells.filter((_, i) => i % 7 === 0);
    for (const c of some) {
      const f = foot(line, [c.x, c.z]);
      // (the cells past the road's ends turn round them; those beside it run with it)
      if (f.d > 0 && turnBetween(c.angle, Math.atan2(800, 440)) < 1e-6) offsets.push(f.d);
      // (a cell may reach over a road tile's margin, as the zones' do, never onto the road drawn)
      expect(f.d).toBeGreaterThan(CELL / 2);
    }
    expect(offsets.length / some.length).toBeGreaterThan(0.8);
    // every row the same distance from the road: a cell's width apart from the first
    const first = Math.min(...offsets);
    for (const d of offsets) expect(Math.abs((d - first) / CELL - Math.round((d - first) / CELL))).toBeLessThan(0.02);
    // ... as deep as a field may lie from the road
    expect(Math.max(...offsets) - first).toBeGreaterThan((farmRows({ tileSizeM: M }, 8) - 2) * CELL);
    // no two cells closer than 0.9 of a cell (src/zoneCells.ts CELL_GAP)
    const sorted = [...cells].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].x - sorted[i].x < CELL; j++) {
        expect(Math.hypot(sorted[j].x - sorted[i].x, sorted[j].z - sorted[i].z)).toBeGreaterThanOrEqual(0.9 * CELL - 1e-9);
      }
    }
  });

  test("beside a curved road each cell turns with the road where it stands", () => {
    const core = city([80, 560], [880, 560], [[300, 40], [660, 40]]);
    const line = roadLine(core), cells = allCells(core).filter((c, i) => i % 5 === 0 && foot(line, [c.x, c.z]).d < 6 * CELL);
    const angles = new Set(cells.map((c) => Math.round(c.angle * 10)));
    expect(angles.size).toBeGreaterThan(10);
    for (const c of cells) expect(turnBetween(c.angle, foot(line, [c.x, c.z]).angle)).toBeLessThan(0.12);
  });

  test("beside a canal the cells run along it too, the nearer of a road and a canal winning; none on its water or banks", () => {
    // (owner, 23 Oct 2026: "จะต้องขนานกับถนน และคลองด้วยนะ")
    const core = city([40, 440], [920, 440]), map = core.map as any;
    expect(core.apply({ type: "road", tool: "canal" as never, from: [100, 80], to: [700, 420], stroke: 2 }).accepted).toBe(true);
    expect(map.canalGraph.segments.size).toBe(1);
    const canal: Array<[number, number]> = [[100 * 10 / M, 80 * 10 / M], [700 * 10 / M, 420 * 10 / M]], along = Math.atan2(600, 340);
    const cells = allCells(core);
    const byCanal = cells.filter((c) => foot(canal, [c.x, c.z]).d < foot(roadLine(core), [c.x, c.z]).d);
    expect(byCanal.length).toBeGreaterThan(500);
    for (const c of byCanal) {
      const d = foot(canal, [c.x, c.z]).d;
      // not on its water or banks (8 m from its middle at its highest level), and those beside it turned with it
      expect(d).toBeGreaterThan(8 * 10 / M);
      if (d < 20 && c.x > 100 && c.x < 400) expect(turnBetween(c.angle, along)).toBeLessThan(1e-6);
    }
    // ... and those nearer the road with the road
    for (const c of cells.filter((c) => !byCanal.includes(c) && foot(roadLine(core), [c.x, c.z]).d < 20)) expect(turnBetween(c.angle, Math.PI / 2)).toBeLessThan(1e-6);
    // paddies along the canal paint, the rows over its tiles' margin too (the field's way is to the road, 128 m)
    const strip = byCanal.filter((c) => c.row <= 3 && c.x > 300 && c.x < 360 && turnBetween(c.angle, along) < 1e-6 && c.nz > 0);
    expect(strip.length).toBeGreaterThan(8);
    expect(core.apply({ type: "farmCells", erase: false, cells: strip.map((c) => c.key), stroke: 3 })).toMatchObject({ accepted: true });
    expect(strip.filter((c) => cellPainted(map, c)).length).toBeGreaterThan(strip.length * 0.8);
    // the zones' cells never lie along a canal (they face roads)
    const zones = cellLayout(map);
    for (const c of zones.cells) expect(turnBetween(c.angle, along)).toBeGreaterThan(0.1);
  });

  test("laid a chunk at a time, the cells are the whole map's", () => {
    const core = city([80, 80], [880, 520]);
    const whole = cellLayout(core.map as any, () => true, { depth: farmRows({ tileSizeM: M }, 8), plots: false,
      ground: (v) => isOpenLand(v) || isFieldValue(v) || isRoadTile(v), canals: true });
    const parts = allCells(core);
    expect(parts.length).toBe(whole.cells.length);
    for (const c of parts) expect(whole.byKey.has(c.key)).toBe(true);
    expect(FARM_CHUNK * 16).toBe(160);
  });

  test("a rectangle is turned with its road and paints the cells inside it; the fields drawn have no axis staircase", () => {
    const core = city([80, 80], [880, 520]), map = core.map as any;
    const road = Math.atan2(800, 440), line = roadLine(core);
    // from a cell a few rows off the road, 8 cells along it and 4 rows deep
    const start = allCells(core).find((c) => turnBetween(c.angle, road) < 1e-6 && Math.abs(foot(line, [c.x, c.z]).d - 20) < CELL / 2)!;
    const along = [Math.sin(start.angle), Math.cos(start.angle)], across = [start.nx, start.nz];
    const end: [number, number] = [start.x + along[0] * 7 * CELL + across[0] * 3 * CELL, start.z + along[1] * 7 * CELL + across[1] * 3 * CELL];
    const rect = farmCellsInRect(map, [start.x, start.z], end);
    expect(rect.cells).toHaveLength(32);
    for (const c of rect.cells) expect(turnBetween(c.angle, road)).toBeLessThan(1e-6);
    // the outline's sides along and across the road
    const side = [rect.corners[1][0] - rect.corners[0][0], rect.corners[1][1] - rect.corners[0][1]];
    const sideTurn = turnBetween(Math.atan2(side[0], side[1]), road);
    expect(Math.min(sideTurn, Math.PI / 2 - sideTurn)).toBeLessThan(1e-6);
    expect(core.apply({ type: "farmCells", erase: false, cells: rect.cells.map((c) => c.key), stroke: 2 })).toMatchObject({ accepted: true });
    for (const c of rect.cells) expect(cellPainted(map, c)).toBe(true);
    // grown paddies, drawn: every edge of every patch runs along the road or across it
    for (let i = 0; i < W * H; i++) {
      if (!isFieldValue(map.getTileValue(i % W, Math.floor(i / W)))) continue;
      map.setTile(i % W, Math.floor(i / W), fieldTile(2), FIELD_FLAGS);
      (map.farmKinds ??= new Uint8Array(W * H))[i] = kindCode("paddy");
    }
    const view = new CityFarmFields(map, { sample: () => 0 });
    view.update([], 6, 300, 0);
    const ground = view.root.children.find((c) => c.name === "farm_fields/ground") as Mesh;
    const position = ground.geometry.getAttribute("position") as BufferAttribute;
    expect(position.count).toBeGreaterThan(32 * 6);
    // (each patch two triangles, (u0, v0) (u0, v1) (u1, v0) and (u1, v0) (u0, v1) (u1, v1): their sides, not the diagonal)
    for (let t = 0; t < position.count; t += 3) {
      for (const [a, b] of (t / 3) % 2 === 0 ? [[0, 1], [0, 2]] : [[2, 0], [2, 1]]) {
        const dx = position.getX(t + b) - position.getX(t + a), dz = position.getZ(t + b) - position.getZ(t + a);
        const turn = turnBetween(Math.atan2(dx, dz), road);
        expect(Math.min(turn, Math.abs(turn - Math.PI / 2))).toBeLessThan(1e-4);
      }
    }
    expect(view.counts().fields).toBeGreaterThan(0);
    expect(ground.material).toBeInstanceOf(MeshStandardMaterial);
    view.dispose();
  });

  test("beside a slanted road the rows over its tiles' margin paint too: no staircase of road tiles along the field", () => {
    const core = city([80, 80], [880, 520]), map = core.map as any, road = Math.atan2(800, 440);
    const near = allCells(core).filter((c) => c.row <= 2 && c.x > 300 && c.x < 420 && turnBetween(c.angle, road) < 1e-6);
    // some of them lie wholly or partly on the road's tiles
    expect(near.some((c) => isRoadTile(map.getTileValue(Math.floor(c.x / 10), Math.floor(c.z / 10))))).toBe(true);
    const behind = allCells(core).filter((c) => c.row >= 3 && c.row <= 5 && c.x > 300 && c.x < 420 && turnBetween(c.angle, road) < 1e-6);
    core.apply({ type: "farmCells", erase: false, cells: [...near, ...behind].map((c) => c.key), stroke: 2 });
    // (each painted, but where the land tile it belongs to was left out of the stroke: past the stroke's ends)
    const owned = (c: Cell) => { const h = homeSquare(map, c)!; return isFieldValue(map.getTileValue(h.owner % W, Math.floor(h.owner / W))); };
    for (const c of behind) expect([c.row, cellPainted(map, c)]).toEqual([c.row, true]);
    for (const c of near) expect([c.row, cellPainted(map, c)]).toEqual([c.row, owned(c)]);
    expect(near.filter((c) => cellPainted(map, c)).length).toBeGreaterThan(near.length * 0.8);
    // ... and they are saved
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: W, height: H, version: (Storage as any).CURRENT_VERSION }));
    const again = new CityCore({ sandbox: true, map: new (GameMap as any)(W, H), saved });
    for (const c of near) expect(cellPainted(again.map as any, c)).toBe(cellPainted(map, c));
  });

  test("the paint stays where it lies when its road is upgraded in place", () => {
    const core = city([80, 80], [880, 520]), map = core.map as any;
    const cells = allCells(core).filter((c) => c.row >= 2 && c.row <= 5 && c.x > 300 && c.x < 340);
    core.apply({ type: "farmCells", erase: false, cells: cells.map((c) => c.key), stroke: 2 });
    const squares = map.farmSquares.slice(), painted = allCells(core).filter((c) => cellPainted(map, c)).length;
    for (let i = 0; i < W * H; i++) {
      if (isRoadTile(map.getTileValue(i % W, Math.floor(i / W)))) core.apply({ type: "tool", tool: UPGRADE_TOOL as never, x: i % W, y: Math.floor(i / W), stroke: 3 });
    }
    expect(map.roadLevels.some((level: number) => level > 1)).toBe(true);
    expect([...map.farmSquares]).toEqual([...squares]);
    const after = allCells(core).filter((c) => cellPainted(map, c)).length;
    expect(after).toBeGreaterThan(painted * 0.85);
    expect(after).toBeLessThan(painted * 1.15);
  });

  test("an older save's fields painted in 4 m cells of 4 x 4 show through the road-aligned cells, none lost", () => {
    const core = city([80, 80], [880, 520]), map = core.map as any;
    // a tile beside the road, painted in its old top-left quarter and one lone old cell
    const c = allCells(core).find((cell) => cell.row === 8)!, tx = Math.floor(c.x / 10), ty = Math.floor(c.z / 10);
    map.setTile(tx, ty, fieldTile(1), FIELD_FLAGS);
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: W, height: H, version: (Storage as any).CURRENT_VERSION }));
    delete saved.farmSquares;
    saved.farmCells = { [ty * W + tx]: 0x0033 | 0x8000 };
    const again = new CityCore({ sandbox: true, map: new (GameMap as any)(W, H), saved }), opened = again.map as any;
    expect(paintedSquares(opened, ty * W + tx)).toBeGreaterThanOrEqual(5 * 4);
    // every old cell has a road-aligned cell painted whose middle lies in it or reaches over it
    const shown = paintedCells(opened, [ty * W + tx]).map((one) => one.cell);
    for (const bit of [0, 1, 4, 5, 15]) {
      const ox = (tx + ((bit & 3) + 0.5) / 4) * 10, oz = (ty + ((bit >> 2) + 0.5) / 4) * 10;
      expect([bit, shown.some((cell) => Math.hypot(cell.x - ox, cell.z - oz) < CELL)]).toEqual([bit, true]);
    }
    expect(fieldShare(opened, ty * W + tx)).toBeGreaterThan(0);
  });

  test("the same commands make the same fields", () => {
    const run = () => {
      const core = city([80, 80], [880, 520]);
      const rect = farmCellsInRect(core.map as any, [300, 230], [330, 260]);
      core.apply({ type: "farmCells", erase: false, cells: rect.cells.map((c: Cell) => c.key), stroke: 2 });
      core.apply({ type: "tool", tool: "zone_farm" as never, x: 30, y: 25, stroke: 3 });
      const map = core.map as any, tiles: number[] = [];
      for (let i = 0; i < W * H; i++) tiles.push(map.getTileValue(i % W, Math.floor(i / W)));
      return { squares: [...map.farmSquares], tiles };
    };
    expect(run()).toEqual(run());
  });

  test("a square's place and the simulation's version", () => {
    expect(squareAt({ width: W, height: H }, 10 + 1.3, 20 + 8.9)).toEqual({ tile: 2 * W + 1, row: 7, column: 1 });
    expect(SQUARES * SQUARES).toBe(ALL_SQUARES);
    expect(SIM_VERSION).toBeGreaterThanOrEqual(17);
  });
});
