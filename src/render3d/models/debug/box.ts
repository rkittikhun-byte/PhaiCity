/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, Mesh, Object3D } from 'three';
import { tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { beveledBox, countTriangles } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';

export function createDebugBox(options: ModelOptions = {}): Group {
  const id = 'debug.box_3x3';
  const root = new Group();
  root.name = id;
  const rng = seededRng(options.seed);
  const palette = [0xe6c593, 0xa4c8ba, 0xd8b4a6, 0xb9c5db];
  const choice = (Math.floor(rng() * palette.length) + (options.variant ?? 0)) % palette.length;
  const color = palette[(choice + palette.length) % palette.length];
  const geometry = beveledBox(29, 12, 29, 0.16, 1).translate(0, 6, 0);
  const selected = options.state === 'lit' ? 'lit' : 'solid';
  for (const state of ['solid', 'lit'] as const) {
    const group = new Group();
    group.name = `state_${state}`;
    group.visible = state === selected;
    const box = new Mesh(geometry, tint(state === 'lit' ? 'emissive_window' : 'plaster_tint', color));
    box.name = `${id}/body_${state}`;
    box.castShadow = box.receiveShadow = true;
    box.position.set(0, 0, 0);
    group.add(box);
    root.add(group);
  }
  const light = new Object3D();
  light.name = 'anchor_light_0';
  light.position.set(0, 12, 0);
  root.add(light);
  root.userData = { id, category: 'debug', footprint: [3, 3], tiles: [], triangles: countTriangles(root) };
  return root;
}
