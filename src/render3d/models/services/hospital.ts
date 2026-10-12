/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, CylinderGeometry, Object3D, PlaneGeometry } from 'three';
import { tint } from '../../materials/library.js';
import { hospitalAtlas } from '../../materials/signs.js';
import { ZoneBuilder } from '../residential/zone-builder.js';
import { applyWorldUV } from '../../util/geometry.js';
import { point } from '../../regional/geometry.js';
import type { ModelOptions } from '../registry.js';

export function createHospital(options: ModelOptions = {}) {
  const b = new ZoneBuilder(options), colors = b.kit.civicPalette(options.seed), wall = tint('plaster_tint', colors.wall), trim = tint('plaster_tint', colors.trim), atlas = hospitalAtlas();
  b.stone = wall; b.site(wall, wall); b.entrance(wall, 6.2);
  b.feature('six-storey-hospital', () => {
    b.mass(22, 17.7, 15, 0, 9.06, -2.2, wall);
    b.facade(22, 15, 6, 7, 0, -2.2, trim);
    for (let level = 1; level < 6; level++) b.box(22.2, 0.16, 15.2, 0, level * 3 + 0.18, -2.2, trim);
    for (const x of [-11.03, 11.03]) for (let level = 0; level < 6; level++) for (const z of [-6.5, -2.2, 2.1]) b.box(0.045, 1.7, 1.9, x, 1.7 + level * 3, z, b.glass);
    b.take(b.kit.roofs.flatParapet([22, 15], { baseY: 17.95, overhang: 0.18, seed: options.seed, material: 'plaster_tint', surfaceColor: colors.wall, ornaments: false }), 0, 0, -2.2);
    b.mass(4.8, 2.15, 6.4, -6.7, 19.17, -3, wall);
    b.take(b.kit.roofs[b.kit.defaults.roofForm]([4.8, 6.4], { baseY: 20.25, pitch: Math.min(34, b.kit.defaults.pitch), overhang: 0.22, seed: options.seed, ornaments: false, detail: 'low' }), -6.7, 0, -3);
  });
  b.feature('covered-ambulance-dropoff', () => {
    b.box(12.2, 0.16, 4.3, 0, 3.25, 7.6, trim);
    for (const x of [-5.6, 5.6]) b.box(0.22, 3.1, 0.22, x, 1.7, 9.2, wall);
    b.box(11.8, 0.24, 4.2, 0, 0.24, 7.6, wall);
    for (let segment = 0; segment < 10; segment++) b.box(3.4, 0.04, 0.46, 0, 0.12 + segment * 0.028, 12.75 - segment * 0.44, wall);
    b.atlas(atlas, 8.2, 1.25, 0, 4.2, 5.43, [0, 0.52, 1, 0.99]);
    b.atlas(atlas, 1.1, 1.15, 6.1, 4.15, 5.43, [0.35, 0.25, 0.65, 0.49]);
  });
  b.feature('rooftop-helipad', () => {
    b.cylinder(3.5, 0.09, 4.5, 18.21, -2.2, trim, 24);
    const h = new BoxGeometry(2.3, 2.5, 0.024), uv = h.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.35 + uv.getX(i) * 0.3, 0.25 + uv.getY(i) * 0.24);
    h.rotateX(-Math.PI / 2).translate(4.5, 18.27, -2.2); b.add(h, atlas);
    for (const x of [1.2, 7.8]) b.box(0.08, 0.18, 0.08, x, 18.37, -2.2, b.metal);
  });
  b.feature('Thai-national-flag', () => {
    b.pole(point(-11.6, 0.06, 11.4), point(-11.6, 9.7, 11.4), 0.055, b.metal, 8);
    const flag = new PlaneGeometry(2.4, 1.6, 8, 2), p = flag.getAttribute('position'), uv = flag.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { p.setZ(i, Math.sin((p.getX(i) + 1.2) * 2.4) * 0.12); uv.setY(i, uv.getY(i) * 0.25); }
    flag.computeVertexNormals(); flag.translate(-10.4, 8.81, 11.4); b.add(flag, atlas);
  });
  b.feature('parked-ambulance', () => {
    const x = -4.2, z = 7.6;
    b.box(1.92, 1.4, 4.3, x, 1.17, z, wall);
    b.box(1.64, 0.65, 1.22, x, 1.89, z + 1.08, b.glass);
    b.box(1.66, 0.14, 0.38, x, 2.25, z + 0.38, trim);
    for (const side of [-1, 1]) for (const dz of [-1.32, 1.32]) {
      const wheel = new CylinderGeometry(0.34, 0.34, 0.18, 8).rotateZ(Math.PI / 2).translate(x + side * 0.92, 0.5, z + dz);
      b.add(applyWorldUV(wheel, 1), b.metal); wheel.dispose();
    }
    for (const side of [-1, 1]) b.atlas(atlas, 0.8, 0.78, x + side * 0.98, 1.36, z - 0.55, [0.35, 0.25, 0.65, 0.49], side * Math.PI / 2);
    b.box(1.7, 0.14, 0.08, x, 0.95, z + 2.18, b.metal);
  });
  b.feature('parking', () => { b.car(8.5, 10.1, trim, Math.PI / 2); b.motorcycle(10.5, 6.2, trim); });
  b.gardens(3, 5.2);
  const root = b.finishZone('svc.hospital', 'services', 409, 'R2', { floors: 6, maxHeight: 24, helipad: true,
    signText: 'โรงพยาบาล', mark: 'H', markColor: 'green', nationalFlag: 'Thai', parkedAmbulances: 1 });
  for (let i = 0; i < 2; i++) { const anchor = new Object3D(); anchor.name = `anchor_light_${i}`; anchor.position.set(i ? 5.6 : -5.6, 3.1, 9.2); root.add(anchor); }
  return root;
}
