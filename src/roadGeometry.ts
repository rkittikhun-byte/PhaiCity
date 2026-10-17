/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The shape of the roads and railways on the ground (owner, 14 Oct 2026: smooth curves as in Cities: Skylines). The
// game lays them tile by tile, a slanted one as a staircase of tiles; each stretch between junctions is drawn along
// one smooth line through its tiles' middles, its stairsteps averaged away and its bends rounded. The 3D view draws
// the roads along these lines (src/render3d/city/roadCurves.ts) and the zone cells lie beside them (src/zoneCells.ts),
// so both use this. World units, as the 3D view's: 10 a tile, x east and z south. Plain code: no DOM, nothing random.

export type Point = [number, number];

/** A plain road or railway tile, which lies on a smooth line rather than drawing its own tile (bridges, crossings and
 * power lines over a road keep their tiles) */
export const isLineRoad = (v: number): boolean => v >= 66 && v <= 206 && v !== 77 && v !== 78;
export const isLineRail = (v: number): boolean => v >= 226 && v <= 236;
/** ... and a road tile with a power line over it (77, 78), which the road's line runs on through: only the wires keep
 * their tile's model (owner, 15 Oct 2026, a picture of a road widening into a block at each pole) */
export const isPowerCrossing = (v: number): boolean => v === 77 || v === 78;
/** Any road or railway tile, which a line runs up to */
export const isAnyRoad = (v: number): boolean => v >= 64 && v <= 206 || v === 237 || v === 238 || v >= 828 && v <= 832 ||
  v >= 948 && v <= 951 || v === 239;
export const isAnyRail = (v: number): boolean => v >= 224 && v <= 238 || v === 221 || v === 222;

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
/** The tiles of a real-scale city map are 40 m or less (src/landBlocks.ts isCityMap) */
const CITY_TILE_MAX_M = 40;
/** World units a metre on a real-scale city map (10 a tile: 0.625 at 16 m a tile), or null on any other map, whose
 * roads and buildings are drawn as for 10 m tiles */
export const realUnits = (tileSizeM?: number | null): number | null =>
  tileSizeM && tileSizeM > 0 && tileSizeM <= CITY_TILE_MAX_M ? 10 / tileSizeM : null;
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
const MAX_KNOT = 3;
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

/** The smooth line a stretch of tiles' middles is drawn along: its steps averaged away, bends rounded */
export function smoothLine(points: Point[]): Point[] {
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
}

/** A stretch between junctions, ends and other tiles: its tiles' middles, and its tiles */
export interface Stretch { points: Point[]; tiles: number[]; level: number; rail: boolean }

export interface Network {
  stretches: Stretch[];
  /** Dead ends, which get a rounded end: where (world units) and the road's level */
  plates: Array<[number, number, number]>;
  /** Junctions' middles (world units), where the roads run into each other */
  junctions: Point[];
  /** 1 for every tile on a line */
  covered: Uint8Array;
}

/** The stretches of the roads (rail false) or the railways of a map */
export function networkOf(map: LineMap, rail: boolean): Network {
  const { width, height } = map;
  const plain = rail ? isLineRail : (v: number) => isLineRoad(v) || isPowerCrossing(v), joins = rail ? isAnyRail : isAnyRoad;
  const rawLevel = (i: number): number => (rail ? 0 : Math.max(1, map.level(i)));
  const near = (i: number): number[] => {
    const x = i % width, y = (i - x) / width, out: number[] = [];
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && joins(map.value(ny * width + nx))) out.push(ny * width + nx);
    }
    return out;
  };
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
    return n.length !== 2 || n.some((j) => !plain(map.value(j)));
  };
  const tileMiddle = (i: number): Point => [((i % width) + 0.5) * 10, (Math.floor(i / width) + 0.5) * 10];
  const covered = new Uint8Array(width * height);
  const count = width * height;
  // Junction tiles side by side (a new road laid beside an old one, or two roads meeting at a slant) are one junction
  // at their middle (owner, 14 Oct 2026: "ทำไมทางแยกมัน มีหลายเส้นแบบนี้"), so long as the knot is small.
  // Only true topological junctions/stops form knots — never 2-neighbour level transitions.
  const knot = new Map<number, number>(), knots: number[][] = [];
  for (let i = 0; i < count; i++) {
    if (!plain(map.value(i)) || !topoStop(i) || near(i).length <= 2 || knot.has(i)) continue;
    const members = [i], queue = [i];
    knot.set(i, knots.length);
    for (let q = 0; q < queue.length; q++) {
      for (const j of near(queue[q])) {
        if (knot.has(j) || !plain(map.value(j)) || !topoStop(j) || near(j).length <= 2) continue;
        knot.set(j, knots.length);
        members.push(j);
        queue.push(j);
      }
    }
    knots.push(members);
  }
  const knotMiddle = knots.map((members): Point | null => {
    if (members.length < 2) return null;
    const xs = members.map((i) => i % width), ys = members.map((i) => Math.floor(i / width));
    if (Math.max(...xs) - Math.min(...xs) > MAX_KNOT || Math.max(...ys) - Math.min(...ys) > MAX_KNOT) return null;
    let x = 0, z = 0;
    for (const i of members) { const [mx, mz] = tileMiddle(i); x += mx; z += mz; }
    return [x / members.length, z / members.length];
  });
  const merged = (i: number): Point | null => (knot.has(i) ? knotMiddle[knot.get(i)!] : null);
  const sameKnot = (i: number, j: number): boolean => knot.has(i) && knot.get(i) === knot.get(j) && merged(i) !== null;
  const centre = (i: number): Point => merged(i) ?? tileMiddle(i);
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
    // Per-tile effective level along the stretch (endpoints inherit their interior neighbour's level if they are junctions)
    const tileLevel = (idx: number): number => {
      const t = tiles[idx];
      if (!topoStop(t) || near(t).length <= 2) return levelOf(t);
      const nb = idx === 0 ? tiles[Math.min(1, tiles.length - 1)] : tiles[Math.max(0, idx - 1)];
      return !topoStop(nb) ? levelOf(nb) : levelOf(t);
    };
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
      for (const tile of subTiles) addPt(centre(tile));
      if (lvNext !== lvCur) {
        const [ax, az] = centre(tiles[endIdx]), [bx, bz] = centre(tiles[endIdx + 1]);
        const mid: Point = [(ax + bx) / 2, (az + bz) / 2];
        addPt(mid);
        addJunction(mid);
        prevMid = mid;
        runStart = endIdx + 1;
        if (points.length > 1) stretches.push({ points, tiles: subTiles, level: lvCur, rail });
        if (isLast) {
          // Final single tile at the end of the stretch with a different level
          const tailPts: Point[] = [mid];
          const endC = centre(tiles[k]);
          if (endC[0] !== mid[0] || endC[1] !== mid[1]) tailPts.push(endC);
          if (tailPts.length > 1) stretches.push({ points: tailPts, tiles: [tiles[k]], level: lvNext, rail });
        }
      } else {
        if (points.length > 1) stretches.push({ points, tiles: subTiles, level: lvCur, rail });
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
  for (let i = 0; i < count; i++) {
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
      else if (merged(i) || n.length > 2) addJunction([px, pz]);
    }
    for (const j of n) {
      if (!plain(map.value(j))) {
        // Up to the edge of a bridge or a crossing, which keeps its own model
        const [cx, cz] = tileMiddle(i), [jx, jz] = tileMiddle(j);
        stretches.push({ points: [centre(i), [cx, cz], [(cx + jx) / 2, (cz + jz) / 2]], tiles: [i], level: levelOf(i), rail });
      } else if (sameKnot(i, j)) {
        // Inside a knot, which is one junction
        done.add(`${i}>${j}`); done.add(`${j}>${i}`);
      } else if (!done.has(`${i}>${j}`)) walk(i, j);
    }
  }
  // Rings with no junction at all
  for (let i = 0; i < count; i++) {
    if (!plain(map.value(i)) || topoStop(i)) continue;
    for (const j of near(i)) if (!done.has(`${i}>${j}`)) walk(i, j);
  }
  return { stretches, plates, junctions, covered };
}

/** Two arms of a junction at least this far apart (degrees) are one road running on through it */
const THROUGH_DEG = 125;
/** How far along a road (world units) its way out of a junction is taken */
const ARM_REACH = 25;

/** A road as drawn: one or more stretches joined where it runs on through a junction, as one smooth line */
export interface RoadLine { points: Point[]; level: number; rail: boolean; stretches: number[] }
/** A road at a junction: its line, the end of it that is there (null where the line runs on through), the way it
 * leaves the junction and its level */
export interface JunctionArm { line: number; end: 0 | 1 | null; way: Point; level: number }
/** A junction as drawn: where its roads meet (on the through road, when one runs through) and its roads, round it */
export interface JunctionShape { at: Point; arms: JunctionArm[]; through: number | null }

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

/** The way along a line from a point on segment i, `reach` units forward (or back), as a unit vector */
function wayAlong(line: Point[], i: number, from: Point, reach: number, forward: boolean): Point {
  let left = reach, [px, pz] = from;
  for (let k = forward ? i : i - 1; forward ? k < line.length : k >= 0; k += forward ? 1 : -1) {
    const [qx, qz] = line[k], d = Math.hypot(qx - px, qz - pz);
    if (d >= left) { const s = left / d; return unit(px + (qx - px) * s - from[0], pz + (qz - pz) * s - from[1]); }
    left -= d; px = qx; pz = qz;
  }
  return unit(px - from[0], pz - from[1]);
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
      const angle = Math.acos(Math.max(-1, Math.min(1, arms[a].way[0] * arms[b].way[0] + arms[a].way[1] * arms[b].way[1]))) * 180 / Math.PI;
      const sameBonus = stretches[arms[a].s].level === stretches[arms[b].s].level ? 8 : 0;
      if (arms.length === 2 || angle >= THROUGH_DEG) pairs.push([angle + sameBonus, a, b]);
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
  const throughSmoothOf = new Map<number, Point[]>();
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
    const wholeSmooth = smoothLine(points);
    if (runs.length === 1) {
      const idx = lines.length;
      for (const s of runs[0].ids) { lineOf.set(s, idx); throughSmoothOf.set(s, wholeSmooth); }
      raw.push(points);
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
    const throughArm = armsAt[j].find((arm) => partner.has(`${arm.s}:${arm.end}`));
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
      const n = lineOf.get(arm.s)!, line = raw[n];
      line[endsAt(n, p) === 0 ? 0 : line.length - 1] = at;
      moved.add(n);
    }
  });
  for (const n of moved) lines[n].points = smoothLine(raw[n]);
  const junctions: JunctionShape[] = network.junctions.map((_, j) => {
    const { through, throughPts, at } = centres[j], out: JunctionArm[] = [];
    const partneredArms = armsAt[j].filter((arm) => partner.has(`${arm.s}:${arm.end}`));
    if (through !== null && throughPts !== null && partneredArms.length === 2) {
      const near = nearestOnLine(throughPts, at);
      const wayFwd = wayAlong(throughPts, near.i, at, reach, true);
      const wayBack = wayAlong(throughPts, near.i, at, reach, false);
      const a0 = partneredArms[0], a1 = partneredArms[1];
      const dot0 = a0.way[0] * wayFwd[0] + a0.way[1] * wayFwd[1];
      const firstFwd = dot0 >= 0;
      const line0 = lineOf.get(a0.s)!, line1 = lineOf.get(a1.s)!;
      out.push(
        { line: line0, end: null, way: firstFwd ? wayFwd : wayBack, level: lines[line0].level },
        { line: line1, end: null, way: firstFwd ? wayBack : wayFwd, level: lines[line1].level },
      );
    } else if (through !== null) {
      const line = lines[through].points, near = nearestOnLine(line, at);
      out.push({ line: through, end: null, way: wayAlong(line, near.i, at, reach, true), level: lines[through].level },
        { line: through, end: null, way: wayAlong(line, near.i, at, reach, false), level: lines[through].level });
    }
    for (const arm of armsAt[j]) {
      if (partner.has(`${arm.s}:${arm.end}`)) continue;
      const n = lineOf.get(arm.s)!, line = lines[n].points, end = endsAt(n, at);
      const way = end === 0 ? wayAlong(line, 1, line[0], reach, true) : wayAlong(line, line.length - 1, line[line.length - 1], reach, false);
      out.push({ line: n, end, way, level: lines[n].level });
    }
    out.sort((a, b) => Math.atan2(a.way[1], a.way[0]) - Math.atan2(b.way[1], b.way[0]));
    return { at, arms: out, through };
  });
  return { lines, junctions };
}
