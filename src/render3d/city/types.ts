/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import type { RegionId } from '../regional/types.js';
import type { ModelOptions } from '../models/registry.js';
export interface CityMapReader {
  readonly width: number; readonly height: number;
  readonly insideProvince?: Uint8Array | null;
  readonly town?: { readonly x: number; readonly y: number } | null;
  readonly heights?: Float32Array | null;
  readonly tileSizeM?: number | null;
  /** Homes, shops and factories painted tile by tile (src/plots.ts), and each road tile's level (src/roadLevels.ts) */
  readonly paintedZones?: boolean;
  readonly roadLevels?: Uint8Array | null;
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
}
export interface Placement {
  index: number; x: number; z: number; id: string | null; options: ModelOptions; rotation: number;
  footprint: readonly [number, number]; height: number; color: number; kind: string; water: boolean;
  scale: number; powered: boolean;
  baseY?: number; outside?: boolean;
}
export const CHUNK_TILES = 16;
export const SEED_BUCKETS = 4;
