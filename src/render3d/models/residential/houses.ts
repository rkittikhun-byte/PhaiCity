/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, BoxGeometry } from 'three';
import { getMaterial, roadConcrete, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { seededRng } from '../../rng.js';
import { getRegionKit } from '../../regional/index.js';
import { KitBuilder, place, point } from '../../regional/geometry.js';
import type { HouseStyleId, HouseStyle } from '../../regional/house-styles.js';
import type { RoofForm } from '../../regional/contracts.js';
import type { GeometryPart } from '../../util/geometry.js';
import { beveledBox } from '../../util/geometry.js';
import { LAND_LABELS, PlotBuilder } from '../plot/builder.js';
import { buildConstructionStage } from '../plot/construction.js';
import type { ModelOptions } from '../registry.js';

export const HOUSE_IDS = ['res.house_0_0', 'res.house_0_1', 'res.house_0_2', 'res.house_1_0', 'res.house_1_1', 'res.house_1_2',
  'res.house_2_0', 'res.house_2_1', 'res.house_2_2', 'res.house_3_0', 'res.house_3_1', 'res.house_3_2'] as const;
export const HOUSE_TIERS = ['R1', 'R1', 'R2', 'R1', 'R1', 'R2', 'R2', 'R2', 'R2', 'R2', 'R1', 'R1'] as const;
const VERNACULAR: Partial<Record<number, HouseStyleId>> = { 0: 'shack', 1: 'stilt', 3: 'mixed', 4: 'concrete', 10: 'traditional', 11: 'heritage' };
interface Component { role: string; min: number[]; max: number[]; triangles: number }

export function createHouse(index: number, options: ModelOptions = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= HOUSE_IDS.length) throw new RangeError('Unknown house index');
  if (options.state === 'stage_1' || options.state === 'stage_2') {
    const pb = new PlotBuilder(options, 3);
    const meta = buildConstructionStage(pb, options.state, 'residential', 1, [1, 1]);
    return pb.finishPlot(HOUSE_IDS[index], 'residential', HOUSE_TIERS[index], 1, LAND_LABELS, meta, [1, 1]);
  }
  const kit = getRegionKit(options.region), rng = seededRng(options.seed), propRng = seededRng((options.seed ?? 1) ^ 0x713a),
    b = new KitBuilder(), components: Component[] = [];
  const styleId = VERNACULAR[index], traditional = styleId !== undefined;
  const modern: HouseStyle = { width: index === 2 ? 4.3 : index === 5 ? 5.3 : 5.6, depth: index === 2 ? 3.8 : 4.2,
    floor: 0.16, storeys: index === 2 ? 1 : 2, roof: index === 9 ? 'flatParapet' : kit.defaults.roofForm,
    roofMaterial: index === 2 ? 'roof_metal_corrugated' : index === 9 ? 'concrete_weathered' : kit.defaults.roofMaterial,
    wall: 'plaster', wallMaterial: index === 2 ? 'concrete_raw' : 'plaster_tint', finish: 'plaster',
    props: [], plants: [kit.vegetation.find(p => !p.nearWaterOnly)!.id.slice(4)] };
  const s = styleId ? kit.houses[styleId] : modern;
  const color = styleId ? kit.housePalette(styleId, options.seed) : kit.palette.pick(options.seed, s.finish), wallColor = color.wall;
  const wood = tint('wood_painted', color.trim), wallMat = index === 2 ? roadConcrete(0x96938d + Math.floor(rng() * 5) * 0x040404) : tint(s.wallMaterial, wallColor);
  const concrete = index === 2 ? wallMat : getMaterial('concrete_raw'), glass = getMaterial('glass_tinted');
  const groundMat = getMaterial('grass'), zCenter = -0.9, front = zCenter + s.depth / 2;
  const floor = s.floor + 0.1, bodyHeight = s.storeys * 3 - 0.3, top = floor + bodyHeight;
  const feature = (role: string, build: () => void): void => {
    const first = b.parts.length; build(); const bounds = new Box3(); let triangles = 0;
    b.parts.slice(first).forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!);
      triangles += (p.geometry.index?.count ?? p.geometry.getAttribute('position').count) / 3; });
    if (b.parts.length > first) components.push({ role, min: bounds.min.toArray(), max: bounds.max.toArray(), triangles });
  };
  const add = (parts: GeometryPart[], x = 0, y = 0, z = 0, scale = 1): void => { b.parts.push(...place(parts, x, y, z, scale)); };
  const gardenProp = (parts: GeometryPart[], x: number, y: number, z: number, scale: number): void => {
    const yaw = (propRng() - 0.5) * 0.16;
    parts.forEach(part => part.geometry.rotateY(yaw));
    add(parts, x + (propRng() - 0.5) * 0.16, y, z + (propRng() - 0.5) * 0.16, scale);
  };
  feature('yard', () => b.box(9, 0.08, 9, 0, 0.04, 0, groundMat));
  feature('body', () => {
    if (s.floor > 0.4) {
      b.box(s.width, 0.16, s.depth, 0, floor, zCenter, wood);
      for (const x of [-s.width / 2 + 0.15, 0, s.width / 2 - 0.15]) for (const z of [zCenter - s.depth / 2 + 0.15, front - 0.15])
        b.box(0.18, floor, 0.18, x, floor / 2, z, s.postMaterial ? getMaterial(s.postMaterial) : wood);
    } else b.box(s.width + 0.2, 0.22, s.depth + 0.2, 0, 0.19, zCenter, traditional ? wood : concrete);
    if (styleId === 'mixed') {
      if (!s.openGround) b.box(s.width, 2.82, s.depth, 0, floor + 1.4, zCenter, concrete);
      else for (const x of [-s.width / 2 + 0.15, s.width / 2 - 0.15]) for (const z of [zCenter - s.depth / 2 + 0.15, front - 0.15])
        b.box(0.25, 3, 0.25, x, floor + 1.5, z, concrete);
      b.box(s.width, 0.16, s.depth, 0, floor + 3, zCenter, concrete);
      b.box(s.width, 2.7, s.depth, 0, floor + 4.35, zCenter, wallMat);
    } else {
      const body = beveledBox(s.cluster ? 2.65 : s.width, bodyHeight, s.depth, 0.035).translate(s.cluster ? -1.55 : 0, floor + bodyHeight / 2, zCenter);
      b.add(body, wallMat);
    }
    if (s.cluster) { // Central applied house: attached second pavilion with a lower ridge.
      b.box(2.4, 2.45, 3.45, 1.75, floor + 1.22, zCenter, wallMat);
    }
    if (index === 2) for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++)
      b.box(0.58, 0.4, 0.06, (col - 3) * 0.605, floor + 0.23 + row * 0.44, front + 0.05, wallMat);
  });
  feature('regional-wall', () => {
    if (!traditional || s.wall === 'plaster') return;
    const panelHeight = styleId === 'mixed' ? 2.7 : Math.min(bodyHeight, 2.7), y = styleId === 'mixed' ? floor + 3 : floor;
    const parts = kit.walls[s.wall]({ width: s.width - 0.24, height: panelHeight, seed: options.seed });
    parts.forEach(p => {
      if (['wood_teak', 'wood_painted', 'bamboo_split'].includes(p.material.userData.materialKey) &&
        p.material !== wood) p.material = wallMat;
    });
    add(parts, 0, y, front + 0.07);
  });
  feature('roof', () => {
    const roof = (form: RoofForm, width: number, depth: number, base: number, x = 0, z = zCenter, ornament = true): void => {
      add(kit.roofs[form]([width, depth], { baseY: base, overhang: index === 8 ? 0.8 : 0.4,
        seed: options.seed, material: s.roofMaterial, ornaments: ornament, trimColor: color.trim }), x, 0, z);
      if (form === 'gable') for (const side of [-1, 1]) {
        const y = base + Math.tan(kit.defaults.pitch * Math.PI / 180) * (index === 8 ? 0.8 : 0.4);
        const rise = Math.tan(kit.defaults.pitch * Math.PI / 180) * width / 2;
        const end = z + side * depth / 2;
        const panel = [point(x - width / 2, base - 0.05, end), point(x + width / 2, base - 0.05, end),
          point(x + width / 2, y, end), point(x, y + rise, end), point(x - width / 2, y, end)];
        b.panel(side > 0 ? panel : panel.reverse(), point(0, 0, side), 0.07, wallMat);
      }
    };
    if (s.cluster) { roof('gable', 2.65, s.depth, top, -1.55); roof('gable', 2.4, 3.45, floor + 2.55, 1.65); }
    else if (s.layeredHip) {
      roof('hip', s.width, s.depth, top - 0.35, 0, zCenter, false);
      b.box(s.width * 0.69, 1.6, s.depth * 0.69, 0, top + 0.45, zCenter, wallMat);
      roof('hip', s.width * 0.69, s.depth * 0.69, top + 1.25, 0, zCenter, false);
    }
    else roof(s.roof, s.width, s.depth, top, 0, zCenter, index !== 0 && index !== 2 && index !== 9);
  });
  feature('windows-door', () => {
    const windowMat = index === 2 ? wood : traditional && s.wall !== 'plaster' ? s.shutterColor !== undefined ? tint('wood_painted', color.shutter) : wallMat : glass;
    for (let level = 0; level < s.storeys; level++) for (const x of [-s.width * 0.29, s.width * 0.29]) {
      const y = floor + level * 3 + 1.5;
      b.box(index === 9 ? 1.95 : 0.92, index === 9 ? 1.9 : 1.15, 0.08, x, y, front + 0.25, windowMat);
      if (traditional) {
        for (const dx of [-0.6, 0.6]) b.box(0.22, 1.18, 0.1, x + dx, y, front + 0.27, s.shutterColor !== undefined ? tint('wood_painted', color.shutter) : wood);
        if (s.ventPanel) for (let j = 0; j < 4; j++) b.box(0.94, 0.07, 0.06, x, y - 0.4 + j * 0.25, front + 0.32, wood);
      } else b.box(1.02, 0.07, 0.16, x, y - 0.6, front + 0.28, wood);
      if (s.pediments) add(kit.ornaments.pediment({ width: 1.06, seed: options.seed, color: color.trim }), x, y + 0.63, front + 0.3);
      if (s.windowFret) add(kit.ornaments.fretwork({ width: 1.1, height: 0.42, seed: options.seed, color: color.trim, detail: 'low' }), x, y + 0.63, front + 0.3);
    }
    for (const x of index === 7 ? [-0.55, 0.55] : [0]) b.box(index === 7 ? 0.7 : 0.86, 2.02, 0.1, x, floor + 1.03, front + 0.24, wood);
    if (index === 9) for (const x of [-s.width / 2 - 0.035, s.width / 2 + 0.035]) b.box(0.07, 2.05, 2.1, x, floor + 1.5, zCenter, glass);
  });
  feature('terrace', () => {
    if (!traditional) return;
    const y = floor - (s.terraceDrop ?? 0);
    const d = s.cluster ? 1.9 : 1.25;
    b.box(s.width, 0.13, d, 0, y, front + d / 2 + 0.08, wood);
    if (s.wrapVeranda) for (const side of [-1, 1]) {
      b.box(0.85, 0.14, s.depth + 1.3, side * (s.width / 2 + 0.48), y, zCenter + 0.45, wood);
      for (const z of [zCenter - s.depth / 2, front + 1.25]) b.box(0.12, 2.7, 0.12, side * (s.width / 2 + 0.75), y + 1.35, z, wood);
    }
    if (s.balcony === 'fretwork') {
      for (const side of [-1, 1]) add(kit.ornaments.fretwork({ width: s.width / 2 - 0.65, height: 0.85, seed: options.seed, color: color.trim, detail: 'low' }), side * (s.width / 4 + 0.35), y + 0.05, front + d + 0.09);
    } else if (s.balcony === 'open') for (const side of [-1, 1]) {
      b.box(s.width / 2 - 0.6, 0.1, 0.1, side * (s.width / 4 + 0.32), y + 0.85, front + d, wood);
      for (let j = 0; j < 3; j++) b.box(0.07, 0.78, 0.07, side * (0.8 + j * (s.width / 2 - 0.9) / 2), y + 0.43, front + d, wood);
    }
    const run = Math.min(1.6, 4.25 - (front + d));
    const steps = Math.max(2, Math.ceil(y / 0.3));
    for (let i = 0; i < steps; i++) b.box(0.98, y * (i + 1) / steps, run / steps + 0.02, 0, y * (i + 1) / steps / 2,
      front + d + run * (1 - (i + 0.5) / steps), wood);
    if (s.arches) for (const x of [-1.4, 1.4]) add(kit.ornaments.arch({ width: 2.2, height: 1.8, seed: options.seed }), x, y + 0.08, front + 1.05);
    if (s.fretEaves) add(kit.ornaments.fretwork({ width: s.width, height: 0.45, seed: options.seed, color: color.trim, detail: 'low' }), 0, top - 0.48, front + 0.15);
    if (s.malayGable) add(kit.ornaments[kit.defaults.ridgeOrnament]({ width: 2, height: 0.65, seed: options.seed }), 0, top - 0.2, front + 0.22);
  });
  feature('fence', () => {
    const mat = s.grilleFence ? tint('metal_steel', 0x575b57) : wood;
    for (const x of [-4.35, 4.35]) {
      b.box(0.09, 0.18, 8.7, x, 0.34, 0, mat);
      b.box(0.09, 0.12, 8.7, x, 0.99, 0, mat);
      for (const z of [-4.35, -1.5, 1.5, 4.35]) b.box(0.13, 1.05, 0.13, x, 0.565, z, mat);
    }
    b.box(8.7, 0.18, 0.09, 0, 0.34, -4.35, mat);
    b.box(8.7, 0.12, 0.09, 0, 0.99, -4.35, mat);
    for (const side of [-1, 1]) {
      b.box(3.5, 0.18, 0.09, side * 2.6, 0.34, 4.35, mat);
      b.box(3.5, 0.12, 0.09, side * 2.6, 0.99, 4.35, mat);
      for (let j = 0; j < 4; j++) b.box(0.07, 0.95, 0.07, side * (0.9 + j * 1.12), 0.565, 4.35, mat);
    }
    if (s.grilleFence) for (const x of [-3.6, -1.7, 1.7, 3.6]) b.box(0.17, 1.17, 0.17, x, 0.625, 4.3, wallMat);
  });
  feature('entrance', () => b.box(1.55, 0.05, Math.max(0.4, 4.4 - front), 0, 0.1, (4.4 + front) / 2, traditional ? wood : concrete));
  feature('regional-props', () => {
    s.props.forEach(p => {
      const parts = kit.props[p.kind]({ seed: options.seed, detail: 'low' });
      parts.forEach(part => { if (s.wall === 'plaster' && part.material.userData.materialKey === 'concrete_weathered') part.material = wallMat; });
      gardenProp(parts, p.x, p.y ?? 0.08, p.z, p.scale);
    });
    if (!traditional) {
      // Compact domestic props keep the R2 silhouette fixed and share trim / foliage finishes.
      const kind = kit.modernHouseProp;
      const parts = kit.props[kind]({ seed: options.seed, detail: 'low' });
      // Tiny garden furnishings share the building's wood finish; keep large regional features textured.
      parts.forEach(p => { if (p.material.userData.materialKey === 'bamboo_split') p.material = wood; });
      gardenProp(parts, -3.5, 0.08, index === 9 ? -2.7 : 2.45, 0.4);
    }
    if (s.laundry) {
      for (const x of [-2, 2]) b.box(0.06, 1.5, 0.06, x, 0.83, -3.45, wood);
      b.box(4, 0.025, 0.025, 0, 1.5, -3.45, wood);
      for (let i = 0; i < 3; i++) b.box(0.5, 0.65, 0.025, -1.1 + i * 1.1, 1.2, -3.45, tint('fabric_canvas', color.shutter));
    }
  });
  feature('greenery', () => {
    s.plants.forEach((kind, i) => add(kit.gardenPlant(kind, { seed: (options.seed ?? 1) + i, height: Math.min(3.8, top - 0.2), radius: 0.57, bark: wood }),
      i % 2 === 0 ? 3.55 : -3.55, 0.08, i < 2 ? 3.15 : -3.45));
    if (s.hedge) for (const side of [-1, 1]) add(kit.gardenPlant('hedge', { seed: options.seed }), side * 2.6, 0.08, 4.08);
  });
  feature('modern-fixtures', () => {
    if (traditional) return;
    if (index === 2) {
      b.box(2.5, 0.8, 0.7, 0, 0.51, front + 0.75, wood);
      b.box(2.7, 0.12, 1.15, 0, 2.2, front + 0.65, tint('fabric_canvas', color.shutter));
      // Canvas signs use a normalized atlas, rather than repeated world UVs.
      b.add(new BoxGeometry(2.2, 0.5, 0.06).translate(0, 1.75, front + 1.15),
        thaiSign(rng() < 0.5 ? 'ของชำ' : 'ของใช้ในบ้าน', 0xe4ddc3, 0x173f35, [2.2, 0.5]));
      for (let i = 0; i < 3; i++) b.box(0.5, 0.25, 0.45, -0.75 + i * 0.75, 1.05, front + 0.76, wood);
    }
    if (index === 5) {
      const gate = tint('metal_painted', color.trim);
      for (let i = 0; i < 8; i++) b.box(0.09, 2.15, 0.07, -1.65 + i * 0.48, 1.32, front + 0.35, gate, (i % 2 ? 1 : -1) * 0.13);
      b.box(4.8, 0.12, 0.95, 0, 2.6, front + 0.5, wood);
      const side = rng() < 0.5 ? -1 : 1;
      b.box(0.3, 0.65, 0.95, side * (s.width / 2 + 0.15), 4.1, zCenter + 0.75, concrete);
      for (let i = 0; i < 4; i++) b.box(0.06, 0.05, 0.8, side * (s.width / 2 + 0.33), 3.9 + i * 0.11, zCenter + 0.75, wood);
      for (const y of [1.7, 4.7]) for (const z of [-1.65, 0.15]) b.box(0.08, 1.15, 0.95, s.width / 2 + 0.08, y, z, glass);
      b.box(0.85, 0.12, 3.6, s.width / 2 + 0.25, 2.6, zCenter + 0.35, wood);
    }
    if (index === 6) {
      b.box(3, 0.16, 2.35, 1.15, 2.55, front + 1.3, wood);
      for (const x of [-0.2, 2.55]) b.box(0.13, 2.4, 0.13, x, 1.3, front + 2.3, concrete);
    }
    if (index === 7) {
      b.box(0.12, bodyHeight, s.depth + 0.1, 0, floor + bodyHeight / 2, zCenter, wood);
      for (const x of [-1.8, 1.8]) for (let i = 0; i < 5; i++) b.box(1.25, 0.09, 0.4, x, 4.05 + i * 0.28, front + 0.4, wood);
    }
    if (index === 8) for (let i = 0; i < 14; i++) b.box(0.12, 2.7, 0.1, -2.5 + i * 0.385, 1.73, front + 0.37, wood);
    if (index === 9) {
      const water = tint('water_river', 0x64bfc4);
      b.box(2.15, 0.07, 1.8, 2.4, 0.16, 2.65, water);
      for (const x of [1.27, 3.53]) b.box(0.16, 0.26, 2.1, x, 0.21, 2.65, concrete);
      for (const z of [1.63, 3.67]) b.box(2.4, 0.26, 0.16, 2.4, 0.21, z, concrete);
    }
  });
  // Poolside paving and the concrete plinth share one stone finish on the luxury house.
  if (index === 9) {
    const roofStone = b.parts.find(p => p.material.userData.materialKey === 'concrete_weathered')!.material;
    b.parts.forEach(p => { if (p.material === concrete) p.material = roofStone; });
  }
  if (index === 5) b.parts.forEach(p => { if (p.material === concrete) p.material = wallMat; });
  const root = b.finish(HOUSE_IDS[index], 'residential', [1, 1], [249 + index], options);
  Object.assign(root.userData, { regionTier: HOUSE_TIERS[index], kit: kit.id, houseStyle: styleId ?? 'modern',
    components, roofForm: s.roof, plants: [...s.plants], props: s.props.map(p => p.kind),
    bodyEnvelope: [s.width, bodyHeight, s.depth, floor], entranceGap: [-0.82, 0.82], landValue: Math.floor(index / 3), style: index % 3 });
  return root;
}
