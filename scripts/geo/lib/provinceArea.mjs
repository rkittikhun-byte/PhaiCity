/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A whole province as the play area (owner, 12 Oct 2026; GEO_SPEC section 2): its shape from the Natural Earth
// file the national map is made from, its bounding box, and the scale that fits it into a game map.

import fs from 'node:fs';
import { FOREIGN_GEOJSON, NATIONAL_FULL_GEOJSON, readJson } from './common.mjs';
import { METERS_PER_DEGREE_LAT, METERS_PER_DEGREE_LON_AT_EQUATOR } from './projection.mjs';

/** About how many map tiles fall inside each province, whatever its size (a 200 × 200 map has 40,000 in all). */
export const TARGET_INSIDE_TILES = 30000;
/** The longest side a map may have, in tiles; a very long province gets bigger tiles instead. */
export const MAX_SIDE_TILES = 300;
/** Tiles of neighbouring land around the province on every side, so roads and rails visibly run on out. */
export const MARGIN_TILES = 4;
/** The simulation reads the map in blocks of 2, 4 and 8 tiles, so each side is a multiple of this. */
export const SIDE_STEP_TILES = 8;

/** Every outer and inner ring of a GeoJSON polygon or multipolygon, as [lon, lat] points. */
export function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/** [west, south, east, north] around all the rings. */
export function ringsBbox(rings) {
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon); east = Math.max(east, lon);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
  }
  return [west, south, east, north];
}

/**
 * The area inside the rings in square metres, near latitude lat0. Every ring adds (Thai provinces have islands but no
 * holes), so the winding of the source file does not matter.
 */
export function ringsAreaM2(rings, lat0) {
  const kx = Math.cos(lat0 * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR;
  const ky = METERS_PER_DEGREE_LAT;
  let total = 0;
  for (const ring of rings) {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      sum += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
    }
    total += Math.abs(sum / 2);
  }
  return total;
}

/**
 * The map for a province: the tile size that puts about TARGET_INSIDE_TILES inside it, grown when the province is
 * so long that a side would pass MAX_SIDE_TILES, and the map's size with MARGIN_TILES all round, rounded up to a
 * multiple of SIDE_STEP_TILES (so a side may reach MAX_SIDE_TILES + 7).
 */
export function provinceScale(bbox, areaM2) {
  const [west, south, east, north] = bbox;
  const lat0 = (south + north) / 2;
  const widthM = (east - west) * Math.cos(lat0 * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR;
  const heightM = (north - south) * METERS_PER_DEGREE_LAT;
  let tileSizeM = Math.sqrt(areaM2 / TARGET_INSIDE_TILES);
  const longest = Math.max(widthM, heightM);
  if (longest / tileSizeM + 2 * MARGIN_TILES > MAX_SIDE_TILES) tileSizeM = longest / (MAX_SIDE_TILES - 2 * MARGIN_TILES);
  tileSizeM = Math.ceil(tileSizeM / 5) * 5;
  return {
    tileSizeM,
    width: roundUpSide(Math.ceil(widthM / tileSizeM) + 2 * MARGIN_TILES),
    height: roundUpSide(Math.ceil(heightM / tileSizeM) + 2 * MARGIN_TILES),
    center: { lat: lat0, lon: (west + east) / 2 },
  };
}

const roundUpSide = (tiles) => Math.ceil(tiles / SIDE_STEP_TILES) * SIDE_STEP_TILES;

/** The neighbouring countries' land (npm run geo:national puts it in the cache): code → { rings, bbox }. */
export function loadForeignShapes() {
  if (!fs.existsSync(FOREIGN_GEOJSON)) throw new Error('Run npm run geo:national first: the neighbouring countries are missing');
  const shapes = new Map();
  for (const feature of readJson(FOREIGN_GEOJSON).features) {
    const rings = ringsOf(feature.geometry);
    shapes.set(feature.properties.iso_a2, { rings, bbox: ringsBbox(rings) });
  }
  return shapes;
}

/** Each province's shape from the national file: id → { rings, bbox, areaM2 }. */
export function loadProvinceShapes() {
  const shapes = new Map();
  for (const feature of readJson(NATIONAL_FULL_GEOJSON).features) {
    const rings = ringsOf(feature.geometry);
    const bbox = ringsBbox(rings);
    shapes.set(feature.properties.id, { rings, bbox, areaM2: ringsAreaM2(rings, (bbox[1] + bbox[3]) / 2) });
  }
  return shapes;
}
