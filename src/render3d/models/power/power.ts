/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, CatmullRomCurve3, Group, Material, Mesh, Object3D, PlaneGeometry, TubeGeometry, Vector3 } from 'three';
import { getMaterial, paintedSteel, roadConcrete, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import { beveledBox, CatenaryCurve } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { RoadBuilder } from '../road/builder.js';
import { BASIC_MASKS, POWER_INTERFACE, roadForMask } from '../road/interfaces.js';
import { horizontal, SIDES, terrainUV } from '../terrain/helpers.js';
import { point } from '../vegetation/builder.js';

export const POWER_KINDS = ['straight', 'corner', 't', 'cross', 'end', 'water'] as const;
export type PowerKind = typeof POWER_KINDS[number];
const joints = Object.freeze(Array.from({ length: 9 }, (_, i) => 212 + i));
export const POWER_TILES: Readonly<Record<PowerKind, readonly number[]>> = Object.freeze({
  straight: [210, 211], corner: joints, t: joints, cross: joints, end: joints, water: [208, 209],
});
export const POWER_SAG = 0.15;
export const powerMask = (kind: PowerKind): number => BASIC_MASKS[kind === 'water' ? 'straight' : kind];

/** The same canonical topology as roads; isolated power lines have no model. */
export function powerForMask(value: number): { id: string; quarterTurns: number; rotationY: number } | undefined {
  const selected = roadForMask(value);
  return selected.id === 'road.single' ? undefined : { ...selected, id: selected.id.replace('road.', 'power.') };
}

/** Fixed world axes for wire ordering, matching the existing E/W crossings. */
export function wireTerminal(side: number, offset: number, y: number): Vector3 {
  const direction = SIDES.find(item => item.bit === side);
  if (!direction) throw new RangeError('Wire side must be N, E, S or W');
  return direction.x ? point(direction.x * 5, y, offset) : point(offset, y, direction.z * 5);
}

export class PowerBuilder extends RoadBuilder {
  readonly spans: { kind: string; side: number; start: number[]; end: number[]; sag: number }[] = [];
  override world(source: BufferGeometry, material: Material): void {
    // Only the millimetre-scale wire tube rim can cross a boundary. Trim it to the seam plane.
    const positions = source.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      positions.setX(i, Math.max(-5, Math.min(5, positions.getX(i))));
      positions.setZ(i, Math.max(-5, Math.min(5, positions.getZ(i))));
    }
    const rotation = this.options.worldRotationY ?? 0;
    source.rotateY(rotation);
    const projected = terrainUV(source, this.options.worldOrigin);
    if (source !== projected) source.dispose();
    projected.rotateY(-rotation); this.add(projected, material);
  }
}

const cableMaterial = () => paintedSteel(0x20252a);
const steelMaterial = () => paintedSteel(0x858c8e);
const porcelain = () => tint('plaster_white', 0xa9baad);

function insulator(builder: PowerBuilder, x: number, z: number, top: number): void {
  builder.cylinder(point(x, top - 0.12, z), 0.065, 0.24, porcelain(), 4);
  for (const y of [top - 0.055, top - 0.16]) builder.cylinder(point(x, y, z), 0.115, 0.035, porcelain(), 4);
}

function crossarms(builder: PowerBuilder, mask: number): void {
  const pins = new Map<string, [number, number]>();
  for (const alongX of [true, false]) {
    if (!(mask & (alongX ? 5 : 10))) continue;
    for (const y of [10.72, 5.72]) {
      builder.box(point(0, y, 0), point(alongX ? 2.2 : 0.13, 0.13, alongX ? 0.13 : 2.2), steelMaterial());
      for (const side of [-1, 1]) builder.rod(point(0, y - 0.45, 0),
        point(alongX ? side * 0.75 : 0, y, alongX ? 0 : side * 0.75), 0.035, steelMaterial(), 3);
    }
    for (const offset of POWER_INTERFACE.offsets) {
      const p: [number, number] = alongX ? [offset, 0] : [0, offset]; pins.set(p.join(','), p);
    }
  }
  pins.forEach(([x, z]) => insulator(builder, x, z, POWER_INTERFACE.powerY));
  insulator(builder, 0, 0, POWER_INTERFACE.telecomY);
}

function support(builder: PowerBuilder, water: boolean): void {
  if (!water) {
    builder.world(beveledBox(0.32, 12, 0.32, 0.02).translate(0, 6, 0), roadConcrete());
    builder.box(point(0, 0.1, 0), point(0.7, 0.2, 0.7), roadConcrete());
    return;
  }
  builder.prop('pile_cap', () => {
    builder.box(point(0, -0.35, 0), point(2.5, 1, 2.5), roadConcrete());
    for (const x of [-0.75, 0.75]) for (const z of [-0.75, 0.75])
      builder.cylinder(point(x, -1.9, z), 0.25, 2.2, roadConcrete(), 4);
  });
  builder.prop('lattice_tower', () => {
    const levels = [0.15, 3.1, 6, 9, 11.92];
    const corner = (i: number, y: number): Vector3 => {
      const width = 0.88 - y * 0.045;
      return point([1, 1, -1, -1][i] * width, y, [-1, 1, 1, -1][i] * width);
    };
    for (let face = 0; face < 4; face++) {
      const next = (face + 1) % 4;
      builder.rod(corner(face, levels[0]), corner(face, levels[levels.length - 1]), 0.06, steelMaterial(), 3);
      for (let n = 0; n < levels.length; n++) {
        builder.rod(corner(face, levels[n]), corner(next, levels[n]), 0.035, steelMaterial(), 3);
        if (n < levels.length - 1) builder.rod(corner(n % 2 ? next : face, levels[n]),
          corner(n % 2 ? face : next, levels[n + 1]), 0.025, steelMaterial(), 3);
      }
    }
    for (const y of [5.72, 10.72]) for (const cornerIndex of [0, 1])
      builder.rod(corner(cornerIndex, y), corner(cornerIndex + 2, y), 0.035, steelMaterial(), 3);
    builder.box(point(0, 11.96, 0), point(0.7, 0.08, 0.7), steelMaterial());
  });
}

function wires(builder: PowerBuilder, id: string, mask: number, random: () => number): void {
  const spans = builder.spans;
  for (const side of SIDES) {
    if (!(mask & side.bit)) continue;
    const lines = [...POWER_INTERFACE.offsets.map((offset, i) => ({ offset, y: POWER_INTERFACE.powerY, kind: `power_${i}`, radius: 0.018 })),
      { offset: 0, y: POWER_INTERFACE.telecomY, kind: 'telecom', radius: 0.05 }];
    for (const line of lines) {
      const end = wireTerminal(side.bit, line.offset, line.y);
      const start = point(side.x ? 0 : line.offset, line.y, side.x ? line.offset : 0);
      builder.world(new TubeGeometry(new CatenaryCurve(start, end, POWER_SAG), 4, line.radius, 3, false), cableMaterial());
      spans.push({ kind: line.kind, side: side.bit, start: start.toArray(), end: end.toArray(), sag: POWER_SAG });
      if (line.kind === 'telecom') for (const sign of [-1, 1]) {
        const bundled = start.clone().add(point(side.x ? 0 : sign * 0.065, sign * 0.025, side.x ? sign * 0.065 : 0));
        builder.world(new TubeGeometry(new CatenaryCurve(bundled, end, POWER_SAG), 4, 0.012, 3, false), cableMaterial());
        const loose = start.clone().add(point(side.x ? 0 : sign * 0.035, sign * 0.14, side.x ? sign * 0.035 : 0));
        builder.world(new TubeGeometry(new CatenaryCurve(loose, end, POWER_SAG), 4, 0.014, 3, false), cableMaterial());
      }
      const attachment = new Object3D();
      attachment.name = `${id}/wire_${['N', 'E', 'S', 'W'][Math.log2(side.bit)]}_${line.kind}`;
      attachment.position.copy(end); attachment.userData = { attachment: true, kind: line.kind, side: side.bit };
      builder.anchors.push(attachment);
    }
  }
  // Two hanging service loops give the bundled cables volume without an extra material.
  for (const side of [-1, 1]) {
    const drop = 0.45 + random() * 0.45;
    const loop = [point(0.18, 6.05, 0.12), point(side * 0.6, 5.8, 0.25), point(side * 0.46, 6 - drop, 0.28),
      point(0.18, 5.82, 0.15), point(0.18, 6.05, 0.12)];
    builder.world(new TubeGeometry(new CatmullRomCurve3(loop), 6, 0.026, 3, false), cableMaterial());
  }
}

function seededProp(builder: PowerBuilder, random: () => number, water: boolean): void {
  const choice = Math.floor(random() * 4);
  const front = water ? 1 : 0.31;
  const mount = (y: number): void => {
    const width = 0.88 - y * 0.045;
    builder.rod(point(-width, y, width), point(width, y, width), 0.035, steelMaterial(), 3);
    builder.rod(point(0, y, width), point(0, y, front), 0.035, steelMaterial(), 3);
  };
  if (choice === 0) builder.prop('transformer', () => {
    builder.box(point(0.52, 9.65, 0), point(0.85, 0.12, 0.7), steelMaterial());
    builder.cylinder(point(0.6, 10.13, 0), 0.33, 0.84, steelMaterial(), 8);
    builder.cylinder(point(0.6, 10.58, 0), 0.37, 0.06, steelMaterial(), 8);
    builder.rod(point(0.15, 10.7, 0), point(0.6, 9.65, 0), 0.035, steelMaterial(), 3);
  });
  else if (choice === 1) builder.prop('meter_box', () => {
    if (water) mount(1.5);
    builder.box(point(0, 1.5, front), point(0.4, 0.6, 0.22), steelMaterial());
    builder.box(point(0, 1.57, front + 0.12), point(0.2, 0.22, 0.025), cableMaterial());
    if (water) builder.rod(point(0.12, 1.75, front - 0.11), point(0.12, 2, 0.18), 0.02, cableMaterial(), 3);
    builder.rod(point(0.12, 1.75, 0.18), point(0.12, 5.85, 0.18), 0.02, cableMaterial(), 3);
  });
  else if (choice === 2) builder.prop('advertising_sign', () => {
    const texts = ['ซ่อมเครื่องใช้ไฟฟ้า', 'ห้องว่าง', 'ตัดเย็บเสื้อผ้า', 'ต้นไม้และกระถาง'];
    const text = texts[Math.floor(random() * texts.length)];
    builder.box(point(0, 2.1, front - 0.05), point(0.75, 0.85, 0.08), steelMaterial());
    builder.add(new PlaneGeometry(0.72, 0.82).translate(0, 2.1, front - 0.005), thaiSign(text, 0xe5efce, 0x254335, [0.72, 0.82]));
    if (water) mount(2.1);
    else for (const y of [1.8, 2.4]) builder.box(point(0, y, 0), point(0.36, 0.04, 0.36), cableMaterial());
  });
}

export function createPower(kind: PowerKind, options: ModelOptions = {}): Group {
  const id = `power.${kind}`, mask = powerMask(kind), water = kind === 'water';
  const builder = new PowerBuilder(options), random = seededRng(options.seed);
  builder.world(horizontal(10, 10, water ? -0.6 : 0), getMaterial(water ? 'water_river' : 'dirt_laterite'));
  support(builder, water); crossarms(builder, mask); wires(builder, id, mask, random); seededProp(builder, random, water);
  if (kind === 'end') builder.prop('guy_wire', () => {
    builder.box(point(0, 0.1, 3.8), point(0.4, 0.2, 0.4), roadConcrete());
    builder.rod(point(0, 10.5, 0.17), point(0, 0.2, 3.8), 0.025, cableMaterial(), 3);
    builder.rod(point(0, 0.2, 3.8), point(0, 2.05, 3.15), 0.06, tint('metal_painted', 0xe6c84a), 4);
  });
  const root = builder.finish(id, 'power', [1, 1], POWER_TILES[kind], options);
  if (water) root.children.forEach(child => { if (child instanceof Mesh && child.material === getMaterial('water_river')) child.castShadow = false; });
  root.add(...builder.anchors);
  root.userData = { ...root.userData, connections: mask, power: { ...POWER_INTERFACE, sag: POWER_SAG, poleHeight: 12 },
    spans: builder.spans, props: builder.props,
    worldOrigin: [...(options.worldOrigin ?? [0, 0])] };
  return root;
}
