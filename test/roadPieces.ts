/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Each drawn road is a piece of its own (src/roadPieces.ts): a road built on from another's end, leaving it or crossing
// it never moves the road that was there (owner, 18 Oct 2026: "ถนนที่สร้างไปแล้ว และฉันสร้างต่อ จะต้องไม่เปลี่ยนรูป ถนนอีก").

import type { TilePoint } from "../src/cityView";
import { CityCore } from "../src/core/cityCore";
import { curvePath, gridLines, gridPath, linePath } from "../src/drawPaths";
import { GameMap } from "../src/gameMap.js";
import { networkOf, roadLines, type Point } from "../src/roadGeometry";

const SIZE = 70;

function newCity(saved: unknown = null) {
  const map = new (GameMap as unknown as new (w: number, h: number) => any)(SIZE, SIZE);
  const core = new CityCore({ map, saved, seed: 3 });
  core.simulation.budget.setFunds(500000);
  // Railways too, before the ruler's house stands (src/rulerHouse.ts)
  core.map.needsRulerHouse = false;
  return core;
}

let stroke = 0;
/** Lays a drawn line as the game does: a road (or railway) command a tile, all one stroke, saying how it was drawn */
function draw(core: CityCore, tiles: TilePoint[], tool: "road" | "rail" = "road", extra: Record<string, unknown> = {}): void {
  stroke++;
  for (const { x, y } of tiles) core.apply({ type: "tool", tool, x, y, stroke, ...extra } as any);
}
/** ... a straight line from a to b, as the straight mode draws it */
function drawStraight(core: CityCore, a: TilePoint, b: TilePoint, tool: "road" | "rail" = "road"): void {
  draw(core, linePath(a, b), tool, { shape: "straight", controls: [[a.x, a.y], [b.x, b.y]] });
}
/** ... and the curve through clicked points, as the curve modes draw it */
function drawCurve(core: CityCore, points: TilePoint[] = CURVE_POINTS, tool: "road" | "rail" = "road"): void {
  draw(core, curvePath(points), tool, { shape: "curve", controls: points.map((p) => [p.x, p.y]) });
}

/** The roads' (or railways') lines as the 3D view draws them */
function drawn(core: CityCore, rail = false) {
  const map = core.map;
  return roadLines(networkOf({ width: map.width, height: map.height,
    value: (i) => map.getTileValue(i % map.width, Math.floor(i / map.width)),
    level: (i) => map.roadLevels[i] || 1, piece: (i) => map.roadPieces[i], path: (piece) => map.roadPaths[piece] ?? null }, rail));
}

/** The way a line runs at its point nearest p, as a unit vector from its start towards its end */
function wayAt(line: Point[], p: Point): Point {
  let best = 1, bestDistance = Infinity;
  for (let i = 1; i < line.length; i++) {
    const distance = Math.hypot((line[i - 1][0] + line[i][0]) / 2 - p[0], (line[i - 1][1] + line[i][1]) / 2 - p[1]);
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  const dx = line[best][0] - line[best - 1][0], dz = line[best][1] - line[best - 1][1], length = Math.hypot(dx, dz);
  return [dx / length, dz / length];
}
const degreesBetween = (a: Point, b: Point) => Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1]))) * 180 / Math.PI;

/** The line that runs through these two points (an old road's ends) */
function lineThrough(lines: Point[][], a: Point, b: Point): Point[] | undefined {
  const near = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;
  return lines.find((line) => (near(line[0], a) && near(line[line.length - 1], b)) ||
    (near(line[0], b) && near(line[line.length - 1], a)));
}

function expectSameLine(after: Point[] | undefined, before: Point[]): void {
  expect(after).toBeDefined();
  const line = after!.length && Math.hypot(after![0][0] - before[0][0], after![0][1] - before[0][1]) < 0.01 ? after! : [...after!].reverse();
  expect(line).toHaveLength(before.length);
  line.forEach(([x, z], i) => {
    expect(x).toBeCloseTo(before[i][0], 6);
    expect(z).toBeCloseTo(before[i][1], 6);
  });
}

/** A curve east, then bending south, as the screenshot's (owner, 18 Oct 2026) */
const CURVE_POINTS = [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 45, y: 40 }];
const CURVE = curvePath(CURVE_POINTS);
const END = CURVE[CURVE.length - 1];
const MIDDLE = CURVE[Math.floor(CURVE.length / 2)];

describe("road pieces", () => {
  test("each stroke of a road tool lays a piece of its own; roads already there keep theirs", () => {
    const core = newCity();
    drawStraight(core, { x: 5, y: 5 }, { x: 20, y: 5 });
    drawStraight(core, { x: 20, y: 5 }, { x: 20, y: 20 });
    const pieces = core.map.roadPieces, at = (x: number, y: number) => pieces[y * SIZE + x];
    expect(at(5, 5)).toBe(1);
    expect(at(20, 5)).toBe(1);
    expect(at(20, 6)).toBe(2);
    expect(at(20, 20)).toBe(2);
    // A road laid without a stroke (a script, an old replay) is of no piece, and joins as roads always have
    core.apply({ type: "tool", tool: "road", x: 30, y: 30 });
    expect(at(30, 30)).toBe(0);
  });

  test.each([
    ["straight on along its way", { x: END.x + 3, y: END.y + 18 }, true],
    ["turning south-west", { x: END.x - 15, y: END.y + 15 }, false],
    ["turning east", { x: END.x + 20, y: END.y }, false],
  ])("a road built on from a curve's end (%s) leaves the curve as it was", (_, to, smooth) => {
    const core = newCity();
    drawCurve(core);
    const [before] = drawn(core).lines.map((line) => line.points);
    drawStraight(core, END, to);
    const after = drawn(core), lines = after.lines.map((line) => line.points);
    const curve = lineThrough(lines, before[0], before[before.length - 1]);
    expectSameLine(curve, before);
    // The two meet at the curve's end; drawn on along the curve's way the new road leaves it without a corner, and
    // turning it keeps its angle there, under a round plate (owner, 18 Oct 2026: "วาดแบบไหน จะได้แบบนั้น")
    expect(after.lines).toHaveLength(2);
    const end: Point = [(END.x + 0.5) * 10, (END.y + 0.5) * 10];
    const joint = after.junctions.find(({ at }) => Math.hypot(at[0] - end[0], at[1] - end[1]) < 0.01);
    expect(joint?.through).toBeNull();
    expect(joint?.arms.map((arm) => arm.end !== null)).toEqual([true, true]);
    expect(joint?.smooth === true).toBe(smooth);
    const road = lines.find((line) => line !== curve)!;
    const turn = degreesBetween(wayAt(curve!, end), wayAt(road, end));
    if (smooth) expect(turn).toBeLessThan(1); else expect(turn).toBeGreaterThan(30);
  });

  test("a railway built on from another's end, or leaving it, leaves it as it was", () => {
    const core = newCity();
    drawCurve(core, CURVE_POINTS, "rail");
    const [before] = drawn(core, true).lines.map((line) => line.points);
    expect(core.map.roadPieces[CURVE[3].y * SIZE + CURVE[3].x]).toBe(1);
    drawStraight(core, END, { x: END.x, y: END.y + 20 }, "rail");
    drawStraight(core, MIDDLE, { x: MIDDLE.x - 20, y: MIDDLE.y + 20 }, "rail");
    const lines = drawn(core, true).lines.map((line) => line.points);
    expectSameLine(lineThrough(lines, before[0], before[before.length - 1]), before);
  });

  test("a road laid across a railway keeps the railway's piece on the crossing", () => {
    const core = newCity();
    drawStraight(core, { x: 5, y: 30 }, { x: 40, y: 30 }, "rail");
    drawStraight(core, { x: 20, y: 20 }, { x: 20, y: 40 });
    expect(core.map.roadPieces[30 * SIZE + 20]).toBe(1);
    expect(core.map.roadPieces[25 * SIZE + 20]).toBe(2);
  });

  test.each([
    ["a side road leaving it at a slant", linePath(MIDDLE, { x: MIDDLE.x - 20, y: MIDDLE.y + 20 })],
    ["a side road ending on it", linePath({ x: MIDDLE.x + 20, y: MIDDLE.y - 8 }, MIDDLE)],
    ["a road crossing it", linePath({ x: MIDDLE.x + 12, y: MIDDLE.y - 10 }, { x: MIDDLE.x - 12, y: MIDDLE.y + 12 })],
    ["a road laid beside it, touching it", linePath({ x: MIDDLE.x - 12, y: MIDDLE.y - 14 }, { x: MIDDLE.x + 10, y: MIDDLE.y + 16 })],
  ])("%s leaves the curve as it was, running on through the junction", (_, tiles) => {
    const core = newCity();
    drawCurve(core);
    const [before] = drawn(core).lines.map((line) => line.points);
    draw(core, tiles);
    const after = drawn(core), lines = after.lines.map((line) => line.points);
    const curve = lineThrough(lines, before[0], before[before.length - 1]);
    expectSameLine(curve, before);
    // At every junction on it, it runs on through, and is the road the junction is drawn on
    const on = after.junctions.filter((junction) => junction.arms.some((arm) => lines[arm.line] === curve));
    expect(on.length).toBeGreaterThan(0);
    for (const junction of on) {
      expect(lines[junction.through!]).toBe(curve);
      expect(junction.arms.filter((arm) => lines[arm.line] === curve && arm.end === null)).toHaveLength(2);
    }
  });

  /** How far p lies from a line */
  const offLine = (line: Point[], p: Point): number => {
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]));
    }
    return best;
  };
  const bulldoze = (core: CityCore, tile: TilePoint) => {
    stroke++;
    core.apply({ type: "tool", tool: "bulldozer", x: tile.x, y: tile.y, stroke });
    expect(core.map.getTileValue(tile.x, tile.y) >= 64 && core.map.getTileValue(tile.x, tile.y) <= 206).toBe(false);
  };

  test("bulldozing a drawn road's tiles, an end one by one or one in the middle, leaves the rest where it was drawn", () => {
    const core = newCity();
    drawCurve(core);
    const [before] = drawn(core).lines.map((line) => line.points);
    expect(core.map.roadPaths[1].tiles).toHaveLength(CURVE.length);
    for (let k = 1; k <= 4; k++) {
      bulldoze(core, CURVE[CURVE.length - k]);
      const lines = drawn(core).lines.map((line) => line.points);
      expect(lines).toHaveLength(1);
      for (const p of lines[0]) expect(offLine(before, p)).toBeLessThan(1e-6);
    }
    bulldoze(core, MIDDLE);
    const halves = drawn(core).lines.map((line) => line.points);
    expect(halves).toHaveLength(2);
    for (const line of halves) for (const p of line) expect(offLine(before, p)).toBeLessThan(1e-6);
    // ... and taking it back puts the very line back
    for (let k = 0; k < 5; k++) core.apply({ type: "undo" });
    expectSameLine(drawn(core).lines.map((line) => line.points)[0], before);
  });

  test("a road built on from another's end keeps its shape when that end is bulldozed", () => {
    const core = newCity();
    drawCurve(core);
    drawStraight(core, END, { x: END.x + 3, y: END.y + 18 });
    const lines = drawn(core).lines.map((line) => line.points);
    const curve = lines.find((line) => offLine(line, [(CURVE[0].x + 0.5) * 10, (CURVE[0].y + 0.5) * 10]) < 0.01)!;
    const road = lines.find((line) => line !== curve)!;
    bulldoze(core, END);
    bulldoze(core, CURVE[CURVE.length - 2]);
    const after = drawn(core).lines.map((line) => line.points);
    expect(after).toHaveLength(2);
    for (const line of after) {
      const own = offLine(curve, line[1]) < offLine(road, line[1]) ? curve : road;
      for (const p of line) expect(offLine(own, p)).toBeLessThan(1e-6);
    }
  });

  test("a stroke that is no path (a grid) keeps no path, and drawn paths are saved with the city", () => {
    const core = newCity();
    stroke++;
    for (const { x, y } of gridPath({ x: 5, y: 5 }, { x: 19, y: 19 })) core.apply({ type: "tool", tool: "road", x, y, stroke });
    expect(core.map.roadPaths[1]).toBeUndefined();
    drawStraight(core, { x: 30, y: 30 }, { x: 50, y: 40 });
    const saved = JSON.parse(JSON.stringify(core.save()));
    expect(Object.keys(saved.roadPaths)).toEqual(["2"]);
    const again = newCity(saved);
    expect(again.map.roadPaths[2].tiles).toEqual(core.map.roadPaths[2].tiles);
  });

  /** Every point of a line on the straight line through its ends */
  const straightness = (line: Point[]): number => {
    const [ax, az] = line[0], [bx, bz] = line[line.length - 1], length = Math.hypot(bx - ax, bz - az) || 1;
    return Math.max(...line.map(([x, z]) => Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / length));
  };

  test("each way of drawing builds what it draws: a straight line, the curve through its points, a grid", () => {
    // Straight: one straight line from A's middle to B's, however its tiles stairstep
    let core = newCity();
    drawStraight(core, { x: 5, y: 5 }, { x: 40, y: 22 });
    let lines = drawn(core).lines.map((line) => line.points);
    expect(lines).toHaveLength(1);
    expect(straightness(lines[0])).toBeLessThan(1e-9);
    expect(lines[0][0]).toEqual([55, 55]);
    // Curve: the very curve through the clicked points' middles, as the preview draws it
    core = newCity();
    drawCurve(core);
    lines = drawn(core).lines.map((line) => line.points);
    const at = CURVE_POINTS.map((p): Point => [(p.x + 0.5) * 10, (p.y + 0.5) * 10]);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p: Point = [(1 - t) ** 2 * at[0][0] + 2 * (1 - t) * t * at[1][0] + t * t * at[2][0],
        (1 - t) ** 2 * at[0][1] + 2 * (1 - t) * t * at[1][1] + t * t * at[2][1]];
      expect(offLine(lines[0], p)).toBeLessThan(0.05);
    }
    // Grid: its rows and columns straight, its corners corners, not rounded into curves
    core = newCity();
    stroke++;
    gridLines({ x: 5, y: 5 }, { x: 19, y: 19 }).forEach((line, part) => {
      for (const { x, y } of line) core.apply({ type: "tool", tool: "road", x, y, stroke, part, shape: "straight" } as any);
    });
    const grid = drawn(core);
    for (const line of grid.lines) expect(straightness(line.points)).toBeLessThan(1e-9);
    const corner = grid.junctions.find(({ at: [x, z] }) => x === 55 && z === 55);
    expect(corner?.smooth).toBeUndefined();
    expect(corner?.arms.map((arm) => arm.end !== null)).toEqual([true, true]);
    // ... and taking it back takes the whole grid back at once
    core.apply({ type: "undo" });
    expect(drawn(core).lines).toHaveLength(0);
  });

  test("a straight road drawn onto a slanted one stays straight to the other's middle line, with no turn at its end", () => {
    const core = newCity();
    drawStraight(core, { x: 5, y: 50 }, { x: 60, y: 30 });
    const main = linePath({ x: 5, y: 50 }, { x: 60, y: 30 });
    for (const x of [20, 33, 40, 47]) {
      const b = main.find((t) => t.x === x)!;
      drawStraight(core, { x: b.x + 2, y: 12 }, b);
    }
    const lines = drawn(core).lines.map((line) => line.points);
    const road = lines.find((line) => line.length > 0 && Math.abs(line[0][1] - 505) < 1 || Math.abs(line[line.length - 1][1] - 505) < 1)!;
    const branches = lines.filter((line) => line !== road);
    expect(branches).toHaveLength(4);
    for (const line of branches) {
      expect(straightness(line)).toBeLessThan(1e-6);
      expect(offLine(road, line[line.length - 1])).toBeLessThan(1e-6);
    }
  });

  test("the pieces are saved, and the next stroke is numbered on from them", () => {
    const core = newCity();
    drawCurve(core);
    drawStraight(core, END, { x: END.x, y: END.y + 10 });
    const [before] = drawn(core).lines.map((line) => line.points);
    const saved = JSON.parse(JSON.stringify(core.save()));
    expect(typeof saved.roadPieces).toBe("string");
    const again = newCity(saved);
    expect(Array.from(again.map.roadPieces)).toEqual(Array.from(core.map.roadPieces));
    expectSameLine(drawn(again).lines.map((line) => line.points)[0], before);
    draw(again, linePath({ x: 5, y: 60 }, { x: 25, y: 60 }));
    expect(again.map.roadPieces[60 * SIZE + 5]).toBe(3);
  });
});
