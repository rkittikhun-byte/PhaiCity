/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The police's and the fire brigade's cover by the distance along the roads from their station (docs/NO_GRID_PLAN.md
// 4.3). On a real-scale city map micropolisJS put each station's strength into the 128 m block it stood in and smoothed
// the blocks three times, so a station covered a square of blocks whichever way the roads went, across a river or a
// railway with no bridge as well as down its own street. Here each station's cover starts on the roads beside it and runs
// along them (the road graph, src/sim/roadNetwork.ts), falling smoothly to nothing COVER_REACH_M along the roads; a
// block is covered from the nearest road tile within a plot's reach of its middle, by that tile's distance and the
// straight way from it. Several stations' cover adds up, as their smoothed strengths did. The block maps keep it, so
// crime, fire and the layers read it as before.
//
// Only + - x / and the roads' lengths decide it, so every machine makes the same city. Plain code, no DOM.

import type { RoadGraph } from "../roads/roadGraph";
import { roadNet, type RoadNet } from "./roadNetwork";
import { roadsMet } from "./roadAccess";
import { segmentShape } from "./roadUpkeep";
import type { FootprintMap } from "../buildings/turnedFootprint";

/** How far along the roads a station's cover reaches (metres): about where micropolisJS's three passes had all but
 * spent it, its 128 m block and the next round it */
export const COVER_REACH_M = 320;
/** The cover at the station's own road, a share of its strength (the old passes left about a third in its block) */
export const COVER_PEAK = 0.31;
/** How far off its road a block is covered from (metres): a plot's reach (src/plots.ts PLOT_REACH, 3 tiles) */
export const COVER_OFF_ROAD_M = 48;

/** A station: its centre tile, its size in tiles, and its strength (its budget's share, its level, its power) */
export interface Station { centre: number; size: number; effect: number }

/** What of the map the cover reads */
export interface CoverMap extends FootprintMap {
  readonly roadGraph?: RoadGraph | null;
  readonly tileSizeM?: number | null;
}

/** What it writes: a block map (src/blockMap.ts) */
export interface CoverBlocks {
  readonly width: number;
  readonly height: number;
  readonly blockSize: number;
  clear(): void;
  set(x: number, y: number, value: number): void;
}

/** The cover a station gives at `metres` along the roads from it, a share of its strength */
export function coverAt(metres: number): number {
  if (metres >= COVER_REACH_M) return 0;
  const fall = 1 - (metres * metres) / (COVER_REACH_M * COVER_REACH_M);
  return COVER_PEAK * fall * fall;
}

/** The distance along the roads from the starts to every node within `limit` metres (Infinity past it) */
export function roadDistances(net: RoadNet, starts: ReadonlyArray<{ k: number; t: number; d: number }>, limit: number): Float64Array {
  const n = net.x.length, dist = new Float64Array(n).fill(Infinity);
  const heapD: number[] = [], heapN: number[] = [];
  const push = (d: number, node: number): void => {
    if (d >= dist[node] || d > limit) return;
    dist[node] = d;
    let i = heapD.length;
    heapD.push(d); heapN.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapD[p] <= d) break;
      heapD[i] = heapD[p]; heapN[i] = heapN[p]; i = p;
    }
    heapD[i] = d; heapN[i] = node;
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heapD[0], heapN[0]], d = heapD.pop()!, node = heapN.pop()!;
    if (heapD.length) {
      let i = 0;
      for (;;) {
        const a = 2 * i + 1, b = a + 1;
        let m = i, md = d;
        if (a < heapD.length && heapD[a] < md) { m = a; md = heapD[a]; }
        if (b < heapD.length && heapD[b] < md) { m = b; md = heapD[b]; }
        if (m === i) break;
        heapD[i] = heapD[m]; heapN[i] = heapN[m]; i = m;
      }
      heapD[i] = d; heapN[i] = node;
    }
    return top;
  };
  for (const s of starts) {
    push(s.d + s.t * net.length[s.k], net.segA[s.k]);
    push(s.d + (1 - s.t) * net.length[s.k], net.segB[s.k]);
  }
  while (heapD.length) {
    const [d, node] = pop();
    if (d > dist[node]) continue;
    for (let w = net.offsets[node]; w < net.offsets[node + 1]; w++) push(d + net.length[net.waySegment[w]], net.wayTo[w]);
  }
  return dist;
}

/**
 * Every station's cover, added up, at each block of `blocks` (cleared first): by the distance along the roads from the
 * station to the nearest road tile within COVER_OFF_ROAD_M of the block's middle and the straight way from there. A
 * station that meets no road covers only round itself, as far off as a block is covered from a road.
 */
export function coverAlongRoads(map: CoverMap, stations: readonly Station[], blocks: CoverBlocks): void {
  blocks.clear();
  if (!stations.length) return;
  const graph = map.roadGraph, tile = map.tileSizeM || 16, width = map.width, height = map.height;
  const bs = blocks.blockSize, blockM = bs * tile, off = COVER_OFF_ROAD_M;
  const sums = new Float64Array(blocks.width * blocks.height);
  const net = graph && graph.segments.size ? roadNet(graph) : null;
  const raster = { width, height, tileSizeM: tile };
  for (const station of stations) {
    if (station.effect <= 0) continue;
    // The road tiles this station reaches and how far along the roads, nearest first per tile
    const reached = new Map<number, number>();
    const met = net ? roadsMet(map, station.centre, station.size) : [];
    if (net && met.length) {
      const starts = met.map((m) => ({ k: net.segmentIndex.get(m.segment) ?? -1, t: m.t, d: m.distance })).filter((s) => s.k >= 0);
      const dist = roadDistances(net, starts, COVER_REACH_M);
      for (let k = 0; k < net.segmentIds.length; k++) {
        const da = dist[net.segA[k]], db = dist[net.segB[k]];
        // (a segment the station stands on is reached from its middle, though neither end may be)
        const own = starts.find((s) => s.k === k);
        if (da === Infinity && db === Infinity && !own) continue;
        const seg = graph!.segment(net.segmentIds[k]), tiles = segmentShape(graph!, seg, raster).tiles, length = net.length[k];
        tiles.forEach((t, i) => {
          const along = ((i + 0.5) / tiles.length) * length;
          let d = Math.min(da + along, db + length - along);
          if (own) d = Math.min(d, own.d + Math.abs(along - own.t * length));
          if (d < COVER_REACH_M && d < (reached.get(t) ?? Infinity)) reached.set(t, d);
        });
      }
    } else {
      reached.set(station.centre, 0);
    }
    // ... and each block within a plot's reach of those tiles, by the nearest way
    const best = new Map<number, number>();
    for (const [t, d] of reached) {
      const tx = t % width, ty = (t - tx) / width, px = (tx + 0.5) * tile, pz = (ty + 0.5) * tile;
      const b0x = Math.max(0, Math.floor((px - off) / blockM)), b1x = Math.min(blocks.width - 1, Math.floor((px + off) / blockM));
      const b0z = Math.max(0, Math.floor((pz - off) / blockM)), b1z = Math.min(blocks.height - 1, Math.floor((pz + off) / blockM));
      for (let bz = b0z; bz <= b1z; bz++) for (let bx = b0x; bx <= b1x; bx++) {
        const dx = (bx + 0.5) * blockM - px, dz = (bz + 0.5) * blockM - pz, straight2 = dx * dx + dz * dz;
        if (straight2 > off * off) continue;
        const total = d + Math.sqrt(straight2), k = bz * blocks.width + bx;
        if (total < (best.get(k) ?? Infinity)) best.set(k, total);
      }
    }
    for (const [k, d] of best) sums[k] += station.effect * coverAt(d);
  }
  for (let bz = 0; bz < blocks.height; bz++) for (let bx = 0; bx < blocks.width; bx++) {
    const v = Math.floor(sums[bz * blocks.width + bx]);
    if (v > 0) blocks.set(bx, bz, v);
  }
}
