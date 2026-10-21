/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 3D view of a temple (src/temples.ts, docs/GAME_DESIGN.md 9): on its civic 3 x 3, the program's temple at its level
// until its era's model loads, then `era.<n>.temple_<level>` of the temple's era; its wall is its model's, so no ruler's
// fence goes round it; the festivals' look stands at the venue the city held them at.

import { Box3, Vector3 } from 'three';
import { EraModels, eraKindFor, eraModelId, TEMPLE_KINDS, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { fencedBuildings } from '../../src/render3d/city/compounds.js';
import { registry } from '../../src/render3d/models/registry.js';
import { TEMPLE_ID } from '../../src/render3d/models/civic/temple.js';
import { countTriangles, disposeModel } from '../../src/render3d/util/geometry.js';
import { PlacedBuildings } from '../../src/buildings/placedBuildings.js';
import { ZONEBIT } from '../../src/tileFlags.js';
import { CIVIC } from '../../src/tileValues.js';

const W = 24, CX = 10, CY = 10, CENTRE = CY * W + CX;

/** A map with a temple of a level round (10, 10), its era kept per building */
function city(level: number, era: number) {
  const values = new Uint16Array(W * W), flags = new Uint16Array(W * W);
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) values[(CY - 1 + dy) * W + CX - 1 + dx] = CIVIC - 4 + dy * 3 + dx;
  flags[CENTRE] = ZONEBIT;
  const buildingEras = new Uint8Array(W * W);
  buildingEras[CENTRE] = era;
  const map = { width: W, height: W, era: 1, buildingEras, civicKinds: { [CENTRE]: 'temple' },
    temples: { temples: [{ tile: CENTRE, level, since: 0 }] },
    getTileValue: (x: number, y: number) => values[y * W + x], getTileFlags: (x: number, y: number) => flags[y * W + x] };
  const snapshot = new TileSnapshot(W, W); snapshot.source = map as never; snapshot.sync(map as never);
  return { snapshot, map };
}

/** An index with every temple kind of every era and region */
function templeIndex(): EraIndex {
  const regions = ['north', 'northeast', 'central', 'east', 'west', 'south'];
  const buildings: Record<string, Record<string, Record<string, { height: number; triangles: number }>>> = {};
  for (let era = 1; era <= 5; era++) {
    buildings[`era${era}`] = Object.fromEntries(regions.map(r => [r, Object.fromEntries(TEMPLE_KINDS.map((k, i) => [k, { height: 10 + i * 6, triangles: 9000 }]))]));
  }
  return { version: 1, tileMetres: 16, kinds: Object.fromEntries(TEMPLE_KINDS.map(k => [k, { tiles: 3 }])), buildings };
}

describe('a temple in the city view', () => {
  it('is the program’s temple at its level until the era models load', () => {
    for (const level of [1, 2, 3]) {
      const p = city(level, 2).snapshot.placement(CENTRE, 'central')!;
      expect(p).toMatchObject({ id: TEMPLE_ID, footprint: [3, 3], eraKind: `temple_${level}` });
      expect(p.options.variant).toBe(level);
      expect(p.powered).toBe(false);
    }
  });

  it('is drawn with its own era’s model of its level', () => {
    for (const era of [1, 3, 5]) for (const level of [1, 2, 3]) {
      const { snapshot } = city(level, era);
      snapshot.eraModels = new EraModels(templeIndex());
      const p = snapshot.placement(CENTRE, 'central')!;
      expect(p.id).toBe(eraModelId(era, `temple_${level}`));
      expect(p.height).toBe(10 + (level - 1) * 6);
    }
    expect(eraKindFor(TEMPLE_ID, 'temple_2', 3)).toBe('temple_2');
    expect(eraKindFor(TEMPLE_ID, undefined, 3)).toBeNull();
  });

  it('has no ruler’s fence: its wall is its own', () => {
    const { map } = city(1, 1);
    const placed = new PlacedBuildings();
    placed.add({ tool: 'temple', size: 3, tile: CENTRE, x: 168, z: 168, rot: 0 });
    placed.add({ tool: 'primary_school', size: 3, tile: CENTRE + 6, x: 264, z: 168, rot: 0 });
    const fenced = fencedBuildings({ ...map, buildings: placed, getTile: () => ({ isZone: () => true }) } as never);
    expect(fenced.map(b => b.tool)).toEqual(['primary_school']);
  });

  it('the program’s temple stays within its 3 x 3, light, its gate on its front, one model a level', () => {
    expect(registry[TEMPLE_ID]).toMatchObject({ footprint: [3, 3], variants: [1, 2, 3] });
    let before = 0;
    for (const level of [1, 2, 3]) {
      const root = registry[TEMPLE_ID].factory({ region: 'central', variant: level });
      try {
        const box = new Box3().setFromObject(root), size = box.getSize(new Vector3());
        expect(Math.max(size.x, size.z)).toBeLessThanOrEqual(30);
        const triangles = countTriangles(root);
        expect(triangles).toBeLessThanOrEqual(registry[TEMPLE_ID].budget);
        expect(triangles).toBeGreaterThan(before);
        before = triangles;
        expect(root.userData).toMatchObject({ temple: true, templeLevel: level, entranceFacing: '+Z' });
      } finally { disposeModel(root); }
    }
  });
});
