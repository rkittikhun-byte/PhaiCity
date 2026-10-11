/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, CircleGeometry, Group, LatheGeometry, Material, Matrix4, Mesh, Object3D, Vector2, Vector3 } from 'three';
import { getMaterial, polishedStone, tint } from '../../materials/library.js';
import { applyWorldUV, beveledBox, countTriangles, mergeByMaterial } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { PlantBuilder, point } from './builder.js';
import { TreeKind, treeParts } from './trees.js';

export const PARK_IDS = ['park.garden_0', 'park.garden_1', 'park.garden_2', 'park.garden_3', 'park.fountain'] as const;
export const PARK_TILES = [[40], [41], [42], [43], [840, 841, 842, 843]] as const;

function box(b: PlantBuilder, size: Vector3, center: Vector3, material: Material, bevel = false): void {
  const source = bevel ? beveledBox(size.x, size.y, size.z, Math.min(0.035, Math.min(size.x, size.y, size.z) / 5)) : new BoxGeometry(size.x, size.y, size.z);
  source.translate(center.x, center.y, center.z);
  const geometry = applyWorldUV(source, 1); if (geometry !== source) source.dispose(); b.add(geometry, material);
}

function tree(b: PlantBuilder, kind: TreeKind, options: ModelOptions, seedOffset: number, center: Vector3, scale: number, density: number): void {
  const parts = treeParts(kind, { ...options, seed: (options.seed ?? 1) + seedOffset, density });
  const transform = new Matrix4().makeTranslation(center.x, center.y, center.z).multiply(new Matrix4().makeScale(scale, scale, scale));
  parts.parts.forEach(part => { part.geometry.applyMatrix4(transform); b.parts.push(part); });
  b.leafCards += parts.leafCards;
}

function ground(b: PlantBuilder): void { box(b, point(9, 0.12, 9), point(0, 0.06, 0), tint('grass', 0x7acb88)); }

function bench(b: PlantBuilder, x: number, z: number): void {
  const marble = polishedStone();
  box(b, point(2.15, 0.22, 0.6), point(x, 0.64, z), marble, true);
  for (const dx of [-0.72, 0.72]) box(b, point(0.3, 0.45, 0.48), point(x + dx, 0.34, z), marble, true);
}

function garden0(b: PlantBuilder, options: ModelOptions): void {
  ground(b); tree(b, 'rain_tree', options, 0, point(0, 0.12, -0.1), 0.47, 0.45);
  bench(b, -2.4, 3.1); bench(b, 2.4, 3.1);
  const brick = getMaterial('brick_red');
  box(b, point(9, 0.08, 0.9), point(0, 0.16, 2.05), brick);
  box(b, point(0.9, 0.08, 2.5), point(0, 0.16, 3.2), brick);
}

function garden1(b: PlantBuilder, options: ModelOptions): Vector3[] {
  ground(b); tree(b, 'bamboo', options, 0, point(-1.85, 0.12, -0.2), 0.44, 0.42);
  tree(b, 'bamboo', options, 97, point(1.85, 0.12, -0.2), 0.44, 0.42);
  const gravel = getMaterial('gravel_ballast');
  box(b, point(1.25, 0.08, 9), point(0, 0.16, 0), gravel);
  box(b, point(9, 0.08, 0.85), point(0, 0.16, 2.5), gravel);
  const metal = tint('metal_steel', 0x3a4943), light = getMaterial('emissive_window'), anchors: Vector3[] = [];
  for (const x of [-1, 1]) for (const z of [-2.5, 3.2]) {
    b.pole(point(x, 0.12, z), point(x, 1.85, z), 0.045, metal);
    box(b, point(0.36, 0.08, 0.36), point(x, 1.99, z), metal);
    box(b, point(0.22, 0.22, 0.22), point(x, 1.84, z), light);
    anchors.push(point(x, 1.84, z));
  }
  return anchors;
}

function garden2(b: PlantBuilder, options: ModelOptions): void {
  ground(b); const wood = tint('wood_teak', 0x68513c), roof = getMaterial('roof_clay_tile');
  const roofWood = tint('wood_teak', 0x755942);
  box(b, point(4.3, 0.22, 4.1), point(0, 0.5, -0.4), wood, true);
  for (const x of [-1.8, 1.8]) for (const z of [-2.05, 1.25]) b.pole(point(x, 0.12, z), point(x, 3.95, z), 0.105, wood, 8);
  for (const z of [-2.05, 1.25]) box(b, point(3.6, 0.2, 0.18), point(0, 3.85, z), wood);
  for (const x of [-1.8, 1.8]) {
    box(b, point(0.18, 0.2, 3.6), point(x, 3.85, -0.4), wood);
    box(b, point(0.14, 0.13, 3.3), point(x, 1.25, -0.4), wood);
    for (let i = 0; i < 7; i++) box(b, point(0.07, 0.58, 0.07), point(x, 0.95, -1.8 + i * 0.45), wood);
  }
  for (const x of [-1.25, 1.25]) box(b, point(0.45, 0.16, 2.5), point(x, 0.83, -0.5), wood);
  box(b, point(2, 0.18, 0.7), point(0, 0.21, 1.9), wood);
  box(b, point(2, 0.18, 0.65), point(0, 0.39, 1.65), wood);
  for (const side of [-1, 1]) {
    const slab = beveledBox(3.45, 0.18, 4.75, 0.035);
    slab.rotateZ(side * -0.72).translate(side * 1.3, 4.42, -0.4); b.add(slab, roof);
  }
  // Plain gable frames and king posts, kept with the replaceable roof.
  for (const z of [-2.68, 1.88]) {
    for (const side of [-1, 1]) b.pole(point(side * 2.57, 3.25, z), point(0, 5.51, z), 0.065, roofWood);
    b.pole(point(-1.8, 3.89, z), point(1.8, 3.89, z), 0.065, roofWood);
    b.pole(point(0, 3.89, z), point(0, 5.51, z), 0.065, roofWood);
  }
  tree(b, 'bougainvillea', options, 0, point(0, 0.12, 2.9), 0.62, 0.45);
}

function garden3(b: PlantBuilder, options: ModelOptions): void {
  ground(b); tree(b, 'coconut', options, 0, point(-2.2, 0.12, -2.1), 0.34, 0.35);
  tree(b, 'coconut', options, 83, point(2.2, 0.12, -2.1), 0.34, 0.35);
  const orange = tint('metal_painted', 0xeab14e), blue = tint('metal_painted', 0x65a1ab);
  const steel = getMaterial('metal_steel'), rubber = tint('fabric_canvas', 0x6e8274);
  box(b, point(7.4, 0.06, 4.3), point(0, 0.15, 1.65), rubber);
  // Two-seat swing: A frames, crossbeam, hanging chains and flat seats.
  for (const x of [-3.45, -0.95]) for (const dz of [-0.65, 0.65]) b.pole(point(x, 0.18, 1.25 + dz), point(x, 2.4, 1.25), 0.055, orange);
  b.pole(point(-3.6, 2.4, 1.25), point(-0.8, 2.4, 1.25), 0.065, orange);
  for (const x of [-2.85, -1.6]) {
    box(b, point(0.62, 0.09, 0.34), point(x, 0.7, 1.25), blue);
    for (const dx of [-0.25, 0.25]) b.pole(point(x + dx, 0.72, 1.25), point(x + dx, 2.35, 1.25), 0.018, steel, 4);
  }
  // Slide, ladder and handles.
  const slide = new BoxGeometry(0.8, 0.07, 2.5).rotateX(0.5).translate(1.35, 0.9, 2.15);
  b.add(applyWorldUV(slide, 1), blue); slide.dispose();
  for (const x of [0.95, 1.75]) {
    b.pole(point(x, 0.18, 1.1), point(x, 1.85, 1.1), 0.045, orange);
    b.pole(point(x, 1.55, 1.3), point(x, 1.8, 1.3), 0.035, orange);
  }
  for (let rung = 0; rung < 5; rung++) b.pole(point(0.95, 0.38 + rung * 0.28, 1.1), point(1.75, 0.38 + rung * 0.28, 1.1), 0.028, steel, 4);
  // Outdoor exercise: parallel bars and an inclined sit-up bench.
  for (const z of [-0.05, 0.75]) {
    for (const x of [2.65, 3.7]) b.pole(point(x, 0.18, z), point(x, 1.3, z), 0.045, blue);
    b.pole(point(2.65, 1.3, z), point(3.7, 1.3, z), 0.055, blue);
  }
  const exercise = new BoxGeometry(0.6, 0.12, 1.65).rotateX(-0.17).translate(3, 0.63, 2.65);
  b.add(applyWorldUV(exercise, 1), orange); exercise.dispose();
  for (const z of [2.1, 3.2]) b.pole(point(3, 0.18, z), point(3, 0.62, z), 0.06, blue);
}

function fountain(b: PlantBuilder): { water: PlantBuilder; jet: PlantBuilder; tip: Vector3 } {
  ground(b); const stone = polishedStone(0xdadbd2), elephant = polishedStone(0x8a9590), ivory = polishedStone(0xe9e0c8);
  const profile = [new Vector2(0, 0.2), new Vector2(3.05, 0.2), new Vector2(3.35, 0.4),
    new Vector2(3.35, 0.85), new Vector2(3.12, 0.91), new Vector2(2.9, 0.75), new Vector2(2.85, 0.32), new Vector2(0, 0.32)];
  const basin = new LatheGeometry(profile, 28); b.add(applyWorldUV(basin, 1), stone); basin.dispose();
  b.pole(point(0, 0.3, 0), point(0, 0.78, 0), 0.92, stone, 20);
  b.ellipsoid(point(0, 2.05, 0), point(0.7, 0.65, 0.98), elephant, 12, 8);
  b.ellipsoid(point(0, 2.63, 0.85), point(0.5, 0.57, 0.54), elephant, 10, 8);
  for (const x of [-0.44, 0.44]) for (const z of [-0.55, 0.52]) {
    b.pole(point(x, 0.77, z), point(x, 1.83, z), 0.19, elephant, 8);
    b.ellipsoid(point(x, 0.85, z + 0.04), point(0.23, 0.15, 0.26), elephant, 6, 4);
  }
  for (const side of [-1, 1]) {
    b.ellipsoid(point(side * 0.57, 2.56, 0.55), point(0.43, 0.58, 0.13), elephant, 8, 6);
    b.ellipsoid(point(side * 0.34, 2.78, 1.23), point(0.06, 0.055, 0.05), tint('metal_steel', 0x283931), 6, 4);
    b.taper([point(side * 0.28, 2.32, 1.22), point(side * 0.38, 2.18, 1.52), point(side * 0.34, 2.45, 1.76)], 0.075, ivory, 4, 5);
  }
  const tip = point(0, 3.06, 1.96);
  b.taper([point(0, 2.56, 1.26), point(0, 2.16, 1.65), point(0, 2.44, 2.02), tip], 0.2, elephant, 12, 7);
  b.tube([point(0, 2.28, -0.9), point(0.16, 1.7, -1.18), point(0.12, 1.32, -1.16)], 0.035, elephant, 5, 4);
  const water = new PlantBuilder(), jet = new PlantBuilder(), material = tint('water_river', 0x79b8ce);
  const surface = new CircleGeometry(2.88, 32).rotateX(-Math.PI / 2).translate(0, 0.64, 0);
  water.add(applyWorldUV(surface, 1), material); surface.dispose();
  jet.tube([tip, point(0, 3.3, 2.35), point(0, 2.15, 2.9), point(0, 0.67, 2.88)], 0.052, material, 12, 5);
  for (let i = 0; i < 8; i++) jet.ellipsoid(point(Math.sin(i * 2.4) * 0.18, 0.73 + i % 3 * 0.08, 2.85 + Math.cos(i * 2.4) * 0.16), point(0.07, 0.13, 0.07), material, 5, 3);
  return { water, jet, tip };
}

export function createPark(index: number, options: ModelOptions = {}): Group {
  const b = new PlantBuilder(), id = PARK_IDS[index]; let lights: Vector3[] = [], waterJet: ReturnType<typeof fountain> | undefined;
  if (index === 0) garden0(b, options);
  else if (index === 1) lights = garden1(b, options);
  else if (index === 2) garden2(b, options);
  else if (index === 3) garden3(b, options);
  else waterJet = fountain(b);
  const root = b.finish(id, 'park', [1, 1], PARK_TILES[index], options);
  const roofPart = new Group(); roofPart.name = `${id}/roof`; roofPart.userData.role = 'replaceable-regional-roof';
  [...root.children].forEach(child => {
    if (child instanceof Mesh && !Array.isArray(child.material) && child.material.userData.materialKey === 'grass') child.name = `${id}/ground`;
    if (index === 2 && child instanceof Mesh && (child.material === getMaterial('roof_clay_tile') || child.material === tint('wood_teak', 0x755942))) {
      child.name = `${id}/${child.material === getMaterial('roof_clay_tile') ? 'roof_tiles' : 'roof_frame'}`;
      roofPart.add(child);
    }
  });
  if (index === 2) root.add(roofPart);
  lights.forEach((position, i) => { const anchor = new Object3D(); anchor.name = `anchor_light_${i}`; anchor.position.copy(position); root.add(anchor); });
  if (waterJet) {
    for (const state of ['on', 'off']) {
      const pieces = state === 'on' ? [...waterJet.water.parts, ...waterJet.jet.parts] : waterJet.water.parts;
      const group = mergeByMaterial(id, pieces); group.name = `state_${state}`;
      group.visible = state === (options.state === 'off' ? 'off' : 'on'); root.add(group);
    }
    [...waterJet.water.parts, ...waterJet.jet.parts].forEach(part => part.geometry.dispose());
    const anchor = new Object3D(); anchor.name = 'anchor_water_0'; anchor.position.copy(waterJet.tip); root.add(anchor);
  }
  root.userData.triangles = countTriangles(root);
  return root;
}
