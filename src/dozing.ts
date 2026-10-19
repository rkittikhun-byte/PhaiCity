/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The bulldozer by dragging the mouse (owner, 18 Oct 2026: "รื้อถอน เอาแบบลากเม้าส์ ได้เลย"). A road at a slant is a staircase
// of tiles that the 3D view draws as one smooth line through them, so the mouse following the road drawn passes beside
// tiles of it, and clicking tile by tile left some behind, shown as stray round dots (owner: "ลบถนนออก แต่มีจุด ไปแสดงอยู่ที่นึง").
// So the bulldozer takes the road, railway or power line tile nearest the mouse, goes over every tile along the mouse's way,
// and takes a road tile left alone beside one it dozed. Plain code: no DOM, nothing random.

import { isRoadTile } from "./roadLevels";
import { LASTPOWER, LASTRAIL, POWERBASE, RAILBASE } from "./tileValues";

/** A point or a tile, in tiles */
export interface DozePoint { x: number; y: number }

export interface DozeMap {
  testBounds(x: number, y: number): boolean;
  getTileValue(x: number, y: number): number;
}

/** How far (tiles, from a tile's square) the mouse may be from a line tile that it still takes instead of the ground it is over */
export const DOZE_REACH = 0.4;
/** ... and that a stroke along the mouse's way takes, the road drawn smooth running through tiles it only passes beside */
export const DOZE_PATH_REACH = 0.55;
/** The steps (tiles) a stroke is sampled at, so no tile it passes through is missed */
const SAMPLE_STEP = 0.2;

/** Whether a tile value is a road, a railway or a power line: what a bulldozer snaps to */
export const isLineTile = (value: number): boolean =>
  isRoadTile(value) || (value >= RAILBASE && value <= LASTRAIL) || (value >= POWERBASE && value <= LASTPOWER);

/** The tiles of roads, railways and power lines whose squares lie within reach of a point, nearest first */
export function lineTilesNear(map: DozeMap, point: DozePoint, reach: number): Array<DozePoint & { away: number }> {
  const found: Array<DozePoint & { away: number }> = [], cx = Math.floor(point.x), cy = Math.floor(point.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!map.testBounds(x, y) || !isLineTile(map.getTileValue(x, y))) continue;
      // How far the point is from this tile's square
      const away = Math.hypot(Math.max(x - point.x, 0, point.x - (x + 1)), Math.max(y - point.y, 0, point.y - (y + 1)));
      if (away <= reach) found.push({ x, y, away });
    }
  }
  return found.sort((a, b) => a.away - b.away);
}

/** The tile a click or the mouse at a point takes: a line tile within DOZE_REACH when the tile under it is bare land or trees
 * (open: whether a tile value is), else the tile itself */
export function dozeTile(map: DozeMap, tile: DozePoint, point: DozePoint | null, open: (value: number) => boolean): DozePoint {
  if (!point || !open(map.getTileValue(tile.x, tile.y))) return tile;
  const near = lineTilesNear(map, point, DOZE_REACH);
  return near.length > 0 ? { x: near[0].x, y: near[0].y } : tile;
}

/** The tiles a bulldozer dragged from one point to another goes over, each once: those under its way, and the line tiles
 * beside it that the road drawn smooth runs through; where a line tile lies within reach of a bare tile (open: whether a
 * tile value is bare land or trees) under the way, only the line tile, so a stroke along a road does not clear the trees
 * beside it */
export function dozePath(map: DozeMap, from: DozePoint, to: DozePoint, open: (value: number) => boolean = () => false): DozePoint[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SAMPLE_STEP)), tiles: DozePoint[] = [], seen = new Set<string>();
  const add = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (!seen.has(key)) { seen.add(key); tiles.push({ x, y }); }
  };
  for (let k = 0; k <= steps; k++) {
    const point = { x: from.x + (to.x - from.x) * k / steps, y: from.y + (to.y - from.y) * k / steps };
    const own = { x: Math.floor(point.x), y: Math.floor(point.y) }, near = lineTilesNear(map, point, DOZE_PATH_REACH);
    if (near.length === 0 || !map.testBounds(own.x, own.y) || !open(map.getTileValue(own.x, own.y))) add(own.x, own.y);
    for (const tile of near) add(tile.x, tile.y);
  }
  return tiles;
}

/** The tiles a bulldozer takes for the way the mouse went, as points in tiles: one tile for a click (or a drag shorter
 * than a third of a tile), else those along the way (dozePath) */
export function dozeStroke(map: DozeMap, points: readonly DozePoint[], open: (value: number) => boolean): DozePoint[] {
  if (points.length === 0) return [];
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const first = points[0], tile = { x: Math.floor(first.x), y: Math.floor(first.y) };
  if (length < 0.35) return map.testBounds(tile.x, tile.y) ? [dozeTile(map, tile, first, open)] : [];
  const out: DozePoint[] = [], seen = new Set<string>();
  for (let i = 1; i < points.length; i++) {
    for (const t of dozePath(map, points[i - 1], points[i], open)) {
      const key = `${t.x},${t.y}`;
      if (!seen.has(key) && map.testBounds(t.x, t.y)) { seen.add(key); out.push(t); }
    }
  }
  // A stroke along a road, railway or power line takes only the line: the bare ground and trees the mouse strays over
  // beside it stay (owner, 20 Oct 2026: "ทำไมไม่รื้อถอนเฉพาะช่องที่เราเลือก ตามถนนเท่านั้น")
  if (out.some(t => isLineTile(map.getTileValue(t.x, t.y)))) return out.filter(t => !open(map.getTileValue(t.x, t.y)));
  return out;
}

/** The road tiles beside those just dozed that no road reaches now (none next to them, up, down, left or right): only a
 * stray round dot, which is taken too */
export function loneRoads(map: DozeMap, dozed: readonly DozePoint[]): DozePoint[] {
  const road = (x: number, y: number): boolean => map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y));
  const taken = new Set<string>(), out: DozePoint[] = [];
  for (const tile of dozed) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tile.x + dx, y = tile.y + dy, key = `${x},${y}`;
        if (taken.has(key) || !road(x, y) || road(x + 1, y) || road(x - 1, y) || road(x, y + 1) || road(x, y - 1)) continue;
        taken.add(key);
        out.push({ x, y });
      }
    }
  }
  return out;
}
