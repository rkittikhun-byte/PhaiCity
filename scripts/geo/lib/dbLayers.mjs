/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The map layers read from the local Thailand database (docs/GAME_PLAN.md decision 16) instead of the downloaded
// Overpass squares: the same elements the province map builder reads (provinceData.mjs: ways with points, areas as
// relations of outer and inner rings), cut to a box, plus the city's streets with their names and lanes. Plain data.

import { envelope, queryRows } from './db.mjs';

/** Every class of street a city map lays, biggest first (docs/GAME_PLAN.md decision 17) */
export const STREET_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'living_street', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'];
// Areas smaller than this (m²) are left out, as the downloaded layers left out short outlines
const MIN_AREA_M2 = 2000;
// Outlines are simplified by about 3 m, well inside a 16 m tile
const SIMPLIFY_DEG = 0.00003;

const LINE_TAGS = `json_build_object('highway', highway, 'railway', railway, 'waterway', waterway, 'service', service,
  'name', name, 'name:en', tags->'name:en', 'lanes', tags->'lanes', 'bridge', bridge, 'tunnel', tunnel, 'layer', layer,
  'width', width, 'ref', ref, 'usage', tags->'usage', 'oneway', oneway)`;
const AREA_TAGS = `json_build_object('natural', "natural", 'landuse', landuse, 'water', water, 'waterway', waterway,
  'wetland', wetland, 'name', name, 'crop', tags->'crop')`;

/** [lon, lat, lon, lat, …] to five decimals, as the downloaded layers keep them */
const flat = (coordinates) => {
  const points = [];
  for (const [lon, lat] of coordinates) points.push(Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5);
  return points;
};
const clean = (tags) => Object.fromEntries(Object.entries(tags).filter(([, value]) => value !== null && value !== undefined));

function lineElements(rows) {
  const elements = [];
  for (const [id, tagsText, geometryText] of rows) {
    const geometry = JSON.parse(geometryText), tags = clean(JSON.parse(tagsText));
    const lines = geometry.type === 'LineString' ? [geometry.coordinates]
      : geometry.type === 'MultiLineString' ? geometry.coordinates : [];
    lines.forEach((line, k) => {
      if (line.length >= 2) elements.push({ type: 'way', id: Number(id) * 16 + k, tags, points: flat(line) });
    });
  }
  return elements;
}

function areaElements(rows) {
  const elements = [];
  for (const [id, tagsText, geometryText] of rows) {
    const geometry = JSON.parse(geometryText), tags = clean(JSON.parse(tagsText));
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    const members = [];
    for (const rings of polygons) {
      rings.forEach((ring, k) => { if (ring.length >= 4) members.push({ role: k === 0 ? 'outer' : 'inner', points: flat(ring) }); });
    }
    if (members.length) elements.push({ type: 'relation', id: Number(id), tags, members });
  }
  return elements;
}

function lines(box, where) {
  return lineElements(queryRows(`SELECT osm_id, ${LINE_TAGS},
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_ClipByBox2D(way, ${envelope(box)}), ${SIMPLIFY_DEG}))
    FROM planet_osm_line WHERE way && ${envelope(box)} AND (${where});`));
}

function areas(box, where) {
  return areaElements(queryRows(`SELECT osm_id, ${AREA_TAGS},
    ST_AsGeoJSON(ST_MakeValid(ST_SimplifyPreserveTopology(ST_ClipByBox2D(way, ${envelope(box)}), ${SIMPLIFY_DEG})))
    FROM planet_osm_polygon WHERE way && ${envelope(box)} AND (${where})
    AND ST_Area(way::geography) > ${MIN_AREA_M2};`));
}

const list = (values) => values.map((v) => `'${v}'`).join(', ');

/** The villages, towns and neighbourhoods of the box, as { lon, lat, place, name } */
function places(box) {
  return queryRows(`SELECT ST_X(way), ST_Y(way), place, name FROM planet_osm_point
    WHERE way && ${envelope(box)} AND place IN ('village', 'hamlet', 'town', 'suburb', 'neighbourhood', 'quarter');`)
    .map(([lon, lat, place, name]) => ({ lon: Number(lon), lat: Number(lat), place, name }));
}

/**
 * The layers of the box [west, south, east, north]: the province map builder's own (roads, links, rail, coast,
 * rivers, water, forest) and the streets of a city map.
 */
export function loadDbLayers(box) {
  return {
    roads: lines(box, `highway IN ('motorway', 'trunk', 'primary')`),
    links: lines(box, `highway IN ('motorway_link', 'trunk_link', 'primary_link')`),
    rail: lines(box, `railway = 'rail'`),
    coast: lines(box, `"natural" = 'coastline'`),
    rivers: lines(box, `waterway = 'river'`),
    // A city map's canals, streams and rivers of every name, a tile wide (provinceMap.mjs terrain)
    waterways: lines(box, `waterway IN ('river', 'canal', 'stream')`),
    water: areas(box, `"natural" = 'water' OR landuse IN ('reservoir', 'basin') OR waterway = 'riverbank'`),
    forest: areas(box, `landuse = 'forest' OR "natural" = 'wood' OR wetland = 'mangrove'`),
    streets: lines(box, `highway IN (${list(STREET_CLASSES)})`),
    // What covers the open land (landCover.mjs), and the villages
    landuse: areas(box, `landuse IN ('paddy', 'farmland', 'farmyard', 'orchard', 'plantation', 'vineyard', 'meadow',
      'grass', 'village_green', 'recreation_ground', 'residential') OR "natural" IN ('wetland', 'grassland', 'scrub', 'heath')`),
    places: places(box),
  };
}
