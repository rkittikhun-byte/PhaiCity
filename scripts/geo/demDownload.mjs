/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:dem
// Downloads the Copernicus DEM GLO-90 (90 m elevation, GEO_SPEC section 3) for every one-degree square the province
// maps reach into, from its open-data copy on AWS, into data/geo/cache/dem/ (not in git). Squares already there are
// skipped; squares of open sea have no file and are noted, not an error.
// Licence: free for any use; the notice "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus
// Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
// goes with anything made from it (data/CREDITS.md).

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, loadProvinces, USER_AGENT } from './lib/common.mjs';
import { loadProvinceShapes } from './lib/provinceArea.mjs';
import { cellsTouching, provinceGrid } from './provinceData.mjs';

export const DEM_DIR = path.join(CACHE_DIR, 'dem');
const BUCKET = 'https://copernicus-dem-90m.s3.amazonaws.com';

/** The file name of the GLO-90 tile whose south-west corner is at lat, lon (whole degrees). */
export function demTileName(lat, lon) {
  const ns = `${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}_00`;
  const ew = `${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}_00`;
  return `Copernicus_DSM_COG_30_${ns}_${ew}_DEM`;
}

async function main() {
  const shapes = loadProvinceShapes();
  const cells = new Set();
  for (const province of loadProvinces()) {
    for (const key of cellsTouching(provinceGrid(shapes.get(province.id)).fetchBox)) cells.add(key);
  }
  fs.mkdirSync(DEM_DIR, { recursive: true });

  let bytes = 0;
  const sea = [];
  for (const key of [...cells].sort()) {
    const [lat, lon] = key.split('_').map(Number);
    const name = demTileName(lat, lon);
    const file = path.join(DEM_DIR, `${name}.tif`);
    if (fs.existsSync(file)) {
      bytes += fs.statSync(file).size;
      continue;
    }
    const response = await fetch(`${BUCKET}/${name}/${name}.tif`, { headers: { 'User-Agent': USER_AGENT } });
    if (response.status === 404 || response.status === 403) {
      sea.push(key);
      continue;
    }
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(file, data);
    bytes += data.length;
    console.log(`${key} ${(data.length / 1048576).toFixed(1)} MB  total ${(bytes / 1048576).toFixed(0)} MB`);
  }
  console.log(`${cells.size - sea.length} tiles, ${(bytes / 1048576).toFixed(0)} MB in ${DEM_DIR}`);
  if (sea.length) console.log(`No tile (open sea): ${sea.join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'geo', 'demDownload.mjs'))) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
