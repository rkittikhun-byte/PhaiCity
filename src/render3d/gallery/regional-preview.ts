/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Group } from 'three';
import { TILE_M } from '../constants.js';
import { REGIONS, getRegionKit, ROOF_FORMS, WALL_FORMS } from '../regional/index.js';
import { kitPreview, place } from '../regional/geometry.js';
import type { ModelOptions, ModelRegistration } from '../models/registry.js';
import { countTriangles } from '../util/geometry.js';

export function regionalSamples(options: ModelOptions): { id: string; th: string; en: string; factory: (opts?: ModelOptions) => Group }[] {
  const kit = getRegionKit(options.region);
  const roofNames = ['จั่ว', 'จั่วซ้อนสองชั้น', 'ปั้นหยา', 'เพิงหมาแหงน', 'ดาดฟ้ามีขอบ'];
  const wallNames = ['ฝาไหล', 'ฝาปะกน', 'ฟากไม้ไผ่', 'บานเกล็ด', 'ปูนฉาบ'];
  const partNames: Readonly<Record<string, string>> = {
    kalae: 'กาแล', plain_trim: 'ป้านลมเรียบ', bargeboards: 'ป้านลมแกะลาย', fretwork: 'แผงฉลุระเบียง',
    mon_trim: 'ป้านลมมอญซ้อนชั้น', arch: 'ซุ้มโค้งปูนปั้น', pediment: 'หน้าต่างปูนปั้น', malay_gable: 'หน้าจั่วไม้ฉลุ',
    rice_granary: 'หลองข้าว', paper_umbrella: 'ร่มกระดาษ', rice_barn: 'เล้าข้าว', weaving_loom: 'กี่ทอผ้า', bamboo_daybed: 'แคร่ไม้ไผ่',
    dragon_jar: 'โอ่งมังกร', rowing_boat: 'เรือพายผูกท่าน้ำ', spirit_house: 'ศาลพระภูมิประจำบ้าน', fishing_nets: 'ราวตากอวน',
    fruit_crates: 'ลังผลไม้', palm_sugar_pots: 'หม้อตาล', palm_sugar_shed: 'โรงเคี่ยวน้ำตาล', bamboo_fence: 'รั้วไม้ไผ่',
    rubber_rack: 'ราวตากยาง', dove_cage_pole: 'เสาแขวนกรงนกเขา',
  };
  return [
    ...ROOF_FORMS.map((form, i) => ({ id: `kit.${kit.id}.roof.${form}`, th: `หลังคา${roofNames[i]}`, en: `${form} roof`,
      factory: (opts: ModelOptions = {}) => kitPreview(`kit.${kit.id}.roof.${form}`, kit.roofs[form]([4.3, 4.1], { baseY: 0.4, seed: opts.seed })) })),
    ...WALL_FORMS.map((form, i) => ({ id: `kit.${kit.id}.wall.${form}`, th: wallNames[i], en: `${form} wall`,
      factory: (opts: ModelOptions = {}) => kitPreview(`kit.${kit.id}.wall.${form}`, kit.walls[form]({ seed: opts.seed })) })),
    ...Object.entries(kit.ornaments).map(([name, builder]) => ({ id: `kit.${kit.id}.ornament.${name}`, th: partNames[name], en: `${kit.labelEn} · ${name}`,
      factory: (opts: ModelOptions = {}) => kitPreview(`kit.${kit.id}.ornament.${name}`, builder({ seed: opts.seed })) })),
    ...Object.entries(kit.props).map(([name, builder]) => ({ id: `kit.${kit.id}.prop.${name}`, th: partNames[name], en: name.replace(/_/g, ' '),
      factory: (opts: ModelOptions = {}) => kitPreview(`kit.${kit.id}.prop.${name}`, place(builder({ seed: opts.seed, nearWater: true }), 0, 0, 0)) })),
  ];
}

/** Renderer-only comparison: each child retains its own registered model contract. */
export function regionLineup(entry: ModelRegistration): ModelRegistration {
  const spacing = entry.footprint[0] * TILE_M + 2;
  return { ...entry, category: 'ui', regionTier: 'R3', tiles: [], budget: entry.budget * 6,
    footprint: [entry.footprint[0] * 6 + 2, entry.footprint[1]],
    factory: (opts: ModelOptions = {}) => {
      const root = new Group(); root.name = 'preview.six_regions';
      REGIONS.forEach((region, i) => {
        const model = entry.factory({ ...opts, region }); model.position.x = (i - 2.5) * spacing;
        root.add(model);
      });
      root.userData.regions = [...REGIONS]; root.userData.triangles = countTriangles(root); return root;
    },
  };
}
