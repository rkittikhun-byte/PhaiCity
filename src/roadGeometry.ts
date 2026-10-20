/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The shape of the roads and railways on the ground (owner, 14 Oct 2026: smooth curves as in Cities: Skylines). The
// game lays them tile by tile, a slanted one as a staircase of tiles; each stretch between junctions is drawn along
// one smooth line through its tiles' middles, its stairsteps averaged away and its bends rounded. The 3D view draws
// the roads along these lines (src/render3d/city/roadCurves.ts) and the zone cells lie beside them (src/zoneCells.ts),
// so both use this. World units, as the 3D view's: 10 a tile, x east and z south. Plain code: no DOM, nothing random.

import { isCityTileSize, unitsPerMetre } from "./units";

export type Point = [number, number];

/** Which tiles lie on a smooth line, have a power line over them, or are any road or railway a line runs up to: every
 * road test lives in src/roadTiles.ts */
export { isAnyRail, isAnyRoad, isLineRail, isLineRoad, isPowerCrossing } from "./roadTiles";
import { isAnyRail, isAnyRoad, isLineRail, isLineRoad, isPowerCrossing } from "./roadTiles";

/** Half the width of each road level's carriageway (1 laterite … 8 tollway), and its shoulders, in world units */
export const HALF_WIDTH = [3.5, 3.5, 3.5, 3.6, 4.2, 4.6, 4.9, 4.9, 4.9];
export const SHOULDER = 0.6;
/**
 * On a real-scale city map every road is its real width (owner, 15 Oct 2026, docs/CITY_SCALE.md): each level's whole
 * carriageway in metres, laterite 5 m, asphalt 6 m, concrete two lanes 7 m and four lanes 13 m; the wider levels as
 * wide as one 16 m tile holds with their shoulders, until big roads take two tiles. Shoulders 1 m a side.
 */
export const REAL_WIDTH_M = [5, 5, 6, 7, 13, 14, 14, 14, 14];
export const REAL_SHOULDER_M = 1;
/** World units a metre on a real-scale city map (10 a tile: 0.625 at 16 m a tile), or null on any other map, whose
 * roads and buildings are drawn as for 10 m tiles */
export const realUnits = (tileSizeM?: number | null): number | null =>
  tileSizeM && isCityTileSize(tileSizeM) ? unitsPerMetre(tileSizeM) : null;
const levelOf = (level: number): number => Math.max(1, Math.min(8, level));
/** Half a road's carriageway (world units); units: realUnits of its map */
export const halfWidth = (level: number, units?: number | null): number =>
  units ? REAL_WIDTH_M[levelOf(level)] / 2 * units : HALF_WIDTH[levelOf(level)];
/** A road's shoulder either side (world units) */
export const shoulderOf = (units?: number | null): number => units ? REAL_SHOULDER_M * units : SHOULDER;
/** How far a road reaches either side of its line, shoulders and all */
export const roadReach = (level: number, units?: number | null): number => halfWidth(level, units) + (level > 1 ? shoulderOf(units) : 0);

/** How far the simplified line may stray from the smoothed one, and how many tiles either side a point is averaged */
const STRAY = 1.5, REACH = 4;
/** The widest knot of junction tiles (tiles across) drawn as one junction */
const MAX_KNOT = 10;
const SIDES: ReadonlyArray<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Douglas–Peucker: the fewest points that keep the line within tolerance of where it was */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!, [ax, az] = points[a], [bx, bz] = points[b], dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz) || 1;
    let far = -1, farthest = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / length;
      if (d > farthest) { farthest = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Each point moved to the average of its neighbours along the line, up to reach points either side, passes times:
 * the stairsteps of a slanted road go, its real bends stay as wide curves. Past each end the line goes on as its own
 * mirror image through the end, so the ends stay put and the road runs into them along its own way, not along the
 * last tiles' steps (owner, 15 Oct 2026, of a road hooking into its junction: "จุดต่อมันควรจะเนียนกว่านี้")
 */
function average(points: Point[], reach: number, passes: number): Point[] {
  let line = points;
  for (let pass = 0; pass < passes; pass++) {
    const n = line.length, last = n - 1, next: Point[] = [];
    const at = (k: number): Point => {
      if (k < 0) { const p = line[Math.min(last, -k)]; return [2 * line[0][0] - p[0], 2 * line[0][1] - p[1]]; }
      if (k > last) { const p = line[Math.max(0, 2 * last - k)]; return [2 * line[last][0] - p[0], 2 * line[last][1] - p[1]]; }
      return line[k];
    };
    for (let i = 0; i < n; i++) {
      const r = Math.min(reach, last);
      let x = 0, z = 0;
      for (let k = i - r; k <= i + r; k++) { const [px, pz] = at(k); x += px; z += pz; }
      next.push([x / (2 * r + 1), z / (2 * r + 1)]);
    }
    line = next;
  }
  return line;
}

/** Chaikin's corner cutting, its ends kept: each bend becomes a curve, long straights stay straight */
function round(points: Point[], passes = 3): Point[] {
  let line = points;
  for (let pass = 0; pass < passes && line.length > 2; pass++) {
    const next: Point[] = [line[0]];
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      if (i > 0) next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      if (i + 2 < line.length) next.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

/** Points no further apart than step, so a ribbon follows the ground */
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}

/** The smooth line a stretch of tiles' middles is drawn along: its steps averaged away, bends rounded. The same line
 * whichever end it is read from, so a road read the other way round (when a junction joins it) keeps its shape. */
export function smoothLine(points: Point[]): Point[] {
  const [fx, fz] = points[0], [lx, lz] = points[points.length - 1];
  if (lx < fx || (lx === fx && lz < fz)) return smoothLine([...points].reverse()).reverse();
  return densify(round(simplify(average(points, REACH, 2), STRAY), 2), 2.5);
}

/** The point of the lines nearest (x, z), if one lies within reach (world units) */
export function nearestOnLines(lines: readonly Point[][], x: number, z: number, reach: number): Point | null {
  let best: Point | null = null, bestDistance = reach;
  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)), px = ax + dx * t, pz = az + dz * t;
    const distance = Math.hypot(px - x, pz - z);
    if (distance < bestDistance) { bestDistance = distance; best = [px, pz]; }
  }
  return best;
}

/** A map as the lines read it: its size, each tile's value and each road tile's level (1 laterite … 8) */
export interface LineMap {
  readonly width: number;
  readonly height: number;
  value(i: number): number;
  level(i: number): number;
  /** The drawn line each road tile was laid by (gameMap.roadPieces, newer lines higher), 0 for roads laid before the
   * pieces were kept or that came with the map. Without it every tile is 0. */
  piece?(i: number): number;
  /** The tiles a piece was drawn along, in order, and the older pieces it began and ended on (gameMap.roadPaths,
   * src/roadPieces.ts): its shape is worked out once from them, so bulldozing some of it never moves the rest */
  path?(piece: number): DrawnPath | null;
  /** Only the tiles from (x0, y0) to (x1, y1), inclusive, are looked at for lines, which value must give as none outside
   * them (src/render3d/city/roadCurves.ts sketch, which reads a few tiles of a big map) */
  area?: readonly [number, number, number, number];
}

/** The tiles a piece was drawn along, how, and the older pieces it began and ended on (src/roadPieces.ts RoadPath) */
export interface DrawnPath {
  from: number;
  to: number;
  tiles: readonly number[];
  shape?: "straight" | "curve" | "free";
  controls?: ReadonlyArray<readonly [number, number]>;
}

/** The line a piece was drawn as: straight from its first tile's middle to its last's, the curve through the middles of
 * the points it was clicked through, or (free, or laid tile by tile) its tiles' middles smoothed */
export function drawnLine(path: DrawnPath, middleOf: (tile: number) => Point): Point[] {
  const middle = ([x, y]: readonly [number, number]): Point => [(x + 0.5) * 10, (y + 0.5) * 10];
  const ends = (): Point[] => [middleOf(path.tiles[0]), middleOf(path.tiles[path.tiles.length - 1])];
  // A straight line from its first point to its last, which may be where it joined a road between tiles' middles
  const at = path.shape === "curve" && path.controls && path.controls.length >= 2 ? path.controls.map(middle) :
    path.shape === "straight" ? (path.controls && path.controls.length >= 2 ?
      [middle(path.controls[0]), middle(path.controls[path.controls.length - 1])] : ends()) : null;
  if (!at) return smoothLine(path.tiles.map(middleOf));
  let length = 0;
  for (let i = 1; i < at.length; i++) length += Math.hypot(at[i][0] - at[i - 1][0], at[i][1] - at[i - 1][1]);
  const steps = Math.max(1, Math.ceil(length / 2.5)), line: Point[] = [];
  for (let k = 0; k <= steps; k++) {
    let level = at.map((p): Point => [p[0], p[1]]);
    while (level.length > 1) level = level.slice(1).map((p, i): Point => [level[i][0] + (p[0] - level[i][0]) * k / steps, level[i][1] + (p[1] - level[i][1]) * k / steps]);
    line.push(level[0]);
  }
  return line;
}

/** A stretch between junctions, ends and other tiles: its tiles' middles, its tiles, and the drawn line it is part of */
export interface Stretch { points: Point[]; tiles: number[]; level: number; rail: boolean; piece: number }

export interface Network {
  stretches: Stretch[];
  /** Dead ends, which get a rounded end: where (world units) and the road's level */
  plates: Array<[number, number, number]>;
  /** Junctions' middles (world units), where the roads run into each other */
  junctions: Point[];
  /** 1 for every tile on a line */
  covered: Uint8Array;
  /** A drawn piece's own line, from the tiles it was drawn along (LineMap path), or null without them */
  frozen?(piece: number): Point[] | null;
}

/** The stretches of the roads (rail false) or the railways of a map */
export function networkOf(map: LineMap, rail: boolean): Network {
  const { width, height } = map;
  const plain = rail ? isLineRail : (v: number) => isLineRoad(v) || isPowerCrossing(v), joins = rail ? isAnyRail : isAnyRoad;
  const rawLevel = (i: number): number => (rail ? 0 : Math.max(1, map.level(i)));
  const pieceOf = map.piece ? (i: number): number => map.piece!(i) : (): number => 0;
  const joinsAt = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && joins(map.value(y * width + x));
  const plainAt = (i: number): boolean => plain(map.value(i));
  const degree = (i: number): number => {
    const x = i % width, y = (i - x) / width;
    let n = 0;
    for (const [dx, dy] of SIDES) if (joinsAt(x + dx, y + dy)) n++;
    return n;
  };
  // A newer drawn line meets an older one inside a block of 2 × 2 road tiles by two links (a slanted road leaving a road,
  // or a tile filling the inside of its stairstep): only the one it needs most, the one whose tiles have the fewest
  // other roads, joins them, so the older road keeps its own tiles' line through a junction of one tile rather than
  // a knot's middle (owner, 18 Oct 2026: "ถนนที่สร้างไปแล้ว และฉันสร้างต่อ จะต้องไม่เปลี่ยนรูป ถนนอีก")
  const linkRank = (a: number, b: number): [number, number] => [Math.min(degree(a), degree(b)), Math.min(a, b) * 2 + (Math.abs(a - b) === 1 ? 0 : 1)];
  const cut = (i: number, j: number): boolean => {
    const pi = pieceOf(i), pj = pieceOf(j);
    if (pi === pj || !plainAt(i) || !plainAt(j)) return false;
    const [deg, key] = linkRank(i, j), xi = i % width, yi = (i - xi) / width, xj = j % width, yj = (j - xj) / width;
    for (const side of [-1, 1]) {
      const ox = yi === yj ? 0 : side, oy = yi === yj ? side : 0;
      if (!joinsAt(xi + ox, yi + oy) || !joinsAt(xj + ox, yj + oy)) continue;
      const i2 = (yi + oy) * width + xi + ox, j2 = (yj + oy) * width + xj + ox;
      if (!plainAt(i2) || !plainAt(j2)) continue;
      for (const [a, b] of [[i, i2], [j, j2], [i2, j2]]) {
        const pa = pieceOf(a), pb = pieceOf(b);
        if (!(pa === pi && pb === pj || pa === pj && pb === pi)) continue;
        const [d, k] = linkRank(a, b);
        if (d < deg || d === deg && k < key) return true;
      }
    }
    return false;
  };
  const nearOf: Array<number[] | undefined> = [];
  const near = (i: number): number[] => {
    const known = nearOf[i];
    if (known) return known;
    const x = i % width, y = (i - x) / width, out: number[] = [];
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (joinsAt(nx, ny) && !cut(i, ny * width + nx)) out.push(ny * width + nx);
    }
    nearOf[i] = out;
    return out;
  };
  // Where a newer drawn line goes on from an older one's tile (built on from its end, or from a road laid before the
  // lines were kept), each is its own line, ending there along its own way: building on never moves the older one
  const newerBeside = (i: number): boolean => near(i).some((j) => pieceOf(j) > pieceOf(i));
  // Smooth single-tile road level discrepancies along a 2-neighbour stretch so upgrading a diagonal staircase or a
  // junction tile does not leave 1-tile level islands
  const pass1Level = (i: number): number => {
    const lv = rawLevel(i);
    if (rail) return 0;
    const n = near(i);
    if (n.length === 2 && plain(map.value(n[0])) && plain(map.value(n[1]))) {
      const l0 = rawLevel(n[0]), l1 = rawLevel(n[1]);
      if (lv < l0 && lv < l1) return Math.min(l0, l1);
      if (l0 === l1 && lv !== l0) return l0;
    }
    return lv;
  };
  const levelOf = (i: number): number => {
    const lv = pass1Level(i);
    if (rail) return 0;
    const n = near(i);
    if (n.length === 2 && plain(map.value(n[0])) && plain(map.value(n[1]))) {
      const l0 = pass1Level(n[0]), l1 = pass1Level(n[1]);
      if (lv < l0 && lv < l1) return Math.min(l0, l1);
    }
    return lv;
  };
  const topoStop = (i: number): boolean => {
    const n = near(i);
    return n.length !== 2 || n.some((j) => !plain(map.value(j))) || newerBeside(i);
  };
  const tileMiddle = (i: number): Point => [((i % width) + 0.5) * 10, (Math.floor(i / width) + 0.5) * 10];
  const covered = new Uint8Array(width * height);
  // The tiles looked at, row by row: the whole map, or only the area given (LineMap area)
  const [ax0, ay0, ax1, ay1] = map.area ?? [0, 0, width - 1, height - 1];
  const first = ay0 * width + ax0, last = ay1 * width + ax1;
  const next = (i: number): number => (i % width === ax1 ? i + width - (ax1 - ax0) : i + 1);
  // Junction tiles side by side (a new road laid beside an old one, or two roads meeting at a slant) are one junction
  // at their middle (owner, 14 Oct 2026: "ทำไมทางแยกมัน มีหลายเส้นแบบนี้"), so long as the knot is small.
  // Only true topological junctions/stops form knots — never 2-neighbour level transitions. A knot is one drawn line's
  // (src/roadPieces.ts): where a newer road touches an older one, the older keeps its own tiles' middles
  const knot = new Map<number, number>(), knots: number[][] = [];
  for (let i = first; i <= last; i = next(i)) {
    if (!plain(map.value(i)) || !topoStop(i) || near(i).length <= 2 || knot.has(i)) continue;
    const members = [i], queue = [i];
    knot.set(i, knots.length);
    for (let q = 0; q < queue.length; q++) {
      for (const j of near(queue[q])) {
        if (knot.has(j) || !plain(map.value(j)) || !topoStop(j) || near(j).length <= 2 || pieceOf(j) !== pieceOf(i)) continue;
        knot.set(j, knots.length);
        members.push(j);
        queue.push(j);
      }
    }
    knots.push(members);
  }
  const knotMiddle = knots.map((members): Point | null => {
    if (members.length < 2 || pieceOf(members[0]) > 0) return null;
    const xs = members.map((i) => i % width), ys = members.map((i) => Math.floor(i / width));
    if (Math.max(...xs) - Math.min(...xs) > MAX_KNOT || Math.max(...ys) - Math.min(...ys) > MAX_KNOT) return null;
    let x = 0, z = 0;
    for (const i of members) { const [mx, mz] = tileMiddle(i); x += mx; z += mz; }
    return [x / members.length, z / members.length];
  });
  const merged = (i: number): Point | null => (knot.has(i) ? knotMiddle[knot.get(i)!] : null);
  const sameKnot = (i: number, j: number): boolean => knot.has(i) && knot.get(i) === knot.get(j) && merged(i) !== null;
  const centre = (i: number): Point => merged(i) ?? tileMiddle(i);
  // A drawn line's knot (src/roadPieces.ts: a slanted road crossing a slanted one shares two of its tiles) keeps its
  // own tiles' middles, so it keeps its shape; the other roads that meet it there end at one of them, the nearest the
  // knot's middle, and run on through it as one crossing
  const gatherAt = knots.map((members): number => {
    if (members.length < 2 || pieceOf(members[0]) === 0) return -1;
    let x = 0, z = 0;
    for (const i of members) { const [mx, mz] = tileMiddle(i); x += mx / members.length; z += mz / members.length; }
    let best = members[0], bestDistance = Infinity;
    for (const i of members) {
      const [mx, mz] = tileMiddle(i), distance = Math.hypot(mx - x, mz - z);
      if (distance < bestDistance - 1e-9 || Math.abs(distance - bestDistance) <= 1e-9 && i < best) { best = i; bestDistance = distance; }
    }
    return best;
  });
  const endCentre = (i: number, piece: number): Point => {
    const k = knot.get(i);
    return k !== undefined && gatherAt[k] >= 0 && pieceOf(i) !== piece ? tileMiddle(gatherAt[k]) : centre(i);
  };
  const done = new Set<string>(), stretches: Stretch[] = [], plates: Array<[number, number, number]> = [];
  const junctionKeys = new Set<string>(), junctions: Point[] = [];
  const addJunction = (p: Point): void => {
    const k = keyOf(p);
    if (!junctionKeys.has(k)) { junctionKeys.add(k); junctions.push(p); }
  };
  const pushStretch = (tiles: number[]): void => {
    // A short way out of a knot and straight back in is part of the knot
    const first = tiles[0], end = tiles[tiles.length - 1];
    if (tiles.length <= 2 * MAX_KNOT && sameKnot(first, end)) return;
    // The drawn line it is part of: its middle tiles' (its ends may be an older line's, which it was built on from)
    const piece = tiles.length > 2 ? pieceOf(tiles[1]) : Math.max(pieceOf(first), pieceOf(end));
    // Per-tile effective level along the stretch (endpoints inherit their interior neighbour's level if they are junctions)
    const tileLevel = (idx: number): number => {
      const t = tiles[idx];
      if (!topoStop(t) || near(t).length <= 2) return levelOf(t);
      const nb = idx === 0 ? tiles[Math.min(1, tiles.length - 1)] : tiles[Math.max(0, idx - 1)];
      return !topoStop(nb) ? levelOf(nb) : levelOf(t);
    };
    const middleAt = (idx: number): Point => (idx === 0 || idx === tiles.length - 1 ? endCentre(tiles[idx], piece) : centre(tiles[idx]));
    // Split into contiguous same-level sub-stretches when a road changes level mid-stretch
    let runStart = 0;
    let prevMid: Point | null = null;
    for (let k = 1; k < tiles.length; k++) {
      const lvCur = tileLevel(runStart);
      const isLast = k === tiles.length - 1;
      const lvNext = tileLevel(k);
      if (!isLast && lvNext === lvCur) continue;
      const endIdx = lvNext === lvCur ? k : k - 1;
      const subTiles = tiles.slice(runStart, endIdx + 1);
      const points: Point[] = [];
      const addPt = (p: Point): void => {
        const last = points[points.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
      };
      if (prevMid) addPt(prevMid);
      for (let t = runStart; t <= endIdx; t++) addPt(middleAt(t));
      if (lvNext !== lvCur) {
        const [ax, az] = middleAt(endIdx), [bx, bz] = middleAt(endIdx + 1);
        const mid: Point = [(ax + bx) / 2, (az + bz) / 2];
        addPt(mid);
        addJunction(mid);
        prevMid = mid;
        runStart = endIdx + 1;
        if (points.length > 1) stretches.push({ points, tiles: subTiles, level: lvCur, rail, piece });
        if (isLast) {
          // Final single tile at the end of the stretch with a different level
          const tailPts: Point[] = [mid];
          const endC = middleAt(k);
          if (endC[0] !== mid[0] || endC[1] !== mid[1]) tailPts.push(endC);
          if (tailPts.length > 1) stretches.push({ points: tailPts, tiles: [tiles[k]], level: lvNext, rail, piece });
        }
      } else {
        if (points.length > 1) stretches.push({ points, tiles: subTiles, level: lvCur, rail, piece });
      }
    }
  };
  const walk = (from: number, to: number): void => {
    const tiles = [from, to];
    done.add(`${from}>${to}`); done.add(`${to}>${from}`);
    while (!topoStop(tiles[tiles.length - 1])) {
      const last = tiles[tiles.length - 1], before = tiles[tiles.length - 2];
      const next = near(last).find((j) => j !== before && !done.has(`${last}>${j}`));
      if (next === undefined) break;
      done.add(`${last}>${next}`); done.add(`${next}>${last}`);
      tiles.push(next);
      if (next === tiles[0]) break;
    }
    pushStretch(tiles);
  };
  const plated = new Set<number>();
  for (let i = first; i <= last; i = next(i)) {
    if (!plain(map.value(i))) continue;
    covered[i] = 1;
    if (!topoStop(i)) continue;
    const n = near(i);
    // Dead ends and lone tiles get a rounded end; a junction (a knot one at its middle) is where its roads meet
    const id = merged(i) ? -1 - knot.get(i)! : i;
    if (!plated.has(id)) {
      plated.add(id);
      const [px, pz] = centre(i);
      if (!merged(i) && n.length <= 1) plates.push([px, pz, levelOf(i)]);
      else if (merged(i) || n.length > 2 || n.every(plainAt)) addJunction([px, pz]);
    }
    for (const j of n) {
      if (!plain(map.value(j))) {
        // Up to the edge of a bridge or a crossing, which keeps its own model
        const [cx, cz] = tileMiddle(i), [jx, jz] = tileMiddle(j);
        stretches.push({ points: [centre(i), [cx, cz], [(cx + jx) / 2, (cz + jz) / 2]], tiles: [i], level: levelOf(i), rail,
          piece: pieceOf(i) });
      } else if (sameKnot(i, j)) {
        // Inside a knot, which is one junction
        done.add(`${i}>${j}`); done.add(`${j}>${i}`);
      } else if (!done.has(`${i}>${j}`)) walk(i, j);
    }
  }
  // Rings with no junction at all
  for (let i = first; i <= last; i = next(i)) {
    if (!plain(map.value(i)) || topoStop(i)) continue;
    for (const j of near(i)) if (!done.has(`${i}>${j}`)) walk(i, j);
  }
  // Each drawn piece's line as it was drawn (owner, 18 Oct 2026: "ถ้าลบ ไม่ต้องใช้ฟังก์ชั่นนี้ ให้ถนนมันอยู่กับที่ห้ามขยับ", "วาด
  // แบบไหน จะได้แบบนั้น"): one straight line, the curve through the points it was clicked through (as the preview shows
  // it, src/render3d/city/overlay.ts ghostRoad), or its tiles smoothed; its tiles' lines are cut from it, never
  // smoothed again
  const frozenOf = new Map<number, Point[] | null>();
  const frozen = (piece: number): Point[] | null => {
    if (piece <= 0 || !map.path) return null;
    if (frozenOf.has(piece)) return frozenOf.get(piece)!;
    const path = map.path(piece);
    const line = path && path.tiles.length >= 2 ? drawnLine(path, tileMiddle) : null;
    frozenOf.set(piece, line);
    return line;
  };
  return { stretches, plates, junctions, covered, frozen };
}

/** Two arms of a junction at least this far apart (degrees) are one road running on through it */
const THROUGH_DEG = 125;
/** How far along a road (world units) its way out of a junction is taken */
const ARM_REACH = 25;
/** A road built on from another's end turning no more than this (degrees) leaves along the other's way, smoothly */
const SMOOTH_JOINT_DEG = 30;

/** A road as drawn: one or more stretches joined where it runs on through a junction, as one smooth line */
export interface RoadLine { points: Point[]; level: number; rail: boolean; stretches: number[] }
/** A road at a junction: its line, the end of it that is there (null where the line runs on through), the way it
 * leaves the junction and its level */
export interface JunctionArm { line: number; end: 0 | 1 | null; way: Point; level: number }
/** A junction as drawn: where its roads meet (on the through road, when one runs through) and its roads, round it;
 * smooth where a road built on from another's end goes on along its way, so the two meet without a corner */
export interface JunctionShape { at: Point; arms: JunctionArm[]; through: number | null; smooth?: boolean }

const keyOf = (p: Point): string => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const unit = (x: number, z: number): Point => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/** The point of a line nearest p: its segment, how far along it, and the point */
function nearestOnLine(line: Point[], p: Point): { i: number; t: number; at: Point } {
  let best = { i: 1, t: 0, at: line[0] }, bestD = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1)));
    const at: Point = [ax + dx * t, az + dz * t], d = Math.hypot(at[0] - p[0], at[1] - p[1]);
    if (d < bestD) { bestD = d; best = { i, t, at }; }
  }
  return best;
}

/** Slice a smoothed polyline between two parameters (i0, t0, at0) and (i1, t1, at1) */
function sliceLine(line: Point[], a: { i: number; t: number; at: Point }, b: { i: number; t: number; at: Point }): Point[] {
  const out: Point[] = [a.at];
  for (let k = a.i; k < b.i && k < line.length; k++) {
    const p = line[k], last = out[out.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-3) out.push(p);
  }
  const last = out[out.length - 1];
  if (Math.hypot(b.at[0] - last[0], b.at[1] - last[1]) > 1e-3) out.push(b.at);
  else if (out.length === 1) out.push(b.at);
  return out;
}

/** The part of a line between the points of it nearest a and b, from a to b */
function sliceAlong(line: Point[], a: Point, b: Point): Point[] {
  const p = nearestOnLine(line, a), q = nearestOnLine(line, b);
  return p.i < q.i || p.i === q.i && p.t <= q.t ? sliceLine(line, p, q) : sliceLine(line, q, p).reverse();
}

/**
 * A line whose end (0 its start, 1 its last point) meets another line: it goes on straight along its own way to where
 * it crosses it, or stops where it already has, a little before its end; to `fallback` if it never does near its end.
 */
export function meetLine(line: Point[], end: 0 | 1, other: Point[], fallback: Point): Point[] {
  const own = end === 1 ? line.slice() : [...line].reverse(), tip = own[own.length - 1];
  const back = wayAlong(own, own.length - 1, tip, 6, false), d: Point = [-back[0], -back[1]];
  const BEHIND = 20, AHEAD = 25, from: Point = [tip[0] - d[0] * BEHIND, tip[1] - d[1] * BEHIND];
  let best: number | null = null;
  for (let i = 1; i < other.length; i++) {
    const [ax, az] = other[i - 1], ex = other[i][0] - ax, ez = other[i][1] - az;
    const denominator = d[0] * ez - d[1] * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const s = ((ax - from[0]) * ez - (az - from[1]) * ex) / denominator, u = ((ax - from[0]) * d[1] - (az - from[1]) * d[0]) / denominator;
    if (u < 0 || u > 1 || s < 0 || s > BEHIND + AHEAD) continue;
    if (best === null || Math.abs(s - BEHIND) < Math.abs(best - BEHIND)) best = s;
  }
  if (best === null) own.push(fallback);
  else {
    const cut = best - BEHIND, meet: Point = [tip[0] + d[0] * cut, tip[1] + d[1] * cut];
    const along = (p: Point): number => (p[0] - tip[0]) * d[0] + (p[1] - tip[1]) * d[1];
    while (own.length > 1 && along(own[own.length - 1]) >= cut) own.pop();
    own.push(meet);
  }
  return end === 1 ? own : own.reverse();
}

/** The way along a line from a point on segment i, `reach` units forward (or back), as a unit vector */
export function wayAlong(line: Point[], i: number, from: Point, reach: number, forward: boolean): Point {
  let left = reach, [px, pz] = from;
  for (let k = forward ? i : i - 1; forward ? k < line.length : k >= 0; k += forward ? 1 : -1) {
    const [qx, qz] = line[k], d = Math.hypot(qx - px, qz - pz);
    if (d >= left) { const s = left / d; return unit(px + (qx - px) * s - from[0], pz + (qz - pz) * s - from[1]); }
    left -= d; px = qx; pz = qz;
  }
  return unit(px - from[0], pz - from[1]);
}

/** How far along a road built on from another's end (world units) it bends from that one's way into its own */
const BEND_REACH = 60;

/**
 * A line whose start leaves along `way` instead of its own way: each point within BEND_REACH of the start (or less on a
 * short line) moved towards where that way would have taken it, fully at the start and not at all by the end of the
 * bend, smoothly, so the line keeps its start and runs on into its own way without a kink at either end
 */
function bendStart(line: Point[], way: Point): Point[] {
  let length = 0;
  for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  const reach = Math.min(BEND_REACH, length * 0.45), [sx, sz] = line[0], out: Point[] = [line[0]];
  let along = 0;
  for (let i = 1; i < line.length; i++) {
    along += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (along >= reach) { out.push(...line.slice(i)); break; }
    const t = along / reach, share = 1 - t * t * (3 - 2 * t), [x, z] = line[i];
    out.push([x + share * (sx + way[0] * along - x), z + share * (sz + way[1] * along - z)]);
  }
  return out;
}

/**
 * The roads of a network as drawn (owner, 15 Oct 2026: "1 กับ 2 มันควรจะเป็นถนนเดียวกัน และ 3 มาเชื่อม ทำแยกจุดต่อใหม่ ไม่ใช่
 * เอากลมๆ ไปวางเฉยๆ"): at each junction the two roads that run on most nearly straight are one continuous smooth curve
 * through it (even when upgraded to different levels, split cleanly along that smooth curve so each level keeps its width
 * and surface without kinking); the others end at it.
 */
export function roadLines(network: Network): { lines: RoadLine[]; junctions: JunctionShape[] } {
  const { stretches } = network;
  const junctionAt = new Map(network.junctions.map((p, j) => [keyOf(p), j]));
  // Each junction's roads: the stretches' ends there, and the way each leaves along its own smooth line (its tiles'
  // steps would turn it by up to 45 degrees)
  const armsAt: Array<Array<{ s: number; end: 0 | 1; way: Point }>> = network.junctions.map(() => []);
  stretches.forEach((stretch, s) => {
    const smooth = stretch.points.length > 1 ? smoothLine(stretch.points) : stretch.points;
    for (const end of [0, 1] as const) {
      const points = end === 0 ? stretch.points : [...stretch.points].reverse();
      const j = junctionAt.get(keyOf(points[0]));
      if (j === undefined || points.length < 2) continue;
      const way = end === 0 ? wayAlong(smooth, 1, smooth[0], ARM_REACH, true)
        : wayAlong(smooth, smooth.length - 1, smooth[smooth.length - 1], ARM_REACH, false);
      armsAt[j].push({ s, end, way });
    }
  });
  // The roads running on through each junction, the straightest first (preferring same-level pairs when close, but
  // allowing level transitions so upgrading part of a road never breaks its smooth through-curve)
  const partner = new Map<string, string>();
  for (const arms of armsAt) {
    const pairs: Array<[number, number, number]> = [];
    for (let a = 0; a < arms.length; a++) for (let b = a + 1; b < arms.length; b++) {
      if (arms[a].s === arms[b].s) continue;
      // A road runs on through a junction only along its own drawn line (src/roadPieces.ts): an older road keeps its
      // line through the junction of a newer one that leaves it or crosses it, and a road built on from another's end
      // ends there (owner, 18 Oct 2026)
      if (stretches[arms[a].s].piece !== stretches[arms[b].s].piece) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, arms[a].way[0] * arms[b].way[0] + arms[a].way[1] * arms[b].way[1]))) * 180 / Math.PI;
      const sameBonus = stretches[arms[a].s].level === stretches[arms[b].s].level ? 25 : 0;
      // In 2-arm connections and 3-arm T-junctions, the continuous road must always remain partnered as through-road
      // so an existing road's smooth curve/layout never shifts or breaks when a side road connects to it.
      if (arms.length <= 3 || angle >= THROUGH_DEG) pairs.push([angle + sameBonus, a, b]);
    }
    pairs.sort((p, q) => q[0] - p[0]);
    const used = new Set<number>();
    for (const [, a, b] of pairs) {
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      partner.set(`${arms[a].s}:${arms[a].end}`, `${arms[b].s}:${arms[b].end}`);
      partner.set(`${arms[b].s}:${arms[b].end}`, `${arms[a].s}:${arms[a].end}`);
    }
  }
  // The stretches joined end to end through their junctions, smoothed as one continuous curve and then split by level
  const lineOf = new Map<number, number>(), lines: RoadLine[] = [], raw: Point[][] = [];
  const throughSmoothOf = new Map<number, Point[]>(), whole = new Set<number>(), frozenLines = new Set<number>();
  const chain = (start: number, enter: 0 | 1): void => {
    const points: Point[] = [];
    const runs: Array<{ level: number; ids: number[]; rawPoints: Point[]; endPoint: Point }> = [];
    for (let s = start, e = enter; ;) {
      const own = e === 0 ? stretches[s].points : [...stretches[s].points].reverse();
      for (const p of own) { const last = points[points.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p); }
      const lv = stretches[s].level;
      let run = runs[runs.length - 1];
      if (!run || run.level !== lv) {
        run = { level: lv, ids: [], rawPoints: own.length ? [own[0]] : [], endPoint: own[own.length - 1] };
        runs.push(run);
      }
      run.ids.push(s);
      for (const p of own) {
        const last = run.rawPoints[run.rawPoints.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) run.rawPoints.push(p);
      }
      run.endPoint = own[own.length - 1];
      const next = partner.get(`${s}:${e === 0 ? 1 : 0}`);
      if (!next) break;
      const [t, te] = next.split(":").map(Number);
      if (lineOf.has(t) || runs.some((r) => r.ids.includes(t))) break;
      s = t; e = te as 0 | 1;
    }
    // A drawn piece with its path is cut from its own line, never smoothed again (Network frozen)
    const piece = stretches[start].piece, ring = points.length > 2 && keyOf(points[0]) === keyOf(points[points.length - 1]);
    const own = piece > 0 && !ring && runs.every((r) => r.ids.every((id) => stretches[id].piece === piece)) ?
      network.frozen?.(piece) ?? null : null;
    const wholeSmooth = own ? sliceAlong(own, points[0], points[points.length - 1]) : smoothLine(points);
    if (own) for (let k = 0; k < runs.length; k++) frozenLines.add(lines.length + k);
    if (runs.length === 1) {
      const idx = lines.length;
      for (const s of runs[0].ids) { lineOf.set(s, idx); throughSmoothOf.set(s, wholeSmooth); }
      raw.push(points);
      whole.add(idx);
      lines.push({ points: wholeSmooth, level: runs[0].level, rail: stretches[start].rail, stretches: runs[0].ids });
    } else {
      let prevCut = { i: 1, t: 0, at: wholeSmooth[0] };
      runs.forEach((run, rIdx) => {
        const idx = lines.length;
        for (const s of run.ids) { lineOf.set(s, idx); throughSmoothOf.set(s, wholeSmooth); }
        const nextCut = rIdx === runs.length - 1
          ? { i: wholeSmooth.length - 1, t: 1, at: wholeSmooth[wholeSmooth.length - 1] }
          : nearestOnLine(wholeSmooth, run.endPoint);
        const sliced = sliceLine(wholeSmooth, prevCut, nextCut);
        raw.push(run.rawPoints);
        lines.push({ points: sliced, level: run.level, rail: stretches[start].rail, stretches: run.ids });
        prevCut = nextCut;
      });
    }
  };
  stretches.forEach((_, s) => {
    if (lineOf.has(s)) return;
    if (!partner.has(`${s}:0`)) chain(s, 0);
    else if (!partner.has(`${s}:1`)) chain(s, 1);
  });
  stretches.forEach((_, s) => { if (!lineOf.has(s)) chain(s, 0); });
  // Each junction as drawn: on its through road where one runs through (whose smooth line passes a little off the
  // junction tile's middle), and the roads ending there end on that road's middle line, smoothed again so they curve
  // into it rather than kink
  const reach = 12;
  const centres = network.junctions.map((p, j) => {
    // ... the oldest drawn line where two cross (src/roadPieces.ts)
    const throughArm = armsAt[j].filter((arm) => partner.has(`${arm.s}:${arm.end}`))
      .reduce<typeof armsAt[number][number] | undefined>((best, arm) => (!best || stretches[arm.s].piece < stretches[best.s].piece ? arm : best), undefined);
    const through = throughArm ? lineOf.get(throughArm.s)! : null;
    const throughPts = throughArm ? (throughSmoothOf.get(throughArm.s) ?? lines[through!].points) : null;
    return { through, throughPts, at: throughPts === null ? p : nearestOnLine(throughPts, p).at };
  });
  const endsAt = (n: number, p: Point): 0 | 1 => {
    const line = raw[n];
    return Math.hypot(line[0][0] - p[0], line[0][1] - p[1]) <= Math.hypot(line[line.length - 1][0] - p[0], line[line.length - 1][1] - p[1]) ? 0 : 1;
  };
  const moved = new Set<number>();
  network.junctions.forEach((p, j) => {
    const { through, at } = centres[j];
    if (through === null) return;
    for (const arm of armsAt[j]) {
      if (partner.has(`${arm.s}:${arm.end}`)) continue;
      const n = lineOf.get(arm.s)!, line = raw[n], end = endsAt(n, p);
      line[end === 0 ? 0 : line.length - 1] = at;
      // ... a drawn piece's own line goes on (or stops) along its own way to where it meets that road's middle line,
      // so it stays as it was drawn, with no turn at its end (owner, 18 Oct 2026: "เส้นสุดท้ายฉันให้เป็นเส้นตรง ทำไม มันเลี้ยว")
      if (frozenLines.has(n)) lines[n].points = meetLine(lines[n].points, end, centres[j].throughPts ?? lines[through].points, at);
      else moved.add(n);
    }
  });
  for (const n of moved) lines[n].points = smoothLine(raw[n]);
  // ... and a dead end of one is drawn where its line now ends
  const plateAt = new Map(network.plates.map((plate) => [keyOf([plate[0], plate[1]]), plate]));
  for (const n of frozenLines) {
    const pts = lines[n].points, line = raw[n];
    for (const [rawEnd, end] of [[line[0], pts[0]], [line[line.length - 1], pts[pts.length - 1]]] as const) {
      const plate = plateAt.get(keyOf(rawEnd));
      if (plate) { plate[0] = end[0]; plate[1] = end[1]; }
    }
  }
  // Where a drawn line goes on from an older one's end nearly straight (src/roadPieces.ts), it leaves along the older
  // one's way, so the two meet without a corner: its first stretch bends from that way into its own line, and the
  // older one stays as it was. Oldest first, as each line follows the one it was built on from.
  const leaving = (n: number, p: Point, along: number): Point => {
    const line = lines[n].points;
    return endsAt(n, p) === 0 ? wayAlong(line, 1, line[0], along, true) : wayAlong(line, line.length - 1, line[line.length - 1], along, false);
  };
  const follows = new Map<number, Array<{ j: number; older: number }>>(), smoothJoints = new Set<number>();
  network.junctions.forEach((_, j) => {
    const arms = armsAt[j];
    if (arms.length !== 2 || arms.some((arm) => partner.has(`${arm.s}:${arm.end}`))) return;
    const [a, b] = stretches[arms[0].s].piece < stretches[arms[1].s].piece ? arms : [arms[1], arms[0]];
    const older = lineOf.get(a.s)!, newer = lineOf.get(b.s)!;
    if (stretches[a.s].piece === stretches[b.s].piece || older === newer || !whole.has(newer)) return;
    // A drawn piece is the line it was drawn as (Network frozen): drawn on along a road's way it meets it smoothly, at an
    // angle it keeps the angle; a road laid before the paths were kept still follows here
    if (frozenLines.has(newer)) return;
    follows.set(newer, [...(follows.get(newer) ?? []), { j, older }]);
  });
  const pieceOfLine = (n: number): number => stretches[lines[n].stretches[0]].piece;
  for (const n of [...follows.keys()].sort((m, k) => pieceOfLine(m) - pieceOfLine(k))) {
    for (const { j, older } of follows.get(n)!) {
      const p = network.junctions[j], back = leaving(older, p, 5), out = leaving(n, p, ARM_REACH);
      const turn = Math.acos(Math.max(-1, Math.min(1, -(back[0] * out[0] + back[1] * out[1])))) * 180 / Math.PI;
      if (turn > SMOOTH_JOINT_DEG) continue;
      const fromStart = endsAt(n, p) === 0, line = fromStart ? lines[n].points : [...lines[n].points].reverse();
      const bent = bendStart(line, [-back[0], -back[1]]);
      lines[n].points = fromStart ? bent : bent.reverse();
      smoothJoints.add(j);
    }
  }
  const junctions: JunctionShape[] = network.junctions.map((_, j) => {
    const { through, at } = centres[j], out: JunctionArm[] = [];
    const seenPartners = new Set<string>();
    for (const arm of armsAt[j]) {
      const key = `${arm.s}:${arm.end}`;
      const partnerKey = partner.get(key);
      if (!partnerKey || seenPartners.has(key)) continue;
      seenPartners.add(key);
      seenPartners.add(partnerKey);
      const [ps] = partnerKey.split(":").map(Number);
      const line0 = lineOf.get(arm.s)!, line1 = lineOf.get(ps)!;
      const pts = throughSmoothOf.get(arm.s) ?? throughSmoothOf.get(ps) ?? lines[line0].points;
      const near = nearestOnLine(pts, at);
      const wayFwd = wayAlong(pts, near.i, at, reach, true);
      const wayBack = wayAlong(pts, near.i, at, reach, false);
      const dot0 = arm.way[0] * wayFwd[0] + arm.way[1] * wayFwd[1];
      const firstFwd = dot0 >= 0;
      out.push(
        { line: line0, end: null, way: firstFwd ? wayFwd : wayBack, level: lines[line0].level },
        { line: line1, end: null, way: firstFwd ? wayBack : wayFwd, level: lines[line1].level },
      );
    }
    for (const arm of armsAt[j]) {
      if (partner.has(`${arm.s}:${arm.end}`)) continue;
      const n = lineOf.get(arm.s)!, line = lines[n].points, end = endsAt(n, at);
      const way = end === 0 ? wayAlong(line, 1, line[0], reach, true) : wayAlong(line, line.length - 1, line[line.length - 1], reach, false);
      out.push({ line: n, end, way, level: lines[n].level });
    }
    out.sort((a, b) => Math.atan2(a.way[1], a.way[0]) - Math.atan2(b.way[1], b.way[0]));
    // Two lines meeting end to end along one way (bent so here, or when drawn) meet without a corner
    if (!smoothJoints.has(j) && out.length === 2 && out.every((arm) => arm.end !== null) && out[0].line !== out[1].line) {
      const [u, v] = out.map((arm) => {
        const line = lines[arm.line].points;
        return arm.end === 0 ? wayAlong(line, 1, line[0], 3, true) : wayAlong(line, line.length - 1, line[line.length - 1], 3, false);
      });
      if (u[0] * v[0] + u[1] * v[1] < -Math.cos(6 * Math.PI / 180)) smoothJoints.add(j);
    }
    return smoothJoints.has(j) ? { at, arms: out, through, smooth: true } : { at, arms: out, through };
  });
  return { lines, junctions };
}
