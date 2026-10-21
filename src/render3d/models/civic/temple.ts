/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A temple (วัด, src/temples.ts, docs/GAME_DESIGN.md 9) as the program draws it: only until its era's model from
// Blender (art/buildings, temple_1..3) has loaded, or where none loads, so the city never shows a bare 3 × 3. On its
// civic 3 × 3 (from gameMap.civicKinds), variant = its level 1-3: the กำแพงแก้ว round its ground with a gate on its
// front (+Z), a sala, the ordination hall with its eight sema stones, and from level 2 a bell tower and a chedi, from 3
// a second hall. ช่อฟ้า as plain gold tips on the halls' gables, temple buildings only (CLAUDE.md rule 8); no Buddha
// image anywhere, no royal symbol. Its colours are the theme's (src/theme/tokens.ts).

import type { Group } from 'three';
import { RAMPS } from '../../../theme/tokens.js';
import { point } from '../../regional/geometry.js';
import type { ModelOptions } from '../registry.js';
import { PlotBuilder } from '../plot/builder.js';

export const TEMPLE_ID = 'civic.temple';
export const TEMPLE_LEVELS = [1, 2, 3] as const;

const TEMPLE_LABELS = {
  th: ['วัดหมู่บ้าน', 'วัดมีโบสถ์และหอระฆัง', 'วัดเต็มรูป'],
  en: ['Village temple', 'Temple with its ordination hall and bell tower', 'Full temple'],
} as const;

const C = {
  white: RAMPS.sand[50], wall: RAMPS.sand[100], coping: RAMPS.sand[300], ground: RAMPS.sand[200],
  roof: RAMPS.clay[500], roofEdge: RAMPS.rice[600], gold: RAMPS.gold[500], wood: RAMPS.clay[700],
  leaf: RAMPS.rice[600], trunk: RAMPS.sand[700], sema: RAMPS.sand[300],
} as const;

export function createTemple(options: ModelOptions = {}): Group {
  const level = Math.max(1, Math.min(3, Math.round(Number(options.variant ?? 1)) || 1));
  const b = new PlotBuilder({ ...options, seed: 0, variant: 0 }, 0);
  const half = 14.25, gate = 4;

  b.feature('ground-and-wall', () => {
    b.tone(C.ground, 2 * half, 0.06, 2 * half, 0, 0.03, 0, b.stone);
    const h = 1.1, run = (length: number, x: number, z: number, along: 'x' | 'z'): void => {
      b.tone(C.wall, along === 'x' ? length : 0.3, h, along === 'x' ? 0.3 : length, x, h / 2, z, b.paint);
      b.tone(C.coping, along === 'x' ? length : 0.42, 0.12, along === 'x' ? 0.42 : length, x, h + 0.06, z, b.paint);
    };
    const wing = half - gate / 2;
    for (const side of [-1, 1]) {
      run(wing, side * (gate / 2 + wing / 2), half, 'x');
      run(2 * half, side * half, 0, 'z');
      // the gate's posts
      b.tone(C.white, 0.7, 2.6, 0.7, side * (gate / 2 + 0.35), 1.3, half - 0.2, b.paint);
      b.tone(C.gold, 0.5, 0.5, 0.5, side * (gate / 2 + 0.35), 2.85, half - 0.2, b.paint);
    }
    run(2 * half, 0, -half, 'x');
  });

  /** A hall w wide (x) and d deep (z) at (x, z), its ridge front to back, its gables gold-tipped */
  const hall = (w: number, d: number, x: number, z: number, height: number): void => {
    b.tone(C.white, w + 1.2, 0.6, d + 1.2, x, 0.3, z, b.stone);
    b.tone(C.white, w, height, d, x, 0.6 + height / 2, z, b.paint);
    const base = 0.6 + height, rise = w * 0.55, slope = Math.atan2(rise, w / 2 + 0.8), run = Math.hypot(rise, w / 2 + 0.8);
    for (const side of [-1, 1]) {
      b.at(x + side * (w / 4 + 0.2), base + rise / 2, z, 0, () => b.tone(C.roof, run, 0.25, d + 2, 0, 0, 0, b.paint, -side * slope));
      b.tone(C.roofEdge, 0.2, 0.3, d + 2, x + side * (w / 2 + 0.8), base - 0.05, z, b.paint);
    }
    // the ridge and its gold tips: the ช่อฟ้า of a temple hall
    b.tone(C.gold, 0.3, 0.3, d + 2.2, x, base + rise, z, b.paint);
    for (const end of [-1, 1]) b.colored(C.gold, () => b.pole(point(x, base + rise, z + end * (d / 2 + 1.1)),
      point(x, base + rise + 1.4, z + end * (d / 2 + 1.6)), 0.12, b.paint, 4));
    // its door on the front
    b.tone(C.wood, 1.4, 2.4, 0.1, x, 0.6 + 1.2, z + d / 2 + 0.05, b.paint);
  };

  b.feature('ordination-hall', () => {
    const w = level === 1 ? 5 : 7, d = level === 1 ? 9 : 13, z = -3;
    hall(w, d, 0, z, level === 1 ? 3.2 : 4.2);
    // its eight sema stones round it
    for (const [sx, sz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      b.tone(C.sema, 0.5, 0.9, 0.2, sx * (w / 2 + 1.8), 0.45, z + sz * (d / 2 + 1.8), b.stone);
    }
  });

  b.feature('sala', () => {
    // an open hall on posts by the gate, its roof low and long
    const x = -8.4, z = 7.6, w = 7, d = 5;
    b.tone(C.wood, w, 0.4, d, x, 0.4, z, b.paint);
    for (const px of [-1, 1]) for (const pz of [-1, 1]) b.tone(C.wood, 0.25, 2.6, 0.25, x + px * (w / 2 - 0.2), 1.9, z + pz * (d / 2 - 0.2), b.paint);
    b.tone(C.roof, w + 1.4, 0.3, d + 1.4, x, 3.4, z, b.paint);
    b.tone(C.roof, w * 0.6, 0.7, d * 0.6, x, 3.9, z, b.paint);
  });

  b.feature('kuti', () => {
    for (let k = 0; k < (level === 1 ? 2 : 3); k++) {
      const x = 10 - k * 5, z = -11.2;
      b.tone(C.wood, 3.6, 2.6, 3, x, 1.3, z, b.paint);
      b.tone(C.roof, 4.2, 0.3, 3.6, x, 2.75, z, b.paint);
    }
  });

  b.feature('bodhi-tree', () => {
    b.tone(C.trunk, 0.8, 4, 0.8, 9.2, 2, 6.4, b.paint);
    b.tone(C.leaf, 6.4, 3.6, 6.4, 9.2, 5.6, 6.4, b.leaves);
  });

  if (level >= 2) {
    b.feature('chedi', () => {
      const x = 0, z = -11.6;
      let y = 0;
      for (const [r, h] of [[2.6, 1], [2, 0.8], [1.5, 2.4], [0.9, 0.8]] as const) {
        b.colored(C.white, () => b.cylinder(r, h, x, y + h / 2, z, b.paint, 12));
        y += h;
      }
      b.colored(C.gold, () => b.pole(point(x, y, z), point(x, y + 4.5, z), 0.45, b.paint, 8));
    });
    b.feature('bell-tower', () => {
      const x = 9.6, z = -3.2;
      for (const px of [-1, 1]) for (const pz of [-1, 1]) b.tone(C.white, 0.35, 4.2, 0.35, x + px * 1.1, 2.1, z + pz * 1.1, b.paint);
      b.tone(C.roof, 3.4, 0.3, 3.4, x, 4.4, z, b.paint);
      b.colored(C.gold, () => b.pole(point(x, 4.5, z), point(x, 6.2, z), 0.25, b.paint, 6));
      b.colored(C.gold, () => b.cylinder(0.45, 0.8, x, 3.4, z, b.paint, 8));
    });
  }
  if (level >= 3) b.feature('viharn', () => hall(6, 9, -9.4, -3, 3.8));

  const root = b.finishPlot(TEMPLE_ID, 'services', 'R2', level, { th: TEMPLE_LABELS.th, en: TEMPLE_LABELS.en },
    { temple: true, templeLevel: level }, [3, 3]);
  root.userData.variantLabel = TEMPLE_LABELS.th[level - 1];
  root.userData.variantLabelEn = TEMPLE_LABELS.en[level - 1];
  return root;
}
