/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The open land's covers on a real-scale city map (scripts/geo/lib/landCover.mjs, docs/GAME_PLAN.md phase 4): paddy,
// upland fields and wetland are their own looks of terrain.dirt, inside a tile's budget, the same for the same seed,
// and the city view picks them from the map's landCover.
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { LAND_COVER_STATES } from '../../src/render3d/models/terrain/terrain.js';
import { registry } from '../../src/render3d/models/registry.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { countDrawCalls, countTriangles, disposeModel } from '../../src/render3d/util/geometry.js';

const dirt = registry['terrain.dirt'];

describe('land cover', () => {
  test.each(['grass', 'paddy', 'field', 'orchard', 'wetland', 'village'])('%s is a tile of open land within budget', state => {
    for (const variant of [0, 1, 2, 3]) {
      const a = dirt.factory({ seed: 3, variant, state, region: 'northeast' });
      const b = dirt.factory({ seed: 3, variant, state, region: 'northeast' });
      expect(a.name).toBe('terrain.dirt');
      expect(countTriangles(a)).toBeLessThanOrEqual(TRIANGLE_BUDGETS.tile);
      expect(countTriangles(a)).toBe(countTriangles(b));
      expect(countDrawCalls(a)).toBeLessThanOrEqual(4);
      disposeModel(a); disposeModel(b);
    }
  });

  test('paddy, field and wetland look different from a meadow', () => {
    const triangles = (state: string) => { const m = dirt.factory({ seed: 1, variant: 0, state }); const n = countTriangles(m); disposeModel(m); return n; };
    const meadow = triangles('grass');
    expect(new Set([meadow, triangles('paddy'), triangles('field'), triangles('wetland')]).size).toBe(4);
  });

  test('the city view takes each open tile\'s look from the map\'s land cover', () => {
    const width = 4, height = 1, values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
    const map = { width, height, paintedZones: true, landCover: new Uint8Array([1, 2, 5, 0]),
      getTileValue: (x: number, y: number) => values[y * width + x], getTileFlags: (x: number, y: number) => flags[y * width + x] };
    const snapshot = new TileSnapshot(width, height);
    snapshot.source = map as never; snapshot.sync(map as never);
    expect([0, 1, 2, 3].map(i => snapshot.placement(i, 'northeast')?.options.state))
      .toEqual(['paddy', 'field', 'wetland', 'grass']);
    expect(LAND_COVER_STATES[6]).toBe('village');
  });
});
