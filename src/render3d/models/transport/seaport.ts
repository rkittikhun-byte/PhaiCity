/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { InstancedMesh, Matrix4, Object3D } from 'three';
import { transportCraneMaterial, transportMotionDepthMaterial } from '../../materials/library.js';
import { mergeGeometry } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import { seededRng } from '../../rng.js';
import { TransportBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const CRANE_BASES = [[-9, 0.55, 11], [9, 0.55, 11]] as const;
export const CRANE_TRAVEL = 2;

function gantryCrane(options: ModelOptions) {
  const b = new TransportBuilder(options);
  b.colored(0xc99343, () => {
    for (const x of [-2.6, 2.6]) for (const z of [-2.5, 2.5]) {
      b.pole(point(x, 0.55, z), point(x * 0.75, 12.8, z), 0.22, b.metal, 6);
      b.box(0.85, 0.6, 1.5, x, 0.55, z, b.metal);
      for (const dz of [-0.48, 0.48]) b.cylinder(0.32, 0.9, x, 0.38, z + dz, b.metal, 8, Math.PI / 2);
    }
    for (const z of [-2.5, 2.5]) b.box(6.5, 0.55, 0.55, 0, 12.8, z, b.metal);
    for (const x of [-0.65, 0.65]) {
      b.box(0.25, 0.55, 15.6, x, 13.35, 0.45, b.metal);
      b.pole(point(x, 13.5, -4.8), point(x, 20, -2), 0.18, b.metal, 6);
      b.pole(point(x, 20, -2), point(x, 13.5, 8.2), 0.06, b.metal, 4);
      b.pole(point(x, 20, -2), point(x, 13.5, -7.2), 0.06, b.metal, 4);
    }
    b.box(2.3, 1.45, 1.8, 0, 12, 0.3, b.metal);
    b.box(6.3, 0.3, 2.7, 0, 6.7, 6.1, b.metal);
    for (const x of [-1.1, 1.1]) for (const z of [5.3, 6.9]) b.pole(point(x, 13.1, z), point(x, 6.9, z), 0.025, b.metal, 4);
  });
  b.colored(0x314d53, () => b.box(1.85, 0.65, 0.04, 0, 12.1, 1.22, b.metal));
  const geometry = mergeGeometry(b.parts.map(part => part.geometry)); b.parts.forEach(part => part.geometry.dispose());
  return geometry;
}

export function createSeaport(options: ModelOptions = {}) {
  const b = new TransportBuilder(options), random = seededRng(options.seed), palette = b.kit.neutralPalette(options.seed);
  b.hubSite(4);
  b.feature('concrete-quay-facing-water', () => {
    b.colored(0xa8afa7, () => {
      b.box(39, 0.45, 8, 0, 0.325, 15.5, b.stone);
      b.box(39, 0.7, 0.5, 0, 0.4, 19.15, b.stone);
    });
    for (const x of [-16, -8, 0, 8, 16]) {
      b.colored(0x353c39, () => b.box(0.9, 0.65, 0.12, x, 0.44, 19.42, b.metal));
      b.cylinder(0.2, 0.4, x + 0.75, 0.72, 18.7, b.metal, 8);
    }
    for (const z of [8.5, 13.5]) b.box(37, 0.12, 0.13, 0, 0.65, z, b.metal);
  });
  const colors = [0x8e4236, 0x47797c, 0x5d7452, 0xbd9b4d, 0x647b9b, 0xa17a67], stacks: number[] = [];
  b.feature('multicolored-container-stacks', () => {
    for (const z of [-5, 1]) for (const x of [-8, 0, 8]) {
      const high = 2 + Math.floor(random() * 3); stacks.push(high);
      for (let floor = 0; floor < high; floor++) b.colored(colors[Math.floor(random() * colors.length)], () => {
        b.mass(6.06, 2.59, 2.44, x, 0.14 + 1.295 + floor * 2.65, z, b.metal);
        for (let i = 0; i < 14; i++) for (const side of [-1, 1]) b.box(0.075, 2.4, 0.05,
          x - 2.85 + i * 0.44, 1.43 + floor * 2.65, z + side * 1.23, b.metal);
        for (const dz of [-0.75, 0.75]) b.box(0.045, 2.33, 0.045, x + 3.04, 1.43 + floor * 2.65, z + dz, b.metal);
      });
    }
  });
  b.feature('warehouse', () => {
    b.colored(palette.wall, () => b.mass(15, 5.6, 7, -10.5, 2.95, -13, b.paint));
    b.colored(0x8e9993, () => b.box(15.3, 0.2, 7.3, -10.5, 5.88, -13, b.sheet));
    for (const x of [-15, -10.5, -6]) b.colored(0x567373, () => b.box(3.6, 3.5, 0.08, x, 1.9, -9.46, b.metal));
    b.shopSign('คลังสินค้า', 7, 0.9, -10.5, 4.38, -9.38);
  });
  b.feature('terminal-tractors', () => {
    for (const z of [-3, 3]) {
      b.colored(0xdcce9b, () => { b.box(1.9, 0.55, 3.6, -15.8, 0.92, z, b.metal);
        b.box(1.65, 1.3, 1.35, -15.8, 1.8, z + 0.9, b.metal); });
      b.box(1.35, 0.68, 0.06, -15.8, 2.02, z + 1.62, b.glass);
      for (const x of [-16.7, -14.9]) for (const dz of [-1, 1]) b.cylinder(0.4, 0.22, x, 0.55, z + dz, b.metal, 8, Math.PI / 2);
    }
  });
  b.feature('entrance-gate-and-guard-booth', () => {
    b.colored(palette.wall, () => b.mass(3.5, 2.8, 3.2, 14.5, 1.5, -14.5, b.paint));
    b.colored(0x8e9993, () => b.box(3.8, 0.15, 3.5, 14.5, 3, -14.5, b.sheet));
    b.box(2.6, 1.05, 0.04, 14.5, 1.78, -12.87, b.glass);
    for (const x of [-1, 9]) b.box(0.3, 4.1, 0.3, x, 2.15, -18.2, b.metal);
    b.shopSign('ท่าเรือสินค้า', 10.5, 1.1, 4, 4, -18.02);
    b.colored(0xd5b269, () => b.box(8.8, 0.15, 0.15, 4, 1.25, -17.7, b.metal));
  });
  const root = b.finishHub('port.seaport', 4, 698, 'R3', { quaySide: '+Z', craneTravel: CRANE_TRAVEL, containerStackHeights: stacks,
    terminalTractors: 2, entranceSide: '-Z', palette });
  const cranes = new InstancedMesh(gantryCrane(options), transportCraneMaterial(), 2);
  cranes.name = 'port.seaport/cranes'; cranes.castShadow = cranes.receiveShadow = true;
  cranes.customDepthMaterial = transportMotionDepthMaterial(cranes.material);
  CRANE_BASES.forEach((base, i) => {
    const pivot = new Object3D(); pivot.name = `anim_crane_${i}`; pivot.position.set(base[0], base[1], base[2]);
    pivot.userData = { axis: 'X', baseX: base[0], instance: i }; root.add(pivot);
    cranes.setMatrixAt(i, new Matrix4().makeTranslation(base[0], base[1], base[2]));
  });
  cranes.computeBoundingBox(); cranes.computeBoundingSphere(); root.add(cranes); b.refreshTriangles(root);
  return root;
}
