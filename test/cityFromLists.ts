/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// On a real-scale city map the city is counted from its lists, not a look over every tile (docs/NO_GRID_PLAN.md 5.2):
// a home, shop or factory object a plot of the list (src/objects/cityObjects.ts), what the city has built for the
// unlocks from its buildings' list (src/unlocks.ts), and its paved roads from the road graph (src/eraScore.ts) — the
// same answers the tiles gave for what the tiles could tell.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { Storage } from "../src/storage.js";
import { PLOT_OBJECT_BASE } from "../src/objects/cityObject";
import { unlockCity } from "../src/unlocks";

function open(file: string) {
  const save = JSON.parse(fs.readFileSync(file, "utf8"));
  save.map = decodeMap(save.mapRle);
  delete save.mapRle;
  if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
  return new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save });
}

describe("a real-scale city counted from its lists", () => {
  const core = open("test/fixtures/khonKaen-v5.json"), map = core.map as any;
  core.run(16 * 4);

  test("each grown plot is one home, shop or factory, covering the tiles its columns lie on", () => {
    core.objects.scan(map, 0);
    const zoned = core.objects.all().filter((b) => ["home", "shop", "factory"].includes(b.kind));
    const grown = map.plotBuildings.all().filter((p: any) => p.level > 0);
    expect(grown.length).toBeGreaterThan(50);
    expect(zoned.length).toBe(grown.length);
    const order = new Map(zoned.map((b, i) => [b, i]));
    for (const b of zoned) {
      const plot = map.plotBuildings.get(b.id - PLOT_OBJECT_BASE), place = map.plotBuildings.places.get(plot.id);
      expect((b as any).plot).toBe(plot.id);
      expect(b.coverTiles(map.width, map.height)).toEqual(place.tiles);
      expect([b.x, b.y]).toEqual([place.anchor % map.width, Math.floor(place.anchor / map.width)]);
      expect((b as any).level(map)).toBe(plot.level);
      // ... clicked on any of its tiles, unless a plot before it in the list, or a building the ruler put down, lies
      // there too
      const anchor = b.y * map.width + b.x;
      for (const tile of place.tiles) {
        const at = core.objects.at(tile % map.width, Math.floor(tile / map.width));
        expect(at).not.toBeNull();
        if (at === b) continue;
        expect(at!.coverTiles(map.width, map.height)).toContain(tile);
        if (order.has(at!)) expect(order.get(at!)!).toBeLessThan(order.get(b)!);
      }
      expect(place.tiles).toContain(anchor);
    }
  });

  test("its buildings for the unlocks, from their list, are those a look over every tile finds", () => {
    const fromList = unlockCity(map);
    // (the same map read as one whose tiles are not real-scale: a look over every tile)
    const tiles = unlockCity(new Proxy(map, { get: (target, key) => key === "tileSizeM" ? null : Reflect.get(target, key) }));
    for (const tool of Object.keys((core as any).tools)) expect([tool, fromList.count(tool)]).toEqual([tool, tiles.count(tool)]);
    for (const need of ["rail", "paved_road", "power_plant"] as const) expect([need, fromList.has(need)]).toEqual([need, tiles.has(need)]);
  });
});
