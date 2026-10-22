/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which roads a building meets (docs/NO_GRID_PLAN.md 2.1): on a real-scale city map every building of the ruler's, every
// power plant and water works and every old 3 x 3 zone touches the roads of the road graph whose middle line comes within
// a tile of its outline: its turned outline where it was laid turned (src/buildings/turnedFootprint.ts), else its square
// block. The power and the water come in and go out there (src/sim/cityUtilities.ts). The plots find theirs as their
// trips do (src/plots.ts plotAccess). Worked out from the building and the graph as they are, not kept: a road drawn or
// cut changes them, and the save needs nothing new. Plain code, no DOM.

import { laidOutline, outlineOf, outsideBy, type FootprintMap, type Outline } from "../buildings/turnedFootprint";
import type { RoadGraph } from "../roads/roadGraph";
import { AIRPORT, FULLSTADIUM, NUCLEAR, PLANT2, PLANT3, PORT, POWERPLANT, STADIUM, WATER_TOWER } from "../tileValues";

/** How far beyond a building's outline a road's middle line may lie for the building to meet it (metres): a road on
 * the tile beside it, its middle line half a tile out, and a little for a line smoothed from a staircase of tiles */
export const MEET_M = 12;

/** Where a building meets a road: the segment (id), how far along it (0 at its node a, 1 at b), and how far beyond the
 * building's outline the road's middle line lies there (metres) */
export interface RoadMeet { segment: number; t: number; distance: number }

/** Tiles a side of the building whose centre tile has this value: the old 4 x 4s, the airport's 6 x 6, the sized plants
 * (src/plantBlocks.ts), a water tower's one tile, and 3 for every other (the zones, the ruler's 3 x 3s) */
export function centreSize(value: number): number {
  if (value === POWERPLANT || value === NUCLEAR || value === PORT || value === STADIUM || value === FULLSTADIUM) return 4;
  if (value === AIRPORT) return 6;
  if (value === PLANT2) return 2;
  if (value === WATER_TOWER) return 1;
  if (value === PLANT3) return 3;
  return 3;
}

/** The tiles (indices) of the square block of a building of `size` whose centre tile is `centre` (one in from its top
 * left, the tile itself for one tile), on the map */
export function blockTiles(centre: number, size: number, width: number, height: number): number[] {
  const corner = size > 1 ? 1 : 0, left = centre % width - corner, top = Math.floor(centre / width) - corner, out: number[] = [];
  for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) {
    if (x >= 0 && y >= 0 && x < width && y < height) out.push(y * width + x);
  }
  return out;
}

/** A building's outline in metres: as it was laid turned, else its square block */
export function footprintOutline(map: FootprintMap, centre: number, size: number): Outline {
  const b = map.buildings?.atTile(centre);
  const turned = b && b.size === size ? laidOutline(map, b) : null;
  if (turned) return turned;
  const t = map.tileSizeM || 16, corner = size > 1 ? 1 : 0;
  const left = centre % map.width - corner, top = Math.floor(centre / map.width) - corner;
  return outlineOf((left + size / 2) * t, (top + size / 2) * t, 0, size, t);
}

/** The roads a building meets, worked out again when the graph or the buildings change: by graph */
const known = new WeakMap<RoadGraph, { version: number; buildings: number; at: Map<string, RoadMeet[]> }>();

/** How far apart the points a segment is tested at lie (metres) */
const STEP_M = 2;

/**
 * The roads a building meets, nearest first (ties by segment id): every segment of the graph whose middle line comes
 * within MEET_M of its outline, where along it it comes nearest.
 */
export function roadsMet(map: FootprintMap & { roadGraph?: RoadGraph | null }, centre: number, size: number): RoadMeet[] {
  const graph = map.roadGraph;
  if (!graph || !graph.segments.size) return [];
  const buildings = map.buildings?.version ?? 0;
  let cache = known.get(graph);
  if (!cache || cache.version !== graph.version || cache.buildings !== buildings) {
    known.set(graph, cache = { version: graph.version, buildings, at: new Map() });
  }
  const key = `${centre}:${size}`, had = cache.at.get(key);
  if (had) return had;
  const o = footprintOutline(map, centre, size), out: RoadMeet[] = [];
  for (const id of graph.segmentsNear([o.x, o.z], o.half * Math.SQRT2 + MEET_M)) {
    const length = graph.length(id), n = Math.max(1, Math.ceil(length / STEP_M));
    let best = Infinity, bestT = 0;
    for (let j = 0; j <= n; j++) {
      const [px, pz] = graph.pointAt(id, j / n), d = outsideBy(o, px, pz);
      if (d < best) { best = d; bestT = j / n; }
    }
    if (best <= MEET_M) out.push({ segment: id, t: bestT, distance: Math.max(0, best) });
  }
  out.sort((a, b) => a.distance - b.distance || a.segment - b.segment);
  cache.at.set(key, out);
  return out;
}
