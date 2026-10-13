/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:districts [-- --only TH-40]
// A province's districts (อำเภอ, owner 13 Oct 2026: "ให้ user เลือก อำเภอเลย", Khon Kaen first), from OpenStreetMap
// in the local Thailand database (docs/geo/THAILAND_DB.md: psql on the PATH or PSQL set, the password in pgpass, never
// asked for): each district's names, area, outline (simplified) and the town its city map centres on, written to
// data/geo/districts/TH-xx.json. The town is the district office where OpenStreetMap has one, else the town or city
// named after the district, else a village of that name, else any town in it, else a point well inside it.
// The data stay ODbL (data/CREDITS.md).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GEO_DIR, loadProvinces, writeJson } from './lib/common.mjs';

const PSQL = process.env.PSQL || 'psql';
const DATABASE = 'thailand';
/** Degrees the outlines are simplified by: about 50 m, plenty for a 16 m-a-tile map's mask */
const SIMPLIFY = 0.0005;
/** ... and the light outline the province card draws (about 300 m) */
const OUTLINE = 0.003;

// The query goes in on stdin, as UTF-8: on Windows a Thai name in psql's arguments reaches it in the wrong code page
function sql(query) {
  return execFileSync(PSQL, ['-w', '-h', 'localhost', '-U', 'postgres', '-d', DATABASE, '-A', '-t', '-F', '\t', '-q'],
    { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
}

const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;

/** "Mueang Khon Kaen District" → "mueang-khon-kaen" */
export function districtSlug(nameEn) {
  return nameEn.replace(/\s+District$/i, '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseArgs(argv) {
  const options = { only: new Set(['TH-40']) };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = new Set(argv[++i].split(',').map((s) => s.trim()));
  }
  return options;
}

function districtsOf(province) {
  const rows = sql(`
    WITH p AS (SELECT way FROM planet_osm_polygon WHERE boundary = 'administrative' AND admin_level = '4'
               AND name = ${quote(`จังหวัด${province.nameTh}`)} ORDER BY ST_Area(way) DESC LIMIT 1),
    d AS (SELECT d.osm_id, d.name, d.tags -> 'name:en' AS name_en, d.tags -> 'short_name' AS short_name, d.way
          FROM planet_osm_polygon d, p WHERE d.boundary = 'administrative' AND d.admin_level = '6'
          AND ST_Within(ST_PointOnSurface(d.way), p.way))
    SELECT d.osm_id, d.name, coalesce(d.name_en, ''), coalesce(d.short_name, ''),
      round((ST_Area(d.way::geography) / 1e6)::numeric, 1),
      ST_AsGeoJSON(ST_SimplifyPreserveTopology(d.way, ${SIMPLIFY}), 5),
      ST_X(ST_PointOnSurface(d.way)), ST_Y(ST_PointOnSurface(d.way)),
      ST_AsGeoJSON(ST_SimplifyPreserveTopology(d.way, ${OUTLINE}), 4)
    FROM d ORDER BY d.name`);
  return rows.trim().split('\n').filter(Boolean).map((line) => {
    const [osmId, name, nameEn, shortName, area, geometry, x, y, outline] = line.split('\t');
    return { osmId: Number(osmId), name, nameEn, shortName: shortName || name.replace(/^อำเภอ/, ''), areaKm2: Number(area),
      geometry: JSON.parse(geometry), outline: JSON.parse(outline), inside: { lon: Number(x), lat: Number(y) } };
  });
}

/** The district's town: its office, or the town, city or village named after it, or any town, else a point inside. */
function townOf(district) {
  const name = district.shortName;
  const within = `ST_Within(t.way, (SELECT way FROM planet_osm_polygon WHERE osm_id = ${district.osmId}))`;
  const pick = (where, order = '') => {
    const row = sql(`SELECT ST_X(t.way), ST_Y(t.way), t.name FROM planet_osm_point t WHERE ${within} AND ${where} ${order} LIMIT 1`).trim();
    if (!row) return null;
    const [lon, lat, label] = row.split('\t');
    return { lon: Number(lon), lat: Number(lat), label };
  };
  const tries = [
    ['office', `t.amenity = 'townhall' AND t.name LIKE ${quote(`%ว่าการอำเภอ%`)}`],
    ['named_town', `t.place IN ('city', 'town') AND (t.name = ${quote(name)} OR t.name = ${quote(name.replace(/^เมือง/, ''))})`],
    ['named_village', `t.place IN ('village', 'suburb', 'hamlet') AND (t.name = ${quote(name)} OR t.name = ${quote(`บ้าน${name}`)})`],
    ['town', `t.place IN ('city', 'town')`, `ORDER BY t.place = 'city' DESC, (t.tags -> 'population') IS NULL, t.name`],
  ];
  for (const [source, where, order] of tries) {
    const found = pick(where, order);
    if (found) return { lat: found.lat, lon: found.lon, source, label: found.label };
  }
  return { ...district.inside, source: 'inside', label: '' };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const province of loadProvinces().filter((p) => options.only.has(p.id))) {
    const districts = districtsOf(province).map((district) => {
      const town = townOf(district);
      return {
        id: `${province.id}-${districtSlug(district.nameEn || district.shortName)}`,
        osmId: district.osmId,
        nameTh: district.shortName,
        nameEn: district.nameEn.replace(/\s+District$/i, ''),
        areaKm2: district.areaKm2,
        town: { lat: Number(town.lat.toFixed(6)), lon: Number(town.lon.toFixed(6)), source: town.source, name: town.label },
        outline: district.outline,
        geometry: district.geometry,
      };
    });
    // The province's own town first (อำเภอเมือง), then the rest by their Thai names
    districts.sort((a, b) => Number(b.nameTh.startsWith('เมือง')) - Number(a.nameTh.startsWith('เมือง')) ||
      a.nameTh.localeCompare(b.nameTh, 'th'));
    writeJson(path.join(GEO_DIR, 'districts', `${province.id}.json`), {
      provinceId: province.id,
      sources: ['OpenStreetMap contributors (ODbL 1.0)'],
      generatedAt: new Date().toISOString(),
      districts,
    });
    const sources = districts.reduce((count, d) => ({ ...count, [d.town.source]: (count[d.town.source] ?? 0) + 1 }), {});
    console.log(`${province.id}: ${districts.length} districts, towns by ${JSON.stringify(sources)}`);
  }
}

// Run only as a script, so tests can import districtSlug
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
