/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { SITE } from '../../../theme/tokens.js';
import { point } from '../../regional/geometry.js';
import { PlotBuilder, PlotCategory } from './builder.js';

const SAFETY_GREEN = 0x2e7d52;
const FENCE_BLUE = 0x2b5f8e;
const CRANE_YELLOW = 0xe2a829;
const REBAR_RUST = 0x6e4e3a;
const BRICK_RED = 0xb8523b;
const SAND_BUFF = 0xd6be8a;

/**
 * Builds a 3D construction site sequence (ลำดับการก่อสร้าง) for any 1×1 plot or 2×2 lot:
 * - `stage_1`: Foundation slab, exposed rebar starter columns, sand & brick stacks, cement mixer, and Thai site fence.
 * - `stage_2`: Rising concrete structural frame scaled to target `level`, bamboo/steel scaffolding, green dust safety
 *   netting (ตาข่ายกันฝุ่นสีเขียว), and a yellow tower crane on buildings of level >= 3.
 */
export function buildConstructionStage(
  b: PlotBuilder,
  stage: 'stage_1' | 'stage_2' | 'scaffold',
  category: PlotCategory,
  level: number,
  footprint: readonly [number, number],
  era = 3,
): Record<string, unknown> {
  // Built in its era's way (owner, 24 Oct 2026): a farming village's bamboo poles and thatch, a market town's timber, then
  // concrete, steel scaffold, netting and a crane
  const bamboo = era <= 1, timber = era === 2, old = era <= 2;
  const POLE = bamboo ? SITE.pole.bamboo : SITE.pole.timber, FRAME = old ? (bamboo ? SITE.frame.bamboo : SITE.frame.timber) : SITE.frame.steel;
  const SLAB = old ? SITE.slab.old : SITE.slab.concrete;
  const span = footprint[0] * 10;
  const W = span - 1.2;
  const front = span / 2 - 0.65;
  const back = -span / 2 + 0.85;
  const D = front - back;
  const zc = (front + back) / 2;
  const targetFloors = category === 'industrial' ? Math.max(1, level) : [1, 1, 2, 4, 8, 16][Math.min(5, Math.max(1, level))];
  const frameFloors = stage === 'stage_1' ? 1 : Math.max(1, Math.min(8, Math.ceil(targetFloors * 0.65)));
  const storey = 3.0;

  // (scaffold: only the scaffold standing round a building rebuilt in another era's look, its old self inside, src/eraScore.ts)
  const wrap = stage === 'scaffold';
  if (!wrap) b.feature('site-ground-and-foundation', () => {
    // Compacted laterite earth pad, cleared and pegged; a concrete foundation slab from the factory town on
    b.tone(0x9e7352, W + 0.3, 0.08, span - 1.1, 0, 0.04, 0, b.stone);
    if (!old) b.body(SITE.concrete, W - 0.6, 0.45, D - 0.6, 0, 0, zc, 0.08);
    // The street front (+Z), leaving a gate: a low bamboo or timber rail in the old eras, corrugated sheet later
    const gateW = footprint[0] > 1 ? 3.8 : 2.6;
    const wingW = (W - gateW) / 2;
    for (const side of [-1, 1]) {
      const fx = side * (gateW / 2 + wingW / 2);
      if (old) {
        b.tone(POLE, wingW, 0.07, 0.07, fx, 0.85, front + 0.04, b.wood);
        b.tone(POLE, wingW, 0.07, 0.07, fx, 0.45, front + 0.04, b.wood);
      } else {
        b.tone(FENCE_BLUE, wingW, 1.85, 0.08, fx, 0.96, front + 0.04, b.metal);
        b.tone(SITE.steel, wingW + 0.06, 0.07, 0.12, fx, 1.88, front + 0.04, b.metal);
      }
    }
    if (!old) b.shopSign('กำลังก่อสร้าง', 2.1, 0.48, -gateW / 2 - wingW / 2, 1.45, front + 0.1, {
      background: CRANE_YELLOW,
      foreground: 0x222526,
    });
  });

  if (stage === 'stage_1') {
    b.feature('rebar-footings-and-materials', () => {
      const cols = footprint[0] > 1 ? [-5.5, -1.8, 1.8, 5.5] : [-2.8, 0, 2.8];
      const rows = footprint[0] > 1 ? [-5.0, -1.2, 2.4] : [-2.4, 0.6];
      for (const cx of cols) {
        for (const cz of rows) {
          // The old eras' stilts: a post on a stone, no rebar
          if (old) { b.tone(POLE, 0.22, 1.9, 0.22, cx, 0.95, cz, b.wood); continue; }
          // Concrete footing stub + 4 starter rebar rods
          b.tone(0xb5b1a8, 0.65, 0.85, 0.65, cx, 0.45 + 0.425, cz, b.stone);
          b.colored(REBAR_RUST, () => {
            for (const dx of [-0.16, 0.16]) {
              for (const dz of [-0.16, 0.16]) {
                b.box(0.04, 1.55, 0.04, cx + dx, 0.85 + 0.77, cz + dz, b.metal);
              }
            }
          });
        }
      }
      // Sand pile, brick pallets, and orange cement mixer in the front yard; thatch bundles and a timber stack before
      b.tone(SAND_BUFF, 1.9, 0.65, 1.5, -W / 2 + 1.4, 0.36, front - 1.1, b.stone);
      if (old) {
        b.tone(bamboo ? SITE.stack.bamboo : SITE.stack.timber, 1.2, 0.5, 0.9, W / 2 - 1.4, 0.3, front - 1.1, b.wood);
        return;
      }
      b.tone(0x8a6e4e, 1.1, 0.12, 1.1, W / 2 - 1.4, 0.51, front - 1.1);
      b.tone(BRICK_RED, 0.95, 0.62, 0.95, W / 2 - 1.4, 0.88, front - 1.1);
      // Cement mixer drum
      b.colored(0xd96b27, () => b.cylinder(0.42, 0.78, 0.8, 0.95, front - 1.05, b.metal, 8, 0.4));
      b.tone(0x3a3f40, 0.75, 0.5, 0.65, 0.8, 0.7, front - 1.05, b.metal);
    });
    return { floors: 1, constructionStage: 'stage_1', targetLevel: level };
  }

  // Stage 2: Rising concrete frame + scaffolding + green safety netting + tower crane (for level >= 3)
  const frameTop = wrap ? 0.45 + targetFloors * storey : 0.45 + frameFloors * storey;
  const bw = wrap ? W + 0.4 : W - 1.0;
  const bd = wrap ? D + 0.4 : D - 1.0;

  b.feature('concrete-frame-and-scaffolding', () => {
    // Structural core & floor slabs
    if (!old && !wrap) b.body(SITE.concreteDark, bw * 0.42, frameTop, bd * 0.42, 0, 0.45, zc, 0.12);
    for (let f = 1; f <= (wrap ? 0 : frameFloors); f++) {
      const y = 0.45 + f * storey;
      b.tone(SLAB, bw, 0.22, bd, 0, y - 0.11, zc, old ? b.wood : b.stone);
    }
    // Perimeter concrete columns
    const cols = footprint[0] > 1 ? [-bw / 2 + 0.25, -bw / 6, bw / 6, bw / 2 - 0.25] : [-bw / 2 + 0.22, 0, bw / 2 - 0.22];
    const rows = [zc - bd / 2 + 0.22, zc, zc + bd / 2 - 0.22];
    if (!wrap) b.colored(FRAME, () => {
      for (const cx of cols) {
        for (const cz of rows) {
          b.box(0.32, frameTop + 0.7, 0.32, cx, 0.45 + (frameTop + 0.7) / 2, cz, b.stone);
        }
      }
    });
    // Green safety dust netting (ตาข่ายกันฝุ่นสีเขียว) wrapping the upper scaffolding, from the factory town on
    const netBottom = Math.max(0.6, frameTop * 0.32);
    const netH = frameTop + 0.6 - netBottom;
    for (const side of old ? [] : [-1, 1]) {
      b.tone(SAFETY_GREEN, bw + 0.36, netH, 0.04, 0, netBottom + netH / 2, zc + side * (bd / 2 + 0.2), b.fabric);
      b.tone(SAFETY_GREEN, 0.04, netH, bd + 0.36, side * (bw / 2 + 0.2), netBottom + netH / 2, zc, b.fabric);
    }
    // Scaffolding standards & ledgers: bamboo, timber, then steel
    b.colored(old ? POLE : SITE.steelPole, () => {
      for (const cx of cols) {
        for (const side of [-1, 1]) {
          b.box(0.05, frameTop + 0.9, 0.05, cx, 0.45 + (frameTop + 0.9) / 2, zc + side * (bd / 2 + 0.24), b.metal);
        }
      }
      for (let y = 1.8; y <= frameTop + 0.6; y += 1.6) {
        for (const side of [-1, 1]) {
          b.box(bw + 0.48, 0.04, 0.04, 0, y, zc + side * (bd / 2 + 0.24), b.metal);
        }
      }
    });
  });

  if (level >= 3 && !old && !wrap) {
    b.feature('tower-crane', () => {
      const mastH = frameTop + 4.8;
      const cx = bw * 0.22;
      const cz = zc - bd * 0.15;
      // Yellow crane mast, operator cab, horizontal jib, and counterweight
      b.tone(CRANE_YELLOW, 0.55, mastH, 0.55, cx, mastH / 2 + 0.2, cz, b.metal);
      b.tone(0x2d3234, 0.85, 0.9, 0.85, cx, mastH - 0.3, cz, b.metal);
      const jibLen = Math.min(span * 0.78, 7.2);
      b.tone(CRANE_YELLOW, 0.38, 0.38, jibLen, cx, mastH + 0.35, cz + jibLen * 0.18, b.metal);
      // Counterweight block at back of jib
      b.tone(0x585c5e, 0.68, 0.65, 1.1, cx, mastH + 0.15, cz - jibLen * 0.28, b.stone);
      // Hoist cable and hook block
      const hookZ = cz + jibLen * 0.52;
      b.colored(0x303436, () => {
        b.pole(point(cx, mastH + 1.4, cz), point(cx, mastH + 0.45, hookZ), 0.03, b.metal, 4);
        b.box(0.04, 2.2, 0.04, cx, mastH - 0.8, hookZ, b.metal);
      });
      b.tone(CRANE_YELLOW, 0.32, 0.36, 0.32, cx, mastH - 1.95, hookZ, b.metal);
    });
  }

  return { floors: frameFloors, constructionStage: 'stage_2', targetLevel: level, towerCrane: level >= 3 && !old, era, timber };
}
