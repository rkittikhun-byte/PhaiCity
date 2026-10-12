/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Color, Group, InstancedMesh, Material, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { registry } from '../../src/render3d/models/registry.js';
import { STADIUM_LIGHT_HEADS } from '../../src/render3d/models/services/stadium.js';
import { getRegionKit, REGIONS } from '../../src/render3d/regional/index.js';
import { isLibraryMaterial, setNightMode } from '../../src/render3d/materials/library.js';
import { countDrawCalls, countTriangles, disposeModel, visibleBounds, visibleMeshes } from '../../src/render3d/util/geometry.js';
import { TileSnapshot, prototypeKey } from '../../src/render3d/city/tileModels.js';
import { TestCity } from '../../src/render3d/city/test-city.js';
import { serializeModel } from '../../src/render3d/city/model-serialization.js';
import { decodePrototype } from '../../src/render3d/city/prototypes.js';

const ids = ['svc.police', 'svc.fire', 'svc.stadium'];
const shape = (root: Group) => visibleMeshes(root).map(mesh => ({
  positions: Array.from(mesh.geometry.getAttribute('position').array),
  ...(mesh instanceof InstancedMesh ? { instances: Array.from(mesh.instanceMatrix.array), colors: Array.from(mesh.instanceColor!.array) } : {}),
}));

describe('service building contracts', () => {
  it('registers the complete police, fire and both stadium tile footprints without conflicts', () => {
    expect(registry['svc.police'].tiles).toEqual(Array.from({ length: 9 }, (_, i) => 770 + i));
    expect(registry['svc.fire'].tiles).toEqual(Array.from({ length: 9 }, (_, i) => 761 + i));
    expect(registry['svc.stadium'].tiles).toEqual(Array.from({ length: 32 }, (_, i) => 779 + i));
    expect(registry['svc.stadium'].states).toEqual(['empty', 'game']);
  });

  for (const id of ids) for (const region of REGIONS) for (const state of registry[id].states ?? [undefined]) {
    it(`${id}/${region}/${state ?? 'default'} fits its lot, budgets and library material batches`, () => {
      const root = registry[id].factory({ region, state, seed: 42 });
      try {
        const bounds = new Box3().setFromObject(root), half = registry[id].footprint[0] * 5 - 0.5;
        expect([bounds.min.x, bounds.min.z]).toEqual([-half, -half]);
        expect([bounds.max.x, bounds.max.z]).toEqual([half, half]);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01); expect(bounds.max.y).toBeLessThan(150);
        expect(countTriangles(root)).toBeLessThanOrEqual(registry[id].budget);
        expect(countDrawCalls(root)).toBeLessThanOrEqual(8);
        expect(root.userData).toMatchObject({ id, region, regionTier: registry[id].regionTier,
          footprint: [...registry[id].footprint], tiles: [...registry[id].tiles], triangles: countTriangles(root) });
        const materials = new Set<Material>();
        visibleMeshes(root).forEach(mesh => {
          const material = mesh.material as Material;
          expect(isLibraryMaterial(material)).toBe(true); expect(materials.has(material)).toBe(false);
          expect(mesh.name.startsWith(`${id}/`)).toBe(true); materials.add(material);
          expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        });
      } finally { disposeModel(root); }
    });
  }

  it.each(['svc.police', 'svc.fire'])('%s keeps R2 massing but uses kit roofs and palettes in every region', id => {
    const bodies: unknown[] = [], roofs: string[] = [];
    for (const region of REGIONS) {
      const kit = getRegionKit(region), a = registry[id].factory({ region, seed: 73 }), b = registry[id].factory({ region, seed: 73 });
      try {
        expect(shape(a)).toEqual(shape(b));
        expect(a.userData.palette).toEqual(kit.services.palette(id === 'svc.police' ? 'police' : 'fire', 73));
        expect(a.userData.roofForm).toBe(kit.services.roofForm);
        expect(a.userData.roofOrnament).toBe(kit.services.ornament);
        bodies.push(a.userData.structuralBodies); roofs.push(a.userData.roofForm);
        const role = id === 'svc.police' ? 'white-striped-patrol-car' : 'red-fire-engine';
        expect(a.userData.components.filter((c: { role: string }) => c.role === role)).toHaveLength(2);
        if (id === 'svc.police') {
          expect(a.userData.components.filter((c: { role: string }) => c.role === 'police-motorbike')).toHaveLength(2);
          expect(a.userData.components.find((c: { role: string }) => c.role === 'Thai-national-flag')).toBeDefined();
          expect(a.userData.signText).toBe('สถานีตำรวจ');
        } else {
          expect(a.userData.components.find((c: { role: string }) => c.role === 'training-yard')).toBeDefined();
          expect(a.userData.trainingFloors).toBe(5); expect(a.userData.signText).toBe('สถานีดับเพลิง');
        }
        expect(visibleMeshes(a).some(mesh => (mesh.material as Material).userData.signAtlas)).toBe(true);
      } finally { disposeModel(a); disposeModel(b); }
    }
    bodies.forEach(body => expect(body).toEqual(bodies[0]));
    expect(roofs).toEqual(['gable', 'gable', 'layeredGable', 'layeredGable', 'layeredGable', 'hip']);
  });

  it('shows a seeded full crowd, 22 figures and emissive lights only in the match state', () => {
    const empty = registry['svc.stadium'].factory(), game = registry['svc.stadium'].factory({ state: 'game', seed: 73 });
    const repeat = registry['svc.stadium'].factory({ state: 'game', seed: 73 });
    try {
      expect(shape(game)).toEqual(shape(repeat));
      expect(visibleMeshes(empty).some(mesh => mesh instanceof InstancedMesh)).toBe(false);
      const dots = game.getObjectByName('svc.stadium/crowd') as InstancedMesh;
      expect(dots).toBeInstanceOf(InstancedMesh); expect(dots.count).toBe(336);
      expect(Array.from(dots.geometry.getAttribute('color').array).every(value => value === 1)).toBe(true);
      expect(new Set(Array.from(dots.instanceColor!.array)).size).toBeGreaterThan(6);
      expect(game.getObjectByName('state_game')!.userData).toMatchObject({ players: 22, crowd: 336, lightsOn: true });
      expect(empty.getObjectByName('state_empty')!.userData).toMatchObject({ players: 0, crowd: 0, lightsOn: false });
      expect(game.children.filter(group => group.name.startsWith('state_') && group.visible).map(group => group.name)).toEqual(['state_game']);
      expect(empty.children.filter(group => group.name.startsWith('state_') && group.visible).map(group => group.name)).toEqual(['state_empty']);
      const light = visibleMeshes(game).map(mesh => mesh.material as MeshStandardMaterial).find(material => material.userData.stadiumFloodlight)!;
      for (const night of [true, false]) { setNightMode(night); expect(light.emissiveIntensity).toBe(4); expect(light.emissive.getHex()).not.toBe(0); }
      expect(visibleMeshes(empty).some(mesh => (mesh.material as Material).userData.stadiumFloodlight)).toBe(false);
      for (const root of [empty, game]) STADIUM_LIGHT_HEADS.forEach((position, i) => {
        const anchor = root.getObjectByName(`anchor_light_${i}`)!;
        expect(anchor.position.toArray()).toEqual([...position]); expect(anchor).not.toBeInstanceOf(Mesh); expect(anchor.children).toHaveLength(0);
      });
      expect(game.userData).toMatchObject({ foodStalls: 2, parkingCars: 4, coveredGrandstands: 2 });
    } finally { setNightMode(false); [empty, game, repeat].forEach(disposeModel); }
  });

  it.each(['empty', 'game'])('keeps the complete %s stadium and instance colors after a worker round trip', state => {
    const root = registry['svc.stadium'].factory({ state, seed: 73 }), decoded = new Group();
    try {
      const { value, transfer } = serializeModel('stadium', root), prototype = decodePrototype(value);
      prototype.parts.forEach(part => decoded.add(new Mesh(part.geometry, part.material)));
      expect(countTriangles(decoded)).toBe(countTriangles(root)); expect(countDrawCalls(decoded)).toBe(countDrawCalls(root));
      expect(visibleBounds(decoded)).toEqual(visibleBounds(root));
      expect(transfer.every(buffer => buffer.byteLength > 0)).toBe(true);
      const crowd = prototype.parts.find(part => part.material.userData.stadiumCrowd);
      if (state === 'game') {
        expect(crowd).toBeDefined();
        expect(crowd!.castShadow).toBe(false); expect(crowd!.receiveShadow).toBe(false);
        const dots = root.getObjectByName('svc.stadium/crowd') as InstancedMesh, matrix = new Matrix4(), color = new Color();
        dots.getMatrixAt(0, matrix); dots.getColorAt(0, color);
        const positions = crowd!.geometry.getAttribute('position'), colors = crowd!.geometry.getAttribute('color');
        expect(colors.count).toBe(336 * 60); expect(colors.getX(0)).toBeCloseTo(color.r);
        expect(positions.getX(0)).toBeCloseTo(dots.geometry.getAttribute('position').getX(0) + matrix.elements[12]);
        expect(prototype.parts.find(part => part.material.userData.stadiumFloodlight)!.material.emissiveIntensity).toBe(4);
      } else expect(crowd).toBeUndefined();
    } finally { disposeModel(root); disposeModel(decoded); }
  });

  it('resolves service centres once, covers all 16 stadium cells and changes the prototype on match start', () => {
    const city = new TestCity(), snapshot = new TileSnapshot(200, 200); snapshot.sync(city);
    for (const [x, y, id] of [[76, 53, 'svc.fire'], [82, 53, 'svc.police'], [139, 52, 'svc.stadium'], [154, 59, 'svc.stadium']] as const)
      expect(snapshot.placement(y * 200 + x, 'north')!.id).toBe(id);
    const index = 52 * 200 + 139, empty = snapshot.placement(index, 'north')!;
    expect(empty.options.state).toBe('empty');
    city.zone(139, 52, 800, 4); snapshot.sync(city);
    const game = snapshot.placement(index, 'north')!;
    expect(game.options.state).toBe('game'); expect(prototypeKey(game)).not.toBe(prototypeKey(empty));
    let buildings = 0;
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
      const tile = (52 + dy) * 200 + 139 + dx;
      expect(snapshot.coverage[tile]).toBe(index); if (snapshot.placement(tile, 'north')) buildings++;
    }
    expect(buildings).toBe(1);
  });
});
