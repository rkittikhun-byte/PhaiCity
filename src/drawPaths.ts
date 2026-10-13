/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The tiles a drawn road, railway or power line covers (owner 13 Oct 2026, docs/ZONE_PAINT.md): a straight line
// between two clicks, a curve bent by one or two more, or a grid across a dragged rectangle, as Cities: Skylines draws
// them. The map is tiles, so every line is a chain of tiles each beside the last (never a diagonal step, which roads
// cannot join across); the 3D view then smooths their staircases into diagonals and curves
// (src/render3d/models/road/centreline.ts). Plain geometry, no DOM.

import type { TilePoint } from "./cityView";

/** The most tiles one drawn line lays */
export const MAX_PATH = 2000;
/** Tiles from one road of a grid to the next: a road and three plots deep on each side (src/plots.ts PLOT_REACH) */
export const GRID_SPACING = 7;

/** The tiles of a straight line from a to b, both ends included, each beside the last. */
export function linePath(a: TilePoint, b: TilePoint): TilePoint[] {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  const tiles = [{ x: a.x, y: a.y }];
  let x = a.x, y = a.y, ix = 0, iy = 0;
  // Step across or down, whichever keeps the chain nearer the true line
  while ((ix < dx || iy < dy) && tiles.length < MAX_PATH) {
    if ((0.5 + ix) * dy < (0.5 + iy) * dx) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    tiles.push({ x, y });
  }
  return tiles;
}

/** A point on the Bézier curve through these control points at t (0–1), by de Casteljau. */
function bezier(points: readonly TilePoint[], t: number): { x: number; y: number } {
  let level = points.map((p) => ({ x: p.x, y: p.y }));
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => ({ x: level[i].x + (p.x - level[i].x) * t, y: level[i].y + (p.y - level[i].y) * t }));
  }
  return level[0];
}

/**
 * The tiles of the curve from the first point to the last, bent towards the ones between (one bend: a simple curve,
 * two: an S or a sweeping curve). Two points make a straight line.
 */
export function curvePath(points: readonly TilePoint[]): TilePoint[] {
  if (points.length === 0) return [];
  if (points.length <= 2) return linePath(points[0], points[points.length - 1]);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const steps = Math.max(2, Math.ceil(length * 3));
  const tiles: TilePoint[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i <= steps && tiles.length < MAX_PATH; i++) {
    const p = bezier(points, i / steps);
    const tile = { x: Math.round(p.x), y: Math.round(p.y) };
    const last = tiles[tiles.length - 1];
    if (tile.x !== last.x || tile.y !== last.y) tiles.push(...linePath(last, tile).slice(1));
  }
  return tiles.slice(0, MAX_PATH);
}

/** The tiles of a grid of lines across the rectangle from a to b: its edges, and a line every GRID_SPACING inside. */
export function gridPath(a: TilePoint, b: TilePoint, spacing = GRID_SPACING): TilePoint[] {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const lines = (from: number, to: number): number[] => {
    const at: number[] = [];
    for (let v = from; v < to; v += spacing) at.push(v);
    at.push(to);
    return at;
  };
  const seen = new Set<string>();
  const tiles: TilePoint[] = [];
  const add = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key) || tiles.length >= MAX_PATH) return;
    seen.add(key);
    tiles.push({ x, y });
  };
  for (const y of lines(y0, y1)) for (let x = x0; x <= x1; x++) add(x, y);
  for (const x of lines(x0, x1)) for (let y = y0; y <= y1; y++) add(x, y);
  return tiles;
}

/** The tiles of a rectangle from a to b, row by row, at most MAX_PATH of them. */
export function rectanglePath(a: TilePoint, b: TilePoint): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      if (tiles.length >= MAX_PATH) return tiles;
      tiles.push({ x, y });
    }
  }
  return tiles;
}
