/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Shape, TorusGeometry } from 'three';
import { car_paint, getMaterial, tint, vehicleMaterial } from '../../materials/library.js';
import { applyWorldUV } from '../../util/geometry.js';
import { seededRng } from '../../rng.js';
import { getRegionKit } from '../../regional/index.js';
import { point } from './builder.js';
import { CarProfile, VehicleKit } from './kit.js';
import { finishRoadVehicle, rearLamps, roundHeadlamp } from './road-detail.js';
import type { ModelOptions } from '../registry.js';

export function createTuktuk(options: ModelOptions = {}) {
  const roofColor = [0x1d4ed8, 0x15803d, 0xca8a04, 0xdc2626][Math.floor(seededRng(options.seed ?? 1)() * 4)];
  const b = new VehicleKit(0x1e3a8a), roof = car_paint(roofColor), shape = new Shape();
  shape.moveTo(1.335, 0.7); shape.quadraticCurveTo(1.335, 0.96, 1.08, 0.98);
  shape.lineTo(0.61, 0.81); shape.quadraticCurveTo(0.5, 0.73, 0.44, 0.5);
  shape.lineTo(-0.3, 0.5); shape.lineTo(-0.42, 0.87); shape.lineTo(-1.23, 1.025);
  shape.quadraticCurveTo(-1.315, 1.025, -1.315, 0.88); shape.lineTo(-1.315, 0.3);
  b.archBottom(shape, -1.315, 0.4, 0.24, 0.25, [-0.75], [[0.63, 0.35], [0.82, 0.65], [1.25, 0.7]]);
  const profile: CarProfile = { shape, width: 1.26, beltY: 1.1, roofY: 1.8, roofRatio: 1,
    noseTaper: { start: 0.48, end: 1.34, ratio: 0.52 } };
  b.feature('curved-driver-apron-and-open-passenger-body', () => b.profileBody(profile));
  b.feature('three-rounded-wheels-and-steering-fork', () => {
    b.wheelAt(point(0, 0.25, 0.95), 0.25, 0.14, { faces: [-1, 1] });
    for (const side of [-1, 1]) {
      b.wheelAt(point(side * 0.52, 0.25, -0.75), 0.25, 0.14);
      b.tube(point(side * 0.09, 0.28, 0.95), point(side * 0.09, 0.83, 0.74), 0.028, b.chrome, 8);
    }
    b.fenderLips([0.95], 0.25, 0.18);
    b.tube(point(-0.31, 0.88, 0.69), point(0.31, 0.88, 0.69), 0.026, b.chrome);
  });
  b.feature('rounded-colorful-canopy-and-tubular-frame', () => {
    const s = new Shape(); s.moveTo(1.06, 1.6); s.lineTo(1.06, 1.67);
    s.quadraticCurveTo(1.06, 1.755, 0.91, 1.755); s.lineTo(-1.17, 1.755);
    s.quadraticCurveTo(-1.3, 1.755, -1.3, 1.65); s.lineTo(-1.3, 1.6); s.closePath();
    b.profileBody({ shape: s, width: 1.3, beltY: 1.6, roofY: 1.8, roofRatio: 1 }, 'full', roof);
    for (const side of [-1, 1]) {
      b.tube(point(side * 0.39, 0.88, 1.1), point(side * 0.39, 1.6, 0.96), 0.025, b.chrome, 6);
      b.tube(point(side * 0.6, 0.93, -1.24), point(side * 0.6, 1.6, -1.24), 0.025, b.chrome, 6);
      b.tube(point(side * 0.6, 0.91, -1.24), point(side * 0.6, 0.91, -0.36), 0.024, b.chrome, 6);
      b.box(point(side * 0.43, 1.05, 0.94), point(0.085, 0.1, 0.07), b.trim);
    }
    b.tube(point(-0.39, 1.6, 0.96), point(0.39, 1.6, 0.96), 0.022, b.chrome, 6);
    b.endGlass([1.1, 0.97, 0.96, 1.59], { ...profile, width: 0.88, noseTaper: undefined }, true);
  });
  b.feature('driver-seat-passenger-bench-and-lamps', () => {
    b.roundedBox(point(0, 0.62, 0.15), point(0.47, 0.14, 0.44), b.trim, 0.035);
    b.roundedBox(point(0, 0.79, -0.86), point(1.13, 0.17, 0.56), b.trim, 0.045);
    b.roundedBox(point(0, 1.04, -1.23), point(1.13, 0.35, 0.12), b.trim, 0.035);
    b.box(point(0, 0.31, -1.34), point(1.24, 0.11, 0.1), b.chrome);
    roundHeadlamp(b, 0, 0.87, 1.365, 0.125); rearLamps(b, 0.46, 0.78, -1.385);
  });
  return finishRoadVehicle(b, 'veh.tuktuk', options, [1, 1], { roofColor, passengerBench: true });
}

export function createMotorbike(options: ModelOptions = {}) {
  const color = [0xdc2626, 0x2563eb, 0x1f2937, 0xf8fafc][Math.floor(seededRng(options.seed ?? 1)() * 4)];
  const isTaxi = (options.seed ?? 1) % 2 === 0, b = new VehicleKit(color);
  const clothing = vehicleMaterial('plastic_trim_black', isTaxi ? 0xf97316 : 0x3b82f6), helmet = car_paint(isTaxi ? 0xfacc15 : 0x1e293b);
  const shape = new Shape(); shape.moveTo(0.88, 0.64); shape.quadraticCurveTo(0.91, 0.88, 0.76, 0.89);
  shape.lineTo(0.5, 0.85); shape.lineTo(0.32, 0.63); shape.lineTo(0.19, 0.4);
  shape.lineTo(-0.1, 0.4); shape.lineTo(-0.23, 0.71); shape.lineTo(-0.74, 0.73);
  shape.quadraticCurveTo(-0.89, 0.73, -0.89, 0.67);
  b.archBottom(shape, -0.89, 0.88, 0.23, 0.28, [-0.65, 0.65]);
  b.feature('curved-step-through-scooter-and-rounded-wheels', () => {
    b.profileBody({ shape, width: 0.32, beltY: 0.9, roofY: 1.55, roofRatio: 1 });
    for (const z of [-0.65, 0.65]) b.wheelAt(point(0, 0.28, z), 0.28, 0.09, { faces: [-1, 1] });
    b.roundedBox(point(0, 0.76, -0.37), point(0.31, 0.115, 0.77), b.trim, 0.035);
    b.box(point(0, 0.38, 0.08), point(0.37, 0.045, 0.32), b.trim);
    b.cylinder(point(0.17, 0.27, -0.45), 0.043, 0.63, b.chrome, 12, 'z');
    for (const side of [-1, 1]) {
      b.tube(point(side * 0.055, 0.28, 0.65), point(side * 0.055, 0.84, 0.47), 0.021, b.chrome, 8);
      b.tube(point(side * 0.29, 0.96, 0.53), point(side * 0.35, 1.065, 0.48), 0.012, b.chrome, 6);
      b.ellipsoid(point(side * 0.35, 1.08, 0.48), point(0.045, 0.035, 0.016), b.trim, 8, 4);
    }
    b.tube(point(-0.34, 0.96, 0.53), point(0.34, 0.96, 0.53), 0.021, b.chrome, 8);
    roundHeadlamp(b, 0, 0.855, 0.925, 0.07); rearLamps(b, 0.06, 0.65, -0.95);
  });
  b.feature('seated-helmeted-rider-and-taxi-vest', () => {
    b.roundedBox(point(0, 1.125, 0.04), point(0.38, 0.35, 0.26), clothing, 0.075);
    b.ellipsoid(point(0, 1.41, 0.07), point(0.145, 0.14, 0.155), helmet);
    b.ellipsoid(point(0, 1.407, 0.2), point(0.117, 0.053, 0.039), b.trim, 12, 6);
    for (const side of [-1, 1]) {
      b.tube(point(side * 0.17, 1.235, 0.12), point(side * 0.245, 1.1, 0.26), 0.052, clothing, 8);
      b.tube(point(side * 0.245, 1.1, 0.26), point(side * 0.29, 0.965, 0.53), 0.043, clothing, 8);
      b.ellipsoid(point(side * 0.29, 0.965, 0.53), point(0.046, 0.042, 0.06), b.trim, 8, 4);
      b.tube(point(side * 0.15, 0.95, -0.1), point(side * 0.22, 0.69, 0.13), 0.075, b.trim, 8);
      b.tube(point(side * 0.22, 0.69, 0.13), point(side * 0.21, 0.45, 0.05), 0.062, b.trim, 8);
      b.roundedBox(point(side * 0.21, 0.415, 0.13), point(0.13, 0.095, 0.26), b.trim, 0.028);
    }
    if (isTaxi) b.face([point(-0.1, 1.055, -0.105), point(-0.1, 1.2, -0.105), point(0.1, 1.2, -0.105), point(0.1, 1.055, -0.105)], b.chrome);
  });
  return finishRoadVehicle(b, 'veh.motorbike', options, [1, 1], { isTaxi, paintColor: color, helmetedRider: true, stepThrough: true });
}

export function createEtan(options: ModelOptions = {}) {
  const b = new VehicleKit(0xb91c1c), bedColor = getRegionKit(options.region).vehicles.etanColor(options.seed);
  const wood = getMaterial('wood_teak'), paintedWood = tint('wood_painted', bedColor);
  b.feature('ladder-frame-rounded-wheels-and-fenders', () => {
    for (const x of [-0.48, 0.48]) b.box(point(x, 0.49, 0), point(0.13, 0.16, 5.4), b.chrome);
    for (const z of [-2.45, -0.2, 1.6]) b.box(point(0, 0.49, z), point(1.25, 0.13, 0.1), b.chrome);
    b.wheelSet([1.8], 0.35, 0.18, 0.72); b.wheelSet([-1.4], 0.45, 0.25, 0.76);
    b.fenderLips([1.8], 0.35, 1.6); b.fenderLips([-1.4], 0.45, 1.78);
  });
  b.feature('exposed-engine-radiator-flywheel-and-belt', () => {
    b.roundedBox(point(0, 0.87, 2.0), point(0.58, 0.57, 0.78), b.paint, 0.065);
    b.roundedBox(point(0, 1.26, 2.15), point(0.43, 0.27, 0.38), b.paint, 0.045);
    b.cylinder(point(-0.355, 0.86, 2.0), 0.31, 0.085, b.chrome, 16, 'x');
    b.cylinder(point(-0.365, 0.64, 1.67), 0.105, 0.055, b.chrome, 12, 'x');
    b.tube(point(-0.405, 0.58, 1.6), point(-0.405, 0.62, 2.24), 0.02, b.trim, 6);
    b.tube(point(-0.405, 0.72, 1.6), point(-0.405, 1.16, 2.0), 0.02, b.trim, 6);
    b.box(point(0, 1.05, 2.42), point(0.52, 0.55, 0.065), b.trim);
    for (let i = 0; i < 8; i++) b.box(point(0, 0.83 + i * 0.06, 2.457), point(0.47, 0.018, 0.015), b.chrome);
    b.tube(point(0.22, 1.04, 1.84), point(0.22, 1.8, 1.84), 0.038, b.chrome, 8);
    for (const side of [-1, 1]) roundHeadlamp(b, side * 0.55, 0.79, 2.7, 0.095);
    rearLamps(b, 0.68, 0.91, -2.735);
  });
  b.feature('open-planked-wooden-bed-and-driver-canopy', () => {
    b.box(point(0, 0.91, -1.35), point(1.78, 0.1, 2.7), wood);
    for (const y of [1.09, 1.29, 1.49]) {
      for (const side of [-1, 1]) b.box(point(side * 0.87, y, -1.35), point(0.06, 0.14, 2.7), paintedWood);
      b.box(point(0, y, -2.7), point(1.78, 0.14, 0.06), paintedWood);
    }
    for (const side of [-1, 1]) for (const z of [-2.65, -1.35, -0.05]) b.box(point(side * 0.85, 1.27, z), point(0.08, 0.67, 0.085), wood);
    b.box(point(0, 1.29, 0.04), point(1.78, 0.74, 0.055), wood);
    b.box(point(0, 0.83, 0.61), point(1.4, 0.1, 0.84), wood);
    b.roundedBox(point(0, 1.025, 0.39), point(1.12, 0.17, 0.39), b.trim, 0.04);
    b.roundedBox(point(0, 1.28, 0.2), point(1.12, 0.36, 0.11), b.trim, 0.025);
    for (const side of [-1, 1]) for (const z of [1.08, -0.1]) b.tube(point(side * 0.72, 0.8, z), point(side * 0.72, 2.01, z), 0.027, b.chrome, 6);
    b.roundedBox(point(0, 2.055, 0.51), point(1.65, 0.09, 1.46), b.paint, 0.033);
    for (let i = -3; i <= 3; i++) b.box(point(i * 0.21, 2.104, 0.51), point(0.018, 0.008, 1.33), b.chrome);
    b.tube(point(0.3, 0.92, 0.94), point(0.3, 1.36, 0.84), 0.025, b.chrome, 6);
    const ring = new TorusGeometry(0.18, 0.02, 6, 16).rotateX(Math.PI / 2).translate(0.3, 1.36, 0.84);
    b.add(applyWorldUV(ring, 1), b.trim);
  });
  return finishRoadVehicle(b, 'veh.etan', options, [1, 1], { bedColor, exposedEngine: true, openWoodenBed: true }, 'R2');
}
