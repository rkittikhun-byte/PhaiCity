/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Object3D } from 'three';
import { getMaterial, roadConcrete } from '../../materials/library.js';
import { catenaryWire } from '../../util/geometry.js';
import { point } from '../vegetation/builder.js';
import { RoadBuilder } from './builder.js';
import { POWER_INTERFACE } from './interfaces.js';

/** Road and rail crossings share the exact E/W wire terminals for Prompt 6. */
export function crossingPowerLines(builder: RoadBuilder, id: string, baseY = 0.15): Object3D[] {
  const attachments: Object3D[] = [];
  for (const x of [-4.32, 4.32]) builder.prop('utility_pole', () => {
    builder.box(point(x, (12 + baseY) / 2, 0), point(0.26, 12 - baseY, 0.26), roadConcrete());
    for (const y of [10.72, 5.72]) builder.box(point(x, y, 0), point(0.16, 0.13, 2.15), getMaterial('metal_steel'));
    for (const offset of POWER_INTERFACE.offsets) builder.cylinder(point(x, 10.88, offset), 0.09, 0.24, roadConcrete(), 6);
  });
  const wires = [...POWER_INTERFACE.offsets.map((z, index) => ({ z, y: POWER_INTERFACE.powerY, kind: `power_${index}`, radius: 0.018 })),
    { z: 0, y: POWER_INTERFACE.telecomY, kind: 'telecom', radius: 0.055 }];
  for (const wire of wires) {
    for (const [start, end, sag, segments] of [[-5, -4.32, 0.015, 2], [-4.32, 4.32, 0.26, 9], [4.32, 5, 0.015, 2]]) {
      const geometry = catenaryWire(point(start, wire.y, wire.z), point(end, wire.y, wire.z), sag, wire.radius, segments);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) positions.setX(i, Math.max(-5, Math.min(5, positions.getX(i))));
      builder.world(geometry, getMaterial('metal_steel'));
    }
    for (const side of [-1, 1]) {
      const anchor = new Object3D(); anchor.name = `${id}/wire_${side < 0 ? 'W' : 'E'}_${wire.kind}`;
      anchor.position.set(side * 5, wire.y, wire.z); anchor.userData = { kind: wire.kind, attachment: true }; attachments.push(anchor);
    }
  }
  return attachments;
}
