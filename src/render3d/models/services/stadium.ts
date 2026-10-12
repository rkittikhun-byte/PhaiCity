/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Color, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Object3D } from 'three';
import { serviceConcreteMaterial, stadiumCrowdMaterial, stadiumFloodlightMaterial, vertexFinish } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV, countTriangles, mergeByMaterial } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import { ServiceBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const STADIUM_TILES = Array.from({ length: 32 }, (_, i) => 779 + i);
export const STADIUM_LIGHT_HEADS = [[-17.1, 18.1, -13.4], [17.1, 18.1, -13.4],
  [-17.1, 18.1, 13.4], [17.1, 18.1, 13.4]] as const;

class StadiumBuilder extends ServiceBuilder {
  readonly paint = serviceConcreteMaterial();
  stone = this.paint;
}

/** Capsule track with true straightaways and rounded ends, facing up at y. */
function ovalRing(outer: number, inner: number, y: number, straight = 5.3): BufferGeometry {
  const outline = (radius: number): [number, number][] => [-1, 1].flatMap(side =>
    Array.from({ length: 25 }, (_, i) => {
      const angle = (side < 0 ? 0 : Math.PI) + i / 24 * Math.PI;
      return [radius * Math.cos(angle), -side * straight + radius * Math.sin(angle)] as [number, number];
    }));
  const a = outline(outer), b = outline(inner), values: number[] = [];
  const vertex = (p: readonly number[]): void => { values.push(p[0], y, p[1]); };
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    [a[i], b[i], a[j], b[i], b[j], a[j]].forEach(vertex);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
  geometry.computeVertexNormals(); return applyWorldUV(geometry, 1);
}

function stadiumSite(b: StadiumBuilder): void {
  const palette = b.kit.neutralPalette(b.options.seed);
  b.feature('stadium-site-and-parking', () => {
    b.colored(0xbab9ae, () => b.box(39, 0.06, 39, 0, 0.03, 0, b.paint));
    b.colored(palette.wall, () => {
      for (const x of [-19.1, 19.1]) b.box(0.16, 0.75, 38.2, x, 0.44, 0, b.paint);
      b.box(38.2, 0.75, 0.16, 0, 0.44, -19.1, b.paint);
      for (const x of [-11.7, 11.7]) b.box(14.6, 0.75, 0.16, x, 0.44, 19.1, b.paint);
    });
    for (const x of [-16, -11, 11, 16]) b.car(x, 17.1, b.paint);
    b.colored(0xf5f0dc, () => {
      for (const x of [-18, -13.5, -8.7, 8.7, 13.5, 18]) b.box(0.08, 0.015, 3.4, x, 0.12, 17.1, b.paint);
    });
  });
  b.feature('football-field-and-running-track', () => {
    const grass = vertexFinish('grass');
    b.colored(0x56865a, () => b.box(21.2, 0.03, 31.8, 0, 0.085, 0, grass));
    for (let i = 0; i < 8; i++) b.colored(i % 2 ? 0x548b58 : 0x46804d,
      () => b.box(12.4, 0.016, 2.55, 0, 0.111, -8.925 + i * 2.55, grass));
    b.colored(0xb7684e, () => b.add(ovalRing(10.6, 8.7, 0.13), b.paint));
    b.colored(0xe8ded0, () => {
      for (const radius of [8.73, 9.18, 9.63, 10.08, 10.53]) b.add(ovalRing(radius, radius - 0.035, 0.141), b.paint);
      for (const x of [-6.2, 6.2]) b.box(0.07, 0.016, 20.4, x, 0.14, 0, b.paint);
      for (const z of [-10.2, 0, 10.2]) b.box(12.4, 0.016, 0.07, 0, 0.14, z, b.paint);
      b.add(ovalRing(1.65, 1.58, 0.145, 0), b.paint);
      for (const side of [-1, 1]) {
        for (const x of [-4.1, 4.1]) b.box(0.07, 0.016, 3.6, x, 0.14, side * 8.4, b.paint);
        b.box(8.2, 0.016, 0.07, 0, 0.14, side * 6.6, b.paint);
        for (const x of [-1.8, 1.8]) b.pole(point(x, 0.15, side * 10.45), point(x, 2.05, side * 10.45), 0.06, b.metal, 6);
        b.pole(point(-1.8, 2.05, side * 10.45), point(1.8, 2.05, side * 10.45), 0.06, b.metal, 6);
        for (let i = 0; i < 7; i++) b.box(0.027, 1.8, 0.027, -1.75 + i * 0.58, 1.03, side * 11.1, b.fabric);
        for (const y of [0.4, 0.9, 1.4, 1.9]) b.box(3.6, 0.027, 0.027, 0, y, side * 11.1, b.fabric);
      }
    });
  });
  b.feature('two-covered-grandstands', () => {
    for (const side of [-1, 1]) {
      b.colored(palette.wall, () => {
        for (let row = 0; row < 6; row++) b.box(0.64, 0.6 + row * 0.48, 22,
          side * (11.15 + row * 0.62), 0.36 + row * 0.24, 0, b.paint);
        b.box(0.18, 3.55, 23, side * 15, 1.84, 0, b.paint);
      });
      for (const z of [-10.5, -3.5, 3.5, 10.5]) b.box(0.15, 5.6, 0.15, side * 15, 2.91, z, b.metal);
      b.colored(0x819998, () => {
        b.box(6.8, 0.13, 23.5, side * 13.05, 5.87, 0, b.metal, -side * 0.07);
        b.box(0.09, 0.2, 23.5, side * 9.65, 6.13, 0, b.metal);
      });
      for (const z of [-11.2, 11.2]) b.pole(point(side * 10.1, 3.1, z), point(side * 15, 3.1, z), 0.04, b.metal, 4);
    }
  });
  b.feature('four-floodlight-masts', () => {
    for (const [x, y, z] of STADIUM_LIGHT_HEADS) {
      b.cylinder(0.5, 0.3, x, 0.21, z, b.paint, 8);
      b.pole(point(x, 0.15, z), point(x, y, z), 0.12, b.metal, 8);
      b.box(1.72, 1.42, 0.22, x, y, z, b.metal);
    }
  });
  b.feature('food-stalls', () => { b.cart(-4.3, 17.2, 'ข้าวแกง'); b.cart(4.3, 17.2, 'น้ำผลไม้'); });
  b.feature('stadium-entrance', () => {
    for (const x of [-3.4, 3.4]) b.box(0.16, 3.3, 0.16, x, 1.71, 18.8, b.metal);
    b.shopSign('สนามฟุตบอล', 7.2, 0.85, 0, 3.25, 18.85);
  });
  b.flushSigns();
}

function matchPlayers(b: StadiumBuilder): void {
  b.feature('twenty-two-player-figures', () => {
    for (const team of [-1, 1]) for (let i = 0; i < 11; i++) {
      const x = i === 0 ? 0 : (i % 4 - 1.5) * 2.35;
      const z = team * (i === 0 ? 9 : 1.2 + Math.floor((i - 1) / 4) * 2.55);
      b.colored(team < 0 ? 0x2e66a1 : 0xd46b35, () => {
        b.cylinder(0.15, 0.48, x, 0.96, z, b.metal, 6);
        for (const side of [-1, 1]) b.box(0.12, 0.38, 0.14, x + side * 0.22, 0.95, z, b.metal, side * 0.18);
      });
      b.colored(0xb99173, () => b.ellipsoid(point(x, 1.32, z), point(0.14, 0.16, 0.14), b.metal, 6, 3));
      for (const side of [-1, 1]) b.box(0.1, 0.55, 0.12, x + side * 0.09, 0.42, z, b.metal);
    }
    b.colored(0xf3efdf, () => b.ellipsoid(point(0.65, 0.27, 0.3), point(0.12, 0.12, 0.12), b.metal, 6, 3));
  });
}

function crowd(seed = 1): InstancedMesh {
  const dots = new InstancedMesh(new IcosahedronGeometry(0.2, 0), stadiumCrowdMaterial(), 336);
  // The shared finish also reads vertex color in baked city prototypes; supply neutral vertices here.
  ServiceBuilder.color(dots.geometry, 0xffffff);
  // Crowd dots stand in for clothing at game distance; keep their colors readable under the canopy.
  dots.name = 'svc.stadium/crowd'; dots.castShadow = false; dots.receiveShadow = false;
  const random = seededRng(seed), colors = [0xc98053, 0x4177a0, 0xe3d2a5, 0x62915e, 0x945a74, 0xd4d8d0];
  let n = 0;
  for (const side of [-1, 1]) for (let row = 0; row < 6; row++) for (let seat = 0; seat < 28; seat++) {
    dots.setMatrixAt(n, new Matrix4().makeTranslation(side * (11.15 + row * 0.62), 1.04 + row * 0.48, -10.125 + seat * 0.75));
    dots.setColorAt(n++, new Color(colors[Math.floor(random() * colors.length)]));
  }
  dots.instanceMatrix.needsUpdate = true; dots.instanceColor!.needsUpdate = true; return dots;
}

export function createStadium(options: ModelOptions = {}): Group {
  const id = 'svc.stadium', b = new StadiumBuilder(options), root = new Group(); root.name = id;
  stadiumSite(b);
  for (const state of ['empty', 'game']) {
    const extra = new StadiumBuilder(options);
    const light = state === 'game' ? stadiumFloodlightMaterial() : extra.metal;
    for (const [x, y, z] of STADIUM_LIGHT_HEADS) for (const dx of [-0.39, 0.39]) for (const dy of [-0.31, 0.31])
      extra.box(0.59, 0.46, 0.05, x + dx, y + dy, z + (z < 0 ? 0.15 : -0.15), light);
    if (state === 'game') matchPlayers(extra);
    const group = mergeByMaterial(id, [...b.parts, ...extra.parts]); group.name = `state_${state}`;
    if (state === 'game') group.add(crowd(options.seed));
    group.visible = state === (options.state === 'game' ? 'game' : 'empty');
    group.userData = { players: state === 'game' ? 22 : 0, crowd: state === 'game' ? 336 : 0,
      lightsOn: state === 'game', components: extra.components };
    root.add(group); extra.parts.forEach(part => part.geometry.dispose());
  }
  b.parts.forEach(part => part.geometry.dispose());
  STADIUM_LIGHT_HEADS.forEach((position, i) => {
    const anchor = new Object3D(); anchor.name = `anchor_light_${i}`; anchor.position.set(position[0], position[1], position[2]); root.add(anchor);
  });
  root.userData = { id, category: 'services', footprint: [4, 4], tiles: [...STADIUM_TILES],
    region: options.region ?? 'central', regionTier: 'R3', centerTile: 784, matchTile: 800,
    triangles: countTriangles(root), components: b.components, coveredGrandstands: 2,
    foodStalls: 2, parkingCars: 4, pitchSize: [12.4, 20.4], entranceFacing: '+Z' };
  return root;
}
