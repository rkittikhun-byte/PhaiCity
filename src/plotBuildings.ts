/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Plots as buildings, one at a time (docs/NO_GRID_PLAN.md 3B; owner, 21 Oct 2026: "เกมส์ยังแบ่งช่องเป็นตารางอยู่"). On a
// real-scale city map painted in 4 m cells (src/zoneCells.ts) a plot is no longer a 16 m tile painted enough (28% of its
// cells, syncCellPlots): it is a run of painted columns side by side along one road (src/plotColumns.ts), as wide as its
// kind builds (a shophouse bay 4 m, a house 12 m, a factory 16 m: PLOT_FRONTAGE) and one plot deep, with an id that
// stays, its kind, level, land class and the time it was formed. Painting one row of cells along a road is enough, and
// the building stands where the paint is.
//
// - **Formed** from the columns (formPlots), whenever the paint or the land under it changes and once a month: a plot
//   keeps its columns while they are all still painted its zone and its land is its own; an empty plot narrower than
//   its kind's frontage takes the free columns of its zone beside it; the free columns left make new plots, each run
//   cut into its kind's frontage. A new plot on tiles that show a plot of its kind nobody keeps (an older save's tile
//   plot, a tile undo put back) takes that plot's level: so an older city opens with its buildings (3B.4).
// - **Counted by its area** (plotShare): a 16 m tile's worth of columns counts as a tile plot did, the census's 20 people
//   a level, the power and water of its level, so the city grows as before while a shop on one bay counts a quarter.
// - **Grows** by itself, as a tile plot did (src/plots.ts plotFound), when the map scan comes to the tile it is counted
//   at (its anchor, its middle column's), with its own luck (src/sim/agentRandom.ts), so one built or bulldozed leaves
//   the others' luck alone. Two plots side by side along the road, grown far enough, join into one (keeping the older's
//   id and time): the top level wants a plot LOT_COLUMNS wide, an old lot's side.
// - **Tiles for the old readers**: each tile its columns lie on shows the plot that has the most columns there
//   (writePlotTiles), so pollution, fire, the bulldozer, the objects and the city map read plots as before. A tile the
//   list wrote that something else took (fire, the bulldozer, a road, a flood) takes every plot on it with it.
//
// Only on a map painted a cell at a time (usesPlotList); a map painted a tile at a time (tests, practice) keeps its tile
// plots. Plain code, no DOM: it runs in the simulation.

import { frontageColumns, type FrontageColumn } from "./plotColumns";
import {
  CITY_LUCK, commuteCost, DESTINATIONS, grows, homeScore, isOpenLand, type Luck, NO_ROAD_FOUND, nearestRoad,
  PLOT_KINDS, PLOT_SHARE, PLOT_TOP, type PlotKind, plotKindOfValue, plotEnvironmentClass, type PlotScanMap,
  type PlotSimData, plotTile, plotWhyOf, readPlotValue, ROUTE_FOUND, shrinks, tripMinutes, WHY, DENSITY_TO_RISE,
} from "./plots";
import { plotWater } from "./sim/cityUtilities";
import { ZoneUtils } from "./zoneUtils.js";
import { CELL_M, type CellLayout, type CellMap, type CellPlotMap, PLOT_ROWS, rasterKey, syncCellPlots } from "./zoneCells";
import { BLBNCNBIT, POWERBIT, ZONEBIT } from "./tileFlags";
import { DIRT } from "./tileValues";
import { isCityTileSize } from "./units";
import { mapEra } from "./era";

/** How many columns (4 m each) along its road each kind's plot takes: a shophouse bay, a 12 m house, a 16 m works */
export const PLOT_FRONTAGE: Readonly<Record<PlotKind, number>> = { residential: 3, commercial: 1, industrial: 4 };
/** How wide a plot must be for its kind's top level (columns): 32 m, the side of an old lot of four tile plots */
export const LOT_COLUMNS = 8;
/** ... and for a building of a whole tile, a walk-up block, an office tower or a works (columns): 16 m */
export const TILE_COLUMNS = 4;
/** The widest plots joined may be (columns) */
export const MERGE_MAX_COLUMNS = 12;
/** The shop levels each era builds as shophouse bays (art/buildings, src/render3d/city/frontage.ts), on one column each:
 * the lower row up to the first, the taller up to the second; above that the era's tile model (its office towers in
 * eras 4 and 5), a tile wide */
export const BAY_LEVELS: Readonly<Record<number, readonly [number, number]>> = { 1: [2, 4], 2: [2, 4], 3: [2, 4], 4: [1, 2], 5: [1, 2] };
/** ... and the home levels each era builds as a 12 m house on three columns (above: its walk-up flats and
 * condominiums, a tile wide) */
export const HOUSE_LEVELS: Readonly<Record<number, readonly [number, number]>> = { 1: [2, 4], 2: [2, 4], 3: [1, 3], 4: [1, 3], 5: [1, 3] };

/**
 * How many columns along its road a building of a kind and level needs in an era (docs/NO_GRID_PLAN.md 3B.2): a
 * shophouse bay one, a 12 m house three (PLOT_FRONTAGE), a building of a whole tile four, the top level eight (a lot).
 * A plot narrower than its next level needs takes in the plots of its kind beside it first (joinNeighbour).
 */
export function needColumns(kind: PlotKind, level: number, era: number): number {
  if (level >= PLOT_TOP[kind]) return LOT_COLUMNS;
  if (level <= 0) return 1;
  const bays = (BAY_LEVELS[era] ?? BAY_LEVELS[1])[1], houses = (HOUSE_LEVELS[era] ?? HOUSE_LEVELS[1])[1];
  if (kind === "commercial") return level <= bays ? 1 : TILE_COLUMNS;
  if (kind === "residential") return level <= houses ? PLOT_FRONTAGE.residential : TILE_COLUMNS;
  return PLOT_FRONTAGE.industrial;
}

const ZONE_KIND: readonly (PlotKind | null)[] = [null, "residential", "commercial", "industrial"];
/** The city's time a month (src/construction.ts TIME_PER_MONTH) */
const TIME_PER_MONTH = 4;
const codeOf = (kind: PlotKind): number => PLOT_KINDS.indexOf(kind) + 1;

/** A plot and the building on it */
export interface PlotBuilding {
  readonly id: number;
  kind: PlotKind;
  level: number;
  /** The land and pollution class its building was put up for: 0–3 (0–1 for factories) */
  value: number;
  /** Which of the three houses of its class a house is (src/plots.ts plotTile) */
  style: number;
  /** The city's time (src/simulation.js _cityTime) it was formed */
  born: number;
  /** Its columns, left to right as seen from its road: each one's key, the 1 m raster key of its front row's middle */
  columns: number[];
  /** The level of the building standing on it when that is higher than its people's (`level`): people who left leave
   * their building standing, vacant, until the ruler bulldozes it or people move back (owner, 24 Oct 2026: "ถ้าย้ายออก จะต้อง
   * มีสิ่งปลูกสร้างคงค้างอยู่ ต้องให้ user รื้อถอนเท่านั้น"); builtLevel reads it */
  built?: number;
  /** The city's time its standing building began to go up, while it is still a construction site (constructionShare) */
  since?: number;
  /** The city's time its last people left, while it stands empty (the auto player clears the oldest) */
  left?: number;
}

/** The level of the building standing on a plot: its people's, or higher while some or all of them have left */
export const builtLevel = (plot: Pick<PlotBuilding, "level" | "built">): number => Math.max(plot.level, plot.built ?? 0);

/** Whether a plot's building stands empty: built, and nobody lives or works in it */
export const isVacant = (plot: Pick<PlotBuilding, "level" | "built">): boolean => plot.level === 0 && builtLevel(plot) > 0;

/** The months a plot's building of a level takes to go up (owner, 24 Oct 2026: "ต้องมีการเริ่มก่อสร้างด้วย ไม่ใช่หายแว๊บ
 * ขึ้นมาเลย"): a stilt house a month, each level of a home a month more, a shophouse a month more than a home, a
 * factory two */
export function buildMonths(kind: PlotKind, level: number): number {
  return Math.max(1, level) + (kind === "commercial" ? 1 : kind === "industrial" ? 2 : 0);
}

/** How far a plot's building has gone up at the city's time `now`: 0 cleared ground, 1 finished (and finished when it
 * keeps no start: older saves, the tools) */
export function constructionShare(plot: PlotBuilding, now: number): number {
  if (plot.since === undefined || builtLevel(plot) <= 0) return 1;
  return Math.max(0, Math.min(1, (now - plot.since) / (buildMonths(plot.kind, builtLevel(plot)) * TIME_PER_MONTH)));
}

/** Where a plot stands now, worked out from its columns each time the plots are formed */
export interface PlotPlace {
  /** Its columns' indices in the list's columns, left to right */
  cols: number[];
  /** The tile it is counted at (its middle column's), and every tile its columns lie on */
  anchor: number;
  tiles: number[];
}

/** A map whose plots are a list: painted a cell at a time on real-scale tiles */
export interface PlotListMap extends CellMap {
  paintedZones?: boolean;
  getTileFlags(x: number, y: number): number;
  setTile(x: number, y: number, value: number, flags: number): void;
  plotBuildings?: PlotBuildings | null;
}

/** Whether a map's plots are a list: painted a cell at a time, on real-scale tiles */
export function usesPlotList(map: { cellZones?: boolean; tileSizeM?: number | null }): boolean {
  return Boolean(map.cellZones) && isCityTileSize(map.tileSizeM);
}

/** The plots of a map, by id, ids counting up */
export class PlotBuildings {
  private readonly items = new Map<number, PlotBuilding>();
  private next = 1;
  /** Counts every change to the plots (formed, grown, joined, gone), for whoever draws them */
  version = 0;
  /** The columns the plots were last formed from, their keys, and whose each one is (a plot's id, 0 for none) */
  columns: FrontageColumn[] = [];
  keys: number[] = [];
  owner: Int32Array = new Int32Array(0);
  /** Where each plot stands, and the plots counted at each tile, by id */
  readonly places = new Map<number, PlotPlace>();
  readonly byAnchor = new Map<number, number[]>();
  /** The tiles the plots show (writePlotTiles): the value each was given and whose it is */
  written = new Map<number, number>();
  shownBy = new Map<number, number>();
  /** Whether the plots have been formed once on this map (an older save's tile plots are taken in then) */
  formed = false;
  /** What they were last formed from: the cells' layout, the paint's count of changes, and how many painted columns
   * waited for their land (a fire's or a bulldozer's dust); while all are the same and no tile they show was taken, a
   * forming again would change nothing and is passed by (about 40 ms on a town of 860 plots) */
  formedOn: { layout: CellLayout | null; paint: number; waiting: number } = { layout: null, paint: -1, waiting: 0 };

  get(id: number): PlotBuilding | undefined {
    return this.items.get(id);
  }

  all(): PlotBuilding[] {
    return [...this.items.values()].sort((a, b) => a.id - b.id);
  }

  get size(): number {
    return this.items.size;
  }

  /** The plots counted at a tile, by id */
  atAnchor(tile: number): PlotBuilding[] {
    return (this.byAnchor.get(tile) ?? []).map((id) => this.items.get(id)!).filter(Boolean);
  }

  /** The plot whose building a tile shows, or null */
  shownAt(tile: number): PlotBuilding | null {
    const id = this.shownBy.get(tile);
    return id === undefined ? null : this.items.get(id) ?? null;
  }

  /** The plot a column (its index in the list's columns) belongs to, or null */
  ofColumn(k: number): PlotBuilding | null {
    const id = k >= 0 && k < this.owner.length ? this.owner[k] : 0;
    return id ? this.items.get(id) ?? null : null;
  }

  add(plot: Omit<PlotBuilding, "id">): PlotBuilding {
    const made: PlotBuilding = { ...plot, id: this.next++ };
    this.items.set(made.id, made);
    this.version++;
    return made;
  }

  remove(id: number): void {
    if (this.items.delete(id)) this.version++;
    this.places.delete(id);
  }

  /** As a save keeps them: [id, kind (1 homes, 2 shops, 3 factories), level, value, style, born, ...column keys] each,
   * the next id, and the buildings standing above their people or still going up: [id, built, since or -1, left or -1] */
  toJSON(): { plots: number[][]; next: number; standing?: number[][] } {
    const standing = this.all().filter((p) => builtLevel(p) > p.level || p.since !== undefined || p.left !== undefined)
      .map((p) => [p.id, builtLevel(p), p.since ?? -1, p.left ?? -1]);
    return { plots: this.all().map((p) => [p.id, codeOf(p.kind), p.level, p.value, p.style, p.born, ...p.columns]), next: this.next,
      ...(standing.length ? { standing } : {}) };
  }

  /** From toJSON's data; what does not read as such is left out */
  static fromJSON(data: unknown): PlotBuildings {
    const out = new PlotBuildings();
    const saved = data as { plots?: unknown; next?: unknown } | null;
    if (!saved || !Array.isArray(saved.plots)) return out;
    for (const row of saved.plots) {
      if (!Array.isArray(row) || row.length < 7 || !row.every((n) => Number.isInteger(n))) continue;
      const [id, code, level, value, style, born, ...columns] = row as number[];
      const kind = ZONE_KIND[code];
      if (!kind || id < 1 || out.items.has(id)) continue;
      out.items.set(id, { id, kind, level: Math.max(0, Math.min(PLOT_TOP[kind], level)), value, style, born, columns });
      out.next = Math.max(out.next, id + 1);
    }
    if (typeof saved.next === "number" && saved.next > out.next) out.next = saved.next;
    for (const row of Array.isArray((saved as { standing?: unknown }).standing) ? (saved as { standing: unknown[] }).standing : []) {
      if (!Array.isArray(row) || row.length !== 4 || !row.every((n) => Number.isFinite(n))) continue;
      const [id, built, since, left] = row as number[], plot = out.items.get(id);
      if (!plot) continue;
      plot.built = Math.max(plot.level, Math.min(PLOT_TOP[plot.kind], built));
      if (since >= 0) plot.since = since;
      if (left >= 0) plot.left = left;
    }
    out.formed = out.items.size > 0;
    return out;
  }
}

/** A plot's share of a 16 m tile's ground, which the census, the power and the water count it by: its columns, each a
 * cell wide and PLOT_ROWS cells deep (a tile's four columns make one) */
export function plotShare(map: { tileSizeM?: number | null }, plot: PlotBuilding): number {
  const tile = map.tileSizeM || 16;
  return plot.columns.length * CELL_M * PLOT_ROWS * CELL_M / (tile * tile);
}

/** The plots a map keeps, made the first time they are asked for on a map whose plots are a list; null on any other */
export function plotListOf(map: PlotListMap): PlotBuildings | null {
  if (!usesPlotList(map)) return null;
  return map.plotBuildings ?? (map.plotBuildings = new PlotBuildings());
}

/** Whether a tile's land may hold a plot: open land, or a plot already (never a zone's or a building's) */
function plotLand(map: PlotListMap, tile: number): boolean {
  const x = tile % map.width, y = (tile - x) / map.width;
  if (map.getTileFlags(x, y) & ZONEBIT) return false;
  const value = map.getTileValue(x, y);
  return isOpenLand(value) || plotKindOfValue(value) !== null;
}

/** How a run of n columns is cut into plots of a frontage f: as evenly as it goes, the wider ones first */
export function cutRun(n: number, f: number): number[] {
  const count = Math.max(1, Math.ceil(n / f)), base = Math.floor(n / count), extra = n % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * The plots formed again from the painted columns (see the top of this file): the ones kept, widened or gone, the new
 * ones, where each stands, and the tiles they show. time: the city's time, the new plots' `born`. Returns the tiles it
 * changed.
 */
export function formPlots(map: PlotListMap, layout: CellLayout, time = 0): number[] {
  const list = plotListOf(map);
  if (!list) return [];
  const width = map.width;
  // The tiles the list wrote that something else took since: every plot on them goes
  const taken = new Set<number>();
  for (const [tile, value] of list.written) {
    const x = tile % width, y = (tile - x) / width;
    if (map.getTileValue(x, y) !== value || map.getTileFlags(x, y) & ZONEBIT) taken.add(tile);
  }
  const paint = map.zoneCellsVersion ?? 0, last = list.formedOn;
  if (list.formed && last.layout === layout && last.paint === paint && !last.waiting && !taken.size) return [];
  const cols = frontageColumns(layout, map.zoneCells ?? new Map());
  const keys = cols.map((c) => rasterKey(map, c.x, c.z));
  const keyIndex = new Map<number, number>();
  keys.forEach((key, i) => { if (!keyIndex.has(key)) keyIndex.set(key, i); });
  // ... and where each lies, for a column the road's redrawing moved a little (its key no longer the same)
  const cu = layout.cellUnits, buckets = new Map<string, number[]>();
  cols.forEach((c, i) => {
    const key = `${Math.floor(c.x / cu)},${Math.floor(c.z / cu)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i);
  });
  const rasterUnits = layout.rasterUnits, rasterWidth = layout.rasterWidth;
  const moved = (key: number): number | undefined => {
    const x = (key % rasterWidth + 0.5) * rasterUnits, z = (Math.floor(key / rasterWidth) + 0.5) * rasterUnits;
    let best: number | undefined, bestD = 0.45 * cu;
    const bx = Math.floor(x / cu), bz = Math.floor(z / cu);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const i of buckets.get(`${bx + dx},${bz + dz}`) ?? []) {
      const d = Math.hypot(cols[i].x - x, cols[i].z - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
  const owner = new Int32Array(cols.length);
  const land = new Map<number, boolean>();
  const free = (i: number): boolean => {
    if (owner[i]) return false;
    const tile = cols[i].tile;
    if (taken.has(tile)) return false;
    let ok = land.get(tile);
    if (ok === undefined) land.set(tile, ok = plotLand(map, tile));
    return ok;
  };
  // 1. The plots kept: all their columns still painted their zone, side by side along the road, on their own land
  const placed = new Map<number, number[]>();
  const gone: number[] = [];
  for (const plot of list.all()) {
    const idxs: number[] = [];
    let ok = plot.columns.length > 0;
    for (const key of plot.columns) {
      const i = keyIndex.get(key) ?? moved(key);
      if (i === undefined || !free(i) || cols[i].zone !== codeOf(plot.kind) || idxs.includes(i)) { ok = false; break; }
      idxs.push(i);
    }
    for (let j = 1; ok && j < idxs.length; j++) if (cols[idxs[j - 1]].right !== idxs[j]) ok = false;
    if (!ok) { gone.push(plot.id); continue; }
    for (const i of idxs) owner[i] = plot.id;
    placed.set(plot.id, idxs);
  }
  for (const id of gone) list.remove(id);
  // 2. An empty plot narrower than its kind's frontage takes the free columns of its zone beside it
  for (const plot of list.all()) {
    if (builtLevel(plot) > 0) continue;
    const idxs = placed.get(plot.id)!, want = PLOT_FRONTAGE[plot.kind];
    while (idxs.length < want) {
      const right = cols[idxs[idxs.length - 1]].right, left = cols[idxs[0]].left;
      if (right >= 0 && free(right)) { idxs.push(right); owner[right] = plot.id; }
      else if (left >= 0 && free(left)) { idxs.unshift(left); owner[left] = plot.id; }
      else break;
    }
  }
  // 3. The free columns left make new plots: each run of them along the road, from its left end, cut into its kind's
  // frontage; a run that goes round in a ring has no left end, and starts at its first column
  const shown = (tile: number): PlotBuilding | null => {
    const id = list.shownBy.get(tile);
    return id === undefined ? null : list.get(id) ?? null;
  };
  const newPlot = (run: number[]): void => {
    const kind = ZONE_KIND[cols[run[0]].zone]!;
    for (const n of cutRun(run.length, PLOT_FRONTAGE[kind])) {
      const part = run.splice(0, n);
      // ... on tiles showing a plot of its kind nobody keeps (an older save's, one undo put back), at its level
      const old = adopted(map, part.map((i) => cols[i].tile), kind, (tile) => shown(tile));
      const plot = list.add({ kind, level: old?.level ?? 0, value: old?.value ?? 0, style: old?.style ?? 0, born: time,
        columns: part.map((i) => keys[i]) });
      for (const i of part) owner[i] = plot.id;
      placed.set(plot.id, part);
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < cols.length; i++) {
      if (!free(i)) continue;
      const left = cols[i].left;
      if (pass === 0 && left >= 0 && free(left) && cols[left].zone === cols[i].zone) continue;
      const run = [i];
      for (let r = cols[i].right; r >= 0 && free(r) && !run.includes(r) && run.length < 4096; r = cols[r].right) run.push(r);
      newPlot(run);
    }
  }
  list.columns = cols;
  list.keys = keys;
  list.owner = owner;
  for (const [id, idxs] of placed) {
    const plot = list.get(id);
    if (plot) plot.columns = idxs.map((i) => keys[i]);
  }
  placePlots(list, map.width);
  const changed = writePlotTiles(map, list, !list.formed);
  let waiting = 0;
  for (let i = 0; i < owner.length; i++) if (!owner[i]) waiting++;
  list.formedOn = { layout, paint, waiting };
  list.formed = true;
  return changed;
}

/** The plot of a kind a new plot's tiles show that no plot of the list keeps (the tile most of its columns lie on): an
 * older save's tile plot, or a tile undo put back */
function adopted(map: PlotListMap, tiles: number[], kind: PlotKind, shown: (tile: number) => PlotBuilding | null):
  { level: number; value: number; style: number } | null {
  const counts = new Map<number, number>();
  for (const tile of tiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  let best = -1, most = 0;
  for (const [tile, n] of counts) if (n > most || n === most && tile < best) { best = tile; most = n; }
  if (best < 0 || shown(best)) return null;
  const x = best % map.width, y = (best - x) / map.width;
  if (map.getTileFlags(x, y) & ZONEBIT) return null;
  const value = map.getTileValue(x, y), plot = readPlotValue(value);
  if (!plot || plot.kind !== kind || plot.level <= 0) return null;
  const style = plot.kind === "residential" && plot.level === 1 ? (value - plotTile(kind, 1, plot.value, 0)) % 3 : 0;
  return { level: plot.level, value: plot.value, style: Math.max(0, style) };
}

/** Where each plot stands, from its columns: its anchor (its middle column's tile) and its tiles */
export function placePlots(list: PlotBuildings, width: number): void {
  void width;
  list.places.clear();
  list.byAnchor.clear();
  const index = new Map<number, number>();
  list.keys.forEach((key, i) => { if (list.owner[i] && !index.has(key)) index.set(key, i); });
  for (const plot of list.all()) {
    const cols = plot.columns.map((key) => index.get(key)).filter((i): i is number => i !== undefined && list.owner[i] === plot.id);
    if (!cols.length) continue;
    const tiles = [...new Set(cols.map((i) => list.columns[i].tile))];
    const anchor = list.columns[cols[Math.floor((cols.length - 1) / 2)]].tile;
    list.places.set(plot.id, { cols, anchor, tiles });
    const here = list.byAnchor.get(anchor);
    if (here) here.push(plot.id); else list.byAnchor.set(anchor, [plot.id]);
  }
}

/**
 * The tiles the plots show, for the readers of tiles: each tile a plot's columns lie on shows the plot with the most
 * columns there (the lower id when as many), as a tile plot of its kind and level; a tile no plot lies on any more goes
 * back to bare ground. Only open land or a plot's tile is written, never a zone's, a road's or a fire's. sweep: the first
 * time a map's plots are formed, a tile plot of an older save that no plot of the list took is bare ground then. Returns
 * the tiles it changed.
 */
export function writePlotTiles(map: PlotListMap, list: PlotBuildings, sweep = false): number[] {
  const width = map.width, counts = new Map<number, Map<number, number>>();
  for (const [id, place] of list.places) for (const i of place.cols) {
    const tile = list.columns[i].tile, here = counts.get(tile) ?? new Map<number, number>();
    here.set(id, (here.get(id) ?? 0) + 1);
    counts.set(tile, here);
  }
  const written = new Map<number, number>(), shownBy = new Map<number, number>(), changed: number[] = [];
  for (const [tile, here] of counts) {
    let best = 0, most = 0;
    for (const [id, n] of here) if (n > most || n === most && id < best) { best = id; most = n; }
    const plot = list.get(best)!, value = plotTile(plot.kind, plot.level, plot.value, plot.style);
    const x = tile % width, y = (tile - x) / width, now = map.getTileValue(x, y), flags = map.getTileFlags(x, y);
    if (now !== value) {
      if (flags & ZONEBIT || !(isOpenLand(now) || plotKindOfValue(now) !== null)) continue;
      map.setTile(x, y, value, BLBNCNBIT | (flags & POWERBIT));
      changed.push(tile);
    }
    written.set(tile, value);
    shownBy.set(tile, best);
  }
  const bare = (tile: number): void => {
    const x = tile % width, y = (tile - x) / width;
    if (map.getTileFlags(x, y) & ZONEBIT) return;
    map.setTile(x, y, DIRT, 0);
    changed.push(tile);
  };
  for (const [tile, value] of list.written) {
    if (written.has(tile)) continue;
    const x = tile % width, y = (tile - x) / width;
    if (map.getTileValue(x, y) === value) bare(tile);
  }
  if (sweep) {
    for (let y = 0; y < map.height; y++) for (let x = 0; x < width; x++) {
      const tile = y * width + x;
      if (!written.has(tile) && !(map.getTileFlags(x, y) & ZONEBIT) && plotKindOfValue(map.getTileValue(x, y)) !== null) bare(tile);
    }
  }
  list.written = written;
  list.shownBy = shownBy;
  list.version++;
  return changed;
}

/** The plots the paint makes, once it or the land under it changed (src/cityCommands.ts, src/core/cityCore.ts): formed
 * again as a list where the plots are one (formPlots), else the tiles painted enough (src/zoneCells.ts syncCellPlots,
 * tiles: those to look at) */
export function refreshCellPlots(map: PlotListMap & CellPlotMap, layout: CellLayout, tiles?: Iterable<number>, time = 0): number[] {
  return usesPlotList(map) ? formPlots(map, layout, time) : syncCellPlots(map, layout, tiles);
}

/**
 * A plot put to a level and class: the tiles it shows show its people's level. With the city's time `now` (the
 * simulation's growth) a level above its standing building puts up a new one, a construction site from then; a level
 * below leaves the building standing, vacant at 0. Without it (the tools, tests) the building is put up as it is, at
 * once.
 */
function setPlot(map: PlotListMap, list: PlotBuildings, plot: PlotBuilding, level: number, value: number, style: number,
  now?: number): void {
  const standing = builtLevel(plot);
  if (now === undefined) { plot.built = level; delete plot.since; delete plot.left; }
  else {
    if (level > standing) { plot.built = level; plot.since = now; }
    else plot.built = standing;
    if (level === 0 && plot.level > 0) plot.left = now;
    else if (level > 0) delete plot.left;
  }
  plot.level = level;
  plot.value = value;
  plot.style = style;
  const shownValue = plotTile(plot.kind, level, value, style), width = map.width;
  for (const tile of list.places.get(plot.id)?.tiles ?? []) {
    if (list.shownBy.get(tile) !== plot.id) continue;
    const x = tile % width, y = (tile - x) / width;
    map.setTile(x, y, shownValue, BLBNCNBIT | (map.getTileFlags(x, y) & POWERBIT));
    list.written.set(tile, shownValue);
  }
  list.version++;
}

/** A plot's building put to a level (and class), for tests and the tools: the tiles it shows show it; with the city's
 * time `now`, as the simulation grows it (a construction site going up, a building left standing when people leave) */
export function putPlotLevel(map: PlotListMap, plot: PlotBuilding, level: number, value = plot.value, now?: number): void {
  const list = map.plotBuildings;
  if (list && list.get(plot.id) === plot) setPlot(map, list, plot, Math.max(0, Math.min(PLOT_TOP[plot.kind], level)), value, plot.style, now);
}

/** Whether a plot of the list is wide enough for its next level's building in an era (needColumns) */
export function plotMayRise(plot: PlotBuilding, era = 1): boolean {
  return plot.columns.length >= needColumns(plot.kind, plot.level + 1, era);
}

/**
 * A plot too narrow for its next level's building takes in the plot of its kind beside it along the road
 * (docs/NO_GRID_PLAN.md 3B.2; owner's taste, docs/design/LOOK_BOOK.md: a building stands on the ground it takes), as a lot
 * of four tile plots once joined: one no taller than it, an empty lot of its kind too, no wider together than
 * MERGE_MAX_COLUMNS. It keeps its id, its time and its level, and the richer class; the other's building makes way.
 * Returns whether they joined.
 */
export function joinNeighbour(map: PlotListMap, list: PlotBuildings, plot: PlotBuilding): boolean {
  const place = list.places.get(plot.id);
  if (!place || plot.level < 1) return false;
  for (const side of ["right", "left"] as const) {
    const end = side === "right" ? place.cols[place.cols.length - 1] : place.cols[0];
    const other = list.ofColumn(list.columns[end][side]);
    // (never a building standing empty or half empty: its land is not free until it is bulldozed)
    if (!other || other.id === plot.id || other.kind !== plot.kind || builtLevel(other) > other.level || other.level > plot.level ||
      plot.columns.length + other.columns.length > MERGE_MAX_COLUMNS) continue;
    plot.columns = side === "right" ? [...plot.columns, ...other.columns] : [...other.columns, ...plot.columns];
    plot.value = Math.max(plot.value, other.value);
    list.remove(other.id);
    for (let i = 0; i < list.owner.length; i++) if (list.owner[i] === other.id) list.owner[i] = plot.id;
    placePlots(list, map.width);
    writePlotTiles(map, list);
    return true;
  }
  return false;
}

/** The plots counted at a tile, with their power demand in the units a tile of a building takes, and the tiles they
 * show; null when the tile counts none (or the map's plots are not a list) */
export function anchorUse(map: PlotListMap, tile: number, power: (kind: PlotKind, level: number) => number):
  { demand: number; tiles: number[] } | null {
  const list = map.plotBuildings;
  if (!list || !usesPlotList(map)) return null;
  const here = list.atAnchor(tile);
  if (!here.length) return null;
  let demand = 0;
  const tiles = new Set<number>([tile]);
  for (const plot of here) {
    demand += power(plot.kind, plot.level) * plotShare(map, plot);
    for (const t of list.places.get(plot.id)?.tiles ?? []) if (list.shownBy.get(t) === plot.id) tiles.add(t);
  }
  return { demand, tiles: [...tiles] };
}

/** Plot shares of a zone's water, by level (src/sim/cityUtilities.ts plotWater), for the plots counted at a tile */
export function anchorWater(map: PlotListMap, tile: number, water: (level: number) => number): number | null {
  const list = map.plotBuildings;
  if (!list || !usesPlotList(map)) return null;
  let demand = 0;
  for (const plot of list.atAnchor(tile)) if (plot.level >= 1) demand += water(plot.level) * plotShare(map, plot);
  return demand;
}

/** What the water supply asks of the plots counted at a tile (src/waterManager.ts supplyPlot) */
interface PlotWaterSupply {
  supplyPlot(x: number, y: number, roadX: number, roadY: number, census: unknown, needsWater: boolean,
    demand?: number, share?: number): boolean;
}

/**
 * The map scan came to a tile the plots of the list are counted at (src/mapScanner.js): each is counted by its area,
 * all take their water together along the road their tile reaches, and each grows or shrinks by a level as a tile plot
 * does (src/plots.ts plotFound), with its own luck: luckFor(plot) gives it.
 */
export function plotsFound(map: PlotScanMap & PlotListMap, x: number, y: number, sim: PlotSimData,
  luckFor: (plot: PlotBuilding) => Luck = () => CITY_LUCK): void {
  const list = map.plotBuildings;
  if (!list) return;
  const tile = y * map.width + x, here = list.atAnchor(tile);
  if (!here.length) return;
  const census = sim.census, powered = map.getTile(x, y).isPowered();
  const road = nearestRoad(map, x, y);
  let shares = 0, demand = 0, needs = false;
  for (const plot of here) {
    const share = plotShare(map, plot);
    shares += share;
    if (plot.level >= 1) { needs = true; demand += plotWater(plot.level) * share; }
  }
  const water = sim.waterManager as unknown as PlotWaterSupply | null | undefined;
  const watered = water ? water.supplyPlot(x, y, road ? road.x : -1, road ? road.y : -1, census, needs, demand, shares) : true;
  for (const plot of here) {
    if (list.get(plot.id) !== plot) continue;
    growPlot(map, list, plot, x, y, sim, luckFor(plot), powered, watered, road);
  }
}

/** One plot of the list at its look: counted, sends out a trip now and then, grows or shrinks */
function growPlot(map: PlotScanMap & PlotListMap, list: PlotBuildings, plot: PlotBuilding, x: number, y: number,
  sim: PlotSimData, luck: Luck, powered: boolean, watered: boolean, road: { x: number; y: number } | null): void {
  const { kind, level } = plot, census = sim.census, share = plotShare(map, plot);
  if (powered) census.poweredZoneCount += PLOT_SHARE * share;
  else census.unpoweredZoneCount += PLOT_SHARE * share;
  if (kind === "residential") {
    census.resZonePop += PLOT_SHARE * share;
    census.resPop += level * share;
  } else if (kind === "commercial") {
    census.comZonePop += PLOT_SHARE * share;
    census.comPop += level * PLOT_SHARE * share;
  } else {
    census.indZonePop += PLOT_SHARE * share;
    census.indPop += level * PLOT_SHARE * share;
  }
  // A building finished going up keeps no start; one whose stage changed is drawn again (constructionShare)
  const now = sim.cityTime ?? 0;
  if (plot.since !== undefined && constructionShare(plot, now) >= 1) { delete plot.since; list.version++; }
  const grow = (to: number): void => {
    if (to < 0 || to > PLOT_TOP[kind]) return;
    // (an emptied building keeps its class: it still stands as it was built)
    const value = to === 0 ? (builtLevel(plot) > 0 ? plot.value : 0) : plotEnvironmentClass(map, sim, x, y, kind, luck);
    if (to === level && value <= plot.value) return;
    // ... and people moving back into a standing building move in; only a level above it builds anew
    setPlot(map, list, plot, to, value, to > level && to <= builtLevel(plot) ? plot.style : luck.getRandom(2), now);
    if (to !== level) ZoneUtils.incRateOfGrowth(sim.blockMaps, x, y, to > level ? 1 : -1);
  };
  // Its trips, as a tile plot's (src/plots.ts plotFound): on a real-scale city map the month's trips say where it gets
  const minutes = tripMinutes(map, x, y, kind);
  const cutOff = minutes === Infinity;
  let traffic = road ? ROUTE_FOUND : NO_ROAD_FOUND;
  const trips = kind === "commercial" && level > 0 ? level + (sim.touristTrips ?? 0) : level;
  if (trips > luck.getRandom(kind === "residential" ? 35 : 40)) {
    if (minutes !== null) traffic = road ? ROUTE_FOUND : NO_ROAD_FOUND;
    else traffic = road && sim.trafficManager ?
      sim.trafficManager.makeTrafficFrom(road.x, road.y, x, y, sim.blockMaps, DESTINATIONS[kind]) : NO_ROAD_FOUND;
    if (traffic === NO_ROAD_FOUND || (road && cutOff)) {
      grow(level - 1);
      return;
    }
  }
  const rises = plotMayRise(plot, mapEra(map as { era?: unknown }));
  if (map.plotWhy !== undefined) {
    const why = map.plotWhy ?? (map.plotWhy = new Uint8Array(map.width * map.height));
    const reason = WHY(plotWhyOf(map, x, y, sim, plot, powered, watered, traffic === NO_ROAD_FOUND || cutOff, rises));
    // (one mark a plot, at the tile it is counted at, which the checklist reads: src/plotChecklist.ts)
    const anchor = y * map.width + x;
    for (const t of list.places.get(plot.id)?.tiles ?? []) if (t !== anchor && list.shownBy.get(t) === plot.id) why[t] = 0;
    why[anchor] = reason;
  }
  // A building wider than its plot (a tile's, a lot's) takes in the plots beside it first, one at a time, as long as
  // it rises (joinNeighbour)
  const era = mapEra(map as { era?: unknown });
  const mayRise = (): boolean => {
    for (let n = 0; n < MERGE_MAX_COLUMNS && !plotMayRise(plot, era); n++) if (!joinNeighbour(map, list, plot)) return false;
    return plotMayRise(plot, era);
  };
  const bm = sim.blockMaps;
  if (kind === "residential") {
    if (level > 1 && !luck.getChance(7)) return;
    let score = sim.valves.resValve + homeScore(sim, x, y, cutOff ? NO_ROAD_FOUND : traffic) - commuteCost(minutes);
    if (!powered || (!watered && level >= 1)) score = -500;
    if (grows(score, luck)) {
      const crowd = bm.populationDensityMap.worldGet(x, y);
      if (bm.pollutionDensityMap.worldGet(x, y) <= 128 && (level === 0 || crowd > DENSITY_TO_RISE[level]) && mayRise())
        grow(level + 1);
      else if (level >= 1 && bm.pollutionDensityMap.worldGet(x, y) <= 128)
        grow(level);
    } else if (shrinks(score, luck)) {
      grow(level - 1);
    }
    return;
  }
  if (!luck.getChance(7)) return;
  const stuck = traffic === NO_ROAD_FOUND || cutOff;
  let score = (kind === "commercial" ?
    sim.valves.comValve + (stuck ? -3000 : bm.cityCentreDistScoreMap.worldGet(x, y)) :
    sim.valves.indValve + (stuck ? -1000 : 0)) - commuteCost(minutes);
  if (!powered || (!watered && level > 1)) score = -500;
  if ((watered || level === 0) && grows(score, luck)) {
    if ((kind !== "commercial" || level <= bm.landValueMap.worldGet(x, y) >> 5) && mayRise())
      grow(level + 1);
    else if (level >= 1)
      grow(level);
  } else if (shrinks(score, luck)) {
    grow(level - 1);
  }
}
