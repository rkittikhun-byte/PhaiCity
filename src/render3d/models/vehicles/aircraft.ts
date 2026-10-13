/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, PlaneGeometry, Shape } from 'three';
import { car_paint, vehicleMaterial } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import { mergeByMaterial } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { point } from './builder.js';
import { VehicleKit } from './kit.js';
import { finishVehicle, latheZ, loft, wing } from './forms.js';

const HELI_PALETTES = [
  { body: 0x1d4ed8, accent: 0xf5eccf },
  { body: 0xca8a04, accent: 0x1f2937 },
  { body: 0x059669, accent: 0xffffff },
] as const;

export function createHelicopter(options: ModelOptions = {}): Group {
  const palette = HELI_PALETTES[Math.floor(seededRng(options.seed ?? 1)() * HELI_PALETTES.length)];
  const b = new VehicleKit(palette.body), accent = car_paint(palette.accent);
  // Teardrop stations: rounded broad cockpit, gently narrowing rear cabin. Cockpit replaces the shell cells.
  b.feature('teardrop-cabin-and-inset-cockpit', () => {
    const stations = [[-2.15, 0.13, 1.76, 0.24], [-1.8, 0.65, 1.65, 0.78], [-1.1, 0.96, 1.62, 0.99],
      [-0.3, 1.02, 1.64, 1.03], [0.35, 1, 1.65, 1.01], [0.9, 0.94, 1.63, 0.95],
      [1.45, 0.8, 1.59, 0.82], [1.9, 0.59, 1.53, 0.62], [2.25, 0.32, 1.46, 0.35], [2.48, 0.02, 1.43, 0.03]];
    const rings = stations.map(([z, rx, y, ry]) => Array.from({ length: 32 }, (_, j) => {
      const a = j * Math.PI / 16; return point(rx * Math.sin(a), y + ry * Math.cos(a), z);
    }));
    loft(b, rings, (_c, i, j) => {
      // Angular boundaries follow the curved surface continuously; world-Y tests create jagged glazing.
      const front = i >= 5 && i <= 7 && (j >= 1 && j <= 9 || j >= 22 && j <= 30);
      const side = i >= 1 && i < 5 && (j >= 4 && j <= 9 || j >= 22 && j <= 27);
      if (front || side) return b.glass;
      return i >= 1 && i <= 7 && j >= 12 && j <= 19 ? accent : b.paint;
    }, true, true);
    for (const side of [-1, 1]) {
      b.tube(point(side * 1.003, 1.73, -0.5), point(side * 0.95, 2.27, -0.5), 0.028, b.trim, 6);
      b.roundedBox(point(side * 1.01, 1.51, -0.45), point(0.035, 0.055, 0.26), b.chrome, 0.012);
    }
    b.ellipsoid(point(0, 2.61, -0.25), point(0.6, 0.44, 1.12), b.paint, 28, 14);
    for (const side of [-1, 1]) {
      b.cylinder(point(side * 0.48, 2.83, -0.95), 0.13, 0.36, b.chrome, 16, 'z');
      b.cylinder(point(side * 0.48, 2.83, -1.14), 0.1, 0.02, b.trim, 16, 'z');
    }
  });
  b.feature('curved-skids-and-camera-gimbal', () => {
    for (const side of [-1, 1]) {
      const path = [point(side * 0.9, 0.05, -2.5), point(side * 0.9, 0.05, 1.9),
        point(side * 0.9, 0.1, 2.16), point(side * 0.9, 0.25, 2.34)];
      for (let i = 0; i < path.length - 1; i++) b.tube(path[i], path[i + 1], 0.05, b.chrome, 12);
      for (const z of [-1.05, 0.85]) b.tube(point(side * 0.9, 0.1, z), point(side * 0.48, 0.9, z), 0.055, b.chrome, 10);
    }
    b.ellipsoid(point(0, 0.69, 1.98), point(0.24, 0.21, 0.24), b.trim, 20, 10);
    b.cylinder(point(0, 0.69, 2.2), 0.13, 0.035, b.glass, 20, 'z');
    b.cylinder(point(0, 0.49, 2.01), 0.07, 0.04, b.lamp, 12, 'y');
  });
  b.feature('tail-boom-and-stabilizers', () => {
    const rings = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11, z = -5.08 + 3.35 * t, r = 0.105 + 0.28 * t;
      return Array.from({ length: 20 }, (_, j) => { const a = j * Math.PI / 10; return point(r * Math.sin(a), 2.48 - 0.66 * t + r * Math.cos(a), z); });
    }); loft(b, rings, () => b.paint, true, true);
    for (const side of [-1, 1]) wing(b, [[0, 2.2, -3.91, -4.6, 0.065], [side * 1.03, 2.24, -4.17, -4.53, 0.025]], accent);
    const fin = new Shape(); fin.moveTo(-5.28, 2.22); fin.lineTo(-4.44, 2.24); fin.lineTo(-4.83, 3.02);
    fin.quadraticCurveTo(-5.12, 3.18, -5.22, 2.94); fin.closePath();
    b.profileBody({ shape: fin, width: 0.13, beltY: 2.3, roofY: 3.16, roofRatio: 1 }, 'full', accent);
    b.cylinder(point(0, 3.08, 0.4), 0.14, 0.24, b.chrome, 16);
  });
  // Dedicated finishes keep each moving rotor in one batch and preserve both original pivots.
  const main = new VehicleKit(0x181818), mainMat = vehicleMaterial('plastic_trim_black', 0x181818);
  main.ellipsoid(point(0, 0, 0), point(0.26, 0.07, 0.26), mainMat, 16, 8);
  for (const side of [-1, 1]) wing(main, [[side * 0.2, 0, 0.2, -0.16, 0.025], [side * 2.8, 0, 0.12, -0.2, 0.018],
    [side * 4.1, 0, -0.04, -0.26, 0.01]], mainMat);
  const animMain = mergeByMaterial('veh.helicopter/rotor_main', main.parts); main.parts.forEach(p => p.geometry.dispose());
  animMain.name = 'anim_rotor_main'; animMain.position.set(0, 3.2, 0.4); b.addAnimNode(animMain);
  const tail = new VehicleKit(0x2e2e2e), tailMat = vehicleMaterial('plastic_trim_black', 0x2e2e2e);
  tail.cylinder(point(0, 0, 0), 0.1, 0.1, tailMat, 12, 'x');
  tail.roundedBox(point(0, 0, 0), point(0.04, 1.3, 0.14), tailMat, 0.014);
  tail.roundedBox(point(0, 0, 0), point(0.04, 0.14, 1.3), tailMat, 0.014);
  const animTail = mergeByMaterial('veh.helicopter/rotor_tail', tail.parts); tail.parts.forEach(p => p.geometry.dispose());
  animTail.name = 'anim_rotor_tail'; animTail.position.set(-0.16, 2.5, -5); b.addAnimNode(animTail);
  return finishVehicle(b, 'veh.helicopter', [1, 1], options, { palette, rotorAxes: ['Y', 'X'] });
}

export function createAirplane(options: ModelOptions = {}): Group {
  const b = new VehicleKit(0x237346), white = car_paint(0xf4f3ef);
  b.feature('round-lathe-fuselage-and-cockpit-band', () => {
    const samples: [number, number][] = [[-14, 0], [-13.75, 0.12], [-13.2, 0.36], [-12.4, 0.65], [-11.5, 1.05], [-10.5, 1.4], [-9.2, 1.6]];
    for (let z = -8.5; z < 9; z += 1.3) samples.push([z, 1.6], [z + 0.62, 1.6]);
    samples.push([9.5, 1.57], [10.2, 1.47], [10.85, 1.33], [11.5, 1.13], [12.1, 0.88], [12.75, 0.6], [13.3, 0.36], [13.72, 0.16], [14, 0]);
    latheZ(b, samples, point(0, 2.5, 0), c => {
      const cockpit = c.z > 10.2 && c.z < 12.75 && c.y > 2.79 && c.y < 3.42;
      const passenger = Math.abs(c.x) > 1.45 && c.y > 2.51 && c.y < 2.99 && c.z > -8.5 && c.z < 8.5 && ((c.z + 8.5) % 1.3) < 0.62;
      return cockpit || passenger ? b.glass : c.y < 1.94 ? b.paint : white;
    }, 32);
    for (const side of [-1, 1]) for (const z of [-9.1, 9.05]) {
      // Recessed door outlines sit above the stripe, with simple molded handles.
      b.tube(point(side * 1.54, 2.27, z - 0.42), point(side * 1.47, 3.11, z - 0.42), 0.018, b.trim, 6);
      b.tube(point(side * 1.54, 2.27, z + 0.42), point(side * 1.47, 3.11, z + 0.42), 0.018, b.trim, 6);
      b.tube(point(side * 1.47, 3.11, z - 0.42), point(side * 1.47, 3.11, z + 0.42), 0.018, b.trim, 6);
      b.box(point(side * 1.604, 2.37, z + 0.22), point(0.03, 0.045, 0.17), b.chrome);
    }
  });
  b.feature('swept-airfoil-wings-and-tail', () => {
    for (const side of [-1, 1]) {
      wing(b, [[side * 1.05, 1.87, 3.4, -3.3, 0.26], [side * 4.5, 2.03, 1.25, -4.6, 0.19],
        [side * 8.5, 2.28, -1.7, -5.7, 0.12], [side * 11.8, 2.58, -4.15, -6.15, 0.055]], white);
      b.tube(point(side * 2, 1.91, -2.7), point(side * 10.7, 2.55, -5.84), 0.017, b.trim, 6);
      const tip = new Shape(); tip.moveTo(-6.15, 2.57); tip.lineTo(-4.15, 2.57); tip.lineTo(-5.12, 3.69); tip.lineTo(-6.13, 3.68); tip.closePath();
      const first = b.parts.length; b.profileBody({ shape: tip, width: 0.12, beltY: 2.6, roofY: 3.7, roofRatio: 1 });
      for (const part of b.parts.slice(first)) part.geometry.translate(side * 11.8, 0, 0);
      wing(b, [[side * 0.36, 3.17, -9.48, -12.9, 0.12], [side * 2.5, 3.28, -11, -13.25, 0.075],
        [side * 4.5, 3.4, -12, -13.65, 0.025]], white);
    }
    const fin = new Shape(); fin.moveTo(-13.5, 2.77); fin.lineTo(-9.8, 3.21); fin.lineTo(-11.8, 6.92);
    fin.quadraticCurveTo(-12, 7.12, -12.26, 7); fin.lineTo(-13.12, 6.96); fin.closePath();
    b.profileBody({ shape: fin, width: 0.24, beltY: 3, roofY: 7, roofRatio: 0.58 });
    for (const side of [-1, 1]) b.tube(point(side * 0.12, 3.7, -12.74), point(side * 0.07, 6.6, -12.84), 0.017, b.trim, 6);
  });
  b.feature('open-nacelles-fan-blades-and-landing-gear', () => {
    for (const side of [-1, 1]) {
      const x = side * 4.2;
      b.box(point(x, 1.85, 0.2), point(0.2, 0.65, 1.75), white);
      // Hollow rolled intake lip and tapered exhaust: engine interior is visible from +Z.
      latheZ(b, [[-1.28, 0.42], [-1.13, 0.57], [-0.75, 0.72], [0.6, 0.74], [1.23, 0.71], [1.43, 0.66],
        [1.45, 0.6], [1.33, 0.565], [0.97, 0.54], [0.62, 0.5]], point(x, 1.29, 0.2), c => c.z > 1.46 ? b.chrome : b.paint, 24);
      b.cylinder(point(x, 1.29, 1.05), 0.52, 0.035, b.trim, 32, 'z');
      latheZ(b, [[0.96, 0.17], [1.09, 0.16], [1.25, 0.11], [1.38, 0]], point(x, 1.29, 0), b.chrome, 20);
      for (let j = 0; j < 12; j++) {
        const a = j * Math.PI / 6, r = 0.33;
        b.box(point(x + Math.sin(a) * r, 1.29 + Math.cos(a) * r, 1.08), point(0.06, 0.34, 0.025), b.chrome, 0, 0, -a + 0.25);
      }
      b.cylinder(point(x, 1.29, -1.11), 0.33, 0.18, b.trim, 24, 'z');
    }
    for (const [x, z, r] of [[0, 9.2, 0.35], [-3.2, -1.2, 0.45], [3.2, -1.2, 0.45]]) {
      b.tube(point(x, r, z), point(x, 1.5, z - 0.12), 0.085, b.chrome, 12);
      b.tube(point(x, 0.6, z), point(x, 1.58, z - 0.55), 0.04, b.chrome, 8);
      for (const dx of [-0.2, 0.2]) b.wheelAt(point(x + dx, r, z), r, r === 0.35 ? 0.14 : 0.18, { rim: 'dish', faces: [dx < 0 ? -1 : 1], segments: 12 });
    }
  });
  b.feature('fictional-phai-air-livery', () => {
    const sign = thaiSign('ไผ่แอร์', 0xf4f3ef, 0x237346, [4.6, 0.55]);
    for (const side of [-1, 1]) {
      const geometry = new PlaneGeometry(4.6, 0.55).rotateY(side * Math.PI / 2).translate(side * 1.59, 2.15, 5.6);
      b.add(geometry, sign);
      // Abstract bamboo leaves, not a real airline logo.
      b.face([point(side * 0.111, 5.05, -12.35), point(side * 0.105, 5.9, -12.75), point(side * 0.09, 6.46, -12.12)], white);
    }
  });
  return finishVehicle(b, 'veh.airplane', [3, 3], options, { airline: 'ไผ่แอร์', livery: [0x237346, 0xf4f3ef], length: 28 });
}
