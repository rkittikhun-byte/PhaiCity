/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The map keeps its tiles as numbers, 16 bits a tile, not an object a tile (docs/NO_GRID_PLAN.md 5.4): a tile asked
// for reads and writes its cell, as the object the map kept once did.

import { GameMap } from "../src/gameMap.js";
import { MapTile, Tile } from "../src/tile";
import { ALLBITS, BIT_MASK, BULLBIT, BURNBIT, CONDBIT, POWERBIT, ZONEBIT } from "../src/tileFlags";

type Map = {
  width: number; height: number; _cells: Uint16Array;
  getTile(x: number, y: number, fill?: Tile): Tile; getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number; rawTileAt(i: number): number; setTile(x: number, y: number, v: number, f: number): void;
  setTo(x: number, y: number, tile: Tile): void; setTileValue(x: number, y: number, v: number): void;
  addTileFlags(x: number, y: number, f: number): void; removeTileFlags(x: number, y: number, f: number): void;
  setTileFlags(x: number, y: number, f: number): void; putZone(x: number, y: number, centre: number, size: number): void;
  save(data: Record<string, unknown>): void; load(data: Record<string, unknown>): void; changeCount(): number;
};

describe("the map's tiles as numbers", () => {
  test("a map of 480 x 480 tiles keeps them in one array of 16-bit numbers", () => {
    const map = new GameMap(480, 480) as unknown as Map;
    expect(map._cells).toBeInstanceOf(Uint16Array);
    expect(map._cells.length).toBe(480 * 480);
    expect(map.getTileValue(479, 479)).toBe(new Tile().getValue());
  });

  test("a tile asked for is the tile: it sees later changes, and its writes change the map", () => {
    const map = new GameMap(10, 8) as unknown as Map;
    const tile = map.getTile(3, 4);
    expect(tile).toBeInstanceOf(Tile);
    expect(tile).toBeInstanceOf(MapTile);
    map.setTile(3, 4, 300, CONDBIT | BURNBIT);
    expect(tile.getValue()).toBe(300);
    expect(tile.isConductive()).toBe(true);
    tile.addFlags(POWERBIT);
    expect(map.getTileFlags(3, 4)).toBe(CONDBIT | BURNBIT | POWERBIT);
    tile.setValue(301);
    expect(map.getTileValue(3, 4)).toBe(301);
    expect(map.rawTileAt(4 * 10 + 3)).toBe(301 | CONDBIT | BURNBIT | POWERBIT);
    // ... and its neighbours are untouched
    expect(map.getTileValue(2, 4)).toBe(new Tile().getValue());
    expect(map.getTileValue(3, 3)).toBe(new Tile().getValue());
  });

  test("every way of writing a tile writes its cell, and the flags and value stay apart", () => {
    const map = new GameMap(6, 6) as unknown as Map;
    map.setTileValue(1, 1, 44);
    map.addTileFlags(1, 1, BULLBIT | ZONEBIT);
    expect([map.getTileValue(1, 1), map.getTileFlags(1, 1)]).toEqual([44, BULLBIT | ZONEBIT]);
    map.removeTileFlags(1, 1, ZONEBIT);
    expect(map.getTileFlags(1, 1)).toBe(BULLBIT);
    map.setTileFlags(1, 1, POWERBIT);
    expect([map.getTileValue(1, 1), map.getTileFlags(1, 1)]).toEqual([44, POWERBIT]);
    // the highest value and every flag fit in 16 bits
    map.setTile(2, 2, BIT_MASK, ALLBITS);
    expect([map.getTileValue(2, 2), map.getTileFlags(2, 2)]).toEqual([BIT_MASK, ALLBITS]);
    // a tile put down is copied: changing it afterwards leaves the map alone
    const put = new Tile(55, BURNBIT);
    map.setTo(3, 3, put);
    put.setValue(56);
    expect(map.getTileValue(3, 3)).toBe(55);
    // a zone put down
    map.putZone(4, 4, 265, 3);
    expect([map.getTileValue(4, 4), map.getTile(4, 4).isZone(), map.getTile(3, 3).isZone()]).toEqual([265, true, false]);
    // writes out of the map still refuse
    expect(() => map.setTileValue(6, 0, 1)).toThrow();
    expect(() => map.setTile(0, 0, 2000, 0)).toThrow();
  });

  test("a tile copied into a scratch tile, as the map's scan does, gives the scratch tile back", () => {
    const map = new GameMap(4, 4) as unknown as Map;
    map.setTile(1, 2, 77, CONDBIT);
    const scratch = new Tile();
    expect(map.getTile(1, 2, scratch)).toBe(scratch);
    expect([scratch.getValue(), scratch.isConductive()]).toEqual([77, true]);
    // the scratch tile is a copy
    scratch.setValue(78);
    expect(map.getTileValue(1, 2)).toBe(77);
  });

  test("only a real change of a cell counts as a change", () => {
    const map = new GameMap(4, 4) as unknown as Map;
    map.setTile(0, 0, 66, 0);
    let before = map.changeCount();
    map.setTile(0, 0, 66, 0);
    map.setTo(0, 0, new Tile(66, 0));
    // (making a free tile counts, as it always did; putting it down unchanged does not)
    expect(map.changeCount()).toBe(before + 1);
    before = map.changeCount();
    map.getTile(1, 1);
    map.getTile(2, 2).getValue();
    expect(map.changeCount()).toBe(before);
    map.setTileValue(1, 1, 67);
    expect(map.changeCount()).toBe(before + 1);
  });

  test("a map saves and loads its tiles as before", () => {
    const map = new GameMap(5, 3) as unknown as Map;
    map.setTile(4, 2, 500, BULLBIT | POWERBIT);
    const data: Record<string, unknown> = {};
    map.save(data);
    expect((data.map as Array<{ value: number }>)[14]).toEqual({ value: 500 | BULLBIT | POWERBIT });
    const copy = new GameMap(5, 3) as unknown as Map;
    copy.load(data);
    expect(Array.from(copy._cells)).toEqual(Array.from(map._cells));
  });
});
