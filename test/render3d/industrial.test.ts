/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { IND_ZONE_SPECS, createIndustrialBlock } from '../../src/render3d/models/industrial/zones.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { countDrawCalls, countTriangles, disposeModel, mergeByMaterial, visibleMeshes } from '../../src/render3d/util/geometry.js';
import type { ZoneComponent } from '../../src/render3d/models/residential/zone-builder.js';

const entries = Object.entries(registry).filter(([id]) => id.startsWith('ind.'));
describe('Prompt 12 industrial zones', () => {
  it('registers all eight formula centres plus the empty lot with disjoint 3×3 tile ranges', () => {
    expect(entries).toHaveLength(9); const used = new Set<number>();
    IND_ZONE_SPECS.forEach(spec => {
      expect(spec.center).toBe(625 + (spec.type * 4 + spec.size) * 9);
      expect(registry[spec.id].tiles).toEqual(Array.from({ length: 9 }, (_, n) => spec.center - 4 + n));
    });
    expect(registry['ind.zone_empty'].tiles).toEqual([612, 613, 614, 615, 616, 617, 618, 619, 620]);
    entries.forEach(([, entry]) => entry.tiles.forEach(tile => { expect(used.has(tile)).toBe(false); used.add(tile); }));
    expect(() => createIndustrialBlock(2, 0)).toThrow(RangeError); expect(() => createIndustrialBlock(0, 4)).toThrow(RangeError);
  });
  for (const [id, entry] of entries) it.each(REGIONS)(`${id}: footprint, batches and smoke aperture in %s`, region => {
    const root = entry.factory({ region, seed: 0 });
    try {
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeCloseTo(-14.5, 3); expect(bounds.max.x).toBeCloseTo(14.5, 3);
      expect(bounds.min.z).toBeCloseTo(-14.5, 3); expect(bounds.max.z).toBeCloseTo(14.5, 3);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThanOrEqual(150);
      expect(countTriangles(root)).toBeLessThanOrEqual(8000); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
      expect(root.userData).toMatchObject({ id, category: 'industrial', region, regionTier: entry.regionTier, footprint: [3, 3], entranceFacing: '+Z' });
      const components = root.userData.components as ZoneComponent[];
      expect(components.reduce((sum, c) => sum + c.triangles, 0)).toBe(countTriangles(root));
      const entrance = components.find(c => c.role === 'entrance')!; expect(entrance.max[2]).toBeGreaterThan(14.3);
      const materials = new Set<Material>(); visibleMeshes(root).forEach(mesh => {
        expect(mesh.name.startsWith(`${id}/`)).toBe(true); const mat = mesh.material as Material;
        expect(isLibraryMaterial(mat)).toBe(true); expect(materials.has(mat)).toBe(false); materials.add(mat);
      });
      const spec = IND_ZONE_SPECS.find(s => s.id === id), anchor = root.getObjectByName('anchor_smoke_0');
      if (spec?.smoke) {
        expect(anchor).toBeDefined(); expect(anchor).not.toBeInstanceOf(Mesh);
        expect(anchor!.position.toArray()).toEqual([spec.smoke[0], root.userData.stackHeight, spec.smoke[1]]);
        expect(anchor!.children).toHaveLength(0);
        const chimney = components.find(c => c.role === 'chimney')!;
        expect(chimney.max[1]).toBeCloseTo(anchor!.position.y, 4);
        // Smoke is over an open annulus; no triangles close its top aperture.
        const topTriangles: Vector3[][] = [];
        for (const mesh of visibleMeshes(root)) { const p = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
          const count = index?.count ?? p.count;
          for (let n = 0; n < count; n += 3) { const v = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(p, index ? index.getX(n + k) : n + k));
            if (v.every(a => Math.abs(a.y - anchor!.position.y) < 0.001)) topTriangles.push(v); }
        }
        expect(topTriangles.length).toBeGreaterThan(0);
        for (const v of topTriangles) expect(v.every(a => Math.hypot(a.x - spec.smoke![0], a.z - spec.smoke![1]) >= 0.5)).toBe(true);
      } else {
        expect(anchor).toBeUndefined(); expect(components.some(c => c.role === 'chimney')).toBe(false);
      }
      const signMesh = visibleMeshes(root).filter(m => (m.material as Material).userData.signAtlas);
      expect(signMesh).toHaveLength(1); expect(root.userData.signTexts.length).toBeGreaterThan(0);
    } finally { disposeModel(root); }
  });
  it('has six distinct traditional production forms and matching equipment', () => {
    expect(REGIONS.map(r => getRegionKit(r).industrial.traditional[0].kind)).toEqual([
      'tobacco-barns', 'rice-mill', 'rice-mill', 'fish-sauce', 'palm-sugar-sheds', 'rubber-smoking-house']);
    expect(REGIONS.map(r => getRegionKit(r).industrial.traditional[2].kind)).toEqual([
      'longan-kilns', 'sugar-mill', 'sugar-mill', 'seafood-canning', 'sugar-mill', 'palm-oil-mill']);
    for (const region of REGIONS) for (const id of ['ind.block_0_0', 'ind.block_0_2']) {
      const a = registry[id].factory({ region, seed: 73 }), b = registry[id].factory({ region, seed: 73 }), c = registry[id].factory({ region, seed: 789 });
      try { expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
        expect(countTriangles(a)).toBe(countTriangles(b));
        const positions = (root: typeof a) => visibleMeshes(root).map(m => Array.from(m.geometry.getAttribute('position').array));
        expect(positions(a)).toEqual(positions(b)); expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(c));
        expect(a.userData.industry).toBe(getRegionKit(region).industrial.traditional[id.endsWith('_0') ? 0 : 2].kind);
      } finally { [a, b, c].forEach(disposeModel); }
    }
  });
  it('keeps all smoke anchors identical across regions and covers required modern equipment', () => {
    for (const spec of IND_ZONE_SPECS) if (spec.smoke) {
      const positions = REGIONS.map(region => { const root = registry[spec.id].factory({ region });
        try { return root.getObjectByName('anchor_smoke_0')!.position.toArray(); } finally { disposeModel(root); } });
      positions.forEach(p => expect(p).toEqual(positions[0]));
    }
    const expected = { 'ind.zone_empty': { powerPoles: 2, saleText: 'ขาย/ให้เช่าที่ดิน' },
      'ind.block_0_1': { repairPickups: 2, oldTires: 9, smoke: false }, 'ind.block_0_3': { sphericalTanks: 3 },
      'ind.block_1_0': { loadingDocks: 6, semiTrailers: 2, smoke: false },
      'ind.block_1_1': { solarPanels: 18, glassOffice: true, smoke: false },
      'ind.block_1_2': { sawtoothBays: 4, newCars: 12 }, 'ind.block_1_3': { silos: 4, distillationTowers: 1, elevatedPipeRacks: true } };
    for (const [id, metadata] of Object.entries(expected)) { const root = registry[id].factory();
      try { expect(root.userData).toMatchObject(metadata); } finally { disposeModel(root); } }
  });
  it('keeps the added kit builders deterministic, within the lot and below 3,000 triangles', () => {
    for (const region of REGIONS) for (const size of [0, 2] as const) {
      const kit = getRegionKit(region), first = kit.industrial.hall(size, 73), second = kit.industrial.hall(size, 73);
      const a = mergeByMaterial('test.industrial-kit', first), b = mergeByMaterial('test.industrial-kit', second);
      first.concat(second).forEach(p => p.geometry.dispose());
      try { expect(countTriangles(a)).toBeLessThanOrEqual(3000); expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
        const bounds = new Box3().setFromObject(a);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-14.5); expect(bounds.max.x).toBeLessThanOrEqual(14.5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-14.5); expect(bounds.max.z).toBeLessThanOrEqual(14.5);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(visibleMeshes(a).map(m => Array.from(m.geometry.getAttribute('position').array)))
          .toEqual(visibleMeshes(b).map(m => Array.from(m.geometry.getAttribute('position').array)));
      } finally { disposeModel(a); disposeModel(b); }
    }
    for (const id of ['ind.zone_empty', 'ind.block_0_1']) {
      const bodies = REGIONS.map(region => { const root = registry[id].factory({ region, seed: 42 });
        try { return root.userData.structuralBodies; } finally { disposeModel(root); } });
      bodies.forEach(body => expect(body).toEqual(bodies[0]));
    }
  });
});
