/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A big building's construction site in 3D (src/construction.ts map.sites): the view draws a site with a fence,
// scaffolding and, on large ones, a tower crane in the building's place until the map lets it go, then the building;
// every site of a size is one shared prototype, and the view only reads map.sites.

import { Box3 } from 'three';
import { TileSnapshot, prototypeKey } from '../../src/render3d/city/tileModels.js';
import { registry } from '../../src/render3d/models/registry.js';
import { SITE_SIZES, siteId } from '../../src/render3d/models/plot/site.js';
import { countTriangles, disposeModel } from '../../src/render3d/util/geometry.js';
import { CIVIC, POWERPLANT } from '../../src/tileValues.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';

describe('construction site models', () => {
  it('registers one light site a size, with and without a crane', () => {
    for (const size of SITE_SIZES) {
      const entry = registry[siteId(size)];
      expect(entry).toMatchObject({ category: 'services', footprint: [size, size], tiles: [], regionTier: 'R3', variants: [0, 1] });
      const plain = entry.factory({ variant: 0 }), crane = entry.factory({ variant: 1 });
      try {
        expect(plain.userData.towerCrane).toBe(false);
        expect(crane.userData.towerCrane).toBe(true);
        // the crane stands above the frame
        expect(new Box3().setFromObject(crane).max.y).toBeGreaterThan(new Box3().setFromObject(plain).max.y + 4);
        expect(countTriangles(crane)).toBeLessThan(3000);
        expect(plain.userData.signTexts).toContain('กำลังก่อสร้าง');
      } finally { disposeModel(plain); disposeModel(crane); }
    }
  });
});

describe('construction sites in the city view', () => {
  const W = 20;
  function city(value: number, sites: Record<string, { tool: string; ready: number }> | null, civic?: string) {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W), centre = 10 * W + 10;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = value - 4 + (dy + 1) * 3 + dx + 1;
    values[centre] = value;
    flags[centre] = ZONEBIT | POWERBIT;
    const map = { width: W, height: W, sites, getTileValue: (x: number, y: number) => values[y * W + x],
      getTileFlags: (x: number, y: number) => flags[y * W + x], civicKinds: civic ? { [centre]: civic } : {} };
    const snapshot = new TileSnapshot(W, W); snapshot.source = map; snapshot.sync(map);
    return { snapshot, centre, map };
  }

  it('draws a site in place of a building still being built, and the building once it is done', () => {
    const { snapshot, centre, map } = city(CIVIC, { [10 * W + 10]: { tool: 'secondary_school', ready: 40 } }, 'secondary_school');
    expect(snapshot.placement(centre, 'central')).toMatchObject({ id: 'site.building_3', kind: 'services', footprint: [3, 3], x: 105, z: 105 });
    expect(snapshot.placement(centre, 'central')!.options).toMatchObject({ variant: 0, seed: 0 });
    // The site is finished: no tile changes, but the view sees the site go and draws the school
    map.sites = {};
    expect(snapshot.sync(map)).toEqual([centre]);
    expect(snapshot.placement(centre, 'central')!.id).toBe('civic.secondary_school');
    expect(snapshot.sync(map)).toEqual([]);
    // ... and a new site is seen too
    map.sites = { [centre]: { tool: 'secondary_school', ready: 80 } };
    expect(snapshot.sync(map)).toEqual([centre]);
  });

  it('puts a tower crane on a large site or a long build', () => {
    const plant = city(POWERPLANT, { [10 * W + 10]: { tool: 'coal', ready: 24 } });
    expect(plant.snapshot.placement(plant.centre, 'central')).toMatchObject({ id: 'site.building_4', footprint: [4, 4], x: 110, z: 110 });
    expect(plant.snapshot.placement(plant.centre, 'central')!.options.variant).toBe(1);
    const hospital = city(CIVIC, { [10 * W + 10]: { tool: 'provincial_hospital', ready: 24 } }, 'provincial_hospital');
    expect(hospital.snapshot.placement(hospital.centre, 'central')!.options.variant).toBe(1);
  });

  it('shares one prototype between sites of a size, whatever the seed', () => {
    const a = city(CIVIC, { [10 * W + 10]: { tool: 'kindergarten', ready: 8 } }, 'kindergarten');
    const b = city(CIVIC, { [10 * W + 10]: { tool: 'health_centre', ready: 8 } }, 'health_centre');
    expect(prototypeKey(a.snapshot.placement(a.centre, 'central')!)).toBe(prototypeKey(b.snapshot.placement(b.centre, 'central')!));
  });

  it('only reads the sites', () => {
    const { snapshot, centre, map } = city(CIVIC, { [10 * W + 10]: { tool: 'secondary_school', ready: 40 } }, 'secondary_school');
    const before = JSON.stringify(map.sites);
    snapshot.placement(centre, 'east'); snapshot.sync(map);
    expect(JSON.stringify(map.sites)).toBe(before);
  });
});
