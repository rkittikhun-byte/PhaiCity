/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone (โซนเกษตร, owner 21 Oct 2026, docs/GAME_DESIGN.md section 7: "เอาเลย เพราะประเทศไทยเป็นครัวของโลก"): a
// fourth zone, painted a 16 m tile at a time on a real-scale city map, where rice paddies, crop fields, orchards and fish
// ponds spread round the village as in the concept art. A painted tile need not touch a road: it needs a way to one
// within reach (FarmZoneSpec.reach), over open land and other fields, as a cart track or the dikes between paddies.
//
// The tile value says the field's level (FIELD_BASE + 0–5, 0 painted and empty), so undo, saves, the bulldozer and fire
// need nothing new; the kind the game grows there, chosen by the land when the field first grows (pickKind: height,
// distance to water, the ground's water), is kept beside the tiles (map.farmKinds). The city's fields are found by the
// map scanner each cycle (FarmFields.found) and grow by water, their way to a road, the town's and the market's want of
// food, and the era; each month they sell their crop, give work, draw the groundwater, seep chemicals, burn their stubble
// and muddy the water (FarmFields.month). Every number is the province's rules' (src/provinceRules.ts FarmZoneSpec).
// Plain code, no DOM, nothing random but the simulation's Random.

import { drivewayAt, isOpenLand, type PlotMap } from "./plots";
import { NO_BURNING_YIELD } from "./policies";
import { FARM_KINDS, FARM_ZONE, type FarmKind, type FarmZoneSpec } from "./provinceRules";
import { Random } from "./random";
import { BULLBIT, BURNBIT } from "./tileFlags";
import { FIELD_BASE, FIELD_LAST, WATER_HIGH, WATER_LOW } from "./tileValues";

export { FARM_KINDS };
export type { FarmKind };

/** What stands among the fields in each era, one for so many grown fields (src/render3d/city/farmFields.ts draws them;
 * the era card lists the next era's, docs/GAME_DESIGN.md 7.2): buffalo and field huts in the farming village, granaries
 * in the market town, tractors and greenhouses, harvesters, and at last a smart farm's drones and solar panels */
export const FARM_ERA_LOOKS: Readonly<Record<number, ReadonlyArray<readonly [FarmLook, number]>>> = {
  1: [["buffalo", 9], ["hut", 23]],
  2: [["granary", 17], ["buffalo", 19], ["hut", 37]],
  3: [["tractor", 13], ["greenhouse", 21], ["granary", 41]],
  4: [["harvester", 11], ["greenhouse", 17]],
  5: [["drone", 7], ["solar", 9], ["greenhouse", 29]],
};
export type FarmLook = "buffalo" | "hut" | "granary" | "tractor" | "greenhouse" | "harvester" | "drone" | "solar";

/** The looks an era brings to the fields that the era before did not have */
export function newFarmLooks(era: number): FarmLook[] {
  const before = new Set((FARM_ERA_LOOKS[era - 1] ?? []).map(([look]) => look));
  return (FARM_ERA_LOOKS[era] ?? []).map(([look]) => look).filter((look) => !before.has(look));
}

/** The brush that paints the farm zone and the one that rubs it out (src/farmTool.ts) */
export const FARM_PAINT_TOOL = "zone_farm";
export const FARM_ERASE_TOOL = "farm_erase";
/** The highest level of a field */
export const FIELD_TOP = 5;
/** A field's flags: the bulldozer clears it, fire burns it */
export const FIELD_FLAGS = BULLBIT | BURNBIT;
/** The most tiles one fill paints */
export const MAX_FARM_FILL = 4000;
/** February to April, 0-based: when paddies and cane fields burn their stubble (as src/farming.ts BURNING_MONTHS) */
export const FIELD_BURNING_MONTHS: readonly number[] = [1, 2, 3];

export const isFieldValue = (value: number): boolean => value >= FIELD_BASE && value <= FIELD_LAST;
/** The tile a field of this level shows */
export const fieldTile = (level: number): number => FIELD_BASE + Math.max(0, Math.min(FIELD_TOP, Math.round(level)));
/** A field's level from its tile, or -1 for a tile that is no field */
export const fieldLevelOf = (value: number): number => (isFieldValue(value) ? value - FIELD_BASE : -1);
/** The kind kept in map.farmKinds (1-4; 0 none chosen yet) */
export const kindCode = (kind: FarmKind): number => FARM_KINDS.indexOf(kind) + 1;
export const kindOfCode = (code: number): FarmKind | null => FARM_KINDS[code - 1] ?? null;

const isWater = (value: number): boolean => value >= WATER_LOW && value <= WATER_HIGH;

/** A map that may have farm fields */
export interface FieldMap extends PlotMap {
  /** Ground height a tile, metres (the province's map) */
  heights?: ArrayLike<number> | null;
  /** The kind of each field (kindCode), kept beside the tiles and saved */
  farmKinds?: Uint8Array | null;
  /** The city's era, 1-5 (src/era.ts) */
  era?: number;
  /** Whether its zones are painted a cell at a time (a real-scale city map, src/zoneCells.ts), and its tiles' size */
  cellZones?: boolean;
  tileSizeM?: number | null;
  /** The cells of each field painted (fieldCells), kept beside the tiles and saved; 0 where every cell is */
  farmCells?: Uint16Array | null;
}

// --- The painted shape of the fields (docs/NO_GRID_PLAN.md 3C) ---------------------------------------------------------
// On a real-scale city map the farm brush paints cells about 4 m a side, as the zones' cells are (src/zoneCells.ts
// CELL_M), not whole 16 m tiles (owner, 21 Oct 2026: "นาเป็นสี่เหลี่ยม 16 ม." was the grid he saw): the fields are the
// shape the brush went, and their dikes run along it (src/render3d/city/farmFields.ts). A field's level and kind stay
// the tile's, so the simulation, saves, undo, fire and the bulldozer keep their tiles; a tile is a field while any of
// its cells is painted, and it counts as much as is painted of it (fieldShare). Elsewhere, and where a tool paints a
// whole tile (the fill, the auto player), every cell of the tile is the field.

/** About how many metres a side a field's cell is */
export const FARM_CELL_M = 4;

/** How many cells a side a tile of this map has: 4 on a 16 m city map; 1, a whole tile, where the zones are not
 * painted a cell at a time */
export function farmSide(map: { cellZones?: boolean; tileSizeM?: number | null }): number {
  if (!map.cellZones) return 1;
  return Math.max(1, Math.min(4, Math.round((map.tileSizeM || 16) / FARM_CELL_M)));
}

/** Every cell of a tile `side` cells a side, as bits row by row from its top left */
export const fullCells = (side: number): number => (side >= 4 ? 0xffff : (1 << (side * side)) - 1);

/** How many cells a mask holds */
export function cellCount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** The painted cells of the field on tile i: its kept mask, or every cell where it keeps none (a whole tile painted) */
export function fieldCells(map: FieldMap, i: number): number {
  const full = fullCells(farmSide(map)), mask = (map.farmCells?.[i] ?? 0) & full;
  return mask || full;
}

/** How much of tile i its field covers, 0-1: what it counts as (its crop, its work, the food it gives) */
export function fieldShare(map: FieldMap, i: number): number {
  const side = farmSide(map);
  return side <= 1 ? 1 : cellCount(fieldCells(map, i)) / (side * side);
}

/** A farm cell's key, its tile and its bit (row * side + column): as the farmCells command names them */
export const farmCellKey = (tile: number, bit: number): number => tile * 16 + bit;
export const farmCellTile = (key: number): number => Math.floor(key / 16);
export const farmCellBit = (key: number): number => key % 16;

/**
 * The cells whose middles lie within `radius` metres of the stretch from `from` to `to` (metres; a point when from is
 * null), on the map: their keys. What the farm brush paints where the mouse went.
 */
export function farmCellsNear(map: FieldMap, from: readonly [number, number] | null, to: readonly [number, number],
                              radius: number): number[] {
  const side = farmSide(map), metres = map.tileSizeM || 16, cell = metres / side, a = from ?? to, out: number[] = [];
  const x0 = Math.min(a[0], to[0]) - radius, x1 = Math.max(a[0], to[0]) + radius;
  const z0 = Math.min(a[1], to[1]) - radius, z1 = Math.max(a[1], to[1]) + radius;
  const dx = to[0] - a[0], dz = to[1] - a[1], length2 = dx * dx + dz * dz;
  for (let cz = Math.max(0, Math.floor(z0 / cell)); cz <= Math.min(map.height * side - 1, Math.floor(z1 / cell)); cz++) {
    for (let cx = Math.max(0, Math.floor(x0 / cell)); cx <= Math.min(map.width * side - 1, Math.floor(x1 / cell)); cx++) {
      const px = (cx + 0.5) * cell, pz = (cz + 0.5) * cell;
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / length2)) : 0;
      if (Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t) > radius) continue;
      const tx = Math.floor(cx / side), ty = Math.floor(cz / side);
      out.push(farmCellKey(ty * map.width + tx, (cz - ty * side) * side + (cx - tx * side)));
    }
  }
  return out;
}

/** The cells whose middles lie inside the rectangle between two corners (metres): what a dragged rectangle paints */
export function farmCellsInRect(map: FieldMap, a: readonly [number, number], b: readonly [number, number]): number[] {
  const side = farmSide(map), metres = map.tileSizeM || 16, cell = metres / side, out: number[] = [];
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
  for (let cz = Math.max(0, Math.ceil(z0 / cell - 0.5)); cz <= Math.min(map.height * side - 1, Math.floor(z1 / cell - 0.5)); cz++) {
    for (let cx = Math.max(0, Math.ceil(x0 / cell - 0.5)); cx <= Math.min(map.width * side - 1, Math.floor(x1 / cell - 0.5)); cx++) {
      const tx = Math.floor(cx / side), ty = Math.floor(cz / side);
      out.push(farmCellKey(ty * map.width + tx, (cz - ty * side) * side + (cx - tx * side)));
    }
  }
  return out;
}

/** The fields' painted cells as a save keeps them: by tile, only where a field covers part of its tile, or null */
export function farmCellsKept(map: FieldMap): Record<string, number> | null {
  const cells = map.farmCells;
  if (!cells || cells.length !== map.width * map.height) return null;
  const full = fullCells(farmSide(map)), kept: Record<string, number> = {};
  let any = false;
  for (let i = 0; i < cells.length; i++) {
    const mask = cells[i] & full;
    if (!mask || mask === full || !isFieldValue(map.getTileValue(i % map.width, Math.floor(i / map.width)))) continue;
    kept[i] = mask;
    any = true;
  }
  return any ? kept : null;
}

/** The fields' painted cells from a save (farmCellsKept), on a map width x height; null when it keeps none */
export function readFarmCells(saved: unknown, width: number, height: number): Uint16Array | null {
  if (!saved || typeof saved !== "object") return null;
  const cells = new Uint16Array(width * height);
  let any = false;
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= cells.length || !Number.isInteger(value)) continue;
    cells[i] = (value as number) & 0xffff;
    any = true;
  }
  return any ? cells : null;
}

const inside = (map: { width: number; height: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < map.width && y < map.height;

/** Land a cart track crosses on its way to a road: open land and fields */
const passable = (value: number): boolean => isOpenLand(value) || isFieldValue(value);

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

// --- The cart tracks (ทางเกวียน) a field needs to a road ---------------------------------------------------------------
// On a real-scale city map the way is measured in metres, as the crow flies from tile to tile across open land and
// fields, diagonally too (a track never squeezes between two blocked tiles' corners): a field may lie as far as the
// province's reach (FarmZoneSpec.reach tiles of 16 m, 128 m) from the road its track meets, round about it, not in the
// diamond of tile steps the way once was (docs/NO_GRID_PLAN.md 3C). Elsewhere it is tile steps, as before. Either way
// the answer is in tiles' worth (1 beside a road), which what reads it keeps.

/** Whether a map measures its fields' ways in metres */
const waysInMetres = (map: PlotMap & { cellZones?: boolean }): boolean => map.cellZones === true;

const DIAGONALS = [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const;

/**
 * The way to a road over open land and fields in metres from every tile whose way the search starts at, as far as
 * `limit` metres: a search out from `starts` (their map indices and metres), each step a tile across (tileSizeM) or a
 * diagonal (that x √2) where both tiles beside it are open, only open land and fields leading on; within the window of
 * tiles x0..x0+w-1, y0..y0+h-1 (the whole map unless given). Metres by the window's own index (y - y0) * w + (x - x0),
 * Infinity where it does not reach.
 */
function metreWays(map: PlotMap, starts: ReadonlyArray<[number, number]>, limit: number, startsLead = false,
                   x0 = 0, y0 = 0, w = map.width, h = map.height): Float64Array {
  const width = map.width, tile = map.tileSizeM || 16, diagonal = tile * Math.SQRT2;
  const dist = new Float64Array(w * h).fill(Infinity), open = new Uint8Array(w * h);
  const local = (x: number, y: number): number => (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h ? -1 : (y - y0) * w + (x - x0));
  const isOpen = (x: number, y: number): boolean => {
    const k = local(x, y);
    if (k < 0) return false;
    if (!open[k]) open[k] = passable(map.getTileValue(x, y)) ? 2 : 1;
    return open[k] === 2;
  };
  // (startsLead: the starts lead on whatever stands there, as the tile a field is asked for does)
  if (startsLead) for (const [i] of starts) { const k = local(i % width, Math.floor(i / width)); if (k >= 0) open[k] = 2; }
  // A binary heap of [metres, window index]
  const heapD: number[] = [], heapK: number[] = [];
  const push = (d: number, k: number): void => {
    let n = heapD.length;
    heapD.push(d); heapK.push(k);
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (heapD[parent] <= d) break;
      heapD[n] = heapD[parent]; heapK[n] = heapK[parent]; n = parent;
    }
    heapD[n] = d; heapK[n] = k;
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heapD[0], heapK[0]], d = heapD.pop()!, k = heapK.pop()!;
    if (heapD.length) {
      let n = 0;
      for (;;) {
        const a = 2 * n + 1, b = a + 1;
        let m = n, md = d;
        if (a < heapD.length && heapD[a] < md) { m = a; md = heapD[a]; }
        if (b < heapD.length && heapD[b] < md) { m = b; md = heapD[b]; }
        if (m === n) break;
        heapD[n] = heapD[m]; heapK[n] = heapK[m]; n = m;
      }
      heapD[n] = d; heapK[n] = k;
    }
    return top;
  };
  for (const [i, d] of starts) {
    const k = local(i % width, Math.floor(i / width));
    if (k >= 0 && d < dist[k]) { dist[k] = d; push(d, k); }
  }
  const step = (nx: number, ny: number, nd: number): void => {
    const j = local(nx, ny);
    if (j < 0 || nd > limit + 1e-6 || nd >= dist[j] || drivewayAt(map, nx, ny)) return;
    dist[j] = nd;
    push(nd, j);
  };
  while (heapD.length) {
    const [d, k] = pop();
    const x = x0 + (k % w), y = y0 + Math.floor(k / w);
    if (d > dist[k] || !isOpen(x, y)) continue;
    for (const [dx, dy] of SIDES) step(x + dx, y + dy, d + tile);
    // (between two open tiles only, never through a corner of something in the way)
    for (const [dx, dy] of DIAGONALS) if (isOpen(x + dx, y) && isOpen(x, y + dy)) step(x + dx, y + dy, d + diagonal);
  }
  return dist;
}

/** Tiles' worth of a way of `metres` (1 beside a road), for what reads a way in tiles */
const waySteps = (metres: number, tile: number): number => Math.max(1, Math.min(255, Math.ceil(metres / tile - 1e-6)));

/**
 * How far (x, y) is from a road along a way over open land and fields, in tiles (1 beside a road), or -1 when no road
 * lies within reach that way. Motorways and tollways give no way in (src/plots.ts drivewayAt).
 */
export function wayToRoad(map: PlotMap, x: number, y: number, reach: number): number {
  if (!inside(map, x, y)) return -1;
  if (waysInMetres(map)) {
    // (from the tile out, the way's metres the same as wayField's from the roads in)
    const tile = map.tileSizeM || 16, limit = reach * tile;
    const x0 = Math.max(0, x - reach), y0 = Math.max(0, y - reach);
    const w = Math.min(map.width - 1, x + reach) - x0 + 1, h = Math.min(map.height - 1, y + reach) - y0 + 1;
    const dist = metreWays(map, [[y * map.width + x, 0]], limit, true, x0, y0, w, h);
    let best = Infinity;
    for (let ty = y0; ty < y0 + h; ty++) {
      for (let tx = x0; tx < x0 + w; tx++) {
        const d = dist[(ty - y0) * w + (tx - x0)];
        if (d === Infinity || d + tile > limit + 1e-6) continue;
        if ((tx === x && ty === y || passable(map.getTileValue(tx, ty))) &&
            SIDES.some(([dx, dy]) => drivewayAt(map, tx + dx, ty + dy))) best = Math.min(best, d + tile);
      }
    }
    return best === Infinity ? -1 : waySteps(best, tile);
  }
  const span = 2 * reach + 1, seen = new Uint8Array(span * span);
  const at = (tx: number, ty: number): number => (ty - y + reach) * span + (tx - x + reach);
  let frontier: Array<[number, number]> = [[x, y]];
  seen[at(x, y)] = 1;
  for (let d = 1; d <= reach && frontier.length; d++) {
    const next: Array<[number, number]> = [];
    for (const [cx, cy] of frontier) {
      for (const [dx, dy] of SIDES) {
        const nx = cx + dx, ny = cy + dy;
        if (!inside(map, nx, ny) || Math.abs(nx - x) > reach || Math.abs(ny - y) > reach) continue;
        if (drivewayAt(map, nx, ny)) return d;
        const k = at(nx, ny);
        if (seen[k]) continue;
        seen[k] = 1;
        if (passable(map.getTileValue(nx, ny))) next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return -1;
}

/**
 * Every tile's way to a road as wayToRoad finds it, at once for the whole map (0 where there is none within reach): a
 * search out from all the roads over open land and fields. What the month's fields and a fill read.
 */
export function wayField(map: PlotMap, reach: number): Uint8Array {
  const { width, height } = map, out = new Uint8Array(width * height);
  if (waysInMetres(map)) {
    // Every tile beside a road has its way, a tile's width from the road; open land and fields lead on, in metres
    const tile = map.tileSizeM || 16, starts: Array<[number, number]> = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (drivewayAt(map, x, y)) continue;
      if (SIDES.some(([dx, dy]) => drivewayAt(map, x + dx, y + dy))) starts.push([y * width + x, tile]);
    }
    const dist = metreWays(map, starts, reach * tile);
    for (let i = 0; i < dist.length; i++) if (dist[i] !== Infinity) out[i] = waySteps(dist[i], tile);
    return out;
  }
  let frontier: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!drivewayAt(map, x, y)) continue;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (!inside(map, nx, ny)) continue;
      const i = ny * width + nx;
      if (out[i] || drivewayAt(map, nx, ny)) continue;
      out[i] = 1;
      // Any tile beside a road has its way, but only open land and fields lead further
      if (passable(map.getTileValue(nx, ny))) frontier.push(i);
    }
  }
  for (let d = 2; d <= reach && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width, y = (i - x) / width;
      for (const [dx, dy] of SIDES) {
        const nx = x + dx, ny = y + dy;
        if (!inside(map, nx, ny)) continue;
        const j = ny * width + nx;
        if (out[j] || drivewayAt(map, nx, ny)) continue;
        out[j] = d;
        if (passable(map.getTileValue(nx, ny))) next.push(j);
      }
    }
    frontier = next;
  }
  return out;
}

/** What painting the farm zone at (x, y) would do: "paint", "same" (a field already), or why it cannot. */
export type FieldOutcome = "paint" | "same" | "not_land" | "no_way" | "no_zones";

export function fieldOutcome(map: PlotMap, x: number, y: number, reach: number = FARM_ZONE.reach): FieldOutcome {
  if (!map.paintedZones || !inside(map, x, y)) return "no_zones";
  const value = map.getTileValue(x, y);
  if (isFieldValue(value)) return "same";
  if (!isOpenLand(value)) return "not_land";
  return wayToRoad(map, x, y, reach) > 0 ? "paint" : "no_way";
}

/**
 * The tiles one fill of the farm brush reaches from (x, y): every tile joined to it, side by side, of the same ground
 * (open land, or fields for the eraser), each with its way to a road; so it stops at roads, buildings and the zones.
 */
export function fieldFillRegion(map: PlotMap, x: number, y: number, erase: boolean, reach: number = FARM_ZONE.reach,
                                limit = MAX_FARM_FILL): Array<{ x: number; y: number }> {
  if (!map.paintedZones || !inside(map, x, y)) return [];
  const like = (value: number): boolean => (erase ? isFieldValue(value) : isOpenLand(value));
  if (!like(map.getTileValue(x, y))) return [];
  const ways = erase ? null : wayField(map, reach);
  const ok = (i: number): boolean => ways === null || ways[i] > 0;
  if (!ok(y * map.width + x)) return [];
  const seen = new Uint8Array(map.width * map.height), found: Array<{ x: number; y: number }> = [];
  const queue: Array<[number, number]> = [[x, y]];
  seen[y * map.width + x] = 1;
  for (let head = 0; head < queue.length && found.length < limit; head++) {
    const [cx, cy] = queue[head];
    found.push({ x: cx, y: cy });
    for (const [dx, dy] of SIDES) {
      const nx = cx + dx, ny = cy + dy, i = ny * map.width + nx;
      if (!inside(map, nx, ny) || seen[i]) continue;
      seen[i] = 1;
      if (like(map.getTileValue(nx, ny)) && ok(i)) queue.push([nx, ny]);
    }
  }
  return found;
}

// --- The land's own choice of field -----------------------------------------------------------------------------------

/** The nearest water to (x, y) within radius tiles (a ring at a time), as its distance and its tile, or null */
function nearestWater(map: FieldMap, x: number, y: number, radius: number): { distance: number; index: number } | null {
  for (let r = 1; r <= radius; r++) {
    let best: { distance: number; index: number } | null = null;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (!inside(map, tx, ty) || !isWater(map.getTileValue(tx, ty))) continue;
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) best = { distance, index: ty * map.width + tx };
    }
    if (best) return best;
  }
  return null;
}

/**
 * The kind of field the land at (x, y) grows (docs/GAME_DESIGN.md 7.1): a fish pond beside the water, a rice paddy on
 * low land near it or wherever the ground is wet, an orchard on good ground that is not low, and a crop field (cane,
 * cassava, maize) on the uplands where the ground holds little water. groundShare: the ground's water there, 0–1.
 */
export function pickKind(map: FieldMap, x: number, y: number, spec: FarmZoneSpec, groundShare: number): FarmKind {
  const reach = Math.max(spec.pondReach, spec.paddyReach);
  const water = reach > 0 ? nearestWater(map, x, y, reach) : null;
  if (water && water.distance <= spec.pondReach + 0.5) return "pond";
  const heights = map.heights;
  const rise = water ? (heights ? (heights[y * map.width + x] ?? 0) - (heights[water.index] ?? 0) : 0) : Infinity;
  if (water && water.distance <= spec.paddyReach && rise <= spec.paddyRise) return "paddy";
  if (groundShare >= spec.paddyGround) return "paddy";
  if (groundShare >= spec.orchardGround) return "orchard";
  return "field";
}

/** The kind of the field at (x, y): the one kept, else what the land would grow */
export function fieldKindAt(map: FieldMap, x: number, y: number): FarmKind | null {
  return kindOfCode(map.farmKinds?.[y * map.width + x] ?? 0);
}

// --- The simulation, as the fields see it -------------------------------------------------------------------------

interface CensusLike {
  /** Work in the fields: jobs for the valves and the era score, not counted as people (src/census.js) */
  farmPop?: number;
}

export interface FieldScanMap extends FieldMap {
  setTile(x: number, y: number, value: number, flags: number): void;
}

/** The ground the water manager keeps (src/waterManager.ts): its stores and each tile's natural level */
export interface Ground {
  stores: Uint8Array;
  natural: Uint8Array;
}

export interface FieldsMonth {
  /** Baht the fields sold this month, and what their visitors spent */
  income: number;
  agroIncome: number;
  visitors: number;
  /** Fields burning their stubble this month, and grown fields of each kind */
  burning: number;
  levels: number;
  counts: Record<FarmKind, number>;
}

/** Each grown field, as this cycle's scan found it, and how much of its tile it covers (fieldShare) */
interface Found {
  index: number;
  level: number;
  kind: FarmKind;
  share?: number;
}

const UNITS_FULL = 7 * 32;

/** A city's farm zone: the fields this cycle's scan found, and their effects on the land this month. */
export class FarmFields {
  spec: FarmZoneSpec = FARM_ZONE;
  /** The province's farmland, 0–5 (src/geo/provinceResources.ts) */
  farmland = 2;
  /** The ruler's policy against field burning (src/policies.ts) */
  noBurning = false;
  /** The ground the water manager keeps, set before each month; null before a city has ground */
  ground: Ground | null = null;
  /** The fields found this cycle (level 1 and up), and the painted tiles still empty */
  found: Found[] = [];
  empty = 0;
  /** The levels the town and the market would take more of, set each month: what lets fields grow */
  room = 0;
  /** Each tile's way to a road (wayField), worked out each month; null before the first */
  ways: Uint8Array | null = null;
  /** Haze from burning stubble and mud in the water, and land value near the fields, this month */
  haze: Uint8Array;
  mud: Uint8Array;
  landValue: Uint8Array;
  /** The tiles a cooperative, rice mill or cold store reaches (the 3 × 3 farm buildings), this month */
  hubs: Uint8Array;
  /** The last month's sums, for the status and the auto player */
  last: FieldsMonth = emptyMonth();

  constructor(readonly width: number, readonly height: number) {
    this.haze = new Uint8Array(width * height);
    this.mud = new Uint8Array(width * height);
    this.landValue = new Uint8Array(width * height);
    this.hubs = new Uint8Array(width * height);
  }

  /** Work in the fields the last whole scan found (census units), which the era score reads after the census is cleared */
  jobs = 0;
  private jobsCycle = 0;

  clearCycle(): void {
    this.found = [];
    this.empty = 0;
    this.jobs = this.jobsCycle;
    this.jobsCycle = 0;
  }

  /** The ground's water at a tile, 0–1 of the fullest a store can be (0.5 before a city has ground) */
  groundShare(i: number): number {
    return this.ground ? Math.min(1, this.ground.stores[i] / UNITS_FULL) : 0.5;
  }

  /** The highest level a field reaches in the city's era */
  topLevel(era: number | undefined): number {
    const e = Math.max(1, Math.min(5, Math.round(era ?? 1)));
    return Math.min(FIELD_TOP, this.spec.eraTop[e - 1] ?? FIELD_TOP);
  }

  /**
   * The map scanner found a field at (x, y) (src/mapScanner.js): it is counted, gives its work, and now and then
   * grows a level, as a zone grows a size, when it has its way to a road, water enough, the town or the market wants
   * more food, and the era allows; with no way to a road it goes back a level.
   */
  fieldFound(map: FieldScanMap, x: number, y: number, census: CensusLike): void {
    const i = y * map.width + x, level = fieldLevelOf(map.getTileValue(x, y));
    if (level < 0) return;
    const kinds = map.farmKinds ?? (map.farmKinds = new Uint8Array(map.width * map.height));
    let kind = kindOfCode(kinds[i]);
    if (level > 0 && !kind) kinds[i] = kindCode(kind = pickKind(map, x, y, this.spec, this.groundShare(i)));
    if (level > 0 && kind) {
      // (a field painted over part of its tile works and gives as much as it covers: docs/NO_GRID_PLAN.md 3C)
      const share = fieldShare(map, i), jobs = level * this.spec.kinds[kind].jobs * share;
      census.farmPop = (census.farmPop ?? 0) + jobs;
      this.jobsCycle += jobs;
      this.found.push({ index: i, level, kind, share });
    } else {
      this.empty++;
    }
    // About one look in eight, as a zone is looked at (src/plots.ts)
    if (!Random.getChance(7)) return;
    const way = this.ways ? this.ways[i] : wayToRoad(map, x, y, this.spec.reach);
    if (way <= 0) {
      if (level > 0) map.setTile(x, y, fieldTile(level - 1), FIELD_FLAGS);
      return;
    }
    const grown = kind ?? pickKind(map, x, y, this.spec, this.groundShare(i));
    if (this.room > 0 && level < this.topLevel(map.era) && this.watered(map, x, y, i, grown, level)) {
      if (level === 0) kinds[i] = kindCode(grown);
      map.setTile(x, y, fieldTile(level + 1), FIELD_FLAGS);
      this.room--;
    } else if (this.room < -this.spec.feeds && level > 0) {
      // Far more food than anyone takes: a field is let go a level
      map.setTile(x, y, fieldTile(level - 1), FIELD_FLAGS);
      this.room++;
    }
  }

  /** Whether a field has water enough to grow from this level: a pond its water beside it, past level 2 the ground's */
  private watered(map: FieldMap, x: number, y: number, i: number, kind: FarmKind, level: number): boolean {
    if (kind === "pond" && !nearestWater(map, x, y, Math.max(1, this.spec.pondReach))) return false;
    return level < 2 || this.groundShare(i) >= this.spec.kinds[kind].ground;
  }

  /**
   * A month of the fields. month: 0 January; dry: whether it is the dry season; people: the town's people; farms: the
   * 3 × 3 farm buildings (cooperatives, rice mills, cold stores) and poison: the mines' poisoned ground.
   */
  month(map: FieldMap, month: number, dry: boolean, people: number, farms: ReadonlyArray<{ x: number; y: number }>,
        poison: Uint8Array | null): FieldsMonth {
    const spec = this.spec, width = this.width, height = this.height, result = emptyMonth();
    this.haze.fill(0);
    this.mud.fill(0);
    this.landValue.fill(0);
    this.hubs.fill(0);
    for (const farm of farms) {
      for (let dy = -spec.hubReach; dy <= spec.hubReach; dy++) for (let dx = -spec.hubReach; dx <= spec.hubReach; dx++) {
        const tx = farm.x + dx, ty = farm.y + dy;
        if (inside(this, tx, ty)) this.hubs[ty * width + tx] = 1;
      }
    }
    const provinceFactor = 0.6 + 0.2 * Math.max(0, Math.min(5, this.farmland));
    const burnMonth = FIELD_BURNING_MONTHS.includes(month);
    for (const field of this.found) {
      const kind = spec.kinds[field.kind], level = field.level, i = field.index, covers = field.share ?? 1;
      const x = i % width, y = (i - x) / width;
      result.levels += level * covers;
      result.counts[field.kind]++;
      const share = this.groundShare(i);
      let sale = kind.sale * level * covers * provinceFactor * (0.5 + 0.5 * share) * (dry ? spec.dryYield : 1);
      if (kind.burns && this.noBurning) sale *= NO_BURNING_YIELD;
      if (this.hubs[i]) sale *= 1 + spec.hubBonus;
      result.income += sale;
      // The groundwater it draws, more in the dry season (src/groundwater.ts)
      if (this.ground && kind.draw > 0 && this.ground.natural[i] < 7) {
        const draw = Math.round(kind.draw * level * covers * (dry ? spec.dryDraw : 1));
        this.ground.stores[i] = Math.max(0, this.ground.stores[i] - draw);
      }
      // ... the chemicals that seep into the ground (src/mining.ts, which cleans a little away each month)
      if (poison) poison[i] = Math.min(255, poison[i] + Math.round(kind.chemicals * level * covers));
      // ... the stubble it burns from February to April, unless the ruler forbids it
      if (kind.burns && burnMonth && !this.noBurning) {
        result.burning++;
        stampMax(this.haze, width, height, x, y, spec.haze, 2);
      }
      // ... the mud a pond lets into the water beside it
      if (kind.mud > 0) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const tx = x + dx, ty = y + dy;
          if (!inside(this, tx, ty) || !isWater(map.getTileValue(tx, ty))) continue;
          const j = ty * width + tx;
          this.mud[j] = Math.min(255, this.mud[j] + kind.mud);
        }
      }
      // ... and the countryside it makes round it
      stampMax(this.landValue, width, height, x, y, spec.landValue, 2);
    }
    result.visitors = Math.round(result.levels * spec.visitors);
    result.agroIncome = result.visitors * AGRO_SPEND;
    // How many more levels the town and the market beyond it take: what lets fields grow in the month's scans
    this.room = Math.floor(people / spec.feeds + this.farmland * spec.exportPerLevel - result.levels);
    // ... and each tile's way to a road, for the next month's scans (none to work out with no fields)
    this.ways = this.found.length || this.empty ? wayField(map, spec.reach) : null;
    this.last = result;
    return result;
  }

  /** Where the first field burning its stubble this month is, for the news */
  firstBurning(): { x: number; y: number } | null {
    if (!this.last.burning || !FIELD_BURNING_MONTHS.length) return null;
    const field = this.found.find((f) => this.spec.kinds[f.kind].burns);
    return field ? { x: field.index % this.width, y: Math.floor(field.index / this.width) } : null;
  }

  /** Haze and mud on a tile this month, which the pollution scan adds (src/blockMapUtils.js) */
  pollutionAt(x: number, y: number): number {
    const i = y * this.width + x;
    return this.haze[i] + this.mud[i];
  }

  landValueAt(x: number, y: number): number {
    return this.landValue[y * this.width + x];
  }
}

/** Baht a farm visitor spends (src/tourism.ts SPEND_PER_VISITOR) */
const AGRO_SPEND = 0.1;

function emptyMonth(): FieldsMonth {
  return { income: 0, agroIncome: 0, visitors: 0, burning: 0, levels: 0,
    counts: { paddy: 0, field: 0, orchard: 0, pond: 0 } };
}

/** amount at (x, y), less further out as far as radius, keeping the larger of it and what is there */
function stampMax(layer: Uint8Array, width: number, height: number, x: number, y: number, amount: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const tx = x + dx, ty = y + dy, distance = Math.hypot(dx, dy);
    if (distance > radius || tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    const i = ty * width + tx, value = Math.round(amount * (radius + 1 - distance) / (radius + 1));
    if (value > layer[i]) layer[i] = value;
  }
}

/** The fields' kinds as a save keeps them: only where a field still stands, or null when there is none */
export function farmKindsKept(map: FieldMap): Uint8Array | null {
  const kinds = map.farmKinds;
  if (!kinds || kinds.length !== map.width * map.height) return null;
  const kept = new Uint8Array(kinds.length);
  let any = false;
  for (let i = 0; i < kinds.length; i++) {
    if (!kinds[i] || !isFieldValue(map.getTileValue(i % map.width, Math.floor(i / map.width)))) continue;
    kept[i] = kinds[i];
    any = true;
  }
  return any ? kept : null;
}

// --- The 3 × 3 farm building: the fields' cooperative, rice mill or cold store (docs/GAME_DESIGN.md 7.3) ---------------

/** What a 3 × 3 farm building is, by the fields round it: a rice mill among paddies, a cold store among orchards and
 * ponds, a cooperative among crop fields or with no fields near (as every farm of a city saved before the farm zone) */
export const HUB_KINDS = ["cooperative", "rice_mill", "cold_store"] as const;
export type HubKind = typeof HUB_KINDS[number];
const HUB_OF: Readonly<Record<FarmKind, HubKind>> = { paddy: "rice_mill", field: "cooperative", orchard: "cold_store", pond: "cold_store" };

/** The kind of the 3 × 3 farm building centred on (x, y): the most grown fields' within reach tiles of it */
export function hubKind(map: FieldMap, x: number, y: number, reach: number = FARM_ZONE.hubReach): HubKind {
  const levels: Record<HubKind, number> = { cooperative: 0, rice_mill: 0, cold_store: 0 };
  const kinds = map.farmKinds;
  if (!kinds) return "cooperative";
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const tx = x + dx, ty = y + dy;
    if (!inside(map, tx, ty)) continue;
    const level = fieldLevelOf(map.getTileValue(tx, ty)), kind = kindOfCode(kinds[ty * map.width + tx]);
    if (level > 0 && kind) levels[HUB_OF[kind]] += level;
  }
  let best: HubKind = "cooperative";
  for (const kind of HUB_KINDS) if (levels[kind] > levels[best]) best = kind;
  return best;
}
