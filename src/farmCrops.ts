/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The crops grown in the farm zone, by province and by soil (owner, 24 Oct 2026: "ฟาร์ม ไม่ได้ไม่แค่นาข้าวนะ จะมีพืชหลายอย่าง
// สลับกันไป" and "แต่ละพื้นที่ ก้ปลูกได้ไม่เหมือนกัน เพราะดินต่างกัน อย่างทุเรียน ก้จะมีพื้นที่ จำกัดเฉพาะ"; docs/GAME_DESIGN.md
// section 7.6). Each of the four kinds of field (paddy, field, orchard, pond) has its own crops in the rules
// (src/provinceRules.ts FarmZoneSpec.crops, data/province-rules.json). Along each road or canal, the road-aligned cells
// (src/farmGrid.ts) are grouped into family plots 5–8 cells wide (20–32 m) and 11 rows deep (44 m); each plot picks one
// crop of its field's kind from the province's weights and the soil there (height above water, slope, groundwater,
// distance to water, distance to town), using a deterministic hash of the map's seed and the plot's place. Plain code:
// no DOM, no window, no Math.random.

import { cellPainted, farmCellsOnTiles, type FarmGridMap } from "./farmGrid";
import { FARM_CELL_M, farmSide, fieldKindAt, fieldLevelOf, isFieldValue, type FieldMap } from "./farmZone";
import { GROUNDWATER_MAX } from "./groundwater";
import {
  FARM_CROP_IDS, FARM_CROPS,
  type FarmCropId, type FarmCropSpec, type FarmKind, type FarmZoneSpec, type Rules,
} from "./provinceRules";
import { BIT_MASK } from "./tileFlags";
import { WATER_HIGH, WATER_LOW } from "./tileValues";
import { TILE_UNITS, tileMetres, tileOfUnits } from "./units";
import type { Cell } from "./zoneCells";

export { FARM_CROP_IDS, FARM_CROPS };
export type { FarmCropId, FarmCropSpec };

/** Minimum and maximum width of a family plot along its road or canal, in 4 m cells (20–32 m), and its depth in rows (44 m) */
export const PLOT_MIN_CELLS = 5;
export const PLOT_MAX_CELLS = 8;
export const PLOT_DEPTH_ROWS = 11;

/** What the soil at a plot is like (docs/GAME_DESIGN.md 7.6 point 3) */
export interface SoilSample {
  /** Height above nearby water (or low ground), metres */
  rise: number;
  /** Local slope across neighbouring tiles, metres a tile */
  slope: number;
  /** The ground's water there, 0–1 of full */
  ground: number;
  /** Distance to the nearest water, in 16 m tiles */
  water: number;
  /** Distance to the nearest town building or plot, in 16 m tiles */
  town: number;
}

/** A family plot of cells along a road or canal (or a tile plot on a non-cell map) */
export interface FamilyPlot {
  /** Identifier of the road/canal side line */
  lineId: number;
  /** Index of the family plot along that line */
  plotIndex: number;
  /** First cell slot of the plot along the line */
  startSlot: number;
  /** Width of the plot in cells (5–8) */
  widthCells: number;
  /** Depth band from the road (0 for rows 0–10, 1 for 11–21, 2 for 22–32) */
  depthBand: number;
  /** Representative tile coordinates (tx, ty) where the plot's soil is sampled */
  tileX: number;
  tileY: number;
}

/** A cell of a field, as laid by src/farmGrid.ts or src/render3d/city/farmFields.ts */
export interface CropCell {
  x: number;
  z: number;
  angle: number;
  nx: number;
  nz: number;
  row: number;
  road?: number;
}

/** A map with optional seed, province, region, groundwater and rules */
export interface CropMap extends Omit<FieldMap, "getTileFlags"> {
  getTileFlags?(x: number, y: number): number;
  seed?: number;
  citySeed?: number;
  provinceId?: string | null;
  provinceIso?: string | null;
  region?: string | null;
  rules?: Rules | null;
  farmZone?: FarmZoneSpec | null;
  groundwater?: ArrayLike<number> | null;
  ground?: { stores?: ArrayLike<number>; natural?: ArrayLike<number> } | null;
  rulerHouse?: { x: number; y: number } | null;
  town?: { x: number; y: number } | null;
  canals?: ArrayLike<number> | null;
}

export interface CropOptions {
  rules?: Rules | null;
  farmZone?: FarmZoneSpec | null;
  crops?: Readonly<Record<FarmCropId, FarmCropSpec>> | null;
  provinceId?: string | null;
  region?: string | null;
  groundShare?: number;
  seed?: number;
}

/** The resolved crop table from the map's or options' province rules (map.farmZone), or the game's defaults (FARM_CROPS) */
export function resolveCropTable(map?: CropMap | null, options?: CropOptions): Readonly<Record<FarmCropId, FarmCropSpec>> {
  if (options?.crops) return options.crops;
  if (options?.farmZone?.crops) return options.farmZone.crops;
  if (options?.rules?.farmZone?.crops) return options.rules.farmZone.crops;
  if (map?.farmZone?.crops) return map.farmZone.crops;
  if (map?.rules?.farmZone?.crops) return map.rules.farmZone.crops;
  return FARM_CROPS;
}

// --- Deterministic hashing (no Math.random) -------------------------------------------------------------------------

function hash32(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 2146121005);
  h = Math.imul(h ^ (h >>> 15), -2073254261);
  return (h ^ (h >>> 16)) >>> 0;
}

function hashInts(a: number, b: number, c: number, d = 0): number {
  let h = hash32(a ^ -1640531527);
  h = hash32(h ^ Math.imul(b | 0, -2048144789));
  h = hash32(h ^ Math.imul(c | 0, -1028477387));
  return hash32(h ^ Math.imul(d | 0, 668265263));
}

const seedCache = new WeakMap<object, number>();

/** Deterministic seed of a map from its explicit seed or its dimensions and terrain heights */
export function mapSeedOf(map: CropMap, explicitSeed?: number): number {
  if (typeof explicitSeed === "number" && Number.isFinite(explicitSeed)) return explicitSeed | 0;
  if (typeof map.seed === "number" && Number.isFinite(map.seed)) return map.seed | 0;
  if (typeof map.citySeed === "number" && Number.isFinite(map.citySeed)) return map.citySeed | 0;
  const cached = seedCache.get(map);
  if (cached !== undefined) return cached;
  let h = hashInts(map.width, map.height, map.tileSizeM ?? 16);
  const heights = map.heights;
  if (heights && heights.length > 0) {
    const step = Math.max(1, Math.floor(heights.length / 32));
    for (let i = 0; i < heights.length; i += step) h = hash32(h ^ Math.round((heights[i] ?? 0) * 10));
  }
  const seed = h | 0;
  seedCache.set(map, seed);
  return seed;
}

// --- Soil measurement and scoring (docs/GAME_DESIGN.md 7.6 point 3) -------------------------------------------------

const isWater = (v: number): boolean => v >= WATER_LOW && v <= WATER_HIGH;

interface LandSummary {
  minHeight: number;
}
const landCache = new WeakMap<object, { heightsRef: ArrayLike<number> | null | undefined; summary: LandSummary }>();

function landSummaryOf(map: CropMap): LandSummary {
  const heights = map.heights;
  const kept = landCache.get(map);
  if (kept && kept.heightsRef === heights) return kept.summary;
  let minHeight = Infinity;
  if (heights && heights.length > 0) {
    const step = Math.max(1, Math.floor(heights.length / 4096));
    for (let i = 0; i < heights.length; i += step) {
      const h = heights[i];
      if (typeof h === "number" && h < minHeight) minHeight = h;
    }
  }
  if (!Number.isFinite(minHeight)) minHeight = 0;
  const summary = { minHeight };
  landCache.set(map, { heightsRef: heights, summary });
  return summary;
}

const waterCache = new WeakMap<object, Map<number, { waterDist: number; waterIdx: number }>>();

/** Measures the soil at tile (x, y): height above water, local slope, natural groundwater, distance to water and to the town centre */
export function soilAt(map: CropMap, x: number, y: number, groundShare?: number): SoilSample {
  const width = map.width, height = map.height;
  const tx = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const idx = ty * width + tx;

  let byTile = waterCache.get(map);
  let waterInfo = byTile?.get(idx);
  if (!waterInfo) {
    const raw = (map as { rawCells?(): ArrayLike<number> }).rawCells?.() ?? null;
    const canals = map.canals;
    const naturalWaterAt = (cx: number, cy: number): boolean => {
      const i = cy * width + cx;
      if (canals && canals[i]) return false;
      const v = raw !== null ? raw[i] & BIT_MASK : map.getTileValue(cx, cy) & BIT_MASK;
      return isWater(v);
    };
    let waterDist = 32, waterIdx = -1;
    const maxR = 24;
    for (let r = 0; r <= maxR && waterIdx < 0; r++) {
      if (r === 0) {
        if (naturalWaterAt(tx, ty)) { waterDist = 0; waterIdx = idx; }
        continue;
      }
      for (let dy = -r; dy <= r; dy++) {
        const step = dy === -r || dy === r ? 1 : 2 * r;
        const cy = ty + dy;
        if (cy < 0 || cy >= height) continue;
        for (let dx = -r; dx <= r; dx += step) {
          const cx = tx + dx;
          if (cx < 0 || cx >= width) continue;
          const d = Math.hypot(dx, dy);
          if (d < waterDist && naturalWaterAt(cx, cy)) { waterDist = d; waterIdx = cy * width + cx; }
        }
      }
    }
    waterInfo = { waterDist, waterIdx };
    if (!byTile) waterCache.set(map, byTile = new Map());
    byTile.set(idx, waterInfo);
  }

  const { waterDist, waterIdx } = waterInfo;
  // Town distance measured from the ruler's house or the town centre (gameMap.town), never from buildings added month to month
  const centre = map.rulerHouse ?? map.town;
  const cx = centre && typeof centre.x === "number" ? centre.x : width * 0.5;
  const cy = centre && typeof centre.y === "number" ? centre.y : height * 0.5;
  const townDist = Math.min(32, Math.hypot(tx - cx, ty - cy));

  const heights = map.heights;
  let rise = 2;
  let slope = 0.5;
  if (heights && heights.length > idx) {
    const h = heights[idx] ?? 0;
    const baseH = waterIdx >= 0 ? (heights[waterIdx] ?? h) : landSummaryOf(map).minHeight;
    rise = Math.max(0, h - baseH);
    const hx0 = heights[ty * width + Math.max(0, tx - 1)] ?? h;
    const hx1 = heights[ty * width + Math.min(width - 1, tx + 1)] ?? h;
    const hy0 = heights[Math.max(0, ty - 1) * width + tx] ?? h;
    const hy1 = heights[Math.min(height - 1, ty + 1) * width + tx] ?? h;
    slope = Math.hypot((hx1 - hx0) * 0.5, (hy1 - hy0) * 0.5);
  }

  // Only the land's natural water (ground.natural, or the estimate from water distance and rise), never ground.stores
  let ground = groundShare;
  if (typeof ground !== "number" || !Number.isFinite(ground)) {
    const natural = map.ground?.natural;
    if (natural && natural.length > idx) {
      const level = natural[idx] ?? 1;
      ground = Math.max(0, Math.min(1, level <= 1 && level > 0 && !(natural instanceof Uint8Array) ? level : level / GROUNDWATER_MAX));
    } else {
      const nearWater = Math.max(0, 1 - waterDist / 20);
      const lowBonus = Math.max(0, 1 - rise / 25);
      ground = Math.max(0.12, Math.min(0.95, 0.22 + 0.42 * nearWater + 0.25 * lowBonus));
    }
  }

  return { rise, slope, ground, water: waterDist, town: townDist };
}

function rangeFit(value: number, range: readonly [number, number], scale: number): number {
  const [lo, hi] = range;
  if (value >= lo && value <= hi) return 1;
  const dist = value < lo ? lo - value : value - hi;
  const span = value < lo && lo > 0 ? Math.min(scale, Math.max(0.08, lo * 0.5)) : scale;
  return Math.max(0.02, 1 / (1 + (dist / span) * (dist / span) * 3));
}

/** How well a crop likes the soil there, multiplied by the province's weight for that crop (0 when weight <= 0) */
export function cropScore(spec: FarmCropSpec, soil: SoilSample): number {
  if (spec.weight <= 0) return 0;
  const fRise = rangeFit(soil.rise, spec.rise, 6);
  const fSlope = rangeFit(soil.slope, spec.slope, 1.5);
  const fGround = rangeFit(soil.ground, spec.ground, 0.14);
  const fWater = rangeFit(soil.water, spec.water, 4);
  const fTown = rangeFit(soil.town, spec.town, 6);
  const soilFit = Math.pow(fRise * fSlope * fGround * fWater * fTown, 0.75);
  return spec.weight * soilFit;
}

// --- Family plots along each road/canal line (docs/GAME_DESIGN.md 7.6 point 4) --------------------------------------

function plotSpanAt(seed: number, lineId: number, depthBand: number, slot: number): { plotIndex: number; startSlot: number; widthCells: number } {
  const base = hashInts(seed, lineId, depthBand, 1367130551);
  if (slot >= 0) {
    let start = 0, idx = 0;
    for (;;) {
      const w = PLOT_MIN_CELLS + (hash32(base ^ Math.imul(idx, 374761393)) & 3);
      if (slot < start + w) return { plotIndex: idx, startSlot: start, widthCells: w };
      start += w;
      idx++;
    }
  } else {
    let end = 0, idx = -1;
    for (;;) {
      const w = PLOT_MIN_CELLS + (hash32(base ^ Math.imul(idx, 374761393)) & 3);
      const start = end - w;
      if (slot >= start) return { plotIndex: idx, startSlot: start, widthCells: w };
      end = start;
      idx--;
    }
  }
}

/** The family plot a cell belongs to: 5–8 cells wide along the road or canal, 11 rows deep from it */
export function plotOfCell(map: CropMap, cell: CropCell, explicitSeed?: number): FamilyPlot {
  const seed = mapSeedOf(map, explicitSeed);
  const cellUnits = farmSide(map) > 1 ? TILE_UNITS * FARM_CELL_M / tileMetres(map) : TILE_UNITS;
  if (cell.row < 0 || farmSide(map) <= 1) {
    // Tile-based fallback map: group contiguous tiles into 2 x 2 tile plots
    const tx = Math.max(0, Math.min(map.width - 1, tileOfUnits(cell.x)));
    const ty = Math.max(0, Math.min(map.height - 1, tileOfUnits(cell.z)));
    const px = Math.floor(tx / 2), py = Math.floor(ty / 2);
    return {
      lineId: py,
      plotIndex: px,
      startSlot: px * 2,
      widthCells: 2,
      depthBand: 0,
      tileX: Math.min(map.width - 1, px * 2),
      tileY: Math.min(map.height - 1, py * 2),
    };
  }

  // Project cell back along its outward normal (nx, nz) to the road edge (row = -0.5)
  // Every row 0..32 generated from the same step along the road shares the exact same (ex, ez), angle, and (nx, nz)
  const dEdge = (cell.row + 0.5) * cellUnits;
  const ex = Math.round((cell.x - cell.nx * dEdge) * 1e4) * 1e-4;
  const ez = Math.round((cell.z - cell.nz * dEdge) * 1e4) * 1e-4;

  // Canonical road tangent (tx, tz) so opposite angle conventions on the same line stay aligned
  let tx = Math.sin(cell.angle), tz = Math.cos(cell.angle);
  if (tx < -1e-6 || (Math.abs(tx) <= 1e-6 && tz < 0)) {
    tx = -tx;
    tz = -tz;
  }
  const side = cell.nx * tz - cell.nz * tx >= 0 ? 1 : -1;
  const vPerp = Math.round(((ex * cell.nx + ez * cell.nz) / cellUnits) * 8);
  const angleBucket = Math.round(Math.atan2(tx, tz) * 32);
  const lineId = hashInts(cell.road ?? 0, side, vPerp, angleBucket) | 0;

  // Cell slot along the road line
  const uAlong = (ex * tx + ez * tz) / cellUnits;
  const slot = Math.floor(Math.round(uAlong * 1024) / 1024 + 1e-4);
  const depthBand = Math.floor(cell.row / PLOT_DEPTH_ROWS);
  const { plotIndex, startSlot, widthCells } = plotSpanAt(seed, lineId, depthBand, slot);

  // Representative world point of the plot (identical for all cells in this plot)
  const uMid = (startSlot + 0.5 * widthCells) * cellUnits;
  const vMid = (ex * cell.nx + ez * cell.nz) + (depthBand * PLOT_DEPTH_ROWS + 2.5) * cellUnits;
  const mx = tx * uMid + cell.nx * vMid;
  const mz = tz * uMid + cell.nz * vMid;
  const tileX = Math.max(0, Math.min(map.width - 1, tileOfUnits(mx)));
  const tileY = Math.max(0, Math.min(map.height - 1, tileOfUnits(mz)));

  return { lineId, plotIndex, startSlot, widthCells, depthBand, tileX, tileY };
}

function pickFromScores(candidates: ReadonlyArray<{ id: FarmCropId; score: number }>, hash: number): FarmCropId {
  let total = 0;
  for (const c of candidates) total += c.score;
  if (total <= 0) return candidates[0].id;
  const pick = ((hash >>> 0) / 4294967296) * total;
  let acc = 0;
  for (const c of candidates) {
    acc += c.score;
    if (pick < acc) return c.id;
  }
  return candidates[candidates.length - 1].id;
}

/**
 * The crop grown on a family plot for a given field kind, from its soil and the province's crop table.
 * Neighbouring plots along a line usually alternate crops while sometimes matching, and a weight-0 crop is never picked.
 */
export function cropOfPlot(map: CropMap, plot: FamilyPlot, kind: FarmKind, options?: CropOptions): FarmCropId {
  const table = resolveCropTable(map, options);
  const soil = soilAt(map, plot.tileX, plot.tileY, options?.groundShare);
  const baseCandidates: Array<{ id: FarmCropId; score: number }> = [];
  let fallback: FarmCropId | null = null;
  for (const id of FARM_CROP_IDS) {
    const spec = table[id] ?? FARM_CROPS[id];
    if (spec.kind !== kind) continue;
    if (!fallback) fallback = id;
    const score = cropScore(spec, soil);
    if (score > 0) baseCandidates.push({ id, score });
  }
  if (baseCandidates.length === 0) return fallback ?? "jasmine_rice";
  if (baseCandidates.length === 1) return baseCandidates[0].id;

  const seed = mapSeedOf(map, options?.seed);
  // Step along a small window of up to 4 preceding plots so neighbouring plots along a line rarely repeat
  const windowStart = plot.plotIndex - Math.min(4, Math.abs(plot.plotIndex));
  let prev: FarmCropId | null = null;
  for (let p = windowStart; p <= plot.plotIndex; p++) {
    const h = hashInts(seed, plot.lineId, p, plot.depthBand * 31 + FARM_CROP_IDS.indexOf(baseCandidates[0].id));
    const adjusted = prev
      ? baseCandidates.map((c) => ({ id: c.id, score: c.id === prev ? c.score * 0.25 : c.score }))
      : baseCandidates;
    prev = pickFromScores(adjusted, h);
  }
  return prev ?? baseCandidates[0].id;
}

/** The crop of a grown field cell (src/farmGrid.ts Cell), deterministic from map seed, plot place, soil and rules */
export function fieldCropOfCell(map: CropMap, cell: CropCell, kind: FarmKind, options?: CropOptions): FarmCropId {
  const plot = plotOfCell(map, cell, options?.seed);
  return cropOfPlot(map, plot, kind, options);
}

/**
 * The crop of a grown field at tile (x, y), for the inspector card and hover tooltip (src/inspect.ts):
 * uses the first painted road-aligned farm cell on that tile when present, or the tile's own plot otherwise.
 */
export function fieldCropAt(map: CropMap, x: number, y: number, kind: FarmKind, options?: CropOptions): FarmCropId;
export function fieldCropAt(map: CropMap, x: number, y: number, kind?: FarmKind | null, options?: CropOptions): FarmCropId | null;
export function fieldCropAt(map: CropMap, x: number, y: number, kind?: FarmKind | null, options?: CropOptions): FarmCropId | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  let resolvedKind = kind ?? null;
  if (!resolvedKind) {
    const value = map.getTileValue(x, y) & BIT_MASK;
    if (!isFieldValue(value) || fieldLevelOf(value) <= 0) return null;
    resolvedKind = fieldKindAt(map as FieldMap, x, y);
  }
  if (!resolvedKind) return null;
  if (farmSide(map) > 1) {
    const grid = map as unknown as FarmGridMap;
    const cells: Cell[] = farmCellsOnTiles(grid, x, y, x, y);
    const painted = cells.find((c) => cellPainted(grid, c)) ?? cells[0];
    if (painted) return fieldCropOfCell(map, painted, resolvedKind, options);
  }
  const tileCell: CropCell = { x: (x + 0.5) * TILE_UNITS, z: (y + 0.5) * TILE_UNITS, angle: 0, nx: 0, nz: 1, row: -1, road: 0 };
  return fieldCropOfCell(map, tileCell, resolvedKind, options);
}
