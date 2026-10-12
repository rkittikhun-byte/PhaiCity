/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:download [-- --layers roads,rail] [-- --cells 16_102,18_98] [-- --plan]
// Downloads what the whole-province maps are drawn from (GEO_SPEC sections 3 and 6): main roads, railways, coast,
// rivers, lakes and forest, and the airports. Thailand is fetched once, in squares of one degree, rather than province by province,
// because the boxes round neighbouring provinces overlap. Each square of each layer is one Overpass request, trimmed
// to what the maps use and cached in data/geo/cache/overpass/national/ so a second run downloads nothing.
// --plan only prints each province map's scale and size.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR, loadProvinces, overpass, readJson } from './lib/common.mjs';
import { loadProvinceShapes, provinceScale } from './lib/provinceArea.mjs';
import { makeGrid, METERS_PER_DEGREE_LAT, METERS_PER_DEGREE_LON_AT_EQUATOR } from './lib/projection.mjs';

/** Areas whose outline is shorter than this are too small to cover a tile of any province map. */
const MIN_AREA_OUTLINE_M = 1000;
const big = `(if: length() > ${MIN_AREA_OUTLINE_M})`;

// In the order they are downloaded: what the maps need most comes first
export const LAYERS = {
  roads: (bb) => `way["highway"~"^(motorway|trunk|primary)$"]${bb};`,
  rail: (bb) => `way["railway"="rail"]${bb};`,
  coast: (bb) => `way["natural"="coastline"]${bb};`,
  rivers: (bb) => `way["waterway"="river"]${bb};`,
  water: (bb) => `way["natural"="water"]${bb}${big}; relation["natural"="water"]${bb}${big};
    way["landuse"~"^(reservoir|basin)$"]${bb}${big}; relation["landuse"~"^(reservoir|basin)$"]${bb}${big};
    way["waterway"="riverbank"]${bb}${big}; relation["waterway"="riverbank"]${bb}${big};`,
  forest: (bb) => `way["landuse"="forest"]${bb}${big}; relation["landuse"="forest"]${bb}${big};
    way["natural"="wood"]${bb}${big}; relation["natural"="wood"]${bb}${big};
    way["wetland"="mangrove"]${bb}${big}; relation["wetland"="mangrove"]${bb}${big};`,
  // Not downloaded unless asked for: the next class of road down, should the main ones leave a neighbour unlinked
  secondary: (bb) => `way["highway"="secondary"]${bb};`,
};
/** The layers the province maps are built from (geo:maps), downloaded in this order. */
export const LAYER_NAMES = ['roads', 'rail', 'coast', 'rivers', 'water', 'forest'];

// What each request declares it may use. A busy server turns away requests that declare much more than they need
// ("the server is probably too busy"), so the limits stay modest, and only the area layers get the larger ones.
const LIMITS = { lines: '[timeout:120][maxsize:268435456]', areas: '[timeout:300][maxsize:536870912]' };

export function layerQuery(layer, [west, south, east, north]) {
  const bb = `(${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)})`;
  const limits = layer === 'water' || layer === 'forest' ? LIMITS.areas : LIMITS.lines;
  return `[out:json]${limits};\n(\n${LAYERS[layer](bb)}\n);\nout geom;`;
}

/** The tags the maps read; everything else is dropped before caching. */
const KEPT_TAGS = new Set([
  'highway', 'railway', 'service', 'usage', 'ref', 'name', 'name:en', 'bridge', 'tunnel', 'layer',
  'waterway', 'natural', 'water', 'landuse', 'wetland', 'width', 'intermittent', 'seasonal',
]);

/** [lon, lat, lon, lat, …] to five decimals (about a metre), from Overpass's [{ lat, lon }, …]. */
function flatPoints(geometry) {
  const points = [];
  for (const point of geometry ?? []) {
    if (!point) continue;
    points.push(Math.round(point.lon * 1e5) / 1e5, Math.round(point.lat * 1e5) / 1e5);
  }
  return points;
}

/** An Overpass "out geom" answer cut down to { type, id, tags, points } ways and { type, id, tags, members } relations. */
export function slimAnswer(json) {
  const elements = [];
  for (const element of json.elements ?? []) {
    const tags = {};
    for (const [key, value] of Object.entries(element.tags ?? {})) if (KEPT_TAGS.has(key)) tags[key] = value;
    if (element.type === 'way') {
      elements.push({ type: 'way', id: element.id, tags, points: flatPoints(element.geometry) });
    } else if (element.type === 'relation') {
      const members = (element.members ?? [])
        .filter((member) => member.type === 'way' && member.geometry)
        .map((member) => ({ role: member.role ?? '', points: flatPoints(member.geometry) }));
      elements.push({ type: 'relation', id: element.id, tags, members });
    }
  }
  return { elements };
}

/** How far past a province's own bounding box its map's data reaches, whatever the map's scale turns out to be. */
export const FETCH_MARGIN_M = 8000;

/** The map's grid for a province, and the area its data comes from: the province's box and FETCH_MARGIN_M round it. */
export function provinceGrid(shape) {
  const scale = provinceScale(shape.bbox, shape.areaM2);
  const grid = makeGrid({ center: scale.center, width: scale.width, height: scale.height, tileSizeM: scale.tileSizeM });
  const [west, south, east, north] = shape.bbox;
  const dLat = FETCH_MARGIN_M / METERS_PER_DEGREE_LAT;
  const dLon = FETCH_MARGIN_M / (Math.cos(scale.center.lat * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR);
  return { grid, fetchBox: [west - dLon, south - dLat, east + dLon, north + dLat] };
}

/** "16_102": the one-degree square whose south-west corner is 16° N 102° E. */
export const cellKey = (lat, lon) => `${lat}_${lon}`;

export function cellBox(key) {
  const [lat, lon] = key.split('_').map(Number);
  return [lon, lat, lon + 1, lat + 1];
}

/** Every square that a box [west, south, east, north] touches. */
export function cellsTouching([west, south, east, north]) {
  const keys = [];
  for (let lat = Math.floor(south); lat < north; lat++) {
    for (let lon = Math.floor(west); lon < east; lon++) keys.push(cellKey(lat, lon));
  }
  return keys;
}

// Airports with an IATA code: the country's passenger airports, for each province's transport (GEO_SPEC section 1).
// One small request for all of Thailand, cached on its own.
const AIRPORTS_QUERY = '[out:json][timeout:60];\n(\nnwr["aeroway"="aerodrome"]["iata"](5.5,97.3,20.6,105.7);\n);\nout center tags;';
const AIRPORTS_CACHE = 'national/airports';

/** The answer to AIRPORTS_QUERY cut down to [{ name, nameEn, iata, lat, lon }]. */
export function slimAirports(json) {
  const airports = [];
  for (const element of json.elements ?? []) {
    const point = element.type === 'node' ? element : element.center;
    if (!point || !element.tags?.iata) continue;
    airports.push({
      name: element.tags.name ?? '',
      nameEn: element.tags['name:en'] ?? '',
      iata: element.tags.iata,
      lat: Math.round(point.lat * 1e5) / 1e5,
      lon: Math.round(point.lon * 1e5) / 1e5,
    });
  }
  return { airports };
}

/** Every airport in and around Thailand, downloading them first if they are not cached yet. */
export async function loadAirports() {
  return (await overpass(AIRPORTS_QUERY, AIRPORTS_CACHE, { slim: slimAirports })).airports;
}

const cacheName = (layer, key) => `national/${layer}/${key}`;
const cacheFile = (layer, key) => path.join(CACHE_DIR, 'overpass', `${cacheName(layer, key)}.json`);

/**
 * One layer's elements around a box, from the squares already downloaded; an element in two squares comes once.
 * A square that has not been downloaded is an error, or skipped when partial is set.
 */
export function loadLayer(layer, box, { partial = false } = {}) {
  const seen = new Set();
  const elements = [];
  for (const key of cellsTouching(box)) {
    const file = cacheFile(layer, key);
    if (!fs.existsSync(file)) {
      if (partial) continue;
      throw new Error(`${layer} ${key} has not been downloaded (npm run geo:download)`);
    }
    for (const element of readJson(file).elements) {
      const id = `${element.type}/${element.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      elements.push(element);
    }
  }
  return elements;
}

function parseArgs(argv) {
  const options = { cells: null, layers: LAYER_NAMES, plan: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--cells': options.cells = value.split(',').map((s) => s.trim()); i++; break;
      case '--layers': options.layers = value.split(',').map((s) => s.trim()); i++; break;
      case '--plan': options.plan = true; break;
      default: throw new Error(`Unknown argument ${argv[i]}`);
    }
  }
  for (const layer of options.layers) if (!LAYERS[layer]) throw new Error(`Unknown layer ${layer}`);
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const shapes = loadProvinceShapes();
  const provinces = loadProvinces();

  if (options.plan) {
    for (const province of provinces) {
      const { grid } = provinceGrid(shapes.get(province.id));
      console.log(`${province.id} ${province.nameTh.padEnd(16)} ${String(grid.tileSizeM).padStart(4)} m  ` +
        `${grid.width} × ${grid.height} = ${grid.width * grid.height}`);
    }
    return;
  }

  // Every square some province's data reaches into
  const wanted = new Set();
  for (const province of provinces) {
    for (const key of cellsTouching(provinceGrid(shapes.get(province.id)).fetchBox)) wanted.add(key);
  }
  const cells = options.cells ?? [...wanted].sort();
  console.log(`${cells.length} squares × ${options.layers.length} layers`);

  // What came over the network (as text, before it was trimmed) and what was kept
  let fetched = 0;
  let bytes = 0;
  const slim = (json) => {
    fetched += JSON.stringify(json).length;
    return slimAnswer(json);
  };
  for (const layer of options.layers) {
    for (const key of cells) {
      const started = Date.now();
      const cached = fs.existsSync(cacheFile(layer, key));
      await overpass(layerQuery(layer, cellBox(key)), cacheName(layer, key), { slim });
      const size = fs.statSync(cacheFile(layer, key)).size;
      bytes += size;
      console.log(`${layer} ${key} ${(size / 1048576).toFixed(2)} MB` +
        `${cached ? ' (cached)' : ` in ${((Date.now() - started) / 1000).toFixed(0)} s`}  ` +
        `kept ${(bytes / 1048576).toFixed(1)} MB of ${(fetched / 1048576).toFixed(1)} MB fetched`);
    }
  }
  console.log(`airports: ${(await loadAirports()).length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
