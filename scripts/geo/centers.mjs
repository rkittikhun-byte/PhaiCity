/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:centers   (run geo:national first)
// Chooses each province's map center from OpenStreetMap, in the order of GEO_SPEC section 7,
// and writes data/geo/province-centers.json. Never invents coordinates: unresolved centers are null.

import fs from 'node:fs';
import {
  CENTERS_FILE, NATIONAL_FULL_GEOJSON,
  loadOverrides, loadProvinces, overpass, readJson, toRepoPath, writeJson,
} from './lib/common.mjs';
import { geometryContains } from './lib/geometry.mjs';

const THAILAND_AREA = 'area["ISO3166-1"="TH"]["admin_level"="2"]->.th;';
const PLACE_RANK = { city: 0, town: 1, municipality: 2, suburb: 3, village: 4, quarter: 5, neighbourhood: 6 };

// Bangkok has no single capital town; GEO_SPEC section 7 asks for the old city (Rattanakosin).
const BANGKOK_ID = 'TH-10';
const BANGKOK_AREA_NAME = 'เกาะรัตนโกสินทร์';

async function main() {
  if (!fs.existsSync(NATIONAL_FULL_GEOJSON)) {
    throw new Error('Run "npm run geo:national" first: province shapes are needed to check centers.');
  }
  const shapes = new Map(readJson(NATIONAL_FULL_GEOJSON).features.map((f) => [f.properties.id, f.geometry]));
  const provinces = loadProvinces();
  loadOverrides();   // creates an empty overrides file if missing; never overwritten here

  const adminCentres = await fetchAdminCentres();
  const capitals = await fetchCapitalPlaces();
  const namedPlaces = await fetchNamedPlaces(provinces);
  const bangkokOldCity = await fetchBangkokOldCity();

  const centers = {};
  const report = { fallback: [], missing: [], outside: [] };

  for (const province of provinces) {
    const shape = shapes.get(province.id);
    const inside = (point) => geometryContains(shape, point);
    let center = null;

    if (province.id === BANGKOK_ID && bangkokOldCity) {
      center = { ...bangkokOldCity, source: 'osm_named_area',
        note: 'Bangkok has no single capital town; using the old city (Rattanakosin) per GEO_SPEC section 7.' };
    }
    if (!center && adminCentres.has(province.id)) {
      center = { ...adminCentres.get(province.id), source: 'admin_centre' };
    }
    if (!center) {
      const capital = pickBest(capitals.filter(inside));
      if (capital) center = { ...capital, source: 'capital_4' };
    }
    if (!center) {
      const named = pickBest(namedPlaces.filter((p) => p.name === province.nameTh && inside(p)));
      if (named) center = { ...named, source: 'name_match' };
    }

    if (!center) {
      centers[province.id] = null;
      report.missing.push(province);
      continue;
    }

    center.lat = round(center.lat);
    center.lon = round(center.lon);
    centers[province.id] = center;
    if (center.source === 'capital_4' || center.source === 'name_match') report.fallback.push(province);
    if (!inside(center)) report.outside.push(province);
  }

  writeJson(CENTERS_FILE, {
    _meta: {
      description: 'Automatic map centers for each province (GEO_SPEC section 7). ' +
        'data/geo/center-overrides.json always wins over these.',
      license: 'Derived from OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0',
      generatedAt: new Date().toISOString(),
    },
    centers,
  });

  printReport(report);
}

// Order 2: the admin_centre member of each province boundary relation (admin_level=4).
async function fetchAdminCentres() {
  const data = await overpass(`[out:json][timeout:180];
${THAILAND_AREA}
rel(area.th)["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"]->.p;
.p out body;
node(r.p:"admin_centre");
out;`, 'admin-centres');

  const nodes = new Map(data.elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
  const result = new Map();
  for (const relation of data.elements.filter((e) => e.type === 'relation')) {
    const member = (relation.members || []).find((m) => m.role === 'admin_centre' && m.type === 'node');
    const node = member && nodes.get(member.ref);
    if (node) {
      result.set(relation.tags['ISO3166-2'], toCenter(node));
    }
  }
  return result;
}

// Order 3: city/town nodes tagged capital=4.
async function fetchCapitalPlaces() {
  const data = await overpass(`[out:json][timeout:120];
${THAILAND_AREA}
node(area.th)["place"~"^(city|town|municipality)$"]["capital"="4"];
out;`, 'capital-4');
  return data.elements.map(toCenter);
}

// Order 4: place nodes whose Thai name equals a province name (most capitals share the name).
async function fetchNamedPlaces(provinces) {
  const names = provinces.map((p) => p.nameTh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const data = await overpass(`[out:json][timeout:180];
${THAILAND_AREA}
node(area.th)["place"]["name"~"^(${names})$"];
out;`, 'named-places');
  return data.elements.map(toCenter);
}

async function fetchBangkokOldCity() {
  const data = await overpass(`[out:json][timeout:60];
${THAILAND_AREA}
nwr(area.th)["name"="${BANGKOK_AREA_NAME}"];
out center;`, 'bangkok-old-city');
  const element = data.elements[0];
  return element ? toCenter(element) : null;
}

function toCenter(element) {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  return {
    lat, lon,
    name: element.tags?.name,
    place: element.tags?.place,
    osm: `${element.type}/${element.id}`,
  };
}

function pickBest(candidates) {
  return candidates
    .slice()
    .sort((a, b) => (PLACE_RANK[a.place] ?? 9) - (PLACE_RANK[b.place] ?? 9))[0] || null;
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

function printReport({ fallback, missing, outside }) {
  const label = (p) => `${p.id} ${p.nameTh}`;
  console.log(`Wrote ${toRepoPath(CENTERS_FILE)}`);
  console.log(`Fallback (capital=4 or name match): ${fallback.map(label).join(', ') || 'none'}`);
  console.log(`Missing (null): ${missing.map(label).join(', ') || 'none'}`);
  console.log(`Outside own province shape: ${outside.map(label).join(', ') || 'none'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
