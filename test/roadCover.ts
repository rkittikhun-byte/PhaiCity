/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every road in the road graph (src/roads/roadCover.ts, docs/NO_GRID_PLAN.md 0.1): roads that are only tiles (a map's
// own, one laid tile by tile) are put into the graph, joined to the drawn roads they meet, the same every time, kept by
// a save and cut where their tiles go.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { firstFrame } from "../src/cityFrame";
import { DISTRICT_BLOCK, framePreset, isDistrictMap } from "../src/geo/districtFrame";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { coverCityRoads, coveredTiles } from "../src/roads/roadCover";
import type { RoadGraph } from "../src/roads/roadGraph";
import { isAnyRail, isAnyRoad } from "../src/roadTiles";
import { Storage } from "../src/storage.js";

/** A bare 16 m city map, 60 × 40 tiles */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

function saveAndOpen(core: CityCore) {
  const saved = JSON.parse(JSON.stringify({ ...core.save(), width: core.map.width, height: core.map.height,
    version: (Storage as any).CURRENT_VERSION }));
  return new CityCore({ sandbox: true, map: new (GameMap as any)(saved.width, saved.height), saved });
}

const graphOf = (core: CityCore, rail = false): RoadGraph => (core.map as any)[rail ? "railGraph" : "roadGraph"];

/** Roads laid tile by tile, as an old command log or a map's own roads are */
function layTiles(core: CityCore, tiles: Array<[number, number]>, tool = "road") {
  for (const [x, y] of tiles) expect(core.apply({ type: "tool", tool: tool as any, x, y }).accepted).toBe(true);
}
const row = (y: number, x0: number, x1: number): Array<[number, number]> => Array.from({ length: x1 - x0 + 1 }, (_, k) => [x0 + k, y]);
const column = (x: number, y0: number, y1: number): Array<[number, number]> => Array.from({ length: y1 - y0 + 1 }, (_, k) => [x, y0 + k]);

/** The map as roadCover reads it */
function coverMap(core: CityCore) {
  const map = core.map as any, width = map.width;
  return { width, height: map.height, tileSizeM: 16, value: (i: number) => map.getTileValue(i % width, Math.floor(i / width)) };
}

/** The road (or railway) tiles joined side to side, and the graph's segments joined at nodes: how many pieces each is
 * in, and whether every tile lies near a segment of the graph's piece its own piece is matched to, one to one */
function pieces(map: { width: number; height: number; tileSizeM: number; value(i: number): number }, graph: RoadGraph, rail: boolean) {
  const { width: W, height: H } = map, kind = rail ? isAnyRail : isAnyRoad;
  const tileOf = new Int32Array(W * H).fill(-1);
  let tilePieces = 0;
  for (let i = 0; i < W * H; i++) {
    if (tileOf[i] >= 0 || !kind(map.value(i))) continue;
    const queue = [i];
    tileOf[i] = tilePieces;
    while (queue.length) {
      const t = queue.pop()!, x = t % W, y = (t - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && tileOf[j] < 0 && kind(map.value(j))) { tileOf[j] = tilePieces; queue.push(j); }
      }
    }
    tilePieces++;
  }
  const nodeOf = new Map<number, number>();
  let graphPieces = 0;
  for (const id of graph.nodes.keys()) {
    if (nodeOf.has(id)) continue;
    const queue = [id];
    nodeOf.set(id, graphPieces);
    while (queue.length) {
      for (const s of graph.segmentsAt(queue.pop()!)) {
        const seg = graph.segment(s);
        for (const n of [seg.a, seg.b]) if (!nodeOf.has(n)) { nodeOf.set(n, graphPieces); queue.push(n); }
      }
    }
    graphPieces++;
  }
  const match = new Map<number, Set<number>>(), back = new Map<number, Set<number>>();
  for (let i = 0; i < W * H; i++) {
    if (tileOf[i] < 0) continue;
    const x = i % W, y = (i - x) / W, near = graph.nearest([(x + 0.5) * map.tileSizeM, (y + 0.5) * map.tileSizeM], map.tileSizeM);
    if (!near) continue;
    const g = nodeOf.get(graph.segment(near.segment).a)!;
    if (!match.has(tileOf[i])) match.set(tileOf[i], new Set());
    match.get(tileOf[i])!.add(g);
    if (!back.has(g)) back.set(g, new Set());
    back.get(g)!.add(tileOf[i]);
  }
  return { tilePieces, graphPieces, oneToOne: [...match.values()].every((s) => s.size === 1) && [...back.values()].every((s) => s.size === 1) };
}

describe("every road in the road graph", () => {
  test("roads laid tile by tile are put into the graph, joined as their tiles are, and nothing more is added", () => {
    const core = city();
    // A crossroads and a road off to the side, with a bend
    layTiles(core, [...row(20, 10, 40), ...column(25, 8, 32), ...column(40, 21, 30), ...row(30, 41, 50)]);
    const graph = graphOf(core), map = coverMap(core);
    expect(graph.segments.size).toBeGreaterThan(0);
    expect([...graph.segments.values()].every((s) => s.traced && s.piece === undefined)).toBe(true);
    // Every road tile is the graph's, and the graph is one piece, as the tiles are
    const covered = coveredTiles(graph, map, false);
    for (let i = 0; i < covered.length; i++) if (isAnyRoad(map.value(i))) expect(covered[i]).toBe(1);
    expect(pieces(map, graph, false)).toEqual({ tilePieces: 1, graphPieces: 1, oneToOne: true });
    // A crossing where the two roads cross, and the ends where the tiles end
    const crossing = graph.nodeNear([25.5 * 16, 20.5 * 16], 4)!;
    expect(graph.degree(crossing.id)).toBe(4);
    expect([...graph.nodes.keys()].filter((n) => graph.degree(n) === 1).map((n) => [graph.node(n).x / 16, graph.node(n).z / 16]))
      .toEqual([[10.5, 20.5], [25.5, 8.5], [25.5, 32.5], [50.5, 30.5]]);
    // ... and looking again adds nothing
    const before = JSON.stringify(graph.toJSON());
    expect(coverCityRoads(core.map, true)).toEqual({ roads: { added: 0, linked: 0 }, rails: { added: 0, linked: 0 } });
    expect(JSON.stringify(graph.toJSON())).toBe(before);
  });

  test("a road drawn onto one or stopping beside it meets it in the graph, and a save keeps it all", () => {
    const core = city();
    layTiles(core, row(20, 5, 50));
    const graph = graphOf(core);
    // A road drawn onto it at a slant ends on its line: a T of three segments
    expect(core.apply({ type: "road", tool: "road" as any, from: [200.5, 520.25], to: [300.25, 20.5 * 16], stroke: 1 }))
      .toEqual({ accepted: true, toolResult: 0 });
    const tee = graph.nodeNear([300.25, 20.5 * 16], 1)!;
    expect(graph.degree(tee.id)).toBe(3);
    // A road drawn from the north that stops 6 m short of it, its last tile beside the road's: joined by a short piece
    expect(core.apply({ type: "road", tool: "road" as any, from: [600.5, 40.25], to: [600.5, 20.5 * 16 - 6], stroke: 2 }))
      .toEqual({ accepted: true, toolResult: 0 });
    const end = graph.nodeNear([600.5, 20.5 * 16 - 6], 0.01)!;
    expect(graph.degree(end.id)).toBe(2);
    expect(pieces(coverMap(core), graph, false)).toEqual({ tilePieces: 1, graphPieces: 1, oneToOne: true });
    // Saved and opened, the very same graph, and nothing added to it
    const opened = saveAndOpen(core);
    expect(JSON.stringify(graphOf(opened).toJSON())).toBe(JSON.stringify(graph.toJSON()));
  });

  test("a tile bulldozed out of one cuts it there, and it is not put back", () => {
    const core = city();
    layTiles(core, row(20, 5, 50));
    const graph = graphOf(core);
    expect(pieces(coverMap(core), graph, false).graphPieces).toBe(1);
    layTiles(core, [[30, 20]], "bulldozer");
    core.run(1);
    expect(pieces(coverMap(core), graph, false)).toEqual({ tilePieces: 2, graphPieces: 2, oneToOne: true });
    expect(graph.nearest([30.5 * 16, 20.5 * 16], 7)).toBeNull();
  });

  test("the same commands make the same graph", () => {
    const build = () => {
      const core = city();
      layTiles(core, [...row(12, 3, 30), ...column(17, 4, 25)]);
      core.apply({ type: "road", tool: "road" as any, from: [100.5, 300.25], to: [500.25, 150.5], stroke: 1 });
      core.run(64);
      return JSON.stringify(graphOf(core).toJSON());
    };
    expect(build()).toBe(build());
  });

  test("Khon Kaen's start frame: every road and railway of the map is the graph's, joined as the tiles are", async () => {
    const whole = JSON.parse(fs.readFileSync("data/maps/district/TH-40-mueang-khon-kaen.json", "utf8"));
    const preset = isDistrictMap(whole) ? await framePreset(whole, firstFrame(whole, whole.town, DISTRICT_BLOCK)) : whole;
    const layer = (e?: string) => (e ? decodePresetLayer(e, preset.width, preset.height) : null);
    const transport = layer(preset.transport);
    const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
    Object.assign(map, { nationalTransport: transport, tileSizeM: preset.tileSizeM, roadLevels: layer(preset.roadLevels) });
    const core = new CityCore({ map, seed: 11 });
    const cover = coverMap(core);
    for (const rail of [false, true]) {
      const graph = graphOf(core, rail), covered = coveredTiles(graph, cover, rail), kind = rail ? isAnyRail : isAnyRoad;
      let tiles = 0;
      for (let i = 0; i < covered.length; i++) if (kind(cover.value(i))) { tiles++; expect(covered[i]).toBe(1); }
      expect(tiles).toBeGreaterThan(500);
      const p = pieces(cover, graph, rail);
      expect(p.oneToOne).toBe(true);
      expect(p.graphPieces).toBe(p.tilePieces);
      // The state's highways and railways are the state's in the graph too
      expect([...graph.segments.values()].filter((s) => s.national).length).toBeGreaterThan(graph.segments.size / 2);
    }
    expect(coverCityRoads(core.map, true)).toEqual({ roads: { added: 0, linked: 0 }, rails: { added: 0, linked: 0 } });
  }, 60000);
});
