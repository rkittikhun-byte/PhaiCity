/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, DoubleSide, MeshStandardMaterial, Triangle, Vector3 } from 'three';
import { createHash } from 'node:crypto';
import { bambooCulmMaterial, isLibraryMaterial, polishedStone } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { createTree, TREE_HEIGHTS, TREE_KINDS } from '../../src/render3d/models/vegetation/trees.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { vegetationMix } from '../../src/render3d/regional/vegetation.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

const plants = Object.entries(registry).filter(([, entry]) => entry.category === 'veg' || entry.category === 'park');

describe('vegetation and parks', () => {
  it('registers all 18 standalone trees and the five exact park tile mappings', () => {
    expect(plants).toHaveLength(23);
    TREE_KINDS.forEach(kind => { expect(registry[`veg.${kind}`].category).toBe('veg'); expect(registry[`veg.${kind}`].tiles).toEqual([]); });
    [[40], [41], [42], [43], [840, 841, 842, 843]].forEach((tiles, i) => {
      expect(registry[i === 4 ? 'park.fountain' : `park.garden_${i}`].tiles).toEqual(tiles);
    });
  });

  it.each(TREE_KINDS)('%s has reproducible ±15%% height, lean, rotation and volumetric alpha foliage', kind => {
    const root = createTree(kind, { seed: 1234 });
    try {
      const { sizeScale, lean, yaw } = root.userData.variation;
      expect(sizeScale).toBeGreaterThanOrEqual(0.85); expect(sizeScale).toBeLessThanOrEqual(1.15);
      expect(lean.every((component: number) => Math.abs(component) <= 0.03)).toBe(true);
      expect(yaw).toBeGreaterThanOrEqual(0); expect(yaw).toBeLessThan(Math.PI * 2);
      expect(new Box3().setFromObject(root).max.y).toBeCloseTo(TREE_HEIGHTS[kind] * sizeScale, 4);
      const foliage = visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'foliage_tropical');
      expect(foliage).toHaveLength(1);
      const material = foliage[0].material as MeshStandardMaterial;
      expect(material.side).toBe(DoubleSide); expect(material.alphaTest).toBeGreaterThan(0);
      const geometry = foliage[0].geometry, uv = geometry.getAttribute('uv');
      // Leaf cards sample a single leaf within the atlas, rather than tiled canopy spheres.
      expect(Array.from(uv.array).every(value => value >= 0 && value <= 1)).toBe(true);
      const size = new Box3().setFromObject(foliage[0]).getSize(new Vector3());
      expect(Math.min(size.x, size.y, size.z)).toBeGreaterThan(0.25);
      expect(root.userData.leafCards).toBeGreaterThan(20);
      if (kind === 'hedge') expect(new Box3().setFromObject(root).getSize(new Vector3()).x).toBeCloseTo(10, 4);
      if (kind === 'rain_tree') expect(Math.max(size.x, size.z) / sizeScale).toBeGreaterThanOrEqual(13);
      if (kind === 'bamboo') { expect(root.userData.leafCards).toBeGreaterThanOrEqual(300); expect(countDrawCalls(root)).toBe(2); }
      if (kind === 'mangrove') expect(new Box3().setFromObject(root).min.y).toBeLessThan(-0.6);
    } finally { disposeModel(root); }
  });

  it.each(plants)('%s stays inside its footprint and budget across 24 additional seeds', (_id, entry) => {
    for (let seed = 100; seed < 124; seed++) {
      const root = entry.factory({ seed });
      try {
        const bounds = new Box3().setFromObject(root), margin = entry.tiling ? 0 : 0.5;
        const halfX = entry.footprint[0] * 5 - margin, halfZ = entry.footprint[1] * 5 - margin;
        expect([bounds.min.x >= -halfX - 0.001, bounds.max.x <= halfX + 0.001,
          bounds.min.z >= -halfZ - 0.001, bounds.max.z <= halfZ + 0.001]).toEqual([true, true, true, true]);
        expect(bounds.min.y).toBeGreaterThanOrEqual(entry.ground === 'shore' ? -3 : -0.01);
        expect(countTriangles(root)).toBeLessThanOrEqual(3000); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
      } finally { disposeModel(root); }
    }
  });

  it.each(['coconut', 'sugar_palm', 'oil_palm'] as const)('%s keeps every leaf base attached to a frond', kind => {
    const root = createTree(kind, { seed: 42 });
    try {
      const meshes = visibleMeshes(root);
      const leaf = meshes.find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'foliage_tropical')!.geometry.getAttribute('position');
      const bark = meshes.find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'wood_teak')!.geometry.getAttribute('position');
      const triangle = new Triangle(), target = new Vector3(), base = new Vector3(), edge = new Vector3();
      // The first two vertices of each merged six-vertex card are its attachment edge.
      for (let card = 0; card < leaf.count; card += 6) {
        base.fromBufferAttribute(leaf, card).add(edge.fromBufferAttribute(leaf, card + 1)).multiplyScalar(0.5);
        let nearest = Infinity;
        for (let face = 0; face < bark.count; face += 3) {
          triangle.a.fromBufferAttribute(bark, face); triangle.b.fromBufferAttribute(bark, face + 1); triangle.c.fromBufferAttribute(bark, face + 2);
          nearest = Math.min(nearest, triangle.closestPointToPoint(base, target).distanceTo(base));
        }
        expect(nearest).toBeLessThan(0.22);
      }
    } finally { disposeModel(root); }
  });

  it.each(plants)('%s preserves its footprint, tier, anchors and states; R3 also preserves geometry', (id, entry) => {
    const central = entry.factory({ seed: 42, region: 'central' });
    const anchors = (root: typeof central) => {
      const found: unknown[] = []; root.traverse(node => { if (node.name.startsWith('anchor_')) found.push([node.name, node.position.toArray()]); }); return found;
    };
    const geometry = (root: typeof central) => {
      const hash = createHash('sha256');
      visibleMeshes(root).forEach(mesh => Object.entries(mesh.geometry.attributes).forEach(([name, attribute]) => {
        const array = attribute.array;
        hash.update(name).update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
      }));
      return hash.digest('hex');
    };
    try {
      for (const region of REGIONS) {
        const root = entry.factory({ seed: 42, region });
        try {
          expect(root.userData).toMatchObject({ id, region, regionTier: entry.regionTier, footprint: central.userData.footprint, tiles: central.userData.tiles });
          if (entry.regionTier === 'R3') {
            expect(new Box3().setFromObject(root)).toEqual(new Box3().setFromObject(central));
            expect(geometry(root)).toEqual(geometry(central));
          }
          expect(anchors(root)).toEqual(anchors(central));
          expect(root.children.filter(node => node.name.startsWith('state_')).map(node => [node.name, node.visible]))
            .toEqual(central.children.filter(node => node.name.startsWith('state_')).map(node => [node.name, node.visible]));
        } finally { disposeModel(root); }
      }
    } finally { disposeModel(central); }
  });

  it('keeps the pavilion roof replaceable and grounds independently hideable', () => {
    for (const index of [0, 1, 2, 3]) {
      const id = `park.garden_${index}`, root = registry[id].factory();
      try {
        expect(root.getObjectByName(`${id}/ground`)).toBeDefined();
        if (index === 2) expect(root.getObjectByName(`${id}/roof`)?.userData.role).toBe('replaceable-regional-roof');
        if (index === 1) expect(root.children.filter(node => node.name.startsWith('anchor_light_'))).toHaveLength(4);
      } finally { disposeModel(root); }
    }
  });

  it('places the fountain anchor at the start of the water jet and keeps only the selected state visible', () => {
    const on = registry['park.fountain'].factory({ state: 'on' }), off = registry['park.fountain'].factory({ state: 'off' });
    try {
      const tip = on.getObjectByName('anchor_water_0')!.position;
      expect(tip.z).toBeGreaterThan(0); expect(tip.y).toBeGreaterThan(2.5);
      const water = visibleMeshes(on).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'water_river')!;
      const position = water.geometry.getAttribute('position');
      let nearest = Infinity;
      for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, new Vector3().fromBufferAttribute(position, i).distanceTo(tip));
      expect(nearest).toBeLessThan(0.06);
      expect(countTriangles(on)).toBeGreaterThan(countTriangles(off));
      expect(on.getObjectByName('state_off')?.visible).toBe(false); expect(off.getObjectByName('state_on')?.visible).toBe(false);
      expect(off.getObjectByName('anchor_water_0')?.position).toEqual(tip);
    } finally { disposeModel(on); disposeModel(off); }
  });

  it('caches polished stone and bamboo finishes within the material library', () => {
    expect(polishedStone()).toBe(polishedStone()); expect(bambooCulmMaterial()).toBe(bambooCulmMaterial());
    expect(polishedStone().roughness).toBeLessThan(0.3);
    expect(isLibraryMaterial(polishedStone())).toBe(true); expect(isLibraryMaterial(bambooCulmMaterial())).toBe(true);
  });
});

describe('regional vegetation mixes', () => {
  const expected = {
    north: ['teak', 'pine', 'bamboo', 'mango', 'rain_tree'],
    northeast: ['tamarind', 'eucalyptus', 'sugar_palm', 'mango', 'bamboo'],
    central: ['mango', 'banana', 'coconut', 'rain_tree', 'bamboo'],
    east: ['durian', 'coconut', 'mango', 'mangrove'],
    west: ['sugar_palm', 'teak', 'bamboo', 'mango'],
    south: ['rubber', 'oil_palm', 'coconut', 'mangrove'],
  };
  it.each(REGIONS)('%s contains the requested species with usable weights and coastal restrictions', region => {
    const mix = vegetationMix(region);
    expect(mix.map(tree => tree.id)).toEqual(expected[region].map(kind => `veg.${kind}`));
    expect(mix.reduce((total, tree) => total + tree.weight, 0)).toBe(100);
    mix.forEach(tree => { expect(tree.weight).toBeGreaterThan(0); expect(registry[tree.id]).toBeDefined(); expect(Boolean(tree.nearWaterOnly)).toBe(tree.id === 'veg.mangrove'); });
    expect(Object.isFrozen(mix)).toBe(true);
    if (region === 'north') expect(mix.find(tree => tree.id === 'veg.pine')!.weight).toBeLessThan(10);
    mix.filter(tree => tree.id === 'veg.rubber' || tree.id === 'veg.eucalyptus').forEach(tree => {
      expect(tree.placement).toBe('rows');
      const root = registry[tree.id].factory();
      try { expect(root.userData.placement).toBe('rows'); } finally { disposeModel(root); }
    });
  });
  it('defaults to central and shares immutable entries', () => { expect(vegetationMix()).toBe(vegetationMix('central')); expect(vegetationMix().every(Object.isFrozen)).toBe(true); });
});
