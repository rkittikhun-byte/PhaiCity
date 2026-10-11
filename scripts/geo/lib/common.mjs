/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Shared paths and I/O for the real-geography pipeline (docs/geo/GEO_SPEC.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const GEO_DIR = path.join(ROOT, 'data', 'geo');
export const CACHE_DIR = path.join(GEO_DIR, 'cache');
export const MAPS_DIR = path.join(ROOT, 'data', 'maps');
export const PROVINCES_FILE = path.join(ROOT, 'data', 'thailand-provinces.json');
export const CENTERS_FILE = path.join(GEO_DIR, 'province-centers.json');
export const OVERRIDES_FILE = path.join(GEO_DIR, 'center-overrides.json');
export const EDGES_FILE = path.join(GEO_DIR, 'neighbor-edges.json');
export const NATIONAL_TOPO_FILE = path.join(GEO_DIR, 'thailand-provinces.topo.json');
export const NATIONAL_FULL_GEOJSON = path.join(CACHE_DIR, 'thailand-provinces.full.geojson');

export const USER_AGENT = 'PhaiCity-geo/0.1 (+https://github.com/rkittikhun-byte/PhaiCity)';

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadProvinces() {
  return readJson(PROVINCES_FILE).provinces;
}

// The owner edits center-overrides.json by hand; scripts only create it when missing.
export function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_FILE)) {
    writeJson(OVERRIDES_FILE, {});
  }
  return readJson(OVERRIDES_FILE);
}

// Overrides always win over the automatically chosen centers.
export function resolveCenters() {
  const auto = fs.existsSync(CENTERS_FILE) ? readJson(CENTERS_FILE).centers : {};
  const overrides = loadOverrides();
  const resolved = {};
  for (const province of loadProvinces()) {
    const override = overrides[province.id];
    if (override && typeof override.lat === 'number' && typeof override.lon === 'number') {
      resolved[province.id] = { lat: override.lat, lon: override.lon, source: 'override' };
    } else if (auto[province.id]) {
      resolved[province.id] = auto[province.id];
    } else {
      resolved[province.id] = null;
    }
  }
  return resolved;
}

export async function download(url, dest) {
  if (fs.existsSync(dest)) {
    return dest;
  }
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIN_INTERVAL_MS = 2000;
const OVERPASS_MAX_ATTEMPTS = 5;
let lastOverpassRequest = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cached, rate-limited Overpass request. Retries with backoff on 429/504 (GEO_SPEC section 12).
export async function overpass(query, cacheName) {
  const cacheFile = path.join(CACHE_DIR, 'overpass', `${cacheName}.json`);
  if (fs.existsSync(cacheFile)) {
    return readJson(cacheFile);
  }

  for (let attempt = 0; attempt < OVERPASS_MAX_ATTEMPTS; attempt++) {
    const wait = lastOverpassRequest + OVERPASS_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    lastOverpassRequest = Date.now();

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    });

    if (response.status === 429 || response.status === 504) {
      await sleep(5000 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Overpass request "${cacheName}" failed with ${response.status}`);
    }

    const json = await response.json();
    writeJson(cacheFile, json);
    return json;
  }

  throw new Error(`Overpass request "${cacheName}" kept failing after ${OVERPASS_MAX_ATTEMPTS} attempts`);
}

// mapshaper resolves file paths against the working directory, so scripts run from the repo root.
export function toRepoPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}
