/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, Material } from 'three';
import { car_paint, getMaterial, vehicleMaterial } from '../../materials/library.js';
import { getRegionKit } from '../../regional/index.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point } from './builder.js';
import { VehicleKit } from './kit.js';
import { finishVehicle, loft } from './forms.js';

type HullStation = { z: number; width: number; bottom: number; top: number };
/** Rounded stations, flared topsides and a true flat bottom. Both small craft include an inner wooden lining. */
function hull(b: VehicleKit, stations: readonly HullStation[], finish: (p: ReturnType<typeof point>) => Material,
  deck: boolean, lining?: Material, segments = 20): void {
  const ring = (s: HullStation, inside: boolean) => Array.from({ length: segments + 1 }, (_, i) => {
    const u = Math.cos(Math.PI * i / segments), flare = Math.max(0, (Math.abs(u) - 0.48) / 0.52);
    return point(u * Math.max(0.015, s.width - (inside ? 0.045 : 0)),
      s.bottom + (inside ? 0.055 : 0) + (s.top - s.bottom - (inside ? 0.055 : 0)) * flare ** 1.45, s.z);
  });
  const outer = stations.map(s => ring(s, false)); loft(b, outer, p => deck && p.y > stations[0].top - 0.01 && Math.abs(p.x) < 0.1 ? b.chrome : finish(p), deck, true);
  if (lining) loft(b, stations.map(s => ring(s, true).reverse()), () => lining, false);
}

function interpolateHull(length: number, width: number, top: number, bow: number, stern: number, count: number): HullStation[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1), q = t * 2 - 1;
    // Fuller rounded stern, fine flared bow. Ends meet in a narrow stem instead of a box transom.
    const w = width * Math.max(0.015, q > 0 ? (1 - q ** 3) ** 0.7 : (1 - (-q) ** 5) ** 0.42);
    return { z: q * length / 2, width: w, bottom: Math.abs(q) ** 8 * 0.26,
      top: top + (q > 0 ? bow * q ** 7 : stern * (-q) ** 8) };
  });
}

export function createShip(options: ModelOptions = {}): Group {
  const b = new VehicleKit(0x1e293b), red = car_paint(0x881337), white = car_paint(0xf4f3ef), amber = car_paint(0xd97706);
  const blue = car_paint(0x1e40af), green = car_paint(0x15803d), mats = [blue, green, red, amber];
  const rng = seededRng(options.seed ?? 1), containerColors: number[] = [];
  const stations = interpolateHull(34.93, 3.6, 3.6, 1.05, 0.14, 29);
  b.feature('flared-bow-flat-bottom-rounded-stern-hull', () => {
    hull(b, stations, p => p.y < 1.8 ? red : b.paint, true, undefined, 20);
    // A separate working deck is bounded by the hull, with a pointed forecastle platform.
    b.roundedBox(point(0, 3.615, 3), point(6.56, 0.08, 21.2), b.chrome, 0.03);
    for (const side of [-1, 1]) {
      const path = stations.filter(s => s.z < -8.5 || s.z > 12.6);
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], c = path[i + 1]; if (c.z - a.z > 2) continue;
        b.tube(point(side * a.width, a.top + 0.48, a.z), point(side * c.width, c.top + 0.48, c.z), 0.035, white, 6);
      }
      for (const s of stations.filter((s, i) => i % 2 === 0 && (s.z < -8.5 || s.z > 12.6)))
        b.tube(point(side * s.width, s.top, s.z), point(side * s.width, s.top + 0.48, s.z), 0.03, white, 6);
    }
    for (const z of [-16, 14.5]) for (const side of [-1, 1]) {
      b.cylinder(point(side * 1.1, z > 0 ? 4.02 : 3.9, z), 0.16, 0.3, b.chrome, 10);
      b.box(point(side * 1.1, z > 0 ? 4.19 : 4.07, z), point(0.46, 0.08, 0.12), b.chrome);
    }
  });
  b.feature('seeded-corrugated-container-stacks', () => {
    for (const z of [-4, 2.5, 9]) for (const x of [-2.1, 0, 2.1]) for (const tier of [0, 1]) {
      const material = mats[Math.floor(rng() * mats.length)]; containerColors.push(material.color.getHex());
      const y = tier ? 7.35 : 4.9, h = tier ? 2.4 : 2.5;
      b.roundedBox(point(x, y, z), point(2, h, 5.8), material, 0.04);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 10; i++) {
          const rz = z - 2.67 + i * 0.59, lo = y - h / 2 + 0.065, hi = y + h / 2 - 0.065;
          for (const flank of [-1, 1]) {
            const v = [point(x + side * 1.001, lo, rz + flank * 0.043), point(x + side * 1.026, lo, rz),
              point(x + side * 1.026, hi, rz), point(x + side * 1.001, hi, rz + flank * 0.043)];
            b.face(side * flank > 0 ? v : v.reverse(), material);
          }
        }
        for (const dx of [-0.56, 0.56]) {
          const v = [point(x + dx - 0.014, y - h / 2 + 0.13, z + side * 2.908),
            point(x + dx + 0.014, y - h / 2 + 0.13, z + side * 2.908),
            point(x + dx + 0.014, y + h / 2 - 0.13, z + side * 2.908), point(x + dx - 0.014, y + h / 2 - 0.13, z + side * 2.908)];
          b.face(side > 0 ? v : v.reverse(), b.chrome);
        }
      }
    }
  });
  b.feature('stern-bridge-windows-rails-and-funnel', () => {
    b.roundedBox(point(0, 5.4, -12.5), point(6.6, 3.6, 7), white, 0.13);
    b.roundedBox(point(0, 7.28, -12.5), point(7.6, 0.22, 5.1), white, 0.08);
    b.roundedBox(point(0, 8.61, -12.5), point(7.6, 0.19, 5.1), white, 0.075);
    // Bridge glass is between roof and sill, with no solid accommodation block behind it.
    b.box(point(0, 8.04, -10.04), point(7.2, 1.02, 0.045), b.glass);
    b.box(point(0, 8.04, -14.96), point(7.2, 1.02, 0.045), b.glass);
    for (const side of [-1, 1]) b.box(point(side * 3.66, 8.04, -12.5), point(0.045, 1.02, 4.83), b.glass);
    for (const x of [-3.62, -2.4, -1.2, 0, 1.2, 2.4, 3.62]) b.box(point(x, 8.04, -10.007), point(0.085, 1.08, 0.07), white);
    for (const side of [-1, 1]) for (const z of [-14.94, -13.72, -12.5, -11.28, -10.06])
      b.box(point(side * 3.69, 8.04, z), point(0.07, 1.08, 0.085), white);
    for (const side of [-1, 1]) for (const z of [-14, -12.5, -11]) {
      b.box(point(side * 3.307, 5.86, z), point(0.035, 0.54, 0.75), b.glass);
      b.tube(point(side * 3.36, 7.35, z), point(side * 3.36, 7.75, z), 0.025, white, 6);
    }
    b.roundedBox(point(0, 8.4, -15.6), point(1.8, 2.6, 2), amber, 0.14);
    b.roundedBox(point(0, 9.75, -15.6), point(1.9, 0.2, 2.1), b.paint, 0.06);
    b.smokeAnchor('anchor_smoke_0', point(0, 9.85, -15.6));
    b.cylinder(point(0, 9.6, -12.5), 0.1, 2, b.chrome, 12);
    b.roundedBox(point(0, 10.2, -12.5), point(1.8, 0.14, 0.18), b.chrome, 0.04);
    b.tube(point(-0.8, 8.75, -12.5), point(0, 10.6, -12.5), 0.035, b.chrome, 8);
    b.tube(point(0.8, 8.75, -12.5), point(0, 10.6, -12.5), 0.035, b.chrome, 8);
  });
  return finishVehicle(b, 'veh.ship', [1, 4], options, { length: 35, containerColors, hullStations: stations, bridgeZ: -12.5 });
}

function gunwales(b: VehicleKit, stations: readonly HullStation[], material: Material): void {
  for (const side of [-1, 1]) for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], c = stations[i + 1];
    b.tube(point(side * a.width, a.top, a.z), point(side * c.width, c.top, c.z), 0.03, material, 6);
  }
}

export function createLongtailBoat(options: ModelOptions = {}): Group {
  const color = [0x0891b2, 0xb91c1c, 0x15803d, 0xd97706][Math.floor(seededRng(options.seed ?? 1)() * 4)];
  const b = new VehicleKit(color), teak = getMaterial('wood_teak'), canvas = vehicleMaterial('plastic_trim_black', 0xc79b60);
  const red = vehicleMaterial('plastic_trim_black', 0xef4444), gold = vehicleMaterial('plastic_trim_black', 0xfacc15);
  const stations = interpolateHull(9, 0.8, 0.78, 0.77, 0.24, 19);
  b.feature('curved-open-wooden-hull-and-thwarts', () => {
    hull(b, stations, p => p.y < 0.39 && p.y > 0.27 ? b.paint : teak, false, teak, 12); gunwales(b, stations, b.paint);
    b.box(point(0, 0.14, 0), point(0.83, 0.07, 5.4), teak);
    for (const z of [-1.5, -0.5, 0.5, 1.5, 2.5]) b.box(point(0, 0.43, z), point(1.19, 0.09, 0.35), teak);
    for (const z of [-2, 0, 2]) for (const side of [-1, 1]) b.tube(point(side * 0.34, 0.18, z), point(side * 0.72, 0.69, z), 0.025, teak, 6);
  });
  b.feature('arched-canopy-and-colored-bow-ribbons', () => {
    const rings = [-2, -0.6, 0.8, 2.2].map(z => Array.from({ length: 9 }, (_, i) => {
      const x = (i / 8 - 0.5) * 1.4; return point(x, 1.72 + 0.17 * Math.cos(x / 0.7 * Math.PI / 2), z);
    })); loft(b, rings, () => canvas, false);
    for (const z of [-2, -0.6, 0.8, 2.2]) {
      for (const side of [-1, 1]) b.tube(point(side * 0.68, 0.59, z), point(side * 0.68, 1.73, z), 0.025, b.chrome, 6);
      for (let i = 0; i < 8; i++) b.tube(rings[0][i].clone().setZ(z), rings[0][i + 1].clone().setZ(z), 0.021, b.chrome, 6);
    }
    for (const [material, y, dx] of [[red, 1.44, -0.11], [gold, 1.28, 0.1]] as const) {
      b.tube(point(-0.16, y, 4.35), point(0.16, y, 4.35), 0.045, material, 6);
      const ribbon = [point(dx - 0.06, y, 4.36), point(dx + 0.06, y, 4.36), point(dx + 0.12, y - 0.32, 4.48), point(dx + 0.07, y - 0.54, 4.4), point(dx - 0.02, y - 0.52, 4.39)];
      b.face(ribbon, material); b.face([...ribbon].reverse(), material);
    }
  });
  b.feature('exposed-swivel-engine-and-long-propeller-shaft', () => {
    b.roundedBox(point(0, 0.65, -3.2), point(0.55, 0.5, 0.75), b.chrome, 0.06);
    for (const z of [-3.44, -3.23, -3.02]) b.cylinder(point(0, 0.94, z), 0.09, 0.16, b.paint, 10);
    b.tube(point(0.23, 0.75, -3.31), point(0.23, 1.17, -3.31), 0.045, b.chrome, 8);
    b.cylinder(point(0, 0.51, -3.61), 0.09, 0.33, b.chrome, 12);
    b.tube(point(0, 0.65, -3.49), point(0, 0.22, -6.45), 0.04, b.chrome, 10);
    b.cylinder(point(0, 0.22, -6.45), 0.055, 0.09, b.chrome, 12, 'z');
    for (const sign of [-1, 1]) b.face([point(0, 0.22, -6.43), point(0.12, 0.22 + sign * 0.15, -6.45),
      point(0.04, 0.22 + sign * 0.2, -6.46), point(-0.07, 0.22 + sign * 0.07, -6.45)], b.chrome);
    b.tube(point(0, 0.88, -3.35), point(0, 0.98, -2.22), 0.03, b.chrome, 8);
  });
  return finishVehicle(b, 'veh.longtail_boat', [1, 2], options, { trimColor: color, hullStations: stations, propellerZ: -6.45 });
}

export function createKorlaeBoat(options: ModelOptions = {}): Group {
  const colors = getRegionKit(options.region ?? 'central').vehicles.korlaeColors;
  const b = new VehicleKit(colors[0]), teak = getMaterial('wood_teak'), blue = car_paint(colors[1]), red = car_paint(colors[2]), white = car_paint(colors[3]);
  const net = vehicleMaterial('plastic_trim_black', 0xafa58d), stations = interpolateHull(8.5, 1, 1.05, 1.55, 1.05, 21);
  b.feature('curved-wooden-hull-high-bow-and-painted-bands', () => {
    hull(b, stations, p => {
      const q = p.z / 4.25, top = 1.05 + (q > 0 ? 1.55 * q ** 7 : 1.05 * (-q) ** 8);
      return p.y > top * 0.89 ? red : p.y > top * 0.64 ? blue : b.paint;
    }, false, teak, 12); gunwales(b, stations, red);
    for (const z of [-1.8, -0.6, 0.6, 1.8]) b.box(point(0, 0.64, z), point(1.65, 0.11, 0.32), teak);
    b.box(point(0, 0.22, 0), point(0.86, 0.08, 4.5), teak);
    for (const side of [-1, 1]) {
      for (let i = 2; i < stations.length - 2; i++) {
        const s = stations[i], next = stations[i + 1];
        b.tube(point(side * s.width * 0.94, s.top * 0.86, s.z), point(side * next.width * 0.94, next.top * 0.86, next.z), 0.018, white, 6);
      }
      // Hand-painted geometric petals follow the flared hull; no sacred figures or agency symbols.
      for (const z of [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4]) {
        const x = side * (1 - (Math.max(0, z) / 4.25) ** 3) ** 0.7 * 0.84;
        const motif = [point(x, 0.46, z), point(x + side * 0.09, 0.6, z - 0.25), point(x + side * 0.14, 0.79, z), point(x + side * 0.09, 0.6, z + 0.25)];
        b.face(side > 0 ? motif : [...motif].reverse(), white);
        b.tube(point(x + side * 0.08, 0.58, z - 0.14), point(x + side * 0.14, 0.73, z), 0.025, red, 6);
      }
    }
  });
  b.feature('fishing-net-and-stowed-pole', () => {
    b.ellipsoid(point(0, 0.53, -0.8), point(0.53, 0.22, 0.41), net, 16, 8);
    for (let i = 0; i < 5; i++) b.tube(point(-0.45, 0.59, -1.07 + i * 0.13), point(0.45, 0.59, -1.07 + i * 0.13), 0.014, white, 6);
    b.tube(point(0.35, 0.77, -1.3), point(0.35, 0.87, 2.3), 0.04, b.chrome, 8);
  });
  return finishVehicle(b, 'veh.korlae_boat', [1, 2], options, { palette: colors, hullStations: stations, trafficRegions: ['south'] }, 'R2');
}
