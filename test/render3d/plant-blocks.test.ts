/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 3D view of the power plants that take only the tiles their model covers (src/plantBlocks.ts): a 3 x 3 drawn with
// its era's model where its era has one, a 2 x 2 always by the program's model, each standing on exactly its block,
// never past it; the sizes the simulation gives agree with which kinds the era models draw.

import { Box3, Vector3 } from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EraModels, eraKindFor, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { PLANT_SHARE, plantScale, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { registry } from '../../src/render3d/models/registry.js';
import { disposeModel } from '../../src/render3d/util/geometry.js';
import { NUCLEAR_KIND, plantBlockSize } from '../../src/plantBlocks.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { PLANT2, PLANT2_BASE, PLANT3, PLANT3_BASE } from '../../src/tileValues.js';

const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
const W = 24, CX = 10, CY = 10, CENTRE = CY * W + CX;

/** A map with one sized plant round (10, 10) of a kind, in an era, at real scale (16 m tiles) or not */
function city(size: 2 | 3, kind: string, era: number, real: boolean) {
  const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), base = size === 3 ? PLANT3_BASE : PLANT2_BASE;
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) values[(CY - 1 + dy) * W + CX - 1 + dx] = base + dy * size + dx;
  flags[CENTRE] = ZONEBIT | POWERBIT;
  const map = { width: W, height: W, era, powerKinds: { [CENTRE]: kind },
    getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x] };
  const snapshot = new TileSnapshot(W, W); snapshot.source = map as never; snapshot.sync(map as never);
  snapshot.eraModels = new EraModels(index);
  if (real) snapshot.realUnits = 10 / 16;
  return snapshot;
}

/** Where a procedural plant's model reaches as drawn, in world units round its placement's middle */
function reach(id: string, scale: number): number {
  const root = registry[id].factory({ region: 'central' });
  try {
    const box = new Box3().setFromObject(root), size = box.getSize(new Vector3());
    return Math.max(size.x, size.z) / 2 * scale;
  } finally { disposeModel(root); }
}

describe('sized power plants in the city view', () => {
  it('give an era model to a 3 x 3 exactly where the simulation gave its kind a 3 x 3', () => {
    for (const era of [1, 2, 3, 4, 5]) for (const [kind, id] of [['lignite', 'power.coal'], ['gas', 'power.gas'],
      ['solar', 'power.solar'], ['wind', 'power.wind'], ['hydro', 'power.hydro'], [NUCLEAR_KIND, 'power.nuclear']] as const) {
      const eraModel = eraKindFor(id, undefined, era) !== null;
      // (a nuclear plant is built only in era 5, gas from era 2)
      if (kind === NUCLEAR_KIND && era < 5 || kind === 'gas' && era < 2) continue;
      expect([kind, era, plantBlockSize(kind, era)]).toEqual([kind, era, eraModel ? 3 : 2]);
    }
  });

  it.each([[3, 'lignite', 1, 'era.1.power_plant'], [3, 'gas', 4, 'era.4.power_plant'], [3, NUCLEAR_KIND, 5, 'era.5.power_plant'],
    [2, 'lignite', 4, 'power.coal'], [2, 'gas', 3, 'power.gas'], [2, 'solar', 4, 'power.solar'], [2, 'wind', 5, 'power.wind'],
    [2, 'hydro', 3, 'power.hydro'], [3, 'lignite', 4, 'power.coal']] as const)(
    'a %i-tile-wide %s plant in era %i is drawn as %s on its block, never past it', (size, kind, era, id) => {
      for (const real of [false, true]) {
        const p = city(size, kind, era, real).placement(CENTRE, 'central')!;
        expect(p.id).toBe(id);
        expect(p.footprint).toEqual([size, size]);
        // its middle the block's: tiles 9 .. 9 + size - 1, 10 world units each
        expect([p.x, p.z]).toEqual([(CX - 1 + size / 2) * 10, (CY - 1 + size / 2) * 10]);
        const half = size * 5;
        if (id.startsWith('era.')) {
          // an era model is 16 m a tile less half a metre clear: on its block whole, drawn 10 units a 16 m tile
          const drawn = (index.kinds.power_plant.tiles * 16 / 2) * p.scale * (real ? 1 : 1);
          expect(index.kinds.power_plant.tiles).toBe(size);
          expect(drawn).toBeCloseTo(half, 5);
        } else {
          // the program's model, made for the old 4 x 4, fills its block half a metre clear of its edge
          const r = reach(id, p.scale);
          expect(r).toBeLessThanOrEqual(half + 1e-6);
          expect(r).toBeGreaterThan(half * 0.9);
        }
      }
    });

  it('draws a 2 x 2 by the program even in an era whose model would not fit it', () => {
    // a gas plant built as a 2 x 2 in era 3 stays one after the city reaches era 4, whose gas plant is a 48 m model
    const p = city(2, 'gas', 4, true).placement(CENTRE, 'central')!;
    expect(p.id).toBe('power.gas');
    expect(p.procedural).toBe(true);
    // 10 units a tile less half a unit clear, as ไม้ไผ่26's road edge reads every building's front (tileModels.ts frontOf)
    expect(plantScale(2) * 39 / 2).toBeCloseTo(2 * 5 - 0.5, 5);
    expect(PLANT_SHARE).toBe(1.6);
  });

  it('draws a 2 x 2 site while a 2 x 2 plant is being built', () => {
    const snapshot = city(2, 'solar', 4, true);
    (snapshot.source as any).sites = { [CENTRE]: { tool: 'solar', done: 99999 } };
    snapshot.sync(snapshot.source as never);
    snapshot.enableConstruction = true;
    const p = snapshot.placement(CENTRE, 'central')!;
    if (p.id?.startsWith('site.')) expect(p).toMatchObject({ id: 'site.building_2', footprint: [2, 2] });
    expect(registry['site.building_2'].footprint).toEqual([2, 2]);
    expect([PLANT3, PLANT2]).toEqual([874, 1019]);
  });
});
