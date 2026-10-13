/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync } from 'fs';
import { Box3, Color, Group, Material, Mesh } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { HOSPITAL_FLOORS, HOSPITAL_HEIGHTS, HOSPITAL_KINDS, HOSPITAL_NAMES, hospitalId } from '../../src/render3d/models/civic/hospitals.js';
import { AMBULANCE_WHITE, CROSS_GREEN, HOSPITAL_ACCENTS } from '../../src/render3d/models/civic/hospital-builder.js';
import { SCHOOL_PROPS } from '../../src/render3d/models/civic/school-builder.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { HEALTH_TOOLS } from '../../src/services.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { CIVIC, ROADS } from '../../src/tileValues.js';

type Kind = typeof HOSPITAL_KINDS[number];
interface Component { role: string; min: number[]; max: number[]; triangles: number }
const build = (kind: Kind, region: typeof REGIONS[number] = 'central', seed = 7): Group => registry[hospitalId(kind)].factory({ region, seed });
const roles = (root: Group): Set<string> => new Set((root.userData.components as Component[]).map(c => c.role));
const component = (root: Group, role: string): Component => (root.userData.components as Component[]).find(c => c.role === role)!;
const anchors = (root: Group) => root.children.filter(child => child.name.startsWith('anchor_'))
  .map(child => [child.name, ...child.position.toArray().map(v => Math.round(v * 1000) / 1000)]);
const signs = (root: Group): string[] => visibleMeshes(root).map(mesh => (mesh.material as Material).userData.signAtlas)
  .filter(Boolean).flatMap((atlas: { text: string }[]) => atlas.map(sign => sign.text));

const COMMON = ['site', 'sign', 'flagpole', 'gate', 'fence', 'trees', 'regional-prop'];
const ROLES: Readonly<Record<Kind, readonly string[]>> = {
  health_centre: ['clinic', 'staff-house', 'sala', 'herb-garden', 'water-tank', 'ambulance-carport', 'bike-shed', 'path'],
  community_hospital: ['opd-block', 'ward-block', 'emergency-porch', 'ambulances', 'entrance-canopy', 'service-block', 'walkway', 'driveway',
    'parking', 'bike-shed', 'generator'],
  provincial_hospital: ['tower', 'helipad', 'opd-wing', 'emergency-porch', 'ambulances', 'entrance-canopy', 'driveway', 'parking', 'bike-shed'],
  regional_hospital: ['podium', 'tower-west', 'tower-east', 'skybridge', 'helipad', 'emergency-porch', 'ambulances', 'entrance-canopy', 'driveway', 'parking',
    'parking-building'],
};

describe('hospital registrations', () => {
  it('registers a 3×3 R2 model for every hospital the game builds (src/services.ts), placed by civicKinds, not by tile', () => {
    expect([...HOSPITAL_KINDS]).toEqual([...HEALTH_TOOLS]);
    for (const kind of HOSPITAL_KINDS) {
      expect(registry[hospitalId(kind)]).toMatchObject({ category: 'services', footprint: [3, 3], tiles: [], regionTier: 'R2' });
      expect(registry[hospitalId(kind)].variants).toBeUndefined();
      expect(registry[hospitalId(kind)].states).toBeUndefined();
    }
    expect(registry[hospitalId('health_centre')].budget).toBe(TRIANGLE_BUDGETS.lowRise);
    expect(registry[hospitalId('community_hospital')].budget).toBe(TRIANGLE_BUDGETS.lowRise);
    expect(registry[hospitalId('provincial_hospital')].budget).toBe(TRIANGLE_BUDGETS.highRise);
    expect(registry[hospitalId('regional_hospital')].budget).toBe(TRIANGLE_BUDGETS.highRise);
  });

  it('never draws from Math.random, names no real hospital and keeps the red cross out of every colour', () => {
    for (const file of ['hospital-builder.ts', 'hospitals.ts']) {
      expect(readFileSync(`src/render3d/models/civic/${file}`, 'utf8')).not.toMatch(/Math\.random/);
    }
    for (const names of Object.values(HOSPITAL_NAMES)) expect(names.length).toBeGreaterThanOrEqual(3);
    // The cross is green and every hospital colour is a green or a blue: nothing where red leads
    const hsl = (hex: number): { h: number; s: number } => { const out = { h: 0, s: 0, l: 0 }; new Color(hex).getHSL(out); return out; };
    expect(hsl(CROSS_GREEN).h).toBeGreaterThan(0.3); expect(hsl(CROSS_GREEN).h).toBeLessThan(0.5);
    for (const accent of HOSPITAL_ACCENTS) { expect(hsl(accent).h).toBeGreaterThan(0.25); expect(hsl(accent).h).toBeLessThan(0.65); }
    expect(hsl(AMBULANCE_WHITE).s).toBeLessThan(0.3);
  });
});

describe('every hospital in every region', () => {
  for (const kind of HOSPITAL_KINDS) it(`${kind}: fits its lot, its budget and eight batches of library materials in all six regions`, () => {
    for (const region of REGIONS) {
      const root = build(kind, region);
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.x).toBeLessThanOrEqual(14.501);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.z).toBeLessThanOrEqual(14.501);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThan(HOSPITAL_HEIGHTS[kind] + 8);
        expect(bounds.max.y).toBeGreaterThan(HOSPITAL_HEIGHTS[kind] - 8);
        expect(countTriangles(root)).toBeLessThanOrEqual(registry[hospitalId(kind)].budget);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const used = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true);
          expect(used.has(material)).toBe(false); used.add(material);
          expect(mesh.name.startsWith(`${hospitalId(kind)}/`)).toBe(true);
        });
        expect(root.userData).toMatchObject({ id: hospitalId(kind), kind, region, regionTier: 'R2', category: 'services',
          footprint: [3, 3], tiles: [], entranceFacing: '+Z', nationalFlag: 'Thai', mark: 'H', markColor: 'green', floors: HOSPITAL_FLOORS[kind] });
        expect(HOSPITAL_NAMES[kind]).toContain(root.userData.signText);
        expect(signs(root)).toContain(root.userData.signText);
        expect(signs(root)).toContain('H');
        expect(signs(root).some(text => text.includes('ฉุกเฉิน')) || kind === 'health_centre').toBe(true);
      } finally { disposeModel(root); }
    }
  });
});

describe('hospital compounds (DETAIL_CHECKLIST: hospitals)', () => {
  it('give every hospital its sign, flagpole, gate, fence, trees, a covered way in, ambulances and a car park', () => {
    for (const kind of HOSPITAL_KINDS) {
      const root = build(kind);
      try {
        const have = roles(root);
        for (const role of [...COMMON, ...ROLES[kind]]) expect([kind, role, have.has(role)]).toEqual([kind, role, true]);
        expect(anchors(root).filter(([name]) => String(name).startsWith('anchor_light_')).length).toBeGreaterThanOrEqual(2);
        expect(root.userData.blocks.length).toBeGreaterThanOrEqual(kind === 'health_centre' ? 1 : 2);
      } finally { disposeModel(root); }
    }
  });

  it('scales a hospital up from the clinic to the regional hospital', () => {
    const height = (kind: Kind): number => { const root = build(kind); try { return new Box3().setFromObject(root).max.y; } finally { disposeModel(root); } };
    const floors = (kind: Kind): number[] => { const root = build(kind); try { return (root.userData.blocks as { floors: number[] }[]).map(b => b.floors.length); } finally { disposeModel(root); } };
    expect(height('health_centre')).toBeLessThan(10);
    expect(height('community_hospital')).toBeGreaterThan(10); expect(height('community_hospital')).toBeLessThan(18);
    expect(height('provincial_hospital')).toBeGreaterThan(22);
    expect(height('regional_hospital')).toBeGreaterThan(height('provincial_hospital'));
    expect(floors('health_centre')).toEqual([1]);
    expect(Math.max(...floors('community_hospital'))).toBe(3);
    expect(Math.max(...floors('provincial_hospital'))).toBe(6);
    expect(floors('regional_hospital')).toEqual(expect.arrayContaining([2, 6, 4]));
  });

  it('puts a helipad on the roof of the two big hospitals, above the towers, and nowhere else', () => {
    for (const kind of HOSPITAL_KINDS) {
      const root = build(kind);
      try {
        const big = kind === 'provincial_hospital' || kind === 'regional_hospital';
        expect(roles(root).has('helipad')).toBe(big);
        if (big) { expect(component(root, 'helipad').min[1]).toBeGreaterThan(20); expect(component(root, 'helipad').max[1]).toBeLessThan(HOSPITAL_HEIGHTS[kind] + 8); }
      } finally { disposeModel(root); }
    }
  });

  it('parks more ambulances at the bigger hospitals', () => {
    const triangles = (kind: Kind): number => { const root = build(kind); try { return component(root, kind === 'health_centre' ? 'ambulance-carport' : 'ambulances').triangles; } finally { disposeModel(root); } };
    expect(triangles('health_centre')).toBeGreaterThan(100);
    expect(triangles('community_hospital')).toBeLessThan(triangles('regional_hospital'));
  });

  it('keeps the buildings apart: no two buildings of a hospital stand in each other', () => {
    const buildings: Readonly<Record<Kind, readonly string[]>> = {
      health_centre: ['clinic', 'staff-house', 'sala', 'herb-garden', 'water-tank', 'ambulance-carport', 'bike-shed'],
      community_hospital: ['opd-block', 'ward-block', 'service-block', 'generator', 'bike-shed', 'emergency-porch', 'entrance-canopy'],
      provincial_hospital: ['tower', 'opd-wing', 'bike-shed', 'emergency-porch', 'entrance-canopy'],
      regional_hospital: ['podium', 'parking-building', 'emergency-porch', 'entrance-canopy'],
    };
    const overlap = (a: Component, b: Component): boolean => a.min[0] < b.max[0] - 1 && b.min[0] < a.max[0] - 1
      && a.min[2] < b.max[2] - 1 && b.min[2] < a.max[2] - 1;
    // The L-shaped complexes are one building: their blocks meet, and their sun shades and plinths reach a little past the wall
    const joined = (a: string, b: string): boolean => [['opd-block', 'ward-block'], ['tower', 'opd-wing']].some(([x, y]) => a === x && b === y || a === y && b === x);
    for (const kind of HOSPITAL_KINDS) for (const region of ['central', 'south'] as const) {
      const root = build(kind, region);
      try {
        const parts = (root.userData.components as Component[]).filter(c => buildings[kind].includes(c.role));
        parts.forEach((a, i) => parts.slice(i + 1).filter(b => !joined(a.role, b.role)).forEach(b => expect([kind, a.role, b.role, overlap(a, b)]).toEqual([kind, a.role, b.role, false])));
      } finally { disposeModel(root); }
    }
  });
});

describe('hospitals as R2 models', () => {
  it('keep the same blocks and anchors in every region; the roof, its finish and the prop come from the kit', () => {
    for (const kind of HOSPITAL_KINDS) {
      const blocks: unknown[] = [], seen: unknown[] = [];
      for (const region of REGIONS) {
        const kit = getRegionKit(region), root = build(kind, region, 73);
        try {
          blocks.push(root.userData.blocks); seen.push(anchors(root));
          expect(root.userData.roofForm).toBe(kit.houses.concrete.roof);
          expect(root.userData.roofMaterial).toBe(kit.houses.concrete.roofMaterial.startsWith('thatch') ? 'roof_cement_tile' : kit.houses.concrete.roofMaterial);
          expect(kit.props[SCHOOL_PROPS[region]]).toBeDefined();
        } finally { disposeModel(root); }
      }
      blocks.forEach(list => expect(list).toEqual(blocks[0]));
      seen.forEach(list => expect(list).toEqual(seen[0]));
    }
  });

  it('let the seed pick names and hospital colours but never change the buildings', () => {
    for (const kind of HOSPITAL_KINDS) {
      const names = new Set<string>(), accents = new Set<number>(), sizes = new Set<string>();
      for (let seed = 0; seed < 8; seed++) {
        const root = build(kind, 'central', seed);
        try {
          names.add(root.userData.signText); accents.add(root.userData.accent);
          expect(HOSPITAL_ACCENTS as readonly number[]).toContain(root.userData.accent);
          sizes.add(JSON.stringify(root.userData.blocks));
        } finally { disposeModel(root); }
      }
      expect(names.size).toBeGreaterThan(1); expect(accents.size).toBeGreaterThan(1); expect(sizes.size).toBe(1);
    }
    const a = build('provincial_hospital', 'east', 42), b = build('provincial_hospital', 'east', 42);
    try {
      expect(countTriangles(a)).toBe(countTriangles(b));
      expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
      expect(anchors(a)).toEqual(anchors(b));
    } finally { disposeModel(a); disposeModel(b); }
  });
});

describe('hospitals in the city view', () => {
  const W = 20;
  function city(kind: string | null, roads: readonly (readonly [number, number])[] = []) {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), centre = 10 * W + 10;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = CIVIC - 4 + (dy + 1) * 3 + dx + 1;
    flags[centre] = ZONEBIT | POWERBIT;
    for (const [x, y] of roads) values[y * W + x] = ROADS;
    const map = { width: W, height: W, getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x],
      civicKinds: kind ? { [centre]: kind } : {} };
    const snapshot = new TileSnapshot(W, W); snapshot.source = map; snapshot.sync(map);
    return { snapshot, centre, map };
  }

  it('places each hospital from civicKinds on its centre once, covering its 3 × 3, with its far-view height', () => {
    for (const kind of HOSPITAL_KINDS) {
      const { snapshot, centre } = city(kind);
      const placement = snapshot.placement(centre, 'north')!;
      expect(placement).toMatchObject({ id: hospitalId(kind), kind: 'services', footprint: [3, 3], x: 105, z: 105, rotation: 0, powered: true, height: HOSPITAL_HEIGHTS[kind] });
      expect(placement.options).toMatchObject({ region: 'north', variant: 0, state: 'closed' });
      let others = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) {
        expect(snapshot.coverage[(10 + dy) * W + 10 + dx]).toBe(centre);
        if (snapshot.placement((10 + dy) * W + 10 + dx, 'north')) others++;
      }
      expect(others).toBe(0);
    }
  });

  it('turns a hospital\'s gate toward its road', () => {
    const turn = (roads: readonly (readonly [number, number])[]): number => city('community_hospital', roads).snapshot.placement(10 * W + 10, 'central')!.rotation;
    expect(turn([])).toBe(0);
    expect(turn([[9, 12], [10, 12], [11, 12]])).toBe(0);
    expect(turn([[12, 9], [12, 10], [12, 11]])).toBeCloseTo(Math.PI / 2);
    expect(turn([[8, 9], [8, 10]])).toBeCloseTo(-Math.PI / 2);
    expect(turn([[9, 8], [10, 8], [11, 8]])).toBeCloseTo(Math.PI);
  });

  it('only reads the map', () => {
    const { snapshot, centre, map } = city('regional_hospital', [[10, 12]]);
    const before = JSON.stringify(map.civicKinds);
    snapshot.placement(centre, 'east');
    expect(JSON.stringify(map.civicKinds)).toBe(before);
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe('hospital meshes', () => {
  it('name every mesh after its model', () => {
    const root = build('community_hospital', 'west', 3);
    try { root.traverse(object => { if (object instanceof Mesh) expect(object.name.startsWith('civic.community_hospital/')).toBe(true); }); } finally { disposeModel(root); }
  });
});
