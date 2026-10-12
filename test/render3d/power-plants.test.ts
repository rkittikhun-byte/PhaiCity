/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh, MeshStandardMaterial } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { COAL_STACKS } from '../../src/render3d/models/services/coal.js';
import { NUCLEAR_DOME_LIGHT, NUCLEAR_STEAM } from '../../src/render3d/models/services/nuclear.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { isLibraryMaterial, setNightMode } from '../../src/render3d/materials/library.js';
import { TileSnapshot, makeTileTable } from '../../src/render3d/city/tileModels.js';
import { TestCity } from '../../src/render3d/city/test-city.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';

const ids = ['power.coal', 'power.nuclear'];
const positions = (root: ReturnType<typeof registry[string]['factory']>) => visibleMeshes(root)
  .map(mesh => Array.from(mesh.geometry.getAttribute('position').array));

describe('power plant contracts', () => {
  for (const id of ids) for (const region of REGIONS) {
    it(`${id}/${region} fits 39 m, batches library finishes and repeats without changing R3 geometry`, () => {
      const model = registry[id].factory({ region, seed: 73 }), repeat = registry[id].factory({ region, seed: 73 });
      const central = registry[id].factory({ region: 'central', seed: 73 });
      try {
        const bounds = new Box3().setFromObject(model), materials = new Set<Material>();
        expect(bounds.min.x).toBeCloseTo(-19.5); expect(bounds.min.z).toBeCloseTo(-19.5);
        expect(bounds.max.x).toBeCloseTo(19.5); expect(bounds.max.z).toBeCloseTo(19.5);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(bounds.max.y).toBeCloseTo(id === 'power.coal' ? 44 : 55);
        expect(countTriangles(model)).toBeLessThanOrEqual(25000); expect(countDrawCalls(model)).toBeLessThanOrEqual(8);
        expect(model.userData).toMatchObject({ id, category: 'services', region, regionTier: 'R3', footprint: [4, 4],
          tiles: [...registry[id].tiles], triangles: countTriangles(model) });
        for (const mesh of visibleMeshes(model)) {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true); expect(materials.has(material)).toBe(false); materials.add(material);
        }
        expect(positions(model)).toEqual(positions(repeat)); expect(positions(model)).toEqual(positions(central));
        for (const anchor of model.children.filter(child => child.name.startsWith('anchor_'))) {
          expect(anchor).not.toBeInstanceOf(Mesh); expect(anchor.children).toHaveLength(0);
          expect(anchor.position.toArray()).toEqual(central.getObjectByName(anchor.name)!.position.toArray());
        }
      } finally { [model, repeat, central].forEach(disposeModel); }
    });
  }
  it('places all four open stack rims at the animation tile centres and the boiler roof at 35 m', () => {
    const root = registry['power.coal'].factory();
    try {
      const stacks = root.userData.components.filter((c: { role: string }) => c.role === 'smoke-stack');
      expect(stacks).toHaveLength(4);
      COAL_STACKS.forEach(([x, y, z], i) => {
        expect(root.getObjectByName(`anchor_smoke_${i}`)!.position.toArray()).toEqual([x, y, z]);
        expect(stacks[i].max[1]).toBeCloseTo(y);
        expect(x).toBeGreaterThan(0); expect(z).toBeLessThan(0);
        // The rim has vertices at both outer and inner radii, not a closed cylinder cap.
        const rim = visibleMeshes(root).flatMap(mesh => {
          const p = mesh.geometry.getAttribute('position'), values: number[] = [];
          for (let n = 0; n < p.count; n++) if (Math.abs(p.getY(n) - y) < 0.001 && Math.hypot(p.getX(n) - x, p.getZ(n) - z) < 1.3)
            values.push(Math.hypot(p.getX(n) - x, p.getZ(n) - z));
          return values;
        });
        expect(Math.min(...rim)).toBeCloseTo(0.95); expect(Math.max(...rim)).toBeCloseTo(1.2);
      });
      const components = root.userData.components as { role: string; min: number[]; max: number[] }[];
      expect(components.find(c => c.role === '35m-boiler-house')!.max[1]).toBeCloseTo(35);
      expect(components.filter(c => c.role === 'transmission-tower')).toHaveLength(2);
      components.filter(c => c.role === 'transmission-tower').forEach(c => expect(c.max[0]).toBeLessThan(-13));
      for (const role of ['coal-conveyor', 'black-coal-pile', 'high-voltage-switchyard']) expect(components.find(c => c.role === role)).toBeDefined();
      expect(components.find(c => c.role === 'black-coal-pile')!.min[1]).toBeGreaterThanOrEqual(0.09);
    } finally { disposeModel(root); }
  });
  it('keeps the cooling tower hyperbolic and open with an unobstructed mouth and a soft dome beacon', () => {
    const root = registry['power.nuclear'].factory();
    try {
      expect(root.getObjectByName('anchor_steam_0')!.position.toArray()).toEqual([...NUCLEAR_STEAM]);
      expect(root.getObjectByName('anchor_light_0')!.position.toArray()).toEqual([...NUCLEAR_DOME_LIGHT]);
      expect(root.userData).toMatchObject({ fictional: true, securityFences: 2 });
      const concrete = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.serviceConcrete)!;
      const p = concrete.geometry.getAttribute('position'), radii = (y: number) => {
        const values: number[] = [];
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - y) < 0.001)
          values.push(Math.hypot(p.getX(i) + 9, p.getZ(i) + 9));
        return values;
      };
      expect(Math.min(...radii(55))).toBeGreaterThan(5); expect(Math.max(...radii(55))).toBeLessThan(6);
      expect(Math.min(...radii(35.5))).toBeLessThan(4.5); expect(Math.max(...radii(3))).toBeGreaterThan(7);
      const glow = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.powerDomeGlow)!.material as MeshStandardMaterial;
      expect(glow.emissiveIntensity).toBe(0.65); setNightMode(true); expect(glow.emissiveIntensity).toBe(0.65);
      const decoded = decodePrototype(serializeModel('plant', root).value);
      expect(decoded.parts.find(part => part.material.userData.powerDomeGlow)!.material.emissiveIntensity).toBe(0.65);
      decoded.parts.forEach(part => part.geometry.dispose());
    } finally { setNightMode(false); disposeModel(root); }
  });
  it('resolves 16 cells to one plant at the correct centre and keeps the tall silhouette in coarse detail', () => {
    const table = makeTileTable(), city = new TestCity(), snapshot = new TileSnapshot(200, 200); snapshot.sync(city);
    for (const [id, center, start, x] of [['power.coal', 750, 745, 129], ['power.nuclear', 816, 811, 149]] as const) {
      expect(registry[id].tiles).toEqual(Array.from({ length: 16 }, (_, i) => start + i));
      registry[id].tiles.forEach(value => expect(table[value].id).toBe(id));
      const index = 52 * 200 + x, placement = snapshot.placement(index, 'south')!;
      expect(city.getTileValue(x, 52)).toBe(center); expect(placement.id).toBe(id);
      expect([placement.x, placement.z]).toEqual([(x + 1) * 10, 530]);
      expect(placement.height).toBe(id === 'power.coal' ? 44 : 55);
      let count = 0;
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
        const tile = (52 + dy) * 200 + x + dx; expect(snapshot.coverage[tile]).toBe(index);
        if (snapshot.placement(tile, 'south')) count++;
      }
      expect(count).toBe(1);
    }
  });
});
