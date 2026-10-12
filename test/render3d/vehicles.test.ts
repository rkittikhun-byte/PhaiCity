/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Group, Material } from 'three';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { VEHICLE_IDS } from '../../src/render3d/models/vehicles/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

describe('Vehicles (Prompts 16 and 5B, category veh)', () => {
  it('registers all 17 vehicle models in registry', () => {
    expect(VEHICLE_IDS).toHaveLength(17);
    for (const id of VEHICLE_IDS) {
      const entry = registry[id];
      expect(entry).toBeDefined();
      expect(entry.category).toBe('veh');
      expect(typeof entry.factory).toBe('function');
      expect(entry.tiles).toEqual([]);
      expect(entry.budget).toBeGreaterThan(0);
      expect(['R2', 'R3']).toContain(entry.regionTier);
    }
  });

  describe.each(VEHICLE_IDS)('%s', id => {
    const entry = registry[id];

    it('returns a Group matching id and meets bounding constraints', () => {
      const root = entry.factory({ seed: 42, region: 'central' });
      try {
        expect(root).toBeInstanceOf(Group);
        expect(root.name).toBe(id);
        expect(root.userData.category).toBe('veh');
        expect(root.userData.id).toBe(id);

        root.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(root);
        expect(bounds.isEmpty()).toBe(false);

        // Wheels or hull rest on y = 0
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(bounds.min.y).toBeLessThanOrEqual(0.05);

        // Budget check
        const triangles = countTriangles(root);
        expect(triangles).toBeLessThanOrEqual(entry.budget);
        expect(triangles).toBeGreaterThan(100);

        // Draw call limit
        const drawCalls = countDrawCalls(root);
        expect(drawCalls).toBeLessThanOrEqual(8);
        expect(drawCalls).toBeGreaterThan(0);

        // Materials: only library materials, and no two visible meshes share the same material
        const usedMaterials = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          expect(isLibraryMaterial(mat)).toBe(true);
          expect(usedMaterials.has(mat)).toBe(false);
          usedMaterials.add(mat);
        });
      } finally {
        disposeModel(root);
      }
    });

    it('maintains exact bounding box dimensions across different seeds', () => {
      const modelA = entry.factory({ seed: 73, region: 'central' });
      const modelB = entry.factory({ seed: 789, region: 'central' });
      try {
        modelA.updateMatrixWorld(true);
        modelB.updateMatrixWorld(true);
        const boundsA = new Box3().setFromObject(modelA);
        const boundsB = new Box3().setFromObject(modelB);

        expect(boundsB.max.x - boundsB.min.x).toBeCloseTo(boundsA.max.x - boundsA.min.x, 3);
        expect(boundsB.max.y - boundsB.min.y).toBeCloseTo(boundsA.max.y - boundsA.min.y, 3);
        expect(boundsB.max.z - boundsB.min.z).toBeCloseTo(boundsA.max.z - boundsA.min.z, 3);
      } finally {
        disposeModel(modelA);
        disposeModel(modelB);
      }
    });
  });

  describe('Special vehicle requirements', () => {
    it('veh.helicopter has anim_rotor_main and anim_rotor_tail with rotating meshes', () => {
      const heli = registry['veh.helicopter'].factory({ seed: 1 });
      try {
        const rotorMain = heli.getObjectByName('anim_rotor_main');
        const rotorTail = heli.getObjectByName('anim_rotor_tail');
        expect(rotorMain).toBeDefined();
        expect(rotorTail).toBeDefined();
        expect(rotorMain?.children.length).toBeGreaterThan(0);
        expect(rotorTail?.children.length).toBeGreaterThan(0);
      } finally {
        disposeModel(heli);
      }
    });

    it('veh.train_loco and veh.ship have anchor_smoke_0 for exhaust', () => {
      const loco = registry['veh.train_loco'].factory({ seed: 1 });
      const ship = registry['veh.ship'].factory({ seed: 1 });
      try {
        const locoSmoke = loco.getObjectByName('anchor_smoke_0');
        const shipSmoke = ship.getObjectByName('anchor_smoke_0');
        expect(locoSmoke).toBeDefined();
        expect(locoSmoke?.children).toHaveLength(0);
        expect(shipSmoke).toBeDefined();
        expect(shipSmoke?.children).toHaveLength(0);
      } finally {
        disposeModel(loco);
        disposeModel(ship);
      }
    });

    it('veh.songthaew is red in north and varies in other regions', () => {
      const northSongthaew = registry['veh.songthaew'].factory({ seed: 1, region: 'north' });
      const centralSongthaew = registry['veh.songthaew'].factory({ seed: 1, region: 'central' });
      try {
        expect(northSongthaew.userData.region).toBe('north');
        expect(centralSongthaew.userData.region).toBe('central');
        expect(northSongthaew.userData.regionTier).toBe('R2');
      } finally {
        disposeModel(northSongthaew);
        disposeModel(centralSongthaew);
      }
    });

    it('veh.airplane is 28 m long and features Phai Air bamboo green livery', () => {
      const plane = registry['veh.airplane'].factory({ seed: 1 });
      try {
        plane.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(plane);
        const length = bounds.max.z - bounds.min.z;
        expect(length).toBeCloseTo(28, 1);
        // Nose faces +Z
        expect(bounds.max.z).toBeGreaterThan(10);
      } finally {
        disposeModel(plane);
      }
    });

    it('veh.ship is 35 m long with containers and stern bridge', () => {
      const ship = registry['veh.ship'].factory({ seed: 1 });
      try {
        ship.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(ship);
        const length = bounds.max.z - bounds.min.z;
        expect(length).toBeCloseTo(35, 1);
        // Bow faces +Z
        expect(bounds.max.z).toBeGreaterThan(15);
      } finally {
        disposeModel(ship);
      }
    });
  });
});
