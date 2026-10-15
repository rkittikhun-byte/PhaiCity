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
  const plain = rail ? isLineRail : isLineRoad, joins = rail ? isAnyRail : isAnyRoad;
  const levelOf = (i: number): number => (rail ? 0 : Math.max(1, map.level(i)));
  const near = (i: number): number[] => {
    const x = i % width, y = (i - x) / width, out: number[] = [];
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && joins(map.value(ny * width + nx))) out.push(ny * width + nx);
    }
    return out;
  };
  const stop = (i: number): boolean => {
    const n = near(i);
    return n.length !== 2 || n.some((j) => !plain(map.value(j)) || levelOf(j) !== levelOf(i));
  };
  const tileMiddle = (i: number): Point => [((i % width) + 0.5) * 10, (Math.floor(i / width) + 0.5) * 10];
  const covered = new Uint8Array(width * height);
  const count = width * height;
  // Junction tiles side by side (a new road laid beside an old one, or two roads meeting at a slant) are one junction
  // at their middle (owner, 14 Oct 2026: "ทำไมทางแยกมัน มีหลายเส้นแบบนี้"), so long as the knot is small
  const knot = new Map<number, number>(), knots: number[][] = [];
  for (let i = 0; i < count; i++) {
    if (!plain(map.value(i)) || !stop(i) || knot.has(i)) continue;
    const members = [i], queue = [i];
    knot.set(i, knots.length);
    for (let q = 0; q < queue.length; q++) {
      for (const j of near(queue[q])) {
        if (knot.has(j) || !plain(map.value(j)) || !stop(j)) continue;
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
  const walk = (from: number, to: number): void => {
    const tiles = [from, to];
    done.add(`${from}>${to}`); done.add(`${to}>${from}`);
    while (!stop(tiles[tiles.length - 1])) {
      const last = tiles[tiles.length - 1], before = tiles[tiles.length - 2];
      const next = near(last).find((j) => j !== before && !done.has(`${last}>${j}`));
      if (next === undefined) break;
      done.add(`${last}>${next}`); done.add(`${next}>${last}`);
      tiles.push(next);
      if (next === tiles[0]) break;
    }
    // A short way out of a knot and straight back in is part of the knot
    const first = tiles[0], end = tiles[tiles.length - 1];
    if (tiles.length <= 2 * MAX_KNOT && sameKnot(first, end)) return;
    // Its tiles' middles, a knot's tiles at the knot's middle, each once
    const points: Point[] = [];
    for (const tile of tiles) {
      const point = centre(tile), last = points[points.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
    }
    if (points.length > 1) stretches.push({ points, tiles, level: levelOf(tiles[1]), rail });
  };
  const plated = new Set<number>(), junctions: Point[] = [];
  for (let i = 0; i < count; i++) {
    if (!plain(map.value(i))) continue;
    covered[i] = 1;
    if (!stop(i)) continue;
    const n = near(i);
    // Dead ends and lone tiles get a rounded end; a junction (a knot one at its middle) is where its roads meet
    const id = merged(i) ? -1 - knot.get(i)! : i;
    if (!plated.has(id)) {
      plated.add(id);
      const [px, pz] = centre(i);
      if (!merged(i) && n.length <= 1) plates.push([px, pz, levelOf(i)]);
      else if (merged(i) || n.length > 2) junctions.push([px, pz]);
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
    if (!plain(map.value(i)) || stop(i)) continue;
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
 * เอากลมๆ ไปวางเฉยๆ"): at each junction the two roads that run on most nearly straight, of one level, are one road
 * through it, drawn as one smooth line; the others end at it. And each junction's shape: where its roads meet and
 * the way each leaves, round it, for drawing its corners.
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
  // The roads running on through each junction, the straightest first
  const partner = new Map<string, string>();
  for (const arms of armsAt) {
    const pairs: Array<[number, number, number]> = [];
    for (let a = 0; a < arms.length; a++) for (let b = a + 1; b < arms.length; b++) {
      if (arms[a].s === arms[b].s || stretches[arms[a].s].level !== stretches[arms[b].s].level) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, arms[a].way[0] * arms[b].way[0] + arms[a].way[1] * arms[b].way[1]))) * 180 / Math.PI;
      if (angle >= THROUGH_DEG) pairs.push([angle, a, b]);
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
  // The stretches joined end to end through their junctions, each road once
  const lineOf = new Map<number, number>(), lines: RoadLine[] = [], raw: Point[][] = [];
  const chain = (start: number, enter: 0 | 1): void => {
    const points: Point[] = [], ids: number[] = [];
    for (let s = start, e = enter; ;) {
      lineOf.set(s, lines.length); ids.push(s);
      const own = e === 0 ? stretches[s].points : [...stretches[s].points].reverse();
      for (const p of own) { const last = points[points.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p); }
      const next = partner.get(`${s}:${e === 0 ? 1 : 0}`);
      if (!next) break;
      const [t, te] = next.split(":").map(Number);
      if (lineOf.has(t)) break;
      s = t; e = te as 0 | 1;
    }
    raw.push(points);
    lines.push({ points: smoothLine(points), level: stretches[start].level, rail: stretches[start].rail, stretches: ids });
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
    return { through, at: through === null ? p : nearestOnLine(lines[through].points, p).at };
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
    const { through, at } = centres[j], out: JunctionArm[] = [];
    if (through !== null) {
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
