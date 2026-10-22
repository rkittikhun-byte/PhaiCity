/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The columns of painted cells along the roads (docs/NO_GRID_PLAN.md 3B.1): on a map whose zones are painted in 4 m cells
// (src/zoneCells.ts), a column is the cells one behind another from the road, rows 0-3, a plot deep, kept by where its
// front row's middle lies; its zone is the paint most of its cells have. The columns side by side along a road, each
// with the next of its zone on its left and right, are what plots are made of (src/plotBuildings.ts) and what the 3D
// view's frontage stands on (src/render3d/city/frontage.ts). Moved here from the view, which only reads, so the
// simulation forms its plots from the same columns the player sees. Plain code, no DOM, nothing random.

import type { CellLayout } from "./zoneCells";

/** A column of painted cells */
export interface FrontageColumn {
  /** Its front row's middle (world units), whether or not that cell was laid, and the unit normal away from the road */
  x: number; z: number; nx: number; nz: number;
  /** The zone its paint is (zoneCells codes: 1 homes, 2 shops, 3 factories) */
  zone: number;
  /** The plot tile its cells belong to */
  tile: number;
  /** The column of the same zone next to it along the road, on its left and right as seen from the road (a building's
   * -X and +X), -1 for none */
  left: number; right: number;
}

/** The columns of the painted cells and their neighbours along the road: they change only with the roads and the
 * paint, so a live map keeps them while its plots grow */
export function frontageColumns(layout: CellLayout, paint: ReadonlyMap<number, number>): FrontageColumn[] {
  const cu = layout.cellUnits, columns: FrontageColumn[] = [];
  const tileOf = new Map<number, number>();
  for (const [tile, list] of layout.byPlotTile) for (const index of list) tileOf.set(index, tile);
  // Columns kept in buckets a cell wide by where their front row's middle lies
  const buckets = new Map<string, number[]>();
  const bucketKey = (x: number, z: number): string => `${Math.floor(x / cu)},${Math.floor(z / cu)}`;
  const near = (x: number, z: number, nx: number, nz: number, reach: number): number => {
    let best = -1, bestD = reach;
    const bx = Math.floor(x / cu), bz = Math.floor(z / cu);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const k of buckets.get(`${bx + dx},${bz + dz}`) ?? []) {
      const c = columns[k];
      if (c.nx * nx + c.nz * nz < 0.8) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  };
  const counts: number[][] = [], fronts: number[][] = [];
  layout.cells.forEach((cell, index) => {
    const code = paint.get(cell.key);
    if (!code || (cell.span ?? 1) < 1) return;
    const tile = tileOf.get(index);
    if (tile === undefined) return;
    const x = cell.x - cell.nx * cell.row * cu, z = cell.z - cell.nz * cell.row * cu;
    let k = near(x, z, cell.nx, cell.nz, 0.3 * cu);
    if (k < 0) {
      k = columns.length;
      columns.push({ x, z, nx: cell.nx, nz: cell.nz, zone: 0, tile, left: -1, right: -1 });
      counts.push([0, 0, 0, 0]); fronts.push([99, 99, 99, 99]);
      const key = bucketKey(x, z);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(k);
    }
    counts[k][code]++;
    fronts[k][code] = Math.min(fronts[k][code], cell.row);
  });
  // Its zone: the paint most of its cells have, the front one's when as many
  columns.forEach((c, k) => {
    let best = 1;
    for (let code = 2; code <= 3; code++) {
      if (counts[k][code] > counts[k][best] || counts[k][code] === counts[k][best] && fronts[k][code] < fronts[k][best]) best = code;
    }
    c.zone = best;
  });
  // Its neighbours along the road: the nearest column of its zone a cell to its right, and back
  columns.forEach((c, k) => {
    const rx = -c.nz, rz = c.nx, j = near(c.x + rx * cu, c.z + rz * cu, c.nx, c.nz, 0.35 * cu);
    if (j < 0 || j === k || columns[j].zone !== c.zone) return;
    const other = columns[j];
    if (other.left >= 0) {
      const was = columns[other.left];
      if (Math.hypot(was.x - other.x, was.z - other.z) <= Math.hypot(c.x - other.x, c.z - other.z)) return;
      was.right = -1;
    }
    other.left = k; c.right = j;
  });
  return columns;
}
