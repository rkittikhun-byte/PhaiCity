/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bulldozer on roads drawn in metres (docs/METRE_DRAWING_PLAN.md, step 1's leftovers): a tile it clears is cut out
// of every road (or railway) of the graph that runs over it, the parts either side staying exactly where they were,
// their new ends just inside the tiles beside it. Clearing a road's tiles one after another takes the whole line, a
// stretch of them cuts that span out, and what is left is still drawn as drawn (src/roads/graphLines.ts), not read
// from its tiles again. Plain code, no DOM: metres from the map's corner.

import type { RoadGraph } from "./roadGraph";

/** How far past the cleared tile the cut reaches (metres), so a cut road's end lies on the tile beside it */
const PAST_M = 0.25;
/** Steps along a road looked at for where it enters and leaves the tile (metres) */
const STEP_M = 0.25;
/** A span shorter than this (metres) is an end left on the box's edge by an earlier cut (its node to the millimetre) */
const SLIVER_M = 0.01;

/** Where a segment first runs over a box (metres, x0 z0 x1 z1): t from and to (0 to 1), or null */
export function spanOver(graph: RoadGraph, id: number, box: readonly [number, number, number, number]): [number, number] | null {
  const [x0, z0, x1, z1] = box;
  const inside = (t: number): boolean => {
    const [x, z] = graph.pointAt(id, t);
    return x >= x0 && x <= x1 && z >= z0 && z <= z1;
  };
  const steps = Math.max(8, Math.ceil(graph.length(id) / STEP_M));
  let first = -1;
  for (let i = 0; i <= steps; i++) if (inside(i / steps)) { first = i; break; }
  if (first < 0) return null;
  let last = first;
  while (last < steps && inside((last + 1) / steps)) last++;
  // Where it crosses the box's edge, between a step outside and the next inside: the last point outside, so what is
  // left of the road ends just outside the box
  const edge = (out: number, into: number): number => {
    let lo = out, hi = into;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2;
      if (inside(m)) hi = m; else lo = m;
    }
    return lo;
  };
  return [first === 0 ? 0 : edge((first - 1) / steps, first / steps), last === steps ? 1 : edge((last + 1) / steps, last / steps)];
}

/**
 * Cuts the tile (tx, ty) of tiles tileSizeM metres across out of every segment of the graph that runs over it; whether
 * anything was cut. A segment wholly over it goes.
 */
export function cutTile(graph: RoadGraph, tx: number, ty: number, tileSizeM: number): boolean {
  const box: [number, number, number, number] = [tx * tileSizeM - PAST_M, ty * tileSizeM - PAST_M,
    (tx + 1) * tileSizeM + PAST_M, (ty + 1) * tileSizeM + PAST_M];
  const middle: [number, number] = [(tx + 0.5) * tileSizeM, (ty + 0.5) * tileSizeM];
  let cut = false;
  // One span at a time: a cut gives its segment's parts new ids, so the segments near are looked for again
  for (let guard = 0; guard < 64; guard++) {
    let found: { id: number; span: [number, number] } | null = null;
    for (const id of graph.segmentsNear(middle, tileSizeM).sort((p, q) => p - q)) {
      const span = spanOver(graph, id, box);
      if (span && (span[1] - span[0]) * graph.length(id) >= SLIVER_M) { found = { id, span }; break; }
    }
    if (!found) break;
    graph.cut(found.id, found.span[0], found.span[1]);
    cut = true;
  }
  return cut;
}
