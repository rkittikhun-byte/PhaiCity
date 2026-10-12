/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Mesh, MeshStandardMaterial } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { createResidentialBlock, RES_ZONE_SPECS } from '../../src/render3d/models/residential/zones.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { getRegionKit } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { isLibraryMaterial, setNightMode } from '../../src/render3d/materials/library.js';
import { seededRng } from '../../src/render3d/rng.js';
import type { ZoneComponent } from '../../src/render3d/models/residential/zone-builder.js';

const CASES = [...RES_ZONE_SPECS, { id: 'res.zone_empty', maxHeight: 4, floors: 0, center: 244, regionTier: 'R2' },
  { id: 'svc.hospital', maxHeight: 24, floors: 6, center: 409, regionTier: 'R2' }];

describe('Prompts 8 and 9: residential zones and hospital', () => {
  for (const spec of CASES) {
    it.each(REGIONS)(`${spec.id}: complete lot, correct tile range and height in %s`, region => {
      const entry = registry[spec.id], root = entry.factory({ region, seed: 42 });
      try {
        expect(entry.tiles).toEqual(Array.from({ length: 9 }, (_, n) => spec.center - 4 + n));
        expect(root.userData).toMatchObject({ footprint: [3, 3], centerTile: spec.center, regionTier: spec.regionTier, entranceFacing: '+Z', region });
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeCloseTo(-14.5, 3); expect(bounds.max.x).toBeCloseTo(14.5, 3);
        expect(bounds.min.z).toBeCloseTo(-14.5, 3); expect(bounds.max.z).toBeCloseTo(14.5, 3);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThanOrEqual(spec.maxHeight + 0.001);
        expect(countTriangles(root)).toBeLessThanOrEqual(entry.budget); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const features = root.userData.components as ZoneComponent[];
        expect(features.reduce((sum, p) => sum + p.triangles, 0)).toBe(countTriangles(root));
        const entrance = features.find(p => p.role === 'entrance')!;
        expect(entrance.min[0]).toBeLessThan(-2); expect(entrance.max[0]).toBeGreaterThan(2); expect(entrance.max[2]).toBeGreaterThan(14);
        if (spec.id !== 'res.zone_empty') expect(features.some(p => p.role.includes('parking') || p.role.includes('Parking') || p.role === 'detached-houses')).toBe(true);
        expect(features.some(p => p.role === 'trees' || p.role === 'bamboo-garden')).toBe(true);
        visibleMeshes(root).forEach(mesh => expect(isLibraryMaterial(mesh.material as MeshStandardMaterial)).toBe(true));
      } finally { disposeModel(root); }
    });
    if (spec.regionTier === 'R2' && spec.id !== 'res.zone_empty') it(`${spec.id}: actual structural bodies stay identical in every region`, () => {
      let reference: unknown;
      for (const region of REGIONS) {
        const root = registry[spec.id].factory({ region, seed: 5 });
        try {
          expect(root.userData.structuralBodies.length).toBeGreaterThan(0);
          if (reference) expect(root.userData.structuralBodies).toEqual(reference);
          reference = root.userData.structuralBodies;
        } finally { disposeModel(root); }
      }
    });
  }

  it('keeps the user-approved eight-storey condo at 3 m floor spacing under 25 m', () => {
    const root = registry['res.block_2_2'].factory();
    try { expect(root.userData.floors).toBe(8); expect(root.userData.floorSpacing).toBe(3); expect(root.userData.maxHeight).toBe(25); }
    finally { disposeModel(root); }
  });

  it('retains nine regional shack/stilt houses, including canal-side seeds for central/east only', () => {
    const seed = Array.from({ length: 100 }, (_, n) => n).find(n => seededRng(n)() < 0.45)!;
    for (const region of REGIONS) {
      const root = registry['res.block_0_0'].factory({ region, seed });
      try {
        expect(root.userData.houseCount).toBe(9); expect(root.userData.houseTemplates).toEqual(['res.house_0_0', 'res.house_0_1']);
        expect(root.userData.canalEdge).toBe(region === 'central' || region === 'east');
        const roles = (root.userData.components as ZoneComponent[]).map(p => p.role);
        expect(roles.includes('canal-edge')).toBe(region === 'central' || region === 'east');
      } finally { disposeModel(root); }
    }
  });

  it('uses a real covered arcade in the southern old row, and full-depth covered car spaces in modern rows', () => {
    const old = registry['res.block_0_1'].factory({ region: 'south' }), modern = registry['res.block_1_0'].factory();
    try {
      expect(old.userData.arcade).toBe(true); expect(old.userData.unitCount).toBe(10); expect(old.userData.rows).toBe(2);
      expect(modern.userData.coveredCarports).toBe(true); expect(modern.userData.parkedCars).toBe(4);
      expect((modern.userData.components as ZoneComponent[]).find(p => p.role === 'covered-car-parking')!.triangles).toBeGreaterThan(0);
    } finally { disposeModel(old); disposeModel(modern); }
  });

  it('provides dormitory AC per room, the five-level podium, level-six pool, and three sky gardens', () => {
    const dorm = registry['res.block_1_2'].factory(), tower = registry['res.block_2_3'].factory(), luxury = registry['res.block_3_2'].factory();
    try {
      expect(dorm.userData.airConditioners).toBe(dorm.userData.rooms); expect(dorm.userData.liftCore).toBe(true);
      expect(tower.userData.parkingLevels).toBe(5); expect(tower.userData.poolLevel).toBe(6); expect(tower.userData.poolElevation).toBeGreaterThan(15);
      expect(luxury.userData.skyGardenLevels).toEqual([5, 10, 15]); expect(luxury.userData.lobbyHeight).toBe(6);
    } finally { [dorm, tower, luxury].forEach(disposeModel); }
  });

  it('has library-owned night lighting on the 45-storey crown', () => {
    const root = registry['res.block_3_3'].factory();
    try {
      const lights = visibleMeshes(root).map(m => m.material as MeshStandardMaterial).filter(m => m.userData.materialKey === 'emissive_window');
      expect(lights.length).toBe(1); setNightMode(true); expect(lights[0].emissiveIntensity).toBeGreaterThan(1);
      setNightMode(false); expect(lights[0].emissiveIntensity).toBeLessThan(1);
    } finally { setNightMode(false); disposeModel(root); }
  });

  it('uses normalized atlas UVs for the hospital name, green H and five-stripe flag, and an unnumbered land-sale sign', () => {
    const hospital = registry['svc.hospital'].factory(), empty = registry['res.zone_empty'].factory();
    try {
      expect(hospital.userData).toMatchObject({ signText: 'โรงพยาบาล', mark: 'H', markColor: 'green', nationalFlag: 'Thai', parkedAmbulances: 1, helipad: true });
      const atlas = visibleMeshes(hospital).find(m => (m.material as MeshStandardMaterial).userData.hospitalAtlas)!;
      expect((atlas.material as MeshStandardMaterial).userData.hospitalAtlas.flagBands).toEqual(['red', 'white', 'blue', 'white', 'red']);
      const uv = atlas.geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) { expect(uv.getX(i)).toBeGreaterThanOrEqual(0); expect(uv.getX(i)).toBeLessThanOrEqual(1); expect(uv.getY(i)).toBeGreaterThanOrEqual(0); expect(uv.getY(i)).toBeLessThanOrEqual(1); }
      expect(empty.userData.landSaleText).toBe('ขายที่ดิน'); expect(empty.userData.landSaleText).not.toMatch(/[0-9๐-๙]/);
      hospital.traverse(node => { if (node.name.startsWith('anchor_')) expect(node).not.toBeInstanceOf(Mesh); });
    } finally { disposeModel(hospital); disposeModel(empty); }
  });

  it('provides shared low-detail shack/stilt geometry and rejects invalid zone coordinates', () => {
    for (const region of REGIONS) for (const kind of ['shack', 'stilt'] as const) {
      const parts = getRegionKit(region).communityHouse(kind, { seed: 3, twoStoreys: kind === 'stilt' });
      expect(parts.length).toBeGreaterThan(0); parts.forEach(p => p.geometry.dispose());
    }
    expect(() => createResidentialBlock(-1, 0)).toThrow(RangeError);
    expect(() => createResidentialBlock(4, 0)).toThrow(RangeError);
    expect(() => createResidentialBlock(0, 0.5)).toThrow(RangeError);
  });
});
