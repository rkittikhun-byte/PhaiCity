/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The zone cells in the 3D view (src/render3d/city/zoneCellsView.ts) show no grid of tiles or cells (owner, 21 Oct 2026:
// "ทำไมยังเห็นรอยเป็นช่องๆ อยู่ เราไม่ได้สร้างตามช่องแล้วไม่ใช่เหรอ?"): with a brush in hand only the strip it would paint
// under it (src/zoneCells.ts cellsInStrip), soft in its colour; with a road tool, nothing; the painted cells as painted.

import { InstancedMesh, type Object3D } from 'three';
import { ZoneCellsView } from '../../src/render3d/city/zoneCellsView.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { cellAt, cellsInStrip, cellsOf } from '../../src/zoneCells';
import { showsZoneGrid } from '../../src/drawModes';

const U = 10 / 16;
const flat = { sampleTile: () => 0, sample: () => 0 } as unknown as CityHeightField;

function city() {
  const map = (MapGenerator as any).fromPresetCells(80, 60, new Uint8Array(80 * 60));
  Object.assign(map, { tileSizeM: 16, paintedZones: true, cellZones: true });
  const core = new CityCore({ sandbox: true, map, seed: 3 });
  core.simulation.budget.setFunds(500000);
  (core.map as any).needsRulerHouse = false;
  expect(core.apply({ type: 'road', tool: 'road', from: [100, 300], to: [1100, 520], stroke: 1 }).accepted).toBe(true);
  return core;
}

/** The meshes of cells the layer draws now, and how many cells each */
const drawn = (root: Object3D): number[] => {
  const counts: number[] = [];
  root.traverse((o) => { if (o instanceof InstancedMesh && o.visible) counts.push(o.count); });
  return counts;
};

describe('the zone cells in 3D', () => {
  test('show nothing of the empty cells: with a road tool nothing at all, with a brush only the strip under it', () => {
    const core = city(), map = core.map as any, view = new ZoneCellsView(map, flat);
    try {
      // No tool, or a road, rail or canal tool: no grid of cells or tiles
      for (const tool of [null, 'road', 'road_asphalt', 'rail', 'canal']) expect([tool, showsZoneGrid(tool)]).toEqual([tool, false]);
      view.update(null, null);
      expect(drawn(view.root)).toEqual([]);
      // A brush: the strip it would paint where it points, and nothing else
      view.show(true);
      const point = { x: 650 * U / 10, y: 428 * U / 10 }, layout = cellsOf(map);
      const strip = cellsInStrip(layout, map.width, null, [point.x * 10, point.y * 10]);
      expect(cellAt(layout, map.width, point.x * 10, point.y * 10)).not.toBeNull();
      view.update(point, '#e0b020', strip);
      expect(drawn(view.root)).toEqual([strip.length]);
      expect(strip.length).toBeLessThan(layout.cells.length / 10);
      // Painted cells show as painted, the brush's strip besides
      expect(core.apply({ type: 'zoneCells', zone: 'industrial', cells: strip }).accepted).toBe(true);
      view.show(false);
      view.update(null, null);
      expect(drawn(view.root)).toEqual([strip.length]);
    } finally { view.dispose(); }
  });
});
