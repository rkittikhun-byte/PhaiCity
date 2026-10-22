/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A road drawn in metres never moves (owner, 20 Oct 2026: "บอกแล้วไง ห้ามขยับ"; docs/METRE_DRAWING_PLAN.md 6: draw →
// save → load → compare every piece in metres): roads drawn on from its ends, across it, onto its middle or twice
// across a curve, a railway over it, undo, a year of the city going on, a save and the city opened from it. After
// each, every road and railway drawn is checked three ways against the line it was drawn as: the graph's segments of
// its stroke, the runs the 3D view draws from them (src/roads/graphLines.ts), and the lines the game snaps to and the
// view finally draws (drawnRoads, joined to everything else).

import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { roadReach } from "../src/roadGeometry";
import { drawnRoads, graphLines } from "../src/roads/graphLines";
import { RoadGraph } from "../src/roads/roadGraph";
import { snapNext, snapStart, WAY_MAX_M, type SnapNet } from "../src/roads/roadSnap";
import { isLineRail, isLineRoad, isPowerCrossing } from "../src/roadTiles";
import { Storage } from "../src/storage.js";

type P = [number, number];
interface Drawn { from: P; to: P; c1?: P; c2?: P }
/** A road or railway drawn, the piece its stroke laid, and whether it is a railway */
interface Stroke { road: Drawn; piece: number; rail: boolean }

/** World units a metre on a 16 m city map */
const U = 10 / 16;

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** A city's save as the game keeps it, and the city opened from it */
function saveAndOpen(core: CityCore) {
  const saved = JSON.parse(JSON.stringify({ ...core.save(), width: core.map.width, height: core.map.height,
    version: (Storage as any).CURRENT_VERSION }));
  return new CityCore({ sandbox: true, map: new (GameMap as any)(saved.width, saved.height), saved });
}

const graphOf = (core: CityCore, rail = false): RoadGraph => (core.map as any)[rail ? "railGraph" : "roadGraph"];

/** Draws a road (or railway) as the game does, a road command of its own stroke, laid whole */
function draw(core: CityCore, strokes: Stroke[], road: Drawn, tool = "road"): Stroke {
  const out = core.apply({ type: "road", tool: tool as any, ...road, stroke: core.log.length + 1 });
  expect(out).toEqual({ accepted: true, toolResult: 0 });
  const rail = tool === "rail";
  const stroke = { road, rail, piece: Math.max(...[...graphOf(core, rail).segments.values()].map((s) => s.piece ?? 0)) };
  strokes.push(stroke);
  return stroke;
}

/** The road as it was drawn, on a graph of its own: how far a point lies off it, and points along it */
function asDrawn(road: Drawn) {
  const graph = new RoadGraph(), [id] = graph.add({ ...road, level: 1 }).segments;
  const samples: P[] = [];
  for (let k = 0; k <= 200; k++) samples.push(graph.pointAt(id, k / 200));
  return { off: (p: readonly number[]): number => graph.nearestOn(id, [p[0], p[1]]).distance, samples };
}

/** A point along a drawn road, t from its start (0) to its end (1) */
const along = (road: Drawn, t: number): P => {
  const graph = new RoadGraph(), [id] = graph.add({ ...road, level: 1 }).segments;
  return graph.pointAt(id, t);
};

/** How far p lies from a line of points */
function offPolyline(points: readonly (readonly number[])[], p: readonly number[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az, len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]));
  }
  return best;
}

/** The map as graphLines and drawnRoads read it */
function lineMap(core: CityCore) {
  const map = core.map as any, width = map.width;
  return { width, height: map.height, tileSizeM: 16, value: (i: number) => map.getTileValue(i % width, Math.floor(i / width)),
    piece: (i: number) => map.roadPieces?.[i] ?? 0, level: (i: number) => map.roadLevels?.[i] || 1,
    path: (p: number) => map.roadPaths?.[p] ?? null };
}

/**
 * Checks a stroke lies exactly where it was drawn: its segments within 2 mm of the line drawn and covering it all, and
 * the lines the 3D view draws for it within 2 cm (points 4 m apart on a curve) and covering it all, but for the tiles
 * that keep a model of their own (a level crossing, a bridge), which its lines stop at
 */
function expectWhereDrawn(core: CityCore, { road, piece, rail }: Stroke): void {
  const drawn = asDrawn(road), graph = graphOf(core, rail);
  const own = [...graph.segments.values()].filter((s) => s.piece === piece);
  expect(own.length).toBeGreaterThan(0);
  for (const s of own) for (let k = 0; k <= 50; k++) expect(drawn.off(graph.pointAt(s.id, k / 50))).toBeLessThan(0.002);
  const polylines = own.map((s) => graph.polyline(s.id, 0.25));
  for (const p of drawn.samples) expect(Math.min(...polylines.map((line) => offPolyline(line, p)))).toBeLessThan(0.002);
  // ... as the 3D view draws it from the graph: the whole stroke, none of it read from its tiles
  const map = lineMap(core), lines = graphLines(graph, map, rail);
  const plain = (p: P): boolean => {
    const v = map.value(Math.floor(p[1] / 16) * map.width + Math.floor(p[0] / 16));
    return rail ? isLineRail(v) : isLineRoad(v) || isPowerCrossing(v);
  };
  const shown = drawn.samples.filter(plain);
  const runs = lines.runs.filter((run) => run.piece === piece).map((run) => run.points.map(([x, z]) => [x / U, z / U]));
  expect(runs.length).toBeGreaterThan(0);
  for (const run of runs) for (const p of run) expect(drawn.off(p)).toBeLessThan(0.02);
  for (const p of shown) expect(Math.min(...runs.map((run) => offPolyline(run, p)))).toBeLessThan(0.02);
  // ... and as the lines everything else snaps to and the view finally draws, joined to the other roads
  const joined = drawnRoads(map, lines, rail).lines.filter((line) => line.piece === piece)
    .map((line) => line.points.map(([x, z]) => [x / U, z / U]));
  expect(joined.length).toBeGreaterThan(0);
  for (const line of joined) for (const p of line) expect(drawn.off(p)).toBeLessThan(0.02);
  for (const p of shown) expect(Math.min(...joined.map((line) => offPolyline(line, p)))).toBeLessThan(0.02);
}

const expectAllWhereDrawn = (core: CityCore, strokes: readonly Stroke[]): void => {
  for (const stroke of strokes) expectWhereDrawn(core, stroke);
};

/** Two roads to keep an eye on: a straight one at a slant no row of tiles follows, and a curve */
const SLANT: Drawn = { from: [37.3, 101.9], to: [610.4, 377.7] };
const CURVE: Drawn = { from: [60.5, 520.25], c1: [250, 330], c2: [520, 640], to: [880.75, 430.5] };
/** ... a road across the slant, one across the curve twice and a railway across both */
const ACROSS: Drawn = { from: [300.5, 20.25], to: [180.75, 400.5] };
const TWICE: Drawn = { from: [120.5, 610.25], c1: [300.5, 380.75], c2: [600.25, 380.5], to: [800.5, 620.25] };
const RAILWAY: Drawn = { from: [400.25, 20.5], to: [420.5, 630.25] };

/** The roads as the road tool snaps to them (src/game.js networkLines, metrePoint), in metres */
function snapNet(core: CityCore): SnapNet {
  const map = lineMap(core), drawn = drawnRoads(map, graphLines(graphOf(core), map, false), false);
  return { lines: drawn.lines.map((line) => line.points.map(([x, z]): P => [x / U, z / U])),
    nodes: drawn.points.map(([x, z]): P => [x / U, z / U]),
    half: drawn.lines.map((line) => roadReach(line.level || 1, U) / U) };
}

describe("a road drawn in metres stays where it was drawn", () => {
  test("roads drawn on from its ends, at any angle, leave it as drawn, and are where they were drawn", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    // Nearly straight on from the slant's end, square from its start, and off the curve's ends
    draw(core, strokes, { from: SLANT.to, to: [930.5, 520.2] });
    draw(core, strokes, { from: SLANT.from, to: [80.7, 11.8] });
    draw(core, strokes, { from: CURVE.from, to: [20.25, 630.5] });
    draw(core, strokes, { from: CURVE.to, to: [940.5, 300.25] });
    expectAllWhereDrawn(core, strokes);
  });

  test("roads drawn across it, onto its middle and twice across a curve leave it as drawn, and are where they were drawn", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    // Across the slant steeply and at a shallow angle; a T onto it from either side
    draw(core, strokes, ACROSS);
    draw(core, strokes, { from: [100.25, 230.5], to: [560.5, 280.75] });
    const middle = along(SLANT, 0.8), quarter = along(SLANT, 0.3);
    draw(core, strokes, { from: [middle[0] + 40.5, middle[1] - 120.25], to: middle });
    draw(core, strokes, { from: quarter, to: [quarter[0] - 50.5, quarter[1] + 140.75] });
    // A curve across the curve twice, and a straight road across both near where they bend most
    draw(core, strokes, TWICE);
    draw(core, strokes, { from: [430.25, 380.5], to: [470.5, 630.25] });
    expect(graphOf(core).segments.size).toBeGreaterThan(14);
    expectAllWhereDrawn(core, strokes);
  });

  test("a road at 45° from a tile's middle, through the tiles' corners, stays drawn from the graph when crossed", () => {
    // Its staircase turns at the tiles' corners, which a road cut where another crosses it may turn the other way at
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, { from: [88, 88], to: [408, 408] });
    draw(core, strokes, { from: [100.25, 300.5], to: [400.5, 120.25] });
    draw(core, strokes, { from: [200.5, 30.25], to: [330.25, 600.5] });
    draw(core, strokes, { from: [600, 88], to: [440, 248] });
    draw(core, strokes, { from: [430.5, 100.25], c1: [520.5, 260.75], c2: [600.25, 160.5], to: [700.5, 300.25] });
    expectAllWhereDrawn(core, strokes);
    expectAllWhereDrawn(saveAndOpen(core), strokes);
  });

  test("a road drawn past another's end within a metre joins it there, laid on the tiles it bends over", () => {
    const core = city(), strokes: Stroke[] = [];
    const first = draw(core, strokes, { from: [489.617, 293.603], to: [533.709, 365.661] });
    const out = core.apply({ type: "road", tool: "road", from: [147.841, 421.359], to: [839.519, 164.859], stroke: 9 });
    expect(out).toEqual({ accepted: true, toolResult: 0 });
    // ... a T at the first road's end, which stays where it was drawn, and both drawn from the graph, saved and opened
    const graph = graphOf(core), end = graph.nodeNear([489.617, 293.603], 0.01)!;
    expect(graph.segmentsAt(end.id)).toHaveLength(3);
    expectWhereDrawn(core, first);
    for (const c of [core, saveAndOpen(core)]) {
      const runs = graphLines(graphOf(c), lineMap(c), false).runs;
      expect(new Set(runs.map((run) => run.piece)).size).toBe(2);
    }
  });

  test("a railway across them leaves them as drawn", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    draw(core, strokes, TWICE);
    draw(core, strokes, RAILWAY, "rail");
    expectAllWhereDrawn(core, strokes);
  });

  test("undone, the roads drawn over it give it back as one segment of just its shape", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    const json = JSON.stringify(graphOf(core).toJSON());
    draw(core, strokes, ACROSS);
    draw(core, strokes, TWICE);
    expect(graphOf(core).segments.size).toBeGreaterThan(6);
    core.apply({ type: "undo" });
    core.apply({ type: "undo" });
    expect(JSON.stringify(graphOf(core).toJSON())).toBe(json);
    expectAllWhereDrawn(core, strokes.slice(0, 2));
  });

  test("saved and opened, every road and railway is where it was drawn, to the millimetre, and is drawn the same", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    draw(core, strokes, { from: SLANT.to, to: [930.5, 520.2] });
    draw(core, strokes, ACROSS);
    draw(core, strokes, TWICE);
    draw(core, strokes, RAILWAY, "rail");
    const again = saveAndOpen(core);
    expect(JSON.stringify(graphOf(again).toJSON())).toBe(JSON.stringify(graphOf(core).toJSON()));
    expect(JSON.stringify(graphOf(again, true).toJSON())).toBe(JSON.stringify(graphOf(core, true).toJSON()));
    expectAllWhereDrawn(again, strokes);
    // ... drawn by the 3D view just as before, point for point
    const view = (c: CityCore, rail: boolean) => {
      const map = lineMap(c), lines = graphLines(graphOf(c, rail), map, rail);
      return JSON.stringify({ runs: lines.runs, joined: drawnRoads(map, lines, rail).lines.map((l) => l.points) });
    };
    expect(view(again, false)).toBe(view(core, false));
    expect(view(again, true)).toBe(view(core, true));
    // ... and drawn on from, both go on the same
    const more = { type: "road" as const, tool: "road" as const, from: along(SLANT, 0.5), to: [500.5, 40.25] as P, stroke: 99 };
    core.apply(more);
    again.apply(more);
    expect(JSON.stringify(graphOf(again).toJSON())).toBe(JSON.stringify(graphOf(core).toJSON()));
    expectAllWhereDrawn(again, strokes);
  });

  test("roads drawn by an unsteady hand, each click landing as the tool lands it, stay where they landed, saved and opened", () => {
    // Clicks 5 to 20 pixels off where they are meant (docs/design/LOOK_BOOK.md), a 16 m tile 32 pixels across
    const MPP = 0.5, SPACING = 7 * 16;
    let state = 5;
    const next = (): number => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const shaky = (q: P, maxPx = 20): P => {
      const angle = next() * Math.PI * 2, px = 5 + next() * (maxPx - 5);
      return [q[0] + Math.cos(angle) * px * MPP, q[1] + Math.sin(angle) * px * MPP];
    };
    const core = city(), strokes: Stroke[] = [];
    const LEVEL: Drawn = { from: [40.5, 560.25], to: [920.75, 600.5] };
    draw(core, strokes, SLANT);
    draw(core, strokes, LEVEL);
    const slant = asDrawn(SLANT), level = asDrawn(LEVEL);
    // Square off the slant either side, from it to the other road, and from open land onto it
    const across: P = [-0.434, 0.901];
    const meant: Array<[P | null, P, Drawn | null]> = [
      [along(SLANT, 0.15), [along(SLANT, 0.15)[0] + across[0] * 130, along(SLANT, 0.15)[1] + across[1] * 130], null],
      [along(SLANT, 0.45), [along(SLANT, 0.45)[0] - across[0] * 150, along(SLANT, 0.45)[1] - across[1] * 150], null],
      [along(SLANT, 0.7), along(LEVEL, 0.52), LEVEL],
      [null, along(SLANT, 0.88), SLANT],
    ];
    for (const [onRoad, end, endRoad] of meant) {
      // A: meant on the slant, it lands on it; meant in open land, where the mouse is or on a guideline
      const pa = shaky(onRoad ?? [300.5, 470.25]), a = snapStart(pa, MPP, snapNet(core), SPACING);
      if (onRoad) {
        expect(["node", "end", "mark", "road"]).toContain(a?.kind);
        expect(slant.off(a!.point)).toBeLessThan(0.002);
      }
      const from = a ? a.point : pa;
      // B: meant on a road a few pixels off it, it lands on it; meant in open land, within a few metres of the mouse
      const pb = shaky(end, endRoad ? 10 : 20), b = snapNext(pb, MPP, snapNet(core), from, a ? a.way : null, 7);
      if (endRoad) {
        expect(b?.kind).toBe("road");
        expect((endRoad === SLANT ? slant : level).off(b!.point)).toBeLessThan(0.002);
      } else {
        expect(Math.hypot((b ? b.point : pb)[0] - pb[0], (b ? b.point : pb)[1] - pb[1])).toBeLessThanOrEqual(WAY_MAX_M);
      }
      draw(core, strokes, { from, to: b ? b.point : pb });
    }
    expectAllWhereDrawn(core, strokes);
    const again = saveAndOpen(core);
    expect(JSON.stringify(graphOf(again).toJSON())).toBe(JSON.stringify(graphOf(core).toJSON()));
    expectAllWhereDrawn(again, strokes);
  });

  test("a year of the city going on leaves them as drawn", () => {
    const core = city(), strokes: Stroke[] = [];
    draw(core, strokes, SLANT);
    draw(core, strokes, CURVE);
    draw(core, strokes, ACROSS);
    draw(core, strokes, TWICE);
    core.run(STEPS_PER_YEAR);
    expectAllWhereDrawn(core, strokes);
  });
});
