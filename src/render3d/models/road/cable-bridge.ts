/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Float32BufferAttribute, Group, Object3D } from 'three';
import { getMaterial, roadConcrete } from '../../materials/library.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { RoadBuilder } from './builder.js';
import { bridgeDeck } from './special.js';

export const CABLE_BRIDGE = Object.freeze({ height: 120, anchorsPerSide: 20, anchorMinY: 60, anchorMaxY: 115,
  deckAnchorX: 4.78, deckAnchorY: 0.93, forkY: 44, crownBaseY: 119.5 });

interface Section { x: number; y: number; width: number; depth: number }

/** Eight-sided concrete sections keep subtle chamfers without subdividing the mast. */
function taperedPier(builder: RoadBuilder, sections: readonly Section[]): void {
  const ring = (section: Section): number[][] => {
    const { x, y, width: w, depth: d } = section, bevel = Math.min(w, d) * 0.14;
    return [[-w / 2 + bevel, -d / 2], [w / 2 - bevel, -d / 2], [w / 2, -d / 2 + bevel],
      [w / 2, d / 2 - bevel], [w / 2 - bevel, d / 2], [-w / 2 + bevel, d / 2],
      [-w / 2, d / 2 - bevel], [-w / 2, -d / 2 + bevel]].map(([dx, z]) => [x + dx, y, z]);
  };
  const rings = sections.map(ring), vertices: number[] = [];
  for (let level = 0; level < rings.length - 1; level++) for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, a = rings[level][i], b = rings[level + 1][i], c = rings[level + 1][j], d = rings[level][j];
    vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (const [level, top] of [[0, false], [rings.length - 1, true]] as const) {
    for (let i = 1; i < 7; i++) vertices.push(...rings[level][0], ...rings[level][top ? i + 1 : i], ...rings[level][top ? i : i + 1]);
  }
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); builder.world(geometry, roadConcrete());
}

const mastWidth = (y: number): number => 1.6 - 0.7 * (y - CABLE_BRIDGE.forkY) / (CABLE_BRIDGE.crownBaseY - CABLE_BRIDGE.forkY);

function anchor(builder: RoadBuilder, name: string, x: number, y: number, z: number): void {
  const attachment = new Object3D(); attachment.name = name;
  attachment.position.set(x, y, z); builder.anchors.push(attachment);
}

function litDeck(builder: RoadBuilder): void {
  bridgeDeck(builder);
  // Exposed outer rail faces keep the continuous strips visible from above at night.
  for (const x of [-4.91, 4.91]) builder.box(point(x, 1.02, 0), point(0.16, 0.18, 10), getMaterial('emissive_window'));
}

export function createCableBridge(pylon: boolean, options: ModelOptions = {}): Group {
  const builder = new RoadBuilder(options), id = `road.bridge_cable_${pylon ? 'pylon' : 'deck'}`;
  litDeck(builder);
  if (pylon) {
    // A single inverted-Y mast; feet leave the 7 m carriageway unobstructed.
    for (const side of [-1, 1]) taperedPier(builder, [
      { x: side * 4.25, y: -3, width: 1.15, depth: 1.65 },
      { x: side * 4.25, y: 8, width: 1.15, depth: 1.65 },
      { x: 0, y: CABLE_BRIDGE.forkY, width: 1.6, depth: 1.5 },
    ]);
    builder.box(point(0, -2.75, 0), point(9.8, 0.5, 2.4), roadConcrete());
    taperedPier(builder, [
      { x: 0, y: CABLE_BRIDGE.forkY, width: 1.6, depth: 1.5 },
      { x: 0, y: CABLE_BRIDGE.crownBaseY, width: 0.9, depth: 0.9 },
    ]);
    builder.box(point(0, 119.75, 0), point(0.95, 0.5, 0.95), getMaterial('emissive_window'));
    builder.light(0, 119.8, 0);
    for (const side of [0, 1]) for (let n = 0; n < CABLE_BRIDGE.anchorsPerSide; n++) {
      const y = CABLE_BRIDGE.anchorMinY + n * (CABLE_BRIDGE.anchorMaxY - CABLE_BRIDGE.anchorMinY) / (CABLE_BRIDGE.anchorsPerSide - 1);
      // Even/odd anchors face N/S, giving two balanced fans at nearly paired heights.
      anchor(builder, `anchor_cable_${side}_${n}`, (side ? 1 : -1) * mastWidth(y) / 2, y, n % 2 ? 0.22 : -0.22);
    }
  } else {
    anchor(builder, 'anchor_cable_left', -CABLE_BRIDGE.deckAnchorX, CABLE_BRIDGE.deckAnchorY, 0);
    anchor(builder, 'anchor_cable_right', CABLE_BRIDGE.deckAnchorX, CABLE_BRIDGE.deckAnchorY, 0);
  }
  const root = builder.finishRoad(id, [], 5);
  root.userData.crossSection.sidewalk = 0;
  root.userData.deckY = 0; root.userData.riverbedY = -3;
  root.userData.cableBridge = { part: pylon ? 'pylon' : 'deck', ...CABLE_BRIDGE };
  return root;
}
