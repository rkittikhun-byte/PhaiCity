/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { powerNeighbors } from '../../src/render3d/gallery/power-neighbors.js';
import { paintedSteel, roadConcrete } from '../../src/render3d/materials/library.js';
import { createPower, POWER_KINDS, POWER_SAG, POWER_TILES, powerForMask, powerMask } from '../../src/render3d/models/power/power.js';
import { createRail } from '../../src/render3d/models/rail/rail.js';
import { createRoad } from '../../src/render3d/models/road/road.js';
import { POWER_INTERFACE } from '../../src/render3d/models/road/interfaces.js';
import { registry } from '../../src/render3d/models/registry.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleBounds, visibleMeshes } from '../../src/render3d/util/geometry.js';

const terminals = (root: Object3D): Object3D[] => root.children.filter(node => node.userData.attachment);
const closeVector = (actual: Vector3, expected: number[]): void => actual.toArray().forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));

describe('Prompt 6: connectivity and actual wire geometry', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('connects precisely on the boundary for mask %i', mask => {
    const selected = powerForMask(mask)!;
    const root = registry[selected.id].factory({ seed: 7 }); root.rotation.y = selected.rotationY; root.updateMatrixWorld(true);
    try {
      expect(terminals(root)).toHaveLength([1, 2, 4, 8].filter(side => mask & side).length * 4);
      for (const side of [1, 2, 4, 8]) {
        const edge = terminals(root).filter(node => {
          const p = node.getWorldPosition(new Vector3());
          return side === 1 ? p.z < -4.99 : side === 2 ? p.x > 4.99 : side === 4 ? p.z > 4.99 : p.x < -4.99;
        });
        expect(edge).toHaveLength(mask & side ? 4 : 0);
        const offsets = edge.filter(node => node.userData.kind.startsWith('power')).map(node => {
          const p = node.getWorldPosition(new Vector3()); expect(p.y).toBeCloseTo(11, 8);
          return side & 5 ? p.x : p.z;
        }).sort((a, b) => a - b);
        if (mask & side) {
          offsets.forEach((offset, i) => expect(offset).toBeCloseTo(POWER_INTERFACE.offsets[i], 6));
          const p = edge.find(node => node.userData.kind === 'telecom')!.getWorldPosition(new Vector3());
          expect(p.y).toBeCloseTo(6, 8); expect(side & 5 ? p.x : p.z).toBeCloseTo(0, 8);
        }
      }
    } finally { disposeModel(root); }
  });

  it.each(POWER_KINDS)('%s has real vertices at each wire attachment and the 0.15 m midpoint sag', kind => {
    const root = createPower(kind, { seed: 7 });
    try {
      const p = visibleMeshes(root).find(mesh => mesh.material === paintedSteel(0x20252a))!.geometry.getAttribute('position');
      for (const terminal of terminals(root)) {
        const end = terminal.position;
        const near = Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i))
          .filter(vertex => vertex.distanceTo(end) < (terminal.userData.kind === 'telecom' ? 0.06 : 0.025));
        expect(near.length).toBeGreaterThanOrEqual(3);
      }
      // At the middle of a half-span, the tangent is horizontal: the tube ring lies on this section plane.
      for (const span of root.userData.spans.filter((s: { kind: string }) => s.kind.startsWith('power'))) {
        const mid = new Vector3().fromArray(span.start).lerp(new Vector3().fromArray(span.end), 0.5);
        mid.y -= POWER_SAG;
        const longitudinal = span.side & 5 ? 'z' : 'x';
        const ring = Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i))
          .filter(vertex => Math.abs(vertex[longitudinal] - mid[longitudinal]) < 1e-5 && vertex.distanceTo(mid) < 0.025);
        expect(ring.length).toBeGreaterThanOrEqual(3);
        expect(ring.reduce((sum, vertex) => sum + vertex.y, 0) / ring.length).toBeCloseTo(10.85, 5);
      }
    } finally { disposeModel(root); }
  });

  it('matches both existing road and railway E/W crossings, including telecom', () => {
    const power = createPower('straight'); power.rotation.y = -Math.PI / 2;
    const crossings = [createRoad('power_crossing'), createRail('power_crossing')];
    try {
      power.updateMatrixWorld(true);
      const signature = (root: Group) => terminals(root).map(node => node.getWorldPosition(new Vector3()).toArray()
        .map(n => +n.toFixed(6)).join(',')).sort();
      crossings.forEach(root => { root.updateMatrixWorld(true); expect(signature(root)).toEqual(signature(power)); });
    } finally { [power, ...crossings].forEach(disposeModel); }
  });

  it('joins actual neighbor terminals in the gallery at every connected side', () => {
    for (const kind of POWER_KINDS) {
      const root = createPower(kind), neighbors = powerNeighbors(root.name, {});
      try {
        expect(neighbors.children).toHaveLength(8); neighbors.updateMatrixWorld(true);
        for (const terminal of terminals(root)) {
          const candidate = neighbors.children.flatMap(terminals).find(node => node.getWorldPosition(new Vector3()).distanceTo(terminal.position) < 1e-6);
          expect(candidate).toBeDefined(); expect(candidate!.userData.kind.startsWith('power')).toBe(terminal.userData.kind.startsWith('power'));
        }
      } finally { disposeModel(root); disposeModel(neighbors); }
    }
  });

  it('maps all tiles without inventing a disconnected or congested piece', () => {
    expect(POWER_TILES.straight).toEqual([210, 211]); expect(POWER_TILES.water).toEqual([208, 209]);
    for (const kind of ['corner', 't', 'cross', 'end'] as const) expect(POWER_TILES[kind]).toEqual(Array.from({ length: 9 }, (_, i) => i + 212));
    expect(powerForMask(0)).toBeUndefined(); expect(powerForMask(NaN)).toBeUndefined();
  });
});

describe('Prompt 6: supports, props, UVs and regions', () => {
  it.each(POWER_KINDS)('%s has fixed massing in six regions and handles every prop within the budgets', kind => {
    const propKinds = new Set<string>();
    for (const region of REGIONS) for (let seed = 0; seed < 8; seed++) {
      const root = createPower(kind, { region, seed });
      try {
        const bounds = visibleBounds(root);
        closeVector(bounds.min, [-5, kind === 'water' ? -3 : 0, -5]); closeVector(bounds.max, [5, 12, 5]);
        expect(root.userData.region).toBe(region); expect(root.userData.regionTier).toBe('R3');
        expect(root.userData.connections).toBe(powerMask(kind));
        expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(new Set(visibleMeshes(root).map(mesh => mesh.material)).size).toBe(countDrawCalls(root));
        root.userData.props.forEach((prop: { kind: string }) => propKinds.add(prop.kind));
      } finally { disposeModel(root); }
    }
    for (const prop of ['transformer', 'meter_box', 'advertising_sign']) expect(propKinds.has(prop)).toBe(true);
  });

  it('builds a centered square concrete pole and two real crossarm levels', () => {
    const root = createPower('straight', { seed: 7 }); root.updateMatrixWorld(true);
    try {
      const concrete = visibleMeshes(root).filter(mesh => mesh.material === roadConcrete());
      const hits = new Raycaster(new Vector3(2, 8, 0), new Vector3(-1, 0, 0)).intersectObjects(concrete, false);
      expect(hits[0].point.x).toBeCloseTo(0.16, 5);
      const steel = visibleMeshes(root).filter(mesh => mesh.material === paintedSteel(0x858c8e));
      for (const y of [10.72, 5.72]) expect(new Raycaster(new Vector3(0.55, y, 1), new Vector3(0, 0, -1)).intersectObjects(steel, false).length).toBeGreaterThan(0);
    } finally { disposeModel(root); }
  });

  it('anchors the end guy to concrete at ground level, opposite the live north side', () => {
    const root = createPower('end');
    try {
      const guy = root.userData.props.find((prop: { kind: string }) => prop.kind === 'guy_wire');
      expect(guy.min[1]).toBeCloseTo(0, 6); expect(guy.max[1]).toBeGreaterThan(10);
      expect(guy.max[2]).toBeCloseTo(4, 6); expect(root.userData.connections).toBe(1);
    } finally { disposeModel(root); }
  });

  it('puts an open steel lattice on a pile cap with all four piles reaching the riverbed', () => {
    const root = createPower('water'); root.updateMatrixWorld(true);
    try {
      const cap = root.userData.props.find((prop: { kind: string }) => prop.kind === 'pile_cap');
      expect(cap.min[1]).toBeCloseTo(-3, 6); expect(cap.max[1]).toBeCloseTo(0.15, 6);
      const concrete = visibleMeshes(root).filter(mesh => mesh.material === roadConcrete());
      for (const x of [-0.75, 0.75]) for (const z of [-0.75, 0.75]) {
        const hits = new Raycaster(new Vector3(x, -4, z), new Vector3(0, 1, 0)).intersectObjects(concrete, false);
        expect(hits[0].point.y).toBeCloseTo(-3, 6);
      }
      const steel = visibleMeshes(root).filter(mesh => mesh.material === paintedSteel(0x858c8e));
      expect(new Raycaster(new Vector3(0, 3.7, 3), new Vector3(0, 0, -1)).intersectObjects(steel, false)).toHaveLength(0);
      expect(root.userData.props.some((prop: { kind: string }) => prop.kind === 'lattice_tower')).toBe(true);
    } finally { disposeModel(root); }
  });

  it('keeps ground UVs continuous through rotated tiles at a noninteger world origin', () => {
    const root = createPower('straight', { worldOrigin: [13.2, -18.4], worldRotationY: -Math.PI / 2 });
    root.rotation.y = -Math.PI / 2; root.position.set(13.2, 0, -18.4); root.updateMatrixWorld(true);
    try {
      const mesh = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'dirt_laterite')!;
      const p = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
      for (let i = 0; i < p.count; i++) {
        const world = new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        expect(uv.getX(i)).toBeCloseTo(world.x, 4); expect(uv.getY(i)).toBeCloseTo(world.z, 4);
      }
    } finally { disposeModel(root); }
  });
});
