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
// Myanmar, Laos, Cambodia and Malaysia, so province maps can stop roads at the border; never drawn (GEO_SPEC 11)
export const FOREIGN_GEOJSON = path.join(CACHE_DIR, 'neighbor-countries.geojson');

export const USER_AGENT = 'PhaiCity-geo/0.1 (+https://github.com/rkittikhun-byte/PhaiCity)';

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileRetrying(file, JSON.stringify(data, null, 2) + '\n');
}

// On Windows a file watcher (the dev server copying data/) can hold a file for a moment; try again a few times
export function writeFileRetrying(file, text, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.writeFileSync(file, text);
      return;
    } catch (error) {
      if (attempt >= attempts || !['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt);
    }
  }
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

// Public Overpass instances listed on the OSM wiki. The main one is often overloaded (504),
// so busy responses rotate to the next instance.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OVERPASS_MIN_INTERVAL_MS = 2000;
const OVERPASS_MAX_ATTEMPTS = 20;
// Waits between tries grow from 3 s and stop growing at two minutes: a busy server can take a while to have room
const OVERPASS_MAX_WAIT_MS = 120000;
const backoff = (attempt) => Math.min(OVERPASS_MAX_WAIT_MS, 3000 * 2 ** Math.floor(attempt / OVERPASS_URLS.length));
const OVERPASS_BUSY_STATUSES = new Set([429, 502, 503, 504]);
let lastOverpassRequest = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retrying = (cacheName, problem) => console.warn(`  ${cacheName}: ${problem}, trying again`);

// Cached, rate-limited Overpass request. Retries with backoff and rotates instances when
// a server is busy (GEO_SPEC section 12). Big downloads pass slim, which trims the answer before
// it is cached on one line instead of indented.
export async function overpass(query, cacheName, { slim = null } = {}) {
  const cacheFile = path.join(CACHE_DIR, 'overpass', `${cacheName}.json`);
  if (fs.existsSync(cacheFile)) {
    return readJson(cacheFile);
  }

  let lastProblem = '';
  for (let attempt = 0; attempt < OVERPASS_MAX_ATTEMPTS; attempt++) {
    const wait = lastOverpassRequest + OVERPASS_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    lastOverpassRequest = Date.now();
    const url = OVERPASS_URLS[attempt % OVERPASS_URLS.length];

    // A server that takes the request but never answers is given up on a minute after the query's own time limit
    const queryLimitS = Number(/\[timeout:(\d+)\]/.exec(query)?.[1] ?? 180);
    let response;
    let json;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Encoding': 'gzip',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout((queryLimitS + 60) * 1000),
      });
      if (response.ok) json = await response.json();
    } catch (error) {
      lastProblem = `${url}: ${error.message}`;
      retrying(cacheName, lastProblem);
      await sleep(backoff(attempt));
      continue;
    }

    if (OVERPASS_BUSY_STATUSES.has(response.status)) {
      lastProblem = `${url}: HTTP ${response.status}`;
      retrying(cacheName, lastProblem);
      await sleep(backoff(attempt));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Overpass request "${cacheName}" failed with ${response.status} at ${url}`);
    }

    if (json.remark && /runtime error|timed out/i.test(json.remark)) {
      // Overpass reports query timeouts inside a 200 response; never cache a partial result.
      lastProblem = `${url}: ${json.remark}`;
      retrying(cacheName, lastProblem);
      continue;
    }
    if (slim) {
      const trimmed = slim(json);
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(trimmed));
      return trimmed;
    }
    writeJson(cacheFile, json);
    return json;
  }

  throw new Error(`Overpass request "${cacheName}" kept failing after ${OVERPASS_MAX_ATTEMPTS} attempts (${lastProblem})`);
}

// mapshaper resolves file paths against the working directory, so scripts run from the repo root.
export function toRepoPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}
