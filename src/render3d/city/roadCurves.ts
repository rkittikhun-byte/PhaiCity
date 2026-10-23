/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Roads and railways as smooth curves (owner, 14 Oct 2026: "ที่มันเป็นเหลี่ยมๆ ทำให้มันโค้งๆ สวยๆ ได้ไหม ทั้งจังหวัดเลย",
// with a picture of Cities: Skylines' highways sweeping through the countryside). The game lays them tile by tile, so
// a road at a slant is a staircase of tiles; each stretch between junctions is drawn as one ribbon through its tiles'
// middles, the steps smoothed away and the bends rounded, lying on the ground, with junctions one patch with rounded
// corners; roadBuild.ts builds those shapes, this shows them. Bridges, level crossings and power line crossings keep
// their own tile models, the ribbons running up to their edges. The tiles themselves, which the simulation, the tools
// and the cars use, are unchanged: the view draws the curved tiles as open land (TileSnapshot.curves) and this draws
// the roads, and the buildings' lots and driveways beside them. It reads the map and never writes it.
import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, BoxGeometry, OctahedronGeometry, Vector3 } from 'three';
import type { CityHeightField } from './heightfield.js';
import { roadReach, smoothLine, type Point } from '../../roadGeometry.js';
import { graphLines, type GraphLines } from '../../roads/graphLines.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import { CITY_TILE_M } from '../../units.js';
import { mapEra } from '../../era.js';
import { laidOutline, type FootprintMap } from '../../buildings/turnedFootprint.js';
import { compoundSides, fencedBuildings, type CompoundMap } from './compounds.js';
import type { PlacedBuilding } from '../../buildings/placedBuildings.js';
import { isRail, isRoad, type TileSnapshot } from './tileModels.js';
import { Placement } from './placement.js';
import { tint } from '../materials/library.js';
import { loadMaterialTextures } from '../materials/textures.js';
import { applyWorldUV } from '../util/geometry.js';
import type { ModelOptions } from '../models/registry.js';
import { GRADE_STEPS } from '../../terrain/groundGrade.js';
import { assemble, groundHeight, PIECE_RANGE, RoadBuilder, SLEEPER_SIZE, UNDER_LIFT, type MeshData, type Piece, type PieceIndex, type RoadBuild,
  type RoadMap, type RoadReply, type RoadRequest } from './roadBuild.js';

export { smoothLine, type Point };

const OUTSIDE_SHADE = 0.62;
/** How strongly the laterite's scanned bumps show */
const DIRT_BUMPS = 1;
/** The road surfaces' fine grain, so a wide surface of one colour is not flat paint */
function grain(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoadXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoadXZ = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoadXZ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rGrain = sin(vRoadXZ.x * 11.3 + cos(vRoadXZ.y * 9.7)) * cos(vRoadXZ.y * 12.1 - sin(vRoadXZ.x * 8.9));
        float rMacro = sin(vRoadXZ.x * 1.3 + vRoadXZ.y * 0.9) * cos(vRoadXZ.x * 0.8 - vRoadXZ.y * 1.4);
        diffuseColor.rgb *= 1.0 + rGrain * 0.032 + rMacro * 0.024;`);
  };
  material.customProgramCacheKey = () => 'phaicity-road-curves-grain';
}
/** A roadside building's lot: just over the ground, under its road, its driveway and its own model */
const LOT_LIFT = 0.03;
/** ... laid in the buildings' own lawn (models/civic/builder.ts grass, a shade off so its material is the lots' own and
 * may be pulled over the ground), or bare concrete under a works */
const LOT_GRASS = 0x8fbe6e, LOT_YARD = 0xb8b2a4, LOT_REPEAT_M = 4;
/** How far round the changed roads (tiles) a sketch reads the map, so the lines it draws there are whole (sketch) */
const SKETCH_MARGIN = 4;

/** A worker that builds the roads' shapes off the page (road-worker.ts), as a browser's Worker is */
export interface RoadWorkerLike {
  postMessage(message: RoadRequest, transfer: Transferable[]): void;
  onmessage: ((event: { data: RoadReply }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** A build on the scene: where its pieces lie (roadBuild.ts PieceIndex), which of them a sketch hides, its meshes (road,
 * dirt, rails), its stones and sleepers, and its lines */
interface ShownBuild {
  pieces: PieceIndex;
  hidden: Uint8Array;
  meshes: Array<Mesh | null>;
  gravel: InstancedMesh | null;
  sleepers: InstancedMesh | null;
  lines: DrawnCurveLine[];
}

interface DrawnCurveLine {
  points: Point[];
  rail: boolean;
  level: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function lineBounds(points: Point[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, maxX, minZ, maxZ };
}

/** Whether a piece has a corner on one of the tiles */
function pieceOn(piece: Piece, tiles: ReadonlySet<number>, width: number): boolean {
  return [piece.road, piece.dirt, piece.rails].some((data) => {
    if (!data) return false;
    for (let v = 0; v < data.position.length; v += 3) {
      if (tiles.has(Math.floor(data.position[v + 2] / 10) * width + Math.floor(data.position[v] / 10))) return true;
    }
    return false;
  });
}

/** A building tile's lot (its corners, its size in tiles, its triangles, in a works' yard or a lawn) and driveway */
interface Decor {
  lot: { rect: Point[]; size: number; triangles: number[]; yard: boolean } | null;
  drive: Driveway | null;
}
/** A building's driveway: its triangles and their colours, and its line (world units) from the road's edge to the
 * entrance it serves, which it ends at */
export interface Driveway { positions: number[]; colors: number[]; from: Point; to: Point; entrance: Point; halfWidth: number }
/** How wide a driveway is either side of its middle (metres), by what it serves and the city's era: a footpath to a
 * village or market-town home, a lane to a shop, a temple or the ruler's buildings, wider from the factory town on;
 * it flares by DRIVE_FLARE_M each side where it meets the road (owner, 23 Oct 2026: "ทางเข้าวัด หรือเข้าบ้าน ควรจะตรง
 * ประตูบ้าน") */
export function driveHalfWidth(kind: string, era: number): number {
  if (kind === 'residential') return era <= 2 ? 0.6 : 1.2;
  if (kind === 'commercial') return 1.5;
  return era <= 2 ? 1.5 : 2.2;
}
export const DRIVE_FLARE_M = 0.8;
/** A driveway is laid only to a road in front of its entrance: the road's way at most this far off square to it (sine) */
const DRIVE_SQUARE = 0.6;
/** How far from a changed tile (tiles) a building's lot or driveway may have changed with it: a building's tiles change
 * with its centre tile, which lies at most two tiles from any of them (a 4 x 4 block's centre is its tile (1, 1)), and a
 * plot's joined lot is one tile further at most */
const DECOR_REACH = 3;

export class RoadCurves {
  readonly root = new Group();
  private lines: DrawnCurveLine[] = [];
  /** The roads and railways as drawn, for whatever moves along them (buses.ts) */
  get drawnLines(): ReadonlyArray<{ points: Point[]; rail: boolean; level: number }> { return this.lines; }
  private readonly roadMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  private readonly railMaterial = new MeshStandardMaterial({ color: 0x4c5155, roughness: 0.45, metalness: 0.5 });
  private readonly sleeperMaterial = new MeshStandardMaterial({ color: 0xaaa497, roughness: 0.9 });
  private readonly sleeperGeometry = new BoxGeometry(...SLEEPER_SIZE);
  /** Laterite roads, their junctions and ends: the gallery model's dirt, its scanned bumps lit as relief (normal map),
   * coloured by the road's own profile */
  private readonly dirtMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  /** One stone of the shoulders' gravel, flattened and turned by each of its places */
  private readonly stoneGeometry = new OctahedronGeometry(0.5, 0);
  /** ... the gallery's gravel, pulled toward the camera further than the dirt it lies on so it shows over it */
  private readonly stoneMaterial = new MeshStandardMaterial({ color: 0x8c877c, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  /** Builds the roads' shapes, keeping each line's to give back while it stays the same (roadBuild.ts) */
  private builder = new RoadBuilder();
  /** How many pieces the last build made and how many it kept from before */
  readonly lastBuild = { built: 0, reused: 0 };
  /** Each tile's road as last drawn: its value, level and piece when it is a road or a railway, 0 otherwise; and the
   * tiles within one of a road, whose ground lies under some road's edges */
  private roadState = new Uint32Array(0);
  private roadNear = new Uint8Array(0);
  /** The meshes of the roads and railways, and of the buildings' lots and driveways, each drawn again on its own */
  private roadMeshes: Array<Mesh | InstancedMesh> = [];
  private decorMeshes: Mesh[] = [];
  /** The build shown, and the sketch over it of the roads changed since (sketch) */
  private shown: ShownBuild | null = null;
  private sketchMeshes: Array<Mesh | InstancedMesh> = [];
  /** The road tiles changed that the build shown does not have yet: those of the request the worker is building, and
   * those changed since it was sent */
  private sending = new Set<number>();
  private unsent = new Set<number>();
  /** The map's tiles round the changed roads, the rest bare, for the sketch to read */
  private masked: Uint16Array | null = null;
  /** The worker building the roads off the page, once one is asked for; null after it failed, when they are built on
   * the page again */
  private worker: RoadWorkerLike | null = null;
  private workerFactory: (() => RoadWorkerLike) | null;
  /** A request is out: what changed meanwhile waits (the tiles whose ground moved under a road), sent when it comes */
  private waiting = false;
  private queued: number[] | null = null;
  private requests = 0;
  /** The ground's version (heightfield.ts) the worker last had */
  private sentGround = -1;
  /** Counts up whenever a road or railway tile changes, and the roads as drawn worked out for the last count and the
   * graphs' versions (graphLines) */
  private roadsVersion = 0;
  private drawn: { key: string; graph: GraphLines | null; railGraph: GraphLines | null } | null = null;

  /** World units a metre of a road's or a railway's cross-section: 1 on a map of 10 m tiles, less on a real-scale
   * city map's (owner, 15 Oct 2026: roads their real width, src/roadGeometry.ts) */
  private get metre(): number { return Math.min(1, this.snapshot.realUnits ?? 1); }

  /**
   * options.worker makes the worker that builds the roads off the page after the first build, which is built here so
   * the city opens with its roads (owner, 19 Oct 2026: "บันทึก เป็น background"); without one, as in tests, every
   * build is on the page.
   */
  constructor(private readonly snapshot: TileSnapshot, private readonly terrain: CityHeightField,
    options: { worker?: () => RoadWorkerLike } = {}) {
    this.workerFactory = options.worker ?? null;
    this.root.name = 'road_curves';
    this.snapshot.roadSnap = (x, z, reach) => this.nearest(x, z, reach);
    grain(this.roadMaterial); grain(this.dirtMaterial);
    // The laterite's scanned bumps, roughness and shade when they have loaded (none in Node); its colour stays the
    // road's profile
    void loadMaterialTextures('dirt_laterite').then((maps) => {
      if (!maps) return;
      const dirt = this.dirtMaterial;
      dirt.normalMap = maps.normal ?? null; dirt.normalScale.setScalar(DIRT_BUMPS);
      dirt.roughnessMap = maps.roughness ?? null; dirt.aoMap = maps.ao ?? null; dirt.aoMapIntensity = 0.65;
      dirt.needsUpdate = true;
    });
    this.noteRoads(null);
    this.show(this.builder.build(this.roadMap(), this.terrain));
    // The worker made and given the map as soon as the city has opened, not when the first road is drawn: loading its
    // script and building every piece the first time took about 1.4 s, which the first road waited for (19 Oct 2026)
    if (this.workerFactory) setTimeout(() => this.warm(), 0);
  }

  /**
   * Tiles changed (and the ground under raised ones): the roads and railways are drawn again only when one of theirs
   * changed or the ground moved under them; a building's change only lays its lot and driveway again (owner, 19 Oct
   * 2026: the game stalled each time a building rose a stage, as every road in the city was drawn again)
   */
  update(changed: readonly number[], raised: readonly number[] = []): void {
    if (!changed.length && !raised.length) return;
    const roads = this.noteRoads(changed), under = raised.filter((i) => this.roadNear[i]);
    if (roads.length || under.length || this.drawn?.key !== this.drawnKey()) this.rebuild(under, roads);
    else this.rebuildDecor([...changed, ...raised]);
  }

  /** Buildings drawn again without their tiles changing (a building taking its era's look, a farm's hub, a canal dug,
   * the city's new era: null for every one): their lots and driveways laid again */
  redecorate(near: readonly number[] | null): void {
    if (near === null) this.rebuildDecor();
    else if (near.length) this.rebuildDecor(near);
  }

  /** What a tile's road is, for telling when one changes: 0 for a tile with none */
  private roadKey(i: number): number {
    const value = this.snapshot.values[i];
    if (!isRoad(value) && !isRail(value)) return 0;
    return (value | (this.snapshot.roadLevels?.[i] ?? 0) << 10 | (this.snapshot.roadPieces?.[i] ?? 0) << 14) >>> 0;
  }

  /** Notes the changed tiles' roads (all of them for null), which of them differ, and then which tiles lie near one */
  private noteRoads(changed: readonly number[] | null): number[] {
    const { width, height } = this.snapshot, n = width * height, differ: number[] = [];
    let any = false;
    if (changed === null || this.roadState.length !== n) {
      this.roadState = new Uint32Array(n);
      for (let i = 0; i < n; i++) this.roadState[i] = this.roadKey(i);
      any = true;
    } else for (const i of changed) {
      const key = this.roadKey(i);
      if (key !== this.roadState[i]) { this.roadState[i] = key; any = true; differ.push(i); }
    }
    if (any) {
      this.roadsVersion++;
      this.roadNear = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (!this.roadState[i]) continue;
        const x = i % width, y = Math.floor(i / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) this.roadNear[ny * width + nx] = 1;
        }
      }
    }
    return differ;
  }

  /** The point of a road's middle line nearest (x, z) within reach, using AABB early rejection (TileSnapshot.roadSnap) */
  nearest(x: number, z: number, reach: number): { x: number; z: number; tx: number; tz: number; reach: number } | null {
    let best: { x: number; z: number; tx: number; tz: number; reach: number } | null = null, bestDistance = reach;
    for (const line of this.lines) {
      if (line.rail) continue;
      if (x < line.minX - bestDistance || x > line.maxX + bestDistance ||
          z < line.minZ - bestDistance || z > line.maxZ + bestDistance) continue;
      const points = line.points;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        const segMinX = (ax < bx ? ax : bx) - bestDistance;
        if (x < segMinX) continue;
        const segMaxX = (ax > bx ? ax : bx) + bestDistance;
        if (x > segMaxX) continue;
        const segMinZ = (az < bz ? az : bz) - bestDistance;
        if (z < segMinZ) continue;
        const segMaxZ = (az > bz ? az : bz) + bestDistance;
        if (z > segMaxZ) continue;

        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)));
        const px = ax + dx * t, pz = az + dz * t, distance = Math.hypot(px - x, pz - z);
        if (distance < bestDistance) { bestDistance = distance; best = { x: px, z: pz, tx: dx / length, tz: dz / length, reach: roadReach(line.level, this.snapshot.realUnits) }; }
      }
    }
    return best;
  }

  /** Places along the roads near the target for the ambient cars (src/render3d/city/sprites.ts), as tiles would be */
  roadsNear(target: Vector3): Placement[] {
    const near: Placement[] = [];
    for (const { points, rail } of this.lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        if (Math.abs(ax - target.x) > 220 || Math.abs(az - target.z) > 220) continue;
        near.push(new Placement({ index: -1, x: ax, z: az, id: 'road.curve_straight', kind: 'road', rotation: Math.atan2(bx - ax, bz - az),
          footprint: [1, 1], height: 0, color: 0, water: false, scale: 1, powered: false, options: {} as ModelOptions }));
      }
    }
    return near.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)).slice(0, 64);
  }

  dispose(): void {
    this.worker?.terminate(); this.worker = null; this.workerFactory = null;
    for (const meshes of [this.roadMeshes, this.sketchMeshes, this.decorMeshes]) this.drop(meshes);
    this.roadMaterial.dispose(); this.railMaterial.dispose(); this.sleeperMaterial.dispose(); this.sleeperGeometry.dispose();
    this.dirtMaterial.dispose(); this.stoneGeometry.dispose(); this.stoneMaterial.dispose();
  }

  /** Takes the meshes off the scene and frees their geometry */
  private drop(meshes: Array<Mesh | InstancedMesh>): void {
    for (const mesh of meshes) {
      if (!(mesh instanceof InstancedMesh)) mesh.geometry.dispose();
      else mesh.dispose();
      this.root.remove(mesh);
    }
    meshes.length = 0;
  }

  /** Adds a mesh of the lots and driveways to the scene */
  private keep(mesh: Mesh): void {
    this.decorMeshes.push(mesh);
    this.root.add(mesh);
  }

  /** The roads and railways (built again only where they changed, or where the ground moved under the tiles given),
   * then the lots and driveways along them; with a worker, the roads changed are sketched at once until it answers */
  private rebuild(raised: readonly number[], roads: readonly number[] = []): void {
    this.builder.invalidate(raised, this.snapshot.width);
    if (this.workerFactory) {
      for (const i of roads) this.unsent.add(i);
      this.request(raised);
      // (nothing is left to sketch when the worker has failed and the roads were built here instead)
      this.sketch();
      return;
    }
    this.show(this.builder.build(this.roadMap(), this.terrain));
  }

  /** What the roads are built from, read from the map */
  private roadMap(): RoadMap {
    const { width, height, values, roadLevels, roadPieces, roadPaths, realUnits } = this.snapshot;
    const { graph, railGraph } = this.drawnRoads();
    return { width, height, values, levels: roadLevels, pieces: roadPieces, paths: roadPaths, realUnits, graph, railGraph };
  }

  /** The map's road and rail graphs, which tell when the roads as drawn change */
  private graphs(): { road: RoadGraph | null; rail: RoadGraph | null; size: number } {
    const source = this.snapshot.source;
    return { road: source?.roadGraph ?? null, rail: source?.railGraph ?? null, size: source?.tileSizeM || CITY_TILE_M };
  }
  private drawnKey(): string {
    const { road, rail } = this.graphs();
    return `${this.roadsVersion}:${road ? road.version : -1}:${rail ? rail.version : -1}`;
  }

  /** The roads and railways as drawn (src/roads/graphLines.ts), worked out again when a road tile or a graph changed */
  private drawnRoads(): { graph: GraphLines | null; railGraph: GraphLines | null } {
    const key = this.drawnKey();
    if (this.drawn?.key === key) return this.drawn;
    const { road, rail, size } = this.graphs(), { width, height, values } = this.snapshot, pieces = this.snapshot.roadPieces;
    const levels = this.snapshot.roadLevels;
    const map = { width, height, tileSizeM: size, value: (i: number) => values[i], piece: (i: number) => pieces?.[i] ?? 0,
      level: (i: number) => levels?.[i] ?? 1 };
    const lines = (graph: RoadGraph | null): GraphLines | null => (graph && graph.segments.size ? graphLines(graph, map, graph === rail) : null);
    this.drawn = { key, graph: lines(road), railGraph: lines(rail) };
    return this.drawn;
  }

  /**
   * Asks the worker to build the roads: a copy of the map, and of the ground when it changed since the worker last had
   * it. One request at a time; changes meanwhile wait for its answer, and the old roads show until then.
   */
  private request(raised: readonly number[]): void {
    if (this.waiting) { this.queued = [...(this.queued ?? []), ...raised]; return; }
    const worker = this.workerFor();
    if (!worker) { this.rebuild(raised); return; }
    this.sending = this.unsent; this.unsent = new Set();
    this.post(worker, raised, false);
  }

  /** The worker made and sent the map as the city opens, so its pieces are ready before any road is drawn */
  private warm(): void {
    if (this.requests || !this.workerFactory) return;
    const worker = this.workerFor();
    if (worker) this.post(worker, [], true);
  }

  /** Sends the worker a copy of the map, and of the ground when it changed since the worker last had it */
  private post(worker: RoadWorkerLike, raised: readonly number[], quiet: boolean): void {
    const map = this.roadMap(), copy: RoadMap = { ...map, values: map.values.slice(), levels: map.levels?.slice() ?? null,
      pieces: map.pieces?.slice() ?? null };
    const grid = this.terrain.version !== this.sentGround ? this.terrain.grid() : null;
    const transfer: Transferable[] = [copy.values.buffer];
    if (copy.levels) transfer.push(copy.levels.buffer);
    if (copy.pieces) transfer.push(copy.pieces.buffer);
    if (grid) { transfer.push(grid.pads.buffer, grid.corners.buffer); if (grid.mask) transfer.push(grid.mask.buffer); }
    this.waiting = true;
    try {
      worker.postMessage({ id: ++this.requests, map: copy, grid, invalidate: [...raised], ...(quiet ? { quiet } : {}) }, transfer);
      if (grid) this.sentGround = this.terrain.version;
    } catch (error) {
      this.failed(error, raised);
    }
  }

  /** The worker, made the first time it is needed; null when there is none or it could not be made */
  private workerFor(): RoadWorkerLike | null {
    if (this.worker || !this.workerFactory) return this.worker;
    try {
      const worker = this.workerFactory();
      worker.onmessage = ({ data }) => this.answered(data);
      worker.onerror = (event) => this.failed(event, []);
      this.worker = worker;
    } catch (error) {
      this.workerFactory = null;
      console.warn('Roads are built on the page: no worker (' + String(error) + ')');
    }
    return this.worker;
  }

  /** The worker's answer: its roads are shown (none after a quiet request), and what changed meanwhile is asked for
   * next and sketched over them */
  private answered(reply: RoadReply): void {
    this.waiting = false;
    if (!reply.build && reply.error !== null) { this.failed(reply.error, []); return; }
    if (reply.build) { this.sending = new Set(); this.show(reply.build); }
    if (this.queued) { const queued = this.queued; this.queued = null; this.request(queued); }
    if (reply.build && this.workerFactory && this.sending.size + this.unsent.size) this.sketch();
  }

  /** The worker failed (or could not be loaded): the roads are built on the page from now on, starting afresh */
  private failed(error: unknown, raised: readonly number[]): void {
    const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? String(error);
    console.warn('Roads are built on the page: the worker failed (' + message + ')');
    this.worker?.terminate();
    this.worker = null; this.workerFactory = null; this.waiting = false;
    this.builder = new RoadBuilder(); this.sending = new Set(); this.unsent = new Set();
    const queued = this.queued ?? []; this.queued = null;
    this.rebuild([...queued, ...raised]);
  }

  /** Shows a build: its lines for whatever goes along them, and its meshes, then the lots and driveways */
  private show(build: RoadBuild): void {
    this.drop(this.roadMeshes); this.drop(this.sketchMeshes);
    this.lastBuild.built = build.built; this.lastBuild.reused = build.reused;
    this.lines = build.lines.map((line) => ({ ...line, ...lineBounds(line.points) }));
    const meshes = this.meshesOf(build, '', this.roadMeshes);
    this.shown = { pieces: build.pieces, hidden: new Uint8Array(build.pieces.keys.length), lines: this.lines, ...meshes };
    this.rebuildDecor();
  }

  /** A build's meshes on the scene, each named for what it draws (and suffix), kept in list: the road, dirt and rails
   * meshes, the stones and the sleepers */
  private meshesOf(build: RoadBuild, suffix: string, list: Array<Mesh | InstancedMesh>):
    { meshes: Array<Mesh | null>; gravel: InstancedMesh | null; sleepers: InstancedMesh | null } {
    const keep = (shown: Mesh | InstancedMesh): void => { list.push(shown); this.root.add(shown); };
    const mesh = (data: MeshData | null, material: MeshStandardMaterial, name: string, shadow: boolean): Mesh | null => {
      if (!data) return null;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(data.position, 3));
      geometry.setAttribute('normal', new BufferAttribute(data.normal, 3));
      if (data.color) geometry.setAttribute('color', new BufferAttribute(data.color, 3));
      if (data.uv) geometry.setAttribute('uv', new BufferAttribute(data.uv, 2));
      geometry.setIndex(new BufferAttribute(data.index, 1));
      const shown = new Mesh(geometry, material);
      shown.name = name + suffix; shown.receiveShadow = shadow;
      keep(shown);
      return shown;
    };
    const instances = (matrices: Float32Array, geometry: BufferGeometry, material: MeshStandardMaterial, name: string): InstancedMesh | null => {
      if (!matrices.length) return null;
      const shown = new InstancedMesh(geometry, material, matrices.length / 16);
      shown.instanceMatrix.array.set(matrices);
      shown.instanceMatrix.needsUpdate = true;
      shown.name = name + suffix; shown.receiveShadow = true;
      keep(shown);
      return shown;
    };
    const road = mesh(build.road, this.roadMaterial, 'curves', true);
    const dirt = mesh(build.dirt, this.dirtMaterial, 'dirt', true);
    const gravel = instances(build.gravel, this.stoneGeometry, this.stoneMaterial, 'gravel');
    const rails = mesh(build.rails, this.railMaterial, 'rails', false);
    const sleepers = instances(build.sleepers, this.sleeperGeometry, this.sleeperMaterial, 'sleepers');
    return { meshes: [road, dirt, rails], gravel, sleepers };
  }

  /**
   * The roads changed since the build shown, drawn at once while the worker builds them all (owner, 19 Oct 2026: a road
   * showed a moment after it was drawn). The pieces of the build shown with a corner on a changed tile are hidden, and
   * the roads round the changed tiles are built here as the worker will build them, from the map read only there
   * (SKETCH_MARGIN tiles round them and round the pieces hidden): the pieces lying whole inside it, apart from those
   * still shown, are drawn over the build until the worker's answer takes their place. That is a few milliseconds,
   * where all the city's roads took 60-200 ms.
   */
  private sketch(): void {
    this.drop(this.sketchMeshes);
    const shown = this.shown, tiles = new Set([...this.sending, ...this.unsent]);
    if (shown) this.lines = shown.lines;
    if (!shown || !tiles.size) return;
    const { width, height } = this.snapshot;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (const i of tiles) {
      const x = i % width, y = (i - x) / width;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    // The pieces shown on a changed tile hidden (those hidden by an earlier sketch stay so), the map read over them
    const { keys, bounds } = shown.pieces, [bx0, bx1, bz0, bz1] = [x0 * 10, (x1 + 1) * 10, y0 * 10, (y1 + 1) * 10];
    for (let n = 0; n < keys.length; n++) {
      const minX = bounds[n * 4], maxX = bounds[n * 4 + 1], minZ = bounds[n * 4 + 2], maxZ = bounds[n * 4 + 3];
      if (minX > bx1 || maxX < bx0 || minZ > bz1 || maxZ < bz0) continue;
      if (!shown.hidden[n]) {
        if (!this.shownOn(shown, n, tiles)) continue;
        this.hide(shown, n);
      }
      x0 = Math.min(x0, Math.floor(minX / 10)); x1 = Math.max(x1, Math.floor(maxX / 10));
      y0 = Math.min(y0, Math.floor(minZ / 10)); y1 = Math.max(y1, Math.floor(maxZ / 10));
    }
    x0 = Math.max(0, x0 - SKETCH_MARGIN); y0 = Math.max(0, y0 - SKETCH_MARGIN);
    x1 = Math.min(width - 1, x1 + SKETCH_MARGIN); y1 = Math.min(height - 1, y1 + SKETCH_MARGIN);
    const values = this.snapshot.values;
    const masked = this.masked = this.masked?.length === values.length ? this.masked : new Uint16Array(values.length);
    masked.fill(0);
    for (let y = y0; y <= y1; y++) masked.set(values.subarray(y * width + x0, y * width + x1 + 1), y * width + x0);
    const built = this.builder.pieces({ ...this.roadMap(), values: masked, area: [x0, y0, x1, y1] }, this.terrain, false);
    // A piece cut short by the edge of the map read lies within a tile of it, and one still shown is left as it is; a
    // line is drawn whole, a junction, bend or lone tile only by the tiles changed
    const near = new Set<number>();
    for (const i of tiles) {
      const x = i % width, y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add((y + dy) * width + x + dx);
    }
    const inner = [x0 > 0 ? (x0 + 1) * 10 : -Infinity, x1 < width - 1 ? x1 * 10 : Infinity,
      y0 > 0 ? (y0 + 1) * 10 : -Infinity, y1 < height - 1 ? y1 * 10 : Infinity];
    const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean =>
      b.minX >= inner[0] && b.maxX <= inner[1] && b.minZ >= inner[2] && b.maxZ <= inner[3];
    const showing = new Set<string>();
    keys.forEach((key, n) => { if (!shown.hidden[n]) showing.add(key); });
    const pieces = built.pieces.filter((piece) => inside(piece) && !showing.has(piece.key) &&
      (piece.key[0] === 'L' || piece.key[0] === 'R' || pieceOn(piece, near, width)));
    const lines = built.lines.map((line) => ({ ...line, ...lineBounds(line.points) }))
      .filter((line) => inside(line) && line.points.some(([x, z]) => near.has(Math.floor(z / 10) * width + Math.floor(x / 10))));
    if (pieces.length) this.meshesOf(assemble([], pieces, 0, 0), '_sketch', this.sketchMeshes);
    // ... and whatever goes along the roads leaves the lines over a changed tile for the sketch's
    const kept = shown.lines.filter((line) => line.maxX < bx0 || line.minX > bx1 || line.maxZ < bz0 || line.minZ > bz1 ||
      !line.points.some(([x, z]) => tiles.has(Math.floor(z / 10) * width + Math.floor(x / 10))));
    this.lines = [...kept, ...lines];
  }

  /** Whether a piece of the build shown has a corner on one of the tiles */
  private shownOn(shown: ShownBuild, n: number, tiles: ReadonlySet<number>): boolean {
    const width = this.snapshot.width;
    return shown.meshes.some((mesh, k) => {
      if (!mesh) return false;
      const at = n * PIECE_RANGE + k * 4, first = shown.pieces.ranges[at + 2], count = shown.pieces.ranges[at + 3];
      const position = mesh.geometry.getAttribute('position').array as Float32Array;
      for (let v = first; v < first + count; v++) {
        if (tiles.has(Math.floor(position[v * 3 + 2] / 10) * width + Math.floor(position[v * 3] / 10))) return true;
      }
      return false;
    });
  }

  /** Hides a piece of the build shown until the next build: its triangles drawn as nothing, its stones and sleepers
   * shrunk to nothing */
  private hide(shown: ShownBuild, n: number): void {
    shown.hidden[n] = 1;
    const ranges = shown.pieces.ranges, at = n * PIECE_RANGE;
    shown.meshes.forEach((mesh, k) => {
      const first = ranges[at + k * 4], count = ranges[at + k * 4 + 1], index = mesh?.geometry.getIndex();
      if (!index || !count) return;
      (index.array as Uint32Array).fill(0, first, first + count);
      index.addUpdateRange(first, count); index.needsUpdate = true;
    });
    for (const [instances, k] of [[shown.gravel, 12], [shown.sleepers, 14]] as const) {
      const first = ranges[at + k], count = ranges[at + k + 1];
      if (!instances || !count) continue;
      instances.instanceMatrix.array.fill(0, first * 16, (first + count) * 16);
      instances.instanceMatrix.addUpdateRange(first * 16, count * 16); instances.instanceMatrix.needsUpdate = true;
    }
  }

  /** Each building tile's lot and driveway, as rebuildDecor last worked them out (only tiles with either) */
  private decor = new Map<number, Decor>();

  /**
   * The buildings' lots, in their own lawn or yard, and the driveways from their roads, laid again whenever a building
   * changes, which never draws the roads again: those of the tiles within DECOR_REACH of the tiles in `near` worked out
   * again, the rest kept (every tile without it: the roads were drawn again). A building's change worked out every tile of
   * the map again, some 40-200 ms on a 480 x 480 city map's every growing plot; the same triangles in the same order
   */
  private rebuildDecor(near?: readonly number[]): void {
    this.drop(this.decorMeshes);
    const { width, height } = this.snapshot;
    if (!near) {
      this.decor.clear();
      for (let i = 0; i < width * height; i++) this.decorAt(i);
    } else {
      const seen = new Set<number>();
      for (const c of near) {
        const cx = c % width, cy = Math.floor(c / width);
        for (let y = Math.max(0, cy - DECOR_REACH); y <= Math.min(height - 1, cy + DECOR_REACH); y++)
          for (let x = Math.max(0, cx - DECOR_REACH); x <= Math.min(width - 1, cx + DECOR_REACH); x++) {
            const i = y * width + x;
            if (!seen.has(i)) { seen.add(i); this.decorAt(i); }
          }
      }
    }
    // The tiles in order, as the whole map was gone over before
    const tiles = [...this.decor.keys()].sort((a, b) => a - b);
    const lawn: number[] = [], yard: number[] = [], positions: number[] = [], colors: number[] = [];
    this.lotRects.clear();
    for (const i of tiles) {
      const d = this.decor.get(i)!;
      if (d.lot) {
        const { rect, size, triangles, yard: works } = d.lot, x0 = i % width - 1, y0 = Math.floor(i / width) - 1;
        for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) this.lotRects.set((y0 + ty) * width + x0 + tx, rect);
        (works ? yard : lawn).push(...triangles);
      }
    }
    for (const i of tiles) {
      const d = this.decor.get(i)!;
      if (d.drive) { positions.push(...d.drive.positions); colors.push(...d.drive.colors); }
    }
    for (const [lot, key, colour] of [[lawn, 'grass', LOT_GRASS], [yard, 'concrete_raw', LOT_YARD]] as const) {
      if (!lot.length) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(lot, 3));
      const material = tint(key, colour);
      material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
      const mesh = new Mesh(applyWorldUV(geometry, LOT_REPEAT_M * 10 / 16), material);
      mesh.geometry.computeVertexNormals();
      mesh.name = 'lots'; mesh.receiveShadow = true;
      this.keep(mesh);
    }
    if (positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.roadMaterial);
      mesh.name = 'driveways'; mesh.receiveShadow = true;
      this.keep(mesh);
    }
  }

  /** Works out tile i's lot and driveway again (decor) */
  private decorAt(i: number): void {
    this.decor.delete(i);
    if (this.snapshot.values[i] < 240) return;
    const p = this.snapshot.placement(i, 'central');
    if (!p) return;
    const lot = this.lotOf(p), drive = this.drivewayOf(p);
    if (lot || drive) this.decor.set(i, { lot, drive });
  }

  /**
   * The lot of each building stood against its road: lawn under a building of the ruler's, a yard under a works, as big
   * as the building drawn on it (owner, 21 Oct 2026), and the place every tile it takes shows as taken (owner, 18 Oct
   * 2026: a road drawn past the ruler's house was refused on ground that looked open). Zones' plots show their own cells.
   */
  /** The corners of each lot (world units, round it), by every tile of the building it lies under */
  private lotRects = new Map<number, Point[]>();
  /** The lot a building's tile lies on, or null: for whatever shows that tile is taken (overlay.ts blocked) */
  lotAt(index: number): readonly Point[] | null { return this.lotRects.get(index) ?? null; }

  /** The lot of a building (its placement p): its corners, its size in tiles, and its triangles, in a yard or a
   * lawn; null for none */
  private lotOf(p: Placement): Decor['lot'] {
    const { width, height } = this.snapshot;
    {
      if (!p.posed || ['residential', 'commercial', 'industrial'].includes(p.kind)) return null;
      const size = Math.max(p.footprint[0], p.footprint[1]);
      // (from a 2 × 2 up: the 2 × 2 power plant, src/plantBlocks.ts)
      if (size < 2) return null;
      const works = ['power', 'waste', 'industry', 'transport'].includes(p.kind), out: number[] = [], colors: number[] = [], white = new Color(0xffffff);
      // As big as what is built on it and no more (owner, 21 Oct 2026: "พื้นที่รอบข้าง object มันเกินที่ๆ กำหนดหรือป่าว ต้องย่อให้
      // เท่าๆ กับที่สร้างได้พอดี"; it once reached over every tile the building takes, squared to the map, and from there to
      // the road): its drawn front, sides and back (tileModels.ts toRoadEdge, Placement.front), turned with it
      const ground = p.ground(), sin = Math.sin(ground.rotation), cos = Math.cos(ground.rotation);
      const front = p.front ?? ground.depth / 2, at = (u: number, v: number): Point => [ground.x + cos * u + sin * v, ground.z - sin * u + cos * v];
      const uMin = -(p.side ?? front), uMax = p.side ?? front, vMin = -(p.back ?? front), vMax = front;
      const rect = [at(uMin, vMin), at(uMax, vMin), at(uMax, vMax), at(uMin, vMax)];
      // A quad as often as the levelled ground is sampled, so the lot lies on hills and on the slope round a levelled yard
      const columns = Math.ceil((uMax - uMin) / (10 / GRADE_STEPS)), rows = Math.ceil((vMax - vMin) / (10 / GRADE_STEPS));
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const u0 = uMin + (uMax - uMin) * column / columns, u1 = uMin + (uMax - uMin) * (column + 1) / columns;
        const v0 = vMin + (vMax - vMin) * row / rows, v1 = vMin + (vMax - vMin) * (row + 1) / rows;
        const corners = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
        if (corners.some(([x, z]) => x < 0 || z < 0 || x > width * 10 || z > height * 10)) continue;
        this.flat([corners[0], corners[1], corners[2]], white, LOT_LIFT, out, colors);
        this.flat([corners[0], corners[2], corners[3]], white, LOT_LIFT, out, colors);
      }
      return { rect, size, triangles: out, yard: works };
    }
  }

  /** The driveways laid, by the tile of the building each serves, for whoever checks where they lead (tests) */
  driveways(): Driveway[] {
    return [...this.decor.values()].map((d) => d.drive).filter((d): d is Driveway => d !== null);
  }

  /**
   * Where a building is entered and the way it faces (world units): the gate in its fence for a building of the ruler's
   * that is fenced (compounds.ts compoundSides, the middle of the gap), else the middle of its front as drawn (a temple's
   * main gate is in the middle of its wall's front, art/buildings temples.py; a home's or shop's door faces its road).
   */
  private entranceOf(p: Placement): { at: Point; facing: Point } | null {
    const source = this.snapshot.source, units = this.snapshot.realUnits;
    const b = source?.buildings?.atTile(p.index) as PlacedBuilding | undefined;
    if (b && units && b.rot !== null && fencedBuildings(source as unknown as CompoundMap).some((f) => f.id === b.id)) {
      const tileSizeM = source!.tileSizeM || CITY_TILE_M;
      const sides = compoundSides(b, this.snapshot.width, tileSizeM, laidOutline(source as unknown as FootprintMap, b));
      const gate = sides.find((side) => side.gate);
      if (gate) {
        const mx = (gate.ax + gate.bx) / 2, mz = (gate.az + gate.bz) / 2;
        const cx = sides.reduce((sum, side) => sum + side.ax, 0) / 4, cz = sides.reduce((sum, side) => sum + side.az, 0) / 4;
        const length = Math.hypot(mx - cx, mz - cz) || 1;
        return { at: [mx * units, mz * units], facing: [(mx - cx) / length, (mz - cz) / length] };
      }
    }
    const size = Math.max(p.footprint[0], p.footprint[1]);
    const front = p.front !== undefined ? p.front : size * 5 * (p.fill ?? 0.625) * 0.45;
    if (p.posed) {
      const fx = Math.sin(p.rotation), fz = Math.cos(p.rotation);
      return { at: [p.x + fx * front, p.z + fz * front], facing: [fx, fz] };
    }
    // a building standing square to its tiles faces the road nearest it
    const near = this.nearest(p.x, p.z, size * 5 + 28);
    if (!near) return null;
    const dx = near.x - p.x, dz = near.z - p.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) return null;
    return { at: [p.x + dx / length * front, p.z + dz / length * front], facing: [dx / length, dz / length] };
  }

  /**
   * The driveway of a building (its placement p), or null for none: from the edge of the road in front of its entrance,
   * cut along that edge, straight to the entrance, square to the building there, as wide as what it serves needs. None
   * where the building already meets its road, where no road lies in front of its entrance, or where the road runs past
   * at its side.
   */
  private drivewayOf(p: Placement): Decor['drive'] {
    if (!this.lines.length) return null;
    if (['terrain', 'road', 'rail', 'shore', 'debug', 'veg', 'park', 'power'].includes(p.kind)) return null;
    if (p.id?.endsWith('zone_empty')) return null;
    const entrance = this.entranceOf(p);
    if (!entrance) return null;
    const m = this.metre, [ex, ez] = entrance.at, [fx, fz] = entrance.facing;
    // The road in front: the nearest to a point a little ahead of the entrance, and where the entrance's way meets it
    const near = this.nearest(ex + fx * 2 * m, ez + fz * 2 * m, 30);
    if (!near) return null;
    const cross = fx * near.tz - fz * near.tx;
    if (Math.abs(cross) < DRIVE_SQUARE) return null;
    const ahead = ((near.x - ex) * near.tz - (near.z - ez) * near.tx) / cross;
    // ... from its edge (the road's surface, as the old aprons met it)
    const length = ahead - near.reach * 0.72 / Math.abs(cross);
    if (ahead <= 0 || length < 0.3 * m || length > 18) return null;
    const half = driveHalfWidth(p.kind, mapEra(this.snapshot.source as { era?: unknown } | null ?? {})) * m;
    const flare = half + DRIVE_FLARE_M * m, border = 0.24 * m;
    const sx = ex + fx * length, sz = ez + fz * length;
    // across the building's way (u), and along the road, turned to the same side (t), so the road end lies on its edge
    const ux = -fz, uz = fx, along = near.tx * ux + near.tz * uz >= 0 ? 1 : -1, tx = near.tx * along, tz = near.tz * along;
    const k = 1 / Math.abs(tx * ux + tz * uz);
    const corners = (atRoad: number, atDoor: number): [Point, Point, Point, Point] => [
      [sx - tx * atRoad * k, sz - tz * atRoad * k], [sx + tx * atRoad * k, sz + tz * atRoad * k],
      [ex + ux * atDoor, ez + uz * atDoor], [ex - ux * atDoor, ez - uz * atDoor]];
    const positions: number[] = [], colors: number[] = [];
    // an apron of concrete round it, and its paving
    this.quad(corners(flare + border, half + border), new Color(0xb5afa1), UNDER_LIFT + 0.006, positions, colors);
    this.quad(corners(flare, half), new Color(0x6e7174), UNDER_LIFT + 0.012, positions, colors);
    return { positions, colors, from: [sx, sz], to: [ex, ez], entrance: [ex, ez], halfWidth: half };
  }

  /**
   * A quad (corners going round) lying on the ground, lifted, in pieces no longer than the levelled ground's samples are
   * apart (src/terrain/groundGrade.ts GRADE_STEPS), so it follows the slope from a levelled yard to its road and the ground
   * never rises through it (owner, 23 Oct 2026: driveways flickered there, sampled only at their ends)
   */
  private quad(corners: [Point, Point, Point, Point], colour: Color, lift: number, positions: number[], colors: number[]): void {
    const [a, b, c, d] = corners, step = 10 / GRADE_STEPS;
    const along = Math.max(1, Math.ceil(Math.max(Math.hypot(d[0] - a[0], d[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1])) / step));
    const across = Math.max(1, Math.ceil(Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - d[0], c[1] - d[1])) / step));
    const at = (u: number, v: number): Point => {
      const x0 = a[0] + (b[0] - a[0]) * u, z0 = a[1] + (b[1] - a[1]) * u, x1 = d[0] + (c[0] - d[0]) * u, z1 = d[1] + (c[1] - d[1]) * u;
      return [x0 + (x1 - x0) * v, z0 + (z1 - z0) * v];
    };
    for (let j = 0; j < along; j++) for (let i = 0; i < across; i++) {
      const p00 = at(i / across, j / along), p10 = at((i + 1) / across, j / along);
      const p11 = at((i + 1) / across, (j + 1) / along), p01 = at(i / across, (j + 1) / along);
      this.flat([p00, p10, p11], colour, lift, positions, colors);
      this.flat([p00, p11, p01], colour, lift, positions, colors);
    }
  }

  /** A triangle lying on the ground, lifted, facing up whichever way round its corners come; darker outside the province */
  private flat(corners: [Point, Point, Point], colour: Color, lift: number, positions: number[], colors: number[]): void {
    const [a, b, c] = corners, { width, height } = this.snapshot;
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    for (const [x, z] of up >= 0 ? [a, b, c] : [a, c, b]) {
      positions.push(x, groundHeight(this.terrain, width, height, x, z) + lift, z);
      const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
      const shade = tx < 0 || ty < 0 || tx >= width || ty >= height || this.terrain.inside(tx, ty) ? 1 : OUTSIDE_SHADE;
      colors.push(colour.r * shade, colour.g * shade, colour.b * shade);
    }
  }
}
