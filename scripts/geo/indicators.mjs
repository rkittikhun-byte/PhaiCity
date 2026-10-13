/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:indicators: measures each province from the Thailand database (docs/geo/THAILAND_DB.md: OpenStreetMap
// in PostgreSQL + PostGIS on this machine) and from its game map (data/maps) into data/geo/province-indicators.json:
// the counts and shares that src/geo/provinceResources.ts turns into resource levels. It only reads the database
// (its working tables are temporary). psql must be on the PATH (or set PSQL to its full path) and the password in
// pgpass, as in docs/geo/THAILAND_DB.md. "-- --maps-only" refreshes only what comes from the game maps.
//
// The numbers are OpenStreetMap's, so they are only as complete as the map: a province where more has been mapped
// counts higher. That is why the owner can set any level by hand (data/province-profiles.json, the admin page).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { GEO_DIR, loadProvinces, MAPS_DIR, readJson, writeJson } from './lib/common.mjs';

const PSQL = process.env.PSQL || 'psql';
const DATABASE = process.env.PGDATABASE || 'thailand';
const OUTPUT = path.join(GEO_DIR, 'province-indicators.json');
const MAPS_ONLY = process.argv.includes('--maps-only');

// Provinces cut into small pieces with an index, so finding the province of a point is quick; "near" reaches 1 km
// out to sea for what lies on the coast
const SETUP = `
SET client_min_messages = warning;
CREATE TEMP TABLE prov AS
  SELECT tags->'ISO3166-2' AS id, ST_Subdivide(way, 256) AS way
  FROM planet_osm_polygon WHERE boundary = 'administrative' AND admin_level = '4' AND tags ? 'ISO3166-2';
CREATE INDEX ON prov USING gist (way);
ANALYZE prov;
CREATE TEMP TABLE prov_area AS
  SELECT tags->'ISO3166-2' AS id, ST_Area(way::geography) AS area
  FROM planet_osm_polygon WHERE boundary = 'administrative' AND admin_level = '4' AND tags ? 'ISO3166-2';
`;
const NEAR = 0.01;

/** Points and polygons matching where, each counted once in the province holding its middle (or near it). */
function count(name, where, { coast = false } = {}) {
  const join = coast ? `ST_DWithin(p.way, t.way, ${NEAR})` : 'ST_Intersects(p.way, t.way)';
  return `SELECT '${name}', p.id, count(DISTINCT t.key) FROM prov p JOIN (
      SELECT 'n' || osm_id AS key, way FROM planet_osm_point WHERE ${where}
      UNION ALL SELECT 'w' || osm_id, ST_PointOnSurface(way) FROM planet_osm_polygon WHERE ${where}) t ON ${join}
    GROUP BY p.id;`;
}

/** The share of each province covered by polygons matching where, each counted in the province holding its middle. */
function share(name, where) {
  return `SELECT '${name}', p.id, sum(t.area) / max(a.area) FROM prov p JOIN (
      SELECT ST_PointOnSurface(way) AS middle, ST_Area(way::geography) AS area FROM planet_osm_polygon WHERE ${where}) t
      ON ST_Intersects(p.way, t.middle)
    JOIN prov_area a ON a.id = p.id GROUP BY p.id;`;
}

/** The share of each province inside polygons matching where, cut along the province's edge. */
function shareCut(name, where) {
  return `SELECT '${name}', p.id, least(1, sum(ST_Area(ST_Intersection(p.way, t.way)::geography)) / max(a.area))
    FROM prov p JOIN (SELECT ST_MakeValid(way) AS way FROM planet_osm_polygon WHERE ${where}) t ON ST_Intersects(p.way, t.way)
    JOIN prov_area a ON a.id = p.id GROUP BY p.id;`;
}

const TOURISM = `tourism IN ('attraction', 'viewpoint', 'museum', 'theme_park', 'zoo', 'aquarium', 'hotel', 'resort',
  'guest_house', 'hostel', 'camp_site')`;
const plant = (source) => `power = 'plant' AND tags->'plant:source' LIKE '%${source}%'`;

const QUERIES = [
  count('tourism', TOURISM),
  count('beaches', `"natural" = 'beach'`, { coast: true }),
  count('islands', `place IN ('island', 'islet')`, { coast: true }),
  shareCut('protectedShare', `boundary IN ('national_park', 'protected_area')`),
  share('farmShare', `landuse IN ('farmland', 'paddy', 'meadow')`),
  share('orchardShare', `landuse IN ('orchard', 'plantation', 'vineyard')`),
  share('industryShare', `landuse = 'industrial'`),
  share('urbanShare', `landuse IN ('residential', 'commercial', 'retail', 'industrial')`),
  share('aquacultureShare', `landuse = 'aquaculture'`),
  count('saltPonds', `landuse = 'salt_pond'`, { coast: true }),
  count('quarries', `landuse = 'quarry' OR man_made = 'mineshaft' OR tags->'industrial' = 'mine'`),
  count('oilSites', `tags->'industrial' IN ('oil', 'refinery') OR man_made IN ('petroleum_well', 'offshore_platform')`,
    { coast: true }),
  count('solarPlants', plant('solar')),
  count('hydroPlants', plant('hydro')),
  count('gasPlants', plant('gas')),
  count('coalPlants', plant('coal')),
  count('biomassPlants', `power = 'plant' AND (tags->'plant:source' LIKE '%biomass%' OR tags->'plant:source' LIKE '%waste%')`),
  count('borderCrossings', `barrier = 'border_control'`),
  count('reservoirs', `"natural" = 'water' AND tags->'water' = 'reservoir' AND ST_Area(way::geography) > 1000000`),
  `SELECT 'areaKm2', id, area / 1e6 FROM prov_area;`,
  // Shoreline in short pieces, each given to the nearest province within reach
  `SELECT 'coastKm', id, sum(km) FROM (
     SELECT DISTINCT ON (c.piece) p.id, c.km FROM (
       SELECT row_number() OVER () AS piece, way, ST_Length(way::geography) / 1000 AS km
       FROM (SELECT ST_Subdivide(way, 32) AS way FROM planet_osm_line WHERE "natural" = 'coastline') s) c
     JOIN prov p ON ST_DWithin(p.way, c.way, ${NEAR * 2})
     ORDER BY c.piece, ST_Distance(p.way, c.way)) near GROUP BY id;`,
];

function measureDatabase(indicators) {
  const started = Date.now();
  const sql = SETUP + QUERIES.join('\n');
  const out = execFileSync(PSQL, ['-w', '-h', 'localhost', '-U', 'postgres', '-d', DATABASE, '-A', '-t', '-F', '|',
    '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const line of out.split(/\r?\n/)) {
    const [name, id, value] = line.split('|');
    if (!value || !indicators[id]) continue;
    const number = Number(value);
    indicators[id][name] = name.endsWith('Share') ? Math.round(number * 10000) / 10000 : Math.round(number * 10) / 10;
  }
  console.log(`database measured in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

/** The shares of water, woods and open land in each province's own tiles, and its heights, from its game map. */
function measureMaps(indicators) {
  for (const id of Object.keys(indicators)) {
    const file = path.join(MAPS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const stats = readJson(file).stats ?? {};
    for (const key of ['water', 'woods', 'land', 'heightMin', 'heightMax']) {
      if (typeof stats[key] === 'number') indicators[id][key] = stats[key];
    }
  }
}

const provinces = loadProvinces();
const previous = fs.existsSync(OUTPUT) ? readJson(OUTPUT).provinces ?? {} : {};
const indicators = Object.fromEntries(provinces.map((p) => [p.id, MAPS_ONLY ? { ...(previous[p.id] ?? {}) } : {}]));
if (!MAPS_ONLY) measureDatabase(indicators);
measureMaps(indicators);

writeJson(OUTPUT, {
  _note: 'Measured by scripts/geo/indicators.mjs from OpenStreetMap (© OpenStreetMap contributors, ODbL) in the ' +
    'Thailand database, and from each province\'s game map (water, woods, land: shares of its own tiles; heights in ' +
    'metres from the Copernicus DEM). Counts are of mapped places; other shares are of the province\'s area. Do not ' +
    'edit: run "npm run geo:indicators" again. The owner\'s own levels live in data/province-profiles.json.',
  provinces: indicators,
});
console.log(`wrote ${path.relative(process.cwd(), OUTPUT)}`);
