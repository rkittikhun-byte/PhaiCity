/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:maps [-- --only TH-40,TH-50] [-- --preview] [-- --partial]
// Builds every province's map, the whole province scaled down (GEO_SPEC sections 2, 5, 6 and 6B), from the data
// that geo:download keeps in data/geo/cache/, and writes data/maps/TH-xx.json in format 2. Run geo:centers first.
// --preview also draws each map into data/geo/cache/preview/TH-xx.png; --partial builds from whatever has been
// downloaded so far, to look at results before the download is done, and writes those maps beside the previews
// instead of into data/maps/.

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, MAPS_DIR, loadProvinces, resolveCenters, toRepoPath, writeJson } from './lib/common.mjs';
import { encodePng } from './lib/png.mjs';
import { loadProvinceShapes } from './lib/provinceArea.mjs';
import { buildProvinceMap, WATER, WOODS } from './lib/provinceMap.mjs';
import { encodeRle } from './lib/rle.mjs';
import { CROSSING, RAIL, ROAD } from './lib/routing.mjs';
import { provinceAt } from './lib/links.mjs';
import { LAYER_NAMES, loadAirports, loadLayer, provinceGrid } from './provinceData.mjs';

const MIN_LAND_FRACTION = 0.4;
const PREVIEW_DIR = path.join(CACHE_DIR, 'preview');

function parseArgs(argv) {
  const options = { only: null, preview: false, partial: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--only': options.only = new Set(argv[i + 1].split(',').map((s) => s.trim())); i++; break;
      case '--preview': options.preview = true; break;
      case '--partial': options.partial = true; break;
      default: throw new Error(`Unknown argument ${argv[i]}`);
    }
  }
  return options;
}

function flagsFor(province, result, neighborsByLand) {
  const flags = [];
  const { stats } = result;
  if (!result.town) flags.push('center_missing');
  if (stats.land + stats.woods < MIN_LAND_FRACTION) flags.push('too_much_water');
  const linked = new Set(result.exits.filter((exit) => exit.kind === 'road').map((exit) => exit.neighbor));
  const unlinked = neighborsByLand.filter((id) => !linked.has(id));
  if (unlinked.length) flags.push('neighbor_unlinked');
  if (result.problems.some((problem) => problem.includes('could not be laid'))) flags.push('route_failed');
  return { flags, unlinked };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const shapes = loadProvinceShapes();
  const centers = resolveCenters();
  const towns = new Map(Object.entries(centers).filter(([, center]) => center));
  const provinces = loadProvinces().filter((p) => !options.only || options.only.has(p.id));
  const airports = await loadAirports();
  const report = [];

  for (const province of provinces) {
    const started = Date.now();
    const shape = shapes.get(province.id);
    const { grid, fetchBox } = provinceGrid(shape);
    const layers = {};
    for (const layer of LAYER_NAMES) layers[layer] = loadLayer(layer, fetchBox, { partial: options.partial });

    const result = buildProvinceMap({
      id: province.id, shape, shapes, grid, layers, town: centers[province.id], towns,
    });
    const { flags, unlinked } = flagsFor(province, result, province.neighbors);
    const round = (v) => Math.round(v * 1e6) / 1e6;

    writeJson(path.join(options.partial ? PREVIEW_DIR : MAPS_DIR, `${province.id}.json`), {
      format: 2,
      provinceId: province.id,
      width: grid.width,
      height: grid.height,
      tileSizeM: grid.tileSizeM,
      center: { lat: round(grid.center.lat), lon: round(grid.center.lon) },
      bbox: grid.bbox().map(round),
      cells: encodeRle(result.cells),
      transport: encodeRle(result.transport),
      inside: encodeRle(result.inside),
      town: result.town,
      exits: result.exits,
      waterways: result.waterways,
      airports: airports
        .filter((airport) => provinceAt(airport.lon, airport.lat, shapes) === province.id)
        .map((airport) => ({ th: airport.name, en: airport.nameEn, iata: airport.iata })),
      stats: result.stats,
      flags,
      unlinked,
      sources: ['OpenStreetMap contributors (ODbL 1.0)', 'Natural Earth (public domain)'],
      generatedAt: new Date().toISOString(),
    });
    if (options.preview) writePreview(province.id, grid, result);
    report.push({ province, flags, unlinked, problems: result.problems, stats: result.stats, exits: result.exits });
    console.log(`${province.id} ${province.nameTh.padEnd(14)} ${grid.width}×${grid.height}  ` +
      `roads ${result.stats.roadTiles} rail ${result.stats.railTiles}  ` +
      `links ${result.exits.filter((e) => e.kind === 'road').map((e) => e.neighbor.slice(3)).join(' ') || '-'}` +
      `${flags.length ? `  [${flags.join(', ')}]` : ''}  ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

  printReport(report);
}

// ── Preview pictures ───────────────────────────────────────────────────────────────────────────────────────────

const COLORS = {
  land: [200, 162, 107],
  water: [63, 127, 184],
  woods: [63, 138, 70],
  road: [196, 84, 40], // laterite
  rail: [30, 30, 30],
  crossing: [255, 230, 0],
  town: [255, 255, 255],
  exit: [255, 0, 255],
};
const PIXELS_PER_TILE = 3;

function writePreview(id, grid, result) {
  const { width, height } = grid;
  const scale = PIXELS_PER_TILE;
  const rgb = new Uint8Array(width * scale * height * scale * 3);
  const paint = (x, y, color) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const p = ((y * scale + dy) * width * scale + x * scale + dx) * 3;
        rgb[p] = color[0];
        rgb[p + 1] = color[1];
        rgb[p + 2] = color[2];
      }
    }
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const cell = result.cells[i];
      let color = cell === WATER ? COLORS.water : cell === WOODS ? COLORS.woods : COLORS.land;
      const transport = result.transport[i];
      if (transport === ROAD) color = COLORS.road;
      else if (transport === RAIL) color = COLORS.rail;
      else if (transport === CROSSING) color = COLORS.crossing;
      // Outside the province: dimmed
      if (!result.inside[i]) color = color.map((c) => Math.round(c * 0.45));
      paint(x, y, color);
    }
  }
  for (const exit of result.exits) paint(exit.x, exit.y, COLORS.exit);
  if (result.town) paint(result.town.x, result.town.y, COLORS.town);
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  fs.writeFileSync(path.join(PREVIEW_DIR, `${id}.png`), encodePng(width * scale, height * scale, rgb));
}

function printReport(report) {
  console.log('');
  const flagged = report.filter((r) => r.flags.length || r.problems.length);
  console.log(`Maps written: ${report.length}. Flagged: ${flagged.length}.`);
  for (const { province, flags, unlinked, problems } of flagged) {
    const details = [...flags.map((flag) => (flag === 'neighbor_unlinked' ? `${flag} (${unlinked.join(', ')})` : flag)),
      ...problems];
    console.log(`  ${province.id} ${province.nameTh}: ${details.join('; ')}`);
  }
  const bytes = fs.readdirSync(MAPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .reduce((sum, f) => sum + fs.statSync(path.join(MAPS_DIR, f)).size, 0);
  console.log(`Total size of ${toRepoPath(MAPS_DIR)}: ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((error) => {
  console.error(`\n${error.stack ?? error.message}`);
  process.exit(1);
});
