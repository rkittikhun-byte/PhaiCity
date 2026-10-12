/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { SphereGeometry } from 'three';
import { powerDomeGlowMaterial } from '../../materials/library.js';
import { applyWorldUV } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import { PowerPlantBuilder } from './power-builder.js';
import type { ModelOptions } from '../registry.js';

export const NUCLEAR_STEAM = [-9, 55, -9] as const;
export const NUCLEAR_DOME_LIGHT = [9, 25.2, -9] as const;

export function createNuclear(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options); b.plantSite();
  b.feature('cylindrical-containment-and-dome', () => {
    b.colored(0xd5d8cf, () => {
      b.cylinder(7, 18.1, 9, 9.15, -9, b.stone, 40);
      const source = new SphereGeometry(7, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(9, 18.2, -9);
      b.add(applyWorldUV(source, 1), b.stone); source.dispose();
      b.cylinder(7.18, 0.25, 9, 18.17, -9, b.stone, 40);
    });
    b.colored(0x9bafa9, () => b.box(3.2, 4, 0.15, 9, 2.1, -1.92, b.metal));
    // A small warm beacon, not a glowing reactor dome.
    b.ellipsoid(point(...NUCLEAR_DOME_LIGHT), point(0.22, 0.18, 0.22), powerDomeGlowMaterial(), 12, 5);
  });
  b.anchor('anchor_light_0', ...NUCLEAR_DOME_LIGHT);
  b.feature('hyperbolic-cooling-tower', () => {
    const throatY = 36, throatR = 4.4;
    const radius = (y: number) => Math.sqrt(throatR ** 2 + ((y - throatY) / 5.4) ** 2);
    const profile: [number, number][] = Array.from({ length: 25 }, (_, i) => {
      const y = 3 + i / 24 * 52; return [radius(y), y];
    });
    profile.push([radius(55) - 0.3, 55], [radius(55) - 0.3, 51]);
    b.colored(0xbfc4b9, () => b.shell(profile, -9, -9, 40));
    // Open air intake and mouth with a deep dark throat; no cap at the rim.
    b.colored(0x313b37, () => b.cylinder(radius(51) - 0.35, 0.08, -9, 50.9, -9, b.stone, 40));
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, c = a + 0.12;
      b.pole(point(-9 + Math.cos(a) * 7.7, 0.1, -9 + Math.sin(a) * 7.7),
        point(-9 + Math.cos(c) * radius(3), 3.1, -9 + Math.sin(c) * radius(3)), 0.22, b.stone, 6);
    }
  });
  b.anchor('anchor_steam_0', ...NUCLEAR_STEAM);
  b.feature('turbine-hall', () => {
    b.hall(25, 10, 9, -0.5, 7.6);
    for (const x of [-8, 0, 8]) {
      b.colored(0x657f7c, () => b.box(4, 1.1, 3.2, x, 9.75, 7.6, b.metal));
      b.pole(point(x, 3, 1), point(x, 3, -1.1), 0.34, b.metal, 10);
    }
  });
  b.feature('double-security-fence', () => { b.fence(19); b.fence(17.8); });
  b.feature('guard-booth-and-gate', () => {
    b.hall(3.6, 2.8, 2.8, 9, 15.5);
    for (const z of [17.8, 19]) {
      for (const x of [-3.3, 3.3]) b.cylinder(0.14, 1.1, x, 0.65, z, b.metal, 8);
      b.colored(0xe0b95e, () => b.box(6.4, 0.14, 0.14, 0, 1.05, z, b.metal));
    }
    b.shopSign('โรงไฟฟ้านิวเคลียร์', 8, 1.2, -0.5, 6.1, 12.72);
    b.shopSign('เขตควบคุม', 2.8, 0.7, 9, 2.1, 17.03);
  });
  return b.finishPlant('power.nuclear', 816, { fictional: true, coolingTowerHeight: 55, securityFences: 2 });
}
