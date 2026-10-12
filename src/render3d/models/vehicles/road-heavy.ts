/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Shape } from 'three';
import { car_paint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { point } from './builder.js';
import { CarProfile, VehicleKit } from './kit.js';
import { finishRoadVehicle, glazedBody, rectangle, routeDisplay } from './road-detail.js';
import type { ModelOptions } from '../registry.js';

export function createBus(options: ModelOptions = {}) {
  const isAircon = (options.seed ?? 1) % 2 === 0, b = new VehicleKit(isAircon ? 0x1e3a8a : 0xfef3c7);
  const skirt = car_paint(isAircon ? 0x0284c7 : 0xb91c1c), shape = new Shape();
  shape.moveTo(5.205, 0.55); shape.lineTo(5.205, 1.5); shape.lineTo(5.205, 2.62); shape.lineTo(5.205, 2.72);
  shape.quadraticCurveTo(5.205, 3.055, 4.9, 3.055); shape.lineTo(-4.9, 3.055);
  shape.quadraticCurveTo(-5.205, 3.055, -5.205, 2.78); shape.lineTo(-5.205, 2.62);
  shape.lineTo(-5.205, 1.65); shape.lineTo(-5.205, 0.55);
  b.archBottom(shape, -5.205, 5.205, 0.32, 0.5, [-2.8, 3.4]);
  const profile: CarProfile = { shape, width: 2.5, beltY: 1.65, roofY: 3.1, roofRatio: 0.96,
    frontGlass: [5.205, 1.5, 5.205, 2.62], rearGlass: [-5.205, 1.65, -5.205, 2.62] };
  // One connected band has downward door cut-outs; the offside lower openings are closed with body sheets.
  const opening = [[-4.75, 1.65], [0, 1.65], [0, 0.65], [0.86, 0.65], [0.86, 1.65],
    [4.03, 1.65], [4.03, 0.65], [4.78, 0.65], [4.78, 2.65], [-4.75, 2.65]] as const;
  b.windowHole(shape, opening);
  b.feature('low-floor-rounded-bus-body', () => b.profileBody(profile));
  b.feature('continuous-window-band-and-folding-doors', () => {
    b.sideWindow(rectangle(-4.75, 1.65, 4.78, 2.65), profile);
    b.endGlass(profile.frontGlass!, profile, true); b.endGlass(profile.rearGlass!, profile, false);
    for (const z of [-4.05, -2.6, -1.18, 1.1, 2.6, 4.02]) b.sideSheet(rectangle(z - 0.03, 1.63, z + 0.03, 2.68), profile, b.trim, [-1, 1], -0.002);
    for (const [rear, front] of [[0, 0.86], [4.03, 4.78]]) {
      b.sideSheet(rectangle(rear, 0.65, front, 1.65), profile, b.glass, [-1]);
      b.sideSheet(rectangle(rear, 1.43, front, 1.65), profile, b.paint, [1], -0.002);
      for (let n = 0; n <= 4; n++) {
        const z = rear + (front - rear) * n / 4;
        b.sideSheet(rectangle(z - 0.012, 0.64, z + 0.012, 2.66), profile, b.trim, [-1], -0.003);
      }
      b.box(point(-1.1, 0.58, (rear + front) / 2), point(0.24, 0.07, front - rear), b.trim);
    }
    for (const y of [1.64, 2.66]) b.sideSheet(rectangle(-4.77, y - 0.018, 4.8, y + 0.018), profile, b.trim, [-1, 1], -0.003);
  });
  b.feature('two-tone-skirt-with-clear-arches', () => {
    const side = new Shape(); side.moveTo(5.19, 1.43); side.lineTo(-5.19, 1.43);
    b.archBottom(side, -5.19, 5.19, 0.34, 0.5, [-2.8, 3.4]); b.sidePanel(side, profile, skirt, [1]);
    const doorSide = new Shape(); doorSide.moveTo(5.19, 1.43);
    for (const [front, rear] of [[4.78, 4.03], [0.86, 0]]) {
      doorSide.lineTo(front, 1.43); doorSide.lineTo(front, 0.65); doorSide.lineTo(rear, 0.65); doorSide.lineTo(rear, 1.43);
    }
    doorSide.lineTo(-5.19, 1.43); b.archBottom(doorSide, -5.19, 5.19, 0.34, 0.5, [-2.8, 3.4]);
    b.sidePanel(doorSide, profile, skirt, [-1]);
    for (const front of [true, false]) {
      const z = (front ? 1 : -1) * 5.252, vertices = [point(-1.18, 0.44, z), point(1.18, 0.44, z), point(1.18, 1.43, z), point(-1.18, 1.43, z)];
      b.face(front ? vertices : vertices.reverse(), skirt);
    }
  });
  b.feature('six-tires-and-dished-heavy-rims', () => {
    for (const side of [-1, 1]) {
      b.wheelAt(point(side * 1.08, 0.5, 3.4), 0.5, 0.28, { rim: 'dish' });
      b.wheelAt(point(side * 1.08, 0.5, -2.8), 0.5, 0.24, { rim: 'dish' });
      b.wheelAt(point(side * 0.8, 0.5, -2.8), 0.5, 0.24, { rim: 'none' });
    }
  });
  b.fittings(10.5, 2.5, 1.03, 4.85, { indicators: false, mirrorY: 2.12, lampFrames: true });
  const route = `P${100 + ((options.seed ?? 1) >>> 0) % 100}`;
  b.feature('fictional-route-display-and-roof-ac', () => {
    routeDisplay(b, route, 2.87, 5.273);
    b.roundedBox(point(0, 3.13, 0.5), point(1.65, 0.14, 2.6), b.trim, 0.035);
    for (const x of [-0.5, 0.5]) b.cylinder(point(x, 3.203, 0.5), 0.24, 0.009, b.chrome, 12);
    for (let i = 0; i < 6; i++) b.box(point(0, 3.208, -0.4 + i * 0.16), point(1.1, 0.009, 0.025), b.trim);
  });
  return finishRoadVehicle(b, 'veh.bus', options, [1, 2], { isAircon, route, floorHeight: 0.58, foldingDoors: 2 });
}

export function createTruck(options: ModelOptions = {}) {
  const random = seededRng(options.seed ?? 1), color = [0x1e3a8a, 0x047857, 0xf8fafc, 0xd97706][Math.floor(random() * 4)];
  const b = new VehicleKit(color), cargo = car_paint(0x63707c), hasBox = (options.seed ?? 1) % 2 === 0, shape = new Shape();
  shape.moveTo(3.555, 0.82); shape.lineTo(3.555, 1.83); shape.lineTo(3.39, 2.64);
  shape.quadraticCurveTo(3.34, 2.855, 3.15, 2.855); shape.lineTo(1.43, 2.855);
  shape.quadraticCurveTo(1.255, 2.855, 1.255, 2.68); shape.lineTo(1.255, 0.8);
  b.archBottom(shape, 1.255, 3.555, 0.65, 0.5, [2.4]);
  const profile: CarProfile = { shape, width: 2.3, beltY: 1.78, roofY: 2.9,
    frontGlass: [3.555, 1.83, 3.39, 2.64] };
  glazedBody(b, profile, [[[1.42, 1.88], [3.37, 1.88], [3.19, 2.61], [1.42, 2.61]]]);
  b.feature('six-distinct-wheels-with-dual-rear-pairs', () => {
    for (const side of [-1, 1]) {
      b.wheelAt(point(side * 1.02, 0.5, 2.4), 0.5, 0.25);
      b.wheelAt(point(side * 1.07, 0.5, -1.8), 0.5, 0.22, { rim: 'dish' });
      b.wheelAt(point(side * 0.8, 0.5, -1.8), 0.5, 0.22, { rim: 'none' });
    }
  });
  b.feature('separate-cargo-body-and-ladder-frame', () => {
    for (const x of [-0.43, 0.43]) b.box(point(x, 0.65, -0.18), point(0.1, 0.18, 6.72), b.trim);
    for (const z of [-2.7, -0.6, 1.1]) b.box(point(0, 0.65, z), point(1.02, 0.12, 0.08), b.chrome);
    b.roundedBox(point(0, 1.16, -1.24), point(2.28, 0.16, 4.64), cargo, 0.04);
    if (hasBox) {
      b.roundedBox(point(0, 2.02, -1.24), point(2.28, 1.6, 4.64), cargo, 0.05);
      for (const x of [-0.56, 0.56]) b.box(point(x, 2.01, -3.568), point(0.022, 1.37, 0.026), b.chrome);
      b.box(point(0, 2.01, -3.569), point(0.035, 1.57, 0.03), b.trim);
    } else {
      for (const side of [-1, 1]) b.roundedBox(point(side * 1.1, 1.59, -1.24), point(0.075, 0.66, 4.64), cargo, 0.025);
      b.roundedBox(point(0, 1.59, -3.53), point(2.28, 0.66, 0.075), cargo, 0.025);
      b.box(point(0, 2.02, 1.12), point(2.22, 1.63, 0.065), cargo);
    }
    b.cylinder(point(-0.79, 0.72, 0), 0.23, 1.1, b.chrome, 12, 'z');
    for (const z of [-1.8]) b.fenderLips([z], 0.5, 2.3);
    for (const side of [-1, 1]) {
      b.box(point(side * 1.15, 1.75, 1.63), point(0.027, 0.055, 0.28), b.chrome);
      b.box(point(side * 0.97, 0.76, 1.35), point(0.36, 0.075, 0.5), b.trim);
    }
  });
  b.fittings(7.2, 2.3, 1.05, 3.3, { indicators: false, mirrorY: 2.02, lampFrames: true });
  return finishRoadVehicle(b, 'veh.truck', options, [1, 2], { paintColor: color, cargoType: hasBox ? 'box' : 'flatbed', cabOver: true });
}
