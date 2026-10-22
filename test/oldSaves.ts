/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Old saves of a Khon Kaen city still open and play on (docs/NO_GRID_PLAN.md 4.4, step 0.3): a city of Mueang Khon
// Kaen a year after it started, saved as storage version 5 kept it before every road was in the road graph and the
// rules' version was kept (test/fixtures/khonKaen-v5.json), and as version 4 kept it before the roads were kept in metres
// (khonKaen-v4.json, the same city without its graphs). Each step of the plan keeps them opening.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { coveredTiles } from "../src/roads/roadCover";
import type { RoadGraph } from "../src/roads/roadGraph";
import { isAnyRail, isAnyRoad } from "../src/roadTiles";
import { SIM_VERSION } from "../src/sim/simVersion";
import { Storage } from "../src/storage.js";
import { plotOf } from "../src/plots";

/** A fixture as the game reads a save (src/cityStorage.ts readSave), and the city opened from it */
function open(file: string) {
  const save = JSON.parse(fs.readFileSync(file, "utf8"));
  save.map = decodeMap(save.mapRle);
  delete save.mapRle;
  if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
  return { save, core: new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save }) };
}

/** The painted plots of a map, by kind and level */
function plots(map: any): string {
  const counts = new Map<string, number>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const plot = plotOf(map, x, y);
    if (plot) counts.set(`${plot.kind}${plot.level}`, (counts.get(`${plot.kind}${plot.level}`) ?? 0) + 1);
  }
  return [...counts.entries()].sort().map(([k, n]) => `${k}:${n}`).join(" ");
}

describe.each([["version 5", "test/fixtures/khonKaen-v5.json"], ["version 4", "test/fixtures/khonKaen-v4.json"]])(
  "a Khon Kaen city saved as %s", (_, file) => {
    test("opens with all it had, every road in its graphs, and plays on", () => {
      const { save, core } = open(file);
      const map = core.map as any;
      expect(save.simVersion).toBeUndefined();
      expect(map.simVersion).toBe(1);
      expect(map.width).toBe(480);
      const before = plots(map);
      expect(before.length).toBeGreaterThan(0);
      // Its roads as drawn are in the graph again, and every road and railway tile of the map is too
      const value = (i: number) => map.getTileValue(i % map.width, Math.floor(i / map.width));
      const cover = { width: map.width, height: map.height, tileSizeM: 16, value };
      for (const rail of [false, true]) {
        const graph: RoadGraph = rail ? map.railGraph : map.roadGraph, kind = rail ? isAnyRail : isAnyRoad;
        const covered = coveredTiles(graph, cover, rail);
        let missed = 0;
        for (let i = 0; i < covered.length; i++) if (kind(value(i)) && !covered[i]) missed++;
        expect(missed).toBe(0);
      }
      expect([...map.roadGraph.segments.values()].some((s: any) => s.piece && !s.traced)).toBe(true);
      // ... and a month on, it still has its people and is saved with today's rules
      const people = core.simulation.evaluation.cityPop;
      core.run(64);
      expect(core.simulation.evaluation.cityPop).toBeGreaterThan(people * 0.8);
      const again = core.save();
      expect(again.simVersion).toBe(SIM_VERSION);
      expect(plots(map).split(" ").length).toBeGreaterThanOrEqual(before.split(" ").length - 1);
    }, 120000);
  });
