/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Material, Vector3 } from 'three';
import { RIVERBED_Y, WATER_Y } from '../../constants.js';
import { getMaterial, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { bankMaterial, horizontal, isCanal, mask4, SIDES, TerrainBuilder } from './helpers.js';

/** Earth height is a union of bank ramps; no overlapping slopes at inside corners. */
export function bankHeight(x: number, z: number, mask: number): number {
  let height = RIVERBED_Y;
  for (const side of SIDES) if (mask & side.bit) {
    const distance = 5 - (x * side.x + z * side.z);
    height = Math.max(height, Math.max(RIVERBED_Y, -Math.max(0, distance - 0.3) * 3 / 2.1));
  }
  return height;
}

function earthSurface(mask: number): BufferGeometry {
  // Include the exact plateau, ramp toe and tile endpoints.
  const samples = [-5, -4.7, -4.6, -4.2, -3.8, -3.4, -3, -2.6, 0, 2.6, 3, 3.4, 3.8, 4.2, 4.6, 4.7, 5];
  const vertices: number[] = [];
  const vertex = (x: number, z: number): number[] => [x, bankHeight(x, z, mask), z];
  for (let z = 0; z < samples.length - 1; z++) for (let x = 0; x < samples.length - 1; x++) {
    const a = vertex(samples[x], samples[z]), c = vertex(samples[x + 1], samples[z + 1]);
    vertices.push(...a, ...vertex(samples[x], samples[z + 1]), ...c,
      ...a, ...c, ...vertex(samples[x + 1], samples[z]));
  }
  // Close the bank ends down to the common bed. A wall or differently shaped bank
  // beside this tile can then meet it without exposing holes under the surface.
  for (const side of SIDES) for (let i = 0; i < samples.length - 1; i++) {
    const a = side.x ? vertex(side.x * 5, samples[i]) : vertex(samples[i], side.z * 5);
    const c = side.x ? vertex(side.x * 5, samples[i + 1]) : vertex(samples[i + 1], side.z * 5);
    if (a[1] === RIVERBED_Y && c[1] === RIVERBED_Y) continue;
    const lowA = [a[0], RIVERBED_Y, a[2]], lowC = [c[0], RIVERBED_Y, c[2]];
    // Outward-facing winding on +X and -Z, reversed on the other two sides.
    if (side.x === 1 || side.z === -1) vertices.push(...a, ...c, ...lowC, ...a, ...lowC, ...lowA);
    else vertices.push(...a, ...lowC, ...c, ...a, ...lowA, ...lowC);
  }
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); return geometry;
}

function rotateSide(p: Vector3, side: typeof SIDES[number]): Vector3 {
  return p.applyAxisAngle(point(0, 1, 0), side.angle);
}

function walls(b: TerrainBuilder, mask: number, material: Material): void {
  for (const side of SIDES) if (mask & side.bit) {
    // 30 cm wall occupies only 3% of the tile, preserving a broad visible canal.
    const geometry = new BoxGeometry(10, 3, 0.3).translate(0, -1.5, -4.85).rotateY(side.angle);
    b.world(geometry, material);
  }
}

function pierOrSteps(b: TerrainBuilder, mask: number, rng: () => number): string | undefined {
  const available = SIDES.filter(side => mask & side.bit);
  if (!available.length) return undefined;
  const choice = rng();
  if (choice > 0.4) return undefined;
  const side = available[Math.floor(rng() * available.length)], wood = tint('wood_teak', 0x807154);
  if (choice < 0.2) {
    for (let plank = 0; plank < 7; plank++) {
      b.box(rotateSide(point(0, 0.06, -4.4 + plank * 0.3), side), point(1.7, 0.12, 0.27), wood, side.angle);
    }
    for (const x of [-0.65, 0.65]) for (const z of [-4.2, -2.6]) {
      b.rod(rotateSide(point(x, -2.7, z), side), rotateSide(point(x, 0.12, z), side), 0.09, wood, 5);
    }
    return 'pier';
  }
  const stone = getMaterial('concrete_weathered');
  for (let step = 0; step < 5; step++) {
    const top = -step * 0.24;
    b.box(rotateSide(point(0, top - 0.12, -4.6 + step * 0.34), side), point(1.8, 0.24, 0.35), stone, side.angle);
  }
  return 'steps';
}

function hyacinth(b: TerrainBuilder, mask: number, rng: () => number, vertical: boolean): void {
  const leaf = tint('foliage_tropical', 0x70a643), stem = tint('wood_painted', 0x69834d);
  for (const side of SIDES) if (mask & side.bit) for (let cluster = 0; cluster < 3; cluster++) {
    const center = rotateSide(point(-3.2 + cluster * 3.1 + rng() * 0.3, WATER_Y + 0.04, vertical ? -4.25 : -3.75), side);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      b.leaf(center, point(Math.cos(angle), 0.1, Math.sin(angle)), 0.44, 0.32, leaf, angle, 0.04);
    }
    b.rod(center.clone().add(point(0, -0.04, 0)), center.clone().add(point(0, 0.16, 0)), 0.055, stem);
  }
}

/** landMask applies to water; shore uses its land-side variant. Opposite banks always stay vertical. */
export function createWater(kind: 'water' | 'shore', options: ModelOptions = {}) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed), id = `terrain.${kind}`;
  const mask = mask4(kind === 'shore' ? options.variant : options.landMask);
  const canal = isCanal(mask);
  const roll = rng();
  const requested = options.bankStyle ?? (roll < 0.12 ? 'brick' : roll < 0.3 ? 'concrete' : 'earth');
  const style = canal && requested === 'earth' ? 'concrete' : requested;
  const vertical = mask !== 0 && style !== 'earth';
  b.world(horizontal(10, 10, WATER_Y), getMaterial('water_river'));
  // Ground mesh contains the bed and all natural banks, so heightfield replacement can hide it.
  const groundParts = mask && !vertical ? [earthSurface(mask)] : [horizontal(10, 10, RIVERBED_Y)];
  if (vertical) walls(b, mask, bankMaterial(style));
  const dryGrass = tint('grass', 0xa2a771);
  for (const side of SIDES) if (mask & side.bit) for (let tuft = 0; tuft < 8; tuft++) {
    const center = rotateSide(point(-4.3 + tuft * 1.2, 0, -4.95), side);
    // Narrow blades sit within the land-side strip and stay clear of the tile boundary.
    b.grass(center.x - side.x * 0.13, center.z - side.z * 0.13, 0.45, dryGrass,
      vertical ? 0 : bankHeight(center.x - side.x * 0.13, center.z - side.z * 0.13, mask));
  }
  hyacinth(b, mask, rng, vertical);
  const riverside = pierOrSteps(b, mask, rng);
  const ground = bankMaterial('earth');
  const root = b.finishTerrain(id, groundParts, ground, kind === 'water' ? [2, 3, 4] : [], WATER_Y);
  root.userData.landMask = mask; root.userData.bankStyle = style; root.userData.canal = canal;
  root.userData.riverside = riverside ?? 'none'; root.userData.waterWidth = canal ? 9.4 : 10;
  return root;
}
