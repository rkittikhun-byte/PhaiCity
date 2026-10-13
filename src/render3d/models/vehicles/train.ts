/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, LatheGeometry, Shape, Vector2 } from 'three';
import { car_paint, vehicleMaterial } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { point } from './builder.js';
import { CarProfile, VehicleKit } from './kit.js';
import { finishVehicle, loft } from './forms.js';

const LOCO_PALETTES = [
  { body: 0xd9531e, stripe: 0xf5eccf }, { body: 0x8b1e22, stripe: 0xeab308 },
  { body: 0x1d4ed8, stripe: 0xef4444 }, { body: 0x15803d, stripe: 0xfde047 },
] as const;
const CAR_PALETTES = [
  { body: 0x7c2d37, trim: 0xe5d8be }, { body: 0x22543d, trim: 0xede4cd }, { body: 0x1e3a8a, trim: 0xe0e7ff },
] as const;

function bogies(b: VehicleKit, zs: readonly number[]): void {
  const wheel = vehicleMaterial('chrome', 0x657078);
  const source = new LatheGeometry([[0, -0.085], [0.35, -0.085], [0.46, -0.075],
    [0.46, -0.03], [0.45, 0.075], [0.16, 0.045], [0, 0.045]].map(([r, x]) => new Vector2(r, x)), 16).rotateZ(-Math.PI / 2);
  const wheelGeometry = applyWorldUV(source, 1); source.dispose();
  b.feature('meter-gauge-bogies-wheels-and-suspension', () => {
    for (const centerZ of zs) {
      for (const dz of [-1.15, 0, 1.15]) {
        const z = centerZ + dz;
        b.cylinder(point(0, 0.45, z), 0.07, 1.16, b.chrome, 8, 'x');
        for (const side of [-1, 1] as const) {
          b.add(wheelGeometry.clone().translate(side * 0.5, 0.46, z), wheel);
          b.wheels.push({ center: [side * 0.5, 0.46, z], radius: 0.46, width: 0.17 });
          b.box(point(side * 0.69, 0.61, z), point(0.14, 0.16, 0.28), b.trim);
          for (const offset of [-0.2, 0.2]) b.cylinder(point(side * 0.69, 0.79, z + offset), 0.085, 0.22, b.chrome, 6);
        }
      }
      for (const side of [-1, 1] as const) {
        b.box(point(side * 0.7, 0.85, centerZ), point(0.12, 0.17, 3.02), b.trim);
        b.tube(point(side * 0.68, 0.75, centerZ - 1.2), point(side * 0.68, 0.98, centerZ), 0.06, b.chrome, 8);
        b.tube(point(side * 0.68, 0.98, centerZ), point(side * 0.68, 0.75, centerZ + 1.2), 0.06, b.chrome, 8);
      }
      b.box(point(0, 0.99, centerZ), point(1.55, 0.16, 0.7), b.trim);
    }
  }); wheelGeometry.dispose();
}

function frame(b: VehicleKit): void {
  b.feature('underframe-couplers-and-end-handrails', () => {
    b.roundedBox(point(0, 1.07, 0), point(2.7, 0.2, 14.42), b.trim, 0.06);
    for (const sign of [-1, 1] as const) {
      b.box(point(0, 0.93, sign * 7.13), point(2.5, 0.24, 0.13), b.trim);
      b.roundedBox(point(0, 0.79, sign * 7.37), point(0.3, 0.22, 0.26), b.chrome, 0.04);
      for (const side of [-1, 1] as const) {
        for (const y of [1.01, 1.29]) b.box(point(side * 1.2, y, sign * 6.76), point(0.32, 0.08, 0.48), b.chrome);
        b.tube(point(side * 1.36, 1.43, sign * 6.61), point(side * 1.36, 2.49, sign * 6.61), 0.035, b.chrome, 8);
        b.tube(point(side * 1.36, 2.49, sign * 6.61), point(side * 1.29, 2.6, sign * 6.49), 0.035, b.chrome, 8);
      }
    }
    b.roundedBox(point(0, 0.73, 0), point(1.9, 0.49, 3.8), b.trim, 0.07);
    b.cylinder(point(-0.99, 0.7, 0), 0.22, 3.6, b.chrome, 16, 'z');
  });
}

function roof(b: VehicleKit, endZ = 7.15): void {
  const stations = [-endZ, -endZ + 0.13, -endZ + 0.35, -5.8, -4, -2, 0, 2, 4, 5.8, endZ - 0.35, endZ - 0.13, endZ];
  const rings = stations.map(z => {
    const end = Math.max(0, (Math.abs(z) - (endZ - 0.35)) / 0.35);
    return Array.from({ length: 17 }, (_, j) => {
      const a = (j / 16 - 0.5) * Math.PI;
      return point(Math.sin(a) * (1.3 - 0.1 * end), 3.03 + Math.cos(a) * (0.59 - 0.5 * end), z);
    });
  }); loft(b, rings, () => b.chrome, false, true);
}

export function createTrainLoco(options: ModelOptions = {}): Group {
  const palette = LOCO_PALETTES[Math.floor(seededRng(options.seed ?? 1)() * LOCO_PALETTES.length)];
  const b = new VehicleKit(palette.body), stripe = car_paint(palette.stripe);
  bogies(b, [-4.5, 4.5]); frame(b);
  b.feature('rounded-cabs-and-recessed-window-band', () => {
    const shape = new Shape(); shape.moveTo(-7.15, 1.18); shape.lineTo(7.15, 1.18);
    shape.quadraticCurveTo(7.26, 1.3, 7.21, 1.66); shape.lineTo(7.08, 2.07); shape.lineTo(6.66, 3.04);
    shape.lineTo(-6.66, 3.04); shape.lineTo(-7.08, 2.07); shape.quadraticCurveTo(-7.26, 1.6, -7.15, 1.18); shape.closePath();
    const front = [7.08, 2.1, 6.66, 3.02] as const, rear = [-7.08, 2.1, -6.66, 3.02] as const;
    const profile: CarProfile = { shape, width: 2.6, beltY: 2.08, roofY: 3.05, roofRatio: 0.89, frontGlass: front, rearGlass: rear };
    for (const sign of [-1, 1] as const) {
      const vertices = [[sign * 5.4, 2.19], [sign * 6.39, 2.19], [sign * 6.12, 2.89], [sign * 5.4, 2.89]] as const;
      b.windowHole(shape, vertices); b.sideWindow(vertices, profile);
    }
    b.profileBody(profile, 'display'); b.endGlass(front, profile, true); b.endGlass(rear, profile, false); roof(b, 6.75);
    for (const side of [-1, 1] as const) {
      b.sideSheet([[-6.95, 1.43], [6.95, 1.43], [6.91, 1.65], [-6.91, 1.65]], profile, stripe, [side], -0.004);
      for (const z of [-2.2, 0, 2.2]) {
        b.sideSheet([[z - 0.72, 2.05], [z + 0.72, 2.05], [z + 0.72, 2.79], [z - 0.72, 2.79]], profile, b.trim, [side], -0.004);
        for (let i = 0; i < 7; i++) b.box(point(side * 1.308, 2.11 + i * 0.095, z), point(0.025, 0.025, 1.32), b.chrome);
      }
    }
    for (const sign of [-1, 1] as const) {
      b.tube(point(0, 2.14, sign * 7.06), point(0, 3.01, sign * 6.67), 0.035, b.trim, 8);
      for (const side of [-1, 1] as const) b.cylinder(point(side * 0.86, 1.9, sign * 7.17), 0.11, 0.045, b.lamp, 16, 'z');
      b.cylinder(point(0, 3.14, sign * 6.65), 0.12, 0.1, b.lamp, 16, 'z');
    }
  });
  b.feature('roof-fans-and-exhaust', () => {
    for (const z of [-1.8, -0.2]) {
      b.cylinder(point(0, 3.65, z), 0.62, 0.12, b.trim, 24);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4; b.tube(point(0, 3.72, z), point(Math.sin(a) * 0.55, 3.72, z + Math.cos(a) * 0.55), 0.02, b.chrome, 6);
      }
    }
    b.cylinder(point(0, 3.72, 1.4), 0.22, 0.2, b.chrome, 20);
    b.smokeAnchor('anchor_smoke_0', point(0, 3.82, 1.4));
  });
  return finishVehicle(b, 'veh.train_loco', [1, 2], options, { palette, gauge: 1, bogieCenters: [-4.5, 4.5] });
}

export function createTrainCar(options: ModelOptions = {}): Group {
  const palette = CAR_PALETTES[Math.floor(seededRng(options.seed ?? 1)() * CAR_PALETTES.length)];
  const b = new VehicleKit(palette.body), trim = car_paint(palette.trim), seat = vehicleMaterial('plastic_trim_black', 0x98683b);
  bogies(b, [-4.8, 4.8]); frame(b);
  b.feature('open-third-class-window-band-and-rounded-roof', () => {
    const shape = new Shape(); shape.moveTo(-7.17, 1.17); shape.lineTo(7.17, 1.17);
    shape.quadraticCurveTo(7.29, 1.35, 7.19, 2.74); shape.quadraticCurveTo(7.17, 3.04, 6.98, 3.04);
    shape.lineTo(-6.98, 3.04); shape.quadraticCurveTo(-7.23, 3.04, -7.17, 1.17); shape.closePath();
    const profile: CarProfile = { shape, width: 2.7, beltY: 2.79, roofY: 3.08, roofRatio: 0.965 };
    const zs = [-5.5, -4.2, -2.9, -1.6, -0.3, 1, 2.3, 3.6, 4.9];
    for (const z of zs) {
      // Each window is an actual beveled opening; no opaque sheet is inserted.
      b.windowHole(shape, [[z - 0.49, 1.98], [z + 0.49, 1.98], [z + 0.49, 2.75], [z - 0.49, 2.75]]);
      for (const side of [-1, 1] as const) {
        b.box(point(side * 1.31, 1.94, z), point(0.095, 0.05, 1.03), trim);
        b.tube(point(side * 1.325, 2.1, z - 0.5), point(side * 1.325, 2.1, z + 0.5), 0.018, b.chrome, 6);
        b.box(point(side * 0.71, 1.51, z), point(1.01, 0.12, 0.61), seat);
        b.box(point(side * 0.71, 1.75, z - 0.26), point(1.01, 0.47, 0.07), seat);
      }
    }
    b.profileBody(profile, 'display'); roof(b);
    // Thin interior liners do not close the openings, unlike an extruded solid body core.
    b.box(point(0, 1.24, 0), point(2.5, 0.06, 14.1), seat);
    for (const side of [-1, 1] as const) b.sideSheet([[-6.8, 1.77], [6.8, 1.77], [6.8, 1.86], [-6.8, 1.86]], profile, trim, [side], -0.004);
    for (const sign of [-1, 1] as const) {
      b.roundedBox(point(0, 2.07, sign * 7.22), point(0.84, 1.77, 0.08), trim, 0.035);
      b.box(point(0, 2.47, sign * 7.27), point(0.54, 0.58, 0.016), b.glass);
      b.box(point(0.3, 1.94, sign * 7.281), point(0.045, 0.14, 0.015), b.chrome);
    }
  });
  b.feature('roof-ventilators', () => {
    for (const z of [-4.5, -2.2, 0, 2.2, 4.5]) b.ellipsoid(point(0, 3.71, z), point(0.16, 0.12, 0.3), b.chrome, 12, 6);
  });
  return finishVehicle(b, 'veh.train_car', [1, 2], options, { palette, gauge: 1, bogieCenters: [-4.8, 4.8], openWindows: 18 });
}
