/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:national
// Builds data/geo/thailand-provinces.topo.json from Natural Earth 1:10m Admin-1 (public domain).
// Thailand only: no neighboring countries (GEO_SPEC section 11).

import fs from 'node:fs';
import path from 'node:path';
import mapshaper from 'mapshaper';
import {
  CACHE_DIR, NATIONAL_FULL_GEOJSON, NATIONAL_TOPO_FILE, ROOT,
  download, loadProvinces, readJson, toRepoPath,
} from './lib/common.mjs';

const NATURAL_EARTH_URL =
  'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip';
const MAX_TOPO_BYTES = 300 * 1024;

async function main() {
  process.chdir(ROOT);
  const zip = await download(NATURAL_EARTH_URL, path.join(CACHE_DIR, 'ne_10m_admin_1_states_provinces.zip'));

  // Full-detail copy, kept in the cache for point-in-province checks by other scripts.
  await mapshaper.runCommands([
    `-i ${toRepoPath(zip)}`,
    `-filter "iso_a2 === 'TH'" target=ne_10m_admin_1_states_provinces`,
    '-each "id = iso_3166_2"',
    '-filter-fields id',
    '-rename-layers provinces',
    `-o ${toRepoPath(NATIONAL_FULL_GEOJSON)} format=geojson`,
  ].join(' '));

  verifyProvinceIds(readJson(NATIONAL_FULL_GEOJSON).features.map((f) => f.properties.id));

  await mapshaper.runCommands([
    `-i ${toRepoPath(NATIONAL_FULL_GEOJSON)}`,
    '-simplify 25% keep-shapes',
    '-rename-layers provinces',
    `-o ${toRepoPath(NATIONAL_TOPO_FILE)} format=topojson id-field=id quantization=20000`,
  ].join(' '));

  const bytes = fs.statSync(NATIONAL_TOPO_FILE).size;
  console.log(`Wrote ${toRepoPath(NATIONAL_TOPO_FILE)} (${(bytes / 1024).toFixed(0)} KB)`);
  if (bytes > MAX_TOPO_BYTES) {
    throw new Error(`National map is ${bytes} bytes; the limit is ${MAX_TOPO_BYTES}. Simplify more.`);
  }
}

// Stop instead of guessing when Natural Earth and data/thailand-provinces.json disagree.
function verifyProvinceIds(ids) {
  const expected = new Set(loadProvinces().map((p) => p.id));
  const found = new Set(ids);
  const missing = [...expected].filter((id) => !found.has(id));
  const unexpected = [...found].filter((id) => !expected.has(id));
  if (ids.length !== 77 || found.size !== 77 || missing.length || unexpected.length) {
    throw new Error(
      `Natural Earth gave ${ids.length} Thai features (${found.size} unique ids). ` +
      `Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}.`);
  }
  console.log('Natural Earth: all 77 province ids match data/thailand-provinces.json');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
