/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color, Group, LatheGeometry, Material, Vector2, Vector3 } from 'three';
import { bambooCulmMaterial, tint } from '../../materials/library.js';
import { regionalLeafColor } from '../../regional/vegetation.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { PlantBuilder, point } from './builder.js';
export { vegetationMix } from '../../regional/vegetation.js';

export const TREE_KINDS = ['rain_tree', 'coconut', 'sugar_palm', 'mango', 'banana', 'bamboo',
  'flame_tree', 'golden_shower', 'bougainvillea', 'hedge', 'teak', 'pine', 'eucalyptus',
  'tamarind', 'durian', 'rubber', 'oil_palm', 'mangrove'] as const;
export type TreeKind = typeof TREE_KINDS[number];
export const TREE_HEIGHTS: Record<TreeKind, number> = { rain_tree: 12, coconut: 12.5, sugar_palm: 15,
  mango: 7, banana: 4, bamboo: 10, flame_tree: 9, golden_shower: 9, bougainvillea: 1.7,
  hedge: 1.2, teak: 15, pine: 18, eucalyptus: 15, tamarind: 10, durian: 12, rubber: 15, oil_palm: 8, mangrove: 6 };
export const TREE_FOOTPRINTS: Record<TreeKind, readonly [number, number]> = {
  rain_tree: [2, 2], coconut: [2, 2], sugar_palm: [1, 1], mango: [1, 1], banana: [1, 1], bamboo: [2, 2],
  flame_tree: [2, 2], golden_shower: [1, 1], bougainvillea: [1, 1], hedge: [1, 1], teak: [2, 2],
  pine: [1, 1], eucalyptus: [1, 1], tamarind: [2, 2], durian: [1, 1], rubber: [2, 2], oil_palm: [2, 2], mangrove: [1, 1],
};

interface TreeBuildOptions extends ModelOptions { density?: number; leafColor?: number; barkColor?: number }
type Random = () => number;
const polar = (angle: number, radius: number, height: number): Vector3 => point(Math.cos(angle) * radius, height, Math.sin(angle) * radius);

function leafSpray(b: PlantBuilder, rng: Random, center: Vector3, count: number, radius: number, leaf: Material, length = 0.75, width = 0.4): void {
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const offset = polar(angle, Math.sqrt(rng()) * radius, (rng() - 0.5) * radius * 0.9);
    const direction = polar(angle + 0.4, 1, (rng() - 0.3) * 0.8);
    b.leaf(center.clone().add(offset), direction, length * (0.8 + rng() * 0.4), width,
      leaf, rng() * Math.PI * 2, 0.12, 1, false, rng() > 0.5);
  }
}

function broadleaf(kind: TreeKind, b: PlantBuilder, rng: Random, leaf: Material, bark: Material, density: number): void {
  const h = TREE_HEIGHTS[kind];
  const umbrella = ['rain_tree', 'flame_tree', 'tamarind'].includes(kind);
  const radius = kind === 'rain_tree' ? 6.4 : kind === 'flame_tree' ? 4.8 : kind === 'tamarind' ? 4.1 :
    kind === 'mango' ? 2.15 : kind === 'mangrove' ? 2.2 : kind === 'golden_shower' ? 2.5 :
      kind === 'durian' ? 2.4 : kind === 'eucalyptus' ? 1.55 : 2.65;
  const trunkHeight = h * (umbrella ? 0.35 : 0.58);
  b.taper([point(0, 0, 0), point(-0.12, trunkHeight * 0.45, 0.1), point(0.12, trunkHeight, 0)],
    kind === 'rain_tree' ? 0.7 : kind === 'mangrove' ? 0.26 : 0.3, bark, 7, 7);
  if (kind === 'rain_tree') for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    b.taper([polar(angle, 0.12, 0.75), polar(angle, 0.7, 0.2), polar(angle, 1.25, 0.015)], 0.18, bark, 3, 5);
  }
  const branchCount = density < 0.6 ? 4 : 7;
  for (let branch = 0; branch < branchCount; branch++) {
    const angle = branch / branchCount * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const endpoint = polar(angle, radius * 0.72, h * (umbrella ? 0.79 : 0.83));
    const start = point(0.1, trunkHeight * (0.78 + rng() * 0.22), 0);
    b.taper([start, polar(angle - 0.17, radius * 0.28, h * 0.64), endpoint], umbrella ? 0.26 : 0.13, bark, 5, 5);
    for (let fork = 0; fork < 2; fork++) {
      const end = polar(angle + (fork ? 0.26 : -0.3), radius * (0.87 + rng() * 0.1), h * (umbrella ? 0.88 : 0.95));
      b.taper([endpoint.clone().multiplyScalar(0.9), endpoint, end], 0.065, bark, 3, 4);
    }
  }
  // Stratified, overlapping branch-tip sprays. No opaque ellipsoid canopy meshes.
  const clusters = Math.round(umbrella ? 42 * density : 38 * density);
  for (let cluster = 0; cluster < clusters; cluster++) {
    const t = cluster / Math.max(1, clusters - 1), angle = cluster * 2.399963 + rng() * 0.38;
    const r = radius * Math.sqrt(t) * (0.84 + rng() * 0.16);
    const conical = kind === 'durian';
    const y = conical ? h * (0.97 - t * 0.4) : umbrella ? h * (0.94 - t * 0.13) : h * (0.96 - t * 0.32);
    const center = polar(angle, conical ? r * t : r, y);
    const small = kind === 'tamarind' || kind === 'eucalyptus';
    const cards = kind === 'golden_shower' ? 9 : small ? 20 : 15;
    leafSpray(b, rng, center, cards, umbrella ? 0.52 : 0.45, leaf,
      kind === 'teak' ? 1.25 : small ? 0.62 : 0.86, small ? 0.13 : kind === 'teak' ? 0.65 : 0.42);
  }
  leafSpray(b, rng, point(0, h * 0.96, 0), 10, 0.45, leaf);
  if (kind === 'mango') for (let i = 0; i < 9; i++) {
    b.ellipsoid(polar(i * 2.4, radius * 0.7, h * 0.68), point(0.13, 0.21, 0.12), tint('plaster_tint', 0xb5b44d), 5, 4);
  }
  if (kind === 'flame_tree' || kind === 'golden_shower') {
    const flowers = tint('plaster_tint', kind === 'flame_tree' ? 0xef5327 : 0xf9cf31);
    for (let chain = 0; chain < Math.round(24 * density); chain++) {
      const angle = chain * 2.4, center = polar(angle, radius * (0.55 + rng() * 0.4), h * 0.83);
      const length = kind === 'golden_shower' ? 5 : 2;
      for (let flower = 0; flower < length; flower++) {
        b.flower(center.clone().add(point(Math.sin(flower) * 0.08, -flower * 0.23, 0)),
          kind === 'golden_shower' ? 0.18 : 0.3, flowers, rng());
      }
      if (kind === 'golden_shower') b.tube([center, center.clone().add(point(0.02, -1.1, 0))], 0.012, bark, 2, 3);
    }
  }
  if (kind === 'rubber') {
    // Diagonal tapping scar on the front and a small cup directly below it.
    b.tube([point(-0.24, 1.6, 0.2), point(0, 1.4, 0.31), point(0.23, 1.2, 0.2)], 0.045, tint('wood_teak', 0x36251f), 4, 4);
    const cup = new LatheGeometry([new Vector2(0, 0), new Vector2(0.16, 0), new Vector2(0.19, 0.06),
      new Vector2(0.18, 0.2), new Vector2(0.14, 0.2), new Vector2(0.13, 0.07), new Vector2(0, 0.07)], 8)
      .translate(0, 0.88, 0.45);
    b.add(applyWorldUV(cup, 1), tint('metal_steel', 0x3d4644)); cup.dispose();
  }
  if (kind === 'mangrove') for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2;
    b.taper([point(0, 2, 0), polar(angle, 0.9, 1.05), polar(angle, 1.6, 0), polar(angle, 1.85, -1.1)], 0.13, bark, 6, 5);
  }
}

function palm(kind: 'coconut' | 'sugar_palm' | 'oil_palm', b: PlantBuilder, rng: Random, leaf: Material, bark: Material, density: number): void {
  const h = TREE_HEIGHTS[kind], stout = kind === 'oil_palm', fan = kind === 'sugar_palm';
  const crown = point(kind === 'coconut' ? 0.65 : 0, h * 0.88, 0);
  const stemRadius = stout ? 0.52 : fan ? 0.35 : 0.23;
  const stemCurve = b.taper([point(0, 0, 0), point(kind === 'coconut' ? -0.32 : 0, h * 0.43, 0.1), crown], stemRadius, bark, 11, 7);
  const ringCount = Math.max(3, Math.round((stout ? 8 : 15) * density));
  for (let ring = 0; ring < ringCount; ring++) {
    const t = 0.91 * (ring + 1) / (ringCount + 1);
    const center = stemCurve.getPointAt(t), radius = stemRadius * (1 - t * 0.7) + 0.008;
    if (stout) for (let side = 0; side < 5; side++) {
      const angle = side / 5 * Math.PI * 2 + ring * 0.35;
      b.taper([center.clone().add(polar(angle, radius, 0)), center.clone().add(polar(angle, radius + 0.28, 0.12))], 0.11, bark, 1, 4);
    } else {
      const points = Array.from({ length: 9 }, (_, i) => center.clone().add(polar(i / 8 * Math.PI * 2, radius, 0)));
      b.tube(points, 0.02, bark, 8, 3);
    }
  }
  const count = Math.round((stout ? 14 : fan ? 11 : 10) * Math.max(0.45, density));
  for (let frond = 0; frond < count; frond++) {
    const angle = frond / count * Math.PI * 2 + rng() * 0.13;
    if (fan) {
      const base = crown.clone().add(polar(angle, 1.05, 0.6 + rng() * 0.3));
      b.tube([crown, base], 0.045, bark, 2, 4);
      for (let finger = 0; finger < 11; finger++) {
        const direction = polar(angle + (finger - 5) * 0.15, 1, 0.25 + Math.sin(finger / 10 * Math.PI) * 0.5);
        b.leaf(base, direction, 1.6, 0.2, leaf, angle, 0.14);
      }
    } else {
      const radius = stout ? 3.7 : 3.8;
      const tip = crown.clone().add(polar(angle, radius, -h * 0.2));
      const middle = crown.clone().add(polar(angle, radius * 0.45, h * 0.1));
      const frondCurve = b.taper([crown, middle, tip], 0.055, bark, 6, 4);
      const pairs = Math.round(14 * Math.max(0.45, density));
      for (let pair = 0; pair < pairs; pair++) {
        const t = (pair + 1) / (pairs + 1);
        const center = frondCurve.getPointAt(t);
        for (const side of [-1, 1]) {
          const direction = polar(angle + side * 0.84, 1, -0.48 - t * 0.25);
          b.leaf(center, direction, (0.4 + Math.sin(t * Math.PI) * 0.85), 0.2, leaf, angle, 0.16);
        }
      }
    }
  }
  const fruits = tint('plaster_tint', stout ? 0x9a4424 : 0x7b8546);
  for (let i = 0; i < 6; i++) b.ellipsoid(crown.clone().add(polar(i * 2.4, 0.35, -0.4 - rng() * 0.25)), point(0.18, 0.24, 0.18), fruits, 6, 4);
}

function bamboo(b: PlantBuilder, rng: Random, leaf: Material, density: number): void {
  const culm = bambooCulmMaterial();
  const count = Math.round(26 * density);
  for (let stem = 0; stem < count; stem++) {
    const angle = stem * 2.399963, r = Math.sqrt((stem + 0.5) / count) * 1.05;
    const base = polar(angle, r, 0), height = 7 + rng() * 2.7;
    const spread = 1.1 + r * 1.1, end = base.clone().add(polar(angle, spread, height));
    b.taper([base, base.clone().add(polar(angle, spread * 0.12, height * 0.48)), end], 0.065 + rng() * 0.025, culm, 6, 5);
    for (let spray = 0; spray < 2; spray++) {
      const t = 0.62 + spray * 0.2, origin = base.clone().add(polar(angle, spread * t * t, height * t));
      const sprayEnd = origin.clone().add(polar(angle + (spray % 2 ? -0.6 : 0.7), 1.05, 0.45));
      b.taper([origin, sprayEnd], 0.022, culm, 1, 3);
      leafSpray(b, rng, sprayEnd, 7, 0.42, leaf, 0.8, 0.13);
    }
    leafSpray(b, rng, end, 7, 0.42, leaf, 0.78, 0.13);
  }
}

function banana(b: PlantBuilder, rng: Random, leaf: Material): void {
  const stem = tint('wood_painted', 0x9cb565), rib = tint('wood_painted', 0xbaca83);
  const count = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const origin = polar(i * 2.4, i ? 0.7 : 0, 0), h = 2.4 + rng() * 0.8;
    const crown = origin.clone().add(point(0.12, h, -0.1));
    b.taper([origin, origin.clone().add(point(0, h * 0.65, 0)), crown], 0.15, stem, 4, 6);
    for (let j = 0; j < 7; j++) {
      const angle = j * 2.4 + i, direction = polar(angle, 1, 0.15 + rng() * 0.6);
      b.leaf(crown, direction, 2, 0.76, leaf, angle, -0.4, 6, j === 1 || j === 4);
      b.taper([crown, crown.clone().add(polar(angle, 0.85, 0.25)), crown.clone().add(polar(angle, 1.7, -0.3))], 0.023, rib, 3, 3);
    }
  }
}

function pine(b: PlantBuilder, rng: Random, leaf: Material, bark: Material, density: number): void {
  b.taper([point(0, 0, 0), point(0.08, 8, 0), point(0, 17.8, 0)], 0.32, bark, 8, 7);
  for (let tier = 0; tier < 4; tier++) for (let branch = 0; branch < 5; branch++) {
    const angle = branch / 5 * Math.PI * 2 + tier * 0.8, r = 2.45 - tier * 0.37, y = 10 + tier * 2;
    const tip = polar(angle, r, y + 0.35);
    b.taper([point(0, y, 0), polar(angle, r * 0.55, y - 0.35), tip], 0.07, bark, 3, 4);
    for (let spray = 0; spray < Math.round(4 * density); spray++) leafSpray(b, rng,
      tip.clone().multiplyScalar(0.75 + spray * 0.075), 8, 0.26, leaf, 0.65, 0.075);
  }
  leafSpray(b, rng, point(0, 17.5, 0), 16, 0.5, leaf, 0.7, 0.075);
}

function shrub(kind: 'hedge' | 'bougainvillea', b: PlantBuilder, rng: Random, leaf: Material, bark: Material, density: number): void {
  const hedge = kind === 'hedge', count = Math.round((hedge ? 60 : 38) * density);
  for (let i = 0; i < (hedge ? 8 : 4); i++) {
    const x = hedge ? -4.25 + i * 1.2 : (i - 1.5) * 0.6;
    b.taper([point(x, 0, 0), point(x + 0.1, 0.6, 0.1), point(x, hedge ? 0.9 : 1.25, 0)], 0.04, bark, 3, 4);
  }
  const flowers = tint('plaster_tint', 0xcb388d);
  for (let i = 0; i < count; i++) {
    const center = hedge ? point(-4.55 + (i + 0.5) / count * 9.1, 0.55 + rng() * 0.37, (rng() - 0.5) * 0.5)
      : polar(i * 2.4, Math.sqrt(rng()) * 1.7, 0.6 + rng() * 0.75);
    leafSpray(b, rng, center, 8, hedge ? 0.22 : 0.3, leaf, 0.42, 0.24);
    if (!hedge && i % 2 === 0) for (let petal = 0; petal < 3; petal++) b.flower(center.clone().add(point(petal * 0.1, 0.22, 0)), 0.18, flowers, rng());
  }
}

/** The park density level reduces repeated sprays and branches before merging. */
export function treeParts(kind: TreeKind, options: TreeBuildOptions = {}): PlantBuilder {
  const rng = seededRng(options.seed), b = new PlantBuilder(), density = options.density ?? 1;
  const color = new Color(options.leafColor ?? regionalLeafColor(options.region));
  if (['mango', 'durian', 'mangrove', 'tamarind'].includes(kind)) color.multiplyScalar(0.72);
  const leaf = tint('foliage_tropical', color), bark = tint('wood_teak', options.barkColor ??
    (kind === 'eucalyptus' ? 0xc9cab7 : kind === 'rubber' ? 0x9eaaa0 : kind === 'coconut' ? 0x929079 : 0x75634b));
  const sizeScale = 0.85 + rng() * 0.3, yaw = rng() * Math.PI * 2;
  const leanX = (rng() - 0.5) * 0.06, leanZ = (rng() - 0.5) * 0.06;
  if (kind === 'bamboo') bamboo(b, rng, leaf, density);
  else if (kind === 'banana') banana(b, rng, leaf);
  else if (kind === 'pine') pine(b, rng, leaf, bark, density);
  else if (kind === 'coconut' || kind === 'sugar_palm' || kind === 'oil_palm') palm(kind, b, rng, leaf, bark, density);
  else if (kind === 'hedge' || kind === 'bougainvillea') shrub(kind, b, rng, leaf, bark, density);
  else broadleaf(kind, b, rng, leaf, bark, density);
  b.transformPlant(TREE_HEIGHTS[kind], sizeScale, kind === 'hedge' ? 0 : yaw, kind === 'hedge' ? 0 : leanX, kind === 'hedge' ? 0 : leanZ, kind === 'mangrove');
  if (kind === 'hedge') {
    // A hedge joins adjacent tiles: its length stays exactly 10 m, despite height variation.
    let min = Infinity, max = -Infinity;
    b.parts.forEach(part => { part.geometry.computeBoundingBox(); min = Math.min(min, part.geometry.boundingBox!.min.x); max = Math.max(max, part.geometry.boundingBox!.max.x); });
    b.parts.forEach(part => part.geometry.translate(-(min + max) / 2, 0, 0).scale(10 / (max - min), 1, 1));
  }
  // Used by the public factory and by tests of the explicit tree-size exception.
  b.variation = { sizeScale, yaw: kind === 'hedge' ? 0 : yaw, lean: kind === 'hedge' ? [0, 0] : [leanX, leanZ] };
  return b;
}

export function createTree(kind: TreeKind, options: ModelOptions = {}): Group {
  const builder = treeParts(kind, options);
  const root = builder.finish(`veg.${kind}`, 'veg', TREE_FOOTPRINTS[kind], [], options);
  root.userData.variation = builder.variation;
  if (kind === 'rubber' || kind === 'eucalyptus') root.userData.placement = 'rows';
  return root;
}
