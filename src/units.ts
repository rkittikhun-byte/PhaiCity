/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Metres, map tiles and world units, in one place (docs/METRE_DRAWING_PLAN.md 0.2).
//
// A map tile is TILE_UNITS world units across in the 3D view and in every geometry the game works out (road lines,
// zone cells, building poses): the same on every map. How many metres a tile is depends on the map: a real-scale
// city map's tiles are 16 m (gameMap.tileSizeM, docs/CITY_SCALE.md), a whole-province map's hundreds of metres, and
// a map that does not say is drawn as if its tiles were 10 m, a world unit a metre.

/** World units a map tile (docs/3d/MODEL_SPEC.md TILE_M) */
export const TILE_UNITS = 10;
/** The tiles of a real-scale city map are this many metres or less (src/landBlocks.ts isCityMap) */
export const CITY_TILE_MAX_M = 40;
/** Metres a tile of a real-scale city map, for the code that works in cells and assumes one when the map does not say */
export const CITY_TILE_M = 16;
/** Metres a tile of a map that is not real-scale, as its roads and buildings are drawn: a world unit a metre */
export const DRAWN_TILE_M = TILE_UNITS;

/** Whether tiles this many metres across make a real-scale city map */
export const isCityTileSize = (tileSizeM?: number | null): boolean =>
  Boolean(tileSizeM && tileSizeM > 0 && tileSizeM <= CITY_TILE_MAX_M);

/** Metres a tile of this map, a city map's when it does not say */
export const tileMetres = (map: { readonly tileSizeM?: number | null }): number => map.tileSizeM || CITY_TILE_M;

/** World units a metre on a map of tiles this many metres across */
export const unitsPerMetre = (tileSizeM: number): number => TILE_UNITS / tileSizeM;
/** Metres a world unit on a map of tiles this many metres across */
export const metresPerUnit = (tileSizeM: number): number => tileSizeM / TILE_UNITS;

/** The tile a world coordinate lies in */
export const tileOfUnits = (units: number): number => Math.floor(units / TILE_UNITS);
/** A tile's near edge in world units */
export const unitsOfTile = (tile: number): number => tile * TILE_UNITS;
/** A tile's middle in world units */
export const tileMiddleUnits = (tile: number): number => (tile + 0.5) * TILE_UNITS;
