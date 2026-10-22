/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Frontage (docs/METRE_DRAWING_PLAN.md 3.3, art/buildings/PLAN.md "Frontage"): on a map whose zones are painted in 4 m
// cells along the roads (src/zoneCells.ts), a plot's building takes the era model that fits the painted cells running
// side by side along its road, instead of the one full-tile model squeezed onto them:
//
// - shops: one shophouse bay (ห้องแถว/ตึกแถว คูหาเดียว, 4 m) on every painted column of cells, so a run of cells is a
//   terrace: a bay whose neighbour along the road is a bay too joins it (party walls flush), the bays at a terrace's
//   ends show their end walls (`left`, `right`), a bay alone shows both (`one`), and the middle ones take turns
//   (`mid`, `mid2`) so a long terrace is not one bay repeated. A terrace runs on across plots, so one plot's bays join
//   the next plot's. The lower shop levels take the era's lower row (bay1), the higher its taller one (bay2).
// - homes: a house of 12 m (house12_1, house12_2) on a plot whose painted cells are one run of three.
// - anything else keeps the full-tile model (tileModels.ts), as before.
//
// A column is the cells one behind another from the road (rows 0-3, a plot deep), kept by where its front row's
// middle lies. A column lies on the plot tile its cells belong to (zoneCells plotTileOfCell); one on a tile that is no
// plot (too little of that tile painted) is drawn by the plot of its zone it continues along the road, the one on its
// left first, so the paint left over beside a plot is not left bare. Plain code over the map's cells: it only reads.

import type { PlotKind } from '../../plots.js';
import { cellsOf, CELL_M, type CellLayout, type CellMap } from '../../zoneCells.js';
import { frontageColumns, type FrontageColumn } from '../../plotColumns.js';
import { tileMetres, unitsPerMetre } from '../../units.js';
import { type BayPlace, type FrontageKind } from './eraBuildings.js';

export { BAY_PLACES, FRONTAGE_KINDS, type BayPlace, type FrontageKind } from './eraBuildings.js';
export { frontageColumns, type FrontageColumn } from '../../plotColumns.js';
/** A frontage building's depth, a plot's (metres), and a house's cells along the road */
export const FRONTAGE_DEPTH_M = 16;
export const HOUSE_CELLS = 3;
/** The shop levels each era draws as shophouse bays: the lower row up to the first, the taller up to the second; above
 * that the era's tile model (its office towers in eras 4 and 5) */
export const BAY_LEVELS: Readonly<Record<number, readonly [number, number]>> = { 1: [2, 4], 2: [2, 4], 3: [2, 4], 4: [1, 2], 5: [1, 2] };
/** ... and the home levels each era draws as a 12 m house (above: its walk-up flats and condominiums) */
export const HOUSE_LEVELS: Readonly<Record<number, readonly [number, number]>> = { 1: [2, 4], 2: [2, 4], 3: [1, 3], 4: [1, 3], 5: [1, 3] };
/** How many columns beside a plot that lie on no plot of their zone it draws, at most, either way */
export const ORPHAN_REACH = 3;

const ZONE_KIND: readonly (PlotKind | null)[] = [null, 'residential', 'commercial', 'industrial'];

/** Every painted column of a map, the plot whose building stands on each (-1 for none), and the columns each plot
 * draws, left to right */
export interface FrontagePlan {
  readonly cellUnits: number;
  readonly columns: readonly FrontageColumn[];
  readonly owners: Int32Array;
  readonly byOwner: ReadonlyMap<number, readonly number[]>;
}

/** One building of a plot's frontage: its era kind, its middle and turn (world units, front +Z to the road) */
export interface FrontagePiece { kind: FrontageKind; x: number; z: number; rotation: number; width: number; depth: number }

/** The columns of the painted cells (layout: the map's cells, paint: their zones by key) and who draws each */
export function frontagePlan(layout: CellLayout, paint: ReadonlyMap<number, number>, plotKindAt: (tile: number) => PlotKind | null): FrontagePlan {
  return frontageOwners(frontageColumns(layout, paint), layout.cellUnits, plotKindAt);
}

/** Who draws each column: the plot it lies on, else the plot it continues along the road (left first) */
export function frontageOwners(columns: readonly FrontageColumn[], cu: number, plotKindAt: (tile: number) => PlotKind | null): FrontagePlan {
  const owners = new Int32Array(columns.length).fill(-1);
  const kindOf = (c: FrontageColumn): PlotKind | null => ZONE_KIND[c.zone] ?? null;
  const own = (c: FrontageColumn): boolean => plotKindAt(c.tile) === kindOf(c);
  columns.forEach((c, k) => { if (own(c)) owners[k] = c.tile; });
  columns.forEach((c, k) => {
    // ... only where its tile is no plot at all: paint of one zone on another's plot is that plot's to draw
    if (owners[k] >= 0 || plotKindAt(c.tile) !== null) return;
    for (const side of ['left', 'right'] as const) {
      let j = c[side], steps = 1;
      while (j >= 0 && steps <= ORPHAN_REACH && !own(columns[j])) { j = columns[j][side]; steps++; }
      if (j >= 0 && steps <= ORPHAN_REACH && own(columns[j])) { owners[k] = columns[j].tile; break; }
    }
  });
  const byOwner = new Map<number, number[]>();
  owners.forEach((owner, k) => {
    if (owner < 0) return;
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner)!.push(k);
  });
  // ... left to right along the road
  for (const list of byOwner.values()) {
    const ref = columns[list[0]], rx = -ref.nz, rz = ref.nx;
    list.sort((a, b) => (columns[a].x * rx + columns[a].z * rz) - (columns[b].x * rx + columns[b].z * rz));
  }
  return { cellUnits: cu, columns, owners, byOwner };
}

/** A live map's columns, kept until its cells are laid again or its paint changes */
const kept = new WeakMap<object, { layout: CellLayout; version: number; columns: FrontageColumn[] }>();

/** The plan of a live map's painted cells (null when its zones are not painted in cells) */
export function mapFrontagePlan(map: CellMap, plotKindAt: (tile: number) => PlotKind | null): FrontagePlan | null {
  if (!map.cellZones || !map.zoneCells?.size) return null;
  const layout = cellsOf(map), version = map.zoneCellsVersion ?? 0;
  let found = kept.get(map);
  if (!found || found.layout !== layout || found.version !== version) {
    found = { layout, version, columns: frontageColumns(layout, map.zoneCells) };
    kept.set(map, found);
  }
  return frontageOwners(found.columns, layout.cellUnits, plotKindAt);
}

/** What a plot is to its frontage: its kind and level, and whether it is part of a 2 × 2 lot (drawn as one) */
export interface FrontagePlot { kind: PlotKind; level: number; lot: boolean; era: number }

/** Whether a plot draws shophouse bays (and which row), or a 12 m house (and which), at its era and level */
export function bayRow(plot: FrontagePlot): 1 | 2 | 0 {
  const [low, high] = BAY_LEVELS[plot.era] ?? [0, 0];
  if (plot.kind !== 'commercial' || plot.lot || plot.level < 1 || plot.level > high) return 0;
  return plot.level <= low ? 1 : 2;
}
export function houseSize(plot: FrontagePlot): 1 | 2 | 0 {
  const [low, high] = HOUSE_LEVELS[plot.era] ?? [0, 0];
  if (plot.kind !== 'residential' || plot.lot || plot.level < 1 || plot.level > high) return 0;
  return plot.level <= low ? 1 : 2;
}

/**
 * The buildings of a plot's frontage, or null when nothing fits (its full-tile model stays). metre: world units a
 * metre. plotAt: what the plot on a tile is to its frontage (null for none), for whether a neighbouring column's
 * bay joins this plot's.
 */
export function frontagePieces(plan: FrontagePlan, tile: number, plot: FrontagePlot, metre: number,
  plotAt: (tile: number) => FrontagePlot | null): FrontagePiece[] | null {
  const own = plan.byOwner.get(tile);
  if (!own?.length) return null;
  const cols = plan.columns, cu = plan.cellUnits, depth = FRONTAGE_DEPTH_M * metre;
  // From a column's front row's middle to the middle of a building a plot deep standing on the row's front edge
  const back = depth / 2 - cu / 2;
  const pose = (c: FrontageColumn): { x: number; z: number; rotation: number } =>
    ({ x: c.x + c.nx * back, z: c.z + c.nz * back, rotation: Math.atan2(-c.nx, -c.nz) });
  const row = bayRow(plot);
  if (row) {
    // A neighbouring column joins when its plot draws bays too
    const bays = (k: number): boolean => {
      if (k < 0) return false;
      const owner = plan.owners[k], other = owner >= 0 ? plotAt(owner) : null;
      return Boolean(other && bayRow(other));
    };
    return own.map(k => {
      const c = cols[k], left = bays(c.left), right = bays(c.right);
      let place: BayPlace = left && right ? 'mid' : left ? 'right' : right ? 'left' : 'one';
      if (place === 'mid') {
        // the middle bays take turns from the terrace's left end
        let steps = 0, j = c.left;
        while (j >= 0 && bays(j) && steps < 512) { steps++; j = cols[j].left; }
        place = steps % 2 ? 'mid' : 'mid2';
      }
      return { kind: `bay${row}_${place}` as FrontageKind, ...pose(c), width: cu, depth };
    });
  }
  const size = houseSize(plot);
  if (size && own.length === HOUSE_CELLS && cols[own[0]].right === own[1] && cols[own[1]].right === own[2]) {
    return [{ kind: `house12_${size}` as FrontageKind, ...pose(cols[own[1]]), width: HOUSE_CELLS * cu, depth }];
  }
  return null;
}

/** World units a metre on a cell map, and a cell's side */
export const frontageMetre = (map: CellMap): number => unitsPerMetre(tileMetres(map));
export const frontageCell = (map: CellMap): number => CELL_M * frontageMetre(map);
