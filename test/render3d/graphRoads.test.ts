/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads as drawn, drawn by the 3D view exactly from the map's road graph (src/roads/graphLines.ts,
// src/render3d/city/roadCurves.ts; docs/METRE_DRAWING_PLAN.md 1.4): where they were drawn to the metre, their junctions
// at the graph's nodes, and joined to the roads that are only tiles.

import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import { RoadBuilder } from '../../src/render3d/city/roadBuild.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { realUnits, type Point } from '../../src/roadGeometry.js';
import { graphLines } from '../../src/roads/graphLines.js';
import type { RoadGraph } from '../../src/roads/roadGraph.js';

const flat = { sample: () => 0, sampleTile: () => 0, inside: () => true } as unknown as CityHeightField;
/** World units a metre on a 16 m city map */
const U = 10 / 16;

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  // Railways and the rest without the ruler's house first
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** The 3D view's copy of the city's map */
function snapshotOf(core: CityCore): TileSnapshot {
  const map = core.map as any, snapshot = new TileSnapshot(map.width, map.height);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) snapshot.values[y * map.width + x] = map.getTileValue(x, y);
  snapshot.source = map;
  snapshot.realUnits = realUnits(16);
  snapshot.curves = true;
  return snapshot;
}

const near = (p: Point, q: Point, by = 0.01): boolean => Math.hypot(p[0] - q[0], p[1] - q[1]) <= by;
/** The lines drawn with an end at p */
const endingAt = (curves: RoadCurves, p: Point): number =>
  curves.drawnLines.filter((l) => !l.rail && (near(l.points[0], p) || near(l.points[l.points.length - 1], p))).length;

describe('roads as drawn in 3D', () => {
  test('a road drawn in metres is drawn from where it was drawn to where it was drawn, not from its tiles', () => {
    const core = city();
    // Ends a few metres off the tiles' middles, at a slant no row of tiles follows
    core.apply({ type: 'road', tool: 'road', from: [3, 170], to: [701, 431], stroke: 1 });
    const curves = new RoadCurves(snapshotOf(core), flat);
    const roads = curves.drawnLines.filter((l) => !l.rail);
    expect(roads).toHaveLength(1);
    const line = roads[0].points;
    expect(near(line[0], [3 * U, 170 * U])).toBe(true);
    expect(near(line[line.length - 1], [701 * U, 431 * U])).toBe(true);
    // ... every point of it on the straight line drawn
    const [ax, az] = [3 * U, 170 * U], [bx, bz] = [701 * U, 431 * U], length = Math.hypot(bx - ax, bz - az);
    for (const [x, z] of line) expect(Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / length).toBeLessThan(1e-6);
    curves.dispose();
  });

  test('a curve keeps its drawn shape, and two roads crossing meet in one junction at their node', () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [40, 600], to: [880, 40], c1: [300, 0], c2: [600, 640], stroke: 1 });
    core.apply({ type: 'road', tool: 'road', from: [8, 312], to: [904, 312], stroke: 2 });
    const graph = (core.map as any).roadGraph as RoadGraph;
    // Crossing splits both: the graph's node where they cross, three ways or more
    const crossings = [...graph.nodes.values()].filter((n) => graph.segmentsAt(n.id).length >= 4);
    expect(crossings.length).toBeGreaterThan(0);
    const curves = new RoadCurves(snapshotOf(core), flat);
    // Each road is one line through its crossings (they run on through them)
    expect(curves.drawnLines.filter((l) => !l.rail)).toHaveLength(2);
    const curve = curves.drawnLines.find((l) => near(l.points[0], [40 * U, 600 * U]) || near(l.points[0], [880 * U, 40 * U]))!;
    expect(curve).toBeDefined();
    // ... its points on the Bezier drawn (its middle at t = 0.5)
    const mid: Point = [(40 + 3 * 300 + 3 * 600 + 880) / 8 * U, (600 + 0 + 3 * 640 + 40) / 8 * U];
    expect(curve.points.some((p) => near(p, mid, 1.6 * U))).toBe(true);
    // ... and a junction patch at each crossing node
    const build = new RoadBuilder().build((curves as any).roadMap(), flat as any);
    for (const node of crossings) {
      const at: Point = [node.x * U, node.z * U];
      const index = build.pieces.keys.findIndex((key, n) => key[0] === 'J' &&
        build.pieces.bounds[n * 4] <= at[0] && build.pieces.bounds[n * 4 + 1] >= at[0] &&
        build.pieces.bounds[n * 4 + 2] <= at[1] && build.pieces.bounds[n * 4 + 3] >= at[1]);
      expect(index).toBeGreaterThanOrEqual(0);
    }
    curves.dispose();
  });

  test('a road drawn from a road of tiles meets it in a junction, the tile road running on through', () => {
    const core = city();
    // A road laid tile by tile along row 10 (the old way), then one drawn north from the middle of its tile 20
    for (let x = 5; x <= 40; x++) core.apply({ type: 'tool', tool: 'road', x, y: 10 });
    core.apply({ type: 'road', tool: 'road', from: [20 * 16 + 8, 10 * 16 + 8], to: [20 * 16 + 8, 2 * 16 + 8], stroke: 1 });
    const graph = (core.map as any).roadGraph as RoadGraph;
    expect(graph.segments.size).toBe(1);
    const curves = new RoadCurves(snapshotOf(core), flat);
    const roads = curves.drawnLines.filter((l) => !l.rail);
    // The tile road is one line (not cut where the new road leaves it), the new road another
    expect(roads).toHaveLength(2);
    const old = roads.find((l) => l.points.some(([x]) => x < 10 * 10))!;
    expect(old.points[0][0]).toBeLessThan(6 * 10);
    expect(old.points[old.points.length - 1][0]).toBeGreaterThan(40 * 10);
    // ... and they meet in a junction: the new road's end lies on the old road's line
    const build = new RoadBuilder().build((curves as any).roadMap(), flat as any);
    expect(build.pieces.keys.some((key) => key[0] === 'J')).toBe(true);
    curves.dispose();
  });

  test('a road of tiles ending at a road as drawn meets it in a junction', () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [8, 168], to: [904, 168], stroke: 1 });
    // A road laid tile by tile down column 30 from row 2, its last tile beside the drawn road's tile in row 10
    for (let y = 2; y <= 9; y++) core.apply({ type: 'tool', tool: 'road', x: 30, y });
    const curves = new RoadCurves(snapshotOf(core), flat);
    const side = curves.drawnLines.find((l) => !l.rail && l.points.every(([x]) => Math.abs(x - 305) < 1))!;
    expect(side).toBeDefined();
    // ... run on to the drawn road's middle line, z 168 m
    const end = side.points[0][1] > side.points[side.points.length - 1][1] ? side.points[0] : side.points[side.points.length - 1];
    expect(end[1]).toBeCloseTo(168 * U, 1);
    const build = new RoadBuilder().build((curves as any).roadMap(), flat as any);
    expect(build.pieces.keys.some((key) => key[0] === 'J')).toBe(true);
    curves.dispose();
  });

  test('a drawn road bulldozed in part is drawn from its tiles again, and a railway is kept in a graph of its own', () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: 'road', tool: 'rail', from: [8, 488], to: [904, 488], stroke: 2 });
    const map = core.map as any;
    expect(map.roadGraph.segments.size).toBe(1);
    expect(map.railGraph.segments.size).toBe(1);
    const units = { width: 60, height: 40, tileSizeM: 16, value: (i: number) => map.getTileValue(i % 60, Math.floor(i / 60)),
      piece: (i: number) => map.roadPieces[i] };
    expect(graphLines(map.roadGraph, units, false).runs).toHaveLength(1);
    expect(graphLines(map.railGraph, units, true).runs).toHaveLength(1);
    core.apply({ type: 'tool', tool: 'bulldozer', x: 30, y: 10 });
    expect(graphLines(map.roadGraph, units, false).runs).toHaveLength(0);
    const curves = new RoadCurves(snapshotOf(core), flat);
    // ... its two halves drawn from their tiles, the railway from its graph
    expect(curves.drawnLines.filter((l) => !l.rail)).toHaveLength(2);
    const rails = curves.drawnLines.filter((l) => l.rail);
    expect(rails).toHaveLength(1);
    expect(near(rails[0].points[0], [8 * U, 488 * U]) || near(rails[0].points[rails[0].points.length - 1], [8 * U, 488 * U])).toBe(true);
    curves.dispose();
  });

  test('a road drawn to end just beside another, their tiles touching, runs on to meet it', () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [8, 168], to: [904, 168], stroke: 1 });
    // ... ending 8 m short of its middle line
    core.apply({ type: 'road', tool: 'road', from: [400, 40], to: [400, 160], stroke: 2 });
    const curves = new RoadCurves(snapshotOf(core), flat);
    const side = curves.drawnLines.find((l) => !l.rail && l.points.every(([x]) => Math.abs(x - 400 * U) < 0.01))!;
    const end = side.points[0][1] > side.points[side.points.length - 1][1] ? side.points[0] : side.points[side.points.length - 1];
    expect(end[1]).toBeCloseTo(168 * U, 3);
    curves.dispose();
  });

  test("a drawn road upgraded is drawn at its tiles' level, a part upgraded as a part of its own", () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [8, 168], to: [904, 168], stroke: 1 });
    const map = core.map as any;
    // The upgrade tool raises its tiles 20 to 39 (owner, 13 Oct 2026: a road one level up for the difference)
    for (let x = 20; x < 40; x++) expect(core.apply({ type: 'tool', tool: 'road_upgrade', x, y: 10 }).accepted).toBe(true);
    expect(map.roadLevels[10 * 60 + 25]).toBeGreaterThan(1);
    const lines = graphLines(map.roadGraph, { width: 60, height: 40, tileSizeM: 16,
      value: (i: number) => map.getTileValue(i % 60, Math.floor(i / 60)), piece: (i: number) => map.roadPieces[i],
      level: (i: number) => map.roadLevels[i] }, false);
    expect(lines.runs.map((r) => r.level)).toEqual([1, map.roadLevels[10 * 60 + 25], 1]);
    // ... cut at the edges of tiles 20 and 39, the road whole from end to end
    expect(lines.runs[1].points[0][0]).toBeCloseTo(200, 1);
    expect(lines.runs[1].points[lines.runs[1].points.length - 1][0]).toBeCloseTo(400, 1);
    const curves = new RoadCurves(snapshotOf(core), flat);
    const levels = curves.drawnLines.filter((l) => !l.rail).map((l) => l.level).sort();
    expect(levels).toEqual([1, 1, map.roadLevels[10 * 60 + 25]]);
    curves.dispose();
  });

  test('a road drawn end to end from another meets it without a gap at their node', () => {
    const core = city();
    core.apply({ type: 'road', tool: 'road', from: [8, 168], to: [400, 168], stroke: 1 });
    core.apply({ type: 'road', tool: 'road', from: [400, 168], to: [700, 400], stroke: 2 });
    const curves = new RoadCurves(snapshotOf(core), flat);
    expect(endingAt(curves, [400 * U, 168 * U])).toBe(2);
    curves.dispose();
  });
});
