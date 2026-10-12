/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Heights for a province map (GEO_SPEC section 5): the mean ground height of each tile in metres, from the Copernicus
// DEM GLO-90 tiles npm run geo:dem keeps in data/geo/cache/dem/. Squares of open sea have no tile and are at 0.
// It is a surface model, so towns and forests stand a few metres above the ground: fine at a few hundred metres a tile.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readGeoTiff } from './geotiff.mjs';
import { DEM_DIR, demTileName } from '../demDownload.mjs';

const images = new Map();

/** The DEM tile covering a whole-degree square, read once; null for open sea. */
function demTile(lat, lon) {
  const key = `${lat}_${lon}`;
  if (!images.has(key)) {
    const file = path.join(DEM_DIR, `${demTileName(lat, lon)}.tif`);
    images.set(key, fs.existsSync(file) ? readGeoTiff(fs.readFileSync(file)) : null);
  }
  return images.get(key);
}

/** The DEM height at a point, or 0 over open sea (no tile) and missing pixels. */
export function demHeight(lat, lon) {
  const image = demTile(Math.floor(lat), Math.floor(lon));
  if (!image) return 0;
  const x = Math.min(image.width - 1, Math.max(0, Math.floor((lon - image.west) / image.dx)));
  const y = Math.min(image.height - 1, Math.max(0, Math.floor((image.north - lat) / image.dy)));
  const value = image.data[y * image.width + x];
  return Number.isFinite(value) && value > -1000 ? value : 0;
}

/**
 * The mean height of each tile of a map grid (makeGrid), in metres, row by row: SAMPLES × SAMPLES points per tile, so
 * a tile of a kilometre averages over a dozen DEM pixels a side and a small tile still gets several.
 */
const SAMPLES = 4;
export function tileHeights(grid) {
  const { width, height, tileSizeM } = grid;
  const heights = new Float32Array(width * height);
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      let sum = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const { lat, lon } = grid.unproject((tx + (sx + 0.5) / SAMPLES) * tileSizeM, (ty + (sy + 0.5) / SAMPLES) * tileSizeM);
          sum += demHeight(lat, lon);
        }
      }
      heights[ty * width + tx] = sum / (SAMPLES * SAMPLES);
    }
  }
  return heights;
}

/**
 * Heights packed for a map file: whole metres above the map's lowest tile, in steps of `step` metres so each fits a
 * byte, deflated and in base64: { min, step, data }. min and step are whole metres.
 */
export function packHeights(heights) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of heights) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  min = Math.floor(min);
  const step = Math.max(1, Math.ceil((Math.ceil(max) - min) / 255));
  const levels = new Uint8Array(heights.length);
  for (let i = 0; i < heights.length; i++) levels[i] = Math.min(255, Math.round((heights[i] - min) / step));
  return { min, step, data: zlib.deflateSync(levels, { level: 9 }).toString('base64') };
}
