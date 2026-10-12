/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import type { ModelOptions, ModelRegistration } from '../models/registry.js';
import { createElevatedRail, ElevatedStyle } from '../models/rail/elevated.js';

/** All three ramp segments followed by a level viaduct, in increasing N-to-S station order. */
export function elevatedRampPreview(style: ElevatedStyle, options: ModelOptions = {}): Group {
  const root = new Group(); root.name = `preview.${style}_ramp`;
  for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * 10;
    const model = createElevatedRail(style, i < 3 ? 'ramp' : 'straight', { ...options, variant: i,
      worldOrigin: [options.worldOrigin?.[0] ?? 0, (options.worldOrigin?.[1] ?? 0) + z] });
    model.position.z = z; root.add(model);
  }
  root.userData = { style, tiles: 4, region: options.region ?? 'central' }; return root;
}

export const ELEVATED_PREVIEWS: Readonly<Record<string, ModelRegistration>> = Object.freeze(
  Object.fromEntries((['hsr', 'metro'] as const).map(style => [`preview.${style}_ramp`, {
    factory: (options?: ModelOptions) => elevatedRampPreview(style, options), category: 'rail',
    footprint: [1, 4], tiles: [], budget: 6000, regionTier: 'R3', tiling: true,
  } as ModelRegistration])),
);
