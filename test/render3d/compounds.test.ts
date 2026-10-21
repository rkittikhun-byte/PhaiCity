/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The fences round what the ruler's buildings reserve (src/render3d/city/compounds.ts) and the 3D view's tiles of a
// building turned to a slanted road (src/buildings/turnedFootprint.ts): the fence follows the reserved outline in the
// era's look, and the view draws the turned building over its turned tiles, its square's free corners as what they are.

import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { compoundGeometry, fencedBuildings } from '../../src/render3d/city/compounds.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { outlineCorners, outlineOf, outlineTiles, turnedTilesOf } from '../../src/buildings/turnedFootprint.js';
import { roadReach } from '../../src/roadGeometry.js';
import { CIVIC } from '../../src/tileValues.js';

const W = 60, H = 50, M = 16, U = 10 / 16;

function city(era: number) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M; map.paintedZones = true; map.cellZones = true; map.era = era;
  const core = new CityCore({ map, seed: 3, sandbox: true });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  const from: [number, number] = [80, 640], to: [number, number] = [880, 240];
  core.apply({ type: 'road', tool: 'road', from, to, stroke: 1 } as any);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]), tx = (to[0] - from[0]) / len, tz = (to[1] - from[1]) / len;
  const nx = -tz, nz = tx, gap = roadReach(1, U) / U + 1 + 24, px = from[0] + tx * 400, pz = from[1] + tz * 400;
  const p = { x: px + nx * gap, z: pz + nz * gap, rot: Math.atan2(-nx, -nz) };
  expect(core.apply({ type: 'build', tool: 'ruler_house', ...p, stroke: 2 } as any)).toMatchObject({ accepted: true });
  return { core, map: core.map as any, p };
}

describe('the fences round what the buildings reserve', () => {
  it.each([1, 3, 5])('in era %i follow the turned outline, round its middle, no further', era => {
    const { map, p } = city(era);
    expect(fencedBuildings(map).map(b => b.tool)).toEqual(['ruler_house']);
    const g = compoundGeometry(map, U, () => 0)!;
    expect(g).not.toBeNull();
    g.computeBoundingBox();
    const box = g.boundingBox!, corners = outlineCorners(outlineOf(p.x, p.z, p.rot, 3, M));
    const xs = corners.map(c => c[0] * U), zs = corners.map(c => c[1] * U);
    // the posts and rails (a hedge in era 5) stand on the outline, half a post or a hedge's width either side at most
    const slack = (era === 5 ? 0.5 : 0.2) * U;
    expect(box.min.x).toBeGreaterThan(Math.min(...xs) - slack - 1);
    expect(box.max.x).toBeLessThan(Math.max(...xs) + slack + 1);
    expect(box.min.z).toBeGreaterThan(Math.min(...zs) - slack - 1);
    expect(box.max.z).toBeLessThan(Math.max(...zs) + slack + 1);
    expect(box.max.y).toBeLessThan(1.3 * U);
    g.dispose();
  });

  it('the view draws a turned building over its turned tiles, its square\'s corners past them as their own', () => {
    const { map, p } = city(2);
    const snapshot = new TileSnapshot(W, H); snapshot.source = map; snapshot.sync(map); snapshot.coverZones();
    const b = map.buildings.all().find((x: any) => x.tool === 'ruler_house');
    const own = turnedTilesOf(map, b.tile, CIVIC)!;
    for (const i of own) expect((snapshot as any).coverage[i]).toBe(b.tile);
    const inside = new Set(outlineTiles(outlineOf(p.x, p.z, p.rot, 3, M), W, H, M));
    const cx = b.tile % W, cy = Math.floor(b.tile / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (cy + dy) * W + cx + dx;
      if (!inside.has(i)) expect((snapshot as any).coverage[i]).not.toBe(b.tile);
    }
  });
});
