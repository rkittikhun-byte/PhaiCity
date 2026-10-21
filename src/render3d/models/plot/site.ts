/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A big building's construction site (เวลาก่อสร้าง, src/construction.ts, docs/GAME_DESIGN.md 6.1): while the map keeps
// it in `map.sites` the city view draws this in its place (city/tileModels.ts sitePlacement), and the building once it is
// done. One model a size (3 x 3, 4 x 4, 6 x 6 tiles), the same for every seed and region, so every site of a size shares
// one prototype and the chunks draw them all as instances: a laterite pad behind a sheet-metal fence with its sign and a
// truck gate, the concrete frame rising floor by floor, its top floor half cast, scaffolding and green dust netting on
// its front and side, a site office and stacks of materials, and on the large ones (variant 1) a tower crane over it.
// Its colours are the theme's (src/theme/tokens.ts), a few hundred triangles in all.

import type { Group } from 'three';
import { RAMPS } from '../../../theme/tokens.js';
import { point } from '../../regional/geometry.js';
import type { ModelOptions } from '../registry.js';
import { PlotBuilder } from './builder.js';

export const SITE_SIZES = [2, 3, 4, 6] as const;
export type SiteSize = typeof SITE_SIZES[number];
export const siteId = (size: SiteSize): string => `site.building_${size}`;
/** 0 a site without a crane, 1 one with */
export const SITE_VARIANTS = [0, 1] as const;

const SITE_LABELS = {
  th: ['ไซต์ก่อสร้าง', 'ไซต์ก่อสร้างพร้อมปั้นจั่น'],
  en: ['Construction site', 'Construction site with a tower crane'],
} as const;

/** The site's colours, from the theme's ramps */
const C = {
  earth: RAMPS.clay[600], fence: RAMPS.water[600], fenceCap: RAMPS.sand[600], concrete: RAMPS.sand[300],
  slab: RAMPS.sand[200], net: RAMPS.rice[600], scaffold: RAMPS.lavender[500], crane: RAMPS.gold[400],
  dark: RAMPS.sand[800], office: RAMPS.water[300], sand: RAMPS.gold[300], rebar: RAMPS.clay[700],
  sign: RAMPS.gold[400], signInk: RAMPS.sand[900],
} as const;

const STOREY = 3.2;

export function createSite(size: SiteSize, options: ModelOptions = {}): Group {
  const crane = Number(options.variant ?? 0) === 1;
  // (the plots' builder reads its variant as the land value: one class here, the crane is ours)
  const b = new PlotBuilder({ ...options, seed: 0, variant: 0 }, 0);
  const span = size * 10, half = span / 2 - 0.6;
  // The frame: a little over half the lot, set back from the gate, two floors or four under a crane
  const fw = span * 0.56, fd = span * 0.46, fz = -span * 0.1, floors = crane ? 4 : 2, top = floors * STOREY;

  b.feature('site-pad-and-fence', () => {
    b.tone(C.earth, 2 * half, 0.08, 2 * half, 0, 0.04, 0, b.stone);
    const gate = Math.min(6, span * 0.18), h = 2.2, e = half - 0.05;
    const run = (length: number, x: number, z: number, along: 'x' | 'z'): void => {
      b.tone(C.fence, along === 'x' ? length : 0.1, h, along === 'x' ? 0.1 : length, x, h / 2, z, b.metal);
      b.tone(C.fenceCap, along === 'x' ? length : 0.14, 0.1, along === 'x' ? 0.14 : length, x, h, z, b.metal);
    };
    const wing = e - gate / 2;
    for (const side of [-1, 1]) {
      run(wing, side * (gate / 2 + wing / 2), e, 'x');
      run(2 * e, side * e, 0, 'z');
    }
    run(2 * e, 0, -e, 'x');
    b.shopSign('กำลังก่อสร้าง', Math.min(4, wing * 0.7), 0.9, -(gate / 2 + wing / 2), 1.3, e + 0.08,
      { background: C.sign, foreground: C.signInk });
  });

  b.feature('concrete-frame', () => {
    const cols = 4, rows = 3;
    b.colored(C.concrete, () => {
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = -fw / 2 + 0.3 + i * (fw - 0.6) / (cols - 1), z = fz - fd / 2 + 0.3 + j * (fd - 0.6) / (rows - 1);
        b.box(0.45, top + 1, 0.45, x, (top + 1) / 2, z, b.stone);
      }
    });
    // Each floor's slab, the top one half cast; the lift core a storey above it
    for (let f = 1; f <= floors; f++) {
      const part = f === floors ? 0.5 : 1;
      b.tone(C.slab, fw, 0.25, fd * part, 0, f * STOREY - 0.12, fz - fd / 2 + fd * part / 2, b.stone);
    }
    b.tone(C.concrete, fw * 0.18, top + STOREY, fd * 0.3, -fw * 0.25, (top + STOREY) / 2, fz - fd * 0.2, b.stone);
  });

  b.feature('scaffolding-and-netting', () => {
    const netTop = top + 0.8, netBottom = 1.2;
    // Green dust netting on the front and the right side, the frame left bare behind
    b.tone(C.net, fw + 0.6, netTop - netBottom, 0.05, 0, (netTop + netBottom) / 2, fz + fd / 2 + 0.6, b.fabric);
    b.tone(C.net, 0.05, netTop - netBottom, fd * 0.6, fw / 2 + 0.6, (netTop + netBottom) / 2, fz + fd * 0.2, b.fabric);
    b.colored(C.scaffold, () => {
      const n = Math.max(4, Math.round(fw / 3));
      for (let i = 0; i <= n; i++) b.box(0.06, netTop, 0.06, -fw / 2 - 0.3 + i * (fw + 0.6) / n, netTop / 2, fz + fd / 2 + 0.75, b.metal);
      for (let y = 2; y < netTop; y += 2) b.box(fw + 0.7, 0.06, 0.06, 0, y, fz + fd / 2 + 0.75, b.metal);
    });
  });

  b.feature('site-office-and-materials', () => {
    const yard = half - 2.4;
    // A container office by the gate, sand, a pallet of blocks and a bundle of rebar in the yard
    b.tone(C.office, 6, 2.6, 2.4, half - 3.6, 1.3, yard - 0.4, b.metal);
    b.tone(C.dark, 6.1, 0.12, 2.5, half - 3.6, 2.66, yard - 0.4, b.metal);
    b.tone(C.sand, 3, 1, 2.4, -half + 2.4, 0.5, yard - 0.6, b.stone);
    b.tone(C.concrete, 1.6, 1, 1.6, -half + 5.4, 0.5, yard - 0.6, b.stone);
    b.tone(C.rebar, 5, 0.3, 0.6, -half + 3.6, 0.15, fz - fd / 2 - 1.6, b.metal);
  });

  if (crane) {
    b.feature('tower-crane', () => {
      const mast = top + STOREY + 9, cx = fw / 2 + 1.6, cz = fz - fd / 2 + 1.5, jib = Math.min(span * 0.62, 26);
      // (the counter-jib stays over the lot)
      const counter = Math.min(7, half - cx - 0.4);
      b.tone(C.crane, 1.1, mast, 1.1, cx, mast / 2, cz, b.paint);
      b.tone(C.dark, 1.5, 1.4, 1.5, cx, mast + 0.7, cz, b.metal);
      // The jib reaches back over the frame, the counter-jib and its weight the other way
      const jibX = cx - jib / 2 + 1;
      b.tone(C.crane, jib, 0.7, 0.7, jibX, mast + 1.8, cz, b.paint);
      b.tone(C.crane, counter, 0.6, 0.6, cx + counter / 2, mast + 1.8, cz, b.paint);
      b.tone(C.dark, 1.6, 1.4, 1.4, cx + counter - 0.8, mast + 1, cz, b.stone);
      b.tone(C.crane, 0.5, 2.6, 0.5, cx, mast + 3.4, cz, b.paint);
      const hookX = cx - jib * 0.62;
      b.colored(C.dark, () => {
        b.pole(point(cx, mast + 4.6, cz), point(cx - jib + 1.5, mast + 2.1, cz), 0.06, b.metal, 4);
        b.box(0.06, 8, 0.06, hookX, mast + 1.4 - 4, cz, b.metal);
      });
      b.tone(C.crane, 0.6, 0.6, 0.6, hookX, mast + 1.4 - 8.2, cz, b.paint);
    });
  }

  const level = crane ? 4 : 2;
  const root = b.finishPlot(siteId(size), 'services', 'R3', level, SITE_LABELS,
    { site: true, floors, constructionStage: 'stage_2', towerCrane: crane }, [size, size]);
  root.userData.variantLabel = SITE_LABELS.th[crane ? 1 : 0];
  root.userData.variantLabelEn = SITE_LABELS.en[crane ? 1 : 0];
  return root;
}
