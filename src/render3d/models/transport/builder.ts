/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group, Material, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { getMaterial, vertexFinish } from '../../materials/library.js';
import { countTriangles, disposeModel } from '../../util/geometry.js';
import { ServiceBuilder } from '../services/builder.js';
import type { RegionTier } from '../../regional/types.js';

/** Hubs share colored paint batches; kit carving retains its shape and colors. */
export class TransportBuilder extends ServiceBuilder {
  readonly wood = this.metal;
  readonly asphalt = getMaterial('asphalt');
  readonly sheet = vertexFinish('roof_metal_sheet');

  hubSite(size: number): void {
    this.colored(0xb8beb5, () => this.box(size * 10 - 1, 0.1, size * 10 - 1, 0, 0.05, 0, this.stone));
  }
  parkedVehicle(root: Group, x: number, z: number, yaw = 0): void {
    root.updateMatrixWorld(true);
    const placement = new Matrix4().makeTranslation(x, 0.1, z).multiply(new Matrix4().makeRotationY(yaw));
    root.traverseVisible(node => {
      if (!(node instanceof Mesh)) return;
      const original = node.material as MeshStandardMaterial, key = original.userData.materialKey;
      const material: Material = key.startsWith('glass_') ? this.glass : key === 'asphalt' ? this.asphalt
        : key.startsWith('plaster_') ? this.paint : this.metal;
      const geometry = node.geometry.clone().applyMatrix4(placement.clone().multiply(node.matrixWorld));
      if (material.userData.vertexFinish) TransportBuilder.color(geometry, original.color.getHex());
      this.add(geometry, material);
    });
    disposeModel(root);
  }
  finishHub(id: string, size: number, center: number, tier: RegionTier, metadata: Record<string, unknown> = {}) {
    this.flushSigns();
    const root = this.finish(id, 'transport', [size, size], Array.from({ length: size * size }, (_, i) => center - size - 1 + i), this.options);
    Object.assign(root.userData, { regionTier: tier, centerTile: center, components: this.components,
      structuralBodies: this.structuralBodies, ...metadata });
    return root;
  }
  refreshTriangles(root: Group): void { root.userData.triangles = countTriangles(root); }
}
