/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, CircleGeometry, Float32BufferAttribute, PlaneGeometry, RingGeometry } from 'three';
import { contaminationGlow, getMaterial, paintedSteel, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { createWoods } from './forest.js';
import { horizontal, TerrainBuilder } from './helpers.js';
import { createWater } from './water.js';

export const TERRAIN_KINDS = ['dirt', 'water', 'shore', 'woods', 'rubble', 'flood', 'radiation'] as const;
export type TerrainKind = typeof TERRAIN_KINDS[number];
export const TERRAIN_TILES: Record<TerrainKind, readonly number[]> = {
  dirt: [0], water: [2, 3, 4], shore: [], woods: Array.from({ length: 19 }, (_, i) => i + 21),
  rubble: [44, 45, 46, 47], flood: [48, 49, 50, 51], radiation: [52],
};
export const FLOOD_LEVELS = [0.4, 0.36, 0.44, 0.48] as const;

function createDirt(options: ModelOptions) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed), variant = (options.variant ?? 0) & 3;
  // state 'grass': the open land of a real-scale city map, a meadow rather than laterite (src/render3d/city/tileModels.ts)
  const meadow = options.state === 'grass';
  const dry = tint('grass', meadow ? 0x7f9a4c : 0xb7a56c), stones = getMaterial('gravel_ballast');
  for (let patch = 0; patch < (meadow ? 7 : 4) + variant; patch++) {
    const x = (rng() - 0.5) * 7.6, z = (rng() - 0.5) * 7.6;
    for (let blade = 0; blade < 8; blade++) b.grass(x + (rng() - 0.5) * 1.1, z + (rng() - 0.5) * 1.1, 0.45, dry);
  }
  for (let stone = 0; stone < (meadow ? 2 : 8 + variant * 3); stone++) b.heap(point((rng() - 0.5) * 8.2, 0, (rng() - 0.5) * 8.2),
    0.14 + rng() * 0.15, 0.1 + rng() * 0.15, stones, rng() * Math.PI);
  const root = b.finishTerrain('terrain.dirt', [horizontal()], meadow ? tint('grass', 0x7f9a52) : getMaterial('dirt_laterite'),
    TERRAIN_TILES.dirt);
  root.userData.variant = variant; return root;
}

function createRubble(options: ModelOptions) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed), variant = (options.variant ?? 0) & 3;
  const concrete = getMaterial('concrete_raw'), brick = getMaterial('brick_red'), steel = getMaterial('metal_steel');
  const centers = [[-1.6, -1.1], [1.7, 1.3], [-2.6, 2.7], [2.8, -2.5]];
  for (let pile = 0; pile < 2 + variant % 3; pile++) {
    const [x, z] = centers[pile];
    b.heap(point(x, 0, z), 1.6, 1.1, concrete, rng() * Math.PI);
    for (let fragment = 0; fragment < 12; fragment++) {
      const angle = rng() * Math.PI * 2, radius = rng() * 1.25;
      b.box(point(x + Math.cos(angle) * radius, 0.25 + (1 - radius / 1.6) * 0.75, z + Math.sin(angle) * radius),
        point(0.35 + rng() * 0.35, 0.18 + rng() * 0.18, 0.3 + rng() * 0.5),
        fragment % 3 ? concrete : brick, rng() * Math.PI, (rng() - 0.5) * 0.65);
    }
  }
  // One fixed-height broken slab establishes the pile envelope; debris placement remains seeded.
  b.box(point(0.3, 1.3, 0), point(1.1, 0.4, 0.55), concrete, variant * 0.3);
  for (let bar = 0; bar < 8; bar++) {
    const x = -1.8 + bar * 0.45, z = -0.6 + rng() * 0.6;
    b.tube([point(x, 0.7, z), point(x + 0.12, 1.1, z + 0.2), point(x + 0.35, 1.32, z + 0.15)], 0.025, steel, 3, 3);
  }
  const root = b.finishTerrain('terrain.rubble', [horizontal()], tint('gravel_ballast', 0xa49f95), TERRAIN_TILES.rubble);
  root.userData.variant = variant; return root;
}

function createFlood(options: ModelOptions) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed), variant = (options.variant ?? 0) & 3;
  const level = FLOOD_LEVELS[variant], plastic = tint('plaster_tint', 0x8abbb1), wood = getMaterial('wood_teak');
  b.world(horizontal(10, 10, level), getMaterial('water_flood'));
  for (let bottle = 0; bottle < 7; bottle++) {
    const center = point((rng() - 0.5) * 8, level + 0.07, (rng() - 0.5) * 8);
    b.cylinder(center, 0.09, 0.42, plastic, 6, Math.PI / 2);
    b.cylinder(center.clone().add(point(0.24, 0, 0)), 0.045, 0.09, plastic, 6, Math.PI / 2);
  }
  for (let branch = 0; branch < 5; branch++) {
    const center = point((rng() - 0.5) * 7.5, level + 0.03, (rng() - 0.5) * 7.5), yaw = rng() * Math.PI;
    const end = center.clone().add(point(Math.cos(yaw) * 1.2, 0.08, Math.sin(yaw) * 1.2));
    b.rod(center, end, 0.07, wood, 5); b.rod(end, end.clone().add(point(0.3, 0.06, -0.4)), 0.035, wood);
  }
  for (let bowl = 0; bowl < 3; bowl++) {
    const x = (rng() - 0.5) * 7, z = (rng() - 0.5) * 7;
    // Open rim and bottom: readable plastic bowls rather than closed cylinders.
    b.world(new RingGeometry(0.2, 0.28, 8).rotateX(-Math.PI / 2).translate(x, level + 0.2, z), plastic);
    b.world(new CircleGeometry(0.2, 8).rotateX(-Math.PI / 2).translate(x, level + 0.04, z), plastic);
    b.cylinder(point(x, level + 0.1, z), 0.24, 0.08, plastic, 8);
  }
  for (let scrap = 0; scrap < 6; scrap++) b.box(point((rng() - 0.5) * 8.5, level + 0.025, (rng() - 0.5) * 8.5),
    point(0.35, 0.04, 0.28), plastic, rng() * Math.PI);
  const root = b.finishTerrain('terrain.flood', [horizontal()], tint('dirt_laterite', 0x76644d), TERRAIN_TILES.flood, level);
  root.userData.variant = variant; root.userData.waterLevel = level; return root;
}

function createRadiation(options: ModelOptions) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed);
  const yellow = paintedSteel(0xe3bd32), dark = tint('asphalt', 0x191b17), steel = getMaterial('metal_steel');
  for (let drum = 0; drum < 2 + ((options.seed ?? 1) % 2); drum++) {
    const center = point(-2.2 + drum * 2, 0.4, -0.9 + rng() * 1.5);
    b.cylinder(center, 0.38, 0.92, yellow, 10, Math.PI / 2);
    for (const offset of [-0.34, 0.34]) b.cylinder(center.clone().add(point(offset, 0, 0)), 0.39, 0.055, dark, 10, Math.PI / 2);
  }
  const dead = tint('grass', 0xb5a33e);
  for (let tuft = 0; tuft < 28; tuft++) b.grass((rng() - 0.5) * 8.5, (rng() - 0.5) * 8.5, 0.35, dead);
  b.rod(point(2.6, 0, 2.2), point(2.6, 2.3, 2.2), 0.055, steel);
  // Generic radiation trefoil, generated geometry: no external logo or protected emblem.
  const background = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([
    1.9, 1.45, 2.22, 3.3, 1.45, 2.22, 2.6, 2.3, 2.22,
    2.6, 2.3, 2.22, 3.3, 1.45, 2.22, 1.9, 1.45, 2.22,
  ], 3)); background.computeVertexNormals(); b.world(background, yellow);
  b.world(new CircleGeometry(0.055, 8).translate(2.6, 1.77, 2.24), dark);
  for (let blade = 0; blade < 3; blade++) b.world(new RingGeometry(0.09, 0.24, 8, 1,
    blade * Math.PI * 2 / 3 + Math.PI / 6, Math.PI / 3).translate(2.6, 1.77, 2.24), dark);
  b.add(new PlaneGeometry(1.25, 0.35).translate(2.6, 1.2, 2.25), thaiSign('อันตราย รังสี', '#ebc83c', '#22221b', [1.25, 0.35]));
  const glow = contaminationGlow();
  b.world(new CircleGeometry(1.2, 12).rotateX(-Math.PI / 2).translate(-0.5, 0.012, 0), glow);
  const root = b.finishTerrain('terrain.radiation', [horizontal()], tint('dirt_laterite', 0x24271f), TERRAIN_TILES.radiation);
  root.userData.warning = 'radiation'; return root;
}

export function createTerrain(kind: TerrainKind, options: ModelOptions = {}) {
  if (kind === 'water' || kind === 'shore') return createWater(kind, options);
  if (kind === 'woods') return createWoods(options);
  if (kind === 'dirt') return createDirt(options);
  if (kind === 'rubble') return createRubble(options);
  if (kind === 'flood') return createFlood(options);
  return createRadiation(options);
}
