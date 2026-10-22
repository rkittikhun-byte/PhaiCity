/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A plot finds its road in metres (docs/NO_GRID_PLAN.md 0.5): on a real-scale city map the nearest road in any way, a
// slanted one too, within 48 m of the plot's middle, by the roads as drawn (src/plots.ts nearestRoad); on other maps
// straight north, east, south or west within three tiles, as before.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { nearestRoad, PLOT_REACH } from "../src/plots";
import { isRoadTile } from "../src/roadTiles";

function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 60, new Uint8Array(60 * 60));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ sandbox: true, map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** The nearest road straight north, east, south or west, as plots found it before */
function straight(map: any, x: number, y: number): { x: number; y: number } | null {
  for (let d = 1; d <= PLOT_REACH; d++) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const nx = x + dx * d, ny = y + dy * d;
    if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && isRoadTile(map.getTileValue(nx, ny))) return { x: nx, y: ny };
  }
  return null;
}

describe("a plot finds its road in metres", () => {
  test("beside a slanted road, every tile whose middle lies within 48 m of it finds it, none further", () => {
    const core = city(), map = core.map as any;
    // A road at about 30° across the map
    expect(core.apply({ type: "road", tool: "road" as any, from: [40.5, 100.25], to: [900.75, 600.5], stroke: 1 }).accepted).toBe(true);
    const graph = map.roadGraph;
    let found = 0, foundStraight = 0, near = 0;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      if (isRoadTile(map.getTileValue(x, y))) continue;
      const off = graph.nearest([(x + 0.5) * 16, (y + 0.5) * 16], 200)?.distance ?? Infinity;
      const road = nearestRoad(map, x, y);
      if (off <= 48) {
        near++;
        expect(road).not.toBeNull();
        // ... a road tile, beside where the road's line comes nearest
        expect(isRoadTile(map.getTileValue(road!.x, road!.y))).toBe(true);
        found++;
        if (straight(map, x, y)) foundStraight++;
      } else if (off > 50) expect(road).toBeNull();
    }
    expect(found).toBe(near);
    // The straight search missed some of them: tiles beside the slant whose straight lines pass between its tiles
    expect(foundStraight).toBeLessThan(found);
  });

  test("on a map that is not real-scale, plots still look straight out", () => {
    const core = city(), map = core.map as any;
    expect(core.apply({ type: "road", tool: "road" as any, from: [40.5, 100.25], to: [900.75, 600.5], stroke: 1 }).accepted).toBe(true);
    map.tileSizeM = 200;
    for (let y = 0; y < 60; y += 3) for (let x = 0; x < 60; x += 3) expect(nearestRoad(map, x, y)).toEqual(straight(map, x, y));
  });
});
