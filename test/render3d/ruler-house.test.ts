/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync } from 'fs';
import { Box3, Group, Material, Mesh } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { parseRulerWings, RULER_HOUSE_ID, RULER_HOUSE_LEVELS, RULER_HOUSE_SIGN, RULER_HOUSE_WINGS, rulerHouseLevel } from '../../src/render3d/models/civic/ruler-house.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { WINGS } from '../../src/rulerHouse.js';

const entry = registry[RULER_HOUSE_ID];
const ALL = RULER_HOUSE_WINGS.join(',');
interface Component { role: string; min: number[]; max: number[] }
const components = (root: Group): Component[] => root.userData.components;
const anchors = (root: Group) => root.children.filter(child => child.name.startsWith('anchor_'))
  .map(child => [child.name, ...child.position.toArray().map(v => Math.round(v * 1000) / 1000)]);
const build = (region: typeof REGIONS[number], variant: number, state = '', seed = 7): Group =>
  entry.factory({ region, variant, state, seed });

describe('civic.ruler_house registration', () => {
  it('is a 3×3 R1 government office compound chosen by civicKinds, not by tile, with six levels', () => {
    expect(entry).toMatchObject({ category: 'services', footprint: [3, 3], tiles: [], regionTier: 'R1', budget: TRIANGLE_BUDGETS.special });
    expect(entry.variants).toEqual([1, 2, 3, 4, 5, 6]);
    expect(RULER_HOUSE_LEVELS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(entry.states).toBeUndefined();
  });

  it('knows the same wings as the game (src/rulerHouse.ts)', () => {
    expect([...RULER_HOUSE_WINGS]).toEqual([...WINGS]);
  });

  it('clamps the level and parses wings robustly', () => {
    expect([undefined, 0, -3, 1, 2.4, 2.6, 6, 9, NaN, Infinity].map(v => rulerHouseLevel(v))).toEqual([1, 1, 1, 1, 2, 3, 6, 6, 1, 1]);
    expect(parseRulerWings(undefined)).toEqual([]);
    expect(parseRulerWings('')).toEqual([]);
    expect(parseRulerWings('solid')).toEqual([]);
    expect(parseRulerWings(' front_garden, Treasury;; treasury | unknown_wing  granary ')).toEqual(['treasury', 'granary', 'front_garden']);
    expect(parseRulerWings(ALL)).toEqual([...RULER_HOUSE_WINGS]);
  });

  it('never draws from Math.random', () => {
    for (const file of ['builder.ts', 'ruler-house.ts']) {
      expect(readFileSync(`src/render3d/models/civic/${file}`, 'utf8')).not.toMatch(/Math\.random/);
    }
  });
});

describe('civic.ruler_house with every wing', () => {
  for (const region of REGIONS) {
    it(`${region}: every level fits its lot, budget and batches, with all eight wings`, () => {
      for (const variant of RULER_HOUSE_LEVELS) {
        const root = build(region, variant, ALL);
        try {
          const bounds = new Box3().setFromObject(root);
          expect(bounds.min.x).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.x).toBeLessThanOrEqual(14.501);
          expect(bounds.min.z).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.z).toBeLessThanOrEqual(14.501);
          expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThan(20);
          expect(countTriangles(root)).toBeLessThanOrEqual(entry.budget);
          expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
          const used = new Set<Material>();
          visibleMeshes(root).forEach(mesh => {
            const material = mesh.material as Material;
            expect(isLibraryMaterial(material)).toBe(true);
            expect(used.has(material)).toBe(false); used.add(material);
          });
          expect(root.userData).toMatchObject({ id: RULER_HOUSE_ID, level: variant, region, wings: [...RULER_HOUSE_WINGS] });
          for (const wing of RULER_HOUSE_WINGS) expect(components(root).some(c => c.role === `wing-${wing}`)).toBe(true);
        } finally { disposeModel(root); }
      }
    });
  }

  it('keeps each wing on its own plot, clear of the other wings and of the house\'s buildings', () => {
    // Buildings, the drive island or plaza, parking, lawn furniture; flat paths and the scattered trees are left out,
    // their boxes span the whole axis.
    const core = ['district-office', 'porch', 'government-building', 'portico', 'office-wing', 'meeting-hall', 'gate', 'island',
      'plaza', 'parking', 'lawn', 'notice-board', 'regional-prop', 'flagpole'];
    const overlap = (a: Component, b: Component): boolean => a.min[0] < b.max[0] - 0.05 && b.min[0] < a.max[0] - 0.05
      && a.min[2] < b.max[2] - 0.05 && b.min[2] < a.max[2] - 0.05;
    for (const region of REGIONS) for (const variant of RULER_HOUSE_LEVELS) {
      const root = build(region, variant, ALL);
      try {
        const wings = components(root).filter(c => c.role.startsWith('wing-'));
        const buildings = components(root).filter(c => core.includes(c.role));
        wings.forEach((a, i) => {
          wings.slice(i + 1).forEach(b => expect([region, variant, a.role, b.role, overlap(a, b)]).toEqual([region, variant, a.role, b.role, false]));
          buildings.forEach(b => expect([region, variant, a.role, b.role, overlap(a, b)]).toEqual([region, variant, a.role, b.role, false]));
        });
      } finally { disposeModel(root); }
    }
  });

  it('adds geometry for each wing, deterministically for a seed', () => {
    const plain = build('central', 3);
    const base = countTriangles(plain);
    disposeModel(plain);
    for (const wing of RULER_HOUSE_WINGS) {
      const a = build('central', 3, wing), b = build('central', 3, wing);
      try {
        expect(countTriangles(a)).toBeGreaterThan(base + 150);
        expect(countTriangles(a)).toBe(countTriangles(b));
        expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
        expect(a.userData.wings).toEqual([wing]);
      } finally { disposeModel(a); disposeModel(b); }
    }
  });

  it('labels the office, its gate and the annexes with generic Thai signs on one atlas', () => {
    const root = build('south', 5, 'treasury,planning_office,trade_office');
    try {
      const signs = visibleMeshes(root).map(mesh => (mesh.material as Material).userData.signAtlas).filter(Boolean);
      expect(signs).toHaveLength(1);
      expect(signs[0].map((sign: { text: string }) => sign.text).sort()).toEqual(
        [RULER_HOUSE_SIGN, RULER_HOUSE_SIGN, 'หอประชุม', 'การเงินและคลัง', 'งานที่ดินและผังเมือง', 'สำนักการค้า'].sort());
      expect(root.userData).toMatchObject({ signText: 'ที่ว่าการอำเภอ', building: 'district-office' });
    } finally { disposeModel(root); }
    for (const variant of [1, 2, 3]) {
      const office = build('central', variant);
      try {
        const signs = visibleMeshes(office).map(mesh => (mesh.material as Material).userData.signAtlas).filter(Boolean);
        expect(signs[0].map((sign: { text: string }) => sign.text)).toEqual([RULER_HOUSE_SIGN]);
      } finally { disposeModel(office); }
    }
  });
});

describe('civic.ruler_house levels and regions', () => {
  it('grows level by level: a timber office, a two-storey office, a government building, a centre with wings, a meeting hall, a plaza', () => {
    const roles = (variant: number): Set<string> => {
      const root = build('central', variant);
      try { return new Set(components(root).map(c => c.role)); } finally { disposeModel(root); }
    };
    const [l1, l2, l3, l4, l5, l6] = RULER_HOUSE_LEVELS.map(roles);
    for (const roles of [l1, l2, l3, l4, l5, l6]) for (const role of ['flagpole', 'parking', 'notice-board']) {
      expect([role, roles.has(role) || roles.has('island') || roles.has('plaza')]).toEqual([role, true]);
    }
    expect([l1.has('district-office'), l1.has('porch'), l1.has('fence')]).toEqual([true, false, true]);
    expect([l2.has('district-office'), l2.has('porch')]).toEqual([true, true]);
    expect([l3.has('government-building'), l3.has('portico'), l3.has('island'), l3.has('perimeter-wall')]).toEqual([true, true, true, false]);
    expect([l4.has('office-wing'), l4.has('perimeter-wall'), l4.has('gate'), l4.has('meeting-hall')]).toEqual([true, true, true, false]);
    expect([l5.has('meeting-hall'), l5.has('plaza')]).toEqual([true, false]);
    expect([l6.has('plaza'), l6.has('island')]).toEqual([true, false]);
    for (const role of l4) expect([role, l5.has(role)]).toEqual([role, true]);
    for (const role of l5) if (role !== 'island') expect([role, l6.has(role)]).toEqual([role, true]);
  });

  it('changes form by region through the kit, with the same anchors everywhere', () => {
    const forms: Record<string, unknown> = {};
    for (const variant of [1, 4, 6]) {
      const seen: unknown[] = [];
      for (const region of REGIONS) {
        const root = build(region, variant, ALL);
        try {
          forms[region] = [root.userData.houseRoofForm, root.userData.civicRoofForm, root.userData.twinGables];
          seen.push(anchors(root));
          expect(anchors(root).length).toBeGreaterThan(0);
          expect(anchors(root).some(([name]) => name === 'anchor_water_0')).toBe(variant === 6);
          root.children.filter(child => child.name.startsWith('anchor_')).forEach(anchor => {
            expect(anchor).not.toBeInstanceOf(Mesh); expect(anchor.name).toMatch(/^anchor_(light|water)_\d+$/);
          });
        } finally { disposeModel(root); }
      }
      seen.forEach(list => expect(list).toEqual(seen[0]));
    }
    expect(forms).toEqual({
      north: ['gable', 'gable', true], northeast: ['gable', 'gable', false], central: ['gable', 'layeredGable', false],
      east: ['gable', 'layeredGable', false], west: ['layeredGable', 'layeredGable', false], south: ['hip', 'hip', false],
    });
  });
});
