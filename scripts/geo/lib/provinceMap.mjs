/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A whole province as a game map (GEO_SPEC sections 2, 5, 6 and 6B): its land, water and woods, which tiles are in
// the province (the rest cannot be built on), the railways through it, one laterite road to each neighbouring
// province, where those leave the province, and the tile of the provincial town.

import { createMask, fillPolygon, labelRegions, orMask, seaFromCoastline, tileCoverage, traceSegmentCells } from './raster.mjs';
import { anchorTile, buildChains, clipLine, createNetwork, layPath, NONE, RAIL, ROAD, route, thinBlocks } from './routing.mjs';
import { polygonIndex, provinceAt, provinceLinks, roadGraph } from './links.mjs';
import { layStreets } from './cityStreets.mjs';

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
/** How far a straightened road or railway on a district's map may stray from the real one (metres) */
const STRAIGHT_STRAY_M = 100;
/** Two railways this close (metres) along most of their way are one double track */
const DOUBLE_TRACK_M = 60;

/**
 * Builds the map. shape: the province's { rings, bbox }; shapes: every province's; grid: makeGrid(…);
 * layers: { roads, links, rail, coast, rivers, water, forest } slim Overpass elements around the map;
 * town and towns: { lat, lon } of this province's town and of every province's (by id); neighbors: the ids of the
 * neighbouring provinces (data/thailand-provinces.json); foreign: the neighbouring countries' { rings, bbox }.
 */
export function buildProvinceMap({ id, shape, shapes, foreign = new Map(), grid, layers, town, towns, neighbors = [],
  streets = null, roadRank = ROAD_RANK, smoothLinks = 0 }) {
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
  const railExits = layRails(net, layers.rail, toTiles, inside, problems, provinceOfTile, abroad, smoothLinks, tileSizeM);

  // The town's tile, and one road to each neighbour from it
  const townTile = town ? nearestInsideLand(cells, inside, width, height, ...toTiles(town.lon, town.lat)) : null;
  const roadExits = townTile === null ? []
    : layLinks({ shape, shapes, grid, layers, net, inside, town, towns, townTile, neighbors, problems, abroad, roadRank,
      smoothLinks });

  // A city map's real streets (cityStreets.mjs), after the railways so they cross them on straight track
  const streetMap = streets ? layStreets(net, streets, toTiles) : null;

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
    streets: streetMap,
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

  // A city map (16 m a tile) also has its canals, streams and smaller rivers, a tile wide (layers.waterways comes
  // from the local database only: dbLayers.mjs); not where they run in a pipe or under a road. On coarser tiles a
  // canal a tile wide would be far too wide
  for (const element of tileSizeM <= 40 ? layers.waterways ?? [] : []) {
    if (element.type !== 'way') continue;
    if (element.tags.tunnel && element.tags.tunnel !== 'no') continue;
    for (const segment of segmentsOf(element.points)) {
      traceSegmentCells(segment, tileSizeM, width, height, (column, row) => { cells[row * width + column] = WATER; });
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
function layRails(net, rail, toTiles, inside, problems, provinceOfTile, abroad, smoothLinks = 0, tileSizeM = 0) {
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

  // On a district's map, longest first, so a second track beside the first (a double track drawn as two lines) is
  // seen to be one and laid once
  const chains = buildChains(ways).map((chain) => ({ ...chain, tiles: chain.points.map(([lon, lat]) => toTiles(lon, lat)) }));
  if (smoothLinks > 0) chains.sort((a, b) => lineLength(b.tiles) - lineLength(a.tiles));
  for (const chain of chains) {
    const points = chain.tiles;
    if (smoothLinks > 0 && besideRail(net, points, DOUBLE_TRACK_M / tileSizeM)) continue;
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
      // Straightened on a district's map like its roads (owner, 14 Oct 2026: "ทางรถไฟก็เหมือนกัน เป็นยึกยือ"), as straight
      // runs and 45° diagonals drawn in even steps
      const guide = smoothLinks > 0
        ? octilinear(straighten(simplifyLine(kept.points, smoothLinks), STRAIGHT_STRAY_M / tileSizeM)) : null;
      const path = (guide ? evenPath(net, guide, start, goal) : null) ?? route(net, 'rail', kept.points, start, goal);
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

/** A line's length, in its own units */
function lineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return length;
}

/** Whether most of a line (points in tiles) on the map runs within reach tiles of a railway already laid */
function besideRail(net, points, reach) {
  const { width, height, transport } = net;
  const r = Math.ceil(reach);
  let on = 0, near = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k < steps; k++) {
      const x = Math.floor(ax + (bx - ax) * k / steps), y = Math.floor(ay + (by - ay) * k / steps);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      on++;
      search: for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && transport[ny * width + nx] & RAIL) {
          near++;
          break search;
        }
      }
    }
  }
  return on > 0 && near / on >= 0.7;
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

function layLinks({ shape, shapes, grid, layers, net, inside, town, towns, townTile, neighbors, problems, abroad,
  roadRank = ROAD_RANK, smoothLinks = 0 }) {
  const { width, height, tileSizeM, widthM, heightM } = grid;
  const ways = [...layers.roads, ...(layers.links ?? [])]
    .filter((element) => element.type === 'way' && roadRank[element.tags.highway] !== undefined)
    .map((element) => ({ points: element.points, rank: roadRank[element.tags.highway], ref: element.tags.ref ?? '' }));
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

  // The most important roads are laid first, so the others join them
  links.sort((a, b) => a.rank - b.rank);
  if (smoothLinks > 0) return layLinkNetwork({ links, net, inside, townTile, tileSizeM, abroad, smoothLinks, problems });
  const exits = [];
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
    const guide = [[(townTile % width) + 0.5, Math.floor(townTile / width) + 0.5], ...line.points];
    const path = route(net, 'road', guide, townTile, goal);
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

/**
 * A district's roads to its neighbours (owner, 14 Oct 2026: one road each, straight or smooth curves as on the real
 * map, not wiggles, "ถนน ให้มีเส้นเดียว"): the links as one network, so where two follow the same real road they share
 * its points and that stretch is laid once. Each stretch between junctions is straightened within smoothLinks tiles of
 * the real road, as straight runs and 45° diagonals (octilinear), and drawn tile by tile in even steps, which the 3D
 * view draws smooth; routing (which takes uneven steps) only where that would cross water or a railway on a step.
 */
function layLinkNetwork({ links, net, inside, townTile, tileSizeM, abroad, smoothLinks, problems }) {
  const { width, height } = net;
  const key = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;
  const town = [(townTile % width) + 0.5, Math.floor(townTile / width) + 0.5];
  // Each link's line in tiles, from the town to the map's edge or a little beyond where it leaves the district
  const lines = [];
  for (const link of links) {
    const points = abroad.cutTail(cutAfterExit(link.points.map(([x, y]) => [x / tileSizeM, y / tileSizeM]),
      link.exitIndex), link.exitIndex);
    const parts = clipLine(points, width, height);
    if (!parts.length) continue;
    const line = [town];
    for (const point of parts[0].points) if (key(point) !== key(line[line.length - 1])) line.push(point);
    if (line.length > 1) lines.push({ link, points: line });
  }
  // The network: its points, which are next to which, and where lines end
  const at = new Map(), next = new Map(), ends = new Set();
  const join = (a, b) => {
    if (!next.has(a)) next.set(a, new Set());
    next.get(a).add(b);
  };
  for (const { points } of lines) {
    for (const point of points) at.set(key(point), point);
    ends.add(key(points[0]));
    ends.add(key(points[points.length - 1]));
    for (let i = 1; i < points.length; i++) {
      join(key(points[i - 1]), key(points[i]));
      join(key(points[i]), key(points[i - 1]));
    }
  }
  // Its stretches, from junction to junction (or a line's end), each laid once
  const junction = (k) => ends.has(k) || next.get(k).size !== 2;
  const stretches = [], stretchOf = new Map();
  for (const [start, others] of next) {
    if (!junction(start)) continue;
    for (const second of others) {
      if (stretchOf.has(`${start}|${second}`)) continue;
      const keys = [start, second];
      while (!junction(keys[keys.length - 1])) {
        const last = keys[keys.length - 1], before = keys[keys.length - 2];
        keys.push([...next.get(last)].find((k) => k !== before));
      }
      for (let i = 1; i < keys.length; i++) {
        stretchOf.set(`${keys[i - 1]}|${keys[i]}`, [stretches.length, true]);
        stretchOf.set(`${keys[i]}|${keys[i - 1]}`, [stretches.length, false]);
      }
      stretches.push({ keys, tiles: null });
    }
  }
  const anchors = new Map();
  const anchorOf = (k) => {
    if (!anchors.has(k)) anchors.set(k, anchorTile(net, 'road', ...tileOf(at.get(k), width, height)));
    return anchors.get(k);
  };
  const limit = STRAIGHT_STRAY_M / tileSizeM;
  for (const stretch of stretches) {
    const points = stretch.keys.map((k) => at.get(k));
    const guide = octilinear(straighten(simplifyLine(points, smoothLinks), limit));
    const start = anchorOf(stretch.keys[0]), goal = anchorOf(stretch.keys[stretch.keys.length - 1]);
    stretch.tiles = evenPath(net, guide, start, goal) ?? route(net, 'road', guide, start, goal);
    if (stretch.tiles) layPath(net, 'road', stretch.tiles);
    else problems.push(`a stretch of road from ${stretch.keys[0]} could not be laid`);
  }
  // Each link's tiles, stretch by stretch, for where it leaves the district or the map
  const exits = [];
  for (const { link, points } of lines) {
    const path = [];
    for (let i = 0; i + 1 < points.length;) {
      const [index, forward] = stretchOf.get(`${key(points[i])}|${key(points[i + 1])}`);
      const { keys, tiles } = stretches[index];
      for (const tile of tiles ? (forward ? tiles : [...tiles].reverse()) : []) if (path[path.length - 1] !== tile) path.push(tile);
      i += keys.length - 1;
    }
    if (!path.length) continue;
    const crossing = boundaryExits(path, inside, width).filter((exit) => exit.leaving).at(-1);
    const last = path[path.length - 1], x = last % width, y = Math.floor(last / width);
    if (crossing) exits.push({ neighbor: link.neighbor, kind: 'road', ref: link.ref, x: crossing.x, y: crossing.y });
    // A district bigger than its map: where the road leaves the map towards that neighbour
    else if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      exits.push({ neighbor: link.neighbor, kind: 'road', ref: link.ref, x, y, edge: true });
    } else problems.push(`road to ${link.neighbor} never leaves the district on the map`);
  }
  return exits;
}

/**
 * A line with its long slanted stretches cut in two, and again, until straight runs and a 45° diagonal between them
 * (octilinear) stay within limit tiles of it: a stretch dx across and dy along (dx ≥ dy) strays dy (dx − dy) / 2dx.
 */
function straighten(points, limit) {
  const out = [points[0]];
  const cut = (a, b) => {
    const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]), long = Math.max(dx, dy), short = Math.min(dx, dy);
    if (long < 4 || short * (long - short) / (2 * long) <= limit) {
      out.push(b);
      return;
    }
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    cut(a, middle);
    cut(middle, b);
  };
  for (let i = 1; i < points.length; i++) cut(points[i - 1], points[i]);
  return out;
}

/**
 * A line as straight runs and 45° diagonals only, which the 3D view draws as straight roads and smooth diagonals with
 * round bends (src/render3d/models/road/centreline.ts), rather than the uneven steps of other slants: each stretch
 * runs straight for half its excess, diagonally, then straight again.
 */
function octilinear(source) {
  // A stretch that strays only a tile or two sideways runs straight, the next one taking up the difference (no jogs)
  const points = source.map((point) => [...point]);
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1], b = points[i], dx = b[0] - ax, dy = b[1] - ay;
    if (Math.abs(dy) <= 2.5 && Math.abs(dx) > Math.abs(dy)) b[1] = ay;
    else if (Math.abs(dx) <= 2.5 && Math.abs(dy) > Math.abs(dx)) b[0] = ax;
  }
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay;
    const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx), sy = Math.sign(dy);
    // The straight part along the longer axis, split either side of the diagonal
    const straightX = Math.abs(dx) > Math.abs(dy) ? (Math.abs(dx) - diagonal) * sx : 0;
    const straightY = Math.abs(dy) > Math.abs(dx) ? (Math.abs(dy) - diagonal) * sy : 0;
    const m1 = [ax + straightX / 2, ay + straightY / 2];
    const m2 = [m1[0] + diagonal * sx, m1[1] + diagonal * sy];
    if (Math.hypot(m1[0] - ax, m1[1] - ay) > 0.5) out.push(m1);
    if (Math.hypot(m2[0] - m1[0], m2[1] - m1[1]) > 0.5) out.push(m2);
    out.push([bx, by]);
  }
  return out;
}

/**
 * The tiles of an octilinear line from start to goal: straight runs, and diagonals as even steps (one across, one
 * along), crossing water and railways square on, with no tile twice. Null when it cannot.
 */
function evenPath(net, points, start, goal) {
  const { width, height, transport, water } = net;
  const tiles = [];
  const add = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (tiles[tiles.length - 1] !== i) tiles.push(i);
  };
  const blocked = (cx, cy) => {
    const i = cy * width + cx;
    return water(i) || (transport[i] & RAIL) !== 0;
  };
  let x = start % width, y = Math.floor(start / width), budget = 8 * (width + height);
  // One step, and on in the same direction through water or a railway, so it is crossed square on
  const step = (sx, sy) => {
    x += sx; y += sy;
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    add(x, y);
    while (blocked(x, y)) {
      x += sx; y += sy;
      if (x < 0 || y < 0 || x >= width || y >= height || budget-- <= 0) return false;
      add(x, y);
    }
    return true;
  };
  add(x, y);
  // Its corners, but none in water or on a railway, which the line crosses instead
  const targets = points.slice(1).map(([px, py]) => [Math.floor(px), Math.floor(py)])
    .filter(([tx, ty]) => tx >= 0 && ty >= 0 && tx < width && ty < height && !blocked(tx, ty));
  targets.push([goal % width, Math.floor(goal / width)]);
  for (const [tx, ty] of targets) {
    while (x !== tx || y !== ty) {
      if (budget-- <= 0) return null;
      const dx = Math.sign(tx - x), dy = Math.sign(ty - y);
      // On a diagonal, one step across then one along; else straight
      if (dx && dy) {
        if (!step(dx, 0)) return null;
        if (y !== ty && !step(0, Math.sign(ty - y))) return null;
      } else if (!step(dx, dy)) return null;
    }
  }
  if (new Set(tiles).size !== tiles.length) return null;
  for (let k = 1; k + 1 < tiles.length; k++) {
    const i = tiles[k];
    if (!water(i) && !(transport[i] & RAIL)) continue;
    // Water and railways only on a straight run: the tiles either side on the same axis
    const before = tiles[k - 1] - i, after = tiles[k + 1] - i;
    if (before !== -after) return null;
  }
  return tiles;
}

/** Douglas–Peucker: the fewest points that keep a line within tolerance of where it was */
function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b], dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1;
    let far = -1, farthest = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length;
      if (d > farthest) { farthest = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
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
