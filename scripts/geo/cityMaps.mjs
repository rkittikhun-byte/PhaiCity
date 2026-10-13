/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:city [-- --only TH-40] [-- --size 400] [-- --preview]
// Real-scale city maps (docs/CITY_SCALE.md; owner, 13 Oct 2026): a square of SIZE × SIZE tiles of 16 m round a
// province's town, from the same data as the province maps (geo:download, geo:dem, geo:centers), written to
// data/maps/city/TH-xx.json in format 2, so the game loads it like a province map. Water, woods, the land's heights
// and the railways come from the real map; no roads, which are the player's to build, and no links to the neighbours,
// which lie far beyond its edges.

import path from 'node:path';
import { MAPS_DIR, loadProvinces, resolveCenters, writeJson } from './lib/common.mjs';
import { packHeights, tileHeights } from './lib/elevation.mjs';
import { makeGrid } from './lib/projection.mjs';
import { loadForeignShapes, loadProvinceShapes } from './lib/provinceArea.mjs';
import { buildProvinceMap } from './lib/provinceMap.mjs';
import { encodeRle } from './lib/rle.mjs';
import { LAYER_NAMES, loadLayer } from './provinceData.mjs';

/** Metres a tile: a two-lane road and its pavements, as in Cities: Skylines (docs/CITY_SCALE.md) */
export const CITY_TILE_M = 16;
const DEFAULT_SIZE = 400;
const METERS_PER_DEGREE_LAT = 110574;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;
const CITY_DIR = path.join(MAPS_DIR, 'city');

function parseArgs(argv) {
  const options = { only: new Set(['TH-40']), size: DEFAULT_SIZE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = new Set(argv[++i].split(',').map((s) => s.trim()));
    else if (argv[i] === '--size') options.size = Math.max(64, Math.min(1024, Number(argv[++i]) || DEFAULT_SIZE));
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const shapes = loadProvinceShapes();
  const foreign = loadForeignShapes();
  const centers = resolveCenters();
  for (const province of loadProvinces().filter((p) => options.only.has(p.id))) {
    const started = Date.now();
    const town = centers[province.id];
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
      id: province.id, shape: shapes.get(province.id), shapes, foreign, grid, layers, town, towns: new Map(), neighbors: [],
    });
    const heights = tileHeights(grid);
    writeJson(path.join(CITY_DIR, `${province.id}.json`), {
      format: 2,
      provinceId: province.id,
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
    console.log(`${province.id} city ${grid.width}×${grid.height} at ${CITY_TILE_M} m  rail ${result.stats.railTiles}  ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
