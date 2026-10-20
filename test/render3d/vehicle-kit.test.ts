/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { PICKUP_PAINTS, sedanDisplayParts } from '../../src/render3d/models/vehicles/road-cars.js';
import { car_paint, cityLODMaterial, setNightMode, vehicleMaterial } from '../../src/render3d/materials/library.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, mergeByMaterial, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';

const ids = ['veh.pickup', 'veh.sedan', 'veh.songthaew'];
const keys = ['car_paint', 'rubber_tire', 'chrome', 'plastic_trim_black', 'lamp_lens', 'tail_light_red', 'glass_vehicle'];

describe('16B automotive kit', () => {
  it('uses cached clearcoat paint without scanned maps and keeps solid white nonmetallic', () => {
    const white = car_paint(0xf8fafc), silver = car_paint(0xc4c9cc);
    expect(white).toBeInstanceOf(MeshPhysicalMaterial); expect(white).toBe(car_paint(0xf8fafc));
    expect(white.clearcoat).toBe(1); expect(white.clearcoatRoughness).toBe(0.1); expect(white.roughness).toBe(0.35);
    expect(white.metalness).toBe(0); expect(silver.metalness).toBe(0.4);
    for (const material of [white, silver, vehicleMaterial('rubber_tire'), vehicleMaterial('glass_vehicle')]) {
      expect(material.map).toBeNull(); expect(material.normalMap).toBeNull(); expect(material.roughnessMap).toBeNull();
      expect(material.metalnessMap).toBeNull(); expect(material.aoMap).toBeNull();
    }
    expect(PICKUP_PAINTS.filter(color => color === 0xf8fafc)).toHaveLength(4);
  });
  for (const id of ids) for (const seed of [0, 1, 2, 3, 9, 42, 73, 789]) {
    it(`${id}/${seed} keeps wheels grounded, useful geometry detail, clean finishes and a real empty arch`, () => {
      const root = registry[id].factory({ seed });
      try {
        const bounds = new Box3().setFromObject(root); expect(bounds.min.y).toBeCloseTo(0, 5);
        expect(countTriangles(root)).toBeGreaterThanOrEqual(2000); expect(countTriangles(root)).toBeLessThanOrEqual(4000);
        expect(countDrawCalls(root)).toBe(8); expect(root.userData.wheelSegments).toBe(16);
        expect(root.userData.greenhouseRoofRatio).toBe(0.875); expect(root.userData.front).toBe('+Z');
        visibleMeshes(root).forEach(mesh => {
          expect(keys).toContain((mesh.material as Material).userData.vehicleMaterial);
          expect((mesh.material as MeshStandardMaterial).map).toBeNull();
        });
        root.updateMatrixWorld(true);
        const paint = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.vehicleMaterial === 'car_paint')!;
        const wheelZ = id === 'veh.sedan' ? 1.4 : 1.62, radius = id === 'veh.sedan' ? 0.32 : 0.38;
        const holeRay = new Raycaster(new Vector3(-2, radius + 0.2, wheelZ), new Vector3(1, 0, 0), 0, 4);
        expect(holeRay.intersectObject(paint)).toHaveLength(0);
        const fenderRay = new Raycaster(new Vector3(-2, radius * 2 + 0.15, wheelZ), new Vector3(1, 0, 0), 0, 4);
        expect(fenderRay.intersectObject(paint).length).toBeGreaterThan(0);
        const glass = visibleMeshes(root).find(mesh => (mesh.material as Material).userData.vehicleMaterial === 'glass_vehicle')!;
        const normals = glass.geometry.getAttribute('normal');
        expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
        expect(Array.from({ length: normals.count }, (_, i) => Math.abs(normals.getX(i))).some(x => x > 0.8)).toBe(true);
        // Glass consists of individual sheet faces; each window has two coplanar triangles, without a thick box.
        expect((glass.geometry.index?.count ?? glass.geometry.getAttribute('position').count) / 3).toBeLessThanOrEqual(18);
      } finally { disposeModel(root); }
    });
  }
  it('chooses all three pickup cab layouts and both accessories without moving the overall envelope', () => {
    const cabs = new Set<string>(), accessories = new Set<string>(); let first: Box3 | undefined;
    for (let seed = 0; seed < 40; seed++) {
      const root = registry['veh.pickup'].factory({ seed });
      try {
        cabs.add(root.userData.cabType); accessories.add(root.userData.accessory);
        expect(root.userData.hasCanopy).toBe(seed % 2 === 0);
        const bounds = new Box3().setFromObject(root); if (!first) first = bounds;
        for (const axis of ['x', 'y', 'z'] as const) expect(bounds.max[axis] - bounds.min[axis]).toBeCloseTo(first.max[axis] - first.min[axis], 3);
      } finally { disposeModel(root); }
    }
    expect([...cabs].sort()).toEqual(['double', 'extended', 'single']);
    expect([...accessories].sort()).toEqual(['canopy', 'roll-bar']);
  });
  it('gets songthaew color through every region kit and retains two benches and the passenger roof', () => {
    for (const region of REGIONS) for (const seed of [1, 73]) {
      const root = registry['veh.songthaew'].factory({ region, seed });
      try {
        const color = getRegionKit(region).vehicles.songthaewColor(seed);
        expect(root.userData.paintColor).toBe(color); expect(root.userData.benchRows).toBe(2);
        expect(root.userData.passengerRoof).toBe(true); expect(root.userData.pickupBased).toBe(true);
        if (region === 'north') expect(color).toBe(0xdc2626); else expect([0x1d4ed8, 0x15803d, 0xf8fafc]).toContain(color);
      } finally { disposeModel(root); }
    }
  });
  it('lights white/amber lenses and red rear lamps through the shared night mode', () => {
    const front = vehicleMaterial('lamp_lens'), rear = vehicleMaterial('tail_light_red');
    try {
      setNightMode(false); const day = front.emissiveIntensity;
      setNightMode(true); expect(front.emissiveIntensity).toBeGreaterThan(day * 10);
      expect(rear.emissiveIntensity).toBe(2.2); expect(rear.emissive.getHex()).toBe(0xde252b);
    } finally { setNightMode(false); }
  });
  it.each(ids)('%s exposes headlight and tail-light lenses ahead of the painted body', id => {
    const root = registry[id].factory();
    try {
      root.updateMatrixWorld(true);
      const width = id === 'veh.sedan' ? 1.8 : 1.85, belt = id === 'veh.sedan' ? 0.91 : 1.09;
      for (const side of [1, -1]) {
        const ray = new Raycaster(new Vector3(width * 0.35, belt - 0.09, side * 5), new Vector3(0, 0, -side), 0, 10);
        const hits = ray.intersectObjects(visibleMeshes(root)); expect(hits.length).toBeGreaterThan(0);
        expect(((hits[0].object as Mesh).material as Material).userData.vehicleMaterial)
          .toBe(side > 0 ? 'lamp_lens' : 'tail_light_red');
      }
    } finally { disposeModel(root); }
  });
  it.each(ids)('%s survives worker transfer and city LOD without loading building textures or losing clearcoat', id => {
    const root = registry[id].factory();
    try {
      const decoded = decodePrototype(serializeModel('car', root).value);
      expect(decoded.parts).toHaveLength(8);
      const paint = decoded.parts.find(part => part.material.userData.vehicleMaterial === 'car_paint')!.material as MeshPhysicalMaterial;
      expect(paint.clearcoat).toBe(1); expect(paint.map).toBeNull();
      const city = cityLODMaterial(paint) as MeshPhysicalMaterial;
      expect(city.clearcoat).toBe(1); expect(city.map).toBeNull(); expect(city.userData.vehicleMaterial).toBe('car_paint');
      decoded.parts.forEach(part => part.geometry.dispose());
    } finally { disposeModel(root); }
  });
  it('keeps showroom props compact and transfers their baked paint/glass/tire colors through the worker', () => {
    const parts = sedanDisplayParts(0xa6b3b7), root = mergeByMaterial('showroom-prop', parts);
    parts.forEach(part => part.geometry.dispose());
    try {
      expect(countTriangles(root)).toBeLessThanOrEqual(1200); expect(countDrawCalls(root)).toBe(1);
      const decoded = decodePrototype(serializeModel('display-car', root).value);
      expect(decoded.parts).toHaveLength(1); const part = decoded.parts[0];
      expect(part.material.userData.vehicleDisplay).toBe(true); expect(part.material.vertexColors).toBe(true);
      expect(part.material.map).toBeNull(); expect(part.geometry.hasAttribute('color')).toBe(true);
      part.geometry.dispose();
    } finally { disposeModel(root); }
  });
});
