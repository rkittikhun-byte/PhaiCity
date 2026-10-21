/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's house drawn with its era's model (RENDERER_SPEC 6H): the era models have the house alone, so the city view
// makes it a little bigger at each level and stands each wing it has built round it on its lot, as its placement's parts.

import { Box3 } from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EraModels, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { HOUSE_ERA_SCALES, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { registry } from '../../src/render3d/models/registry.js';
import { RULER_HOUSE_WINGS, rulerWingId } from '../../src/render3d/models/civic/ruler-house.js';
import { disposeModel } from '../../src/render3d/util/geometry.js';
import { CIVIC } from '../../src/tileValues.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';

const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
const W = 20, CENTRE = 10 * W + 10;

function city(level: number, wings: string[], era = 2) {
  const values = new Uint16Array(W * W), flags = new Uint16Array(W * W);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = CIVIC - 4 + (dy + 1) * 3 + dx + 1;
  flags[CENTRE] = ZONEBIT | POWERBIT;
  const map = { width: W, height: W, era, civicKinds: { [CENTRE]: 'ruler_house' }, rulerHouse: { x: 10, y: 10, level, wings },
    getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x] };
  const snapshot = new TileSnapshot(W, W); snapshot.source = map as never; snapshot.sync(map as never);
  snapshot.eraModels = new EraModels(index);
  return { snapshot, map };
}

describe('the ruler\'s house with its era model', () => {
  it('registers each wing alone on a tile, in the house\'s regional dress', () => {
    for (const wing of RULER_HOUSE_WINGS) {
      expect(registry[rulerWingId(wing)]).toMatchObject({ category: 'services', footprint: [1, 1], tiles: [], regionTier: 'R1' });
      const root = registry[rulerWingId(wing)].factory({ region: 'northeast' });
      try {
        expect(root.userData).toMatchObject({ id: rulerWingId(wing), wing, kit: 'northeast' });
        const box = new Box3().setFromObject(root);
        expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(4.5);
      } finally { disposeModel(root); }
    }
  });

  it('grows a little at each level', () => {
    const scales = [1, 2, 3, 4, 5, 6].map(level => {
      const p = city(level, []).snapshot.placement(CENTRE, 'central')!;
      expect(p.id).toBe('era.2.ruler_house');
      expect(p.parts ?? []).toEqual([]);
      return p.scale;
    });
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    // Not a real-scale map: a 16 m model tile drawn in a 10-unit tile, the house a share of its lot
    expect(scales[0]).toBeCloseTo(10 / 16 * HOUSE_ERA_SCALES[0]);
    expect(scales[5]).toBeCloseTo(10 / 16 * HOUSE_ERA_SCALES[5]);
  });

  it.each([2, 4, 6])('stands every wing round a level-%i house on its lot, clear of the house and of each other', level => {
    const p = city(level, [...RULER_HOUSE_WINGS]).snapshot.placement(CENTRE, 'central')!;
    expect(p.parts!.map(part => part.id).sort()).toEqual(RULER_HOUSE_WINGS.map(rulerWingId).sort());
    // In the era lot's metres: the lot reaches 24 m from its middle, the house's own fence 23.4 m at full size
    const fence = 23.4 * HOUSE_ERA_SCALES[level - 1];
    const boxes = p.parts!.map(part => {
      expect(part.index).toBe(CENTRE);
      expect(part.rotation).toBe(p.rotation);
      expect(part.options).toMatchObject({ seed: 0, variant: 0, state: 'closed' });
      const root = registry[part.id!].factory({ region: 'central' }), box = new Box3().setFromObject(root);
      disposeModel(root);
      const u = (part.x - p.x) / part.scale, v = (part.z - p.z) / part.scale;
      return { id: part.id, x0: u + box.min.x, x1: u + box.max.x, z0: v + box.min.z, z1: v + box.max.z };
    });
    for (const b of boxes) {
      expect([b.id, Math.min(b.x0, b.z0) >= -24.05 && Math.max(b.x1, b.z1) <= 24.05]).toEqual([b.id, true]);
      const clear = b.x1 <= -fence || b.x0 >= fence || b.z1 <= -fence || b.z0 >= fence;
      expect([b.id, clear]).toEqual([b.id, true]);
    }
    for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) {
      const A = boxes[a], B = boxes[c];
      expect([A.id, B.id, A.x1 <= B.x0 || B.x1 <= A.x0 || A.z1 <= B.z0 || B.z1 <= A.z0]).toEqual([A.id, B.id, true]);
    }
  });

  it('turns the wings with the house', () => {
    const { snapshot, map } = city(3, ['culture_court']);
    const straight = snapshot.placement(CENTRE, 'central')!;
    const ahead = straight.parts![0];
    // the culture court stands in front (+Z), right of the gate
    expect(ahead.z).toBeGreaterThan(straight.z);
    expect(ahead.x).toBeGreaterThan(straight.x);
    expect(map.rulerHouse.wings).toEqual(['culture_court']);
  });

  it('only reads the house', () => {
    const { snapshot, map } = city(4, ['granary', 'treasury']);
    const before = JSON.stringify(map.rulerHouse);
    snapshot.placement(CENTRE, 'central'); snapshot.sync(map as never);
    expect(JSON.stringify(map.rulerHouse)).toBe(before);
  });

  it('keeps the procedural compound, wings and all, until the era models load', () => {
    const { snapshot } = city(4, ['granary']);
    snapshot.eraModels = null;
    const p = snapshot.placement(CENTRE, 'central')!;
    expect(p).toMatchObject({ id: 'civic.ruler_house' });
    expect(p.options).toMatchObject({ variant: 4, state: 'granary' });
    expect(p.parts).toBeUndefined();
  });
});
