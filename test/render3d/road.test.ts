/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Bone, Box3, Group, Mesh, MeshStandardMaterial, Raycaster, SkinnedMesh, Vector3 } from 'three';
import { roadCurbMaterial, railwaySignalMaterial, setNightMode, updateRoadSignals } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { CORNER_CENTER, CORNER_RADIUS, cornerArc } from '../../src/render3d/models/road/basic.js';
import { BASIC_MASKS, POWER_INTERFACE, RAIL_INTERFACE, roadForMask } from '../../src/render3d/models/road/interfaces.js';
import { ROAD_KINDS, ROAD_TILES, createRoad } from '../../src/render3d/models/road/road.js';
import { DRAWBRIDGE_HINGE, crossingHeight } from '../../src/render3d/models/road/special.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleBounds, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { roadNeighbors } from '../../src/render3d/gallery/road-neighbors.js';

const cast = (root: Group, x: number, z: number, keys = ['asphalt', 'sidewalk_tile']): number => {
  root.updateMatrixWorld(true);
  const surface = visibleMeshes(root).filter(mesh => !Array.isArray(mesh.material) && keys.includes(mesh.material.userData.materialKey));
  return new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0)).intersectObjects(surface, false)[0]?.point.y ?? -Infinity;
};
const edgePoint = (side: number, lateral: number): [number, number] => side === 1 ? [lateral, -4.9999]
  : side === 2 ? [4.9999, lateral] : side === 4 ? [-lateral, 4.9999] : [-4.9999, -lateral];

describe('Prompt 4 roads: physical seams and canonical connections', () => {
  it.each(Array.from({ length: 16 }, (_, i) => i))('joins every edge for connection mask %i after renderer rotation', mask => {
    const selected = roadForMask(mask), root = registry[selected.id].factory({ seed: 42 });
    root.rotation.y = selected.rotationY;
    try {
      for (const side of [1, 2, 4, 8]) for (const lateral of [-4.99, -4.25, -3.501, -3.499, -1.75, 0, 1.75, 3.499, 3.501, 4.25, 4.99]) {
        const connected = mask & side;
        const expected = connected && Math.abs(lateral) < 3.5 ? 0 : 0.15;
        expect(cast(root, ...edgePoint(side, lateral))).toBeCloseTo(expected, 4);
      }
    } finally { disposeModel(root); }
  });

  it('builds an actual 3 m curb arc with exact north/east tangent edge coordinates', () => {
    const root = createRoad('corner');
    try {
      expect(root.userData.connections).toBe(3); expect(root.userData.curbRadius).toBe(3);
      for (const [x, z] of cornerArc()) {
        expect(Math.hypot(x - CORNER_CENTER[0], z - CORNER_CENTER[1])).toBeCloseTo(CORNER_RADIUS, 8);
        expect(cast(root, x - 0.02, z + 0.02)).toBeCloseTo(0.15, 4);
        expect(cast(root, x + 0.02, z - 0.02)).toBeCloseTo(0, 4);
      }
    } finally { disposeModel(root); }
  });

  it('has four zebra crossings and stop lines on the incoming left-hand lanes', () => {
    const root = createRoad('cross');
    try {
      for (const side of [1, 2, 4, 8]) {
        const rotate = (x: number, z: number): [number, number] => side === 1 ? [x, z] : side === 2 ? [-z, x] : side === 4 ? [-x, -z] : [z, -x];
        for (const x of [-3.15, -2.45, -1.75, -1.05, -0.35, 0.35, 1.05, 1.75, 2.45, 3.15]) {
          expect(cast(root, ...rotate(x, -4.2), ['road_marking_white'])).toBeCloseTo(0.004, 5);
        }
        expect(cast(root, ...rotate(1.75, -4.8), ['road_marking_white'])).toBeCloseTo(0.004, 5);
        expect(cast(root, ...rotate(-1.75, -4.8), ['road_marking_white'])).toBe(-Infinity);
      }
    } finally { disposeModel(root); }
  });

  it('retains material world UVs across two adjoining straight tiles', () => {
    const left = createRoad('straight', { worldOrigin: [0, 0] }), right = createRoad('straight', { worldOrigin: [0, 10] });
    try {
      for (const key of ['asphalt', 'sidewalk_tile']) {
        const values = (root: Group, edge: number): Map<string, number[]> => {
          const result = new Map<string, number[]>();
          visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === key).forEach(mesh => {
            const p = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv'), n = mesh.geometry.getAttribute('normal');
            for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - edge) < 0.0001 && n.getY(i) > 0.9) {
              result.set(`${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)}`, [uv.getX(i), uv.getY(i)]);
            }
          }); return result;
        };
        const a = values(left, 5), b = values(right, -5); expect(a.size).toBeGreaterThan(1);
        expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
        a.forEach((uv, position) => uv.forEach((value, axis) => expect(value).toBeCloseTo(b.get(position)![axis], 5)));
      }
    } finally { disposeModel(left); disposeModel(right); }
  });
});

describe('Prompt 4 roads: seeded props, budgets and special pieces', () => {
  it.each(ROAD_KINDS)('%s stays in budget across 32 seeds, states and all regions', kind => {
    for (let seed = 0; seed < 32; seed++) for (const state of registry[`road.${kind}`].states ?? ['closed']) for (const region of REGIONS) {
      const root = createRoad(kind, { seed, state, region });
      try {
        expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-5.001); expect(bounds.max.x).toBeLessThanOrEqual(5.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-5.001); expect(bounds.max.z).toBeLessThanOrEqual(5.001);
        expect(bounds.min.y).toBeGreaterThanOrEqual((kind.includes('bridge') ? -3 : 0) - 0.001);
        const groups = root.children.filter(child => child.name.startsWith('state_'));
        const active = groups.find(group => group.visible) ?? root;
        for (const prop of active.userData.props ?? []) {
          // Bounds are calculated from the unmerged construction buffers. Trees include every leaf card.
          for (const x of [prop.min[0], (prop.min[0] + prop.max[0]) / 2, prop.max[0]]) for (const z of [prop.min[2], (prop.min[2] + prop.max[2]) / 2, prop.max[2]]) {
            if (kind.includes('bridge')) expect(Math.abs(x)).toBeGreaterThan(3.5);
            else if (kind === 'rail_crossing') expect(Math.abs(x)).toBeGreaterThan(3.5);
            else {
              root.updateMatrixWorld(true);
              const sidewalks = visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'sidewalk_tile');
              const hits = new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0)).intersectObjects(sidewalks, false);
              expect(hits.some(hit => Math.abs(hit.point.y - 0.15) < 0.0001)).toBe(true);
            }
          }
          if (prop.kind === 'motorbike_taxi_stand' || prop.kind === 'bus_shelter') expect(kind).toBe('straight');
        }
      } finally { disposeModel(root); }
    }
  });

  it('actually varies curbs, trees, traffic signs, bus shelters and taxi stands by seed', () => {
    const props = new Set<string>(), curbs = new Set<boolean>();
    for (let seed = 0; seed < 32; seed++) {
      const root = createRoad('straight', { seed });
      try { root.userData.props.forEach((prop: { kind: string }) => props.add(prop.kind)); curbs.add(root.userData.paintedCurb); }
      finally { disposeModel(root); }
    }
    expect([...props].sort()).toEqual(['bus_shelter', 'drain', 'motorbike_taxi_stand', 'street_light', 'street_tree', 'traffic_sign']);
    expect(curbs.size).toBe(2);
  });

  it('keeps the concrete bridge deck at zero, piers at -3 and omits raised sidewalks', () => {
    const root = createRoad('bridge');
    try {
      expect(cast(root, 0, -4, ['concrete_raw'])).toBeCloseTo(0, 5);
      expect(cast(root, 4, 0, ['concrete_raw'])).toBeCloseTo(0, 5);
      expect(new Box3().setFromObject(root).min.y).toBeCloseTo(-3, 5);
      expect(visibleMeshes(root).some(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'sidewalk_tile')).toBe(false);
    } finally { disposeModel(root); }
  });

  it('raises the drawbridge leaf 70 degrees at the hinge, keeps approaches fixed and batches moving paint/steel', () => {
    const closed = createRoad('drawbridge', { state: 'closed' }), open = createRoad('drawbridge', { state: 'open' });
    try {
      const leaves = (root: Group): Bone[] => { const result: Bone[] = []; root.traverseVisible(node => { if (node instanceof Bone && node.name === 'anim_leaf') result.push(node); }); return result; };
      expect(leaves(closed)).toHaveLength(1); expect(leaves(open)).toHaveLength(1);
      expect(leaves(closed)[0].position.toArray()).toEqual([...DRAWBRIDGE_HINGE]);
      expect(leaves(closed)[0].rotation.x).toBe(0); expect(leaves(open)[0].rotation.x).toBeCloseTo(-70 * Math.PI / 180, 8);
      const leaf = visibleMeshes(open).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'asphalt')!;
      expect(leaf).toBeInstanceOf(SkinnedMesh); expect((leaf as SkinnedMesh).boundingBox!.max.y).toBeGreaterThan(6.3);
      for (const root of [closed, open]) {
        expect(cast(root, 0, -4.5, ['concrete_raw'])).toBeCloseTo(0, 5);
        expect(cast(root, 0, 4.5, ['concrete_raw'])).toBeCloseTo(0, 5);
        const materials = visibleMeshes(root).map(mesh => mesh.material); expect(new Set(materials).size).toBe(materials.length);
      }
      expect(cast(closed, 0, 0)).toBeCloseTo(0, 5); expect(cast(open, 0, 0)).toBe(-Infinity);
      expect(visibleBounds(closed).max.y).toBeCloseTo(6.5, 5);
      expect(visibleBounds(open).max.y).toBeGreaterThan(visibleBounds(closed).max.y + 0.1);
    } finally { disposeModel(closed); disposeModel(open); }
  });

  it('matches the actual railway rail-head geometry to a 1 m clear gauge at both E/W boundaries', () => {
    const root = createRoad('rail_crossing');
    try {
      expect(root.userData.rail).toMatchObject(RAIL_INTERFACE);
      for (const x of [-4.999, 4.999]) for (const z of [-0.54, 0.54]) expect(cast(root, x, z, ['metal_steel'])).toBeCloseTo(0.42, 5);
      for (const x of [-4.999, 4.999]) expect(cast(root, x, 0, ['metal_steel'])).toBe(-Infinity);
      for (const x of [-4.999, 4.999]) {
        expect(cast(root, x, 0, ['gravel_ballast'])).toBeCloseTo(0.3, 5);
        expect(cast(root, x, 1.599, ['gravel_ballast'])).toBeCloseTo(0.00075, 4);
        expect(cast(root, x, 0)).toBe(-Infinity);
      }
      const steel = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'metal_steel')!;
      const p = steel.geometry.getAttribute('position');
      const faces = new Set<number>();
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) === 5 && Math.abs(p.getY(i) - 0.42) < 0.0001) faces.add(Number(p.getZ(i).toFixed(4)));
      expect([...faces].sort((a, b) => a - b)).toEqual([-0.58, -0.5, 0.5, 0.58]);
      for (const z of [-4.999, 4.999]) expect(cast(root, 0, z)).toBeCloseTo(0, 5);
      expect(cast(root, 0, 0)).toBeCloseTo(crossingHeight(0), 5);
      expect(visibleMeshes(root).some(mesh => (mesh.material as MeshStandardMaterial).userData.sign?.text.replace(/\s/g, '') === 'หยุดระวังรถไฟ')).toBe(true);
    } finally { disposeModel(root); }
  });

  it('provides two real barrier pivots, closed/open states and alternating signal phases', () => {
    for (const state of ['closed', 'open']) {
      const root = createRoad('rail_crossing', { state });
      try {
        const bones: Bone[] = []; root.traverseVisible(node => { if (node instanceof Bone && node.name.startsWith('anim_barrier_')) bones.push(node); });
        expect(bones.map(bone => bone.name).sort()).toEqual(['anim_barrier_0', 'anim_barrier_1']);
        expect(bones[0].position.toArray()).toEqual([-3.91, 0.9, -2.1]);
        expect(bones[1].position.toArray()).toEqual([3.91, 0.9, 2.1]);
        expect(bones[0].rotation.z).toBeCloseTo(state === 'open' ? 80 * Math.PI / 180 : 0, 8);
        expect(bones[1].rotation.z).toBeCloseTo(state === 'open' ? -80 * Math.PI / 180 : 0, 8);
        const tipHeight = 0.9 + 7.82 * Math.sin(80 * Math.PI / 180) + 0.08 * Math.cos(80 * Math.PI / 180);
        expect(visibleBounds(root).max.y).toBeCloseTo(state === 'open' ? tipHeight : 2.825, 4);
        const lamps = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).userData.railwaySignal)!;
        const uv = lamps.geometry.getAttribute('uv');
        expect(new Set(Array.from({ length: uv.count }, (_, i) => Math.floor(uv.getX(i))))).toEqual(new Set(state === 'open' ? [-1, 2, 3] : [-1, 0, 1]));
      } finally { disposeModel(root); }
    }
  });

  it('matches four E/W wire attachment centers exactly, including 11 m power offsets and 6 m telecom', () => {
    const root = createRoad('power_crossing');
    try {
      for (const side of ['E', 'W']) {
        const x = side === 'E' ? 5 : -5;
        POWER_INTERFACE.offsets.forEach((z, index) => {
          const anchor = root.getObjectByName(`road.power_crossing/wire_${side}_power_${index}`)!;
          expect(anchor.position.toArray()).toEqual([x, 11, z]); expect(anchor.children).toHaveLength(0);
        });
        expect(root.getObjectByName(`road.power_crossing/wire_${side}_telecom`)!.position.toArray()).toEqual([x, 6, 0]);
      }
      // The actual cable mesh contains the edge rings and sags across the carriageway.
      const steel = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'metal_steel')!;
      const p = steel.geometry.getAttribute('position');
      for (const y of [6, 11]) {
        expect(Array.from({ length: p.count }, (_, i) => i).some(i => Math.abs(p.getX(i)) > 4.999 && Math.abs(p.getY(i) - y) < 0.001)).toBe(true);
        expect(Array.from({ length: p.count }, (_, i) => i).some(i => Math.abs(p.getX(i)) < 0.6 && p.getY(i) < y - 0.20 && p.getY(i) > y - 0.35)).toBe(true);
      }
    } finally { disposeModel(root); }
  });

  it('uses only existing base tiles, and selects end/single from masks rather than traffic animation values', () => {
    for (const kind of ROAD_KINDS) expect(registry[`road.${kind}`].tiles).toEqual(ROAD_TILES[kind]);
    const tiles = Object.values(ROAD_TILES).flat(); expect(tiles.some(tile => tile >= 80 && tile <= 206)).toBe(false);
    expect(Object.values(BASIC_MASKS).map(mask => roadForMask(mask).id)).toEqual(Object.keys(BASIC_MASKS).map(kind => `road.${kind}`));
  });

  it('shows connected neighboring roads without adding them to the inspected model', () => {
    const root = roadNeighbors('road.corner', { seed: 1 });
    try {
      expect(root.children).toHaveLength(8);
      expect(root.children.filter(child => child.name.startsWith('road.')).map(child => child.position.toArray()).sort()).toEqual([[0, 0, -10], [10, 0, 0]].sort());
    } finally { disposeModel(root); }
  });

  it('caches curb and signal shaders, updates their clock and leaves signal brightness intact at day/night', () => {
    const curb = roadCurbMaterial(), signal = railwaySignalMaterial();
    expect(curb).toBe(roadCurbMaterial()); expect(signal).toBe(railwaySignalMaterial());
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <emissivemap_fragment>' } as Parameters<typeof signal.onBeforeCompile>[0];
    signal.onBeforeCompile(shader, {} as Parameters<typeof signal.onBeforeCompile>[1]);
    updateRoadSignals(2.25); expect(shader.uniforms.railwayTime.value).toBe(2.25);
    expect(shader.fragmentShader).toContain('step(1.5, lampPhase)');
    setNightMode(false); expect(signal.emissiveIntensity).toBe(2.5); setNightMode(true); expect(signal.emissiveIntensity).toBe(2.5); setNightMode(false);
  });

  it('disposes each owned skeleton once and preserves shared materials during gallery rebuilds', () => {
    const root = createRoad('drawbridge'), skeletons = new Set(visibleMeshes(root).filter((mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh).map(mesh => mesh.skeleton));
    const spies = [...skeletons].map(skeleton => jest.spyOn(skeleton, 'dispose'));
    const material = (visibleMeshes(root)[0] as Mesh).material as MeshStandardMaterial, materialSpy = jest.spyOn(material, 'dispose');
    disposeModel(root); spies.forEach(spy => { expect(spy).toHaveBeenCalledTimes(1); spy.mockRestore(); });
    expect(materialSpy).not.toHaveBeenCalled(); materialSpy.mockRestore();
  });

  it('constructs every road without three.js errors or warnings', () => {
    const error = jest.spyOn(console, 'error'), warn = jest.spyOn(console, 'warn');
    try {
      ROAD_KINDS.forEach(kind => { const root = createRoad(kind); disposeModel(root); });
      expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
    } finally { error.mockRestore(); warn.mockRestore(); }
  });
});
