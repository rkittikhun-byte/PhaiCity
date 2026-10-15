/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A layer of the city map laid over the 3D ground (src/render3d/city/layerOverlay.ts; owner, 15 Oct 2026): draped over
// the hills a little above them, and taken away again.

import { Mesh } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { LayerOverlay } from '../../src/render3d/city/layerOverlay.js';

const hills = { sample: (x: number, z: number) => (x + z) / 100 } as unknown as CityHeightField;

describe('city map layer on the ground', () => {
  it('lies over the whole map a little above its hills, and goes when taken away', () => {
    const overlay = new LayerOverlay(40, 30, hills);
    overlay.show({ width: 40, height: 30 } as unknown as HTMLCanvasElement);
    expect(overlay.showing).toBe(true);
    const mesh = overlay.root.children[0] as Mesh;
    const p = mesh.geometry.getAttribute('position');
    expect(p.count).toBe(41 * 31);
    // The far corner: the map's edge, over the ground there
    expect([p.getX(p.count - 1), p.getZ(p.count - 1)]).toEqual([400, 300]);
    expect(p.getY(p.count - 1)).toBeCloseTo(7 + 0.35);
    overlay.show(null);
    expect(overlay.showing).toBe(false);
    expect(overlay.root.children).toHaveLength(0);
  });

  it('keeps a big map light: a vertex every few tiles', () => {
    const overlay = new LayerOverlay(1024, 1024, hills);
    overlay.show({ width: 1024, height: 1024 } as unknown as HTMLCanvasElement);
    expect((overlay.root.children[0] as Mesh).geometry.getAttribute('position').count).toBe(257 * 257);
    overlay.dispose();
  });
});
