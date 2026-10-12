/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BoxGeometry, Material, MeshStandardMaterial } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { COM_ZONE_SPECS, createCommercialBlock } from '../../src/render3d/models/commercial/zones.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { getRegionKit } from '../../src/render3d/regional/index.js';
import { CommercialBuilder } from '../../src/render3d/models/commercial/builder.js';
import { ZoneComponent } from '../../src/render3d/models/residential/zone-builder.js';
import { countDrawCalls, countTriangles, disposeModel, mergeGeometry, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { isLibraryMaterial, setNightMode, vertexFinish } from '../../src/render3d/materials/library.js';
import { thaiSignAtlas } from '../../src/render3d/materials/signs.js';

const entries = Object.entries(registry).filter(([id]) => id.startsWith('com.'));
describe('Prompt 10–11 commercial lots', () => {
  it('registers twenty commercial levels and the empty lot with non-overlapping nine-tile ranges', () => {
    expect(entries).toHaveLength(21); const used = new Set<number>();
    COM_ZONE_SPECS.forEach(spec => {
      expect(spec.center).toBe(436 + (spec.landValue * 5 + spec.density) * 9);
      expect(registry[spec.id].tiles).toEqual(Array.from({ length: 9 }, (_, n) => spec.center - 4 + n));
    });
    expect(registry['com.zone_empty'].tiles).toEqual([423, 424, 425, 426, 427, 428, 429, 430, 431]);
    entries.forEach(([, entry]) => entry.tiles.forEach(tile => { expect(used.has(tile)).toBe(false); used.add(tile); }));
  });
  for (const [id, entry] of entries) {
    it.each(REGIONS)(`${id}: full lot, commercial floors and one Thai-sign batch in %s`, region => {
      const root = entry.factory({ region, seed: 0 });
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeCloseTo(-14.5, 3); expect(bounds.max.x).toBeCloseTo(14.5, 3);
        expect(bounds.min.z).toBeCloseTo(-14.5, 3); expect(bounds.max.z).toBeCloseTo(14.5, 3);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThanOrEqual(150);
        expect(countTriangles(root)).toBeLessThanOrEqual(entry.budget); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(root.userData.category).toBe('commercial'); expect(root.userData.entranceFacing).toBe('+Z');
        const components = root.userData.components as ZoneComponent[];
        expect(components.reduce((sum, c) => sum + c.triangles, 0)).toBe(countTriangles(root));
        expect(components.find(c => c.role === 'entrance')!.max[2]).toBeGreaterThan(14.3);
        if (root.userData.floorSpacing) (root.userData.floorSpacing as number[]).forEach(n => expect(n).toBeGreaterThanOrEqual(3.5));
        const signs = visibleMeshes(root).filter(mesh => (mesh.material as Material).userData.signAtlas);
        expect(signs).toHaveLength(1);
        const material = signs[0].material as MeshStandardMaterial;
        expect(isLibraryMaterial(material)).toBe(true); expect(material.userData.signAtlas.length).toBe(root.userData.signTexts.length);
        (root.userData.signTexts as string[]).forEach(text => expect(text).toMatch(/^[\p{Script=Thai}\s]+$/u));
        const uv = signs[0].geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) { expect(uv.getX(i)).toBeGreaterThan(0); expect(uv.getX(i)).toBeLessThan(1);
          expect(uv.getY(i)).toBeGreaterThan(0); expect(uv.getY(i)).toBeLessThan(1); }
        visibleMeshes(root).forEach(mesh => {
          const mat = mesh.material as Material;
          if (mat.userData.vertexFinish) expect(mesh.geometry.getAttribute('color')).toBeDefined();
        });
      } finally { disposeModel(root); }
    });
    if (entry.regionTier === 'R2') it(`${id}: structural geometry is identical across all regions`, () => {
      const bodies = REGIONS.map(region => { const root = entry.factory({ region, seed: 42 });
        try { return root.userData.structuralBodies; } finally { disposeModel(root); } });
      bodies.slice(1).forEach(body => expect(body).toEqual(bodies[0]));
    });
  }
  it('has region-specific market cuisine and a complete 16-stall layout', () => {
    expect(REGIONS.map(r => getRegionKit(r).commercial.goods)).toEqual(['lanna', 'isan', 'mixed', 'fruit', 'sugar', 'south']);
    for (const region of REGIONS) {
      const root = registry['com.block_0_0'].factory({ region });
      try { expect(root.userData.stallCount).toBe(16); expect(root.userData.sellingPickup).toBe(true);
        expect(root.userData.paperUmbrellas).toBe(region === 'north'); expect(root.userData.marketNames).toHaveLength(4);
      } finally { disposeModel(root); }
    }
  });
  it('changes regional shophouse floors and preserves southern arches / eastern balconies', () => {
    for (const id of ['com.block_0_3', 'com.block_0_4']) for (const region of REGIONS) {
      const root = registry[id].factory({ region });
      try { expect(root.userData.units).toBe(6); expect(root.userData.coveredArcade).toBe(region === 'south');
        expect(root.userData.stuccoPediments).toBe(region === 'south'); expect(root.userData.waterfrontWalkway).toBe(region === 'east');
        expect(root.userData.bakery).toBe(region === 'northeast');
        if (region === 'north') expect(root.userData.floors).toBe(2);
        if (region === 'south') expect(root.userData.floors).toBeLessThanOrEqual(3);
        expect(root.userData.verticalSigns).toBe(id.endsWith('_4') ? 12 : 0);
      } finally { disposeModel(root); }
    }
  });
  it('provides the carts, noodle lean-to, open market, fuel pumps, clinic/pharmacy and parking court', () => {
    const expected: Record<string, object> = {
      'com.zone_empty': { rentalText: 'ให้เช่า' }, 'com.block_0_1': { units: 4, floors: 2, noodleLeanTo: true, drinkCoolers: 2 },
      'com.block_0_2': { openSteelFrame: true, zincRoof: true, vegetableStalls: 8, meatStalls: 4, iceBuckets: 6 },
      'com.block_1_0': { fuelPumps: 2, realBrand: false }, 'com.block_1_1': { units: 5, floors: 4, pharmacySign: 'green' },
      'com.block_1_2': { plan: 'U', floors: 2, centralParkingCars: 3 }, 'com.block_1_3': { floors: 8, glassLobby: true },
      'com.block_1_4': { floors: 5, blankWalls: true, billboards: 2, rooftopParkingCars: 5 },
    };
    for (const [id, metadata] of Object.entries(expected)) { const root = registry[id].factory();
      try { expect(root.userData).toMatchObject(metadata); } finally { disposeModel(root); } }
  });
  it('lights only the hotel name cell in a cached atlas and validates invalid inputs', () => {
    const entries = [{ text: 'โรงแรมลานลม', lit: true }, { text: 'ยินดีต้อนรับ' }], a = thaiSignAtlas(entries), b = thaiSignAtlas(entries);
    expect(a.material).toBe(b.material); expect(a.rects).toEqual(b.rects); expect(isLibraryMaterial(a.material)).toBe(true);
    try { setNightMode(true); expect(a.material.emissiveIntensity).toBe(1.6); setNightMode(false); expect(a.material.emissiveIntensity).toBe(0.3); }
    finally { setNightMode(false); }
    expect(() => thaiSignAtlas([])).toThrow(RangeError);
    expect(() => thaiSignAtlas([{ text: 'ให้เช่า', size: [0, 1] }])).toThrow(RangeError);
    expect(() => createCommercialBlock(4, 0)).toThrow(RangeError); expect(() => createCommercialBlock(0, 5)).toThrow(RangeError);
  });
  it('preserves baked colors through merging, filling unpainted geometry with white', () => {
    const a = new BoxGeometry(), b = new BoxGeometry(); CommercialBuilder.color(a, 0x89ab76);
    const merged = mergeGeometry([a, b]);
    try { const colors = merged.getAttribute('color'); expect(colors).toBeDefined();
      expect(colors.getX(0)).toBeCloseTo(a.getAttribute('color').getX(0), 5);
      expect(colors.getX(colors.count - 1)).toBe(1); expect(vertexFinish('fabric_canvas')).toBe(vertexFinish('fabric_canvas'));
    } finally { a.dispose(); b.dispose(); merged.dispose(); }
  });
});
