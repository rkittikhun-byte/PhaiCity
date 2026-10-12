/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads between provinces (owner, 12 Oct 2026; GEO_SPEC section 6B): a province map starts with one main road
// to each neighbouring province, a laterite road from the border to the provincial town, and nothing else; the
// player builds every other road. Each road is the real one, found on OpenStreetMap's main roads: the crossing
// into the neighbour that makes the shortest way between the two towns, followed on to the map's edge.

import { MinHeap } from './routing.mjs';

/** Main roads are weighed by class, so the way between towns keeps to the bigger roads. */
const CLASS_WEIGHT = [1, 1, 1.25]; // motorway, trunk, primary
/** How near the town a road must pass to start from it; further away, the nearest road point is used anyway. */
const TOWN_REACH_M = 5000;

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
  return nodes;
}

/** Shortest weighted distances from a node, over nodes allowed by keep(node); with the edge each was reached by. */
function shortestFrom(start, keep = () => true) {
  const distance = new Map([[start, 0]]);
  const via = new Map();
  const queue = new MinHeap();
  queue.push(start, 0);
  const done = new Set();
  while (queue.size > 0) {
    const [node, cost] = queue.pop();
    if (done.has(node)) continue;
    done.add(node);
    for (const edge of node.edges) {
      if (!keep(edge.to)) continue;
      const next = cost + edge.weight;
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
 * - neighborOf(node): the province an outside node is in, or null
 * - town: { x, y } in metres; townOf(id): another province's town in metres, or null
 * - onMap(node): whether a node is on the map
 */
export function provinceLinks({ nodes, inside, neighborOf, town, townOf, onMap }) {
  // Start from the main road nearest the town
  let start = null;
  let startDistance = Infinity;
  for (const node of nodes.values()) {
    if (!inside(node)) continue;
    const distance = Math.hypot(node.x - town.x, node.y - town.y);
    if (distance < startDistance) { start = node; startDistance = distance; }
  }
  if (!start) return { links: [], townRoadM: null };

  // The best crossing into each neighbour: the shortest way from the town to it, plus the straight distance from
  // it to the neighbour's town
  const { distance, via } = shortestFrom(start, inside);
  const best = new Map();
  for (const [node, cost] of distance) {
    for (const edge of node.edges) {
      if (inside(edge.to)) continue;
      const neighbor = neighborOf(edge.to);
      if (!neighbor) continue;
      const theirTown = townOf(neighbor);
      const onward = theirTown ? Math.hypot(edge.to.x - theirTown.x, edge.to.y - theirTown.y) : 0;
      const score = cost + edge.weight + onward;
      if (score < (best.get(neighbor)?.score ?? Infinity)) best.set(neighbor, { score, from: node, edge });
    }
  }

  const links = [];
  for (const [neighbor, { from, edge }] of best) {
    const inward = pathTo(via, from);
    // On from the crossing, outside the province, to where the road leaves the map, or as far as it goes
    const outside = shortestFrom(edge.to, (node) => !inside(node));
    let end = null;
    let endCost = Infinity;
    for (const [node, cost] of outside.distance) {
      if (!onMap(node) && cost < endCost) { end = node; endCost = cost; }
    }
    if (!end) {
      endCost = -Infinity;
      for (const [node, cost] of outside.distance) if (cost > endCost) { end = node; endCost = cost; }
    }
    const outward = pathTo(outside.via, end);
    const points = [...inward, ...outward].map((node) => [node.x, node.y]);
    links.push({ neighbor, ref: edge.way.ref ?? '', rank: edge.way.rank, points });
  }
  links.sort((a, b) => a.neighbor.localeCompare(b.neighbor));
  return { links, townRoadM: startDistance > TOWN_REACH_M ? startDistance : 0 };
}
