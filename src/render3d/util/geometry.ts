/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  Box3, BoxGeometry, BufferGeometry, Curve, Float32BufferAttribute, Group,
  InstancedMesh, Material, Matrix4, Mesh, Object3D, Skeleton, SkinnedMesh, TubeGeometry, Vector3,
} from 'three';

function positive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive`);
}

/** Centered rounded box with a flat core and outward-facing smooth bevel normals. */
export function beveledBox(width: number, height: number, depth: number, radius = 0.1, segments = 1): BufferGeometry {
  [width, height, depth].forEach(value => positive(value, 'Box dimensions'));
  if (!Number.isFinite(radius) || radius < 0 || radius >= Math.min(width, height, depth) / 2) {
    throw new RangeError('Bevel must be smaller than half the smallest dimension');
  }
  if (!Number.isInteger(segments) || segments < 1) throw new RangeError('Segments must be a positive integer');
  const steps = radius === 0 ? 1 : 2 * segments + 1;
  const indexed = new BoxGeometry(1, 1, 1, steps, steps, steps);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.clearGroups();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const half = new Vector3(width / 2, height / 2, depth / 2);
  const core = half.clone().addScalar(-radius);
  const point = new Vector3();
  const nearest = new Vector3();
  const direction = new Vector3();
  const remap = (value: number, extent: number): number => {
    if (radius === 0) return value * extent * 2;
    const index = Math.round((value + 0.5) * steps);
    return index <= segments
      ? -extent + radius * index / segments
      : extent - radius + radius * (index - segments - 1) / segments;
  };
  for (let i = 0; i < position.count; i++) {
    point.set(remap(position.getX(i), half.x), remap(position.getY(i), half.y), remap(position.getZ(i), half.z));
    if (radius > 0) {
      nearest.copy(point).clamp(core.clone().negate(), core);
      direction.subVectors(point, nearest).normalize();
      point.copy(nearest).addScaledVector(direction, radius);
      normal.setXYZ(i, direction.x, direction.y, direction.z);
    }
    position.setXYZ(i, point.x, point.y, point.z);
  }
  applyWorldUV(geometry, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Planar projection per triangle, measured in meters. Indexed input returns a new geometry.
 * Apply after placement transforms when UV continuity between parts is needed.
 */
export function applyWorldUV(input: BufferGeometry, metersPerRepeat: number): BufferGeometry {
  positive(metersPerRepeat, 'Meters per texture repeat');
  const geometry = input.index ? input.toNonIndexed() : input;
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1).sub(a);
    c.fromBufferAttribute(position, i + 2).sub(a);
    normal.crossVectors(b, c);
    const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] = (x >= y && x >= z ? position.getZ(j) : position.getX(j)) / metersPerRepeat;
      uv[j * 2 + 1] = (y >= x && y >= z ? position.getZ(j) : position.getY(j)) / metersPerRepeat;
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** Static position/normal/UV geometry only. Source geometries remain caller-owned. */
export function mergeGeometry(geometries: readonly BufferGeometry[]): BufferGeometry {
  const parts = geometries.map(source => source.index ? source.toNonIndexed() : source.clone());
  const result = new BufferGeometry();
  const count = parts.reduce((total, part) => total + part.getAttribute('position').count, 0);
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
    const values = new Float32Array(count * size);
    let offset = 0;
    for (const part of parts) {
      if (name === 'normal' && !part.getAttribute(name)) part.computeVertexNormals();
      const attribute = part.getAttribute(name);
      const length = part.getAttribute('position').count;
      for (let i = 0; i < length; i++) {
        for (let axis = 0; axis < size; axis++) {
          values[offset++] = attribute ? attribute.getComponent(i, axis) : 0;
        }
      }
    }
    result.setAttribute(name, new Float32BufferAttribute(values, size));
  }
  // Optional baked colors let many painted shop fronts share one library material.
  if (parts.some(part => part.hasAttribute('color'))) {
    const values = new Float32Array(count * 3); let offset = 0;
    parts.forEach(part => {
      const colors = part.getAttribute('color');
      for (let i = 0; i < part.getAttribute('position').count; i++) for (let axis = 0; axis < 3; axis++) {
        values[offset++] = colors ? colors.getComponent(i, axis) : 1;
      }
    });
    result.setAttribute('color', new Float32BufferAttribute(values, 3));
  }
  parts.forEach(part => part.dispose());
  if (count > 0) {
    result.computeBoundingBox();
    result.computeBoundingSphere();
  }
  return result;
}

export interface GeometryPart {
  geometry: BufferGeometry;
  material: Material;
  transform?: Matrix4;
}

/** Exactly one mesh and one draw call per material; no multi-material geometry groups. */
export function mergeByMaterial(id: string, parts: readonly GeometryPart[]): Group {
  const batches = new Map<Material, BufferGeometry[]>();
  for (const part of parts) {
    const geometry = part.geometry.clone();
    if (part.transform) geometry.applyMatrix4(part.transform);
    const batch = batches.get(part.material) ?? [];
    batch.push(geometry);
    batches.set(part.material, batch);
  }
  const group = new Group();
  group.name = id;
  batches.forEach((batch, material) => {
    const mesh = new Mesh(mergeGeometry(batch), material);
    mesh.name = `${id}/${material.name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    batch.forEach(geometry => geometry.dispose());
  });
  return group;
}

export interface RowOptions {
  columns: number;
  rows: number;
  spacingX: number;
  spacingY: number;
  /** Center of the bottom row. Facades face +Z. */
  origin?: Vector3;
  width?: number;
  height?: number;
  depth?: number;
}

function repeatedRows(prototype: BufferGeometry, options: RowOptions): BufferGeometry {
  if (![options.columns, options.rows].every(value => Number.isInteger(value) && value > 0)) {
    throw new RangeError('Row and column counts must be positive integers');
  }
  positive(options.spacingX, 'Column spacing');
  positive(options.spacingY, 'Row spacing');
  const origin = options.origin ?? new Vector3();
  const parts: BufferGeometry[] = [];
  for (let row = 0; row < options.rows; row++) {
    for (let column = 0; column < options.columns; column++) {
      parts.push(prototype.clone().translate(
        origin.x + (column - (options.columns - 1) / 2) * options.spacingX,
        origin.y + row * options.spacingY,
        origin.z,
      ));
    }
  }
  const result = mergeGeometry(parts);
  parts.forEach(part => part.dispose());
  return result;
}

export function windowRows(options: RowOptions): BufferGeometry {
  const prototype = beveledBox(options.width ?? 1.5, options.height ?? 1.8, options.depth ?? 0.12, 0.02);
  const result = repeatedRows(prototype, options);
  prototype.dispose();
  return result;
}

/** Slab and simple solid parapets; merged before repetition. Origin is at slab center. */
export function balconyRows(options: RowOptions): BufferGeometry {
  const width = options.width ?? 2.4, height = options.height ?? 1.1, depth = options.depth ?? 1.2;
  [width, height, depth].forEach(value => positive(value, 'Balcony dimensions'));
  if (width <= 0.24 || depth <= 0.12) throw new RangeError('Balcony is too small for parapets');
  const parts = [
    new BoxGeometry(width, 0.18, depth),
    new BoxGeometry(width, height, 0.12).translate(0, height / 2, depth / 2 - 0.06),
    new BoxGeometry(0.12, height, depth).translate(-width / 2 + 0.06, height / 2, 0),
    new BoxGeometry(0.12, height, depth).translate(width / 2 - 0.06, height / 2, 0),
  ];
  const prototype = mergeGeometry(parts);
  parts.forEach(part => part.dispose());
  const result = repeatedRows(prototype, options);
  prototype.dispose();
  return applyWorldUV(result, 1);
}

/** Exact catenary with sag measured below the chord at its horizontal midpoint.
 * Unequal attachment heights are supported. Zero sag gives a straight wire.
 */
export class CatenaryCurve extends Curve<Vector3> {
  private readonly distance: number;
  private readonly direction: Vector3;
  private readonly a: number;
  private readonly center: number;
  private readonly start: Vector3;
  private readonly end: Vector3;

  constructor(start: Vector3, end: Vector3, readonly sag: number) {
    super();
    this.start = start.clone();
    this.end = end.clone();
    if (![...start.toArray(), ...end.toArray(), sag].every(Number.isFinite) || sag < 0) {
      throw new RangeError('Wire coordinates and nonnegative sag must be finite');
    }
    this.direction = end.clone().sub(start).setY(0);
    this.distance = this.direction.length();
    positive(this.distance, 'Horizontal wire span');
    this.direction.normalize();
    const dy = end.y - start.y;
    let low = 0, high = 1;
    const sagAt = (t: number): number => Math.hypot(
      this.distance / (2 * t) * 2 * Math.sinh(t / 2) ** 2,
      dy / 2 * Math.tanh(t / 2),
    );
    while (sagAt(high) < sag) high *= 2;
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      if (sagAt(mid) < sag) low = mid;
      else high = mid;
    }
    const t = (low + high) / 2;
    this.a = this.distance / (2 * t);
    this.center = this.distance / 2 - this.a * Math.asinh(dy / (2 * this.a * Math.sinh(t)));
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    // Return exact endpoints and avoid cancellation for the zero-sag limit.
    if (t === 0) return target.copy(this.start);
    if (t === 1) return target.copy(this.end);
    if (this.sag === 0) return target.lerpVectors(this.start, this.end, t);
    const x = t * this.distance;
    target.copy(this.start).addScaledVector(this.direction, x);
    // Stable cosh difference, including very small nonzero sags.
    target.y = this.start.y + 2 * this.a * Math.sinh(x / (2 * this.a))
      * Math.sinh((x - 2 * this.center) / (2 * this.a));
    return target;
  }
}

export function catenaryWire(start: Vector3, end: Vector3, sag = 0.6, radius = 0.03, segments = 16): BufferGeometry {
  positive(radius, 'Wire radius');
  if (!Number.isInteger(segments) || segments < 2) throw new RangeError('Wire needs at least two segments');
  return new TubeGeometry(new CatenaryCurve(start, end, sag), segments, radius, 4, false);
}

/** Renderable meshes only: excludes hidden states and counts instance multiplicity. */
export function visibleMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverseVisible(object => { if (object instanceof Mesh) meshes.push(object); });
  return meshes;
}

/** Frame the rendered pose; hidden states and unused bone bind poses must not move the camera. */
export function visibleBounds(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const result = new Box3();
  visibleMeshes(root).forEach(mesh => {
    let bounds: Box3 | null;
    if (mesh instanceof SkinnedMesh || mesh instanceof InstancedMesh) {
      mesh.computeBoundingBox(); bounds = mesh.boundingBox;
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds = mesh.geometry.boundingBox;
    }
    if (bounds) result.union(bounds.clone().applyMatrix4(mesh.matrixWorld));
  });
  return result;
}

function renderedRanges(mesh: Mesh): { start: number; count: number }[] {
  const geometry = mesh.geometry;
  const available = geometry.index?.count ?? geometry.getAttribute('position').count;
  const start = geometry.drawRange.start;
  const end = Math.min(available, start + geometry.drawRange.count);
  const groups = Array.isArray(mesh.material)
    ? geometry.groups.filter(group => mesh.material instanceof Array && mesh.material[group.materialIndex ?? 0]?.visible)
    : mesh.material.visible ? [{ start: 0, count: available }] : [];
  return groups.map(group => ({
    start: Math.max(start, group.start),
    count: Math.max(0, Math.min(end, group.start + group.count) - Math.max(start, group.start)),
  }));
}

export function countTriangles(root: Object3D): number {
  return visibleMeshes(root).reduce((total, mesh) => total + renderedRanges(mesh).reduce(
    (sum, range) => sum + Math.floor(range.count / 3), 0,
  ) * (mesh instanceof InstancedMesh ? mesh.count : 1), 0);
}

/** Model surface calls, excluding lighting passes and gallery guides. */
export function countDrawCalls(root: Object3D): number {
  return visibleMeshes(root).reduce((total, mesh) => total + (
    mesh instanceof InstancedMesh && mesh.count === 0 ? 0 : renderedRanges(mesh).filter(range => range.count > 0).length
  ), 0);
}

/** Shared library materials survive gallery rebuilds; only owned model geometry is freed. */
export function disposeModel(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const skeletons = new Set<Skeleton>();
  root.traverse(object => {
    if (object instanceof Mesh) geometries.add(object.geometry);
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
  });
  geometries.forEach(geometry => geometry.dispose());
  skeletons.forEach(skeleton => skeleton.dispose());
}
