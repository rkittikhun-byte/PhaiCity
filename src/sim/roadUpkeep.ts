/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Road upkeep by length (docs/NO_GRID_PLAN.md 1.1). The original game paid upkeep for each road tile its scan found, so
// a slanted road, a staircase of tiles, cost about 1.4 times as much as a straight one as long. On a real-scale city map
// every road is in the road graph (src/roads/roadCover.ts), and a road's upkeep is its length in tiles (metres over a
// tile's size) times its level's upkeep (src/roadLevels.ts), the levels of the tiles it lies on (the upgrade tool raises
// tiles) weighed as many as there are. The state's roads cost the city nothing. Plain code, no DOM.

import { segmentTiles } from "../roads/roadRaster";
import type { RoadGraph, RoadSegment } from "../roads/roadGraph";
import { isRoadTile, MAX_ROAD_LEVEL, roadSpec } from "../roadLevels";
import { isCityTileSize } from "../units";

export interface UpkeepMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadGraph?: RoadGraph | null;
  readonly roadLevels?: Uint8Array | null;
  getTileValue(x: number, y: number): number;
}

/** Each segment's tiles and length, by the segment itself: one never changes its shape (a cut or a split makes new
 * ones) */
const known = new WeakMap<RoadSegment, { tiles: number[]; length: number }>();

/** A segment's tiles (src/roads/roadRaster.ts segmentTiles) and its length (metres), worked out once */
export function segmentShape(graph: RoadGraph, segment: RoadSegment, raster: { width: number; height: number; tileSizeM: number }):
  { tiles: number[]; length: number } {
  let seen = known.get(segment);
  if (!seen) known.set(segment, seen = { tiles: segmentTiles(graph, segment.id, raster), length: graph.length(segment.id) });
  return seen;
}

/** The level a segment works at: the level most of the road tiles it lies on are at (the upgrade tool raises tiles;
 * the higher of two as many), else the level it was drawn at */
export function segmentLevel(map: UpkeepMap, graph: RoadGraph, segment: RoadSegment): number {
  const { tiles } = segmentShape(graph, segment, { width: map.width, height: map.height, tileSizeM: map.tileSizeM ?? 16 });
  const counts = new Array(MAX_ROAD_LEVEL + 1).fill(0);
  let any = false;
  for (const i of tiles) {
    const x = i % map.width, y = (i - x) / map.width;
    if (!isRoadTile(map.getTileValue(x, y))) continue;
    const level = map.roadLevels?.[i] ?? 0;
    counts[level >= 1 && level <= MAX_ROAD_LEVEL ? level : segment.level]++;
    any = true;
  }
  if (!any) return segment.level;
  let best = segment.level;
  for (let level = 1; level <= MAX_ROAD_LEVEL; level++) if (counts[level] >= counts[best]) best = level;
  return best;
}

/**
 * The upkeep of a real-scale city map's own roads, in the units the census counts it (a tile of laterite 0.5, of
 * asphalt 1 …), from their lengths in the road graph; null on any other map, whose roads are counted a tile at a time
 * (src/road.js).
 */
export function roadUpkeepByLength(map: UpkeepMap): number | null {
  const graph = map.roadGraph, size = map.tileSizeM;
  if (!graph || !size || !isCityTileSize(size)) return null;
  const raster = { width: map.width, height: map.height, tileSizeM: size };
  let total = 0;
  for (const segment of graph.segments.values()) {
    if (segment.national) continue;
    const seen = segmentShape(graph, segment, raster), tiles = seen.tiles;
    // The upkeep of its level, by the levels of the road tiles it lies on
    let sum = 0, count = 0;
    for (const i of tiles) {
      const x = i % map.width, y = (i - x) / map.width;
      if (!isRoadTile(map.getTileValue(x, y))) continue;
      const level = map.roadLevels?.[i] ?? 0;
      sum += roadSpec(level >= 1 && level <= MAX_ROAD_LEVEL ? level : segment.level).upkeep;
      count++;
    }
    total += seen.length / size * (count ? sum / count : roadSpec(segment.level).upkeep);
  }
  return total;
}
