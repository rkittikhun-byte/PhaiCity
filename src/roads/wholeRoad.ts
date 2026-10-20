/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The road under the mouse from junction to junction (docs/METRE_DRAWING_PLAN.md, step 1's leftovers), for the
// upgrade tool's whole-road mode: a segment of the roads drawn in metres, its tiles as the road command laid them
// (src/roads/roadRaster.ts), or a stretch of a road that is only tiles (src/roadGeometry.ts networkOf). Plain code.

import { networkOf } from "../roadGeometry";
import { isRoadTile } from "../roadTiles";
import { tileMetres } from "../units";
import type { RoadGraph } from "./roadGraph";
import { segmentTiles } from "./roadRaster";

export interface WholeRoadMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadGraph?: RoadGraph | null;
  readonly roadLevels?: Uint8Array | null;
  readonly roadPieces?: Uint16Array | null;
  readonly roadPaths?: Readonly<Record<number, { from: number; to: number; tiles: readonly number[] }>> | null;
  getTileValue(x: number, y: number): number;
}

/**
 * The road tiles of the road at (x, z) metres, on tile (tx, ty): the drawn road within a tile of the point, else the
 * stretch of tile road on that tile; their indices, none when no road is there.
 */
export function wholeRoadTiles(map: WholeRoadMap, x: number, z: number, tx: number, ty: number): number[] {
  const { width, height } = map, size = tileMetres(map);
  const value = (i: number): number => map.getTileValue(i % width, Math.floor(i / width));
  const isRoad = (i: number): boolean => isRoadTile(value(i));
  const graph = map.roadGraph;
  const near = graph?.segments.size ? graph.nearest([x, z], size) : null;
  if (graph && near) return segmentTiles(graph, near.segment, { width, height, tileSizeM: size }).filter(isRoad);
  if (tx < 0 || ty < 0 || tx >= width || ty >= height || !isRoad(ty * width + tx)) return [];
  const index = ty * width + tx, levels = map.roadLevels, pieces = map.roadPieces, paths = map.roadPaths;
  const network = networkOf({ width, height, value, level: (i) => levels?.[i] ?? 1, piece: (i) => pieces?.[i] ?? 0,
    path: (p) => paths?.[p] ?? null }, false);
  const stretch = network.stretches.find((s) => s.tiles.includes(index));
  return stretch ? stretch.tiles.filter(isRoad) : [index];
}
