/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A whole district's map cut to the frame a city plays (docs/DISTRICT_FRAME.md, src/cityFrame.ts): the same kind of
// map as before, the frame's size, so the game builds its city as it always has, plus where the frame lies in the
// district for growing it later. Also the fresh map of a bigger frame that a growing city's save is moved into.

import { cropLayer, frameCenter, type Frame, type FreshFrame } from "../cityFrame.js";
import { CITY_BLOCK_SIZE } from "../landBlocks.js";
import { MapGenerator } from "../mapGenerator.js";
import { decodePresetCells, decodePresetHeights, decodePresetLayer, decodePresetLayerWide, encodePresetLayer } from "./presetMap.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Preset = Record<string, any>;

/** The district's map's size and middle, kept with a framed map for growing its frame */
export interface DistrictPlace { width: number; height: number; center: { lat: number; lon: number } }

/** Whether a map is a district's, played a frame at a time */
export const isDistrictMap = (preset: Preset): boolean => preset.scale === "district" && Boolean(preset.districtId);

/** The district's map's block size: a city map's land blocks (src/landBlocks.ts) */
export const DISTRICT_BLOCK = CITY_BLOCK_SIZE;

/**
 * The district's map cut to a frame: its layers, its town and exits moved into the frame, the frame's middle on the
 * earth, its heights decoded (as `decodedHeights`), and `frame` and `district` for growing it
 */
export async function framePreset(preset: Preset, frame: Frame): Promise<Preset> {
  const { width, height } = preset;
  const crop = (encoded: string | undefined): string | undefined =>
    encoded ? encodePresetLayer(cropLayer(decodePresetLayer(encoded, width, height), width, frame)) : undefined;
  const heights = await decodePresetHeights(preset as never);
  const inFrame = (p: { x: number; y: number }): boolean => p.x >= frame.x && p.y >= frame.y && p.x < frame.x + frame.width &&
    p.y < frame.y + frame.height;
  const moved = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x - frame.x, y: p.y - frame.y });
  return {
    ...preset,
    width: frame.width,
    height: frame.height,
    center: frameCenter(preset.center, { width, height }, frame, preset.tileSizeM),
    cells: encodePresetLayer(cropLayer(decodePresetCells(preset as never), width, frame)),
    transport: crop(preset.transport),
    inside: crop(preset.inside),
    landCover: crop(preset.landCover),
    roadLevels: crop(preset.roadLevels),
    roadNames: preset.roadNames ? encodePresetLayer(cropLayer(decodePresetLayerWide(preset.roadNames, width, height), width, frame)) : undefined,
    heights: undefined,
    decodedHeights: heights ? cropLayer(heights, width, frame) : null,
    town: preset.town && inFrame(preset.town) ? moved(preset.town) : null,
    exits: (preset.exits ?? []).filter(inFrame).map(moved),
    frame: { ...frame },
    district: { width, height, center: preset.center } as DistrictPlace,
  };
}

/** A framed map's heights: decoded already by framePreset, else from the map */
export function presetHeights(preset: Preset): Promise<Float32Array | null> {
  return preset.decodedHeights !== undefined ? Promise.resolve(preset.decodedHeights) : decodePresetHeights(preset as never);
}

/** A bigger frame's fresh map, as a new city's would be, for moving a growing city's save into (src/cityFrame.ts) */
export function freshFrame(framed: Preset): FreshFrame {
  const layer = (encoded: string | undefined): Uint8Array | null =>
    encoded ? decodePresetLayer(encoded, framed.width, framed.height) : null;
  const transport = layer(framed.transport);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = (MapGenerator as any).fromPresetCells(framed.width, framed.height, decodePresetCells(framed as never), transport);
  const data: { map?: Array<{ value: number }> } = {};
  map.save(data);
  return { map: data.map ?? [], inside: layer(framed.inside), national: transport, roadLevels: layer(framed.roadLevels) };
}
