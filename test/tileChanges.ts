/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The map counts its tile changes, so the 3D view need not go over every tile each frame to find what changed
// (owner, 19 Oct 2026: the game stalled, src/tile.ts Tile.changes, src/render3d/city/tileModels.ts TileSnapshot.sync).

import { GameMap } from "../src/gameMap.js";
import { TileSnapshot } from "../src/render3d/city/tileModels";
import { Tile } from "../src/tile";
import { POWERBIT, ZONEBIT } from "../src/tileFlags";

describe("counting tile changes", () => {
  test("only a real change counts, by any way a tile is written", () => {
    const tile = new Tile(66, 0);
    let before = Tile.changes;
    tile.setValue(66);
    tile.addFlags(0);
    tile.removeFlags(POWERBIT);
    expect(Tile.changes).toBe(before);
    for (const write of [() => tile.setValue(67), () => tile.addFlags(POWERBIT), () => tile.removeFlags(POWERBIT),
      () => tile.setFlags(ZONEBIT), () => tile.set(68, 0), () => tile.setFrom(new Tile(69, 0))]) {
      before = Tile.changes;
      write();
      expect(Tile.changes).toBeGreaterThan(before);
    }
  });

  test("the 3D view's copy skips going over the map while nothing changed, and still sees a road's new level", () => {
    const map = new GameMap(30, 20) as unknown as {
      setTileValue(x: number, y: number, v: number): void; changeCount(): number; rawTileAt(i: number): number;
      getTileValue(x: number, y: number): number; getTileFlags(x: number, y: number): number; roadLevels: Uint8Array | null;
    };
    map.roadLevels = new Uint8Array(30 * 20);
    const snapshot = new TileSnapshot(30, 20);
    snapshot.sync(map as never);
    // Nothing changed: no tile is read at all
    const read = jest.spyOn(map, "rawTileAt");
    expect(snapshot.sync(map as never)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    // A road's level alone
    map.roadLevels[5 * 30 + 4] = 3;
    expect(snapshot.sync(map as never)).toEqual([5 * 30 + 4]);
    // A tile: the map is gone over again, and finds it
    map.setTileValue(7, 2, 66);
    expect(snapshot.sync(map as never)).toEqual([2 * 30 + 7]);
    expect(read).toHaveBeenCalled();
    expect(snapshot.values[2 * 30 + 7]).toBe(66);
  });
});
