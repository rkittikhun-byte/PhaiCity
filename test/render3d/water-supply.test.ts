/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync } from 'fs';
import { Box3, Group, Material } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { WATER_WORKS_ID, WATER_WORKS_SIGN, WATER_WORKS_TILES, WATER_WORKS_TOWER_TOP } from '../../src/render3d/models/water/water-works.js';
import { WATER_TOWER_COLORS, WATER_TOWER_ID, WATER_TOWER_SIGN, WATER_TOWER_TILES } from '../../src/render3d/models/water/water-tower.js';
import { REGIONS } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { TILE_TABLE, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { BULLBIT, BURNBIT, POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { MINE, ROADS, WATER_TOWER, WATER_WORKS, WATER_WORKS_BASE, WATER_WORKS_LAST } from '../../src/tileValues.js';

interface Component { role: string; min: number[]; max: number[] }
const roles = (root: Group): Set<string> => new Set((root.userData.components as Component[]).map(c => c.role));
const signs = (root: Group): string[] => visibleMeshes(root).map(mesh => (mesh.material as Material).userData.signAtlas)
  .filter(Boolean).flatMap((atlas: { text: string }[]) => atlas.map(sign => sign.text));
const materials = (root: Group): string[] => visibleMeshes(root).map(mesh => String((mesh.material as Material).userData.materialKey));

describe('water supply registrations (RENDERER_SPEC 6C)', () => {
  it('claims the water works\' nine tiles and the water tower\'s one, as R3 services', () => {
    expect(WATER_WORKS_TILES).toEqual(Array.from({ length: WATER_WORKS_LAST - WATER_WORKS_BASE + 1 }, (_, i) => WATER_WORKS_BASE + i));
    expect(WATER_WORKS_TILES[4]).toBe(WATER_WORKS);
    expect(WATER_TOWER_TILES).toEqual([WATER_TOWER]);
    expect(registry[WATER_WORKS_ID]).toMatchObject({ category: 'services', footprint: [3, 3], tiles: WATER_WORKS_TILES, regionTier: 'R3',
      budget: TRIANGLE_BUDGETS.lowRise });
    expect(registry[WATER_TOWER_ID]).toMatchObject({ category: 'services', footprint: [1, 1], tiles: WATER_TOWER_TILES, regionTier: 'R3',
      budget: TRIANGLE_BUDGETS.prop });
  });

  it('resolves those tiles in the city\'s tile table and leaves the other extended 3 × 3s generic', () => {
    for (const value of WATER_WORKS_TILES) expect(TILE_TABLE[value]).toMatchObject({ id: WATER_WORKS_ID, kind: 'services', footprint: [3, 3] });
    expect(TILE_TABLE[WATER_TOWER]).toMatchObject({ id: WATER_TOWER_ID, kind: 'services', footprint: [1, 1] });
    for (const value of [MINE - 4, MINE, 1000, 1009]) expect(TILE_TABLE[value]).toMatchObject({ id: null, kind: 'services', footprint: [3, 3] });
  });

  it('never draws from Math.random', () => {
    for (const file of ['builder.ts', 'water-works.ts', 'water-tower.ts']) {
      expect(readFileSync(`src/render3d/models/water/${file}`, 'utf8')).not.toMatch(/Math\.random/);
    }
  });
});

describe.each([[WATER_WORKS_ID, 14.5], [WATER_TOWER_ID, 4.5]] as const)('%s', (id, half) => {
  it('fits its footprint, budget and batches in every region and seed, with the same shape', () => {
    const sizes = new Set<string>();
    for (const region of REGIONS) for (const seed of [0, 1, 2, 3, 42]) {
      const root = registry[id].factory({ region, seed });
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.x).toBeLessThanOrEqual(half + 0.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.z).toBeLessThanOrEqual(half + 0.001);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(countTriangles(root)).toBeLessThanOrEqual(registry[id].budget);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const used = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true); expect(used.has(material)).toBe(false); used.add(material);
        });
        expect(root.userData).toMatchObject({ id, region, regionTier: 'R3', entranceFacing: '+Z' });
        // Region and seed tint the paint and turn the trees; the buildings keep their size and place.
        const buildings = (root.userData.components as Component[]).filter(c => !['trees', 'hedge', 'shrubs'].includes(c.role));
        sizes.add(JSON.stringify(buildings.map(c => [c.role, ...c.min, ...c.max].map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v))));
      } finally { disposeModel(root); }
    }
    expect(sizes.size).toBe(1);
  });

  it('repeats exactly for a seed', () => {
    const a = registry[id].factory({ seed: 9 }), b = registry[id].factory({ seed: 9 });
    try {
      expect(countTriangles(a)).toBe(countTriangles(b));
      expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
      expect(materials(a)).toEqual(materials(b));
    } finally { disposeModel(a); disposeModel(b); }
  });
});

describe('the water works', () => {
  it('treats water from the aerator to the elevated tank, with its chemicals, pumps, mains, gate and fence', () => {
    const root = registry[WATER_WORKS_ID].factory({ seed: 1 });
    try {
      const have = roles(root);
      for (const role of ['aerator', 'flocculation-channel', 'clarifier', 'filters', 'clear-water-tank', 'pump-house',
        'chemical-building', 'elevated-tank', 'mains', 'raw-water-main', 'roads', 'gate', 'fence', 'trees']) {
        expect([role, have.has(role)]).toEqual([role, true]);
      }
      expect(materials(root)).toEqual(expect.arrayContaining(['water_river', 'roof_metal_corrugated']));
      expect(signs(root)).toEqual(expect.arrayContaining([WATER_WORKS_SIGN, 'การประปา', 'อาคารสูบน้ำ', 'อาคารสารเคมี', 'ถังน้ำใส', 'ถังกรองน้ำ']));
      const bounds = new Box3().setFromObject(root);
      expect(bounds.max.y).toBeCloseTo(WATER_WORKS_TOWER_TOP, 0);
      expect(root.userData).toMatchObject({ centerTile: WATER_WORKS, signText: WATER_WORKS_SIGN });
      const tower = (root.userData.components as Component[]).find(c => c.role === 'elevated-tank')!;
      expect(tower.max[1]).toBeGreaterThan(15);
    } finally { disposeModel(root); }
  });
});

describe('the water tower', () => {
  it('stands a painted tank on a concrete frame with a caged ladder, mains, a pump, a fence and its sign', () => {
    const colors = new Set<number>();
    for (let seed = 0; seed < 8; seed++) {
      const root = registry[WATER_TOWER_ID].factory({ seed });
      try {
        const have = roles(root);
        for (const role of ['pad', 'frame', 'tank', 'ladder', 'mains', 'filter-and-pump', 'fence', 'sign-board']) expect([role, have.has(role)]).toEqual([role, true]);
        expect(signs(root)).toEqual([WATER_TOWER_SIGN, WATER_TOWER_SIGN]);
        expect(WATER_TOWER_COLORS).toContain(root.userData.tankColor);
        colors.add(root.userData.tankColor);
        const bounds = new Box3().setFromObject(root);
        expect(bounds.max.y).toBeGreaterThan(12); expect(bounds.max.y).toBeLessThan(16);
        expect(root.children.filter(child => child.name.startsWith('anchor_')).map(child => child.name)).toEqual(['anchor_light_0']);
      } finally { disposeModel(root); }
    }
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('water buildings in the city view', () => {
  const W = 16;
  function city(roads: readonly (readonly [number, number])[]) {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(5 + dy) * W + 5 + dx] = WATER_WORKS_BASE + (dy + 1) * 3 + dx + 1;
    flags[5 * W + 5] = ZONEBIT | POWERBIT;
    values[11 * W + 11] = WATER_TOWER; flags[11 * W + 11] = BURNBIT | BULLBIT;
    for (const [x, y] of roads) values[y * W + x] = ROADS;
    const map = { width: W, height: W, getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x] };
    const snapshot = new TileSnapshot(W, W); snapshot.sync(map);
    return snapshot;
  }

  it('places the water works once over its 3 × 3 and the tower on its tile', () => {
    const snapshot = city([]);
    expect(snapshot.placement(5 * W + 5, 'central')).toMatchObject({ id: WATER_WORKS_ID, kind: 'services', footprint: [3, 3], x: 55, z: 55, rotation: 0, powered: true });
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) expect(snapshot.placement((5 + dy) * W + 5 + dx, 'central')).toBeNull();
    expect(snapshot.placement(11 * W + 11, 'central')).toMatchObject({ id: WATER_TOWER_ID, kind: 'services', footprint: [1, 1], x: 115, z: 115, rotation: 0 });
  });

  it('turns the works\' gate and the tower\'s ladder toward their roads', () => {
    const snapshot = city([[7, 4], [7, 5], [7, 6], [11, 10]]);
    expect(snapshot.placement(5 * W + 5, 'central')!.rotation).toBeCloseTo(Math.PI / 2);
    expect(snapshot.placement(11 * W + 11, 'central')!.rotation).toBeCloseTo(Math.PI);
    const west = city([[3, 5], [10, 11]]);
    expect(west.placement(5 * W + 5, 'central')!.rotation).toBeCloseTo(-Math.PI / 2);
    expect(west.placement(11 * W + 11, 'central')!.rotation).toBeCloseTo(-Math.PI / 2);
    expect(west.roadSide(11, 11, 1)).toBe(3);
  });
});
