/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Turns OpenStreetMap elements (Overpass "out geom") into preset map cells (GEO_SPEC sections 5–6).

import {
  createMask, fillPolygon, labelRegions, seaFromCoastline, strokeSegment, tileCoverage, traceSegmentCells,
} from './raster.mjs';

export const LAND = 0;
export const WATER = 1;
export const WOODS = 2;

// Fine cells per tile edge used for coverage estimation (4 → 2.5 m cells for 10 m tiles).
const FINE_FACTOR = 4;
const DEFAULT_WATERWAY_WIDTH_M = { river: 40, canal: 12, stream: 6 };
const AREA_ROLES = new Set(['outer', 'inner', '']);
const SMALL_REGION_TILES = 3;

// 'coast' | 'waterline' | 'water' | 'woods' | null
export function classifyTags(tags = {}) {
  if (tags.natural === 'coastline') return 'coast';
  if (DEFAULT_WATERWAY_WIDTH_M[tags.waterway] !== undefined) {
    return tags.tunnel && tags.tunnel !== 'no' ? null : 'waterline';
  }
  if (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.natural === 'bay' ||
      tags.landuse === 'reservoir' || tags.landuse === 'basin') {
    return 'water';
  }
  if (tags.wetland === 'mangrove' || tags.landuse === 'forest' || tags.natural === 'wood' ||
      tags.natural === 'scrub' || tags.leisure === 'park') {
    return 'woods';
  }
  return null;
}

export function waterwayWidthM(tags) {
  const parsed = parseFloat(String(tags.width ?? '').replace(',', '.'));
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000) return parsed;
  return DEFAULT_WATERWAY_WIDTH_M[tags.waterway];
}

function lineSegments(points, grid) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = grid.project(points[i - 1].lat, points[i - 1].lon);
    const b = grid.project(points[i].lat, points[i].lon);
    segments.push([a.x, a.y, b.x, b.y]);
  }
  return segments;
}

function isClosed(points) {
  if (!points || points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lon === last.lon;
}

// All boundary segments of an area: a closed way, or every outer/inner member of a relation.
function areaSegments(element, grid) {
  if (element.type === 'way') {
    return isClosed(element.geometry) ? lineSegments(element.geometry, grid) : [];
  }
  if (element.type === 'relation') {
    return (element.members || [])
      .filter((m) => m.type === 'way' && m.geometry && AREA_ROLES.has(m.role || ''))
      .flatMap((m) => lineSegments(m.geometry, grid));
  }
  return [];
}

export function buildPreset(grid, elements) {
  const { width, height, tileSizeM } = grid;
  const fineWidth = width * FINE_FACTOR;
  const fineHeight = height * FINE_FACTOR;
  const cellM = tileSizeM / FINE_FACTOR;

  const water = createMask(fineWidth, fineHeight);
  const woods = createMask(fineWidth, fineHeight);
  const coastSegments = [];
  const centerlines = [];

  for (const element of elements) {
    const kind = classifyTags(element.tags);
    if (!kind) continue;

    if (kind === 'coast') {
      if (element.geometry) coastSegments.push(...lineSegments(element.geometry, grid));
    } else if (kind === 'waterline') {
      if (!element.geometry) continue;
      const halfWidth = waterwayWidthM(element.tags) / 2;
      for (const segment of lineSegments(element.geometry, grid)) {
        strokeSegment(water, cellM, segment, halfWidth);
        centerlines.push(segment);
      }
    } else {
      fillPolygon(kind === 'water' ? water : woods, cellM, areaSegments(element, grid));
    }
  }

  const sea = seaFromCoastline(fineWidth, fineHeight, cellM, coastSegments);
  if (sea) {
    for (let i = 0; i < sea.data.length; i++) {
      if (sea.data[i]) water.data[i] = 1;
    }
  }

  const waterCoverage = tileCoverage(water, FINE_FACTOR, width, height);
  const woodsCoverage = tileCoverage(woods, FINE_FACTOR, width, height);
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    if (waterCoverage[i] >= 0.5) cells[i] = WATER;
    else if (woodsCoverage[i] >= 0.5) cells[i] = WOODS;
    else cells[i] = LAND;
  }

  // Waterways are at least one tile wide and 4-connected along their centerline.
  for (const segment of centerlines) {
    traceSegmentCells(segment, tileSizeM, width, height, (column, row) => {
      cells[row * width + column] = WATER;
    });
  }

  cleanUp(cells, width, height);

  const seaCoverage = sea ? tileCoverage(sea, FINE_FACTOR, width, height) : null;
  const isSeaTile = (i) => seaCoverage !== null && seaCoverage[i] >= 0.5 && cells[i] === WATER;

  return {
    cells,
    stats: computeStats(cells),
    hasSea: seaCoverage !== null && cells.some((_, i) => isSeaTile(i)),
    seaTouchesEdge: edgeIndices(width, height).some(isSeaTile),
  };
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
    if (label >= 0 && sizes.get(label) < SMALL_REGION_TILES && !touchesEdge.has(label)) {
      cells[i] = replacement;
    }
  }
}

function edgeIndices(width, height) {
  const indices = [];
  for (let column = 0; column < width; column++) {
    indices.push(column, (height - 1) * width + column);
  }
  for (let row = 1; row < height - 1; row++) {
    indices.push(row * width, row * width + width - 1);
  }
  return indices;
}

function computeStats(cells) {
  const counts = [0, 0, 0];
  for (const code of cells) counts[code]++;
  const fraction = (n) => Math.round(n / cells.length * 1000) / 1000;
  return { land: fraction(counts[LAND]), water: fraction(counts[WATER]), woods: fraction(counts[WOODS]) };
}
