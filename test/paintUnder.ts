/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Paint and what grew from it give way to the ruler's buildings and roads (src/paintUnder.ts; owner, 23 Oct 2026: a
// water tower tried again and again on painted homes' land, "วางไม่ติดสักที", then "บริการของประชาชน จะวางได้ทุกที่ ถ้าไปชน
// กับ object ที่วาดสี" and "ถนนก็ด้วยเหมือนกัน วาดได้หมด").

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { Storage } from "../src/storage.js";
import { isRoadTile } from "../src/roadLevels";
import { WATER_TOWER } from "../src/tileValues";
import { plotOf } from "../src/plots";
import { tileRasterKeys } from "../src/zoneCells";

function open(file: string) {
  const save = JSON.parse(fs.readFileSync(file, "utf8"));
  save.map = decodeMap(save.mapRle);
  delete save.mapRle;
  if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
  return new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save });
}

describe("a building on painted land", () => {
  const core = open("test/fixtures/khonKaen-v5.json"), map = core.map as any;
  (core as any).simulation.budget.totalFunds = 1e6;
  const besideRoad = (level: number): [number, number] | null => {
    for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
      if (plotOf(map, x, y)?.level !== level) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoadTile(map.getTileValue(x + dx, y + dy) & 1023))) continue;
      const out: any = core.apply({ type: "tool", tool: "watertower", x, y } as any);
      if (out.accepted) return [x, y];
    }
    return null;
  };

  test("a water tower on painted land with nothing grown takes its place, and the paint there goes", () => {
    const at = besideRoad(0);
    expect(at).not.toBeNull();
    const [x, y] = at!;
    expect(map.getTileValue(x, y) & 1023).toBe(WATER_TOWER);
    for (const key of tileRasterKeys(map, x, y)) expect(map.zoneCells?.has(key) ?? false).toBe(false);
  });

  test("a house grown from paint gives way too (owner: services go anywhere a painted thing stands)", () => {
    const at = besideRoad(1);
    expect(at).not.toBeNull();
    expect(map.getTileValue(at![0], at![1]) & 1023).toBe(WATER_TOWER);
  });

  test("a road drawn over a grown house lays its road there", () => {
    for (let y = 2; y < map.height - 2; y++) for (let x = 2; x < map.width - 2; x++) {
      if ((plotOf(map, x, y)?.level ?? 0) < 1) continue;
      const out: any = core.apply({ type: "tool", tool: "road", x, y } as any);
      if (!out.accepted) continue;
      expect(out.toolResult).toBe(0);
      expect(isRoadTile(map.getTileValue(x, y) & 1023)).toBe(true);
      for (const key of tileRasterKeys(map, x, y)) expect(map.zoneCells?.has(key) ?? false).toBe(false);
      return;
    }
    throw new Error("no house found");
  });
});
