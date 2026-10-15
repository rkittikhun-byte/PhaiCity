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
import { loadDbLayers } from './lib/dbLayers.mjs';
import { COVER, landCover } from './lib/landCover.mjs';
import { encodePng } from './lib/png.mjs';
import { DISTRICT_ROAD_RANK, districtGrid, districtNeighbours } from './lib/wholeDistrict.mjs';
import { ROAD, RAIL } from './lib/routing.mjs';

/** Metres a tile: a two-lane road and its pavements, as in Cities: Skylines (docs/CITY_SCALE.md) */
export const CITY_TILE_M = 16;
const DEFAULT_SIZE = 400;
const METERS_PER_DEGREE_LAT = 110574;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;
const CITY_DIR = path.join(MAPS_DIR, 'city');
/** The districts whose zones are painted a 4 m cell at a time along the roads (src/zoneCells.ts; owner, 14 Oct 2026:
 * "ทำแค่อำเภอเมือง") */
const CELL_ZONE_DISTRICTS = new Set(['TH-40-mueang-khon-kaen']);
const DISTRICT_DIR = path.join(MAPS_DIR, 'district');

function parseArgs(argv) {
  const options = { only: new Set(['TH-40']), size: DEFAULT_SIZE, districts: false, district: null, db: true, preview: false,
    whole: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = new Set(argv[++i].split(',').map((s) => s.trim()));
    else if (argv[i] === '--size') options.size = Math.max(64, Math.min(1024, Number(argv[++i]) || DEFAULT_SIZE));
    else if (argv[i] === '--districts') options.districts = true;
    // The downloaded Overpass squares instead of the local database (the old way: no streets)
    else if (argv[i] === '--cache') options.db = false;
    else if (argv[i] === '--preview') options.preview = true;
    // A district's map with every street in it (13 Oct 2026), instead of only one road towards each neighbour (owner,
    // 14 Oct 2026)
    else if (argv[i] === '--square') options.whole = false;
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

/** A box [west, south, east, north] grown by a share of its size on every side */
function grownBox([west, south, east, north], share) {
  const dLon = (east - west) * share, dLat = (north - south) * share;
  return [west - dLon, south - dLat, east + dLon, north + dLat];
}

/** The districts of a province as { id, rings, bbox, town } (npm run geo:districts) */
function provinceDistricts(provinceId) {
  const file = path.join(GEO_DIR, 'districts', `${provinceId}.json`);
  if (!fs.existsSync(file)) return [];
  return readJson(file).districts.map((d) => {
    const rings = ringsOf(d.geometry);
    return { id: d.id, rings, bbox: ringsBbox(rings), town: d.town };
  });
}

/** A picture of the map for checking it by eye: data/geo/cache/preview/city-<id>.png (gitignored) */
function writePreview(id, grid, result) {
  const { width, height } = grid, rgb = new Uint8Array(width * height * 3);
  const shades = [[214, 205, 168], [70, 130, 190], [74, 122, 70]];
  const covers = { [COVER.PADDY]: [150, 190, 90], [COVER.FIELD]: [190, 180, 110], [COVER.ORCHARD]: [95, 140, 70],
    [COVER.GRASS]: [165, 185, 110], [COVER.WETLAND]: [110, 150, 140], [COVER.VILLAGE]: [120, 150, 90], [COVER.URBAN]: [200, 190, 175] };
  for (let i = 0; i < width * height; i++) {
    let colour = covers[result.cover?.[i]] ?? shades[result.cells[i]] ?? shades[0];
    const transport = result.transport[i], level = result.streets?.levels[i] ?? 0;
    if (transport & RAIL) colour = [40, 40, 40];
    else if (transport & ROAD) colour = level >= 4 ? [200, 60, 40] : level === 3 ? [235, 150, 60] : [120, 110, 100];
    if (!result.inside[i]) colour = colour.map((c) => Math.round(c * 0.75));
    rgb.set(colour, i * 3);
  }
  const dir = path.join(GEO_DIR, 'cache', 'preview');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `city-${id}.png`), encodePng(width, height, rgb));
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
    // A district (owner, 14 Oct 2026): its outline on 16 m tiles round its town, one road towards each neighbour; the
    // road graph reaches well beyond, to find the way to each neighbour's town
    const whole = Boolean(district && options.whole && options.db);
    const grid = whole ? districtGrid(shape.bbox)
      : makeGrid({ center: { lat: town.lat, lon: town.lon }, width: options.size, height: options.size, tileSizeM: CITY_TILE_M });
    const fetchBox = whole ? grownBox(shape.bbox, 0.25) : (() => {
      const half = options.size * CITY_TILE_M / 2 + 500;
      const dLat = half / METERS_PER_DEGREE_LAT;
      const dLon = half / (Math.cos(town.lat * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR);
      return [town.lon - dLon, town.lat - dLat, town.lon + dLon, town.lat + dLat];
    })();
    // The local database by default (docs/GAME_PLAN.md decision 16): its streets too, with their names and lanes
    let layers = {};
    if (options.db) layers = loadDbLayers(fetchBox, whole ? { roadClasses: Object.keys(DISTRICT_ROAD_RANK).filter((c) => !c.endsWith('_link')) } : {});
    else for (const layer of LAYER_NAMES) layers[layer] = loadLayer(layer, fetchBox, {});
    let linkShapes = shapes, neighbors = [], towns = new Map();
    if (whole) {
      // Its neighbours: the province's districts it touches, and the neighbouring provinces at the province's edge;
      // the districts come first in the shapes, so a point in the province is found in its district
      const districts = provinceDistricts(province.id);
      const provinceNeighbours = (province.neighbors ?? []).filter((id) => shapes.has(id))
        .map((id) => ({ id, rings: shapes.get(id).rings, bbox: shapes.get(id).bbox }));
      neighbors = districtNeighbours({ id: district.id, rings: shape.rings, bbox: shape.bbox }, districts, provinceNeighbours);
      linkShapes = new Map([...districts.map((d) => [d.id, d]), ...shapes]);
      for (const d of districts) towns.set(d.id, d.town);
      for (const p of provinceNeighbours) if (centers[p.id]) towns.set(p.id, centers[p.id]);
    }
    const result = buildProvinceMap({
      id: province.id, shape: shape ?? shapes.get(province.id), shapes: linkShapes, foreign, grid, layers, town, towns, neighbors,
      streets: options.db && !whole ? layers.streets : null,
      ...(whole ? { roadRank: DISTRICT_ROAD_RANK, smoothLinks: 1.5 } : {}),
    });
    const streets = result.streets;
    const heights = tileHeights(grid);
    // What covers the open land: OpenStreetMap's fields and villages, paddy and upland fields where it draws nothing
    const cover = options.db ? landCover({ grid, cells: result.cells, transport: result.transport, heights,
      areas: layers.landuse, places: layers.places }) : null;
    result.cover = cover;
    writeJson(district ? path.join(DISTRICT_DIR, `${district.id}.json`) : path.join(CITY_DIR, `${province.id}.json`), {
      format: 2,
      provinceId: province.id,
      ...(district ? { districtId: district.id, districtNameTh: district.nameTh, districtNameEn: district.nameEn } : {}),
      scale: whole ? 'district' : 'city',
      // Homes, shops and factories are painted a tile at a time on it, whatever its tiles' size (docs/ZONE_PAINT.md)
      paintedZones: true,
      ...(district && CELL_ZONE_DISTRICTS.has(district.id) ? { cellZones: true } : {}),
      ...(whole ? { neighbours: neighbors } : {}),
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
      // Each road tile's level (src/roadLevels.ts) and the name of its street, an index into streetNames (0: none)
      // What covers each open tile (landCover.mjs COVER: 1 paddy, 2 field, 3 orchard, 4 grass, 5 wetland, 6 village,
      // 7 built-up; 0 none, as on water, woods, roads and railways)
      ...(cover ? { landCover: encodeRle(cover) } : {}),
      ...(streets ? { roadLevels: encodeRle(streets.levels), roadNames: encodeRle(streets.nameAt),
        streetNames: streets.names.slice(1) } : {}),
      stats: result.stats,
      sources: ['OpenStreetMap contributors (ODbL 1.0)', 'Natural Earth (public domain)',
        'produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 ' +
        'provided under COPERNICUS by the European Union and ESA; all rights reserved'],
      generatedAt: new Date().toISOString(),
    });
    if (options.preview) writePreview(district ? district.id : province.id, grid, result);
    if (streets) console.log(`  streets laid ${streets.laid}, not laid ${streets.failed}, names ${streets.names.length - 1}`);
    console.log(`${district ? district.id : province.id} ${grid.width}×${grid.height} at ${grid.tileSizeM} m  roads ${result.stats.roadTiles}  exits ${result.exits.length}  problems ${result.problems.length}  rail ${result.stats.railTiles}  ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
