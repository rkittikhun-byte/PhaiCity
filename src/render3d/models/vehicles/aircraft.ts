/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, Group, Mesh } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { applyWorldUV } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { point, VehicleBuilder } from './builder.js';

const HELI_PALETTES = [
  { body: 0x1d4ed8, accent: 0xf5eccf }, // Traffic blue & cream
  { body: 0xca8a04, accent: 0x1f2937 }, // News yellow & dark grey
  { body: 0x059669, accent: 0xffffff }, // News emerald & white
] as const;

export function createHelicopter(options: ModelOptions = {}): Group {
  const id = 'veh.helicopter';
  const b = new VehicleBuilder();
  const rng = seededRng(options.seed ?? 1);
  const palette = HELI_PALETTES[Math.floor(rng() * HELI_PALETTES.length)];

  const bodyMat = tint('metal_painted', palette.body);
  const accentMat = tint('plaster_white', palette.accent);
  const steel = getMaterial('metal_steel');
  const glass = getMaterial('glass_tinted');
  const lightMat = getMaterial('emissive_window');

  // Landing skids resting on y = 0 (Y from 0 to 0.55, X = ±0.9)
  for (const sign of [-1, 1]) {
    const x = sign * 0.9;
    // Main skid tube along Z (-2.5 to 2.2)
    b.cylinder(point(x, 0.05, -0.15), 0.05, 4.7, steel, 8, 'z');
    // Curved front upturn
    b.box(point(x, 0.15, 2.3), point(0.08, 0.22, 0.25), steel, 0, -0.4, 0);
    // Support struts connecting to cabin belly (at Y = 0.6)
    b.cylinder(point(sign * 0.55, 0.32, 0.8), 0.04, 0.65, steel, 6, 'z');
    b.cylinder(point(sign * 0.55, 0.32, -1.0), 0.04, 0.65, steel, 6, 'z');
  }

  // Fuselage cabin (Y from 0.55 to 2.8, Z from -2.2 to 2.2)
  b.box(point(0, 1.6, 0.1), point(1.9, 1.8, 3.8), bodyMat);
  // Aerodynamic nose taper
  b.box(point(0, 1.5, 2.2), point(1.6, 1.5, 0.8), bodyMat);
  // Colored side trim stripe
  b.box(point(0, 1.45, 0.1), point(1.92, 0.35, 4.0), accentMat);

  // Large cockpit bubble windshield & side windows
  b.box(point(0, 1.85, 2.05), point(1.7, 1.1, 1.1), glass);
  b.box(point(-0.96, 1.75, 0.4), point(0.04, 0.8, 1.6), glass);
  b.box(point(0.96, 1.75, 0.4), point(0.04, 0.8, 1.6), glass);

  // Under-nose traffic news camera gimbal
  b.cylinder(point(0, 0.72, 2.1), 0.2, 0.25, steel, 8, 'y');
  b.box(point(0, 0.58, 2.15), point(0.28, 0.25, 0.28), steel);
  b.box(point(0, 0.58, 2.3), point(0.12, 0.12, 0.04), lightMat); // Camera lens / spotlight

  // Engine cowling / transmission roof doghouse (Y up to 3.05)
  b.box(point(0, 2.75, 0.2), point(1.2, 0.55, 2.6), bodyMat);
  b.cylinder(point(0, 3.08, 0.4), 0.14, 0.22, steel, 8, 'y'); // Rotor mast

  // Tail boom extending back to -Z (Z from -1.8 to -5.0)
  b.taperedCylinder(point(0, 1.95, -3.4), 0.28, 0.45, 3.4, bodyMat, 8, 'z');
  // Horizontal stabilizer fins at Z = -4.2
  b.box(point(0, 2.1, -4.2), point(2.0, 0.06, 0.45), bodyMat);
  // Vertical tail fin at Z = -5.0 (Y up to 2.85)
  b.box(point(0, 2.45, -5.0), point(0.1, 1.1, 0.8), bodyMat);
  b.box(point(0, 2.45, -5.02), point(0.12, 0.3, 0.82), accentMat);

  // Rotating main rotor under anim_rotor_main
  const mainHubY = 3.2;
  const mainHubZ = 0.4;
  const animMain = new Group();
  animMain.name = 'anim_rotor_main';
  animMain.position.set(0, mainHubY, mainHubZ);

  // Rotor hub and 2 long blades (span 8.2 m)
  const mainBladeMat = tint('metal_painted', 0x181818);
  const mainRotorGeom = new BoxGeometry(8.2, 0.04, 0.32);
  applyWorldUV(mainRotorGeom, 1);
  const mainRotorMesh = new Mesh(mainRotorGeom, mainBladeMat);
  mainRotorMesh.name = `${id}/rotor_main`;
  mainRotorMesh.castShadow = true;
  animMain.add(mainRotorMesh);
  b.addAnimNode(animMain);

  // Rotating tail rotor under anim_rotor_tail
  const tailHubX = -0.16;
  const tailHubY = 2.5;
  const tailHubZ = -5.0;
  const animTail = new Group();
  animTail.name = 'anim_rotor_tail';
  animTail.position.set(tailHubX, tailHubY, tailHubZ);

  const tailBladeMat = tint('metal_painted', 0x2e2e2e);
  const tailRotorGeom = new BoxGeometry(0.04, 1.3, 0.14);
  applyWorldUV(tailRotorGeom, 1);
  const tailRotorMesh = new Mesh(tailRotorGeom, tailBladeMat);
  tailRotorMesh.name = `${id}/rotor_tail`;
  tailRotorMesh.castShadow = true;
  animTail.add(tailRotorMesh);
  b.addAnimNode(animTail);

  return b.finish(id, [1, 1], options, 'R3');
}

export function createAirplane(options: ModelOptions = {}): Group {
  const id = 'veh.airplane';
  const b = new VehicleBuilder();

  // Fictional airline: "ไผ่แอร์" (Phai Air) in bamboo green and white.
  // Strictly no purple and gold.
  const bambooGreen = tint('metal_painted', 0x237346); // Fresh bamboo green
  const whiteMat = getMaterial('plaster_white');
  const steel = getMaterial('metal_steel');
  const glass = getMaterial('glass_tinted');
  const tireMat = getMaterial('asphalt');

  // Landing gear wheels resting on y = 0
  // Nose gear at Z = +9.2, wheel radius = 0.35, Y = 0 to 0.7
  b.cylinder(point(0, 0.85, 9.2), 0.08, 1.2, steel, 6, 'y');
  b.wheel(point(-0.2, 0.35, 9.2), 0.35, 0.14, tireMat, steel, 8);
  b.wheel(point(0.2, 0.35, 9.2), 0.35, 0.14, tireMat, steel, 8);

  // Main gears under wings at Z = -1.2, X = ±3.2
  for (const sign of [-1, 1]) {
    const x = sign * 3.2;
    b.cylinder(point(x, 0.95, -1.2), 0.1, 1.4, steel, 6, 'y');
    b.wheel(point(x - 0.2, 0.45, -1.2), 0.45, 0.18, tireMat, steel, 8);
    b.wheel(point(x + 0.2, 0.45, -1.2), 0.45, 0.18, tireMat, steel, 8);
  }

  // Fuselage (Length = 28 m: Z from -14 to +14, centerline height Y = 2.5)
  // Main passenger cabin tube: upper white, lower bamboo green
  b.cylinder(point(0, 2.5, 0), 1.6, 20.0, whiteMat, 12, 'z');
  // Lower belly cheatline
  b.box(point(0, 1.35, 0), point(3.0, 0.8, 20.0), bambooGreen);

  // Streamlined nose cone (Z from +10.0 to +14.0)
  b.taperedCylinder(point(0, 2.4, 12.0), 0.3, 1.6, 4.0, whiteMat, 10, 'z');
  b.box(point(0, 1.4, 11.9), point(2.4, 0.7, 3.8), bambooGreen);
  // Cockpit windshield
  b.box(point(0, 2.85, 11.8), point(1.5, 0.6, 1.2), glass, 0, -0.3, 0);

  // Passenger window rows along both sides (X = ±1.61)
  for (let z = -8.0; z <= 8.0; z += 1.3) {
    b.box(point(-1.61, 2.6, z), point(0.04, 0.32, 0.55), glass);
    b.box(point(1.61, 2.6, z), point(0.04, 0.32, 0.55), glass);
  }

  // Tapered tail cone (Z from -10.0 to -14.0)
  b.taperedCylinder(point(0, 2.6, -12.0), 1.6, 0.3, 4.0, whiteMat, 10, 'z');

  // Main swept wings (wingspan = 24.0 m, root Z = 0.5, tip Z = -3.5)
  // Center wing root fairing
  b.box(point(0, 1.7, -0.5), point(4.2, 0.65, 6.0), bambooGreen);
  // Left & right swept wing slabs
  for (const sign of [-1, 1]) {
    const angleY = sign * -0.28; // Swept back
    const angleZ = sign * 0.07;  // Slight dihedral
    const midX = sign * 6.5;
    const midZ = -1.0;
    b.box(point(midX, 1.85, midZ), point(9.5, 0.26, 3.2), whiteMat, angleY, 0, angleZ);
    // Bamboo green winglet tips at ±12 m
    b.box(point(sign * 11.8, 2.5, -2.6), point(0.12, 1.2, 0.8), bambooGreen);
  }

  // Turbofan jet engines under wings at X = ±4.2, Y = 1.35, Z = 0.2
  for (const sign of [-1, 1]) {
    const ex = sign * 4.2;
    // Pylon strut from wing
    b.box(point(ex, 1.8, 0.2), point(0.16, 0.65, 1.8), steel);
    // Engine nacelle cylinder in bamboo green
    b.cylinder(point(ex, 1.35, 0.2), 0.72, 2.8, bambooGreen, 10, 'z');
    // Front engine intake spinner and rear exhaust cone
    b.cylinder(point(ex, 1.35, 1.62), 0.6, 0.15, steel, 10, 'z');
    b.cylinder(point(ex, 1.35, -1.25), 0.45, 0.3, steel, 10, 'z');
  }

  // Horizontal tailplanes at Z = -12.2 (span 8.5 m)
  for (const sign of [-1, 1]) {
    b.box(point(sign * 2.4, 3.2, -12.2), point(3.6, 0.16, 1.5), whiteMat, sign * -0.28, 0, 0);
  }

  // Vertical tail fin in bamboo green (Y up to 7.0 m, Z from -10.5 to -13.5)
  b.box(point(0, 5.2, -11.8), point(0.26, 3.6, 2.4), bambooGreen, 0, 0.3, 0);
  // Decorative white tip cap on tail
  b.box(point(0, 6.9, -12.6), point(0.28, 0.4, 1.0), whiteMat);

  return b.finish(id, [3, 3], options, 'R3');
}
