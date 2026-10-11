/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point, VehicleBuilder } from './builder.js';

const LOCO_PALETTES = [
  { body: 0xd9531e, stripe: 0xf5eccf }, // Warm orange & cream
  { body: 0x8b1e22, stripe: 0xeab308 }, // Deep crimson & gold
  { body: 0x1d4ed8, stripe: 0xef4444 }, // Royal blue & red accent
  { body: 0x15803d, stripe: 0xfde047 }, // Forest green & yellow
] as const;

const CAR_PALETTES = [
  { body: 0x7c2d37, trim: 0xe5d8be }, // Maroon & cream (classic 3rd class)
  { body: 0x22543d, trim: 0xede4cd }, // Olive green & cream
  { body: 0x1e3a8a, trim: 0xe0e7ff }, // Navy & white
] as const;

function buildBogie(b: VehicleBuilder, centerZ: number): void {
  const steel = getMaterial('metal_steel');
  const wheelMat = tint('metal_steel', 0x33363d);
  const wheelRadius = 0.45;
  const wheelWidth = 0.14;
  const wheelX = 0.5; // 1.0 m gauge (between wheels)

  // 3 axles per bogie
  const axleOffsets = [-1.15, 0, 1.15];
  for (const dz of axleOffsets) {
    const z = centerZ + dz;
    // Axle shaft
    b.cylinder(point(0, wheelRadius, z), 0.08, 1.2, steel, 6, 'x');
    // Left & right wheels
    b.wheel(point(-wheelX, wheelRadius, z), wheelRadius, wheelWidth, wheelMat, steel, 10);
    b.wheel(point(wheelX, wheelRadius, z), wheelRadius, wheelWidth, wheelMat, steel, 10);
  }

  // Bogie side frames
  for (const sign of [-1, 1]) {
    const x = sign * (wheelX + 0.15);
    b.box(point(x, wheelRadius + 0.05, centerZ), point(0.12, 0.28, 3.0), steel);
    b.box(point(x, wheelRadius + 0.22, centerZ), point(0.16, 0.14, 1.4), steel);
    // Springs over axle boxes
    for (const dz of axleOffsets) {
      b.cylinder(point(x, wheelRadius + 0.18, centerZ + dz), 0.09, 0.16, steel, 6, 'y');
    }
  }
  // Center bolster beam
  b.box(point(0, wheelRadius + 0.26, centerZ), point(1.4, 0.18, 0.6), steel);
}

export function createTrainLoco(options: ModelOptions = {}): Group {
  const id = 'veh.train_loco';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const paletteIndex = Math.floor(rng() * LOCO_PALETTES.length);
  const palette = LOCO_PALETTES[paletteIndex];

  const bodyMat = tint('metal_painted', palette.body);
  const stripeMat = tint('plaster_white', palette.stripe);
  const steel = getMaterial('metal_steel');
  const glass = getMaterial('glass_tinted');
  const lightMat = getMaterial('emissive_window');
  const grillMat = getMaterial('roller_shutter');

  // Bogies on 1 m gauge at Z = ±4.5 (wheels rest on y = 0)
  buildBogie(b, 4.5);
  buildBogie(b, -4.5);

  // Underframe chassis
  b.box(point(0, 0.95, 0), point(2.7, 0.25, 14.8), steel);
  // End buffer beams / couplers
  for (const sign of [-1, 1]) {
    const z = sign * 7.42;
    b.box(point(0, 0.85, z), point(2.6, 0.35, 0.16), steel);
    b.box(point(0, 0.75, z + sign * 0.12), point(0.3, 0.25, 0.2), steel); // Coupler
    // Cowcatcher / snowplow wedge
    b.box(point(0, 0.42, z + sign * 0.05), point(2.2, 0.35, 0.12), steel);
  }
  // Underfloor fuel tank & air reservoirs between bogies
  b.box(point(0, 0.65, 0), point(2.3, 0.6, 4.2), steel);
  b.cylinder(point(-0.9, 0.62, 0), 0.25, 3.8, steel, 8, 'z');
  b.cylinder(point(0.9, 0.62, 0), 0.25, 3.8, steel, 8, 'z');

  // Locomotive main body (Y from 1.07 to 3.55)
  b.box(point(0, 2.31, 0), point(2.6, 2.2, 13.6), bodyMat);
  // Colored accent stripe along the lower body
  b.box(point(0, 1.45, 0), point(2.62, 0.3, 13.8), stripeMat);

  // Cabs at both ends (Front +Z, Rear -Z)
  for (const sign of [-1, 1]) {
    const zCab = sign * 6.0;
    // Angled nose hood
    b.box(point(0, 2.05, sign * 6.95), point(2.5, 1.7, 0.9), bodyMat);
    b.box(point(0, 1.45, sign * 6.96), point(2.52, 0.3, 0.92), stripeMat);
    // Windshields (left & right)
    b.box(point(-0.65, 2.65, zCab + sign * 0.81), point(0.85, 0.65, 0.04), glass);
    b.box(point(0.65, 2.65, zCab + sign * 0.81), point(0.85, 0.65, 0.04), glass);
    // Headlights (high centered & twin lower)
    b.box(point(0, 3.2, sign * 6.81), point(0.3, 0.2, 0.05), lightMat);
    b.box(point(-0.85, 1.85, sign * 7.41), point(0.25, 0.2, 0.05), lightMat);
    b.box(point(0.85, 1.85, sign * 7.41), point(0.25, 0.2, 0.05), lightMat);
  }

  // Flank ventilation grilles
  for (const z of [-2.2, 0, 2.2]) {
    b.box(point(-1.31, 2.4, z), point(0.04, 0.9, 1.5), grillMat);
    b.box(point(1.31, 2.4, z), point(0.04, 0.9, 1.5), grillMat);
  }

  // Curved roof
  b.box(point(0, 3.52, 0), point(2.35, 0.25, 13.8), steel);
  // Dynamic brake fan blister and radiator pods on roof
  b.cylinder(point(0, 3.68, -1.8), 0.65, 0.16, steel, 10, 'y');
  b.cylinder(point(0, 3.68, -0.2), 0.65, 0.16, steel, 10, 'y');

  // Exhaust stack (Y reaches 3.8 m)
  b.cylinder(point(0, 3.72, 1.4), 0.22, 0.22, steel, 8, 'y');
  // Smoke anchor on exhaust
  b.smokeAnchor('anchor_smoke_0', point(0, 3.82, 1.4));

  return b.finish(id, [1, 2], options, 'R3');
}

export function createTrainCar(options: ModelOptions = {}): Group {
  const id = 'veh.train_car';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const paletteIndex = Math.floor(rng() * CAR_PALETTES.length);
  const palette = CAR_PALETTES[paletteIndex];

  const bodyMat = tint('metal_painted', palette.body);
  const trimMat = tint('plaster_white', palette.trim);
  const steel = getMaterial('metal_steel');
  const wood = getMaterial('wood_teak');

  // Bogies on 1 m gauge at Z = ±4.8
  buildBogie(b, 4.8);
  buildBogie(b, -4.8);

  // Underframe chassis
  b.box(point(0, 0.95, 0), point(2.7, 0.22, 14.8), steel);
  // Couplers at ends
  for (const sign of [-1, 1]) {
    const z = sign * 7.45;
    b.box(point(0, 0.85, z), point(2.6, 0.35, 0.14), steel);
    b.box(point(0, 0.75, z + sign * 0.1), point(0.3, 0.25, 0.2), steel);
  }
  // Underfloor battery boxes & brake cylinders
  b.box(point(-0.6, 0.65, 0), point(1.1, 0.45, 3.2), steel);
  b.cylinder(point(0.7, 0.65, 0), 0.22, 1.8, steel, 8, 'z');

  // Passenger car body
  // Lower body panel (up to window sill Y = 1.9)
  b.box(point(0, 1.45, 0), point(2.7, 0.8, 14.6), bodyMat);
  b.box(point(0, 1.87, 0), point(2.72, 0.08, 14.62), trimMat);

  // Window pillars and open windows! (Third-class open-window carriages)
  // Window openings: Y from 1.91 to 2.75
  const windowZOffsets = [-5.5, -4.2, -2.9, -1.6, -0.3, 1.0, 2.3, 3.6, 4.9];
  for (const z of windowZOffsets) {
    // Open window opening is left clear!
    // Benches inside passenger car aligned with windows
    b.box(point(-0.65, 1.45, z), point(0.95, 0.12, 0.65), wood); // Left bench
    b.box(point(-0.65, 1.75, z - 0.28), point(0.95, 0.5, 0.08), wood); // Backrest
    b.box(point(0.65, 1.45, z), point(0.95, 0.12, 0.65), wood); // Right bench
    b.box(point(0.65, 1.75, z - 0.28), point(0.95, 0.5, 0.08), wood);
  }

  // Pillars between open windows
  const pillarZOffsets = [-6.2, -4.85, -3.55, -2.25, -0.95, 0.35, 1.65, 2.95, 4.25, 5.55];
  for (const z of pillarZOffsets) {
    b.box(point(-1.31, 2.33, z), point(0.08, 0.84, 0.25), trimMat);
    b.box(point(1.31, 2.33, z), point(0.08, 0.84, 0.25), trimMat);
  }

  // End walls & doors
  for (const sign of [-1, 1]) {
    const z = sign * 7.15;
    b.box(point(0, 2.3, z), point(2.7, 2.4, 0.3), bodyMat);
    b.box(point(0, 2.1, z + sign * 0.16), point(0.85, 1.8, 0.06), trimMat); // Door
  }

  // Roof frieze & roof
  b.box(point(0, 2.85, 0), point(2.7, 0.22, 14.6), bodyMat);
  b.box(point(0, 3.25, 0), point(2.65, 0.58, 14.7), steel);
  // Curved roof crown (max Y = 3.8)
  b.box(point(0, 3.65, 0), point(2.2, 0.22, 14.7), steel);

  // Roof ventilation torpedo cowls
  for (const z of [-4.5, -2.2, 0, 2.2, 4.5]) {
    b.cylinder(point(0, 3.78, z), 0.14, 0.45, steel, 8, 'z');
  }

  return b.finish(id, [1, 2], options, 'R3');
}
