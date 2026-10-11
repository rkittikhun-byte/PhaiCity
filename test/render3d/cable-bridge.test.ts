/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Group, Line, LineSegments, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { CABLE_PREVIEW_ID, cableBridgePreview, disposeCableBridgePreview } from '../../src/render3d/gallery/cable-bridge-preview.js';
import { isLibraryMaterial, setNightMode } from '../../src/render3d/materials/library.js';
import { registry } from '../../src/render3d/models/registry.js';
import { CABLE_BRIDGE, createCableBridge } from '../../src/render3d/models/road/cable-bridge.js';
import { createRoad } from '../../src/render3d/models/road/road.js';
import { REGIONS } from '../../src/render3d/regional/types.js';
import { countDrawCalls, countTriangles, disposeModel, visibleMeshes } from '../../src/render3d/util/geometry.js';

const cableAnchors = (root: Group): Record<string, number[]> => Object.fromEntries(root.children
  .filter(child => child.name.startsWith('anchor_cable_')).map(child => [child.name, child.position.toArray()]));

describe('Prompt 4B cable bridge tiles and renderer anchors', () => {
  it.each([false, true])('keeps the %s pylon flag inside one tile, with library batches and fixed regional geometry', pylon => {
    let expectedAnchors: Record<string, number[]> | undefined;
    for (const region of REGIONS) for (const seed of [0, 1, 4294967295]) {
      const root = createCableBridge(pylon, { seed, region });
      try {
        const bounds = new Box3().setFromObject(root), entry = registry[root.name];
        expect(entry.footprint).toEqual([1, 1]); expect(entry.regionTier).toBe('R3'); expect(entry.tiles).toEqual([]);
        expect(root.userData.region).toBe(region);
        expect(bounds.min.x).toBeCloseTo(-5, 5); expect(bounds.max.x).toBeCloseTo(5, 5);
        expect(bounds.min.z).toBeCloseTo(-5, 5); expect(bounds.max.z).toBeCloseTo(5, 5);
        expect(bounds.min.y).toBeCloseTo(pylon ? -3 : -0.35, 5);
        expect(bounds.max.y).toBeCloseTo(pylon ? 120 : 1.15, 5);
        expect(countTriangles(root)).toBeLessThanOrEqual(1500); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(root.userData.triangles).toBe(countTriangles(root));
        const materials = visibleMeshes(root).map(mesh => mesh.material as MeshStandardMaterial);
        expect(new Set(materials).size).toBe(materials.length); materials.forEach(material => expect(isLibraryMaterial(material)).toBe(true));
        root.traverse(object => { expect(object).not.toBeInstanceOf(Line); });
        const anchors = cableAnchors(root);
        if (!expectedAnchors) expectedAnchors = anchors;
        expect(anchors).toEqual(expectedAnchors);
      } finally { disposeModel(root); }
    }
  });

  it('exposes exactly two empty deck anchors and forty ordered mast anchors spanning 60–115 m', () => {
    const deck = createCableBridge(false), pylon = createCableBridge(true);
    try {
      expect(cableAnchors(deck)).toEqual({ anchor_cable_left: [-4.78, 0.93, 0], anchor_cable_right: [4.78, 0.93, 0] });
      expect(Object.keys(cableAnchors(pylon))).toHaveLength(40);
      for (const side of [0, 1]) for (let n = 0; n < 20; n++) {
        const anchor = pylon.getObjectByName(`anchor_cable_${side}_${n}`)!;
        expect(anchor.children).toHaveLength(0);
        expect(anchor.position.y).toBeCloseTo(60 + 55 * n / 19, 9);
        expect(Math.sign(anchor.position.x)).toBe(side ? 1 : -1);
        expect(Math.sign(anchor.position.z)).toBe(n % 2 ? 1 : -1);
      }
      expect(pylon.getObjectByName('anchor_light_0')!.position.y).toBeLessThanOrEqual(CABLE_BRIDGE.height);
    } finally { disposeModel(deck); disposeModel(pylon); }
  });

  it('matches the original bridge surface and world UVs at both ends and leaves traffic clearance below the fork', () => {
    const ordinary = createRoad('bridge', { worldOrigin: [10, 20] });
    const deck = createCableBridge(false, { worldOrigin: [10, 20] }), pylon = createCableBridge(true, { worldOrigin: [10, 20] });
    const samples = (root: Group, z: number): Record<string, number[]> => {
      const result: Record<string, number[]> = {};
      visibleMeshes(root).filter(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'concrete_raw').forEach(mesh => {
        const p = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv'), normal = mesh.geometry.getAttribute('normal');
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - z) < 0.0001 && Math.abs(p.getY(i)) < 0.0001 && normal.getY(i) > 0.99)
          result[`${p.getX(i)},${p.getY(i)}`] = [uv.getX(i), uv.getY(i)];
      }); return result;
    };
    try {
      for (const root of [deck, pylon]) {
        expect(root.userData.crossSection).toMatchObject({ tile: 10, carriageway: 7, sidewalk: 0 });
        root.updateMatrixWorld(true);
        for (const z of [-5, 5]) {
          expect(Object.keys(samples(ordinary, z)).length).toBeGreaterThan(0);
          expect(samples(root, z)).toEqual(samples(ordinary, z));
          for (const x of [-4.99, -3.5, 0, 3.5, 4.99]) {
            const hits = new Raycaster(new Vector3(x, 7, z * 0.9999), new Vector3(0, -1, 0)).intersectObjects(visibleMeshes(root), false);
            expect(hits[0].point.y).toBeCloseTo(0.004 * Number(x === 0), 5);
          }
        }
      }
      const crossing = new Raycaster(new Vector3(-3.5, 5, 0), new Vector3(1, 0, 0)).intersectObjects(visibleMeshes(pylon), false);
      expect(crossing.some(hit => hit.point.x < 3.5)).toBe(false);
    } finally { [ordinary, deck, pylon].forEach(disposeModel); }
  });

  it('keeps 64/65 mapped only to the ordinary bridge and does not register the multi-tile gallery assembly', () => {
    expect(Object.entries(registry).filter(([, entry]) => entry.tiles.some(tile => tile === 64 || tile === 65)).map(([id]) => id)).toEqual(['road.bridge']);
    expect(registry[CABLE_PREVIEW_ID]).toBeUndefined();
  });

  it('joins every deck anchor exactly once to the correct mast anchor in a 210 m gallery assembly', () => {
    const root = cableBridgePreview({ seed: 42, region: 'south', worldOrigin: [30, 50] });
    try {
      const tiles = root.children.filter(child => child instanceof Group) as Group[];
      expect(tiles).toHaveLength(21); expect(tiles.filter(tile => tile.name.endsWith('_pylon'))).toHaveLength(1);
      expect(tiles.map(tile => tile.position.z).sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, n) => (n - 10) * 10));
      const stays = root.getObjectByName('gallery/cable-stays') as LineSegments;
      expect(stays).toBeInstanceOf(LineSegments); expect(stays.geometry.getAttribute('position').count).toBe(80);
      const seen = new Set<string>(), mast = tiles.find(tile => tile.name.endsWith('_pylon'))!;
      root.updateMatrixWorld(true);
      stays.userData.pairs.forEach((pair: { mast: string; deckTile: number; deck: string }, i: number) => {
        const deck = tiles.find(tile => tile.position.z === pair.deckTile * 10)!;
        const uvOrigin = deck.userData.worldOrigin; expect(uvOrigin).toEqual([30, 50 + pair.deckTile * 10]);
        const p = stays.geometry.getAttribute('position');
        [mast.getObjectByName(pair.mast)!, deck.getObjectByName(pair.deck)!].forEach((anchor, end) => {
          const expected = anchor.getWorldPosition(new Vector3()), actual = new Vector3().fromBufferAttribute(p, i * 2 + end);
          expect(actual.distanceTo(expected)).toBeLessThan(0.00001);
        });
        const key = `${pair.deckTile}/${pair.deck}`; expect(seen.has(key)).toBe(false); seen.add(key);
      });
      expect(seen.size).toBe(40);
      const bounds = new Box3().setFromObject(root); expect(bounds.min.z).toBe(-105); expect(bounds.max.z).toBe(105);
    } finally { disposeCableBridgePreview(root); }
  });

  it('lights the crown and both continuous deck strips at night using the shared library material', () => {
    const root = createCableBridge(true);
    try {
      const lights = visibleMeshes(root).find(mesh => (mesh.material as MeshStandardMaterial).userData.materialKey === 'emissive_window')!;
      const material = lights.material as MeshStandardMaterial;
      setNightMode(false); const daytime = material.emissiveIntensity;
      setNightMode(true); expect(material.emissiveIntensity).toBeGreaterThan(daytime * 5);
      const p = lights.geometry.getAttribute('position');
      expect(Array.from({ length: p.count }, (_, i) => p.getY(i)).some(y => y === 120)).toBe(true);
      for (const side of [-1, 1]) for (const z of [-5, 5]) expect(Array.from({ length: p.count }, (_, i) =>
        p.getX(i) * side > 4.87 && p.getX(i) * side < 5 && p.getZ(i) === z && p.getY(i) < 1.15).some(Boolean)).toBe(true);
    } finally { setNightMode(false); disposeModel(root); }
  });

  it('frees the assembly stay buffers and material once while retaining library materials', () => {
    const root = cableBridgePreview(), stays = root.getObjectByName('gallery/cable-stays') as LineSegments;
    const geometry = jest.spyOn(stays.geometry, 'dispose'), material = jest.spyOn(stays.material as MeshStandardMaterial, 'dispose');
    const shared = visibleMeshes(root)[0].material as MeshStandardMaterial, retained = jest.spyOn(shared, 'dispose');
    disposeCableBridgePreview(root);
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1); expect(retained).not.toHaveBeenCalled();
    [geometry, material, retained].forEach(spy => spy.mockRestore());
  });
});
