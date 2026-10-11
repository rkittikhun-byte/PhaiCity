/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:edges   (run geo:centers first)
// For every province, decides which map edge faces each neighboring province (GEO_SPEC section 8)
// and writes data/geo/neighbor-edges.json.

import { EDGES_FILE, loadProvinces, resolveCenters, toRepoPath, writeJson } from './lib/common.mjs';
import { assignNeighborEdges } from './lib/geometry.mjs';

function main() {
  const provinces = loadProvinces();
  const centers = resolveCenters();
  const edges = {};
  const skipped = [];

  for (const province of provinces) {
    const center = centers[province.id];
    const neighbors = province.neighbors
      .filter((id) => centers[id])
      .map((id) => ({ id, center: centers[id] }));

    if (!center || neighbors.length !== province.neighbors.length) {
      skipped.push(province.id);
      edges[province.id] = null;
      continue;
    }
    edges[province.id] = assignNeighborEdges(center, neighbors);
  }

  writeJson(EDGES_FILE, {
    _meta: {
      description: 'Map edge facing each neighboring province. Positions run west→east on N/S edges ' +
        'and north→south on E/W edges (GEO_SPEC section 8).',
      license: 'Derived from OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0',
      generatedAt: new Date().toISOString(),
    },
    edges,
  });

  console.log(`Wrote ${toRepoPath(EDGES_FILE)}`);
  if (skipped.length) {
    console.log(`Skipped (missing center for the province or a neighbor): ${skipped.join(', ')}`);
  }
}

main();
