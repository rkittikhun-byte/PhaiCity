/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { getMaterial, tint, vertexFinish, commercialLEDMaterial } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { displayPanel } from './geometry.js';
import { CommercialBuilder } from './builder.js';
import { Mesh, Material } from 'three';
import { createSedan } from '../vehicles/road.js';
import { disposeModel } from '../../util/geometry.js';

export function gardenCafe(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.palette.pick(b.options.seed), wood = vertexFinish(b.kit.zoneStyle.timber);
  b.site(getMaterial('grass')); b.entrance();
  b.feature('glass-and-timber-garden-pavilion', () => {
    b.box(13.1, 0.16, 8.8, 0, 0.2, -4, b.stone);
    b.mass(12.8, 3.75, 8.4, 0, 2.225, -4, b.glass);
    b.colored(colors.wall, () => {
      for (const x of [-6.2, -3.1, 0, 3.1, 6.2]) for (const z of [-8.15, 0.25]) b.box(0.16, 3.8, 0.18, x, 2.25, z, wood);
      b.box(12.9, 0.17, 0.2, 0, 4.05, 0.26, wood);
      for (const x of [-5.8, 5.8]) for (let slat = 0; slat < 6; slat++) b.box(0.095, 2.8, 0.18, x + slat * 0.14, 2.4, 0.4, wood);
    });
    for (const x of [-3.2, 3.2]) b.take(b.remap(b.kit.roofs[b.kit.defaults.roofForm]([6.4, 8.4],
      { baseY: 4.12, pitch: 25, overhang: 0.42, seed: b.options.seed, detail: 'low' }), ['wood_painted'], wood), x, 0, -4);
  });
  b.feature('outdoor-garden-seating', () => {
    for (const [x, z] of [[-7.2, 5.5], [-7.2, 9.7], [7.2, 5.5], [7.2, 9.7]]) b.plasticFurniture(x, z, 0xbea981);
    b.box(4.8, 0.1, 8.1, 0, 0.18, 6.1, b.stone);
  });
  b.feature('large-regional-trees', () => {
    const mix = b.kit.vegetation.filter(tree => !tree.nearWaterOnly && tree.id !== 'veg.banana');
    for (const [n, x, z] of [[0, -10.8, -8.8], [1, 10.8, -8.8], [2, 10.8, 1.8]]) b.take(b.kit.bigGardenTree(mix[n % mix.length].id.slice(4),
      { seed: (b.options.seed ?? 1) + n, height: 11.5, radius: 3.5, bark: wood }), x, 0.06, z);
  });
  b.shopSign('คาเฟ่ลานใบเมฆ', 7.2, 0.7, 0, 3.45, 0.4);
  return { floors: 1, floorSpacing: [4], glassTimberPavilion: true, outdoorTables: 4, bigTrees: 3 };
}

export function glassShoppingCenter(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed);
  b.site(b.stone); b.entrance();
  b.feature('three-storey-glass-shopping-center', () => {
    b.colored(colors.wall, () => b.mass(23, 11.45, 17.4, 0, 5.925, -3, b.paint));
    b.box(22.3, 10.3, 0.08, 0, 5.52, 5.75, b.glass);
    b.colored(colors.trim, () => {
      for (const y of [4.2, 7.7, 11.2]) b.box(23.2, 0.22, 17.6, 0, y, -3, b.paint);
      for (const x of [-10.8, -5.4, 0, 5.4, 10.8]) b.box(0.12, 10.4, 0.25, x, 5.52, 5.84, b.paint);
      b.box(23.5, 0.28, 18, 0, 11.66, -3, b.paint);
    });
    b.box(7.5, 0.2, 3, -5.3, 3.8, 7, b.stone);
  });
  b.feature('LED-screen', () => {
    b.box(9, 4.6, 0.18, 5.7, 7.53, 5.98, b.metal);
    displayPanel(b, 8.6, 4.15, 5.7, 7.53, 6.09, commercialLEDMaterial());
  });
  b.shopSign('ศูนย์การค้าลานผกา', 9.6, 0.9, -5.7, 3.21, 5.93);
  b.parking(2, b.stone); b.gardens(2, 5.4, b.paint);
  return { floors: 3, floorSpacing: [4, 3.5], glassFacade: true, LEDScreen: true };
}

export function carShowroom(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), clear = getMaterial('glass_clear'), body = vertexFinish('metal_painted');
  const displayCar = (x: number, y: number, z: number, yaw: number, color: number): void => {
    const car = createSedan({ seed: b.options.seed }); car.updateMatrixWorld(true);
    const parts = car.children.filter((child): child is Mesh => child instanceof Mesh).map(mesh => {
      const key = (mesh.material as Material).userData.materialKey;
      const material = key === 'metal_painted' ? body : key === 'glass_tinted' ? b.glass : key === 'emissive_window' ? b.paint : b.metal;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (material.userData.vertexFinish) CommercialBuilder.color(geometry, key === 'metal_painted' ? color : 0xf2eee0);
      return { geometry, material };
    });
    b.take(parts, x, y, z, yaw); disposeModel(car);
  };
  b.site(b.stone); b.entrance();
  b.feature('two-storey-clear-glass-showroom', () => {
    b.mass(23, 7.5, 17, 0, 4.05, -3, clear);
    b.colored(colors.wall, () => {
      for (const y of [0.24, 4.15, 7.98]) b.box(23.6, 0.18, 17.6, 0, y, -3, b.paint);
      for (const x of [-11.1, -5.55, 0, 5.55, 11.1]) b.box(0.12, 7.35, 0.18, x, 4.1, 5.54, b.paint);
    });
  });
  b.feature('unbranded-display-cars', () => {
    for (const [n, x] of [[0, -7], [1, 0], [2, 7]]) displayCar(x, 0.36, 1.7, 0.18, [0xe4e6df, 0xa6b3b7, 0x58656c][n]);
    for (const x of [-5.5, 5.5]) displayCar(x, 4.3, -2.5, -0.18, 0xc4cfcf);
    displayCar(8.5, 0.12, 10.1, Math.PI / 3, 0xb29e80);
  });
  b.shopSign('ยานยนต์ลานแก้ว', 12, 1, 0, 7.11, 5.66);
  b.gardens(2, 6.4, b.paint);
  return { floors: 2, floorSpacing: [4, 3.5], glassBox: true, displayCars: 6, vehicleLogos: false };
}

export function lifestyleMall(b: CommercialBuilder): Record<string, unknown> {
  const colors = b.kit.neutralPalette(b.options.seed), wood = vertexFinish(b.kit.zoneStyle.timber), water = tint('water_river', 0x65bac4);
  b.site(b.stone); b.entrance();
  b.feature('two-storey-curved-roof-lifestyle-mall', () => {
    b.mass(24, 7.45, 8.2, 0, 3.925, -7.1, b.glass);
    b.colored(colors.wall, () => {
      for (const y of [0.25, 4.2, 7.7]) b.box(24.3, 0.15, 8.5, 0, y, -7.1, b.paint);
      for (let i = 0; i < 9; i++) b.box(0.13, 7.35, 0.25, -11.6 + i * 2.9, 3.98, -2.94, b.paint);
    });
    for (const x of [-8, 0, 8]) b.take(b.remap(b.kit.curvedRoof([8, 8.2], { baseY: 7.8, overhang: 0.35, seed: b.options.seed }), ['wood_painted'], wood), x, 0, -7.1);
    for (const x of [-8, 0, 8]) b.shopSign(x ? 'อาหารลานใบไม้' : 'ลานศิลป์ร่วมสมัย', 6.4, 0.8, x, 3.48, -2.82);
  });
  b.feature('fountain-plaza', () => {
    b.cylinder(3.3, 0.23, 0, 0.24, 5.6, b.stone, 32); b.cylinder(2.98, 0.06, 0, 0.39, 5.6, water, 32);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, c = (i + 1) * Math.PI / 8;
      b.pole(point(Math.cos(a) * 3.17, 0.47, 5.6 + Math.sin(a) * 3.17), point(Math.cos(c) * 3.17, 0.47, 5.6 + Math.sin(c) * 3.17), 0.13, b.stone, 6);
    }
    for (const side of [-1, 1]) b.tube([point(0, 2.25, 5.6), point(side * 0.8, 1.8, 5.6), point(side * 1.5, 0.4, 5.6)], 0.038, water, 8, 4);
    b.cylinder(0.22, 1.75, 0, 1.26, 5.6, b.stone, 12);
    for (const x of [-5.6, 5.6]) b.colored(colors.trim, () => {
      b.box(2.6, 0.11, 0.65, x, 0.6, 8.8, wood); b.box(2.6, 0.8, 0.11, x, 1.05, 9.04, wood);
      for (const dx of [-1, 1]) b.box(0.12, 0.52, 0.4, x + dx, 0.34, 8.8, wood);
    });
  });
  b.feature('large-regional-plaza-trees', () => {
    const mix = b.kit.vegetation.filter(tree => !tree.nearWaterOnly && tree.id !== 'veg.banana');
    for (const [n, x] of [[0, -10.8], [1, 10.8]]) b.take(b.kit.bigGardenTree(mix[n % mix.length].id.slice(4),
      { seed: (b.options.seed ?? 1) + n, height: 11.5, radius: 3.5, bark: wood }), x, 0.06, 7.8);
  });
  return { floors: 2, floorSpacing: [4, 3.5], curvedRoofs: 3, fountainPlaza: true, bigTrees: 2, waterAnchor: [0, 2.25, 5.6] };
}
