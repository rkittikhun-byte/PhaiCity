/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { getMaterial, tint } from '../../materials/library.js';
import { KitBuilder, point } from '../../regional/geometry.js';
import { catenaryWire } from '../../util/geometry.js';
import { seededRng } from '../../rng.js';
import { regionalLeafColor } from '../../regional/vegetation.js';
import { ZoneBuilder } from './zone-builder.js';

export function buildCommunity(b: ZoneBuilder): Record<string, unknown> {
  const kit = b.kit, colors = kit.palette.pick(b.options.seed), wood = tint(kit.zoneStyle.timber, colors.wall), cloth = tint('fabric_canvas', 0xb8c0aa);
  const canal = kit.zoneStyle.canalCommunity && seededRng(b.options.seed)() < 0.45;
  b.stone = wood;
  b.site(getMaterial('dirt_laterite'), wood); b.entrance(wood);
  b.feature('community-houses', () => {
    for (let i = 0; i < 9; i++) {
      const parts = kit.communityHouse(i % 3 === 0 ? 'stilt' : 'shack', { seed: b.options.seed, twoStoreys: i % 3 === 0 });
      parts.forEach(p => p.geometry.scale(1.4, 1, 1.3));
      b.take(parts, (i % 3 - 1) * 7.2, 0.05, (Math.floor(i / 3) - 1) * 7.2, (i % 3 - 1) * 0.07);
    }
  });
  b.feature('walkways-laundry-wires', () => {
    for (const x of [-3.6, 3.6]) b.box(1.15, 0.09, 24, x, 0.12, 0, wood);
    for (const z of [-3.6, 3.6]) b.box(22, 0.08, 0.8, 0, 0.12, z, wood);
    for (const z of [-11.6, 11.6]) b.pole(point(2.6, 0.06, z), point(2.6, 6.6, z), 0.07, b.metal, 5);
    for (let i = 0; i < 5; i++) b.add(catenaryWire(point(2.6 + i * 0.1, 6.3 - i * 0.4, -11.6), point(2.6 + i * 0.1, 6.3 - i * 0.4, 11.6), 0.22 + i * 0.05, 0.018, 8), b.metal);
    for (let line = 0; line < 3; line++) {
      const z = -4 + line * 4;
      b.pole(point(-3.15, 2.2, z), point(3.15, 2.2, z), 0.017, b.metal, 3);
      for (let item = 0; item < 4; item++) b.box(0.67, 0.73, 0.025, -2.3 + item * 1.5, 1.88, z, cloth);
    }
  });
  if (canal) b.feature('canal-edge', () => {
    b.box(25.4, 0.05, 2.1, 0, 0.105, -12.65, tint('water_river', 0x648175));
    for (const x of [-7.2, 0, 7.2]) { b.box(0.75, 0.09, 2.4, x, 0.26, -11.15, wood);
      b.box(0.14, 0.28, 0.14, x, 0.14, -12.1, wood); }
  });
  b.parking(3, wood, true); b.gardens(2, 4.2, wood);
  return { houseCount: 9, houseTemplates: ['res.house_0_0', 'res.house_0_1'], storeys: [1, 2], canalEdge: canal };
}

export function buildRows(b: ZoneBuilder, floors: 2 | 3, old: boolean): Record<string, unknown> {
  const kit = b.kit, colors = old ? kit.palette.pick(b.options.seed) : floors === 3 ? kit.neutralPalette(b.options.seed) : kit.palette.pick(b.options.seed, 'plaster');
  const wall = tint(old ? kit.zoneStyle.rowWall : 'plaster_tint', colors.wall), trim = tint('wood_painted', colors.trim);
  b.site(b.stone, b.stone); b.entrance();
  b.feature('lane', () => b.box(5.3, 0.04, 28.7, 0, 0.09, 0, b.stone));
  b.feature('row-houses', () => {
    const unit = new KitBuilder(), width = 4.25, depth = 5.7, top = floors * 3 - 0.1;
    unit.box(width, top - 0.1, depth, 0, (top + 0.1) / 2, 0, wall);
    unit.parts[0].geometry.userData.structuralBody = true;
    unit.box(width, 0.14, depth + 0.1, 0, 3, 0, trim);
    const roof = kit.roofs[old ? kit.zoneStyle.rowRoof : kit.defaults.roofForm]([width, depth], { baseY: top,
      pitch: 24, overhang: 0.18, seed: b.options.seed, material: old ? kit.zoneStyle.rowRoofMaterial : kit.defaults.roofMaterial,
      ornaments: old && kit.zoneStyle.rowOrnaments, trimColor: colors.trim, detail: 'low' });
    unit.parts.push(...roof);
    if ((old ? kit.zoneStyle.rowRoof : kit.defaults.roofForm) === 'gable') for (const side of [-1, 1]) {
      const vertices = [point(-width / 2, top, side * depth / 2), point(width / 2, top, side * depth / 2), point(0, top + (width / 2 + 0.18) * Math.tan(24 * Math.PI / 180), side * depth / 2)];
      unit.face(side > 0 ? vertices : vertices.reverse(), wall);
    }
    for (let floor = 0; floor < floors; floor++) for (const x of [-1.08, 1.08]) {
      unit.box(0.95, 1.3, 0.055, x, 1.7 + floor * 3, depth / 2 + 0.08, b.glass);
      unit.box(1.1, 0.08, 0.19, x, 1.03 + floor * 3, depth / 2 + 0.12, trim);
      if (floors === 3 && floor > 0) for (let slat = 0; slat < 2; slat++) unit.box(0.07, 1.4, 0.08, x - 0.32 + slat * 0.64, 1.7 + floor * 3, depth / 2 + 0.19, trim);
    }
    for (let panel = 0; panel < 6; panel++) unit.box(0.38, 2.18, 0.075, -1.2 + panel * 0.48, 1.2, depth / 2 + 0.15, old ? trim : b.metal, panel % 2 ? 0.09 : -0.09);
    if (old && kit.zoneStyle.rowPanel !== 'plaster') {
      const panel = kit.walls[kit.zoneStyle.rowPanel]({ width: width - 0.15, height: 2.65, seed: b.options.seed, detail: 'low' });
      panel.forEach(p => { p.material = p.material.userData.materialKey === kit.zoneStyle.rowWall ? wall : trim; p.geometry.translate(0, 3.05, depth / 2 + 0.035); }); unit.parts.push(...panel);
    }
    if (old && kit.zoneStyle.rowFretwork) {
      unit.box(width, 0.13, 0.8, 0, 3.03, depth / 2 + 0.48, trim);
      const fret = kit.ornaments.fretwork({ width: width - 0.1, height: 0.85, seed: b.options.seed, color: colors.trim, detail: 'low' });
      fret.forEach(p => p.geometry.translate(0, 3.1, depth / 2 + 0.87)); unit.parts.push(...fret);
    }
    if (old && kit.zoneStyle.arcade) {
      unit.box(width, 0.14, 1.2, 0, 3.04, depth / 2 + 0.66, wall);
      const arches = kit.ornaments.arch({ width: 2.55, height: 1.8, seed: b.options.seed, color: colors.trim });
      arches.forEach(p => p.geometry.translate(0, 0.12, depth / 2 + 1.12)); unit.parts.push(...arches);
    }
    if (!old) {
      unit.box(width - 0.12, 0.1, 3.65, 0, 2.6, depth / 2 + 1.84, tint('roof_metal_sheet', 0xaeb3ad));
      for (const x of [-1.9, 1.9]) unit.box(0.08, 2.4, 0.08, x, 1.3, depth / 2 + 3.5, b.metal);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) b.place(unit.parts, side * (old ? 7.25 : 8.5), 0, -9.2 + i * 4.6, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    unit.parts.forEach(p => p.geometry.dispose());
  });
  if (!old) b.feature('covered-car-parking', () => { for (const side of [-1, 1]) for (const z of [-4.6, 4.6]) b.car(side * 3.85, z, trim, side < 0 ? Math.PI / 2 : -Math.PI / 2); });
  b.parking(old ? 3 : 4, trim, true, 12.3); b.gardens(2, 4.3, trim);
  return { unitCount: 10, rows: 2, floors, facingCourtyard: true, arcade: old && kit.zoneStyle.arcade, coveredCarports: !old, parkedCars: old ? 0 : 4 };
}

export function buildApartmentL(b: ZoneBuilder): Record<string, unknown> {
  const colors = b.kit.palette.pick(b.options.seed, 'plaster'), wall = tint('plaster_tint', colors.wall), trim = tint('wood_painted', colors.trim);
  b.site(b.stone, b.stone); b.entrance();
  b.feature('body', () => { b.mass(6, 11.7, 20, -8, 6, -1, wall); b.mass(18, 11.7, 6, 1, 6, -8, wall); });
  b.feature('regional-roof', () => {
    b.take(b.kit.roofs[b.kit.defaults.roofForm]([6, 20], { baseY: 11.85, seed: b.options.seed, pitch: 14, overhang: 0.18, ornaments: false }), -8, 0, -1);
    b.take(b.kit.roofs[b.kit.defaults.roofForm]([6, 18], { baseY: 11.85, seed: b.options.seed, pitch: 14, overhang: 0.18, ornaments: false }), 1, 0, -8, Math.PI / 2);
  });
  b.feature('corridors-windows', () => {
    b.facade(18, 6, 4, 6, 1, -8, wall, { balcony: true, both: false });
    const wing = new ZoneBuilder(b.options); wing.facade(20, 6, 4, 6, 0, 0, wall, { balcony: true, both: false });
    b.take(wing.parts, -8, 0, -1, Math.PI / 2);
  });
  b.feature('coin-laundry', () => {
    for (let i = 0; i < 4; i++) { const x = -2.8 + i * 1.35;
      b.box(0.95, 1.25, 0.75, x, 0.79, -3.95, b.stone);
      const washer = new KitBuilder(); washer.pole(point(0, 0, -0.04), point(0, 0, 0.04), 0.31, b.metal, 10);
      b.take(washer.parts, x, 0.78, -3.5); b.box(0.17, 0.09, 0.03, x + 0.25, 1.24, -3.54, trim);
    }
    b.sign('ห้องว่าง', 3.9, 0.95, 1, 2.52, -3.94);
  });
  b.parking(4, trim, true, 9.5); b.gardens(2, 4.6, trim);
  return { floors: 4, footprintForm: 'L', coinWashers: 4 };
}

export function buildEstate(b: ZoneBuilder, luxury: boolean): Record<string, unknown> {
  const colors = b.kit.palette.pick(b.options.seed, 'plaster'), wall = tint('plaster_tint', colors.wall), trim = tint('wood_painted', colors.trim);
  b.site(getMaterial('grass'), b.stone); b.entrance();
  b.feature('soi', () => b.box(4.4, 0.04, 28.5, 0, 0.095, 0, b.stone));
  b.feature('detached-houses', () => {
    const positions = luxury ? [[-7, -3], [7, -3]] : [[-7, -6.4], [7, -6.4], [-7, 5.8], [7, 5.8]];
    for (const [x, z] of positions) {
      const w = luxury ? 8.5 : 7.7, d = luxury ? 7.6 : 6.4;
      b.mass(w, 5.7, d, x, 3.1, z, wall);
      b.take(b.kit.roofs[luxury ? 'flatParapet' : 'hip']([w, d], { baseY: 5.95, pitch: Math.min(34, b.kit.defaults.pitch), overhang: luxury ? 1.05 : 0.35, seed: b.options.seed, ornaments: false, trimColor: colors.trim,
        ...(luxury ? { material: 'plaster_tint' as const, surfaceColor: colors.wall } : {}) }), x, 0, z);
      b.facade(w, d, 2, 3, x, z, wall, { balcony: luxury, glassRail: luxury });
      b.box(0.9, 2.1, 0.1, x, 1.32, z + d / 2 + 0.11, trim);
      b.box(w - 0.3, 0.09, 0.09, x, 0.9, z - d / 2 - 1.3, trim);
      for (const side of [-1, 1]) { b.box(0.09, 0.09, d + 2.6, x + side * (w / 2 - 0.15), 0.9, z, trim);
        for (const dz of [-d / 2 - 1.3, d / 2 + 1.3]) b.box(0.09, 0.82, 0.09, x + side * (w / 2 - 0.15), 0.5, z + dz, trim); }
      if (luxury) b.pool(x, 6.5, 5.1, 3.3, 0.13);
      else b.car(x + 1.7, z + d / 2 + 1.9, trim, Math.PI / 2);
    }
  });
  b.feature('trees', () => {
    const kinds = b.kit.vegetation.filter(p => !p.nearWaterOnly);
    for (const [i, x] of [-12, 12].entries()) b.tree(kinds[i % kinds.length].id.slice(4), x, -10.4, luxury ? 7.5 : 5.8, luxury ? 1.8 : 1.2, 0.06, trim, i);
  });
  if (luxury) b.parking(2, trim, false, 11.8);
  return { floors: 2, houseCount: luxury ? 2 : 4, pools: luxury ? 2 : 0, soi: true };
}

export function buildTraditionalEstate(b: ZoneBuilder): Record<string, unknown> {
  const kit = b.kit, s = kit.houses.traditional, colors = kit.housePalette('traditional', b.options.seed);
  const wall = tint(s.wallMaterial, colors.wall), trim = tint('wood_painted', colors.trim), floor = s.floor + 0.25;
  const lotusPetals = tint('fabric_canvas', 0xd898a1);
  b.stone = trim;
  b.site(getMaterial('grass'), trim); b.entrance(trim);
  b.feature('traditional-residence', () => {
    const bodies = s.cluster ? [[-4.7, -4.8, 6.2, 8.2], [3.1, -4.8, 5.4, 7.3], [0, 0.3, 4.4, 3.7]] : [[0, -4.6, 10.6, 8.2]];
    for (const [x, z, w, d] of bodies) {
      b.box(w, 0.18, d, x, floor, z, trim);
      for (const px of [-w / 2 + 0.2, w / 2 - 0.2]) for (const pz of [-d / 2 + 0.2, d / 2 - 0.2]) b.box(0.22, floor, 0.22, x + px, floor / 2, z + pz, trim);
      b.mass(w, 2.75, d, x, floor + 1.46, z, wall);
      const parts = kit.walls[s.wall]({ width: w - 0.2, height: 2.7, seed: b.options.seed });
      parts.forEach(p => { p.material = p.material === tint('wood_painted', kit.palette.pick(b.options.seed).trim) ? trim : wall; });
      b.take(parts, x, floor + 0.1, z + d / 2 + 0.07);
      b.take(kit.roofs[s.roof]([w, d], { baseY: floor + 2.85, pitch: Math.min(42, kit.defaults.pitch), overhang: 0.5, seed: b.options.seed, material: s.roofMaterial, trimColor: colors.trim }), x, 0, z);
      for (const px of [-w * 0.28, w * 0.28]) b.box(1.15, 1.45, 0.08, x + px, floor + 1.75, z + d / 2 + 0.2, trim);
    }
    b.box(14.5, 0.2, 3.4, 0, floor, 2.55, trim);
    for (const side of [-1, 1]) b.box(5.6, 0.11, 0.12, side * 4.4, floor + 1.03, 4.2, trim);
    for (let i = 0; i < 6; i++) b.box(1.8, floor * (i + 1) / 6, 0.38, 0, floor * (i + 1) / 12, 6.2 - i * 0.36, trim);
    if (s.balcony === 'fretwork') b.take(kit.ornaments.fretwork({ width: 10.5, height: 0.92, seed: b.options.seed, color: colors.trim, detail: 'low' }), 0, floor + 0.13, 4.16);
    if (s.malayGable) b.take(kit.ornaments[kit.defaults.ridgeOrnament]({ width: 3.8, height: 1.1, seed: b.options.seed, color: colors.trim }), 0, floor + 2.5, -0.34);
  });
  b.feature('regional-household-props', () => {
    s.props.forEach((p, i) => {
      const parts = kit.props[p.kind]({ seed: b.options.seed, detail: 'low' });
      parts.forEach(part => {
        if (part.material.userData.materialKey === 'bamboo_split') part.material = trim;
        if (part.material.userData.materialKey === 'fabric_canvas') part.material = lotusPetals;
        if (part.material.userData.materialKey === 'roof_glazed_tile' && s.roofMaterial === 'roof_clay_tile') part.material = tint('roof_clay_tile', colors.roof);
      });
      b.take(parts, -8.5 + i * 3, p.kind === 'weaving_loom' || p.kind === 'bamboo_daybed' ? 0.08 : floor, -2.3, 0, 0.9);
    });
  });
  b.feature('lotus-pond-pavilion', () => {
    b.pool(-6.7, 8.1, 5.5, 4.3, 0.15, trim);
    const leaf = tint('foliage_tropical', regionalLeafColor(b.options.region));
    for (let i = 0; i < 10; i++) { const x = -8.4 + i % 4 * 1.2, z = 6.9 + Math.floor(i / 4) * 1.1;
      const card = new KitBuilder(); card.leaf(point(0, 0, 0), point(0, 1, 0), 0.55, 0.55, leaf, 0, 0.02);
      card.parts.forEach(p => p.geometry.rotateX(-Math.PI / 2)); b.take(card.parts, x, 0.21, z, i);
      if (i % 3 === 0) b.flower(point(x, 0.25, z), 0.15, lotusPetals);
    }
    b.box(3.6, 0.15, 3.3, 7.3, 0.48, 7.5, trim);
    for (const x of [-1.45, 1.45]) for (const z of [-1.28, 1.28]) b.box(0.14, 2.5, 0.14, 7.3 + x, 1.73, 7.5 + z, trim);
    b.take(kit.roofs[s.roof]([3.6, 3.3], { baseY: 2.96, pitch: 32, overhang: 0.35, seed: b.options.seed, material: s.roofMaterial, trimColor: colors.trim }), 7.3, 0, 7.5);
  });
  b.feature('bamboo-garden', () => {
    s.plants.forEach((kind, i) => b.tree(kind, i % 2 ? -12.1 : 12.1, i > 1 ? 6 : -7.4, 6.7, 1.2, 0.06, trim, i));
  });
  b.parking(2, trim, true, 11.8);
  return { floors: 1, lotusPond: true, watersidePavilion: true, regionalHouseTemplate: 'res.house_3_1', cluster: Boolean(s.cluster) };
}

export function createEmptyParts(b: ZoneBuilder): void {
  const color = b.kit.palette.pick(b.options.seed), marker = tint('wood_painted', color.trim);
  b.site(getMaterial('dirt_laterite'), b.stone); b.entrance();
  b.feature('boundary-fence-and-markers', () => {
    for (const x of [-13.7, 13.7]) for (const z of [-13.7, -7, 0, 7, 13.7]) b.pole(point(x, 0.06, z), point(x, 1.6, z), 0.04, b.metal, 5);
    for (const x of [-13.7, 13.7]) for (const y of [0.8, 1.45]) b.pole(point(x, y, -13.7), point(x, y, 13.7), 0.012, b.metal, 3);
    for (const y of [0.8, 1.45]) {
      b.pole(point(-13.7, y, -13.7), point(13.7, y, -13.7), 0.012, b.metal, 3);
      for (const side of [-1, 1]) b.pole(point(side * 2.7, y, 13.7), point(side * 13.7, y, 13.7), 0.012, b.metal, 3);
    }
    for (const x of [-2.7, 2.7]) b.pole(point(x, 0.06, 13.7), point(x, 1.6, 13.7), 0.04, b.metal, 5);
    for (const x of [-13.7, 13.7]) for (let i = 0; i < 26; i++) {
      const z = -13.2 + i * 1.05;
      b.pole(point(x - 0.065, 1.37, z - 0.055), point(x + 0.065, 1.53, z + 0.055), 0.012, b.metal, 3);
      b.pole(point(x - 0.065, 1.53, z - 0.055), point(x + 0.065, 1.37, z + 0.055), 0.012, b.metal, 3);
    }
    for (const z of [-13.7, 13.7]) for (let i = 0; i < 26; i++) {
      const x = -13.2 + i * 1.05; if (z > 0 && Math.abs(x) < 2.8) continue;
      b.pole(point(x - 0.06, 1.38, z - 0.06), point(x + 0.06, 1.52, z + 0.06), 0.012, b.metal, 3);
      b.pole(point(x - 0.06, 1.52, z + 0.06), point(x + 0.06, 1.38, z - 0.06), 0.012, b.metal, 3);
    }
    for (const x of [-10, 0, 10]) for (const z of [-10, 10]) { b.box(0.15, 0.62, 0.15, x, 0.36, z, b.stone); b.box(0.18, 0.11, 0.18, x, 0.68, z, marker); }
  });
  b.feature('concrete-pile-stack', () => {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4 - row; col++) {
      const src = new KitBuilder(); src.pole(point(0, 0, -3), point(0, 0, 3), 0.16, b.stone, 6);
      b.take(src.parts, 5.5 + col * 0.36 + row * 0.18, 0.26 + row * 0.3, -6.4);
    }
  });
  b.feature('land-sale-sign', () => {
    for (const x of [-5.8, -2.6]) b.box(0.08, 3.1, 0.08, x, 1.61, 9.8, b.metal);
    b.sign('ขายที่ดิน', 3.5, 1.15, -4.2, 2.52, 9.85, 0xeee7cd, color.shutter);
  });
  b.gardens(2, 2.6, marker);
}
