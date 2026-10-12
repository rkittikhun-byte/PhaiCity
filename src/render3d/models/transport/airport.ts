/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { transportRadarMaterial, transportMotionDepthMaterial } from '../../materials/library.js';
import { mergeByMaterial } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import { createAirplane } from '../vehicles/aircraft.js';
import { TransportBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const AIRPORT_RADAR = [-5, 6.4, -25] as const;
export const AIRPORT_PARKED_PLANES = [[-14, 0], [14, 0]] as const;

export function createAirport(options: ModelOptions = {}) {
  const b = new TransportBuilder(options), palette = b.kit.services.palette('airport', options.seed); b.hubSite(6);
  b.feature('runway-along-X', () => {
    b.box(59, 0.04, 12, 0, 0.13, 22, b.asphalt);
    b.colored(0xf3efdf, () => {
      for (const z of [16.3, 27.7]) b.box(58, 0.012, 0.15, 0, 0.16, z, b.paint);
      for (let i = 0; i < 9; i++) b.box(2.8, 0.012, 0.22, -20 + i * 5, 0.16, 22, b.paint);
      for (const x of [-26, 26]) for (const z of [-4.3, -3, -1.7, 1.7, 3, 4.3]) b.box(3.3, 0.012, 0.6, x, 0.16, 22 + z, b.paint);
      for (const x of [-19, 19]) for (const z of [19.3, 24.7]) b.box(2.7, 0.012, 0.95, x, 0.16, z, b.paint);
    });
  });
  b.feature('apron-and-taxiway', () => {
    b.colored(0x9ea9a2, () => b.box(55, 0.025, 29.5, 0, 0.117, -0.3, b.stone));
    b.colored(0xd3b965, () => {
      for (const [x] of AIRPORT_PARKED_PLANES) {
        b.box(0.12, 0.014, 23, x, 0.145, 0, b.paint);
        b.box(4.4, 0.014, 0.12, x, 0.145, -11.7, b.paint);
      }
      b.box(0.16, 0.014, 17, 0, 0.145, 11.5, b.paint);
    });
  });
  b.feature('passenger-terminal', () => {
    b.colored(palette.wall, () => {
      b.mass(18, 1.2, 9, -18, 0.7, -19, b.paint);
      for (const x of [-26.8, -23.3, -19.8, -16.3, -12.8, -9.2]) b.box(0.24, 4.7, 0.3, x, 3.45, -14.52, b.paint);
      b.box(18, 0.4, 9, -18, 5.7, -19, b.paint);
    });
    b.box(17.5, 3.8, 0.07, -18, 3.25, -14.46, b.glass);
    b.box(0.07, 3.8, 8.5, -26.96, 3.25, -19, b.glass);
    b.box(17.5, 3.8, 0.07, -18, 3.25, -23.54, b.glass);
    b.civicRoof(18, 9, -18, 5.9, -19);
    b.shopSign('ท่าอากาศยานเมืองไผ่', 12.5, 1.15, -18, 5.38, -14.32, { background: palette.wall, foreground: 0x244438 });
  });
  b.feature('control-tower', () => {
    b.colored(0xd4d8ce, () => {
      b.mass(3.4, 14, 3.4, 24, 7.1, -22, b.paint);
      b.mass(6.4, 0.6, 6.4, 24, 14.1, -22, b.paint);
      b.box(6.8, 0.22, 6.8, 24, 17.05, -22, b.paint);
    });
    b.box(6.1, 2.5, 6.1, 24, 15.65, -22, b.glass);
    for (const x of [21, 27]) for (const z of [-25, -19]) b.box(0.14, 2.6, 0.14, x, 15.65, z, b.metal);
    b.pole(point(24, 17.15, -22), point(24, 20.5, -22), 0.045, b.metal, 6);
  });
  b.feature('parked-airplanes', () => {
    for (const [x, z] of AIRPORT_PARKED_PLANES) b.parkedVehicle(createAirplane(options), x, z, Math.PI);
  });
  b.feature('car-park-and-access-road', () => {
    b.box(59, 0.025, 2.5, 0, 0.113, -28, b.asphalt);
    b.box(15, 0.025, 7.2, 8.5, 0.113, -23.3, b.asphalt);
    for (const x of [3, 6.6, 10.2, 13.8]) b.car(x, -23, b.metal);
    b.colored(0xe5dfbd, () => {
      for (const x of [1.6, 5.2, 8.8, 12.4, 16]) b.box(0.07, 0.013, 4.4, x, 0.145, -23, b.paint);
      for (const x of [-25, -13, -1, 11, 23]) b.box(4, 0.013, 0.12, x, 0.145, -28, b.paint);
    });
  });
  b.feature('radar-mast', () => {
    b.cylinder(0.9, 0.3, -5, 0.25, -25, b.stone, 12);
    b.pole(point(-5, 0.1, -25), point(...AIRPORT_RADAR), 0.18, b.metal, 8);
  });
  const root = b.finishHub('port.airport', 6, 716, 'R2', { palette, roofForm: b.kit.services.roofForm,
    roofOrnament: b.kit.services.ornament, runwaySize: [59, 12], runwayAxis: 'X', runwayCenterZ: 22,
    parkedAirplanes: 2, airplaneSource: 'veh.airplane', parkedPlaneCenters: AIRPORT_PARKED_PLANES, entranceSide: '-Z' });
  const dish = new TransportBuilder(options), material = transportRadarMaterial();
  dish.colored(0x527974, () => {
    dish.box(4.4, 1.15, 0.32, 0, 0.3, 0, material);
    for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) dish.box(0.06, 1.3, 0.07, x, 0.3, 0.22, material);
    dish.cylinder(0.3, 0.7, 0, -0.2, 0, material, 10);
  });
  const radar: Group = mergeByMaterial('port.airport/radar', dish.parts); dish.parts.forEach(part => part.geometry.dispose());
  radar.name = 'anim_radar'; radar.position.set(...AIRPORT_RADAR);
  radar.children.forEach(node => { if ('customDepthMaterial' in node) node.customDepthMaterial = transportMotionDepthMaterial(material); });
  root.add(radar); b.refreshTriangles(root); return root;
}
