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
  PlaneGeometry, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mapEra } from '../../era.js';
import { FARM_ERA_LOOKS, farmSide, type FarmLook, FIELD_BURNING_MONTHS, fieldLevelOf, kindOfCode,
  type FarmKind } from '../../farmZone.js';
import { paintedCells, type FarmGridMap } from '../../farmGrid.js';
import { isOpenLand, plotKindOfValue } from '../../plots.js';
import { tileMetres } from '../../units.js';
import { CELL_M } from '../../zoneCells.js';
import { WASH_SECONDS } from './zoneCellsView.js';
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
  /** The squares of each field painted on part of its tile, its tiles' size, whether its zones go a cell at a time, and a
   * count of changes to the paint (src/farmGrid.ts; docs/NO_GRID_PLAN.md 3C): on such a map the fields are drawn on the
   * road-aligned farm cells, which it lays from its roads (src/farmGrid.ts FarmGridMap) */
  readonly farmSquares?: Uint8Array | null;
  readonly tileSizeM?: number | null;
  readonly cellZones?: boolean;
  readonly farmCellsVersion?: number;
  /** How far a field may lie from a road (tiles, the province's rules' farmZone.reach), when not the game's default */
  readonly farmReach?: number | null;
  getTileValue(x: number, y: number): number;
}

/** Beyond this camera distance (world units) only the fields' ground is drawn */
export const FARM_DETAIL_DISTANCE = 1600;
/** Seconds the fields wait after a change before they are drawn again, so a month's growth is one rebuild */
const REBUILD_AFTER = 0.6;
/** Above the land: the dikes and bare earth, and what lies inside them */
const LIFT = 0.05, INNER_LIFT = 0.09;
const UNITS = 10;
/** World units a bucket of the cells drawn, for finding each one's neighbours */
const BUCKET = 5;
/** How much larger than its side a farm cell's patch is drawn */
const CELL_GROW = 1.06;
/** Tiles round a field whose roads may lay its cells (33 rows of 4 m and the road's half width) */
const NEAR_FIELDS = 10;

/** What a tile is to the farm cells (src/farmGrid.ts farmGround): a road or railway (by its tile), land they may lie on,
 * or neither; never 0 */
const groundClass = (value: number): number =>
  value >= 64 && value <= 238 ? 3 + value : isOpenLand(value) || plotKindOfValue(value) !== null || (value >= FIELD_BASE && value <= FIELD_BASE + 5) ? 1 : 2;

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

/** A field as drawn: its tile, level and kind, and its painted cells (src/farmGrid.ts), or the whole tile as one cell */
interface Field { index: number; level: number; kind: FarmKind | null; cells: DrawnCell[] }
/** A cell drawn: its middle (world units), the way its road runs (radians, 0 along +z), its side and its length along
 * its row as a share of its side (a cell a road cut short) */
interface DrawnCell { x: number; z: number; angle: number; size: number; span: number; row: number; nx: number; nz: number; field: Field }

export class CityFarmFields {
  readonly root = new Group();
  private readonly details = new Group();
  private ground: Mesh | null = null;
  /** The fields painted and not grown yet: the zone's tint, faded in while a tool that builds is in hand (wash) */
  private paint: Mesh | null = null;
  private washing = false;
  private washShown = 0;
  private washedAt = -1;
  // (drawn over the land's detail, terrain-detail.ts at -2, -2, which hid the fields of a city map's woods and fields
  // of open land; under the roads and their gravel, which no field cell reaches)
  private readonly groundMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -5 });
  private readonly paintMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -5 });
  private readonly materials = new Map<number, MeshStandardMaterial>();
  private readonly meshes = new Map<string, InstancedMesh[]>();
  private fields: Field[] = [];
  /** The tiles drawn as fields last time, to hear when one stops being one */
  private drawn = new Uint8Array(0);
  /** On a city map, what each tile near the fields was to their cells when drawn (groundClass; 0 not near any) */
  private near = new Uint8Array(0);
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

  /**
   * The zone's tint on the fields painted and not grown yet shown only while a tool that builds is in hand
   * (CityView.zoneWash; owner, 23 Oct 2026), faded in and out over WASH_SECONDS; at once when now. The paddies, crops,
   * ponds and dikes of the grown fields stay, being what is there.
   */
  wash(on: boolean, now = false): void {
    this.washing = on;
    if (now) this.washShown = on ? 1 : 0;
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
      // (and on a city map a road, a building or water near the fields, which may lay their cells otherwise:
      // src/farmGrid.ts)
      if (this.drawn[i] || fieldLevelOf(this.valueAt(i)) >= 0 ||
          this.near.length === size && this.near[i] && this.near[i] !== groundClass(this.valueAt(i))) { this.dirtyAt ??= seconds; break; }
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
    // The tint a step nearer what the tool in hand says
    const step = this.washedAt < 0 ? 0 : Math.max(0, seconds - this.washedAt) / WASH_SECONDS;
    this.washedAt = seconds;
    this.washShown = this.washing ? Math.min(1, this.washShown + step) : Math.max(0, this.washShown - step);
    this.paintMaterial.opacity = this.washShown;
    if (this.paint) this.paint.visible = this.washShown > 0;
    // The drones of a smart farm hover and bob
    for (const d of this.drones) {
      const m = new Matrix4().makeTranslation(d.x, d.y + Math.sin(seconds * 2 + d.x) * 0.25, d.z);
      d.mesh.setMatrixAt(d.n, m);
      d.mesh.instanceMatrix.needsUpdate = true;
    }
    return hubs;
  }

  /**
   * The farm cells the brush in hand would paint (src/farmGrid.ts: their middles and the way their road runs), each a
   * flat square on the land in the brush's colour, turned with its road; none when null (docs/NO_GRID_PLAN.md 3C: the
   * brush shows the shape it paints, in the grid it paints, not a tile)
   */
  showBrush(cells: ReadonlyArray<{ x: number; z: number; angle: number; span?: number }> | null, colour: string | null): void {
    const key = cells && cells.length ? `${cells.length}:${cells[0].x}:${cells[0].z}:${cells[cells.length - 1].x}:${cells[cells.length - 1].z}:${colour}` : '';
    if (key === this.brushKey) return;
    this.brushKey = key;
    if (this.brush) { this.root.remove(this.brush); this.brush.dispose(); this.brush = null; }
    if (!cells || !cells.length) return;
    const side = this.cellUnits();
    if (colour) this.brushMaterial.color.set(colour);
    const mesh = new InstancedMesh(this.brushPlane, this.brushMaterial, cells.length), m = new Matrix4();
    const turn = new Quaternion(), place = new Vector3(), scale = new Vector3(), up = new Vector3(0, 1, 0);
    cells.forEach((c, n) => {
      place.set(c.x, this.terrain.sample(c.x, c.z) + INNER_LIFT + 0.1, c.z);
      turn.setFromAxisAngle(up, c.angle);
      mesh.setMatrixAt(n, m.compose(place, turn, scale.set(side * 0.92, 1, side * 0.92 * (c.span ?? 1))));
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
    this.paint?.geometry.dispose();
    this.paintMaterial.dispose();
    this.materials.forEach((m) => m.dispose());
    this.brush?.dispose();
    this.brushPlane.dispose();
    this.brushMaterial.dispose();
  }

  private valueAt(i: number): number {
    return this.map.getTileValue(i % this.map.width, Math.floor(i / this.map.width)) & 1023;
  }

  /** Whether the fields are painted in road-aligned cells (src/farmGrid.ts): a real-scale city map's */
  private cellMap(): boolean { return farmSide(this.map) > 1; }

  /** World units a side of a field's cell: a farm cell's on a city map, a whole tile elsewhere */
  private cellUnits(): number { return this.cellMap() ? UNITS * CELL_M / tileMetres(this.map) : UNITS; }

  /** What each tile as far from the fields as a road their cells lie along may be (NEAR_FIELDS) is to the cells */
  private nearFields(fields: readonly Field[]): Uint8Array {
    const { width, height } = this.map, out = new Uint8Array(width * height);
    for (const f of fields) {
      const x = f.index % width, y = Math.floor(f.index / width);
      for (let ty = Math.max(0, y - NEAR_FIELDS); ty <= Math.min(height - 1, y + NEAR_FIELDS); ty++) {
        for (let tx = Math.max(0, x - NEAR_FIELDS); tx <= Math.min(width - 1, x + NEAR_FIELDS); tx++) {
          const i = ty * width + tx;
          if (!out[i]) out[i] = groundClass(this.valueAt(i));
        }
      }
    }
    return out;
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
      fields.push({ index: i, level, kind, cells: [] });
      now[i] = 1 + level * 5 + (kind ? 1 + ['paddy', 'field', 'orchard', 'pond'].indexOf(kind) : 0);
    }
    for (let i = 0; i < now.length && !changedHub; i++) if (now[i] !== before[i]) changedHub = true;
    // Each field's cells: on a city map the road-aligned cells painted whose middles lie on it, elsewhere its tile
    const size = this.cellUnits();
    if (this.cellMap()) {
      const byTile = new Map<number, Field>();
      for (const f of fields) byTile.set(f.index, f);
      const grid = this.map as unknown as FarmGridMap;
      for (const { cell, tile } of paintedCells(grid, byTile.keys(), this.map.farmReach ?? undefined)) {
        const f = byTile.get(tile);
        if (f) f.cells.push({ x: cell.x, z: cell.z, angle: cell.angle, size, span: cell.span ?? 1, row: cell.row, nx: cell.nx, nz: cell.nz, field: f });
      }
    } else {
      for (const f of fields) {
        const x = f.index % width, y = Math.floor(f.index / width);
        f.cells.push({ x: (x + 0.5) * UNITS, z: (y + 0.5) * UNITS, angle: 0, size, span: 1, row: -1, nx: 0, nz: 0, field: f });
      }
    }
    this.drawn = now;
    this.fields = fields;
    this.near = this.cellMap() && fields.length ? this.nearFields(fields) : new Uint8Array(0);
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

  /**
   * The fields' ground, on the cells painted (docs/NO_GRID_PLAN.md 3C: the shape the brush went, in rows along its road,
   * never an axis staircase): each cell a patch turned with its road. A paddy's or a pond's dike only where the field
   * ends, along the edge of what was painted, not round every cell (owner, 21 Oct 2026: "นาเป็นสี่เหลี่ยม 16 ม. พร้อมคันนา
   * ทุกช่อง" was the grid he saw): cells of one kind grown side by side in one road's grid are one sheet of water inside
   * one bank, and where two roads' grids meet a bank runs along the seam.
   */
  private buildGround(month: number): void {
    this.ground?.geometry.dispose();
    if (this.ground) this.root.remove(this.ground);
    this.ground = null;
    this.paint?.geometry.dispose();
    if (this.paint) this.root.remove(this.paint);
    this.paint = null;
    this.verts = [];
    if (!this.fields.length) return;
    const positions: number[] = [], colours: number[] = [], outer = new Color(), inner = new Color();
    // (a field painted and not grown yet is the zone's tint, shown only while a tool is in hand: wash)
    const tintPositions: number[] = [], tintColours: number[] = [];
    let target = { positions, colours };
    // The cells drawn, by where their middles lie, to find each one's neighbours in its grid
    const bucket = new Map<number, DrawnCell[]>(), bucketOf = (x: number, z: number): number => Math.floor(z / BUCKET) * 65536 + Math.floor(x / BUCKET);
    for (const f of this.fields) for (const c of f.cells) {
      const b = bucketOf(c.x, c.z);
      let list = bucket.get(b);
      if (!list) bucket.set(b, list = []);
      list.push(c);
    }
    // Whether the cell a side's width from c towards (dx, dz) is a grown field of c's kind in c's grid
    const joins = (c: DrawnCell, dx: number, dz: number): boolean => {
      const f = c.field;
      if (!f.kind || f.level <= 0) return false;
      const px = c.x + dx, pz = c.z + dz, reach = 0.35 * c.size;
      for (let bz = Math.floor((pz - reach) / BUCKET); bz <= Math.floor((pz + reach) / BUCKET); bz++) {
        for (let bx = Math.floor((px - reach) / BUCKET); bx <= Math.floor((px + reach) / BUCKET); bx++) {
          for (const o of bucket.get(bz * 65536 + bx) ?? []) {
            if (o === c || Math.abs(o.x - px) > reach || Math.abs(o.z - pz) > reach) continue;
            const turn = Math.abs(((o.angle - c.angle) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);
            if (turn > 0.3 || o.field.kind !== f.kind || o.field.level <= 0) continue;
            return true;
          }
        }
      }
      return false;
    };
    // A patch of a cell from (u0, v0) to (u1, v1) across and along its road, on the land
    const patch = (c: DrawnCell, u0: number, v0: number, u1: number, v1: number, lift: number, tone: Color): number => {
      const sin = Math.sin(c.angle), cos = Math.cos(c.angle);
      const p = (u: number, v: number): void => {
        const x = c.x + cos * u + sin * v, z = c.z - sin * u + cos * v;
        target.positions.push(x, this.terrain.sample(x, z) + lift, z);
        target.colours.push(tone.r, tone.g, tone.b);
      };
      p(u0, v0); p(u0, v1); p(u1, v0);
      p(u1, v0); p(u0, v1); p(u1, v1);
      return 6;
    };
    // (a road-aligned cell a little larger than its 4 m, so the cells of a bend, laid square, leave no slivers of grass
    // between them; a whole tile as it is)
    const grow = (c: DrawnCell): number => (c.size < UNITS ? CELL_GROW : 1);
    // Neighbouring painted cells in the same row along a road, matched by the road step they were laid from
    // (src/zoneCells.ts: x = px + nx * distance), so their side edges can stretch to meet across a bend
    const rowBucket = new Map<string, DrawnCell[]>(), rowKey = (r: number, bx: number, bz: number): string => `${r}:${bx}:${bz}`;
    const roadBase = (c: DrawnCell): [number, number] => {
      const d = (c.row + 1.6) * c.size;
      return [c.x - c.nx * d, c.z - c.nz * d];
    };
    for (const f of this.fields) for (const c of f.cells) {
      if (c.row < 0) continue;
      const [rx, rz] = roadBase(c), k = rowKey(c.row, Math.floor(rx / BUCKET), Math.floor(rz / BUCKET));
      let list = rowBucket.get(k);
      if (!list) rowBucket.set(k, list = []);
      list.push(c);
    }
    const prevRaw = new Map<DrawnCell, DrawnCell>(), nextRaw = new Map<DrawnCell, DrawnCell>();
    for (const f of this.fields) for (const c of f.cells) {
      if (c.row < 0) continue;
      const [rx, rz] = roadBase(c), bx = Math.floor(rx / BUCKET), bz = Math.floor(rz / BUCKET);
      const sc = Math.sin(c.angle), cc = Math.cos(c.angle), tint = c.field.level === 0 || !c.field.kind;
      let bestPrev: DrawnCell | undefined, bestNext: DrawnCell | undefined, prevD = Infinity, nextD = Infinity;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const o of rowBucket.get(rowKey(c.row, bx + dx, bz + dz)) ?? []) {
          if (o === c || (o.field.level === 0 || !o.field.kind) !== tint) continue;
          const so = Math.sin(o.angle), co = Math.cos(o.angle);
          if (c.nx * o.nx + c.nz * o.nz < 0.85 || sc * so + cc * co < 0.85) continue;
          let tx = sc + so, tz = cc + co;
          const tLen = Math.hypot(tx, tz) || 1;
          tx /= tLen; tz /= tLen;
          const [ox, oz] = roadBase(o);
          const along = (o.x - c.x) * tx + (o.z - c.z) * tz, across = Math.abs((o.x - c.x) * tz - (o.z - c.z) * tx);
          const rAlong = (ox - rx) * tx + (oz - rz) * tz, rAcross = Math.abs((ox - rx) * tz - (oz - rz) * tx);
          if (across > 0.55 * c.size || rAcross > 0.65 * c.size || Math.abs(along) < 0.25 * c.size) continue;
          if (along * rAlong < 0 && Math.abs(along) > 1.65 * c.size) continue;
          if (Math.min(Math.abs(rAlong), Math.abs(along)) > 1.65 * c.size) continue;
          if (along > 0 && along < nextD) { nextD = along; bestNext = o; }
          else if (along < 0 && -along < prevD) { prevD = -along; bestPrev = o; }
        }
      }
      if (bestPrev) prevRaw.set(c, bestPrev);
      if (bestNext) nextRaw.set(c, bestNext);
    }
    const prev = new Map<DrawnCell, DrawnCell>(), next = new Map<DrawnCell, DrawnCell>();
    for (const [a, b] of nextRaw) if (prevRaw.get(b) === a) { next.set(a, b); prev.set(b, a); }
    const bent = (a: DrawnCell | undefined, b: DrawnCell | undefined): boolean =>
      !!a && !!b && (Math.abs(a.angle - b.angle) > 1e-5 || Math.hypot(b.x - a.x, b.z - a.z) > (a.span + b.span) * a.size / 2 * CELL_GROW);
    // Where two neighbouring cells a (back) and b (front) in a row meet at offset u across the road
    const seamAt = (a: DrawnCell, b: DrawnCell, u: number, shift: number, sin: number, cos: number): [number, number] => {
      const sa = Math.sin(a.angle), ca = Math.cos(a.angle), sb = Math.sin(b.angle), cb = Math.cos(b.angle);
      const ax = a.x + ca * u, az = a.z - sa * u, bx = b.x + cb * u, bz = b.z - sb * u;
      const dx = bx - ax, dz = bz - az, denom = Math.max(0.2, 1 + sa * sb + ca * cb);
      const va = Math.max(-a.size, Math.min(8 * a.size, (dx * sa + dz * ca) / denom)), vb = Math.max(-b.size, Math.min(8 * b.size, (dx * sb + dz * cb) / denom));
      return [0.5 * (ax + sa * va + bx - sb * vb) + sin * shift, 0.5 * (az + ca * va + bz - cb * vb) + cos * shift];
    };
    const rowPatch = (c: DrawnCell, u0: number, v0: number, u1: number, v1: number, bIn: number, fIn: number, lift: number, tone: Color): number => {
      const back = prev.get(c), front = next.get(c);
      if (!bent(back, c) && !bent(c, front)) return patch(c, u0, v0, u1, v1, lift, tone);
      const sin = Math.sin(c.angle), cos = Math.cos(c.angle);
      const backPt = (u: number): [number, number] => bent(back, c) ? seamAt(back!, c, u, bIn, sin, cos) : [c.x + cos * u + sin * v0, c.z - sin * u + cos * v0];
      const frontPt = (u: number): [number, number] => bent(c, front) ? seamAt(c, front!, u, -fIn, sin, cos) : [c.x + cos * u + sin * v1, c.z - sin * u + cos * v1];
      const put = ([x, z]: [number, number]): void => {
        target.positions.push(x, this.terrain.sample(x, z) + lift, z);
        target.colours.push(tone.r, tone.g, tone.b);
      };
      const p00 = backPt(u0), p01 = frontPt(u0), p10 = backPt(u1), p11 = frontPt(u1);
      put(p00); put(p01); put(p10);
      put(p10); put(p01); put(p11);
      return 6;
    };
    for (const field of this.fields) {
      const insideToo = this.tones(field, month, outer, inner), tint = field.level === 0 || !field.kind;
      target = tint ? { positions: tintPositions, colours: tintColours } : { positions, colours };
      // Each cell's dike on each side where the field ends: [across left, right, along back, front]
      const insets = field.cells.map((c): [number, number, number, number] => {
        if (!insideToo) return [0, 0, 0, 0];
        const sin = Math.sin(c.angle), cos = Math.cos(c.angle), along = c.size * c.span;
        const inset = Math.min(field.kind === 'pond' ? 1.4 : 0.7, 0.3 * c.size);
        // (across the road: (cos, -sin); along it: (sin, cos)); no dike between a row's neighbours of one kind
        const back = prev.get(c), front = next.get(c);
        const sameKind = (o: DrawnCell | undefined): boolean => !!o && o.field.kind === field.kind && o.field.level > 0;
        return [joins(c, -cos * c.size, sin * c.size) ? 0 : inset, joins(c, cos * c.size, -sin * c.size) ? 0 : inset,
          joins(c, -sin * along, -cos * along) || sameKind(back) ? 0 : inset, joins(c, sin * along, cos * along) || sameKind(front) ? 0 : inset];
      });
      // The earth or the bank under each cell, unless the water covers it whole, then the water or the pond inside
      let outerVerts = 0, innerVerts = 0;
      field.cells.forEach((c, n) => {
        const half = c.size / 2 * grow(c), halfV = half * c.span, [l, r, b, f] = insets[n];
        if (!insideToo || l || r || b || f) outerVerts += rowPatch(c, -half, -halfV, half, halfV, 0, 0, LIFT, outer);
      });
      if (insideToo) field.cells.forEach((c, n) => {
        const half = c.size / 2 * grow(c), halfV = half * c.span, [l, r, b, f] = insets[n];
        innerVerts += rowPatch(c, -half + l, -halfV + b, half - r, halfV - f, b, f, INNER_LIFT, inner);
      });
      // (the tint's vertices are in its own mesh, never recoloured: the month does not change it)
      this.verts.push(tint ? [0, 0] : [outerVerts, innerVerts]);
    }
    if (tintPositions.length) {
      const tintGeometry = new BufferGeometry();
      tintGeometry.setAttribute('position', new BufferAttribute(new Float32Array(tintPositions), 3));
      tintGeometry.setAttribute('color', new BufferAttribute(new Float32Array(tintColours), 3));
      tintGeometry.computeVertexNormals();
      tintGeometry.computeBoundingSphere();
      this.paint = new Mesh(tintGeometry, this.paintMaterial);
      this.paint.name = 'farm_fields/paint';
      this.paint.visible = this.washShown > 0;
      this.root.add(this.paint);
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
    const grown = this.fields.filter((f) => f.level > 0 && f.kind && f.cells.length);
    const rows = cropHeight(month);
    for (const f of grown) {
      if (f.kind === 'field') {
        // Two rows of the crop along each cell, as its road runs (a whole tile's eight, across it)
        const tall = (0.3 + 0.5 * rows) * (0.7 + 0.1 * f.level);
        for (const c of f.cells) {
          const sin = Math.sin(c.angle), cos = Math.cos(c.angle), lines = c.size >= UNITS ? [-3.4, -1.13, 1.13, 3.4] : [-c.size / 4, c.size / 4];
          const pieces = c.size >= UNITS ? [-2.5, 2.5] : [0];
          for (const u of lines) for (const v of pieces) {
            add('row', at(c.x + cos * u + sin * v, c.z - sin * u + cos * v, tall / 2, c.size >= UNITS ? 4.3 : c.size * 0.92 * c.span,
              tall, c.size >= UNITS ? 0.9 : c.size * 0.22, c.angle - Math.PI / 2));
          }
        }
      } else if (f.kind === 'orchard') {
        // Trees in rows along the road, 8 m apart (every other cell of every other row; four a whole tile)
        const grownUp = 0.6 + 0.12 * f.level;
        for (const c of f.cells) {
          for (const [x, z] of this.treeSpots(c)) {
            add('trunk', at(x, z, 0.9 * grownUp, grownUp, grownUp, grownUp));
            add('tree', at(x, z, 2.3 * grownUp, 1.7 * grownUp, 1.4 * grownUp, 1.7 * grownUp, hashOf(f.index)));
          }
        }
      } else if (f.kind === 'pond' && f.level >= 2 && this.painted(f) >= 0.5) {
        const [cx, cz] = this.paintedMiddle(f);
        add('aerator', at(cx, cz, INNER_LIFT + 0.15, 1, 1, 1, f.cells[0].angle + hashOf(f.index) % 6));
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
        if (this.painted(f) < 0.5) continue;
        const [mx, mz] = this.paintedMiddle(f);
        const cx = mx + ((h >> 8) % 5 - 2), cz = mz + ((h >> 12) % 5 - 2);
        // (turned with the field's road, a quarter turn at a time: a machine works along the rows)
        const turn = this.cellMap() ? f.cells[0].angle + ((h >> 16) % 4) * Math.PI / 2 : (h >> 16) % 628 / 100;
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

  /** Where a cell's orchard trees stand (world units): a whole tile's four in its quarters; a city cell's one on every
   * other cell of every other row, counted from its road, so the trees stand in rows 8 m apart along it */
  private treeSpots(c: DrawnCell): Array<[number, number]> {
    if (c.size >= UNITS) return [[c.x - 2.5, c.z - 2.5], [c.x + 2.5, c.z - 2.5], [c.x - 2.5, c.z + 2.5], [c.x + 2.5, c.z + 2.5]];
    const sin = Math.sin(c.angle), cos = Math.cos(c.angle);
    const along = Math.round((c.x * sin + c.z * cos) / c.size), across = Math.round((c.x * cos - c.z * sin) / c.size);
    return along % 2 === 0 && across % 2 === 0 ? [[c.x, c.z]] : [];
  }

  /** How much of its tile a field's drawn cells cover, 0-1 */
  private painted(f: Field): number {
    const side = this.cellUnits();
    return Math.min(1, f.cells.reduce((sum, c) => sum + c.span, 0) * side * side / (UNITS * UNITS));
  }

  /** The middle of a field's drawn cells (world units): its tile's middle when it has none */
  private paintedMiddle(f: Field): [number, number] {
    if (!f.cells.length) {
      const x = f.index % this.map.width, y = Math.floor(f.index / this.map.width);
      return [(x + 0.5) * UNITS, (y + 0.5) * UNITS];
    }
    let sx = 0, sz = 0;
    for (const c of f.cells) { sx += c.x; sz += c.z; }
    return [sx / f.cells.length, sz / f.cells.length];
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
