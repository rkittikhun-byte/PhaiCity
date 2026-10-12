/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color, Float32BufferAttribute, MeshStandardMaterial, Shape } from 'three';
import { vehicleDisplayMaterial } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { getRegionKit } from '../../regional/index.js';
import { point } from './builder.js';
import { CarProfile, VehicleKit } from './kit.js';
import type { ModelOptions } from '../registry.js';

export const PICKUP_PAINTS = [0xf8fafc, 0xf8fafc, 0xf8fafc, 0xf8fafc, 0xc4c9cc, 0xc4c9cc,
  0x5b6469, 0x24292c, 0x294a71, 0x9f343a, 0x9e8970] as const;
export const SEDAN_PAINTS = [0xc4c9cc, 0xf8fafc, 0x46545d, 0x315d8d, 0xaa4045, 0x9e8970] as const;
type WindowOutline = readonly (readonly [number, number])[];

function finishCar(b: VehicleKit, id: string, options: ModelOptions, metadata: Record<string, unknown> = {}) {
  const root = b.finish(id, [1, 1], options, id === 'veh.songthaew' ? 'R2' : 'R3');
  Object.assign(root.userData, { kit: 'profile-car-v1', front: '+Z', wheelSegments: 16,
    wheelArchGap: 0.06, greenhouseRoofRatio: 0.875, components: b.components, ...metadata }); return root;
}

function greenhouse(b: VehicleKit, profile: CarProfile, windows: readonly WindowOutline[]): void {
  windows.forEach(window => b.windowHole(profile.shape, window));
  b.feature('continuous-profile-body-with-wheel-arches', () => b.profileBody(profile));
  b.feature('inset-tapered-greenhouse', () => {
    windows.forEach(window => b.sideWindow(window, profile));
    if (windows.length === 2) {
      const frontRearZ = windows[0][0][0], rearFrontZ = windows[1][1][0];
      const bottom = Math.max(windows[0][0][1], windows[1][1][1]), top = Math.min(windows[0][3][1], windows[1][2][1]);
      for (const side of [-1, 1]) {
        const pillar = [[rearFrontZ, bottom], [frontRearZ, bottom], [frontRearZ, top], [rearFrontZ, top]]
          .map(([z, y]) => point(side * (b.widthAt(y, profile) + 0.002), y, z));
        b.face(side > 0 ? pillar.reverse() : pillar, b.trim);
      }
    }
    if (profile.frontGlass) b.endGlass(profile.frontGlass, profile, true);
    if (profile.rearGlass) b.endGlass(profile.rearGlass, profile, false);
    // Window seals follow the real edge; the glass stays 15 mm inside the side body surface.
    for (const window of windows) for (const side of [-1, 1]) for (let i = 0; i < window.length; i++) {
      const [z, y] = window[i], [nextZ, nextY] = window[(i + 1) % window.length];
      b.tube(point(side * (b.widthAt(y, profile) - 0.005), y, z),
        point(side * (b.widthAt(nextY, profile) - 0.005), nextY, nextZ), 0.018, b.trim, 6);
    }
  });
}

function sedanProfile(b: VehicleKit): { profile: CarProfile; windows: WindowOutline[] } {
  const shape = new Shape();
  shape.moveTo(2.245, 0.57); shape.quadraticCurveTo(2.245, 0.9, 2.03, 0.96);
  shape.quadraticCurveTo(1.55, 1, 1.01, 1.03); shape.lineTo(0.43, 1.37);
  shape.quadraticCurveTo(0.3, 1.405, 0.11, 1.405); shape.lineTo(-0.7, 1.405);
  shape.quadraticCurveTo(-0.83, 1.405, -0.93, 1.31); shape.lineTo(-1.5, 1.03);
  shape.quadraticCurveTo(-1.91, 1.01, -2.12, 0.91); shape.quadraticCurveTo(-2.245, 0.86, -2.245, 0.54);
  b.archBottom(shape, -2.245, 2.245, 0.265, 0.32, [-1.4, 1.4]);
  const profile: CarProfile = { shape, width: 1.8, beltY: 1.015, roofY: 1.45,
    frontGlass: [1.01, 1.03, 0.43, 1.37], rearGlass: [-1.5, 1.03, -0.93, 1.31] };
  const windows: WindowOutline[] = [ [[0.08, 1.07], [0.91, 1.07], [0.4, 1.32], [0.08, 1.35]],
    [[-1.32, 1.07], [-0.025, 1.07], [-0.025, 1.35], [-0.7, 1.35]] ];
  return { profile, windows };
}

export function createSedan(options: ModelOptions = {}) {
  const color = SEDAN_PAINTS[Math.floor(seededRng(options.seed ?? 1)() * SEDAN_PAINTS.length)], b = new VehicleKit(color);
  const { profile, windows } = sedanProfile(b);
  greenhouse(b, profile, windows); b.wheelSet([-1.4, 1.4], 0.32, 0.2, 0.8);
  b.fittings(4.6, 1.8, 0.91, 0.75);
  b.feature('four-door-handles', () => {
    for (const side of [-1, 1]) for (const z of [-0.93, 0.12]) b.box(point(side * 0.906, 0.99, z), point(0.025, 0.04, 0.19), b.chrome);
  });
  return finishCar(b, 'veh.sedan', options, { paintColor: color, bodySize: [1.8, 1.45, 4.6], doors: 4 });
}

/** Compact showroom prop: same silhouette/windows as the road sedan, without close-up wheel and trim detail. */
export function sedanDisplayParts(color: number) {
  const b = new VehicleKit(color), { profile, windows } = sedanProfile(b);
  windows.forEach(window => b.windowHole(profile.shape, window)); b.profileBody(profile, 'display');
  windows.forEach(window => b.sideWindow(window, profile));
  b.endGlass(profile.frontGlass!, profile, true); b.endGlass(profile.rearGlass!, profile, false);
  for (const z of [-1.4, 1.4]) for (const side of [-1, 1]) {
    b.cylinder(point(side * 0.8, 0.32, z), 0.32, 0.2, b.tire, 8, 'x');
    b.cylinder(point(side * 0.906, 0.32, z), 0.19, 0.018, b.chrome, 6, 'x');
  }
  const finish = vehicleDisplayMaterial();
  for (const part of b.parts) {
    const c = new Color((part.material as MeshStandardMaterial).color), vertices = part.geometry.getAttribute('position').count;
    const values = new Float32Array(vertices * 3);
    for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
    part.geometry.setAttribute('color', new Float32BufferAttribute(values, 3)); part.material = finish;
  }
  return b.parts;
}

function pickupChassis(options: ModelOptions, color: number, cab: 'double' | 'extended' | 'single', accessory: 'canopy' | 'roll-bar' | 'passenger') {
  const b = new VehicleKit(color), rear = { double: -0.86, extended: -0.37, single: 0.08 }[cab], shape = new Shape();
  shape.moveTo(2.605, 0.7); shape.quadraticCurveTo(2.605, 1.03, 2.43, 1.1);
  shape.quadraticCurveTo(1.68, 1.14, 1.08, 1.23); shape.lineTo(0.52, 1.71);
  shape.quadraticCurveTo(0.4, 1.755, 0.32, 1.755); shape.lineTo(rear + 0.16, 1.755);
  shape.quadraticCurveTo(rear, 1.755, rear, 1.59); shape.lineTo(rear, 1.275);
  shape.lineTo(-2.43, 1.275); shape.quadraticCurveTo(-2.605, 1.275, -2.605, 1.1); shape.lineTo(-2.605, 0.38);
  b.archBottom(shape, -2.605, 2.605, 0.36, 0.38, [-1.62, 1.62]);
  const profile: CarProfile = { shape, width: 1.85, beltY: 1.275, roofY: 1.8,
    frontGlass: [1.08, 1.23, 0.52, 1.71], rearGlass: [rear, 1.29, rear, 1.7], openBed: [-2.48, rear - 0.015] };
  const windows: WindowOutline[] = cab === 'single' ? [[[rear + 0.07, 1.325], [0.93, 1.325], [0.47, 1.69], [rear + 0.12, 1.69]]]
    : [[[0.1, 1.325], [0.93, 1.325], [0.47, 1.69], [0.1, 1.69]],
      [[rear + 0.07, 1.325], [0.01, 1.325], [0.01, 1.69], [rear + 0.12, 1.69]]];
  greenhouse(b, profile, windows); b.wheelSet([-1.62, 1.62], 0.38, 0.24, 0.81);
  b.fittings(5.3, 1.85, 1.09, 0.89);
  b.feature('lined-open-bed-and-tailgate', () => {
    const front = rear - 0.1, back = -2.5;
    b.box(point(0, 0.81, (back + front) / 2), point(1.61, 0.04, front - back), b.trim);
    for (const side of [-1, 1]) {
      const lining = [point(side * 0.83, 0.83, back), point(side * 0.83, 1.28, back),
        point(side * 0.83, 1.28, front), point(side * 0.83, 0.83, front)];
      b.face(side > 0 ? lining.reverse() : lining, b.trim);
    }
    b.box(point(0, 1.045, back), point(1.67, 0.47, 0.055), b.paint);
    b.box(point(0, 1.1, -2.651), point(0.27, 0.08, 0.025), b.trim);
    for (const side of [-1, 1]) for (const z of cab === 'single' ? [0.26] : [rear + 0.16, 0.17])
      b.box(point(side * 0.923, 1.22, z), point(0.025, 0.04, 0.2), b.chrome);
  });
  if (accessory === 'roll-bar') b.feature('roll-bar', () => {
    const z = rear - 0.14;
    for (const side of [-1, 1]) b.tube(point(side * 0.77, 1.28, z), point(side * 0.77, 1.735, z), 0.035, b.chrome);
    b.tube(point(-0.77, 1.735, z), point(0.77, 1.735, z), 0.035, b.chrome);
  });
  if (accessory === 'canopy') b.feature('glazed-canopy', () => {
    const s = new Shape(), back = -2.5, front = rear - 0.08;
    s.moveTo(back, 1.29); s.lineTo(front, 1.29); s.lineTo(front, 1.7);
    s.quadraticCurveTo(front, 1.755, front - 0.09, 1.755); s.lineTo(back + 0.09, 1.755);
    s.quadraticCurveTo(back, 1.755, back, 1.69); s.closePath();
    const canopy: CarProfile = { shape: s, width: 1.77, beltY: 1.29, roofY: 1.8, rearGlass: [back, 1.3, back, 1.72] };
    const window: WindowOutline = [[back + 0.15, 1.37], [front - 0.15, 1.37], [front - 0.15, 1.65], [back + 0.15, 1.65]];
    b.windowHole(s, window); b.profileBody(canopy); b.sideWindow(window, canopy); b.endGlass(canopy.rearGlass!, canopy, false);
  });
  return { b, rear, profile, options };
}

export function createPickup(options: ModelOptions = {}) {
  const random = seededRng(options.seed ?? 1), color = PICKUP_PAINTS[Math.floor(random() * PICKUP_PAINTS.length)], choice = random();
  const cab = choice < 0.7 ? 'double' : choice < 0.94 ? 'extended' : 'single';
  const accessory = (options.seed ?? 1) % 2 === 0 ? 'canopy' : 'roll-bar';
  const { b } = pickupChassis(options, color, cab, accessory);
  return finishCar(b, 'veh.pickup', options, { paintColor: color, cabType: cab, accessory, hasCanopy: accessory === 'canopy',
    doors: cab === 'double' ? 4 : 2, bodySize: [1.85, 1.8, 5.3], bedWallHeight: 0.5 });
}

export function createSongthaew(options: ModelOptions = {}) {
  const color = getRegionKit(options.region).vehicles.songthaewColor(options.seed), { b, rear } = pickupChassis(options, color, 'single', 'passenger');
  b.feature('two-bench-rows', () => {
    for (const side of [-1, 1]) {
      b.roundedBox(point(side * 0.6, 1.03, -1.22), point(0.35, 0.12, 2.15), b.trim, 0.035);
      b.box(point(side * 0.77, 1.23, -1.22), point(0.08, 0.36, 2.15), b.trim);
    }
  });
  b.feature('passenger-roof-frame-and-boarding-step', () => {
    for (const z of [-2.4, -1.25, rear - 0.12]) for (const side of [-1, 1]) {
      b.tube(point(side * 0.82, 1.28, z), point(side * 0.82, 2.17, z), 0.03, b.chrome, 6);
    }
    b.roundedBox(point(0, 2.205, -1.23), point(1.82, 0.12, 2.59), b.paint, 0.045);
    for (const side of [-1, 1]) {
      b.tube(point(side * 0.81, 1.5, -2.42), point(side * 0.81, 1.5, -0.1), 0.025, b.chrome, 6);
      b.tube(point(side * 0.78, 2.29, -2.37), point(side * 0.78, 2.29, -0.12), 0.022, b.chrome, 6);
      b.tube(point(side * 0.47, 0.45, -2.62), point(side * 0.47, 2.13, -2.62), 0.025, b.chrome, 6);
    }
    b.box(point(0, 0.435, -2.59), point(1.76, 0.1, 0.2), b.trim);
  });
  return finishCar(b, 'veh.songthaew', options, { paintColor: color, pickupBased: true, cabType: 'single', benchRows: 2,
    passengerRoof: true, bodySize: [1.85, 2.312, 5.3] });
}
