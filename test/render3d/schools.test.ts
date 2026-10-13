/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync } from 'fs';
import { Box3, Group, Material, Mesh } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { SCHOOL_KINDS, SCHOOL_NAMES, schoolId } from '../../src/render3d/models/civic/schools.js';
import { SCHOOL_ACCENTS, SCHOOL_PROPS } from '../../src/render3d/models/civic/school-builder.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { EDUCATION_TOOLS } from '../../src/services.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { CIVIC, ROADS } from '../../src/tileValues.js';

type Kind = typeof SCHOOL_KINDS[number];
interface Component { role: string; min: number[]; max: number[] }
const build = (kind: Kind, region: typeof REGIONS[number] = 'central', seed = 7): Group => registry[schoolId(kind)].factory({ region, seed });
const roles = (root: Group): Set<string> => new Set((root.userData.components as Component[]).map(c => c.role));
const anchors = (root: Group) => root.children.filter(child => child.name.startsWith('anchor_'))
  .map(child => [child.name, ...child.position.toArray().map(v => Math.round(v * 1000) / 1000)]);
const signs = (root: Group): string[] => visibleMeshes(root).map(mesh => (mesh.material as Material).userData.signAtlas)
  .filter(Boolean).flatMap((atlas: { text: string }[]) => atlas.map(sign => sign.text));

describe('school registrations', () => {
  it('registers a 3×3 R2 model for every school the game builds (src/services.ts), placed by civicKinds, not by tile', () => {
    expect([...SCHOOL_KINDS]).toEqual([...EDUCATION_TOOLS]);
    for (const kind of SCHOOL_KINDS) {
      expect(registry[schoolId(kind)]).toMatchObject({ category: 'services', footprint: [3, 3], tiles: [], regionTier: 'R2',
        budget: TRIANGLE_BUDGETS.lowRise });
      expect(registry[schoolId(kind)].variants).toBeUndefined();
      expect(registry[schoolId(kind)].states).toBeUndefined();
    }
  });

  it('never draws from Math.random and names no real school', () => {
    for (const file of ['school-builder.ts', 'schools.ts']) {
      expect(readFileSync(`src/render3d/models/civic/${file}`, 'utf8')).not.toMatch(/Math\.random/);
    }
    for (const names of Object.values(SCHOOL_NAMES)) expect(names.length).toBeGreaterThanOrEqual(3);
  });
});

describe('every school in every region', () => {
  for (const kind of SCHOOL_KINDS) it(`${kind}: fits its lot, its budget and eight batches of library materials in all six regions`, () => {
    for (const region of REGIONS) {
      const root = build(kind, region);
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.x).toBeLessThanOrEqual(14.501);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.z).toBeLessThanOrEqual(14.501);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThan(22);
        expect(countTriangles(root)).toBeLessThanOrEqual(registry[schoolId(kind)].budget);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const used = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true);
          expect(used.has(material)).toBe(false); used.add(material);
          expect(mesh.name.startsWith(`${schoolId(kind)}/`)).toBe(true);
        });
        expect(root.userData).toMatchObject({ id: schoolId(kind), kind, region, regionTier: 'R2', category: 'services',
          footprint: [3, 3], tiles: [], entranceFacing: '+Z', nationalFlag: 'Thai' });
        expect(SCHOOL_NAMES[kind]).toContain(root.userData.signText);
        expect(signs(root)).toContain(root.userData.signText);
      } finally { disposeModel(root); }
    }
  });
});

describe('school compounds (DETAIL_CHECKLIST: schools)', () => {
  it('give every school its buildings, flagpole, gate with the name, fence, trees and the region prop', () => {
    for (const kind of SCHOOL_KINDS) {
      const root = build(kind);
      try {
        const have = roles(root);
        for (const role of ['site', 'classroom-block', 'flagpole', 'gate', 'fence', 'trees', 'regional-prop']) {
          expect([kind, role, have.has(role)]).toEqual([kind, role, true]);
        }
        expect(anchors(root).filter(([name]) => String(name).startsWith('anchor_light_')).length).toBeGreaterThanOrEqual(2);
      } finally { disposeModel(root); }
    }
  });

  it('builds each level of schooling its own way', () => {
    const look = (kind: Kind): { have: Set<string>; floors: number; blocks: { width: number; depth: number; top: number; floors: number[] }[]; anchors: ReturnType<typeof anchors> } => {
      const root = build(kind);
      try { return { have: roles(root), floors: root.userData.floors, blocks: root.userData.blocks, anchors: anchors(root) }; } finally { disposeModel(root); }
    };
    const kinder = look('kindergarten'), primary = look('primary_school'), secondary = look('secondary_school');
    const vocational = look('vocational_college'), university = look('university');
    for (const role of ['playground', 'play-house', 'shade-tree', 'handwash', 'garden', 'parking', 'office']) expect([role, kinder.have.has(role)]).toEqual([role, true]);
    expect(kinder.floors).toBe(1);
    for (const role of ['pitch', 'canteen', 'playground', 'drinking-water', 'bike-shed', 'assembly-yard', 'shade-tree']) expect([role, primary.have.has(role)]).toEqual([role, true]);
    expect(primary.floors).toBe(2);
    for (const role of ['track', 'canteen-block', 'guard-booth', 'bike-shed', 'drinking-water']) expect([role, secondary.have.has(role)]).toEqual([role, true]);
    expect(secondary.floors).toBe(4);
    expect(secondary.blocks.map(block => block.floors.length)).toEqual([4, 2]);
    for (const role of ['motor-workshop', 'machine-workshop', 'court', 'canteen', 'guard-booth', 'parking']) expect([role, vocational.have.has(role)]).toEqual([role, true]);
    expect(vocational.floors).toBe(3);
    for (const role of ['great-hall', 'library', 'pond', 'lamps', 'benches', 'sala', 'parking', 'paths']) expect([role, university.have.has(role)]).toEqual([role, true]);
    expect(university.floors).toBe(4);
    expect(university.anchors.some(([name]) => name === 'anchor_water_0')).toBe(true);
    for (const look of [kinder, primary, secondary, vocational]) expect(look.anchors.some(([name]) => name === 'anchor_water_0')).toBe(false);
  });

  it('keeps the buildings apart: no two buildings of a school stand in each other', () => {
    const buildings = ['classroom-block', 'canteen-block', 'office', 'canteen', 'great-hall', 'library', 'motor-workshop',
      'machine-workshop', 'guard-booth', 'bike-shed', 'play-house', 'drinking-water', 'handwash'];
    const overlap = (a: Component, b: Component): boolean => a.min[0] < b.max[0] - 1 && b.min[0] < a.max[0] - 1
      && a.min[2] < b.max[2] - 1 && b.min[2] < a.max[2] - 1;
    for (const kind of SCHOOL_KINDS) for (const region of ['central', 'south'] as const) {
      const root = build(kind, region);
      try {
        const parts = (root.userData.components as Component[]).filter(c => buildings.includes(c.role));
        parts.forEach((a, i) => parts.slice(i + 1).forEach(b => expect([kind, a.role, b.role, overlap(a, b)]).toEqual([kind, a.role, b.role, false])));
      } finally { disposeModel(root); }
    }
  });
});

describe('schools as R2 models', () => {
  it('keep the same blocks and anchors in every region; the roof, its finish and the prop come from the kit', () => {
    for (const kind of SCHOOL_KINDS) {
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
    expect(new Set(REGIONS.map(region => getRegionKit(region).houses.concrete.roof)).size).toBeGreaterThan(1);
  });

  it('let the seed pick names and school colours but never change the buildings', () => {
    for (const kind of SCHOOL_KINDS) {
      const names = new Set<string>(), accents = new Set<number>(), sizes = new Set<string>();
      for (let seed = 0; seed < 8; seed++) {
        const root = build(kind, 'central', seed);
        try {
          names.add(root.userData.signText); accents.add(root.userData.accent);
          expect(SCHOOL_ACCENTS).toContain(root.userData.accent);
          sizes.add(JSON.stringify(root.userData.blocks));
        } finally { disposeModel(root); }
      }
      expect(names.size).toBeGreaterThan(1); expect(accents.size).toBeGreaterThan(1); expect(sizes.size).toBe(1);
    }
    const a = build('secondary_school', 'east', 42), b = build('secondary_school', 'east', 42);
    try {
      expect(countTriangles(a)).toBe(countTriangles(b));
      expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
      expect(anchors(a)).toEqual(anchors(b));
    } finally { disposeModel(a); disposeModel(b); }
  });
});

describe('schools in the city view', () => {
  const W = 20;
  function city(kind: string | null, roads: readonly (readonly [number, number])[] = [], house = false) {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), centre = 10 * W + 10;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = CIVIC - 4 + (dy + 1) * 3 + dx + 1;
    flags[centre] = ZONEBIT | POWERBIT;
    for (const [x, y] of roads) values[y * W + x] = ROADS;
    const map = { width: W, height: W, getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x],
      civicKinds: kind ? { [centre]: kind } : {}, rulerHouse: house ? { x: 10, y: 10, level: 3, wings: ['treasury'] } : null };
    const snapshot = new TileSnapshot(W, W); snapshot.source = map; snapshot.sync(map);
    return { snapshot, centre, map };
  }

  it('places each school from civicKinds on its centre once, covering its 3 × 3', () => {
    for (const kind of SCHOOL_KINDS) {
      const { snapshot, centre } = city(kind);
      const placement = snapshot.placement(centre, 'north')!;
      expect(placement).toMatchObject({ id: schoolId(kind), kind: 'services', footprint: [3, 3], x: 105, z: 105, rotation: 0, powered: true });
      expect(placement.options).toMatchObject({ region: 'north', variant: 0, state: 'closed' });
      expect(placement.height).toBeGreaterThan(3);
      let others = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) {
        expect(snapshot.coverage[(10 + dy) * W + 10 + dx]).toBe(centre);
        if (snapshot.placement((10 + dy) * W + 10 + dx, 'north')) others++;
      }
      expect(others).toBe(0);
    }
  });

  it('turns a school\'s gate toward its road', () => {
    const turn = (roads: readonly (readonly [number, number])[]): number => city('primary_school', roads).snapshot.placement(10 * W + 10, 'central')!.rotation;
    expect(turn([])).toBe(0);
    expect(turn([[9, 12], [10, 12], [11, 12]])).toBe(0);
    expect(turn([[12, 9], [12, 10], [12, 11]])).toBeCloseTo(Math.PI / 2);
    expect(turn([[8, 9], [8, 10]])).toBeCloseTo(-Math.PI / 2);
    expect(turn([[9, 8], [10, 8], [11, 8]])).toBeCloseTo(Math.PI);
    expect(turn([[9, 8], [10, 8], [11, 8], [12, 10]])).toBeCloseTo(Math.PI);
  });

  it('keeps the ruler\'s house as it was, and other civic kinds generic', () => {
    const house = city('ruler_house', [[12, 10]], true).snapshot.placement(10 * W + 10, 'south')!;
    expect(house).toMatchObject({ id: 'civic.ruler_house', rotation: 0, footprint: [3, 3] });
    expect(house.options).toMatchObject({ variant: 3, state: 'treasury' });
    expect(city('ruler_house').snapshot.placement(10 * W + 10, 'south')).toMatchObject({ id: null, kind: 'services', footprint: [3, 3] });
    expect(city('some_future_kind').snapshot.placement(10 * W + 10, 'south')).toMatchObject({ id: null, kind: 'services', footprint: [3, 3] });
    expect(city(null).snapshot.placement(10 * W + 10, 'south')).toMatchObject({ id: null, kind: 'services' });
  });

  it('only reads the map', () => {
    const { snapshot, centre, map } = city('university', [[10, 12]]);
    const before = JSON.stringify(map.civicKinds);
    snapshot.placement(centre, 'east');
    expect(JSON.stringify(map.civicKinds)).toBe(before);
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe('school meshes', () => {
  it('name every mesh after its model', () => {
    const root = build('kindergarten', 'west', 3);
    try { root.traverse(object => { if (object instanceof Mesh) expect(object.name.startsWith('civic.kindergarten/')).toBe(true); }); } finally { disposeModel(root); }
  });
});
