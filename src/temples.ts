/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Temples (วัด, docs/GAME_DESIGN.md 9; owner, 21 Oct 2026: "ที่ไหนมีชุมชน ก็จะมีวัด"). A neighbourhood of homes with no
// temple within walking reach builds its own, as Thai villages do: once 400 people live in it for three months, a
// temple goes up beside a road at its heart (or its edge, when the heart is full), facing the road, as a construction
// site for six months; then it grows a level as its community grows. A temple is the community's, never the ruler's:
// the ruler cannot build, bulldoze or move one (CityCommands, templeProblem). It cheers the people it serves (the era
// score's living side), holds Songkran, Loy Krathong and Yi Peng, and keeps its centre out of fire.
//
// A temple stands on the civic 3 x 3 (tiles 414-422, gameMap.civicKinds[centre] = "temple") and is kept in
// gameMap.buildings like the ruler's buildings, turned to a slanted road with its turned outline's tiles
// (src/buildings/turnedFootprint.ts). Its level and the community gathering for the next are gameMap.temples (saved as
// `temples`). The core's monthly "temples" system runs it (src/core/cityCore.ts). Plain code: no DOM, nothing random.

import { blockOf, PlacedBuildings } from "./buildings/placedBuildings.js";
import { familyValue, isTurned, outlineOf, outlineTiles, outsideBy, type Outline, RAIL_REACH_M, turnedTilesOf }
  from "./buildings/turnedFootprint.js";
import { TIME_PER_MONTH } from "./construction.js";
import { ownsLand } from "./landBlocks.js";
import { isOpenLand, plotOf } from "./plots.js";
import { Residential } from "./residential.js";
import { roadReach } from "./roadGeometry.js";
import { isRoadTile } from "./roadLevels.js";
import type { RoadGraph } from "./roads/roadGraph.js";
import { BURNBIT, CONDBIT, ZONEBIT } from "./tileFlags.js";
import { CIVIC, COMBASE, LASTRAIL, RAILBASE, RESBASE } from "./tileValues.js";
import { TILE_UNITS, tileMetres, unitsPerMetre } from "./units.js";
import { RASTER_M } from "./zoneCells.js";

/** What gameMap.civicKinds says of a temple's centre, and the name its building is kept by in gameMap.buildings */
export const TEMPLE_KIND = "temple";
/** Why a tool may not touch a temple's ground */
export const TEMPLE_IN_THE_WAY = "the temple's ground is in the way";

/** How far a temple serves, as the half side of a square round it (metres): the area of a circle of about 800 m,
 * as far as people walk to their temple */
export const TEMPLE_REACH_M = 700;
/** The people in homes with no temple within reach that make a community build one */
export const FOUND_PEOPLE = 400;
/** The months the community gathers before it builds, and the months it builds */
export const GATHER_MONTHS = 3;
export const BUILD_MONTHS = 6;
/** The people within reach a temple needs for each level (1 to 3) */
export const LEVEL_PEOPLE: readonly number[] = [0, FOUND_PEOPLE, 1500, 4000];
export const TOP_LEVEL = 3;
/** The months between one level and the next: the people make merit and build a hall at a time */
export const GROW_MONTHS = 24;
/** The cheer a temple gives the people it serves, by its level (points of 100), and at most all temples together */
export const CHEER_BY_LEVEL: readonly number[] = [0, 2, 3, 4];
export const MAX_TEMPLE_CHEER = 4;
/** The great Buddhist days, months 0-11 (Makha Bucha, Visakha Bucha, Khao Phansa, Ok Phansa): a little more cheer */
export const HOLY_MONTHS: readonly number[] = [1, 4, 6, 9];
export const HOLY_CHEER = 1;
/** The people a home plot holds a level (census resPop to people, src/evaluation.js) */
export const PEOPLE_A_LEVEL = 20;
/** The festivals held at the temple when the city has one (src/festivals.ts venueOf) */
export const TEMPLE_FESTIVALS: ReadonlySet<string> = new Set(["songkran", "loy_krathong", "yi_peng"]);

/** A temple: its centre tile (index), level 1-3 and the month (city time / 4) it was founded or last grew */
export interface Temple {
  tile: number;
  level: number;
  since: number;
}

/** The temples of a city, as gameMap.temples keeps them */
export interface TempleState {
  temples: Temple[];
  /** Months a community with no temple has gathered for one (0 none) */
  gathering: number;
  /** The month last run, so it never runs twice a month */
  at: number;
  /** The cheer this month (points of 100) and the share of home people a temple serves, for the era score and the card */
  cheer: number;
  served: number;
}

export function newTempleState(): TempleState {
  return { temples: [], gathering: 0, at: -1, cheer: 0, served: 0 };
}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const num = (v: unknown, fallback = 0): number => typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** A save's temples (writeTemples) */
export function readTemples(saved: unknown): TempleState {
  const state = newTempleState();
  if (!saved || typeof saved !== "object") return state;
  const s = saved as Record<string, unknown>;
  if (Array.isArray(s.temples)) {
    for (const t of s.temples) {
      if (!Array.isArray(t) || !isInt(t[0]) || !isInt(t[1])) continue;
      state.temples.push({ tile: t[0], level: Math.max(1, Math.min(TOP_LEVEL, t[1])), since: isInt(t[2]) ? t[2] : 0 });
    }
  }
  state.gathering = Math.max(0, Math.floor(num(s.gathering)));
  state.at = isInt(s.at) ? s.at : -1;
  state.cheer = num(s.cheer);
  state.served = num(s.served);
  return state;
}

/** The temples as a save keeps them, or undefined for none */
export function writeTemples(state: TempleState | null | undefined): Record<string, unknown> | undefined {
  if (!state || !state.temples.length && !state.gathering) return undefined;
  return { temples: state.temples.map((t) => [t.tile, t.level, t.since]), gathering: state.gathering || undefined, at: state.at,
    cheer: Math.round(state.cheer * 1000) / 1000 || undefined, served: Math.round(state.served * 1000) / 1000 || undefined };
}

/** What of the map the temples read and write (src/gameMap.js, typed loosely) */
export interface TempleMap {
  readonly width: number;
  readonly height: number;
  tileSizeM?: number | null;
  paintedZones?: boolean;
  insideProvince?: Uint8Array | null;
  landBlocks?: Uint8Array | null;
  civicKinds?: Record<string, string> | null;
  buildings?: PlacedBuildings | null;
  sites?: Record<string, { tool: string; ready: number }> | null;
  zoneCells?: Map<number, number> | null;
  roadGraph?: RoadGraph | null;
  railGraph?: RoadGraph | null;
  temples?: TempleState | null;
  town?: { x: number; y: number } | null;
  rulerHouse?: { x: number; y: number } | null;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  getTile(x: number, y: number): { isZone(): boolean };
  setTile(x: number, y: number, value: number, flags: number): void;
}

export function templesOf(map: { temples?: TempleState | null }): TempleState {
  return map.temples ??= newTempleState();
}

/** Whether the civic centre at tile index i is a temple */
export const isTempleAt = (map: { civicKinds?: Record<string, string> | null }, i: number): boolean =>
  map.civicKinds?.[i] === TEMPLE_KIND;

/** Whether a temple stands on its centre (its tiles may be a site still) */
function stands(map: TempleMap, t: Temple): boolean {
  const x = t.tile % map.width, y = Math.floor(t.tile / map.width);
  return x >= 0 && y >= 0 && x < map.width && y < map.height && map.getTileValue(x, y) === CIVIC &&
    map.getTile(x, y).isZone() && isTempleAt(map, t.tile);
}

/** Whether a temple is still being built */
export const isBuilding = (map: TempleMap, t: Temple): boolean => !!map.sites?.[String(t.tile)];

/** The temples standing and built (not sites) */
export function workingTemples(map: TempleMap): Temple[] {
  return templesOf(map).temples.filter((t) => stands(map, t) && !isBuilding(map, t));
}

/** A temple's tiles: its turned outline's, or its square block's */
export function templeTiles(map: TempleMap, centre: number): number[] {
  const turned = turnedTilesOf(map as never, centre, CIVIC);
  if (turned) return turned;
  const cx = centre % map.width, cy = Math.floor(centre / map.width), out: number[] = [];
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) out.push(y * map.width + x);
  }
  return out;
}

/** The temple whose ground holds tile (x, y), or null */
export function templeAt(map: TempleMap, x: number, y: number): Temple | null {
  const state = map.temples;
  if (!state || !state.temples.length) return null;
  const i = y * map.width + x;
  for (const t of state.temples) {
    const tx = t.tile % map.width, ty = Math.floor(t.tile / map.width);
    if (Math.abs(tx - x) > 3 || Math.abs(ty - y) > 3 || !stands(map, t)) continue;
    if (templeTiles(map, t.tile).includes(i)) return t;
  }
  return null;
}

/** Why a tool of `size` tiles at (x, y) may not be used: it would touch a temple's ground (TEMPLE_IN_THE_WAY), or
 * null. `tiles` are a turned building's own tiles in place of the square block. */
export function templeProblem(map: TempleMap | null | undefined, x: number, y: number, size = 1,
  tiles?: ReadonlyArray<{ x: number; y: number }> | null): string | null {
  if (!map || !map.temples?.temples.length) return null;
  const corner = size > 1 ? 1 : 0;
  const cover = tiles ?? Array.from({ length: size * size }, (_, k) => ({ x: x - corner + k % size, y: y - corner + Math.floor(k / size) }));
  for (const c of cover) if (c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && templeAt(map, c.x, c.y)) return TEMPLE_IN_THE_WAY;
  return null;
}

// --- The people and their communities ------------------------------------------------------------------------------

/** The people living on tile (x, y): a home plot's level, or a home zone's people, by PEOPLE_A_LEVEL */
export function homePeople(map: TempleMap, x: number, y: number): number {
  const value = map.getTileValue(x, y);
  if (map.paintedZones) {
    const plot = plotOf(map as never, x, y);
    if (plot) return plot.kind === "residential" ? plot.level * PEOPLE_A_LEVEL : 0;
  }
  if (value >= RESBASE && value < COMBASE && map.getTileFlags(x, y) & ZONEBIT) {
    return (Residential as unknown as { getZonePopulation(m: unknown, x: number, y: number, v: number): number })
      .getZonePopulation(map, x, y, value) * PEOPLE_A_LEVEL;
  }
  return 0;
}

/** Every tile's people in homes */
export function peopleGrid(map: TempleMap): Float32Array {
  const grid = new Float32Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const p = homePeople(map, x, y);
    if (p) grid[y * map.width + x] = p;
  }
  return grid;
}

/** A temple's reach in tiles (half side of its square) on this map */
export const reachTiles = (map: { tileSizeM?: number | null }): number => Math.max(1, Math.round(TEMPLE_REACH_M / tileMetres(map)));

/** Sums over squares of a grid, each in constant time */
class Sums {
  private readonly s: Float64Array;
  constructor(private readonly w: number, private readonly h: number, grid: ArrayLike<number>) {
    const s = this.s = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += grid[y * w + x];
        s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
      }
    }
  }
  /** The sum over tiles within r (each way) of (x, y) */
  around(x: number, y: number, r: number): number {
    const w1 = this.w + 1, x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(this.w, x + r + 1), y1 = Math.min(this.h, y + r + 1);
    if (x1 <= x0 || y1 <= y0) return 0;
    const s = this.s;
    return s[y1 * w1 + x1] - s[y0 * w1 + x1] - s[y1 * w1 + x0] + s[y0 * w1 + x0];
  }
}

/** Whether tile (x, y) lies within a temple's reach */
const within = (map: TempleMap, t: Temple, x: number, y: number, r: number): boolean =>
  Math.abs(t.tile % map.width - x) <= r && Math.abs(Math.floor(t.tile / map.width) - y) <= r;

/** The community most in want of a temple: the most people no temple serves within a temple's reach of one tile, and
 * their heart (where their middle lies) */
export function neediest(map: TempleMap, people: Float32Array, temples: readonly Temple[]): { x: number; y: number; people: number; unserved: Float32Array } {
  const r = reachTiles(map), unserved = people.slice();
  for (const t of temples) {
    const tx = t.tile % map.width, ty = Math.floor(t.tile / map.width);
    for (let y = Math.max(0, ty - r); y <= Math.min(map.height - 1, ty + r); y++) {
      unserved.fill(0, y * map.width + Math.max(0, tx - r), y * map.width + Math.min(map.width - 1, tx + r) + 1);
    }
  }
  const sums = new Sums(map.width, map.height, unserved);
  let best = { x: -1, y: -1, people: 0 };
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!unserved[y * map.width + x]) continue;
    const n = sums.around(x, y, r);
    if (n > best.people) best = { x, y, people: n };
  }
  // ... its heart: where its people's middle lies, within that reach
  if (best.people > 0) {
    let sx = 0, sy = 0, sum = 0;
    for (let y = Math.max(0, best.y - r); y <= Math.min(map.height - 1, best.y + r); y++) {
      for (let x = Math.max(0, best.x - r); x <= Math.min(map.width - 1, best.x + r); x++) {
        const p = unserved[y * map.width + x];
        sx += p * x; sy += p * y; sum += p;
      }
    }
    best = { x: Math.round(sx / sum), y: Math.round(sy / sum), people: best.people };
  }
  return { ...best, unserved };
}

// --- Where a temple goes -------------------------------------------------------------------------------------------

/** A place for a temple: its centre tile, its middle in metres and turn (null: its square block, not turned), its
 * tiles, and the people it would serve */
export interface TempleSpot {
  cx: number;
  cy: number;
  x: number;
  z: number;
  rot: number | null;
  tiles: number[];
  serves: number;
}

/** The tiles painted with zone cells (src/zoneCells.ts), which a temple leaves to the plots they make */
function paintedTiles(map: TempleMap): Set<number> {
  const out = new Set<number>();
  if (!map.zoneCells?.size) return out;
  const r = RASTER_M * unitsPerMetre(tileMetres(map)), width = Math.ceil(map.width * TILE_UNITS / r);
  for (const key of map.zoneCells.keys()) {
    const rx = key % width, rz = Math.floor(key / width);
    out.add(Math.floor((rz + 0.5) * r / TILE_UNITS) * map.width + Math.floor((rx + 0.5) * r / TILE_UNITS));
  }
  return out;
}

const isRail = (value: number): boolean => value >= RAILBASE && value <= LASTRAIL;

/** Whether a temple may take tile i: the city's own bare land (woods and rubble cleared), in the province, no zone
 * cells painted on it, nothing built */
function freeTile(map: TempleMap, i: number, painted: ReadonlySet<number>): boolean {
  const x = i % map.width, y = Math.floor(i / map.width);
  if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
  if (map.insideProvince && map.insideProvince[i] !== 1) return false;
  if (!ownsLand(map as never, x, y) || painted.has(i) || map.sites?.[String(i)]) return false;
  const value = map.getTileValue(x, y);
  return isOpenLand(value) && !(map.getTileFlags(x, y) & ZONEBIT);
}

/** Whether a road or railway drawn in metres comes inside the outline (only those near it are looked at) */
function lineInside(map: TempleMap, o: Outline): boolean {
  const units = unitsPerMetre(tileMetres(map));
  for (const [graph, rail] of [[map.roadGraph, false], [map.railGraph, true]] as const) {
    if (!graph) continue;
    for (const id of graph.segmentsNear([o.x, o.z], o.half * Math.SQRT2 + 30)) {
      const reach = rail ? RAIL_REACH_M : roadReach(graph.segment(id).level, units) / units;
      const pts = graph.polyline(id, 2);
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
        for (let s = 0; s <= n; s++) if (outsideBy(o, ax + (bx - ax) * s / n, az + (bz - az) * s / n) < reach) return true;
      }
    }
  }
  return false;
}

/** Whether a road tile lies beside one of these tiles */
function besideRoadTile(map: TempleMap, tiles: readonly number[]): boolean {
  const road = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && isRoadTile(map.getTileValue(x, y));
  return tiles.some((i) => {
    const x = i % map.width, y = Math.floor(i / map.width);
    return road(x - 1, y) || road(x + 1, y) || road(x, y - 1) || road(x, y + 1);
  });
}

/** The square block round centre (cx, cy) */
function blockTiles(map: TempleMap, cx: number, cy: number): number[] {
  const out: number[] = [];
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) out.push(y * map.width + x);
  return out;
}

/**
 * The places round (hx, hy) (within half a temple's reach) where a temple may stand, facing its road: along the
 * roads drawn in metres when the map has them (turned to a slanted road, on its turned outline's tiles), else on
 * square blocks beside a road tile. Each with the people no temple serves it would serve (`unserved`).
 */
export function templeSpots(map: TempleMap, hx: number, hy: number, unserved: Float32Array): TempleSpot[] {
  const metres = tileMetres(map), r = reachTiles(map), near = Math.max(2, Math.floor(r / 2));
  const sums = new Sums(map.width, map.height, unserved), painted = paintedTiles(map);
  const spots = new Map<string, TempleSpot>();
  const free = (tiles: readonly number[]): boolean => tiles.every((i) => freeTile(map, i, painted));
  const add = (spot: Omit<TempleSpot, "serves">): void => {
    const key = `${spot.cx},${spot.cy},${spot.rot === null ? "-" : spot.rot.toFixed(2)}`;
    if (!spots.has(key)) spots.set(key, { ...spot, serves: sums.around(spot.cx, spot.cy, r) });
  };
  const graph = map.roadGraph;
  if (graph && graph.segments.size) {
    const units = unitsPerMetre(metres), half = 1.5 * metres;
    const hxm = (hx + 0.5) * metres, hzm = (hy + 0.5) * metres;
    for (const id of graph.segmentsNear([hxm, hzm], (near + 3) * metres)) {
      const level = graph.segment(id).level, reach = roadReach(level, units) / units;
      const pts = graph.polyline(id, 2);
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k], length = Math.hypot(bx - ax, bz - az);
        if (length < 1e-6) continue;
        const tx = (bx - ax) / length, tz = (bz - az) / length;
        for (let along = 0; along <= length; along += 4) {
          const rx = ax + tx * along, rz = az + tz * along;
          for (const side of [1, -1]) {
            const nx = -tz * side, nz = tx * side, rot = Math.round(Math.atan2(-nx, -nz) * 1000) / 1000;
            const turned = isTurned(rot);
            // the outline's front a metre off the road's edge; a square block stood back a metre at a time until it
            // takes no road tile and stands beside one
            for (let back = 0; back <= (turned ? 0 : 16); back += 2) {
              const gap = reach + 1 + half + back, x = rx + nx * gap, z = rz + nz * gap;
              const b = blockOf(x, z, 3, metres);
              if (Math.abs(b.cx - hx) > near || Math.abs(b.cy - hy) > near) break;
              if (b.cx < 1 || b.cy < 1 || b.cx >= map.width - 1 || b.cy >= map.height - 1) break;
              if (turned) {
                const o = outlineOf(x, z, rot, 3, metres);
                if (lineInside(map, o)) break;
                const tiles = outlineTiles(o, map.width, map.height, metres).filter((i) => {
                  const v = map.getTileValue(i % map.width, Math.floor(i / map.width));
                  return i === b.cy * map.width + b.cx || !isRoadTile(v) && !isRail(v);
                });
                if (free(tiles)) add({ cx: b.cx, cy: b.cy, x, z, rot, tiles });
                break;
              }
              const tiles = blockTiles(map, b.cx, b.cy);
              if (tiles.some((i) => isRoadTile(map.getTileValue(i % map.width, Math.floor(i / map.width))))) continue;
              if (free(tiles) && besideRoadTile(map, tiles)) {
                add({ cx: b.cx, cy: b.cy, x, z, rot, tiles });
                break;
              }
            }
          }
        }
      }
    }
  } else {
    for (let cy = Math.max(1, hy - near); cy <= Math.min(map.height - 2, hy + near); cy++) {
      for (let cx = Math.max(1, hx - near); cx <= Math.min(map.width - 2, hx + near); cx++) {
        const tiles = blockTiles(map, cx, cy);
        if (free(tiles) && besideRoadTile(map, tiles)) add({ cx, cy, x: (cx + 0.5) * metres, z: (cy + 0.5) * metres, rot: null, tiles });
      }
    }
  }
  return [...spots.values()];
}

/** The best of the spots: the one serving the most people, then the nearest the community's heart, then the first */
export function bestSpot(spots: readonly TempleSpot[], hx: number, hy: number, width: number): TempleSpot | null {
  let best: TempleSpot | null = null;
  const d = (s: TempleSpot): number => Math.hypot(s.cx - hx, s.cy - hy);
  for (const s of spots) {
    if (!best || s.serves > best.serves + 1e-6 ||
      Math.abs(s.serves - best.serves) <= 1e-6 && (d(s) < d(best) - 1e-6 ||
        Math.abs(d(s) - d(best)) <= 1e-6 && s.cy * width + s.cx < best.cy * width + best.cx)) best = s;
  }
  return best;
}

/**
 * Lays a temple on a spot: its centre with the zone bit, its other tiles in the civic family (CIVIC's, as the
 * building tool lays them, src/buildingTool.js), conducting but never its centre burning (fire reaches its edge,
 * which is mended, and never takes the temple: CLAUDE.md rule 8); kept in gameMap.buildings where it was put, a
 * construction site for BUILD_MONTHS
 */
export function layTemple(map: TempleMap, spot: TempleSpot, now: number): Temple {
  const centre = spot.cy * map.width + spot.cx;
  for (const i of spot.tiles) {
    const x = i % map.width, y = Math.floor(i / map.width);
    if (i === centre) map.setTile(x, y, CIVIC, CONDBIT | ZONEBIT);
    else map.setTile(x, y, familyValue(CIVIC, 3, x - spot.cx, y - spot.cy), CONDBIT | BURNBIT);
  }
  (map.civicKinds ??= {})[centre] = TEMPLE_KIND;
  const placed = map.buildings ??= new PlacedBuildings();
  const old = placed.atTile(centre);
  if (old) placed.remove(old.id);
  placed.add({ tool: TEMPLE_KIND, size: 3, tile: centre, x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100,
    rot: spot.rot });
  (map.sites ??= {})[String(centre)] = { tool: TEMPLE_KIND, ready: now + BUILD_MONTHS * TIME_PER_MONTH };
  const temple = { tile: centre, level: 1, since: Math.floor(now / TIME_PER_MONTH) };
  templesOf(map).temples.push(temple);
  return temple;
}

// --- The month ------------------------------------------------------------------------------------------------------

/** What the temples did this month, for the news */
export type TempleNews =
  | { type: "templeFounded"; x: number; y: number }
  | { type: "templeGrew"; x: number; y: number; level: number };

/** The people each temple serves, and the share of all home people some temple serves */
export function servedBy(map: TempleMap, people: Float32Array, temples: readonly Temple[]): { each: number[]; share: number; total: number } {
  const r = reachTiles(map), each = temples.map(() => 0);
  let total = 0, served = 0;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    if (!p) continue;
    total += p;
    const x = i % map.width, y = Math.floor(i / map.width);
    let any = false;
    temples.forEach((t, k) => { if (within(map, t, x, y, r)) { each[k] += p; any = true; } });
    if (any) served += p;
  }
  return { each, share: total > 0 ? served / total : 0, total };
}

/**
 * A month of the temples (the core's "temples" system), at its turn: temples gone are forgotten; each grows a level when
 * its people reach the next and its last change is GROW_MONTHS behind; the cheer of the people they serve; and a
 * community with no temple gathers, then builds one. Never twice a month. `month` is 0-11.
 */
export function templeMonth(map: TempleMap, now: number, month: number): TempleNews[] {
  const state = templesOf(map), monthIndex = Math.floor(now / TIME_PER_MONTH);
  if (state.at === monthIndex) return [];
  state.at = monthIndex;
  const news: TempleNews[] = [];
  state.temples = state.temples.filter((t) => stands(map, t));
  const people = peopleGrid(map);
  const working = state.temples.filter((t) => !isBuilding(map, t));
  // Each grows with its people
  const served = servedBy(map, people, working);
  working.forEach((t, k) => {
    if (t.level < TOP_LEVEL && served.each[k] >= LEVEL_PEOPLE[t.level + 1] && monthIndex - t.since >= GROW_MONTHS) {
      t.level++;
      t.since = monthIndex;
      news.push({ type: "templeGrew", x: t.tile % map.width, y: Math.floor(t.tile / map.width), level: t.level });
    }
  });
  // The cheer: each home's best temple, and the great Buddhist days
  state.served = served.share;
  state.cheer = templeCheerOf(map, people, working, served.total, HOLY_MONTHS.includes(month));
  // A community with no temple: it gathers while it holds enough people, and builds when it has gathered (one at a time)
  const need = neediest(map, people, state.temples);
  if (need.people < FOUND_PEOPLE) {
    state.gathering = 0;
    return news;
  }
  if (state.temples.some((t) => isBuilding(map, t))) return news;
  state.gathering++;
  if (state.gathering < GATHER_MONTHS) return news;
  const spot = bestSpot(templeSpots(map, need.x, need.y, need.unserved), need.x, need.y, map.width);
  if (!spot) return news;
  layTemple(map, spot, now);
  state.gathering = 0;
  news.push({ type: "templeFounded", x: spot.cx, y: spot.cy });
  return news;
}

/** The cheer the temples give (points of 100): each home's people by its best temple's level, over all home people,
 * at most MAX_TEMPLE_CHEER, and on a great Buddhist day HOLY_CHEER more for those a temple serves */
function templeCheerOf(map: TempleMap, people: Float32Array, temples: readonly Temple[], total: number, holy: boolean): number {
  if (!temples.length || total <= 0) return 0;
  const r = reachTiles(map);
  let sum = 0, served = 0;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    if (!p) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    let level = 0;
    for (const t of temples) if (t.level > level && within(map, t, x, y, r)) level = t.level;
    if (level) { sum += p * CHEER_BY_LEVEL[level]; served += p; }
  }
  return Math.min(MAX_TEMPLE_CHEER, sum / total) + (holy ? HOLY_CHEER * served / total : 0);
}

/** The cheer the temples give the people this month (points of 100), for the era score's living side */
export function templeCheer(map: { temples?: TempleState | null }): number {
  return map.temples?.cheer ?? 0;
}

/** The temple a festival is held at: the city's biggest, nearest the ruler's house (else the town), or null when
 * the festival is not a temple's or the city has none */
export function festivalTemple(map: TempleMap, festival: string): { x: number; y: number } | null {
  if (!TEMPLE_FESTIVALS.has(festival)) return null;
  const temples = workingTemples(map);
  if (!temples.length) return null;
  const centre = map.rulerHouse ?? map.town ?? { x: map.width / 2, y: map.height / 2 };
  const d = (t: Temple): number => Math.hypot(t.tile % map.width - centre.x, Math.floor(t.tile / map.width) - centre.y);
  const best = temples.reduce((a, b) => b.level > a.level || b.level === a.level && (d(b) < d(a) || d(b) === d(a) && b.tile < a.tile) ? b : a);
  return { x: best.tile % map.width, y: Math.floor(best.tile / map.width) };
}

/** A temple's level at its centre tile (index), 0 when none stands there */
export function templeLevel(map: { temples?: TempleState | null }, tile: number): number {
  return map.temples?.temples.find((t) => t.tile === tile)?.level ?? 0;
}
