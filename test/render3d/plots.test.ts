/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { createPlot, PLOT_IDS, PLOT_SPECS } from '../../src/render3d/models/plot/index.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import type { ZoneComponent } from '../../src/render3d/models/residential/zone-builder.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

/** Floors each level may have, from the cheapest land value class to the dearest. */
const FLOORS: Record<string, readonly [number, number]> = {
  'plot.res_2': [2, 2], 'plot.res_3': [3, 4], 'plot.res_4': [6, 8], 'plot.res_5': [18, 25],
  'plot.com_1': [1, 2], 'plot.com_2': [3, 3], 'plot.com_3': [4, 5], 'plot.com_4': [8, 12], 'plot.com_5': [20, 30],
  'plot.ind_1': [1, 1], 'plot.ind_2': [1, 1], 'plot.ind_3': [1, 1], 'plot.ind_4': [1, 1],
  'lot.res_4': [8, 12], 'lot.res_5': [25, 35], 'lot.com_4': [3, 4], 'lot.com_5': [30, 40], 'lot.ind_3': [1, 1], 'lot.ind_4': [1, 1],
};
const LOTS = ['lot.res_4', 'lot.res_5', 'lot.com_4', 'lot.com_5', 'lot.ind_3', 'lot.ind_4'];
const SMOKE = ['plot.ind_3', 'plot.ind_4', 'lot.ind_3', 'lot.ind_4'];
const regionsOf = (id: string) => registry[id].regionTier === 'R3' ? [undefined] : REGIONS;
const isLot = (id: string) => id.startsWith('lot.');

describe('plot buildings: one-tile plots (แปลง) and two-by-two lots', () => {
  it('registers thirteen one-tile plot levels and six two-by-two lots that claim no tile values', () => {
    expect([...PLOT_IDS].sort()).toEqual(Object.keys(FLOORS).sort());
    expect(Object.keys(registry).filter(id => /^(plot|lot)\./.test(id)).sort()).toEqual([...PLOT_IDS].sort());
    expect(PLOT_IDS.filter(isLot)).toEqual(LOTS);
    for (const spec of PLOT_SPECS) {
      const entry = registry[spec.id], lot = isLot(spec.id);
      expect(entry).toMatchObject({ category: spec.category, footprint: lot ? [2, 2] : [1, 1], tiles: [], regionTier: spec.regionTier, budget: spec.budget });
      expect(spec.id.startsWith(`${lot ? 'lot' : 'plot'}.${{ residential: 'res', commercial: 'com', industrial: 'ind' }[spec.category]}_`)).toBe(true);
      expect(entry.variants).toEqual(spec.category === 'industrial' && !lot ? [0, 1] : [0, 1, 2, 3]);
      expect(Object.values(TRIANGLE_BUDGETS)).toContain(entry.budget);
    }
    expect(PLOT_SPECS.filter(s => s.regionTier !== 'R3').map(s => s.id))
      .toEqual(['plot.res_2', 'plot.res_3', 'plot.com_1', 'plot.com_2', 'plot.com_3', 'plot.ind_1']);
    expect(() => createPlot('plot.res_9')).toThrow(RangeError);
  });

  for (const spec of PLOT_SPECS) for (const variant of spec.variants) {
    it.each(regionsOf(spec.id))(`${spec.id} land ${variant}: inside its tiles, front +Z, budgets and Thai signs in %s`, region => {
      const root = registry[spec.id].factory({ seed: 3, variant, region });
      try {
        const bounds = new Box3().setFromObject(root), [low, high] = FLOORS[spec.id], half = spec.footprint[0] * 5 - 0.5;
        expect(bounds.min.x).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.x).toBeLessThanOrEqual(half + 0.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-half - 0.001); expect(bounds.max.z).toBeLessThanOrEqual(half + 0.001);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(countTriangles(root)).toBeLessThanOrEqual(spec.budget); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(root.userData).toMatchObject({ id: spec.id, plot: true, level: spec.level, landValue: variant, entranceFacing: '+Z',
          region: region ?? 'central', regionTier: spec.regionTier });
        expect(root.userData.variantLabel).toMatch(/\p{Script=Thai}/u); expect(root.userData.variantLabelEn).toMatch(/[a-z]/);
        // Floors stay inside the level's range, and the building really is that tall (3–4 m a floor).
        expect(root.userData.floors).toBeGreaterThanOrEqual(low); expect(root.userData.floors).toBeLessThanOrEqual(high);
        expect(bounds.max.y).toBeGreaterThan(root.userData.floors * 2.9);
        expect(bounds.max.y).toBeLessThan(155);
        const components = root.userData.components as ZoneComponent[];
        expect(components.reduce((sum, c) => sum + c.triangles, 0)).toBe(countTriangles(root));
        // The street side is +Z: the building mass stands back from the front edge and something meets the road there.
        const bodies = root.userData.structuralBodies as { min: number[]; max: number[] }[];
        expect(bodies.length).toBeGreaterThan(0);
        expect(Math.max(...bodies.map(body => body.max[2]))).toBeLessThan(bounds.max.z);
        expect(Math.min(...bodies.map(body => body.min[2]))).toBeLessThan(0);
        expect(bounds.max.z).toBeGreaterThan(half - 0.3);
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as MeshStandardMaterial;
          expect(isLibraryMaterial(material)).toBe(true);
          if (material.userData.vertexFinish) expect(mesh.geometry.getAttribute('color')).toBeDefined();
        });
        const signs = visibleMeshes(root).filter(mesh => (mesh.material as Material).userData.signAtlas);
        expect(signs.length).toBeLessThanOrEqual(1);
        (root.userData.signTexts as string[]).forEach(text => expect(text).toMatch(/^[\p{Script=Thai}\s-]+$/u));
        if (signs.length) {
          expect((signs[0].material as Material).userData.signAtlas).toHaveLength(root.userData.signTexts.length);
          const uv = signs[0].geometry.getAttribute('uv');
          for (let i = 0; i < uv.count; i++) { expect(uv.getX(i)).toBeGreaterThan(0); expect(uv.getX(i)).toBeLessThan(1); }
        }
      } finally { disposeModel(root); }
    });
  }

  for (const spec of PLOT_SPECS.filter(s => s.regionTier === 'R2')) it(`${spec.id}: the same walls in every region, only the dress changes`, () => {
    for (const variant of spec.variants) {
      const bodies = REGIONS.map(region => { const root = registry[spec.id].factory({ region, seed: 11, variant });
        try { return root.userData.structuralBodies; } finally { disposeModel(root); } });
      bodies.slice(1).forEach(body => expect(body).toEqual(bodies[0]));
      const kits = REGIONS.map(region => { const root = registry[spec.id].factory({ region, seed: 11, variant });
        try { return root.userData.kit; } finally { disposeModel(root); } });
      expect(kits).toEqual([...REGIONS]);
    }
  });

  it('grows with land value and never shrinks a level', () => {
    for (const spec of PLOT_SPECS) {
      const heights = spec.variants.map(variant => { const root = registry[spec.id].factory({ seed: 1, variant });
        try { return [root.userData.floors as number, new Box3().setFromObject(root).max.y]; } finally { disposeModel(root); } });
      for (let i = 1; i < heights.length; i++) expect(heights[i][0]).toBeGreaterThanOrEqual(heights[i - 1][0]);
    }
    const tallest = (id: string) => { const root = registry[id].factory({ seed: 1, variant: 3 });
      try { return new Box3().setFromObject(root).max.y; } finally { disposeModel(root); } };
    expect(tallest('plot.res_5')).toBeGreaterThan(tallest('plot.res_4'));
    expect(tallest('plot.res_4')).toBeGreaterThan(tallest('plot.res_3'));
    expect(tallest('plot.com_5')).toBeGreaterThan(tallest('plot.com_4'));
    expect(tallest('plot.com_4')).toBeGreaterThan(tallest('plot.com_3'));
    // Joined plots grow bigger buildings than one-tile plots of the same level.
    expect(tallest('lot.res_5')).toBeGreaterThan(tallest('lot.res_4'));
    expect(tallest('lot.com_5')).toBeGreaterThan(tallest('lot.com_4'));
    expect(tallest('lot.res_5')).toBeGreaterThan(tallest('plot.res_5'));
    expect(tallest('lot.com_5')).toBeGreaterThan(tallest('plot.com_5'));
    expect(tallest('lot.ind_4')).toBeGreaterThan(tallest('lot.ind_3'));
  });

  it('varies colours with the seed in each of the city view\'s four seed buckets, but never the massing', () => {
    for (const spec of PLOT_SPECS) for (const variant of [0, spec.variants.length - 1]) {
      const looks = new Set<string>(), sizes = new Set<string>();
      for (let seed = 0; seed < 4; seed++) {
        const root = registry[spec.id].factory({ seed, variant });
        try {
          const colors: number[] = [];
          visibleMeshes(root).forEach(mesh => { const c = mesh.geometry.getAttribute('color'); if (c) colors.push(...Array.from(c.array.slice(0, 600))); });
          looks.add(colors.map(n => n.toFixed(3)).join(','));
          sizes.add(new Box3().setFromObject(root).getSize(new Vector3()).toArray().map(n => n.toFixed(3)).join(','));
        } finally { disposeModel(root); }
      }
      expect(looks.size).toBeGreaterThan(1); expect(sizes.size).toBe(1);
    }
  });

  it('clamps out-of-range land values to the family\'s classes', () => {
    const same = (id: string, a: number | undefined, b: number) => {
      const x = registry[id].factory({ seed: 5, variant: a }), y = registry[id].factory({ seed: 5, variant: b });
      try { expect(countTriangles(x)).toBe(countTriangles(y)); expect(x.userData.landValue).toBe(b);
        expect(new Box3().setFromObject(x)).toEqual(new Box3().setFromObject(y)); } finally { disposeModel(x); disposeModel(y); }
    };
    same('plot.res_3', 9, 3); same('plot.com_2', -2, 0); same('plot.ind_4', 7, 1); same('plot.res_2', undefined, 0);
    same('lot.ind_3', 9, 3); same('lot.com_4', -1, 0);
  });

  it('puts the smoke anchor on each chimney\'s open rim and a light on the towers\' crowns', () => {
    for (const id of SMOKE) for (const variant of registry[id].variants!) {
      const root = registry[id].factory({ seed: 2, variant });
      try {
        const anchor = root.getObjectByName('anchor_smoke_0')!;
        expect(anchor).toBeDefined(); expect(anchor).not.toBeInstanceOf(Mesh); expect(anchor.children).toHaveLength(0);
        expect(anchor.position.y).toBeCloseTo(root.userData.stackHeight, 5);
        expect(anchor.position.y).toBeCloseTo(new Box3().setFromObject(root).max.y, 5);
        // No triangle closes the stack's mouth: rim triangles all lie outside the throat.
        const rim: Vector3[][] = [];
        for (const mesh of visibleMeshes(root)) {
          const p = mesh.geometry.getAttribute('position');
          for (let n = 0; n < p.count; n += 3) {
            const v = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(p, n + k));
            if (v.every(a => Math.abs(a.y - anchor.position.y) < 0.001)) rim.push(v);
          }
        }
        expect(rim.length).toBeGreaterThan(0);
        rim.forEach(v => expect(v.every(a => Math.hypot(a.x - anchor.position.x, a.z - anchor.position.z) >= 0.25)).toBe(true));
        // The big plant's second, shorter stack smokes too.
        const second = root.getObjectByName('anchor_smoke_1');
        if (id === 'lot.ind_4') expect(second!.position.y).toBeLessThan(anchor.position.y); else expect(second).toBeUndefined();
      } finally { disposeModel(root); }
    }
    for (const id of ['plot.res_5', 'plot.com_5', 'lot.res_5', 'lot.com_5']) {
      const root = registry[id].factory({ seed: 2, variant: 3 });
      try {
        const light = root.getObjectByName('anchor_light_0')!;
        expect(light).toBeDefined(); expect(light.position.y).toBeGreaterThan(60);
        expect(light.position.y).toBeCloseTo(new Box3().setFromObject(root).max.y, 1);
      } finally { disposeModel(root); }
    }
    for (const id of PLOT_IDS.filter(id => !SMOKE.includes(id))) {
      const root = registry[id].factory({ seed: 2 });
      try { expect(root.getObjectByName('anchor_smoke_0')).toBeUndefined(); } finally { disposeModel(root); }
    }
  });

  it('keeps regional character: kit roofs, shophouse dress and household props', () => {
    const shop = (region: typeof REGIONS[number]) => registry['plot.com_2'].factory({ region, seed: 4, variant: 1 });
    for (const region of REGIONS) {
      const root = shop(region);
      try {
        expect(root.userData.coveredArcade).toBe(region === 'south');
        expect(root.userData.woodenBalconies).toBe(['north', 'east', 'west'].includes(region));
        expect(root.userData.fretwork).toBe(region === 'east');
        expect(root.userData.timberFront).toBe(region === 'northeast');
      } finally { disposeModel(root); }
      const home = registry['plot.res_2'].factory({ region, seed: 4, variant: 1 });
      try { expect(home.userData.roofForm).toBe(region === 'south' ? 'hip' : region === 'west' ? 'layeredGable' : 'gable'); }
      finally { disposeModel(home); }
    }
    const townhouses = [0, 3].map(variant => registry['plot.res_2'].factory({ seed: 4, variant }));
    try { expect(townhouses.map(t => t.userData.units)).toEqual([3, 2]); } finally { townhouses.forEach(disposeModel); }
  });
});
