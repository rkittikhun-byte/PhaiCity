/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { PlaneGeometry } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point } from '../vegetation/builder.js';
import { BASIC_MASKS, BasicRoadKind } from './interfaces.js';
import { Point2, RoadBuilder } from './builder.js';

const rectangle = (x0: number, z0: number, x1: number, z1: number): Point2[] => [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
export const CORNER_RADIUS = 3;
export const CORNER_CENTER: Point2 = [-0.5, 0.5];
export function cornerArc(radius = CORNER_RADIUS): Point2[] {
  return Array.from({ length: 13 }, (_, i) => {
    const angle = Math.PI - i / 12 * Math.PI / 2;
    return [CORNER_CENTER[0] + radius * Math.cos(angle), CORNER_CENTER[1] + radius * Math.sin(angle)] as Point2;
  });
}

/** The 3 m outer curb fillet keeps the exact 7 m cross-section at N and E. */
export function sidewalkPolygons(kind: BasicRoadKind): Point2[][] {
  switch (kind) {
    case 'straight': return [rectangle(-5, -5, -3.5, 5), rectangle(3.5, -5, 5, 5)];
    case 'corner': return [[[ -5, -5], [-3.5, -5], ...cornerArc(), [5, 3.5], [5, 5], [-5, 5]], rectangle(3.5, -5, 5, -3.5)];
    case 't': return [rectangle(-5, -5, -3.5, 5), rectangle(3.5, -5, 5, -3.5), rectangle(3.5, 3.5, 5, 5)];
    case 'cross': return [rectangle(-5, -5, -3.5, -3.5), rectangle(3.5, -5, 5, -3.5), rectangle(-5, 3.5, -3.5, 5), rectangle(3.5, 3.5, 5, 5)];
    case 'end': {
      const arc = Array.from({ length: 17 }, (_, i) => [3.5 * Math.cos(i / 16 * Math.PI), 3.5 * Math.sin(i / 16 * Math.PI)] as Point2);
      return [[[ -5, -5], [-3.5, -5], [-3.5, 0], ...arc.slice().reverse(), [3.5, -5], [5, -5], [5, 5], [-5, 5]]];
    }
    case 'single': {
      // Four corner polygons leave a closed, circular turnaround with no edge connections.
      return Array.from({ length: 4 }, (_, quadrant) => {
        const arc = Array.from({ length: 9 }, (_, i) => {
          const angle = i / 8 * Math.PI / 2;
          return [3.5 * Math.cos(angle), 3.5 * Math.sin(angle)] as Point2;
        });
        const polygon: Point2[] = [...arc, [0, 5], [5, 5], [5, 0]];
        const angle = quadrant * Math.PI / 2;
        return polygon.map(([x, z]) => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)] as Point2);
      });
    }
  }
}

const facing = (side: number, x: number, z: number): Point2 => side === 1 ? [x, z] : side === 2 ? [-z, x] : side === 4 ? [-x, -z] : [z, -x];

export function roadBase(builder: RoadBuilder, kind: BasicRoadKind, painted: boolean, ground: (z: number) => number = () => 0): void {
  builder.polygon(rectangle(-5, -5, 5, 5), getMaterial('asphalt'), (_x, z) => ground(z));
  sidewalkPolygons(kind).forEach(polygon => builder.slab(polygon, getMaterial('sidewalk_tile'), ground));
  const mask = BASIC_MASKS[kind];
  if (kind === 'straight') {
    for (const x of [-3.5, 3.5]) builder.curb([[x, -5], [x, 5]], painted, ground);
    for (const x of [-3.28, 3.28]) builder.line([[x, -5], [x, 5]], 0.12, ground);
    for (const center of [-5, -2.5, 0, 2.5, 5]) builder.line([[0, Math.max(-5, center - 0.6)], [0, Math.min(5, center + 0.6)]], 0.12, ground);
  } else if (kind === 'corner') {
    builder.curb([[-3.5, -5], ...cornerArc(), [5, 3.5]], painted);
    builder.curb([[3.5, -5], [3.5, -3.5], [5, -3.5]], painted);
    builder.line([[-3.28, -5], [-3.28, 0.5], ...cornerArc(2.78), [5, 3.28]]);
    builder.line([[3.28, -5], [3.28, -3.28], [5, -3.28]]);
    const centerline = (angle: number): Point2 => [5 - 5 * Math.cos(angle), -5 + 5 * Math.sin(angle)];
    for (let i = 0; i < 4; i++) {
      const start = i / 3 * Math.PI / 2, end = Math.min(Math.PI / 2, start + 0.12);
      const low = Math.max(0, start - 0.12);
      builder.line(Array.from({ length: 5 }, (_, j) => centerline(low + j / 4 * (end - low))));
    }
  } else if (kind === 'single') {
    const circle = Array.from({ length: 33 }, (_, i) => [3.5 * Math.cos(i / 32 * Math.PI * 2), 3.5 * Math.sin(i / 32 * Math.PI * 2)] as Point2);
    builder.curb(circle, painted);
    builder.line(circle.map(([x, z]) => [x * 3.28 / 3.5, z * 3.28 / 3.5]));
  } else if (kind === 'end') {
    const arc = Array.from({ length: 17 }, (_, i) => [3.5 * Math.cos(i / 16 * Math.PI), 3.5 * Math.sin(i / 16 * Math.PI)] as Point2);
    builder.curb([[-3.5, -5], ...arc.slice().reverse(), [3.5, -5]], painted);
    builder.line([[-3.28, -5], [-3.28, 0], ...arc.slice().reverse().map(([x, z]) => [x * 3.28 / 3.5, z * 3.28 / 3.5] as Point2), [3.28, -5]]);
    for (const center of [-5, -2.5]) builder.line([[0, Math.max(-5, center - 0.6)], [0, center + 0.6]]);
  } else {
    for (const side of [1, 2, 4, 8]) if (mask & side) {
      for (const x of [-3.5, 3.5]) builder.curb([facing(side, x, -5), facing(side, x, -3.5)], painted);
      for (const x of [-3.28, 3.28]) builder.line([facing(side, x, -5), facing(side, x, -3.5)]);
      builder.line([facing(side, 0, -5), facing(side, 0, -4.75)]);
      // Left-hand traffic: stop line spans only the lane entering the junction.
      const stopZ = kind === 'cross' ? -4.8 : -3.7;
      builder.line([facing(side, 0.25, stopZ), facing(side, 3.2, stopZ)], 0.25);
      if (kind === 'cross') for (let stripe = 0; stripe < 10; stripe++) {
        const x = -3.15 + stripe * 0.7;
        builder.line([facing(side, x, -4.6), facing(side, x, -3.85)], 0.38);
      }
    }
    if (kind === 't') {
      builder.curb([[-3.5, -5], [-3.5, 5]], painted);
      builder.line([[-3.28, -5], [-3.28, 5]]);
    }
  }
}

export function streetLamp(builder: RoadBuilder, x: number, z: number, y = 0.15, height = 6.5): void {
  const steel = getMaterial('metal_steel');
  builder.prop('street_light', () => {
    builder.cylinder(point(x, y + 0.15, z), 0.16, 0.3, steel, 6);
    builder.rod(point(x, y, z), point(x, height - 0.15, z), 0.065, steel, 6);
    builder.rod(point(x, height - 0.5, z), point(x, height - 0.14, z + 0.45), 0.045, steel, 5);
    builder.box(point(x, height - 0.10, z + 0.45), point(0.24, 0.20, 0.52), steel);
    builder.box(point(x, height - 0.205, z + 0.45), point(0.19, 0.012, 0.42), getMaterial('emissive_window'));
  });
  builder.light(x, height - 0.22, z + 0.45);
}

function roadsideSign(builder: RoadBuilder, text: string, x: number, z: number, size: readonly [number, number] = [0.95, 0.65]): void {
  builder.rod(point(x, 0.15, z), point(x, 2.45, z), 0.045, getMaterial('metal_steel'));
  builder.box(point(x, 2.35, z), point(size[0], size[1], 0.06), getMaterial('metal_steel'));
  builder.add(new PlaneGeometry(...size).translate(x, 2.35, z + 0.031), thaiSign(text, 0xf1eada, 0x263932, size));
}

export function roadProps(builder: RoadBuilder, kind: BasicRoadKind, options: ModelOptions, allowShelters = kind === 'straight'): void {
  const random = seededRng((options.seed ?? 1) ^ 0x7a3bd);
  const cross = kind === 'cross', x = -4.28, z = cross ? -4.3 : -2.9 + random() * 1.3;
  streetLamp(builder, x, z);
  builder.prop('drain', () => {
    builder.box(point(x, 0.158, cross ? 4.25 : 2.9), point(0.65, 0.016, 0.45), getMaterial('metal_steel'));
    for (let i = 0; i < 5; i++) builder.box(point(x - 0.25 + i * 0.125, 0.168, cross ? 4.25 : 2.9), point(0.04, 0.004, 0.35), getMaterial('asphalt'));
  });
  const prop = Math.floor(random() * (allowShelters ? 4 : 2));
  if (prop === 0) builder.prop('street_tree', () => {
    const treeX = cross ? 4.28 : -4.28, treeZ = cross ? 4.28 : 1.05;
    builder.cylinder(point(treeX, 0.29, treeZ), 0.38, 0.28, getMaterial('sidewalk_tile'), 8);
    builder.rod(point(treeX, 0.4, treeZ), point(treeX, 3.65, treeZ), 0.07, tint('wood_teak', 0x665744), 5);
    const foliage = tint('foliage_tropical', options.region === 'south' || options.region === 'east' ? 0x467b42 : 0x70944c);
    for (let i = 0; i < 32; i++) {
      const angle = random() * Math.PI * 2, radius = random() * 0.32;
      builder.leaf(point(treeX + Math.cos(angle) * radius, 2.7 + random() * 1.0, treeZ + Math.sin(angle) * radius),
        point(Math.cos(angle), random() * 0.4 - 0.2, Math.sin(angle)), 0.28, 0.22, foliage, angle, 0.08);
    }
  });
  else if (prop === 1) builder.prop('traffic_sign', () => roadsideSign(builder, 'ชะลอ\nเขตชุมชน', cross ? 4.28 : -4.28, cross ? -4.25 : 0.5));
  else builder.prop(prop === 2 ? 'bus_shelter' : 'motorbike_taxi_stand', () => {
    const px = 4.28;
    for (const dz of [-1.25, 1.25]) for (const dx of [-0.42, 0.42]) builder.rod(point(px + dx, 0.15, dz), point(px + dx, 2.55, dz), 0.045, getMaterial('metal_steel'));
    builder.box(point(px, 2.58, 0), point(1.16, 0.12, 3.1), getMaterial(prop === 2 ? 'metal_steel' : 'fabric_canvas'));
    builder.box(point(px + 0.25, 0.65, 0), point(0.46, 0.12, 2.25), getMaterial('sidewalk_tile'));
    for (const dz of [-0.8, 0.8]) builder.box(point(px + 0.25, 0.38, dz), point(0.2, 0.46, 0.15), getMaterial('metal_steel'));
    builder.add(new PlaneGeometry(2.3, 0.45).rotateY(-Math.PI / 2).translate(px - 0.55, 2.3, 0),
      thaiSign(prop === 2 ? 'ป้ายรถโดยสาร' : 'วินมอเตอร์ไซค์', 0xf1eada, 0x263932, [2.3, 0.45]));
  });
}

export function createBasicRoad(kind: BasicRoadKind, options: ModelOptions, tiles: readonly number[]): ReturnType<RoadBuilder['finishRoad']> {
  const builder = new RoadBuilder(options), painted = seededRng(options.seed)() < 0.5;
  roadBase(builder, kind, painted); roadProps(builder, kind, options);
  const root = builder.finishRoad(`road.${kind}`, tiles, BASIC_MASKS[kind]);
  root.userData.paintedCurb = painted;
  if (kind === 'corner') root.userData.curbRadius = CORNER_RADIUS;
  return root;
}
