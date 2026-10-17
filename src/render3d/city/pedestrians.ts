/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  BoxGeometry, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D, Vector3,
} from 'three';
import { mergeGeometry } from '../util/geometry.js';
import { getMaterial } from '../materials/library.js';
import { registry } from '../models/registry.js';
import { CIVIC, COMBASE, HOSPITALBASE, INDBASE, PORTBASE, RESBASE } from '../../tileValues.js';
import { isRoad, tileSeed, type TileSnapshot } from './tileModels.js';
import type { CityHeightField } from './heightfield.js';
import { halfWidth, roadReach, type Point } from '../../roadGeometry.js';
import type { RegionId } from '../regional/types.js';
import type { BlockMapReader } from './types.js';

const MAX_PEDESTRIANS = 140;
const MAX_VEHICLES = 16;
let rngState = 0;
function fastSeed(seed: number): void { rngState = seed >>> 0; }
function fastRng(): number { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; }
/** Adult height in metres (1.68 m); multiplied by `size` (realUnits = 10/16 = 0.625 on 16 m city tiles -> 1.05 units). */
export const HUMAN_HEIGHT_M = 1.68;
const LIMB_PIVOT_Y = 0.84;

const lineLengthCache = new WeakMap<object, number>();
function getLineLength(points: Point[]): number {
  let len = lineLengthCache.get(points);
  if (len !== undefined) return len;
  len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  lineLengthCache.set(points, len);
  return len;
}

const SHIRT_COLOURS = [
  0x2c4c7e, // Isan indigo (Mor Hom)
  0xf2f0e8, // White school / office shirt
  0xc85a3b, // Terracotta / brick red
  0x3b7a6e, // Tropical teal
  0xe0a238, // Marigold / saffron yellow
  0xd96f14, // Saffron orange monk robe
  0x5d7aa8, // Sky polo blue
  0x8b4c70, // Silk magenta / mudmee
  0x6b8e4e, // Palm green
  0xd97f54, // Warm coral
  0x48525e, // Charcoal work shirt
  0xe6c229, // Yellow silk
  0x283845, // Navy blue uniform
] as const;

function colorGeometry(box: BoxGeometry, hex: number): BufferGeometry {
  const g = box.toNonIndexed();
  box.dispose();
  const count = g.getAttribute('position').count;
  const c = new Color(hex);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return g;
}

function makeShirtGeometry(): BufferGeometry {
  // Torso + shoulders + collar in local metres (1.68 m full human height, 1:7.5 head-to-body ratio)
  const torso = colorGeometry(new BoxGeometry(0.31, 0.46, 0.18), 0xffffff);
  torso.translate(0, 1.09, 0);
  const shoulders = colorGeometry(new BoxGeometry(0.38, 0.13, 0.19), 0xffffff);
  shoulders.translate(0, 1.26, 0);
  const merged = mergeGeometry([torso, shoulders]);
  torso.dispose();
  shoulders.dispose();
  return merged;
}

function makeHeadAndPackGeometry(): BufferGeometry {
  // Neck + head (warm skin) + hair crown + small shoulder bag
  const neck = colorGeometry(new BoxGeometry(0.10, 0.08, 0.10), 0xd8a47f);
  neck.translate(0, 1.36, 0);
  const head = colorGeometry(new BoxGeometry(0.18, 0.21, 0.18), 0xd8a47f);
  head.translate(0, 1.50, 0.01);
  const hairTop = colorGeometry(new BoxGeometry(0.19, 0.08, 0.19), 0x201a17);
  hairTop.translate(0, 1.64, 0);
  const hairBack = colorGeometry(new BoxGeometry(0.18, 0.14, 0.06), 0x201a17);
  hairBack.translate(0, 1.53, -0.08);
  const pelvis = colorGeometry(new BoxGeometry(0.29, 0.14, 0.17), 0x2b3340);
  pelvis.translate(0, 0.80, 0);
  const bag = colorGeometry(new BoxGeometry(0.18, 0.23, 0.09), 0x5c4632);
  bag.translate(0, 1.09, -0.13);
  const parts = [neck, head, hairTop, hairBack, pelvis, bag];
  const merged = mergeGeometry(parts);
  parts.forEach(p => p.dispose());
  return merged;
}

function makeStrideGeometry(leftLegRightArm: boolean): BufferGeometry {
  // Pivoted at y = LIMB_PIVOT_Y (0.84 m) so X-rotation swings the leg and opposite arm together
  const legSign = leftLegRightArm ? -1 : 1;
  const armSign = -legSign;
  const thigh = colorGeometry(new BoxGeometry(0.115, 0.38, 0.125), 0x2b3340);
  thigh.translate(legSign * 0.08, 0.56 - LIMB_PIVOT_Y, 0);
  const shin = colorGeometry(new BoxGeometry(0.095, 0.34, 0.105), 0xcfa07c);
  shin.translate(legSign * 0.08, 0.24 - LIMB_PIVOT_Y, 0);
  const shoe = colorGeometry(new BoxGeometry(0.105, 0.08, 0.19), 0x24201d);
  shoe.translate(legSign * 0.08, 0.04 - LIMB_PIVOT_Y, 0.025);
  const upperArm = colorGeometry(new BoxGeometry(0.085, 0.26, 0.09), 0xd8a47f);
  upperArm.translate(armSign * 0.21, 1.12 - LIMB_PIVOT_Y, 0);
  const forearm = colorGeometry(new BoxGeometry(0.075, 0.24, 0.08), 0xd8a47f);
  forearm.translate(armSign * 0.21, 0.90 - LIMB_PIVOT_Y, 0.015);
  const parts = [thigh, shin, shoe, upperArm, forearm];
  const merged = mergeGeometry(parts);
  parts.forEach(p => p.dispose());
  return merged;
}

const bodyMatrix = new Matrix4();
const limbMatrix = new Matrix4();
const swingMatrix = new Matrix4();
const pivotToWorld = new Matrix4();
const instanceColor = new Color();

export interface RoadLine {
  readonly points: Point[];
  readonly rail: boolean;
  readonly level?: number;
}

/**
 * Animated 3D pedestrians walking along sidewalks, crossing streets, and strolling around homes,
 * shops, schools, hospitals, bus stops, and the district office (`rulerHouse`).
 * Scaled accurately (`1.68 m * realUnits`, e.g., `1.05` world units on 16 m/tile city maps).
 */
export class CityPedestrians {
  readonly root = new Group();
  readonly shirtMesh: InstancedMesh;
  readonly headMesh: InstancedMesh;
  readonly strideAMesh: InstancedMesh;
  readonly strideBMesh: InstancedMesh;
  private readonly shirtGeo = makeShirtGeometry();
  private readonly headGeo = makeHeadAndPackGeometry();
  private readonly strideAGeo = makeStrideGeometry(true);
  private readonly strideBGeo = makeStrideGeometry(false);
  private readonly material: MeshStandardMaterial;
  private cachedPlazas: Array<{ tx: number; ty: number; isCivic: boolean; isStop: boolean; isRes: boolean; isCom: boolean; seed: number }> = [];
  private lastPlazaKey = '';
  size = 1;

  constructor(
    private readonly snapshot: TileSnapshot,
    private readonly terrain: CityHeightField,
    size = 1,
  ) {
    this.size = size;
    this.root.name = 'pedestrians';
    const base = getMaterial('plaster_white');
    this.material = base.clone();
    this.material.vertexColors = true;
    this.material.roughness = 0.85;

    this.shirtMesh = new InstancedMesh(this.shirtGeo, this.material, MAX_PEDESTRIANS);
    this.headMesh = new InstancedMesh(this.headGeo, this.material, MAX_PEDESTRIANS);
    this.strideAMesh = new InstancedMesh(this.strideAGeo, this.material, MAX_PEDESTRIANS);
    this.strideBMesh = new InstancedMesh(this.strideBGeo, this.material, MAX_PEDESTRIANS);

    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.root.add(mesh);
    }
    // Initialize instanceColor on all meshes so vertexColors * instanceColor works cleanly
    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      instanceColor.setHex(0xffffff);
      this.shirtMesh.setColorAt(i, instanceColor);
      this.headMesh.setColorAt(i, instanceColor);
      this.strideAMesh.setColorAt(i, instanceColor);
      this.strideBMesh.setColorAt(i, instanceColor);
    }
  }

  private placeWalker(
    slot: number,
    x: number,
    z: number,
    heading: number,
    phase: number,
    scaleMultiplier: number,
    shirtHex: number,
  ): void {
    const s = this.size * scaleMultiplier;
    const swing = Math.sin(phase) * 0.52;
    const bob = Math.abs(Math.sin(phase)) * 0.032 * s;
    const y = this.terrain.sample(x, z) + bob;

    bodyMatrix.makeRotationY(heading).scale(new Vector3(s, s, s)).setPosition(x, y, z);
    this.shirtMesh.setMatrixAt(slot, bodyMatrix);
    this.headMesh.setMatrixAt(slot, bodyMatrix);
    this.shirtMesh.setColorAt(slot, instanceColor.setHex(shirtHex));

    pivotToWorld.makeRotationY(heading).scale(new Vector3(s, s, s)).setPosition(x, y + LIMB_PIVOT_Y * s, z);
    swingMatrix.makeRotationX(swing);
    limbMatrix.multiplyMatrices(pivotToWorld, swingMatrix);
    this.strideAMesh.setMatrixAt(slot, limbMatrix);

    swingMatrix.makeRotationX(-swing);
    limbMatrix.multiplyMatrices(pivotToWorld, swingMatrix);
    this.strideBMesh.setMatrixAt(slot, limbMatrix);
  }

  /** How lively a tile is based on nearby zones, civic buildings, or road activity. */
  private activityAt(tx: number, ty: number): number {
    const { width, height, values } = this.snapshot;
    let score = 1;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const v = values[ny * width + nx];
        if (v === CIVIC || v === 1021) score += 3;
        else if (v >= COMBASE && v < INDBASE) score += 2;
        else if (v >= RESBASE && v < HOSPITALBASE) score += 1.5;
        else if (v >= INDBASE && v < PORTBASE) score += 1;
      }
    }
    return score;
  }

  update(
    lines: ReadonlyArray<RoadLine>,
    target: Vector3,
    distance: number,
    seconds: number,
  ): void {
    // At high altitude pedestrians fade out cleanly to save GPU work
    if (distance > 620) {
      this.shirtMesh.count = 0;
      this.headMesh.count = 0;
      this.strideAMesh.count = 0;
      this.strideBMesh.count = 0;
      return;
    }

    let count = 0;
    const viewSpan = Math.min(340, Math.max(130, distance * 0.95));
    const walkSpeed = 0.85 * this.size; // ~1.35 m/s in world units

    // 1. Sidewalk pedestrians along curved roads near the camera target
    for (let lineIdx = 0; lineIdx < lines.length && count < MAX_PEDESTRIANS; lineIdx++) {
      const line = lines[lineIdx];
      if (line.rail || line.points.length < 2) continue;

      const mid = line.points[Math.floor(line.points.length / 2)];
      if (Math.abs(mid[0] - target.x) > viewSpan + 80 || Math.abs(mid[1] - target.z) > viewSpan + 80) continue;

      const totalLen = getLineLength(line.points);
      if (totalLen < 6) continue;

      const tx = Math.max(0, Math.min(this.snapshot.width - 1, Math.floor(mid[0] / 10)));
      const ty = Math.max(0, Math.min(this.snapshot.height - 1, Math.floor(mid[1] / 10)));
      const activity = this.activityAt(tx, ty);
      const seed = tileSeed(tx + lineIdx * 17, ty + lineIdx * 31);
      fastSeed(seed);

      // Spacing ~7-18 world units along the road depending on activity
      const spacing = Math.max(7, 18 - Math.min(11, activity * 1.5));
      const walkersOnLine = Math.min(32, Math.max(2, Math.floor(totalLen / spacing)));
      const sidewalkOffset = (2.15 + (line.level ?? 2) * 0.22) * this.size;

      for (let w = 0; w < walkersOnLine && count < MAX_PEDESTRIANS; w++) {
        const startFrac = fastRng();
        const dir = fastRng() < 0.5 ? 1 : -1;
        const speedVar = 0.82 + fastRng() * 0.36;
        const isChild = fastRng() < 0.16;
        const scaleMult = isChild ? 0.78 : 0.94 + fastRng() * 0.12;
        const shirt = SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)];
        const sideSign = (w % 2 === 0 ? 1 : -1);
        const laneJitter = (fastRng() - 0.5) * 0.35 * this.size;

        const travel = (startFrac * totalLen + seconds * walkSpeed * speedVar * dir) % totalLen;
        const distAlong = travel < 0 ? travel + totalLen : travel;

        // Locate point and tangent at distAlong
        let acc = 0;
        let px = line.points[0][0], pz = line.points[0][1];
        let dx = line.points[1][0] - px, dz = line.points[1][1] - pz;
        for (let i = 1; i < line.points.length; i++) {
          const ax = line.points[i - 1][0], az = line.points[i - 1][1];
          const bx = line.points[i][0], bz = line.points[i][1];
          const seg = Math.hypot(bx - ax, bz - az);
          if (acc + seg >= distAlong || i === line.points.length - 1) {
            const t = seg > 0 ? Math.max(0, Math.min(1, (distAlong - acc) / seg)) : 0;
            px = ax + (bx - ax) * t;
            pz = az + (bz - az) * t;
            dx = bx - ax;
            dz = bz - az;
            break;
          }
          acc += seg;
        }

        if (Math.abs(px - target.x) > viewSpan || Math.abs(pz - target.z) > viewSpan) continue;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len, nz = dx / len;
        const offset = sideSign * sidewalkOffset + laneJitter;
        const wx = px + nx * offset;
        const wz = pz + nz * offset;
        const heading = Math.atan2(dx * dir, dz * dir);
        const phase = seconds * 6.2 * speedVar + w * 2.1 + lineIdx;

        this.placeWalker(count++, wx, wz, heading, phase, scaleMult, shirt);
      }
    }

    // 2. Active plazas, frontages (Homes / Shophouses / Markets / District Office / Schools / Hospitals / Bus Stops)
    const plazaSpan = Math.min(160, viewSpan);
    const plazaCellX = Math.round(target.x / 40);
    const plazaCellZ = Math.round(target.z / 40);
    const plazaKey = `${plazaCellX},${plazaCellZ}`;
    if (plazaKey !== this.lastPlazaKey) {
      this.lastPlazaKey = plazaKey;
      const minTx = Math.max(1, Math.floor((target.x - plazaSpan) / 10));
      const maxTx = Math.min(this.snapshot.width - 2, Math.ceil((target.x + plazaSpan) / 10));
      const minTy = Math.max(1, Math.floor((target.z - plazaSpan) / 10));
      const maxTy = Math.min(this.snapshot.height - 2, Math.ceil((target.z + plazaSpan) / 10));
      const plazas: Array<{ tx: number; ty: number; isCivic: boolean; isStop: boolean; isRes: boolean; isCom: boolean; seed: number }> = [];
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const i = ty * this.snapshot.width + tx;
          const v = this.snapshot.values[i];
          const isCivic = v === CIVIC;
          const isStop = v === 1021;
          const isRes = v >= RESBASE && v < HOSPITALBASE;
          const isCom = v >= COMBASE && v < INDBASE;
          const isInd = v >= INDBASE && v < PORTBASE;
          if (!isCivic && !isStop && !isRes && !isCom && !isInd) continue;
          plazas.push({ tx, ty, isCivic, isStop, isRes, isCom, seed: tileSeed(tx, ty) });
        }
      }
      this.cachedPlazas = plazas;
    }

    for (let pIdx = 0; pIdx < this.cachedPlazas.length && count < MAX_PEDESTRIANS; pIdx++) {
      const p = this.cachedPlazas[pIdx];
      fastSeed(p.seed ^ 0x9e3779b9);
      const groupCount = p.isCivic ? 5 : p.isStop ? 3 : p.isCom ? 2 : 1;
      const cx = (p.tx + 0.5) * 10, cz = (p.ty + 0.5) * 10;

      for (let k = 0; k < groupCount && count < MAX_PEDESTRIANS; k++) {
        const orbitR = (p.isCivic ? 2.4 + fastRng() * 3.8 : p.isCom ? 1.4 + fastRng() * 2.2 : p.isRes ? 1.0 + fastRng() * 1.8 : 1.1 + fastRng() * 1.4) * this.size;
        const speed = (p.isStop ? 0.12 : p.isRes ? 0.22 + fastRng() * 0.2 : 0.42 + fastRng() * 0.35) * (fastRng() < 0.5 ? 1 : -1);
        const angle0 = fastRng() * Math.PI * 2;
        const angle = angle0 + seconds * speed * 0.35;
        const wx = cx + Math.cos(angle) * orbitR;
        const wz = cz + Math.sin(angle) * orbitR;
        if (isRoad(this.snapshot.getTileValue(Math.floor(wx / 10), Math.floor(wz / 10)))) continue;
        const heading = angle + (speed >= 0 ? Math.PI / 2 : -Math.PI / 2);
        const phase = p.isStop && k === 0 ? 0 : seconds * 5.0 * Math.abs(speed) + k * 1.7;
        const shirt = SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)];
        this.placeWalker(count++, wx, wz, heading, phase, 0.92 + fastRng() * 0.14, shirt);
      }
    }

    this.shirtMesh.count = count;
    this.headMesh.count = count;
    this.strideAMesh.count = count;
    this.strideBMesh.count = count;
    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.shirtMesh.instanceColor) this.shirtMesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.shirtMesh.dispose();
    this.headMesh.dispose();
    this.strideAMesh.dispose();
    this.strideBMesh.dispose();
    this.shirtGeo.dispose();
    this.headGeo.dispose();
    this.strideAGeo.dispose();
    this.strideBGeo.dispose();
    this.material.dispose();
    this.root.clear();
  }
}

const VEHICLE_POOL_IDS: Readonly<Record<RegionId, readonly string[]>> = {
  northeast: ['veh.pickup', 'veh.motorbike', 'veh.sedan', 'veh.songthaew', 'veh.tuktuk', 'veh.pickup', 'veh.motorbike', 'veh.etan', 'veh.truck'],
  north: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.pickup', 'veh.motorbike', 'veh.truck'],
  central: ['veh.sedan', 'veh.pickup', 'veh.motorbike', 'veh.tuktuk', 'veh.sedan', 'veh.songthaew', 'veh.truck'],
  east: ['veh.pickup', 'veh.sedan', 'veh.motorbike', 'veh.truck', 'veh.songthaew', 'veh.sedan'],
  west: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.truck', 'veh.etan'],
  south: ['veh.pickup', 'veh.motorbike', 'veh.songthaew', 'veh.sedan', 'veh.tuktuk', 'veh.truck'],
};

interface VehicleSlot {
  readonly model: Object3D;
  readonly speed: number;
}

/**
 * Real 3D road vehicles (`veh.sedan`, `veh.pickup`, `veh.motorbike`, `veh.tuktuk`, `veh.songthaew`, `veh.truck`, `veh.etan`)
 * driving in the left lane along `RoadCurves.drawnLines` at realistic scale (`realUnits`).
 */
export class CityRoadTraffic {
  readonly root = new Group();
  private readonly vehicles: VehicleSlot[] = [];
  private builtSize = 0;

  constructor(
    private readonly snapshot: TileSnapshot,
    private readonly terrain: CityHeightField,
    private readonly region: RegionId,
    public size = 1,
  ) {
    this.root.name = 'roadTraffic';
  }

  private ensurePool(): void {
    if (this.vehicles.length === MAX_VEHICLES && this.builtSize === this.size) return;
    if (this.vehicles.length === 0) {
      const ids = VEHICLE_POOL_IDS[this.region] ?? VEHICLE_POOL_IDS.central;
      for (let i = 0; i < MAX_VEHICLES; i++) {
        const id = ids[i % ids.length];
        const entry = registry[id];
        const model = entry ? entry.factory({ seed: i % 4, region: this.region }) : new Group();
        model.traverse(node => {
          const m = node as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
          if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; }
        });
        model.scale.setScalar(this.size);
        model.visible = false;
        const speed = id === 'veh.etan' ? 3.2 : id === 'veh.truck' || id === 'veh.songthaew' ? 5.2 : id === 'veh.tuktuk' ? 5.8 : 7.0;
        this.vehicles.push({ model, speed });
        this.root.add(model);
      }
      this.builtSize = this.size;
    } else if (this.builtSize !== this.size) {
      for (const v of this.vehicles) v.model.scale.setScalar(this.size);
      this.builtSize = this.size;
    }
  }

  update(
    lines: ReadonlyArray<RoadLine>,
    target: Vector3,
    distance: number,
    seconds: number,
    traffic?: BlockMapReader,
  ): void {
    if (distance > 780 || lines.length === 0) {
      for (const v of this.vehicles) v.model.visible = false;
      return;
    }
    this.ensurePool();

    const viewSpan = Math.min(340, Math.max(140, distance * 0.95));
    let used = 0;

    for (let lineIdx = 0; lineIdx < lines.length && used < MAX_VEHICLES; lineIdx++) {
      const line = lines[lineIdx];
      if (line.rail || line.points.length < 2) continue;

      const mid = line.points[Math.floor(line.points.length / 2)];
      if (Math.abs(mid[0] - target.x) > viewSpan + 90 || Math.abs(mid[1] - target.z) > viewSpan + 90) continue;

      const totalLen = getLineLength(line.points);
      if (totalLen < 14) continue;

      const tx = Math.max(0, Math.min(this.snapshot.width - 1, Math.floor(mid[0] / 10)));
      const ty = Math.max(0, Math.min(this.snapshot.height - 1, Math.floor(mid[1] / 10)));
      const density = traffic?.worldGet(tx, ty) ?? 0;
      fastSeed(tileSeed(tx + lineIdx * 23, ty + lineIdx * 41));

      // Multi-lane traffic ("just one more lane"): 1 lane/dir on 2-lane roads, 2 on 4-lane, 3 on 6-lane, 4 on 8-lane/motorway
      const level = line.level ?? 2;
      const lanesPerDir = level >= 6 ? 4 : level === 5 ? 3 : level === 4 ? 2 : 1;
      const hw = halfWidth(level, this.snapshot.realUnits);
      const spacing = Math.max(16, (54 - Math.min(32, density * 0.35)) / Math.sqrt(lanesPerDir));
      const countOnLine = Math.min(6 * lanesPerDir, Math.max(lanesPerDir, Math.floor(totalLen / spacing)));

      for (let c = 0; c < countOnLine && used < MAX_VEHICLES; c++) {
        const slot = this.vehicles[used];
        const startFrac = fastRng();
        const dir = fastRng() < 0.5 ? 1 : -1;
        const laneIdx = c % lanesPerDir;
        const speed = slot.speed * this.size * (0.85 + fastRng() * 0.22 + laneIdx * 0.14);
        const travel = (startFrac * totalLen + seconds * speed * dir) % totalLen;
        const distAlong = travel < 0 ? travel + totalLen : travel;

        let acc = 0;
        let px = line.points[0][0], pz = line.points[0][1];
        let dx = line.points[1][0] - px, dz = line.points[1][1] - pz;
        for (let i = 1; i < line.points.length; i++) {
          const ax = line.points[i - 1][0], az = line.points[i - 1][1];
          const bx = line.points[i][0], bz = line.points[i][1];
          const seg = Math.hypot(bx - ax, bz - az);
          if (acc + seg >= distAlong || i === line.points.length - 1) {
            const t = seg > 0 ? Math.max(0, Math.min(1, (distAlong - acc) / seg)) : 0;
            px = ax + (bx - ax) * t;
            pz = az + (bz - az) * t;
            dx = bx - ax;
            dz = bz - az;
            break;
          }
          acc += seg;
        }

        if (Math.abs(px - target.x) > viewSpan || Math.abs(pz - target.z) > viewSpan) continue;
        const heading = Math.atan2(dx * dir, dz * dir);
        // Compute lateral offset across the carriageway's lanes (with smooth lane-change weave on multi-lane roads)
        const laneStep = hw / (lanesPerDir + 0.35);
        let lateral = (laneIdx + 0.55) * laneStep;
        if (lanesPerDir > 1 && (c + lineIdx) % 3 === 0) {
          const weave = Math.sin(seconds * 0.75 + c * 2.1) * 0.5 + 0.5;
          const altLane = (laneIdx + 1) % lanesPerDir;
          lateral = ((1 - weave) * (laneIdx + 0.55) + weave * (altLane + 0.55)) * laneStep;
        }
        // Left-hand traffic offset: (cos(heading), -sin(heading)) is to the left of the heading vector (sin(heading), cos(heading))
        const vx = px + Math.cos(heading) * lateral;
        const vz = pz - Math.sin(heading) * lateral;

        slot.model.position.set(vx, this.terrain.sample(vx, vz), vz);
        slot.model.rotation.y = heading;
        slot.model.visible = true;
        used++;
      }
    }

    for (let i = used; i < this.vehicles.length; i++) {
      this.vehicles[i].model.visible = false;
    }
  }

  dispose(): void {
    this.root.clear();
    this.vehicles.length = 0;
  }
}

const FOLIAGE_SPECIES = ['golden_shower', 'rain_tree', 'flame_tree', 'mango', 'sugar_palm'] as const;
const MAX_PER_SPECIES = 260;

interface SpeciesBatch {
  readonly meshes: InstancedMesh[];
  count: number;
}

/**
 * Detailed, wind-swaying 3D tropical trees (`veg.golden_shower` / ต้นคูนราชพฤกษ์ดอกเหลืองขอนแก่น,
 * `veg.rain_tree` / จามจุรี, `veg.flame_tree` / หางนกยูง, `veg.mango` / มะม่วง, `veg.sugar_palm` / ตาลโตนด)
 * instanced along streets, parks, forests (`woods`), orchards, villages, and paddy dikes near the camera.
 */
export class CityFoliage {
  readonly root = new Group();
  private readonly batches: SpeciesBatch[] = [];
  private lastCellKey = '';

  constructor(
    private readonly snapshot: TileSnapshot,
    private readonly terrain: CityHeightField,
    private readonly region: RegionId,
    public size = 1,
  ) {
    this.root.name = 'cityFoliage';
  }

  private ensureBatches(): void {
    if (this.batches.length > 0) return;
    for (let s = 0; s < FOLIAGE_SPECIES.length; s++) {
      const kind = FOLIAGE_SPECIES[s];
      const entry = registry[`veg.${kind}`];
      const meshes: InstancedMesh[] = [];
      if (entry) {
        const proto = entry.factory({ seed: s + 1, region: this.region });
        proto.updateMatrixWorld(true);
        const byMaterial = new Map<MeshStandardMaterial, BufferGeometry[]>();
        proto.traverse(node => {
          const m = node as { isMesh?: boolean; visible?: boolean; geometry?: BufferGeometry; material?: MeshStandardMaterial; matrixWorld?: Matrix4 };
          if (m.isMesh && m.visible !== false && m.geometry && m.material) {
            const g = m.geometry.clone();
            if (m.matrixWorld) g.applyMatrix4(m.matrixWorld);
            const list = byMaterial.get(m.material) ?? [];
            list.push(g);
            byMaterial.set(m.material, list);
          }
        });
        for (const [mat, geos] of byMaterial) {
          const merged = geos.length === 1 ? geos[0] : mergeGeometry(geos);
          if (geos.length > 1) geos.forEach(g => g.dispose());
          const inst = new InstancedMesh(merged, mat, MAX_PER_SPECIES);
          inst.instanceMatrix.setUsage(DynamicDrawUsage);
          inst.castShadow = false;
          inst.receiveShadow = true;
          inst.frustumCulled = false;
          inst.count = 0;
          meshes.push(inst);
          this.root.add(inst);
        }
      }
      this.batches.push({ meshes, count: 0 });
    }
  }

  private addTree(speciesIdx: number, x: number, z: number, scale: number, yaw: number): void {
    const batch = this.batches[speciesIdx];
    if (!batch || batch.count >= MAX_PER_SPECIES) return;
    const slot = batch.count++;
    const y = this.terrain.sample(x, z);
    bodyMatrix.makeRotationY(yaw).scale(new Vector3(scale, scale, scale)).setPosition(x, y, z);
    for (const mesh of batch.meshes) {
      mesh.setMatrixAt(slot, bodyMatrix);
    }
  }

  invalidate(): void {
    this.lastCellKey = '';
  }

  update(lines: ReadonlyArray<RoadLine>, target: Vector3, distance: number): void {
    if (distance > 520) {
      if (this.lastCellKey !== 'far') {
        for (const b of this.batches) {
          b.count = 0;
          for (const m of b.meshes) m.count = 0;
        }
        this.lastCellKey = 'far';
      }
      return;
    }

    const hasLandCover = Boolean(this.snapshot.source?.landCover);
    if (lines.length === 0 && !hasLandCover) return;

    const cellX = Math.round(target.x / 90);
    const cellZ = Math.round(target.z / 90);
    const cellKey = `${cellX},${cellZ},${lines.length},${this.size}`;
    if (cellKey === this.lastCellKey) return;
    this.lastCellKey = cellKey;

    this.ensureBatches();
    for (const b of this.batches) b.count = 0;

    const viewSpan = 210;

    // 1. Street trees (ต้นคูนราชพฤกษ์, หางนกยูง, จามจุรี, มะม่วง) along both sides of curved roads
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (line.rail || line.points.length < 2) continue;
      const mid = line.points[Math.floor(line.points.length / 2)];
      if (Math.abs(mid[0] - target.x) > viewSpan + 80 || Math.abs(mid[1] - target.z) > viewSpan + 80) continue;

      let acc = 0;
      let nextTreeDist = 6 + (lineIdx % 4) * 2.0;
      const spacing = 12;
      const reach = roadReach(line.level ?? 2, this.snapshot.realUnits);
      const vergeOffset = reach + 2.2 * this.size;

      for (let i = 1; i < line.points.length; i++) {
        const ax = line.points[i - 1][0], az = line.points[i - 1][1];
        const bx = line.points[i][0], bz = line.points[i][1];
        const dx = bx - ax, dz = bz - az;
        const seg = Math.hypot(dx, dz);
        if (seg < 0.1) continue;
        const nx = -dz / seg, nz = dx / seg;

        while (acc + seg >= nextTreeDist) {
          const t = (nextTreeDist - acc) / seg;
          const px = ax + dx * t, pz = az + dz * t;
          if (Math.abs(px - target.x) <= viewSpan && Math.abs(pz - target.z) <= viewSpan) {
            const hSeed = tileSeed(Math.floor(px), Math.floor(pz));
            for (const side of [-1, 1] as const) {
              if (((hSeed + (side > 0 ? 3 : 0)) % 6) === 0) continue;
              const tx = px + nx * side * vergeOffset;
              const tz = pz + nz * side * vergeOffset;
              const tileX = Math.floor(tx / 10), tileY = Math.floor(tz / 10);
              if (tileX < 0 || tileY < 0 || tileX >= this.snapshot.width || tileY >= this.snapshot.height) continue;
              const tv = this.snapshot.getTileValue(tileX, tileY);
              if (tv !== 0 && !(tv >= 21 && tv <= 39)) continue;
              const nearRoad = this.snapshot.roadSnap?.(tx, tz, 12);
              if (nearRoad && Math.hypot(tx - nearRoad.x, tz - nearRoad.z) < nearRoad.reach + 1.4 * this.size) continue;
              // Alternate Golden Shower (ต้นคูน 0), Rain Tree (จามจุรี 1), Flame Tree (หางนกยูง 2), Mango (3)
              const speciesIdx = (hSeed + (side > 0 ? 1 : 0)) % 4;
              const scale = this.size * (0.82 + (hSeed % 7) * 0.05);
              const yaw = (hSeed % 16) * (Math.PI / 8);
              this.addTree(speciesIdx, tx, tz, scale, yaw);
            }
          }
          nextTreeDist += spacing;
        }
        acc += seg;
      }
    }

    // 2. Detailed 3D trees on nearby woods, orchards, parks, villages, and paddy dikes
    const minTx = Math.max(1, Math.floor((target.x - viewSpan) / 10));
    const maxTx = Math.min(this.snapshot.width - 2, Math.ceil((target.x + viewSpan) / 10));
    const minTy = Math.max(1, Math.floor((target.z - viewSpan) / 10));
    const maxTy = Math.min(this.snapshot.height - 2, Math.ceil((target.z + viewSpan) / 10));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const i = ty * this.snapshot.width + tx;
        const v = this.snapshot.values[i];
        const woods = v >= 21 && v <= 39;
        const cover = this.snapshot.source?.landCover?.[i] ?? 0;
        if (!woods && (v !== 0 || !hasLandCover)) continue;

        const seed = tileSeed(tx, ty);
        const count = woods ? 3 : cover === 3 ? 2 : cover === 4 || cover === 5 || cover === 6 ? 1 : (seed % 4 === 0 ? 1 : 0);
        for (let k = 0; k < count; k++) {
          const hSeed = tileSeed(tx * 11 + k * 17, ty * 13 + k * 23);
          const ox = cover === 1 || cover === 2 ? -3.9 : ((hSeed >>> 4) % 101 / 100 - 0.5) * 6.8;
          const oz = ((hSeed >>> 12) % 101 / 100 - 0.5) * 6.8;
          const wx = (tx + 0.5) * 10 + ox;
          const wz = (ty + 0.5) * 10 + oz;
          const nearRoad = this.snapshot.roadSnap?.(wx, wz, 12);
          if (nearRoad && Math.hypot(wx - nearRoad.x, wz - nearRoad.z) < nearRoad.reach + 1.8 * this.size) continue;
          // Paddy/field dikes favor Sugar Palm (ต้นตาลโตนด 4) and Rain Tree (1); orchards favor Mango (3)
          const speciesIdx = cover === 1 || cover === 2 ? (hSeed % 2 === 0 ? 4 : 1) : cover === 3 ? 3 : hSeed % 5;
          const scale = this.size * (0.85 + (hSeed % 7) * 0.06);
          const yaw = (hSeed % 16) * (Math.PI / 8);
          this.addTree(speciesIdx, wx, wz, scale, yaw);
        }
      }
    }

    for (const b of this.batches) {
      for (const m of b.meshes) {
        m.count = b.count;
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const b of this.batches) {
      for (const m of b.meshes) {
        m.geometry.dispose();
        m.dispose();
      }
    }
    this.batches.length = 0;
    this.root.clear();
  }
}

