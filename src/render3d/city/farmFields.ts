/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone's fields (src/farmZone.ts, docs/GAME_DESIGN.md section 7) as the concept art shows them round the
// village: rice paddies inside their dikes, their water green and then gold with the planting and harvest months; rows
// of cane and cassava on red earth; orchards of trees in rows; square fish ponds with aerators. What stands among them
// follows the city's era: buffalo and field huts, then granaries, tractors and greenhouses, harvesters, and at last a
// smart farm's drones and solar panels; the huts and granaries take the region's dress (src/render3d/regional/).
//
// Cheap by design: every field's ground is one mesh of coloured quads over the land, recoloured when the month turns and
// built again only when fields change (a little after, so a month of growth is one rebuild); everything standing on them
// is instanced, a few draw calls for the whole zone, and hidden when the camera is far away. It reads the map and never
// writes it.

import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, type Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mapEra } from '../../era.js';
import { FARM_ERA_LOOKS, farmSide, type FarmLook, FIELD_BURNING_MONTHS, fieldCells, fieldLevelOf, fullCells, kindOfCode,
  type FarmKind, type FieldMap } from '../../farmZone.js';
import { FARM, FIELD_BASE } from '../../tileValues.js';
import { SCENE } from '../../theme/tokens.js';
import { getRegionKit } from '../regional/index.js';
import type { RegionId } from '../regional/types.js';
import { mergeByMaterial, type GeometryPart } from '../util/geometry.js';

export interface FarmViewMap {
  readonly width: number;
  readonly height: number;
  readonly farmKinds?: Uint8Array | null;
  readonly era?: unknown;
  /** The cells of each field painted on part of its tile, its tiles' size, whether its zones go a cell at a time, and a
   * count of changes to the cells (src/farmZone.ts fieldCells; docs/NO_GRID_PLAN.md 3C) */
  readonly farmCells?: Uint16Array | null;
  readonly tileSizeM?: number | null;
  readonly cellZones?: boolean;
  readonly farmCellsVersion?: number;
  getTileValue(x: number, y: number): number;
}

/** Beyond this camera distance (world units) only the fields' ground is drawn */
export const FARM_DETAIL_DISTANCE = 1600;
/** Seconds the fields wait after a change before they are drawn again, so a month's growth is one rebuild */
const REBUILD_AFTER = 0.6;
/** Above the land: the dikes and bare earth, and what lies inside them */
const LIFT = 0.05, INNER_LIFT = 0.09;
const UNITS = 10;

const colour = (hex: number): Color => new Color().setHex(hex);
const F = SCENE.farm;

/** How the month (0 January) colours a paddy: dry stubble after the harvest, the burning months' earth, flooded for the
 * planting in May, green through the rains, gold for the harvest in October and November (the Northeast's rain-fed rice) */
export function paddyColour(month: number, level: number, out = new Color()): Color {
  const m = ((month % 12) + 12) % 12;
  const water = colour(F.paddyWater), young = colour(F.paddyYoung), ripe = colour(F.paddyRipe), stubble = colour(F.stubble);
  const earth = colour(F.earth);
  if (m === 0 || m === 11) out.copy(stubble);
  else if (FIELD_BURNING_MONTHS.includes(m)) out.copy(stubble).lerp(earth, 0.5);
  else if (m === 4) out.copy(water);
  else if (m === 5) out.copy(water).lerp(young, 0.5);
  else if (m <= 7) out.copy(young);
  else if (m === 8) out.copy(young).lerp(ripe, 0.35);
  else out.copy(ripe);
  // A field just started is thinner: more of the earth shows through
  if (level <= 1) out.lerp(earth, 0.18);
  return out;
}

/** How tall a crop field's rows stand in a month (0–1): cut in the dry season, growing with the rains */
export function cropHeight(month: number): number {
  const m = ((month % 12) + 12) % 12;
  if (m <= 3) return 0.15;
  return Math.min(1, 0.25 + (m - 4) * 0.12);
}

/** What stands among the fields in each era (src/farmZone.ts FARM_ERA_LOOKS), and what every field of a kind has */
const ERA_PROPS = FARM_ERA_LOOKS;
type Prop = FarmLook | 'row' | 'tree' | 'trunk' | 'aerator';

/** A stable number for a tile, for which fields get which prop */
const hashOf = (i: number): number => { let h = i * 2654435761 >>> 0; h ^= h >>> 15; return Math.imul(h, 2246822519) >>> 0; };

/** A field as drawn: its tile, level and kind, and its painted cells (bits row by row; every one of a whole tile) */
interface Field { index: number; level: number; kind: FarmKind | null; cells: number }

export class CityFarmFields {
  readonly root = new Group();
  private readonly details = new Group();
  private ground: Mesh | null = null;
  private readonly groundMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  private readonly materials = new Map<number, MeshStandardMaterial>();
  private readonly meshes = new Map<string, InstancedMesh[]>();
  private fields: Field[] = [];
  /** The tiles drawn as fields last time, to hear when one stops being one */
  private drawn = new Uint8Array(0);
  private dirtyAt: number | null = 0;
  private shownMonth = -1;
  private shownEra = 0;
  private shownCells = -1;
  /** How many vertices each field's outer ground and inner part took, as built, for recolouring */
  private verts: Array<[number, number]> = [];
  private drones: Array<{ mesh: InstancedMesh; n: number; x: number; y: number; z: number }> = [];
  /** Each prop's shapes, merged by material once and shared by every rebuild */
  private readonly shapeCache = new Map<Prop, Group>();
  /** The cells the brush in hand would paint, over everything as the tools' outlines are, and what they were */
  private brush: InstancedMesh | null = null;
  private brushKey = '';
  private readonly brushPlane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly brushMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45,
    depthWrite: false, depthTest: false });

  /** metre: world units a metre (a real-scale city map's), for the region's props built in metres */
  constructor(private readonly map: FarmViewMap, private readonly terrain: { sample(x: number, z: number): number },
              private readonly region: RegionId = 'central', private readonly metre: number = 0.625) {
    this.root.name = 'farm_fields';
    this.details.name = 'farm_details';
    this.root.add(this.details);
  }

  /** The ground moved: draw the fields on it again */
  invalidate(seconds = 0): void { this.dirtyAt ??= seconds; }

  /**
   * Each frame, with the tiles whose values changed: the fields drawn again a little after they changed, their colours
   * when the month turns, their props when the era does, and the props only near the camera. Returns the 3 × 3 farm
   * buildings' centres whose fields changed, which the chunks draw again as a cooperative, rice mill or cold store.
   */
  update(changed: readonly number[], month: number, distance: number, seconds: number): number[] {
    const size = this.map.width * this.map.height;
    if (this.drawn.length !== size) this.drawn = new Uint8Array(size);
    for (const i of changed) {
      if (this.drawn[i] || fieldLevelOf(this.valueAt(i)) >= 0) { this.dirtyAt ??= seconds; break; }
    }
    // ... and when the brush painted or rubbed out cells of a field (no tile need change)
    if ((this.map.farmCellsVersion ?? 0) !== this.shownCells) { this.shownCells = this.map.farmCellsVersion ?? 0; this.dirtyAt ??= seconds; }
    const era = mapEra(this.map as { era?: unknown });
    let hubs: number[] = [];
    if (this.dirtyAt !== null && seconds - this.dirtyAt >= REBUILD_AFTER - (this.ground ? 0 : REBUILD_AFTER)) {
      this.dirtyAt = null;
      hubs = this.rebuild(month, era);
    } else if (month !== this.shownMonth || era !== this.shownEra) {
      this.recolour(month);
      if (era !== this.shownEra) this.props(era, month);
      this.shownMonth = month;
      this.shownEra = era;
    }
    this.details.visible = distance < FARM_DETAIL_DISTANCE && this.fields.length > 0;
    // The drones of a smart farm hover and bob
    for (const d of this.drones) {
      const m = new Matrix4().makeTranslation(d.x, d.y + Math.sin(seconds * 2 + d.x) * 0.25, d.z);
      d.mesh.setMatrixAt(d.n, m);
      d.mesh.instanceMatrix.needsUpdate = true;
    }
    return hubs;
  }

  /**
   * The farm cells the brush in hand would paint (their keys, src/farmZone.ts farmCellKey), each a flat square on the
   * land in the brush's colour; none when null (docs/NO_GRID_PLAN.md 3C: the brush shows the shape it paints, not a tile)
   */
  showBrush(keys: readonly number[] | null, colour: string | null): void {
    const key = keys && keys.length ? `${keys.length}:${keys[0]}:${keys[keys.length - 1]}:${colour}` : '';
    if (key === this.brushKey) return;
    this.brushKey = key;
    if (this.brush) { this.root.remove(this.brush); this.brush.dispose(); this.brush = null; }
    if (!keys || !keys.length) return;
    const side = this.side(), cell = UNITS / side, width = this.map.width;
    if (colour) this.brushMaterial.color.set(colour);
    const mesh = new InstancedMesh(this.brushPlane, this.brushMaterial, keys.length), m = new Matrix4();
    keys.forEach((k, n) => {
      const tile = Math.floor(k / 16), bit = k % 16, tx = tile % width, tz = Math.floor(tile / width);
      const x = tx * UNITS + (bit % side + 0.5) * cell, z = tz * UNITS + (Math.floor(bit / side) + 0.5) * cell;
      mesh.setMatrixAt(n, m.makeScale(cell * 0.92, 1, cell * 0.92).setPosition(x, this.terrain.sample(x, z) + INNER_LIFT + 0.1, z));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 25;
    mesh.name = 'farm_fields/brush';
    this.brush = mesh;
    this.root.add(mesh);
  }

  /** How many of each thing are drawn, for tests and the bench */
  counts(): Record<string, number> {
    const out: Record<string, number> = { fields: this.fields.length };
    for (const [name, list] of this.meshes) out[name] = list[0]?.count ?? 0;
    return out;
  }

  dispose(): void {
    this.clearProps();
    for (const group of this.shapeCache.values()) group.traverse((child) => { if (child instanceof Mesh) child.geometry.dispose(); });
    this.shapeCache.clear();
    this.ground?.geometry.dispose();
    this.groundMaterial.dispose();
    this.materials.forEach((m) => m.dispose());
    this.brush?.dispose();
    this.brushPlane.dispose();
    this.brushMaterial.dispose();
  }

  private valueAt(i: number): number {
    return this.map.getTileValue(i % this.map.width, Math.floor(i / this.map.width)) & 1023;
  }

  /** The fields found again, their ground built, and their props; the farm buildings near any that changed */
  private rebuild(month: number, era: number): number[] {
    const { width, height } = this.map, kinds = this.map.farmKinds;
    const before = this.drawn, now = new Uint8Array(width * height), fields: Field[] = [];
    let changedHub = false;
    for (let i = 0; i < width * height; i++) {
      const v = this.valueAt(i);
      if (v < FIELD_BASE || v > FIELD_BASE + 5) continue;
      const level = v - FIELD_BASE, kind = level > 0 ? kindOfCode(kinds?.[i] ?? 0) : null;
      fields.push({ index: i, level, kind, cells: fieldCells(this.map as unknown as FieldMap, i) });
      now[i] = 1 + level * 5 + (kind ? 1 + ['paddy', 'field', 'orchard', 'pond'].indexOf(kind) : 0);
    }
    for (let i = 0; i < now.length && !changedHub; i++) if (now[i] !== before[i]) changedHub = true;
    this.drawn = now;
    this.fields = fields;
    this.buildGround(month);
    this.props(era, month);
    this.shownMonth = month;
    this.shownEra = era;
    if (!changedHub) return [];
    const hubs: number[] = [];
    for (let i = 0; i < width * height; i++) if (this.valueAt(i) === FARM) hubs.push(i);
    return hubs;
  }

  /** The colour of a field's ground: its outer part (dikes, earth) and its inner part (water, crop) */
  private tones(field: Field, month: number, outer: Color, inner: Color): boolean {
    if (field.level === 0 || !field.kind) {
      outer.setHex(F.zone).lerp(colour(F.earth), 0.35);
      return false;
    }
    switch (field.kind) {
      case 'paddy': outer.setHex(F.dike); paddyColour(month, field.level, inner); return true;
      case 'pond': outer.setHex(F.dike); inner.setHex(F.pond); return true;
      case 'orchard': outer.setHex(F.crop).lerp(colour(F.earth), 0.3); return false;
      default: outer.setHex(F.earth); return false;
    }
  }

  /** Cells a side of a tile (src/farmZone.ts farmSide): 4 on a real-scale city map, 1 (whole tiles) elsewhere */
  private side(): number { return farmSide(this.map); }

  /**
   * The fields' ground, on the cells painted (docs/NO_GRID_PLAN.md 3C: the shape the brush went, not 16 m tiles): a
   * whole tile as one patch, a tile painted in part as a patch for each run of painted cells along its rows. A paddy's
   * or a pond's dike only where the field ends, along the edge of what was painted, not round every tile (owner, 21 Oct
   * 2026: "นาเป็นสี่เหลี่ยม 16 ม. พร้อมคันนาทุกช่อง" was the grid he saw): fields of one kind grown side by side are one
   * sheet of water inside one bank.
   */
  private buildGround(month: number): void {
    this.ground?.geometry.dispose();
    if (this.ground) this.root.remove(this.ground);
    this.ground = null;
    this.verts = [];
    if (!this.fields.length) return;
    const positions: number[] = [], colours: number[] = [], outer = new Color(), inner = new Color();
    const quad = (x0: number, z0: number, x1: number, z1: number, lift: number, c: Color, n: number): number => {
      // n quads a side, so the patch follows the land within the tile
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const xa = x0 + (x1 - x0) * a / n, xb = x0 + (x1 - x0) * (a + 1) / n;
        const za = z0 + (z1 - z0) * b / n, zb = z0 + (z1 - z0) * (b + 1) / n;
        const p = (x: number, z: number) => { positions.push(x, this.terrain.sample(x, z) + lift, z); colours.push(c.r, c.g, c.b); };
        p(xa, za); p(xa, zb); p(xb, za);
        p(xb, za); p(xa, zb); p(xb, zb);
      }
      return 6 * n * n;
    };
    // A run along a row, a quad a cell
    const quadRow = (x0: number, z0: number, x1: number, z1: number, lift: number, c: Color, cells: number): number => {
      let verts = 0;
      for (let k = 0; k < cells; k++) verts += quad(x0 + (x1 - x0) * k / cells, z0, x0 + (x1 - x0) * (k + 1) / cells, z1, lift, c, 1);
      return verts;
    };
    const side = this.side(), full = fullCells(side), cell = UNITS / side, { width, height } = this.map;
    const byIndex = new Map<number, Field>();
    for (const field of this.fields) byIndex.set(field.index, field);
    // Whether the cell (cx, cz) of the whole map, cells counted from its top left, is painted with a field like this one
    const joins = (field: Field, cx: number, cz: number): boolean => {
      if (cx < 0 || cz < 0 || cx >= width * side || cz >= height * side) return false;
      const tx = Math.floor(cx / side), tz = Math.floor(cz / side), other = byIndex.get(tz * width + tx);
      return Boolean(other && other.kind === field.kind && other.level > 0 && (other.cells >> ((cz - tz * side) * side + (cx - tx * side))) & 1);
    };
    for (const field of this.fields) {
      const x = field.index % width, y = Math.floor(field.index / width), cx0 = x * side, cz0 = y * side;
      const insideToo = this.tones(field, month, outer, inner);
      const inset = field.kind === 'pond' ? 1.4 : 0.7;
      // A whole tile as one run, else each run of painted cells along a row: [first column, last column, row, last row]
      const runs: Array<[number, number, number, number]> = [];
      if (field.cells === full) runs.push([0, side - 1, 0, side - 1]);
      else {
        for (let r = 0; r < side; r++) {
          for (let c = 0; c < side; c++) {
            if (!((field.cells >> (r * side + c)) & 1)) continue;
            let e = c;
            while (e + 1 < side && (field.cells >> (r * side + e + 1)) & 1) e++;
            runs.push([c, e, r, r]);
            c = e;
          }
        }
      }
      let outerVerts = 0, innerVerts = 0;
      for (const [c0, c1, r0, r1] of runs) {
        const x0 = x * UNITS + c0 * cell, x1 = x * UNITS + (c1 + 1) * cell, z0 = y * UNITS + r0 * cell, z1 = y * UNITS + (r1 + 1) * cell;
        // (a whole tile in 2 x 2, a run a quad a cell along it, so either lies on the land)
        outerVerts += field.cells === full ? quad(x0, z0, x1, z1, LIFT, outer, 2) : quadRow(x0, z0, x1, z1, LIFT, outer, c1 - c0 + 1);
      }
      if (insideToo) {
        // The water or the pond inside: a dike on a side only where the cell across it is not this field's kind. A whole
        // tile whose every side is the same all along is one patch; else a patch a painted cell, each with its own dike,
        // so a run's side half against the field beside it has no dike along that half
        let top = -1, bottom = -1, left = -1, right = -1, even = field.cells === full;
        const side4 = (along: (k: number) => boolean): number => {
          let some = false, all = true;
          for (let k = 0; k < side; k++) { const j = along(k); some ||= j; all &&= j; }
          if (some && !all) even = false;
          return all ? 0 : inset;
        };
        if (even) {
          top = side4((k) => joins(field, cx0 + k, cz0 - 1));
          bottom = side4((k) => joins(field, cx0 + k, cz0 + side));
          left = side4((k) => joins(field, cx0 - 1, cz0 + k));
          right = side4((k) => joins(field, cx0 + side, cz0 + k));
        }
        if (even) innerVerts += quad(x * UNITS + left, y * UNITS + top, (x + 1) * UNITS - right, (y + 1) * UNITS - bottom, INNER_LIFT, inner, 2);
        else {
          for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
            if (!((field.cells >> (r * side + c)) & 1)) continue;
            const gx = cx0 + c, gz = cz0 + r, x0 = x * UNITS + c * cell, z0 = y * UNITS + r * cell;
            innerVerts += quad(x0 + (joins(field, gx - 1, gz) ? 0 : inset), z0 + (joins(field, gx, gz - 1) ? 0 : inset),
              x0 + cell - (joins(field, gx + 1, gz) ? 0 : inset), z0 + cell - (joins(field, gx, gz + 1) ? 0 : inset), INNER_LIFT, inner, 1);
          }
        }
      }
      this.verts.push([outerVerts, innerVerts]);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.ground = new Mesh(geometry, this.groundMaterial);
    this.ground.name = 'farm_fields/ground';
    this.ground.receiveShadow = true;
    this.root.add(this.ground);
  }

  /** The month turned: the paddies' colours again, and the crop rows' height */
  private recolour(month: number): void {
    if (!this.ground) return;
    const attribute = this.ground.geometry.getAttribute('color') as BufferAttribute, outer = new Color(), inner = new Color();
    let v = 0;
    const paint = (c: Color, count: number) => { for (let k = 0; k < count; k++, v++) attribute.setXYZ(v, c.r, c.g, c.b); };
    this.fields.forEach((field, n) => {
      const insideToo = this.tones(field, month, outer, inner), [outerVerts, innerVerts] = this.verts[n] ?? [0, 0];
      paint(outer, outerVerts);
      if (insideToo) paint(inner, innerVerts);
    });
    attribute.needsUpdate = true;
    this.props(this.shownEra || mapEra(this.map as { era?: unknown }), month);
  }

  private material(hex: number, options: { transparent?: boolean; opacity?: number } = {}): MeshStandardMaterial {
    const key = hex + (options.transparent ? 0x1000000 : 0);
    let m = this.materials.get(key);
    if (!m) this.materials.set(key, m = new MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, ...options }));
    return m;
  }

  private clearProps(): void {
    for (const list of this.meshes.values()) for (const mesh of list) { mesh.parent?.remove(mesh); mesh.dispose(); }
    this.meshes.clear();
    this.drones = [];
  }

  /** The things standing on the fields: crop rows, orchard trees, pond aerators, and the era's buffalo, huts, machines */
  private props(era: number, month: number): void {
    this.clearProps();
    if (!this.fields.length) return;
    const place: Record<string, Matrix4[]> = {};
    const add = (prop: Prop, m: Matrix4): void => { (place[prop] ??= []).push(m); };
    const o = new Object3D();
    const at = (x: number, z: number, lift: number, sx = 1, sy = 1, sz = 1, turn = 0): Matrix4 => {
      o.position.set(x, this.terrain.sample(x, z) + lift, z);
      o.rotation.set(0, turn, 0);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      return o.matrix.clone();
    };
    const grown = this.fields.filter((f) => f.level > 0 && f.kind);
    const rows = cropHeight(month);
    for (const f of grown) {
      const x = f.index % this.map.width, y = Math.floor(f.index / this.map.width), [cx, cz] = this.paintedMiddle(f);
      const along = (hashOf(Math.floor(x / 4) + Math.floor(y / 4) * 977) & 1) ? 0 : Math.PI / 2;
      // (each quarter of the tile the field mostly covers: rows and trees only on what was painted)
      const quarters = this.quarters(f);
      if (f.kind === 'field') {
        const tall = (0.3 + 0.5 * rows) * (0.7 + 0.1 * f.level);
        // (rows across the way they run: they once all lay on the tile's middle line, one over another)
        for (const [qx, qz] of quarters) {
          const crossQ = along ? qx : qz, lengthQ = along ? qz : qx;
          for (const off of crossQ < 0 ? [-3.4, -1.13] : [1.13, 3.4]) {
            const mx = (x + 0.5) * UNITS + (along ? off : lengthQ), mz = (y + 0.5) * UNITS + (along ? lengthQ : off);
            add('row', at(mx, mz, tall / 2, 4.3, tall, 0.9, along));
          }
        }
      } else if (f.kind === 'orchard') {
        const grownUp = 0.6 + 0.12 * f.level;
        for (const [dx, dz] of quarters) {
          const tx = (x + 0.5) * UNITS + dx, tz = (y + 0.5) * UNITS + dz;
          add('trunk', at(tx, tz, 0.9 * grownUp, grownUp, grownUp, grownUp));
          add('tree', at(tx, tz, 2.3 * grownUp, 1.7 * grownUp, 1.4 * grownUp, 1.7 * grownUp, hashOf(f.index)));
        }
      } else if (f.kind === 'pond' && f.level >= 2 && quarters.length >= 2) {
        add('aerator', at(cx, cz, INNER_LIFT + 0.15, 1, 1, 1, hashOf(f.index) % 6));
      }
    }
    // The era's things, one among so many grown fields, at a field's edge by its dike
    const drones: Array<[number, number, number]> = [];
    for (const [prop, every] of ERA_PROPS[Math.max(1, Math.min(5, era))] ?? []) {
      for (const f of grown) {
        const h = hashOf(f.index * 31 + every);
        if (h % every) continue;
        // Machines and buffalo on paddies and crop fields, greenhouses on fields and orchards, granaries and huts anywhere
        if ((prop === 'buffalo' || prop === 'tractor' || prop === 'harvester') && f.kind !== 'paddy' && f.kind !== 'field') continue;
        if (prop === 'greenhouse' && f.kind !== 'field' && f.kind !== 'orchard') continue;
        if (f.kind === 'pond' && prop !== 'solar' && prop !== 'drone') continue;
        // (on what was painted of its tile: a field painted on less than half of it has none)
        if (this.quarters(f).length < 2) continue;
        const [mx, mz] = this.paintedMiddle(f);
        const cx = mx + ((h >> 8) % 5 - 2), cz = mz + ((h >> 12) % 5 - 2), turn = (h >> 16) % 628 / 100;
        if (prop === 'drone') drones.push([cx, this.terrain.sample(cx, cz) + 5, cz]);
        else add(prop, at(cx, cz, prop === 'buffalo' ? INNER_LIFT : LIFT, 1, 1, 1, turn));
      }
    }
    for (const [prop, matrices] of Object.entries(place)) this.instance(prop as Prop, matrices);
    if (drones.length) {
      const list = this.instance('drone', drones.map(([x, y, z]) => new Matrix4().makeTranslation(x, y, z)));
      for (const mesh of list) drones.forEach(([x, y, z], n) => this.drones.push({ mesh, n, x, y, z }));
    }
  }

  /** The middle of what was painted of a field's tile (world units): its tile's middle when painted whole */
  private paintedMiddle(f: Field): [number, number] {
    const x = f.index % this.map.width, y = Math.floor(f.index / this.map.width), side = this.side();
    if (f.cells === fullCells(side)) return [(x + 0.5) * UNITS, (y + 0.5) * UNITS];
    let sx = 0, sz = 0, n = 0;
    for (let bit = 0; bit < side * side; bit++) {
      if (!((f.cells >> bit) & 1)) continue;
      sx += (bit % side + 0.5) / side; sz += (Math.floor(bit / side) + 0.5) / side; n++;
    }
    return n ? [(x + sx / n) * UNITS, (y + sz / n) * UNITS] : [(x + 0.5) * UNITS, (y + 0.5) * UNITS];
  }

  /** The quarters of a field's tile it covers at least half of, as their middles from the tile's middle (world units):
   * all four of a whole tile */
  private quarters(f: Field): Array<[number, number]> {
    const side = this.side(), all: Array<[number, number]> = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
    if (side < 2 || f.cells === fullCells(side)) return all;
    const half = side / 2;
    return all.filter(([qx, qz]) => {
      const c0 = qx < 0 ? 0 : Math.floor(half), r0 = qz < 0 ? 0 : Math.floor(half), c1 = qx < 0 ? Math.ceil(half) : side, r1 = qz < 0 ? Math.ceil(half) : side;
      let painted = 0, cells = 0;
      for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { cells++; if ((f.cells >> (r * side + c)) & 1) painted++; }
      return painted * 2 >= cells;
    });
  }

  /** The shapes of a prop, each with its material: plain boxes and cones, or the region's own (granaries, hut roofs) */
  private shapes(prop: Prop): GeometryPart[] {
    const m = this.metre, part = (geometry: BufferGeometry, hex: number, extra: { transparent?: boolean; opacity?: number } = {}) =>
      ({ geometry, material: this.material(hex, extra) as Material });
    switch (prop) {
      case 'row': return [part(new BoxGeometry(1, 1, 1), F.crop)];
      case 'trunk': return [part(new CylinderGeometry(0.16, 0.22, 1.8, 5), F.teak)];
      case 'tree': return [part(new IcosahedronGeometry(1, 0), F.orchard)];
      case 'aerator': return [part(new CylinderGeometry(0.18, 0.18, 0.5, 6), F.machine),
        part(new BoxGeometry(1.8, 0.12, 0.3), F.machine)];
      case 'buffalo': return [part(mergeGeometries([new BoxGeometry(1.5 * m * 1.6, 0.9 * m * 1.6, 0.7 * m * 1.6).translate(0, 1.1 * m * 1.6, 0),
        new BoxGeometry(0.5 * m * 1.6, 0.5 * m * 1.6, 0.5 * m * 1.6).translate(0.95 * m * 1.6, 1.2 * m * 1.6, 0),
        ...[[-0.5, -0.25], [-0.5, 0.25], [0.5, -0.25], [0.5, 0.25]].map(([lx, lz]) =>
          new BoxGeometry(0.18 * m * 1.6, 0.7 * m * 1.6, 0.18 * m * 1.6).translate(lx * m * 1.6, 0.35 * m * 1.6, lz * m * 1.6))])!, F.buffalo)];
      case 'hut': {
        // A field hut (ห้างนา), 3.6 m across, on four posts under the region's roof in thatch; built in metres
        const kit = getRegionKit(this.region);
        const posts = mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([px, pz]) =>
          new BoxGeometry(0.12, 1.6, 0.12).translate(px * 0.95, 0.8, pz * 0.95)))!;
        const floor = new BoxGeometry(2.1, 0.08, 2.1).translate(0, 0.7, 0);
        const roof = kit.roofs[kit.defaults.roofForm]([2.4, 2.4], { baseY: 1.6, pitch: kit.defaults.pitch, material: 'thatch_grass', detail: 'low' });
        return [part(mergeGeometries([posts, floor])!, F.teak), ...roof].map((p) => scaled(p, 1.5 * m));
      }
      case 'granary': {
        // The region's granary (ยุ้งฉาง) where its kit has one, else a hut's shape closed in
        const kit = getRegionKit(this.region), builder = kit.props.rice_granary ?? kit.props.rice_barn;
        if (builder) return builder({ seed: 3 }).map((p) => scaled(p, 1.8 * m));
        return this.shapes('hut');
      }
      case 'tractor': return [part(mergeGeometries([new BoxGeometry(2.6 * m, 1.1 * m, 1.4 * m).translate(0, 1.1 * m, 0),
        new BoxGeometry(1.1 * m, 1.1 * m, 1.2 * m).translate(-0.5 * m, 2.1 * m, 0)])!, F.machine),
        part(mergeGeometries([[-0.8, 0.8], [0.9, 0.8]].flatMap(([wx, r]) => [-1, 1].map((side) =>
          new CylinderGeometry(r * m, r * m, 0.4 * m, 10).rotateX(Math.PI / 2).translate(wx * m, r * m, side * 0.85 * m))))!, F.buffalo)];
      case 'harvester': return [part(mergeGeometries([new BoxGeometry(4.2 * m, 2.2 * m, 2.6 * m).translate(0, 1.9 * m, 0),
        new BoxGeometry(1.4 * m, 1.2 * m, 3.4 * m).translate(2.6 * m, 0.8 * m, 0)])!, F.paddyRipe),
        part(new BoxGeometry(1.2 * m, 1.2 * m, 1.2 * m).translate(-1 * m, 3.6 * m, 0), F.machine)];
      case 'greenhouse': return [part(new CylinderGeometry(2.6, 2.6, 8, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2)
        .translate(0, 0, 0), F.paddyWater, { transparent: true, opacity: 0.55 })];
      case 'drone': return [part(mergeGeometries([new BoxGeometry(0.5, 0.18, 0.5),
        ...[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([rx, rz]) =>
          new CylinderGeometry(0.28, 0.28, 0.04, 8).translate(rx, 0.1, rz))])!, F.solar)];
      case 'solar': return [part(mergeGeometries([new BoxGeometry(5, 0.12, 2.4).rotateX(-0.45).translate(0, 1.3, 0),
        new BoxGeometry(0.15, 1.2, 0.15).translate(-2, 0.6, 0), new BoxGeometry(0.15, 1.2, 0.15).translate(2, 0.6, 0)])!, F.solar)];
      default: return [part(new ConeGeometry(1, 1, 4), F.thatch)];
    }
  }

  /** One instanced mesh for each material of a prop, holding every place it stands; its shapes made once */
  private instance(prop: Prop, matrices: Matrix4[]): InstancedMesh[] {
    let group = this.shapeCache.get(prop);
    if (!group) this.shapeCache.set(prop, group = mergeByMaterial(`farm.${prop}`, this.shapes(prop)));
    const list: InstancedMesh[] = [];
    for (const child of group.children) {
      if (!(child instanceof Mesh)) continue;
      const mesh = new InstancedMesh(child.geometry, child.material as Material, matrices.length);
      matrices.forEach((matrix, n) => mesh.setMatrixAt(n, matrix));
      if (prop === 'drone') mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.computeBoundingSphere();
      mesh.name = `farm_fields/${prop}`;
      mesh.castShadow = prop !== 'row' && prop !== 'drone';
      mesh.receiveShadow = true;
      this.details.add(mesh);
      list.push(mesh);
    }
    this.meshes.set(prop, list);
    return list;
  }
}

/** A part of the region's kit, built in metres, scaled into world units */
function scaled(part: GeometryPart, by: number): GeometryPart {
  const transform = new Matrix4().makeScale(by, by, by);
  return { geometry: part.geometry, material: part.material, transform: part.transform ? transform.multiply(part.transform) : transform };
}
