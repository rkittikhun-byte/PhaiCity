/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Province maps (data/maps/TH-xx.json, format in docs/geo/GEO_SPEC.md section 5): format 1 was a 2 × 2 km area
// around the town; format 2 is the whole province, with its railways, a road to each neighbour and which tiles are
// in the province. Shared by the game's map loader, the province picker and the map review page.

export const PRESET_LAND = 0;
export const PRESET_WATER = 1;
export const PRESET_WOODS = 2;

/** transport codes: a road, a railway, or both where a road crosses a railway */
export const TRANSPORT_ROAD = 1;
export const TRANSPORT_RAIL = 2;
export const TRANSPORT_CROSSING = 3;

export type PresetFlag =
  | "too_much_water" | "no_water" | "coast_not_on_edge" | "center_missing" | "neighbor_unlinked" | "route_failed";

/** Where a road or railway leaves the province, and the neighbouring province it leads to. */
export interface PresetExit {
  neighbor: string;
  kind: "road" | "rail";
  /** The road's number, e.g. "2" */
  ref?: string;
  /** The railway line's name */
  name?: string;
  x: number;
  y: number;
}

/** A big river through the province, in Thai and English (empty when OpenStreetMap has no English name). */
export interface PresetWaterway {
  th: string;
  en: string;
}

/** A passenger airport in the province, with its IATA code. */
export interface PresetAirport extends PresetWaterway {
  iata: string;
}

export interface PresetMap {
  format: number;
  provinceId: string;
  width: number;
  height: number;
  tileSizeM: number;
  center: { lat: number; lon: number };
  bbox: [number, number, number, number];
  cells: string;
  /** Format 2: roads and railways, run-length encoded like cells */
  transport?: string;
  /** Format 2: 1 for tiles in the province, 0 for the land around it */
  inside?: string;
  /** Format 2: the provincial town's tile */
  town?: { x: number; y: number } | null;
  exits?: PresetExit[];
  waterways?: PresetWaterway[];
  airports?: PresetAirport[];
  /** Neighbouring provinces with no road link */
  unlinked?: string[];
  /** Each tile's ground height: min + level × step metres, the levels deflated and in base64 (decodePresetHeights) */
  heights?: { min: number; step: number; data: string };
  stats: {
    land: number; water: number; woods: number; insideTiles?: number; roadTiles?: number; railTiles?: number;
    /** The lowest and highest tile in the province, in metres */
    heightMin?: number; heightMax?: number;
  };
  flags: PresetFlag[];
  sources: string[];
  generatedAt: string;
}

// Colors for drawing a preset map at a few pixels per tile: land, water, woods.
export const PRESET_COLORS = ["#c8794a", "#3f7fb8", "#3f8a46"];
/** A road (light, so it shows on the land), a railway, and a level crossing */
export const TRANSPORT_COLORS = ["", "#f6e7c1", "#2a2a2a", "#f2d24a"];
/** How bright the land outside the province is drawn, against inside */
export const OUTSIDE_BRIGHTNESS = 0.45;

// Draws a preset map onto a canvas, pixelsPerTile pixels per tile (it may be a fraction). Used by the map review
// page and the province picker. Format 2 maps also show their roads and railways, and dim the land around the
// province.
export function drawPresetMap(canvas: HTMLCanvasElement, map: PresetMap, pixelsPerTile: number): void {
  const cells = decodePresetCells(map);
  const transport = map.transport ? decodePresetLayer(map.transport, map.width, map.height) : null;
  const inside = map.inside ? decodePresetLayer(map.inside, map.width, map.height) : null;
  canvas.width = Math.max(1, Math.round(map.width * pixelsPerTile));
  canvas.height = Math.max(1, Math.round(map.height * pixelsPerTile));
  const context = canvas.getContext("2d");
  if (!context) return;

  // One pixel per tile, then scaled up or down without smoothing
  const image = context.createImageData(map.width, map.height);
  const rgb = [...PRESET_COLORS, ...TRANSPORT_COLORS.slice(1)].map(hexToRgb);
  for (let i = 0; i < cells.length; i++) {
    const code = transport && transport[i] ? PRESET_COLORS.length + transport[i] - 1 : cells[i];
    const [r, g, b] = rgb[code] ?? [0, 0, 0];
    const k = inside && !inside[i] ? OUTSIDE_BRIGHTNESS : 1;
    image.data[i * 4] = r * k;
    image.data[i * 4 + 1] = g * k;
    image.data[i * 4 + 2] = b * k;
    image.data[i * 4 + 3] = 255;
  }
  const tiles = document.createElement("canvas");
  tiles.width = map.width;
  tiles.height = map.height;
  tiles.getContext("2d")?.putImageData(image, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(tiles, 0, 0, canvas.width, canvas.height);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Decodes the run-length encoded "count:code,count:code" cells into one code per tile, row-major.
export function decodePresetCells(map: Pick<PresetMap, "cells" | "width" | "height">): Uint8Array {
  return decodePresetLayer(map.cells, map.width, map.height);
}

/** Decodes any of a preset's run-length encoded layers (cells, transport, inside) into one code per tile. */
export function decodePresetLayer(encoded: string, width: number, height: number): Uint8Array {
  const expected = width * height;
  const codes = new Uint8Array(expected);
  let offset = 0;

  if (encoded.length > 0) {
    for (const run of encoded.split(",")) {
      const separator = run.indexOf(":");
      const count = Number(run.slice(0, separator));
      const code = Number(run.slice(separator + 1));
      if (separator < 0 || !Number.isInteger(count) || count <= 0 || !Number.isInteger(code) ||
          offset + count > expected) {
        throw new Error(`Bad preset map run "${run}"`);
      }
      codes.fill(code, offset, offset + count);
      offset += count;
    }
  }

  if (offset !== expected) {
    throw new Error(`Preset map decoded to ${offset} cells, expected ${expected}`);
  }
  return codes;
}

/**
 * The ground height of each tile in metres, row by row (docs/geo/GEO_SPEC.md section 5), or null for a map without
 * heights. The levels are deflated, so this waits on the browser's own decompression.
 */
export async function decodePresetHeights(map: Pick<PresetMap, "heights" | "width" | "height">):
    Promise<Float32Array | null> {
  if (!map.heights) return null;
  const { min, step, data } = map.heights;
  const packed = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate"));
  const levels = new Uint8Array(await new Response(stream).arrayBuffer());
  if (levels.length !== map.width * map.height) {
    throw new Error(`Preset heights decoded to ${levels.length} tiles, expected ${map.width * map.height}`);
  }
  const heights = new Float32Array(levels.length);
  for (let i = 0; i < levels.length; i++) heights[i] = min + levels[i] * step;
  return heights;
}

/** "count:code,…" for a layer of codes, the inverse of decodePresetLayer (saves keep the province mask this way). */
export function encodePresetLayer(codes: ArrayLike<number>): string {
  const runs: string[] = [];
  let i = 0;
  while (i < codes.length) {
    const code = codes[i];
    let count = 1;
    while (i + count < codes.length && codes[i + count] === code) count++;
    runs.push(`${count}:${code}`);
    i += count;
  }
  return runs.join(",");
}
