/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Drawn lines (src/drawPaths.ts): straight lines, curves and grids of tiles, each tile beside the last, as roads need.

import type { TilePoint } from "../src/cityView";
import { curvePath, GRID_SPACING, gridPath, linePath, MAX_PATH, rectanglePath } from "../src/drawPaths";

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

  test("a rectangle is every tile in it, and nothing is ever longer than the limit", () => {
    expect(rectanglePath({ x: 2, y: 2 }, { x: 0, y: 3 }).length).toBe(6);
    expect(rectanglePath({ x: 0, y: 0 }, { x: 99, y: 99 }).length).toBe(MAX_PATH);
    expect(linePath({ x: 0, y: 0 }, { x: 5000, y: 0 }).length).toBe(MAX_PATH);
  });
});
