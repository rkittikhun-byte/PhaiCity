/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Box3, Mesh } from 'three';
import { TileSnapshot, isRoad } from '../../src/render3d/city/tileModels.js';
import { registry } from '../../src/render3d/models/registry.js';
import { roadForMask } from '../../src/render3d/models/road/interfaces.js';
import { STAIRCASE_VARIANTS, roadDistance, roadShape, staircaseVariant } from '../../src/render3d/models/road/centreline.js';
import { LATERITE_EDGE, lateriteShape } from '../../src/render3d/models/road/laterite.js';
import { disposeModel } from '../../src/render3d/util/geometry.js';

/** A 24×16 map: a 1:1 staircase, a 1:2 one, a lone turn and a jog. */
function staircases(): TileSnapshot {
  const W = 24, s = new TileSnapshot(W, 16), set = (x: number, y: number): void => { s.values[y * W + x] = 66; };
  for (let k = 0; k < 6; k++) { set(1 + k, 8 - k); set(2 + k, 8 - k); }
  set(0, 9); set(1, 9);
  for (let k = 0, x = 10, y = 14; k < 4; k++) { set(x, y); set(x + 1, y); set(x + 2, y); x += 2; y--; }
  for (let y = 11; y < 16; y++) set(20, y);
  for (let x = 20; x < 24; x++) set(x, 11);
  for (let x = 12; x < 17; x++) set(x, 4);
  set(16, 3);
  for (let x = 16; x < 22; x++) set(x, 2);
  return s;
}
const shapeAt = (s: TileSnapshot, x: number, y: number) => {
  const steps = s.staircase(x, y);
  return lateriteShape(s.mask(x, y, isRoad), steps & 15, steps >> 4);
};
/** Road width seen from a tile at a world point: the distance to its road, capped where laterite ends. */
const reach = (s: TileSnapshot, x: number, y: number, wx: number, wz: number): number =>
  Math.min(LATERITE_EDGE, roadDistance(wx - (x + .5) * 10, wz - (y + .5) * 10, shapeAt(s, x, y)));

describe('Diagonal roads: staircases bend into diagonals and curves', () => {
  it('finds staircase steps, and which steps continue the staircase', () => {
    const s = staircases();
    // Inside the 1:1 run both sides are steps that go on; at its ends one side meets a straight road.
    expect(s.staircase(4, 6)).toBe(s.mask(4, 6, isRoad) | s.mask(4, 6, isRoad) << 4);
    expect(s.staircase(1, 9) & 15).toBe(1);
    // A 1:2 step is a pair of corners, each a step for the other only.
    expect(s.staircase(12, 14)).toBe(1);
    expect(s.staircase(12, 13)).toBe(4);
    // Lone turns and jogs through a straight tile are not staircases.
    expect(s.staircase(20, 11)).toBe(0);
    expect(s.staircase(16, 4)).toBe(0);
  });

  it('keeps map and model in step: the canonical corner, rotated into place, is the same road', () => {
    for (const mask of [3, 6, 12, 9]) for (let steps = 0; steps < 256; steps++) {
      const diagonal = steps & 15, far = steps >> 4;
      if ((diagonal & ~mask) || (far & ~diagonal)) continue;
      const pick = roadForMask(mask, 1), variant = staircaseVariant(steps, pick.quarterTurns);
      expect(STAIRCASE_VARIANTS).toContain(variant);
      const map = lateriteShape(mask, diagonal, far), model = lateriteShape(3, variant & 3, variant >> 2 & 3);
      for (const [x, z] of [[-4, -3], [1, 4.5], [3.2, -1], [0, 0], [-2.5, 2.5]]) {
        // Placement rotates by pick.rotationY about Y: map (x, z) comes from model (x cos + z sin, -x sin + z cos).
        const c = Math.cos(-pick.rotationY), n = Math.sin(-pick.rotationY);
        expect(roadDistance(x, z, map)).toBeCloseTo(roadDistance(x * c + z * n, -x * n + z * c, model), 5);
      }
    }
  });

  it('meets the tile beyond every edge exactly as wide, so no step or notch shows', () => {
    const s = staircases();
    let edges = 0;
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (isRoad(s.values[y * s.width + x]))
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (x + dx >= s.width || y + dy >= s.height || !isRoad(s.values[(y + dy) * s.width + x + dx])) continue;
        edges++;
        for (let t = 0.05; t < 10; t += 0.25) {
          const wx = dx ? (x + 1) * 10 : x * 10 + t, wz = dy ? (y + 1) * 10 : y * 10 + t;
          expect(Math.abs(reach(s, x, y, wx, wz) - reach(s, x + dx, y + dy, wx, wz))).toBeLessThan(0.12);
        }
      }
    expect(edges).toBeGreaterThan(30);
  });

  it('stays on its own tiles: no road reaches an edge with open land beyond', () => {
    const s = staircases();
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (isRoad(s.values[y * s.width + x]))
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height || isRoad(s.values[ny * s.width + nx])) continue;
        for (let t = 0.05; t < 10; t += 0.25) {
          const wx = dx ? (dx > 0 ? (x + 1) * 10 : x * 10) : x * 10 + t, wz = dy ? (dy > 0 ? (y + 1) * 10 : y * 10) : y * 10 + t;
          expect(reach(s, x, y, wx, wz)).toBeGreaterThan(LATERITE_EDGE - 0.05);
        }
      }
  });

  it('builds a diagonal 1:1 run as one straight line', () => {
    const shape = roadShape(3, 3, false, 3);
    for (const [x, z] of [[-3, -3], [0, -5], [2.5, -2.5], [4, 3]]) expect(roadDistance(x, z, shape)).toBeCloseTo(Math.abs(x - z - 5) / Math.SQRT2, 5);
  });

  it.each(['road.corner', 'road.laterite_corner'])('%s registers every staircase variant inside its tile', id => {
    expect(registry[id].variants).toEqual(STAIRCASE_VARIANTS);
    for (const variant of STAIRCASE_VARIANTS) {
      const root = registry[id].factory({ seed: 3, variant });
      try {
        const box = new Box3().setFromObject(root);
        expect(box.min.x).toBeGreaterThanOrEqual(-5.001); expect(box.max.x).toBeLessThanOrEqual(5.001);
        expect(box.min.z).toBeGreaterThanOrEqual(-5.001); expect(box.max.z).toBeLessThanOrEqual(5.001);
        // A bent asphalt corner drops the kerbs and pavements that would not fit beside the step.
        if (id === 'road.corner') {
          let kerbs = 0;
          root.traverse(node => { if (node instanceof Mesh && /curb|sidewalk/.test(String((node.material as { name?: string }).name))) kerbs++; });
          expect(kerbs > 0).toBe((variant & 3) === 0);
        }
      } finally { disposeModel(root); }
    }
  });
});
