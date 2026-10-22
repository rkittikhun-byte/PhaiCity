/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every building of the ruler's two tiles a side and up takes its turned outline's tiles, not only the 3 x 3s
// (docs/NO_GRID_PLAN.md 3A.1): a 2 x 2 plant, a 4 x 4 stadium and a 6 x 6 airport turned to a slanted road take the tiles
// their outline covers, stand with the outline's front at the road's edge, and their outlines are rectangles of the lot's
// width and depth.

import { CityCore } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import {
  inFamily, laidOutline, outlineCorners, outlineOf, outlineTiles, outsideBy, TURNED_SIZES, turnedTilesOf,
} from "../src/buildings/turnedFootprint";
import { buildingAtPoint, overlapDepth } from "../src/buildings/outlineOverlap";
import { roadPose } from "../src/buildings/roadPose";
import { roadReach } from "../src/roadGeometry";
import { isRoadTile } from "../src/roadTiles";
import { AIRPORT, PLANT2, STADIUM } from "../src/tileValues";

const W = 80, H = 70, M = 16, U = 10 / 16;
const REACH = roadReach(1, U) / U;

void GameMap;

/** A bare 16 m city map whose buildings stand against their roads, with a road at a slant (about 27°) across it */
function city() {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ map, seed: 3, sandbox: true });
  core.simulation.budget.setFunds(10000000);
  (core.map as any).needsRulerHouse = false;
  const from: [number, number] = [80, 900], to: [number, number] = [1200, 340];
  expect(core.apply({ type: "road", tool: "road", from, to, stroke: 1 } as any)).toMatchObject({ accepted: true });
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]), tx = (to[0] - from[0]) / len, tz = (to[1] - from[1]) / len;
  return { core, map: core.map as any, from, tx, tz, nx: -tz, nz: tx };
}

/** Where the game puts a building of `size` against the road: its outline's front at the road's edge */
function pose(c: ReturnType<typeof city>, along: number, size: number): { x: number; z: number; rot: number } {
  const px = c.from[0] + c.tx * along, pz = c.from[1] + c.tz * along, gap = REACH + 1 + size * M / 2;
  return { x: px + c.nx * gap, z: pz + c.nz * gap, rot: Math.atan2(-c.nx, -c.nz) };
}

const value = (core: CityCore, i: number): number => core.map.getTileValue(i % W, Math.floor(i / W));

describe("buildings of every size turned to a slanted road", () => {
  test("two tiles a side and up turn their footprint; one tile does not", () => {
    expect([1, 2, 3, 4, 6].map((n) => TURNED_SIZES.has(n))).toEqual([false, true, true, true, true]);
  });

  test.each([
    ["solar", 2, PLANT2],
    ["stadium", 4, STADIUM],
    ["airport", 6, AIRPORT],
  ])("a %s (%i x %i) takes the tiles of its turned outline", (tool, size, centre) => {
    const c = city(), p = pose(c, 500, size as number);
    const out = c.core.apply({ type: "build", tool, x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    const b = c.map.buildings.all().find((x: any) => x.tool === tool);
    expect(b.size).toBe(size);
    expect(value(c.core, b.tile)).toBe(centre);
    const o = laidOutline(c.map, b);
    expect(o).not.toBeNull();
    const tiles = outlineTiles(o!, W, H, M);
    // every tile of the outline is the building's, or the road's it faces ...
    for (const i of tiles) expect([i, inFamily(value(c.core, i), centre as number, size as number) || isRoadTile(value(c.core, i))]).toEqual([i, true]);
    // ... and none of its family lies outside it
    const mine = turnedTilesOf(c.map, b.tile, centre as number)!;
    expect(mine.length).toBeGreaterThan(0);
    for (const i of mine) expect(outsideBy(o!, (i % W + 0.5) * M, (Math.floor(i / W) + 0.5) * M)).toBeLessThanOrEqual(1e-6);
    // the bulldozer takes it whole
    // (clicked on a tile of it past its square, whose value is its square's edge's)
    const past = mine.find((i) => Math.abs(i % W - b.tile % W) > 1 || Math.abs(Math.floor(i / W) - Math.floor(b.tile / W)) > 1) ?? b.tile;
    expect(c.core.apply({ type: "tool", tool: "bulldozer", x: past % W, y: Math.floor(past / W), stroke: 3 } as any))
      .toMatchObject({ accepted: true, toolResult: 0 });
    for (const i of mine) expect(inFamily(value(c.core, i), centre as number, size as number)).toBe(false);
  });

  test("a 2 x 2 stands with its whole lot against the road, as a 3 x 3 does", () => {
    const line: [number, number][] = [[0, 0], [400, 200]];
    const map = { width: 100, height: 100, tileSizeM: M, realUnits: U, isRoad: () => false };
    for (const size of [2, 3, 4]) {
      const at = roadPose(map, [line], [1], 200, 112, size, { buildingScale: 10 / 16 })!;
      // the middle stands the road's reach, a little, and half its whole lot from the road's middle line
      const len = Math.hypot(400, 200), d = Math.abs((at[0] - 0) * (200 / len) - (at[1] - 0) * (400 / len));
      expect(d).toBeCloseTo(roadReach(1, U) + 0.6 + size * 5, 1);
    }
  });

  test("an outline is a rectangle of its lot's width and depth", () => {
    const o = outlineOf(100, 100, 0, 3, M, 40, 24);
    expect([o.hu, o.hv, o.half]).toEqual([20, 12, 20]);
    expect(outsideBy(o, 119, 100)).toBeLessThan(0);
    expect(outsideBy(o, 100, 113)).toBeCloseTo(1);
    expect(outlineCorners(o).map(([x, z]) => [Math.round(x), Math.round(z)])).toEqual([[80, 88], [120, 88], [120, 112], [80, 112]]);
    // two rectangles side by side along their long sides meet only where they run into each other
    expect(overlapDepth(o, outlineOf(100, 124, 0, 3, M, 40, 24))).toBeCloseTo(0);
    expect(overlapDepth(o, outlineOf(100, 120, 0, 3, M, 40, 24))).toBeCloseTo(4);
    expect(overlapDepth(o, outlineOf(141, 100, 0, 3, M, 40, 24))).toBeLessThan(0);
  });
});

describe("the building under the mouse (docs/NO_GRID_PLAN.md 3A.4)", () => {
  test("is found by its own outline, turned, not by the tile under the mouse", () => {
    const c = city(), p = pose(c, 500, 3);
    c.core.apply({ type: "build", tool: "police", x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    const b = c.map.buildings.all().find((x: any) => x.tool === "police");
    const o = laidOutline(c.map, b)!;
    // a point just inside a corner of the outline, whose tile's middle lies outside it
    const [cx, cz] = outlineCorners(o)[1], inX = cx + (o.x - cx) * 0.03, inZ = cz + (o.z - cz) * 0.03;
    expect(outsideBy(o, inX, inZ)).toBeLessThan(0);
    expect(buildingAtPoint(c.map, inX, inZ)?.id).toBe(b.id);
    // ... and one just outside it is no building's
    const outX = cx + (cx - o.x) * 0.05, outZ = cz + (cz - o.z) * 0.05;
    expect(buildingAtPoint(c.map, outX, outZ)).toBeNull();
    expect(buildingAtPoint(c.map, o.x, o.z, () => false)).toBeNull();
  });
});
