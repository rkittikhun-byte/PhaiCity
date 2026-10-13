/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads between provinces (owner, 12 Oct 2026; GEO_SPEC section 6B): a province map starts with one main road
// to each neighbouring province, a laterite road from the border to the provincial town, and nothing else; the
// player builds every other road. Each road is the real one, found on OpenStreetMap's main roads: the crossing
// into the neighbour that makes the shortest way between the two towns, followed on to the map's edge.

import { MinHeap } from './routing.mjs';

/** Main roads are weighed by class, so the way between towns keeps to the bigger roads. */
const CLASS_WEIGHT = [1, 1, 1.25, 1.5, 1.8, 2.2]; // motorway, trunk, primary; secondary, tertiary, unclassified (a district map)
/** How near the town a road must pass to start from it; further away, the nearest road point is used anyway. */
const TOWN_REACH_M = 5000;
/**
 * Roads outside the province cost this many times their length on the way to a border crossing: the way keeps
 * inside when it can, but may step out where a road runs along the border, in and out of it.
 */
const OUTSIDE_WEIGHT = 4;
/**
 * Main roads often meet through a smaller road the graph does not have: a main road that ends within this distance
 * of another one is joined to it, at GAP_WEIGHT times the straight distance.
 */
const GAP_M = 500;
const GAP_WEIGHT = 1.5;
/** Getting from the town's middle to a main road near it costs this many times the straight distance. */
const TOWN_WEIGHT = 1.5;

/** Even-odd test of a point against rings, with the rings' edges sorted into horizontal bands for speed. */
export function polygonIndex(rings, bandSize) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) for (const [, y] of ring) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const bandCount = Math.max(1, Math.ceil((maxY - minY) / bandSize) + 1);
  const bands = Array.from({ length: bandCount }, () => []);
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if (y1 === y2) continue;
      const first = Math.floor((Math.min(y1, y2) - minY) / bandSize);
      const last = Math.floor((Math.max(y1, y2) - minY) / bandSize);
      for (let band = first; band <= last; band++) bands[band].push([x1, y1, x2, y2]);
    }
  }
  return {
    contains(x, y) {
      if (y < minY || y > maxY) return false;
      let inside = false;
      for (const [x1, y1, x2, y2] of bands[Math.floor((y - minY) / bandSize)]) {
        if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) inside = !inside;
      }
      return inside;
    },
  };
}

/** The id of the province whose shape holds a point, or null (the sea, or another country). */
export function provinceAt(lon, lat, shapes) {
  for (const [id, shape] of shapes) {
    const [west, south, east, north] = shape.bbox;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    let inside = false;
    for (const ring of shape.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        if ((y1 > lat) !== (y2 > lat) && lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1)) inside = !inside;
      }
    }
    if (inside) return id;
  }
  return null;
}

/**
 * The main roads as a graph: a node for every point of every way (ways share the points where they join), and an
 * edge between neighbouring points. project(lat, lon) gives a point in metres.
 */
export function roadGraph(ways, project) {
  const nodes = new Map();
  const nodeOf = (lon, lat) => {
    const key = `${lon},${lat}`;
    let node = nodes.get(key);
    if (!node) {
      const { x, y } = project(lat, lon);
      node = { key, lon, lat, x, y, edges: [] };
      nodes.set(key, node);
    }
    return node;
  };
  for (const way of ways) {
    let previous = null;
    for (let i = 0; i < way.points.length; i += 2) {
      const node = nodeOf(way.points[i], way.points[i + 1]);
      if (previous && previous !== node) {
        const length = Math.hypot(node.x - previous.x, node.y - previous.y);
        const weight = length * CLASS_WEIGHT[way.rank];
        previous.edges.push({ to: node, weight, way });
        node.edges.push({ to: previous, weight, way });
      }
      previous = node;
    }
  }
  joinGaps(nodes);
  return nodes;
}

/** Joins every dead end of a main road to the nearest point of another road within GAP_M (see GAP_M). */
function joinGaps(nodes) {
  const cells = new Map();
  const cellOf = (x, y) => `${Math.floor(x / GAP_M)},${Math.floor(y / GAP_M)}`;
  for (const node of nodes.values()) {
    const key = cellOf(node.x, node.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(node);
  }
  for (const node of nodes.values()) {
    if (node.edges.length !== 1) continue;
    const ownWay = node.edges[0].way;
    const cx = Math.floor(node.x / GAP_M);
    const cy = Math.floor(node.y / GAP_M);
    let nearest = null;
    let nearestDistance = GAP_M;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const other of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (other === node || other.edges.some((edge) => edge.way === ownWay)) continue;
          const distance = Math.hypot(other.x - node.x, other.y - node.y);
          if (distance < nearestDistance) { nearest = other; nearestDistance = distance; }
        }
      }
    }
    if (!nearest) continue;
    const weight = nearestDistance * GAP_WEIGHT;
    node.edges.push({ to: nearest, weight, way: ownWay });
    nearest.edges.push({ to: node, weight, way: ownWay });
  }
}

/**
 * Shortest weighted distances from a node, each edge costing costOf(edge, from) (Infinity to leave it out), with the
 * edge each node was reached by; nodes further than maxCost are not looked at. start may also be a Map of several
 * nodes to what reaching each already cost.
 */
function shortestFrom(start, costOf = (edge) => edge.weight, maxCost = Infinity) {
  const distance = start instanceof Map ? new Map(start) : new Map([[start, 0]]);
  const via = new Map();
  const queue = new MinHeap();
  for (const [node, cost] of distance) queue.push(node, cost);
  const done = new Set();
  while (queue.size > 0) {
    const [node, cost] = queue.pop();
    if (done.has(node)) continue;
    done.add(node);
    for (const edge of node.edges) {
      const next = cost + costOf(edge, node);
      if (next > maxCost) continue;
      if (next < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, next);
        via.set(edge.to, { from: node, edge });
        queue.push(edge.to, next);
      }
    }
  }
  return { distance, via };
}

function pathTo(via, node) {
  const nodes = [node];
  for (let step = via.get(node); step; step = via.get(step.from)) nodes.push(step.from);
  return nodes.reverse();
}

/**
 * One road to each neighbouring province: [{ neighbor, ref, rank, points }] with points in metres, from the town
 * through the border crossing and on to where the road leaves the map (or ends).
 * - nodes: roadGraph of the main roads around the map
 * - inside(node): whether a node is in the province
 * - provinceOf(node): which neighbouring province a node outside is in, or null (the sea, another country, a gap)
 * - neighbors: the neighbouring provinces' ids
 * - town: { x, y } in metres; townOf(id): another province's town in metres, or null
 * - onMap(node): whether a node is on the map
 * For each neighbour the search keeps to the province, that neighbour and land in neither (a bridge, a strait), so
 * the road found leads straight from one to the other; its last crossing of the border is where it leaves.
 */
export function provinceLinks({ nodes, inside, provinceOf, neighbors, town, townOf, onMap }) {
  // Start from every main road near the town, as the town's own streets lead to all of them; with none near it,
  // from the nearest
  let nearest = null;
  let startDistance = Infinity;
  const starts = new Map();
  for (const node of nodes.values()) {
    if (!inside(node)) continue;
    const distance = Math.hypot(node.x - town.x, node.y - town.y);
    if (distance < startDistance) { nearest = node; startDistance = distance; }
    if (distance <= TOWN_REACH_M) starts.set(node, distance * TOWN_WEIGHT);
  }
  if (!nearest) return { links: [], townRoadM: null };
  if (!starts.size) starts.set(nearest, 0);

  const links = [];
  for (const neighbor of neighbors) {
    // Roads outside the province cost more, and those in a third province cannot be used
    const allowed = (node) => inside(node) || provinceOf(node) === neighbor || provinceOf(node) === null;
    const cost = (edge, from) => {
      if (!allowed(edge.to)) return Infinity;
      // A stretch across the border counts as half outside
      const outside = (inside(from) ? 0 : 0.5) + (inside(edge.to) ? 0 : 0.5);
      return edge.weight * (1 + (OUTSIDE_WEIGHT - 1) * outside);
    };
    const { distance, via } = shortestFrom(starts, cost);

    // The point in the neighbour that is cheapest to reach and then nearest its town
    const theirTown = townOf(neighbor);
    let target = null;
    let bestScore = Infinity;
    for (const [node, reached] of distance) {
      if (provinceOf(node) !== neighbor) continue;
      const score = reached + (theirTown ? Math.hypot(node.x - theirTown.x, node.y - theirTown.y) : 0);
      if (score < bestScore) { target = node; bestScore = score; }
    }
    if (!target) continue;
    const path = pathTo(via, target);

    // On from there into the neighbour, to where the road leaves the map or as far as it goes there. A road along the
    // border may run back into the province on the way; it never goes into a third province.
    const onward = shortestFrom(target, cost);
    let last = null;
    let lastCost = Infinity;
    for (const [node, reached] of onward.distance) {
      if (!onMap(node) && provinceOf(node) === neighbor && reached < lastCost) { last = node; lastCost = reached; }
    }
    if (!last) {
      lastCost = -Infinity;
      for (const [node, reached] of onward.distance) {
        if (provinceOf(node) === neighbor && reached > lastCost) { last = node; lastCost = reached; }
      }
    }
    const nodesOnWay = [...path, ...pathTo(onward.via, last).slice(1)];

    // Where it leaves the province for the last time, and the road's number there
    let exit = -1;
    for (let k = 1; k < nodesOnWay.length; k++) if (inside(nodesOnWay[k - 1]) && !inside(nodesOnWay[k])) exit = k;
    if (exit < 0) continue;
    const crossing = nodesOnWay[exit - 1].edges.find((edge) => edge.to === nodesOnWay[exit]);

    const points = nodesOnWay.map((node) => [node.x, node.y]);
    links.push({ neighbor, ref: crossing.way.ref ?? '', rank: crossing.way.rank, points, exitIndex: exit });
  }
  links.sort((a, b) => a.neighbor.localeCompare(b.neighbor));
  return { links, townRoadM: startDistance > TOWN_REACH_M ? startDistance : 0 };
}
