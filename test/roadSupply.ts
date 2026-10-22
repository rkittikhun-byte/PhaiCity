/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Power and water along the roads (docs/NO_GRID_PLAN.md step 2, src/sim/roadSupply.ts, src/sim/cityUtilities.ts): on a
// real-scale city map each plant or works feeds the roads it meets, each building takes what its kind and size use, the
// nearest to a source by road first, and where the supply runs out the far ends go without; nothing passes from one
// plot to the next, and the east of the map is no longer the first to go dry.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { NOT_ENOUGH_POWER } from "../src/messages";
import { plotTile } from "../src/plots";
import { RoadGraph } from "../src/roads/roadGraph";
import { gapLinks, GAP_M, plotPower, PLOT_POWER } from "../src/sim/cityUtilities";
import { roadNet } from "../src/sim/roadNetwork";
import { ROAD_NONE, ROAD_SERVED, ROAD_SHORT, supplyAlongRoads, type SupplyNet } from "../src/sim/roadSupply";
import { BLBNCNBIT, POWERBIT } from "../src/tileFlags";

/** A net of roads in a row: node i at i * 100 m, segment i from node i to i + 1 */
function row(segments: number): SupplyNet {
  const nodes = segments + 1, offsets = new Int32Array(nodes + 1), wayTo: number[] = [], waySegment: number[] = [];
  for (let i = 0; i < nodes; i++) {
    if (i > 0) { wayTo.push(i - 1); waySegment.push(i - 1); }
    if (i < segments) { wayTo.push(i + 1); waySegment.push(i); }
    offsets[i + 1] = wayTo.length;
  }
  const segA = Int32Array.from({ length: segments }, (_, k) => k), segB = Int32Array.from({ length: segments }, (_, k) => k + 1);
  return { offsets, wayTo: Int32Array.from(wayTo), waySegment: Int32Array.from(waySegment), segA, segB,
    length: new Float64Array(segments).fill(100) };
}

describe("handing a supply out along the roads", () => {
  test("the nearest to the source by road first; past where it runs out, the users and the roads go without", () => {
    const net = row(4);
    // Users along the row, given in a jumbled order; a source at the west end gives 3
    const users = [3.5, 0.5, 2.5, 1.5].map((at) => ({ at: { k: Math.floor(at), t: at % 1 }, demand: 1 }));
    const out = supplyAlongRoads(net, [{ at: [{ k: 0, t: 0 }], amount: 3 }], users);
    expect(Array.from(out.served)).toEqual([0, 1, 1, 1]);
    expect(Array.from(out.distance)).toEqual([350, 50, 250, 150]);
    expect(out.short).toBe(true);
    expect(out.used).toBe(3);
    // The roads up to the one the supply ran out on are served; that one and those past it are short
    expect(Array.from(out.roads)).toEqual([ROAD_SERVED, ROAD_SERVED, ROAD_SERVED, ROAD_SHORT]);
    // A source in the middle serves both ways out from it
    const middle = supplyAlongRoads(net, [{ at: [{ k: 2, t: 0 }], amount: 2 }], users);
    expect(Array.from(middle.served)).toEqual([0, 0, 1, 1]);
  });

  test("a network with no source gets nothing, and a source on several networks joins them", () => {
    // Two rows of roads not joined: nodes 0-2 and 3-5
    const a = row(2), net: SupplyNet = {
      offsets: Int32Array.from([0, 1, 3, 4, 5, 7, 8]), wayTo: Int32Array.from([1, 0, 2, 1, 4, 3, 5, 4]),
      waySegment: Int32Array.from([0, 0, 1, 1, 2, 2, 3, 3]), segA: Int32Array.from([0, 1, 3, 4]), segB: Int32Array.from([1, 2, 4, 5]),
      length: new Float64Array(4).fill(100),
    };
    expect(a.segA.length).toBe(2);
    const users = [{ at: { k: 0, t: 0.5 }, demand: 1 }, { at: { k: 3, t: 0.5 }, demand: 1 }, { at: null, demand: 1 }];
    const one = supplyAlongRoads(net, [{ at: [{ k: 0, t: 0 }], amount: 10 }], users);
    expect(Array.from(one.served)).toEqual([1, 0, 0]);
    expect(Array.from(one.reached)).toEqual([1, 0, 0]);
    expect(Array.from(one.roads)).toEqual([ROAD_SERVED, ROAD_SERVED, ROAD_NONE, ROAD_NONE]);
    // ... a plant between the two rows feeds both
    const both = supplyAlongRoads(net, [{ at: [{ k: 1, t: 1 }, { k: 2, t: 0 }], amount: 10 }], users);
    expect(Array.from(both.served)).toEqual([1, 1, 0]);
    // ... and a short cable across a gap joins them as well, its length counted
    const linked = supplyAlongRoads(net, [{ at: [{ k: 0, t: 0 }], amount: 10 }], users,
      { a: Int32Array.from([2]), b: Int32Array.from([3]), length: Float64Array.from([16]) });
    expect(Array.from(linked.served)).toEqual([1, 1, 0]);
    // (to node 2, across the cable to node 3, along to node 4, then half way along its road)
    expect(linked.distance[1]).toBe(200 + 16 + 100 + 50);
  });

  test("a user that takes nothing is reached all the same, past where the supply ran out too", () => {
    const net = row(2);
    const out = supplyAlongRoads(net, [{ at: [{ k: 0, t: 0 }], amount: 1 }],
      [{ at: { k: 0, t: 0.5 }, demand: 2 }, { at: { k: 1, t: 0.5 }, demand: 0 }]);
    expect(Array.from(out.served)).toEqual([0, 1]);
    expect(out.used).toBe(0);
  });

  test("roads that nearly meet are joined by a short cable, those further apart are not", () => {
    for (const [apart, joined] of [[16, true], [GAP_M + 3, false]] as const) {
      const graph = new RoadGraph();
      graph.add({ from: [0, 100], to: [300, 100], level: 2 });
      // a street that stops short of the first, and another beside it
      graph.add({ from: [150, 100 + apart], to: [150, 400], level: 2 });
      const links = gapLinks(graph, roadNet(graph));
      expect(links.a.length > 0).toBe(joined);
      if (joined) expect(links.length[0]).toBeCloseTo(16 + 150, 5);
    }
  });

  test("a plot takes more power the bigger it grows, a factory more than a home", () => {
    expect(plotPower("residential", 0)).toBe(PLOT_POWER[0]);
    for (let level = 1; level <= 5; level++) expect(plotPower("residential", level)).toBeGreaterThan(plotPower("residential", level - 1));
    expect(plotPower("industrial", 3)).toBeGreaterThan(plotPower("residential", 3));
  });
});

/** A blank real-scale city, anything buildable at once */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(10000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** A road drawn in metres along a row of tiles, from tile x0 to x1 */
const road = (core: CityCore, y: number, x0: number, x1: number) =>
  core.apply({ type: "road", tool: "road" as any, from: [(x0 + 0.5) * 16, (y + 0.5) * 16], to: [(x1 + 0.5) * 16, (y + 0.5) * 16], stroke: 1 } as any);

/** Homes of a level on these tiles */
function homes(core: CityCore, tiles: Array<[number, number]>, level = 2): void {
  for (const [x, y] of tiles) core.map.setTile(x, y, plotTile("residential", level), BLBNCNBIT);
}

const powered = (core: CityCore, x: number, y: number): boolean => (core.map.getTileFlags(x, y) & POWERBIT) !== 0;

/** Runs the city until the power has been handed out and the next scan has given the tiles their power bits */
const settle = (core: CityCore) => core.run(16 * 12);

describe("power along the roads in a city", () => {
  test("a plant beside a road lights the plots along it; a plot on no road gets none from the lit plots beside it", () => {
    const core = city();
    expect(road(core, 10, 2, 50).accepted).toBe(true);
    expect(core.apply({ type: "tool", tool: "coal", x: 4, y: 8 } as any).accepted).toBe(true);
    const along: Array<[number, number]> = [];
    for (let x = 10; x <= 40; x++) along.push([x, 11]);
    homes(core, along);
    // A row of homes six tiles back from the road, touching a home that touches the road's plots... none within reach
    for (let y = 12; y <= 16; y++) homes(core, [[20, y]]);
    homes(core, [[20, 18]]);
    settle(core);
    expect(along.every(([x, y]) => powered(core, x, y))).toBe(true);
    // (row 18 lies 7.5 tiles off the road's middle, out of every plot's reach: 48 m)
    expect(powered(core, 20, 18)).toBe(false);
    const roadPower = (core.map as any).roadPower;
    expect(roadPower.state.some((s: number) => s === ROAD_SERVED)).toBe(true);
  });

  test("short of power, the plots nearest the plant by road keep it and the far end goes dark, with the news told", () => {
    const core = city();
    road(core, 10, 2, 58);
    core.apply({ type: "tool", tool: "coal", x: 4, y: 8 } as any);
    const along: Array<[number, number]> = [];
    for (let x = 8; x <= 57; x++) along.push([x, 11], [x, 9]);
    homes(core, along, 5);
    // Lignite gives 700 a month as built (src/powerPlants.ts); set the plant's output so it lights only some
    core.simulation._powerManager.outputFactor = 40 / 700;
    let told = 0;
    core.simulation._powerManager.addEventListener(NOT_ENOUGH_POWER, () => { told++; });
    settle(core);
    const lit = along.filter(([x, y]) => powered(core, x, y)).map(([x]) => x);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(along.length);
    // ... every lit plot nearer the plant than every dark one
    const dark = along.filter(([x, y]) => !powered(core, x, y)).map(([x]) => x);
    expect(Math.max(...lit)).toBeLessThanOrEqual(Math.min(...dark));
    expect(told).toBeGreaterThan(0);
    expect(core.simulation._powerManager.load).toBe(1);
  });

  test("a road network with no plant is dark until a road joins it, or ends within a short cable's reach of a lit one", () => {
    const core = city();
    road(core, 10, 2, 30);
    core.apply({ type: "tool", tool: "coal", x: 4, y: 8 } as any);
    // Another road five tiles south, not joined
    road(core, 20, 2, 30);
    const north: Array<[number, number]> = [], south: Array<[number, number]> = [];
    for (let x = 10; x <= 28; x++) { north.push([x, 11]); south.push([x, 21]); }
    homes(core, north);
    homes(core, south);
    settle(core);
    expect(north.every(([x, y]) => powered(core, x, y))).toBe(true);
    expect(south.some(([x, y]) => powered(core, x, y))).toBe(false);
    // A road from the south one that stops a tile short of the north one: the two join (the road graph links a road's
    // end on the tile beside another road, src/roads/roadCover.ts, and a short cable crosses any gap left)
    core.apply({ type: "road", tool: "road" as any, from: [29.5 * 16, 20.5 * 16], to: [29.5 * 16, 11.5 * 16], stroke: 2 } as any);
    settle(core);
    expect(south.every(([x, y]) => powered(core, x, y))).toBe(true);
  });

  test("the same city twice is lit the same", () => {
    const run = () => {
      const core = city();
      road(core, 10, 2, 58);
      core.apply({ type: "tool", tool: "coal", x: 4, y: 8 } as any);
      const along: Array<[number, number]> = [];
      for (let x = 8; x <= 57; x++) along.push([x, 11], [x, 9]);
      homes(core, along, 4);
      core.simulation._powerManager.outputFactor = 30 / 700;
      settle(core);
      return along.map(([x, y]) => (powered(core, x, y) ? 1 : 0)).join("");
    };
    expect(run()).toBe(run());
  });
});

describe("water along the roads in a city", () => {
  test("short of water, the plots nearest the works by road get it, whichever side of the map they are on", () => {
    const core = city();
    road(core, 10, 1, 58);
    core.apply({ type: "tool", tool: "coal", x: 4, y: 8 } as any);
    // The works at the east end: the scan reaches the west first, which the old way watered first
    expect(core.apply({ type: "tool", tool: "waterworks", x: 55, y: 8 } as any).accepted).toBe(true);
    const along: Array<[number, number]> = [];
    for (let x = 4; x <= 52; x++) along.push([x, 11], [x, 9]);
    homes(core, along.filter(([x, y]) => y === 11 || x > 6), 5);
    const water = core.simulation._waterManager;
    settle(core);
    const zoneWater = (x: number, y: number) => water.view.zoneWater(x, y);
    // As much as one works gives with its ground; find which plots have it
    const homesAlong = along.filter(([x, y]) => y === 11 || x > 6);
    const wet = homesAlong.filter(([x, y]) => zoneWater(x, y) === 1).map(([x]) => x);
    const dry = homesAlong.filter(([x, y]) => zoneWater(x, y) !== 1).map(([x]) => x);
    expect(dry.length).toBeGreaterThan(0);
    expect(wet.length).toBeGreaterThan(0);
    expect(Math.min(...wet)).toBeGreaterThan(Math.max(...dry));
    // The roads that carry it are marked for the water layer
    expect(water.view.hasWater(50, 10)).toBe(true);
  });
});

describe("an older Khon Kaen city keeps its power and water along its roads", () => {
  test.each([["version 5", "test/fixtures/khonKaen-v5.json"], ["version 4", "test/fixtures/khonKaen-v4.json"]])(
    "saved as %s, every plot with a road keeps its power a month on", (_, file) => {
      const fs = require("fs");
      const { decodeMap } = require("../src/cityStorage");
      const { GameMap } = require("../src/gameMap.js");
      const { Storage } = require("../src/storage.js");
      const { plotAccess, plotOf } = require("../src/plots");
      const save = JSON.parse(fs.readFileSync(file, "utf8"));
      save.map = decodeMap(save.mapRle);
      delete save.mapRle;
      if (save.version !== Storage.CURRENT_VERSION) Storage.transitionOldSave(save);
      const core = new CityCore({ map: new GameMap(save.width, save.height), saved: save });
      core.run(64);
      const map = core.map as any;
      let onRoad = 0, lit = 0;
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!plotOf(map, x, y) || !plotAccess(map, x, y)) continue;
        onRoad++;
        if (map.getTileFlags(x, y) & POWERBIT) lit++;
      }
      expect(onRoad).toBeGreaterThan(300);
      expect(lit).toBe(onRoad);
      expect(core.simulation._census.wateredZoneCount).toBeGreaterThan(0);
    }, 120000);
});
