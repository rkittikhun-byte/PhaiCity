/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Float32BufferAttribute, Group, LatheGeometry, Material, Vector2, Vector3 } from 'three';
import { applyWorldUV } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { point } from './builder.js';
import { VehicleKit } from './kit.js';

/** Continuous indexed skin: adjacent stations share normals, including across material boundaries.
 * A null cell is a real opening, not dark paint covering a solid shell. Rings run clockwise viewed from +Z.
 */
export function loft(b: VehicleKit, rings: readonly (readonly Vector3[])[],
  finish: (center: Vector3, station: number, segment: number) => Material | null,
  closed = true, caps = false): void {
  const n = rings[0].length, vertices = rings.flatMap(r => r.flatMap(p => p.toArray())), indices: number[] = [];
  const cells: { start: number; material: Material | null }[] = [];
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n - (closed ? 0 : 1); j++) {
    const k = (j + 1) % n, a = i * n + j, c = (i + 1) * n + k;
    const center = rings[i][j].clone().add(rings[i][k]).add(rings[i + 1][j]).add(rings[i + 1][k]).multiplyScalar(0.25);
    cells.push({ start: indices.length, material: finish(center, i, j) });
    indices.push(a, c, i * n + k, a, (i + 1) * n + j, c);
  }
  if (caps) for (const end of [0, rings.length - 1]) {
    const base = end * n;
    for (let j = 1; j < n - 1; j++) {
      const center = rings[end][0].clone().add(rings[end][j]).add(rings[end][j + 1]).multiplyScalar(1 / 3);
      cells.push({ start: indices.length, material: finish(center, end, -1) });
      indices.push(base, base + (end === 0 ? j : j + 1), base + (end === 0 ? j + 1 : j));
    }
  }
  const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  source.setIndex(indices); source.computeVertexNormals();
  const normals = source.getAttribute('normal'), batches = new Map<Material, { p: number[]; n: number[] }>();
  for (let cell = 0; cell < cells.length; cell++) {
    const { material, start } = cells[cell]; if (!material) continue;
    let batch = batches.get(material); if (!batch) { batch = { p: [], n: [] }; batches.set(material, batch); }
    const end = cells[cell + 1]?.start ?? indices.length;
    for (let i = start; i < end; i++) {
      const index = indices[i], inset = material.userData.vehicleMaterial === 'glass_vehicle' ? 0.012 : 0;
      batch.p.push(vertices[index * 3] - normals.getX(index) * inset,
        vertices[index * 3 + 1] - normals.getY(index) * inset, vertices[index * 3 + 2] - normals.getZ(index) * inset);
      batch.n.push(normals.getX(index), normals.getY(index), normals.getZ(index));
    }
  }
  batches.forEach((batch, material) => {
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(batch.p, 3))
      .setAttribute('normal', new Float32BufferAttribute(batch.n, 3)); b.add(applyWorldUV(geometry, 1), material);
  }); source.dispose();
}

/** Actual surface of revolution along Z; samples include zero-radius nose/tail closures. */
export function latheZ(b: VehicleKit, samples: readonly (readonly [number, number])[], center: Vector3,
  material: Material | ((center: Vector3) => Material), sides = 32): void {
  const source = new LatheGeometry(samples.map(([z, r]) => new Vector2(r, z)), sides).rotateX(Math.PI / 2)
    .translate(center.x, center.y, center.z);
  // rotateX(+pi/2) maps the profile's +Y axis to +Z.
  if (typeof material !== 'function') { b.add(applyWorldUV(source, 1), material); source.dispose(); return; }
  const flat = source.toNonIndexed(), p = flat.getAttribute('position'), normal = flat.getAttribute('normal');
  const batches = new Map<Material, { p: number[]; n: number[] }>();
  for (let i = 0; i < p.count; i += 6) {
    // LatheGeometry emits six indices per cell. Select its whole quad, otherwise windows become half-triangles.
    const center = point(0, 0, 0); for (let j = 0; j < 6; j++) center.add(point(p.getX(i + j), p.getY(i + j), p.getZ(i + j)));
    const mat = material(center.multiplyScalar(1 / 6)); let batch = batches.get(mat);
    if (!batch) { batch = { p: [], n: [] }; batches.set(mat, batch); }
    for (let j = i; j < i + 6; j++) {
      const inset = mat.userData.vehicleMaterial === 'glass_vehicle' ? 0.012 : 0;
      batch.p.push(p.getX(j) - normal.getX(j) * inset, p.getY(j) - normal.getY(j) * inset, p.getZ(j) - normal.getZ(j) * inset);
      batch.n.push(normal.getX(j), normal.getY(j), normal.getZ(j));
    }
  }
  batches.forEach((batch, mat) => b.add(applyWorldUV(new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(batch.p, 3)).setAttribute('normal', new Float32BufferAttribute(batch.n, 3)), 1), mat));
  flat.dispose(); source.dispose();
}

/** Airfoil rather than a rotated rectangle. Each station is [X,Y,leading Z,trailing Z,thickness]. */
export function wing(b: VehicleKit, stations: readonly (readonly [number, number, number, number, number])[], material: Material): void {
  const rings = stations.map(([x, y, front, rear, thickness]) => {
    const chord = front - rear;
    return [[front, 0], [front - chord * 0.08, thickness * 0.65], [front - chord * 0.32, thickness],
      [front - chord * 0.68, thickness * 0.6], [rear, 0], [front - chord * 0.68, -thickness * 0.24],
      [front - chord * 0.32, -thickness * 0.35], [front - chord * 0.08, -thickness * 0.2]]
      .map(([z, dy]) => point(x, y + dy, z));
  });
  // loft() is coordinate independent; order must face outward for either wing.
  if (stations[0][0] > stations[stations.length - 1][0]) rings.forEach(r => r.reverse());
  loft(b, rings, () => material, true, true);
}

export function finishVehicle(b: VehicleKit, id: string, footprint: readonly [number, number], options: ModelOptions,
  data: Record<string, unknown> = {}, tier: 'R2' | 'R3' = 'R3'): Group {
  const root = b.finish(id, footprint, options, tier);
  Object.assign(root.userData, { kit: '16B', front: '+Z', components: b.components, wheels: b.wheels, ...data }); return root;
}
