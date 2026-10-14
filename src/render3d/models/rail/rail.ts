/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, PlaneGeometry } from 'three';
import { getMaterial, paintedSteel, roadConcrete } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { POWER_INTERFACE } from '../road/interfaces.js';
import { crossingPowerLines } from '../road/power-lines.js';
import { ballast, RailBuilder, RAIL_MASKS, railGround, TrackKind, tracks } from './track.js';

export const RAIL_KINDS = ['straight', 'corner', 't', 'cross', 'end', 'bridge', 'power_crossing'] as const;
export type RailKind = typeof RAIL_KINDS[number];
export const RAIL_TILES: Readonly<Record<RailKind, readonly number[]>> = Object.freeze({
  straight: [226, 227], corner: [228, 229, 230, 231, 232, 233, 234, 235, 236],
  t: [228, 229, 230, 231, 232, 233, 234, 235, 236], cross: [228, 229, 230, 231, 232, 233, 234, 235, 236],
  end: [228, 229, 230, 231, 232, 233, 234, 235, 236], bridge: [224, 225], power_crossing: [221, 222],
});

function props(builder: RailBuilder, bridge: boolean): void {
  const random = seededRng(builder.options.seed), kilometer = 10 + Math.floor(random() * 90);
  const sign = thaiSign(`ระวังรถไฟ\nกม. ${kilometer}`, 0xffeed1, 0x242723, [1.2, 1]);
  const spots = [[-3.7, -3.6], [-3.7, 3.6], [3.7, -3.6], [3.7, 3.6]];
  const selected = Math.floor(random() * spots.length), [x, z] = bridge ? [2.2, -3.5] : spots[selected];
  const yaw = x > 0 ? -Math.PI / 2 : Math.PI / 2, base = bridge ? 0.3 : 0;
  builder.prop('warning_sign', () => {
    builder.rod(point(x, base, z), point(x, base + 1.85, z), 0.04, getMaterial('metal_steel'));
    const face = new PlaneGeometry(1.2, 0.5), uv = face.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5 + uv.getY(i) * 0.5);
    builder.add(face.rotateY(yaw).translate(x, base + 1.6, z), sign);
  });
  const [kx, kz] = bridge ? [2.2, 3.5] : spots[(selected + 2) % spots.length];
  builder.prop('kilometer_post', () => {
    builder.box(point(kx, base + 0.4, kz), point(0.32, 0.8, 0.32), roadConcrete());
    const face = new PlaneGeometry(0.48, 0.24), uv = face.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5);
    builder.add(face.rotateY(kx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(kx + (kx > 0 ? -0.161 : 0.161), base + 0.58, kz), sign);
  });
  const [cx, cz] = bridge ? [2.2, 1.5] : spots[(selected + 1) % spots.length];
  builder.prop('signal_cabinet', () => {
    builder.box(point(cx, base + 0.08, cz), point(0.58, 0.16, 0.55), roadConcrete());
    builder.box(point(cx, base + 0.58, cz), point(0.45, 0.9, 0.4), getMaterial('metal_steel'));
    builder.box(point(cx, base + 1.06, cz), point(0.52, 0.06, 0.46), getMaterial('metal_steel'));
  });
}

function bufferStop(builder: RailBuilder): void {
  const steel = getMaterial('metal_steel'), red = paintedSteel(0xba3532), white = getMaterial('road_marking_white');
  for (const x of [-0.72, 0.72]) {
    builder.rod(point(x, 0.33, -0.1), point(x, 1, 0.85), 0.07, steel);
    builder.rod(point(x, 0.33, 1.4), point(x, 1, 0.85), 0.07, steel);
    builder.box(point(x, 0.35, 0.65), point(0.18, 0.07, 1.5), steel);
  }
  builder.box(point(0, 1, 0.85), point(1.9, 0.26, 0.2), white);
  for (const x of [-0.76, 0, 0.76]) for (const side of [-1, 1]) {
    builder.world(new PlaneGeometry(0.38, 0.26).rotateY(side < 0 ? Math.PI : 0)
      .translate(x, 1, 0.85 + side * 0.102), red);
  }
}

function bridgeStructure(builder: RailBuilder): void {
  const steel = paintedSteel(0x3d4952);
  builder.world(new PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, -0.6, 0), getMaterial('water_river'));
  builder.box(point(0, -0.175, 0), point(3.2, 0.35, 10), roadConcrete());
  ballast(builder, 'straight');
  for (const z of [-4, 4]) {
    builder.box(point(0.35, -0.55, z), point(4.3, 0.4, 0.8), roadConcrete());
    for (const x of [-1.2, 1.2]) builder.box(point(x, -1.875, z), point(0.65, 2.25, 0.65), roadConcrete());
  }
  for (const x of [-1.75, 1.75]) {
    builder.box(point(x, 0.24, 0), point(0.18, 0.18, 10), steel);
    builder.box(point(x, 4.8, 0), point(0.16, 0.16, 10), steel);
    for (let i = 0; i <= 5; i++) {
      const z = -4.92 + i * 1.968;
      builder.box(point(x, 2.52, z), point(0.13, 4.56, 0.14), steel);
      if (i < 5) builder.rod(point(x, i % 2 ? 4.8 : 0.3, z), point(x, i % 2 ? 0.3 : 4.8, z + 1.968), 0.075, steel);
    }
  }
  for (const z of [-4.9, 0, 4.9]) builder.rod(point(-1.75, 4.8, z), point(1.75, 4.8, z), 0.07, steel);
  builder.box(point(2.2, 0.24, 0), point(0.75, 0.12, 10), steel);
  for (const z of [-4.9, -2.45, 0, 2.45, 4.9]) builder.box(point(2.65, 0.85, z), point(0.08, 1.1, 0.08), steel);
  builder.box(point(2.65, 1.4, 0), point(0.08, 0.08, 10), steel);
  builder.box(point(2.65, 0.86, 0), point(0.07, 0.07, 10), steel);
}

export function createRail(kind: RailKind, options: ModelOptions = {}): Group {
  const builder = new RailBuilder(options), bridge = kind === 'bridge';
  const trackKind: TrackKind = kind === 'bridge' || kind === 'power_crossing' ? 'straight' : kind;
  // A corner that is a step of a slanted line (track.ts stairPath)
  const variant = kind === 'corner' ? (options.variant ?? 0) & 3 : 0;
  if (bridge) bridgeStructure(builder); else railGround(builder, trackKind, variant);
  tracks(builder, trackKind, variant); props(builder, bridge);
  if (kind === 'end') bufferStop(builder);
  if (kind === 'power_crossing') builder.anchors.push(...crossingPowerLines(builder, 'rail.power_crossing', 0));
  const root = builder.finishRail(`rail.${kind}`, RAIL_TILES[kind], RAIL_MASKS[trackKind]);
  if ((kind === 'corner' && !variant) || kind === 't') root.userData.curveRadius = 5;
  if (bridge) root.userData.riverbedY = -3;
  if (kind === 'power_crossing') root.userData.power = { ...POWER_INTERFACE, offsets: [...POWER_INTERFACE.offsets] };
  return root;
}
