/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:neighbors [-- --osm]
// Checks the hand-made neighbour lists in data/thailand-provinces.json against the province shapes
// (data/geo/thailand-provinces.topo.json, Natural Earth). Read only: it reports, the owner decides.
// Natural Earth is simplified and can miss a very short border, so --osm asks OpenStreetMap about each pair that
// differs: two provinces share a border when their boundary relations share a way (one Overpass query per pair,
// cached in data/geo/cache/overpass/).
// Exits with 1 when there are differences other than the known ones below.

import { compareNeighbors, sharedBorders } from './lib/adjacency.mjs';
import { NATIONAL_TOPO_FILE, overpass, PROVINCES_FILE, readJson } from './lib/common.mjs';

// Known cases, checked against OpenStreetMap with --osm on 12 Oct 2026
const KNOWN = {
  // Neighbours although the simplified shapes share no border
  listedWithoutBorder: [
    ['TH-83', 'TH-82'], // Phuket – Phang Nga: the Sarasin bridge (GEO_SPEC section 8)
    ['TH-16', 'TH-36'], // Lopburi – Chaiyaphum: a short border Natural Earth loses (OSM: 7 shared ways)
    ['TH-91', 'TH-93'], // Satun – Phatthalung: likewise (OSM: 3 shared ways)
  ],
  // Shapes that touch although the provinces don't
  falseBorders: [
    ['TH-90', 'TH-92'], // Songkhla – Trang: touch only in Natural Earth (OSM: no shared way)
  ],
};

const { provinces } = readJson(PROVINCES_FILE);
const topology = readJson(NATIONAL_TOPO_FILE);
const geometries = Object.values(topology.objects)[0].geometries;
const names = new Map(provinces.map((p) => [p.id, `${p.nameTh} (${p.id})`]));
const listed = new Map(provinces.map((p) => [p.id, p.neighbors]));

const unknownIds = provinces.map((p) => p.id).filter((id) => !geometries.some((g) => (g.properties?.id ?? g.id) === id));
const { missing, extra, expected } = compareNeighbors(listed, sharedBorders(geometries), KNOWN);

const show = (pairs) => pairs.map(([a, b]) => `  ${names.get(a) ?? a} – ${names.get(b) ?? b}`).join('\n') || '  (none)';
console.log(`Provinces: ${provinces.length}, shapes: ${geometries.length}${unknownIds.length ? `, without a shape: ${unknownIds.join(', ')}` : ''}`);
console.log(`\nShare a border on the map but are not listed as neighbours (${missing.length}):\n${show(missing)}`);
console.log(`\nListed as neighbours but share no border on the map (${extra.length}):\n${show(extra)}`);
console.log(`\nKnown cases, already checked (${expected.length}):\n${show(expected)}`);

// OpenStreetMap: do the two provinces' boundary relations share at least one way?
async function osmShareBorder(a, b) {
  const query = `[out:json][timeout:90];
rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"="${a}"]->.a;
rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"="${b}"]->.b;
way(r.a)->.wa;
way(r.b)->.wb;
way.wa.wb;
out ids;`;
  const result = await overpass(query, `border-${a}-${b}`);
  return result.elements.length;
}

if (process.argv.includes('--osm')) {
  console.log('\nOpenStreetMap (shared boundary ways):');
  for (const [a, b] of [...missing, ...extra]) {
    const ways = await osmShareBorder(a, b);
    console.log(`  ${names.get(a)} – ${names.get(b)}: ${ways > 0 ? `share a border (${ways} ways)` : 'no shared border'}`);
  }
}
process.exitCode = missing.length || extra.length || unknownIds.length ? 1 : 0;
