/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Material, PlaneGeometry, Vector3 } from 'three';
import { getMaterial, roadConcrete } from '../../materials/library.js';
import { point } from '../vegetation/builder.js';
import { terrainUV } from '../terrain/helpers.js';
import { RoadBuilder, Point2 } from '../road/builder.js';
import { RAIL_INTERFACE } from '../road/interfaces.js';

export const RAIL_MASKS = Object.freeze({ straight: 5, corner: 3, t: 7, cross: 15, end: 1 });
export type TrackKind = keyof typeof RAIL_MASKS;
export const CURVE_RADIUS = 5;
const CURVE_SEGMENTS = 12;

export function railForMask(value: number): { id: string; quarterTurns: number; rotationY: number } | undefined {
  const mask = Number.isFinite(value) ? Math.trunc(value) & 15 : 0;
  for (const [kind, canonical] of Object.entries(RAIL_MASKS)) for (let turn = 0; turn < 4; turn++) {
    if ((((canonical << turn) | (canonical >> (4 - turn))) & 15) === mask)
      return { id: `rail.${kind}`, quarterTurns: turn, rotationY: -turn * Math.PI / 2 };
  }
  return undefined;
}

/** Clip whole triangles, preserving edge intersections rather than distorting rotated sleepers. */
function clipTile(source: BufferGeometry): BufferGeometry {
  const p = source.getAttribute('position'), vertices: number[] = [];
  const count = source.index?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    let polygon = [0, 1, 2].map(n => new Vector3().fromBufferAttribute(p, source.index?.getX(i + n) ?? i + n));
    for (const [axis, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as const) {
      const next: Vector3[] = [];
      polygon.forEach((a, n) => {
        const b = polygon[(n + 1) % polygon.length], da = 5 - a[axis] * sign, db = 5 - b[axis] * sign;
        if (da >= -1e-8) next.push(a);
        if ((da >= 0) !== (db >= 0)) next.push(a.clone().lerp(b, da / (da - db)));
      }); polygon = next;
    }
    for (let n = 1; n < polygon.length - 1; n++) {
      const a = polygon[0], b = polygon[n], c = polygon[n + 1];
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-14) vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }
  }
  const result = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  result.computeVertexNormals(); return result;
}

export class RailBuilder extends RoadBuilder {
  readonly sleepers: { x: number; z: number; station: number; width: number; path: string }[] = [];
  override world(source: BufferGeometry, material: Material): void {
    const clipped = clipTile(source); source.dispose();
    const rotation = this.options.worldRotationY ?? 0;
    clipped.rotateY(rotation);
    const projected = terrainUV(clipped, this.options.worldOrigin);
    if (projected !== clipped) clipped.dispose();
    projected.rotateY(-rotation); this.add(projected, material);
  }
  finishRail(id: string, tiles: readonly number[], mask: number): Group {
    const root = this.finish(id, 'rail', [1, 1], tiles, this.options);
    if (this.anchors.length) root.add(...this.anchors);
    root.userData = { ...root.userData, connections: mask, rail: { ...RAIL_INTERFACE }, sleepers: this.sleepers,
      props: this.props, worldOrigin: [...(this.options.worldOrigin ?? [0, 0])] };
    return root;
  }
}

/** Ordered perimeter of the union bed. Inner and outer perimeters have matching vertices. */
export function bedOutline(kind: TrackKind, w: number, variant = 0): Point2[] {
  if (kind === 'corner' && variant & 3) return stairBed(variant, w);
  if (kind === 'cross') return [[-w, -5], [-w, -w], [-5, -w], [-5, w], [-w, w], [-w, 5],
    [w, 5], [w, w], [5, w], [5, -w], [w, -w], [w, -5]];
  if (kind === 'straight' || kind === 'end') {
    const end = kind === 'end' ? 0.2 + w : 5;
    return [[-w, -5], [-w, end], [w, end], [w, -5]];
  }
  const ring: Point2[] = [];
  const outerStart = kind === 't' ? Math.acos((5 - w) / (5 + w)) : 0;
  if (kind === 't') ring.push([-w, -5], [-w, 5], [w, 5]);
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const a = outerStart + (Math.PI / 2 - outerStart) * i / CURVE_SEGMENTS;
    ring.push([5 - (5 + w) * Math.cos(a), -5 + (5 + w) * Math.sin(a)]);
  }
  for (let i = CURVE_SEGMENTS; i >= 0; i--) {
    const a = Math.PI / 2 * i / CURVE_SEGMENTS;
    ring.push([5 - (5 - w) * Math.cos(a), -5 + (5 - w) * Math.sin(a)]);
  }
  return ring;
}

export function ballast(builder: RailBuilder, kind: TrackKind, variant = 0): void {
  const outer = bedOutline(kind, RAIL_INTERFACE.ballastWidth / 2, variant), inner = bedOutline(kind, 1.2, variant);
  builder.polygon(inner, getMaterial('gravel_ballast'), () => RAIL_INTERFACE.ballastY);
  const vertices: number[] = [];
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length, a = point(outer[i][0], 0, outer[i][1]),
      b = point(inner[i][0], 0.3, inner[i][1]), c = point(inner[j][0], 0.3, inner[j][1]), d = point(outer[j][0], 0, outer[j][1]);
    vertices.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...a.toArray(), ...d.toArray(), ...c.toArray());
  }
  const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  source.computeVertexNormals(); builder.world(source, getMaterial('gravel_ballast'));
}

export interface TrackPath {
  name: string;
  length: number;
  at: (s: number) => { x: number; z: number; nx: number; nz: number };
}

/**
 * A corner on a slanted line, which the game lays as a staircase of corners (models/road/centreline.ts): variant bit 1
 * when its north side is a step, 2 its east side. The track crosses a step side at 45°, so a staircase's corners join
 * into one straight diagonal (owner, 14 Oct 2026: "ทางรถไฟก็เหมือนกัน เป็นยึกยือ"), and eases into straight track where
 * the staircase ends. A cubic curve from the north edge's middle to the east edge's, measured along its length.
 */
function stairPath(variant: number): TrackPath {
  const half = Math.SQRT1_2, pull = 2.6;
  const d0: Point2 = variant & 1 ? [half, half] : [0, 1], d1: Point2 = variant & 2 ? [half, half] : [1, 0];
  const p0: Point2 = [0, -5], p3: Point2 = [5, 0];
  const p1: Point2 = [p0[0] + d0[0] * pull, p0[1] + d0[1] * pull], p2: Point2 = [p3[0] - d1[0] * pull, p3[1] - d1[1] * pull];
  const curve = (t: number): Point2 => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
  const slope = (t: number): Point2 => {
    const u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
    const x = a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]);
    const z = a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]), length = Math.hypot(x, z) || 1;
    return [x / length, z / length];
  };
  const steps = 64, lengths = [0];
  for (let i = 1; i <= steps; i++) {
    const [ax, az] = curve((i - 1) / steps), [bx, bz] = curve(i / steps);
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, bz - az));
  }
  const length = lengths[steps];
  return { name: 'NE', length, at: s => {
    const target = Math.max(0, Math.min(length, s));
    let i = 1;
    while (i < steps && lengths[i] < target) i++;
    const t = (i - 1 + (target - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1)) / steps;
    const [x, z] = curve(t), [tx, tz] = slope(t);
    // Beyond the ends (a sleeper's half past an edge) it runs on straight
    const over = s < 0 ? s : s > length ? s - length : 0;
    return { x: x + tx * over, z: z + tz * over, nx: tz, nz: -tx };
  } };
}

/** The bed of a staircase corner: either side of its track, its ends on the tile's edges, kept within the tile */
function stairBed(variant: number, w: number): Point2[] {
  const path = stairPath(variant), left: Point2[] = [], right: Point2[] = [];
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const p = path.at(path.length * i / CURVE_SEGMENTS);
    // A step side is crossed at 45°: slide the ends along the track onto the edge
    const tx = -p.nz, tz = p.nx;
    const onEdge = (x: number, z: number): Point2 => {
      if (i === 0 && variant & 1) { const k = (-5 - z) / tz; return [x + tx * k, -5]; }
      if (i === CURVE_SEGMENTS && variant & 2) { const k = (5 - x) / tx; return [5, z + tz * k]; }
      return [Math.max(-5, Math.min(5, x)), Math.max(-5, Math.min(5, z))];
    };
    left.push(onEdge(p.x - p.nx * w, p.z - p.nz * w));
    right.push(onEdge(p.x + p.nx * w, p.z + p.nz * w));
  }
  return [...left, ...right.reverse()];
}

export function trackPaths(kind: TrackKind, variant = 0): TrackPath[] {
  if (kind === 'corner' && variant & 3) return [stairPath(variant)];
  const straight: TrackPath = { name: 'NS', length: kind === 'end' ? 6.4 : 10,
    at: s => ({ x: 0, z: s - 5, nx: 1, nz: 0 }) };
  const corner: TrackPath = { name: 'NE', length: CURVE_RADIUS * Math.PI / 2,
    at: s => ({ x: 5 - 5 * Math.cos(s / 5), z: -5 + 5 * Math.sin(s / 5), nx: Math.cos(s / 5), nz: -Math.sin(s / 5) }) };
  const eastWest: TrackPath = { name: 'WE', length: 10, at: s => ({ x: s - 5, z: 0, nx: 0, nz: 1 }) };
  return kind === 'corner' ? [corner] : kind === 't' ? [straight, corner] : kind === 'cross' ? [straight, eastWest] : [straight];
}

/** Sweep the three rectangular parts of the rail profile. The inside head edges define gauge. */
function railProfile(builder: RailBuilder, path: TrackPath, offset: number, width: number, bottom: number, top: number): void {
  const segments = path.name === 'NE' ? CURVE_SEGMENTS : 1, vertices: number[] = [];
  const sections = Array.from({ length: segments + 1 }, (_, i) => {
    const p = path.at(path.length * i / segments);
    return [[offset - width / 2, bottom], [offset + width / 2, bottom],
      [offset + width / 2, top], [offset - width / 2, top]].map(([d, y]) => [p.x + p.nx * d, y, p.z + p.nz * d]);
  });
  for (let i = 0; i < segments; i++) for (let n = 0; n < 4; n++) {
    const m = (n + 1) % 4, a = sections[i][n], b = sections[i + 1][n], c = sections[i + 1][m], d = sections[i][m];
    // WE travels +X with its normal toward +Z, reversing the profile winding.
    if (path.name !== 'WE') vertices.push(...a, ...c, ...b, ...a, ...d, ...c);
    else vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (const [i, reverse] of [[0, path.name !== 'WE'], [segments, path.name === 'WE']] as const) {
    const r = sections[i];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) vertices.push(...r[a], ...r[reverse ? c : b], ...r[reverse ? b : c]);
  }
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); builder.world(geometry, getMaterial('metal_steel'));
}

export function tracks(builder: RailBuilder, kind: TrackKind, variant = 0): void {
  const prototype = new BoxGeometry(1.8, 0.08, 0.22);
  try {
    for (const path of trackPaths(kind, variant)) {
      for (const side of [-1, 1]) {
        const offset = side * (RAIL_INTERFACE.gauge + RAIL_INTERFACE.railWidth) / 2;
        railProfile(builder, path, offset, 0.08, 0.38, 0.42);
        railProfile(builder, path, offset, 0.04, 0.32, 0.38);
        railProfile(builder, path, offset, 0.12, 0.2975, 0.3225);
      }
      const start = builder.options.sleeperOffset ?? (builder.options.worldOrigin?.[path.name === 'WE' ? 0 : 1] ?? 0) - 5;
      const phase = ((-start % 0.6) + 0.6) % 0.6;
      for (let s = phase - 0.6; s <= path.length + 0.11; s += RAIL_INTERFACE.sleeperSpacing) {
        if (s < -0.11) continue;
        // Keep the real center outside an edge, then clip its half sleeper to this tile.
        const p = path.at(s);
        if ((kind === 't' && path.name === 'NE' && p.x < 1.8) || (kind === 'cross' && path.name === 'WE' && Math.abs(p.x) < 1)) continue;
        const extension = kind === 't' && path.name === 'NS' && p.z < -1 ? 5 - Math.sqrt(Math.max(0, 25 - (p.z + 5) ** 2)) : 0;
        const source = prototype.clone().scale((1.8 + extension) / 1.8, 1, 1)
          .rotateY(-Math.atan2(p.nz, p.nx)).translate(p.x + extension / 2, 0.28, p.z);
        builder.world(source, roadConcrete());
        builder.sleepers.push({ x: p.x + extension / 2, z: p.z, station: start + s, width: 1.8 + extension, path: path.name });
      }
    }
  } finally { prototype.dispose(); }
}

export function railGround(builder: RailBuilder, kind: TrackKind, variant = 0): void {
  builder.world(new PlaneGeometry(10, 10).rotateX(-Math.PI / 2), getMaterial('dirt_laterite'));
  // Corner patches stay clear of every canonical track and all four tile edges; a staircase's track cuts across the
  // north-east one
  for (const [x, z] of [[-3.7, -3.5], [-3.5, 3.6], [3.7, 3.5], [3.8, -3.6]]) {
    if (variant & 3 && x > 0 && z < 0) continue;
    const patch: Point2[] = [[-0.73, -0.26], [-0.35, -0.72], [0.45, -0.78], [0.72, -0.12], [0.63, 0.59], [-0.37, 0.78]];
    builder.polygon(patch.map(([dx, dz]) => [x + dx, z + dz]), getMaterial('grass'), () => 0.002);
    builder.grass(x, z, 0.26, getMaterial('grass'));
  }
  ballast(builder, kind, variant);
}

