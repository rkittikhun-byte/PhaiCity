/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { polishedStone, tint } from '../../materials/library.js';
import { seededRng } from '../../rng.js';
import { ZoneBuilder } from './zone-builder.js';
import { point } from '../../regional/geometry.js';

export function buildWalkup(b: ZoneBuilder): Record<string, unknown> {
  const wall = b.stone;
  b.site(); b.entrance();
  b.feature('body', () => b.mass(21, 14.65, 8.4, -1, 7.46, -2.6, wall));
  b.feature('corridor-balconies-and-grilles', () => {
    b.facade(21, 8.4, 5, 8, -1, -2.6, wall);
    for (let floor = 0; floor < 5; floor++) {
      const y = 0.15 + floor * 3;
      b.box(21.3, 0.15, 1.3, -1, y + 0.06, 2.24, wall);
      b.box(21.3, 0.08, 0.07, -1, y + 1.08, 2.82, b.metal);
      for (let col = 0; col < 9; col++) {
        const x = -10.8 + col * 2.45;
        b.box(0.065, 0.95, 0.06, x, y + 0.59, 2.82, b.metal);
        for (let bar = 0; bar < 3; bar++) b.box(0.035, 1.35, 0.05, x - 0.4 + bar * 0.4, y + 1.6, 1.73, b.metal);
        if ((floor + col) % 3 === 0) b.box(0.75, 0.73, 0.025, x, y + 0.78, 2.86, tint('fabric_canvas', 0xb6c6b8));
      }
    }
  });
  b.feature('external-staircase', () => {
    for (let floor = 0; floor < 5; floor++) {
      for (let step = 0; step < 10; step++) b.box(1.8, 0.16, 0.43, 11.05, 0.16 + floor * 3 + (step + 1) * 0.3, -4.8 + step * 0.39, wall);
      b.box(2.1, 0.16, 1.35, 11.05, 3.15 + floor * 3, -0.05, wall);
      b.pole(point(10.16, 1.16 + floor * 3, -4.85), point(10.16, 4.15 + floor * 3, -1.35), 0.028, b.metal, 4);
    }
    b.box(21.4, 0.2, 8.8, -1, 14.95, -2.6, wall);
  });
  b.parking(3, b.wood, true); b.gardens(3, 5.6);
  return { floors: 5, exteriorStaircase: true, corridorBalconies: true, windowGrilles: true };
}

export function buildPublicHousing(b: ZoneBuilder): Record<string, unknown> {
  const colors = [0xd3cab3, 0xb5c2b5, 0xc0bfad, 0xbec3c5], wall = tint('plaster_tint', colors[Math.floor(seededRng(b.options.seed)() * colors.length)]);
  b.site(); b.entrance();
  b.feature('two-housing-blocks', () => {
    for (const x of [-7, 7]) {
      b.mass(9.1, 29.6, 8.6, x, 14.98, -2.1, wall);
      b.facade(9.1, 8.6, 10, 3, x, -2.1, wall, { balcony: true, laundry: true });
      for (let floor = 1; floor < 10; floor++) b.box(9.25, 0.12, 8.7, x, floor * 3 + 0.08, -2.1, b.stone);
      b.box(9.5, 0.19, 9, x, 29.9, -2.1, b.stone);
      for (const dx of [-1.7, 1.7]) b.cylinder(0.67, 1.5, x + dx, 30.75, -3.1, b.metal, 10);
      for (const dz of [-4.4, 0.3]) { b.pole(point(x + 2.7, 30.04, dz), point(x + 2.7, 31, dz), 0.035, b.metal, 5);
        b.ellipsoid(point(x + 2.7, 31.14, dz), point(0.48, 0.1, 0.48), b.metal, 8, 4); }
      for (let clutter = 0; clutter < 10; clutter++) b.box(0.4, 0.45, 0.3, x - 2.65, 0.4 + clutter * 3, 3.08, b.wood);
    }
  });
  b.parking(4, wall); b.gardens(3, 6.2);
  return { floors: 10, buildingCount: 2, rooftopWaterTanks: 4, satelliteDishes: 4, clutteredBalconies: true };
}

export function buildDormitory(b: ZoneBuilder): Record<string, unknown> {
  const wall = tint('plaster_tint', 0xd0d7ca);
  b.site(); b.entrance();
  b.feature('dormitory-body', () => {
    b.mass(20.1, 20.7, 8.4, -1, 10.55, -2.4, wall);
    b.mass(3, 22.5, 5.8, 10.6, 11.36, -2.4, b.stone);
    b.box(20.5, 0.18, 8.8, -1, 21.06, -2.4, b.stone);
  });
  b.feature('room-balconies-and-AC', () => b.facade(20.1, 8.4, 7, 6, -1, -2.4, wall, { balcony: true, ac: true }));
  b.parking(9, wall, true); b.gardens(3, 5.8);
  return { floors: 7, rooms: 84, airConditioners: 84, liftCore: true, motorbikeSpaces: 9 };
}

export function buildBudgetCondo(b: ZoneBuilder): Record<string, unknown> {
  const wall = tint('plaster_tint', 0xcacfc3);
  b.site(); b.entrance();
  b.feature('open-ground-parking-and-slab', () => {
    for (const x of [-9, -4.5, 0, 4.5, 9]) for (const z of [-5, 1.5]) b.box(0.32, 3, 0.32, x, 1.61, z, b.stone);
    b.box(21.4, 0.2, 7.6, 0, 3.13, -1.8, b.stone);
    b.mass(20.8, 41.7, 7, 0, 24.1, -1.8, wall);
    b.box(21.1, 0.2, 7.4, 0, 45.05, -1.8, b.stone);
    for (let i = 0; i < 4; i++) b.car(-7 + i * 4.4, -1.6, wall);
  });
  b.feature('repetitive-balconies', () => b.facade(20.8, 7, 14, 6, 0, -1.8, wall, { floorY: 3.15, balcony: true }));
  b.parking(4, wall, true); b.gardens(3, 5.8);
  return { floors: 15, groundFloorParking: true, longSlab: true };
}

export function buildPoolCondo(b: ZoneBuilder): Record<string, unknown> {
  const wall = tint('plaster_tint', 0xe5e4dd), spacing = 3;
  b.site(); b.entrance();
  b.feature('eight-storey-condo', () => {
    b.mass(20.4, 23.7, 8.6, 0, 12.01, -3.2, wall);
    b.box(20.8, 0.18, 9, 0, 24, -3.2, b.stone);
    for (const side of [-1, 1]) b.box(20.8, 0.42, 0.14, 0, 24.23, -3.2 + side * 4.42, b.stone);
    b.facade(20.4, 8.6, 8, 6, 0, -3.2, wall, { balcony: true, floorY: 0.14, spacing });
  });
  b.feature('swimming-pool-and-glass-gym', () => {
    b.pool(5.5, 7.8, 8.2, 4.4, 0.14);
    b.mass(5.7, 2.75, 4.8, -7.6, 1.5, 6.6, b.glass);
    b.box(5.9, 0.16, 5, -7.6, 2.96, 6.6, wall);
    for (const x of [-9.2, -7.6, -6]) { b.box(0.52, 0.15, 1.5, x, 0.3, 6.6, b.metal); b.box(0.08, 1.2, 0.08, x, 0.88, 7.2, b.metal); }
  });
  b.parking(3, wall, true, 12.2); b.gardens(2, 5.8);
  return { floors: 8, floorSpacing: spacing, swimmingPool: true, glassGym: true };
}

export function buildPodiumTower(b: ZoneBuilder): Record<string, unknown> {
  const wall = tint('plaster_tint', 0xe7e5dc);
  b.site(); b.entrance();
  b.feature('five-level-parking-podium', () => {
    for (let floor = 0; floor <= 5; floor++) b.box(25.2, 0.16, 21.2, 0, 0.14 + floor * 3, -1.4, b.stone);
    for (const x of [-11.2, -5.6, 0, 5.6, 11.2]) for (const z of [-10.1, -4.3, 2.5, 7.8]) b.box(0.37, 15.1, 0.37, x, 7.65, z, b.stone);
    for (let i = 0; i < 4; i++) b.car(-8 + i * 5.2, 2.7, wall, Math.PI / 2);
    // A shallow visible access slope; the simulation still sees an ordinary residential zone.
    for (let i = 0; i < 12; i++) b.box(3, 0.1, 0.55, 10.6, 0.18 + i * 0.24, 9.5 - i * 0.52, b.stone);
  });
  b.feature('thirty-storey-tower', () => {
    b.mass(13.4, 74.7, 11.8, 0, 52.65, -3, b.glass);
    for (let floor = 0; floor <= 25; floor++) b.box(13.65, 0.19, 12.05, 0, 15.18 + floor * 3, -3, wall);
    b.facade(13.4, 11.8, 25, 4, 0, -3, wall, { floorY: 15.15, balcony: true, glassRail: true });
  });
  b.feature('level-six-pool-deck', () => {
    b.pool(-9, 4.2, 4.3, 5.8, 15.26);
    b.tree('mango', 9.9, 5.3, 4.2, 1, 15.3); b.tree('mango', 9.9, -8.8, 4.2, 1, 15.3);
  });
  b.gardens(2, 5.7);
  return { floors: 30, parkingLevels: 5, poolLevel: 6, poolElevation: 15.26, glassBalustrades: true };
}

export function buildLuxuryCondo(b: ZoneBuilder): Record<string, unknown> {
  const wall = polishedStone(0xe0dbd0);
  b.site(); b.entrance();
  b.feature('double-height-lobby-and-stone-tower', () => {
    b.mass(16.8, 47.7, 11.4, 0, 24.02, -2.7, wall);
    b.box(14.5, 5.5, 0.06, 0, 3.05, 3.05, b.glass);
    for (const side of [-1, 1]) b.box(0.35, 5.7, 0.45, side * 7.45, 3.05, 3.1, b.stone);
    b.facade(16.8, 11.4, 14, 4, 0, -2.7, wall, { floorY: 6.15, balcony: true, glassRail: true });
    b.box(17.2, 0.2, 11.8, 0, 48.06, -2.7, b.stone);
    b.mass(6.7, 3.4, 6.1, 0, 49.85, -2.7, b.glass);
  });
  b.feature('sky-gardens', () => {
    for (const [level, y] of [[5, 15.2], [10, 30.2], [15, 45.2]]) {
      b.box(19.4, 0.19, 3, 0, y, 4.25, b.stone);
      for (const x of [-7.5, 7.5]) b.tree('mango', x, 4.2, 3.6, 0.82, y + 0.13, b.wood, level);
      b.box(19.2, 0.85, 0.045, 0, y + 0.6, 5.73, b.glass);
    }
  });
  b.parking(3, wall, true); b.gardens(2, 6.2);
  return { floors: 15, lobbyHeight: 6, skyGardenLevels: [5, 10, 15], stoneFacade: true };
}

export function buildLuxuryTower(b: ZoneBuilder): Record<string, unknown> {
  const wall = tint('plaster_tint', 0xe8e8df), glow = tint('emissive_window', 0xb3d5bf);
  b.site(); b.entrance();
  b.feature('forty-five-storey-glass-tower', () => {
    b.mass(11.6, 134.7, 11.6, 0, 67.55, -2.5, b.glass);
    for (let floor = 0; floor <= 45; floor++) b.box(11.8, 0.14, 11.8, 0, 0.14 + floor * 3, -2.5, wall);
    for (const x of [-5.8, -2.9, 0, 2.9, 5.8]) for (const side of [-1, 1]) b.box(0.07, 134.8, 0.09, x, 67.54, -2.5 + side * 5.85, b.metal);
  });
  b.feature('crowned-top-and-night-lighting', () => {
    for (let tier = 0; tier < 3; tier++) {
      const w = 10.2 - tier * 2.75, y = 136.4 + tier * 2.4;
      b.mass(w, 2.2, w, 0, y, -2.5, b.glass);
      for (const side of [-1, 1]) { b.box(w, 0.11, 0.08, 0, y + 1.05, -2.5 + side * w / 2, glow);
        b.box(0.08, 0.11, w, side * w / 2, y + 1.05, -2.5, glow); }
    }
    b.box(0.16, 5.2, 0.16, 0, 144.91, -2.5, b.metal);
    for (const y of [45.15, 90.15, 133.7]) for (const side of [-1, 1]) b.box(11.85, 0.12, 0.075, 0, y, -2.5 + side * 5.91, glow);
  });
  b.feature('rooftop-garden', () => {
    b.box(9.8, 0.15, 2.1, 0, 135.22, 2.14, b.stone);
    for (const x of [-3.7, 3.7]) b.tree('mango', x, 2.08, 3.2, 0.72, 135.3);
  });
  b.parking(3, wall, true); b.gardens(2, 6.1);
  return { floors: 45, fullyGlazed: true, rooftopGarden: true, decorativeNightLighting: true };
}
