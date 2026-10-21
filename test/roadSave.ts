/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads as drawn kept with the city (docs/METRE_DRAWING_PLAN.md 1.6): the road and rail graphs saved and opened
// again to the centimetre, a stroke bulldozed in part left to its tiles, and a save from before (version 4) given its
// graphs once from the lines its roads were drawn as.

import { reframeSave } from "../src/cityFrame";
import { CityCore } from "../src/core/cityCore";
import { writeCityLayers } from "../src/core/cityLayers";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { Storage } from "../src/storage.js";

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** A city's save as the game keeps it, and the city opened from it */
function saveAndOpen(core: CityCore) {
  const saved = JSON.parse(JSON.stringify({ ...core.save(), width: core.map.width, height: core.map.height,
    version: (Storage as any).CURRENT_VERSION }));
  return { saved, again: new CityCore({ map: new (GameMap as any)(saved.width, saved.height), saved }) };
}

describe("the roads as drawn in a save", () => {
  test("the road and rail graphs open again just as they were", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [3.25, 170.5], to: [701.75, 431.25], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [40, 600], to: [880, 40], c1: [300, 0], c2: [600, 640], stroke: 2 });
    core.apply({ type: "road", tool: "rail", from: [952, 8], to: [952, 630], stroke: 3 });
    const { saved, again } = saveAndOpen(core);
    expect(saved.roads.segments.length).toBeGreaterThan(2);
    expect(JSON.stringify(again.map.roadGraph.toJSON())).toBe(JSON.stringify(core.map.roadGraph.toJSON()));
    expect(JSON.stringify(again.map.railGraph.toJSON())).toBe(JSON.stringify(core.map.railGraph.toJSON()));
    // ... and a road drawn after opening joins them as it would have before
    const more = { type: "road" as const, tool: "road" as const, from: [312, 8] as [number, number], to: [312, 600] as [number, number], stroke: 9 };
    core.apply(more);
    again.apply(more);
    expect(JSON.stringify(again.map.roadGraph.toJSON())).toBe(JSON.stringify(core.map.roadGraph.toJSON()));
  });

  test("a stroke bulldozed in part is cut there (src/roads/roadCut.ts): both its parts are kept as drawn", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [8, 488], to: [904, 488], stroke: 2 });
    core.apply({ type: "tool", tool: "bulldozer", x: 30, y: 10 });
    const { saved, again } = saveAndOpen(core);
    expect(saved.roads.segments).toHaveLength(3);
    expect([...again.map.roadGraph.segments.values()].map((s: any) => s.piece).sort()).toEqual([1, 1, 2]);
    expect(JSON.stringify(again.map.roadGraph.toJSON())).toBe(JSON.stringify((core.map as any).roadGraph.toJSON()));
  });

  test("a stroke that lost a tile some other way (a tornado between steps) is cut there when saved: both parts kept", () => {
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [8, 488], to: [904, 488], stroke: 2 });
    core.map.setTile(30, 10, 0, 0);
    const { saved, again } = saveAndOpen(core);
    expect(saved.roads.segments).toHaveLength(3);
    expect([...again.map.roadGraph.segments.values()].map((s: any) => s.piece).sort()).toEqual([1, 1, 2]);
    expect(JSON.stringify(again.map.roadGraph.toJSON())).toBe(JSON.stringify((core.map as any).roadGraph.toJSON()));
    expect(Object.keys(saved.roadPaths).sort()).toEqual(["1", "2"]);
  });

  test("a stroke whose tile is lost while the save is written with no step between is still saved as its tiles alone", () => {
    // (the cut is the core's, before a save; a save written straight from the layers, as the district frame does, keeps
    // only whole strokes)
    const core = city();
    core.apply({ type: "road", tool: "road", from: [8, 168], to: [904, 168], stroke: 1 });
    core.apply({ type: "road", tool: "road", from: [8, 488], to: [904, 488], stroke: 2 });
    core.map.setTile(30, 10, 0, 0);
    const layers = writeCityLayers(core.map);
    expect((layers.roads as any).segments).toHaveLength(1);
  });

  test("a save from before the roads were kept in metres is given its graphs once, from the lines its roads were drawn as", () => {
    const core = city();
    // Drawn the old way, a command a tile with the line it was drawn as: a straight road and a curve
    for (let x = 2; x <= 40; x++) core.apply({ type: "tool", tool: "road", x, y: 10, stroke: 1, shape: "straight",
      controls: [[2, 10], [40, 10]] } as any);
    const curve: Array<[number, number]> = [[5, 30], [20, 14], [45, 30]];
    const tiles: Array<[number, number]> = [];
    for (let k = 0; k <= 200; k++) {
      const t = k / 200, u = 1 - t;
      const x = Math.round(u * u * curve[0][0] + 2 * u * t * curve[1][0] + t * t * curve[2][0]);
      const y = Math.round(u * u * curve[0][1] + 2 * u * t * curve[1][1] + t * t * curve[2][1]);
      const last = tiles[tiles.length - 1];
      if (last && last[0] === x && last[1] === y) continue;
      if (last && last[0] !== x && last[1] !== y) tiles.push([x, last[1]]);
      tiles.push([x, y]);
    }
    for (const [x, y] of tiles) core.apply({ type: "tool", tool: "road", x, y, stroke: 2, shape: "curve", controls: curve } as any);
    const old = JSON.parse(JSON.stringify({ ...core.save(), width: 60, height: 40, version: 4 }));
    delete old.roads;
    (Storage as any).transitionOldSave(old);
    expect(old.roads.segments.length).toBe(2);
    const again = new CityCore({ map: new (GameMap as any)(60, 40), saved: old });
    const graph = again.map.roadGraph;
    const ends = [...graph.segments.values()].map((s: any) => [[graph.node(s.a).x, graph.node(s.a).z], [graph.node(s.b).x, graph.node(s.b).z], s.shape, s.piece]);
    expect(ends).toContainEqual([[2.5 * 16, 10.5 * 16], [40.5 * 16, 10.5 * 16], "line", 1]);
    expect(ends).toContainEqual([[5.5 * 16, 30.5 * 16], [45.5 * 16, 30.5 * 16], "curve", 2]);
    // Its tiles as they were
    for (let x = 2; x <= 40; x++) expect(again.map.getTileValue(x, 10)).toBe(core.map.getTileValue(x, 10));
  });

  test("a save from before with no drawn lines opens with no graphs", () => {
    const core = city();
    for (let x = 2; x <= 40; x++) core.apply({ type: "tool", tool: "road", x, y: 10 });
    const old = JSON.parse(JSON.stringify({ ...core.save(), width: 60, height: 40, version: 4 }));
    (Storage as any).transitionOldSave(old);
    expect(old.roads).toBeUndefined();
    const again = new CityCore({ map: new (GameMap as any)(60, 40), saved: old });
    expect(again.map.roadGraph).toBeNull();
  });
});

describe("the roads as drawn in a frame that grows", () => {
  test("a save moved to a bigger frame of its district keeps its roads as drawn where they were on the district", () => {
    const from = { x: 64, y: 32, width: 96, height: 96 }, to = { x: 32, y: 0, width: 160, height: 160 };
    const dx = from.x - to.x, dy = from.y - to.y;
    const map = (MapGenerator as any).fromPresetCells(96, 96, new Uint8Array(96 * 96));
    map.tileSizeM = 16;
    const core = new CityCore({ map, seed: 5 });
    core.simulation.budget.setFunds(500000);
    expect(core.apply({ type: "road", tool: "road", from: [20 * 16 + 3, 44 * 16 + 5], to: [70 * 16 + 9, 48 * 16 + 1], stroke: 2 })
      .toolResult).toBe(0);
    // ... and a canal dug in metres
    (core.map as any).needsRulerHouse = false;
    expect(core.apply({ type: "road", tool: "canal" as any, from: [20 * 16 + 3, 60 * 16 + 5], to: [70 * 16 + 9, 60 * 16 + 5],
      stroke: 3 }).toolResult).toBe(0);
    const save = JSON.parse(JSON.stringify(core.save()));
    const fresh = (MapGenerator as any).fromPresetCells(160, 160, new Uint8Array(160 * 160)), freshData: any = {};
    fresh.save(freshData);
    const moved = reframeSave(save, from, to, { map: freshData.map, inside: null, national: null, roadLevels: null }, 32);
    const again = new CityCore({ map: new (GameMap as any)(160, 160), saved: moved });
    const ends = [...again.map.roadGraph.nodes.values()].map((n: any) => [n.x, n.z]);
    expect(ends).toEqual([[(20 + dx) * 16 + 3, (44 + dy) * 16 + 5], [(70 + dx) * 16 + 9, (48 + dy) * 16 + 1]]);
    expect(again.map.getTileValue(20 + dx, 44 + dy)).toBe(core.map.getTileValue(20, 44));
    expect([...again.map.canalGraph.nodes.values()].map((n: any) => [n.x, n.z]))
      .toEqual([[(20 + dx) * 16 + 3, (60 + dy) * 16 + 5], [(70 + dx) * 16 + 9, (60 + dy) * 16 + 5]]);
  });
});
