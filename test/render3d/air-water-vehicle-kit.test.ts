/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';
const ids = ['veh.train_loco', 'veh.train_car', 'veh.helicopter', 'veh.airplane', 'veh.ship', 'veh.longtail_boat', 'veh.korlae_boat'];

describe('16D rail air and water vehicle kit', () => {
  for (const id of ids) for (const seed of [0, 1, 789]) it(`${id}/${seed} has finite geometry and clean library finishes within its detail budget`, () => {
    const root = registry[id].factory({ seed });
    try {
      const triangles = countTriangles(root), calls = countDrawCalls(root);
      expect(triangles).toBeGreaterThanOrEqual(registry[id].budget * 0.5);
      expect(triangles).toBeLessThanOrEqual(registry[id].budget * 0.9);
      expect(calls).toBeLessThanOrEqual(8); expect(root.userData.front).toBe('+Z');
      const bounds = new Box3().setFromObject(root); expect(bounds.min.y).toBeCloseTo(0, 4);
      const materials = new Set<Material>();
      for (const mesh of visibleMeshes(root)) {
        const mat = mesh.material as MeshStandardMaterial;
        expect(isLibraryMaterial(mat)).toBe(true); expect(materials.has(mat)).toBe(false); materials.add(mat);
        for (const a of Object.values(mesh.geometry.attributes)) expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
        if (mat.userData.materialKey === 'wood_teak' || mat.userData.sign) continue;
        expect(mat.userData.vehicleMaterial).toBeDefined(); expect(mat.map).toBeNull(); expect(mat.normalMap).toBeNull();
      }
    } finally { disposeModel(root); }
  });
  it.each(['veh.train_loco', 'veh.train_car'])('%s retains meter gauge, grounded metal wheels and 15 m coupler spacing', id => {
    const root = registry[id].factory();
    try {
      expect(root.userData.gauge).toBe(1); expect(root.userData.wheels).toHaveLength(12);
      root.userData.wheels.forEach((wheel: { center: number[]; radius: number }) => {
        expect(Math.abs(wheel.center[0])).toBe(0.5); expect(wheel.center[1] - wheel.radius).toBeCloseTo(0);
      });
      const bounds = new Box3().setFromObject(root); expect(bounds.max.z - bounds.min.z).toBeCloseTo(15, 4);
    } finally { disposeModel(root); }
  });
  it('third-class carriage windows are genuine open holes through both sides', () => {
    const root = registry['veh.train_car'].factory();
    try {
      root.updateMatrixWorld(true); expect(root.userData.openWindows).toBe(18);
      for (const z of [-5.5, -2.9, -0.3, 2.3, 4.9]) {
        const ray = new Raycaster(new Vector3(3, 2.42, z), new Vector3(-1, 0, 0), 0, 6);
        expect(ray.intersectObjects(visibleMeshes(root))).toHaveLength(0);
      }
    } finally { disposeModel(root); }
  });
  it('locomotive glass is exposed at the raked cab front and exhaust remains at the original anchor', () => {
    const root = registry['veh.train_loco'].factory();
    try {
      root.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(0.55, 2.55, 8), new Vector3(0, 0, -1), 0, 2);
      const hits = ray.intersectObjects(visibleMeshes(root)); expect(hits.length).toBeGreaterThan(0);
      expect(((hits[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('glass_vehicle');
      expect(root.getObjectByName('anchor_smoke_0')!.position.toArray()).toEqual([0, 3.82, 1.4]);
    } finally { disposeModel(root); }
  });
  it('helicopter rotors retain real original pivots, separate batches and horizontal/vertical sweeps', () => {
    const root = registry['veh.helicopter'].factory();
    try {
      const main = root.getObjectByName('anim_rotor_main')!, tail = root.getObjectByName('anim_rotor_tail')!;
      expect(main.position.toArray()).toEqual([0, 3.2, 0.4]); expect(tail.position.toArray()).toEqual([-0.16, 2.5, -5]);
      expect(main.children).toHaveLength(1); expect(tail.children).toHaveLength(1);
      const before = new Box3().setFromObject(main); main.rotation.y = Math.PI / 2; root.updateMatrixWorld(true);
      const after = new Box3().setFromObject(main);
      expect(before.getSize(new Vector3()).x).toBeGreaterThan(8); expect(after.getSize(new Vector3()).z).toBeGreaterThan(8);
      expect(after.max.y).toBeCloseTo(before.max.y); tail.rotation.x = 0.72; root.updateMatrixWorld(true);
      expect(new Box3().setFromObject(tail).min.y).toBeGreaterThan(1.5);
    } finally { disposeModel(root); }
  });
  it('airplane has a round narrow-body fuselage, exposed cockpit and open fan intakes under swept wings', () => {
    const root = registry['veh.airplane'].factory();
    try {
      root.updateMatrixWorld(true); const bounds = new Box3().setFromObject(root);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(28, 5); expect(root.userData.airline).toBe('ไผ่แอร์');
      expect(root.userData.wheels).toHaveLength(6);
      const cockpit = new Raycaster(new Vector3(0, 3.25, 15), new Vector3(0, 0, -1), 0, 6).intersectObjects(visibleMeshes(root));
      expect(((cockpit[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('glass_vehicle');
      for (const x of [-4.2, 4.2]) {
        const fan = new Raycaster(new Vector3(x + 0.25, 1.29, 3), new Vector3(0, 0, -1), 0, 4).intersectObjects(visibleMeshes(root));
        expect(fan.length).toBeGreaterThan(0); expect(fan[0].point.z).toBeLessThan(1.45);
        expect(['chrome', 'plastic_trim_black']).toContain(((fan[0].object as Mesh).material as Material).userData.vehicleMaterial);
      }
      for (const z of [-8.32, -8.1]) {
        const window = new Raycaster(new Vector3(3, 2.62, z), new Vector3(-1, 0, 0), 0, 2).intersectObjects(visibleMeshes(root));
        expect(((window[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('glass_vehicle');
      }
      for (const x of [-6, 6]) {
        const upper = new Raycaster(new Vector3(x, 5, -2), new Vector3(0, -1, 0), 0, 4).intersectObjects(visibleMeshes(root));
        expect(upper[0].point.y).toBeGreaterThan(2.2); expect(upper[0].face!.normal.y).toBeGreaterThan(0);
      }
    } finally { disposeModel(root); }
  });
  it('cargo hull flares from its flat bottom, has outward faces, and keeps stern bridge and smoke anchor', () => {
    const root = registry['veh.ship'].factory();
    try {
      root.updateMatrixWorld(true); const s = root.userData.hullStations, middle = s[Math.floor(s.length / 2)];
      expect(middle.bottom).toBe(0); expect(middle.width).toBe(3.6); expect(s[s.length - 1].width).toBeLessThan(0.1);
      expect(root.userData.bridgeZ).toBeLessThan(-9); expect(root.userData.containerColors).toHaveLength(18);
      expect(new Set(root.userData.containerColors).size).toBeGreaterThanOrEqual(3);
      const ray = new Raycaster(new Vector3(5, 2.4, 0.17), new Vector3(-1, 0, 0), 0, 3).intersectObjects(visibleMeshes(root));
      expect(ray.length).toBeGreaterThan(0); expect(ray[0].face!.normal.x).toBeGreaterThan(0);
      const bounds = new Box3().setFromObject(root); expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(35.001);
      expect(root.getObjectByName('anchor_smoke_0')!.position.toArray()).toEqual([0, 9.85, -15.6]);
    } finally { disposeModel(root); }
  });
  it('small boats have hollow wooden interiors, a high prow, long-tail shaft and southern kit dress', () => {
    for (const region of REGIONS) for (const id of ['veh.longtail_boat', 'veh.korlae_boat']) {
      const root = registry[id].factory({ region });
      try {
        root.updateMatrixWorld(true);
        const inside = new Raycaster(new Vector3(0.26, 1.3, 0.22), new Vector3(0, -1, 0), 0, 2).intersectObjects(visibleMeshes(root));
        expect(inside.length).toBeGreaterThan(0);
        expect(((inside[0].object as Mesh).material as Material).userData.materialKey).toBe('wood_teak');
        if (id === 'veh.korlae_boat') {
          expect(root.userData.palette).toEqual(getRegionKit(region).vehicles.korlaeColors);
          expect(root.userData.trafficRegions).toEqual(['south']); expect(root.userData.regionTier).toBe('R2');
          expect(root.userData.hullStations.at(-1).top).toBeCloseTo(2.6);
        } else { expect(root.userData.propellerZ).toBe(-6.45); expect(root.userData.hullStations.at(-1).top).toBeCloseTo(1.55); }
      } finally { disposeModel(root); }
    }
  });
  it.each(ids)('%s transfers its clean paint, glass and signs through the model worker codec', id => {
    const root = registry[id].factory();
    try {
      const decoded = decodePrototype(serializeModel('16D', root).value);
      expect(decoded.parts).toHaveLength(countDrawCalls(root));
      decoded.parts.forEach(part => { expect(isLibraryMaterial(part.material)).toBe(true); part.geometry.dispose(); });
      if (id === 'veh.airplane') expect(decoded.parts.find(p => p.material.userData.sign?.text === 'ไผ่แอร์')!.material.userData.sign)
        .toMatchObject({ background: 0xf4f3ef, foreground: 0x237346 });
    } finally { disposeModel(root); }
  });
});
