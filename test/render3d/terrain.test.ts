/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { createHash } from 'node:crypto';
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { vegetationMix } from '../../src/render3d/regional/vegetation.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { ModelOptions, registry } from '../../src/render3d/models/registry.js';
import { createTerrain, FLOOD_LEVELS, TERRAIN_KINDS, TERRAIN_TILES } from '../../src/render3d/models/terrain/terrain.js';
import { isCanal } from '../../src/render3d/models/terrain/helpers.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { scrollWaterNormals } from '../../src/render3d/util/water-animation.js';

function digest(root: Group): string {
  const hash = createHash('sha256'); root.updateMatrixWorld(true);
  root.traverse(object => {
    hash.update(JSON.stringify([object.name, object.position.toArray(), object.scale.toArray(), object.userData]));
    if (object instanceof Mesh) Object.entries((object.geometry as BufferGeometry).attributes).forEach(([key, attribute]) => {
      hash.update(key); hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    });
  }); return hash.digest('hex');
}

function contract(root: Group): void {
  const bounds = new Box3().setFromObject(root);
  expect(bounds.min.x).toBeGreaterThanOrEqual(-5.001); expect(bounds.max.x).toBeLessThanOrEqual(5.001);
  expect(bounds.min.z).toBeGreaterThanOrEqual(-5.001); expect(bounds.max.z).toBeLessThanOrEqual(5.001);
  expect(bounds.min.y).toBeGreaterThanOrEqual(-3.001);
  expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
  const used = new Set<Material>();
  visibleMeshes(root).forEach(mesh => {
    expect(Array.isArray(mesh.material)).toBe(false); const material = mesh.material as Material;
    expect(isLibraryMaterial(material)).toBe(true); expect(used.has(material)).toBe(false); used.add(material);
  });
  const ground = root.getObjectByName(`${root.name}/ground`) as Mesh;
  expect(ground).toBeInstanceOf(Mesh);
  ground.geometry.computeBoundingBox();
  const size = ground.geometry.boundingBox!.getSize(new Vector3()); expect(size.x).toBeCloseTo(10); expect(size.z).toBeCloseTo(10);
}

/** Collect shared-edge position/UV pairs from only upward-facing surface triangles. */
function edge(root: Group, part: string, axis: 'x' | 'z', direction: number, offset = 0): number[][] {
  const mesh = root.getObjectByName(`${root.name}/${part}`) as Mesh;
  const position = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv'), normal = mesh.geometry.getAttribute('normal');
  const points: number[][] = [];
  root.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i++) {
    const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (Math.abs(p[axis] - direction * 5) > 0.001 || normal.getY(i) <= 0) continue;
    points.push([axis === 'x' ? p.z : p.x, p.y, uv.getX(i) + (axis === 'x' ? offset : 0), uv.getY(i) + (axis === 'z' ? offset : 0)]);
  }
  const unique = [...new Map(points.map(p => {
    const rounded = p.map(value => Math.round(value * 1e6) / 1e6);
    return [JSON.stringify(rounded), rounded] as const;
  })).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // Compare the actual piecewise edge, independent of redundant collinear vertices.
  return unique.filter((p, i) => {
    if (i === 0 || i === unique.length - 1) return true;
    const before = unique[i - 1], after = unique[i + 1], span = after[0] - before[0];
    if (!span) return true;
    const t = (p[0] - before[0]) / span;
    return p.some((value, axis) => Math.abs(value - (before[axis] + (after[axis] - before[axis]) * t)) > 0.00001);
  });
}

describe('Prompt 3 terrain contracts', () => {
  it('maps the exact terrain tiles and leaves shore masks to the renderer', () => {
    TERRAIN_KINDS.forEach(kind => {
      const entry = registry[`terrain.${kind}`]; expect(entry.tiles).toEqual(TERRAIN_TILES[kind]);
      expect(entry).toMatchObject({ category: 'terrain', footprint: [1, 1], budget: 1500, tiling: true, regionTier: 'R3' });
    });
    expect(TERRAIN_TILES.shore).toEqual([]);
    expect(registry['terrain.shore'].variants).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(registry['terrain.woods'].variants).toHaveLength(16);
  });

  it.each(TERRAIN_KINDS)('%s keeps finite geometry, budget, bounds and deterministic props across regions', kind => {
    for (const region of REGIONS) for (const variant of registry[`terrain.${kind}`].variants!) {
      const opts: ModelOptions = { region, variant, seed: 19, waterMask: 2 };
      const a = createTerrain(kind, opts), b = createTerrain(kind, opts);
      try {
        contract(a); expect(digest(a)).toBe(digest(b)); expect(a.userData.region).toBe(region);
        a.traverse(object => { if (object instanceof Mesh) Object.values((object.geometry as BufferGeometry).attributes).forEach(attr =>
          expect(Array.from(attr.array).every(Number.isFinite)).toBe(true)); });
      } finally { disposeModel(a); disposeModel(b); }
    }
  });

  it.each(TERRAIN_KINDS)('%s separates ground so hiding it retains all props', kind => {
    const root = createTerrain(kind, { variant: 1 });
    try {
      const ground = root.getObjectByName(`${root.name}/ground`)!;
      const before = visibleMeshes(root).length; ground.visible = false;
      expect(visibleMeshes(root).length).toBe(before - 1); expect(ground.userData.role).toBe('ground');
    } finally { disposeModel(root); }
  });

  it.each(['dirt', 'woods', 'rubble', 'radiation'] as const)('%s joins full land surfaces with world UV continuity in both axes', kind => {
    for (const axis of ['x', 'z'] as const) {
      const a = createTerrain(kind), b = createTerrain(kind, { worldOrigin: axis === 'x' ? [10, 0] : [0, 10] });
      try { expect(edge(a, 'ground', axis, 1)).toEqual(edge(b, 'ground', axis, -1)); }
      finally { disposeModel(a); disposeModel(b); }
    }
  });

  it.each(['water', 'shore', 'flood'] as const)('%s joins water normals/UVs without texture resets', kind => {
    for (const axis of ['x', 'z'] as const) {
      const a = createTerrain(kind), b = createTerrain(kind, { worldOrigin: axis === 'x' ? [10, 0] : [0, 10] });
      try { expect(edge(a, 'water', axis, 1)).toEqual(edge(b, 'water', axis, -1)); }
      finally { disposeModel(a); disposeModel(b); }
    }
  });

  it('joins compatible earth bank profiles through straight runs and inside corners', () => {
    for (const [left, right] of [[1, 1], [4, 4], [9, 3], [0, 2], [8, 0]]) {
      const a = createTerrain('shore', { variant: left, bankStyle: 'earth' }),
        b = createTerrain('shore', { variant: right, bankStyle: 'earth', worldOrigin: [10, 0] });
      try { expect(edge(a, 'ground', 'x', 1)).toEqual(edge(b, 'ground', 'x', -1)); }
      finally { disposeModel(a); disposeModel(b); }
    }
  });

  it('uses a vertical 30 cm canal wall for every opposite-bank mask, including water tiles', () => {
    for (let mask = 0; mask < 16; mask++) for (const kind of ['water', 'shore'] as const) for (const bankStyle of ['earth', 'concrete', 'brick'] as const) {
      const root = createTerrain(kind, { landMask: mask, variant: mask, bankStyle, seed: 1 });
      try {
        contract(root); expect(root.userData.canal).toBe(isCanal(mask));
        const surface = root.getObjectByName('anim_water')!; expect(surface.position.y).toBe(-0.6);
        if (isCanal(mask)) {
          expect(root.userData.bankStyle).not.toBe('earth'); expect(root.userData.waterWidth).toBe(9.4);
          // Every wall face is horizontal or vertical, never a slope that consumes canal water.
          const wall = visibleMeshes(root).find(mesh => (mesh.material as Material).name === (bankStyle === 'brick' ? 'brick_red' : 'concrete_weathered'))!;
          const normals = wall.geometry.getAttribute('normal');
          for (let i = 0; i < normals.count; i++) expect([0, 1]).toContain(Math.round(Math.abs(normals.getY(i))));
          const ground = root.getObjectByName(`${root.name}/ground`) as Mesh;
          expect(new Box3().setFromObject(ground).min.y).toBe(-3); expect(new Box3().setFromObject(ground).max.y).toBe(-3);
        }
      } finally { disposeModel(root); }
    }
  });

  it('varies riverside piers/steps deterministically without exceeding any mask budget', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) for (let mask = 0; mask < 16; mask++) {
      const root = createTerrain('shore', { seed, variant: mask });
      try { contract(root); seen.add(root.userData.riverside); } finally { disposeModel(root); }
    }
    expect([...seen].sort()).toEqual(['none', 'pier', 'steps']);
  });

  it('chooses regional species, filters mangroves away from water and keeps plantations on rows', () => {
    let mangroves = 0, rows = 0;
    for (const region of REGIONS) for (let seed = 0; seed < 12; seed++) for (const waterMask of [0, 2]) {
      const root = createTerrain('woods', { seed, region, waterMask, variant: seed & 15 });
      try {
        contract(root);
        const choices = vegetationMix(region);
        for (const tree of root.userData.trees) {
          expect(choices.some(item => item.id === tree.id)).toBe(true);
          if (tree.id === 'veg.mangrove') { mangroves++; expect(waterMask).not.toBe(0); expect(tree.x).toBe(3); }
          if (tree.row) { rows++; expect([-2.4, 0, 2.4]).toContain(tree.x); expect([-2.4, 0, 2.4]).toContain(tree.z); }
        }
      } finally { disposeModel(root); }
    }
    expect(mangroves).toBeGreaterThan(0); expect(rows).toBeGreaterThan(0);
  });

  it('extends dense trees to connected forest edges and keeps other edges sparse', () => {
    const sparse = createTerrain('woods', { variant: 0 }), dense = createTerrain('woods', { variant: 15 });
    try { expect(dense.userData.leafCards - sparse.userData.leafCards).toBe(48); expect(countTriangles(dense)).toBeGreaterThan(countTriangles(sparse)); }
    finally { disposeModel(sparse); disposeModel(dense); }
  });

  it('keeps dirt flat, raises flood to its four levels and provides water animation metadata', () => {
    const dirt = createTerrain('dirt');
    try { expect(new Box3().setFromObject(dirt.getObjectByName('terrain.dirt/ground')!).max.y).toBe(0); }
    finally { disposeModel(dirt); }
    FLOOD_LEVELS.forEach((level, variant) => {
      const root = createTerrain('flood', { variant });
      try {
        const animation = root.getObjectByName('anim_water')!; expect(animation.position.y).toBe(level);
        expect(animation.userData).toMatchObject({ kind: 'normal-scroll', surfaceY: level, velocity: [0.012, 0.007] });
      } finally { disposeModel(root); }
    });
  });

  it('scrolls a shared water normal once at absolute time, without moving geometry', () => {
    const a = createTerrain('water'), b = createTerrain('flood'), texture = new Texture();
    const materials = [a, b].map(root => (root.getObjectByName(`${root.name}/water`) as Mesh).material as MeshStandardMaterial);
    const original = materials.map(material => material.normalMap);
    try {
      materials.forEach(material => { material.normalMap = texture; }); const before = digest(a);
      scrollWaterNormals([a, b], 10); expect(texture.offset.toArray()).toEqual([0.12, 0.07]);
      scrollWaterNormals([a, b], 10); expect(texture.offset.toArray()).toEqual([0.12, 0.07]); expect(digest(a)).toBe(before);
    } finally { materials.forEach((material, i) => { material.normalMap = original[i]; }); texture.dispose(); disposeModel(a); disposeModel(b); }
  });

  it('includes a generic radiation warning and faint green emission', () => {
    const root = createTerrain('radiation');
    try {
      expect(root.userData.warning).toBe('radiation');
      const glow = visibleMeshes(root).map(mesh => mesh.material as MeshStandardMaterial).find(material => material.name.startsWith('contamination-glow'))!;
      expect(glow.emissive.g).toBeGreaterThan(glow.emissive.r); expect(glow.emissiveIntensity).toBeLessThan(0.3);
      expect(visibleMeshes(root).some(mesh => (mesh.material as Material).userData.sign?.text === 'อันตราย รังสี')).toBe(true);
    } finally { disposeModel(root); }
  });
});
