/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ground levelled under what stands on it (owner, 23 Oct 2026: "การวาง object ต่างๆ พอวางแล้ว ต้องลบ gis ของช่วงนั้นให้
// ได้ระดับถนน"; docs/GAME_DESIGN.md section 17). A real-scale city map's ground follows the real hills (gameMap.heights),
// and a building's yard and fence once lay tilted on a slope beside its road. Now everything put down or grown on the
// ground stands on a pad: every building of the ruler's (gameMap.buildings: services, the ruler's house, temples, farm
// hubs, stations; its turned outline or its square block) and every grown plot of the list (src/plotBuildings.ts; its
// columns along the road, a plot deep). The pad is flat over its outline and a metre round it, at the height of its
// road where its front meets it (the road point nearest its front edge's middle; with no road within reach, the mean of
// its ground), and round it the ground eases back to the hills over a short slope, longer where the pad lies further
// from the natural ground, so the eye sees a cut or a bank, never a cliff or a step.
//
// Nothing is saved: the pads come from the buildings, the plots and the roads as they are, the same every time, so an
// older save is levelled when it opens and a building bulldozed gives its ground back. The 3D view draws its ground from
// it (src/render3d/city/heightfield.ts), sampled every GRADE_STEPS a tile; the simulation's floods read each tile's
// levelled height (gradedTileHeight, src/sim/disasterLand.ts). Plain code, no DOM: metres from the map's corner, x east,
// z south, heights in whatever the natural ground's sampler gives.

import { laidOutline, outlineCorners, outlineOf, outsideBy, quarterTurn, type FootprintMap, type Outline } from "../buildings/turnedFootprint";
import type { PlacedBuilding } from "../buildings/placedBuildings";
import type { Vec } from "../roads/roadGraph";

/** Samples a tile side the levelled ground is worked out at (on a 16 m tile, every 4 m) */
export const GRADE_STEPS = 4;
/** How far past its outline a pad stays flat (metres): its fence and the pale strip inside it stand on the level */
export const PAD_APRON_M = 1;
/** The slope round a pad, metres across: at least this, ... */
export const SKIRT_MIN_M = 4;
/** ... at most this */
export const SKIRT_MAX_M = 24;
/** How far from its front edge a pad looks for its road (metres) */
export const FRONT_REACH_M = 24;
/** A plot's depth from its road's edge (metres): src/render3d/city/frontage.ts FRONTAGE_DEPTH_M, src/zoneCells.ts
 * PLOT_ROWS cells of CELL_M */
export const PLOT_DEPTH_M = 16;
/** A painted column's width along its road (metres): src/zoneCells.ts CELL_M */
const COLUMN_M = 4;

/** The ground's own height at a point (metres from the map's corner) */
export type NaturalGround = (x: number, z: number) => number;

/** A levelled pad: its outline (metres), its level, how far its slope reaches past its apron (metres), and its bounds
 * with the slope (metres); id names what stands on it, the same each time */
export interface GradePad {
  readonly id: string;
  readonly outline: Outline;
  readonly level: number;
  readonly skirt: number;
  readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number;
}

/** What of the map the pads read */
export interface GradeMap extends FootprintMap {
  getTile?(x: number, y: number): { isZone(): boolean };
  plotBuildings?: {
    all(): { id: number; level: number }[];
    readonly places: ReadonlyMap<number, { cols: number[] }>;
    readonly columns: readonly { x: number; z: number; nx: number; nz: number }[];
    version?: number;
  } | null;
  roadGraph?: { nearest(p: Vec, reach: number): { point: [number, number] } | null; version?: number } | null;
}

/** How steep the slopes round the pads may be: metres across for each unit of height the pad lies off the ground */
export interface GradeOptions { run: number }

/** What stands on the ground before it is levelled: its id and its outline (metres), its front ahead (outline v) */
interface Footing { id: string; outline: Outline }

/** The outlines of what stands on the map: its buildings (those whose centre still stands) and its grown plots */
function footings(map: GradeMap): Footing[] {
  const size = map.tileSizeM || 16, out: Footing[] = [];
  for (const b of map.buildings?.all() ?? []) {
    const x = b.tile % map.width, y = Math.floor(b.tile / map.width);
    if (map.getTile && !map.getTile(x, y).isZone()) continue;
    out.push({ id: `b${b.id}`, outline: buildingFooting(map, b, size) });
  }
  return out.concat(plotFootings(map));
}

/** The outlines of the grown plots of a map's list, from their columns alone */
function plotFootings(map: GradeMap): Footing[] {
  const plots = map.plotBuildings, size = map.tileSizeM || 16, metres = size / 10, out: Footing[] = [];
  if (!plots) return out;
  for (const plot of plots.all()) {
    const place = plots.places.get(plot.id);
    if (plot.level < 1 || !place?.cols.length) continue;
    const cols = place.cols.map((k) => plots.columns[k]).filter(Boolean);
    if (!cols.length) continue;
    const first = cols[0], last = cols[cols.length - 1];
    let nx = 0, nz = 0;
    for (const c of cols) { nx += c.nx; nz += c.nz; }
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    // as the 3D view stands it (tileModels.ts plotGround): from its front row's middles less half a column toward the
    // road, a plot deep, as wide as its columns run
    const width = Math.hypot(last.x - first.x, last.z - first.z) * metres + COLUMN_M;
    const fx = (first.x + last.x) / 2 * metres - nx * COLUMN_M / 2, fz = (first.z + last.z) / 2 * metres - nz * COLUMN_M / 2;
    out.push({ id: `p${plot.id}`, outline: outlineOf(fx + nx * PLOT_DEPTH_M / 2, fz + nz * PLOT_DEPTH_M / 2,
      Math.atan2(-nx, -nz), 1, size, width, PLOT_DEPTH_M) });
  }
  return out;
}

/** A building's outline facing its front (src/render3d/city/compounds.ts compoundSides): its turned outline, else its
 * square block of tiles turned to the quarter turn it faces */
function buildingFooting(map: GradeMap, b: PlacedBuilding, size: number): Outline {
  const turned = laidOutline(map, b);
  if (turned) return turned;
  const corner = b.size > 1 ? 1 : 0, left = (b.tile % map.width - corner) * size, top = (Math.floor(b.tile / map.width) - corner) * size;
  return outlineOf(left + b.size * size / 2, top + b.size * size / 2, b.rot === null ? 0 : quarterTurn(b.rot), b.size, size);
}

/** Points round an outline grown by `grow` metres: its corners and the middles of its sides */
function rim(o: Outline, grow: number): [number, number][] {
  const g = { ...o, hu: o.hu + grow, hv: o.hv + grow }, c = outlineCorners(g);
  return [...c, ...c.map(([x, z], k): [number, number] => [(x + c[(k + 1) % 4][0]) / 2, (z + c[(k + 1) % 4][1]) / 2])];
}

/**
 * The pads of what stands on the map, in id order. `natural` is the ground's own height; `levels` keeps each one's level
 * between calls (a road's nearest point is the slow part), by what it was worked out from.
 */
export function gradePads(map: GradeMap, natural: NaturalGround, options: GradeOptions,
  levels: Map<string, { sign: string; level: number }> = new Map()): GradePad[] {
  const roads = map.roadGraph ?? null, roadsVersion = roads?.version ?? 0, out: GradePad[] = [];
  for (const { id, outline: o } of footings(map)) {
    const sign = `${o.x},${o.z},${o.hu},${o.hv},${o.vx},${o.vz}|${roadsVersion}`;
    let kept = levels.get(id);
    if (!kept || kept.sign !== sign) {
      kept = { sign, level: padLevel(o, natural, roads) };
      levels.set(id, kept);
    }
    const level = kept.level;
    let off = 0;
    for (const [x, z] of rim(o, PAD_APRON_M + SKIRT_MIN_M)) off = Math.max(off, Math.abs(natural(x, z) - level));
    const skirt = Math.max(SKIRT_MIN_M, Math.min(SKIRT_MAX_M, off * options.run));
    const reach = o.half * Math.SQRT2 + PAD_APRON_M + skirt;
    out.push({ id, outline: o, level, skirt, x0: o.x - reach, z0: o.z - reach, x1: o.x + reach, z1: o.z + reach });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A pad's level: its road's height where its front meets it, else the mean of its ground */
function padLevel(o: Outline, natural: NaturalGround, roads: GradeMap["roadGraph"]): number {
  if (roads) {
    const front: Vec = [o.x + o.vx * o.hv, o.z + o.vz * o.hv];
    const near = roads.nearest(front, FRONT_REACH_M) ?? roads.nearest([o.x, o.z], o.half * Math.SQRT2 + FRONT_REACH_M);
    if (near) return natural(near.point[0], near.point[1]);
  }
  const points = [[o.x, o.z] as [number, number], ...rim(o, 0)];
  return points.reduce((sum, [x, z]) => sum + natural(x, z), 0) / points.length;
}

/** The levelled ground at a point from the pads near it: a pad's level inside it (the one it lies deepest in), else the
 * ground blended toward each pad within its slope's reach, so the levels meet the hills smoothly and two pads side by
 * side meet each other without a step */
export function gradedAt(pads: readonly GradePad[], natural: NaturalGround, x: number, z: number): number {
  let inside: GradePad | null = null, deepest = 0, sum = 0, weights = 0;
  for (const p of pads) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    const d = outsideBy(p.outline, x, z) - PAD_APRON_M;
    if (d <= 0) {
      if (!inside || d < deepest) { inside = p; deepest = d; }
      continue;
    }
    if (d >= p.skirt) continue;
    const t = d / p.skirt, s = t * t * (3 - 2 * t);
    // (1 - s) / s grows without end at the pad's edge, so there it is the pad's level alone
    const k = (1 - s) / Math.max(s, 1e-9);
    sum += k * p.level;
    weights += k;
  }
  if (inside) return inside.level;
  if (!weights) return NaN;
  return (sum + natural(x, z)) / (weights + 1);
}

/** The pads in buckets a tile wide by the tiles their slopes reach */
function bucketPads(pads: readonly GradePad[], width: number, height: number, size: number): Map<number, GradePad[]> {
  const out = new Map<number, GradePad[]>();
  for (const p of pads) {
    const tx0 = Math.max(0, Math.floor(p.x0 / size)), tz0 = Math.max(0, Math.floor(p.z0 / size));
    const tx1 = Math.min(width - 1, Math.floor(p.x1 / size)), tz1 = Math.min(height - 1, Math.floor(p.z1 / size));
    for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * width + tx, list = out.get(i);
      if (list) list.push(p); else out.set(i, [p]);
    }
  }
  return out;
}

/**
 * The levelled ground of a map, tile by tile: for each tile a pad's slope reaches, its heights at (GRADE_STEPS + 1)^2
 * points, row by row from its top left (the tiles no pad reaches are the natural ground). setPads works out again only
 * the tiles of the pads that came, went or changed.
 */
export class GroundGrade {
  readonly tiles = new Map<number, Float32Array>();
  private pads: GradePad[] = [];
  private byId = new Map<string, GradePad>();
  private buckets = new Map<number, GradePad[]>();
  /** Counts each change, for whoever draws it */
  version = 0;
  constructor(readonly width: number, readonly height: number, readonly tileSizeM: number, private readonly natural: NaturalGround) {}

  /** Takes a new list of pads; the tiles whose ground changed */
  setPads(pads: readonly GradePad[]): number[] {
    const next = new Map(pads.map((p) => [p.id, p]));
    const moved: GradePad[] = [];
    for (const [id, p] of this.byId) {
      const q = next.get(id);
      if (!q || !samePad(p, q)) moved.push(p);
    }
    for (const [id, q] of next) {
      const p = this.byId.get(id);
      if (!p || !samePad(p, q)) moved.push(q);
    }
    if (!moved.length) return [];
    this.pads = [...pads];
    this.byId = next;
    this.buckets = bucketPads(this.pads, this.width, this.height, this.tileSizeM);
    const touched = new Set<number>();
    for (const p of moved) {
      const tx0 = Math.max(0, Math.floor(p.x0 / this.tileSizeM)), tz0 = Math.max(0, Math.floor(p.z0 / this.tileSizeM));
      const tx1 = Math.min(this.width - 1, Math.floor(p.x1 / this.tileSizeM)), tz1 = Math.min(this.height - 1, Math.floor(p.z1 / this.tileSizeM));
      for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) touched.add(ty * this.width + tx);
    }
    const changed: number[] = [];
    for (const i of [...touched].sort((a, b) => a - b)) {
      const before = this.tiles.get(i), after = this.gradeTile(i);
      if (after) this.tiles.set(i, after); else this.tiles.delete(i);
      if (!sameSamples(before, after)) changed.push(i);
    }
    if (changed.length) this.version++;
    return changed;
  }

  /** The pads, in id order */
  all(): readonly GradePad[] {
    return this.pads;
  }

  /** The pad a point lies on (with its apron), or null */
  padAt(x: number, z: number): GradePad | null {
    const tx = Math.floor(x / this.tileSizeM), tz = Math.floor(z / this.tileSizeM);
    if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.height) return null;
    let best: GradePad | null = null, deepest = 0;
    for (const p of this.buckets.get(tz * this.width + tx) ?? []) {
      const d = outsideBy(p.outline, x, z) - PAD_APRON_M;
      if (d <= 0 && (!best || d < deepest)) { best = p; deepest = d; }
    }
    return best;
  }

  /** A tile's heights, or null when no pad's slope reaches it (or none changes it) */
  private gradeTile(i: number): Float32Array | null {
    const pads = this.buckets.get(i);
    if (!pads?.length) return null;
    const n = GRADE_STEPS + 1, step = this.tileSizeM / GRADE_STEPS, x0 = (i % this.width) * this.tileSizeM, z0 = Math.floor(i / this.width) * this.tileSizeM;
    const out = new Float32Array(n * n);
    let any = false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = x0 + c * step, z = z0 + r * step, h = gradedAt(pads, this.natural, x, z);
      if (Number.isNaN(h)) out[r * n + c] = this.natural(x, z);
      else { out[r * n + c] = h; any = true; }
    }
    return any ? out : null;
  }

  /**
   * The levelled ground at (u, v) across tile i (0 to 1 each way), or NaN when the tile is the natural ground: on the
   * triangles of its samples' squares, each split from its top right to its bottom left as the ground's own tiles are
   * (heightfield.ts sampleTile), so where no pad reaches it is exactly the natural ground
   */
  sampleTile(i: number, u: number, v: number): number {
    const t = this.tiles.get(i);
    return t ? sampleSamples(t, u, v) : NaN;
  }
}

/** A tile's samples at (u, v), 0 to 1 each way */
export function sampleSamples(t: ArrayLike<number>, u: number, v: number): number {
  const n = GRADE_STEPS + 1, gu = Math.max(0, Math.min(GRADE_STEPS, u * GRADE_STEPS)), gv = Math.max(0, Math.min(GRADE_STEPS, v * GRADE_STEPS));
  const c = Math.min(GRADE_STEPS - 1, Math.floor(gu)), r = Math.min(GRADE_STEPS - 1, Math.floor(gv)), fu = gu - c, fv = gv - r;
  const a = t[r * n + c], b = t[r * n + c + 1], cc = t[(r + 1) * n + c], d = t[(r + 1) * n + c + 1];
  return fu + fv <= 1 ? a + fu * (b - a) + fv * (cc - a) : d + (1 - fv) * (b - d) + (1 - fu) * (cc - d);
}

const samePad = (p: GradePad, q: GradePad): boolean => p.level === q.level && p.skirt === q.skirt &&
  p.outline.x === q.outline.x && p.outline.z === q.outline.z && p.outline.hu === q.outline.hu && p.outline.hv === q.outline.hv &&
  p.outline.ux === q.outline.ux && p.outline.uz === q.outline.uz;

function sameSamples(a: Float32Array | null | undefined, b: Float32Array | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false;
  return true;
}

/** The natural ground of a map from its tiles' heights (metres a tile, its middle): blended between the middles */
export function tileHeightGround(heights: ArrayLike<number>, width: number, height: number, tileSizeM: number): NaturalGround {
  const at = (x: number, y: number): number => Math.max(0, heights[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))]);
  return (x, z) => {
    const gx = x / tileSizeM - 0.5, gz = z / tileSizeM - 0.5, tx = Math.floor(gx), tz = Math.floor(gz), fx = gx - tx, fz = gz - tz;
    return (at(tx, tz) * (1 - fx) + at(tx + 1, tz) * fx) * (1 - fz) + (at(tx, tz + 1) * (1 - fx) + at(tx + 1, tz + 1) * fx) * fz;
  };
}

/** A map whose heights the simulation reads levelled */
export interface GradedHeightsMap extends GradeMap {
  heights?: ArrayLike<number> | null;
}

/** What may stand on each tile, from the lists alone (a building by its middle and size, a plot by its outline), and the
 * pads' levels by what they were worked out from: both follow from the lists and the roads, so keeping them changes no
 * result (a map opened from a save works them out again the same) */
interface SimGrade {
  sign: string;
  near: Map<number, (PlacedBuilding | Footing)[]>;
  levels: Map<string, { sign: string; level: number }>;
  natural: NaturalGround;
}
const simKept = new WeakMap<object, SimGrade>();

function simGrade(map: GradedHeightsMap, heights: ArrayLike<number>): SimGrade {
  const size = map.tileSizeM || 16;
  const sign = `${map.buildings?.version ?? 0}|${map.plotBuildings?.version ?? 0}`;
  const found = simKept.get(map);
  if (found && found.sign === sign) return found;
  const near = new Map<number, (PlacedBuilding | Footing)[]>();
  const add = (x: number, z: number, reach: number, item: PlacedBuilding | Footing): void => {
    const tx0 = Math.max(0, Math.floor((x - reach) / size)), tz0 = Math.max(0, Math.floor((z - reach) / size));
    const tx1 = Math.min(map.width - 1, Math.floor((x + reach) / size)), tz1 = Math.min(map.height - 1, Math.floor((z + reach) / size));
    for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * map.width + tx, list = near.get(i);
      if (list) list.push(item); else near.set(i, [item]);
    }
  };
  // a building's outline (turned, or its square block) lies within its size's half diagonal and a tile of its middle
  for (const b of map.buildings?.all() ?? []) add(b.x, b.z, b.size * size * Math.SQRT1_2 + size + PAD_APRON_M, b);
  for (const f of plotFootings(map)) add(f.outline.x, f.outline.z, f.outline.half * Math.SQRT2 + PAD_APRON_M, f);
  const out = { sign, near, levels: found?.levels ?? new Map(), natural: found?.natural ?? tileHeightGround(heights, map.width, map.height, size) };
  simKept.set(map, out);
  return out;
}

/**
 * A tile's height as the simulation sees it (metres): the level of the pad its middle lies on (with its apron), else
 * the map's own height; NaN where the map has none. Worked out from the map as it is at each call.
 */
export function gradedTileHeight(map: GradedHeightsMap, tile: number): number {
  const heights = map.heights;
  if (!heights || heights.length !== map.width * map.height) return NaN;
  const g = simGrade(map, heights), size = map.tileSizeM || 16, x = (tile % map.width + 0.5) * size, z = (Math.floor(tile / map.width) + 0.5) * size;
  let best: { id: string; outline: Outline } | null = null, deepest = 0;
  for (const item of g.near.get(tile) ?? []) {
    let f: Footing;
    if ("tool" in item) {
      const cx = item.tile % map.width, cy = Math.floor(item.tile / map.width);
      if (map.getTile && !map.getTile(cx, cy).isZone()) continue;
      f = { id: `b${item.id}`, outline: buildingFooting(map, item, size) };
    } else f = item;
    const d = outsideBy(f.outline, x, z) - PAD_APRON_M;
    if (d <= 0 && (!best || d < deepest || d === deepest && f.id < best.id)) { best = f; deepest = d; }
  }
  if (!best) return heights[tile];
  const roads = map.roadGraph ?? null, o = best.outline;
  const sign = `${o.x},${o.z},${o.hu},${o.hv},${o.vx},${o.vz}|${roads?.version ?? 0}`;
  let kept = g.levels.get(best.id);
  if (!kept || kept.sign !== sign) {
    kept = { sign, level: padLevel(o, g.natural, roads) };
    g.levels.set(best.id, kept);
  }
  return kept.level;
}
