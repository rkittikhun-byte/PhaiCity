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
import { isRail, isRoad, type TileSnapshot } from './tileModels.js';
import { Placement } from './placement.js';
import { tint } from '../materials/library.js';
import { loadMaterialTextures } from '../materials/textures.js';
import { applyWorldUV } from '../util/geometry.js';
import type { ModelOptions } from '../models/registry.js';
import { groundHeight, RoadBuilder, SLEEPER_SIZE, UNDER_LIFT, type MeshData, type RoadBuild } from './roadBuild.js';

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

  /** World units a metre of a road's or a railway's cross-section: 1 on a map of 10 m tiles, less on a real-scale
   * city map's (owner, 15 Oct 2026: roads their real width, src/roadGeometry.ts) */
  private get metre(): number { return Math.min(1, this.snapshot.realUnits ?? 1); }

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
    this.noteRoads(null);
    this.rebuild([]);
  }

  /**
   * Tiles changed (and the ground under raised ones): the roads and railways are drawn again only when one of theirs
   * changed or the ground moved under them; a building's change only lays its lot and driveway again (owner, 19 Oct
   * 2026: the game stalled each time a building rose a stage, as every road in the city was drawn again)
   */
  update(changed: readonly number[], raised: readonly number[] = []): void {
    if (!changed.length && !raised.length) return;
    const roads = this.noteRoads(changed), under = raised.filter((i) => this.roadNear[i]);
    if (roads || under.length) this.rebuild(under);
    else this.rebuildDecor();
  }

  /** What a tile's road is, for telling when one changes: 0 for a tile with none */
  private roadKey(i: number): number {
    const value = this.snapshot.values[i];
    if (!isRoad(value) && !isRail(value)) return 0;
    return (value | (this.snapshot.roadLevels?.[i] ?? 0) << 10 | (this.snapshot.roadPieces?.[i] ?? 0) << 14) >>> 0;
  }

  /** Notes the changed tiles' roads (all of them for null), whether any differs, and then which tiles lie near one */
  private noteRoads(changed: readonly number[] | null): boolean {
    const { width, height } = this.snapshot, n = width * height;
    let any = false;
    if (changed === null || this.roadState.length !== n) {
      this.roadState = new Uint32Array(n);
      for (let i = 0; i < n; i++) this.roadState[i] = this.roadKey(i);
      any = true;
    } else for (const i of changed) {
      const key = this.roadKey(i);
      if (key !== this.roadState[i]) { this.roadState[i] = key; any = true; }
    }
    if (any) {
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
    return any;
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
    for (const meshes of [this.roadMeshes, this.decorMeshes]) this.drop(meshes);
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

  /** Adds a mesh of the roads (or, decor, of the lots and driveways) to the scene */
  private keep(mesh: Mesh | InstancedMesh, decor = false): void {
    (decor ? this.decorMeshes : this.roadMeshes).push(mesh as Mesh);
    this.root.add(mesh);
  }

  /** The roads and railways (built again only where they changed, or where the ground moved under the tiles given),
   * then the lots and driveways along them */
  private rebuild(raised: readonly number[]): void {
    this.builder.invalidate(raised, this.snapshot.width);
    this.show(this.builder.build(this.roadMap(), this.terrain));
  }

  /** What the roads are built from, read from the map */
  private roadMap(): Parameters<RoadBuilder['build']>[0] {
    const { width, height, values, roadLevels, roadPieces, roadPaths, realUnits } = this.snapshot;
    return { width, height, values, levels: roadLevels, pieces: roadPieces, paths: roadPaths, realUnits };
  }

  /** Shows a build: its lines for whatever goes along them, and its meshes, then the lots and driveways */
  private show(build: RoadBuild): void {
    this.drop(this.roadMeshes);
    this.lastBuild.built = build.built; this.lastBuild.reused = build.reused;
    this.lines = build.lines.map((line) => ({ ...line, ...lineBounds(line.points) }));
    const mesh = (data: MeshData | null, material: MeshStandardMaterial, name: string, shadow: boolean): void => {
      if (!data) return;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(data.position, 3));
      geometry.setAttribute('normal', new BufferAttribute(data.normal, 3));
      if (data.color) geometry.setAttribute('color', new BufferAttribute(data.color, 3));
      if (data.uv) geometry.setAttribute('uv', new BufferAttribute(data.uv, 2));
      geometry.setIndex(new BufferAttribute(data.index, 1));
      const shown = new Mesh(geometry, material);
      shown.name = name; shown.receiveShadow = shadow;
      this.keep(shown);
    };
    const instances = (matrices: Float32Array, geometry: BufferGeometry, material: MeshStandardMaterial, name: string): void => {
      if (!matrices.length) return;
      const shown = new InstancedMesh(geometry, material, matrices.length / 16);
      shown.instanceMatrix.array.set(matrices);
      shown.instanceMatrix.needsUpdate = true;
      shown.name = name; shown.receiveShadow = true;
      this.keep(shown);
    };
    mesh(build.road, this.roadMaterial, 'curves', true);
    mesh(build.dirt, this.dirtMaterial, 'dirt', true);
    instances(build.gravel, this.stoneGeometry, this.stoneMaterial, 'gravel');
    mesh(build.rails, this.railMaterial, 'rails', false);
    instances(build.sleepers, this.sleeperGeometry, this.sleeperMaterial, 'sleepers');
    this.rebuildDecor();
  }

  /** The buildings' lots, in their own lawn or yard, and the driveways from their roads: quick, so laid again whenever a
   * building changes, which never draws the roads again */
  private rebuildDecor(): void {
    this.drop(this.decorMeshes);
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
      this.keep(mesh, true);
    }
    const positions: number[] = [], colors: number[] = [];
    this.driveways(positions, colors);
    if (positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.roadMaterial);
      mesh.name = 'driveways'; mesh.receiveShadow = true;
      this.keep(mesh, true);
    }
  }

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

  /**
   * Trafficity-style Driveway Aprons (ทางเชื่อมหน้าตึกเข้าสู่ถนน): every building standing beside a road gets a paved
   * flared driveway and curb cut connecting its front entrance directly to the road edge.
   */
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
