/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What covers a city map's open land (docs/GAME_PLAN.md phase 4, decision 18): the fields, orchards, meadows,
// wetlands and villages OpenStreetMap draws, and where it draws nothing, what Khon Kaen's land would be: rice paddies
// on the low ground and near water, upland fields (cassava, sugar cane) on the higher ground. Villages are the trees
// and gardens round each real village's point. Water, woods, roads and railways keep their own tiles.

import { createMask, fillPolygon, tileCoverage } from './raster.mjs';

/** The codes of the landCover layer (src/geo/presetMap.ts PresetMap.landCover) */
export const COVER = { NONE: 0, PADDY: 1, FIELD: 2, ORCHARD: 3, GRASS: 4, WETLAND: 5, VILLAGE: 6, URBAN: 7 };

const FINE = 4;
/** Open land this close to water (metres) is paddy whatever its height */
const PADDY_NEAR_WATER_M = 200;
/** ... and land below this share of the map's land heights is low ground, paddy too */
const LOW_SHARE = 0.6;
/** Metres round a village's point that are its houses' gardens and trees */
const VILLAGE_RADIUS_M = 50;

/** The cover an OpenStreetMap area draws, or NONE */
export function coverOf(tags = {}) {
  switch (tags.landuse) {
    case 'paddy': return COVER.PADDY;
    case 'farmland': return tags.crop === 'rice' || tags.crop === 'paddy' ? COVER.PADDY : COVER.FIELD;
    case 'farmyard': return COVER.FIELD;
    case 'orchard': case 'plantation': case 'vineyard': return COVER.ORCHARD;
    case 'meadow': case 'grass': case 'village_green': case 'recreation_ground': return COVER.GRASS;
    case 'residential': return COVER.URBAN;
    default: break;
  }
  switch (tags.natural) {
    case 'wetland': return COVER.WETLAND;
    case 'grassland': case 'scrub': case 'heath': return COVER.GRASS;
    default: return COVER.NONE;
  }
}

/**
 * The cover of every tile. cells: the map's land (0), water (1) and woods (2); transport: its roads and railways;
 * heights: metres a tile, or null; areas: landuse and natural areas; places: { lon, lat, place } points.
 */
export function landCover({ grid, cells, transport, heights, areas, places }) {
  const { width, height, tileSizeM } = grid, size = width * height;
  const cover = new Uint8Array(size);
  const PADDY_NEAR_WATER = Math.max(2, Math.round(PADDY_NEAR_WATER_M / tileSizeM));
  const VILLAGE_RADIUS = Math.max(1, Math.round(VILLAGE_RADIUS_M / tileSizeM));
  const segmentsOf = (points) => {
    const segments = [];
    for (let i = 2; i < points.length; i += 2) {
      const a = grid.project(points[i - 1], points[i - 2]), b = grid.project(points[i + 1], points[i]);
      segments.push([a.x, a.y, b.x, b.y]);
    }
    return segments;
  };
  // Each kind of cover drawn in turn, so a smaller area of one kind inside a bigger one of another wins
  const kinds = new Map();
  for (const element of areas) {
    const code = coverOf(element.tags);
    if (!code) continue;
    if (!kinds.has(code)) kinds.set(code, []);
    kinds.get(code).push(element);
  }
  for (const [code, elements] of kinds) {
    const mask = createMask(width * FINE, height * FINE);
    for (const element of elements) {
      const segments = element.type === 'way' ? segmentsOf(element.points)
        : element.members.flatMap((member) => segmentsOf(member.points));
      fillPolygon(mask, tileSizeM / FINE, segments);
    }
    const coverage = tileCoverage(mask, FINE, width, height);
    for (let i = 0; i < size; i++) if (coverage[i] >= 0.5) cover[i] = code;
  }
  // How far each tile is from water, out to PADDY_NEAR_WATER
  const distance = new Int16Array(size).fill(-1), queue = [];
  for (let i = 0; i < size; i++) if (cells[i] === 1 || cover[i] === COVER.WETLAND) { distance[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % width, y = (i - x) / width;
    if (distance[i] >= PADDY_NEAR_WATER) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (distance[n] < 0) { distance[n] = distance[i] + 1; queue.push(n); }
    }
  }
  // The low ground: below LOW_SHARE of the land's heights
  let low = Infinity;
  if (heights) {
    const land = [];
    for (let i = 0; i < size; i++) if (cells[i] === 0) land.push(heights[i]);
    land.sort((a, b) => a - b);
    if (land.length) low = land[Math.floor(land.length * LOW_SHARE)];
  }
  // Open land with nothing drawn on it: paddy low or near water, upland fields higher up
  for (let i = 0; i < size; i++) {
    if (cells[i] !== 0 || transport[i] !== 0 || cover[i] !== COVER.NONE) continue;
    const near = distance[i] >= 0 && distance[i] <= PADDY_NEAR_WATER;
    cover[i] = near || !heights || heights[i] <= low ? COVER.PADDY : COVER.FIELD;
  }
  // The villages' gardens and trees round their points, on open farmland
  for (const place of places) {
    const p = grid.project(place.lat, place.lon), cx = Math.floor(p.x / tileSizeM), cy = Math.floor(p.y / tileSizeM);
    for (let dy = -VILLAGE_RADIUS; dy <= VILLAGE_RADIUS; dy++) for (let dx = -VILLAGE_RADIUS; dx <= VILLAGE_RADIUS; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || dx * dx + dy * dy > VILLAGE_RADIUS * VILLAGE_RADIUS) continue;
      const i = y * width + x;
      if (cells[i] === 0 && transport[i] === 0 && (cover[i] === COVER.PADDY || cover[i] === COVER.FIELD)) cover[i] = COVER.VILLAGE;
    }
  }
  // Water, woods, roads and railways have no cover of their own
  for (let i = 0; i < size; i++) if (cells[i] !== 0 || transport[i] !== 0) cover[i] = COVER.NONE;
  return cover;
}
