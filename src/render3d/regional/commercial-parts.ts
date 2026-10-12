/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Color, Float32BufferAttribute } from 'three';
import { vertexFinish, tint } from '../materials/library.js';
import { KitBuilder, point } from './geometry.js';
import { propBuilder } from './props.js';
import { seededRng } from '../rng.js';
import type { GeometryPart } from '../util/geometry.js';
import type { RegionStyle, RoofForm, PartOptions } from './contracts.js';
import type { MaterialKey } from '../materials/library.js';

export interface CommercialStyle {
  wall: MaterialKey; floors: readonly [number, number]; roof: RoofForm; roofMaterial?: MaterialKey;
  balcony: boolean; arcade: boolean; fretwork: boolean; waterfront: boolean; timberUpper: boolean;
  marketNames: readonly string[]; goods: 'mixed' | 'isan' | 'fruit' | 'sugar' | 'south' | 'lanna';
  bakery: boolean;
}
export function commercialStyle(style: RegionStyle): CommercialStyle {
  const id = style.id;
  return Object.freeze({ wall: ['north', 'northeast', 'east', 'west'].includes(id) ? (id === 'north' ? 'wood_teak' : 'wood_painted') : 'plaster_tint',
    floors: (id === 'north' ? [2, 2] : id === 'south' ? [3, 3] : id === 'east' || id === 'west' ? [2, 3] : [3, 4]) as readonly [number, number],
    roof: id === 'central' ? 'flatParapet' : id === 'west' ? 'gable' : style.roofForm,
    roofMaterial: id === 'west' ? 'roof_metal_rusty' : undefined, balcony: ['north', 'east', 'west'].includes(id),
    arcade: id === 'south', fretwork: id === 'east', waterfront: id === 'east', timberUpper: id === 'northeast',
    bakery: id === 'northeast',
    marketNames: {
      north: ['ตลาดร่มไม้', 'ขนมพื้นบ้าน', 'ผ้าทอริมสวน', 'ชาร้อนบ้านเหนือ'],
      northeast: ['ไก่ย่างหลังสวน', 'ส้มตำครกน้อย', 'ข้าวเหนียวอุ่น', 'อาหารบ้านทุ่ง'],
      central: ['ตลาดลานเย็น', 'ข้าวแกงบ้านอุ่น', 'ของใช้ริมซอย', 'น้ำผลไม้สด'],
      east: ['ผลไม้ตามฤดู', 'ทุเรียนสวนฝน', 'มังคุดบ้านคลอง', 'เงาะสวนลม'],
      west: ['น้ำตาลบ้านตาล', 'ขนมหวานลานไม้', 'หม้อดินบ้านสวน', 'ขนมหม้อแกง'],
      south: ['โรตีลานลม', 'ไก่ทอดบ้านสวน', 'ปลาสดบนหาด', 'ครัวใบจาก'],
    }[id], goods: { north: 'lanna', northeast: 'isan', central: 'mixed', east: 'fruit', west: 'sugar', south: 'south' }[id] as CommercialStyle['goods'],
  });
}

/** Regional goods and furniture use baked colors without multiplying batches. */
function color(parts: GeometryPart[], value: number): void {
  const rgb = new Color(value);
  parts.forEach(p => { const a = new Float32Array(p.geometry.getAttribute('position').count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = rgb.r; a[i + 1] = rgb.g; a[i + 2] = rgb.b; }
    p.geometry.setAttribute('color', new Float32BufferAttribute(a, 3)); });
}
export function marketStallParts(style: RegionStyle, options: PartOptions = {}): GeometryPart[] {
  const b = new KitBuilder(), fabric = vertexFinish('fabric_canvas'), wood = tint('wood_painted', 0x725a42);
  b.box(2.6, 0.13, 1.45, 0, 0.95, 0, wood);
  for (const x of [-1.08, 1.08]) for (const z of [-0.52, 0.52]) b.box(0.09, 0.88, 0.09, x, 0.44, z, wood);
  if (style.id === 'north') {
    const umbrella = propBuilder(style, 'paper_umbrella')({ seed: options.seed });
    umbrella.forEach(p => { p.material = p.material.userData.materialKey === 'fabric_canvas' ? fabric : wood; });
    color(umbrella, options.color ?? 0xd48656); b.parts.push(...umbrella);
  } else {
    b.box(0.075, 2.78, 0.075, 0, 1.39, -0.4, wood);
    const first = b.parts.length;
    const n = point(0, 3.02, -0.4), corners = [point(-1.55, 2.65, -1.8), point(1.55, 2.65, -1.8), point(1.55, 2.65, 1), point(-1.55, 2.65, 1)];
    for (let i = 0; i < 4; i++) b.face([corners[i], n, corners[(i + 1) % 4]], fabric);
    color(b.parts.slice(first), options.color ?? 0xdf8147);
  }
  return b.parts;
}
export function marketGoodsParts(style: RegionStyle, options: PartOptions = {}): GeometryPart[] {
  const b = new KitBuilder(), mat = vertexFinish('fabric_canvas'), kind = commercialStyle(style).goods;
  const rng = seededRng(options.seed);
  const item = (paint: number, make: () => void): void => { const first = b.parts.length; make(); color(b.parts.slice(first), paint); };
  const fruit = (x: number, z: number, paint: number, shape = 'round'): void => item(paint, () => {
    x += (rng() - 0.5) * 0.08; z += (rng() - 0.5) * 0.06;
    b.ellipsoid(point(x, 1.15, z), point(shape === 'durian' ? 0.23 : 0.15, shape === 'durian' ? 0.3 : 0.15, 0.18), mat, 6, 3);
    if (shape === 'durian') for (let n = 0; n < 5; n++) b.box(0.07, 0.07, 0.06, x - 0.15 + n * 0.07, 1.35, z, mat, 0.5);
  });
  if (kind === 'fruit') {
    for (let i = 0; i < 3; i++) item(0xa48457, () => { b.box(0.65, 0.16, 0.8, -0.82 + i * 0.82, 1.05, 0, mat); });
    for (let i = 0; i < 6; i++) fruit(-0.9 + (i % 3) * 0.83, -0.2 + Math.floor(i / 3) * 0.4, [0x9a9c49, 0x633c72, 0xc85d47][i % 3], i % 3 === 0 ? 'durian' : 'round');
  } else if (kind === 'south' || kind === 'isan') {
    item(0x465457, () => b.box(1.3, 0.14, 0.62, -0.45, 1.1, 0, mat));
    for (let i = 0; i < 4; i++) item(kind === 'south' ? 0xb9d6d8 : 0xb87936, () => b.ellipsoid(point(-0.88 + i * 0.29, 1.24, 0), point(0.1, 0.08, 0.24), mat, 6, 3));
    for (let i = 0; i < 3; i++) item(0xebddae, () => b.ellipsoid(point(0.65, 1.13 + i * 0.06, 0.1), point(0.25, 0.04, 0.25), mat, 8, 3));
    if (kind === 'isan') item(0xbaa273, () => b.ellipsoid(point(0.8, 1.31, -0.4), point(0.22, 0.26, 0.22), mat, 8, 4));
  } else if (kind === 'sugar') {
    for (let i = 0; i < 3; i++) item(0x94653c, () => b.ellipsoid(point(-0.8 + i * 0.8, 1.2, 0), point(0.23, 0.25, 0.23), mat, 8, 4));
    for (let i = 0; i < 3; i++) item(0xe4bd67, () => b.box(0.32, 0.11, 0.45, -0.7 + i * 0.7, 1.13, 0.48, mat));
  } else {
    for (let i = 0; i < 5; i++) fruit(-0.95 + i * 0.46, 0, i % 2 ? 0xdcab54 : 0x669b54);
    if (kind === 'lanna') item(0x5a8b92, () => b.box(1.2, 0.04, 0.7, 0, 1.05, 0.25, mat));
  }
  return b.parts;
}

/** Vietnamese-style baguettes and breakfast bowls in the northeastern timber/concrete row. */
export function bakeryDisplayParts(style: RegionStyle): GeometryPart[] {
  if (style.id !== 'northeast') return [];
  const b = new KitBuilder(), mat = vertexFinish('fabric_canvas');
  for (let i = 0; i < 4; i++) {
    const first = b.parts.length;
    b.ellipsoid(point(-0.8 + i * 0.5, 1.05, 0), point(0.14, 0.13, 0.48), mat, 8, 4);
    color(b.parts.slice(first), 0xdba45b);
    for (let n = 0; n < 3; n++) { const start = b.parts.length; b.box(0.13, 0.03, 0.035, -0.8 + i * 0.5, 1.17, -0.22 + n * 0.22, mat, 0.25); color(b.parts.slice(start), 0xead5a4); }
  }
  const first = b.parts.length; b.ellipsoid(point(0.6, 1.1, 0.68), point(0.24, 0.1, 0.24), mat, 8, 4); color(b.parts.slice(first), 0xe6e0c5);
  return b.parts;
}
