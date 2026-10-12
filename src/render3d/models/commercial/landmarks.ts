/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, ConeGeometry, Group, Object3D, PlaneGeometry, RingGeometry, TorusGeometry } from 'three';
import { tint, observationDeckMaterial } from '../../materials/library.js';
import { KitBuilder } from '../../regional/geometry.js';
import { applyWorldUV, countTriangles, mergeByMaterial } from '../../util/geometry.js';
import { CommercialBuilder } from './builder.js';

export const LANDMARK_ANCHORS = Object.freeze({ anchor_light_0: [0, 148, -2], anchor_light_1: [0, 3.6, 8.16] });
export interface PixelVoid { floor: number; side: number; column: number; center: number[]; yaw: number; inset: number }

function crown(b: CommercialBuilder, top: number, width: number): void {
  const led = tint('emissive_window', 0xa9d9d1);
  b.feature('LED-lit-abstract-crown', () => {
    for (let tier = 0; tier < 3; tier++) {
      const w = width - tier * 2, y = top + 1.4 + tier * 2.55;
      b.colored(0xb7c9c7, () => b.box(w, 0.8, w, 0, y - 0.15, -2, b.paint));
      for (const side of [-1, 1]) {
        b.box(w + 0.1, 0.12, 0.085, 0, y + 0.33, -2 + side * w / 2, led);
        b.box(0.085, 0.12, w, side * w / 2, y + 0.33, -2, led);
      }
    }
    b.box(0.1, 0.8, 0.1, 0, 148.4, -2, b.metal);
  });
}

export function buildLandmark(b: CommercialBuilder): Record<string, unknown> {
  const variant = [0, 1, 2].includes(b.options.variant ?? 0) ? b.options.variant ?? 0 : 0;
  b.site(b.stone); b.entrance();
  b.feature('mixed-use-retail-lobby-podium', () => {
    b.mass(22, 3.85, 20, 0, 2.125, -2, b.glass);
    b.box(22.4, 0.22, 20.4, 0, 4.09, -2, b.stone);
    for (const x of [-10.4, -5.2, 0, 5.2, 10.4]) b.colored(0xd0d9d4, () => b.box(0.16, 3.7, 0.2, x, 2.12, 8.06, b.paint));
  });
  let voids: PixelVoid[] = [];
  if (variant === 0) {
    b.feature('five-tapering-stepped-tower-volumes', () => {
      let bottom = 4.2;
      const counts = [9, 9, 8, 7, 6];
      counts.forEach((count, tier) => {
        const w = 22 - tier * 3, d = 20 - tier * 2.5, top = bottom + count * 3.5;
        b.mass(w, top - bottom - 0.12, d, 0, (bottom + top) / 2, -2, b.glass);
        for (let floor = 0; floor <= count; floor++) b.colored(0xb4c6c5, () => b.box(w + 0.17, 0.13, d + 0.17, 0, bottom + floor * 3.5, -2, b.paint));
        for (const side of [-1, 1]) for (const x of [-w * 0.3, 0, w * 0.3]) b.box(0.065, top - bottom, 0.1, x, (bottom + top) / 2, -2 + side * d / 2, b.metal);
        bottom = top;
      });
    });
    crown(b, 140.7, 9.6);
  } else if (variant === 1) {
    b.feature('slender-square-tower-and-pointed-spire', () => {
      b.mass(12.8, 129.4, 12.8, 0, 68.95, -2, b.glass);
      for (let floor = 0; floor <= 37; floor++) b.colored(0xb4c6c5, () => b.box(13, 0.13, 13, 0, 4.2 + floor * 3.5, -2, b.paint));
      for (const side of [-1, 1]) for (const x of [-5.7, 0, 5.7]) b.box(0.065, 129.4, 0.08, x, 68.95, -2 + side * 6.44, b.metal);
      const spire = new ConeGeometry(5.2, 12.5, 4).rotateY(Math.PI / 4).translate(0, 140.05, -2);
      b.add(applyWorldUV(spire, 1), b.paint); spire.dispose();
      const tip = new ConeGeometry(0.22, 2.6, 6).translate(0, 147.6, -2);
      b.add(applyWorldUV(tip, 1), b.metal); tip.dispose();
      b.box(0.18, 2.3, 0.18, 0, 147.75, -2, tint('emissive_window', 0xa9d9d1));
    });
  } else {
    voids = pixelTower(b); crown(b, 140.7, 9.6);
  }
  b.shopSign('ลานร้านค้าและสำนักงาน', 10.8, 0.9, 0, 3.12, 8.19, { background: 0xe0e7e1 });
  b.parking(2, b.stone, true); b.gardens(2, 5.7, b.paint);
  return { variant, variantLabel: ['ตึกระฟ้าริ้วเมฆ', 'ตึกระฟ้ายอดแหลม', 'ตึกพิกเซล'][variant],
    variantLabelEn: ['Stepped cloud tower', 'Spired observation tower', 'Pixel terrace tower'][variant],
    floors: variant === 1 ? 38 : 40, originalPromptFloors: 60, ownerApprovedApproximateFloors: 40, floorSpacing: [4, 3.5],
    maxHeight: 150, taperingTiers: variant === 0 ? 5 : 0, LEDCrown: true, rotatingObservationDeck: variant === 1,
    pixelVoids: voids, pixelVoidCount: voids.length, pixelFacadeCells: variant === 2 ? 936 : 0 };
}

function pixelTower(b: CommercialBuilder): PixelVoid[] {
  const voids: PixelVoid[] = [], pitch = 3.3, half = 9.9, terrace = new KitBuilder();
  terrace.box(3.22, 0.14, 2.6, 0, 0.11, -1.36, b.paint);
  for (const side of [-1, 1]) terrace.box(0.055, 0.88, 2.45, side * 1.56, 0.59, -1.36, b.paint);
  terrace.add(new PlaneGeometry(2.98, 0.8).translate(0, 0.61, -0.16), b.glass);
  b.feature('glass-facade-with-carved-spiral-voids', () => {
    b.colored(0x3f5759, () => b.mass(9, 136.4, 9, 0, 72.45, -2, b.paint));
    for (let floor = 1; floor <= 39; floor++) {
      const bottom = 4.2 + (floor - 1) * 3.5, start = Math.floor((floor - 4) * 0.85);
      for (let side = 0; side < 4; side++) for (let col = 0; col < 6; col++) {
        const t = (col + 0.5) * pitch - half, yaw = side * Math.PI / 2;
        const x = side === 0 ? t : side === 1 ? half : side === 2 ? -t : -half;
        const z = -2 + (side === 0 ? half : side === 1 ? -t : side === 2 ? -half : t);
        const missing = floor >= 4 && floor <= 36 && ((side * 6 + col - start + 48) % 24) < 2;
        if (missing) {
          voids.push({ floor, side, column: col, center: [x, bottom + 2.2, z], yaw, inset: 2.6 });
          b.place(terrace.parts, x, bottom, z, yaw);
        } else b.pane(pitch - 0.035, 3.31, x, bottom + 1.75, z, b.glass, yaw);
      }
      // Floor edges continue through the recess, leaving the central facade band genuinely open.
      for (const side of [-1, 1]) {
        b.box(20, 0.12, 0.09, 0, bottom, -2 + side * half, b.paint);
        b.box(0.09, 0.12, 19.9, side * half, bottom, -2, b.paint);
      }
    }
    b.box(20.2, 0.2, 20.2, 0, 140.72, -2, b.stone);
  });
  terrace.parts.forEach(p => p.geometry.dispose()); return voids;
}

/** Named real Y-axis pivot. Its material is dedicated so every material still has one visible mesh. */
export function finishLandmark(root: Group): void {
  const id = root.name;
  if (root.userData.variant === 1) {
    const deck = new KitBuilder(), material = observationDeckMaterial();
    const floor = new RingGeometry(5.4, 7.72, 48).rotateX(-Math.PI / 2); deck.add(applyWorldUV(floor, 1), material); floor.dispose();
    for (const y of [0.2, 1.85]) {
      const rim = new TorusGeometry(7.64, 0.16, 5, 48).rotateX(Math.PI / 2).translate(0, y, 0);
      deck.add(applyWorldUV(rim, 1), material); rim.dispose();
    }
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      deck.box(0.07, 1.6, 0.09, Math.cos(a) * 7.63, 1.03, Math.sin(a) * 7.63, material);
    }
    const pivot = mergeByMaterial(`${id}/deck`, deck.parts); deck.parts.forEach(p => p.geometry.dispose());
    pivot.name = 'anim_deck'; pivot.position.set(0, 127.5, -2); root.add(pivot);
    const bounds = new Box3().setFromObject(pivot);
    root.userData.components.push({ role: 'rotating-observation-deck', min: bounds.min.toArray(), max: bounds.max.toArray(), triangles: countTriangles(pivot) });
    root.userData.observationDeckPivot = [0, 127.5, -2];
  }
  for (const [name, xyz] of Object.entries(LANDMARK_ANCHORS)) { const anchor = new Object3D(); anchor.name = name; anchor.position.set(xyz[0], xyz[1], xyz[2]); root.add(anchor); }
  root.userData.triangles = countTriangles(root);
}

export function animateCommercialModels(roots: readonly Object3D[], seconds: number): void {
  if (!Number.isFinite(seconds)) return;
  for (const root of roots) { const deck = root.getObjectByName('anim_deck'); if (deck) deck.rotation.y = (seconds % 90) / 90 * Math.PI * 2; }
}
