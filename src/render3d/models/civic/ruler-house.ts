/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's seat (docs/RULER_HOUSE.md, RENDERER_SPEC 6H), drawn as the town's government office compound: a district
// office (ที่ว่าการอำเภอ) that grows into a provincial-style government centre. Six levels (variant) and up to eight
// annexes (state) on one 3×3. No palace or temple ornament, no royal or religious symbol, no coat of arms or real
// agency emblem: a generic Thai sign and the plain national flag that MODEL_SPEC 6 allows on government buildings.

import { CylinderGeometry, Object3D } from 'three';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { CivicBuilder, LATERITE, PAVING, STONE, shade, spread } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const RULER_HOUSE_ID = 'civic.ruler_house';
export const RULER_HOUSE_LEVELS = [1, 2, 3, 4, 5, 6] as const;
/** The wings of src/rulerHouse.ts (WINGS), in the same order. */
export const RULER_HOUSE_WINGS = ['council_hall', 'treasury', 'planning_office', 'warning_tower', 'granary',
  'culture_court', 'front_garden', 'trade_office'] as const;
export type RulerHouseWing = typeof RULER_HOUSE_WINGS[number];

const LEVEL_NAMES = ['ที่ว่าการอำเภอเรือนไม้', 'ที่ว่าการอำเภอสองชั้น', 'อาคารที่ว่าการ', 'ศูนย์ราชการ',
  'ศูนย์ราชการและหอประชุม', 'ศูนย์ราชการและลานเมือง'];
const LEVEL_NAMES_EN = ['Timber district office', 'Two-storey district office', 'Government building', 'Government centre',
  'Government centre and meeting hall', 'Government centre and town plaza'];
/** The generic sign over the entrance; no coat of arms. */
export const RULER_HOUSE_SIGN = 'ที่ว่าการอำเภอ';
const DARK = 0x2e2822;

/** The compound's level from options.variant: 1–6, anything else clamped (1 when missing). */
export function rulerHouseLevel(variant?: number): number {
  return typeof variant === 'number' && Number.isFinite(variant) ? Math.min(6, Math.max(1, Math.round(variant))) : 1;
}

/** The wings in options.state: ids in any order and separator; unknown ids and repeats are ignored. */
export function parseRulerWings(state?: string): RulerHouseWing[] {
  const ids = new Set(String(state ?? '').toLowerCase().split(/[^a-z_]+/).filter(Boolean));
  return RULER_HOUSE_WINGS.filter(id => ids.has(id));
}

/** Every annex keeps its own plot at every level, around the office's core (x ±9.3, z −14.2…6.9). */
const SLOTS: Readonly<Record<RulerHouseWing, readonly [number, number]>> = {
  treasury: [11.85, -11.5], granary: [-11.9, -11.2], planning_office: [-11.9, -4.3], trade_office: [11.9, -4.3],
  warning_tower: [-12, 11.3], council_hall: [11.55, 11], culture_court: [5.2, 10.6], front_garden: [-5.2, 10.6],
};

const REGION_PROP: Readonly<Record<string, string>> = { north: 'paper_umbrella', northeast: 'bamboo_daybed',
  central: 'spirit_house', east: 'fruit_crates', west: 'palm_sugar_pots', south: 'dove_cage_pole' };

function path(b: CivicBuilder, z0: number, z1: number, width: number, color: number, x = 0, top = 0.115): void {
  if (z1 - z0 > 0.05) b.bx(b.stone, color, width, 0.05, z1 - z0, x, top - 0.025, (z0 + z1) / 2);
}

/** A garden tree of the region; a full one gets a second, offset crown. */
function tree(b: CivicBuilder, i: number, x: number, z: number, height: number, radius: number, full = false): void {
  b.plant(b.species(i), x, z, height, radius, i + 11);
  if (full) b.plant(b.species(i), x + 0.25, z - 0.2, height * 0.82, radius * 0.85, i + 61);
}

function regionalProp(b: CivicBuilder, x: number, z: number): void {
  b.feature('regional-prop', () => b.prop(REGION_PROP[b.kit.id], x, z, 0.9, b.kit.id === 'central' ? Math.PI : 0));
}

/** A small roofed notice board (ป้ายประกาศ) with papers pinned on it, facing local +Z. */
function noticeBoard(b: CivicBuilder, x: number, z: number, yaw: number): void {
  b.feature('notice-board', () => b.at(x, z, yaw, () => {
    b.colored(b.timber, () => { for (const s of [-1, 1]) b.box(0.1, 2, 0.1, s * 0.85, 1.06, 0, b.wood); });
    b.bx(b.wood, shade(b.timber, -0.05), 1.9, 1.05, 0.08, 0, 1.4, 0);
    b.colored(0xf3efe2, () => { for (let i = 0; i < 4; i++) b.box(0.36, 0.48, 0.02, -0.6 + i * 0.4, 1.4 + (i % 2 ? 0.12 : -0.08), 0.05, b.paint); });
    b.bx(b.wood, b.timber, 2.1, 0.08, 0.42, 0, 2.08, 0);
  }));
}

function bench(b: CivicBuilder, x: number, z: number, yaw = 0, y = 0.06): void {
  b.at(x, z, yaw, () => b.colored(shade(b.timber, 0.05), () => {
    b.box(1.6, 0.07, 0.42, 0, 0.5, 0, b.wood);
    b.box(1.6, 0.36, 0.06, 0, 0.75, -0.2, b.wood);
    for (const s of [-1, 1]) b.box(0.07, 0.44, 0.4, s * 0.7, 0.28, 0, b.wood);
  }), y - 0.06);
}

/** Paved bays with cars and motorbikes parked nose in (toward −Z). */
function parking(b: CivicBuilder, x0: number, x1: number, z0: number, z1: number, cars: readonly number[], bikes: readonly number[],
  surface = 0x8f8d86): void {
  b.feature('parking', () => {
    const z = (z0 + z1) / 2, colors = [0xe8e6df, 0x9aa3a8, 0x7a2c2a, 0x2b3f5a, 0x5d6b4a];
    b.bx(b.stone, surface, x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0.085, z);
    b.colored(0xeeeeea, () => { for (const x of cars) for (const s of [-1, 1]) b.box(0.08, 0.02, 4.6, x + s * 1.18, 0.12, z, b.paint); });
    cars.forEach((x, i) => b.parkedCar(x, z, colors[(i + b.seed) % colors.length], Math.PI));
    bikes.forEach((x, i) => b.parkedBike(x, z + (i % 2 - 0.5) * 1.1, [0xb33a2e, 0x2f5f8a, 0x2a2a2a][(i + b.seed) % 3], Math.PI));
  });
}

// --- Boundaries --------------------------------------------------------------------------------------------------

function fence(b: CivicBuilder, level: number): void {
  b.feature('fence', () => {
    const e = 14.1, h = 1.05, color = shade(b.timber, 0.04);
    const run = (length: number, x: number, z: number, yaw: number): void => b.at(x, z, yaw, () => {
      if (level >= 3) b.bx(b.stone, STONE, length, 0.24, 0.3, 0, 0.12, 0);
      b.colored(color, () => {
        for (const y of level >= 3 ? [0.55, h - 0.08] : [0.45, h - 0.08]) b.box(length, 0.08, 0.07, 0, y, 0, b.wood);
        for (const px of spread(length, 3.2, 0.06)) b.box(0.12, h, 0.12, px, h / 2, 0, b.wood);
      });
    });
    for (const side of [-1, 1]) run(12.5, side * 7.85, e, 0);
    if (level >= 2) for (const side of [-1, 1]) run(28.2, side * e, 0, Math.PI / 2);
    if (level >= 3) run(28.2, 0, -e, 0);
  });
}

/** Gateposts at the entrance of the fence, each carrying a lantern. */
function gateposts(b: CivicBuilder, masonry: boolean): void {
  b.feature('gateposts', () => {
    for (const side of [-1, 1]) {
      if (masonry) b.bx(b.paint, b.masonry, 0.5, 1.4, 0.5, side * 1.55, 0.7, 13.95);
      else b.bx(b.wood, b.timber, 0.22, 1.3, 0.22, side * 1.55, 0.65, 13.95);
      b.lantern(side * 1.55, 13.95, 0.16, masonry ? 1.4 : 1.3);
    }
  });
}

/** A low plastered wall with pilasters round the compound. */
function perimeterWall(b: CivicBuilder): void {
  b.feature('perimeter-wall', () => {
    const e = 14.1, h = 1.3, t = 0.26;
    const run = (length: number, x: number, z: number, yaw: number): void => b.at(x, z, yaw, () => {
      b.bx(b.paint, b.masonry, length, h, t, 0, h / 2, 0);
      b.bx(b.stone, STONE, length + 0.08, 0.1, t + 0.12, 0, h + 0.05, 0);
      b.colored(shade(b.masonry, -0.06), () => {
        for (const px of spread(length, 4.8, 0.2)) b.box(0.42, h + 0.16, 0.42, px, (h + 0.16) / 2, 0, b.paint);
      });
      b.colored(STONE, () => { for (const px of spread(length, 4.8, 0.2)) b.box(0.52, 0.09, 0.52, px, h + 0.2, 0, b.stone); });
    });
    for (const side of [-1, 1]) run(11.6, side * 8.43, e, 0);
    run(28.46, 0, -e, 0);
    for (const side of [-1, 1]) run(27.94, side * e, 0, Math.PI / 2);
  });
}

/** Two plastered pillars, a lintel with the sign and a small regional roof; the leaves stand folded open. */
function gate(b: CivicBuilder): void {
  b.feature('gate', () => {
    const z = 13.75;
    for (const side of [-1, 1]) {
      b.bx(b.paint, b.masonry, 0.7, 2.9, 0.7, side * 2.25, 1.45, z);
      b.bx(b.stone, STONE, 0.84, 0.14, 0.84, side * 2.25, 2.97, z);
      b.lantern(side * 2.25, z, 0.18, 3.04);
      b.bx(b.wood, shade(b.timber, -0.08), 1.65, 2.2, 0.08, side * 2.8, 1.18, z - 0.48);
    }
    b.bx(b.wood, b.timber, 5.2, 0.32, 0.36, 0, 2.86, z);
    b.at(0, z, 0, () => b.roofOver(5, 1, 3.05, { overhang: 0.15, pitch: Math.min(35, b.kit.defaults.pitch), fill: b.colors.trim }));
    b.label(RULER_HOUSE_SIGN, 2.7, 0.5, 0, 2.43, z + 0.21);
  });
}

// --- Level 1: the old timber district office ---------------------------------------------------------------------

/** One raised storey of regional timber under the region's roof, a veranda across the front (a lean-to เกย in the
 * northeast and west), benches for visitors and the sign on the veranda beam. */
function timberOffice(b: CivicBuilder): void {
  const f = b.form, cz = -6.2, w = 9.6, d = 5, floor = Math.min(f.floor, 1.3), h = 2.8, v = 2.2;
  const deck = floor - f.drop, top = floor + h;
  let front = 0;
  b.feature('district-office', () => b.at(0, cz, 0, () => {
    b.at(0, v / 2, 0, () => b.posts(w, d + v, floor));
    b.bx(b.wood, b.timber, w + 0.24, 0.16, d + 0.24, 0, floor - 0.08, 0);
    b.bx(b.wood, shade(b.timber, 0.04), w + 0.24, 0.14, v, 0, deck - 0.07, d / 2 + v / 2);
    b.storey(w, d, floor, h, false);
    b.door(0, floor, d / 2 + 0.02, 0, 1.7, 2.2);
    for (const x of [-3.4, -1.9, 1.9, 3.4]) b.window(x, floor + 1.45, d / 2 + 0.02, 0, 0.9, 1.2, true);
    for (const side of [-1, 1]) b.window(side * (w / 2 + 0.02), floor + 1.45, 0, side * Math.PI / 2, 0.9, 1.2, true);
    for (const x of [-2.8, 0, 2.8]) b.window(x, floor + 1.45, -d / 2 - 0.02, Math.PI);
    if (f.lean) {
      b.roofOver(w, d, top, { ridge: 'x' });
      b.leanTo(w, v, top - 0.12, d / 2, deck);
      b.label(RULER_HOUSE_SIGN, 2.6, 0.38, 0, floor + 2.58, d / 2 + 0.1);
    } else {
      b.colored(b.timber, () => {
        for (const x of spread(w, 2.4, 0.15)) b.box(0.2, top - deck, 0.2, x, deck + (top - deck) / 2, d / 2 + v - 0.15, b.wood);
        b.box(w, 0.24, 0.22, 0, top - 0.12, d / 2 + v - 0.15, b.wood);
      });
      b.at(0, v / 2, 0, () => b.roofOver(w, d + v, top, { ridge: 'x' }));
      b.label(RULER_HOUSE_SIGN, 3.6, 0.58, 0, top - 0.6, d / 2 + v - 0.02);
    }
    b.railing(w, deck, d / 2 + v - 0.06);
    for (const side of [-1, 1]) {
      bench(b, side * 3.2, d / 2 + 0.45, Math.PI, deck);
      b.potted(side * (w / 2 - 0.45), d / 2 + v - 0.5, deck, 0.8);
    }
    front = cz + b.stairs(1.8, deck, 0, d / 2 + v);
  }));
  b.feature('path', () => path(b, front, 14.2, 1.6, LATERITE));
  b.feature('flagpole', () => b.flag(-3, 1.6, 8));
  noticeBoard(b, 2.6, 1.4, -Math.PI / 2);
  parking(b, 4.6, 9, 0.8, 5.6, [6.1], [7.9, 8.4], LATERITE);
  regionalProp(b, -6.8, -2.8);
  b.feature('trees', () => {
    tree(b, 0, -7.4, -10.8, 6.2, 1.7, true); tree(b, 1, 7.4, -10.6, 5.8, 1.6, true);
    tree(b, 2, -7.4, 1.4, 5, 1.3); tree(b, 3, -6.6, 5.8, 4.6, 1.1); bench(b, -5, 3.4);
  });
  fence(b, 1);
  gateposts(b, false);
}

// --- Level 2: a two-storey timber-and-masonry office -------------------------------------------------------------

/** A plastered ground floor under a regional timber upper floor, a two-storey porch (มุข) with the sign, pent roofs,
 * louvred windows, and a ramp beside the steps. Returns the z its steps reach (local). */
function masonryOffice(b: CivicBuilder): number {
  const f = b.form, w = 12, d = 6.6, p = 0.45, g = 3, u = 2.8, y1 = p + g, upper = y1 + 0.12, top = upper + u;
  b.bx(b.stone, STONE, w + 0.5, p, d + 0.5, 0, p / 2, 0);
  b.bx(b.paint, b.masonry, w, g, d, 0, p + g / 2, 0);
  b.bx(b.wood, b.timber, w + 0.3, 0.2, d + 0.3, 0, y1 + 0.02, 0);
  b.storey(w, d, upper, u, f.arcade, false);
  const xs = [3.3, 4.75];
  for (const x of xs) for (const side of [-1, 1]) {
    b.window(side * x, p + 1.6, d / 2, 0, 0.9, 1.15, true);
    b.window(side * x, upper + 1.45, d / 2 + 0.02, 0, 0.9, 1.15, true);
    if (f.arcade) b.take(b.adopt(b.kit.ornaments.pediment({ width: 1.1, seed: b.seed, color: b.colors.trim })), side * x, upper + 2.1, d / 2 + 0.06);
  }
  for (const x of [-3.6, 0, 3.6]) {
    b.window(x, p + 1.6, -d / 2, Math.PI);
    b.window(x, upper + 1.45, -d / 2 - (f.arcade ? 0 : 0.02), Math.PI);
  }
  for (const side of [-1, 1]) for (const z of [-1.5, 1.5]) {
    b.window(side * w / 2, p + 1.6, z, side * Math.PI / 2);
    b.window(side * w / 2 + side * 0.02, upper + 1.45, z, side * Math.PI / 2);
  }
  if (f.arcade) for (const side of [-1, 1]) {
    b.take(b.adopt(b.kit.ornaments.arch({ width: 2.2, height: 1.9, seed: b.seed })), side * 4.05, p, d / 2 + 0.12);
  }
  for (const side of [-1, 1]) {
    b.at(side * w / 2, 0, side * Math.PI / 2, () => b.pentRoof(d - 0.6, y1 - 0.06, 0));
    b.at(side * 4.05, 0, 0, () => b.pentRoof(3.1, y1 - 0.06, d / 2));
  }
  b.roofOver(w, d, top, f.twin ? { twin: true } : { ridge: 'x' });
  const pw = 4.4, pd = 3;
  b.feature('porch', () => b.at(0, d / 2 + pd / 2, 0, () => {
    b.bx(b.stone, STONE, pw + 0.5, p, pd + 0.1, 0, p / 2, 0.05);
    b.colored(b.masonry, () => {
      for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.36, g, 0.36, x * (pw / 2 - 0.22), p + g / 2, z * (pd / 2 - 0.22), b.paint);
    });
    if (f.arcade) b.take(b.adopt(b.kit.ornaments.arch({ width: pw - 0.8, height: 1.8, seed: b.seed })), 0, p, pd / 2 - 0.22);
    b.bx(b.wood, b.timber, pw + 0.3, 0.22, pd + 0.15, 0, y1 + 0.02, 0.07);
    if (f.fret) {
      b.colored(b.timber, () => {
        for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.18, u, 0.18, x * (pw / 2 - 0.15), upper + u / 2, z * (pd / 2 - 0.15), b.wood);
      });
      b.take(b.adopt(b.kit.ornaments.fretwork({ width: pw - 0.4, height: 0.9, seed: b.seed, detail: 'low', color: b.colors.trim })), 0, upper, pd / 2 - 0.1);
    } else {
      b.storey(pw, pd, upper, u, f.arcade, false);
      for (const side of [-1, 1]) b.window(side * 1, upper + 1.6, pd / 2 + 0.02);
    }
    b.label(RULER_HOUSE_SIGN, 3.6, 0.55, 0, upper + 0.42, pd / 2 + 0.1);
    b.roofOver(pw, pd, top, { form: f.roof });
  }));
  b.door(0, p, d / 2 + pd, 0, 1.4, 2.3);
  for (const side of [-1, 1]) b.potted(side * 1.85, d / 2 + pd - 0.3, p, 1.1);
  b.ramp(1.2, p, 3.15, d / 2 + 0.26);
  return b.stairs(2.4, p, 0, d / 2 + pd + 0.1, b.stone, STONE);
}

function masonryLevel(b: CivicBuilder): void {
  const cz = -8.6;
  let front = 0;
  b.feature('district-office', () => b.at(0, cz, 0, () => { front = cz + masonryOffice(b); }));
  b.feature('path', () => { path(b, front, 14.2, 2, PAVING); b.bx(b.stone, PAVING, 2.8, 0.05, 1, 2.35, 0.09, -0.95); });
  b.feature('flagpole', () => b.flag(-3.3, 0.8, 8.5));
  noticeBoard(b, -6, 1.8, 0);
  parking(b, 4.2, 9.1, 0.4, 5.6, [5.4, 7.75], []);
  regionalProp(b, -7.8, -3.4);
  b.feature('trees', () => {
    tree(b, 0, -8.2, -10.8, 5.6, 1.1, true); tree(b, 1, 8.2, -10.6, 5.4, 1.1, true);
    tree(b, 2, -7.4, 4, 5, 1.3); tree(b, 3, 7.4, -2.6, 4.6, 1.1); bench(b, -4.4, 3.8);
  });
  fence(b, 2);
  gateposts(b, false);
}

// --- Levels 3–6: the concrete government building and its centre ------------------------------------------------

const P = 0.6, G = 3.6, U = 3.3;

/** A plastered concrete block with window bands on every storey and the kit's civic crown on top; local front +Z. */
function officeBlock(b: CivicBuilder, w: number, d: number, storeys: number, spec: { ridge?: 'x' | 'z'; groundFront?: readonly (readonly [number, number])[]; back?: boolean } = {}): void {
  const height = G + U * (storeys - 1), top = P + height;
  b.bx(b.stone, STONE, w + 0.6, P, d + 0.6, 0, P / 2, 0);
  b.bx(b.paint, b.masonry, w, height, d, 0, P + height / 2, 0);
  b.colored(shade(b.masonry, -0.06), () => {
    for (let s = 1; s < storeys; s++) b.box(w + 0.14, 0.2, d + 0.14, 0, P + G + (s - 1) * U, 0, b.paint);
  });
  b.bx(b.paint, shade(b.masonry, 0.04), w + 0.3, 0.32, d + 0.3, 0, top + 0.16, 0);
  for (let s = 0; s < storeys; s++) {
    const y = s === 0 ? P + 1.75 : P + G + (s - 1) * U + 1.6;
    for (const [x, width] of s === 0 && spec.groundFront ? spec.groundFront : [[0, w - 1.4] as const]) b.windowBand(width, x, y, d / 2);
    if (spec.back !== false) b.windowBand(w - 1.4, 0, y, -d / 2, Math.PI);
    for (const side of [-1, 1]) b.windowBand(d - 1.4, side * w / 2, y, 0, side * Math.PI / 2);
    if (s > 0) {
      const base = P + G + (s - 1) * U;
      for (const side of [-1, 1]) b.condenser(side * w / 2, base + 0.45, side * (s % 2 ? 1.2 : -1.2), side * Math.PI / 2);
      if (spec.back !== false) for (const x of [-w / 4, w / 4]) b.condenser(x + (s % 2 ? 0.8 : -0.8), base + 0.45, -d / 2, Math.PI);
    }
  }
  b.roofOver(w, d, top + 0.32, { civic: true, ridge: spec.ridge ?? 'x', overhang: 0.45 });
}

/** The front portico: tall columns, an entablature carrying the sign, a civic gable; steps and a ramp. */
function portico(b: CivicBuilder, d: number): void {
  const f = b.form, pw = 6.4, pd = 2.8, colH = 7.2;
  b.feature('portico', () => b.at(0, d / 2 + pd / 2, 0, () => {
    b.bx(b.stone, STONE, pw + 0.6, P, pd + 0.2, 0, P / 2, 0.1);
    b.colored(shade(b.masonry, 0.05), () => {
      for (const t of [-1, -1 / 3, 1 / 3, 1]) {
        const x = t * (pw / 2 - 0.3);
        b.cylinder(0.27, colH - P, x, P + (colH - P) / 2, pd / 2 - 0.3, b.paint, 12);
        b.box(0.72, 0.3, 0.72, x, P + 0.15, pd / 2 - 0.3, b.paint);
        b.box(0.72, 0.26, 0.72, x, colH - 0.13, pd / 2 - 0.3, b.paint);
      }
      for (const s of [-1, 1]) b.box(0.5, colH - P, 0.3, s * (pw / 2 - 0.3), P + (colH - P) / 2, -pd / 2 + 0.15, b.paint);
    });
    if (f.arcade) b.take(b.adopt(b.kit.ornaments.arch({ width: 2.4, height: 3.4, seed: b.seed })), 0, P, pd / 2 - 0.3);
    b.bx(b.paint, shade(b.masonry, 0.04), pw + 0.2, 0.6, pd + 0.1, 0, colH + 0.3, 0.05);
    b.label(RULER_HOUSE_SIGN, 4.6, 0.6, 0, colH + 0.3, pd / 2 + 0.13, 0, 0xf4efe0, 0x5b3f1c);
    b.roofOver(pw, pd + 0.4, colH + 0.6, { civic: true, overhang: 0.35 });
    b.door(0, P, -pd / 2 + 0.02, 0, 2.6, 2.7);
    for (const side of [-1, 1]) b.potted(side * 2.2, pd / 2 - 0.1, P, 1.2);
  }));
  b.stairs(3.4, P, 0, d / 2 + pd + 0.1, b.stone, STONE);
  b.ramp(1.3, P, 3.9, d / 2 + 0.3);
}

/** Level 4: two-storey wings round the front court, each with a covered walk on its court side. */
function sideWing(b: CivicBuilder, side: number): void {
  const w = 4, d = 6.2;
  officeBlock(b, w, d, 2, { ridge: 'z', back: false, groundFront: [[0, 2.4]] });
  b.at(-side * w / 2, 0, -side * Math.PI / 2, () => {
    b.pentRoof(d - 0.6, P + G - 0.15, 0);
    b.door(0.4, P, 0.02, 0, 1.6, 2.4);
  });
}

/** Level 5: the meeting hall (หอประชุม), one tall storey with an entrance canopy; local front +Z. */
function meetingHall(b: CivicBuilder): void {
  const w = 5.2, d = 5, h = 4.6;
  b.bx(b.stone, STONE, w + 0.6, P, d + 0.6, 0, P / 2, 0);
  b.bx(b.paint, b.masonry, w, h, d, 0, P + h / 2, 0);
  b.bx(b.paint, shade(b.masonry, 0.04), w + 0.3, 0.3, d + 0.3, 0, P + h + 0.15, 0);
  for (const side of [-1, 1]) b.windowBand(d - 1.2, side * w / 2, P + 2.4, 0, side * Math.PI / 2, 2.6, 1.3);
  b.windowBand(w - 1.2, 0, P + 2.4, -d / 2, Math.PI, 2.6, 1.3);
  b.door(0, P, d / 2 + 0.02, 0, 1.8, 2.6);
  for (const side of [-1, 1]) b.window(side * 1.75, P + 2, d / 2 + 0.02, 0, 0.8, 1.9, true);
  b.pentRoof(3.6, P + 3.3, d / 2);
  b.label('หอประชุม', 2.4, 0.45, 0, P + 3.75, d / 2 + 0.08);
  b.roofOver(w, d, P + h + 0.3, { civic: true, overhang: 0.4 });
  b.stairs(2.6, P, 0, d / 2 + 0.1, b.stone, STONE);
  for (const side of [-1, 1]) b.lantern(side * 1.8, d / 2 + 0.6, 1.9);
}

/** The drive loop round a round lawn with the flagpole; at level 6 the lawn becomes a fountain in a plaza. */
function frontDrive(b: CivicBuilder, level: number): void {
  const cz = 3, plaza = level >= 6;
  b.feature('drive', () => {
    b.colored(plaza ? 0xd8cfbb : PAVING, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i + 0.5) / 16 * Math.PI * 2;
        b.at(Math.sin(a) * 2.52, cz + Math.cos(a) * 2.52, a, () => b.box(1.05, 0.05, 1.56, 0, 0.09, 0, b.stone));
      }
    });
    path(b, cz + 3.25, level >= 4 ? 13.4 : 14.2, 2.4, PAVING);
    b.colored(shade(STONE, -0.05), () => {
      for (const side of [-1, 1]) b.box(0.14, 0.12, (level >= 4 ? 13.4 : 14.2) - cz - 3.3, side * 1.27, 0.12, (cz + 3.3 + (level >= 4 ? 13.4 : 14.2)) / 2, b.stone);
    });
    for (const side of [-1, 1]) b.lantern(side * 1.55, 9.6, 2.3);
  });
  if (!plaza) {
    b.feature('island', () => {
      b.colored(STONE, () => b.cylinder(1.75, 0.2, 0, 0.1, cz, b.stone, 20));
      b.cylinder(1.6, 0.06, 0, 0.21, cz, b.grass, 20);
      b.colored(0xd2577d, () => { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.box(0.2, 0.14, 0.2, Math.sin(a) * 1.3, 0.3, cz + Math.cos(a) * 1.3, b.paint); } });
      b.flag(0, cz, 9);
    });
    return;
  }
  b.feature('plaza', () => {
    b.colored(STONE, () => {
      b.cylinder(1.8, 0.5, 0, 0.25, cz, b.stone, 20);
      b.cylinder(0.3, 1.1, 0, 0.75, cz, b.stone, 10);
      b.cylinder(0.78, 0.14, 0, 1.3, cz, b.stone, 16);
    });
    b.cylinder(1.58, 0.05, 0, 0.47, cz, b.water(), 20);
    b.cylinder(0.66, 0.04, 0, 1.38, cz, b.water(), 16);
    b.cylinder(0.07, 0.7, 0, 1.75, cz, b.water(), 6);
    b.jets.push(point(0, 2.1, cz));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = x * 2.79, pz = cz + z * 2.79;
      b.colored(STONE, () => b.cylinder(0.7, 0.45, px, 0.27, pz, b.stone, 12));
      tree(b, 4 + (x + 1) + (z + 1) / 2, px, pz, 4.4, 0.95);
    }
    for (const side of [-1, 1]) for (const z of [-0.6, 6.6]) b.lantern(side * 1.6, z, 2.2);
    b.flag(-2.6, -1.9, 9);
  });
}

function governmentCentre(b: CivicBuilder, level: number): void {
  const cz = -10.3, w = 15, d = 6.6;
  b.feature('government-building', () => b.at(0, cz, 0, () => {
    officeBlock(b, w, d, 3, { groundFront: [[-5.25, 3.3], [5.25, 3.3]] });
    portico(b, d);
  }));
  if (level >= 4) for (const side of [-1, 1]) b.feature('office-wing', () => b.at(side * 7, -3.9, 0, () => sideWing(b, side)));
  b.feature('planting', () => {
    if (level < 4) for (const x of [-5.6, 6.1]) b.at(x, cz + d / 2 + 0.75, 0, () => b.take(b.kit.gardenPlant('hedge', { seed: b.seed + x })));
    else {
      for (const z of [-5.6, -3.9, -2.2]) b.potted(-4.35, z, 0.11, 1);
      for (const z of [-2.9, -1.3]) b.potted(2.65, z, 0.11, 1);
    }
  });
  if (level >= 5) b.feature('meeting-hall', () => b.at(-6.4, 3.2, Math.PI / 2, () => meetingHall(b)));
  b.feature('forecourt', () => {
    const half = level >= 4 ? 4.7 : 3.2;
    b.bx(b.stone, PAVING, half * 2, 0.05, 3.5, 0, 0.085, -2);
  });
  frontDrive(b, level);
  parking(b, 3.9, 13.6, 0.4, 6.4, level >= 4 ? [5.1, 7.4, 9.7, 12] : [5.1, 7.4, 9.7], [12.9, 13.3].slice(level >= 4 ? 1 : 0));
  if (level < 5) {
    noticeBoard(b, -4.2, 1.2, Math.PI / 2);
    b.feature('lawn', () => { bench(b, -6.6, 4.6); tree(b, 3, -7.4, 1.6, 5.4, 1.4, true); tree(b, 2, -11.2, 4.4, 5, 1.3); });
  } else {
    noticeBoard(b, -10.6, 1.4, Math.PI / 2);
    b.feature('lawn', () => tree(b, 2, -11.4, 4.6, 5, 1.3));
  }
  regionalProp(b, -12.8, 7.2);
  b.feature('trees', () => {
    tree(b, 0, -8.8, -12.6, 5.4, 0.95, true); tree(b, 1, 8.8, -12.6, 5.4, 0.95, true);
    if (level < 4) { tree(b, 5, -8.6, -5.6, 5, 1.1); tree(b, 4, 8.6, -5.6, 5, 1.1); }
  });
  if (level >= 4) { perimeterWall(b); gate(b); } else { fence(b, 3); gateposts(b, true); }
}

// --- Annexes (ส่วนต่อเติม), each on its own plot, front +Z --------------------------------------------------------------

/** council_hall: an open meeting pavilion (ศาลาประชุม) under the civic crown, benches round a table. */
function councilHall(b: CivicBuilder): void {
  const w = 4.6, d = 4.4, p = 0.5, h = 2.7;
  b.bx(b.stone, STONE, w, p, d, 0, p / 2, 0);
  b.bx(b.wood, b.timber, w - 0.3, 0.08, d - 0.3, 0, p + 0.04, 0);
  b.colored(b.timber, () => {
    for (const x of [-1, 0, 1]) for (const z of [-1, 1]) b.box(0.2, h, 0.2, x * (w / 2 - 0.25), p + h / 2, z * (d / 2 - 0.25), b.wood);
  });
  b.colored(shade(b.timber, 0.06), () => {
    b.box(w - 0.9, 0.45, 0.45, 0, p + 0.23, -d / 2 + 0.6, b.wood);
    for (const side of [-1, 1]) b.box(0.45, 0.45, d - 1.6, side * (w / 2 - 0.6), p + 0.23, 0.1, b.wood);
  });
  b.bx(b.wood, shade(b.timber, -0.1), 1.6, 0.75, 0.9, 0, p + 0.38, 0.1);
  for (const side of [-1, 1]) {
    b.bx(b.wood, DARK, 0.03, 0.35, 0.03, side * (w / 2 - 0.25), p + h - 0.3, d / 2 - 0.05);
    b.bx(b.paint, 0xc2452f, 0.26, 0.34, 0.26, side * (w / 2 - 0.25), p + h - 0.62, d / 2 - 0.05);
  }
  b.roofOver(w, d, p + h, { civic: true, overhang: 0.3 });
  b.stairs(1.4, p, 0, d / 2, b.stone, STONE);
}

/** treasury: the small finance office (การเงินและคลัง), thick plastered walls, barred windows, a strapped door. */
function treasury(b: CivicBuilder): void {
  const w = 3.4, d = 3.6, p = 0.55, h = 2.7;
  b.bx(b.stone, STONE, w + 0.4, p, d + 0.4, 0, p / 2, 0);
  b.bx(b.paint, shade(b.masonry, -0.05), w, h, d, 0, p + h / 2, 0);
  b.bx(b.stone, shade(STONE, -0.04), w + 0.14, 0.22, d + 0.14, 0, p + h - 0.11, 0);
  b.bx(b.wood, 0x4a3324, 1.1, 1.9, 0.1, 0, p + 0.95, d / 2 + 0.05);
  b.colored(DARK, () => { for (const y of [0.45, 1.45]) b.box(1.14, 0.08, 0.04, 0, p + y, d / 2 + 0.11, b.wood); });
  for (const side of [-1, 1]) b.at(side * w / 2, 0, side * Math.PI / 2, () => {
    b.bx(b.wood, DARK, 0.6, 0.42, 0.06, 0, p + h - 0.65, 0.03);
    b.colored(0x3b3b39, () => { for (const x of [-0.17, 0, 0.17]) b.box(0.04, 0.42, 0.04, x, p + h - 0.65, 0.08, b.paint); });
  });
  b.roofOver(w, d, p + h, { overhang: 0.3 });
  b.label('การเงินและคลัง', 2, 0.4, 0, p + 2.3, d / 2 + 0.04);
  b.stairs(1.4, p, 0, d / 2 + 0.2, b.stone, STONE);
  for (const side of [-1, 1]) b.lantern(side * 1.25, d / 2 + 0.75, 1.7);
  b.bx(b.wood, b.timber, 1.2, 0.42, 0.4, -1.1, 0.27, d / 2 + 1.35);
}

/** planning_office: the land and planning office, a map board and a surveyor's pole outside. */
function planningOffice(b: CivicBuilder): void {
  const w = 3.8, d = 3.2, p = 0.55, h = 2.5;
  b.at(0, -0.6, 0, () => {
    b.bx(b.stone, STONE, w + 0.3, p, d + 0.3, 0, p / 2, 0);
    b.storey(w, d, p, h, b.form.arcade, false);
    b.door(-0.95, p, d / 2 + 0.02, 0, 0.9, 1.95);
    b.window(0.8, p + 1.25, d / 2 + 0.02, 0, 1.2, 1);
    b.roofOver(w, d, p + h, { overhang: 0.3 });
    b.label('งานที่ดินและผังเมือง', 2, 0.38, 0.75, p + 2.15, d / 2 + 0.09);
    b.stairs(1.1, p, -0.95, d / 2 + 0.15, b.stone, STONE);
  });
  b.at(1.3, 1.75, -0.3, () => {
    b.colored(b.timber, () => { for (const x of [-0.45, 0.45]) b.box(0.07, 1.5, 0.07, x, 0.75, 0, b.wood); });
    b.bx(b.paint, 0xf1ece0, 1.15, 0.8, 0.05, 0, 1.25, 0.05);
    for (const [color, y, w, x] of [[0x9a6b4f, 1.42, 0.9, 0], [0x5d8a6a, 1.2, 0.6, -0.12], [0x4f79a8, 1.05, 0.75, 0.1]] as const) {
      b.bx(b.paint, color, w, 0.05, 0.02, x, y, 0.085);
    }
  });
  for (let i = 0; i < 4; i++) b.bx(b.paint, i % 2 ? 0xf2efe6 : 0xc2402f, 0.07, 0.4, 0.07, -1.95, 0.26 + i * 0.4, 1.4);
}

/** granary: a raised rice barn kept as the community store (ยุ้งฉาง), and the town's water tank on its stand. */
function granary(b: CivicBuilder): void {
  b.at(-0.3, -0.8, 0, () => {
    const w = 2.8, d = 3, p = 1.1, h = 2, bamboo = b.kit.id === 'northeast' || b.kit.id === 'west';
    b.colored(STONE, () => { for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.4, 0.2, 0.4, x * (w / 2 - 0.2), 0.1, z * (d / 2 - 0.2), b.stone); });
    b.posts(w - 0.4, d - 0.4, p, 2.6, 0.2);
    b.bx(b.wood, b.timber, w + 0.1, 0.14, d + 0.1, 0, p, 0);
    for (const [yaw, half, length] of [[0, w / 2, d], [Math.PI / 2, d / 2, w]]) for (const side of [-1, 1]) b.at(0, 0, yaw, () => {
      b.bx(b.wood, bamboo ? 0xc2a46e : b.colors.wall, 0.1, h, length + 0.25, side * (half + 0.08), p + h / 2 + 0.07, 0, -side * 0.1);
    });
    b.bx(b.wood, DARK, 0.7, 0.95, 0.04, 0, p + 0.8, d / 2 + 0.24);
    b.colored(0xd8c9a4, () => { for (const x of [-0.5, 0, 0.5]) b.ellipsoid(point(x, 0.32, -0.2 + Math.abs(x) * 0.4), point(0.24, 0.27, 0.22), b.paint, 6, 4); });
    b.colored(b.timber, () => {
      for (const x of [-0.3, 0.3]) b.pole(point(x, 0.06, d / 2 + 1.1), point(x, p + 0.1, d / 2 + 0.15), 0.035, b.wood, 4);
      for (let i = 1; i < 4; i++) b.box(0.62, 0.05, 0.05, 0, 0.06 + i * (p / 4), d / 2 + 1.1 - i * 0.24, b.wood);
    });
    b.roofOver(w + 0.5, d + 0.4, p + h + 0.12, { overhang: 0.3, ornaments: false });
  });
  b.at(-0.6, 2.9, 0, () => {
    b.colored(STONE, () => {
      for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.18, 1.6, 0.18, x * 0.6, 0.8, z * 0.6, b.stone);
      b.box(1.7, 0.15, 1.7, 0, 1.65, 0, b.stone);
    });
    b.colored(0xc9cbc6, () => b.cylinder(0.8, 1.5, 0, 2.48, 0, b.stone, 14));
    b.colored(STONE, () => b.cylinder(0.85, 0.1, 0, 3.28, 0, b.stone, 14));
    b.colored(0x5a5d5a, () => b.pole(point(0.62, 0.06, 0.5), point(0.62, 1.95, 0.5), 0.05, b.paint, 4));
  });
}

/** warning_tower: a braced lookout under a small regional roof, with disaster-warning sirens on a mast above it. */
function warningTower(b: CivicBuilder): void {
  const foot = 1.25, head = 0.85, deck = 8.6, cap = 10.9, at = (y: number): number => foot + (head - foot) * y / deck;
  b.colored(STONE, () => { for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.5, 0.3, 0.5, x * foot, 0.15, z * foot, b.stone); });
  b.colored(shade(b.timber, -0.04), () => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.pole(point(x * foot, 0.06, z * foot), point(x * head, deck, z * head), 0.11, b.wood, 6);
    for (let level = 1; level <= 3; level++) {
      const y0 = (level - 1) * deck / 3, y1 = level * deck / 3, r0 = at(y0), r1 = at(y1);
      for (let i = 0; i < 4; i++) {
        const a = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i], c = [[-1, -1], [1, -1], [1, 1], [-1, 1]][(i + 1) % 4];
        b.pole(point(a[0] * r1, y1, a[1] * r1), point(c[0] * r1, y1, c[1] * r1), 0.06, b.wood, 4);
        const [s, e] = (i + level) % 2 ? [a, c] : [c, a];
        b.pole(point(s[0] * r0, y0 + 0.1, s[1] * r0), point(e[0] * r1, y1, e[1] * r1), 0.05, b.wood, 4);
      }
    }
  });
  b.bx(b.wood, b.timber, 2.3, 0.16, 2.3, 0, deck + 0.08, 0);
  b.colored(b.timber, () => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.14, cap - deck, 0.14, x * 1.05, deck + (cap - deck) / 2, z * 1.05, b.wood);
    for (const side of [-1, 1]) {
      b.box(2.24, 0.08, 0.08, 0, deck + 0.95, side * 1.05, b.wood);
      b.box(0.08, 0.08, 2.24, side * 1.05, deck + 0.95, 0, b.wood);
    }
  });
  b.roofOver(2.4, 2.4, cap, { overhang: 0.3, ornaments: false, pitch: Math.min(45, b.kit.defaults.pitch), fill: b.colors.trim });
  const mast = cap + 2.7;
  b.colored(0x8c9396, () => {
    b.pole(point(0, deck + 0.1, 0), point(0, mast, 0), 0.07, b.paint, 6);
    b.box(0.3, 0.3, 0.3, 0, mast - 0.35, 0, b.paint);
    for (let i = 0; i < 4; i++) {
      const horn = new CylinderGeometry(0.06, 0.24, 0.55, 8).rotateZ(Math.PI / 2).translate(0.42, mast - 0.35, 0).rotateY(i * Math.PI / 2);
      b.add(applyWorldUV(horn, 1), b.paint); horn.dispose();
    }
  });
  b.bx(b.paint, 0xc8402f, 0.2, 0.25, 0.2, 0, mast + 0.12, 0);
  b.bx(b.paint, 0xd9d6cc, 0.6, 0.9, 0.35, 1.05, 0.5, -1.35);
  b.colored(b.timber, () => {
    for (const x of [-0.3, 0.3]) b.pole(point(x, 0.06, foot + 0.6), point(x, deck, head + 0.12), 0.04, b.wood, 4);
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      b.box(0.62, 0.05, 0.05, 0, 0.06 + t * (deck - 0.06), foot + 0.6 + (head + 0.12 - foot - 0.6) * t, b.wood);
    }
  });
}

/** culture_court: an open paved court (ลานวัฒนธรรม) with benches facing a small roofed stage. */
function cultureCourt(b: CivicBuilder): void {
  b.bx(b.stone, 0xc6b49a, 6.6, 0.06, 5.2, 0, 0.09, -0.2);
  b.bx(b.stone, 0xa98f72, 4.4, 0.06, 2.6, 0, 0.1, 1);
  b.at(0, -2, 0, () => {
    b.bx(b.wood, shade(b.timber, 0.05), 4.6, 0.8, 2.2, 0, 0.4, 0);
    b.bx(b.wood, 0x7a2f26, 4.6, 2.4, 0.12, 0, 2, -1.04);
    b.colored(b.timber, () => { for (const x of [-2.2, 2.2]) for (const z of [-1, 1]) b.box(0.18, 2.7, 0.18, x, 0.8 + 1.35, z * 0.98, b.wood); });
    b.bx(b.paint, 0xc9a23f, 4.5, 0.28, 0.05, 0, 3.3, 1.1);
    b.roofOver(4.6, 2.2, 3.5, { ridge: 'x', overhang: 0.3 });
    b.stairs(1.2, 0.8, 0, 1.1, b.wood, shade(b.timber, 0.05));
  });
  b.colored(b.timber, () => {
    for (const z of [0.5, 1.3, 2.1]) for (const side of [-1, 1]) b.box(1.8, 0.42, 0.36, side * 1.4, 0.3, z, b.wood);
  });
  for (const side of [-1, 1]) {
    b.lantern(side * 3, 2.1, 2);
    b.colored(b.timber, () => { for (const x of [-0.25, 0.25]) b.box(0.06, 0.7, 0.06, side * 2.75 + x, 0.41, -0.5, b.wood); });
    b.colored(0x8b3a2b, () => b.cylinder(0.32, 0.5, side * 2.75, 0.9, -0.5, b.paint, 10, Math.PI / 2));
    b.colored(0xe6dcc4, () => { for (const x of [-0.26, 0.26]) b.cylinder(0.33, 0.03, side * 2.75 + x, 0.9, -0.5, b.paint, 10, Math.PI / 2); });
  }
}

/** front_garden: a lawn behind low hedges, a pond with stepping stones, flower beds, a bench and two trees. */
function frontGarden(b: CivicBuilder): void {
  for (const x of [-1.7, 1.6]) b.at(x, 2.05, 0, () => b.take(b.kit.gardenPlant('hedge', { seed: b.seed + x })));
  b.at(3.15, 0.4, Math.PI / 2, () => b.take(b.kit.gardenPlant('hedge', { seed: b.seed + 3 })));
  b.colored(STONE, () => {
    for (const side of [-1, 1]) {
      b.box(3, 0.22, 0.2, -0.4, 0.13, -0.6 + side * 0.95, b.stone);
      b.box(0.2, 0.22, 1.7, -0.4 + side * 1.4, 0.13, -0.6, b.stone);
    }
    for (let i = 0; i < 4; i++) b.box(0.5, 0.05, 0.42, 2.3 - i * 0.55, 0.09, 2.2 - i * 0.42, b.stone);
  });
  b.box(2.6, 0.06, 1.7, -0.4, 0.17, -0.6, b.water());
  b.bx(b.stone, 0x6f4f39, 1.3, 0.16, 0.8, -2.3, 0.14, 1.5);
  b.colored(0xd8628a, () => { for (let i = 0; i < 4; i++) b.box(0.22, 0.14, 0.22, -2.75 + i * 0.3, 0.28, 1.5 + (i % 2 - 0.5) * 0.3, b.paint); });
  b.bx(b.wood, b.timber, 1.4, 0.42, 0.42, 1.3, 0.27, 1.5);
  for (const x of [0.35, 2.25]) b.potted(x, 1.5, 0.06, 0.9);
  tree(b, 1, -2.6, -2.1, 4.6, 1.2); tree(b, 2, 2.4, -1.9, 4.2, 1.1);
}

/** trade_office: a small two-storey trade and service office (สำนักการค้า) in the region's shophouse dress. */
function tradeOffice(b: CivicBuilder): void {
  const c = b.kit.commercial, w = 3.8, d = 4.2, g = 3.2, u = 2.6, timber = c.wall !== 'plaster_tint';
  b.at(0, -0.5, 0, () => {
    b.bx(b.stone, STONE, w + 0.2, 0.25, d + 0.2, 0, 0.125, 0);
    b.bx(timber ? b.wood : b.paint, timber ? b.colors.wall : b.masonry, w, g + u, d, 0, 0.25 + (g + u) / 2, 0);
    b.colored(shade(b.colors.shutter, -0.05), () => { for (let i = 0; i < 6; i++) b.box(0.56, 2.5, 0.06, -1.5 + i * 0.6, 1.5, d / 2 + 0.04, b.wood); });
    b.bx(b.wood, b.timber, w + 0.2, 0.18, d + 0.2, 0, 0.25 + g, 0);
    for (const side of [-1, 1]) b.window(side * 0.9, 0.25 + g + 1.3, d / 2 + 0.02);
    if (c.arcade) b.take(b.adopt(b.kit.ornaments.arch({ width: w - 1, height: 1.6, seed: b.seed })), 0, 0.25, d / 2 + 0.12);
    else if (c.fretwork) {
      b.bx(b.wood, b.timber, w, 0.12, 0.7, 0, 0.25 + g + 0.06, d / 2 + 0.35);
      b.take(b.adopt(b.kit.ornaments.fretwork({ width: w - 0.2, height: 0.8, seed: b.seed, detail: 'low', color: b.colors.trim })), 0, 0.25 + g + 0.12, d / 2 + 0.66);
    } else b.colored(0xb5513f, () => b.panel([point(-w / 2 - 0.1, g - 0.2, d / 2), point(-w / 2 - 0.1, g - 0.65, d / 2 + 1),
      point(w / 2 + 0.1, g - 0.65, d / 2 + 1), point(w / 2 + 0.1, g - 0.2, d / 2)], point(0, 1, 0), 0.04, b.paint));
    b.roofOver(w, d, 0.25 + g + u, { form: c.roof, overhang: c.roof === 'flatParapet' ? 0.1 : 0.3 });
    b.label('สำนักการค้า', 2.5, 0.42, 0, 0.25 + g - 0.38, d / 2 + 0.09);
  });
  b.colored(shade(b.timber, 0.08), () => {
    for (const [x, y, z] of [[-1.35, 0.27, 2.05], [-0.75, 0.27, 2.15], [-1.05, 0.75, 2.1]]) b.box(0.55, 0.42, 0.5, x, y + 0.06, z, b.wood);
  });
  b.colored(0xd8c9a4, () => { for (const x of [0.9, 1.4]) b.ellipsoid(point(x, 0.4, 2.1), point(0.26, 0.34, 0.24), b.paint, 6, 4); });
}

const WINGS: Readonly<Record<RulerHouseWing, (b: CivicBuilder) => void>> = {
  council_hall: councilHall, treasury, planning_office: planningOffice, warning_tower: warningTower,
  granary, culture_court: cultureCourt, front_garden: frontGarden, trade_office: tradeOffice,
};

/** One wing alone, on a tile of its own, front +Z (`civic.ruler_wing_<wing>`): the city view stands the wings round the
 * era model of the ruler's house (city/tileModels.ts houseCompound), which has none of its own. */
export const rulerWingId = (wing: RulerHouseWing): string => `civic.ruler_wing_${wing}`;

export function createRulerWing(wing: RulerHouseWing, options: ModelOptions = {}) {
  // (the same for every seed: every house's wing of a kind shares one prototype)
  const b = new CivicBuilder({ ...options, seed: 0 });
  b.feature(`wing-${wing}`, () => WINGS[wing](b));
  if (b.signs.length) b.flushSigns();
  const root = b.finish(rulerWingId(wing), 'services', [1, 1], [], options);
  b.lights.forEach((at, i) => {
    const anchor = new Object3D();
    anchor.name = `anchor_light_${i}`; anchor.position.set(at.x, at.y, at.z); root.add(anchor);
  });
  Object.assign(root.userData, { regionTier: 'R1', kit: b.kit.id, wing, components: b.components, entranceFacing: '+Z' });
  return root;
}

/** civic.ruler_house: variant = level 1–6, state = the annexes built ("treasury,front_garden"), region = the kit. */
export function createRulerHouse(options: ModelOptions = {}) {
  const b = new CivicBuilder(options), level = rulerHouseLevel(options.variant), wings = parseRulerWings(options.state);
  b.feature('site', () => b.box(29, 0.06, 29, 0, 0.03, 0, b.grass));
  if (level === 1) timberOffice(b);
  else if (level === 2) masonryLevel(b);
  else governmentCentre(b, level);
  for (const wing of wings) b.feature(`wing-${wing}`, () => b.at(SLOTS[wing][0], SLOTS[wing][1], 0, () => WINGS[wing](b)));
  b.flushSigns();
  const root = b.finish(RULER_HOUSE_ID, 'services', [3, 3], [], options);
  const anchors = (kind: string, points: readonly { x: number; y: number; z: number }[]): void => points.forEach((at, i) => {
    const anchor = new Object3D();
    anchor.name = `anchor_${kind}_${i}`; anchor.position.set(at.x, at.y, at.z); root.add(anchor);
  });
  anchors('light', b.lights);
  anchors('water', b.jets);
  Object.assign(root.userData, {
    regionTier: 'R1', kit: b.kit.id, level, wings, building: 'district-office',
    levelName: LEVEL_NAMES[level - 1], levelNameEn: LEVEL_NAMES_EN[level - 1],
    variantLabel: `ขั้น ${level} · ${LEVEL_NAMES[level - 1]}`, variantLabelEn: `Level ${level} · ${LEVEL_NAMES_EN[level - 1]}`,
    floors: [1, 2, 3, 3, 3, 3][level - 1], signText: RULER_HOUSE_SIGN,
    roofForm: level >= 3 ? b.kit.services.roofForm : b.form.roof, houseRoofForm: b.form.roof,
    civicRoofForm: b.kit.services.roofForm, twinGables: b.form.twin, components: b.components, entranceFacing: '+Z',
    // The model gallery offers these in its state field (src/render3d/gallery/gallery.ts).
    stateChoices: [...RULER_HOUSE_WINGS, RULER_HOUSE_WINGS.join(',')],
  });
  return root;
}
