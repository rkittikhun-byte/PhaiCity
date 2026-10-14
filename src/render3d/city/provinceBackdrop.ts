/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The whole province round a district's city (owner, 14 Oct 2026: "ในตอนเลือก อ. เมืองแล้ว และอยากดู view ทั้งขอนแก่น
// อีกที แบบ zoom ออก มา ก็สามารถทำได้ด้วยนะ"; docs/GAME_PLAN.md phase 6): the province's own map (600 m a tile) as one
// low ground mesh laid where it really is round the district's map, a little below its ground, with the districts'
// outlines and the city's own district picked out, so zooming out shows all of the province. It only reads.
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import type { CityHeightField } from './heightfield.js';

/** The province's map, as the game loads it (src/splashScreen.js provinceBackdropFrom) */
export interface ProvinceBackdrop {
  width: number; height: number; tileSizeM: number;
  center: { lat: number; lon: number };
  /** 0 land, 1 water, 2 woods a tile */
  cells: Uint8Array;
  /** 1 for a tile in the province */
  inside: Uint8Array | null;
  /** Metres a tile, or null */
  heights: Float32Array | null;
  /** The province's districts' outlines as [lon, lat] rings, and which is the city's own */
  districts?: ReadonlyArray<{ id: string; rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>> }>;
  districtId?: string | null;
}

/** Where the district's map lies: its centre and its tiles' size (the district map's own) */
export interface DistrictPlace { center: { lat: number; lon: number }; width: number; height: number; tileSizeM: number }

const M_PER_DEG_LAT = 110574, M_PER_DEG_LON = 111320;
/** Below the district's own ground, so its map draws over the province where both are */
const SINK = 2.5;
/** The districts' outlines stand this far over the province's ground, this wide (world units) */
const LINE_LIFT = 6, LINE_WIDTH = 40;
const LAND = new Color(0x8fa060), WATER = new Color(0x4f84a8), WOODS = new Color(0x4f6d3b), OUTSIDE_SHADE = 0.6;

export class ProvinceBackdropView {
  readonly root = new Group();
  /** How far it reaches from the district map's middle, in world units, for the camera's zoom and far plane */
  readonly span: number;
  constructor(province: ProvinceBackdrop, district: DistrictPlace, terrain?: CityHeightField) {
    this.root.name = 'province_backdrop';
    const units = 10 / district.tileSizeM;
    const cosD = Math.cos(district.center.lat * Math.PI / 180), cosP = Math.cos(province.center.lat * Math.PI / 180);
    const halfWp = province.width * province.tileSizeM / 2, halfHp = province.height * province.tileSizeM / 2;
    const halfWd = district.width * district.tileSizeM / 2, halfHd = district.height * district.tileSizeM / 2;
    // A point of the province's grid (metres) → lon/lat → the district's world
    const world = (lon: number, lat: number): [number, number] => [
      ((lon - district.center.lon) * M_PER_DEG_LON * cosD + halfWd) * units,
      ((district.center.lat - lat) * M_PER_DEG_LAT + halfHd) * units,
    ];
    const lonLat = (xm: number, ym: number): [number, number] => [
      province.center.lon + (xm - halfWp) / (M_PER_DEG_LON * cosP), province.center.lat - (ym - halfHp) / M_PER_DEG_LAT];
    const base = terrain?.baseMetres ?? 0, perMetre = terrain?.unitsPerMetre ?? 0, floor = (terrain?.min ?? 0) - SINK;
    const { width: w, height: h } = province, positions: number[] = [], colors: number[] = [], index: number[] = [];
    const heightAt = (x: number, y: number): number => {
      const tx = Math.max(0, Math.min(w - 1, x)), ty = Math.max(0, Math.min(h - 1, y));
      const metres = province.heights?.[ty * w + tx] ?? base;
      return floor + Math.max(0, metres - base) * perMetre;
    };
    const colour = new Color();
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      const [lon, lat] = lonLat(x * province.tileSizeM, y * province.tileSizeM), [wx, wz] = world(lon, lat);
      const tx = Math.min(w - 1, x), ty = Math.min(h - 1, y), i = ty * w + tx, cell = province.cells[i];
      colour.copy(cell === 1 ? WATER : cell === 2 ? WOODS : LAND);
      if (province.inside && !province.inside[i]) colour.multiplyScalar(OUTSIDE_SHADE);
      // Under the district's own map it stays at its floor, below the district's ground
      const under = wx >= 0 && wz >= 0 && wx <= district.width * 10 && wz <= district.height * 10;
      positions.push(wx, under ? floor : heightAt(tx, ty), wz); colors.push(colour.r, colour.g, colour.b);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = y * (w + 1) + x, b = a + 1, c = a + w + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setIndex(index); geometry.computeVertexNormals();
    const ground = new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
    ground.name = 'province_ground'; ground.receiveShadow = false;
    this.root.add(ground);
    // The districts' outlines over the ground, the city's own brighter; none across the district's own map, which
    // shows its edge itself
    const lines: number[] = [], own: number[] = [];
    const over = (lon: number, lat: number): [number, number, number, boolean] => {
      const [x, z] = world(lon, lat);
      const tx = Math.floor(((lon - province.center.lon) * M_PER_DEG_LON * cosP + halfWp) / province.tileSizeM);
      const ty = Math.floor(((province.center.lat - lat) * M_PER_DEG_LAT + halfHp) / province.tileSizeM);
      return [x, heightAt(tx, ty) + LINE_LIFT, z, x >= 0 && z >= 0 && x <= district.width * 10 && z <= district.height * 10];
    };
    for (const each of province.districts ?? []) {
      const target = each.id === province.districtId ? own : lines;
      for (const ring of each.rings) for (let i = 1; i < ring.length; i++) {
        const a = over(ring[i - 1][0], ring[i - 1][1]), b = over(ring[i][0], ring[i][1]);
        if (!a[3] || !b[3]) target.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    // Each outline a flat ribbon on the ground, as WebGL draws lines a pixel wide whatever is asked
    for (const [list, colourHex, name, width] of [[lines, 0xf4efd6, 'district_lines', LINE_WIDTH],
      [own, 0xffd75a, 'own_district', LINE_WIDTH * 1.5]] as const) {
      if (!list.length) continue;
      const ribbon: number[] = [];
      for (let k = 0; k < list.length; k += 6) {
        const ax = list[k], ay = list[k + 1], az = list[k + 2], bx = list[k + 3], by = list[k + 4], bz = list[k + 5];
        const length = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / length * width / 2, nz = (bx - ax) / length * width / 2;
        ribbon.push(ax + nx, ay, az + nz, ax - nx, ay, az - nz, bx + nx, by, bz + nz,
          bx + nx, by, bz + nz, ax - nx, ay, az - nz, bx - nx, by, bz - nz);
      }
      const geometryRibbon = new BufferGeometry();
      geometryRibbon.setAttribute('position', new Float32BufferAttribute(ribbon, 3));
      const mesh = new Mesh(geometryRibbon, new MeshBasicMaterial({ color: colourHex, transparent: true, opacity: 0.85, side: DoubleSide }));
      mesh.name = name;
      this.root.add(mesh);
    }
    let span = 0;
    for (let k = 0; k < positions.length; k += 3) {
      span = Math.max(span, Math.hypot(positions[k] - halfWd * units, positions[k + 2] - halfHd * units));
    }
    this.span = span;
  }
  dispose(): void {
    this.root.traverse(node => {
      if (node instanceof Mesh) { node.geometry.dispose(); (node.material as { dispose(): void }).dispose(); }
    });
    this.root.clear();
  }
}
