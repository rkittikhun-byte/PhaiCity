/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Each drawn road is a piece of its own (src/roadPieces.ts): a road built on from another's end, leaving it or crossing
// it never moves the road that was there (owner, 18 Oct 2026: "ถนนที่สร้างไปแล้ว และฉันสร้างต่อ จะต้องไม่เปลี่ยนรูป ถนนอีก").

import type { TilePoint } from "../src/cityView";
import { CityCore } from "../src/core/cityCore";
import { curvePath, linePath } from "../src/drawPaths";
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
/** Lays a drawn line as the game does: a road (or railway) command a tile, all one stroke */
function draw(core: CityCore, tiles: TilePoint[], tool: "road" | "rail" = "road"): void {
  stroke++;
  for (const { x, y } of tiles) core.apply({ type: "tool", tool, x, y, stroke });
}

/** The roads' (or railways') lines as the 3D view draws them */
function drawn(core: CityCore, rail = false) {
  const map = core.map;
  return roadLines(networkOf({ width: map.width, height: map.height,
    value: (i) => map.getTileValue(i % map.width, Math.floor(i / map.width)),
    level: (i) => map.roadLevels[i] || 1, piece: (i) => map.roadPieces[i] }, rail));
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
const CURVE = curvePath([{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 45, y: 40 }]);
const END = CURVE[CURVE.length - 1];
const MIDDLE = CURVE[Math.floor(CURVE.length / 2)];

describe("road pieces", () => {
  test("each stroke of a road tool lays a piece of its own; roads already there keep theirs", () => {
    const core = newCity();
    draw(core, linePath({ x: 5, y: 5 }, { x: 20, y: 5 }));
    draw(core, linePath({ x: 20, y: 5 }, { x: 20, y: 20 }));
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
    ["straight on south", { x: END.x, y: END.y + 20 }, true],
    ["turning south-west", { x: END.x - 15, y: END.y + 15 }, false],
    ["turning east", { x: END.x + 20, y: END.y }, false],
  ])("a road built on from a curve's end (%s) leaves the curve as it was", (_, to, smooth) => {
    const core = newCity();
    draw(core, CURVE);
    const [before] = drawn(core).lines.map((line) => line.points);
    draw(core, linePath(END, to));
    const after = drawn(core), lines = after.lines.map((line) => line.points);
    const curve = lineThrough(lines, before[0], before[before.length - 1]);
    expectSameLine(curve, before);
    // The two meet at the curve's end; going on nearly straight the new road leaves along the curve's way, without a
    // corner, and turning it ends there at a corner under a round plate
    expect(after.lines).toHaveLength(2);
    const end: Point = [(END.x + 0.5) * 10, (END.y + 0.5) * 10];
    const joint = after.junctions.find(({ at }) => Math.hypot(at[0] - end[0], at[1] - end[1]) < 0.01);
    expect(joint?.through).toBeNull();
    expect(joint?.arms.map((arm) => arm.end !== null)).toEqual([true, true]);
    expect(joint?.smooth === true).toBe(smooth);
    const road = lines.find((line) => line !== curve)!;
    const turn = degreesBetween(wayAt(curve!, end), wayAt(road, end));
    if (smooth) expect(turn).toBeLessThan(3); else expect(turn).toBeGreaterThan(30);
  });

  test("a railway built on from another's end, or leaving it, leaves it as it was", () => {
    const core = newCity();
    draw(core, CURVE, "rail");
    const [before] = drawn(core, true).lines.map((line) => line.points);
    expect(core.map.roadPieces[CURVE[3].y * SIZE + CURVE[3].x]).toBe(1);
    draw(core, linePath(END, { x: END.x, y: END.y + 20 }), "rail");
    draw(core, linePath(MIDDLE, { x: MIDDLE.x - 20, y: MIDDLE.y + 20 }), "rail");
    const lines = drawn(core, true).lines.map((line) => line.points);
    expectSameLine(lineThrough(lines, before[0], before[before.length - 1]), before);
  });

  test("a road laid across a railway keeps the railway's piece on the crossing", () => {
    const core = newCity();
    draw(core, linePath({ x: 5, y: 30 }, { x: 40, y: 30 }), "rail");
    draw(core, linePath({ x: 20, y: 20 }, { x: 20, y: 40 }));
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
    draw(core, CURVE);
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

  test("the pieces are saved, and the next stroke is numbered on from them", () => {
    const core = newCity();
    draw(core, CURVE);
    draw(core, linePath(END, { x: END.x, y: END.y + 10 }));
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
