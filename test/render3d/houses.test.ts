/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Material, Mesh } from 'three';
import { HOUSE_IDS, HOUSE_TIERS } from '../../src/render3d/models/residential/houses.js';
import { registry } from '../../src/render3d/models/registry.js';
import { getRegionKit } from '../../src/render3d/regional/index.js';
import { REGIONS, RegionId } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel } from '../../src/render3d/util/geometry.js';
import { isLibraryMaterial } from '../../src/render3d/materials/library.js';

interface Component { role: string; min: number[]; max: number[]; triangles: number }

describe('Prompt 7: twelve houses in every region', () => {
  for (const [index, id] of HOUSE_IDS.entries()) {
    it.each(REGIONS)(`${id} has a complete, bounded lot in %s`, region => {
      const entry = registry[id], house = entry.factory({ seed: 17, region });
      try {
        expect(entry.category).toBe('residential'); expect(entry.tiles).toEqual([249 + index]);
        expect(entry.regionTier).toBe(HOUSE_TIERS[index]); expect(house.userData.kit).toBe(region);
        const parts = house.userData.components as Component[], roles = parts.map(p => p.role);
        for (const role of ['yard', 'body', 'roof', 'windows-door', 'fence', 'entrance', 'greenery']) expect(roles).toContain(role);
        expect(parts.reduce((n, p) => n + p.triangles, 0)).toBe(countTriangles(house));
        expect(countTriangles(house)).toBeLessThanOrEqual(3000); expect(countDrawCalls(house)).toBeLessThanOrEqual(8);
        const bounds = new Box3().setFromObject(house);
        expect(bounds.min.x).toBeCloseTo(-4.5, 3); expect(bounds.max.x).toBeCloseTo(4.5, 3);
        expect(bounds.min.z).toBeCloseTo(-4.5, 3); expect(bounds.max.z).toBeCloseTo(4.5, 3);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
        const entrance = parts.find(p => p.role === 'entrance')!;
        expect(entrance.min[0]).toBeLessThan(-0.7); expect(entrance.max[0]).toBeGreaterThan(0.7);
        expect(entrance.max[2]).toBeGreaterThan(4.3);
        // The front fence leaves a real gap, independent of annotation metadata.
        const fence = parts.find(p => p.role === 'fence')!;
        expect(fence.min[2]).toBeLessThan(-4.3); expect(fence.max[2]).toBeGreaterThan(4.3);
        const frontFenceVertices: number[] = [];
        house.traverse(node => { if (node instanceof Mesh) {
          const mat = node.material as Material; expect(isLibraryMaterial(mat)).toBe(true);
          const p = node.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) if (p.getZ(i) > 4.28 && p.getY(i) > 0.2 && p.getY(i) < 1.12) frontFenceVertices.push(Math.abs(p.getX(i)));
        } });
        expect(frontFenceVertices.length).toBeGreaterThan(0);
        expect(Math.min(...frontFenceVertices)).toBeGreaterThan(0.78);
        expect(house.userData.plants.length).toBeGreaterThan(0);
      } finally { disposeModel(house); }
    });
    if (HOUSE_TIERS[index] === 'R2') it(`${id} keeps its actual body envelope across six regions`, () => {
      let expected: Component | undefined;
      for (const region of REGIONS) {
        const house = registry[id].factory({ region, seed: 4 });
        try {
          const body = (house.userData.components as Component[]).find(p => p.role === 'body')!;
          if (expected) { expect(body.min).toEqual(expected.min); expect(body.max).toEqual(expected.max); }
          expected = body;
        } finally { disposeModel(house); }
      }
    });
  }

  it('preserves the regional cells and characteristic household props', () => {
    const expected: Record<RegionId, Record<string, readonly string[]>> = {
      north: { shack: [], stilt: ['rice_granary'], traditional: ['paper_umbrella'] },
      northeast: { shack: ['rice_barn'], stilt: ['weaving_loom', 'rice_barn'], mixed: ['bamboo_daybed', 'dragon_jar'], traditional: ['bamboo_daybed', 'weaving_loom'] },
      central: { shack: ['dragon_jar', 'dragon_jar'], stilt: ['dragon_jar'], concrete: ['spirit_house'], traditional: ['dragon_jar'] },
      east: { shack: ['fishing_nets'], traditional: ['fishing_nets'] },
      west: { concrete: ['sugar_stove'] },
      south: { shack: ['rubber_rack'], stilt: ['dove_cage_pole'], mixed: ['rubber_rack'], concrete: ['dove_cage_pole'] },
    };
    for (const region of REGIONS) for (const [style, props] of Object.entries(expected[region])) {
      const kit = getRegionKit(region); expect(kit.houses[style as keyof typeof kit.houses].props.map(p => p.kind)).toEqual(props);
      props.forEach(kind => expect(typeof kit.props[kind]).toBe('function'));
    }
    expect(getRegionKit('east').houses.concrete.plants).toEqual(['durian', 'mangosteen']);
    expect(getRegionKit('central').houses.traditional.cluster).toBe(true);
    expect(getRegionKit('north').houses.heritage.layeredHip).toBe(true);
    expect(getRegionKit('north').houses.heritage.wrapVeranda).toBe(true);
    expect(getRegionKit('south').houses.heritage.arches).toBe(true);
    expect(getRegionKit('south').houses.heritage.pediments).toBe(true);
    expect(getRegionKit('central').houses.concrete.hedge).toBe(true);
  });
});
