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
export function bedOutline(kind: TrackKind, w: number): Point2[] {
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

export function ballast(builder: RailBuilder, kind: TrackKind): void {
  const outer = bedOutline(kind, RAIL_INTERFACE.ballastWidth / 2), inner = bedOutline(kind, 1.2);
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

export function trackPaths(kind: TrackKind): TrackPath[] {
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

export function tracks(builder: RailBuilder, kind: TrackKind): void {
  const prototype = new BoxGeometry(1.8, 0.08, 0.22);
  try {
    for (const path of trackPaths(kind)) {
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

export function railGround(builder: RailBuilder, kind: TrackKind): void {
  builder.world(new PlaneGeometry(10, 10).rotateX(-Math.PI / 2), getMaterial('dirt_laterite'));
  // Corner patches stay clear of every canonical track and all four tile edges.
  for (const [x, z] of [[-3.7, -3.5], [-3.5, 3.6], [3.7, 3.5], [3.8, -3.6]]) {
    const patch: Point2[] = [[-0.73, -0.26], [-0.35, -0.72], [0.45, -0.78], [0.72, -0.12], [0.63, 0.59], [-0.37, 0.78]];
    builder.polygon(patch.map(([dx, dz]) => [x + dx, z + dz]), getMaterial('grass'), () => 0.002);
    builder.grass(x, z, 0.26, getMaterial('grass'));
  }
  ballast(builder, kind);
}

