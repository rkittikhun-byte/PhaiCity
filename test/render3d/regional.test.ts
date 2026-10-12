/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { createHash } from 'node:crypto';
import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { getRegionKit, REGIONS, ROOF_FORMS, WALL_FORMS } from '../../src/render3d/regional/index.js';
import { vegetationMix } from '../../src/render3d/regional/vegetation.js';
import { kitPreview } from '../../src/render3d/regional/geometry.js';
import { regionLineup } from '../../src/render3d/gallery/regional-preview.js';
import { registry } from '../../src/render3d/models/registry.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

function fingerprint(root: Group): string {
  const hash = createHash('sha256');
  root.traverse(node => {
    hash.update(node.name);
    if (node instanceof Mesh) {
      hash.update((node.material as MeshStandardMaterial).name);
      const geometry: BufferGeometry = node.geometry;
      for (const attribute of Object.values(geometry.attributes)) hash.update(Buffer.from(attribute.array.buffer));
    }
  });
  return hash.digest('hex');
}

describe('regional kits: reusable components', () => {
  for (const region of REGIONS) {
    const kit = getRegionKit(region);
    const builders = [
      ...ROOF_FORMS.map(form => ({ name: `roof.${form}`, make: () => kit.roofs[form]([4.3, 4.1], { seed: 27, baseY: 0.4 }) })),
      ...WALL_FORMS.map(form => ({ name: `wall.${form}`, make: () => kit.walls[form]({ seed: 27 }) })),
      ...Object.entries(kit.ornaments).map(([name, builder]) => ({ name: `ornament.${name}`, make: () => builder({ seed: 27 }) })),
      ...Object.entries(kit.props).map(([name, builder]) => ({ name: `prop.${name}`, make: () => builder({ seed: 27, nearWater: true }) })),
    ];
    it(`${region}: provides eight repeatable coordinated palettes and the correct vegetation`, () => {
      for (const channel of ['wall', 'trim', 'shutter', 'roof', 'plaster'] as const) {
        expect(kit.palette[channel]).toHaveLength(8);
        expect(new Set(kit.palette[channel]).size).toBe(8);
      }
      const picks = Array.from({ length: 200 }, (_, seed) => kit.palette.pick(seed));
      expect(picks).toEqual(Array.from({ length: 200 }, (_, seed) => kit.palette.pick(seed)));
      expect(new Set(picks).size).toBe(8);
      const modern = Array.from({ length: 200 }, (_, seed) => kit.palette.pick(seed, 'plaster'));
      expect(new Set(modern).size).toBe(8);
      const panel = kitPreview('wall', kit.walls.plaster({ seed: 17 }));
      expect((visibleMeshes(panel)[0].material as MeshStandardMaterial).color.getHex()).toBe(kit.palette.pick(17, 'plaster').wall);
      disposeModel(panel);
      expect(kit.vegetation).toEqual(vegetationMix(region));
    });
    it.each(builders)(`${region}: $name is deterministic, finite, grounded, bounded and batched`, ({ name, make }) => {
      const id = `kit.${region}.${name}`, a = kitPreview(id, make()), b = kitPreview(id, make());
      try {
        expect(fingerprint(a)).toBe(fingerprint(b));
        const bounds = new Box3().setFromObject(a);
        expect(bounds.isEmpty()).toBe(false); expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-4.5); expect(bounds.max.x).toBeLessThanOrEqual(4.5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-4.5); expect(bounds.max.z).toBeLessThanOrEqual(4.5);
        expect(countTriangles(a)).toBeLessThanOrEqual(3000); expect(countTriangles(a)).toBeGreaterThan(0);
        expect(countDrawCalls(a)).toBeLessThanOrEqual(8);
        const mats = new Set();
        visibleMeshes(a).forEach(mesh => {
          expect(mesh.name.startsWith(`${id}/`)).toBe(true);
          expect(isLibraryMaterial(mesh.material as MeshStandardMaterial)).toBe(true);
          expect(mats.has(mesh.material)).toBe(false); mats.add(mesh.material);
          Object.values(mesh.geometry.attributes).forEach(attr => expect(Array.from(attr.array).every(Number.isFinite)).toBe(true));
          expect(mesh.geometry.getAttribute('uv')).toBeDefined(); expect(mesh.geometry.getAttribute('normal')).toBeDefined();
        });
      } finally { disposeModel(a); disposeModel(b); }
    });
    it(`${region}: roof pitch and overhang change geometry while the seed only changes finish`, () => {
      const a = kitPreview('roof', kit.roofs.gable([4, 4], { seed: 0, pitch: 25, overhang: 0.2 }));
      const b = kitPreview('roof', kit.roofs.gable([4, 4], { seed: 33, pitch: 25, overhang: 0.2 }));
      const steep = kitPreview('roof', kit.roofs.gable([4, 4], { pitch: 55, overhang: 0.7 }));
      try {
        expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
        expect(new Box3().setFromObject(steep).max.y).toBeGreaterThan(new Box3().setFromObject(a).max.y);
        expect(new Box3().setFromObject(steep).max.x).toBeGreaterThan(new Box3().setFromObject(a).max.x);
      } finally { [a, b, steep].forEach(disposeModel); }
    });
  }
  it('requires a confirmed water edge before building the tied rowing boat', () => {
    const builder = getRegionKit('central').props.rowing_boat;
    expect(builder()).toEqual([]); expect(builder({ nearWater: false })).toEqual([]);
    const parts = builder({ nearWater: true }); expect(parts.length).toBeGreaterThan(0); parts.forEach(p => p.geometry.dispose());
  });
  it('rejects malformed roof and wall dimensions instead of emitting NaN geometry', () => {
    const kit = getRegionKit();
    expect(() => kit.roofs.gable([NaN, 4])).toThrow(RangeError);
    expect(() => kit.roofs.hip([4, 4], { pitch: 90 })).toThrow(RangeError);
    expect(() => kit.walls.plaster({ width: -1 })).toThrow(RangeError);
  });
});

describe('R1 house and pavilion integration', () => {
  it('uses shared kits in every region, with six distinct house forms and a replaceable pavilion roof', () => {
    const houseSignatures = new Set<string>(), roofSignatures = new Set<string>();
    for (const region of REGIONS) {
      for (const id of ['debug.region_house', 'park.garden_2']) {
        const root = registry[id].factory({ region, seed: 1 });
        try {
          expect(root.userData).toMatchObject({ kit: region, region, regionTier: 'R1', footprint: [1, 1] });
          expect(countTriangles(root)).toBeLessThanOrEqual(3000); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
          if (id === 'debug.region_house') houseSignatures.add(fingerprint(root));
          else {
            const roof = root.getObjectByName(`${id}/roof`) as Group;
            expect(roof.userData.role).toBe('replaceable-regional-roof'); expect(countTriangles(roof)).toBeGreaterThan(0);
            roofSignatures.add(fingerprint(roof));
          }
        } finally { disposeModel(root); }
      }
    }
    expect(houseSignatures.size).toBe(6); expect(roofSignatures.size).toBe(6);
  });
  it('keeps lineup models in the documented order with separate nonoverlapping footprints', () => {
    const lineup = regionLineup(registry['debug.region_house']).factory({ seed: 1 });
    try {
      expect(lineup.children.map(node => node.userData.region)).toEqual([...REGIONS]);
      for (let i = 1; i < lineup.children.length; i++) expect(new Box3().setFromObject(lineup.children[i]).min.x)
        .toBeGreaterThan(new Box3().setFromObject(lineup.children[i - 1]).max.x);
    } finally { disposeModel(lineup); }
  });
});
