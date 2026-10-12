/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { InstancedMesh, Matrix4, Object3D } from 'three';
import { updateTransportClock } from '../../materials/library.js';
import { CRANE_TRAVEL } from './seaport.js';

const matrix = new Matrix4();
/** Explicit elapsed visual time; city pause keeps the same clock and never changes simulation. */
export function animateTransportModels(roots: readonly Object3D[], seconds: number): void {
  if (!Number.isFinite(seconds)) return;
  updateTransportClock(seconds);
  for (const root of roots) root.traverse(model => {
    if (model.userData.id === 'port.airport') {
      const radar = model.getObjectByName('anim_radar'); if (radar) radar.rotation.y = seconds * 0.65;
    }
    if (model.userData.id !== 'port.seaport') return;
    const cranes = model.getObjectByName('port.seaport/cranes'); if (!(cranes instanceof InstancedMesh)) return;
    for (let i = 0; i < 2; i++) {
      const pivot = model.getObjectByName(`anim_crane_${i}`)!;
      pivot.position.x = pivot.userData.baseX + (i ? -1 : 1) * Math.sin(seconds * 0.25) * CRANE_TRAVEL;
      cranes.setMatrixAt(i, matrix.makeTranslation(pivot.position.x, pivot.position.y, pivot.position.z));
    }
    cranes.instanceMatrix.needsUpdate = true; cranes.computeBoundingBox(); cranes.computeBoundingSphere();
  });
}
