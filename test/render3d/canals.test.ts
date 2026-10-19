/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Canals in 3D (src/render3d/city/canals.ts, models/water/canal.ts, docs/CANALS.md): each level's water and banks
// along the canal's line, what stands along it, the rest of the view reading its tiles as ground, and the gallery piece.

import { InstancedMesh, Mesh } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { besideCanal, CANAL_DETAIL_DISTANCE, canalLand, CityCanals } from '../../src/render3d/city/canals.js';
import type { CityMapReader } from '../../src/render3d/city/types.js';
import { buildCanals, canalHalfWidth, createCanalPiece, cutAround } from '../../src/render3d/models/water/canal.js';

const flat = { sample: () => 0 } as unknown as CityHeightField;
const W = 40, H = 40, RIVER = 2, WOODS = 30;

interface TestMap extends CityMapReader { canals: Uint8Array; canalsVersion: number; values: Uint16Array; landCover?: Uint8Array }
function newMap(): TestMap {
  const values = new Uint16Array(W * H);
  return { width: W, height: H, values, canals: new Uint8Array(W * H), canalsVersion: 0,
    getTileValue: (x, y) => values[y * W + x], getTileFlags: () => 0 };
}
/** A canal of one level along a row or a column of tiles */
function dig(map: TestMap, cells: Array<[number, number]>, level: number): void {
  for (const [x, y] of cells) { map.values[y * W + x] = RIVER; map.canals[y * W + x] = level; }
  map.canalsVersion++;
}
const column = (x: number, y0: number, y1: number): Array<[number, number]> =>
  Array.from({ length: y1 - y0 + 1 }, (_, k): [number, number] => [x, y0 + k]);
const row = (y: number, x0: number, x1: number): Array<[number, number]> =>
  Array.from({ length: x1 - x0 + 1 }, (_, k): [number, number] => [x0 + k, y]);

function meshes(view: CityCanals): { surfaces: Mesh[]; details: Map<string, number> } {
  const surfaces: Mesh[] = [], details = new Map<string, number>();
  view.root.traverse((object) => {
    if (object instanceof InstancedMesh) details.set(object.name.split('/')[1], (details.get(object.name.split('/')[1]) ?? 0) + object.count);
    else if (object instanceof Mesh) surfaces.push(object);
  });
  return { surfaces, details };
}

describe('canals in 3D', () => {
  test('the rest of the view reads a canal as ground, and the woods and land cover beside it as plain', () => {
    const map = newMap();
    map.values[5 * W + 9] = WOODS; map.values[5 * W + 20] = WOODS; map.values[30 * W + 30] = RIVER;
    map.landCover = new Uint8Array(W * H).fill(3);
    dig(map, column(10, 2, 12), 1);
    const land = canalLand(map);
    expect(land.getTileValue(10, 5)).toBe(0);
    expect(land.getTileValue(9, 5)).toBe(0);
    expect(land.getTileValue(20, 5)).toBe(WOODS);
    expect(land.getTileValue(30, 30)).toBe(RIVER);
    const cover = (land as unknown as { landCover: Uint8Array }).landCover;
    expect([cover[5 * W + 10], cover[5 * W + 11], cover[5 * W + 12]]).toEqual([0, 0, 3]);
    expect(land.width).toBe(W);
    // ... by index too, with its flags, as the view's quick look reads tiles (TileSnapshot.sync)
    const flagged = { ...map, rawTileAt: (i: number) => map.values[i] | 0x2000 };
    const quick = canalLand(flagged as unknown as TestMap);
    expect(quick.rawTileAt!(5 * W + 10)).toBe(0x2000);
    expect(quick.rawTileAt!(5 * W + 20)).toBe(WOODS | 0x2000);
    expect(besideCanal({ width: W, height: H, source: map }, 5 * W + 11)).toBe(true);
    expect(besideCanal({ width: W, height: H, source: map }, 5 * W + 12)).toBe(false);
  });

  test('each level has its own banks and its own things along it', () => {
    const expected: Array<[number, string, string]> = [
      [1, 'vertex-finish-dirt_laterite', 'mound'], [2, 'vertex-finish-grass', 'pile'],
      [3, 'vertex-finish-concrete_weathered', 'step'], [4, 'vertex-finish-sidewalk_tile', 'lamp'],
      [5, 'vertex-finish-brick_red', 'tree'],
    ];
    for (const [level, surface, detail] of expected) {
      const map = newMap();
      dig(map, column(20, 2, 36), level);
      const view = new CityCanals(map, flat, () => 0.625);
      const changed = view.update(100);
      expect(changed.length).toBeGreaterThan(35);
      const { surfaces, details } = meshes(view);
      expect(surfaces.some((mesh) => mesh.name.includes(surface))).toBe(true);
      expect(surfaces.filter((mesh) => mesh.name.startsWith('canals/water'))).toHaveLength(1);
      expect(details.get(detail)).toBeGreaterThan(0);
      if (level === 5) { expect(details.get('boat')).toBeGreaterThan(0); expect(details.get('salaRoof')).toBeGreaterThan(0); }
      // Nothing changed since: nothing drawn again
      expect(view.update(100)).toEqual([]);
      view.dispose();
    }
  });

  test('the water faces up, lies just above the ground and stays inside the canal', () => {
    const map = newMap();
    dig(map, column(20, 2, 36), 3);
    const view = new CityCanals(map, flat, () => 0.625);
    view.update(100);
    const water = meshes(view).surfaces.find((mesh) => mesh.name.startsWith('canals/water'))!;
    const p = water.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), az = p.getZ(i);
      const ny = (p.getZ(i + 1) - az) * (p.getX(i + 2) - ax) - (p.getX(i + 1) - ax) * (p.getZ(i + 2) - az);
      expect(ny).toBeGreaterThan(0);
    }
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBeCloseTo(0.05, 5);
      expect(Math.abs(p.getX(i) - 205)).toBeLessThanOrEqual(3.5 * 0.625 + 1e-6);
    }
    view.dispose();
  });

  test('a square end is closed by a bank, a canal meeting a river opens through a sluice gate', () => {
    const map = newMap();
    dig(map, column(10, 5, 20), 3);
    for (let x = 5; x <= 15; x++) map.values[21 * W + x] = RIVER;
    map.canalsVersion++;
    const view = new CityCanals(map, flat, () => 0.625);
    view.update(100);
    const { surfaces, details } = meshes(view);
    expect(details.get('gatePier')).toBe(2);
    expect(details.get('gate')).toBe(1);
    // The dead end at the top: concrete closes it across the canal, north of the water's end
    const concrete = surfaces.find((mesh) => mesh.name.includes('concrete_weathered'))!;
    const p = concrete.geometry.getAttribute('position');
    let north = Infinity;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - 105) < 1) north = Math.min(north, p.getZ(i));
    expect(north).toBeLessThan(55);
    view.dispose();
  });

  test('where canals meet, their water fills the middle', () => {
    const map = newMap();
    dig(map, row(20, 5, 35), 4);
    dig(map, column(20, 21, 35), 4);
    const view = new CityCanals(map, flat, () => 0.625);
    view.update(100);
    const water = meshes(view).surfaces.find((mesh) => mesh.name.startsWith('canals/water'))!;
    const p = water.geometry.getAttribute('position');
    // Some water triangle covers the junction's middle, (205, 205)
    let covered = false;
    for (let i = 0; i < p.count && !covered; i += 3) {
      const [ax, az, bx, bz, cx, cz] = [p.getX(i), p.getZ(i), p.getX(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getZ(i + 2)];
      const side = (x1: number, z1: number, x2: number, z2: number) => (x2 - x1) * (205 - z1) - (z2 - z1) * (205 - x1);
      const s1 = side(ax, az, bx, bz), s2 = side(bx, bz, cx, cz), s3 = side(cx, cz, ax, az);
      covered = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
    }
    expect(covered).toBe(true);
    view.dispose();
  });

  test('small things are hidden far away', () => {
    const map = newMap();
    dig(map, column(20, 2, 36), 5);
    const view = new CityCanals(map, flat, () => 0.625);
    view.update(100);
    const details = view.root.getObjectByName('canal_details')!;
    expect(details.visible).toBe(true);
    view.update(CANAL_DETAIL_DISTANCE + 1);
    expect(details.visible).toBe(false);
    view.dispose();
  });

  test('lines are cut round the places canals meet', () => {
    const parts = cutAround([[0, 0], [10, 0], [20, 0], [30, 0]], [[15, 0]], 4);
    expect(parts).toHaveLength(2);
    expect(parts[0][parts[0].length - 1][0]).toBeCloseTo(11, 2);
    expect(parts[1][0][0]).toBeCloseTo(19, 2);
  });

  test('a canal stays as wide as its level, banks and all', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const build = buildCanals([{ points: [[0, -20], [0, 20]], level }], [], { metre: 1, ground: () => 0 });
      let widest = 0;
      for (const sink of build.surfaces.values()) for (let i = 0; i < sink.positions.length; i += 3) widest = Math.max(widest, Math.abs(sink.positions[i]));
      expect(widest).toBeCloseTo(canalHalfWidth(level), 5);
    }
  });

  test('the gallery piece is the level asked for', () => {
    for (const level of [1, 5]) {
      const piece = createCanalPiece({ variant: level });
      expect(piece.userData.level).toBe(level);
      expect(piece.userData.triangles).toBeGreaterThan(0);
    }
  });
});
