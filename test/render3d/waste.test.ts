/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync } from 'fs';
import { Box3, Group, Material, Mesh } from 'three';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { WASTE_BUDGETS, WASTE_FLOORS, WASTE_HEIGHTS, WASTE_KINDS, WASTE_SIGNS, wasteId } from '../../src/render3d/models/waste/waste.js';
import { BIN_COLORS, TRUCK_COLORS } from '../../src/render3d/models/waste/builder.js';
import { REGIONS } from '../../src/render3d/regional/index.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { TILE_TABLE, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { WASTE_KINDS as GAME_WASTE_KINDS } from '../../src/waste.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { ROADS, WASTE, WASTE_BASE, WASTE_LAST } from '../../src/tileValues.js';

type Kind = typeof WASTE_KINDS[number];
interface Component { role: string; min: number[]; max: number[]; triangles: number }
const build = (kind: Kind, region: typeof REGIONS[number] = 'central', seed = 7): Group => registry[wasteId(kind)].factory({ region, seed });
const roles = (root: Group): Set<string> => new Set((root.userData.components as Component[]).map(c => c.role));
const component = (root: Group, role: string): Component => (root.userData.components as Component[]).find(c => c.role === role)!;
const anchorNames = (root: Group): string[] => root.children.filter(child => child.name.startsWith('anchor_')).map(child => child.name);
const signs = (root: Group): string[] => visibleMeshes(root).map(mesh => (mesh.material as Material).userData.signAtlas)
  .filter(Boolean).flatMap((atlas: { text: string }[]) => atlas.map(sign => sign.text));
const materials = (root: Group): string[] => visibleMeshes(root).map(mesh => String((mesh.material as Material).userData.materialKey));

const COMMON = ['site', 'road', 'weighbridge', 'gate', 'fence', 'trees'];
const ROLES: Readonly<Record<Kind, readonly string[]>> = {
  landfill: ['soil', 'active-cell', 'compactor', 'tipping-truck', 'queued-truck', 'capped-cell', 'leachate-pond', 'wheel-wash', 'gas-flare', 'litter-fence', 'office', 'bins'],
  incinerator: ['yard', 'tipping-hall', 'furnace-hall', 'bag-filter', 'flue-duct', 'stack', 'ash-bay', 'ash-containers', 'control-building', 'fire-water-tank', 'trucks'],
  recycling_plant: ['yard', 'sorting-shed', 'sorting-lines', 'tipping-floor', 'loader', 'bale-yard', 'glass-bays', 'trailer', 'truck', 'office', 'bins'],
  waste_power_plant: ['yard', 'bunker-hall', 'boiler-house', 'turbine-hall', 'condenser', 'bag-filter', 'stack', 'lime-silo', 'switchyard', 'control-building', 'trucks'],
  wastewater_plant: ['yard', 'screens', 'grit-chamber', 'primary-clarifier', 'aeration-basin', 'secondary-clarifier', 'contact-tank', 'digester', 'drying-beds',
    'blower-house', 'lab-building', 'pipes', 'outfall'],
};

describe('rubbish and wastewater registrations (RENDERER_SPEC 6I)', () => {
  it('registers a 3×3 R3 model for each of the game\'s five kinds (src/waste.ts), placed by wasteKinds, not by tile', () => {
    expect([...WASTE_KINDS]).toEqual([...GAME_WASTE_KINDS]);
    for (const kind of WASTE_KINDS) {
      expect(registry[wasteId(kind)]).toMatchObject({ category: 'services', footprint: [3, 3], tiles: [], regionTier: 'R3', budget: WASTE_BUDGETS[kind] });
      expect(registry[wasteId(kind)].variants).toBeUndefined();
      expect(registry[wasteId(kind)].states).toBeUndefined();
    }
    expect(WASTE_BUDGETS.landfill).toBe(TRIANGLE_BUDGETS.lowRise);
    expect(WASTE_BUDGETS.incinerator).toBe(TRIANGLE_BUDGETS.highRise);
    expect(WASTE_BUDGETS.waste_power_plant).toBe(TRIANGLE_BUDGETS.highRise);
  });

  it('leaves tiles 992–1000 to the city view (wasteKinds), so the tile table keeps them generic', () => {
    for (let value = WASTE_BASE; value <= WASTE_LAST; value++) expect(TILE_TABLE[value]).toMatchObject({ id: null, kind: 'services', footprint: [3, 3] });
    expect(WASTE).toBe(996);
  });

  it('never draws from Math.random', () => {
    for (const file of ['builder.ts', 'waste.ts']) expect(readFileSync(`src/render3d/models/waste/${file}`, 'utf8')).not.toMatch(/Math\.random/);
  });
});

describe.each(WASTE_KINDS)('%s', kind => {
  it('fits its lot, budget and batches in every region and seed, and keeps the same buildings', () => {
    const shapes = new Set<string>();
    for (const region of REGIONS) for (const seed of [0, 1, 2, 3, 42]) {
      const root = build(kind, region, seed);
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.x).toBeLessThanOrEqual(14.501);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-14.501); expect(bounds.max.z).toBeLessThanOrEqual(14.501);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        expect(bounds.max.y).toBeLessThan(WASTE_HEIGHTS[kind] + 6); expect(bounds.max.y).toBeGreaterThan(WASTE_HEIGHTS[kind] - 6);
        expect(countTriangles(root)).toBeLessThanOrEqual(registry[wasteId(kind)].budget);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        const used = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true); expect(used.has(material)).toBe(false); used.add(material);
          expect(mesh.name.startsWith(`${wasteId(kind)}/`)).toBe(true);
        });
        expect(root.userData).toMatchObject({ id: wasteId(kind), kind, region, regionTier: 'R3', category: 'services', footprint: [3, 3], tiles: [],
          entranceFacing: '+Z', signText: WASTE_SIGNS[kind], floors: WASTE_FLOORS[kind] });
        expect(signs(root)).toContain(WASTE_SIGNS[kind]);
        // Region and seed tint the paint, turn the trees and pick the trucks' paint; the buildings keep their size and place.
        const buildings = (root.userData.components as Component[]).filter(c => !['trees', 'regional-prop'].includes(c.role));
        shapes.add(JSON.stringify(buildings.map(c => [c.role, ...c.min, ...c.max].map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v))));
      } finally { disposeModel(root); }
    }
    expect(shapes.size).toBe(1);
  });

  it('repeats exactly for a seed', () => {
    const a = build(kind, 'north', 9), b = build(kind, 'north', 9);
    try {
      expect(countTriangles(a)).toBe(countTriangles(b));
      expect(new Box3().setFromObject(a)).toEqual(new Box3().setFromObject(b));
      expect(materials(a)).toEqual(materials(b));
      expect(anchorNames(a)).toEqual(anchorNames(b));
    } finally { disposeModel(a); disposeModel(b); }
  });

  it('has its parts: the gate with its sign, the fence, the road in with its weighbridge, trees and what this plant does', () => {
    const root = build(kind);
    try {
      const have = roles(root);
      for (const role of [...COMMON, ...ROLES[kind]]) expect([kind, role, have.has(role)]).toEqual([kind, role, true]);
      expect(anchorNames(root).filter(name => name.startsWith('anchor_light_')).length).toBeGreaterThanOrEqual(2);
    } finally { disposeModel(root); }
  });
});

describe('the five plants each look like what they are', () => {
  it('draws smoke only from the stacks of the incinerator and the waste power plant, and a flame from the landfill\'s flare', () => {
    const names = (kind: Kind): string[] => { const root = build(kind); try { return anchorNames(root).filter(name => !name.startsWith('anchor_light_')); } finally { disposeModel(root); } };
    expect(names('incinerator')).toEqual(['anchor_smoke_0']);
    expect(names('waste_power_plant')).toEqual(['anchor_smoke_0', 'anchor_steam_0', 'anchor_steam_1']);
    expect(names('landfill')).toEqual(['anchor_fire_0']);
    expect(names('recycling_plant')).toEqual([]);
    expect(names('wastewater_plant')).toEqual([]);
  });

  it('puts each smoke anchor on top of its stack', () => {
    for (const kind of ['incinerator', 'waste_power_plant'] as const) {
      const root = build(kind);
      try {
        const smoke = root.children.find(child => child.name === 'anchor_smoke_0')!, stack = component(root, 'stack');
        expect(smoke.position.y).toBeGreaterThan(stack.max[1] - 1.2); expect(smoke.position.y).toBeLessThan(stack.max[1] + 1.2);
        expect(smoke.position.y).toBeGreaterThan(30);
        expect(smoke.position.x).toBeGreaterThan(stack.min[0]); expect(smoke.position.x).toBeLessThan(stack.max[0]);
      } finally { disposeModel(root); }
    }
  });

  it('keeps the low plants low and the two with stacks tall', () => {
    const height = (kind: Kind): number => { const root = build(kind); try { return new Box3().setFromObject(root).max.y; } finally { disposeModel(root); } };
    expect(height('landfill')).toBeLessThan(8);
    expect(height('recycling_plant')).toBeLessThan(10);
    expect(height('wastewater_plant')).toBeLessThan(10);
    expect(height('incinerator')).toBeGreaterThan(30);
    expect(height('waste_power_plant')).toBeGreaterThan(height('incinerator'));
  });

  it('gives the water in the wastewater plant\'s tanks and the landfill\'s wheel wash a water batch, and no other plant one beyond its own', () => {
    const water = (kind: Kind): boolean => { const root = build(kind); try { return materials(root).includes('water_river'); } finally { disposeModel(root); } };
    expect(water('wastewater_plant')).toBe(true);
    expect(water('landfill')).toBe(true);
    expect(water('incinerator')).toBe(false);
    expect(water('waste_power_plant')).toBe(false);
  });

  it('gives the refuse trucks plain paint, never a red cross or a real fleet\'s livery', () => {
    expect(new Set<number>(TRUCK_COLORS).size).toBe(TRUCK_COLORS.length);
    expect(BIN_COLORS.length).toBeGreaterThanOrEqual(3);
    for (const kind of WASTE_KINDS) {
      const root = build(kind);
      try { for (const text of signs(root)) expect(text).not.toMatch(/ตราสัญลักษณ์|กาชาด/); } finally { disposeModel(root); }
    }
  });

  it('keeps the buildings apart: no two main buildings of a plant stand in each other', () => {
    const buildings: Readonly<Record<Kind, readonly string[]>> = {
      landfill: ['office', 'leachate-pond', 'capped-cell', 'wheel-wash'],
      incinerator: ['tipping-hall', 'furnace-hall', 'bag-filter', 'ash-bay', 'control-building', 'fire-water-tank'],
      recycling_plant: ['sorting-shed', 'office', 'glass-bays', 'trailer'],
      waste_power_plant: ['bunker-hall', 'boiler-house', 'turbine-hall', 'condenser', 'bag-filter', 'switchyard', 'control-building'],
      wastewater_plant: ['screens', 'primary-clarifier', 'aeration-basin', 'secondary-clarifier', 'contact-tank', 'digester', 'drying-beds', 'blower-house', 'lab-building'],
    };
    // A hall's skirt, its roof's overhang and the sun-side plinth reach a little past the wall
    const overlap = (a: Component, b: Component): boolean => a.min[0] < b.max[0] - 1.2 && b.min[0] < a.max[0] - 1.2
      && a.min[2] < b.max[2] - 1.2 && b.min[2] < a.max[2] - 1.2;
    for (const kind of WASTE_KINDS) {
      const root = build(kind);
      try {
        const parts = (root.userData.components as Component[]).filter(c => buildings[kind].includes(c.role));
        parts.forEach((a, i) => parts.slice(i + 1).forEach(b => expect([kind, a.role, b.role, overlap(a, b)]).toEqual([kind, a.role, b.role, false])));
      } finally { disposeModel(root); }
    }
  });
});

describe('rubbish and wastewater plants in the city view', () => {
  const W = 20;
  function city(kind: string | null, roads: readonly (readonly [number, number])[] = [], record = true) {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), centre = 10 * W + 10;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = WASTE - 4 + (dy + 1) * 3 + dx + 1;
    flags[centre] = ZONEBIT | POWERBIT;
    for (const [x, y] of roads) values[y * W + x] = ROADS;
    const map = { width: W, height: W, getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x],
      wasteKinds: record ? (kind ? { [centre]: kind } : {}) : null };
    const snapshot = new TileSnapshot(W, W); snapshot.source = map; snapshot.sync(map);
    return { snapshot, centre, map };
  }

  it('places each plant from wasteKinds on its centre once, covering its 3 × 3, with its far-view height', () => {
    for (const kind of WASTE_KINDS) {
      const { snapshot, centre } = city(kind);
      const placement = snapshot.placement(centre, 'south')!;
      expect(placement).toMatchObject({ id: wasteId(kind), kind: 'services', footprint: [3, 3], x: 105, z: 105, rotation: 0, powered: true, height: WASTE_HEIGHTS[kind] });
      expect(placement.options).toMatchObject({ region: 'south', variant: 0, state: 'closed' });
      let others = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) {
        expect(snapshot.coverage[(10 + dy) * W + 10 + dx]).toBe(centre);
        if (snapshot.placement((10 + dy) * W + 10 + dx, 'south')) others++;
      }
      expect(others).toBe(0);
    }
  });

  it('takes a building without a record, or a map without the record, for a landfill', () => {
    expect(city(null).snapshot.placement(10 * W + 10, 'central')).toMatchObject({ id: 'waste.landfill', footprint: [3, 3] });
    expect(city(null, [], false).snapshot.placement(10 * W + 10, 'central')).toMatchObject({ id: 'waste.landfill' });
    expect(city('some_future_kind').snapshot.placement(10 * W + 10, 'central')).toMatchObject({ id: null, kind: 'services', footprint: [3, 3] });
  });

  it('turns a plant\'s gate toward its road', () => {
    const turn = (roads: readonly (readonly [number, number])[]): number => city('recycling_plant', roads).snapshot.placement(10 * W + 10, 'central')!.rotation;
    expect(turn([])).toBe(0);
    expect(turn([[9, 12], [10, 12], [11, 12]])).toBe(0);
    expect(turn([[12, 9], [12, 10], [12, 11]])).toBeCloseTo(Math.PI / 2);
    expect(turn([[8, 9], [8, 10]])).toBeCloseTo(-Math.PI / 2);
    expect(turn([[9, 8], [10, 8], [11, 8]])).toBeCloseTo(Math.PI);
  });

  it('only reads the map', () => {
    const { snapshot, centre, map } = city('wastewater_plant', [[10, 12]]);
    const before = JSON.stringify(map.wasteKinds);
    snapshot.placement(centre, 'east');
    expect(JSON.stringify(map.wasteKinds)).toBe(before);
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe('waste meshes', () => {
  it('name every mesh after its model', () => {
    const root = build('incinerator', 'west', 3);
    try { root.traverse(object => { if (object instanceof Mesh) expect(object.name.startsWith('waste.incinerator/')).toBe(true); }); } finally { disposeModel(root); }
  });
});
