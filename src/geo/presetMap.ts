/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Preset province starting maps (data/maps/TH-xx.json, format in docs/geo/GEO_SPEC.md section 5).
// Shared by the map review page and, later, the game's map loader.

export const PRESET_LAND = 0;
export const PRESET_WATER = 1;
export const PRESET_WOODS = 2;

export type PresetFlag = "too_much_water" | "no_water" | "coast_not_on_edge" | "center_missing";

export interface PresetMap {
  format: number;
  provinceId: string;
  width: number;
  height: number;
  tileSizeM: number;
  center: { lat: number; lon: number };
  bbox: [number, number, number, number];
  cells: string;
  stats: { land: number; water: number; woods: number };
  flags: PresetFlag[];
  sources: string[];
  generatedAt: string;
}

// Colors for drawing a preset map at a few pixels per tile: land, water, woods.
export const PRESET_COLORS = ["#c8794a", "#3f7fb8", "#3f8a46"];

// Draws a preset map onto a canvas, pixelsPerTile pixels per tile. Used by the map review page
// and the province picker.
export function drawPresetMap(canvas: HTMLCanvasElement, map: PresetMap, pixelsPerTile: number): void {
  const cells = decodePresetCells(map);
  canvas.width = map.width * pixelsPerTile;
  canvas.height = map.height * pixelsPerTile;
  const context = canvas.getContext("2d");
  if (!context) return;

  for (let row = 0; row < map.height; row++) {
    for (let column = 0; column < map.width; column++) {
      context.fillStyle = PRESET_COLORS[cells[row * map.width + column]] ?? "#000";
      context.fillRect(column * pixelsPerTile, row * pixelsPerTile, pixelsPerTile, pixelsPerTile);
    }
  }
}

// Decodes the run-length encoded "count:code,count:code" cells into one code per tile, row-major.
export function decodePresetCells(map: Pick<PresetMap, "cells" | "width" | "height">): Uint8Array {
  const expected = map.width * map.height;
  const cells = new Uint8Array(expected);
  let offset = 0;

  if (map.cells.length > 0) {
    for (const run of map.cells.split(",")) {
      const separator = run.indexOf(":");
      const count = Number(run.slice(0, separator));
      const code = Number(run.slice(separator + 1));
      if (separator < 0 || !Number.isInteger(count) || count <= 0 || !Number.isInteger(code) ||
          offset + count > expected) {
        throw new Error(`Bad preset map run "${run}"`);
      }
      cells.fill(code, offset, offset + count);
      offset += count;
    }
  }

  if (offset !== expected) {
    throw new Error(`Preset map decoded to ${offset} cells, expected ${expected}`);
  }
  return cells;
}
