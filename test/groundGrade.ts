/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { describe, expect, it } from "@jest/globals";
import type { PlacedBuilding } from "../src/buildings/placedBuildings";
import {
  GRADE_STEPS, GroundGrade, gradedAt, gradedTileHeight, gradePads, PAD_APRON_M, SKIRT_MAX_M, SKIRT_MIN_M,
  tileHeightGround, type GradeMap, type NaturalGround,
} from "../src/terrain/groundGrade";
import { outsideBy } from "../src/buildings/turnedFootprint";

const T = 16, W = 20, H = 20;
/** Ground rising a metre a tile to the east, and half a metre a tile to the south */
const slope: NaturalGround = (x, z) => x / T + z / T / 2;
/** A straight road running east-west along z = roadZ (metres) */
const road = (roadZ: number) => ({
  version: 1,
  nearest(p: readonly [number, number], reach: number) {
    return Math.abs(p[1] - roadZ) <= reach ? { point: [p[0], roadZ] as [number, number] } : null;
  },
});

interface TestMap extends GradeMap { zone: Set<number>; list: PlacedBuilding[] }
function cityMap(buildings: PlacedBuilding[], roadZ: number | null = 9 * T): TestMap {
  const zone = new Set(buildings.map((b) => b.tile));
  const map: TestMap = {
    width: W, height: H, tileSizeM: T, zone, list: buildings,
    getTileValue: () => 0,
    getTile: (x, y) => ({ isZone: () => zone.has(y * W + x) }),
    buildings: { all: () => map.list, atTile: (t: number) => map.list.find((b) => b.tile === t), version: 1 },
    roadGraph: roadZ === null ? null : road(roadZ),
  };
  return map;
}
/** A 3 x 3 building of the ruler's, square to the tiles, its centre tile (cx, cy), facing south (rot 0) */
const building = (id: number, cx: number, cy: number, rot = 0): PlacedBuilding =>
  ({ id, tool: "police", x: (cx + 0.5) * T, z: (cy + 0.5) * T, rot, size: 3, tile: cy * W + cx });

describe("ground levelled under what stands on it (src/terrain/groundGrade.ts)", () => {
  it("is flat over a building's outline, at its road's height where its front meets it", () => {
    const map = cityMap([building(1, 5, 7)]), [pad] = gradePads(map, slope, { run: 3 });
    // the front edge's middle is (5.5, 9) tiles; the road at z = 9 tiles is right there
    expect(pad.level).toBeCloseTo(slope(5.5 * T, 9 * T), 6);
    const grade = new GroundGrade(W, H, T, slope);
    grade.setPads([pad]);
    const step = T / GRADE_STEPS;
    let inside = 0;
    for (const [i, samples] of grade.tiles) for (let r = 0; r <= GRADE_STEPS; r++) for (let c = 0; c <= GRADE_STEPS; c++) {
      const x = (i % W) * T + c * step, z = Math.floor(i / W) * T + r * step;
      if (outsideBy(pad.outline, x, z) <= PAD_APRON_M) { expect(samples[r * (GRADE_STEPS + 1) + c]).toBe(pad.level); inside++; }
    }
    expect(inside).toBeGreaterThan(100);
  });

  it("eases back to the natural ground over a short slope, never a step", () => {
    const map = cityMap([building(1, 5, 7)]), pads = gradePads(map, slope, { run: 3 });
    const pad = pads[0];
    expect(pad.skirt).toBeGreaterThanOrEqual(SKIRT_MIN_M);
    expect(pad.skirt).toBeLessThanOrEqual(SKIRT_MAX_M);
    // past the apron and the slope the ground is its own again
    for (const [x, z] of [[1 * T, 2 * T], [12 * T, 7.5 * T]]) {
      expect(outsideBy(pad.outline, x, z)).toBeGreaterThan(PAD_APRON_M + pad.skirt);
      expect(Number.isNaN(gradedAt(pads, slope, x, z))).toBe(true);
    }
    // walking out of the pad eastward, a metre at a time, the ground never jumps
    const z = 7.5 * T;
    let last = gradedAt(pads, slope, 5.5 * T, z);
    for (let x = 5.5 * T + 1; x < 5.5 * T + 24 + pad.skirt + 2; x += 1) {
      const g = gradedAt(pads, slope, x, z), h = Number.isNaN(g) ? slope(x, z) : g;
      expect(Math.abs(h - last)).toBeLessThan(0.5);
      last = h;
    }
  });

  it("stands on the mean of its ground with no road within reach", () => {
    const map = cityMap([building(1, 5, 7)], null), [pad] = gradePads(map, slope, { run: 3 });
    expect(pad.level).toBeCloseTo(slope(5.5 * T, 7.5 * T), 6);
  });

  it("follows a building turned to a slanted road: its turned outline, its front toward the road", () => {
    const b: PlacedBuilding = { id: 1, tool: "police", x: 8.5 * T, z: 8.5 * T, rot: Math.PI / 4, size: 3, tile: 8 * W + 8 };
    const map = cityMap([b]);
    map.getTileValue = () => 500;
    const [pad] = gradePads(map, slope, { run: 3 });
    expect(pad.outline.vx).toBeCloseTo(Math.sin(Math.PI / 4), 4);
    expect(pad.outline.vz).toBeCloseTo(Math.cos(Math.PI / 4), 4);
  });

  it("works out again only the tiles of a pad that came or went, and gives the ground back", () => {
    const one = building(1, 5, 7), two = building(2, 14, 7), map = cityMap([one, two]);
    const grade = new GroundGrade(W, H, T, slope);
    const first = grade.setPads(gradePads(map, slope, { run: 3 }));
    expect(first.length).toBeGreaterThan(0);
    // the same again changes nothing
    expect(grade.setPads(gradePads(map, slope, { run: 3 }))).toEqual([]);
    const tilesOfTwo = [...grade.tiles.keys()].filter((i) => i % W >= 10);
    map.list = [one];
    const changed = grade.setPads(gradePads(map, slope, { run: 3 }));
    expect(changed.sort((a, b) => a - b)).toEqual(tilesOfTwo.sort((a, b) => a - b));
    for (const i of changed) expect(grade.tiles.has(i)).toBe(false);
  });

  it("levels the same every time", () => {
    const make = () => {
      const g = new GroundGrade(W, H, T, slope);
      g.setPads(gradePads(cityMap([building(1, 5, 7), building(2, 7, 4, Math.PI / 2)]), slope, { run: 3 }));
      return [...g.tiles].map(([i, t]) => [i, [...t]]);
    };
    expect(make()).toEqual(make());
  });

  it("lays a grown plot's pad along its columns, a plot deep from its road", () => {
    // four columns facing north to a road at z = 9 tiles, their front rows' middles 2 m in from it (world units, 10 a tile)
    const units = 10 / T, columns = [0, 1, 2, 3].map((k) => ({ x: (64 + 2 + 4 * k) * units, z: (9 * T + 2) * units, nx: 0, nz: 1 }));
    const map = cityMap([]);
    map.plotBuildings = { all: () => [{ id: 7, level: 2 }, { id: 8, level: 0 }], places: new Map([[7, { cols: [0, 1, 2, 3] }], [8, { cols: [] }]]), columns };
    const pads = gradePads(map, slope, { run: 3 });
    expect(pads.map((p) => p.id)).toEqual(["p7"]);
    const o = pads[0].outline;
    expect(o.x).toBeCloseTo(64 + 8, 6);
    expect(o.z).toBeCloseTo(9 * T + 8, 6);
    expect(o.hu * 2).toBeCloseTo(16, 6);
    expect(o.hv * 2).toBeCloseTo(16, 6);
    expect(pads[0].level).toBeCloseTo(slope(72, 9 * T), 6);
  });

  it("gives the simulation a pad's level under it, and the ground back when the building is gone", () => {
    const heights = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) heights[y * W + x] = x + y / 2 + 0.5 * 1.5;
    const map = Object.assign(cityMap([building(1, 5, 7)]), { heights });
    const natural = tileHeightGround(heights, W, H, T), level = natural(5.5 * T, 9 * T);
    for (const [x, y] of [[4, 6], [5, 7], [6, 8]]) expect(gradedTileHeight(map, y * W + x)).toBeCloseTo(level, 5);
    expect(gradedTileHeight(map, 2 * W + 2)).toBe(heights[2 * W + 2]);
    // burnt: its centre is no longer a zone
    map.zone.clear();
    expect(gradedTileHeight(map, 7 * W + 5)).toBe(heights[7 * W + 5]);
    expect(Number.isNaN(gradedTileHeight({ ...map, heights: null }, 0))).toBe(true);
  });
});
