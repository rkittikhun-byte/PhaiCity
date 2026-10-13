/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BufferGeometry, Material, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';

const ids = ['veh.bus', 'veh.truck', 'veh.etan', 'veh.tuktuk', 'veh.motorbike'];
const wheelCounts = [6, 6, 4, 3, 2];
const isFiniteGeometry = (geometry: BufferGeometry): boolean => Object.values(geometry.attributes)
  .every(attribute => Array.from(attribute.array).every(Number.isFinite));

describe('16C road vehicle kit', () => {
  for (const id of ids) for (const seed of [0, 1, 2, 73, 789]) {
    it(`${id}/${seed} uses its detail budget, clean automotive finishes and grounded rounded wheels`, () => {
      const root = registry[id].factory({ seed, region: 'central' });
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.y).toBeCloseTo(0, 5); expect(root.userData.front).toBe('+Z');
        expect(countTriangles(root)).toBeGreaterThanOrEqual(2000); expect(countTriangles(root)).toBeLessThanOrEqual(4000);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8); expect(root.userData.wheels).toHaveLength(wheelCounts[ids.indexOf(id)]);
        const materials = new Set<Material>();
        for (const mesh of visibleMeshes(root)) {
          const material = mesh.material as MeshStandardMaterial;
          expect(isLibraryMaterial(material)).toBe(true); expect(materials.has(material)).toBe(false); materials.add(material);
          expect(isFiniteGeometry(mesh.geometry)).toBe(true);
          if (id === 'veh.etan' && ['wood_teak', 'wood_painted'].includes(material.userData.materialKey)) continue;
          expect(material.userData.vehicleMaterial).toBeDefined(); expect(material.map).toBeNull(); expect(material.normalMap).toBeNull();
        }
        root.updateMatrixWorld(true);
        const tire = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.vehicleMaterial === 'rubber_tire')!;
        for (const wheel of root.userData.wheels) {
          const [x, y, z] = wheel.center;
          expect(y - wheel.radius).toBeCloseTo(0, 5);
          // Every tire has actual vertices on the ground plane, including the separate inner dual tires.
          const positions = tire.geometry.getAttribute('position'); let grounded = false;
          for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getY(i)) < 0.00001 &&
            Math.abs(positions.getZ(i) - z) < 0.00001 && Math.abs(positions.getX(i) - x) <= wheel.width / 2 + 0.001) grounded = true;
          expect(grounded).toBe(true);
        }
        expect(root.children.filter(child => /^(anchor_|anim_)/.test(child.name))).toHaveLength(0);
      } finally { disposeModel(root); }
    });
  }
  it.each(['veh.bus', 'veh.truck'])('%s has an open front windshield and headlamps outside the body', id => {
    const root = registry[id].factory();
    try {
      root.updateMatrixWorld(true);
      const front = id === 'veh.bus' ? 5.25 : 3.6, belt = id === 'veh.bus' ? 1.03 : 1.05, width = id === 'veh.bus' ? 2.5 : 2.3;
      const ray = new Raycaster(new Vector3(0, 2.17, front + 1), new Vector3(0, 0, -1), 0, 2);
      const hits = ray.intersectObjects(visibleMeshes(root)); expect(hits.length).toBeGreaterThan(0);
      expect(((hits[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('glass_vehicle');
      const light = new Raycaster(new Vector3(width * 0.35, belt - 0.09, front + 1), new Vector3(0, 0, -1), 0, 2);
      expect(((light.intersectObjects(visibleMeshes(root))[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('lamp_lens');
    } finally { disposeModel(root); }
  });
  it('retains bus paint parity, a fictional readable route and two folding doors', () => {
    for (const seed of [1, 2]) {
      const root = registry['veh.bus'].factory({ seed });
      try {
        expect(root.userData.isAircon).toBe(seed % 2 === 0); expect(root.userData.route).toBe(`P${100 + seed}`);
        expect(root.userData.floorHeight).toBeLessThanOrEqual(0.6); expect(root.userData.foldingDoors).toBe(2);
        const paint = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.vehicleMaterial === 'car_paint')!;
        expect((paint.material as MeshStandardMaterial).color.getHex()).toBe(seed % 2 === 0 ? 0x1e3a8a : 0xfef3c7);
        expect(root.userData.components.find((part: { role: string }) => part.role === 'fictional-route-display-and-roof-ac').triangles).toBeGreaterThan(100);
      } finally { disposeModel(root); }
    }
  });
  it('has only one skirt surface over the closed offside bus door cutout, preventing coplanar flicker', () => {
    const root = registry['veh.bus'].factory();
    try {
      root.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(2.5, 0.88, 4.41), new Vector3(-1, 0, 0), 0, 4);
      const hits = ray.intersectObjects(visibleMeshes(root)); expect(hits.length).toBeGreaterThan(0);
      expect(hits.filter(hit => hit.distance < hits[0].distance + 0.0005)).toHaveLength(1);
      expect(((hits[0].object as Mesh).material as MeshStandardMaterial).color.getHex()).toBe(0xb91c1c);
    } finally { disposeModel(root); }
  });
  it.each(['veh.tuktuk', 'veh.motorbike'])('%s exposes its front tire below the apron when viewed from +Z', id => {
    const root = registry[id].factory();
    try {
      root.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(0, 0.35, 2), new Vector3(0, 0, -1), 0, 3);
      const hits = ray.intersectObjects(visibleMeshes(root)); expect(hits.length).toBeGreaterThan(0);
      expect(((hits[0].object as Mesh).material as Material).userData.vehicleMaterial).toBe('rubber_tire');
    } finally { disposeModel(root); }
  });
  it('makes separate dual rear tires and selects box/flatbed without changing the overall envelope', () => {
    const models = [1, 2].map(seed => registry['veh.truck'].factory({ seed }));
    try {
      expect(models.map(root => root.userData.cargoType)).toEqual(['flatbed', 'box']);
      for (const root of models) {
        const rear = root.userData.wheels.filter((wheel: { center: number[] }) => wheel.center[2] < 0);
        expect(rear).toHaveLength(4); expect(new Set(rear.map((wheel: { center: number[] }) => wheel.center[0])).size).toBe(4);
      }
      const sizes = models.map(root => new Box3().setFromObject(root).getSize(new Vector3()));
      for (const axis of ['x', 'y', 'z'] as const) expect(sizes[0][axis]).toBeCloseTo(sizes[1][axis], 3);
    } finally { models.forEach(disposeModel); }
  });
  it('keeps the homemade etan R2 palette in its region kit for all six regions', () => {
    for (const region of REGIONS) {
      const root = registry['veh.etan'].factory({ seed: 73, region });
      try {
        expect(root.userData.regionTier).toBe('R2'); expect(root.userData.bedColor).toBe(getRegionKit(region).vehicles.etanColor(73));
        expect(root.userData.exposedEngine).toBe(true); expect(root.userData.openWoodenBed).toBe(true);
        expect(visibleMeshes(root).some(mesh => (mesh.material as Material).userData.materialKey === 'wood_teak')).toBe(true);
      } finally { disposeModel(root); }
    }
  });
  it('preserves the bright tuk-tuk canopy and even-seed orange taxi vest/yellow helmet', () => {
    for (const seed of [1, 2]) {
      const root = registry['veh.motorbike'].factory({ seed }), tuk = registry['veh.tuktuk'].factory({ seed });
      try {
        expect(root.userData.isTaxi).toBe(seed % 2 === 0);
        const colors = visibleMeshes(root).map(mesh => (mesh.material as MeshStandardMaterial).color.getHex());
        expect(colors).toContain(seed % 2 === 0 ? 0xf97316 : 0x3b82f6); expect(colors).toContain(seed % 2 === 0 ? 0xfacc15 : 0x1e293b);
        expect([0x1d4ed8, 0x15803d, 0xca8a04, 0xdc2626]).toContain(tuk.userData.roofColor);
      } finally { disposeModel(root); disposeModel(tuk); }
    }
  });
  it.each(ids)('%s transfers its vehicle materials and geometry through the city worker', id => {
    const root = registry[id].factory();
    try {
      const decoded = decodePrototype(serializeModel('road', root).value);
      expect(decoded.parts).toHaveLength(countDrawCalls(root));
      for (const part of decoded.parts) { expect(isLibraryMaterial(part.material)).toBe(true); expect(isFiniteGeometry(part.geometry)).toBe(true); part.geometry.dispose(); }
    } finally { disposeModel(root); }
  });
});
