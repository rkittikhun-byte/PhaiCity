/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The road tiles the simulation reads, made from the roads as drawn (docs/METRE_DRAWING_PLAN.md 4.4, step 1.2).
//
// Each segment's middle line is walked in short steps; every tile it passes through is a road tile, and where it steps
// from one tile to a diagonal neighbour the corner tile nearer the line is taken too, so a road on the screen is always
// a chain of tiles joined side to side: power, water and trips go along it as they do along a road laid tile by tile
// (src/powerManager.js, src/waterManager.ts, src/traffic.js all step north, east, south and west). A tile takes the
// highest level and the lowest piece of the roads through it. Plain code, no DOM, the same tiles every time.

import type { RoadGraph, Vec } from "./roadGraph";

export interface RoadTile {
  /** The highest level of the roads through it (src/roadLevels.ts) */
  level: number;
  /** The piece of the first road through it (src/roadPieces.ts), 0 for none */
  piece: number;
  /** Whether every road through it is the state's */
  national: boolean;
  /** The segments through it, by id */
  segments: number[];
}

export interface RasterMap {
  readonly width: number;
  readonly height: number;
  /** Metres a tile */
  readonly tileSizeM: number;
}

/** Steps a tile's width is walked in along a road's middle line */
const STEPS_A_TILE = 4;

/** The tiles a segment passes through, in order from its node a, joined side to side (tile index y * width + x) */
export function segmentTiles(graph: RoadGraph, id: number, map: RasterMap): number[] {
  const size = map.tileSizeM, step = size / STEPS_A_TILE;
  const pts = graph.polyline(id, step);
  const tiles: number[] = [];
  let last: [number, number] | null = null, lastPoint: Vec | null = null;
  const push = (tx: number, ty: number): void => {
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
    const i = ty * map.width + tx;
    if (tiles[tiles.length - 1] !== i) tiles.push(i);
  };
  const walk = (p: Vec): void => {
    const tx = Math.floor(p[0] / size), ty = Math.floor(p[1] / size);
    if (last && (tx !== last[0] || ty !== last[1])) {
      // From one tile to the next along the line: a diagonal step goes by the corner tile nearer the line
      const dx = Math.sign(tx - last[0]), dy = Math.sign(ty - last[1]);
      let cx = last[0], cy = last[1];
      while (cx !== tx || cy !== ty) {
        if (cx !== tx && cy !== ty) {
          const a: Vec = [(cx + dx + 0.5) * size, (cy + 0.5) * size], b: Vec = [(cx + 0.5) * size, (cy + dy + 0.5) * size];
          if (offLine(a, lastPoint!, p) <= offLine(b, lastPoint!, p)) cx += dx; else cy += dy;
        } else if (cx !== tx) cx += dx;
        else cy += dy;
        push(cx, cy);
      }
    } else push(tx, ty);
    last = [tx, ty];
    lastPoint = p;
  };
  // A short step at a time, never jumping a tile: a curve's points are a step apart, a line's two ends are not
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { walk(pts[0]); continue; }
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) walk([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return tiles;
}

/** How far inside a tile the middle line must run for the tile to be one the road cannot stand without (metres) */
const DEEP_M = 0.5;
/** Steps the middle line is looked at in for the tiles it runs deep into (metres) */
const DEEP_STEP_M = 0.25;

/**
 * The tiles a segment's middle line runs at least DEEP_M into (tile index), whatever it was cut from: the tiles of a
 * piece of a road are among those laid for the road it was cut from (segmentTiles of the whole), where the corner
 * tiles of their staircase may not be (they follow the points the line is looked at in, which a cut moves)
 */
export function deepTiles(graph: RoadGraph, id: number, map: RasterMap): number[] {
  const size = map.tileSizeM, n = Math.max(2, Math.ceil(graph.length(id) / DEEP_STEP_M)), out = new Set<number>();
  for (let k = 0; k <= n; k++) {
    const [x, z] = graph.pointAt(id, k / n), tx = Math.floor(x / size), ty = Math.floor(z / size);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    if (Math.min(x - tx * size, (tx + 1) * size - x, z - ty * size, (ty + 1) * size - z) < DEEP_M) continue;
    out.add(ty * map.width + tx);
  }
  return [...out];
}

/**
 * Whether a segment still lies on tiles of its kind (isKind: a road, a railway, a canal's water): every tile it was
 * laid on (segmentTiles), or for a piece of one cut where another road met it, every tile it runs deep into. A road
 * a flood or the bulldozer took a tile of does not stand.
 */
export function segmentStands(graph: RoadGraph, id: number, map: RasterMap, isKind: (i: number) => boolean): boolean {
  const tiles = segmentTiles(graph, id, map);
  if (tiles.length > 0 && tiles.every(isKind)) return true;
  // ... a piece too short to run deep into any tile standing while one of its tiles is still of its kind
  const deep = deepTiles(graph, id, map);
  return deep.every(isKind) && (deep.length > 0 || tiles.some(isKind));
}

/** How far a point lies from the straight line through a and b */
function offLine(p: Vec, a: Vec, b: Vec): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  if (len < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / len;
}

/** Every road tile of the graph, by tile index in increasing order */
export function rasterize(graph: RoadGraph, map: RasterMap): Map<number, RoadTile> {
  const out = new Map<number, RoadTile>();
  const ids = [...graph.segments.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = graph.segment(id);
    for (const i of segmentTiles(graph, id, map)) {
      const tile = out.get(i);
      if (!tile) {
        out.set(i, { level: s.level, piece: s.piece ?? 0, national: Boolean(s.national), segments: [id] });
        continue;
      }
      tile.level = Math.max(tile.level, s.level);
      if (!tile.piece && s.piece) tile.piece = s.piece;
      tile.national = tile.national && Boolean(s.national);
      if (!tile.segments.includes(id)) tile.segments.push(id);
    }
  }
  return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
}
