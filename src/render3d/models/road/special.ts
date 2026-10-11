/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, PlaneGeometry } from 'three';
import { getMaterial, railwaySignalMaterial, roadConcrete } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { countTriangles } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { RoadBuilder } from './builder.js';
import { roadBase, roadProps, streetLamp } from './basic.js';
import { POWER_INTERFACE, RAIL_INTERFACE } from './interfaces.js';
import { crossingPowerLines } from './power-lines.js';

export const DRAWBRIDGE_ANGLE = 70;
export const DRAWBRIDGE_HINGE = [0, -0.35, -3.5] as const;

function railings(builder: RoadBuilder, start: number, end: number): void {
  const steel = getMaterial('metal_steel');
  for (const x of [-4.82, 4.82]) {
    builder.box(point(x, 1.10, (start + end) / 2), point(0.10, 0.10, end - start), steel);
    builder.box(point(x, 0.57, (start + end) / 2), point(0.07, 0.07, end - start), steel);
    const count = Math.max(1, Math.ceil((end - start) / 1.5));
    for (let i = 0; i <= count; i++) builder.box(point(x, 0.55, start + (end - start) * i / count), point(0.09, 1.1, 0.09), steel);
  }
}

function deckLines(builder: RoadBuilder, start: number, end: number): void {
  for (const x of [-3.28, 3.28]) builder.line([[x, start], [x, end]]);
  for (const center of [-5, -2.5, 0, 2.5, 5]) {
    const a = Math.max(start, center - 0.6), b = Math.min(end, center + 0.6);
    if (b > a) builder.line([[0, a], [0, b]]);
  }
}

function bridgeSupports(builder: RoadBuilder): void {
  for (const z of [-4.2, 4.2]) {
    builder.box(point(0, -0.58, z), point(9.5, 0.46, 0.8), roadConcrete());
    for (const x of [-3, 3]) builder.box(point(x, -1.905, z), point(0.65, 2.19, 0.65), roadConcrete());
  }
  streetLamp(builder, -4.52, -4.25, 0);
  streetLamp(builder, 4.52, 3.85, 0);
}

/** Shared bridge edge profile: full-width deck at y=0, paint and flush railings. */
export function bridgeDeck(builder: RoadBuilder): void {
  builder.box(point(0, -0.175, 0), point(10, 0.35, 10), roadConcrete());
  deckLines(builder, -5, 5); railings(builder, -4.95, 4.95);
}

export function createBridge(options: ModelOptions, tiles: readonly number[]): Group {
  const builder = new RoadBuilder(options);
  bridgeDeck(builder); bridgeSupports(builder);
  const root = builder.finishRoad('road.bridge', tiles, 5);
  root.userData.crossSection.sidewalk = 0; root.userData.deckY = 0; root.userData.riverbedY = -3;
  return root;
}

export function createDrawbridge(options: ModelOptions, tiles: readonly number[]): Group {
  const id = 'road.drawbridge', root = new Group(); root.name = id;
  for (const state of ['closed', 'open']) {
    const builder = new RoadBuilder(options);
    for (const z of [-4.25, 4.25]) builder.box(point(0, -0.175, z), point(10, 0.35, 1.5), roadConcrete());
    bridgeSupports(builder); railings(builder, -4.95, -3.58); railings(builder, 3.58, 4.95);
    builder.cylinder(point(...DRAWBRIDGE_HINGE), 0.18, 9.6, getMaterial('metal_steel'), 8, Math.PI / 2);
    for (const x of [-4.72, 4.72]) builder.box(point(x, -0.35, -3.5), point(0.45, 0.55, 0.6), roadConcrete());
    deckLines(builder, -5, -3.5); deckLines(builder, 3.5, 5);
    builder.articulated('anim_leaf', point(...DRAWBRIDGE_HINGE), 'x', state === 'open' ? -DRAWBRIDGE_ANGLE * Math.PI / 180 : 0, () => {
      builder.box(point(0, -0.175, 0), point(10, 0.35, 7), getMaterial('asphalt'));
      deckLines(builder, -3.5, 3.5); railings(builder, -3.4, 3.4);
      // Steel ribs are under the leaf and move with its real hinge.
      for (const x of [-3.2, 3.2]) builder.box(point(x, -0.42, 0), point(0.18, 0.14, 6.8), getMaterial('metal_steel'));
    });
    const group = builder.finishRoad(id, tiles, 5); group.name = `state_${state}`;
    group.visible = state === (options.state === 'open' ? 'open' : 'closed'); root.add(group);
  }
  root.userData = { id, category: 'road', footprint: [1, 1], tiles: [...tiles], regionTier: 'R3', region: options.region ?? 'central',
    connections: 5, deckY: 0, riverbedY: -3, hinge: [...DRAWBRIDGE_HINGE], maxLeafAngle: DRAWBRIDGE_ANGLE,
    triangles: countTriangles(root), crossSection: { tile: 10, carriageway: 7, sidewalk: 0 }, worldOrigin: [...(options.worldOrigin ?? [0, 0])] };
  return root;
}

/** Rail head at 0.42 m matches Prompt 5; short approach ramps retain road edge y=0. */
export const crossingHeight = (z: number): number => Math.max(0, Math.min(1, (3 - Math.abs(z)) / (3 - 0.85))) * (RAIL_INTERFACE.headY - 0.005);

function crossingSurface(builder: RoadBuilder, painted: boolean): void {
  const knots = [-5, -3, -1.6, -0.85, 0.85, 1.6, 3, 5];
  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[i], b = knots[i + 1];
    const width = a >= -1.6 && b <= 1.6 ? 3.5 : 5;
    builder.polygon([[-width, a], [-width, b], [width, b], [width, a]], getMaterial('asphalt'), (_x, z) => crossingHeight(z));
    if (a >= 1.6 || b <= -1.6) for (const x of [-5, 3.5]) {
      builder.slab([[x, a], [x, b], [x + 1.5, b], [x + 1.5, a]], getMaterial('sidewalk_tile'), crossingHeight);
      const cx = x === -5 ? -3.5 : 3.5; builder.curb([[cx, a], [cx, b]], painted, crossingHeight);
    }
    for (const x of [-3.28, 3.28]) builder.line([[x, a], [x, b]], 0.12, crossingHeight);
  }
  for (const z of [-5, -2.5, 2.5, 5]) builder.line([[0, Math.max(-5, z - 0.6)], [0, Math.min(5, z + 0.6)]], 0.12, crossingHeight);
  builder.line([[0.25, -3.2], [3.2, -3.2]], 0.25, crossingHeight);
  builder.line([[-3.2, 3.2], [-0.25, 3.2]], 0.25, crossingHeight);
}

function railway(builder: RoadBuilder): void {
  const { railWidth, gauge, headY, sleeperSpacing } = RAIL_INTERFACE;
  const steel = getMaterial('metal_steel');
  for (const z of [-(gauge + railWidth) / 2, (gauge + railWidth) / 2]) {
    builder.box(point(0, headY - 0.02, z), point(10, 0.04, railWidth), steel);
    builder.box(point(0, 0.35, z), point(10, 0.06, 0.04), steel);
    builder.box(point(0, 0.31, z), point(10, 0.025, 0.12), steel);
  }
  for (const side of [-1, 1]) {
    for (let x = 3.6; x < 5; x += sleeperSpacing) builder.box(point(x * side, 0.28, 0), point(0.22, 0.08, 1.8), roadConcrete());
    const x0 = side < 0 ? -5 : 3.5, x1 = side < 0 ? -3.5 : 5;
    const vertices: number[] = [];
    for (const [a, ay, b, by] of [[-1.6, 0, -1.2, 0.3], [-1.2, 0.3, 1.2, 0.3], [1.2, 0.3, 1.6, 0]]) {
      vertices.push(x0, ay, a, x0, by, b, x1, by, b, x0, ay, a, x1, by, b, x1, ay, a);
    }
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); builder.world(geometry, getMaterial('gravel_ballast'));
  }
}

function crossingSignals(builder: RoadBuilder, open: boolean): void {
  for (const side of [-1, 1]) {
    const x = side * 4.28, z = side * 2.4;
    builder.prop('railway_signal', () => {
      builder.box(point(x, 0.37, z), point(0.36, 0.44, 0.36), roadConcrete());
      builder.rod(point(x, 0.15, z), point(x, 2.75, z), 0.07, getMaterial('metal_steel'));
      builder.box(point(x, 2.4, z), point(0.92, 0.36, 0.18), getMaterial('metal_steel'));
      for (const phase of [0, 1]) {
        const geometry = new PlaneGeometry(0.24, 0.24).rotateY(side < 0 ? Math.PI : 0)
          .translate(x - 0.24 + phase * 0.48, 2.4, z + side * 0.091);
        const uv = geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setX(i, phase + (open ? 2 : 0) + 0.2 + uv.getX(i) * 0.6);
        builder.add(geometry, railwaySignalMaterial());
      }
    });
    const hingeX = side * 3.91, hingeZ = side * 2.1, index = side < 0 ? 0 : 1;
    builder.box(point(hingeX, 0.55, hingeZ), point(0.3, 0.8, 0.3), getMaterial('metal_steel'));
    builder.articulated(`anim_barrier_${index}`, point(hingeX, 0.9, hingeZ), 'z', open ? -side * 80 * Math.PI / 180 : 0, () => {
      builder.box(point(0, 0.9, hingeZ), point(7.82, 0.16, 0.13), getMaterial('road_marking_white'));
      for (let i = 0; i < 10; i++) {
        const geometry = new BoxGeometry(0.4, 0.162, 0.132).translate(-3.7 + i * 0.8, 0.9, hingeZ);
        const uv = geometry.getAttribute('uv');
        for (let vertex = 0; vertex < uv.count; vertex++) uv.setX(vertex, -0.5);
        builder.add(geometry, railwaySignalMaterial());
      }
    });
  }
  for (const side of [-1, 1]) builder.prop('railway_warning_sign', () => {
    builder.rod(point(side * 4.4, 0.15, side * 3.5), point(side * 4.4, 2.4, side * 3.5), 0.045, getMaterial('metal_steel'));
    builder.add(new PlaneGeometry(0.95, 0.85).rotateY(side < 0 ? Math.PI : 0).translate(side * 4.4, 2.4, side * 3.5),
      thaiSign('หยุด\nระวังรถไฟ', 0xffecb2, 0x301e18, [0.95, 0.85]));
  });
}

export function createRailCrossing(options: ModelOptions, tiles: readonly number[]): Group {
  const id = 'road.rail_crossing', root = new Group(); root.name = id;
  for (const state of ['closed', 'open']) {
    const builder = new RoadBuilder({ ...options }); crossingSurface(builder, false); railway(builder);
    crossingSignals(builder, state === 'open');
    const group = builder.finishRoad(id, tiles, 5); group.name = `state_${state}`;
    group.visible = state === (options.state === 'open' ? 'open' : 'closed'); root.add(group);
  }
  root.userData = { id, category: 'road', footprint: [1, 1], tiles: [...tiles], regionTier: 'R3', region: options.region ?? 'central',
    connections: 5, railDirection: 'EW', rail: { ...RAIL_INTERFACE }, triangles: countTriangles(root), worldOrigin: [...(options.worldOrigin ?? [0, 0])] };
  return root;
}

export function createPowerCrossing(options: ModelOptions, tiles: readonly number[]): Group {
  const builder = new RoadBuilder(options);
  roadBase(builder, 'straight', false); roadProps(builder, 'straight', options, false);
  const attachments = crossingPowerLines(builder, 'road.power_crossing');
  const root = builder.finishRoad('road.power_crossing', tiles, 5); root.add(...attachments);
  root.userData.power = { ...POWER_INTERFACE, offsets: [...POWER_INTERFACE.offsets] };
  return root;
}
