/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A whole province as a game map (GEO_SPEC sections 2, 5, 6 and 6B): its land, water and woods, which tiles are in
// the province (the rest cannot be built on), the railways through it, one laterite road to each neighbouring
// province, where those leave the province, and the tile of the provincial town.

import { createMask, fillPolygon, labelRegions, orMask, seaFromCoastline, tileCoverage, traceSegmentCells } from './raster.mjs';
import { anchorTile, buildChains, clipLine, createNetwork, layPath, NONE, RAIL, ROAD, route, thinBlocks } from './routing.mjs';
import { polygonIndex, provinceAt, provinceLinks, roadGraph } from './links.mjs';

export const LAND = 0;
export const WATER = 1;
export const WOODS = 2;

// Fine cells per tile edge for measuring how much of a tile is water or woods
const FINE_FACTOR = 4;
// Slip roads only join the main roads up when finding the way between towns, at their road's rank
const ROAD_RANK = {
  motorway: 0, trunk: 1, primary: 2, motorway_link: 0, trunk_link: 1, primary_link: 2,
};
// Rivers drawn as a line of water are the big ones: แม่น้ำ, ลำน้ำ, น้ำ… and ลำ… but not streams or ditches
// (ห้วย, ลำห้วย, ลำราง, ลำธาร) or canals (คลอง), long enough on the map to matter
const RIVER_NAME = /^(แม่น้ำ|ลำน้ำ|น้ำ|ลำ(?!ห้วย|ราง|ธาร|คลอง))/u;
const MIN_RIVER_TILES = 25;
const SMALL_REGION_TILES = 3;
// A river is one of the province's waterways when this many of its tiles are in the province
const MIN_WATERWAY_TILES = 10;
// How far beyond the province a road or railway is drawn before it is cut, in tiles: enough to show where it goes
const OUTSIDE_TILES = 20;
const OUTSIDE_CUT_TILES = 6;
// Land in a neighbouring country's outline counts as abroad only this far from every Thai province's outline
const ABROAD_CLEAR_M = 1500;

/**
 * Builds the map. shape: the province's { rings, bbox }; shapes: every province's; grid: makeGrid(…);
 * layers: { roads, links, rail, coast, rivers, water, forest } slim Overpass elements around the map;
 * town and towns: { lat, lon } of this province's town and of every province's (by id); neighbors: the ids of the
 * neighbouring provinces (data/thailand-provinces.json); foreign: the neighbouring countries' { rings, bbox }.
 */
export function buildProvinceMap({ id, shape, shapes, foreign = new Map(), grid, layers, town, towns, neighbors = [] }) {
  const { width, height, tileSizeM } = grid;
  const toTiles = (lon, lat) => {
    const { x, y } = grid.project(lat, lon);
    return [x / tileSizeM, y / tileSizeM];
  };

  const inside = insideMask(shape, grid);
  const { cells, rivers } = terrain(grid, layers);
  const isWater = (i) => cells[i] === WATER;
  const net = createNetwork(width, height, isWater);
  const problems = [];

  const provinceOfTile = (x, y) => {
    const { lat, lon } = grid.unproject((x + 0.5) * tileSizeM, (y + 0.5) * tileSizeM);
    return provinceAt(lon, lat, shapes);
  };
  const abroad = landAbroad(cells, width, height, abroadMask(grid, shapes, foreign));

  // Railways first: roads must cross them on straight track
  const railExits = layRails(net, layers.rail, toTiles, inside, problems, provinceOfTile, abroad);

  // The town's tile, and one road to each neighbour from it
  const townTile = town ? nearestInsideLand(cells, inside, width, height, ...toTiles(town.lon, town.lat)) : null;
  const roadExits = townTile === null ? []
    : layLinks({ shape, shapes, grid, layers, net, inside, town, towns, townTile, neighbors, problems, abroad });

  thinBlocks(net, 'rail');
  thinBlocks(net, 'road');

  const stats = insideStats(cells, net.transport, inside);
  // The big rivers that run through the province for a while: its waterways, longest first
  const waterways = rivers
    .map((river) => ({ river, tiles: [...river.tiles].filter((i) => inside[i]).length }))
    .filter(({ tiles }) => tiles >= MIN_WATERWAY_TILES)
    .sort((a, b) => b.tiles - a.tiles)
    .map(({ river }) => ({ th: river.name, en: river.nameEn }));
  return {
    cells,
    transport: net.transport,
    inside,
    town: townTile === null ? null : { x: townTile % width, y: Math.floor(townTile / width) },
    exits: [...roadExits, ...railExits],
    waterways,
    stats,
    problems,
  };
}

// ── The province's own tiles ───────────────────────────────────────────────────────────────────────────────────

/** 1 for every tile whose centre is inside the province's shape. */
function insideMask(shape, grid) {
  const mask = createMask(grid.width, grid.height);
  const segments = [];
  for (const ring of shape.rings) {
    for (let i = 1; i < ring.length; i++) {
      const a = grid.project(ring[i - 1][1], ring[i - 1][0]);
      const b = grid.project(ring[i][1], ring[i][0]);
      segments.push([a.x, a.y, b.x, b.y]);
    }
  }
  fillPolygon(mask, grid.tileSizeM, segments);
  return mask.data;
}

/** The inside, dry tile nearest (x, y) in tiles, searching outwards; null when there is none nearby. */
function nearestInsideLand(cells, inside, width, height, x, y, reach = 40) {
  const cx = Math.min(width - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(height - 1, Math.max(0, Math.floor(y)));
  for (let r = 0; r <= reach; r++) {
    let best = null;
    let bestDistance = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const i = ty * width + tx;
        if (!inside[i] || cells[i] === WATER) continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) { best = i; bestDistance = distance; }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

// ── Land, water and woods ──────────────────────────────────────────────────────────────────────────────────────

function terrain(grid, layers) {
  const { width, height, tileSizeM } = grid;
  const fineWidth = width * FINE_FACTOR;
  const fineHeight = height * FINE_FACTOR;
  const cellM = tileSizeM / FINE_FACTOR;
  const segmentsOf = (points) => {
    const segments = [];
    for (let i = 2; i < points.length; i += 2) {
      const a = grid.project(points[i - 1], points[i - 2]);
      const b = grid.project(points[i + 1], points[i]);
      segments.push([a.x, a.y, b.x, b.y]);
    }
    return segments;
  };
  const areaSegments = (element) => {
    if (element.type === 'way') {
      const p = element.points;
      const closed = p.length >= 8 && p[0] === p[p.length - 2] && p[1] === p[p.length - 1];
      return closed ? segmentsOf(p) : [];
    }
    return element.members
      .filter((member) => member.role === 'outer' || member.role === 'inner' || member.role === '')
      .flatMap((member) => segmentsOf(member.points));
  };

  const water = createMask(fineWidth, fineHeight);
  const woods = createMask(fineWidth, fineHeight);
  for (const element of layers.water) fillPolygon(water, cellM, areaSegments(element));
  for (const element of layers.forest) fillPolygon(woods, cellM, areaSegments(element));
  const coast = layers.coast.filter((element) => element.type === 'way').flatMap((element) => segmentsOf(element.points));
  const sea = seaFromCoastline(fineWidth, fineHeight, cellM, coast);
  if (sea) orMask(water, sea);

  const waterCoverage = tileCoverage(water, FINE_FACTOR, width, height);
  const woodsCoverage = tileCoverage(woods, FINE_FACTOR, width, height);
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    if (waterCoverage[i] >= 0.5) cells[i] = WATER;
    else if (woodsCoverage[i] >= 0.5) cells[i] = WOODS;
  }

  // The big rivers, as lines of water one tile wide and 4-connected. Each remembers its tiles, for the province's
  // waterways (what boats could use: GEO_SPEC section 6B)
  const rivers = bigRivers(layers.rivers, segmentsOf, tileSizeM);
  for (const river of rivers) {
    river.tiles = new Set();
    for (const segment of river.segments) {
      traceSegmentCells(segment, tileSizeM, width, height, (column, row) => {
        cells[row * width + column] = WATER;
        river.tiles.add(row * width + column);
      });
    }
  }

  cleanUp(cells, width, height);
  return { cells, rivers };
}

/** Each big river: named like one, and long enough around the map, with its English name if it has one. */
function bigRivers(rivers, segmentsOf, tileSizeM) {
  const byName = new Map();
  for (const element of rivers) {
    const name = element.tags.name;
    if (element.type !== 'way' || !name || !RIVER_NAME.test(name)) continue;
    if (element.tags.tunnel && element.tags.tunnel !== 'no') continue;
    if (!byName.has(name)) byName.set(name, { name, nameEn: '', length: 0, segments: [] });
    const river = byName.get(name);
    if (!river.nameEn && element.tags['name:en']) river.nameEn = element.tags['name:en'];
    for (const segment of segmentsOf(element.points)) {
      river.length += Math.hypot(segment[2] - segment[0], segment[3] - segment[1]);
      river.segments.push(segment);
    }
  }
  return [...byName.values()].filter((river) => river.length >= MIN_RIVER_TILES * tileSizeM);
}

// Removes water specks and fills land holes smaller than SMALL_REGION_TILES, except at the map edge.
function cleanUp(cells, width, height) {
  replaceSmallRegions(cells, width, height, (i) => cells[i] === WATER, LAND);
  replaceSmallRegions(cells, width, height, (i) => cells[i] !== WATER, WATER);
}

function replaceSmallRegions(cells, width, height, include, replacement) {
  const labels = labelRegions(width, height, include);
  const sizes = new Map();
  const touchesEdge = new Set();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0) continue;
    sizes.set(label, (sizes.get(label) || 0) + 1);
    const column = i % width;
    const row = Math.floor(i / width);
    if (column === 0 || row === 0 || column === width - 1 || row === height - 1) touchesEdge.add(label);
  }
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label >= 0 && sizes.get(label) < SMALL_REGION_TILES && !touchesEdge.has(label)) cells[i] = replacement;
  }
}

// ── Railways ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every main line that runs through the province (not sidings, yards or spurs), cut OUTSIDE_CUT_TILES beyond the
 * province where it would run on outside it for more than OUTSIDE_TILES. Returns where they leave the province.
 */
function layRails(net, rail, toTiles, inside, problems, provinceOfTile, abroad) {
  const { width, height } = net;
  const ways = rail
    .filter((element) => element.type === 'way' && !element.tags.service && element.points.length >= 4)
    .map((element) => ({ points: element.points, rank: 0, ref: element.tags.name ?? '' }));
  const anchors = new Map();
  const exits = new Map();
  const isInside = ([x, y]) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    return tx >= 0 && ty >= 0 && tx < width && ty < height && inside[ty * width + tx] === 1;
  };

  for (const chain of buildChains(ways)) {
    const points = chain.points.map(([lon, lat]) => toTiles(lon, lat));
    for (const part of clipLine(points, width, height)) {
      const near = nearProvince(part.points, isInside);
      if (!near) continue;
      const kept = abroad.cut(near, isInside);
      if (!kept) continue;
      const anchorOf = (point, key) => {
        const cacheKey = key ?? `${Math.floor(point[0])},${Math.floor(point[1])}`;
        if (!anchors.has(cacheKey)) anchors.set(cacheKey, anchorTile(net, 'rail', ...tileOf(point, width, height)));
        return anchors.get(cacheKey);
      };
      const start = anchorOf(kept.points[0], kept.startCut || part.startCut ? null : chain.from);
      const goal = anchorOf(kept.points[kept.points.length - 1], kept.endCut || part.endCut ? null : chain.to);
      const path = route(net, 'rail', kept.points, start, goal);
      if (!path) {
        problems.push(`rail ${chain.refs.join('/') || '?'} could not be laid`);
        continue;
      }
      layPath(net, 'rail', path);
      for (const exit of boundaryExits(path, inside, width)) {
        const neighbor = provinceOfTile(exit.outsideX, exit.outsideY);
        if (neighbor && !exits.has(neighbor)) {
          exits.set(neighbor, { neighbor, kind: 'rail', name: chain.refs[0] ?? '', x: exit.x, y: exit.y });
        }
      }
    }
  }
  return [...exits.values()];
}

/**
 * The stretch of a line (points in tiles) from OUTSIDE_TILES before it first enters the province to OUTSIDE_TILES
 * after it last leaves, shortened to OUTSIDE_CUT_TILES at an end that would run on outside for longer; null when
 * the line never enters the province.
 */
function nearProvince(points, isInside) {
  // Distance along the line at each point, and the first and last stretch inside
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  let first = -1;
  let last = -1;
  for (let i = 0; i < points.length; i++) {
    if (isInside(points[i])) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return null;
  const total = along[along.length - 1];
  const before = along[first];
  const after = total - along[last];
  const from = before > OUTSIDE_TILES ? along[first] - OUTSIDE_CUT_TILES : 0;
  const to = after > OUTSIDE_TILES ? along[last] + OUTSIDE_CUT_TILES : total;
  return {
    points: sliceAlong(points, along, from, to),
    startCut: from > 0,
    endCut: to < total,
  };
}

/**
 * A road (points in tiles) cut OUTSIDE_CUT_TILES past its point exitIndex, the first outside the province after
 * it leaves for the last time, when it would run on outside for more than OUTSIDE_TILES.
 */
function cutAfterExit(points, exitIndex) {
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = along[along.length - 1];
  if (total - along[exitIndex] <= OUTSIDE_TILES) return points;
  return sliceAlong(points, along, 0, along[exitIndex] + OUTSIDE_CUT_TILES);
}

/**
 * Tiles of land abroad: in a neighbouring country's outline and at least ABROAD_CLEAR_M from every Thai province's.
 * Both outlines are generalised and overlap along the border by up to a kilometre or so, and a road on the Thai bank
 * of the Mekong must not count as abroad.
 */
function abroadMask(grid, shapes, foreign) {
  const { width, height, tileSizeM } = grid;
  const fill = (outlines) => {
    const mask = createMask(width, height);
    const [west, south, east, north] = grid.bbox();
    for (const { rings, bbox } of outlines) {
      if (bbox[2] < west || bbox[0] > east || bbox[3] < south || bbox[1] > north) continue;
      const segments = [];
      for (const ring of rings) {
        for (let i = 1; i < ring.length; i++) {
          const a = grid.project(ring[i - 1][1], ring[i - 1][0]);
          const b = grid.project(ring[i][1], ring[i][0]);
          segments.push([a.x, a.y, b.x, b.y]);
        }
      }
      fillPolygon(mask, tileSizeM, segments);
    }
    return mask.data;
  };
  const thai = fill(shapes.values());
  const country = fill(foreign.values());
  // Distance in tiles from Thai land, out to the clearance needed
  const clear = Math.max(2, Math.ceil(ABROAD_CLEAR_M / tileSizeM));
  const distance = new Uint8Array(width * height).fill(255);
  let front = [];
  for (let i = 0; i < thai.length; i++) if (thai[i]) { distance[i] = 0; front.push(i); }
  for (let d = 1; d <= clear && front.length; d++) {
    const next = [];
    for (const i of front) {
      const x = i % width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (j >= 0 && j < distance.length && distance[j] > d) { distance[j] = d; next.push(j); }
      }
    }
    front = next;
  }
  return (i) => country[i] === 1 && distance[i] >= clear;
}

/**
 * Lines (points in tiles) cut back to the last dry ground on the Thai side before they reach land abroad, so a
 * railway over a border river stops at the Thai bank, while a bridge to another Thai province is kept.
 */
function landAbroad(cells, width, height, isAbroad) {
  const classify = ([x, y]) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return 'water';
    const i = ty * width + tx;
    return cells[i] === WATER ? 'water' : isAbroad(i) ? 'abroad' : 'thai';
  };
  /** The line up to the last dry Thai point before land abroad that comes after index from. */
  const cutTail = (points, from = 0) => {
    let lastThai = -1;
    for (let i = 0; i < points.length; i++) {
      const kind = classify(points[i]);
      if (kind === 'thai') lastThai = i;
      else if (kind === 'abroad' && i >= from) return lastThai >= 1 ? points.slice(0, lastThai + 1) : points.slice(0, 1);
    }
    return points;
  };
  return {
    cutTail,
    /** Whether a point (in tiles) is on land abroad. */
    isAbroad: (point) => classify(point) === 'abroad',
    /** Both ends of a stretch from nearProvince cut back from land abroad; null when nothing inside is left. */
    cut(stretch, isInside) {
      const firstInside = stretch.points.findIndex(isInside);
      if (firstInside < 0) return null;
      const tail = cutTail(stretch.points, firstInside);
      const reversed = [...tail].reverse();
      const head = cutTail(reversed, reversed.length - 1 - firstInside).reverse();
      return {
        points: head,
        startCut: stretch.startCut || head.length < tail.length,
        endCut: stretch.endCut || tail.length < stretch.points.length,
      };
    },
  };
}

/** The part of a line between two distances along it. */
function sliceAlong(points, along, from, to) {
  const at = (distance) => {
    let i = 1;
    while (i < along.length - 1 && along[i] < distance) i++;
    const span = along[i] - along[i - 1];
    const t = span > 0 ? (distance - along[i - 1]) / span : 0;
    return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
  };
  const result = [at(from)];
  for (let i = 0; i < points.length; i++) if (along[i] > from && along[i] < to) result.push(points[i]);
  result.push(at(to));
  return result;
}

const tileOf = ([x, y], width, height) => [
  Math.min(width - 1, Math.max(0, Math.floor(x))),
  Math.min(height - 1, Math.max(0, Math.floor(y))),
];

/**
 * Where a path of tiles crosses the province's edge: the inside tile, the outside tile next to it, and whether the
 * path is leaving (going from inside to outside) there.
 */
function boundaryExits(path, inside, width) {
  const exits = [];
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    if (inside[a] === inside[b]) continue;
    const [inner, outer] = inside[a] ? [a, b] : [b, a];
    exits.push({
      x: inner % width, y: Math.floor(inner / width), outsideX: outer % width, outsideY: Math.floor(outer / width),
      leaving: inside[a] === 1,
    });
  }
  return exits;
}

// ── Roads to the neighbours ────────────────────────────────────────────────────────────────────────────────────

function layLinks({ shape, shapes, grid, layers, net, inside, town, towns, townTile, neighbors, problems, abroad }) {
  const { width, height, tileSizeM, widthM, heightM } = grid;
  const ways = [...layers.roads, ...(layers.links ?? [])]
    .filter((element) => element.type === 'way' && ROAD_RANK[element.tags.highway] !== undefined)
    .map((element) => ({ points: element.points, rank: ROAD_RANK[element.tags.highway], ref: element.tags.ref ?? '' }));
  const nodes = roadGraph(ways, (lat, lon) => grid.project(lat, lon));

  const indexOf = (rings) => polygonIndex(rings.map((ring) => ring.map(([lon, lat]) => {
    const { x, y } = grid.project(lat, lon);
    return [x, y];
  })), 2000);
  const index = indexOf(shape.rings);
  const neighborIndexes = neighbors.filter((neighbor) => shapes.has(neighbor))
    .map((neighbor) => [neighbor, indexOf(shapes.get(neighbor).rings)]);
  const insideOf = (node) => {
    if (node.inside === undefined) node.inside = index.contains(node.x, node.y);
    return node.inside;
  };
  const project = ({ lat, lon }) => grid.project(lat, lon);
  const { links, townRoadM } = provinceLinks({
    nodes,
    inside: insideOf,
    provinceOf: (node) => {
      if (node.province === undefined) {
        // A neighbour, or 'abroad' (never on a road between two provinces), or null for the sea and gaps
        node.province = neighborIndexes.find(([, neighborIndex]) => neighborIndex.contains(node.x, node.y))?.[0] ??
          (abroad.isAbroad([node.x / grid.tileSizeM, node.y / grid.tileSizeM]) ? 'abroad' : null);
      }
      return node.province;
    },
    neighbors: neighborIndexes.map(([neighbor]) => neighbor),
    town: project(town),
    townOf: (neighbor) => (towns.get(neighbor) ? project(towns.get(neighbor)) : null),
    onMap: (node) => node.x >= 0 && node.y >= 0 && node.x <= widthM && node.y <= heightM,
  });
  if (townRoadM) problems.push(`the nearest main road is ${(townRoadM / 1000).toFixed(1)} km from the town`);

  const exits = [];
  // The most important roads are laid first, so the others join them
  links.sort((a, b) => a.rank - b.rank);
  for (const link of links) {
    // The road leaves from the town and runs as far as the map's edge, or is cut a little beyond where it leaves
    // the province for the last time
    const points = abroad.cutTail(cutAfterExit(link.points.map(([x, y]) => [x / tileSizeM, y / tileSizeM]),
      link.exitIndex), link.exitIndex);
    const parts = clipLine(points, width, height);
    if (!parts.length) continue;
    const line = parts[0];
    const goalPoint = line.points[line.points.length - 1];
    const goal = anchorTile(net, 'road', ...tileOf(goalPoint, width, height));
    const path = route(net, 'road', [[(townTile % width) + 0.5, Math.floor(townTile / width) + 0.5], ...line.points], townTile, goal);
    if (!path) {
      problems.push(`road to ${link.neighbor} could not be laid`);
      continue;
    }
    layPath(net, 'road', path);
    const crossing = boundaryExits(path, inside, width).filter((exit) => exit.leaving).at(-1);
    if (crossing) exits.push({ neighbor: link.neighbor, kind: 'road', ref: link.ref, x: crossing.x, y: crossing.y });
    else problems.push(`road to ${link.neighbor} never leaves the province on the map`);
  }
  return exits;
}

// ── Numbers ────────────────────────────────────────────────────────────────────────────────────────────────────

function insideStats(cells, transport, inside) {
  let tiles = 0;
  const counts = [0, 0, 0];
  let road = 0;
  let rail = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!inside[i]) continue;
    tiles++;
    counts[cells[i]]++;
    if (transport[i] & ROAD) road++;
    if (transport[i] & RAIL) rail++;
  }
  const share = (n) => (tiles ? Math.round((n / tiles) * 1000) / 1000 : 0);
  return {
    insideTiles: tiles,
    land: share(counts[LAND]),
    water: share(counts[WATER]),
    woods: share(counts[WOODS]),
    roadTiles: road,
    railTiles: rail,
  };
}

export { NONE };
