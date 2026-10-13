/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The water tower (หอถังสูง, docs/WATER_PLAN.md, RENDERER_SPEC 6C): tile 1020, one tile beside a road. The classic
// Thai village water tower (ประปาหมู่บ้าน): a painted steel tank with a cone roof on a four-column concrete frame tied at
// every storey, a platform with a guard rail and a lamp, a caged ladder, the rising main and the outlet down one column
// to a valve box, a sand-filter tank and a small pump shed at its foot, a low fence and a sign board. Tier R3, front
// +Z (the ladder and the sign; the city turns it toward its road).

import { point } from '../../regional/geometry.js';
import { seededRng } from '../../rng.js';
import { STONE, shade } from '../civic/builder.js';
import { CONCRETE, LADDER, PIPE, RAIL, WaterBuilder } from './builder.js';
import type { ModelOptions } from '../registry.js';

export const WATER_TOWER_ID = 'water.tower';
export const WATER_TOWER_TILES = [1020];
export const WATER_TOWER_SIGN = 'ประปาหมู่บ้าน';
/** Painted tank finishes; the seed picks one */
export const WATER_TOWER_COLORS = [0x2f6fb0, 0x6fb3d8, 0xdfe2de, 0x3f8f6a] as const;
const PLATFORM = 10.1, TANK_R = 1.55, TANK_H = 2.8;

/** water.tower: the seed picks the tank's paint and turns the shrubs; the frame and its height never change. */
export function createWaterTower(options: ModelOptions = {}) {
  const b = new WaterBuilder(options), tank = WATER_TOWER_COLORS[Math.floor(seededRng(b.seed ^ 0x7a3e)() * WATER_TOWER_COLORS.length)];
  b.feature('pad', () => {
    b.bx(b.stone, STONE, 5.6, 0.15, 5.6, 0, 0.075, 0);
    b.colored(CONCRETE, () => { for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.7, 0.3, 0.7, x * 1.4, 0.15, z * 1.4, b.stone); });
  });
  b.feature('frame', () => {
    b.colored(0xc9c6bd, () => {
      for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.3, PLATFORM - 0.15, 0.3, x * 1.4, 0.15 + (PLATFORM - 0.15) / 2, z * 1.4, b.stone);
      for (const y of [3.4, 6.75]) for (const s of [-1, 1]) {
        b.box(2.8, 0.26, 0.22, 0, y, s * 1.4, b.stone);
        b.box(0.22, 0.26, 2.8, s * 1.4, y, 0, b.stone);
      }
    });
    b.bx(b.stone, shade(CONCRETE, 0.04), 3.8, 0.22, 3.8, 0, PLATFORM, 0);
    b.colored(RAIL, () => {
      for (const s of [-1, 1]) for (const y of [0.55, 1.05]) {
        b.box(3.8, 0.05, 0.05, 0, PLATFORM + y, s * 1.88, b.paint);
        b.box(0.05, 0.05, 3.8, s * 1.88, PLATFORM + y, 0, b.paint);
      }
      for (const x of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || z) b.box(0.05, 1.05, 0.05, x * 1.88, PLATFORM + 0.53, z * 1.88, b.paint);
    });
    b.lantern(-1.7, -1.7, 0.7, PLATFORM + 0.11);
  });
  b.feature('tank', () => {
    const base = PLATFORM + 0.35;
    b.colored(0x5a5f5e, () => { for (const x of [-0.8, 0, 0.8]) b.box(0.16, 0.24, 3.2, x, PLATFORM + 0.23, 0, b.paint); });
    b.colored(tank, () => b.cylinder(TANK_R, TANK_H, 0, base + TANK_H / 2, 0, b.paint, 16));
    b.colored(shade(tank, -0.12), () => {
      for (const y of [0.05, TANK_H - 0.05]) b.cylinder(TANK_R + 0.04, 0.1, 0, base + y, 0, b.paint, 16);
    });
    b.shell([[TANK_R + 0.06, base + TANK_H], [0.25, base + TANK_H + 0.55], [0.001, base + TANK_H + 0.56]], 0, 0, 0, 16, shade(tank, -0.06));
    b.colored(shade(tank, -0.06), () => b.cylinder(0.14, 0.4, 0, base + TANK_H + 0.65, 0, b.paint, 6));
    b.bx(b.paint, shade(tank, -0.2), 0.5, 0.1, 0.5, 0.6, base + TANK_H + 0.2, 0.5);
    b.label(WATER_TOWER_SIGN, 1.7, 0.4, 0, base + TANK_H * 0.55, TANK_R + 0.06, 0, 0xf4f4ef, 0x1f4f86);
    b.ladder(1.36, 0.6, PLATFORM + 0.11, base + TANK_H + 0.2, Math.PI / 2);
  });
  b.feature('ladder', () => b.ladder(0, 1.77, 0.15, PLATFORM + 1.1, 0, true));
  b.feature('mains', () => {
    for (const [x, r] of [[0.8, 0.09], [1.05, 0.075]] as const) {
      b.pipe([point(x, PLATFORM + 0.36, -0.6), point(x, PLATFORM - 0.2, -1.05), point(x, 0.6, -1.05), point(x, 0.35, -2.3)], r);
    }
    b.bx(b.stone, CONCRETE, 1.4, 0.35, 0.9, 1.4, 0.175, -2.5);
    b.valve(1.4, 0.55, -2.95, Math.PI, 0.1);
  });
  b.feature('filter-and-pump', () => {
    const x = -2.6;
    b.colored(PIPE, () => {
      b.cylinder(0.5, 1.5, x, 0.9, -2.6, b.paint, 12);
      b.ellipsoid(point(x, 1.65, -2.6), point(0.5, 0.22, 0.5), b.paint, 10, 4);
    });
    b.bx(b.stone, CONCRETE, 1.6, 0.2, 1.3, x, 0.1, -0.7);
    b.bx(b.paint, 0x3f6b55, 0.9, 0.55, 0.5, x, 0.48, -0.7);
    b.colored(LADDER, () => { for (const dx of [-1, 1]) for (const z of [-1, 1]) b.box(0.07, 1.7, 0.07, x + dx * 0.75, 0.95, -0.7 + z * 0.6, b.paint); });
    b.colored(0x8a9696, () => b.panel([point(x - 0.9, 1.75, 0), point(x + 0.9, 1.75, 0), point(x + 0.9, 1.95, -1.4), point(x - 0.9, 1.95, -1.4)],
      point(0, 1.4, 0.2).normalize(), 0.05, b.paint));
    b.pipe([point(x, 0.5, -2.1), point(x, 0.5, -1.2)], 0.07);
  });
  b.feature('fence', () => {
    b.colored(CONCRETE, () => {
      for (const s of [-1, 1]) for (const t of [-1, -0.5, 0, 0.5, 1]) {
        if (s < 0 || t !== 0) b.box(0.12, 1.3, 0.12, t * 4.1, 0.65, s * 4.1, b.stone);
        if (Math.abs(t) < 1) b.box(0.12, 1.3, 0.12, s * 4.1, 0.65, t * 4.1, b.stone);
      }
    });
    b.colored(0x8d9593, () => {
      for (const y of [0.5, 1.1]) {
        b.box(8.2, 0.03, 0.03, 0, y, -4.1, b.paint);
        for (const s of [-1, 1]) {
          b.box(0.03, 0.03, 8.2, s * 4.1, y, 0, b.paint);
          b.box(3, 0.03, 0.03, s * 2.6, y, 4.1, b.paint);
        }
      }
    });
  });
  b.feature('sign-board', () => {
    b.colored(LADDER, () => { for (const x of [-0.75, 0.75]) b.box(0.08, 1.9, 0.08, 2.6 + x, 0.95, 3.4, b.paint); });
    b.label(WATER_TOWER_SIGN, 1.8, 0.5, 2.6, 1.6, 3.45, 0, 0x2f6fa8, 0xffffff);
  });
  b.feature('shrubs', () => { b.shadeTree(0, -3.1, 3.1, 2.8, 0.8); b.at(-3.4, 1.6, Math.PI / 2, () => b.take(b.kit.gardenPlant('hedge', { seed: b.seed + 3 }))); });
  return b.finishWater(WATER_TOWER_ID, [1, 1], WATER_TOWER_TILES, {
    signText: WATER_TOWER_SIGN, tankColor: tank, platform: PLATFORM, height: PLATFORM + 0.35 + TANK_H + 0.85,
  });
}
