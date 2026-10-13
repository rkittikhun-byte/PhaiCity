/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry,
  Material, Path, Quaternion, Shape, ShapeUtils, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three';
import { car_paint, vehicleMaterial } from '../../materials/library.js';
import { applyWorldUV, beveledBox } from '../../util/geometry.js';
import { point, VehicleBuilder } from './builder.js';

export interface CarProfile {
  shape: Shape; width: number; beltY: number; roofY: number; roofRatio?: number;
  /** Exterior edge openings [z0, y0, z1, y1]. Side windows are actual Shape holes. */
  frontGlass?: readonly [number, number, number, number];
  rearGlass?: readonly [number, number, number, number];
  /** Remove the bed lid before lining its interior; keeps pickups genuinely open. */
  openBed?: readonly [number, number];
  /** Narrow an open three-wheeler's apron towards +Z without narrowing its passenger bench. */
  noseTaper?: { start: number; end: number; ratio: number };
}
export interface WheelOptions { faces?: readonly (-1 | 1)[]; rim?: 'spokes' | 'dish' | 'none'; rimMaterial?: Material }

/** Reusable 16B kit: Z-Y silhouette -> beveled X extrusion, carved arches, tapered glass, rounded tires.
 * 16C can reuse profileBody, sideWindow, wheelSet and fittings with its own silhouettes and axle count.
 * All construction buffers belong to this builder; finish() merges one mesh per shared finish.
 */
export class VehicleKit extends VehicleBuilder {
  readonly paint; readonly tire = vehicleMaterial('rubber_tire'); readonly chrome = vehicleMaterial('chrome');
  readonly trim = vehicleMaterial('plastic_trim_black'); readonly lamp = vehicleMaterial('lamp_lens');
  readonly tail = vehicleMaterial('tail_light_red'); readonly glass = vehicleMaterial('glass_vehicle');
  readonly amber = vehicleMaterial('lamp_lens', 0xefaa38);
  readonly components: { role: string; triangles: number }[] = [];
  readonly wheels: { center: number[]; radius: number; width: number }[] = [];
  constructor(color: number) { super(); this.paint = car_paint(color); }

  feature(role: string, make: () => void): void {
    const first = this.parts.length; make();
    this.components.push({ role, triangles: this.parts.slice(first).reduce((n, p) => n +
      (p.geometry.index?.count ?? p.geometry.getAttribute('position').count) / 3, 0) });
  }
  roundedBox(center: Vector3, size: Vector3, material: Material, radius = 0.04, segments = 1): void {
    this.add(beveledBox(size.x, size.y, size.z, radius, segments).translate(center.x, center.y, center.z), material);
  }
  face(vertices: readonly Vector3[], material: Material): void {
    const values: number[] = [];
    for (let i = 1; i < vertices.length - 1; i++) values.push(...vertices[0].toArray(), ...vertices[i].toArray(), ...vertices[i + 1].toArray());
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
    geometry.computeVertexNormals(); this.add(applyWorldUV(geometry, 1), material);
  }
  tube(a: Vector3, b: Vector3, radius: number, material: Material, sides = 8): void {
    const source = new CylinderGeometry(radius, radius, a.distanceTo(b), sides);
    source.applyQuaternion(new Quaternion().setFromUnitVectors(point(0, 1, 0), b.clone().sub(a).normalize()));
    const center = a.clone().add(b).multiplyScalar(0.5); source.translate(center.x, center.y, center.z);
    this.add(applyWorldUV(source, 1), material); source.dispose();
  }
  widthAt(y: number, profile: CarProfile, z = 0): number {
    const t = Math.max(0, Math.min(1, (y - profile.beltY) / (profile.roofY - profile.beltY)));
    const nose = profile.noseTaper, n = nose ? Math.max(0, Math.min(1, (z - nose.start) / (nose.end - nose.start))) : 0;
    return profile.width / 2 * (1 - t * (1 - (profile.roofRatio ?? 0.875))) * (1 - n * (1 - (nose?.ratio ?? 1)));
  }
  profileBody(profile: CarProfile, detail: 'full' | 'display' = 'full', material: Material = this.paint): void {
    const src = new ExtrudeGeometry(profile.shape, { depth: profile.width - 0.09, steps: 1,
      bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.045, bevelSegments: detail === 'full' ? 2 : 1,
      curveSegments: detail === 'full' ? 6 : 3 });
    src.translate(0, 0, -(profile.width - 0.09) / 2).rotateY(-Math.PI / 2);
    const geometry = src.index ? src.toNonIndexed() : src, p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * this.widthAt(p.getY(i), profile, p.getZ(i)) / (profile.width / 2));
    const values: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const ny = normal.getY(i), nz = normal.getZ(i), nx = Math.abs(normal.getX(i));
      const inGlass = (edge: readonly number[], front: boolean) => nx < 0.6 && (front ? nz > 0.3 : nz < -0.3) && ny > -0.05 &&
        z >= Math.min(edge[0], edge[2]) - 0.055 && z <= Math.max(edge[0], edge[2]) + 0.055 &&
        y > Math.min(edge[1], edge[3]) + 0.025 && y < Math.max(edge[1], edge[3]) - 0.015;
      const open = profile.frontGlass && inGlass(profile.frontGlass, true) || profile.rearGlass && inGlass(profile.rearGlass, false) ||
        profile.openBed && nx < 0.6 && ny > 0.6 && z > profile.openBed[0] && z < profile.openBed[1] && y > 1.1;
      if (!open) for (let n = 0; n < 3; n++) values.push(p.getX(i + n), p.getY(i + n), p.getZ(i + n));
    }
    const result = new BufferGeometry(); result.setAttribute('position', new Float32BufferAttribute(values, 3)); result.computeVertexNormals();
    this.add(applyWorldUV(result, 1), material); geometry.dispose(); if (geometry !== src) src.dispose();
  }
  /** Window outlines are in profile coordinates [Z,Y]. They carve both sides before body extrusion. */
  windowHole(shape: Shape, vertices: readonly (readonly [number, number])[]): void {
    const hole = new Path(); vertices.forEach(([z, y], i) => i ? hole.lineTo(z, y) : hole.moveTo(z, y)); hole.closePath(); shape.holes.push(hole);
  }
  sideWindow(vertices: readonly (readonly [number, number])[], profile: CarProfile): void {
    this.sideSheet(vertices, profile, this.glass);
  }
  /** Flat glass/door/trim sheets follow the tapered side surface; outline is counterclockwise in Z-Y. */
  sideSheet(vertices: readonly (readonly [number, number])[], profile: CarProfile, material: Material,
    sides: readonly (-1 | 1)[] = [-1, 1], inset = 0.015): void {
    for (const side of sides) {
      const points = vertices.map(([z, y]) => point(side * (this.widthAt(y, profile, z) - inset), y, z));
      this.face(side > 0 ? points.reverse() : points, material);
    }
  }
  /** Triangulated curved side cladding preserves arches and concave door openings. */
  sidePanel(shape: Shape, profile: CarProfile, material: Material, sides: readonly (-1 | 1)[] = [-1, 1]): void {
    const contours = shape.extractPoints(6), triangles = ShapeUtils.triangulateShape(contours.shape, contours.holes);
    const points = contours.shape.concat(...contours.holes);
    for (const side of sides) for (const triangle of triangles) {
      const face = triangle.map(i => point(side * (this.widthAt(points[i].y, profile, points[i].x) + 0.002), points[i].y, points[i].x));
      this.face(side > 0 ? face.reverse() : face, material);
    }
  }
  ellipsoid(center: Vector3, radii: Vector3, material: Material, segments = 16, rings = 8): void {
    const geometry = new SphereGeometry(1, segments, rings).scale(radii.x, radii.y, radii.z).translate(center.x, center.y, center.z);
    this.add(applyWorldUV(geometry, 1), material);
  }
  endGlass(edge: readonly [number, number, number, number], profile: CarProfile, front: boolean): void {
    const [bottomZ, bottomY, topZ, topY] = edge, inset = front ? -0.015 : 0.015;
    const vertices = [point(-this.widthAt(bottomY, profile) + 0.1, bottomY + 0.035, bottomZ + inset),
      point(this.widthAt(bottomY, profile) - 0.1, bottomY + 0.035, bottomZ + inset),
      point(this.widthAt(topY, profile) - 0.09, topY - 0.03, topZ + inset),
      point(-this.widthAt(topY, profile) + 0.09, topY - 0.03, topZ + inset)];
    this.face(front ? vertices : vertices.reverse(), this.glass);
  }
  /** Clockwise round cut-outs, clipped at body ends for exposed scooter wheels; bevel retains 6 cm clearance. */
  archBottom(shape: Shape, rear: number, front: number, bottom: number, radius: number, centers: readonly number[],
    frontRise: readonly (readonly [number, number])[] = []): void {
    const r = radius + 0.11, a = Math.asin((bottom - radius) / r), half = Math.sqrt(r * r - (bottom - radius) ** 2);
    const axles = [...centers].sort((x, y) => x - y).filter(z => z + half > rear && z - half < front);
    const edgeY = (x: number, z: number) => radius + Math.sqrt(Math.max(0, r * r - (x - z) ** 2));
    const first = axles[0]; shape.lineTo(rear, first !== undefined && first - half < rear ? edgeY(rear, first) : bottom);
    let clippedFront = false;
    for (const z of axles) {
      const lo = Math.max(rear, z - half), hi = Math.min(front, z + half);
      shape.lineTo(lo, lo === z - half ? bottom : edgeY(lo, z));
      shape.absarc(z, radius, r, lo === z - half ? Math.PI - a : Math.acos((lo - z) / r),
        hi === z + half ? a : Math.acos((hi - z) / r), true);
      clippedFront = hi === front;
    }
    if (!clippedFront) shape.lineTo(front, bottom);
    frontRise.forEach(([z, y]) => shape.lineTo(z, y)); shape.closePath();
  }
  wheelSet(zs: readonly number[], radius: number, width: number, x: number): void {
    this.feature('rounded-tires-and-five-spoke-rims', () => {
      for (const z of zs) for (const side of [-1, 1]) this.wheelAt(point(side * x, radius, z), radius, width);
    });
  }
  /** Single wheel, including centerline/both-sided scooter rims and separate inner tires of a dual wheel. */
  wheelAt(center: Vector3, radius: number, width: number, options: WheelOptions = {}): void {
    this.wheels.push({ center: center.toArray(), radius, width });
    const tire = new LatheGeometry([new Vector2(radius * 0.64, -width / 2), new Vector2(radius * 0.9, -width / 2),
      new Vector2(radius, -width * 0.23), new Vector2(radius, width * 0.23), new Vector2(radius * 0.9, width / 2),
      new Vector2(radius * 0.64, width / 2)], 16).rotateZ(-Math.PI / 2).translate(center.x, center.y, center.z);
    this.add(applyWorldUV(tire, 1), this.tire); tire.dispose();
    if (options.rim === 'none') return;
    const material = options.rimMaterial ?? this.chrome;
    for (const side of options.faces ?? [center.x < 0 ? -1 : 1]) {
      const rim = new LatheGeometry([new Vector2(radius * 0.61, 0), new Vector2(radius * 0.61, 0.023),
        new Vector2(radius * 0.5, 0.033), new Vector2(radius * 0.47, 0.012)], 16)
        .rotateZ(-side * Math.PI / 2).translate(center.x + side * (width / 2 - 0.018), center.y, center.z);
      this.add(applyWorldUV(rim, 1), material); rim.dispose();
      this.cylinder(point(center.x + side * (width / 2 - 0.004), center.y, center.z), radius * (options.rim === 'dish' ? 0.48 : 0.2), 0.02, material, 8, 'x');
      for (let spoke = 0; options.rim !== 'dish' && spoke < 5; spoke++) {
        const angle = spoke * Math.PI * 2 / 5;
        this.box(point(center.x + side * (width / 2 - 0.004), center.y + Math.sin(angle) * radius * 0.32, center.z + Math.cos(angle) * radius * 0.32),
          point(0.025, radius * 0.13, radius * 0.45), material, 0, -angle);
      }
    }
  }
  /** Optional outward fender lip for 16C trucks; wheel clearance remains above 6 cm. */
  fenderLips(zs: readonly number[], radius: number, bodyWidth: number): void {
    for (const z of zs) for (const side of [-1, 1]) {
      const source = new TorusGeometry(radius + 0.1, 0.018, 3, 12, Math.PI)
        .rotateY(Math.PI / 2).translate(side * (bodyWidth / 2 + 0.01), radius, z);
      this.add(applyWorldUV(source, 1), this.paint); source.dispose();
    }
  }
  fittings(length: number, width: number, belt: number, mirrorZ: number,
    options: { indicators?: boolean; mirrorY?: number; lampFrames?: boolean } = {}): void {
    this.feature('lamps-grille-bumpers-and-mirrors', () => {
      const front = length / 2 + 0.006, rear = -length / 2 - 0.006;
      this.roundedBox(point(0, belt - 0.43, length / 2 - 0.1), point(width - 0.06, 0.21, 0.2), this.trim, 0.025);
      this.roundedBox(point(0, belt - 0.43, -length / 2 + 0.1), point(width - 0.06, 0.21, 0.2), this.trim, 0.025);
      this.box(point(0, belt - 0.11, front - 0.018), point(width * 0.43, 0.27, 0.03), this.trim);
      for (let i = 0; i < 4; i++) this.box(point(0, belt - 0.22 + i * 0.065, front), point(width * 0.4, 0.018, 0.018), this.chrome);
      for (const side of [-1, 1]) {
        const x = side * width * 0.35;
        if (options.lampFrames) {
          this.face([point(x - 0.218, belt - 0.218, front - 0.001), point(x + 0.218, belt - 0.218, front - 0.001),
            point(x + 0.188, belt + 0.003, front - 0.001), point(x - 0.188, belt + 0.043, front - 0.001)], this.trim);
          this.face([point(x - 0.17, belt - 0.23, rear + 0.001), point(x - 0.17, belt + 0.07, rear + 0.001),
            point(x + 0.17, belt + 0.07, rear + 0.001), point(x + 0.17, belt - 0.23, rear + 0.001)], this.trim);
        }
        this.face([point(x - 0.2, belt - 0.2, front), point(x + 0.2, belt - 0.2, front),
          point(x + 0.17, belt - 0.015, front), point(x - 0.17, belt + 0.025, front)], this.lamp);
        this.face([point(x - 0.15, belt - 0.21, rear), point(x - 0.15, belt + 0.05, rear),
          point(x + 0.15, belt + 0.05, rear), point(x + 0.15, belt - 0.21, rear)], this.tail);
        if (options.indicators !== false) this.face([point(x - 0.15, belt - 0.19, front + 0.002), point(x + 0.15, belt - 0.19, front + 0.002),
          point(x + 0.15, belt - 0.145, front + 0.002), point(x - 0.15, belt - 0.145, front + 0.002)], this.amber);
        const mirrorY = options.mirrorY ?? belt + 0.12;
        this.tube(point(side * width * 0.46, mirrorY - 0.09, mirrorZ), point(side * (width / 2 + 0.07), mirrorY - 0.03, mirrorZ), 0.025, this.trim, 6);
        this.roundedBox(point(side * (width / 2 + 0.07), mirrorY, mirrorZ), point(0.15, 0.13, 0.24), this.trim, 0.025);
        this.face([point(side * (width / 2 + 0.12), mirrorY - 0.045, mirrorZ - 0.122), point(side * (width / 2 + 0.12), mirrorY + 0.05, mirrorZ - 0.122),
          point(side * (width / 2 + 0.01), mirrorY + 0.05, mirrorZ - 0.122), point(side * (width / 2 + 0.01), mirrorY - 0.045, mirrorZ - 0.122)], this.chrome);
      }
    });
  }
}
