/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Matrix4 } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { getRegionKit } from '../../regional/index.js';
import { KitBuilder, place } from '../../regional/geometry.js';
import type { ModelOptions } from '../registry.js';

/** Contract / silhouette sample. Regional components all come through the shared kit. */
export function createRegionHouse(options: ModelOptions = {}) {
  const kit = getRegionKit(options.region), color = kit.palette.pick(options.seed), b = new KitBuilder();
  const floor = kit.defaults.raisedFloor + 0.15, height = 2.4;
  const wood = tint('wood_painted', color.trim), wall = kit.walls[kit.defaults.wallForm];
  b.box(9, 0.08, 9, 0, 0.04, 0, getMaterial('grass'));
  b.box(5.2, 0.18, 4.4, 0, floor, -0.75, wood);
  for (const x of [-2.25, 0, 2.25]) for (const z of [-2.45, 0.95]) b.box(0.16, floor, 0.16, x, floor / 2, z, wood);
  for (const z of [-2.55, 1.05]) b.parts.push(...place(wall({ width: 4.6, height, seed: options.seed }), 0, floor + 0.1, z));
  for (const x of [-2.3, 2.3]) {
    const panels = wall({ width: 3.6, height, seed: options.seed });
    panels.forEach(part => part.geometry.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2)).translate(x, floor + 0.1, -0.75)); b.parts.push(...panels);
  }
  const base = floor + 0.1 + height;
  b.parts.push(...place(kit.roofs[kit.defaults.roofForm]([5.2, 4.4], { baseY: base, seed: options.seed }), 0, 0, -0.75));
  // Large front apertures and seeded shutter finish are legible from the gameplay camera.
  for (const x of [-1.32, 1.32]) {
    b.box(0.95, 1.1, 0.07, x, floor + 1.48, 1.17, getMaterial('glass_tinted'));
    for (const dx of [-0.64, 0.64]) b.parts.push(...place(kit.walls.louvered({ width: 0.26 + 0.1, height: 1.15, seed: options.seed }), x + dx, floor + 0.9, 1.22));
    if (kit.id === 'south') b.parts.push(...place(kit.ornaments.pediment({ width: 1.05, seed: options.seed }), x, floor + 2.03, 1.22));
  }
  b.box(0.65, 1.8, 0.09, 0, floor + 1, 1.18, wood);
  const terrace = kit.id === 'northeast' ? floor - 0.4 : floor;
  b.box(5.2, 0.16, kit.id === 'central' ? 1.8 : 1.35, 0, terrace, 2.05, wood);
  for (let i = 0; i < 3; i++) b.box(1.1, (i + 1) * terrace / 3, 0.35, 0, (i + 1) * terrace / 6, 3.38 - i * 0.32, wood);
  if (kit.id === 'east') b.parts.push(...place(kit.ornaments.fretwork({ width: 4.9, height: 0.85, seed: options.seed }), 0, floor + 0.08, 2.65));
  else if (kit.id === 'south') b.parts.push(...place(kit.ornaments.arch({ width: 4.7, height: 2.3, seed: options.seed }), 0, terrace + 0.08, 2.48));
  else for (const side of [-1, 1]) {
    b.box(1.7, 0.1, 0.1, side * 1.65, terrace + 0.85, 2.65, wood);
    for (let i = 0; i < 4; i++) b.box(0.07, 0.75, 0.07, side * (0.95 + i * 0.46), terrace + 0.43, 2.65, wood);
  }
  const prop = kit.id === 'north' ? 'paper_umbrella' : kit.id === 'northeast' ? 'weaving_loom' : kit.id === 'central' ? 'dragon_jar' :
    kit.id === 'east' ? 'fruit_crates' : kit.id === 'west' ? 'palm_sugar_pots' : 'rubber_rack';
  b.parts.push(...place(kit.props[prop]({ seed: options.seed }), -3.35, 0.08, 1.6, 0.65));
  const root = b.finish('debug.region_house', 'debug', [1, 1], [], options);
  root.userData.regionTier = 'R1'; root.userData.roofForm = kit.defaults.roofForm; root.userData.kit = kit.id;
  return root;
}
