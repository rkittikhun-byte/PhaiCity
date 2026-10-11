/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:maps [-- --only TH-50,TH-83] [-- --width 120 --height 100 --tile 10]
// Builds a preset starting map per province from OpenStreetMap water, coast and woods
// (GEO_SPEC sections 5, 6 and 9) and writes data/maps/TH-xx.json. Run geo:centers first.

import fs from 'node:fs';
import path from 'node:path';
import { MAPS_DIR, loadProvinces, overpass, resolveCenters, toRepoPath, writeJson } from './lib/common.mjs';
import { buildPreset } from './lib/preset.mjs';
import { makeGrid } from './lib/projection.mjs';
import { encodeRle } from './lib/rle.mjs';

const FETCH_MARGIN_M = 300;
const MIN_LAND_FRACTION = 0.4;

function parseArgs(argv) {
  const options = { only: null, width: 120, height: 100, tileSizeM: 10 };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--only': options.only = new Set(value.split(',').map((s) => s.trim())); i++; break;
      case '--width': options.width = Number(value); i++; break;
      case '--height': options.height = Number(value); i++; break;
      case '--tile': options.tileSizeM = Number(value); i++; break;
      default: throw new Error(`Unknown argument ${argv[i]}`);
    }
  }
  return options;
}

function overpassQuery([west, south, east, north]) {
  const bb = `(${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)})`;
  // Bay relations are skipped on purpose: some (e.g. the Gulf of Thailand) are enormous,
  // and the sea is built from the coastline anyway.
  return `[out:json][timeout:180];
(
  way["natural"="water"]${bb}; relation["natural"="water"]${bb};
  way["waterway"="riverbank"]${bb}; relation["waterway"="riverbank"]${bb};
  way["landuse"~"^(reservoir|basin)$"]${bb}; relation["landuse"~"^(reservoir|basin)$"]${bb};
  way["natural"="bay"]${bb};
  way["waterway"~"^(river|canal|stream)$"]${bb};
  way["natural"="coastline"]${bb};
  way["landuse"="forest"]${bb}; relation["landuse"="forest"]${bb};
  way["natural"~"^(wood|scrub)$"]${bb}; relation["natural"~"^(wood|scrub)$"]${bb};
  way["leisure"="park"]${bb}; relation["leisure"="park"]${bb};
  way["wetland"="mangrove"]${bb}; relation["wetland"="mangrove"]${bb};
);
out geom;`;
}

function flagsFor(province, result) {
  const flags = [];
  const { stats } = result;
  if (stats.land + stats.woods < MIN_LAND_FRACTION) flags.push('too_much_water');
  const hasWaterTag = province.tags.some((t) => t.startsWith('river_') || t.startsWith('coast_'));
  if (hasWaterTag && stats.water === 0) flags.push('no_water');
  if (province.tags.some((t) => t.startsWith('coast_')) && !result.seaTouchesEdge) flags.push('coast_not_on_edge');
  return flags;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const centers = resolveCenters();
  const provinces = loadProvinces().filter((p) => !options.only || options.only.has(p.id));
  const report = [];

  for (const province of provinces) {
    const center = centers[province.id];
    if (!center) {
      report.push({ province, flags: ['center_missing'] });
      continue;
    }

    const grid = makeGrid({ center, width: options.width, height: options.height, tileSizeM: options.tileSizeM });
    const cacheName = `maps/${province.id}_${options.width}x${options.height}_${options.tileSizeM}m_` +
      `${center.lat.toFixed(5)}_${center.lon.toFixed(5)}`;
    const data = await overpass(overpassQuery(grid.bbox(FETCH_MARGIN_M)), cacheName);
    const result = buildPreset(grid, data.elements);
    const flags = flagsFor(province, result);
    const bbox = grid.bbox().map((v) => Math.round(v * 1e6) / 1e6);

    writeJson(path.join(MAPS_DIR, `${province.id}.json`), {
      format: 1,
      provinceId: province.id,
      width: options.width,
      height: options.height,
      tileSizeM: options.tileSizeM,
      center: { lat: center.lat, lon: center.lon },
      bbox,
      cells: encodeRle(result.cells),
      stats: result.stats,
      flags,
      sources: ['OpenStreetMap contributors (ODbL 1.0)'],
      generatedAt: new Date().toISOString(),
    });
    report.push({ province, flags, stats: result.stats });
    process.stdout.write(`${province.id} ${flags.length ? `[${flags.join(', ')}]` : 'ok'}  `);
  }

  printReport(report);
}

function printReport(report) {
  console.log('\n');
  const flagged = report.filter((r) => r.flags.length);
  console.log(`Maps written: ${report.filter((r) => r.stats).length}. Flagged: ${flagged.length}.`);
  for (const { province, flags, stats } of flagged) {
    const detail = stats ? ` land ${stats.land} water ${stats.water} woods ${stats.woods}` : '';
    console.log(`  ${province.id} ${province.nameTh}: ${flags.join(', ')}${detail}`);
  }
  const bytes = fs.readdirSync(MAPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .reduce((sum, f) => sum + fs.statSync(path.join(MAPS_DIR, f)).size, 0);
  console.log(`Total size of ${toRepoPath(MAPS_DIR)}: ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
