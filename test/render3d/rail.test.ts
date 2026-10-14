/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { railNeighbors } from '../../src/render3d/gallery/rail-neighbors.js';
import { roadConcrete } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { createRail, RAIL_KINDS, RAIL_TILES } from '../../src/render3d/models/rail/rail.js';
import { CURVE_RADIUS, RAIL_MASKS, railForMask, trackPaths } from '../../src/render3d/models/rail/track.js';
import { POWER_INTERFACE, RAIL_INTERFACE } from '../../src/render3d/models/road/interfaces.js';
import { createRoad } from '../../src/render3d/models/road/road.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleBounds, visibleMeshes } from '../../src/render3d/util/geometry.js';

function hits(root: Group, x: number, z: number, key: string) {
  root.updateMatrixWorld(true);
  const meshes = visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === key);
  return new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0)).intersectObjects(meshes, false);
}
const top = (root: Group, x: number, z: number, key: string): number => hits(root, x, z, key)[0]?.point.y ?? -Infinity;
const edge = (side: number, d: number): [number, number] => side === 1 ? [d, -4.99999]
  : side === 2 ? [4.99999, d] : side === 4 ? [-d, 4.99999] : [-4.99999, -d];
type Sleeper = { x: number; z: number; station: number; width: number; path: string };
const sleepers = (root: Group): Sleeper[] => root.userData.sleepers;

describe('Prompt 5: meter-gauge seams and topology', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('joins every connected edge for mask %i', mask => {
    const selected = railForMask(mask)!;
    const root = registry[selected.id].factory({ seed: 42 }); root.rotation.y = selected.rotationY;
    try {
      for (const side of [1, 2, 4, 8]) {
        for (const d of [-0.54, 0.54]) {
          const y = top(root, ...edge(side, d), 'metal_steel');
          if (mask & side) expect(y).toBeCloseTo(RAIL_INTERFACE.headY, 5); else expect(y).toBe(-Infinity);
        }
        if (mask & side) {
          expect(top(root, ...edge(side, 0), 'metal_steel')).toBe(-Infinity);
          for (const d of [-1.4, 1.4]) expect(top(root, ...edge(side, d), 'gravel_ballast')).toBeCloseTo(0.15, 3);
          for (const d of [-1.19, 0, 1.19]) expect(top(root, ...edge(side, d), 'gravel_ballast')).toBeCloseTo(0.3, 5);
          for (const d of [-1.61, 1.61]) expect(top(root, ...edge(side, d), 'gravel_ballast')).toBe(-Infinity);
        }
        expect(top(root, ...edge(side, 4.8), 'dirt_laterite')).toBeCloseTo(0, 5);
      }
    } finally { disposeModel(root); }
  });

  it('keeps a 1.000 m gap between the inside rail head edges', () => {
    for (const kind of ['straight', 'corner', 't', 'cross'] as const) {
      const root = createRail(kind);
      try {
        const mesh = visibleMeshes(root).find(m => (m.material as MeshStandardMaterial).userData.materialKey === 'metal_steel')!;
        const p = mesh.geometry.getAttribute('position');
        const xs = Array.from({ length: p.count }, (_, i) => i)
          .filter(i => Math.abs(p.getZ(i) + 5) < 1e-5 && Math.abs(p.getY(i) - 0.42) < 1e-5)
          .map(i => p.getX(i));
        const innerLeft = Math.max(...xs.filter(x => x < 0)), innerRight = Math.min(...xs.filter(x => x > 0));
        expect(innerRight - innerLeft).toBeCloseTo(1, 6);
      } finally { disposeModel(root); }
    }
  });

  it('curves around a real 5 m centerline radius with tangent N/E endpoints', () => {
    const path = trackPaths('corner')[0];
    expect(path.length).toBeCloseTo(CURVE_RADIUS * Math.PI / 2, 8);
    for (let i = 0; i <= 24; i++) {
      const p = path.at(path.length * i / 24);
      expect(Math.hypot(p.x - 5, p.z + 5)).toBeCloseTo(5, 8);
      expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1, 8);
    }
    expect(path.at(0)).toEqual({ x: 0, z: -5, nx: 1, nz: -0 });
    const end = path.at(path.length); expect(end.x).toBeCloseTo(5); expect(end.z).toBeCloseTo(0);
    const root = createRail('corner');
    try {
      const p = visibleMeshes(root).find(m => (m.material as MeshStandardMaterial).userData.materialKey === 'metal_steel')!
        .geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - 0.42) < 1e-5) {
        const r = Math.hypot(p.getX(i) - 5, p.getZ(i) + 5);
        expect([4.42, 4.5, 5.5, 5.58].some(expected => Math.abs(r - expected) < 1e-5)).toBe(true);
      }
    } finally { disposeModel(root); }
  });

  it.each(['t', 'cross'] as const)('%s uses a single nonoverlapping ballast surface through the junction', kind => {
    const root = createRail(kind);
    try {
      for (const [x, z] of [[0.17, -0.21], [0.42, 0.11], [-0.51, 0.35], [0.22, -3.12]]) {
        const surface = hits(root, x, z, 'gravel_ballast');
        expect(surface).toHaveLength(1); expect(surface[0].point.y).toBeCloseTo(0.3, 5);
        expect(surface[0].face!.normal.y).toBeGreaterThan(0.999);
      }
    } finally { disposeModel(root); }
  });

  it('maps ordinary/special tiles while leaving 228–236 selection to the neighbor mask', () => {
    expect(RAIL_TILES.straight).toEqual([226, 227]); expect(RAIL_TILES.bridge).toEqual([224, 225]);
    expect(RAIL_TILES.power_crossing).toEqual([221, 222]);
    for (const kind of ['corner', 't', 'cross', 'end'] as const) expect(RAIL_TILES[kind])
      .toEqual(Array.from({ length: 9 }, (_, i) => 228 + i));
    expect(railForMask(0)).toBeUndefined();
  });
});

describe('Prompt 5: sleepers and world coordinates', () => {
  it('continues the 0.6 m sleeper lattice across three 10 m tiles including partial edge sleepers', () => {
    const roots = [0, 10, 20].map(z => createRail('straight', { worldOrigin: [0, z] }));
    try {
      const stations = [...new Set(roots.flatMap(root => sleepers(root).map(s => +s.station.toFixed(6))))].sort((a, b) => a - b);
      for (let i = 1; i < stations.length; i++) expect(stations[i] - stations[i - 1]).toBeCloseTo(0.6, 6);
      roots.forEach(root => sleepers(root).forEach(s => expect(s.z + root.userData.worldOrigin[1]).toBeCloseTo(s.station, 6)));
      // A sleeper centered on world Z=15 must be split exactly between the two tiles.
      for (const [root, z] of [[roots[1], 4.95], [roots[2], -4.95]] as const) {
        root.updateMatrixWorld(true);
        const concrete = visibleMeshes(root).filter(mesh => mesh.material === roadConcrete());
        expect(new Raycaster(new Vector3(0, 1, z), new Vector3(0, -1, 0)).intersectObjects(concrete, false)[0].point.y)
          .toBeCloseTo(0.32, 5);
      }
    } finally { roots.forEach(disposeModel); }
  });

  it('supports route distance phase through a curve and its reversed east neighbor', () => {
    const options = { sleeperOffset: 1.234 }, root = createRail('corner', options), context = railNeighbors('rail.corner', options);
    try {
      const east = context.children.find(child => child.position.x === 10 && child.position.z === 0)!;
      const end = options.sleeperOffset + trackPaths('corner')[0].length;
      const routeStations = [...sleepers(root).filter(s => s.station <= end).map(s => s.station),
        ...sleepers(east as Group).map(s => -s.station).filter(s => s >= end)].sort((a, b) => a - b);
      for (let i = 1; i < routeStations.length; i++) expect(routeStations[i] - routeStations[i - 1]).toBeCloseTo(0.6, 6);
      expect(east.rotation.y).toBeCloseTo(-Math.PI / 2);
      expect(context.children).toHaveLength(8);
    } finally { disposeModel(root); disposeModel(context); }
  });

  it.each(RAIL_KINDS)('%s tolerates changing sleeper phases and negative world centers without exceeding the budget', kind => {
    for (let phase = 0; phase < 12; phase++) {
      const root = createRail(kind, { sleeperOffset: phase * 0.05, worldOrigin: [-137.25, -81.75] });
      try {
        expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const bounds = visibleBounds(root);
        for (const axis of ['x', 'z'] as const) {
          expect(bounds.min[axis]).toBeGreaterThanOrEqual(-5.00001); expect(bounds.max[axis]).toBeLessThanOrEqual(5.00001);
        }
        for (const s of sleepers(root)) expect(s.station / 0.6).toBeCloseTo(Math.round(s.station / 0.6), 6);
      } finally { disposeModel(root); }
    }
  });

  it('bakes top-surface UVs in world coordinates before rotating a canonical east/west tile', () => {
    const root = createRail('straight', { worldOrigin: [13.2, -18.4], worldRotationY: -Math.PI / 2 });
    root.rotation.y = -Math.PI / 2; root.position.set(13.2, 0, -18.4); root.updateMatrixWorld(true);
    try {
      for (const mesh of visibleMeshes(root)) {
        if ((mesh.material as MeshStandardMaterial).userData.sign) continue;
        const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal'), uv = mesh.geometry.getAttribute('uv');
        for (let i = 0; i < p.count; i++) if (n.getY(i) > 0.999) {
          const world = new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
          expect(uv.getX(i)).toBeCloseTo(world.x, 4); expect(uv.getY(i)).toBeCloseTo(world.z, 4);
        }
      }
    } finally { disposeModel(root); }
  });

  it('matches world UVs for rail heads, sleepers, soil and ballast at a north/south seam', () => {
    const a = createRail('straight', { worldOrigin: [0, 10] }), b = createRail('straight', { worldOrigin: [0, 20] });
    try {
      const values = (root: Group, z: number, material: string): Map<string, number[]> => {
        const output = new Map<string, number[]>();
        visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === material).forEach(mesh => {
          const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal'), uv = mesh.geometry.getAttribute('uv');
          for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - z) < 1e-5 && n.getY(i) > 0.99)
            output.set(`${+p.getX(i).toFixed(4)},${+p.getY(i).toFixed(4)}`, [uv.getX(i), uv.getY(i)]);
        }); return output;
      };
      for (const key of ['metal_steel', 'concrete_raw', 'dirt_laterite', 'gravel_ballast']) {
        const first = values(a, 5, key), second = values(b, -5, key);
        expect(first.size).toBeGreaterThan(1); expect([...first.keys()].sort()).toEqual([...second.keys()].sort());
        first.forEach((uv, p) => uv.forEach((value, axis) => expect(value).toBeCloseTo(second.get(p)![axis], 5)));
      }
    } finally { disposeModel(a); disposeModel(b); }
  });
});

describe('Prompt 5: special structures, seeded props and budgets', () => {
  it.each(RAIL_KINDS)('%s stays within budget and fixed massing in every region across 8 seeds', kind => {
    let baseline: Vector3 | undefined;
    for (let seed = 0; seed < 8; seed++) for (const region of REGIONS) {
      const root = createRail(kind, { seed, region });
      try {
        expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(root.userData.regionTier).toBe('R3'); expect(root.userData.region).toBe(region);
        const bounds = visibleBounds(root), size = bounds.getSize(new Vector3());
        expect(bounds.min.x).toBeGreaterThanOrEqual(-5.00001); expect(bounds.max.x).toBeLessThanOrEqual(5.00001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-5.00001); expect(bounds.max.z).toBeLessThanOrEqual(5.00001);
        if (baseline) expect(size.distanceTo(baseline)).toBeLessThan(0.00001); else baseline = size;
        expect(root.userData.connections).toBe(RAIL_MASKS[kind === 'bridge' || kind === 'power_crossing' ? 'straight' : kind]);
        expect(new Set(visibleMeshes(root).map(mesh => mesh.material)).size).toBe(countDrawCalls(root));
        for (const prop of root.userData.props) if (!['utility_pole'].includes(prop.kind)) {
          if (kind === 'bridge') {
            expect(prop.min[0]).toBeGreaterThanOrEqual(1.82); expect(prop.max[0]).toBeLessThanOrEqual(2.6);
          } else expect(Math.min(Math.abs(prop.min[0]), Math.abs(prop.max[0]))).toBeGreaterThan(1.6);
        }
      } finally { disposeModel(root); }
    }
  });

  it('provides a red-and-white steel buffer and stops the rails before the closed south edge', () => {
    const root = createRail('end');
    try {
      expect(top(root, 0, 0.85, 'road_marking_white')).toBeCloseTo(1.13, 5);
      expect(visibleMeshes(root).some(mesh => (mesh.material as MeshStandardMaterial).color.getHex() === 0xba3532)).toBe(true);
      const paint = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).color.getHex() === 0xba3532)!;
      for (const side of [-1, 1]) {
        const ray = new Raycaster(new Vector3(0, 1, 0.85 + side), new Vector3(0, 0, -side));
        expect(ray.intersectObject(paint)[0].point.z).toBeCloseTo(0.85 + side * 0.102, 5);
      }
      expect(top(root, 0.54, 1.3, 'metal_steel')).toBeGreaterThanOrEqual(0.42 - 1e-5);
      expect(top(root, 0.54, 2, 'metal_steel')).toBe(-Infinity);
    } finally { disposeModel(root); }
  });

  it('has dark trusses, riverbed piers, a side walkway and matching bridge approach rails', () => {
    const root = createRail('bridge');
    try {
      const bounds = visibleBounds(root); expect(bounds.min.y).toBeCloseTo(-3, 6); expect(bounds.max.y).toBeCloseTo(4.88, 5);
      const steel = visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).color.getHex() === 0x3d4952);
      expect(steel).toHaveLength(1);
      const walk = new Raycaster(new Vector3(2.2, 2, 2), new Vector3(0, -1, 0)).intersectObjects(steel, false);
      expect(walk[0].point.y).toBeCloseTo(0.3, 5);
      expect(top(root, 0.54, -4.99999, 'metal_steel')).toBeCloseTo(0.42, 5);
      expect(top(root, 4, 0, 'water_river')).toBeCloseTo(-0.6, 5);
    } finally { disposeModel(root); }
  });

  it('reuses the road power terminal layout exactly at 11 m and 6 m', () => {
    const rail = createRail('power_crossing'), road = createRoad('power_crossing');
    try {
      const terminals = (root: Group) => root.children.filter(child => child.userData.attachment)
        .map(child => [child.name.slice(child.name.indexOf('/wire_')), ...child.position.toArray()]);
      expect(terminals(rail)).toEqual(terminals(road)); expect(terminals(rail)).toHaveLength(8);
      expect(rail.userData.power).toEqual({ ...POWER_INTERFACE, offsets: [...POWER_INTERFACE.offsets] });
      expect(countTriangles(road)).toBe(870); expect(countDrawCalls(road)).toBe(7);
    } finally { disposeModel(rail); disposeModel(road); }
  });
});

describe('Slanted railways: a staircase of corners runs straight', () => {
  it('lays a corner whose sides are both steps as one straight 45° track, and eases where straight track meets it', () => {
    const [straight] = trackPaths('corner', 3), mid = straight.at(straight.length / 2), end = straight.at(straight.length);
    expect(straight.length).toBeCloseTo(5 * Math.SQRT2, 3);
    expect(mid.x).toBeCloseTo(2.5, 3); expect(mid.z).toBeCloseTo(-2.5, 3);
    expect(end.nx).toBeCloseTo(Math.SQRT1_2, 3); expect(end.nz).toBeCloseTo(-Math.SQRT1_2, 3);
    // North a step, east straight: in at 45°, out square to the east edge
    const [eased] = trackPaths('corner', 1), start = eased.at(0), out = eased.at(eased.length);
    expect(start.nx).toBeCloseTo(Math.SQRT1_2, 3); expect(out.nx).toBeCloseTo(0, 3); expect(out.nz).toBeCloseTo(-1, 3);
  });

  it('picks the staircase variant for the corners of a slanted railway on the map', () => {
    const W = 10, s = new TileSnapshot(W, 10);
    for (const [x, y] of [[1, 2], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5], [5, 6]]) s.values[y * W + x] = 226;
    const variant = (x: number, y: number) => s.placement(y * W + x, 'central')!.options.variant;
    for (const [x, y] of [[3, 3], [4, 3], [4, 4]]) expect(variant(x, y)).toBe(3);
    for (const [x, y] of [[3, 2], [5, 4]]) expect([1, 2]).toContain(variant(x, y));
    const ends = [variant(3, 2), variant(5, 4)].map(v => v === 1 ? 'north' : 'east');
    expect(new Set(ends).size).toBe(2);
  });
});
