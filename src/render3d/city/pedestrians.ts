/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  BoxGeometry, BufferGeometry, Color, DodecahedronGeometry, DynamicDrawUsage, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D, Vector3,
} from 'three';
import { mergeGeometry } from '../util/geometry.js';
import { getMaterial } from '../materials/library.js';
import { registry } from '../models/registry.js';
import {
  BUS_STOP, CIVIC, COMLAST, CZB, FARM_BASE, FARM_LAST,
  FIRESTATION, HARBOUR_BASE, HARBOUR_LAST, HHTHR, HOSPITAL, HOSPITALBASE,
  HOUSE, IND1, LASTIND, LASTTREE, MINE_BASE, MINE_LAST, POLICESTATION,
  RZB, STATION, TREEBASE,
} from '../../tileValues.js';
import { ZONEBIT } from '../../tileFlags.js';
import { readPlotValue } from '../../plots.js';
import { tileSeed, type TileSnapshot } from './tileModels.js';
import type { CityHeightField } from './heightfield.js';
import { halfWidth, roadReach, type Point } from '../../roadGeometry.js';
import type { RegionId } from '../regional/types.js';
import type { BlockMapReader } from './types.js';

const MAX_PEDESTRIANS = 140;
const MAX_TAKRAW = 8;
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

const SPORTS_COLOURS = [
  0x3b7a6e, // Tropical teal
  0xe0a238, // Marigold yellow
  0xd97f54, // Warm coral
  0x8b4c70, // Silk magenta
  0x2c4c7e, // Mor Hom indigo
  0xc85a3b, // Terracotta
] as const;

const INDUSTRY_SHIRTS = [
  0x2c4c7e, // Mor Hom indigo
  0x48525e, // Charcoal work shirt
  0xc85a3b, // Terracotta factory shirt
  0x283845, // Navy technician uniform
] as const;

const COMMERCE_SHIRTS = [
  0xf2f0e8, // White office shirt
  0x5d7aa8, // Sky polo blue
  0x283845, // Navy business uniform
  0xe6c229, // Yellow commercial shirt
] as const;

const CIVIC_SHIRTS = [
  0xf2f0e8, // White civil service
  0x283845, // Navy uniform
  0xe6c229, // Yellow silk
  0x48525e, // Charcoal uniform
] as const;

const THAI_COMPANIES_INDUSTRY = [
  'บจก. สยามแอโกรอินดัสทรี',
  'โรงสีข้าวไทยเจริญ',
  'บมจ. อุตสาหกรรมชิ้นส่วนยานยนต์',
  'โรงงานทอผ้าไหมมัดหมี่',
  'โรงงานผลิตอาหารแปรรูปอีสาน',
  'คลังสินค้าและโลจิสติกส์รุ่งเรือง',
  'เหมืองแร่สยามพัฒนา',
  'โรงกลั่นน้ำมันพืชไชโย',
] as const;

const THAI_COMPANIES_COMMERCE = [
  'ตลาดสดประสานมิตร',
  'ร้านค้าสะดวกซื้อชุมชน',
  'ธนาคารพาณิชย์ไทยพัฒนา',
  'ร้านทองเยาวราชสาขา 1',
  'ศูนย์การค้าวัฒนาสแควร์',
  'ร้านสหกรณ์การค้าชุมชน',
  'ร้านอาหารพื้นเมืองรสเด็ด',
] as const;

const THAI_COMPANIES_CIVIC = [
  'ที่ว่าการอำเภอ',
  'โรงพยาบาลศูนย์ประจำจังหวัด',
  'โรงเรียนเทศบาลเฉลิมพระเกียรติ',
  'สถานีตำรวจภูธร',
  'สถานีดับเพลิงและกู้ภัย',
  'สถานีขนส่งผู้โดยสาร',
] as const;

const THAI_COMPANIES_AGRI = [
  'ฟาร์มเกษตรอินทรีย์ชุมชน',
  'ไร่กสิกรรมผสมผสาน',
  'ท่าเทียบเรือประมงพื้นบ้าน',
] as const;

const THAI_CITIZEN_NAMES = [
  'สมชาย', 'วิชัย', 'วีระ', 'ประเสริฐ', 'บุญส่ง', 'สุรชัย', 'สมบัติ', 'มานะ',
  'สมร', 'กานดา', 'สุภา', 'วันดี', 'รัตนา', 'เพ็ญศรี', 'อรทัย', 'ศิริพร',
] as const;

interface StructureInfo {
  readonly kind: 'home' | 'industry' | 'commercial' | 'civic' | 'farm' | 'mine' | 'stop' | 'park';
  readonly level: number;
}

function getStructureInfo(v: number, flags: number): StructureInfo | null {
  if (v === BUS_STOP) return { kind: 'stop', level: 1 };
  if (v >= HOUSE && v <= HHTHR) return { kind: 'home', level: 1 };

  const plot = readPlotValue(v);
  if (plot && plot.level > 0) {
    if (plot.kind === 'residential') return { kind: 'home', level: plot.level };
    if (plot.kind === 'commercial') return { kind: 'commercial', level: plot.level };
    if (plot.kind === 'industrial') return { kind: 'industry', level: plot.level };
  }

  if (flags & ZONEBIT) {
    if (v >= RZB && v < HOSPITALBASE) return { kind: 'home', level: 2 };
    if (v >= CZB && v <= COMLAST) return { kind: 'commercial', level: 2 };
    if ((v >= IND1 && v <= LASTIND) || v === 625) return { kind: 'industry', level: 2 };
    if (v === MINE_BASE || (v >= MINE_BASE && v <= MINE_LAST)) return { kind: 'mine', level: 2 };
    if (v === FARM_BASE || (v >= FARM_BASE && v <= FARM_LAST)) return { kind: 'farm', level: 2 };
    if (v === HARBOUR_BASE || (v >= HARBOUR_BASE && v <= HARBOUR_LAST)) return { kind: 'farm', level: 2 };
    if (v === CIVIC || v === FIRESTATION || v === POLICESTATION || v === HOSPITAL || v === STATION) {
      return { kind: 'civic', level: 2 };
    }
  }

  if (v >= TREEBASE && v <= LASTTREE) return { kind: 'park', level: 1 };
  return null;
}

export interface Workplace {
  readonly id: number;
  readonly tx: number;
  readonly ty: number;
  readonly wx: number;
  readonly wz: number;
  readonly sector: 'industry' | 'commercial' | 'civic' | 'agriculture';
  readonly companyName: string;
  readonly capacity: number;
  assignedWorkers: number;
}

export interface Household {
  readonly id: number;
  readonly tx: number;
  readonly ty: number;
  readonly wx: number;
  readonly wz: number;
  readonly residentCount: number;
}

export interface EmployedCitizen {
  readonly id: number;
  readonly name: string;
  readonly home: Household;
  readonly workplace: Workplace;
  readonly shirtColor: number;
  readonly speedVar: number;
  lineIdx: number;
}

interface TakrawCourt {
  readonly cx: number;
  readonly cz: number;
  readonly seed: number;
  readonly angle0: number;
  readonly shirts: readonly [number, number, number];
}

interface ChatSpot {
  readonly cx: number;
  readonly cz: number;
  readonly angle: number;
  readonly shirtA: number;
  readonly shirtB: number;
}

interface TransitStopSpot {
  readonly wx: number;
  readonly wz: number;
  readonly heading: number;
  readonly shirt: number;
}

interface ShopSpot {
  readonly wx: number;
  readonly wz: number;
  readonly heading: number;
  readonly shirt: number;
}

const ballMatrix = new Matrix4();

/**
 * Animated 3D pedestrians with real jobs, destinations, and Thai community activities
 * (commuting between home and workplace, sepak takraw, jogging for fitness, socializing neighbors, transit waiting).
 * Scaled accurately (1.68 m * realUnits, e.g. 1.05 world units on 16 m/tile city maps).
 */
export class CityPedestrians {
  readonly root = new Group();
  readonly shirtMesh: InstancedMesh;
  readonly headMesh: InstancedMesh;
  readonly strideAMesh: InstancedMesh;
  readonly strideBMesh: InstancedMesh;
  readonly takrawMesh: InstancedMesh;
  private readonly shirtGeo = makeShirtGeometry();
  private readonly headGeo = makeHeadAndPackGeometry();
  private readonly strideAGeo = makeStrideGeometry(true);
  private readonly strideBGeo = makeStrideGeometry(false);
  private readonly takrawGeo = new DodecahedronGeometry(0.12, 0);
  private readonly material: MeshStandardMaterial;
  private readonly takrawMaterial: MeshStandardMaterial;

  private cachedHouseholds: Household[] = [];
  private cachedWorkplaces: Workplace[] = [];
  private cachedEmployed: EmployedCitizen[] = [];
  private cachedTakrawCourts: TakrawCourt[] = [];
  private cachedChatSpots: ChatSpot[] = [];
  private cachedTransitStops: TransitStopSpot[] = [];
  private cachedShopSpots: ShopSpot[] = [];
  private commutersByLine = new Map<number, EmployedCitizen[]>();
  private lastScanKey = '';

  employedIndustry = 0;
  employedCommercial = 0;
  employedCivic = 0;
  employedAgri = 0;
  totalEmployed = 0;
  activeCommutersCount = 0;
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

    this.takrawMaterial = new MeshStandardMaterial({
      color: 0xd9a456,
      roughness: 0.8,
      metalness: 0.05,
    });

    this.shirtMesh = new InstancedMesh(this.shirtGeo, this.material, MAX_PEDESTRIANS);
    this.headMesh = new InstancedMesh(this.headGeo, this.material, MAX_PEDESTRIANS);
    this.strideAMesh = new InstancedMesh(this.strideAGeo, this.material, MAX_PEDESTRIANS);
    this.strideBMesh = new InstancedMesh(this.strideBGeo, this.material, MAX_PEDESTRIANS);
    this.takrawMesh = new InstancedMesh(this.takrawGeo, this.takrawMaterial, MAX_TAKRAW);

    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.root.add(mesh);
    }
    this.takrawMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.takrawMesh.castShadow = false;
    this.takrawMesh.receiveShadow = true;
    this.takrawMesh.frustumCulled = false;
    this.takrawMesh.count = 0;
    this.root.add(this.takrawMesh);

    // Initialize instanceColor on all meshes so vertexColors * instanceColor works cleanly
    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      instanceColor.setHex(0xffffff);
      this.shirtMesh.setColorAt(i, instanceColor);
      this.headMesh.setColorAt(i, instanceColor);
      this.strideAMesh.setColorAt(i, instanceColor);
      this.strideBMesh.setColorAt(i, instanceColor);
    }
  }

  get employmentStats(): {
    readonly industry: number;
    readonly commercial: number;
    readonly civic: number;
    readonly totalEmployed: number;
    readonly activeCommuters: number;
  } {
    return {
      industry: this.employedIndustry,
      commercial: this.employedCommercial,
      civic: this.employedCivic,
      totalEmployed: this.totalEmployed,
      activeCommuters: this.activeCommutersCount,
    };
  }

  get households(): ReadonlyArray<Household> { return this.cachedHouseholds; }
  get workplaces(): ReadonlyArray<Workplace> { return this.cachedWorkplaces; }
  get employedCitizens(): ReadonlyArray<EmployedCitizen> { return this.cachedEmployed; }

  private placeWalker(
    slot: number,
    x: number,
    z: number,
    heading: number,
    phase: number,
    scaleMultiplier: number,
    shirtHex: number,
    poseType: 'walk' | 'jog' | 'stand' | 'kick' = 'walk',
    customSwing?: number,
  ): void {
    const s = this.size * scaleMultiplier;
    let swing = 0;
    let bob = 0;

    if (poseType === 'walk') {
      swing = Math.sin(phase) * 0.52;
      bob = Math.abs(Math.sin(phase)) * 0.032 * s;
    } else if (poseType === 'jog') {
      // Energetic jog with high swing and bouncy bob
      swing = Math.sin(phase) * 0.78;
      bob = Math.abs(Math.sin(phase)) * 0.065 * s;
    } else if (poseType === 'kick') {
      // Sepak takraw kick
      swing = customSwing !== undefined ? customSwing : -0.92;
      bob = 0.04 * s;
    } else if (poseType === 'stand') {
      // Conversational or waiting stand
      swing = customSwing !== undefined ? customSwing : Math.sin(phase * 0.4) * 0.07;
      bob = 0;
    }

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

  /** How lively a tile is based on built zones, houses, services, or road frontage. */
  private activityAt(tx: number, ty: number): number {
    const { width, height, values, flags } = this.snapshot;
    let score = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const idx = ny * width + nx;
        const v = values[idx];
        const f = flags[idx];
        const info = getStructureInfo(v, f);
        if (!info) continue;
        if (info.kind === 'civic' || info.kind === 'stop') score += 3;
        else if (info.kind === 'commercial') score += 2;
        else if (info.kind === 'home') score += 1.5;
        else if (info.kind === 'industry' || info.kind === 'mine' || info.kind === 'farm') score += 1;
      }
    }
    return score;
  }

  private scanCityAgents(target: Vector3, span: number, lines: ReadonlyArray<RoadLine>): void {
    const cellX = Math.round(target.x / 40);
    const cellZ = Math.round(target.z / 40);
    const scanKey = `${cellX},${cellZ},${lines.length}`;
    if (scanKey === this.lastScanKey) return;
    this.lastScanKey = scanKey;

    const minTx = Math.max(1, Math.floor((target.x - span) / 10));
    const maxTx = Math.min(this.snapshot.width - 2, Math.ceil((target.x + span) / 10));
    const minTy = Math.max(1, Math.floor((target.z - span) / 10));
    const maxTy = Math.min(this.snapshot.height - 2, Math.ceil((target.z + span) / 10));

    const households: Household[] = [];
    const workplaces: Workplace[] = [];
    const takrawCourts: TakrawCourt[] = [];
    const chatSpots: ChatSpot[] = [];
    const transitStops: TransitStopSpot[] = [];
    const shopSpots: ShopSpot[] = [];

    let workerIdGen = 0;
    let houseIdGen = 0;
    let workIdGen = 0;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const i = ty * this.snapshot.width + tx;
        const v = this.snapshot.values[i];
        const f = this.snapshot.flags[i];
        const info = getStructureInfo(v, f);
        if (!info) continue;

        const seed = tileSeed(tx, ty);
        const cx = (tx + 0.5) * 10;
        const cz = (ty + 0.5) * 10;

        if (info.kind === 'home') {
          const resCount = Math.max(1, info.level * 2);
          const house: Household = { id: ++houseIdGen, tx, ty, wx: cx, wz: cz, residentCount: resCount };
          households.push(house);

          // Community activities in front of homes:
          // 1 in 6 homes has a takraw court if space permits
          if ((seed % 6 === 0) && takrawCourts.length < MAX_TAKRAW) {
            fastSeed(seed ^ 0xa5a5a5a5);
            takrawCourts.push({
              cx: cx + (fastRng() - 0.5) * 1.5,
              cz: cz + (fastRng() - 0.5) * 1.5,
              seed,
              angle0: fastRng() * Math.PI * 2,
              shirts: [
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
              ],
            });
          } else if (seed % 4 === 1 && chatSpots.length < 16) {
            // Chatting neighbors
            fastSeed(seed ^ 0x3c3c3c3c);
            chatSpots.push({
              cx: cx + (fastRng() - 0.5) * 2.0,
              cz: cz + (fastRng() - 0.5) * 2.0,
              angle: fastRng() * Math.PI,
              shirtA: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
              shirtB: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
            });
          }
        } else if (info.kind === 'industry' || info.kind === 'mine') {
          const cap = Math.max(1, info.level * 3);
          const nameIdx = seed % THAI_COMPANIES_INDUSTRY.length;
          workplaces.push({
            id: ++workIdGen,
            tx, ty, wx: cx, wz: cz,
            sector: 'industry',
            companyName: THAI_COMPANIES_INDUSTRY[nameIdx],
            capacity: cap,
            assignedWorkers: 0,
          });
        } else if (info.kind === 'commercial') {
          const cap = Math.max(1, info.level * 2);
          const nameIdx = seed % THAI_COMPANIES_COMMERCE.length;
          workplaces.push({
            id: ++workIdGen,
            tx, ty, wx: cx, wz: cz,
            sector: 'commercial',
            companyName: THAI_COMPANIES_COMMERCE[nameIdx],
            capacity: cap,
            assignedWorkers: 0,
          });
          if (seed % 3 === 0 && shopSpots.length < 12) {
            fastSeed(seed ^ 0x7e7e7e7e);
            shopSpots.push({
              wx: cx + (fastRng() - 0.5) * 2.2,
              wz: cz + (fastRng() - 0.5) * 2.2,
              heading: fastRng() * Math.PI * 2,
              shirt: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
            });
          }
        } else if (info.kind === 'civic') {
          const cap = 4;
          const nameIdx = seed % THAI_COMPANIES_CIVIC.length;
          workplaces.push({
            id: ++workIdGen,
            tx, ty, wx: cx, wz: cz,
            sector: 'civic',
            companyName: THAI_COMPANIES_CIVIC[nameIdx],
            capacity: cap,
            assignedWorkers: 0,
          });
        } else if (info.kind === 'farm') {
          const cap = 3;
          const nameIdx = seed % THAI_COMPANIES_AGRI.length;
          workplaces.push({
            id: ++workIdGen,
            tx, ty, wx: cx, wz: cz,
            sector: 'agriculture',
            companyName: THAI_COMPANIES_AGRI[nameIdx],
            capacity: cap,
            assignedWorkers: 0,
          });
        } else if (info.kind === 'stop') {
          fastSeed(seed ^ 0x55aa55aa);
          transitStops.push({
            wx: cx, wz: cz,
            heading: (seed % 4) * (Math.PI / 2),
            shirt: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
          });
        } else if (info.kind === 'park') {
          if (seed % 3 === 0 && takrawCourts.length < MAX_TAKRAW) {
            fastSeed(seed ^ 0x12345678);
            takrawCourts.push({
              cx, cz, seed,
              angle0: fastRng() * Math.PI * 2,
              shirts: [
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
                SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
              ],
            });
          }
        }
      }
    }

    // Match residents to open workplaces ("คนที่ไปทำงาน ต้อง มีงานจริงๆ นะ")
    const employed: EmployedCitizen[] = [];
    for (const h of households) {
      fastSeed(tileSeed(h.tx + 7, h.ty + 13));
      for (let r = 0; r < h.residentCount; r++) {
        // Find closest workplace with available capacity
        let bestWork: Workplace | null = null;
        let bestDist = Infinity;
        for (const w of workplaces) {
          if (w.assignedWorkers >= w.capacity) continue;
          const dist = Math.hypot(w.wx - h.wx, w.wz - h.wz);
          if (dist < bestDist) {
            bestDist = dist;
            bestWork = w;
          }
        }

        if (bestWork) {
          bestWork.assignedWorkers++;
          const name = THAI_CITIZEN_NAMES[(h.id * 3 + r) % THAI_CITIZEN_NAMES.length];
          let shirtColor: number;
          if (bestWork.sector === 'industry') {
            shirtColor = INDUSTRY_SHIRTS[(h.id + r) % INDUSTRY_SHIRTS.length];
          } else if (bestWork.sector === 'commercial') {
            shirtColor = COMMERCE_SHIRTS[(h.id + r) % COMMERCE_SHIRTS.length];
          } else if (bestWork.sector === 'civic') {
            shirtColor = CIVIC_SHIRTS[(h.id + r) % CIVIC_SHIRTS.length];
          } else {
            shirtColor = INDUSTRY_SHIRTS[(h.id + r) % INDUSTRY_SHIRTS.length];
          }

          employed.push({
            id: ++workerIdGen,
            name,
            home: h,
            workplace: bestWork,
            shirtColor,
            speedVar: 0.88 + fastRng() * 0.24,
            lineIdx: -1,
          });
        }
      }
    }

    // Assign employed citizens to the most relevant road line connecting home and work
    const byLine = new Map<number, EmployedCitizen[]>();
    for (const worker of employed) {
      let bestLine = -1;
      let minScore = Infinity;
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        if (line.rail || line.points.length < 2) continue;
        const mid = line.points[Math.floor(line.points.length / 2)];
        const dHome = Math.hypot(mid[0] - worker.home.wx, mid[1] - worker.home.wz);
        const dWork = Math.hypot(mid[0] - worker.workplace.wx, mid[1] - worker.workplace.wz);
        const score = dHome + dWork;
        if (score < minScore && score < 160) {
          minScore = score;
          bestLine = l;
        }
      }
      worker.lineIdx = bestLine;
      if (bestLine >= 0) {
        let list = byLine.get(bestLine);
        if (!list) { list = []; byLine.set(bestLine, list); }
        list.push(worker);
      }
    }

    // Track sector employment totals ("ก็นับด้วยว่าคนทำงาน ในอุตสาหกรรม 1 คน")
    let ind = 0, com = 0, civ = 0, agr = 0;
    for (const w of employed) {
      if (w.workplace.sector === 'industry') ind++;
      else if (w.workplace.sector === 'commercial') com++;
      else if (w.workplace.sector === 'civic') civ++;
      else if (w.workplace.sector === 'agriculture') agr++;
    }
    this.employedIndustry = ind;
    this.employedCommercial = com;
    this.employedCivic = civ;
    this.employedAgri = agr;
    this.totalEmployed = ind + com + civ + agr;

    this.cachedHouseholds = households;
    this.cachedWorkplaces = workplaces;
    this.cachedEmployed = employed;
    this.cachedTakrawCourts = takrawCourts;
    this.cachedChatSpots = chatSpots;
    this.cachedTransitStops = transitStops;
    this.cachedShopSpots = shopSpots;
    this.commutersByLine = byLine;
  }

  update(
    lines: ReadonlyArray<RoadLine>,
    target: Vector3,
    distance: number,
    seconds: number,
  ): void {
    if (distance > 620) {
      this.shirtMesh.count = 0;
      this.headMesh.count = 0;
      this.strideAMesh.count = 0;
      this.strideBMesh.count = 0;
      this.takrawMesh.count = 0;
      return;
    }

    const viewSpan = Math.min(340, Math.max(130, distance * 0.95));
    const walkSpeed = 0.85 * this.size;

    this.scanCityAgents(target, viewSpan + 60, lines);

    let count = 0;
    let takrawCount = 0;
    this.activeCommutersCount = 0;

    // 1. Purposeful commuters & joggers along road sidewalks
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
      const sidewalkOffset = (2.15 + (line.level ?? 2) * 0.22) * this.size;

      const lineCommuters = this.commutersByLine.get(lineIdx) ?? [];
      const commuterCount = Math.min(lineCommuters.length, 12);

      // A. Real Commuters going between home and work
      for (let c = 0; c < commuterCount && count < MAX_PEDESTRIANS; c++) {
        const worker = lineCommuters[c];
        // 60s commute shift cycle: heading to work vs returning home
        const shiftPeriod = 60;
        const shiftTime = (seconds * 0.5 + worker.id * 6.3) % shiftPeriod;
        const toWork = shiftTime < (shiftPeriod * 0.5);
        const dir = toWork ? 1 : -1;
        const frac = (shiftTime % (shiftPeriod * 0.5)) / (shiftPeriod * 0.5);
        const distAlong = (frac * totalLen) % totalLen;

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
        const sideSign = (c % 2 === 0 ? 1 : -1);
        const offset = sideSign * sidewalkOffset;
        const wx = px + nx * offset;
        const wz = pz + nz * offset;
        const heading = Math.atan2(dx * dir, dz * dir);
        const phase = seconds * 6.2 * worker.speedVar + c * 2.1 + lineIdx;

        this.placeWalker(count++, wx, wz, heading, phase, 0.96, worker.shirtColor, 'walk');
        this.activeCommutersCount++;
      }

      // B. Joggers / Fitness runners along sidewalks
      // Only 1 jogger on quiet roads, up to 2 on active roads
      const joggerCount = activity > 0 ? (totalLen > 40 ? 2 : 1) : (totalLen > 25 ? 1 : 0);
      fastSeed(tileSeed(tx + lineIdx * 19, ty + lineIdx * 37));
      for (let j = 0; j < joggerCount && count < MAX_PEDESTRIANS; j++) {
        const jogDir = (j % 2 === 0 ? 1 : -1);
        const jogStartFrac = fastRng();
        const jogTravel = (jogStartFrac * totalLen + seconds * walkSpeed * 2.2 * jogDir) % totalLen;
        const distAlong = jogTravel < 0 ? jogTravel + totalLen : jogTravel;

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
        const sideSign = (j % 2 === 0 ? -1 : 1);
        const wx = px + nx * sideSign * sidewalkOffset;
        const wz = pz + nz * sideSign * sidewalkOffset;
        const heading = Math.atan2(dx * jogDir, dz * jogDir);
        const phase = seconds * 9.8 + j * 3.1 + lineIdx;
        const jogShirt = SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)];

        this.placeWalker(count++, wx, wz, heading, phase, 0.98, jogShirt, 'jog');
      }
    }

    // 2. Thai Community Activities: Sepak Takraw (เล่นตะกร้อวง)
    const takrawCourtR = 1.75 * this.size;
    for (let tIdx = 0; tIdx < this.cachedTakrawCourts.length && count < MAX_PEDESTRIANS - 2; tIdx++) {
      const court = this.cachedTakrawCourts[tIdx];
      if (Math.abs(court.cx - target.x) > viewSpan || Math.abs(court.cz - target.z) > viewSpan) continue;

      const pCycle = 3.3; // 3.3s cycle for passing ball between 3 players
      const cTime = (seconds + court.seed * 0.31) % pCycle;
      const kickerIdx = Math.floor((cTime / pCycle) * 3) % 3;
      const receiverIdx = (kickerIdx + 1) % 3;
      const passFrac = ((cTime / pCycle) * 3) - Math.floor((cTime / pCycle) * 3);

      const pAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map(a => a + court.angle0);
      const pPos = pAngles.map(a => ({
        x: court.cx + Math.cos(a) * takrawCourtR,
        z: court.cz + Math.sin(a) * takrawCourtR,
        heading: a + Math.PI,
      }));

      // Ball parabolic trajectory
      const kPos = pPos[kickerIdx];
      const rPos = pPos[receiverIdx];
      const bx = kPos.x + (rPos.x - kPos.x) * passFrac;
      const bz = kPos.z + (rPos.z - kPos.z) * passFrac;
      const groundY = this.terrain.sample(bx, bz);
      const arcHeight = 4 * 1.15 * this.size * passFrac * (1 - passFrac);
      const by = groundY + 0.42 * this.size + arcHeight;

      if (takrawCount < MAX_TAKRAW) {
        const bScale = this.size;
        ballMatrix.makeRotationY(seconds * 5).scale(new Vector3(bScale, bScale, bScale)).setPosition(bx, by, bz);
        this.takrawMesh.setMatrixAt(takrawCount++, ballMatrix);
      }

      // 3 Takraw players in circle
      for (let p = 0; p < 3 && count < MAX_PEDESTRIANS; p++) {
        const player = pPos[p];
        const isKicking = p === kickerIdx && passFrac < 0.30;
        const isReceiving = p === receiverIdx && passFrac > 0.70;
        const pose: 'kick' | 'stand' = isKicking ? 'kick' : 'stand';
        const customSwing = isKicking ? -0.92 : isReceiving ? 0.35 : undefined;
        const shirt = court.shirts[p];
        this.placeWalker(count++, player.x, player.z, player.heading, seconds * 3 + p * 2.1, 0.95, shirt, pose, customSwing);
      }
    }

    // 3. Socializing Neighbors (ยืนคุยกันหน้าบ้าน)
    for (let c = 0; c < this.cachedChatSpots.length && count < MAX_PEDESTRIANS - 1; c++) {
      const spot = this.cachedChatSpots[c];
      if (Math.abs(spot.cx - target.x) > viewSpan || Math.abs(spot.cz - target.z) > viewSpan) continue;
      const facingA = spot.angle;
      const facingB = spot.angle + Math.PI;
      const p1x = spot.cx - Math.sin(spot.angle) * 0.65 * this.size;
      const p1z = spot.cz - Math.cos(spot.angle) * 0.65 * this.size;
      const p2x = spot.cx + Math.sin(spot.angle) * 0.65 * this.size;
      const p2z = spot.cz + Math.cos(spot.angle) * 0.65 * this.size;
      this.placeWalker(count++, p1x, p1z, facingA + Math.PI / 2, seconds * 0.8 + c, 0.95, spot.shirtA, 'stand');
      this.placeWalker(count++, p2x, p2z, facingB + Math.PI / 2, seconds * 0.8 + c + 1.2, 0.93, spot.shirtB, 'stand');
    }

    // 4. Waiting passengers at bus stops (รอรถเมล์/สองแถว)
    for (let s = 0; s < this.cachedTransitStops.length && count < MAX_PEDESTRIANS; s++) {
      const stop = this.cachedTransitStops[s];
      if (Math.abs(stop.wx - target.x) > viewSpan || Math.abs(stop.wz - target.z) > viewSpan) continue;
      this.placeWalker(count++, stop.wx, stop.wz, stop.heading, seconds * 0.2 + s, 0.96, stop.shirt, 'stand', 0);
    }

    // 5. Commercial shoppers outside shops
    for (let sp = 0; sp < this.cachedShopSpots.length && count < MAX_PEDESTRIANS; sp++) {
      const shop = this.cachedShopSpots[sp];
      if (Math.abs(shop.wx - target.x) > viewSpan || Math.abs(shop.wz - target.z) > viewSpan) continue;
      this.placeWalker(count++, shop.wx, shop.wz, shop.heading, seconds * 0.6 + sp, 0.94, shop.shirt, 'stand');
    }

    this.shirtMesh.count = count;
    this.headMesh.count = count;
    this.strideAMesh.count = count;
    this.strideBMesh.count = count;
    this.takrawMesh.count = takrawCount;
    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.shirtMesh.instanceColor) this.shirtMesh.instanceColor.needsUpdate = true;
    if (takrawCount > 0) this.takrawMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.shirtMesh.dispose();
    this.headMesh.dispose();
    this.strideAMesh.dispose();
    this.strideBMesh.dispose();
    this.takrawMesh.dispose();
    this.shirtGeo.dispose();
    this.headGeo.dispose();
    this.strideAGeo.dispose();
    this.strideBGeo.dispose();
    this.takrawGeo.dispose();
    this.material.dispose();
    this.takrawMaterial.dispose();
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

