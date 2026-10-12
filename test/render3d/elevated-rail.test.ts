/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { elevatedRailForMask, ELEVATED_HEIGHTS, ELEVATED_INTERFACE, ELEVATED_KINDS, ELEVATED_STYLES } from '../../src/render3d/models/rail/elevated.js';
import { RAIL_MASKS, TrackKind } from '../../src/render3d/models/rail/track.js';
import { railNeighbors } from '../../src/render3d/gallery/rail-neighbors.js';
import { elevatedRampPreview } from '../../src/render3d/gallery/elevated-preview.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

function surface(root: Group, x: number, z: number): number {
  root.updateMatrixWorld(true);
  const hit = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObjects(root.children, true)[0];
  if (!hit) throw new Error(`No visible surface at ${x},${z}`); return hit.point.y;
}

function headEdges(root: Group, side: 'N' | 'E', y: number): number[] {
  const edges = new Set<number>();
  for (const mesh of visibleMeshes(root)) {
    if (Array.isArray(mesh.material) || mesh.material.name !== 'metal_steel') continue;
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i) - y) > 0.0001) continue;
      if (Math.abs((side === 'N' ? p.getZ(i) + 5 : p.getX(i) - 5)) < 0.0001)
        edges.add(Number((side === 'N' ? p.getX(i) : p.getZ(i)).toFixed(4)));
    }
  }
  return [...edges].sort((a, b) => a - b);
}

describe('Prompt 5B elevated rail geometry', () => {
  it.each(ELEVATED_STYLES)('%s uses all the original connection masks and rotation convention', style => {
    expect(elevatedRailForMask(style, 0)).toBeUndefined();
    for (let mask = 1; mask < 16; mask++) {
      const selection = elevatedRailForMask(style, mask)!;
      const root = registry[selection.id].factory();
      try {
        const canonical = root.userData.connections, turns = selection.quarterTurns;
        expect(((canonical << turns) | (canonical >> (4 - turns))) & 15).toBe(mask);
        expect(selection.rotationY).toBe(-turns * Math.PI / 2);
      } finally { disposeModel(root); }
    }
  });
  for (const style of ELEVATED_STYLES) for (const kind of ELEVATED_KINDS) {
    const id = `rail.${style}_${kind}`, entry = registry[id];
    it(`${id} fits its tile and budget in all regions and ramp variants`, () => {
      const counts: number[] = [];
      for (const region of REGIONS) for (const variant of entry.variants ?? [0]) for (const seed of [0, 42, 789]) {
        const root = entry.factory({ region, seed, variant });
        try {
          expect(root.userData.connections).toBe(RAIL_MASKS[(kind === 'ramp' ? 'straight' : kind) as TrackKind]);
          const bounds = new Box3().setFromObject(root);
          expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
          expect(Math.max(Math.abs(bounds.min.x), bounds.max.x, Math.abs(bounds.min.z), bounds.max.z)).toBeLessThanOrEqual(5.001);
          counts.push(countTriangles(root)); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        } finally { disposeModel(root); }
      }
      expect(Math.max(...counts)).toBeLessThanOrEqual(1500);
    });
    if (kind !== 'ramp') it(`${id} matches the same double-track head edges on every connection`, () => {
      const root = entry.factory();
      try {
        const expected = ELEVATED_INTERFACE.trackCenters.flatMap(c => [-1, 1].flatMap(s =>
          [-0.04, 0.04].map(w => Number((c + s * 0.7575 + w).toFixed(4))))).sort((a, b) => a - b);
        expect(headEdges(root, 'N', ELEVATED_HEIGHTS[style] + 0.42)).toEqual(expected);
        if (['corner', 't', 'cross'].includes(kind)) expect(headEdges(root, 'E', ELEVATED_HEIGHTS[style] + 0.42)).toEqual(expected);
        for (const c of ELEVATED_INTERFACE.trackCenters) for (const s of [-1, 1])
          expect(surface(root, c + s * 0.7575, -4.7)).toBeCloseTo(ELEVATED_HEIGHTS[style] + 0.42, 4);
      } finally { disposeModel(root); }
    });
  }

  it.each(ELEVATED_STYLES)('%s ramps join all head, deck, barrier and wire vertices without a height step', style => {
    const models = [0, 1, 2].map(variant => registry[`rail.${style}_ramp`].factory({ variant }));
    models.push(registry[`rail.${style}_straight`].factory());
    try {
      const edge = (root: Group, z: number): number[][] => visibleMeshes(root).flatMap(mesh => {
        const p = mesh.geometry.getAttribute('position'), points: number[][] = [];
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - z) < 0.0001)
          points.push([Number(p.getX(i).toFixed(4)), Number(p.getY(i).toFixed(4))]);
        return points;
      }).filter(p => p[1] > 0.01);
      for (let i = 0; i < 3; i++) {
        // Sleepers at the cut may be different phases; compare continuous rails and barrier sections.
        const a = edge(models[i], 5), b = edge(models[i + 1], -5);
        for (const center of ELEVATED_INTERFACE.trackCenters) for (const side of [-1, 1]) {
          const x = Number((center + side * 0.7575 + 0.04).toFixed(4));
          const y = Number((ELEVATED_HEIGHTS[style] * (i + 1) / 3 + 0.42).toFixed(4));
          expect(a).toContainEqual([x, y]); expect(b).toContainEqual([x, y]);
        }
        expect(surface(models[i], 0, 5 - 0.0001)).toBeCloseTo(surface(models[i + 1], 0, -5 + 0.0001), 3);
        const barrierY = Number((ELEVATED_HEIGHTS[style] * (i + 1) / 3 + (style === 'hsr' ? 1.98 : 1.07)).toFixed(4));
        expect(a.some(p => p[1] === barrierY && Math.abs(p[0]) > 3.5)).toBe(true);
        expect(b.some(p => p[1] === barrierY && Math.abs(p[0]) > 3.5)).toBe(true);
      }
      expect(surface(models[0], 0, -5 + 0.0001)).toBeCloseTo(0, 3);
    } finally { models.forEach(disposeModel); }
  });

  it.each(ELEVATED_STYLES)('%s preview uses the correct family, connection mask and ramp progression', style => {
    const corner = railNeighbors(`rail.${style}_corner`, {}), ramp = railNeighbors(`rail.${style}_ramp`, { variant: 1 });
    const sequence = elevatedRampPreview(style);
    try {
      expect(corner.children.filter(c => c.userData.category === 'rail').map(c => c.name)).toEqual([`rail.${style}_straight`, `rail.${style}_straight`]);
      expect(ramp.children.filter(c => c.userData.category === 'rail').map(c => c.userData.rail.ramp)).toEqual([0, 2]);
      expect(sequence.children.map(c => c.position.z)).toEqual([-15, -5, 5, 15]);
      expect(sequence.children.slice(0, 3).map(c => c.userData.rail.ramp)).toEqual([0, 1, 2]);
    } finally { [corner, ramp, sequence].forEach(disposeModel); }
  });

  it.each(ELEVATED_STYLES)('%s remains within budget with fractional sleeper phases and rotated world UVs', style => {
    for (const kind of ['corner', 't', 'cross'] as const) for (let n = 0; n < 12; n++) {
      const root = registry[`rail.${style}_${kind}`].factory({ sleeperOffset: -15 + n * 0.05,
        worldOrigin: [-10, 20], worldRotationY: -Math.PI / 2 });
      try { expect(countTriangles(root)).toBeLessThanOrEqual(1500); } finally { disposeModel(root); }
    }
  });

  it.each(ELEVATED_STYLES)('%s has a supported guideway and its specified electrification', style => {
    const root = registry[`rail.${style}_straight`].factory();
    try {
      const y = ELEVATED_HEIGHTS[style];
      expect(surface(root, 0, 4.8)).toBeCloseTo(y, 4);
      const pierHit = new Raycaster(new Vector3(-5, y / 2, 0), new Vector3(1, 0, 0)).intersectObjects(root.children, true)[0];
      expect(pierHit.point.x).toBeCloseTo(style === 'hsr' ? -0.7 : -0.475, 3);
      if (style === 'hsr') for (const center of ELEVATED_INTERFACE.trackCenters)
        expect(surface(root, center, 4.8)).toBeCloseTo(y + 6.04, 4);
      else {
        expect(surface(root, 2.73, 4.8)).toBeCloseTo(y + 0.27, 4);
        expect(surface(root, 3.5, 4.8)).toBeCloseTo(y + 0.12, 4);
        const beam = new Raycaster(new Vector3(2.9, y - 0.9, -5), new Vector3(0, 0, 1)).intersectObjects(root.children, true)[0];
        expect(beam.point.z).toBeCloseTo(-0.65, 4);
      }
    } finally { disposeModel(root); }
  });

  it('keeps the metro maintenance walkway on the union perimeter, clear of diverging tracks', () => {
    const root = registry['rail.metro_t'].factory(); root.updateMatrixWorld(true);
    try {
      // Probe below sleeper undersides, where the old route-wise walkway crossed the turnout.
      const hit = new Raycaster(new Vector3(-0.81, 10.15, 1.2), new Vector3(0, -1, 0)).intersectObjects(root.children, true)[0];
      expect(hit.point.y).toBeCloseTo(10, 4);
      expect(surface(root, -3.5, 1.2)).toBeCloseTo(10.12, 4);
    } finally { disposeModel(root); }
  });
});

describe('Prompt 5B fictional electric trainsets', () => {
  it.each(['veh.train_hsr', 'veh.metro'])('%s has three correctly sized cars, real wheel contact and cached Thai livery', id => {
    const root = registry[id].factory();
    try {
      const hsr = id === 'veh.train_hsr', train = root.userData.train;
      expect(train.cars).toHaveLength(3); expect(train.cars.map((c: { length: number }) => c.length)).toEqual([hsr ? 25 : 20, hsr ? 25 : 20, hsr ? 25 : 20]);
      const bounds = new Box3().setFromObject(root);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(hsr ? 75 : 60, 0);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(visibleMeshes(root).some(mesh => !Array.isArray(mesh.material) && mesh.material.userData.sign?.text === (hsr ? 'ไผ่เอ็กซ์เพรส' : 'สายลมเมือง'))).toBe(true);
      expect(countTriangles(root)).toBeLessThanOrEqual(8000); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
      expect(bounds.max.y).toBeCloseTo(hsr ? 5.62 : 3.99, 2);
      // Actual wheel rings are centered on the 1.435 m rails, with tires resting at local y=0.
      const wheels = visibleMeshes(root).find(mesh => !Array.isArray(mesh.material) && mesh.material.name === 'metal_steel#303b3c')!;
      expect(wheels).toBeInstanceOf(Mesh);
      const p = wheels.geometry.getAttribute('position');
      expect(Array.from({ length: p.count }, (_, i) => p.getY(i)).some(y => Math.abs(y) < 0.0001)).toBe(true);
    } finally { disposeModel(root); }
  });
});
