/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A department store (ห้างสรรพสินค้า, src/departmentStores.ts, docs/GAME_DESIGN.md 22) as the program draws it: only
// until its era's model from Blender (art/buildings, `store`) has loaded, or where none loads (era 1 has none), so the
// city never shows a bare 3 × 3. On its civic 3 × 3: a three-storey store with a glass shopfront and a canopy over its
// doors on its front (+Z), a blank sign board (no brand), rooftop units, and its forecourt of parking to the road. Its
// colours are the theme's (src/theme/tokens.ts).

import type { Group } from 'three';
import { RAMPS } from '../../../theme/tokens.js';
import type { ModelOptions } from '../registry.js';
import { PlotBuilder } from '../plot/builder.js';

export const DEPARTMENT_STORE_ID = 'civic.department_store';

const C = {
  ground: RAMPS.sand[200], paving: RAMPS.sand[300], line: RAMPS.sand[50], wall: RAMPS.sand[100], band: RAMPS.clay[500],
  roof: RAMPS.sand[400], canopy: RAMPS.chili[500], sign: RAMPS.gold[500], unit: RAMPS.sand[600], leaf: RAMPS.rice[600],
} as const;

export function createDepartmentStore(options: ModelOptions = {}): Group {
  const b = new PlotBuilder({ ...options, seed: 0, variant: 0 }, 0);
  const half = 14.25, w = 24, d = 15, z = -5.5, storey = 2.6, floors = 3, top = storey * floors;

  b.feature('forecourt', () => {
    b.tone(C.ground, 2 * half, 0.06, 2 * half, 0, 0.03, 0, b.stone);
    b.tone(C.paving, 2 * half - 1, 0.04, 9.5, 0, 0.08, 9, b.stone);
    // the parking bays' lines
    for (let k = -5; k <= 5; k++) b.tone(C.line, 0.12, 0.02, 3.4, k * 2.4, 0.11, 10.6, b.paint);
    // a hedge round the ground it takes, open at the front's drive
    for (const side of [-1, 1]) {
      b.tone(C.leaf, 0.7, 0.8, 2 * half, side * (half - 0.35), 0.4, 0, b.leaves);
      b.tone(C.leaf, half - 4, 0.8, 0.7, side * (half + 4) / 2, 0.4, half - 0.35, b.leaves);
    }
    b.tone(C.leaf, 2 * half, 0.8, 0.7, 0, 0.4, -half + 0.35, b.leaves);
  });

  b.feature('store', () => {
    b.tone(C.wall, w, top, d, 0, top / 2, z, b.paint);
    // a band between the floors, and the glass shopfront of the ground floor
    for (let f = 1; f < floors; f++) b.tone(C.band, w + 0.3, 0.35, d + 0.3, 0, f * storey, z, b.paint);
    b.box(w - 2, storey - 0.6, 0.08, 0, storey / 2, z + d / 2 + 0.05, b.glass);
    for (let f = 1; f < floors; f++) b.box(w - 4, 1.2, 0.08, 0, f * storey + 1.2, z + d / 2 + 0.05, b.glass);
    b.tone(C.roof, w + 0.6, 0.4, d + 0.6, 0, top + 0.2, z, b.paint);
  });

  b.feature('canopy-and-sign', () => {
    b.tone(C.canopy, 10, 0.3, 3, 0, storey - 0.1, z + d / 2 + 1.5, b.paint);
    b.tone(C.sign, 12, 1.6, 0.3, 0, top + 1.2, z + d / 2 - 0.4, b.paint);
  });

  b.feature('roof-units', () => {
    for (const x of [-7, -3, 5]) b.tone(C.unit, 2, 1, 2, x, top + 0.9, z - 3, b.paint);
  });

  return b.finishPlot(DEPARTMENT_STORE_ID, 'services', 'R3', 0, { th: ['ห้างสรรพสินค้า'], en: ['Department store'] },
    { departmentStore: true }, [3, 3]);
}
