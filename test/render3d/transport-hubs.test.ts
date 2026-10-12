/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, InstancedMesh, Material, Matrix4, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { CRANE_BASES, CRANE_TRAVEL } from '../../src/render3d/models/transport/seaport.js';
import { AIRPORT_RADAR } from '../../src/render3d/models/transport/airport.js';
import { animateTransportModels } from '../../src/render3d/models/transport/animation.js';
import { REGIONS, getRegionKit } from '../../src/render3d/regional/index.js';
import { cityLODDepthMaterial, cityLODMaterial, isLibraryMaterial, updateTransportClock } from '../../src/render3d/materials/library.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';
import { TileSnapshot, makeTileTable } from '../../src/render3d/city/tileModels.js';
import { TestCity } from '../../src/render3d/city/test-city.js';

const ids = ['port.seaport', 'port.airport'];

describe('transport hub contracts', () => {
  for (const id of ids) for (const region of REGIONS) {
    it(`${id}/${region} fits the building margin and stays within eight material batches`, () => {
      const root = registry[id].factory({ region, seed: 42 });
      try {
        const bounds = new Box3().setFromObject(root), half = id === 'port.seaport' ? 19.5 : 29.5;
        expect(bounds.min.x).toBeCloseTo(-half); expect(bounds.max.x).toBeCloseTo(half);
        expect(bounds.min.z).toBeCloseTo(-half); expect(bounds.max.z).toBeCloseTo(half);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(countTriangles(root)).toBeLessThanOrEqual(25000);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8); expect(root.userData.triangles).toBe(countTriangles(root));
        const materials = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          expect(isLibraryMaterial(mesh.material as Material)).toBe(true);
          expect(materials.has(mesh.material as Material)).toBe(false); materials.add(mesh.material as Material);
        });
        if (id === 'port.airport') {
          const kit = getRegionKit(region);
          expect(root.userData.palette).toEqual(kit.services.palette('airport', 42));
          expect(root.userData.roofForm).toBe(kit.services.roofForm); expect(root.userData.roofOrnament).toBe(kit.services.ornament);
          expect(root.userData).toMatchObject({ parkedAirplanes: 2, airplaneSource: 'veh.airplane', runwaySize: [59, 12], runwayAxis: 'X' });
          expect(root.getObjectByName('anim_radar')!.position.toArray()).toEqual([...AIRPORT_RADAR]);
          const planes = root.userData.components.find((c: { role: string }) => c.role === 'parked-airplanes');
          expect(planes.min[2]).toBeGreaterThan(-14.5); expect(planes.max[2]).toBeLessThan(14.5);
          expect(planes.max[2]).toBeLessThan(16); // runway starts at Z = 16
        } else {
          expect(root.userData.containerStackHeights).toHaveLength(6);
          root.userData.containerStackHeights.forEach((height: number) => expect([2, 3, 4]).toContain(height));
          expect(root.userData).toMatchObject({ quaySide: '+Z', terminalTractors: 2 });
        }
      } finally { disposeModel(root); }
    });
  }
  it('slides each entire gantry along X, rotates the real radar pivot, and keeps every animated pose in the lot', () => {
    const port = registry['port.seaport'].factory(), airport = registry['port.airport'].factory();
    try {
      const cranes = port.getObjectByName('port.seaport/cranes') as InstancedMesh;
      expect(cranes.count).toBe(2); expect(countDrawCalls(port)).toBe(7);
      for (const seconds of [0, Math.PI * 2, Math.PI * 6, 80]) {
        animateTransportModels([port, airport], seconds);
        const matrix = new Matrix4();
        CRANE_BASES.forEach((base, i) => {
          const pivot = port.getObjectByName(`anim_crane_${i}`)!; cranes.getMatrixAt(i, matrix);
          expect(pivot.position.x).toBeCloseTo(base[0] + (i ? -1 : 1) * Math.sin(seconds * 0.25) * CRANE_TRAVEL);
          expect(matrix.elements[12]).toBeCloseTo(pivot.position.x);
          expect(pivot.position.y).toBe(base[1]); expect(pivot.position.z).toBe(base[2]);
        });
        expect(airport.getObjectByName('anim_radar')!.rotation.y).toBeCloseTo(seconds * 0.65);
        for (const root of [port, airport]) {
          const bounds = new Box3().setFromObject(root), half = root === port ? 19.5 : 29.5;
          expect(bounds.min.x).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.x).toBeLessThanOrEqual(half + 0.001);
          expect(bounds.min.z).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.z).toBeLessThanOrEqual(half + 0.001);
        }
      }
      const previous = port.getObjectByName('anim_crane_0')!.position.clone();
      animateTransportModels([port, airport], NaN); expect(port.getObjectByName('anim_crane_0')!.position).toEqual(previous);
    } finally { updateTransportClock(0); disposeModel(port); disposeModel(airport); }
  });
  it.each(ids)('%s retains its moving batch after worker transfer and animates its city color and depth shaders', id => {
    const root = registry[id].factory();
    try {
      const value = serializeModel('hub', root).value, decoded = decodePrototype(value), kind = id === 'port.seaport' ? 'cranes' : 'radar';
      const moving = decoded.parts.filter(part => part.material.userData.transportMotion);
      expect(moving).toHaveLength(1); expect(moving[0].material.userData.transportMotion).toBe(kind);
      if (kind === 'cranes') expect(moving[0].geometry.getAttribute('position').count)
        .toBe((root.getObjectByName('port.seaport/cranes') as InstancedMesh).geometry.getAttribute('position').count * 2);
      const surface = cityLODMaterial(moving[0].material), depth = cityLODDepthMaterial(surface);
      for (const material of [surface, depth]) {
        const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
          fragmentShader: '#include <common>\n#include <clipping_planes_fragment>' };
        material.onBeforeCompile(shader as any, {} as any);
        expect(shader.vertexShader).toContain(kind === 'cranes' ? 'transformed.x += sin' : 'transformed.xz = mat2');
        updateTransportClock(7); expect((shader.uniforms as any).transportTime.value).toBe(7);
        updateTransportClock(7); expect((shader.uniforms as any).transportTime.value).toBe(7); // paused clock
      }
      decoded.parts.forEach(part => part.geometry.dispose());
    } finally { updateTransportClock(0); disposeModel(root); }
  });
  it('resolves both hub footprints once and points the quay toward the water on each of its four sides', () => {
    const city = new TestCity(), snapshot = new TileSnapshot(200, 200), table = makeTileTable(); snapshot.sync(city);
    expect(snapshot.placement(88 * 200 + 101, 'central')!.rotation).toBe(-Math.PI / 2);
    expect(snapshot.placement(88 * 200 + 114, 'central')!.id).toBe('port.airport');
    for (const [id, start, count, x, size] of [['port.seaport', 693, 16, 108, 4], ['port.airport', 709, 36, 117, 6]] as const) {
      expect(registry[id].tiles).toEqual(Array.from({ length: count }, (_, i) => start + i));
      registry[id].tiles.forEach(value => expect(table[value].id).toBe(id));
      const index = 52 * 200 + x;
      expect(snapshot.placement(index, 'central')!.id).toBe(id);
      let buildings = 0;
      for (let dy = -1; dy < size - 1; dy++) for (let dx = -1; dx < size - 1; dx++) {
        const tile = (52 + dy) * 200 + x + dx; expect(snapshot.coverage[tile]).toBe(index);
        if (snapshot.placement(tile, 'central')) buildings++;
      }
      expect(buildings).toBe(1);
    }
    for (const [side, angle] of [[0, Math.PI], [1, Math.PI / 2], [2, 0], [3, -Math.PI / 2]]) {
      const ocean = new TestCity(); ocean.values.fill(0); ocean.flags.fill(0); ocean.zone(50, 50, 698, 4);
      for (let n = 0; n < 4; n++) {
        const [x, y] = [[49 + n, 48], [53, 49 + n], [49 + n, 53], [48, 49 + n]][side]; ocean.values[y * 200 + x] = 2;
      }
      const tiles = new TileSnapshot(200, 200); tiles.sync(ocean);
      const placement = tiles.placement(50 * 200 + 50, 'central')!; expect(placement.rotation).toBe(angle);
      const normal = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), angle);
      expect(normal.x).toBeCloseTo([0, 1, 0, -1][side]); expect(normal.z).toBeCloseTo([-1, 0, 1, 0][side]);
    }
  });
});
