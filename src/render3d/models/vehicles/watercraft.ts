/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point, VehicleBuilder } from './builder.js';

export function createShip(options: ModelOptions = {}): Group {
  const id = 'veh.ship';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);

  // Ship materials (strictly <= 8 unique materials to stay under the 8 draw-call budget)
  const hullUpper = tint('metal_painted', 0x1e293b); // Dark navy/charcoal hull
  const hullLower = tint('metal_painted', 0x881337); // Red oxide anti-fouling boot-topping & red containers
  const superstructureMat = getMaterial('plaster_white'); // White bridge & cabins
  const steel = getMaterial('metal_steel');          // Steel working deck, masts, funnel cap
  const glass = getMaterial('glass_tinted');
  const funnelMat = tint('metal_painted', 0xd97706); // Amber funnel & orange containers
  const containerBlue = tint('metal_painted', 0x1e40af); // Ocean blue container
  const containerGreen = tint('metal_painted', 0x15803d); // Evergreen container
  const containerMats = [containerBlue, containerGreen, hullLower, funnelMat] as const;

  // Hull (Length = 35 m: Z from -17.5 to +17.5, Width = 7.2 m, bottom rests on y = 0)
  // Lower hull: red oxide anti-fouling boot-topping (Y: 0.0 to 1.8)
  // Main lower hull box (Z: -15.5 to +15.5)
  b.box(point(0, 0.9, 0), point(6.2, 1.8, 31.0), hullLower);
  // Bow lower hull wedge (Z: +15.5 to +17.5)
  b.box(point(0, 1.0, 16.5), point(4.8, 2.0, 2.0), hullLower);
  // Stern lower hull (Z: -17.5 to -15.5)
  b.box(point(0, 0.9, -16.5), point(5.6, 1.8, 2.0), hullLower);

  // Upper hull topsides & bulwark (Y: 1.8 to 3.6, flares out to 7.2 m wide)
  b.box(point(0, 2.7, 0), point(7.2, 1.8, 31.0), hullUpper);
  // Bow upper hull / forecastle (Z: +15.5 to +17.5)
  b.box(point(0, 3.2, 16.5), point(5.6, 2.8, 2.0), hullUpper);
  // Stern transom (Z: -17.5 to -15.5)
  b.box(point(0, 2.7, -16.5), point(6.8, 1.8, 2.0), hullUpper);
  // Raised forecastle deck bulwark at bow tip
  b.box(point(0, 4.8, 17.2), point(4.0, 0.6, 0.6), hullUpper);
  // Bow flagstaff / jackstaff
  b.cylinder(point(0, 5.5, 17.4), 0.05, 1.6, steel, 6, 'y');
  // Stern taffrail
  b.box(point(0, 3.8, -17.3), point(6.0, 0.4, 0.4), hullUpper);

  // Working deck well (Z: -8.0 to +15.0, Y: 3.55)
  b.box(point(0, 3.55, 3.5), point(6.8, 0.15, 23.0), steel);

  // Container cargo stacks on forward deck (Z from -7.0 to +12.0)
  // Standard containers: width 2.0 m, height 2.5 m, length 5.8 m
  const containerZSlots = [-4.0, 2.5, 9.0];
  for (const z of containerZSlots) {
    const len = 5.8;
    for (const x of [-2.1, 0, 2.1]) {
      // Tier 1 (Y: 3.65 to 6.15)
      const mat1 = containerMats[Math.floor(rng() * containerMats.length)];
      b.box(point(x, 4.9, z), point(2.0, 2.5, len), mat1);

      // Tier 2 (Y: 6.15 to 8.6)
      const mat2 = containerMats[Math.floor(rng() * containerMats.length)];
      b.box(point(x, 7.35, z), point(2.0, 2.4, len), mat2);
    }
  }

  // Superstructure / Bridge block at the stern (Z: -16.0 to -9.0, Y: 3.6 to 8.8)
  // Accommodations tier 1 & 2
  b.box(point(0, 5.4, -12.5), point(6.6, 3.6, 7.0), superstructureMat);
  // Navigation bridge deck (tier 3, Y: 7.2 to 8.8) with panoramic bridge wings
  b.box(point(0, 8.0, -12.5), point(7.6, 1.6, 5.0), superstructureMat);
  // Bridge observation windows
  b.box(point(0, 8.2, -9.95), point(7.2, 0.75, 0.1), glass);
  b.box(point(-3.82, 8.2, -12.5), point(0.1, 0.75, 4.8), glass);
  b.box(point(3.82, 8.2, -12.5), point(0.1, 0.75, 4.8), glass);

  // Radar mast on bridge roof (Y reaches 10.6 m)
  b.cylinder(point(0, 9.6, -12.5), 0.1, 2.0, steel, 6, 'y');
  b.box(point(0, 10.2, -12.5), point(1.8, 0.14, 0.18), steel); // Radar scanner crossbar

  // Exhaust funnel behind bridge (Z: -15.6, Y: 7.1 to 9.8)
  b.box(point(0, 8.4, -15.6), point(1.8, 2.6, 2.0), funnelMat);
  b.box(point(0, 9.75, -15.6), point(1.9, 0.2, 2.1), steel); // Black funnel cap
  // Smoke anchor on funnel
  b.smokeAnchor('anchor_smoke_0', point(0, 9.85, -15.6));

  return b.finish(id, [1, 4], options, 'R3');
}

export function createLongtailBoat(options: ModelOptions = {}): Group {
  const id = 'veh.longtail_boat';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);

  const teak = getMaterial('wood_teak');
  const trimColor = [0x0891b2, 0xb91c1c, 0x15803d, 0xd97706][Math.floor(rng() * 4)];
  const trimMat = tint('wood_painted', trimColor);
  const steel = getMaterial('metal_steel');
  const canvas = getMaterial('fabric_canvas');
  const ribbonRed = tint('fabric_canvas', 0xef4444);   // Red auspicious cloth
  const ribbonGold = tint('fabric_canvas', 0xfacc15);  // Yellow auspicious cloth

  // Narrow wooden hull (Length = 9.0 m: Z from -4.5 to +4.5, Width = 1.6 m, bottom rests on y = 0)
  // Keel beam and bottom planks (rests on y = 0)
  b.box(point(0, 0.14, 0), point(1.3, 0.28, 7.8), teak);
  // Bottom waterline paint stripe
  b.box(point(0, 0.35, 0), point(1.42, 0.12, 7.82), trimMat);

  // Flared wooden gunwales along flanks (X = ±0.75, Y: 0.28 to 0.78)
  b.box(point(-0.72, 0.55, 0), point(0.12, 0.55, 7.4), teak);
  b.box(point(0.72, 0.55, 0), point(0.12, 0.55, 7.4), teak);

  // Upswept pointed bow prow (Z: 3.5 to 4.5, rises up to Y = 1.55 m!)
  b.box(point(0, 0.85, 4.0), point(0.8, 0.7, 1.4), teak, 0, -0.25, 0);
  b.cylinder(point(0, 1.25, 4.45), 0.12, 0.7, teak, 8, 'y'); // Pointed prow tip

  // Colorful cloth ribbons on the bow (ผ้าสามสี: auspicious silk ribbons tied around bow)
  b.box(point(0, 1.05, 4.45), point(0.38, 0.14, 0.38), ribbonRed);
  b.box(point(0, 0.9, 4.45), point(0.42, 0.14, 0.42), ribbonGold);

  // Passenger bench rows inside (Z: -1.8 to +2.5)
  for (const z of [-1.5, -0.5, 0.5, 1.5, 2.5]) {
    b.box(point(0, 0.42, z), point(1.2, 0.1, 0.35), teak);
  }

  // Canopy awning over passenger section (Z: -2.0 to +2.8, Y up to 1.85 m)
  // Curved hoop frames
  for (const z of [-2.0, -0.6, 0.8, 2.2]) {
    b.cylinder(point(-0.68, 1.15, z), 0.025, 1.2, steel, 6, 'y');
    b.cylinder(point(0.68, 1.15, z), 0.025, 1.2, steel, 6, 'y');
    b.cylinder(point(0, 1.78, z), 0.025, 1.35, steel, 6, 'x');
  }
  // Canvas fabric sun roof
  b.box(point(0, 1.82, 0.1), point(1.4, 0.05, 4.4), canvas);

  // Stern (-Z: -3.5 to -4.5): Exposed converted truck engine on swivel gimbal!
  b.box(point(0, 0.65, -3.2), point(0.55, 0.5, 0.75), steel); // Engine block
  b.cylinder(point(0.25, 0.95, -3.2), 0.08, 0.45, steel, 6, 'y'); // Exhaust pipe
  // Swivel mounting bracket
  b.cylinder(point(0, 0.52, -3.65), 0.08, 0.25, steel, 8, 'y');
  // Long propeller drive shaft ("long tail" / เพลาใบพัด) angling down behind stern
  // Elevated slightly so bottom edge rests comfortably on y = 0 when beached
  b.cylinder(point(0, 0.35, -5.0), 0.04, 2.9, steel, 6, 'z');
  // Two-blade bronze propeller at tip (radius 0.20 m, center Y = 0.22, min Y = 0.02)
  b.cylinder(point(0, 0.22, -6.45), 0.20, 0.04, steel, 6, 'z');
  // Long tiller steering handle for boatman
  b.cylinder(point(0, 0.88, -2.8), 0.03, 1.1, steel, 6, 'z');

  return b.finish(id, [1, 2], options, 'R3');
}

export function createKorlaeBoat(options: ModelOptions = {}): Group {
  const id = 'veh.korlae_boat';
  const b = new VehicleBuilder();

  // Kolae boat: Southern Thai traditional hand-painted boat.
  // Distinctive vivid multi-colored motifs: ochre/orange, bright ocean blue, crimson red, white
  const baseWood = getMaterial('wood_teak');
  const ochreMat = tint('wood_painted', 0xd97706); // Warm golden ochre base
  const blueMat = tint('wood_painted', 0x2563eb);  // Deep vibrant blue pattern
  const redMat = tint('wood_painted', 0xdc2626);   // Crimson red trim
  const whiteMat = tint('wood_painted', 0xf8fafc); // Crisp white accent
  const steel = getMaterial('metal_steel');

  // Length = 8.5 m: Z from -4.25 to +4.25, Width = 2.0 m, bottom rests on y = 0
  // Curved keel beam
  b.box(point(0, 0.2, 0), point(1.4, 0.35, 6.5), baseWood);

  // Flared hull sides with multi-colored painted bands
  // Lower band in ochre
  b.box(point(-0.85, 0.55, 0), point(0.14, 0.45, 6.2), ochreMat);
  b.box(point(0.85, 0.55, 0), point(0.14, 0.45, 6.2), ochreMat);
  // Middle decorative band in vibrant blue
  b.box(point(-0.92, 0.85, 0), point(0.14, 0.25, 6.0), blueMat);
  b.box(point(0.92, 0.85, 0), point(0.14, 0.25, 6.0), blueMat);
  // Upper gunwale rail in crimson red
  b.box(point(-0.96, 1.05, 0), point(0.14, 0.18, 5.8), redMat);
  b.box(point(0.96, 1.05, 0), point(0.14, 0.18, 5.8), redMat);
  // Painted white accent trim
  b.box(point(-0.98, 0.98, 0), point(0.04, 0.08, 5.82), whiteMat);
  b.box(point(0.98, 0.98, 0), point(0.04, 0.08, 5.82), whiteMat);

  // Iconic dramatic upswept pointed prow (หัวเรือกอและ) at +Z (Z: 2.8 to 4.25, Y up to 2.6 m!)
  b.box(point(0, 1.1, 3.4), point(1.2, 1.1, 1.4), ochreMat, 0, -0.42, 0);
  b.box(point(0, 1.8, 3.9), point(0.6, 1.2, 0.9), redMat, 0, -0.55, 0);
  // Slender curved prow tip reaching Y = 2.6 m
  b.cylinder(point(0, 2.35, 4.15), 0.1, 0.65, blueMat, 8, 'y');
  b.box(point(0, 2.55, 4.2), point(0.16, 0.18, 0.16), whiteMat);

  // Swept-up stern (ท้ายเรือกอและ) at -Z (Z: -2.8 to -4.25, Y up to 2.1 m)
  b.box(point(0, 1.0, -3.4), point(1.2, 1.0, 1.4), ochreMat, 0, 0.38, 0);
  b.box(point(0, 1.6, -3.9), point(0.5, 1.0, 0.8), redMat, 0, 0.48, 0);

  // Interior: cross ribs, floorboards, wooden thwart benches
  for (const z of [-1.8, -0.6, 0.6, 1.8]) {
    b.box(point(0, 0.72, z), point(1.7, 0.12, 0.32), baseWood);
  }
  b.box(point(0, 0.35, 0), point(1.2, 0.08, 4.5), baseWood); // Floorboard

  // Fishing net storage bundle in midsection
  b.cylinder(point(0, 0.65, -0.8), 0.35, 1.1, getMaterial('fabric_canvas'), 8, 'x');

  // Small mast / harpoon pole stowed along deck
  b.cylinder(point(0.35, 0.85, 0.5), 0.04, 3.6, steel, 6, 'z');

  return b.finish(id, [1, 2], options, 'R2');
}
