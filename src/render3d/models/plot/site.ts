/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A big building's construction site (เวลาก่อสร้าง, src/construction.ts, docs/GAME_DESIGN.md 6.1): while the map keeps
// it in `map.sites` the city view draws this in its place (city/tileModels.ts sitePlacement), and the building once it is
// done. One model a size (3 x 3, 4 x 4, 6 x 6 tiles), the same for every seed and region, so every site of a size shares
// one prototype and the chunks draw them all as instances: a fence with its sign along the front, the rising concrete
// frame wrapped in scaffolding and green dust netting, and a tower crane on the large ones (variant 1). The parts are
// the plots' own construction stage (construction.ts), so a site looks like the homes and shops going up round it.

import type { Group } from 'three';
import type { ModelOptions } from '../registry.js';
import { PlotBuilder } from './builder.js';
import { buildConstructionStage } from './construction.js';

export const SITE_SIZES = [3, 4, 6] as const;
export type SiteSize = typeof SITE_SIZES[number];
export const siteId = (size: SiteSize): string => `site.building_${size}`;
/** 0 a site without a crane, 1 one with */
export const SITE_VARIANTS = [0, 1] as const;

const SITE_LABELS = {
  th: ['ไซต์ก่อสร้าง', 'ไซต์ก่อสร้างพร้อมปั้นจั่น'],
  en: ['Construction site', 'Construction site with a tower crane'],
} as const;

export function createSite(size: SiteSize, options: ModelOptions = {}): Group {
  const crane = Number(options.variant ?? 0) === 1;
  // (the plots' builder reads its variant as the land value: one class here, the crane is ours)
  const b = new PlotBuilder({ ...options, seed: 0, variant: 0 }, 0);
  // The frame stands a floor high on a small site and three under a crane (construction.ts: target level 2 or 4)
  const meta = buildConstructionStage(b, 'stage_2', 'commercial', crane ? 4 : 2, [size, size]);
  const root = b.finishPlot(siteId(size), 'services', 'R3', crane ? 4 : 2, SITE_LABELS, { ...meta, site: true }, [size, size]);
  root.userData.variantLabel = SITE_LABELS.th[crane ? 1 : 0];
  root.userData.variantLabelEn = SITE_LABELS.en[crane ? 1 : 0];
  return root;
}
