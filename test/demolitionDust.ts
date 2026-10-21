/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { GameMap } from '../src/gameMap.js';
import { MapScanner } from '../src/mapScanner.js';
import { MiscTiles } from '../src/miscTiles.js';
import { Random } from '../src/random.js';
import { ANIMBIT, BULLBIT } from '../src/tileFlags.js';
import { LASTRUBBLE, PLANT3_BASE, PLANT3_LAST, RUBBLE, TINYEXP, TINYEXPLAST } from '../src/tileValues.js';
import { TILE_TABLE } from '../src/render3d/city/tileModels.js';

describe('demolition dust (owner, 19 Oct 2026: white boxes where something was bulldozed)', () => {
  it('settles into rubble when the map scan comes by, whatever draws the city', () => {
    Random.seed(7);
    const map = new GameMap(8, 8);
    map.setTile(2, 3, TINYEXP, ANIMBIT | BULLBIT);
    map.setTile(5, 5, TINYEXPLAST, ANIMBIT | BULLBIT);
    const scanner = new MapScanner(map);
    MiscTiles.registerHandlers(scanner, null);
    scanner.mapScan(0, map.width, {} as never);
    for (const [x, y] of [[2, 3], [5, 5]]) {
      const value = map.getTileValue(x, y);
      expect(value).toBeGreaterThanOrEqual(RUBBLE);
      expect(value).toBeLessThanOrEqual(LASTRUBBLE);
    }
  });

  it('is drawn in 3D as the rubble it becomes, never as the test box', () => {
    // (but for the 3 x 3 power plant's tiles, which lie among them: src/plantBlocks.ts)
    for (let value = 860; value <= 883; value++) {
      if (value >= PLANT3_BASE && value <= PLANT3_LAST) expect(TILE_TABLE[value].footprint).toEqual([3, 3]);
      else expect(TILE_TABLE[value].id).toBe('terrain.rubble');
    }
    for (let value = 56; value <= 63; value++) expect(TILE_TABLE[value].id).toBe('terrain.rubble');
  });
});
