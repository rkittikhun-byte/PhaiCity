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

/** The lines of a grid across the rectangle from a to b, each whole and in order: its rows, then its columns (each a
 * straight road of its own, so the grid is built as drawn: owner, 18 Oct 2026: "วาดแบบไหน จะได้แบบนั้น"). */
export function gridLines(a: TilePoint, b: TilePoint, spacing = GRID_SPACING): TilePoint[][] {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const lines = (from: number, to: number): number[] => {
    const at: number[] = [];
    for (let v = from; v < to; v += spacing) at.push(v);
    at.push(to);
    return at;
  };
  const out: TilePoint[][] = [];
  if (x1 > x0) for (const y of lines(y0, y1)) out.push(Array.from({ length: x1 - x0 + 1 }, (_, k) => ({ x: x0 + k, y })));
  if (y1 > y0) for (const x of lines(x0, x1)) out.push(Array.from({ length: y1 - y0 + 1 }, (_, k) => ({ x, y: y0 + k })));
  return out.length ? out : [[{ x: x0, y: y0 }]];
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

// Snapping (จัดแนว, owner 13 Oct 2026), as Cities: Skylines guides a road: onto a road it nearly touches, along a
// straight or 45° line, and onto the guideline a block of plots away from a road beside it

/** How near a straight or 45° line, in degrees, a line's end snaps onto it */
export const SNAP_DEGREES = 7;
/** How far, in tiles, a point moves to reach a guideline */
export const SNAP_REACH = 2;
/** How far, in tiles, a click reaches for a road, and the most any snap moves it: about 18 pixels on the screen
 * (src/game.js snapReach), so a road's end is as easy to hit zoomed out as zoomed in (owner, 18 Oct 2026: "มันไม่เริ่มจาก
 * จุด A ไป B และยัง ขาดๆ หายๆ ด้วย ... เกี่ยวกับการ zoom out/in ด้วยหรือป่าวนะ") */
export const MIN_SNAP_REACH = 1.5;
export const MAX_SNAP_REACH = 4;
/** ... and how far it reaches for a road's dead end, at least: a new line begun this near an end goes on from it (a
 * road begun a tile or two off an end, not joined to it, is never what was meant: owner, 18 Oct 2026) */
export const END_SNAP_REACH = 3;

/** The end of a line from a moved onto the nearest multiple of 45° when the line is within SNAP_DEGREES of it, and the
 * move is no more than reach tiles. */
export function snapAngle(a: TilePoint, b: TilePoint, degrees = SNAP_DEGREES, reach = Infinity): TilePoint {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return b;
  const angle = Math.atan2(dy, dx), step = Math.PI / 4;
  const nearest = Math.round(angle / step) * step;
  if (Math.abs(angle - nearest) > degrees * Math.PI / 180) return b;
  const ux = Math.round(Math.cos(nearest)), uy = Math.round(Math.sin(nearest));
  // Along an axis keep the long side; along a diagonal, the steps both ways
  const length = ux !== 0 && uy !== 0 ? Math.round((Math.abs(dx) + Math.abs(dy)) / 2) : Math.max(Math.abs(dx), Math.abs(dy));
  const snapped = { x: a.x + ux * length, y: a.y + uy * length };
  return Math.hypot(snapped.x - b.x, snapped.y - b.y) <= reach ? snapped : b;
}

/**
 * The next point of a line that starts at a road's dead end moved onto the road's own way on from that end (way: a
 * unit vector, in tiles), when the line is within SNAP_DEGREES of it, at least two tiles long and the move no more than
 * reach tiles, so a road drawn on from an end goes on along it, and a curve's bend leaves it smoothly; null when it is
 * not (src/roadGeometry.ts).
 */
export function snapAlong(a: TilePoint, b: TilePoint, way: { x: number; y: number }, degrees = SNAP_DEGREES,
                          reach = Infinity): TilePoint | null {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (length < 2) return null;
  const along = dx * way.x + dy * way.y;
  if (along <= 0 || Math.acos(Math.min(1, along / length)) > degrees * Math.PI / 180) return null;
  const snapped = { x: Math.round(a.x + way.x * along), y: Math.round(a.y + way.y * along) };
  return Math.hypot(snapped.x - b.x, snapped.y - b.y) <= reach ? snapped : null;
}

export type SnapGuide = "road" | "spacing" | "way" | null;

/**
 * A clicked point moved onto a road within reach tiles (from its tile's middle to the road tile's, half a tile more),
 * or onto a road's dead end within endReach, so the new line joins it: a dead end first, as a road is built on from
 * its end, else the nearest; failing that, onto the guideline GRID_SPACING tiles from a straight road running beside it
 * (a road and three plots deep on each side between them), when that is within SNAP_REACH tiles and reach. isRoad
 * answers for tiles on the map only.
 */
export function snapPoint(p: TilePoint, isRoad: (x: number, y: number) => boolean,
                          spacing = GRID_SPACING, reach = 1, endReach = reach): { point: TilePoint; guide: SnapGuide } {
  if (isRoad(p.x, p.y)) return { point: p, guide: "road" };
  const around = Math.floor(Math.max(reach, endReach) + 0.5);
  let road: { point: TilePoint; score: number } | null = null;
  for (let dy = -around; dy <= around; dy++) for (let dx = -around; dx <= around; dx++) {
    const x = p.x + dx, y = p.y + dy, distance = Math.hypot(dx, dy);
    if (distance > Math.max(reach, endReach) + 0.5 || !isRoad(x, y)) continue;
    const end = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ex, ey]) => isRoad(x + ex, y + ey)).length <= 1;
    if (distance > (end ? endReach : reach) + 0.5) continue;
    const score = distance - (end ? 1 : 0);
    if (!road || score < road.score) road = { point: { x, y }, score };
  }
  if (road) return { point: road.point, guide: "road" };
  // A straight road three tiles long, level with the point, spacing ± SNAP_REACH tiles away (no further than reach)
  const shiftMost = Math.min(SNAP_REACH, Math.floor(reach));
  let best: { point: TilePoint; shift: number } | null = null;
  for (let d = spacing - shiftMost; d <= spacing + shiftMost; d++) {
    for (const sign of [-1, 1]) {
      const shift = (d - spacing) * sign;
      if (shift === 0 || (best && Math.abs(shift) >= best.shift)) continue;
      const row = p.y + sign * d, column = p.x + sign * d;
      if ([-1, 0, 1].every((k) => isRoad(p.x + k, row))) best = { point: { x: p.x, y: p.y + shift }, shift: Math.abs(shift) };
      if ([-1, 0, 1].every((k) => isRoad(column, p.y + k)) && (!best || Math.abs(shift) < best.shift)) {
        best = { point: { x: p.x + shift, y: p.y }, shift: Math.abs(shift) };
      }
    }
  }
  return best ? { point: best.point, guide: "spacing" } : { point: p, guide: null };
}

/**
 * The angle a new line makes, in whole degrees: with the line it goes on from (180 straight on, 90 a right angle),
 * or, from a road (which has no way along it), the smaller angle with it (0–90). null without either.
 */
export function joinAngle(next: TilePoint, from: TilePoint | null, road: TilePoint | null): number | null {
  const length = Math.hypot(next.x, next.y);
  if (length === 0) return null;
  const turn = (d: TilePoint): number =>
    Math.acos(Math.max(-1, Math.min(1, (d.x * next.x + d.y * next.y) / (Math.hypot(d.x, d.y) * length)))) * 180 / Math.PI;
  if (from && (from.x || from.y)) return Math.round(180 - turn(from));
  if (road && (road.x || road.y)) {
    const angle = turn(road);
    return Math.round(Math.min(angle, 180 - angle));
  }
  return null;
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

/**
 * A line's staircase of tiles taken round the corner tiles it would cross that hold something else, where it can: at a
 * corner of the staircase the tile may be swapped for the other corner of the same two-by-two, and the line still runs
 * tile to tile. On a city map a building's tiles lie square on the map while its lot turns with its road, so a corner
 * tile of the building may stick out past the lot beside a road drawn along it (owner, 20 Oct 2026: "ทำให้ช่องของอาคาร
 * ตรงกับลานที่หมุนตามถนน ถนนที่วาดเลียดข้างลานจะได้ไม่ชนช่องที่ยื่นออกมา"); the road drawn smooth runs between the two
 * corners either way. Plain code: blocked(x, y) says whether the line may not go on a tile.
 */
export function aroundCorners(path: readonly TilePoint[], blocked: (x: number, y: number) => boolean): TilePoint[] {
  const out = path.map(t => ({ x: t.x, y: t.y }));
  const taken = new Set(out.map(t => `${t.x},${t.y}`));
  for (let i = 1; i < out.length - 1; i++) {
    const before = out[i - 1], here = out[i], after = out[i + 1];
    if (!blocked(here.x, here.y) || before.x === after.x || before.y === after.y) continue;
    const other = { x: before.x + after.x - here.x, y: before.y + after.y - here.y };
    if (taken.has(`${other.x},${other.y}`) || blocked(other.x, other.y)) continue;
    taken.delete(`${here.x},${here.y}`);
    taken.add(`${other.x},${other.y}`);
    out[i] = other;
  }
  return out;
}
