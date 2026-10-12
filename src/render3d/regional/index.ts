/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { north } from './north.js';
import { northeast } from './northeast.js';
import { central } from './central.js';
import { east } from './east.js';
import { west } from './west.js';
import { south } from './south.js';
import type { RegionKit } from './contracts.js';
import type { RegionId } from './types.js';
export { REGIONS } from './types.js';
export type { RegionId, RegionTier } from './types.js';
export * from './contracts.js';

const kits: Readonly<Record<RegionId, RegionKit>> = Object.freeze({ north, northeast, central, east, west, south });
export function getRegionKit(region: RegionId = 'central'): RegionKit {
  const kit = kits[region];
  if (!kit) throw new RangeError(`Unknown region: ${region}`);
  return kit;
}
