/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Group, Material, Raycaster, Vector3, WebGLRenderer } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { COM_ZONE_SPECS } from '../../src/render3d/models/commercial/zones.js';
import { animateCommercialModels, LANDMARK_ANCHORS, PixelVoid } from '../../src/render3d/models/commercial/landmarks.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { commercialLEDMaterial, updateCommercialDisplays, isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { countTriangles, countDrawCalls, visibleMeshes, disposeModel } from '../../src/render3d/util/geometry.js';

const specs = COM_ZONE_SPECS.filter(s => s.landValue >= 2);
describe('Prompt 11 premium commercial zones', () => {
  it('continues all ten centers / tile ranges and registers all landmark variants', () => {
    expect(specs).toHaveLength(10); expect(specs.map(s => s.center)).toEqual([526, 535, 544, 553, 562, 571, 580, 589, 598, 607]);
    specs.forEach(spec => { expect(registry[spec.id].tiles).toEqual(Array.from({ length: 9 }, (_, n) => spec.center - 4 + n));
      expect(spec.regionTier).toBe(['com.block_2_0', 'com.block_3_1'].includes(spec.id) ? 'R2' : 'R3'); });
    expect(registry['com.block_3_4'].variants).toEqual([0, 1, 2]);
  });
  for (const spec of specs) it.each(REGIONS)(`${spec.id}: fits its full lot and budget in %s`, region => {
    const root = registry[spec.id].factory({ region, seed: 42 });
    try {
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeCloseTo(-14.5, 3); expect(bounds.max.x).toBeCloseTo(14.5, 3);
      expect(bounds.min.z).toBeCloseTo(-14.5, 3); expect(bounds.max.z).toBeCloseTo(14.5, 3);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThanOrEqual(150);
      expect(countTriangles(root)).toBeLessThanOrEqual(spec.budget); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
      expect(root.userData.triangles).toBe(countTriangles(root));
      (root.userData.floorSpacing as number[]).forEach(step => expect(step).toBeGreaterThanOrEqual(3.5));
      visibleMeshes(root).forEach(mesh => expect(isLibraryMaterial(mesh.material as Material)).toBe(true));
    } finally { disposeModel(root); }
  });
  it('uses identical R2 structural geometry and deterministic, bounded curved roof kit builders', () => {
    for (const id of ['com.block_2_0', 'com.block_3_1']) {
      const bodies = REGIONS.map(region => { const root = registry[id].factory({ region });
        try { return root.userData.structuralBodies; } finally { disposeModel(root); } });
      bodies.slice(1).forEach(b => expect(b).toEqual(bodies[0]));
    }
    for (const region of REGIONS) {
      const kit = getRegionKit(region), a = kit.curvedRoof([8, 8.2], { baseY: 7.8, seed: 42 }), b = kit.curvedRoof([8, 8.2], { baseY: 7.8, seed: 42 });
      try {
        expect(a.length).toBe(b.length); const bounds = new Box3(); let triangles = 0;
        a.forEach((part, i) => {
          expect(isLibraryMaterial(part.material)).toBe(true);
          expect(Array.from(part.geometry.getAttribute('position').array)).toEqual(Array.from(b[i].geometry.getAttribute('position').array));
          part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!);
          triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3;
        });
        expect(triangles).toBeLessThanOrEqual(3000); expect(bounds.min.x).toBeGreaterThanOrEqual(-4.5); expect(bounds.max.x).toBeLessThanOrEqual(4.5);
        expect(() => kit.curvedRoof([0, 8])).toThrow(RangeError);
      } finally { [...a, ...b].forEach(p => p.geometry.dispose()); }
    }
  });
  it('includes big trees, LED screen, fins, podium, pool, display cars and event plaza', () => {
    const expected: Record<string, object> = {
      'com.block_2_0': { glassTimberPavilion: true, outdoorTables: 4, bigTrees: 3 },
      'com.block_2_1': { floors: 3, LEDScreen: true, glassFacade: true },
      'com.block_2_2': { floors: 12, verticalSunFins: 22, glassColor: 'blue-green' },
      'com.block_2_3': { floors: 20, roomBalconies: 190, rooftopPool: true },
      'com.block_2_4': { floors: 30, podiumFloors: 4, setBackTower: true, topCompanySign: true },
      'com.block_3_0': { floors: 2, glassBox: true, displayCars: 6, vehicleLogos: false },
      'com.block_3_1': { curvedRoofs: 3, fountainPlaza: true, bigTrees: 2 },
      'com.block_3_2': { floors: 25, chamferedCorners: 2.4, tallLobbyHeight: 7.5 },
      'com.block_3_3': { floors: 6, perforatedMetalPanels: 40, eventPlaza: true, eventSeats: 10 },
    };
    for (const [id, metadata] of Object.entries(expected)) { const root = registry[id].factory();
      try { expect(root.userData).toMatchObject(metadata); } finally { disposeModel(root); } }
  });
  it('has actually chamfered office corners and actual holes through the perforated metal facade', () => {
    const office = registry['com.block_3_2'].factory(), store = registry['com.block_3_3'].factory();
    try {
      office.updateMatrixWorld(true); store.updateMatrixWorld(true);
      const corner = new Raycaster(new Vector3(9.3, 100, 5.2), new Vector3(0, -1, 0));
      expect(corner.intersectObjects(visibleMeshes(office))[0].point.y).toBeLessThan(1);
      const metal = visibleMeshes(store).find(mesh => (mesh.material as Material).userData.materialKey === 'metal_painted')!;
      const insideHole = new Raycaster(new Vector3(-10.83, 5.08, 8), new Vector3(0, 0, -1));
      expect(insideHole.intersectObject(metal)).toHaveLength(0);
      const onEdge = new Raycaster(new Vector3(-11.5, 5.6, 8), new Vector3(0, 0, -1));
      expect(onEdge.intersectObject(metal).length).toBeGreaterThan(0);
    } finally { disposeModel(office); disposeModel(store); }
  });
  it.each([0, 1, 2])('landmark %i keeps height, tile value, footprint and common anchors', variant => {
    const root = registry['com.block_3_4'].factory({ variant });
    try {
      expect(root.userData.floors).toBe(variant === 1 ? 38 : 40); expect(root.userData.originalPromptFloors).toBe(60);
      expect(root.userData.ownerApprovedApproximateFloors).toBe(40); expect(root.userData.floorSpacing).toEqual([4, 3.5]);
      expect(root.userData.footprint).toEqual([3, 3]); expect(root.userData.centerTile).toBe(607);
      expect(new Box3().setFromObject(root).max.y).toBeLessThanOrEqual(150);
      expect(new Box3().setFromObject(root).max.y).toBeGreaterThan(148);
      expect(countTriangles(root)).toBeLessThanOrEqual(15000); expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
      for (const [name, xyz] of Object.entries(LANDMARK_ANCHORS)) expect(root.getObjectByName(name)!.position.toArray()).toEqual(xyz);
      expect(root.userData.components.reduce((n: number, c: { triangles: number }) => n + c.triangles, 0)).toBe(countTriangles(root));
    } finally { disposeModel(root); }
  });
  it('rotates the observation ring about its real pivot without moving tower geometry', () => {
    const root = registry['com.block_3_4'].factory({ variant: 1 });
    try {
      const deck = root.getObjectByName('anim_deck') as Group; expect(deck).toBeInstanceOf(Group);
      expect(deck.position.toArray()).toEqual([0, 127.5, -2]);
      for (const mesh of visibleMeshes(deck)) {
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeGreaterThan(Math.sqrt(2) * 6.4);
        }
      }
      const body = root.children.find(child => child.name.includes('glass_tinted'))!, matrix = body.matrix.clone();
      animateCommercialModels([root], 22.5); expect(deck.rotation.y).toBeCloseTo(Math.PI / 2, 8);
      expect(body.matrix).toEqual(matrix); expect(deck.position.toArray()).toEqual([0, 127.5, -2]);
      expect(new Box3().setFromObject(root).max.x).toBeLessThanOrEqual(14.501);
      animateCommercialModels([root], NaN); expect(deck.rotation.y).toBeCloseTo(Math.PI / 2, 8);
    } finally { disposeModel(root); }
  });
  it('carves a spiral of real facade voids, with recessed balcony floors behind the missing glass', () => {
    const root = registry['com.block_3_4'].factory({ variant: 2 });
    try {
      root.updateMatrixWorld(true); const voids = root.userData.pixelVoids as PixelVoid[];
      expect(voids).toHaveLength(66); expect(new Set(voids.map(v => v.side)).size).toBe(4);
      const hole = voids.find(v => v.floor === 7 && v.side === 0 && v.column === 2)!;
      const origin = new Vector3(...hole.center as [number, number, number]).add(new Vector3(0, 0, 3));
      const ray = new Raycaster(origin, new Vector3(0, 0, -1)), hits = ray.intersectObjects(visibleMeshes(root));
      expect(hits[0].distance).toBeGreaterThan(7);
      const intact = new Raycaster(new Vector3(-8.25, hole.center[1], hole.center[2] + 3), new Vector3(0, 0, -1));
      expect(intact.intersectObjects(visibleMeshes(root))[0].distance).toBeCloseTo(3, 3);
    } finally { disposeModel(root); }
  });
  it('caches the LED material and drives an abstract display shader with a shared clock', () => {
    const material = commercialLEDMaterial(); expect(material).toBe(commercialLEDMaterial()); expect(isLibraryMaterial(material)).toBe(true);
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <emissivemap_fragment>' } as Parameters<typeof material.onBeforeCompile>[0];
    try {
      material.onBeforeCompile(shader, {} as WebGLRenderer); updateCommercialDisplays(12.5);
      expect(shader.uniforms.commercialTime.value).toBe(12.5); expect(shader.fragmentShader).toContain('displayUV');
      expect(shader.fragmentShader).toContain('smoothstep(0.34, 0.47'); updateCommercialDisplays(Infinity);
      expect(shader.uniforms.commercialTime.value).toBe(12.5);
    } finally { updateCommercialDisplays(0); }
  });
});
