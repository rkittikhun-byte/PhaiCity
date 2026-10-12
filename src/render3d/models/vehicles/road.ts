/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point, VehicleBuilder } from './builder.js';

export { createSedan, createPickup, createSongthaew } from './road-cars.js';

// --- Tuk-Tuk ---
const TUKTUK_ROOFS = [
  0x1d4ed8, // Vibrant blue
  0x15803d, // Emerald green
  0xca8a04, // Golden yellow
  0xdc2626, // Bright red
] as const;

export function createTuktuk(options: ModelOptions = {}): Group {
  const id = 'veh.tuktuk';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const roofColor = TUKTUK_ROOFS[Math.floor(rng() * TUKTUK_ROOFS.length)];

  const bodyMat = tint('metal_painted', 0x1e3a8a); // Classic royal blue body
  const roofMat = tint('fabric_canvas', roofColor); // Brightly colored roof canopy
  const trimMat = tint('plaster_white', 0xfef08a);  // Yellow/gold trim accent
  const steel = getMaterial('metal_steel');
  const tireMat = getMaterial('asphalt');
  const glass = getMaterial('glass_clear');
  const lightMat = getMaterial('emissive_window');

  // Length = 2.8 m (Z: -1.4 to +1.4), Width = 1.3 m (X: -0.65 to +0.65), Height = 1.8 m (Y: 0 to 1.8)
  const wheelR = 0.25;
  const wheelW = 0.14;

  // 3 Wheels on y = 0: 1 front wheel at center (Z = +0.95), 2 rear wheels (Z = -0.75, X = ±0.52)
  b.wheel(point(0, wheelR, 0.95), wheelR, wheelW, tireMat, steel, 8);
  b.wheel(point(-0.52, wheelR, -0.75), wheelR, wheelW, tireMat, steel, 8);
  b.wheel(point(0.52, wheelR, -0.75), wheelR, wheelW, tireMat, steel, 8);

  // Front fork & mudguard
  b.box(point(0, 0.52, 0.95), point(0.25, 0.32, 0.4), bodyMat);
  // Front apron nose with headlight
  b.box(point(0, 0.65, 1.25), point(0.65, 0.6, 0.3), bodyMat);
  b.box(point(0, 0.68, 1.41), point(0.24, 0.2, 0.04), lightMat); // Center headlight
  // Handlebars
  b.box(point(0, 0.88, 0.72), point(0.65, 0.05, 0.05), steel);

  // Floorpan & chassis frame
  b.box(point(0, 0.32, -0.1), point(1.22, 0.18, 2.5), bodyMat);

  // Front driver seat
  b.box(point(0, 0.58, 0.25), point(0.5, 0.3, 0.45), steel);

  // Passenger compartment: rear bench seat (Z: -0.85)
  b.box(point(0, 0.62, -0.85), point(1.18, 0.35, 0.6), trimMat);
  b.box(point(0, 0.95, -1.18), point(1.18, 0.45, 0.12), trimMat); // Backrest

  // Rear body panel & rear bumper (Z = -1.38)
  b.box(point(0, 0.65, -1.35), point(1.26, 0.55, 0.1), bodyMat);
  b.box(point(0, 0.32, -1.39), point(1.28, 0.12, 0.06), steel); // Rear bumper
  // Taillights
  b.box(point(-0.48, 0.68, -1.41), point(0.18, 0.14, 0.04), lightMat);
  b.box(point(0.48, 0.68, -1.41), point(0.18, 0.14, 0.04), lightMat);

  // Stainless steel tubular frame holding canopy roof
  // 4 corner uprights + windshield frame
  b.box(point(0, 1.15, 1.12), point(0.72, 0.55, 0.04), glass); // Small windshield
  for (const sign of [-1, 1]) {
    b.cylinder(point(sign * 0.42, 1.35, 1.08), 0.025, 0.85, steel, 6, 'y');  // Front pillars
    b.cylinder(point(sign * 0.62, 1.25, -1.35), 0.025, 1.1, steel, 6, 'y');  // Rear pillars
    b.cylinder(point(sign * 0.62, 0.85, -0.4), 0.02, 1.1, steel, 6, 'z');    // Side safety armrests
  }

  // Curved canopy roof (Y reaches 1.8 m, Width = 1.3 m, Length = 2.5 m)
  b.box(point(0, 1.76, -0.15), point(1.28, 0.08, 2.45), roofMat);
  // Slanted front roof visor & side scalloped overhang
  b.box(point(0, 1.72, 1.1), point(1.24, 0.12, 0.25), roofMat, 0, -0.28, 0);
  b.box(point(-0.64, 1.71, -0.15), point(0.04, 0.12, 2.46), trimMat);
  b.box(point(0.64, 1.71, -0.15), point(0.04, 0.12, 2.46), trimMat);

  return b.finish(id, [1, 1], options, 'R3');
}

// --- Motorbike ---
export function createMotorbike(options: ModelOptions = {}): Group {
  const id = 'veh.motorbike';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const isTaxi = (options.seed ?? 1) % 2 === 0;

  const bikeMat = tint('metal_painted', [0xdc2626, 0x2563eb, 0x1f2937, 0xf8fafc][Math.floor(rng() * 4)]);
  const vestMat = tint('fabric_canvas', isTaxi ? 0xf97316 : 0x3b82f6); // Orange taxi vest or civilian blue shirt
  const helmetMat = tint('metal_painted', isTaxi ? 0xfacc15 : 0x1e293b); // Yellow helmet for taxi, dark for civilian
  const steel = getMaterial('metal_steel');
  const tireMat = getMaterial('asphalt');
  const lightMat = getMaterial('emissive_window');

  // Length = 1.9 m (Z: -0.95 to +0.95), Width = 0.75 m (X: -0.375 to +0.375), Height = 1.55 m (Y: 0 to 1.55)
  const wheelR = 0.28;
  const wheelW = 0.09;

  // 2 Wheels on y = 0: Front at Z = +0.65, Rear at Z = -0.65
  b.wheel(point(0, wheelR, 0.65), wheelR, wheelW, tireMat, steel, 10);
  b.wheel(point(0, wheelR, -0.65), wheelR, wheelW, tireMat, steel, 10);

  // Chassis / underbone frame & engine
  b.box(point(0, 0.35, 0), point(0.22, 0.3, 0.8), steel);
  // Chrome exhaust pipe on right side (+X)
  b.cylinder(point(0.18, 0.25, -0.35), 0.04, 0.85, steel, 6, 'z');

  // Body fairing & front cowl
  b.box(point(0, 0.62, 0.25), point(0.32, 0.42, 0.75), bikeMat);
  b.box(point(0, 0.82, 0.62), point(0.28, 0.32, 0.32), bikeMat);
  b.box(point(0, 0.84, 0.79), point(0.18, 0.16, 0.04), lightMat); // Headlight

  // Handlebars (Width = 0.75 m, X = ±0.375)
  b.cylinder(point(0, 0.98, 0.52), 0.02, 0.74, steel, 6, 'x');
  // Rearview mirrors
  b.box(point(-0.35, 1.08, 0.52), point(0.08, 0.08, 0.03), steel);
  b.box(point(0.35, 1.08, 0.52), point(0.08, 0.08, 0.03), steel);

  // Seat
  b.box(point(0, 0.72, -0.15), point(0.3, 0.12, 0.85), steel);

  // --- Helmeted Rider Figure (Sitting, hands on bars, helmet at top Y = 1.55) ---
  // Torso / Vest (Y: 0.95 to 1.35)
  b.box(point(0, 1.15, 0.05), point(0.42, 0.4, 0.28), vestMat);
  if (isTaxi) {
    // Number badge on back of vest
    b.box(point(0, 1.15, -0.1), point(0.22, 0.18, 0.04), tint('plaster_white', 0xffffff));
  }
  // Arms reaching forward to handlebars
  b.box(point(-0.24, 1.02, 0.28), point(0.08, 0.08, 0.45), vestMat);
  b.box(point(0.24, 1.02, 0.28), point(0.08, 0.08, 0.45), vestMat);
  // Legs straddling bike
  b.box(point(-0.2, 0.65, 0.08), point(0.1, 0.45, 0.22), steel);
  b.box(point(0.2, 0.65, 0.08), point(0.1, 0.45, 0.22), steel);

  // Helmet on head defining max height Y = 1.55
  b.cylinder(point(0, 1.45, 0.05), 0.14, 0.2, helmetMat, 8, 'y');
  b.box(point(0, 1.44, 0.16), point(0.2, 0.08, 0.04), steel); // Helmet visor

  return b.finish(id, [1, 1], options, 'R3');
}

// --- City Bus ---
export function createBus(options: ModelOptions = {}): Group {
  const id = 'veh.bus';
  const b = new VehicleBuilder();

  // Bangkok-style bus livery (e.g. cream body with red lower skirt, or blue air-con)
  const isAircon = (options.seed ?? 1) % 2 === 0;
  const mainColor = isAircon ? 0x1e3a8a : 0xfef3c7; // Blue air-con or cream regular
  const skirtColor = isAircon ? 0x0284c7 : 0xb91c1c; // Light blue or red skirt
  const bodyMat = tint('metal_painted', mainColor);
  const skirtMat = tint('metal_painted', skirtColor);
  const steel = getMaterial('metal_steel');
  const tireMat = getMaterial('asphalt');
  const glass = getMaterial('glass_tinted');
  const lightMat = getMaterial('emissive_window');

  // Length = 10.5 m (Z: -5.25 to +5.25), Width = 2.5 m (X: -1.25 to +1.25), Height = 3.2 m (Y: 0 to 3.2)
  const wheelR = 0.5;
  const wheelW = 0.28;
  const wheelX = 1.08;

  // Front single axle at Z = +3.4, Rear dual axle at Z = -2.8
  b.wheel(point(-wheelX, wheelR, 3.4), wheelR, wheelW, tireMat, steel, 12);
  b.wheel(point(wheelX, wheelR, 3.4), wheelR, wheelW, tireMat, steel, 12);
  // Rear dual wheels
  b.wheel(point(-wheelX, wheelR, -2.8), wheelR, wheelW * 1.6, tireMat, steel, 12);
  b.wheel(point(wheelX, wheelR, -2.8), wheelR, wheelW * 1.6, tireMat, steel, 12);

  // Lower skirt & chassis (Y: 0.35 to 1.2)
  b.box(point(0, 0.75, 0), point(2.46, 0.75, 10.4), skirtMat);
  b.box(point(0, 0.52, 5.22), point(2.48, 0.35, 0.08), steel);  // Front bumper
  b.box(point(0, 0.52, -5.22), point(2.48, 0.35, 0.08), steel); // Rear bumper

  // Upper main bus body (Y: 1.2 to 3.05)
  b.box(point(0, 2.12, 0), point(2.46, 1.85, 10.4), bodyMat);

  // Front panoramic windshield & destination box
  b.box(point(0, 2.05, 5.2), point(2.35, 1.2, 0.1), glass);
  // Route destination display box above windshield
  b.box(point(0, 2.85, 5.21), point(1.6, 0.35, 0.04), lightMat); // Lit route sign

  // Passenger windows along right side (+X)
  for (let z = -4.2; z <= 4.2; z += 1.4) {
    b.box(point(1.24, 2.2, z), point(0.04, 0.9, 1.1), glass);
  }
  // Passenger doors on left side (-X) at Z = +3.6 (front) and Z = -0.5 (middle)
  b.box(point(-1.24, 1.65, 3.6), point(0.04, 1.8, 0.95), glass);  // Front door
  b.box(point(-1.24, 1.65, -0.5), point(0.04, 1.8, 0.95), glass); // Mid door
  // Windows on left side where there are no doors
  for (const z of [-4.2, -2.8, -1.8, 0.9, 2.2]) {
    b.box(point(-1.24, 2.2, z), point(0.04, 0.9, 1.1), glass);
  }

  // Rear window
  b.box(point(0, 2.2, -5.21), point(2.1, 0.85, 0.04), glass);

  // Headlights & taillights
  b.box(point(-0.95, 0.85, 5.22), point(0.35, 0.22, 0.04), lightMat);
  b.box(point(0.95, 0.85, 5.22), point(0.35, 0.22, 0.04), lightMat);
  b.box(point(-1.0, 0.85, -5.22), point(0.25, 0.35, 0.04), lightMat);
  b.box(point(1.0, 0.85, -5.22), point(0.25, 0.35, 0.04), lightMat);

  // Roof A/C unit pods (reaches max height Y = 3.2 m)
  b.box(point(0, 3.12, 0.5), point(1.8, 0.2, 3.2), steel);

  return b.finish(id, [1, 2], options, 'R3');
}

// --- 6-Wheel Truck ---
const TRUCK_COLORS = [
  0x1e3a8a, // Navy blue
  0x047857, // Forest green
  0xf8fafc, // Clean white
  0xd97706, // Orange
] as const;

export function createTruck(options: ModelOptions = {}): Group {
  const id = 'veh.truck';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const color = TRUCK_COLORS[Math.floor(rng() * TRUCK_COLORS.length)];

  const cabMat = tint('metal_painted', color);
  const bedMat = tint('metal_painted', 0x374151); // Dark steel dropside bed
  const steel = getMaterial('metal_steel');
  const tireMat = getMaterial('asphalt');
  const glass = getMaterial('glass_tinted');
  const lightMat = getMaterial('emissive_window');

  // Length = 7.2 m (Z: -3.6 to +3.6), Width = 2.3 m (X: -1.15 to +1.15), Height = 2.9 m (Y: 0 to 2.9)
  const wheelR = 0.5;
  const wheelW = 0.28;
  const wheelX = 0.98;

  // 6 wheels on y = 0: 2 steer wheels in front (Z = +2.4), 4 dual wheels on rear axle (Z = -1.8)
  b.wheel(point(-wheelX, wheelR, 2.4), wheelR, wheelW, tireMat, steel, 12);
  b.wheel(point(wheelX, wheelR, 2.4), wheelR, wheelW, tireMat, steel, 12);
  // Dual wheels on rear
  b.wheel(point(-wheelX, wheelR, -1.8), wheelR, wheelW * 1.6, tireMat, steel, 12);
  b.wheel(point(wheelX, wheelR, -1.8), wheelR, wheelW * 1.6, tireMat, steel, 12);

  // Heavy ladder chassis rails
  b.box(point(0, 0.65, -0.2), point(1.1, 0.28, 6.8), steel);
  b.box(point(0, 0.52, 3.55), point(2.28, 0.38, 0.12), steel); // Front bumper

  // Underbed fuel tank & battery box
  b.cylinder(point(-0.85, 0.62, 0.2), 0.3, 1.4, steel, 8, 'z'); // Fuel tank
  b.box(point(0.85, 0.62, 0.2), point(0.5, 0.35, 0.8), steel);   // Battery box

  // Forward Control / Cab-Over-Engine (COE) Cabin (Z: +1.4 to +3.55, Y: 0.75 to 2.85)
  b.box(point(0, 1.82, 2.45), point(2.26, 1.95, 2.15), cabMat);
  b.box(point(0, 2.82, 2.45), point(2.2, 0.08, 2.05), cabMat); // Roof

  // Large front windshield & side windows
  b.box(point(0, 2.15, 3.54), point(2.1, 0.85, 0.04), glass);
  b.box(point(-1.14, 2.15, 2.45), point(0.04, 0.75, 1.2), glass);
  b.box(point(1.14, 2.15, 2.45), point(0.04, 0.75, 1.2), glass);

  // Front grille & headlights
  b.box(point(0, 1.25, 3.54), point(1.4, 0.55, 0.04), steel);
  b.box(point(-0.85, 0.88, 3.56), point(0.32, 0.22, 0.04), lightMat);
  b.box(point(0.85, 0.88, 3.56), point(0.32, 0.22, 0.04), lightMat);

  // Cab roof sun visor defining max Y = 2.9
  b.box(point(0, 2.86, 3.4), point(2.28, 0.1, 0.35), cabMat, 0, 0.2, 0);

  // Rear Dropside Cargo Bed (Z: -3.55 to +1.2, Y: 1.05 to 2.1)
  b.box(point(0, 1.15, -1.18), point(2.28, 0.15, 4.75), bedMat); // Bed floor
  b.box(point(-1.12, 1.55, -1.18), point(0.06, 0.65, 4.75), bedMat); // Left dropside
  b.box(point(1.12, 1.55, -1.18), point(0.06, 0.65, 4.75), bedMat);  // Right dropside
  b.box(point(0, 1.55, -3.54), point(2.28, 0.65, 0.06), bedMat);   // Tailgate
  // Headache rack / cabin protector behind cab
  b.box(point(0, 2.15, 1.25), point(2.26, 0.75, 0.08), steel);

  // Rear taillights
  b.box(point(-0.95, 0.75, -3.56), point(0.28, 0.18, 0.04), lightMat);
  b.box(point(0.95, 0.75, -3.56), point(0.28, 0.18, 0.04), lightMat);

  return b.finish(id, [1, 2], options, 'R3');
}

// --- Etan (Farm Truck) ---
export function createEtan(options: ModelOptions = {}): Group {
  const id = 'veh.etan';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);

  // Authentic rural Thai farm truck (รถอีแต๋น): open wooden bed, exposed diesel engine at front
  const bedMat = tint('wood_painted', [0x2563eb, 0xdc2626, 0x16a34a][Math.floor(rng() * 3)]); // Colorful wooden bed
  const teak = getMaterial('wood_teak');
  const engineRed = tint('metal_painted', 0xb91c1c); // Classic red diesel engine block
  const steel = getMaterial('metal_steel');
  const tireMat = getMaterial('asphalt');
  const roofMat = getMaterial('roof_metal_corrugated'); // Corrugated sheet sun canopy

  // Length = 5.5 m (Z: -2.75 to +2.75), Width = 1.8 m (X: -0.9 to +0.9), Height = 2.1 m (Y: 0 to 2.1)
  // 4 Wheels on y = 0: smaller front steer wheels, larger rugged rear drive wheels
  const frontR = 0.35;
  const rearR = 0.45;
  b.wheel(point(-0.72, frontR, 1.8), frontR, 0.18, tireMat, steel, 10);
  b.wheel(point(0.72, frontR, 1.8), frontR, 0.18, tireMat, steel, 10);
  b.wheel(point(-0.76, rearR, -1.4), rearR, 0.25, tireMat, steel, 10);
  b.wheel(point(0.76, rearR, -1.4), rearR, 0.25, tireMat, steel, 10);

  // Steel channel ladder chassis frame
  b.box(point(0, 0.48, 0), point(1.2, 0.22, 5.2), steel);
  b.box(point(0, 0.45, 2.72), point(1.6, 0.18, 0.08), steel); // Front bumper bar

  // --- Exposed Single-Cylinder Agricultural Diesel Engine at Front (+Z: 1.3 to 2.5) ---
  b.box(point(0, 0.85, 2.0), point(0.55, 0.55, 0.75), engineRed); // Engine block
  // Large circular flywheel / pulley on left side
  b.cylinder(point(-0.35, 0.85, 2.0), 0.32, 0.1, steel, 12, 'x');
  // V-belt drive and crank
  b.cylinder(point(-0.35, 0.65, 1.7), 0.12, 0.08, steel, 8, 'x');
  // Radiator water hopper / cooling tank on top
  b.box(point(0, 1.25, 2.15), point(0.42, 0.28, 0.38), engineRed);
  // Upright exhaust pipe
  b.cylinder(point(0.2, 1.45, 1.8), 0.04, 0.7, steel, 6, 'y');

  // --- Driver Compartment (Z: 0.2 to 1.1) ---
  b.box(point(0, 0.75, 0.5), point(1.4, 0.12, 0.8), teak); // Floorboard
  b.box(point(0, 0.98, 0.35), point(1.1, 0.35, 0.4), teak); // Simple wooden bench seat
  b.box(point(0, 1.25, 0.18), point(1.1, 0.35, 0.08), teak); // Backrest
  // Upright steering column & steering wheel
  b.cylinder(point(0.3, 1.08, 0.85), 0.03, 0.55, steel, 6, 'y');
  b.cylinder(point(0.3, 1.32, 0.82), 0.2, 0.03, steel, 8, 'y');

  // 4 corner tubular poles supporting sun roof
  for (const sign of [-1, 1]) {
    b.cylinder(point(sign * 0.72, 1.38, 1.05), 0.025, 1.4, steel, 6, 'y');
    b.cylinder(point(sign * 0.72, 1.38, -0.1), 0.025, 1.4, steel, 6, 'y');
  }
  // Sun canopy roof at Y = 2.1 m (corrugated metal sheet)
  b.box(point(0, 2.08, 0.5), point(1.65, 0.05, 1.4), roofMat);

  // --- Rear Open Wooden Bed (Z: -2.72 to 0.0, Y: 0.8 to 1.55) ---
  b.box(point(0, 0.85, -1.35), point(1.78, 0.1, 2.7), teak); // Bed deck floor
  // Painted wooden dropside slats (authentic rural Thai style)
  b.box(point(-0.87, 1.2, -1.35), point(0.06, 0.65, 2.7), bedMat); // Left wall
  b.box(point(0.87, 1.2, -1.35), point(0.06, 0.65, 2.7), bedMat);  // Right wall
  b.box(point(0, 1.2, -2.71), point(1.78, 0.65, 0.06), bedMat);   // Tailgate
  // Headboard behind driver
  b.box(point(0, 1.35, 0.02), point(1.78, 0.95, 0.06), teak);

  return b.finish(id, [1, 1], options, 'R2');
}
