/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry } from 'three';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { CommercialBuilder } from '../commercial/builder.js';
import { PowerPlantBuilder } from './power-builder.js';
import type { ModelOptions } from '../registry.js';

const TILT = 0.36; // ~21 degrees southward tilt
/** These plants stand on the coal plant's tiles, which are power.coal's; gameMap.powerKinds picks them (RENDERER_SPEC 6D) */
const KIND_TILES: readonly number[] = [];

function addTiltedBox(
  b: PowerPlantBuilder,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  tiltX: number,
  color: number,
  useGlass = false,
): void {
  const geom = applyWorldUV(new BoxGeometry(w, h, d).rotateX(tiltX).translate(x, y, z), 1);
  CommercialBuilder.color(geom, color);
  b.add(geom, useGlass ? b.glass : b.metal);
}

/**
 * Solar farm (`power.solar`): dense rows of tilted photovoltaic solar panel arrays covering the 4 × 4 compound,
 * complete with aluminum frames, silver busbar strips, galvanized steel support struts, inverter cabins,
 * switchyard, and control office facing the road (+Z).
 */
export function createSolar(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options);
  b.plantSite();
  // Crushed gravel and low grass field base under the solar arrays
  b.colored(0x9ea596, () => b.box(36.8, 0.06, 36.8, 0, 0.09, 0, b.stone));
  // inside its yard (plant-yard.ts) the yard's fence goes round the whole block instead
  if (options.state !== 'yard') b.fence(18.6, 2.2);

  b.feature('solar-pv-arrays', () => {
    const rowZs = [-15.2, -10.6, -6.0, -1.4, 3.2, 7.8];
    const colXs = [-14.2, -8.5, -2.8, 2.9, 8.6, 14.3];
    for (let r = 0; r < rowZs.length; r++) {
      const z = rowZs[r];
      for (let c = 0; c < colXs.length; c++) {
        // Leave space on the front-left for the switchyard and front-right for the control office on the last row
        if (r === rowZs.length - 1 && (c <= 1 || c >= 4)) continue;
        const x = colXs[c];
        // Galvanized steel support struts (front low, back high)
        for (const dx of [-1.8, 0, 1.8]) {
          b.colored(0x8d9699, () => {
            b.box(0.12, 1.15, 0.12, x + dx, 0.65, z + 1.05, b.metal);
            b.box(0.12, 2.25, 0.12, x + dx, 1.2, z - 1.05, b.metal);
          });
        }
        // Aluminum backing frame tilted toward +Z
        addTiltedBox(b, 4.9, 0.1, 3.3, x, 1.68, z, TILT, 0xc4cdd1, false);
        // Dark-blue monocrystalline photovoltaic cell surface
        addTiltedBox(b, 4.72, 0.06, 3.12, x, 1.74, z, TILT, 0x152f59, false);
        // Specular glass top coat + silver busbar grid lines
        addTiltedBox(b, 4.66, 0.03, 3.06, x, 1.77, z, TILT, 0x1e4785, true);
        for (const dx of [-1.55, 0, 1.55]) {
          addTiltedBox(b, 0.07, 0.04, 3.1, x + dx, 1.78, z, TILT, 0xcad6e0, false);
        }
        for (const dz of [-0.75, 0.75]) {
          const yOff = - Math.sin(TILT) * dz;
          const zOff = Math.cos(TILT) * dz;
          addTiltedBox(b, 4.7, 0.04, 0.06, x, 1.78 + yOff, z + zOff, TILT, 0xcad6e0, false);
        }
      }
    }
  });

  // Central string-inverter stations along the service road
  b.feature('solar-inverters', () => {
    for (const z of [-12.9, -3.7, 5.5]) {
      b.colored(0xdce0dd, () => b.mass(1.8, 1.9, 1.3, 0.05, 1.05, z, b.paint));
      b.colored(0x4b5c6b, () => b.box(1.9, 0.14, 1.4, 0.05, 2.05, z, b.metal));
    }
  });

  b.switchyard(-11.5, 12.8);
  b.transmissionTower(-16.2, 12.8);

  b.feature('solar-control-office', () => {
    b.hall(8.2, 5.2, 4.0, 11.8, 13.6);
    // Rooftop solar array on the control office itself
    addTiltedBox(b, 6.8, 0.08, 2.8, 11.8, 4.65, 13.6, 0.22, 0x18386b, false);
    b.shopSign('โรงไฟฟ้าพลังงานแสงอาทิตย์', 7.4, 1.05, 11.8, 2.9, 16.32);
  });

  return b.finishPlant('power.solar', 750, { boilerHeight: 8 }, KIND_TILES);
}

/**
 * Wind farm (`power.wind`): four tall three-bladed horizontal-axis wind turbines with tubular steel towers,
 * nacelles, switchyard, and control office.
 */
export function createWind(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options);
  b.plantSite();
  b.colored(0x889c78, () => b.box(37.5, 0.06, 37.5, 0, 0.09, 0, b.stone));
  if (options.state !== 'yard') b.fence(18.6, 2.0);

  const turbines = [[-11, -11], [11, -11], [-11, 4], [11, 4]] as const;
  b.feature('wind-turbines', () => {
    for (const [tx, tz] of turbines) {
      // Concrete foundation pad
      b.colored(0xb5b8b0, () => b.cylinder(2.4, 0.4, tx, 0.28, tz, b.stone, 12));
      // Tapered white tubular steel tower
      b.colored(0xedf0f2, () => b.shell([[1.15, 0.3], [0.95, 12], [0.68, 28], [0.62, 30]], tx, tz, 16));
      // Nacelle housing
      b.colored(0xf2f4f5, () => b.mass(1.8, 1.9, 4.2, tx, 30.6, tz + 0.4, b.paint));
      // Rotor hub + 3 blades
      b.colored(0xe2e6e8, () => b.cylinder(0.65, 1.2, tx, 30.6, tz + 2.7, b.metal, 10, Math.PI / 2));
      for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        const bx = tx + Math.sin(angle) * 5.8;
        const by = 30.6 + Math.cos(angle) * 5.8;
        b.colored(0xf5f7f8, () => b.pole(point(tx, 30.6, tz + 2.9), point(bx, by, tz + 3.0), 0.24, b.metal, 6));
      }
    }
  });

  b.switchyard(-10.5, 13.2);
  b.feature('wind-control-office', () => {
    b.hall(7.5, 5.0, 4.0, 11.5, 13.6);
    b.shopSign('โรงไฟฟ้าพลังงานลม', 6.8, 1.05, 11.5, 2.9, 16.22);
  });
  return b.finishPlant('power.wind', 750, { boilerHeight: 36 }, KIND_TILES);
}

/**
 * Combined-cycle gas turbine power plant (`power.gas`): twin turbine halls, HRSG heat-recovery boilers,
 * clean silver stacks, spherical LNG/gas storage tanks, and switchyard.
 */
export function createGas(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options);
  b.plantSite();
  if (options.state !== 'yard') b.fence(18.6, 2.4);

  b.feature('gas-turbine-halls', () => {
    for (const x of [-8.5, 3.5]) {
      b.hall(9.5, 14, 14.5, x, -6.5);
      // HRSG silver flue stack
      b.colored(0xc5ccd0, () => b.cylinder(1.1, 26, x, 14, -11.5, b.metal, 16));
      b.colored(0xb84336, () => b.cylinder(1.14, 1.2, x, 24.5, -11.5, b.metal, 16));
    }
    // Spherical gas storage tanks
    for (const z of [-9, -1]) {
      b.colored(0xd8dfe3, () => b.ellipsoid(point(13.5, 4.2, z), point(3.2, 3.2, 3.2), b.metal, 14, 10));
      for (const dx of [-2.1, 2.1]) for (const dz of [-2.1, 2.1]) {
        b.pole(point(13.5 + dx, 0.1, z + dz), point(13.5 + dx * 0.85, 3.6, z + dz * 0.85), 0.16, b.metal, 6);
      }
    }
  });

  b.switchyard(-9.5, 11.5);
  b.transmissionTower(-16.2, 11.5);
  b.feature('gas-control-office', () => {
    b.hall(7.5, 5.0, 4.2, 12, 13.2);
    b.shopSign('โรงไฟฟ้าก๊าซธรรมชาติ', 7.0, 1.05, 12, 3.0, 15.82);
  });
  return b.finishPlant('power.gas', 750, { boilerHeight: 28 }, KIND_TILES);
}

/**
 * Hydroelectric power plant (`power.hydro`): stepped concrete dam wall, reservoir water basin behind,
 * spillway gates, transformer deck, and powerhouse hall.
 */
export function createHydro(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options);
  b.plantSite();
  // Upper reservoir water (-Z) and lower tailrace channel (+Z)
  b.colored(0x2d688a, () => {
    b.box(36, 6.5, 14, 0, 3.3, -11, b.glass);
    b.box(24, 1.2, 12, 0, 0.65, 11, b.glass);
  });
  // Concrete gravity dam wall across the middle
  b.feature('hydro-dam-wall', () => {
    b.colored(0xc2beb4, () => {
      b.mass(37, 14, 7.5, 0, 7.1, -1.5, b.stone);
      b.box(37.4, 1.2, 9.2, 0, 13.8, -1.5, b.stone);
    });
    // Spillway piers
    for (const x of [-12, -6, 0, 6, 12]) {
      b.colored(0xa8a499, () => b.box(1.4, 15.6, 8.4, x, 7.9, -1.5, b.stone));
    }
  });
  b.feature('hydro-powerhouse', () => {
    b.hall(16, 6.5, 7.5, 0, 5.2);
    b.shopSign('โรงไฟฟ้าพลังน้ำ', 6.5, 1.05, 0, 5.8, 8.6);
  });
  b.switchyard(-13.5, 11.5);
  return b.finishPlant('power.hydro', 750, { boilerHeight: 16 }, KIND_TILES);
}
