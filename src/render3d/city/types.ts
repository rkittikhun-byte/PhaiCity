/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import type { DistrictPlace, ProvinceBackdrop } from './provinceBackdrop.js';
import type { RegionId } from '../regional/types.js';
import type { Street } from '../../streetNames.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
export interface CityMapReader {
  readonly width: number; readonly height: number;
  readonly insideProvince?: Uint8Array | null;
  readonly town?: { readonly x: number; readonly y: number } | null;
  readonly heights?: Float32Array | null;
  readonly tileSizeM?: number | null;
  /** Homes, shops and factories painted tile by tile (src/plots.ts), and each road tile's level (src/roadLevels.ts) */
  readonly paintedZones?: boolean;
  readonly roadLevels?: Uint8Array | null;
  /** The drawn line each road tile was laid by (src/roadPieces.ts, RENDERER_SPEC 6G): the roads' lines are smoothed a
   * line at a time, so building on never moves an older road */
  readonly roadPieces?: Uint16Array | null;
  /** How many times any tile has changed (src/gameMap.js changeCount): the view skips its look over the map while it
   * stays the same */
  changeCount?(): number;
  /** A tile's value and flags together by its index (src/gameMap.js rawTileAt), quicker than by x and y */
  rawTileAt?(index: number): number;
  /** ... and the tiles each piece was drawn along (src/roadPieces.ts RoadPath), which set its shape for good */
  readonly roadPaths?: Readonly<Record<number, { from: number; to: number; tiles: readonly number[] }>> | null;
  /** The roads and railways as drawn, in metres (src/roads/roadGraph.ts, docs/METRE_DRAWING_PLAN.md): the view draws
   * them exactly from these, and only the roads that are tiles alone from their tiles */
  readonly roadGraph?: RoadGraph | null;
  readonly railGraph?: RoadGraph | null;
  /** The ruler's buildings where they were put down, in metres (src/buildings/placedBuildings.ts): the view stands each
   * model at its middle and turn, by its centre tile */
  readonly buildings?: {
    atTile(tile: number): { readonly x: number; readonly z: number; readonly rot: number | null } | undefined;
    /** Every one, and a count of the changes made to them (a move), so the view stands a moved one again */
    all?(): ReadonlyArray<{ readonly tile: number; readonly x: number; readonly z: number; readonly rot: number | null }>;
    readonly version?: number;
  } | null;
  /** What covers each open tile of a real-scale city map (scripts/geo/lib/landCover.mjs): 1 paddy, 2 field, 3 orchard,
   * 4 grass, 5 wetland, 6 village, 7 built-up; 0 none */
  readonly landCover?: Uint8Array | null;
  /** What stands on each civic 3 × 3, by its centre's index, and the ruler's house (RENDERER_SPEC 6H) */
  readonly civicKinds?: Readonly<Record<string, string>> | null;
  readonly rulerHouse?: { readonly x: number; readonly y: number; readonly level: number; readonly wings?: readonly string[] } | null;
  /** What stands on each rubbish or wastewater 3 × 3, by its centre's index (RENDERER_SPEC 6I): landfill, incinerator, recycling_plant, waste_power_plant, wastewater_plant; none is a landfill */
  readonly wasteKinds?: Readonly<Record<string, string>> | null;
  readonly powerKinds?: Readonly<Record<string, string>> | null;
  readonly mineKinds?: Readonly<Record<string, string>> | null;
  readonly stationKinds?: Readonly<Record<string, string>> | null;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
}
export interface BlockMapReader { readonly blockSize: number; worldGet(x: number, y: number): number }
export interface CityViewSetup {
  container: HTMLElement; map: CityMapReader; region: RegionId;
  overlays: { trafficDensityMap: BlockMapReader; pollutionDensityMap: BlockMapReader; landValueMap: BlockMapReader };
  date(): { month: number; year: number };
  roadLevel?: 1 | 2 | 3 | ((x: number, y: number) => 1 | 2 | 3);
  /** The province's wind level, 0–5 (src/geo/provinceResources.ts), for how hard the trees sway (src/wind.ts) */
  windLevel?: number;
  /** A street's name in the player's language (src/streetNames.ts); without it the view writes no names */
  streetName?: (street: Street) => string;
  /** The whole province round a district's map, for zooming out over all of it (provinceBackdrop.ts) */
  province?: { backdrop: ProvinceBackdrop; district: DistrictPlace } | null;
}
/** Everything the city view stands on the map: one class, and a class below it for each way of standing (placement.ts) */
export { Placement, RoadsidePlacement } from './placement.js';
export type { PlacementFields } from './placement.js';
export const CHUNK_TILES = 16;
export const SEED_BUCKETS = 4;
