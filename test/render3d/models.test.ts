/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BoxGeometry, BufferGeometry, Group, InstancedMesh, Material, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { BUILDING_MARGIN_M, MAX_BUILDING_HEIGHT_M, MAX_MODEL_DRAW_CALLS, RIVERBED_Y, TILE_M } from '../../src/render3d/constants.js';
import { getMaterial, isLibraryMaterial, MATERIAL_KEYS, tint } from '../../src/render3d/materials/library.js';
import { thaiSign } from '../../src/render3d/materials/signs.js';
import { loadTexture } from '../../src/render3d/materials/textures.js';
import { ModelOptions, registry } from '../../src/render3d/models/registry.js';
import { seededRng } from '../../src/render3d/rng.js';
import { applyWorldUV, balconyRows, beveledBox, CatenaryCurve, catenaryWire, countDrawCalls, countTriangles, disposeModel, mergeByMaterial, visibleMeshes, windowRows } from '../../src/render3d/util/geometry.js';

function materials(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Geometry, transforms, visibility and material properties; excludes random three UUIDs. */
function fingerprint(root: Group): unknown {
  const nodes: unknown[] = [];
  root.updateMatrixWorld(true);
  root.traverse(object => {
    const base = {
      name: object.name, type: object.type, visible: object.visible,
      position: object.position.toArray(), quaternion: object.quaternion.toArray(),
      scale: object.scale.toArray(), userData: object.userData,
    };
    if (object instanceof Mesh) {
      const geometry: BufferGeometry = object.geometry;
      nodes.push({ ...base,
        index: object.geometry.index ? Array.from(object.geometry.index.array) : null,
        attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attr]) => [key, Array.from(attr.array)])),
        groups: object.geometry.groups, drawRange: object.geometry.drawRange,
        materials: materials(object).map(material => ({
          name: material.name, type: material.type,
          color: material instanceof MeshStandardMaterial ? material.color.getHex() : null,
          roughness: material instanceof MeshStandardMaterial ? material.roughness : null,
          metalness: material instanceof MeshStandardMaterial ? material.metalness : null,
        })),
      });
    } else nodes.push(base);
  });
  return nodes;
}

describe('MODEL_SPEC 9.3: every registered model', () => {
  it('has at least one registered factory', () => { expect(Object.keys(registry).length).toBeGreaterThan(0); });

  for (const [id, entry] of Object.entries(registry)) {
    describe(id, () => {
      const variants = entry.variants ?? [0];
      const states = entry.states ?? [undefined];
      const cases: ModelOptions[] = [undefined, 0, 1, 42, 4294967295].flatMap(seed =>
        variants.flatMap(variant => states.map(state => ({ seed, variant, state }))),
      );

      it('provides valid registration metadata', () => {
        expect(typeof entry.factory).toBe('function');
        entry.footprint.forEach(value => { expect(Number.isInteger(value)).toBe(true); expect(value).toBeGreaterThan(0); });
        entry.tiles.forEach(value => { expect(Number.isInteger(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1024); });
        expect(entry.budget).toBeGreaterThan(0);
        expect(Number.isInteger(entry.budget)).toBe(true);
      });

      it.each(cases)('meets the contract for %j', opts => {
        const root = entry.factory(opts);
        try {
          expect(root).toBeInstanceOf(Group);
          expect(root.name).toBe(id);
          expect(root.position.toArray()).toEqual([0, 0, 0]);
          expect(root.userData).toMatchObject({ id, category: entry.category, footprint: [...entry.footprint], tiles: [...entry.tiles], triangles: countTriangles(root) });
          root.updateMatrixWorld(true);
          const bounds = new Box3().setFromObject(root);
          expect(bounds.isEmpty()).toBe(false);
          const exempt = ['veh', 'fx', 'ui'].includes(entry.category);
          if (!exempt) {
            const tiling = entry.tiling ?? ['terrain', 'road', 'rail', 'power'].includes(entry.category);
            const margin = tiling ? 0 : BUILDING_MARGIN_M;
            const halfX = entry.footprint[0] * TILE_M / 2 - margin;
            const halfZ = entry.footprint[1] * TILE_M / 2 - margin;
            expect(bounds.min.x).toBeGreaterThanOrEqual(-halfX - 0.001);
            expect(bounds.max.x).toBeLessThanOrEqual(halfX + 0.001);
            expect(bounds.min.z).toBeGreaterThanOrEqual(-halfZ - 0.001);
            expect(bounds.max.z).toBeLessThanOrEqual(halfZ + 0.001);
            expect(bounds.max.y).toBeLessThanOrEqual(MAX_BUILDING_HEIGHT_M + 0.001);
          }
          const groundMin = entry.ground && entry.ground !== 'land' ? RIVERBED_Y : 0;
          expect(bounds.min.y).toBeGreaterThanOrEqual(groundMin - 0.01);
          expect(countTriangles(root)).toBeLessThanOrEqual(entry.budget);
          expect(countDrawCalls(root)).toBeLessThanOrEqual(MAX_MODEL_DRAW_CALLS);
          const materialUse = new Set<Material>();
          visibleMeshes(root).forEach(mesh => {
            // Repeated elements must be merged: only one visible mesh per material.
            materials(mesh).forEach(material => {
              expect(materialUse.has(material)).toBe(false);
              materialUse.add(material);
            });
          });
          root.traverse(object => {
            expect([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite)).toBe(true);
            if (object instanceof Mesh) {
              expect(object.name.startsWith(`${id}/`)).toBe(true);
              materials(object).forEach(material => expect(isLibraryMaterial(material)).toBe(true));
              const geometry: BufferGeometry = object.geometry;
              Object.values(geometry.attributes).forEach(attribute => {
                expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
              });
            }
            if (object.name.startsWith('anchor')) {
              expect(object.name).toMatch(/^anchor_(smoke|steam|fire|light|water)_\d+$/);
              expect(object).not.toBeInstanceOf(Mesh);
              expect(object.children).toHaveLength(0);
            }
            if (object.name.startsWith('anim')) expect(object.name).toMatch(/^anim_[a-zA-Z0-9_]+$/);
            if (object.name.startsWith('state')) {
              expect(object).toBeInstanceOf(Group);
              expect(object.name).toMatch(/^state_[a-zA-Z0-9_]+$/);
            }
          });
          if (entry.states?.length) {
            const stateGroups = root.children.filter(child => child.name.startsWith('state_'));
            expect(stateGroups.map(group => group.name.slice(6)).sort()).toEqual([...entry.states].sort());
            const shown = stateGroups.filter(group => group.visible);
            expect(shown).toHaveLength(1);
            expect(shown[0].name).toBe(`state_${opts.state ?? entry.states[0]}`);
          }
        } finally { disposeModel(root); }
      });

      it('repeats the same complete model for the same seed and preserves massing across seeds', () => {
        for (const variant of variants) for (const state of states) {
          const opts = { seed: 73, variant, state };
          const first = entry.factory(opts), second = entry.factory(opts), changed = entry.factory({ ...opts, seed: 789 });
          try {
            expect(fingerprint(first)).toEqual(fingerprint(second));
            expect(new Box3().setFromObject(first)).toEqual(new Box3().setFromObject(second));
            expect(countTriangles(first)).toBe(countTriangles(second));
            // Seeds may move details, but cannot change overall width, depth or height.
            const firstSize = new Box3().setFromObject(first).getSize(new Vector3());
            const changedSize = new Box3().setFromObject(changed).getSize(new Vector3());
            expect(changedSize.x).toBeCloseTo(firstSize.x, 3);
            expect(changedSize.y).toBeCloseTo(firstSize.y, 3);
            expect(changedSize.z).toBeCloseTo(firstSize.z, 3);
          } finally { [first, second, changed].forEach(disposeModel); }
        }
      });
    });
  }
});

describe('3D foundation regressions', () => {
  it('defines every specification material, caches tint and uses physical glass', () => {
    const expected = `plaster_white plaster_cream plaster_tint concrete_raw concrete_weathered brick_red roof_clay_tile roof_cement_tile roof_metal_corrugated roof_metal_rusty roof_metal_sheet wood_teak wood_painted metal_steel metal_painted roller_shutter glass_clear glass_tinted asphalt road_marking_white road_marking_yellow sidewalk_tile curb_red_white grass dirt_laterite gravel_ballast water_river water_flood foliage_tropical fabric_canvas sign_thai emissive_window`.split(' ');
    expect([...MATERIAL_KEYS].sort()).toEqual(expected.sort());
    MATERIAL_KEYS.forEach(key => { expect(getMaterial(key)).toBeInstanceOf(MeshStandardMaterial); expect(isLibraryMaterial(getMaterial(key))).toBe(true); });
    expect(getMaterial('glass_clear')).toBeInstanceOf(MeshPhysicalMaterial);
    expect(getMaterial('glass_tinted')).toBeInstanceOf(MeshPhysicalMaterial);
    expect(tint('plaster_tint', '#abcdef')).toBe(tint('plaster_tint', 0xabcdef));
    expect(tint('plaster_tint', '#abcdef')).not.toBe(getMaterial('plaster_tint'));
    expect(isLibraryMaterial(new MeshStandardMaterial())).toBe(false);
  });

  it('keeps signs and lazy textures usable without a browser', async () => {
    expect(thaiSign('ห้องว่าง')).toBe(getMaterial('sign_thai'));
    expect(await loadTexture('/assets/textures/missing/color.jpg', true)).toBeNull();
  });

  it('supports seed zero and produces reproducible unsigned samples', () => {
    const a = seededRng(0), b = seededRng(0), c = seededRng(1);
    const first = Array.from({ length: 128 }, a);
    expect(first).toEqual(Array.from({ length: 128 }, b));
    expect(first).not.toEqual(Array.from({ length: 128 }, c));
    first.forEach(value => { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1); });
  });

  it('bevels edges without changing dimensions and keeps outward normals', () => {
    const geometry = beveledBox(29, 12, 29, 0.16);
    const bounds = geometry.boundingBox!;
    expect(bounds.getSize(new Vector3()).toArray()).toEqual([29, 12, 29]);
    const position = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(position, i);
      const b = new Vector3().fromBufferAttribute(position, i + 1);
      const c = new Vector3().fromBufferAttribute(position, i + 2);
      const faceNormal = b.sub(a).cross(c.sub(a)).normalize();
      expect(faceNormal.dot(new Vector3().fromBufferAttribute(normals, i))).toBeGreaterThan(0);
    }
    expect(() => beveledBox(1, 1, 1, 0.5)).toThrow(RangeError);
    geometry.dispose();
  });

  it('repeats and merges facade rows without increasing draw calls', () => {
    const windows = windowRows({ columns: 3, rows: 2, spacingX: 3, spacingY: 3, origin: new Vector3(0, 2, 4) });
    const balconies = balconyRows({ columns: 3, rows: 2, spacingX: 3, spacingY: 3 });
    const model = mergeByMaterial('debug.rows', [
      { geometry: windows, material: getMaterial('glass_tinted') },
      { geometry: windows, material: getMaterial('glass_tinted'), transform: new Matrix4().makeTranslation(0, 6, 0) },
      { geometry: balconies, material: getMaterial('concrete_raw') },
    ]);
    expect(model.children).toHaveLength(2);
    expect(countDrawCalls(model)).toBe(2);
    expect(countTriangles(model)).toBe((windows.getAttribute('position').count * 2 + balconies.getAttribute('position').count) / 3);
    expect(new Box3().setFromObject(model).max.y).toBeGreaterThan(10);
    expect(() => windowRows({ columns: 0, rows: 1, spacingX: 1, spacingY: 1 })).toThrow(RangeError);
    disposeModel(model); windows.dispose(); balconies.dispose();
  });

  it('uses world-scale UVs with separate vertices at projection seams', () => {
    const source = new BoxGeometry(10, 4, 6).translate(10, 2, 0);
    const geometry = applyWorldUV(source, 2);
    expect(source.index).not.toBeNull();
    expect(geometry.index).toBeNull();
    const uv = geometry.getAttribute('uv');
    const values = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.max(...values)).toBe(7.5); // 15 world meters / 2 meters per repeat.
    expect(Math.min(...values)).toBe(-1.5);
    expect(() => applyWorldUV(source, 0)).toThrow(RangeError);
    source.dispose(); geometry.dispose();
  });

  it.each([0, 0.0000001, 0.01, 0.8, 3])('joins unequal-height wire endpoints with midpoint sag %s', sag => {
    const start = new Vector3(-5, 8, 2), end = new Vector3(5, 10, 2);
    const curve = new CatenaryCurve(start, end, sag);
    expect(curve.getPoint(0)).toEqual(start);
    expect(curve.getPoint(1)).toEqual(end);
    expect(curve.getPoint(0.5).y).toBeCloseTo(9 - sag, 6);
    const wire = catenaryWire(start, end, sag);
    expect(Array.from(wire.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    wire.dispose();
  });

  it('counts active states, geometry groups, draw ranges and instances', () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = getMaterial('plaster_white');
    const plain: Mesh = new Mesh(geometry, material);
    const hidden = new Group();
    hidden.visible = false;
    hidden.add(new Mesh(geometry, material));
    const instances = new InstancedMesh(geometry, material, 3);
    root.add(plain, hidden, instances, new Object3D());
    expect(countTriangles(root)).toBe(48);
    expect(countDrawCalls(root)).toBe(2);
    geometry.setDrawRange(0, 6);
    expect(countTriangles(root)).toBe(8);
    plain.material = [material, material, material, material, material, material];
    expect(countDrawCalls(root)).toBe(2);
    instances.count = 0;
    expect(countTriangles(root)).toBe(2);
    expect(countDrawCalls(root)).toBe(1);
    disposeModel(root);
  });
});
