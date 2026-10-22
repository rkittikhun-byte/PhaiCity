/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Pollution and noise as sources in metres that drift with the wind (docs/NO_GRID_PLAN.md 4.1). On a real-scale city
// map micropolisJS summed each 2 x 2 block's tiles' pollution and smoothed the sums twice with its neighbours, so the
// smoke of a factory filled square blocks 32 m a side, reached about 64 m whichever way, and stopped at a block's edge.
// Here every polluting tile is a source at its middle, and the pollution at a point is the sum of each source's plume
// there: a smooth bump falling to nothing POLLUTION_REACH_M from its middle, as far as the old smoothing reached, the
// same in all (the old passes' height a block from its source and their sum over the map kept), its middle carried
// downwind by the month's wind (src/wind.ts) and drawn out along it. What the old readers read is the pollution at each
// block's middle (gameMap's pollution block map), so nothing else changes how it reads it.
//
// Only + - x / and rounding to whole numbers decide it, the wind rounded to 1/256, so every JS engine makes the same
// city (docs/NO_GRID_PLAN.md 4.2). Plain code, no DOM.

/** How far a source's plume reaches from its middle (metres): the old two smoothing passes' reach, two 32 m blocks */
export const POLLUTION_REACH_M = 64;
/** A plume's height at its middle, a share of its source's pollution (the old passes left about a third) */
export const POLLUTION_PEAK = 0.33;
/** How far a gale carries a plume's middle downwind (metres); a breeze a share of that */
export const DRIFT_M = 32;
/** How much longer than wide a gale draws a plume out along the wind */
export const STRETCH = 0.6;

/** The month's wind as the field takes it: where it blows towards (x east, y south) and how hard, 0-1 */
export interface FieldWind { x: number; y: number; strength: number }

/** A wind rounded to 1/256, so the plumes are the same on every machine */
export function roundedWind(wind: FieldWind | null | undefined): FieldWind {
  if (!wind) return { x: 0, y: 0, strength: 0 };
  const r = (v: number): number => Math.round(v * 256) / 256;
  return { x: r(wind.x), y: r(wind.y), strength: Math.max(0, Math.min(1, r(wind.strength))) };
}

/**
 * The pollution at the middle of every block of `blockSize` tiles of a map `width` x `height` tiles of `tileSizeM`
 * metres, 0-255, from the sources: each a tile's index and its pollution. Blocks in rows, `blocksWide` a row.
 */
export function pollutionField(width: number, height: number, tileSizeM: number, blockSize: number,
  sources: ReadonlyArray<readonly [number, number]>, wind: FieldWind | null | undefined): Uint8Array {
  const blocksWide = Math.ceil(width / blockSize), blocksHigh = Math.ceil(height / blockSize);
  const sum = new Float64Array(blocksWide * blocksHigh);
  const w = roundedWind(wind), block = blockSize * tileSizeM, reach = POLLUTION_REACH_M, reach2 = reach * reach;
  const drift = DRIFT_M * w.strength, stretch = 1 + STRETCH * w.strength;
  // (drawn out along the wind, it is lower in the same measure: the same pollution in all)
  const peak = POLLUTION_PEAK / stretch, along = reach * stretch;
  const span = Math.ceil((along + drift) / block) + 1;
  for (const [tile, strength] of sources) {
    if (strength <= 0) continue;
    const tx = tile % width, ty = (tile - tx) / width;
    // The plume's middle, the source's tile's middle carried downwind
    const cx = (tx + 0.5) * tileSizeM + w.x * drift, cz = (ty + 0.5) * tileSizeM + w.y * drift;
    const bx = Math.floor(cx / block), bz = Math.floor(cz / block);
    for (let j = Math.max(0, bz - span); j <= Math.min(blocksHigh - 1, bz + span); j++) {
      for (let i = Math.max(0, bx - span); i <= Math.min(blocksWide - 1, bx + span); i++) {
        // the block's middle from the plume's middle, along the wind and across it
        const dx = (i + 0.5) * block - cx, dz = (j + 0.5) * block - cz;
        const u = (dx * w.x + dz * w.y) / stretch, v = dx * -w.y + dz * w.x;
        const d2 = w.strength > 0 ? u * u + v * v : dx * dx + dz * dz;
        if (d2 >= reach2) continue;
        const fall = 1 - d2 / reach2;
        sum[j * blocksWide + i] += strength * peak * fall * fall;
      }
    }
  }
  const out = new Uint8Array(sum.length);
  for (let k = 0; k < sum.length; k++) out[k] = Math.min(255, Math.floor(sum[k]));
  return out;
}

// --- Open land round a block (docs/NO_GRID_PLAN.md 4.2) ---------------------------------------------------------------

/** The half-sides of the squares the open land round a block is counted in (metres): near, middling and far */
export const OPEN_LAND_REACH_M: readonly number[] = [32, 64, 96];
/** What land wholly open round a block adds to its value: micropolisJS's 15 a tile of a 4 x 4 block */
export const OPEN_LAND_FULL = 240;

/**
 * How much the open land round each block of `blockSize` tiles adds to its land value (0-240): the share of open tiles
 * in squares of each half-side in OPEN_LAND_REACH_M round the block's middle, averaged, so it falls off smoothly with
 * distance and has no edge where micropolisJS's 64 m blocks of open land ended. Counted with an integral image of the
 * open tiles: a few look-ups a block. Blocks in rows, as the block maps keep them.
 */
export function openLandField(map: { readonly width: number; readonly height: number; readonly tileSizeM?: number | null;
  getTileValue(x: number, y: number): number }, blockSize: number, isOpen: (value: number, x: number, y: number) => boolean): Uint8Array {
  const { width, height } = map, tile = map.tileSizeM || 16;
  // the count of open tiles above and left of each corner
  const sums = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      if (isOpen(map.getTileValue(x, y), x, y)) row++;
      sums[(y + 1) * (width + 1) + x + 1] = sums[y * (width + 1) + x + 1] + row;
    }
  }
  const count = (x0: number, y0: number, x1: number, y1: number): number => {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(width, x1); y1 = Math.min(height, y1);
    if (x1 <= x0 || y1 <= y0) return 0;
    return sums[y1 * (width + 1) + x1] - sums[y0 * (width + 1) + x1] - sums[y1 * (width + 1) + x0] + sums[y0 * (width + 1) + x0];
  };
  const blocksWide = Math.ceil(width / blockSize), blocksHigh = Math.ceil(height / blockSize);
  const out = new Uint8Array(blocksWide * blocksHigh);
  const halves = OPEN_LAND_REACH_M.map((m) => Math.max(1, Math.round(m / tile)));
  for (let j = 0; j < blocksHigh; j++) for (let i = 0; i < blocksWide; i++) {
    // the block's middle, on the corner between its tiles (a block of 2 tiles) or a tile's middle
    const mx = i * blockSize + blockSize / 2, my = j * blockSize + blockSize / 2;
    let share = 0;
    for (const h of halves) {
      const x0 = Math.round(mx - h), y0 = Math.round(my - h), x1 = Math.round(mx + h), y1 = Math.round(my + h);
      // (a square cut by the map's edge counts what lies on the map)
      const area = (Math.min(width, x1) - Math.max(0, x0)) * (Math.min(height, y1) - Math.max(0, y0));
      share += area > 0 ? count(x0, y0, x1, y1) / area : 0;
    }
    out[j * blocksWide + i] = Math.min(OPEN_LAND_FULL, Math.floor(OPEN_LAND_FULL * share / halves.length));
  }
  return out;
}
