/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:city [-- --only TH-40] [-- --size 400] [-- --districts] [-- --district TH-40-phon]
// Real-scale city maps (docs/CITY_SCALE.md; owner, 13 Oct 2026): a square of SIZE × SIZE tiles of 16 m round a
// province's town, from the same data as the province maps (geo:download, geo:dem, geo:centers), written to
// data/maps/city/TH-xx.json in format 2, so the game loads it like a province map. Water, woods, the land's heights
// and the railways come from the real map; no roads, which are the player's to build, and no links to the neighbours,
// which lie far beyond its edges.
// --districts makes one for each of the province's districts instead (owner 13 Oct 2026, Khon Kaen first), round each
// district's town (npm run geo:districts, data/geo/districts/TH-xx.json), with the district as the land that can be
// built on, written to data/maps/district/<district id>.json; --district makes one of them.

import fs from 'node:fs';
import path from 'node:path';
import { GEO_DIR, MAPS_DIR, loadProvinces, readJson, resolveCenters, writeJson } from './lib/common.mjs';
import { packHeights, tileHeights } from './lib/elevation.mjs';
import { makeGrid } from './lib/projection.mjs';
import { loadForeignShapes, loadProvinceShapes, ringsAreaM2, ringsBbox, ringsOf } from './lib/provinceArea.mjs';
import { buildProvinceMap } from './lib/provinceMap.mjs';
import { encodeRle } from './lib/rle.mjs';
import { LAYER_NAMES, loadLayer } from './provinceData.mjs';

/** Metres a tile: a two-lane road and its pavements, as in Cities: Skylines (docs/CITY_SCALE.md) */
export const CITY_TILE_M = 16;
const DEFAULT_SIZE = 400;
const METERS_PER_DEGREE_LAT = 110574;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;
const CITY_DIR = path.join(MAPS_DIR, 'city');
const DISTRICT_DIR = path.join(MAPS_DIR, 'district');

function parseArgs(argv) {
  const options = { only: new Set(['TH-40']), size: DEFAULT_SIZE, districts: false, district: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = new Set(argv[++i].split(',').map((s) => s.trim()));
    else if (argv[i] === '--size') options.size = Math.max(64, Math.min(1024, Number(argv[++i]) || DEFAULT_SIZE));
    else if (argv[i] === '--districts') options.districts = true;
    else if (argv[i] === '--district') {
      options.district = argv[++i];
      options.districts = true;
      options.only = new Set([options.district.split('-').slice(0, 2).join('-')]);
    }
  }
  return options;
}

/** The places a run makes maps of: each province's town, or each of its districts' towns. */
function places(options, centers) {
  const list = [];
  for (const province of loadProvinces().filter((p) => options.only.has(p.id))) {
    if (!options.districts) {
      list.push({ province, town: centers[province.id], shape: null, district: null });
      continue;
    }
    const file = path.join(GEO_DIR, 'districts', `${province.id}.json`);
    for (const district of readJson(file).districts) {
      if (options.district && district.id !== options.district) continue;
      const rings = ringsOf(district.geometry), bbox = ringsBbox(rings);
      list.push({ province, town: district.town, district,
        shape: { rings, bbox, areaM2: ringsAreaM2(rings, (bbox[1] + bbox[3]) / 2) } });
    }
  }
  return list;
}

/** The districts with maps, for the province card's choice: data/maps/district/index.json, without their outlines. */
function writeDistrictIndex() {
  const index = {};
  for (const province of loadProvinces()) {
    const file = path.join(GEO_DIR, 'districts', `${province.id}.json`);
    if (!fs.existsSync(file)) continue;
    const districts = readJson(file).districts.filter((d) => fs.existsSync(path.join(DISTRICT_DIR, `${d.id}.json`)));
    if (districts.length) {
      index[province.id] = districts.map(({ id, nameTh, nameEn, areaKm2, town, outline }) =>
        ({ id, nameTh, nameEn, areaKm2, town: { lat: town.lat, lon: town.lon }, outline }));
    }
  }
  writeJson(path.join(DISTRICT_DIR, 'index.json'), index);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const shapes = loadProvinceShapes();
  const foreign = loadForeignShapes();
  const centers = resolveCenters();
  if (options.districts) process.on('exit', writeDistrictIndex);
  for (const { province, town, shape, district } of places(options, centers)) {
    const started = Date.now();
    if (!town) {
      console.log(`${province.id}: no town centre (run geo:centers)`);
      continue;
    }
    const grid = makeGrid({ center: { lat: town.lat, lon: town.lon }, width: options.size, height: options.size,
      tileSizeM: CITY_TILE_M });
    const half = options.size * CITY_TILE_M / 2 + 500;
    const dLat = half / METERS_PER_DEGREE_LAT;
    const dLon = half / (Math.cos(town.lat * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR);
    const fetchBox = [town.lon - dLon, town.lat - dLat, town.lon + dLon, town.lat + dLat];
    const layers = {};
    for (const layer of LAYER_NAMES) layers[layer] = loadLayer(layer, fetchBox, {});
    const result = buildProvinceMap({
      id: province.id, shape: shape ?? shapes.get(province.id), shapes, foreign, grid, layers, town, towns: new Map(), neighbors: [],
    });
    const heights = tileHeights(grid);
    writeJson(district ? path.join(DISTRICT_DIR, `${district.id}.json`) : path.join(CITY_DIR, `${province.id}.json`), {
      format: 2,
      provinceId: province.id,
      ...(district ? { districtId: district.id, districtNameTh: district.nameTh, districtNameEn: district.nameEn } : {}),
      scale: 'city',
      width: grid.width,
      height: grid.height,
      tileSizeM: grid.tileSizeM,
      center: grid.center,
      bbox: grid.bbox(),
      cells: encodeRle(result.cells),
      transport: encodeRle(result.transport),
      inside: encodeRle(result.inside),
      town: result.town,
      exits: result.exits,
      waterways: result.waterways,
      heights: packHeights(heights),
      stats: result.stats,
      sources: ['OpenStreetMap contributors (ODbL 1.0)', 'Natural Earth (public domain)',
        'produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 ' +
        'provided under COPERNICUS by the European Union and ESA; all rights reserved'],
      generatedAt: new Date().toISOString(),
    });
    console.log(`${district ? district.id : province.id} city ${grid.width}×${grid.height} at ${CITY_TILE_M} m  rail ${result.stats.railTiles}  ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
