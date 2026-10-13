/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Real main roads and railways on a whole-province map (GEO_SPEC section 6B). OpenStreetMap ways become chains that
// run from junction to junction, and each chain is routed across the tile grid near its real line, so the game can
// build the result as it is:
// - one tile wide and 4-connected, the way the game's roads and rails join up;
// - straight across water, because the game's bridges cannot turn;
// - a road crosses a railway only at right angles, on a straight piece of track, and never on a bridge (the game's
//   level crossing tiles);
// - a second carriageway or a parallel track reuses the tiles of the first instead of running beside it.

export const NONE = 0;
export const ROAD = 1;
export const RAIL = 2;
/** A road crossing a railway on the level */
export const CROSSING = 3;

const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // east, south, west, north
const HORIZONTAL = 1;
const VERTICAL = 2;
const axisOf = (direction) => (direction % 2 === 0 ? HORIZONTAL : VERTICAL);

// The corridor a chain may use, in tiles from its real line; a chain that cannot be routed tries the wider one
const CORRIDORS = [2.5, 6];
const COST = {
  step: 1,
  offLine: 0.5, // times the squared distance from the real line, in tiles
  water: 2, // each tile of bridge
  reuse: -0.6, // a tile the same network already has
  beside: 0.8, // each tile of the same network the step runs alongside
  crossing: 1, // a level crossing
  turn: 0.2,
};
const MIN_STEP = COST.step + COST.reuse;

// ── Chains ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Joins ways ({ points: [lon, lat, …], rank, ref }) into chains that run from a junction or a dead end to the next,
 * through every point where just two ways meet end to end. Each chain keeps the lowest (most important) rank on
 * it, and its two end points as keys, so chains meeting at a junction can be routed to the same tile.
 */
export function buildChains(ways) {
  const keyOf = (points, i) => `${points[2 * i]},${points[2 * i + 1]}`;
  const degree = new Map();
  for (const way of ways) {
    const count = way.points.length / 2;
    if (count < 2) continue;
    for (let i = 0; i < count; i++) {
      const key = keyOf(way.points, i);
      degree.set(key, (degree.get(key) ?? 0) + (i === 0 || i === count - 1 ? 1 : 2));
    }
  }
  const stops = (key) => degree.get(key) !== 2;

  // Pieces of ways between stops
  const pieces = [];
  for (const way of ways) {
    const count = way.points.length / 2;
    if (count < 2) continue;
    let start = 0;
    for (let i = 1; i < count; i++) {
      if (i === count - 1 || stops(keyOf(way.points, i))) {
        const points = [];
        for (let k = start; k <= i; k++) points.push([way.points[2 * k], way.points[2 * k + 1]]);
        pieces.push({ points, rank: way.rank, ref: way.ref ?? '', from: keyOf(way.points, start), to: keyOf(way.points, i) });
        start = i;
      }
    }
  }

  // Pieces that meet end to end at a point that is not a stop belong to one chain
  const ends = new Map();
  const addEnd = (key, piece) => {
    if (!ends.has(key)) ends.set(key, []);
    ends.get(key).push(piece);
  };
  for (const piece of pieces) {
    addEnd(piece.from, piece);
    addEnd(piece.to, piece);
  }
  const used = new Set();
  const chains = [];
  const follow = (piece, fromKey) => {
    const points = [];
    let rank = piece.rank;
    const refs = new Set();
    let current = piece;
    let entry = fromKey;
    for (;;) {
      used.add(current);
      const forward = current.from === entry;
      const run = forward ? current.points : [...current.points].reverse();
      points.push(...(points.length ? run.slice(1) : run));
      rank = Math.min(rank, current.rank);
      if (current.ref) refs.add(current.ref);
      const exit = forward ? current.to : current.from;
      if (stops(exit)) return { points, rank, refs: [...refs], from: fromKey, to: exit };
      const next = ends.get(exit).find((other) => other !== current && !used.has(other));
      if (!next) return { points, rank, refs: [...refs], from: fromKey, to: exit };
      current = next;
      entry = exit;
    }
  };
  for (const piece of pieces) {
    if (used.has(piece)) continue;
    if (stops(piece.from)) chains.push(follow(piece, piece.from));
    else if (stops(piece.to)) chains.push(follow(piece, piece.to));
  }
  // What is left are loops with no stop on them, such as a roundabout on its own
  for (const piece of pieces) if (!used.has(piece)) chains.push(follow(piece, piece.from));
  return chains;
}

// ── Clipping to the map ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The parts of a line (points in metres) inside the rectangle [0, width] × [0, height]. Each part says whether its
 * ends are the line's own ends or where it was cut at the map's edge.
 */
export function clipLine(points, width, height) {
  const parts = [];
  let current = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const clipped = clipSegment(points[i], points[i + 1], width, height);
    if (!clipped) {
      if (current) parts.push(current);
      current = null;
      continue;
    }
    const [a, b] = clipped;
    // A segment that comes in across the edge starts a new part there
    const cutStart = !samePoint(a, points[i]);
    if (!current || cutStart) {
      if (current) parts.push(current);
      current = { points: [a], startCut: cutStart, endCut: false };
    }
    current.points.push(b);
    if (!samePoint(b, points[i + 1])) {
      current.endCut = true;
      parts.push(current);
      current = null;
    }
  }
  if (current) parts.push(current);
  return parts;
}

const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Liang–Barsky: the piece of segment a–b inside the rectangle, or null. */
function clipSegment(a, b, width, height) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges = [[-dx, a[0]], [dx, width - a[0]], [-dy, a[1]], [dy, height - a[1]]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  const at = (t) => (t === 0 ? a : t === 1 ? b : [a[0] + dx * t, a[1] + dy * t]);
  return [at(t0), at(t1)];
}

// ── The network on the grid ────────────────────────────────────────────────────────────────────────────────────────

/**
 * A grid of roads and railways being laid. water(i) says whether tile i is water. Bridges and level crossings
 * remember their axis, so later routes can only go straight through them.
 */
export function createNetwork(width, height, water) {
  return {
    width,
    height,
    water,
    transport: new Uint8Array(width * height),
    // Per tile and network: the axis a route must keep through it (bridges, level crossings), 0 when free
    roadAxis: new Uint8Array(width * height),
    railAxis: new Uint8Array(width * height),
    // Tiles routes start or end on: kept when tidying up
    anchors: new Set(),
  };
}

const bitOf = (network) => (network === 'rail' ? RAIL : ROAD);
const otherBit = (network) => (network === 'rail' ? ROAD : RAIL);

/** The axis of the other network's straight track through tile i, or 0 when it turns, branches or ends there. */
function straightAxis(net, i, bit) {
  const { width, height, transport } = net;
  const x = i % width;
  const y = (i - x) / width;
  const has = (cx, cy) => cx >= 0 && cy >= 0 && cx < width && cy < height && (transport[cy * width + cx] & bit) !== 0;
  const east = has(x + 1, y);
  const west = has(x - 1, y);
  const south = has(x, y + 1);
  const north = has(x, y - 1);
  if (east && west && !south && !north) return HORIZONTAL;
  if (south && north && !east && !west) return VERTICAL;
  return 0;
}

/**
 * The tile a chain end uses: the tile under it, or the nearest one within reach that a route can start on (dry, and
 * not taken by the other network). Null when there is none.
 */
export function anchorTile(net, network, x, y, reach = 3) {
  const { width, height, transport, water } = net;
  const usable = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return false;
    const i = cy * width + cx;
    return !water(i) && (transport[i] & otherBit(network)) === 0;
  };
  for (let r = 0; r <= reach; r++) {
    let best = null;
    let bestDistance = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !usable(x + dx, y + dy)) continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) { best = (y + dy) * width + x + dx; bestDistance = distance; }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

/** Distance in tiles from each tile near a line (points in tiles) to the line, within radius; Infinity elsewhere. */
function corridorField(points, radius, width, height) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const x0 = Math.max(0, Math.floor(minX - radius - 1));
  const y0 = Math.max(0, Math.floor(minY - radius - 1));
  const x1 = Math.min(width - 1, Math.ceil(maxX + radius + 1));
  const y1 = Math.min(height - 1, Math.ceil(maxY + radius + 1));
  const fieldWidth = x1 - x0 + 1;
  const field = new Float32Array(fieldWidth * (y1 - y0 + 1)).fill(Infinity);
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, ay] = points[k];
    const [bx, by] = points[k + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const sx0 = Math.max(x0, Math.floor(Math.min(ax, bx) - radius));
    const sx1 = Math.min(x1, Math.ceil(Math.max(ax, bx) + radius));
    const sy0 = Math.max(y0, Math.floor(Math.min(ay, by) - radius));
    const sy1 = Math.min(y1, Math.ceil(Math.max(ay, by) + radius));
    for (let ty = sy0; ty <= sy1; ty++) {
      const py = ty + 0.5;
      for (let tx = sx0; tx <= sx1; tx++) {
        const px = tx + 0.5;
        let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
        t = Math.max(0, Math.min(1, t));
        const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        const index = (ty - y0) * fieldWidth + (tx - x0);
        if (distance < field[index]) field[index] = distance;
      }
    }
  }
  return {
    at(i) {
      const x = i % width;
      const y = (i - x) / width;
      if (x < x0 || x > x1 || y < y0 || y > y1) return Infinity;
      return field[(y - y0) * fieldWidth + (x - x0)];
    },
  };
}

/**
 * The cheapest route from tile start to tile goal near a line (points in tiles), as a list of tiles, or null.
 * States are a tile and the direction the route entered it, so bridges and level crossings can be kept straight.
 */
export function routeLine(net, network, points, start, goal, radius) {
  const { width, height, transport, water } = net;
  const bit = bitOf(network);
  const other = otherBit(network);
  const ownAxis = network === 'rail' ? net.railAxis : net.roadAxis;
  const field = corridorField(points, radius, width, height);
  const goalX = goal % width;
  const goalY = (goal - goalX) / width;

  // Whether a route of this network must leave tile i straight on (a bridge, or crossing the other network)
  const locked = (i) => water(i) || (transport[i] & other) !== 0;

  // The search's tables are made once per grid and only the states a search touched are reset after it
  if (!net.search) {
    const stateCount = width * height * 5;
    net.search = { best: new Float64Array(stateCount).fill(Infinity), cameFrom: new Int32Array(stateCount).fill(-1) };
  }
  const { best, cameFrom } = net.search;
  const touched = [];
  const heap = new MinHeap();
  const startState = start * 5 + 4;
  best[startState] = 0;
  touched.push(startState);
  heap.push(startState, heuristic(start));

  function heuristic(i) {
    const x = i % width;
    return (Math.abs(x - goalX) + Math.abs((i - x) / width - goalY)) * MIN_STEP;
  }

  try {
    while (heap.size > 0) {
      const [state, priority] = heap.pop();
      const tile = Math.floor(state / 5);
      const entered = state % 5;
      const cost = best[state];
      if (priority - heuristic(tile) > cost + 1e-6) continue;
      if (tile === goal) return tracePath(cameFrom, state);
  
      const x = tile % width;
      const y = (tile - x) / width;
      for (let direction = 0; direction < 4; direction++) {
        // Through a bridge or a level crossing only straight on, and never straight back
        if (entered !== 4 && tile !== start && locked(tile) && direction !== entered) continue;
        if (entered !== 4 && direction === (entered + 2) % 4) continue;
        const nx = x + STEPS[direction][0];
        const ny = y + STEPS[direction][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        const distance = field.at(next);
        if (distance > radius && next !== goal) continue;
  
        const axis = axisOf(direction);
        const wet = water(next);
        // A bridge or crossing this network already has can only be followed along its axis
        if (ownAxis[next] && ownAxis[next] !== axis) continue;
        let stepCost = COST.step + COST.offLine * Math.min(distance, radius) ** 2;
        if ((transport[next] & other) !== 0) {
          // The other network's track: only across it at right angles where it runs straight, and not over water.
          // A level crossing this network already has is reused along its axis (checked above).
          if (wet) continue;
          if ((transport[next] & bit) === 0) {
            if (straightAxis(net, next, other) !== 3 - axis) continue;
            stepCost += COST.crossing;
          }
        }
        if (wet) {
          // A bridge cannot start or end at the goal, which must be dry land
          if (next === goal) continue;
          stepCost += COST.water;
        }
        if ((transport[next] & bit) !== 0) {
          stepCost += COST.reuse;
        } else {
          for (let side = 0; side < 4; side++) {
            const sx = nx + STEPS[side][0];
            const sy = ny + STEPS[side][1];
            if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
            const neighbour = sy * width + sx;
            if (neighbour !== tile && (transport[neighbour] & bit) !== 0) stepCost += COST.beside;
          }
        }
        if (entered !== 4 && direction !== entered) stepCost += COST.turn;
  
        const nextState = next * 5 + direction;
        const nextCost = cost + stepCost;
        if (nextCost < best[nextState]) {
          if (best[nextState] === Infinity) touched.push(nextState);
          best[nextState] = nextCost;
          cameFrom[nextState] = state;
          heap.push(nextState, nextCost + heuristic(next));
        }
      }
    }
    return null;
  } finally {
    for (const state of touched) {
      best[state] = Infinity;
      cameFrom[state] = -1;
    }
  }
}

/** routeLine in the narrow corridor, then the wide one. */
export function route(net, network, points, start, goal) {
  if (start === null || goal === null) return null;
  if (start === goal) return [start];
  for (const radius of CORRIDORS) {
    const path = routeLine(net, network, points, start, goal, radius);
    if (path) return path;
  }
  return null;
}

function tracePath(cameFrom, state) {
  const tiles = [];
  for (let s = state; s !== -1; s = cameFrom[s]) tiles.push(Math.floor(s / 5));
  return tiles.reverse();
}

/** Lays a routed path: marks its tiles, and the axis of every bridge and level crossing on it. */
export function layPath(net, network, path) {
  const { width, transport, water } = net;
  const bit = bitOf(network);
  const ownAxis = network === 'rail' ? net.railAxis : net.roadAxis;
  const otherAxis = network === 'rail' ? net.roadAxis : net.railAxis;
  for (let k = 0; k < path.length; k++) {
    const tile = path[k];
    const neighbour = path[k + 1] ?? path[k - 1];
    const axis = neighbour === undefined ? 0 : Math.abs(neighbour - tile) === 1 ? HORIZONTAL : VERTICAL;
    const crossing = (transport[tile] & otherBit(network)) !== 0;
    transport[tile] |= bit;
    if ((water(tile) || crossing) && axis) ownAxis[tile] = axis;
    // The other network's track through a level crossing is held to its own axis from now on
    if (crossing && axis) otherAxis[tile] = 3 - axis;
  }
  if (path.length) {
    net.anchors.add(path[0]);
    net.anchors.add(path[path.length - 1]);
  }
  void width;
}

/**
 * Removes a tile from every 2 × 2 block of one network where that cannot cut anything off, so no stretch of road
 * or rail is two tiles wide (the game would draw it as a cluster of junctions). Anchors, bridges and crossings stay.
 */
export function thinBlocks(net, network) {
  const { width, height, transport, water } = net;
  const bit = bitOf(network);
  const ownAxis = network === 'rail' ? net.railAxis : net.roadAxis;
  const has = (x, y) => x >= 0 && y >= 0 && x < width && y < height && (transport[y * width + x] & bit) !== 0;
  // Bridges and level crossings need the tiles on either side of them to stay
  const nextToLocked = (x, y) => STEPS.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < width && ny < height && ownAxis[ny * width + nx] !== 0;
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y + 1 < height; y++) {
      for (let x = 0; x + 1 < width; x++) {
        if (!(has(x, y) && has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1))) continue;
        for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
          const i = cy * width + cx;
          if (net.anchors.has(i) || water(i) || transport[i] !== bit || nextToLocked(cx, cy)) continue;
          if (removable(has, cx, cy)) {
            transport[i] &= ~bit;
            changed = true;
            break;
          }
        }
      }
    }
  }
}

/**
 * Whether the tile at (x, y) can go without splitting the network around it: the tiles it touches stay joined to
 * each other through the rest of the 3 × 3 square (4-connected). The end of a line is never removed.
 */
function removable(has, x, y) {
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && has(x + dx, y + dy)) cells.push([dx, dy]);
    }
  }
  const touching = cells.filter(([dx, dy]) => Math.abs(dx) + Math.abs(dy) === 1);
  if (touching.length < 2) return false;
  // Flood through the ring of the 3 × 3 square from the first 4-neighbour
  const key = ([dx, dy]) => `${dx},${dy}`;
  const present = new Set(cells.map(key));
  const seen = new Set([key(touching[0])]);
  const queue = [touching[0]];
  while (queue.length) {
    const [dx, dy] = queue.pop();
    for (const [sx, sy] of STEPS) {
      const next = [dx + sx, dy + sy];
      const k = key(next);
      if (present.has(k) && !seen.has(k)) { seen.add(k); queue.push(next); }
    }
  }
  return touching.every((cell) => seen.has(key(cell)));
}

// ── A small binary heap (also used by links.mjs) ───────────────────────────────────────────────────────────────────

export class MinHeap {
  constructor() {
    this.items = [];
    this.priorities = [];
  }

  get size() {
    return this.items.length;
  }

  push(item, priority) {
    const { items, priorities } = this;
    let i = items.length;
    items.push(item);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (priorities[parent] <= priority) break;
      items[i] = items[parent];
      priorities[i] = priorities[parent];
      i = parent;
    }
    items[i] = item;
    priorities[i] = priority;
  }

  pop() {
    const { items, priorities } = this;
    const top = [items[0], priorities[0]];
    const lastItem = items.pop();
    const lastPriority = priorities.pop();
    if (items.length > 0) {
      let i = 0;
      const half = items.length >> 1;
      while (i < half) {
        let child = 2 * i + 1;
        if (child + 1 < items.length && priorities[child + 1] < priorities[child]) child++;
        if (priorities[child] >= lastPriority) break;
        items[i] = items[child];
        priorities[i] = priorities[child];
        i = child;
      }
      items[i] = lastItem;
      priorities[i] = lastPriority;
    }
    return top;
  }
}
