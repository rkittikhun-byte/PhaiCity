/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The road tiles made from the roads as drawn (src/roads/roadRaster.ts, docs/METRE_DRAWING_PLAN.md 1.2): every road
// a chain of tiles joined side to side, at any angle, so power, water and trips go along it.

import { RoadGraph } from "../src/roads/roadGraph";
import { rasterize, segmentTiles } from "../src/roads/roadRaster";

const MAP = { width: 60, height: 60, tileSizeM: 16 };
const xy = (i: number) => [i % MAP.width, Math.floor(i / MAP.width)];

/** Whether each tile of a chain is beside the one before it (north, east, south or west) */
const joinedSideToSide = (tiles: number[]): boolean => tiles.every((t, k) => {
  if (k === 0) return true;
  const [x0, y0] = xy(tiles[k - 1]), [x1, y1] = xy(t);
  return Math.abs(x1 - x0) + Math.abs(y1 - y0) === 1;
});

describe("road raster", () => {
  test("a straight road along a row of tiles takes that row, end to end", () => {
    const g = new RoadGraph();
    const id = g.add({ from: [8, 8 + 16 * 5], to: [8 + 16 * 20, 8 + 16 * 5], level: 2 }).segments[0];
    const tiles = segmentTiles(g, id, MAP);
    expect(tiles).toHaveLength(21);
    expect(tiles.every(t => xy(t)[1] === 5)).toBe(true);
    expect(joinedSideToSide(tiles)).toBe(true);
  });

  test("a road at any angle is a chain of tiles joined side to side", () => {
    for (let degrees = 0; degrees <= 90; degrees += 5) {
      const g = new RoadGraph(), a = degrees * Math.PI / 180;
      const from: [number, number] = [100.3, 120.7], to: [number, number] = [from[0] + Math.cos(a) * 600, from[1] + Math.sin(a) * 600];
      const id = g.add({ from, to, level: 2 }).segments[0];
      const tiles = segmentTiles(g, id, MAP);
      expect(joinedSideToSide(tiles)).toBe(true);
      // ... and never more than one corner tile a diagonal step: about as many tiles as the road is long across and down
      const [x0, y0] = xy(tiles[0]), [x1, y1] = xy(tiles[tiles.length - 1]);
      expect(tiles.length).toBe(Math.abs(x1 - x0) + Math.abs(y1 - y0) + 1);
    }
  });

  test("a curve is a chain too, and its corner tiles are the ones nearer its line", () => {
    const g = new RoadGraph();
    const id = g.add({ from: [20, 20], to: [800, 500], c1: [600, 0], c2: [100, 700], level: 3 }).segments[0];
    const tiles = segmentTiles(g, id, MAP);
    expect(joinedSideToSide(tiles)).toBe(true);
    // Every tile lies within a tile's diagonal of the road's line
    for (const t of tiles) {
      const [x, y] = xy(t), middle: [number, number] = [(x + 0.5) * 16, (y + 0.5) * 16];
      expect(g.nearestOn(id, middle).distance).toBeLessThan(16 * Math.SQRT2);
    }
  });

  test("crossing roads share the crossing tile, which takes the higher level", () => {
    const g = new RoadGraph();
    g.add({ from: [8, 200], to: [700, 200], level: 2, piece: 1 });
    g.add({ from: [300, 8], to: [300, 700], level: 5, piece: 2 });
    const tiles = rasterize(g, MAP);
    const crossing = tiles.get(Math.floor(200 / 16) * MAP.width + Math.floor(300 / 16))!;
    expect(crossing.level).toBe(5);
    expect(crossing.segments.length).toBeGreaterThanOrEqual(2);
    // Every road tile is beside another (no lone tiles)
    for (const i of tiles.keys()) {
      const [x, y] = xy(i);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tiles.has((y + dy) * MAP.width + x + dx))).toBe(true);
    }
  });

  test("a road running off the map keeps only its tiles on it, and the same graph gives the same tiles", () => {
    const build = () => {
      const g = new RoadGraph();
      g.add({ from: [-100, 50], to: [400, 50], level: 2 });
      g.add({ from: [500, -40], to: [520, 2000], level: 1, national: true });
      return g;
    };
    const a = rasterize(build(), MAP), b = rasterize(build(), MAP);
    expect([...a.entries()]).toEqual([...b.entries()]);
    for (const i of a.keys()) { const [x, y] = xy(i); expect(x >= 0 && y >= 0 && x < 60 && y < 60).toBe(true); }
    expect([...a.values()].some(t => t.national)).toBe(true);
  });
});
