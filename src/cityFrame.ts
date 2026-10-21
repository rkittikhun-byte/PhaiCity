/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The frame of a district a city plays (owner, 15 Oct 2026; docs/DISTRICT_FRAME.md). A district's map is the whole
// district at 16 m a tile, some 2,600 tiles a side, far more than the simulation can run; a city plays a frame of it
// in whole land blocks, at first the 15 × 15 blocks round its town, and the frame grows as the city buys land near
// its edge. Growing moves everything a save keeps by tile into the bigger frame (reframeSave) and fills the new land
// from the district's map, so the city opens again on the bigger frame with nothing lost. Plain code: no DOM.

import { decodePresetLayer, decodePresetLayerWide, encodePresetLayer } from "./geo/presetMap.js";
import { movedGraphData } from "./roads/roadGraph.js";
import { CITY_TILE_M } from "./units.js";

/** A frame of a district's map, in its tiles: whole land blocks */
export interface Frame { x: number; y: number; width: number; height: number }
/** A district's map's size, in tiles */
export interface DistrictSize { width: number; height: number }

/** Blocks a side of a new city's frame (480 tiles, 7.7 km: what a district city played before frames) */
export const FRAME_START_BLOCKS = 15;
/** The frame grows on a side where owned land comes within this many blocks of its edge ... */
export const FRAME_MARGIN_BLOCKS = 2;
/** ... by this many blocks */
export const FRAME_GROW_BLOCKS = 4;
/** ... up to this many blocks a side (16.4 km): beyond it the simulation would be too slow */
export const FRAME_MAX_BLOCKS = 32;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** A new city's frame: FRAME_START_BLOCKS a side round the town's block, kept within the district's map */
export function firstFrame(district: DistrictSize, town: { x: number; y: number }, block: number): Frame {
  const columns = Math.floor(district.width / block), rows = Math.floor(district.height / block);
  const across = Math.min(FRAME_START_BLOCKS, columns), down = Math.min(FRAME_START_BLOCKS, rows);
  const bx = clamp(Math.floor(town.x / block) - Math.floor(across / 2), 0, columns - across);
  const by = clamp(Math.floor(town.y / block) - Math.floor(down / 2), 0, rows - down);
  return { x: bx * block, y: by * block, width: across * block, height: down * block };
}

/**
 * The frame a city needs for the land it owns (blocks: the frame's land blocks, 1 owned, row by row), or null when
 * its frame will do: grown by FRAME_GROW_BLOCKS on each side where owned land is within FRAME_MARGIN_BLOCKS of the
 * edge, as far as the district's map and FRAME_MAX_BLOCKS allow
 */
export function grownFrame(frame: Frame, blocks: Uint8Array, district: DistrictSize, block: number): Frame | null {
  const columns = frame.width / block, rows = frame.height / block;
  let west = columns, east = -1, north = rows, south = -1;
  for (let i = 0; i < blocks.length; i++) if (blocks[i] === 1) {
    const bx = i % columns, by = Math.floor(i / columns);
    west = Math.min(west, bx); east = Math.max(east, bx); north = Math.min(north, by); south = Math.max(south, by);
  }
  if (east < 0) return null;
  const maxColumns = Math.floor(district.width / block), maxRows = Math.floor(district.height / block);
  let x0 = frame.x / block, y0 = frame.y / block, x1 = x0 + columns, y1 = y0 + rows;
  if (west < FRAME_MARGIN_BLOCKS) x0 -= FRAME_GROW_BLOCKS;
  if (columns - 1 - east < FRAME_MARGIN_BLOCKS) x1 += FRAME_GROW_BLOCKS;
  if (north < FRAME_MARGIN_BLOCKS) y0 -= FRAME_GROW_BLOCKS;
  if (rows - 1 - south < FRAME_MARGIN_BLOCKS) y1 += FRAME_GROW_BLOCKS;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(maxColumns, x1); y1 = Math.min(maxRows, y1);
  // Never past the largest frame: the side away from the owned land gives way first
  const fit = (low: number, high: number, ownedLow: number, ownedHigh: number): [number, number] => {
    while (high - low > FRAME_MAX_BLOCKS) {
      if (ownedLow - low > high - 1 - ownedHigh) low++;
      else high--;
    }
    return [low, high];
  };
  [x0, x1] = fit(x0, x1, frame.x / block + west, frame.x / block + east);
  [y0, y1] = fit(y0, y1, frame.y / block + north, frame.y / block + south);
  const grown = { x: x0 * block, y: y0 * block, width: (x1 - x0) * block, height: (y1 - y0) * block };
  return grown.x <= frame.x && grown.y <= frame.y && grown.x + grown.width >= frame.x + frame.width &&
    grown.y + grown.height >= frame.y + frame.height &&
    (grown.width > frame.width || grown.height > frame.height) ? grown : null;
}

/** A layer of the district's map (one value a tile, row by row) cut to a frame */
export function cropLayer<T extends Uint8Array | Uint16Array | Float32Array>(layer: T, districtWidth: number, frame: Frame): T {
  const out = new (layer.constructor as { new(n: number): T })(frame.width * frame.height);
  for (let y = 0; y < frame.height; y++) {
    const from = (frame.y + y) * districtWidth + frame.x;
    out.set(layer.subarray(from, from + frame.width) as never, y * frame.width);
  }
  return out;
}

/** Where a frame's middle lies on the earth, from the district map's middle (the projection of
 * scripts/geo/lib/projection.mjs makeGrid) */
export function frameCenter(center: { lat: number; lon: number }, district: DistrictSize, frame: Frame, tileSizeM: number):
    { lat: number; lon: number } {
  const dx = (frame.x + frame.width / 2 - district.width / 2) * tileSizeM;
  const dy = (frame.y + frame.height / 2 - district.height / 2) * tileSizeM;
  return { lat: center.lat - dy / 110574, lon: center.lon + dx / (Math.cos(center.lat * Math.PI / 180) * 111320) };
}

/** A new city's map on the bigger frame, as the game builds one from the district's map: its tiles as a save keeps
 * them, and its own layers */
export interface FreshFrame {
  map: Array<{ value: number }>;
  inside: Uint8Array | null;
  national: Uint8Array | null;
  roadLevels: Uint8Array | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Save = Record<string, any>;

/**
 * A save moved from its frame to a bigger one that holds it: every tile and every record kept by tile in the same
 * place on the district's map, the new land as fresh gives it. The save itself is left as it was.
 */
export function reframeSave(save: Save, from: Frame, to: Frame, fresh: FreshFrame, block: number): Save {
  const dx = from.x - to.x, dy = from.y - to.y, w0 = from.width, h0 = from.height, w1 = to.width, h1 = to.height;
  if (dx < 0 || dy < 0 || dx + w0 > w1 || dy + h0 > h1) throw new Error("the new frame must hold the old one");
  if (dx % block || dy % block) throw new Error("frames lie on whole blocks");
  const moved = (index: number): number => {
    const x = index % w0, y = (index - x) / w0;
    return (y + dy) * w1 + x + dx;
  };
  const movedKeys = <T>(record: Record<string, T> | undefined, value: (v: T) => T = (v) => v): Record<string, T> | undefined => {
    if (!record) return record;
    const out: Record<string, T> = {};
    for (const [key, v] of Object.entries(record)) out[String(moved(Number(key)))] = value(v);
    return out;
  };
  // A layer of one value a tile: the old frame's values in place, fresh ones (or fill) round them
  const layer = (old: Uint8Array | null, base: Uint8Array | null, fill = 0): Uint8Array => {
    const out = base ? base.slice() : new Uint8Array(w1 * h1).fill(fill);
    if (old) for (let y = 0; y < h0; y++) out.set(old.subarray(y * w0, (y + 1) * w0), (y + dy) * w1 + dx);
    return out;
  };
  const decoded = (encoded: unknown): Uint8Array | null => (typeof encoded === "string" ? decodePresetLayer(encoded, w0, h0) : null);
  // ... and one of two bytes a tile, the new land 0
  const wideLayer = (encoded: string): Uint16Array => {
    const old = decodePresetLayerWide(encoded, w0, h0), out = new Uint16Array(w1 * h1);
    for (let y = 0; y < h0; y++) out.set(old.subarray(y * w0, (y + 1) * w0), (y + dy) * w1 + dx);
    return out;
  };
  const point = <T extends { x: number; y: number }>(p: T | undefined): T | undefined => (p ? { ...p, x: p.x + dx, y: p.y + dy } : p);

  const out: Save = { ...save, frame: { ...to }, width: w1, height: h1 };
  // The tiles
  const map = fresh.map.map((tile) => ({ ...tile }));
  for (let i = 0; i < save.map.length; i++) map[moved(i)] = save.map[i];
  out.map = map;
  out.cityCentreX = save.cityCentreX + dx; out.cityCentreY = save.cityCentreY + dy;
  out.pollutionMaxX = save.pollutionMaxX + dx; out.pollutionMaxY = save.pollutionMaxY + dy;
  // The district's own tiles come from its map; the state's roads and the roads' levels are the old ones and the new land's
  if (fresh.inside) out.inside = encodePresetLayer(fresh.inside);
  if (save.national !== undefined || fresh.national) out.national = encodePresetLayer(layer(decoded(save.national), fresh.national));
  if (save.roadLevels !== undefined || fresh.roadLevels) out.roadLevels = encodePresetLayer(layer(decoded(save.roadLevels), fresh.roadLevels, 1));
  // ... and the drawn line each road tile was laid by (src/roadPieces.ts); the new land's roads came with the map
  if (typeof save.roadPieces === "string") out.roadPieces = encodePresetLayer(wideLayer(save.roadPieces));
  // ... and the tiles each was drawn along
  if (save.roadPaths && typeof save.roadPaths === "object") {
    out.roadPaths = Object.fromEntries(Object.entries(save.roadPaths as Record<string, { tiles: number[]; controls?: Array<[number, number]> }>)
      .map(([piece, path]) => [piece, { ...path, tiles: path.tiles.map(moved),
        ...(Array.isArray(path.controls) ? { controls: path.controls.map(([x, y]) => [x + dx, y + dy]) } : {}) }]));
  }
  // ... and the roads and railways as drawn, in metres (src/roads/roadGraph.ts)
  const metres = save.tileSizeM || CITY_TILE_M;
  for (const field of ["roads", "rails", "canalLines"]) if (save[field]) out[field] = movedGraphData(save[field], dx * metres, dy * metres);
  // ... and the ruler's buildings where they were put down (src/buildings/placedBuildings.ts)
  if (save.buildings && Array.isArray(save.buildings.buildings)) {
    out.buildings = { ...save.buildings, buildings: save.buildings.buildings.map((row: unknown[]) =>
      [row[0], row[1], Number(row[2]) + dx * metres, Number(row[3]) + dy * metres, row[4], row[5], moved(Number(row[6])),
        ...row.slice(7)]) };
  }
  // ... and the canals the player dug (src/canals.ts)
  if (typeof save.canals === "string") out.canals = encodePresetLayer(layer(decoded(save.canals), null, 0));
  // ... and each building's era (src/eraScore.ts), the new land's none until it is built on
  if (typeof save.buildingEras === "string") out.buildingEras = encodePresetLayer(layer(decoded(save.buildingEras), null, 0));
  // ... and the kind of each farm zone field (src/farmZone.ts)
  if (typeof save.farmKinds === "string") out.farmKinds = encodePresetLayer(layer(decoded(save.farmKinds), null, 0));
  // The ground's water: the new land full (the water works fill it to what it holds, src/waterManager.ts prepareGround)
  if (typeof save.groundwater === "string") out.groundwater = encodePresetLayer(layer(decoded(save.groundwater), null, 255));
  if (save.mining) out.mining = { ...save.mining, ground: typeof save.mining.ground === "string" ?
    encodePresetLayer(layer(decoded(save.mining.ground), null, 0)) : save.mining.ground };
  if (save.waste) out.waste = { ...save.waste, fill: movedKeys(save.waste.fill) };
  // Records kept by tile
  for (const field of ["powerKinds", "mineKinds", "civicKinds", "wasteKinds", "stationKinds", "buildingLevels"]) {
    if (save[field]) out[field] = movedKeys(save[field]);
  }
  // ... the construction sites (src/construction.ts) and the months each school has trained (src/trainedPeople.ts)
  if (save.sites) out.sites = movedKeys(save.sites);
  // ... and the temples the communities built, by their centre tiles (src/temples.ts)
  if (save.temples && Array.isArray(save.temples.temples)) {
    out.temples = { ...save.temples, temples: save.temples.temples.map((t: number[]) => [moved(t[0]), ...t.slice(1)]) };
  }
  if (save.trained && typeof save.trained === "object") out.trained = { ...save.trained, worked: movedKeys(save.trained.worked) };
  if (save.buildingPoses) out.buildingPoses = movedKeys(save.buildingPoses as Record<string, [number, number, number]>,
    ([x, z, turn]): [number, number, number] => [x + dx * 10, z + dy * 10, turn]);
  if (Array.isArray(save.objects)) out.objects = save.objects.map((v: number, i: number) => (i % 2 === 0 ? moved(v) : v));
  if (Array.isArray(save.buses)) out.buses = save.buses.map(moved);
  out.rulerHouse = point(save.rulerHouse);
  out.town = point(save.town);
  // The land: the old frame's blocks in place, the new ones not yet the city's
  if (typeof save.land === "string") {
    const c0 = Math.ceil(w0 / block), r0 = Math.ceil(h0 / block), c1 = Math.ceil(w1 / block), r1 = Math.ceil(h1 / block);
    const old = decodePresetLayer(save.land, c0, r0), land = new Uint8Array(c1 * r1);
    for (let y = 0; y < r0; y++) for (let x = 0; x < c0; x++) land[(y + dy / block) * c1 + x + dx / block] = old[y * c0 + x];
    out.land = encodePresetLayer(land);
  }
  // The painted zone cells, kept by where their middles lie on a 1 m raster (src/zoneCells.ts rasterKey); a frame's
  // tiles are whole metres, so the raster moves by whole squares
  if (Array.isArray(save.zoneCells)) {
    const perTile = save.tileSizeM || 16, r0 = w0 * perTile, r1 = w1 * perTile;
    out.zoneCells = save.zoneCells.map((v: number, i: number) => {
      if (i % 2) return v;
      const rx = v % r0, rz = (v - rx) / r0;
      return (rz + dy * perTile) * r1 + rx + dx * perTile;
    });
  }
  return out;
}
