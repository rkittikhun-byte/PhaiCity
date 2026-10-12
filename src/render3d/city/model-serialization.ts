/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometry, visibleBounds } from '../util/geometry.js';
import type { SerializedPart, SerializedPrototype } from './prototypes.js';

/** The city instances whole buildings. Bake nested crowd instances and their colors into that prototype. */
function bakedGeometry(mesh: Mesh): BufferGeometry {
  if (!(mesh instanceof InstancedMesh)) return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const parts: BufferGeometry[] = [], matrix = new Matrix4(), color = new Color();
  for (let instance = 0; instance < mesh.count; instance++) {
    mesh.getMatrixAt(instance, matrix); matrix.premultiply(mesh.matrixWorld);
    const geometry = mesh.geometry.clone().applyMatrix4(matrix);
    if (mesh.instanceColor) {
      mesh.getColorAt(instance, color);
      const source = geometry.getAttribute('color'), values = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < values.length / 3; i++) {
        values[i * 3] = (source?.getX(i) ?? 1) * color.r;
        values[i * 3 + 1] = (source?.getY(i) ?? 1) * color.g;
        values[i * 3 + 2] = (source?.getZ(i) ?? 1) * color.b;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
    }
    parts.push(geometry);
  }
  const result = mergeGeometry(parts); parts.forEach(part => part.dispose()); return result;
}

export function serializeModel(key: string, root: Group): { value: SerializedPrototype; transfer: ArrayBuffer[] } {
  root.updateMatrixWorld(true);
  const transfer: ArrayBuffer[] = [], value: SerializedPrototype = { key, parts: [], height: visibleBounds(root).max.y };
  root.traverseVisible(node => {
    if (!(node instanceof Mesh) || node instanceof InstancedMesh && node.count === 0) return;
    const geometry = bakedGeometry(node), material = node.material as MeshStandardMaterial;
    const part: SerializedPart = { attributes: {}, index: null, ground: node.name.endsWith('/ground'),
      castShadow: node.castShadow, receiveShadow: node.receiveShadow,
      material: { key: material.userData.materialKey, name: material.name, color: material.color.getHex(), data: material.userData } };
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    if (material.userData.transportMotion === 'cranes') {
      geometry.boundingBox!.min.x -= 2; geometry.boundingBox!.max.x += 2; geometry.boundingSphere!.radius += 2;
    } else if (material.userData.transportMotion === 'radar') {
      // Rotation changes the dish outline, not its mast pivot; retain the full sweep in city culling bounds.
      geometry.boundingBox!.min.x = -7.4; geometry.boundingBox!.max.x = -2.6;
      geometry.boundingBox!.min.z = -27.4; geometry.boundingBox!.max.z = -22.6;
      geometry.boundingSphere!.radius += 2.4;
    }
    part.bounds = { min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray(),
      center: geometry.boundingSphere!.center.toArray(), radius: geometry.boundingSphere!.radius };
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const source = attribute as BufferAttribute, array = new Float32Array(source.array);
      part.attributes[name] = { array, size: source.itemSize }; transfer.push(array.buffer);
    }
    if (geometry.index) { part.index = new Uint32Array(geometry.index.array); transfer.push(part.index.buffer); }
    value.parts.push(part); geometry.dispose();
  });
  return { value, transfer };
}
