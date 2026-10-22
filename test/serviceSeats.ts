/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The schools' seats and the hospitals' care along the roads (src/sim/serviceSeats.ts, docs/NO_GRID_PLAN.md 4.3): in
// the fixture Khon Kaen city a school in the town serves its homes as the city-wide count did, the same school far out
// along a road beyond a child's reach serves none of them, and with no school there are no seats.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { Storage } from "../src/storage.js";
import { seatsAlongRoads, SEAT_REACH_M } from "../src/sim/serviceSeats";
import { serviceLevels } from "../src/services";
import { isRoadTile } from "../src/roadTiles";

function open(file: string) {
  const save = JSON.parse(fs.readFileSync(file, "utf8"));
  save.map = decodeMap(save.mapRle);
  delete save.mapRle;
  if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
  return new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save });
}

describe("seats and care along the roads", () => {
  const core = open("test/fixtures/khonKaen-v5.json"), map = core.map as any;
  const W = map.width, town = map.town ?? { x: W >> 1, y: map.height >> 1 };
  /** A tile beside a road, the nearest such to (x, y) looking outwards */
  const besideRoad = (x: number, y: number): number => {
    for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= map.height - 2 || isRoadTile(map.getTileValue(tx, ty))) continue;
      if (isRoadTile(map.getTileValue(tx + 2, ty)) || isRoadTile(map.getTileValue(tx, ty + 2))) return ty * W + tx;
    }
    return -1;
  };

  test("a school in the town serves its homes as the city's places over its people did", () => {
    const people = 2000, centre = besideRoad(town.x, town.y);
    expect(centre).toBeGreaterThan(0);
    const along = seatsAlongRoads(map, [{ centre, field: "basic", places: 200 }], people)!;
    const citywide = serviceLevels({ basic: 200, higher: 0, health: 0 }, people);
    expect(along).not.toBeNull();
    expect(Math.abs(along.basic - citywide.basic)).toBeLessThanOrEqual(5);
  });

  test("the same school beyond a child's reach along the roads serves none; with none there are no seats", () => {
    // the tile beside a road furthest, as the crow flies, from every home: further along the roads still
    const homes = map.plotBuildings.all().filter((p: any) => p.kind === "residential" && p.level > 0)
      .map((p: any) => map.plotBuildings.places.get(p.id).anchor);
    let centre = -1, furthest = 0;
    for (let y = 3; y < map.height - 3; y += 3) for (let x = 3; x < W - 3; x += 3) {
      if (isRoadTile(map.getTileValue(x, y)) || !isRoadTile(map.getTileValue(x + 1, y))) continue;
      let near = Infinity;
      for (const h of homes) near = Math.min(near, Math.hypot(h % W - x, Math.floor(h / W) - y) * map.tileSizeM);
      if (near > furthest) { furthest = near; centre = y * W + x; }
    }
    expect(furthest).toBeGreaterThan(SEAT_REACH_M.basic);
    expect(seatsAlongRoads(map, [{ centre, field: "basic", places: 5000 }], 2000)!.basic).toBe(0);
    expect(seatsAlongRoads(map, [], 2000)!.basic).toBe(0);
  });
});
