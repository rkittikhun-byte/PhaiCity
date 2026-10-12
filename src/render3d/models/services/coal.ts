/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { point } from '../../regional/geometry.js';
import { seededRng } from '../../rng.js';
import { PowerPlantBuilder } from './power-builder.js';
import type { ModelOptions } from '../registry.js';

export const COAL_STACKS = [[5, 44, -15], [15, 44, -15], [5, 44, -5], [15, 44, -5]] as const;

export function createCoal(options: ModelOptions = {}) {
  const b = new PowerPlantBuilder(options), random = seededRng(options.seed); b.plantSite();
  b.feature('35m-boiler-house', () => {
    // The complete boiler envelope, including its roof, ends exactly at 35 m.
    b.hall(13, 15, 34.72, -6.5, -9);
    for (const y of [6, 13, 20, 27]) {
      b.colored(0xa7b1a9, () => b.box(13.2, 0.18, 0.5, -6.5, y, -1.2, b.metal));
      for (const x of [-11.5, -7.5, -3.5]) b.box(2.6, 1.3, 0.08, x, y + 1.6, -1.42, b.metal);
    }
  });
  COAL_STACKS.forEach(([x, top, z], i) => {
    b.feature('smoke-stack', () => {
      b.colored(0xa5a69d, () => b.shell([[1.8, 0.08], [1.75, 1], [1.2, top - 1], [1.2, top],
        [0.95, top], [0.95, top - 2.5]], x, z, 20));
      b.colored(0x262b29, () => b.cylinder(0.94, 0.08, x, top - 2.45, z, b.metal, 20));
      for (const y of [12, 24, 36]) b.colored(0x987b62, () => b.cylinder(1.4 - y / top * 0.17, 0.18, x, y, z, b.metal, 20));
      b.pole(point(x, 28, z), point(-0.05, 28, z), 0.7, b.metal, 12);
    });
    b.anchor(`anchor_smoke_${i}`, x, top, z);
  });
  b.feature('black-coal-pile', () => {
    b.colored(0x272a29, () => {
      b.ellipsoid(point(3.5, 0.15, 10.2), point(5.4, 2.9, 4.4), b.stone, 12, 6);
      const pile = b.parts[b.parts.length - 1].geometry, positions = pile.getAttribute('position');
      for (let i = 0; i < positions.count; i++) positions.setY(i, Math.max(0.1, positions.getY(i)));
      pile.computeVertexNormals();
    });
  });
  b.feature('coal-conveyor', () => {
    const start = point(3.5, 2.5, 10), end = point(-5, 18, -1.1);
    b.pole(start, end, 0.68, b.metal, 4);
    for (let n = 0; n <= 5; n++) {
      const p = start.clone().lerp(end, n / 5);
      b.pole(point(p.x, 0.1, p.z), p, 0.1, b.metal, 4);
      b.box(1.7, 0.15, 0.2, p.x, p.y + 0.25, p.z, b.metal);
    }
  });
  b.switchyard(-9.5, 9.5);
  for (const z of [-10, 9]) b.transmissionTower(-16.3, z);
  b.feature('coal-control-office', () => {
    b.hall(7, 5, 4.2, 14, 13);
    b.shopSign('โรงไฟฟ้าถ่านหิน', 6.5, 1.05, 14, 3, 15.62);
    b.colored(0xe3dfc8, () => b.box(3.2, 0.016, 0.15, 13 + random() * 0.1, 0.12, 17, b.paint));
  });
  return b.finishPlant('power.coal', 750, { boilerHeight: 35, stackTops: COAL_STACKS });
}
