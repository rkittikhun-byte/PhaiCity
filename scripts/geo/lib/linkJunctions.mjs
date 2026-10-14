/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Where a district's roads meet (owner, 15 Oct 2026, after "ความเป็นจริงของถนนเป็นแบบนี้ได้เหรอ?" about two junctions
// 93 m apart, the roads meeting at a sharp angle). The roads to the neighbours follow the real roads, but the town's
// short spokes to them and the real roads' slip roads leave knots of junctions a few tiles apart and Y-forks. So:
// - two lines running closer than TWIN_M are one road (a dual carriageway's two ways), laid once
// - a spoke from the town (a straight way to a real road up to 1.5 km off, not a real road) that leaves the town
//   within SIDE_DEG of a real road leaves from that road instead, a little past JUNCTION_MERGE_M from the town (not
//   where the road comes nearest the spoke's end: on Khon Kaen's that ran along the railway, across it again and again)
// - two junctions closer than JUNCTION_MERGE_M along a road become one (the town, or the busier junction, stays put)
// - a road leaving a through road at a sharp angle leaves it nearly square and runs straight SQUARE_RUN_M first
// Plain code on lines of points in tiles, each from the town outwards (provinceMap.mjs layLinkNetwork); nothing random.

export const JUNCTION_MERGE_M = 100;
/** 80 m of tiles, of which the 3D view's smoothing (src/roadGeometry.ts smoothLine) leaves about 50 m straight */
export const SQUARE_RUN_M = 80;
/** A road leaving a through road at less than this (degrees) leaves it square instead */
const SHARP_DEG = 60;
/** Two arms at least this far apart (degrees) are one road running through the junction */
const THROUGH_DEG = 135;
/** A spoke leaving the town less than this (degrees) beside a road leaves from that road */
const SIDE_DEG = 30;
/** How far past JUNCTION_MERGE_M from the town such a spoke leaves its road, as a share */
const BRANCH_PAST = 1.25;
/** Two lines closer than this (metres) are one road */
export const TWIN_M = 50;

export const pointKey = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = ([x, y]) => {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
};
const degreesBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180 / Math.PI;

/** The lines as one network: each point by its key, its neighbours, and where lines end */
function network(lines) {
  const at = new Map(), next = new Map(), ends = new Set();
  const join = (a, b) => {
    if (!next.has(a)) next.set(a, new Set());
    next.get(a).add(b);
  };
  for (const points of lines) {
    if (points.length < 2) continue;
    for (const point of points) at.set(pointKey(point), point);
    ends.add(pointKey(points[0]));
    ends.add(pointKey(points[points.length - 1]));
    for (let i = 1; i < points.length; i++) {
      const a = pointKey(points[i - 1]), b = pointKey(points[i]);
      join(a, b);
      join(b, a);
    }
  }
  return { at, next, ends };
}

/** From a point through one of its neighbours to the next junction or end (or until `reach` tiles from the start):
 * the keys passed and the length along them */
function walk({ at, next, ends }, from, first, reach = Infinity) {
  const keys = [from, first];
  let length = distance(at.get(from), at.get(first));
  for (;;) {
    const last = keys[keys.length - 1];
    if (ends.has(last) || next.get(last).size !== 2 || distance(at.get(from), at.get(last)) >= reach) break;
    const onward = [...next.get(last)].find((k) => k !== keys[keys.length - 2]);
    if (onward === undefined || onward === from) break;
    length += distance(at.get(last), at.get(onward));
    keys.push(onward);
  }
  return { keys, length };
}

/** The line without its loops: where it comes back to a point it passed, the way round is dropped */
function withoutLoops(points) {
  const out = [], index = new Map();
  for (const point of points) {
    const k = pointKey(point);
    if (index.has(k)) {
      for (const dropped of out.splice(index.get(k) + 1)) index.delete(pointKey(dropped));
      continue;
    }
    index.set(k, out.length);
    out.push(point);
  }
  return out;
}

/** The point of the lines' segments nearest p within reach: its line, and that segment's end nearer the point */
function nearestOn(lines, p, reach) {
  let best = null;
  lines.forEach((points, m) => {
    for (let j = 1; j < points.length; j++) {
      const [ax, ay] = points[j - 1], dx = points[j][0] - ax, dy = points[j][1] - ay;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(ax + dx * t - p[0], ay + dy * t - p[1]);
      if (d <= reach && (!best || d < best.d)) best = { m, v: t < 0.5 ? j - 1 : j, d };
    }
  });
  return best;
}

/**
 * Two lines running closer than reachTiles are one road (a dual carriageway is two ways in OpenStreetMap, a few metres
 * apart): each line's points that near an earlier line are moved onto that line's points, with the ones between, so
 * the two share them, as two tracks of one railway are laid once (provinceMap.mjs DOUBLE_TRACK_M)
 */
function snapTwins(lines, reachTiles) {
  const done = [];
  for (const points of lines) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const near = i === 0 ? null : nearestOn(done, points[i], reachTiles);
      if (!near) { out.push({ point: points[i] }); continue; }
      const previous = out[out.length - 1], source = done[near.m];
      if (previous && previous.m === near.m && previous.v !== near.v) {
        const step = near.v > previous.v ? 1 : -1;
        for (let v = previous.v + step; v !== near.v; v += step) out.push({ point: source[v], m: near.m, v });
      }
      out.push({ point: source[near.v], m: near.m, v: near.v });
    }
    done.push(withoutLoops(out.map((entry) => entry.point)));
  }
  return done;
}

/**
 * A spoke from the town (the straight way to its line's first real point, longer than minTiles) that leaves the town
 * within SIDE_DEG of another line whose first step is shorter (a real road from the town) leaves from that line
 * instead, at its first point at least branchTiles from the town, as a junction of its own (squared later)
 */
function branchOffRoads(lines, town, minTiles, branchTiles) {
  const townKey = pointKey(town);
  // A line's way from the town, taken `reach` tiles out
  const lead = (points, reach) => {
    let i = 1;
    while (i < points.length - 1 && distance(points[i], town) < reach) i++;
    return unit([points[i][0] - town[0], points[i][1] - town[1]]);
  };
  return lines.map((points, n) => {
    if (points.length < 2 || pointKey(points[0]) !== townKey) return points;
    const end = points[1], spoke = distance(town, end);
    if (spoke < minTiles) return points;
    const way = unit([end[0] - town[0], end[1] - town[1]]);
    let best = null;
    lines.forEach((other, m) => {
      if (m === n || other.length < 2 || pointKey(other[0]) !== townKey || distance(town, other[1]) >= spoke) return;
      const side = degreesBetween(way, lead(other, minTiles));
      if (side >= SIDE_DEG || (best && side >= best.side)) return;
      const branch = other.findIndex((point, i) => i > 0 && distance(point, town) >= branchTiles);
      if (branch > 0 && distance(other[branch], town) < spoke) best = { other, branch, side };
    });
    return best ? withoutLoops([town, ...best.other.slice(1, best.branch + 1), ...points.slice(1)]) : points;
  });
}

/** Two junctions closer than mergeTiles along the road between them become one */
function mergeClose(lines, townKey, mergeTiles) {
  for (let round = 0; round < 50; round++) {
    const net = network(lines);
    const hub = (k) => k === townKey || (net.next.get(k)?.size ?? 0) >= 3;
    let found = null;
    for (const [from, others] of net.next) {
      if (!hub(from)) continue;
      for (const first of others) {
        const { keys, length } = walk(net, from, first);
        const end = keys[keys.length - 1];
        if (end !== from && hub(end) && length < mergeTiles) { found = keys; break; }
      }
      if (found) break;
    }
    if (!found) return lines;
    // The town stays where it is, else the busier junction, else the first
    let keep = found[0], other = found[found.length - 1];
    const degree = (k) => net.next.get(k).size;
    if (other === townKey || (keep !== townKey && degree(other) > degree(keep))) [keep, other] = [other, keep];
    const kept = net.at.get(keep), gone = new Set(found.filter((k) => k !== keep));
    lines = lines.map((points) => withoutLoops(points.map((point) => (gone.has(pointKey(point)) ? kept : point))));
  }
  return lines;
}

/** A road leaving a through road at a sharp angle leaves it square and runs straight runTiles first; not at the town,
 * whose spokes spread out from it like a star (squared there, Phon's made a knot of short stubs) */
function squareJunctions(lines, runTiles, townKey) {
  const net = network(lines), squares = new Map();
  for (const [hub, others] of net.next) {
    if (others.size < 3 || hub === townKey) continue;
    const at = net.at.get(hub);
    // Each arm's way from the junction, taken a little way along it so a kink at the junction does not count
    const arms = [...others].map((first) => {
      const { keys } = walk(net, hub, first, runTiles * 2);
      const far = net.at.get(keys[keys.length - 1]);
      return { first, way: unit([far[0] - at[0], far[1] - at[1]]) };
    });
    let through = null;
    for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++) {
      const angle = degreesBetween(arms[i].way, arms[j].way);
      if (!through || angle > through.angle) through = { i, j, angle };
    }
    if (through.angle < THROUGH_DEG) continue;
    const a = arms[through.i].way, b = arms[through.j].way, along = unit([a[0] - b[0], a[1] - b[1]]);
    arms.forEach((arm, k) => {
      if (k === through.i || k === through.j || Math.min(degreesBetween(arm.way, a), degreesBetween(arm.way, b)) >= SHARP_DEG) return;
      let square = [-along[1], along[0]];
      if (square[0] * arm.way[0] + square[1] * arm.way[1] < 0) square = [-square[0], -square[1]];
      squares.set(`${hub}|${arm.first}`, [at[0] + square[0] * runTiles, at[1] + square[1] * runTiles]);
    });
  }
  if (!squares.size) return lines;
  const junction = (k) => net.ends.has(k) || (net.next.get(k)?.size ?? 0) !== 2;
  // Into the squared arm: its square point, then on from the first point well past it (never past another junction)
  const forward = (points) => {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      out.push(points[i]);
      const square = i + 1 < points.length ? squares.get(`${pointKey(points[i])}|${pointKey(points[i + 1])}`) : undefined;
      if (!square) continue;
      out.push(square);
      let j = i + 1;
      while (j < points.length - 1 && distance(points[j], points[i]) < runTiles * 1.5 && !junction(pointKey(points[j]))) j++;
      i = j - 1;
    }
    return out;
  };
  return lines.map((points) => forward(forward(points).reverse()).reverse());
}

/**
 * The lines (points in tiles, each from the town outwards) with their junctions tidied: twins made one, spokes beside a
 * road leaving from it, junctions closer than JUNCTION_MERGE_M along a road made one, and sharp ones squared. tileSizeM: metres a tile.
 */
export function tidyJunctions(lines, town, tileSizeM) {
  const mergeTiles = JUNCTION_MERGE_M / tileSizeM;
  const twins = snapTwins(lines, TWIN_M / tileSizeM);
  const branched = branchOffRoads(twins, town, 2 * SQUARE_RUN_M / tileSizeM, mergeTiles * BRANCH_PAST);
  const merged = mergeClose(branched, pointKey(town), mergeTiles);
  return squareJunctions(merged, SQUARE_RUN_M / tileSizeM, pointKey(town));
}
