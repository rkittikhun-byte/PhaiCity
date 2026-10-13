/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Material } from 'three';
import { point } from './builder.js';
import { VehicleKit, CarProfile } from './kit.js';
import type { ModelOptions } from '../registry.js';
import type { RegionTier } from '../../regional/types.js';

export type Outline = readonly (readonly [number, number])[];
export const rectangle = (rear: number, bottom: number, front: number, top: number): Outline =>
  [[rear, bottom], [front, bottom], [front, top], [rear, top]];

export function finishRoadVehicle(b: VehicleKit, id: string, options: ModelOptions, footprint: readonly [number, number],
  metadata: Record<string, unknown> = {}, tier: RegionTier = 'R3') {
  const root = b.finish(id, footprint, options, tier);
  Object.assign(root.userData, { kit: 'profile-car-v1', front: '+Z', wheelSegments: 16, wheels: b.wheels,
    components: b.components, ...metadata }); return root;
}

export function glazedBody(b: VehicleKit, profile: CarProfile, windows: readonly Outline[]): void {
  windows.forEach(window => b.windowHole(profile.shape, window));
  b.feature('beveled-profile-and-carved-arches', () => b.profileBody(profile));
  b.feature('inset-glass-and-window-seals', () => {
    windows.forEach(window => b.sideWindow(window, profile));
    if (profile.frontGlass) b.endGlass(profile.frontGlass, profile, true);
    if (profile.rearGlass) b.endGlass(profile.rearGlass, profile, false);
    for (const window of windows) for (const side of [-1, 1]) for (let i = 0; i < window.length; i++) {
      const [z, y] = window[i], [nextZ, nextY] = window[(i + 1) % window.length];
      b.tube(point(side * (b.widthAt(y, profile, z) - 0.005), y, z),
        point(side * (b.widthAt(nextY, profile, nextZ) - 0.005), nextY, nextZ), 0.02, b.trim, 6);
    }
  });
}

/** Route glyphs share the headlamp finish, avoiding another material/texture or a real operator's sign. */
export function routeDisplay(b: VehicleKit, route: string, y: number, z: number): void {
  const glyphs: Record<string, string> = { '0': 'abcedf', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
    '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd', P: 'abfge' };
  const segments: Record<string, readonly [number, number, number, number]> = {
    a: [0, 0.14, 0.16, 0.026], g: [0, 0, 0.16, 0.026], d: [0, -0.14, 0.16, 0.026],
    f: [-0.084, 0.075, 0.026, 0.11], b: [0.084, 0.075, 0.026, 0.11],
    e: [-0.084, -0.075, 0.026, 0.11], c: [0.084, -0.075, 0.026, 0.11],
  };
  b.box(point(0, y, z - 0.023), point(route.length * 0.29 + 0.12, 0.37, 0.035), b.trim);
  [...route].forEach((digit, i) => {
    const centerX = (i - (route.length - 1) / 2) * 0.29;
    for (const key of glyphs[digit] ?? '') {
      const [x, dy, w, h] = segments[key];
      b.face([point(centerX + x - w / 2, y + dy - h / 2, z), point(centerX + x + w / 2, y + dy - h / 2, z),
        point(centerX + x + w / 2, y + dy + h / 2, z), point(centerX + x - w / 2, y + dy + h / 2, z)], b.lamp);
    }
  });
}

export function rearLamps(b: VehicleKit, x: number, y: number, z: number): void {
  for (const side of [-1, 1]) b.face([point(side * x - 0.075, y - 0.07, z), point(side * x - 0.075, y + 0.07, z),
    point(side * x + 0.075, y + 0.07, z), point(side * x + 0.075, y - 0.07, z)], b.tail);
}
export function roundHeadlamp(b: VehicleKit, x: number, y: number, z: number, radius: number, material: Material = b.lamp): void {
  b.cylinder(point(x, y, z - 0.012), radius * 1.13, 0.036, b.trim, 16, 'z');
  b.cylinder(point(x, y, z + 0.012), radius, 0.025, material, 16, 'z');
}
