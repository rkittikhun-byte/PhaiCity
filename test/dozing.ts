/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bulldozer by dragging the mouse (src/dozing.ts, owner 18 Oct 2026): it follows the road drawn along a slanted road's
// staircase of tiles, takes every tile of it, and leaves no stray tile behind.

import { BulldozerTool } from "../src/bulldozerTool.js";
import { CityCore } from "../src/core/cityCore";
import { dozePath, dozeTile, loneRoads, type DozePoint } from "../src/dozing";
import { linePath } from "../src/drawPaths";
import { GameMap } from "../src/gameMap.js";
import { isOpenLand } from "../src/plots";
import { isRoadTile } from "../src/roadLevels";

const SIZE = 60;

/** A city with a road drawn from (5, 10) to (45, 30): a staircase of tiles, two along for each one down */
function city() {
  const map = new (GameMap as unknown as new (w: number, h: number) => any)(SIZE, SIZE);
  const core = new CityCore({ map, seed: 3 });
  core.simulation.budget.setFunds(500000);
  core.map.needsRulerHouse = false;
  const a = { x: 5, y: 10 }, b = { x: 45, y: 30 };
  for (const { x, y } of linePath(a, b)) core.apply({ type: "tool", tool: "road", x, y, stroke: 1, shape: "straight", controls: [[a.x, a.y], [b.x, b.y]] } as any);
  return { core, a, b };
}

const roads = (map: any): string[] => {
  const out: string[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (isRoadTile(map.getTileValue(x, y))) out.push(`${x},${y}`);
  return out;
};

describe("the bulldozer by dragging", () => {
  test("it is a dragged tool, as a road was in the original", () => {
    const tool = new (BulldozerTool as any)(new (GameMap as unknown as new (w: number, h: number) => any)(20, 20));
    expect(tool.isDraggable).toBe(true);
  });

  test("a mouse wandering beside a slanted road, a tile off its line, still takes every tile of it and none is left alone", () => {
    const { core, a, b } = city();
    const map = core.map as any, before = roads(map);
    expect(before.length).toBeGreaterThan(40);
    // The mouse's way, in tiles, up to half a tile beside the road's line, in quick jumps of about three tiles
    const steps = 14, way: DozePoint[] = [];
    for (let k = 0; k <= steps; k++) way.push({ x: a.x + 0.5 + (b.x - a.x) * k / steps, y: a.y + 0.5 + (b.y - a.y) * k / steps + (k % 2 ? 0.45 : -0.45) });
    const dozed: DozePoint[] = [];
    for (let k = 1; k < way.length; k++) {
      for (const tile of dozePath(map, way[k - 1], way[k])) {
        dozed.push(tile);
        core.apply({ type: "tool", tool: "bulldozer", x: tile.x, y: tile.y, stroke: 2 } as any);
      }
    }
    for (const tile of loneRoads(map, dozed)) core.apply({ type: "tool", tool: "bulldozer", x: tile.x, y: tile.y, stroke: 2 } as any);
    // Everything from the first point to the last is gone, and nothing is left alone beside it
    const left = roads(map);
    const near = (key: string): boolean => {
      const x = Number(key.split(",")[0]);
      return x >= a.x + 1 && x <= b.x - 1;
    };
    expect(left.filter(near)).toEqual([]);
    const lone = left.filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoadTile(map.getTileValue(x + dx, y + dy)));
    });
    expect(lone).toEqual([]);
  });

  test("the mouse over bare land beside a road takes the road tile there; over a building it takes the building", () => {
    const { core } = city();
    const map = core.map as any, road = roads(map).map((key) => key.split(",").map(Number))[10];
    // Just beside it, on the land next to its square
    const point = { x: road[0] + 0.5, y: road[1] - 0.15 };
    const land = { x: road[0], y: road[1] - 1 };
    expect(isOpenLand(map.getTileValue(land.x, land.y))).toBe(true);
    expect(dozeTile(map, land, point, isOpenLand)).toEqual({ x: road[0], y: road[1] });
    // Too far from a road, the tile itself
    expect(dozeTile(map, { x: 30, y: 5 }, { x: 30.5, y: 5.5 }, isOpenLand)).toEqual({ x: 30, y: 5 });
    // Over something that is not open land (a road tile, a building): never moved off it
    expect(dozeTile(map, { x: road[0], y: road[1] }, point, isOpenLand)).toEqual({ x: road[0], y: road[1] });
  });

  test("a road tile left alone beside a dozed one is taken, one with a road next to it is not", () => {
    const map = new (GameMap as unknown as new (w: number, h: number) => any)(20, 20);
    // A road along row 5, tiles 3-9, and a lone road tile at (12, 7)
    for (let x = 3; x <= 9; x++) map.setTile(x, 5, 66, 0);
    map.setTile(12, 7, 66, 0);
    expect(loneRoads(map, [{ x: 11, y: 6 }])).toEqual([{ x: 12, y: 7 }]);
    expect(loneRoads(map, [{ x: 5, y: 4 }])).toEqual([]);
  });
});
