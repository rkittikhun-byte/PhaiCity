/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A district's map as the whole district (owner, 14 Oct 2026: "ฉันอยากได้แต่ละแผนที่ เป็นแผนที่ของอำเภอนั้นจริงๆ ไม่ใช่ 4
// เหลี่ยมแบบนี้"): its real outline on a grid sized to hold all of it (at most WHOLE_MAX_TILES a side, so a tile is
// 45–110 m in Khon Kaen), and one laterite road from its town to each neighbouring district, or neighbouring province
// at the province's edge, along the real roads between them ("จะมีถนนเชื่อมแต่ละอำเภอเข้ากับอำเภออื่นๆ เพียงเส้นเดียว ...
// ถนนด้านในแผนที่ไม่ต้องมีถนนอื่นๆ อีก"). Which districts are neighbours, and how big the grid and its tiles are.

import { makeGrid } from './projection.mjs';

/** A whole district fits in this many tiles a side */
export const WHOLE_MAX_TILES = 480;
/** ... with this share of its size round it, so its edge and the roads leaving it show */
const MARGIN = 0.06;
/** Tiles are a whole number of 5 m, and never finer than a real-scale city map's */
const MIN_TILE_M = 16;
/** Two outlines this close (metres) touch: districts share a boundary, the simplified outlines a little apart */
const TOUCH_M = 400;
/** ... a district and a neighbouring province, whose outline (Natural Earth) is much coarser */
const TOUCH_PROVINCE_M = 2500;

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320;

/** The grid of a whole district: centred on its outline's box, its tiles as small as WHOLE_MAX_TILES allows */
export function wholeDistrictGrid(bbox) {
  const [west, south, east, north] = bbox;
  const lat = (south + north) / 2, lon = (west + east) / 2;
  const widthM = (east - west) * M_PER_DEG_LON * Math.cos(lat * Math.PI / 180), heightM = (north - south) * M_PER_DEG_LAT;
  const spanM = Math.max(widthM, heightM) * (1 + 2 * MARGIN);
  const tileSizeM = Math.max(MIN_TILE_M, Math.ceil(spanM / WHOLE_MAX_TILES / 5) * 5);
  const width = Math.ceil(widthM * (1 + 2 * MARGIN) / tileSizeM), height = Math.ceil(heightM * (1 + 2 * MARGIN) / tileSizeM);
  return makeGrid({ center: { lat, lon }, width, height, tileSizeM });
}

/** The nearest two vertices of two sets of rings are closer than limitM (a cheap test of touching outlines) */
function near(ringsA, bboxA, ringsB, bboxB, limitM) {
  const padLat = limitM / M_PER_DEG_LAT, padLon = limitM / (M_PER_DEG_LON * Math.cos(((bboxA[1] + bboxA[3]) / 2) * Math.PI / 180));
  if (bboxA[0] - padLon > bboxB[2] || bboxB[0] - padLon > bboxA[2] || bboxA[1] - padLat > bboxB[3] || bboxB[1] - padLat > bboxA[3]) return false;
  const cos = Math.cos(((bboxA[1] + bboxA[3]) / 2) * Math.PI / 180), limit2 = limitM * limitM;
  // Only B's vertices near A's box count, which keeps a big province's outline cheap
  const pointsB = [];
  for (const ring of ringsB) for (const [lon, lat] of ring) {
    if (lon >= bboxA[0] - padLon && lon <= bboxA[2] + padLon && lat >= bboxA[1] - padLat && lat <= bboxA[3] + padLat) pointsB.push([lon, lat]);
  }
  for (const ring of ringsA) for (const [lonA, latA] of ring) {
    for (const [lonB, latB] of pointsB) {
      const dx = (lonA - lonB) * M_PER_DEG_LON * cos, dy = (latA - latB) * M_PER_DEG_LAT;
      if (dx * dx + dy * dy < limit2) return true;
    }
  }
  return false;
}

/**
 * The neighbours of a district: the districts of its province whose outlines touch it, and the neighbouring
 * provinces it borders. districts: { id, rings, bbox }; provinces: { id, rings, bbox } of the province's neighbours.
 */
export function districtNeighbours(district, districts, provinces) {
  const neighbours = [];
  for (const other of districts) {
    if (other.id !== district.id && near(district.rings, district.bbox, other.rings, other.bbox, TOUCH_M)) neighbours.push(other.id);
  }
  for (const province of provinces) {
    if (near(district.rings, district.bbox, province.rings, province.bbox, TOUCH_PROVINCE_M)) neighbours.push(province.id);
  }
  return neighbours;
}

/** The roads a road between districts may follow, best first (the province maps' ROAD_RANK and the next classes down) */
export const DISTRICT_ROAD_RANK = {
  motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5,
  motorway_link: 0, trunk_link: 1, primary_link: 2, secondary_link: 3, tertiary_link: 4,
};
