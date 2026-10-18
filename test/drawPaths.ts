/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Drawn lines (src/drawPaths.ts): straight lines, curves and grids of tiles, each tile beside the last, as roads need.

import type { TilePoint } from "../src/cityView";
import {
  curvePath, GRID_SPACING, gridPath, joinAngle, linePath, MAX_PATH, rectanglePath, snapAlong, snapAngle, SNAP_DEGREES, snapPoint,
} from "../src/drawPaths";

/** Every step of a chain goes to a tile beside the last: never a diagonal, never a jump. */
function joined(tiles: readonly TilePoint[]): boolean {
  return tiles.every((t, i) => i === 0 || Math.abs(t.x - tiles[i - 1].x) + Math.abs(t.y - tiles[i - 1].y) === 1);
}

describe("drawn lines", () => {
  test("a straight line joins its ends tile by tile, close to the true line", () => {
    for (const [a, b] of [[{ x: 0, y: 0 }, { x: 9, y: 0 }], [{ x: 3, y: 7 }, { x: 3, y: -2 }], [{ x: 0, y: 0 }, { x: 7, y: 3 }],
      [{ x: 5, y: 5 }, { x: -4, y: 9 }], [{ x: 2, y: 2 }, { x: 2, y: 2 }]] as const) {
      const tiles = linePath(a, b);
      expect(tiles[0]).toEqual(a);
      expect(tiles[tiles.length - 1]).toEqual(b);
      expect(joined(tiles)).toBe(true);
      expect(tiles.length).toBe(Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + 1);
      // Never further than a tile from the line through the ends
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const t of tiles) {
        expect(Math.abs((b.x - a.x) * (a.y - t.y) - (a.x - t.x) * (b.y - a.y)) / length).toBeLessThanOrEqual(1);
      }
    }
  });

  test("a curve starts and ends at its ends, bends towards its other points and stays joined", () => {
    const simple = curvePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(simple[0]).toEqual({ x: 0, y: 0 });
    expect(simple[simple.length - 1]).toEqual({ x: 10, y: 10 });
    expect(joined(simple)).toBe(true);
    // It cuts the corner: it never reaches the bend itself
    expect(simple.some((t) => t.x === 10 && t.y === 0)).toBe(false);
    const s = curvePath([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 0, y: 12 }, { x: 12, y: 12 }]);
    expect(s[s.length - 1]).toEqual({ x: 12, y: 12 });
    expect(joined(s)).toBe(true);
    // Two points make a straight line
    expect(curvePath([{ x: 0, y: 0 }, { x: 4, y: 0 }])).toEqual(linePath({ x: 0, y: 0 }, { x: 4, y: 0 }));
  });

  test("a grid has the rectangle's edges and a line every few tiles inside, each tile once", () => {
    const tiles = gridPath({ x: 0, y: 0 }, { x: 14, y: 7 });
    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
    expect(keys.size).toBe(tiles.length);
    for (const x of [0, GRID_SPACING, 2 * GRID_SPACING]) expect(keys.has(`${x},3`)).toBe(true);
    for (const y of [0, 7]) expect(keys.has(`5,${y}`)).toBe(true);
    expect(keys.has("3,3")).toBe(false);
  });

  test("a line's end snaps onto straight and 45° lines when it is nearly on one", () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 20, y: 1 })).toEqual({ x: 20, y: 0 });
    expect(snapAngle({ x: 0, y: 0 }, { x: -1, y: -15 })).toEqual({ x: 0, y: -15 });
    expect(snapAngle({ x: 5, y: 5 }, { x: 15, y: 16 })).toEqual({ x: 16, y: 16 });
    // Far from any of them it stays where it is
    expect(snapAngle({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual({ x: 10, y: 4 });
  });

  test("a line drawn on from a road's end snaps onto the road's own way, when near it", () => {
    const way = { x: 0.6, y: 0.8 };
    // Within a few degrees of the way: onto it, as far along as the mouse
    expect(snapAlong({ x: 10, y: 10 }, { x: 18, y: 19 }, way)).toEqual({ x: 17, y: 20 });
    // Too far off it, backwards or too short: no snap
    expect(snapAlong({ x: 10, y: 10 }, { x: 20, y: 12 }, way)).toBeNull();
    expect(snapAlong({ x: 10, y: 10 }, { x: 4, y: 2 }, way)).toBeNull();
    expect(snapAlong({ x: 10, y: 10 }, { x: 11, y: 11 }, way)).toBeNull();
  });

  test("a click snaps onto a road it nearly touches, or onto the guideline a block of plots from a road", () => {
    const roads = new Set(["5,10", "6,10", "7,10", "8,10", "9,10"]);
    const isRoad = (x: number, y: number): boolean => roads.has(`${x},${y}`);
    expect(snapPoint({ x: 7, y: 11 }, isRoad)).toEqual({ point: { x: 7, y: 10 }, guide: "road" });
    // Six tiles below the road: onto the guideline seven below, three plots deep on both sides of the gap
    expect(snapPoint({ x: 7, y: 16 }, isRoad)).toEqual({ point: { x: 7, y: 17 }, guide: "spacing" });
    expect(snapPoint({ x: 7, y: 2 }, isRoad)).toEqual({ point: { x: 7, y: 3 }, guide: "spacing" });
    expect(snapPoint({ x: 7, y: 17 }, isRoad)).toEqual({ point: { x: 7, y: 17 }, guide: null });
    expect(snapPoint({ x: 30, y: 30 }, isRoad).guide).toBeNull();
  });

  test("zoomed out a click reaches further for a road, its dead end first, and no snap moves it further than that", () => {
    const roads = new Set(["5,10", "6,10", "7,10", "8,10", "9,10"]);
    const isRoad = (x: number, y: number): boolean => roads.has(`${x},${y}`);
    // Two tiles off the road's end: too far within a tile and a half, joined within two
    expect(snapPoint({ x: 11, y: 11 }, isRoad, GRID_SPACING, 1.5)).toEqual({ point: { x: 11, y: 11 }, guide: null });
    expect(snapPoint({ x: 11, y: 11 }, isRoad, GRID_SPACING, 2)).toEqual({ point: { x: 9, y: 10 }, guide: "road" });
    // Nearer the road's middle than its end, but the end is near too: the end, as a road is built on from it
    expect(snapPoint({ x: 9, y: 12 }, isRoad, GRID_SPACING, 2)).toEqual({ point: { x: 9, y: 10 }, guide: "road" });
    expect(snapPoint({ x: 7, y: 12 }, isRoad, GRID_SPACING, 2)).toEqual({ point: { x: 7, y: 10 }, guide: "road" });
    // The angle snaps move a point no further than the reach
    expect(snapAngle({ x: 0, y: 0 }, { x: 20, y: 1 }, SNAP_DEGREES, 0.5)).toEqual({ x: 20, y: 1 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 40, y: 3 }, SNAP_DEGREES, 2)).toEqual({ x: 40, y: 3 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 40, y: 3 }, SNAP_DEGREES, 4)).toEqual({ x: 40, y: 0 });
    expect(snapAlong({ x: 10, y: 10 }, { x: 18, y: 19 }, { x: 0.6, y: 0.8 }, SNAP_DEGREES, 1)).toBeNull();
  });

  test("a road's dead end reaches further than the rest of the road: a line begun near an end goes on from it", () => {
    const roads = new Set(["5,10", "6,10", "7,10", "8,10", "9,10"]);
    const isRoad = (x: number, y: number): boolean => roads.has(`${x},${y}`);
    // Three tiles off the end: joined to it; three off the road's middle: not joined
    expect(snapPoint({ x: 12, y: 11 }, isRoad, GRID_SPACING, 1.5, 3)).toEqual({ point: { x: 9, y: 10 }, guide: "road" });
    expect(snapPoint({ x: 12, y: 12 }, isRoad, GRID_SPACING, 1.5, 3).guide).toBeNull();
    expect(snapPoint({ x: 7, y: 13 }, isRoad, GRID_SPACING, 1.5, 3).guide).toBeNull();
  });

  test("a new line's angle: with the line before it, or with the road it leaves", () => {
    expect(joinAngle({ x: 5, y: 0 }, { x: 3, y: 0 }, null)).toBe(180);
    expect(joinAngle({ x: 0, y: 5 }, { x: 3, y: 0 }, null)).toBe(90);
    expect(joinAngle({ x: 5, y: 5 }, null, { x: 1, y: 0 })).toBe(45);
    expect(joinAngle({ x: 0, y: -4 }, null, { x: 1, y: 0 })).toBe(90);
    expect(joinAngle({ x: 4, y: 0 }, null, null)).toBeNull();
  });

  test("a rectangle is every tile in it, and nothing is ever longer than the limit", () => {
    expect(rectanglePath({ x: 2, y: 2 }, { x: 0, y: 3 }).length).toBe(6);
    expect(rectanglePath({ x: 0, y: 0 }, { x: 99, y: 99 }).length).toBe(MAX_PATH);
    expect(linePath({ x: 0, y: 0 }, { x: 5000, y: 0 }).length).toBe(MAX_PATH);
  });
});
