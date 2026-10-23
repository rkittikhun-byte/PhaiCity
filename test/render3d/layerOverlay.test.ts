/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A layer of the city map laid over the 3D ground (src/render3d/city/layerOverlay.ts; owner, 15 Oct 2026): draped over
// the hills a little above them, and taken away again.

import { LinearFilter, Mesh, type MeshBasicMaterial } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { LayerOverlay, softenPixels } from '../../src/render3d/city/layerOverlay.js';

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
    expect((overlay.root.children[0] as Mesh).geometry.getAttribute('position').count).toBe(513 * 513);
    overlay.dispose();
  });
  // Playtest, 23 Oct 2026: on a big map the pad under a building and its bank poked through the layer between its points
  it('follows ground levelled under a building finely, where the coarse points would pass under it', () => {
    const pad = (x: number, z: number) => x >= 100 && x < 110 && z >= 100 && z < 110 ? 3 : 0;
    const ground = { sample: pad, levelled: (i: number) => i === 10*1024+10 } as unknown as CityHeightField;
    const overlay = new LayerOverlay(1024, 1024, ground);
    overlay.show({ width: 1024, height: 1024 } as unknown as HTMLCanvasElement);
    const p = (overlay.root.children[0] as Mesh).geometry.getAttribute('position');
    expect(p.count).toBeGreaterThan(513 * 513);
    let over = 0;
    for (let k = 513 * 513; k < p.count; k++) if (pad(p.getX(k), p.getZ(k)) > 0) { over++; expect(p.getY(k)).toBeCloseTo(3.35); }
    expect(over).toBeGreaterThan(0);
    overlay.dispose();
  });

  it("lies on the ground's own tile corners on a city map 480 tiles a side, so no bulge between its points pokes through", () => {
    const overlay = new LayerOverlay(480, 480, hills);
    overlay.show({ width: 480, height: 480 } as unknown as HTMLCanvasElement);
    expect((overlay.root.children[0] as Mesh).geometry.getAttribute('position').count).toBe(481 * 481);
    overlay.dispose();
  });

  it('is drawn smoothly between the tiles, with no tile squares in it (docs/NO_GRID_PLAN.md 0.6)', () => {
    const overlay = new LayerOverlay(40, 30, hills);
    overlay.show({ width: 40, height: 30 } as unknown as HTMLCanvasElement);
    const texture = ((overlay.root.children[0] as Mesh).material as MeshBasicMaterial).map!;
    expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.minFilter).toBe(LinearFilter);
    overlay.dispose();
  });

  it('softens a block of colour into a gradient that fades into clear ground, not into black', () => {
    // A red block 8 tiles across (a value kept 8 x 8 tiles at a time) in a clear picture
    const w = 24, h = 24, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) data.set([200, 40, 30, 255], (y * w + x) * 4);
    softenPixels(data, w, h);
    const at = (x: number, y: number) => Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
    // Its middle stays as it was; its edge is half seen; a few tiles out it is clear
    expect(at(12, 12)[3]).toBeGreaterThan(250);
    expect(at(8, 12)[3]).toBeGreaterThan(80);
    expect(at(8, 12)[3]).toBeLessThan(200);
    expect(at(3, 12)[3]).toBe(0);
    // ... and from the middle out the opacity only falls, a step of at most a third at a time
    for (let x = 12; x > 4; x--) {
      expect(at(x - 1, 12)[3]).toBeLessThanOrEqual(at(x, 12)[3]);
      expect(at(x, 12)[3] - at(x - 1, 12)[3]).toBeLessThan(90);
    }
    // ... and where it is seen at all it keeps its colour
    expect(at(6, 12)[0]).toBeGreaterThan(190);
  });
});
