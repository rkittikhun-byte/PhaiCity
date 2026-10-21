/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The yards round the power plants and water works (models/services/plant-yard.ts, city/plantYards.ts; owner, 21 Oct
// 2026: "โรงไฟฟ้า ทำไมมีพื้นที่เยอะ"): each kind in each era fills the block its building leaves bare, keeps off the
// building, never passes its block, and stays within its triangles; the city view stands it round its plant.

import { Box3, Mesh } from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TRIANGLE_BUDGETS } from '../../src/render3d/constants.js';
import { EraModels, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { Placement, RoadsidePlacement } from '../../src/render3d/city/placement.js';
import { PLANT_YARDS, withPlantYard } from '../../src/render3d/city/plantYards.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { registry } from '../../src/render3d/models/registry.js';
import {
  createPlantYard, defaultHole, holeState, parseHole, YARD_ERAS, YARD_KINDS, YARD_TILE_METRES, YARD_TILES, yardId, yardPieces,
  type YardHole, type YardKind,
} from '../../src/render3d/models/services/plant-yard.js';
import { countTriangles, disposeModel } from '../../src/render3d/util/geometry.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { NUCLEAR, POWERPLANT, WATER_WORKS } from '../../src/tileValues.js';

const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
const half = (kind: YardKind): number => YARD_TILES[kind] * YARD_TILE_METRES / 2;
/** The holes a yard meets in the city: its procedural building against its road, an era model (3 tiles) against its
 * road on a 4 × 4 block, and the procedural building in the middle of its block (no road in front of it) */
function holes(kind: YardKind): [string, YardHole][] {
  const list: [string, YardHole][] = [['procedural against its road', defaultHole(kind)],
    ['procedural in the middle', { hw: defaultHole(kind).hw, c: 0 }]];
  // (only a lignite, gas or nuclear plant is ever drawn with its era's model: eraBuildings.ts eraKindFor)
  if (['coal', 'gas', 'nuclear'].includes(kind)) list.push(['era model against its road', { hw: 23.5, c: half(kind) - 23.5 }]);
  return list;
}
const cases = YARD_KINDS.flatMap(kind => YARD_ERAS.flatMap(era => holes(kind).map(([name, hole]) => [kind, era, name, hole] as const)));

/** The share of the block's bare ground (2 m cells outside the hole and inside the fence) within `reach` metres of a
 * piece of the yard other than its fence */
function covered(kind: YardKind, hole: YardHole, boxes: Box3[], reach = 4): number {
  const h = half(kind) - 1;
  let bare = 0, near = 0;
  for (let x = -h + 1; x < h; x += 2) for (let z = -h + 1; z < h; z += 2) {
    if (Math.abs(x) < hole.hw && Math.abs(z - hole.c) < hole.hw) continue;
    bare++;
    if (boxes.some(b => x > b.min.x - reach && x < b.max.x + reach && z > b.min.z - reach && z < b.max.z + reach)) near++;
  }
  return bare ? near / bare : 1;
}

describe('plant yards', () => {
  it('registers a yard for every kind, its block the kind\'s, every era a variant', () => {
    for (const kind of YARD_KINDS) {
      expect(registry[yardId(kind)]).toMatchObject({ category: 'services', footprint: [YARD_TILES[kind], YARD_TILES[kind]],
        tiles: [], budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R3', variants: [...YARD_ERAS] });
    }
    // every plant the tile reader names has a yard, the power plants on 4 × 4 and the water works and waste plant 3 × 3
    expect(Object.values(PLANT_YARDS).sort()).toEqual([...YARD_KINDS].sort());
  });

  it('reads its hole from its state, and a state it cannot read as its procedural building\'s', () => {
    const hole = { hw: 14.6, c: 17.4 };
    expect(parseHole('coal', holeState(hole))).toEqual(hole);
    expect(parseHole('coal', 'closed')).toEqual(defaultHole('coal'));
    // never past its block
    expect(parseHole('water', '40,40')).toEqual({ hw: 24, c: 0 });
  });

  it.each(cases)('%s yard, era %i, %s: inside its block, off the building, filling the ground, within budget',
    (kind, era, _name, hole) => {
      const root = createPlantYard(kind, { variant: era, state: holeState(hole) });
      try {
        const pieces = yardPieces(root), h = half(kind);
        expect(pieces.length).toBeGreaterThan(0);
        // one mesh in the era buildings' material, within the budget of a low 3 × 3
        const meshes: Mesh[] = [];
        root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
        expect(meshes).toHaveLength(1);
        expect(countTriangles(root)).toBeLessThanOrEqual(TRIANGLE_BUDGETS.lowRise);
        // the whole model inside its footprint (10 units a tile), half a unit clear of its edge
        const bounds = new Box3().setFromObject(root), edge = YARD_TILES[kind] * 5 - 0.5;
        expect(Math.max(-bounds.min.x, bounds.max.x, -bounds.min.z, bounds.max.z)).toBeLessThanOrEqual(edge + 1e-6);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        for (const { feature, box } of pieces) {
          // every piece inside the block, in metres
          expect([feature, Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= h - 0.8 + 1e-6]).toEqual([feature, true]);
          // ... and none on the building's square (a rotor turning high above a side is still beside it)
          const over = box.max.x > -hole.hw + 0.05 && box.min.x < hole.hw - 0.05
            && box.max.z > hole.c - hole.hw + 0.05 && box.min.z < hole.c + hole.hw - 0.05;
          expect([feature, over]).toEqual([feature, false]);
        }
        // the bare ground reads as the plant's: most of it within a few metres of something of the yard
        const stuff = pieces.filter(p => p.feature !== 'fence').map(p => p.box);
        expect(covered(kind, hole, stuff)).toBeGreaterThanOrEqual(0.6);
      } finally { disposeModel(root); }
    });

  it('builds the same yard for any seed or region, and a richer one in a later era', () => {
    for (const kind of ['coal', 'water'] as const) {
      const triangles = YARD_ERAS.map(era => {
        const a = createPlantYard(kind, { variant: era, seed: 3, region: 'north' }), b = createPlantYard(kind, { variant: era });
        try {
          expect(countTriangles(a)).toBe(countTriangles(b));
          return countTriangles(a);
        } finally { disposeModel(a); disposeModel(b); }
      });
      // era 1 is small and simple: fewer triangles than the industrial yards of eras 3 and 4
      expect(triangles[0]).toBeLessThan(triangles[2]);
      expect(triangles[0]).toBeLessThan(triangles[3]);
    }
  });

  it('a lignite yard has its stockpile, conveyor, ash pond, switchyard, truck yard and fence from era 3', () => {
    const root = createPlantYard('coal', { variant: 3 });
    try {
      const features = new Set(yardPieces(root).map(p => p.feature));
      for (const f of ['coal-stockpile', 'conveyor', 'ash-pond', 'switchyard', 'truck-yard', 'fence']) expect([f, features.has(f)]).toEqual([f, true]);
    } finally { disposeModel(root); }
    const village = createPlantYard('coal', { variant: 1 });
    try {
      const features = new Set(yardPieces(village).map(p => p.feature));
      // a village's generator yard: firewood, a heap of lignite, timber poles, ox carts
      for (const f of ['firewood', 'lignite-heap', 'switchyard', 'truck-yard', 'fence']) expect([f, features.has(f)]).toEqual([f, true]);
      expect(features.has('conveyor')).toBe(false);
    } finally { disposeModel(village); }
  });

  it.each([
    ['gas', ['gas-tanks', 'pipe-rack', 'switchyard']], ['solar', ['solar-rows']], ['wind', ['wind-turbine']],
    ['hydro', ['reservoir', 'dam-wall', 'spillway']], ['nuclear', ['cooling-tower', 'containment']],
    ['water', ['settling-tanks', 'filter-beds', 'clear-water-tank', 'pump-house', 'chemical-store']],
    ['waste_power', ['refuse-bunker', 'stack']],
  ] as const)('a %s yard has what such a plant has', (kind, wanted) => {
    const root = createPlantYard(kind, { variant: 5 });
    try {
      const features = new Set(yardPieces(root).map(p => p.feature));
      for (const f of wanted) expect([f, features.has(f)]).toEqual([f, true]);
      if (kind === 'wind') expect(yardPieces(root).filter(p => p.feature === 'wind-turbine').length).toBeGreaterThan(0);
    } finally { disposeModel(root); }
  });

  it('stands the yard behind a building against its road, its block\'s front at the building\'s front, turned with it', () => {
    const units = 10 / 16, rotation = Math.PI / 2;
    // a procedural lignite plant drawn at 0.75 of its 39-unit site, against a road to its east
    const main = new RoadsidePlacement({ index: 5, x: 100, z: 50, id: 'power.coal', options: { state: 'closed' }, rotation,
      footprint: [4, 4], height: 44, color: 0, kind: 'services', water: false, scale: units * 0.75, fill: units * 0.75, powered: true });
    const p = withPlantYard(main, 'power.coal', units, 3, null)!;
    const yard = p.parts![0];
    expect(yard).toBeInstanceOf(RoadsidePlacement);
    expect(yard.id).toBe('yard.coal');
    expect(yard.rotation).toBe(rotation);
    expect(yard.scale).toBeCloseTo(1);
    const hw = 19.5 * 0.75, c = 32 - hw;
    expect(yard.options).toMatchObject({ variant: 3, seed: 0, region: 'central', state: holeState({ hw, c }) });
    // its middle c metres behind the building's: the building faces +x here, so the yard lies to its west
    expect(yard.x).toBeCloseTo(100 - c * units);
    expect(yard.z).toBeCloseTo(50);
    // the yard's front (32 m ahead of its middle) and the building's (hw ahead of its middle) meet
    expect(yard.x + 32 * units).toBeCloseTo(main.x + hw * units);
  });

  it('keeps the solar, wind and gas plants\' own fences out of a yard, and gives none to a plant that fills its block', () => {
    const units = 10 / 16;
    const solar = (fields: Partial<Placement> = {}): Placement => new Placement({ index: 1, x: 0, z: 0, id: 'power.solar',
      options: { state: 'closed' }, rotation: 0, footprint: [4, 4], height: 8, color: 0, kind: 'services', water: false,
      scale: units * 0.85, fill: units * 0.85, powered: true, ...fields });
    expect(withPlantYard(solar(), 'power.solar', units, 4, null)!.options.state).toBe('yard');
    // a procedural plant on a map that is not real-scale fills its block whole: no yard
    expect(withPlantYard(solar({ scale: 1, fill: 1 }), 'power.solar', units, 4, null)!.parts).toBeUndefined();
    // and a construction site, or something that is no plant, never gets one
    expect(withPlantYard(solar({ id: 'site.building_4' }), 'power.solar', units, 4, null)!.parts).toBeUndefined();
    expect(withPlantYard(solar({ id: 'svc.police' }), 'svc.police', units, 4, null)!.parts).toBeUndefined();
  });

  describe('in the city view', () => {
    const W = 24;
    function city(value: number, size: number, era: number, kinds: Record<number, string> = {}) {
      const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), cx = 10, cy = 10, centre = cy * W + cx;
      for (let dy = -1; dy < size - 1; dy++) for (let dx = -1; dx < size - 1; dx++)
        values[(cy + dy) * W + cx + dx] = value - (size === 4 ? 5 : 4) + (dy + 1) * size + dx + 1;
      flags[centre] = ZONEBIT | POWERBIT;
      const map = { width: W, height: W, era, powerKinds: kinds,
        getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x] };
      const snapshot = new TileSnapshot(W, W); snapshot.source = map as never; snapshot.sync(map as never);
      snapshot.eraModels = new EraModels(index);
      return { snapshot, centre };
    }

    it('stands an era-1 lignite plant (the water mill) in its yard, the yard\'s hole the era model\'s 48 m lot', () => {
      const { snapshot, centre } = city(POWERPLANT, 4, 1);
      const p = snapshot.placement(centre, 'central')!;
      expect(p.id).toBe('era.1.power_plant');
      const yard = p.parts?.find(part => part.id === 'yard.coal');
      expect(yard).toBeDefined();
      // a map that is not real-scale: the era model drawn at 10/16, in the middle of its block
      expect(yard!.options).toMatchObject({ variant: 1, state: holeState({ hw: 23.5, c: 0 }) });
      expect([yard!.x, yard!.z]).toEqual([p.x, p.z]);
    });

    it.each([['solar', 4], ['wind', 4], ['hydro', 3], ['gas', 2]] as const)('stands a %s plant in its yard in era %i', (kind, era) => {
      const { snapshot, centre } = city(POWERPLANT, 4, era, { [10 * W + 10]: kind });
      snapshot.realUnits = 10 / 16;
      const p = snapshot.placement(centre, 'central')!;
      expect(p.parts?.map(part => part.id)).toEqual([yardId(kind)]);
    });

    it('stands a nuclear plant and a water works in theirs, and leaves a water works whose era model fills its block alone', () => {
      const nuclear = city(NUCLEAR, 4, 4);
      nuclear.snapshot.realUnits = 10 / 16;
      expect(nuclear.snapshot.placement(nuclear.centre, 'central')!.parts?.map(part => part.id)).toEqual(['yard.nuclear']);
      const water = city(WATER_WORKS, 3, 3);
      water.snapshot.realUnits = 10 / 16;
      const works = water.snapshot.placement(water.centre, 'central')!;
      expect(works.id).toBe('era.3.water_works');
      // 47 m of its 48 m block: nothing bare round it
      expect(works.parts ?? []).toEqual([]);
      // ... but the procedural water works, before the era models load, stands in its yard
      water.snapshot.eraModels = null;
      expect(water.snapshot.placement(water.centre, 'central')!.parts?.map(part => part.id)).toEqual(['yard.water']);
    });
  });

  it('the water tower fits its one tile', () => {
    const root = registry['water.tower'].factory({});
    try {
      const box = new Box3().setFromObject(root);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(5);
    } finally { disposeModel(root); }
  });
});
