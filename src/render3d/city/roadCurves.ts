/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Roads and railways as smooth curves (owner, 14 Oct 2026: "ที่มันเป็นเหลี่ยมๆ ทำให้มันโค้งๆ สวยๆ ได้ไหม ทั้งจังหวัดเลย",
// with a picture of Cities: Skylines' highways sweeping through the countryside). The game lays them tile by tile, so
// a road at a slant is a staircase of tiles; here each stretch between junctions is drawn as one ribbon through its
// tiles' middles, the steps smoothed away and the bends rounded, lying on the ground. Dead ends get a round plate, and
// junctions one patch with rounded corners (node);
// bridges, level crossings and power line crossings keep their own tile models, the ribbons running up to their
// edges. The tiles themselves, which the simulation, the tools and the cars use, are unchanged: the view draws the
// curved tiles as open land (TileSnapshot.curves) and this draws the roads. It reads the map and never writes it.
import { BufferGeometry, Color, Euler, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, BoxGeometry, OctahedronGeometry, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { lateriteColour, LATERITE_EDGE } from '../models/road/laterite.js';
import { RAIL_INTERFACE } from '../models/road/interfaces.js';
import type { CityHeightField } from './heightfield.js';
import { halfWidth, nearestOnLines, networkOf, REAL_WIDTH_M, roadLines, roadReach, shoulderOf, smoothLine, type JunctionArm, type JunctionShape, type Point } from '../../roadGeometry.js';
import type { TileSnapshot } from './tileModels.js';
import { Placement } from './placement.js';
import { tint } from '../materials/library.js';
import { loadMaterialTextures } from '../materials/textures.js';
import { applyWorldUV } from '../util/geometry.js';
import type { ModelOptions } from '../models/registry.js';
import { junctionLayout } from './roadJunctions.js';

export { smoothLine, type Point };


const LIFT = 0.15, PLATE_LIFT = 0.17, OUTSIDE_SHADE = 0.62;
/** A road's end under the road it meets, and the shoulders round a junction's corners. */
const UNDER_LIFT = 0.13, CORNER_LIFT = 0.145;
/** A junction's patch (RoadCurves.node): well over the roads' surfaces and their lines, which it covers, as the ground
 * under it bends at the tiles' edges where neither follows it exactly; under the crossings and rings painted on it */
const NODE_LIFT = 0.185, NODE_PAINT_LIFT = NODE_LIFT + 0.009;
/** ... laid in triangles no longer than this a side (world units), so it follows the ground */
const NODE_STEP = 1.5;
/** ... the share of the way out from its middle that is all its own colour, before it shades into its roads' */
const NODE_INNER = 0.55;
/**
 * A laterite road's surface across it, as its gallery model has it (models/road/laterite.ts): by the model's distance
 * from the middle (0 … LATERITE_EDGE), how far over or under the road's lift it lies (world units): a sunlit crown,
 * two wheel tracks worn into it, a low ridge beside them and the edge falling away (owner, 18 Oct 2026: "เพิ่มรายละเอียด
 * 3D (ผิวนูน กรวด ไหล่ทาง) ให้ถนนโค้งและจุดแยกในเกม"). Its crown stays under a junction's patch (NODE_LIFT).
 */
const LATERITE_RELIEF: readonly (readonly [number, number])[] = [[0, 0.025], [0.4, 0.021], [0.8, 0.002], [1.1, -0.022],
  [1.45, -0.022], [1.8, -0.005], [2.1, 0.004], [2.7, -0.003], [3.2, -0.012], [LATERITE_EDGE, -0.018]];
/** ... past its edge a dusty shoulder this share of its half width, sloping down to just over the land */
const LATERITE_SHOULDER = 0.24, SHOULDER_LIFT = 0.04, SHOULDER_DUST = new Color(0xb7a07a);
/** A laterite road's end, its round plate over the crown of the road running into it */
const DIRT_PLATE_LIFT = 0.178;
/** The laterite's own scanned grain (Poly Haven red_laterite_soil_stones) repeats every 2 m */
const DIRT_REPEAT_M = 2, DIRT_BUMPS = 1;
/** Loose gravel on the shoulders, between these distances from the middle (the model's, as LATERITE_RELIEF), about
 * one stone each this share of the road's half width along it */
const GRAVEL_FROM = 2.3, GRAVEL_TO = 3.9, GRAVEL_STEP = 0.4;
function reliefAt(distance: number): number {
  const d = Math.abs(distance), next = LATERITE_RELIEF.findIndex(([at]) => d < at);
  if (next === 0) return LATERITE_RELIEF[0][1];
  if (next < 0) return LATERITE_RELIEF[LATERITE_RELIEF.length - 1][1];
  const [d0, h0] = LATERITE_RELIEF[next - 1], [d1, h1] = LATERITE_RELIEF[next];
  return h0 + (h1 - h0) * (d - d0) / (d1 - d0);
}
/** A number in [0, 1) from a seed, the same every time */
function scatter(seed: number): number {
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}
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
/** How far along each road a junction measures the way it leaves (world units) */
const NODE_ARM = 6;
/** The way a drawn line leaves a point on or near it, measured dist along it on the side `towards` points to */
function leaving(line: readonly Point[], from: Point, towards: Point, dist: number): Point {
  // Where along the line the point lies
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  let best = 0, bestD = Infinity, base: Point = line[0];
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az;
    const t = Math.max(0, Math.min(1, ((from[0] - ax) * dx + (from[1] - az) * dz) / (dx * dx + dz * dz || 1)));
    const p: Point = [ax + dx * t, az + dz * t], d = Math.hypot(p[0] - from[0], p[1] - from[1]);
    if (d < bestD) { bestD = d; best = lengths[i - 1] + t * (lengths[i] - lengths[i - 1]); base = p; }
  }
  const pointAt = (s: number): Point => {
    let i = 1;
    while (i < line.length - 1 && lengths[i] < s) i++;
    const t = Math.max(0, Math.min(1, (s - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1)));
    return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
  };
  const total = lengths[lengths.length - 1];
  for (const s of [Math.min(total, best + dist), Math.max(0, best - dist)]) {
    const p = pointAt(s), dx = p[0] - base[0], dz = p[1] - base[1], l = Math.hypot(dx, dz);
    if (l > dist * 0.3 && dx * towards[0] + dz * towards[1] > 0) return [dx / l, dz / l];
  }
  return towards;
}
/** A roadside building's lot: just over the ground, under its road, its driveway and its own model */
const LOT_LIFT = 0.03;
/** ... laid in the buildings' own lawn (models/civic/builder.ts grass, a shade off so its material is the lots' own and
 * may be pulled over the ground), or bare concrete under a works */
const LOT_GRASS = 0x8fbe6e, LOT_YARD = 0xb8b2a4, LOT_REPEAT_M = 4;

/** A line cut a distance from each end (world units along it): its start, its middle and its finish, each cut point
 * in both of the parts it joins */
function splitEnds(line: Point[], fromStart: number, fromEnd: number): [Point[], Point[], Point[]] {
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = lengths[lengths.length - 1];
  if (fromStart + fromEnd >= total) return fromStart >= fromEnd ? [line, [], []] : [[], [], line];
  const cut = (d: number): { i: number; p: Point } => {
    let i = 1;
    while (i < line.length - 1 && lengths[i] < d) i++;
    const t = (d - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1);
    return { i, p: [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t] };
  };
  const a = fromStart > 0 ? cut(fromStart) : null, b = fromEnd > 0 ? cut(total - fromEnd) : null;
  const start = a ? [...line.slice(0, a.i), a.p] : [];
  const middle = [...(a ? [a.p] : []), ...line.slice(a ? a.i : 0, b ? b.i : line.length), ...(b ? [b.p] : [])];
  const finish = b ? [b.p, ...line.slice(b.i)] : [];
  return [start, middle, finish];
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

export class RoadCurves {
  readonly root = new Group();
  private covered = new Uint8Array(0);
  private lines: DrawnCurveLine[] = [];
  /** The roads and railways as drawn, for whatever moves along them (buses.ts) */
  get drawnLines(): ReadonlyArray<{ points: Point[]; rail: boolean; level: number }> { return this.lines; }
  private readonly roadMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  private readonly railMaterial = new MeshStandardMaterial({ color: 0x9aa3a0, roughness: 0.4, metalness: 0.6 });
  private readonly sleeperMaterial = new MeshStandardMaterial({ color: 0x8d877c, roughness: 0.9 });
  private readonly sleeperGeometry = new BoxGeometry(1.8, 0.08, 0.22);
  /** Laterite roads, their junctions and ends: the gallery model's dirt, its scanned bumps lit as relief (normal map),
   * coloured by the road's own profile */
  private readonly dirtMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  /** One stone of the shoulders' gravel, flattened and turned by each of its places */
  private readonly stoneGeometry = new OctahedronGeometry(0.5, 0);
  /** ... the gallery's gravel, pulled toward the camera further than the dirt it lies on so it shows over it */
  private readonly stoneMaterial = new MeshStandardMaterial({ color: 0x8c877c, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  /** What a rebuild lays in the dirt mesh and the gravel, beside the other roads' positions and colours */
  private dirtPositions: number[] = [];
  private dirtColors: number[] = [];
  private gravel: Matrix4[] = [];

  /** World units a metre of a road's or a railway's cross-section: 1 on a map of 10 m tiles, less on a real-scale
   * city map's (owner, 15 Oct 2026: roads their real width, src/roadGeometry.ts) */
  private get metre(): number { return Math.min(1, this.snapshot.realUnits ?? 1); }
  /** How much narrower a laterite road is drawn than its tile model's profile (models/road/laterite.ts) */
  private get lateriteShare(): number {
    const units = this.snapshot.realUnits;
    return units ? REAL_WIDTH_M[1] / 2 * units / LATERITE_EDGE : 1;
  }

  constructor(private readonly snapshot: TileSnapshot, private readonly terrain: CityHeightField) {
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
    this.rebuild();
  }

  /** Tiles changed: draw the curves and driveways again when a road, railway or building changes */
  update(changed: readonly number[]): void {
    if (changed.length > 0) this.rebuild();
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
    this.clear();
    this.roadMaterial.dispose(); this.railMaterial.dispose(); this.sleeperMaterial.dispose(); this.sleeperGeometry.dispose();
    this.dirtMaterial.dispose(); this.stoneGeometry.dispose(); this.stoneMaterial.dispose();
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      if (child instanceof Mesh || child instanceof InstancedMesh) child.geometry.dispose();
      this.root.remove(child);
    }
  }

  private rebuild(): void {
    this.clear();
    const { width } = this.snapshot;
    this.covered = new Uint8Array(this.snapshot.values.length);
    this.lines = [];
    const positions: number[] = [], colors: number[] = [], railPositions: number[] = [], sleepers: Matrix4[] = [];
    this.dirtPositions = []; this.dirtColors = []; this.gravel = [];
    for (const rail of [false, true]) {
      const levels = this.snapshot.roadLevels, values = this.snapshot.values, pieces = this.snapshot.roadPieces, paths = this.snapshot.roadPaths;
      const network = networkOf({ width, height: this.snapshot.height, value: (i) => values[i],
        level: (i) => levels?.[i] ?? 1, piece: (i) => pieces?.[i] ?? 0, path: (piece) => paths?.[piece] ?? null }, rail);
      const { plates, junctions, covered } = network;
      for (let i = 0; i < covered.length; i++) if (covered[i]) this.covered[i] = 1;
      // One road where it runs on through a junction, the others ending at it (src/roadGeometry.ts roadLines)
      const drawn = roadLines(network);
      if (rail) {
        // A railway that ends at a junction runs on into it a little, so the tracks meeting there overlap and fill it
        for (const { points: line, level } of drawn.lines) {
          if (line.length > 1) for (const [end, before] of [[0, 1], [line.length - 1, line.length - 2]] as const) {
            if (!junctions.some(([x, z]) => Math.hypot(x - line[end][0], z - line[end][1]) < 2)) continue;
            const [ex, ez] = line[end], [bx, bz] = line[before], length = Math.hypot(ex - bx, ez - bz) || 1, reach = 1.6 * this.metre;
            const past: Point = [ex + (ex - bx) / length * reach * 0.6, ez + (ez - bz) / length * reach * 0.6];
            if (end === 0) line.unshift(past); else line.push(past);
          }
          this.lines.push({ points: line, rail, level, ...lineBounds(line) });
          this.rail(line, positions, colors, railPositions, sleepers);
        }
      } else {
        // Where a road ends at a junction with a road running through it, its end lies under that road
        const under = new Map<string, number>();
        for (const junction of drawn.junctions) {
          if (junction.through === null) continue;
          const reach = roadReach(drawn.lines[junction.through].level, this.snapshot.realUnits);
          const along = junction.arms.find((arm) => arm.end === null)!.way;
          for (const arm of junction.arms) if (arm.end !== null) {
            const sine = Math.abs(along[0] * arm.way[1] - along[1] * arm.way[0]);
            under.set(`${arm.line}:${arm.end}`, reach / Math.max(0.35, sine) + 0.3);
          }
        }
        drawn.lines.forEach(({ points: line, level }, n) => {
          this.lines.push({ points: line, rail, level, ...lineBounds(line) });
          const [start, main, finish] = splitEnds(line, under.get(`${n}:0`) ?? 0, under.get(`${n}:1`) ?? 0);
          for (const part of [start, finish]) if (part.length > 1) this.road(part, level, positions, colors, UNDER_LIFT, false);
          if (main.length > 1) this.road(main, level, positions, colors);
        });
        for (const junction of drawn.junctions) this.junction(junction, drawn.lines, positions, colors);
      }
      for (const [x, z, level] of plates) this.plate(x, z, rail ? null : level, positions, colors);
    }
    // The buildings' lots, in their own lawn or yard (lots)
    const lawn: number[] = [], yard: number[] = [], none: number[] = [];
    this.lots(lawn, yard, none);
    for (const [lot, key, colour] of [[lawn, 'grass', LOT_GRASS], [yard, 'concrete_raw', LOT_YARD]] as const) {
      if (!lot.length) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(lot, 3));
      const material = tint(key, colour);
      material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
      const mesh = new Mesh(applyWorldUV(geometry, LOT_REPEAT_M * 10 / 16), material);
      mesh.geometry.computeVertexNormals();
      mesh.name = 'lots'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    this.driveways(positions, colors);
    if (positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.roadMaterial);
      mesh.name = 'curves'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (this.dirtPositions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(this.dirtPositions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(this.dirtColors, 3));
      applyWorldUV(geometry, DIRT_REPEAT_M * this.metre);
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.dirtMaterial);
      mesh.name = 'dirt'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (this.gravel.length) {
      const mesh = new InstancedMesh(this.stoneGeometry, this.stoneMaterial, this.gravel.length);
      this.gravel.forEach((matrix, n) => mesh.setMatrixAt(n, matrix));
      mesh.name = 'gravel'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (railPositions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(railPositions, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.railMaterial);
      mesh.name = 'rails';
      this.root.add(mesh);
    }
    if (sleepers.length) {
      const mesh = new InstancedMesh(this.sleeperGeometry, this.sleeperMaterial, sleepers.length);
      sleepers.forEach((matrix, n) => mesh.setMatrixAt(n, matrix));
      mesh.name = 'sleepers'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }

  /**
   * Trafficity-style Driveway Aprons (ทางเชื่อมหน้าตึกเข้าสู่ถนน): every building standing beside a road gets a paved
   * flared driveway and curb cut connecting its front entrance directly to the road edge.
   */
  /**
   * The lot of each building stood against its road (owner, 18 Oct 2026: a road drawn past the ruler's house was refused
   * on ground that looked open, as the house is drawn smaller than its 3 × 3 tiles): its whole tiles, lawn under a
   * building of the ruler's, a yard under a works, so what it takes up is what the map shows. Zones' plots show their
   * own cells.
   */
  /** The corners of each lot (world units, round it), by every tile of the building it lies under */
  private lotRects = new Map<number, Point[]>();
  /** The lot a building's tile lies on, or null: for whatever shows that tile is taken (overlay.ts blocked) */
  lotAt(index: number): readonly Point[] | null { return this.lotRects.get(index) ?? null; }

  private lots(lawn: number[], yard: number[], colors: number[]): void {
    const { width, height, values } = this.snapshot;
    this.lotRects.clear();
    for (let i = 0; i < width * height; i++) {
      if (values[i] < 240) continue;
      const p = this.snapshot.placement(i, 'central');
      if (!p || !p.posed || ['residential', 'commercial', 'industrial'].includes(p.kind)) continue;
      const size = Math.max(p.footprint[0], p.footprint[1]);
      if (size < 3) continue;
      const out = ['power', 'waste', 'industry', 'transport'].includes(p.kind) ? yard : lawn, white = new Color(0xffffff);
      // As big as its tiles, but turned with it to face its road (owner, 18 Oct 2026: "ที่ว่าการอำเภอ ทำมันวาดเขียวๆ ไม่ขนาน
      // กับถนน"): from the road's edge in front of it (game.js buildingPose: 0.6 before its front) back as deep as wide ...
      const ground = p.ground(), side = size * 10, sin = Math.sin(ground.rotation), cos = Math.cos(ground.rotation);
      const front = ground.depth / 2 + 0.6, at = (u: number, v: number): Point => [ground.x + cos * u + sin * v, ground.z - sin * u + cos * v];
      // ... and reaching over every tile the building takes, which stand square to the map whatever way it is turned, so
      // none lies bare beside it (owner, 18 Oct 2026: "สี่เหลี่ยมสีแดงๆ ... ไม่ติดกับสิ่งก่อสร้างอะไรเลย")
      const x0 = i % width - 1, y0 = Math.floor(i / width) - 1;
      let uMin = -side / 2, uMax = side / 2, vMin = front - side, vMax = front;
      for (const [cx, cz] of [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]]) {
        const dx = cx * 10 - ground.x, dz = cz * 10 - ground.z, u = cos * dx - sin * dz, v = sin * dx + cos * dz;
        uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
      }
      const rect = [at(uMin, vMin), at(uMax, vMin), at(uMax, vMax), at(uMin, vMax)];
      for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) this.lotRects.set((y0 + ty) * width + x0 + tx, rect);
      // A quad about every half tile, so the lot lies on hills
      const columns = Math.ceil((uMax - uMin) / 5), rows = Math.ceil((vMax - vMin) / 5);
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const u0 = uMin + (uMax - uMin) * column / columns, u1 = uMin + (uMax - uMin) * (column + 1) / columns;
        const v0 = vMin + (vMax - vMin) * row / rows, v1 = vMin + (vMax - vMin) * (row + 1) / rows;
        const corners = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
        if (corners.some(([x, z]) => x < 0 || z < 0 || x > width * 10 || z > height * 10)) continue;
        this.flat([corners[0], corners[1], corners[2]], white, LOT_LIFT, out, colors);
        this.flat([corners[0], corners[2], corners[3]], white, LOT_LIFT, out, colors);
      }
    }
  }

  private driveways(positions: number[], colors: number[]): void {
    const { width, height, values } = this.snapshot;
    if (!this.lines.length) return;
    const m = this.metre;
    const apronColour = new Color(0xb5afa1), paveColour = new Color(0x6e7174);
    for (let i = 0; i < width * height; i++) {
      const v = values[i];
      if (v < 240) continue;
      const p = this.snapshot.placement(i, 'central');
      if (!p || ['terrain', 'road', 'rail', 'shore', 'debug', 'veg', 'park', 'power'].includes(p.kind)) continue;
      if (p.id?.endsWith('zone_empty')) continue;
      const size = Math.max(p.footprint[0], p.footprint[1]);
      const near = this.nearest(p.x, p.z, size * 5 + 28);
      if (!near) continue;

      let nx = -near.tz, nz = near.tx;
      if (nx * (p.x - near.x) + nz * (p.z - near.z) < 0) { nx = -nx; nz = -nz; }
      const tx = near.tx, tz = near.tz;
      const dist = Math.hypot(p.x - near.x, p.z - near.z);
      const d0 = near.reach * 0.72;
      const halfDepth = size * 5 * (p.fill ?? 0.625) * 0.45;
      const d1 = Math.max(d0 + 0.9, dist - halfDepth);
      if (d1 <= d0 + 0.2 || d1 > d0 + 18) continue;

      const wRoad = (size >= 3 ? 3.1 : 1.75) * m;
      const wBldg = (size >= 3 ? 2.3 : 1.25) * m;
      const border = 0.24 * m;
      const rx0 = near.x + nx * d0, rz0 = near.z + nz * d0;
      const rx1 = near.x + nx * d1, rz1 = near.z + nz * d1;

      // Outer concrete curb-cut apron
      const a0: Point = [rx0 - tx * (wRoad + border), rz0 - tz * (wRoad + border)];
      const a1: Point = [rx0 + tx * (wRoad + border), rz0 + tz * (wRoad + border)];
      const a2: Point = [rx1 + tx * (wBldg + border), rz1 + tz * (wBldg + border)];
      const a3: Point = [rx1 - tx * (wBldg + border), rz1 - tz * (wBldg + border)];
      this.flat([a0, a1, a2], apronColour, UNDER_LIFT + 0.006, positions, colors);
      this.flat([a0, a2, a3], apronColour, UNDER_LIFT + 0.006, positions, colors);

      // Inner paved driveway surface
      const b0: Point = [rx0 - tx * wRoad, rz0 - tz * wRoad];
      const b1: Point = [rx0 + tx * wRoad, rz0 + tz * wRoad];
      const b2: Point = [rx1 + tx * wBldg, rz1 + tz * wBldg];
      const b3: Point = [rx1 - tx * wBldg, rz1 - tz * wBldg];
      this.flat([b0, b1, b2], paveColour, UNDER_LIFT + 0.012, positions, colors);
      this.flat([b0, b2, b3], paveColour, UNDER_LIFT + 0.012, positions, colors);
    }
  }

  /**
   * The ground's height there, as the far ground draws its tile (province-surface.ts ground): four triangles round
   * the tile's middle, so a twisted tile's ground does not rise through the road
   */
  private height(x: number, z: number): number {
    const tx = Math.max(0, Math.min(this.snapshot.width - 1, Math.floor(x / 10)));
    const tz = Math.max(0, Math.min(this.snapshot.height - 1, Math.floor(z / 10)));
    const at = (px: number, pz: number): number => this.terrain.sampleTile(tx, tz, px, pz);
    const u = Math.max(0, Math.min(1, x / 10 - tx)), v = Math.max(0, Math.min(1, z / 10 - tz));
    const x0 = tx * 10, z0 = tz * 10, middle = at(x0 + 5, z0 + 5);
    // The triangle's two corners: the edge the point faces from the middle
    const [[ax, az], [bx, bz]] = v <= u && v <= 1 - u ? [[0, 0], [1, 0]] : u >= v && u >= 1 - v ? [[1, 0], [1, 1]]
      : v >= u && v >= 1 - u ? [[1, 1], [0, 1]] : [[0, 1], [0, 0]];
    const ha = at(x0 + ax * 10, z0 + az * 10), hb = at(x0 + bx * 10, z0 + bz * 10);
    // Barycentric weights of the point in the triangle (middle, a, b)
    const d = (az - 0.5) * (bx - 0.5) - (ax - 0.5) * (bz - 0.5) || 1;
    const wa = ((v - 0.5) * (bx - 0.5) - (u - 0.5) * (bz - 0.5)) / d;
    const wb = ((u - 0.5) * (az - 0.5) - (v - 0.5) * (ax - 0.5)) / d;
    return middle + wa * (ha - middle) + wb * (hb - middle);
  }

  private shade(colour: Color, x: number, z: number): Color {
    const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
    const inside = tx < 0 || ty < 0 || tx >= this.snapshot.width || ty >= this.snapshot.height || this.terrain.inside(tx, ty);
    return inside ? colour : colour.clone().multiplyScalar(OUTSIDE_SHADE);
  }

  /** A band along the line: columns at the given offsets across it, each with its colour, lifted over the ground (by
   * as much at each offset, when lift is a function of it) */
  private band(line: Point[], offsets: readonly number[], colourAt: (offset: number) => Color, lift: number | ((offset: number) => number),
    positions: number[], colors: number[]): void {
    const liftAt = typeof lift === 'number' ? (): number => lift : lift;
    const rows: Array<Array<[number, number, number, Color]>> = [];
    for (let i = 0; i < line.length; i++) {
      const [px, pz] = line[i], [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / length, nz = (bx - ax) / length;
      rows.push(offsets.map((d) => {
        const x = px + nx * d, z = pz + nz * d;
        return [x, this.height(x, z) + liftAt(d), z, this.shade(colourAt(d), x, z)];
      }));
    }
    for (let i = 1; i < rows.length; i++) for (let k = 1; k < offsets.length; k++) {
      const a = rows[i - 1][k - 1], b = rows[i - 1][k], c = rows[i][k - 1], d = rows[i][k];
      for (const v of [a, b, c, b, d, c]) { positions.push(v[0], v[1], v[2]); colors.push(v[3].r, v[3].g, v[3].b); }
    }
  }

  private road(line: Point[], level: number, positions: number[], colors: number[], lift = LIFT, stripe = true): void {
    if (level <= 1) {
      this.laterite(line, lift, !stripe);
      return;
    }
    const units = this.snapshot.realUnits, half = halfWidth(level, units), side = shoulderOf(units);
    const surface = new Color(level > 2 ? 0x8f8d86 : 0x4b4f50), shoulder = new Color(0xb5aea0), curb = new Color(0x746f65);
    const cWidth = 0.12 * this.metre;
    this.band(line, [-half - side, -half - cWidth, -half, half, half + cWidth, half + side],
      (d) => {
        const ad = Math.abs(d);
        if (ad > half + cWidth + 0.005) return shoulder;
        if (ad > half + 0.005) return curb;
        return surface;
      }, lift, positions, colors);
    // Its centre line and lane dividers, not under the road it meets ("just one more lane": 2, 4, 6, 8 lanes)
    if (!stripe) return;
    const yellowPaint = new Color(0xe2bc52), whitePaint = new Color(0xebe6d8), width = 0.08 * this.metre;
    this.band(line, [-width, width], () => (level >= 4 ? yellowPaint : whitePaint), lift + 0.01, positions, colors);
    if (level >= 4) {
      const lanesPerDir = level >= 6 ? 4 : level === 5 ? 3 : 2;
      const lw = 0.055 * this.metre;
      for (let lane = 1; lane < lanesPerDir; lane++) {
        const laneOffset = (half * lane) / lanesPerDir;
        this.band(line, [-laneOffset - lw, -laneOffset + lw], () => whitePaint, lift + 0.01, positions, colors);
        this.band(line, [laneOffset - lw, laneOffset + lw], () => whitePaint, lift + 0.01, positions, colors);
      }
    }
  }

  /**
   * A laterite road as its gallery model is (models/road/laterite.ts): across it the model's colours and its relief
   * (LATERITE_RELIEF), a dusty shoulder sloping down to the land either side, and loose gravel on the shoulders. An end
   * lying under the road it meets (under) is laid flat, so no crown of it shows through that road's wheel tracks.
   */
  private laterite(line: Point[], lift: number, under: boolean): void {
    const k = this.lateriteShare, e = LATERITE_EDGE * k, outside = e * (1 + LATERITE_SHOULDER);
    const across = LATERITE_RELIEF.map(([d]) => d * k);
    const offsets = [-outside, ...across.slice(1).reverse().map((d) => -d), 0, ...across.slice(1), outside];
    this.band(line, offsets, (d) => (Math.abs(d) > e + 1e-6 ? SHOULDER_DUST : lateriteColour(Math.abs(d) / k)),
      (d) => (Math.abs(d) > e + 1e-6 ? SHOULDER_LIFT : lift + (under ? reliefAt(LATERITE_EDGE) : reliefAt(Math.abs(d) / k))),
      this.dirtPositions, this.dirtColors);
    if (!under) this.stones(line, lift);
  }

  /** Gravel along a laterite road's shoulders, the same stones each time it is drawn (from where they lie) */
  private stones(line: Point[], lift: number): void {
    const k = this.lateriteShare, step = GRAVEL_STEP * LATERITE_EDGE * k, m = this.metre;
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      const tx = (bx - ax) / length, tz = (bz - az) / length;
      for (let s = carry; s < length; s += step) {
        const x0 = ax + tx * s, z0 = az + tz * s, seed = x0 * 12.9898 + z0 * 78.233;
        const side = scatter(seed) < 0.5 ? -1 : 1, d = GRAVEL_FROM + (GRAVEL_TO - GRAVEL_FROM) * scatter(seed + 1.7);
        const slide = (scatter(seed + 3.1) - 0.5) * step;
        const x = x0 + tx * slide - tz * side * d * k, z = z0 + tz * slide + tx * side * d * k;
        this.stone(x, z, d <= LATERITE_EDGE ? lift + reliefAt(d) : SHOULDER_LIFT + 0.01, seed, m);
      }
      carry = (carry - length) % step;
      if (carry < 0) carry += step;
    }
  }

  /** One stone, a flattened pebble of a size and a turn its seed picks, lying at (x, z) that far over the ground */
  private stone(x: number, z: number, lift: number, seed: number, m: number): void {
    const size = (0.8 + 0.8 * scatter(seed + 5.3)) * m;
    const turn = new Quaternion().setFromEuler(new Euler(0, scatter(seed + 7.9) * Math.PI, (scatter(seed + 9.2) - 0.5) * 0.6));
    this.gravel.push(new Matrix4().compose(new Vector3(x, this.height(x, z) + lift + 0.015 * size, z), turn,
      new Vector3(0.16 * size, 0.08 * size, 0.12 * size)));
  }

  private rail(line: Point[], positions: number[], colors: number[], railPositions: number[], sleepers: Matrix4[]): void {
    const m = this.metre, ballast = new Color(0x8b8379), edge = new Color(0x77705f), half = RAIL_INTERFACE.ballastWidth / 2 * m;
    this.band(line, [-half, -1.2 * m, 1.2 * m, half], (d) => (Math.abs(d) > 1.21 * m ? edge : ballast), LIFT, positions, colors);
    // The two rails, low boxes along the line
    const gauge = (RAIL_INTERFACE.gauge + RAIL_INTERFACE.railWidth) / 2 * m, rail = 0.05 * m;
    for (const side of [-1, 1]) {
      const scratch: number[] = [], none: number[] = [];
      this.band(line, [side * gauge - rail, side * gauge + rail], () => ballast, 0.42 * m, scratch, none);
      railPositions.push(...scratch);
    }
    // Sleepers every RAIL_INTERFACE.sleeperSpacing along it
    const up = new Vector3(0, 1, 0), turn = new Quaternion(), place = new Vector3(), size = new Vector3(m, m, m);
    const spacing = RAIL_INTERFACE.sleeperSpacing * m;
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      turn.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax) + Math.PI / 2);
      for (let s = carry; s < length; s += spacing) {
        const x = ax + (bx - ax) * s / length, z = az + (bz - az) * s / length;
        place.set(x, this.height(x, z) + 0.3 * m, z);
        sleepers.push(new Matrix4().compose(place, turn, size));
      }
      carry = (carry - length) % spacing;
      if (carry < 0) carry += spacing;
    }
  }

  /**
   * A junction where three or more roads meet, as Cities: Skylines draws it: between each two roads next to each other
   * round it (not the two halves of a road running through) the ground between their shoulders is filled up to a
   * curve that meets both, and over the middle lies one patch (node) with its corners rounded.
   */
  private junction(drawnJunction: JunctionShape, lines: ReadonlyArray<{ level: number; points: Point[] }>, positions: number[], colors: number[]): void {
    if (!drawnJunction.arms.length) return;
    // ... where its roads really cross (crossingOf), each leaving it the way its line as drawn does
    const junction = drawnJunction.arms.length < 3 ? drawnJunction : this.crossingOf(drawnJunction, lines);
    const { at, arms } = junction, units = this.snapshot.realUnits;
    const maxLevel = Math.max(...arms.map((arm) => lines[arm.line].level));
    if (arms.length < 3) {
      // A 2-arm level transition is already joined seamlessly along the continuous smooth curve; 1-arm dead ends get a
      // plate, and so do two drawn lines that meet end to end at a corner (src/roadPieces.ts), not where the newer goes
      // on along the older's way
      if (arms.length === 1 || !junction.smooth && arms.every((arm) => arm.end !== null)) this.plate(at[0], at[1], maxLevel, positions, colors);
      return;
    }
    const layout = junctionLayout(at, arms.map((arm) => ({ points: lines[arm.line].points, way: arm.way,
      half: lines[arm.line].level <= 1 ? LATERITE_EDGE * this.lateriteShare : halfWidth(lines[arm.line].level, units) })), this.metre);
    this.node(junction, lines, layout, positions, colors);
    // Trafficity-style Automatic Roundabout (วงเวียนอัตโนมัติ) only at true 4+ way intersections where at least 3 arms are paved
    const pavedArms = arms.filter((arm) => lines[arm.line].level >= 2).length;
    if (arms.length >= 4 && pavedArms >= 3 && maxLevel >= 3) {
      const maxReach = Math.max(...arms.map((arm) => roadReach(lines[arm.line].level, units)));
      this.roundabout(at[0], at[1], maxReach, maxLevel, positions, colors);
    }
    // Zebra crosswalks (ทางม้าลาย) on paved urban roads meeting at a junction (levels 2–6)
    if (arms.length >= 3) {
      const m = this.metre;
      const zebraPaint = new Color(0xebe6d8), zebraLift = NODE_PAINT_LIFT;
      for (const [k, arm] of arms.entries()) {
        const level = lines[arm.line].level;
        if (level < 2 || level >= 7) continue;
        const hw = halfWidth(level, units), mouth = layout.mouths[k];
        const [wx, wz] = mouth.way, nx = -wz, nz = wx;
        const cx = mouth.at[0] + wx * 1.15 * m, cz = mouth.at[1] + wz * 1.15 * m;
        const barHalfLen = 0.68 * m, barHalfW = 0.16 * m, step = 0.62 * m;
        for (let s = -hw * 0.78; s <= hw * 0.78 + 1e-4; s += step) {
          const bx = cx + nx * s, bz = cz + nz * s;
          const p0: Point = [bx - wx * barHalfLen - nx * barHalfW, bz - wz * barHalfLen - nz * barHalfW];
          const p1: Point = [bx - wx * barHalfLen + nx * barHalfW, bz - wz * barHalfLen + nz * barHalfW];
          const p2: Point = [bx + wx * barHalfLen + nx * barHalfW, bz + wz * barHalfLen + nz * barHalfW];
          const p3: Point = [bx + wx * barHalfLen - nx * barHalfW, bz + wz * barHalfLen - nz * barHalfW];
          this.flat([p0, p1, p2], zebraPaint, zebraLift, positions, colors);
          this.flat([p0, p2, p3], zebraPaint, zebraLift, positions, colors);
        }
      }
    }
  }

  /**
   * A junction's middle as one patch over the roads meeting there (owner, 18 Oct 2026: "จุดแยกของถนน มันควรจะมี
   * graphic ที่สวยงามกว่านี้"): each road's carriageway out past where the others cross it, the corners between roads
   * next to each other rounded, so no road's wheel tracks, lines or kerbs run on across the others. A laterite
   * junction shades from its crown in the middle to each road's own colours where the road leaves it, so the tracks
   * fade into it; a paved one is its widest road's surface, with a kerb along each rounded corner.
   */
  private node(junction: JunctionShape, lines: ReadonlyArray<{ level: number; points: Point[] }>, layout: ReturnType<typeof junctionLayout>, roadPositions: number[], roadColors: number[]): void {
    const { at, arms } = junction, units = this.snapshot.realUnits, n = arms.length, m = this.metre;
    const levels = arms.map((arm) => lines[arm.line].level), maxLevel = Math.max(...levels), paved = maxLevel > 1;
    // A laterite junction is the laterite roads' own dirt
    const positions = paved ? roadPositions : this.dirtPositions, colors = paved ? roadColors : this.dirtColors;
    // Each road's carriageway either side of its middle, and its reach with its shoulders
    const half = levels.map((level) => (level <= 1 ? LATERITE_EDGE * this.lateriteShare : halfWidth(level, units)));
    const surfaceAt = (level: number): Color => new Color(level > 2 ? 0x8f8d86 : 0x4b4f50);
    const surface = paved ? surfaceAt(maxLevel) : lateriteColour(0.6);
    const { mouths, corners } = layout;
    // Its outline round the junction, each point in its colour: across each road where the patch ends (a laterite
    // road's shades across it), then round the corner to the next road
    const outline: Array<[Point, Color]> = [];
    arms.forEach((arm, k) => {
      const mouth = mouths[k], h = half[k], [lx, lz] = mouth.normal, level = lines[arm.line].level;
      const across = level > 1 ? [-1, 0, 1] : [-1, -0.7, -0.35, 0, 0.35, 0.7, 1];
      for (const o of across) outline.push([[mouth.at[0] + lx * h * o, mouth.at[1] + lz * h * o],
        level > 1 ? surfaceAt(level) : lateriteColour(Math.abs(o) * LATERITE_EDGE)]);
      const edgeA = level > 1 ? surfaceAt(level) : lateriteColour(LATERITE_EDGE);
      const nextLevel = levels[(k + 1) % n], edgeB = nextLevel > 1 ? surfaceAt(nextLevel) : lateriteColour(LATERITE_EDGE);
      for (const p of corners[k].points.slice(1, -1)) outline.push([p.at, edgeA.clone().lerp(edgeB, p.fraction)]);
    });
    // Filled from the middle: its inner part in the patch's own colour, shading over the outer part to each road's
    // colours at its edge, so a laterite road's tracks fade out just inside it
    const inner = outline.map(([p]): Point => [at[0] + (p[0] - at[0]) * NODE_INNER, at[1] + (p[1] - at[1]) * NODE_INNER]);
    const area = outline.reduce((sum, [p], i) => {
      const q = outline[(i + 1) % outline.length][0];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) * 0.5;
    const fanArea = outline.reduce((sum, [p], i) => {
      const q = outline[(i + 1) % outline.length][0];
      return sum + Math.abs((p[0] - at[0]) * (q[1] - at[1]) - (q[0] - at[0]) * (p[1] - at[1])) * 0.5;
    }, 0);
    if (fanArea > Math.abs(area) + 0.01) {
      // Concave curved approaches can put the node outside the polygon's visibility kernel.
      // Triangulate the outline so the pad cannot fold over itself or cover the land outside it.
      for (const face of ShapeUtils.triangulateShape(outline.map(([p]) => new Vector2(...p)), [])) {
        this.fine(face.map((i) => outline[i][0]) as [Point, Point, Point], face.map((i) => outline[i][1]) as [Color, Color, Color], NODE_LIFT, positions, colors);
      }
    } else for (let k = 0; k < outline.length; k++) {
      const next = (k + 1) % outline.length, [p, cp] = outline[k], [q, cq] = outline[next];
      this.fine([at, inner[k], inner[next]], [surface, surface, surface], NODE_LIFT, positions, colors);
      this.fine([inner[k], p, q], [surface, cp, cq], NODE_LIFT, positions, colors);
      this.fine([inner[k], q, inner[next]], [surface, cq, surface], NODE_LIFT, positions, colors);
    }
    // The same edge samples drive the shoulder and kerb. Their width tapers to zero at a dirt
    // approach instead of drawing a hard kerb or a rectangular shoulder across its wheel tracks.
    for (let k = 0; k < n; k++) {
      const sideA = levels[k] > 1 ? shoulderOf(units) : 0, sideB = levels[(k + 1) % n] > 1 ? shoulderOf(units) : 0;
      const points = corners[k].points, kerb = new Color(0x746f65), shoulder = new Color(0xb5aea0);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const wa = sideA + (sideB - sideA) * a.fraction, wb = sideA + (sideB - sideA) * b.fraction;
        if (wa + wb < 0.001) continue;
        const offset = (p: typeof a, w: number): Point => [p.at[0] + p.normal[0] * w, p.at[1] + p.normal[1] * w];
        const ai = offset(a, Math.min(0.12 * m, wa)), bi = offset(b, Math.min(0.12 * m, wb));
        const ao = offset(a, wa), bo = offset(b, wb);
        this.flat([a.at, b.at, bi], kerb, NODE_LIFT + 0.001, positions, colors);
        this.flat([a.at, bi, ai], kerb, NODE_LIFT + 0.001, positions, colors);
        this.flat([ai, bi, bo], shoulder, NODE_LIFT + 0.001, positions, colors);
        this.flat([ai, bo, ao], shoulder, NODE_LIFT + 0.001, positions, colors);
      }
    }
    if (paved) return;
    // A laterite junction's rounded corners fall away into the dusty shoulder its roads have, gravel lying along them
    const edge = lateriteColour(LATERITE_EDGE);
    for (let k = 0; k < n; k++) {
      const points = corners[k].points, widthAt = (p: typeof points[number]): number =>
        LATERITE_SHOULDER * (half[k] + (half[(k + 1) % n] - half[k]) * p.fraction);
      const offset = (p: typeof points[number], w: number): Point => [p.at[0] + p.normal[0] * w, p.at[1] + p.normal[1] * w];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], ao = offset(a, widthAt(a)), bo = offset(b, widthAt(b));
        this.shaded([a.at, b.at, bo], [edge, edge, SHOULDER_DUST], [NODE_LIFT, NODE_LIFT, SHOULDER_LIFT], positions, colors);
        this.shaded([a.at, bo, ao], [edge, SHOULDER_DUST, SHOULDER_DUST], [NODE_LIFT, SHOULDER_LIFT, SHOULDER_LIFT], positions, colors);
      }
      points.forEach((p, i) => {
        const seed = p.at[0] * 12.9898 + p.at[1] * 78.233 + i, share = scatter(seed) * 1.3 - 0.3;
        const [x, z] = offset(p, widthAt(p) * share);
        this.stone(x, z, share <= 0 ? NODE_LIFT : NODE_LIFT + (SHOULDER_LIFT + 0.01 - NODE_LIFT) * share, seed, m);
      });
    }
  }

  /**
   * Where a junction's roads cross as drawn: a line drawn on from another may meet it a little off the junction's own
   * middle (src/roadGeometry.ts), and the patch lies where they really cross, so it is centred on the roads
   */
  private crossingOf(junction: JunctionShape, lines: ReadonlyArray<{ points: Point[] }>): JunctionShape {
    const { at } = junction, found: Point[] = [];
    // The way each leaves it, along its line as drawn: a junction's own measure starts at its middle, which may lie
    // off a line that only passes near it
    const leave = (arms: readonly JunctionArm[], from: Point): JunctionArm[] => arms
      .map((arm) => ({ ...arm, way: leaving(lines[arm.line].points, from, arm.way, NODE_ARM) }))
      .sort((a, b) => Math.atan2(a.way[1], a.way[0]) - Math.atan2(b.way[1], b.way[0]));
    let arms = leave(junction.arms, at);
    const base = arms.map((arm) => nearestOnLines([lines[arm.line].points], at[0], at[1], 20) ?? at);
    for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++) {
      if (arms[i].line === arms[j].line) continue;
      // base i + a s = base j + b t
      const a = arms[i].way, b = arms[j].way, det = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(det) < 0.3) continue;
      const rx = base[j][0] - base[i][0], rz = base[j][1] - base[i][1], s = (rx * b[1] - rz * b[0]) / det;
      const p: Point = [base[i][0] + a[0] * s, base[i][1] + a[1] * s];
      if (Math.hypot(p[0] - at[0], p[1] - at[1]) < 10) found.push(p);
    }
    if (!found.length) return { ...junction, arms };
    const middle: Point = [found.reduce((sum, p) => sum + p[0], 0) / found.length, found.reduce((sum, p) => sum + p[1], 0) / found.length];
    arms = leave(junction.arms, middle);
    return { ...junction, at: middle, arms };
  }

  /**
   * A Trafficity-style circular roundabout island and ring carriageway at a major intersection.
   */
  private roundabout(cx: number, cz: number, maxReach: number, level: number, positions: number[], colors: number[]): void {
    const surface = new Color(level > 2 ? 0x8f8d86 : 0x4b4f50);
    const shoulder = new Color(0xb5aea0);
    const whiteRing = new Color(0xebe6d8);
    const curbStone = new Color(0xd8d2c5);
    const islandGrass = new Color(0x4d8a44);
    const rOuter = maxReach * 1.28;
    const rCarriage = maxReach * 1.08;
    const rIslandCurb = maxReach * 0.46;
    const rIslandGrass = maxReach * 0.36;
    const rings: Array<[number, number, Color, number]> = [
      [rCarriage, rOuter, shoulder, CORNER_LIFT + 0.002],
      [rIslandCurb, rCarriage, surface, NODE_LIFT + 0.003],
      [rCarriage * 0.92, rCarriage * 0.96, whiteRing, NODE_PAINT_LIFT],
      [rIslandGrass, rIslandCurb, curbStone, NODE_LIFT + 0.04],
      [0, rIslandGrass, islandGrass, NODE_LIFT + 0.07],
    ];
    const n = 24;
    for (const [r0, r1, col, lift] of rings) {
      const shaded = this.shade(col, cx, cz);
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        const p0: [number, number, number] = [cx + Math.cos(a0) * r0, this.height(cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0) + lift, cz + Math.sin(a0) * r0];
        const p1: [number, number, number] = [cx + Math.cos(a1) * r0, this.height(cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0) + lift, cz + Math.sin(a1) * r0];
        const p2: [number, number, number] = [cx + Math.cos(a0) * r1, this.height(cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1) + lift, cz + Math.sin(a0) * r1];
        const p3: [number, number, number] = [cx + Math.cos(a1) * r1, this.height(cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1) + lift, cz + Math.sin(a1) * r1];
        for (const v of [p0, p1, p2, p1, p3, p2]) {
          positions.push(v[0], v[1], v[2]);
          colors.push(shaded.r, shaded.g, shaded.b);
        }
      }
    }
  }

  /** shaded, split across its longest side until none is longer than NODE_STEP, so it follows the ground */
  private fine(corners: [Point, Point, Point], colours: [Color, Color, Color], lift: number, positions: number[], colors: number[], depth = 0): void {
    const sides = [0, 1, 2].map((k) => Math.hypot(corners[(k + 1) % 3][0] - corners[k][0], corners[(k + 1) % 3][1] - corners[k][1]));
    const k = sides.indexOf(Math.max(...sides));
    if (sides[k] <= NODE_STEP || depth > 8) { this.shaded(corners, colours, lift, positions, colors); return; }
    const a = corners[k], b = corners[(k + 1) % 3], c = corners[(k + 2) % 3], ca = colours[k], cb = colours[(k + 1) % 3], cc = colours[(k + 2) % 3];
    const m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cm = ca.clone().lerp(cb, 0.5);
    this.fine([a, m, c], [ca, cm, cc], lift, positions, colors, depth + 1);
    this.fine([m, b, c], [cm, cb, cc], lift, positions, colors, depth + 1);
  }

  /** A triangle lying on the ground, lifted (each corner by as much, when lift lists three), facing up whichever way
   * round its corners come, each corner its colour */
  private shaded(corners: [Point, Point, Point], colours: [Color, Color, Color], lift: number | readonly [number, number, number],
    positions: number[], colors: number[]): void {
    const [a, b, c] = corners;
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    for (const k of up >= 0 ? [0, 1, 2] : [0, 2, 1]) {
      const [x, z] = corners[k];
      positions.push(x, this.height(x, z) + (typeof lift === 'number' ? lift : lift[k]), z);
      const shaded = this.shade(colours[k], x, z); colors.push(shaded.r, shaded.g, shaded.b);
    }
  }

  /** A triangle lying on the ground, lifted, facing up whichever way round its corners come */
  private flat(corners: [Point, Point, Point], colour: Color, lift: number, positions: number[], colors: number[]): void {
    const [a, b, c] = corners;
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    for (const [x, z] of up >= 0 ? [a, b, c] : [a, c, b]) {
      positions.push(x, this.height(x, z) + lift, z);
      const shaded = this.shade(colour, x, z); colors.push(shaded.r, shaded.g, shaded.b);
    }
  }

  /**
   * A round plate at a junction or a road's end, shaded across as the road is (its rings the road's colours from its
   * middle to its edge), so the roads meeting there run into it rather than ending at a disc; level null for a railway
   */
  private plate(cx: number, cz: number, level: number | null, roadPositions: number[], roadColors: number[]): void {
    // Each ring's radius, its colour and how far over the ground it lies
    let rings: Array<[number, Color, number?]>, lift = PLATE_LIFT, positions = roadPositions, colors = roadColors;
    if (level === null) {
      const m = this.metre, half = RAIL_INTERFACE.ballastWidth / 2 * m;
      rings = [[0, new Color(0x8b8379)], [1.2 * m, new Color(0x8b8379)], [half, new Color(0x77705f)]];
    } else if (level <= 1) {
      // A laterite road's end: its dirt, over the crown of the road running into it, falling away into its shoulder
      const k = this.lateriteShare, e = LATERITE_EDGE * k;
      lift = DIRT_PLATE_LIFT; positions = this.dirtPositions; colors = this.dirtColors;
      rings = [0, 0.35, 0.7, 1].map((share): [number, Color] => [e * share, lateriteColour(LATERITE_EDGE * share)]);
      rings.push([e * (1 + LATERITE_SHOULDER), SHOULDER_DUST, SHOULDER_LIFT]);
    } else {
      const units = this.snapshot.realUnits, half = halfWidth(level, units), surface = new Color(level > 2 ? 0x8f8d86 : 0x555959);
      rings = [[0, surface], [half, surface], [half + 0.01, new Color(0xa39c8f)], [half + shoulderOf(units), new Color(0xa39c8f)]];
    }
    const n = 20, at = (radius: number, angle: number, over: number): [number, number, number] => {
      const x = cx + Math.cos(angle) * radius, z = cz + Math.sin(angle) * radius;
      return [x, this.height(x, z) + over, z];
    };
    for (let ring = 1; ring < rings.length; ring++) {
      const [r0, c0, l0 = lift] = rings[ring - 1], [r1, c1, l1 = lift] = rings[ring];
      const inner = this.shade(c0, cx, cz), outer = this.shade(c1, cx, cz);
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
        const p = at(r0, a0, l0), q = at(r0, a1, l0), s = at(r1, a0, l1), t = at(r1, a1, l1);
        for (const [v, c] of [[p, inner], [q, inner], [s, outer], [q, inner], [t, outer], [s, outer]] as const) {
          positions.push(v[0], v[1], v[2]); colors.push(c.r, c.g, c.b);
        }
      }
    }
  }
}
