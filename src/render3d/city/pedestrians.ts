/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  BoxGeometry, BufferGeometry, type Camera, Color, DodecahedronGeometry, DynamicDrawUsage, Float32BufferAttribute, Frustum,
  Group, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D, Sphere, Vector3,
} from 'three';
import { mergeGeometry } from '../util/geometry.js';
import { getMaterial } from '../materials/library.js';
import { registry } from '../models/registry.js';
import { tileSeed, type TileSnapshot } from './tileModels.js';
import type { CityHeightField } from './heightfield.js';
import { halfWidth, roadReach, type Point } from '../../roadGeometry.js';
import type { RegionId } from '../regional/types.js';
import type { BlockMapReader } from './types.js';
import { type Activity, type PeopleDrawer, sheetsFor } from './people3d.js';
import { besideCanal } from './canals.js';
import { animateObject, type VehicleEntry } from './eraVehicles.js';
import type { TripWalkers } from './tripWalkers.js';
import { frustumOf } from './pools.js';
import {
  LineIndex, MAX_TAKRAW, SPORTS_COLOURS, getStructureInfo, scanPeople, type EmployedCitizen, type Household, type PeopleScan,
  type RoadLine, type ScanCounter, type Workplace,
} from './peopleScan.js';
export type { EmployedCitizen, Household, RoadLine, Workplace } from './peopleScan.js';

export const MAX_PEDESTRIANS = 140;
/** How much of a scan of who lives and works round the camera (peopleScan.ts) a frame may do: its count of work, and
 * its milliseconds (the steps already begun finish) */
export const SCAN_BUDGET = 40000;
export const SCAN_BUDGET_MS = 2.5;
const MAX_VEHICLES = 16;
let rngState = 0;
function fastSeed(seed: number): void { rngState = seed >>> 0; }
function fastRng(): number { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; }
/** Adult height in metres (1.68 m); multiplied by `size` (realUnits = 10/16 = 0.625 on 16 m city tiles -> 1.05 units). */
export const HUMAN_HEIGHT_M = 1.68;
/** The concept-sheet people are chibi, about 1.5 m: drawn a little larger so they stand as tall as the boxes did. */
const PEOPLE_SCALE = 1.1;
/** How fast people walk and jog (m/s), and how far a cycle of each clip goes at a person's own size (m): the walk clip
 * is 0.85 m a cycle, the run 1.9 m (art/people/scripts/clips.py); their steps go by the distance walked, so nobody
 * slides (owner, 23 Oct 2026: "คนก็เดินถอยหลัง") */
export const WALK_MS = 1.1;
export const JOG_MS = 2.4;
export const WALK_STRIDE_M = 0.85;
export const JOG_STRIDE_M = 1.9;
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

const ballMatrix = new Matrix4();

/** Each line's length from its start to each of its points, for finding a place along it without walking it */
const lineRunCache = new WeakMap<object, Float64Array>();
function lineRun(points: Point[]): Float64Array {
  let run = lineRunCache.get(points);
  if (run) return run;
  run = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    run[i] = run[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  lineRunCache.set(points, run);
  return run;
}
/** The point `along` units from a line's start and the way its piece there runs, as walking it point by point finds
 * them (the first piece reaching that far, or the last) */
const alongOut = { x: 0, z: 0, dx: 0, dz: 0 };
export function pointAlong(points: Point[], along: number): typeof alongOut {
  const run = lineRun(points), last = points.length - 1;
  let lo = 1, hi = last;
  while (lo < hi) { const m = (lo + hi) >> 1; if (run[m] >= along) hi = m; else lo = m + 1; }
  const ax = points[lo - 1][0], az = points[lo - 1][1], bx = points[lo][0], bz = points[lo][1];
  const seg = Math.hypot(bx - ax, bz - az);
  const t = seg > 0 ? Math.max(0, Math.min(1, (along - run[lo - 1]) / seg)) : 0;
  alongOut.x = ax + (bx - ax) * t; alongOut.z = az + (bz - az) * t; alongOut.dx = bx - ax; alongOut.dz = bz - az;
  return alongOut;
}

const NO_COMMUTERS: EmployedCitizen[] = [];

/** A scan under way (peopleScan.ts): where it looks, and for which lines */
interface ScanJob {
  readonly steps: Generator<void, PeopleScan, void>;
  readonly key: string;
  readonly lines: ReadonlyArray<RoadLine>;
  readonly x: number;
  readonly z: number;
}

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

  /** What the last finished scan found round the camera (peopleScan.ts): the people walking now */
  private shown: PeopleScan | null = null;
  private shownKey = '';
  private shownAt = { x: 0, z: 0 };
  /** The scan under way, if any, a few thousand of its steps' work a frame */
  private job: ScanJob | null = null;
  private lineIndex: LineIndex | null = null;
  private readonly counter: ScanCounter = { units: 0 };
  /** How much of a scan a frame may do: its count of work and milliseconds (SCAN_BUDGET, SCAN_BUDGET_MS) */
  scanBudget = SCAN_BUDGET;
  scanBudgetMs = SCAN_BUDGET_MS;
  /** Scans begun and finished, for tests and the bench */
  scansStarted = 0;
  scansFinished = 0;
  /** The lines of roads built again since the scan shown, to the scan's own lines (commutersOn) */
  private remap: { lines: ReadonlyArray<RoadLine>; map: Map<RoadLine, RoadLine> } | null = null;

  employedIndustry = 0;
  employedCommercial = 0;
  employedCivic = 0;
  employedAgri = 0;
  totalEmployed = 0;
  activeCommutersCount = 0;
  size = 1;
  /** The concept-sheet people once their models have loaded (people3d.ts); until then the boxes walk. */
  private people: PeopleDrawer | null = null;
  private peopleRegion: RegionId = 'central';
  private peopleEra: () => number = () => 1;

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

  /** Draw the concept-sheet people from now on, for this region and the city's era as it is read each frame. */
  /** The walks of the city's own (tripWalkers.ts), set by the city view where the city has trips: they take the place
   * of the commuters going to and fro and the joggers, so nobody walks with nowhere to go */
  tripWalkers: TripWalkers | null = null;

  usePeople(drawer: PeopleDrawer, region: RegionId, era: () => number): void {
    this.people?.dispose();
    this.people = drawer;
    this.peopleRegion = region;
    this.peopleEra = era;
    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.count = 0;
      mesh.visible = false;
    }
    this.root.add(drawer.mesh);
  }

  get households(): ReadonlyArray<Household> { return this.shown?.households ?? []; }
  get workplaces(): ReadonlyArray<Workplace> { return this.shown?.workplaces ?? []; }
  get employedCitizens(): ReadonlyArray<EmployedCitizen> { return this.shown?.employed ?? []; }

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
    who = slot,
    role?: 'walk' | 'jog' | 'stand' | 'kick',
  ): void {
    const s = this.size * scaleMultiplier;
    if (this.people) {
      const activity: Activity = poseType;
      this.people.place(slot, x, this.terrain.sample(x, z), z, heading, s * PEOPLE_SCALE, who, activity, phase,
        poseType === 'kick', role ?? activity);
      return;
    }
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

  /** Whether a scan is under way: until it is done the people shown are those of the last one finished */
  get scanning(): boolean { return this.job !== null; }
  /** The scans' count of work so far: tiles read, squares, workplaces and lines weighed (peopleScan.ts) */
  get scanWork(): number { return this.counter.units; }
  /** Where the scan shown looked from (world units), null before the first */
  get scannedAt(): { readonly x: number; readonly z: number } | null { return this.shown ? this.shownAt : null; }

  /**
   * Who lives and works round the camera, found again once it is over another 40-unit square or the roads have
   * changed: a job of small steps (peopleScan.ts) done a budget a frame, the people of the last scan walking on until it
   * is done. With nothing found yet it is done at once. A scan under way that the camera has gone beyond (a jump) is
   * dropped for one where the camera is.
   */
  private scanCityAgents(target: Vector3, span: number, lines: ReadonlyArray<RoadLine>): void {
    const key = `${Math.round(target.x / 40)},${Math.round(target.z / 40)}`;
    if (this.job && (Math.abs(this.job.x - target.x) > span || Math.abs(this.job.z - target.z) > span)) this.job = null;
    const whole = this.shown === null;
    const start = this.counter.units, began = performance.now();
    for (let steps = 0; ; steps++) {
      if (!this.job) {
        if (this.shown && this.shownKey === key && this.shown.lines === lines) return;
        if (this.lineIndex?.lines !== lines) this.lineIndex = new LineIndex(lines, this.counter);
        this.job = { steps: scanPeople(this.snapshot, target.x, target.z, span, this.lineIndex, this.counter), key, lines,
          x: target.x, z: target.z };
        this.scansStarted++;
      }
      if (!whole && (this.counter.units - start >= this.scanBudget || (steps & 7) === 7 && performance.now() - began >= this.scanBudgetMs)) return;
      const step = this.job.steps.next();
      if (step.done) {
        this.show(step.value, this.job.key);
        this.shownAt = { x: this.job.x, z: this.job.z };
        this.job = null;
        this.scansFinished++;
        if (whole) return;
      }
    }
  }

  /** A finished scan's people walk from now on */
  private show(scan: PeopleScan, key: string): void {
    this.shown = scan;
    this.shownKey = key;
    this.remap = null;
    const s = scan.sectors;
    this.employedIndustry = s.industry;
    this.employedCommercial = s.commercial;
    this.employedCivic = s.civic;
    this.employedAgri = s.agriculture;
    this.totalEmployed = s.industry + s.commercial + s.civic + s.agriculture;
  }

  /**
   * The workers the scan shown put on a line. Roads built again since then are new lines: an unchanged road's (the
   * same points, so the same middle) are its old line's until the next scan, and a changed one has none yet.
   */
  private commutersOn(line: RoadLine, lines: ReadonlyArray<RoadLine>): EmployedCitizen[] | undefined {
    const scan = this.shown;
    if (!scan) return undefined;
    if (scan.lines === lines) return scan.byLine.get(line);
    if (!this.remap || this.remap.lines !== lines) {
      const old = new Map<string, RoadLine>(), map = new Map<RoadLine, RoadLine>();
      const name = (l: RoadLine): string => {
        const p = l.points, mid = p[Math.floor(p.length / 2)];
        return `${p.length},${p[0][0]},${p[0][1]},${mid[0]},${mid[1]}`;
      };
      for (const l of scan.byLine.keys()) old.set(name(l), l);
      for (const l of lines) {
        if (l.rail || l.points.length < 2) continue;
        const was = old.get(name(l));
        if (was) map.set(l, was);
      }
      this.remap = { lines, map };
    }
    const was = this.remap.map.get(line);
    return was ? scan.byLine.get(was) : undefined;
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
      this.people?.finish(0);
      return;
    }
    this.people?.useSheets(sheetsFor(this.peopleEra(), this.peopleRegion));

    const viewSpan = Math.min(340, Math.max(130, distance * 0.95));

    this.scanCityAgents(target, viewSpan + 60, lines);

    let count = 0;
    let takrawCount = 0;
    this.activeCommutersCount = 0;
    const takrawCourts = this.shown?.takrawCourts ?? [];
    const chatSpots = this.shown?.chatSpots ?? [];
    const transitStops = this.shown?.transitStops ?? [];
    const shopSpots = this.shown?.shopSpots ?? [];

    // 1. The city's walks, from a home to work or the shops and back, along the pavements (tripWalkers.ts) ...
    const walks = this.tripWalkers?.active ? this.tripWalkers : null;
    if (walks) {
      walks.update(target.x, target.z, viewSpan + 60, seconds);
      walks.each(target.x - viewSpan, target.x + viewSpan, target.z - viewSpan, target.z + viewSpan, (w, x, z, heading) => {
        if (count >= MAX_PEDESTRIANS) return;
        const phase = 2 * Math.PI * w.s / (WALK_STRIDE_M * this.size * 0.96 * PEOPLE_SCALE);
        this.placeWalker(count++, x, z, heading, phase, 0.96, SPORTS_COLOURS[w.who % SPORTS_COLOURS.length], 'walk', undefined, w.who);
        this.activeCommutersCount++;
      });
    }
    // ... or, where the city has none (a province map), commuters & joggers along road sidewalks
    for (let lineIdx = 0; !walks && lineIdx < lines.length && count < MAX_PEDESTRIANS; lineIdx++) {
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

      const lineCommuters = this.commutersOn(line, lines) ?? NO_COMMUTERS;
      const commuterCount = Math.min(lineCommuters.length, 12);

      // A. Real Commuters going between home and work: along the street and back at a walking pace, facing the way
      // they walk, a step cycle every stride walked
      for (let c = 0; c < commuterCount && count < MAX_PEDESTRIANS; c++) {
        const worker = lineCommuters[c];
        const speed = WALK_MS * this.size * worker.speedVar;
        const walked = seconds * speed + worker.id * 37.1;
        const travel = walked % (totalLen * 2);
        const toWork = travel < totalLen;
        const dir = toWork ? 1 : -1;
        const distAlong = toWork ? travel : totalLen * 2 - travel;

        const { x: px, z: pz, dx, dz } = pointAlong(line.points, distAlong);

        if (Math.abs(px - target.x) > viewSpan || Math.abs(pz - target.z) > viewSpan) continue;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len, nz = dx / len;
        const sideSign = (c % 2 === 0 ? 1 : -1);
        const offset = sideSign * sidewalkOffset;
        const wx = px + nx * offset;
        const wz = pz + nz * offset;
        const heading = Math.atan2(dx * dir, dz * dir);
        const phase = 2 * Math.PI * walked / (WALK_STRIDE_M * this.size * 0.96 * PEOPLE_SCALE);

        this.placeWalker(count++, wx, wz, heading, phase, 0.96, worker.shirtColor, 'walk', undefined, worker.id);
        this.activeCommutersCount++;
      }

      // B. Joggers / Fitness runners along sidewalks
      // Only 1 jogger on quiet roads, up to 2 on active roads
      const joggerCount = activity > 0 ? (totalLen > 40 ? 2 : 1) : (totalLen > 25 ? 1 : 0);
      fastSeed(tileSeed(tx + lineIdx * 19, ty + lineIdx * 37));
      for (let j = 0; j < joggerCount && count < MAX_PEDESTRIANS; j++) {
        const jogDir = (j % 2 === 0 ? 1 : -1);
        const jogStartFrac = fastRng();
        const jogTravel = (jogStartFrac * totalLen + seconds * JOG_MS * this.size * jogDir) % totalLen;
        const distAlong = jogTravel < 0 ? jogTravel + totalLen : jogTravel;

        const { x: px, z: pz, dx, dz } = pointAlong(line.points, distAlong);

        if (Math.abs(px - target.x) > viewSpan || Math.abs(pz - target.z) > viewSpan) continue;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len, nz = dx / len;
        const sideSign = (j % 2 === 0 ? -1 : 1);
        const wx = px + nx * sideSign * sidewalkOffset;
        const wz = pz + nz * sideSign * sidewalkOffset;
        const heading = Math.atan2(dx * jogDir, dz * jogDir);
        const phase = 2 * Math.PI * seconds * JOG_MS / (JOG_STRIDE_M * 0.98 * PEOPLE_SCALE) + j * 3.1 + lineIdx;
        const jogShirt = SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)];

        this.placeWalker(count++, wx, wz, heading, phase, 0.98, jogShirt, 'jog', undefined, 50000 + lineIdx * 4 + j);
      }
    }

    // 2. Thai Community Activities: Sepak Takraw (เล่นตะกร้อวง)
    const takrawCourtR = 1.75 * this.size;
    for (let tIdx = 0; tIdx < takrawCourts.length && count < MAX_PEDESTRIANS - 2; tIdx++) {
      const court = takrawCourts[tIdx];
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
        this.placeWalker(count++, player.x, player.z, player.heading, seconds * 3 + p * 2.1, 0.95, shirt, pose, customSwing,
          60000 + court.seed * 3 + p, 'kick');
      }
    }

    // 3. Socializing Neighbors (ยืนคุยกันหน้าบ้าน)
    for (let c = 0; c < chatSpots.length && count < MAX_PEDESTRIANS - 1; c++) {
      const spot = chatSpots[c];
      if (Math.abs(spot.cx - target.x) > viewSpan || Math.abs(spot.cz - target.z) > viewSpan) continue;
      const facingA = spot.angle;
      const facingB = spot.angle + Math.PI;
      const p1x = spot.cx - Math.sin(spot.angle) * 0.65 * this.size;
      const p1z = spot.cz - Math.cos(spot.angle) * 0.65 * this.size;
      const p2x = spot.cx + Math.sin(spot.angle) * 0.65 * this.size;
      const p2z = spot.cz + Math.cos(spot.angle) * 0.65 * this.size;
      this.placeWalker(count++, p1x, p1z, facingA + Math.PI / 2, seconds * 0.8 + c, 0.95, spot.shirtA, 'stand', undefined,
        70000 + c * 2);
      this.placeWalker(count++, p2x, p2z, facingB + Math.PI / 2, seconds * 0.8 + c + 1.2, 0.93, spot.shirtB, 'stand', undefined,
        70001 + c * 2);
    }

    // 4. Waiting passengers at bus stops (รอรถเมล์/สองแถว)
    for (let s = 0; s < transitStops.length && count < MAX_PEDESTRIANS; s++) {
      const stop = transitStops[s];
      if (Math.abs(stop.wx - target.x) > viewSpan || Math.abs(stop.wz - target.z) > viewSpan) continue;
      this.placeWalker(count++, stop.wx, stop.wz, stop.heading, seconds * 0.2 + s, 0.96, stop.shirt, 'stand', 0, 80000 + s);
    }

    // 5. Commercial shoppers outside shops
    for (let sp = 0; sp < shopSpots.length && count < MAX_PEDESTRIANS; sp++) {
      const shop = shopSpots[sp];
      if (Math.abs(shop.wx - target.x) > viewSpan || Math.abs(shop.wz - target.z) > viewSpan) continue;
      this.placeWalker(count++, shop.wx, shop.wz, shop.heading, seconds * 0.6 + sp, 0.94, shop.shirt, 'stand', undefined,
        90000 + sp);
    }

    const boxes = this.people ? 0 : count;
    this.people?.finish(count);
    this.shirtMesh.count = boxes;
    this.headMesh.count = boxes;
    this.strideAMesh.count = boxes;
    this.strideBMesh.count = boxes;
    this.takrawMesh.count = takrawCount;
    for (const mesh of [this.shirtMesh, this.headMesh, this.strideAMesh, this.strideBMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.shirtMesh.instanceColor) this.shirtMesh.instanceColor.needsUpdate = true;
    if (takrawCount > 0) this.takrawMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.people?.dispose();
    this.people = null;
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
  /** World units it flies above the road (an era 5 flying taxi), 0 on it */
  readonly fly?: number;
  /** The era vehicle it is (its moving parts), if it is one */
  readonly entry?: VehicleEntry;
}

/** The era vehicles the wandering cars are made of once they load (eraVehicles.ts, set by the city view): a key that
 * changes with the era and the models loaded, and each slot's vehicle (metres; speed against a car's) */
export interface RoadTrafficEraSource {
  key(): string;
  vehicle(slot: number): { model: Object3D; slow: number; fly: number; entry?: VehicleEntry } | null;
}

/**
 * Real 3D road vehicles (`veh.sedan`, `veh.pickup`, `veh.motorbike`, `veh.tuktuk`, `veh.songthaew`, `veh.truck`, `veh.etan`)
 * driving in the left lane along `RoadCurves.drawnLines` at realistic scale (`realUnits`).
 */
export class CityRoadTraffic {
  readonly root = new Group();
  private readonly vehicles: VehicleSlot[] = [];
  private builtSize = 0;
  eraSource: RoadTrafficEraSource | null = null;
  private builtKey = '';

  constructor(
    private readonly snapshot: TileSnapshot,
    private readonly terrain: CityHeightField,
    private readonly region: RegionId,
    public size = 1,
  ) {
    this.root.name = 'roadTraffic';
  }

  private ensurePool(): void {
    // The era's vehicles once they load, made again when the era changes
    const key = this.eraSource?.key() ?? '';
    if (key !== this.builtKey) {
      for (const v of this.vehicles) this.root.remove(v.model);
      this.vehicles.length = 0;
      this.builtKey = key;
    }
    if (this.vehicles.length === MAX_VEHICLES && this.builtSize === this.size) return;
    if (this.vehicles.length === 0) {
      const ids = VEHICLE_POOL_IDS[this.region] ?? VEHICLE_POOL_IDS.central;
      for (let i = 0; i < MAX_VEHICLES; i++) {
        const id = ids[i % ids.length];
        const entry = registry[id];
        const era = key ? this.eraSource!.vehicle(i) : null;
        const model = era?.model ?? (entry ? entry.factory({ seed: i % 4, region: this.region }) : new Group());
        model.traverse(node => {
          const m = node as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
          if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; }
        });
        model.scale.setScalar(this.size);
        model.visible = false;
        const speed = era ? 7.0 * era.slow : id === 'veh.etan' ? 3.2 : id === 'veh.truck' || id === 'veh.songthaew' ? 5.2 : id === 'veh.tuktuk' ? 5.8 : 7.0;
        this.vehicles.push({ model, speed, fly: era ? era.fly : 0, entry: era?.entry });
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

      // The cars of one lane of one way go at one pace, the slowest of them, evenly spaced along it, so none drives
      // through the one ahead (owner, 23 Oct 2026: "รถไม่ควรจะซ้อนกันคันกัน"); a faster lane beside it passes
      const groups = lanesPerDir * 2, groupSpeed = new Array<number>(groups).fill(Infinity);
      const groupStart = Array.from({ length: groups }, () => fastRng());
      for (let c = 0; c < countOnLine; c++) {
        const s = this.vehicles[(used + c) % this.vehicles.length];
        groupSpeed[c % groups] = Math.min(groupSpeed[c % groups], s.speed);
      }
      for (let c = 0; c < countOnLine && used < MAX_VEHICLES; c++) {
        const slot = this.vehicles[used];
        const group = c % groups, inGroup = Math.floor(c / groups), groupCount = Math.ceil((countOnLine - group) / groups);
        const dir = group % 2 === 0 ? 1 : -1;
        const laneIdx = Math.floor(group / 2);
        const speed = groupSpeed[group] * this.size * (0.9 + laneIdx * 0.1);
        const travel = ((groupStart[group] + inGroup / groupCount) * totalLen + seconds * speed * dir) % totalLen;
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
        const lateral = (laneIdx + 0.55) * laneStep;
        // Left-hand traffic offset: (cos(heading), -sin(heading)) is to the left of the heading vector (sin(heading), cos(heading))
        const vx = px + Math.cos(heading) * lateral;
        const vz = pz - Math.sin(heading) * lateral;

        slot.model.position.set(vx, this.terrain.sample(vx, vz) + (slot.fly ?? 0) * this.size, vz);
        slot.model.rotation.y = heading;
        slot.model.visible = true;
        // ... its wheels rolling, its animals' legs walking and its riders pedalling by how far it has come
        if (slot.entry) animateObject(slot.model, slot.entry, seconds * speed / this.size, seconds);
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
  /** Every tree of the species round the camera: its matrix, its crown's middle (world units) and reach; the meshes
   * draw only those in sight (CityFoliage.cull) */
  readonly matrices: Float32Array;
  readonly centres: Float32Array;
  readonly reach: Float32Array;
  /** The model's own middle and reach */
  readonly bounds: Sphere;
}
const treeSphere = new Sphere();

/**
 * Detailed, wind-swaying 3D tropical trees (`veg.golden_shower` / ต้นคูนราชพฤกษ์ดอกเหลืองขอนแก่น,
 * `veg.rain_tree` / จามจุรี, `veg.flame_tree` / หางนกยูง, `veg.mango` / มะม่วง, `veg.sugar_palm` / ตาลโตนด)
 * instanced along streets, parks, forests (`woods`), orchards, villages, and paddy dikes near the camera.
 */
export class CityFoliage {
  readonly root = new Group();
  private readonly batches: SpeciesBatch[] = [];
  private lastCellKey = '';
  /** The roads the trees were last planted beside */
  private lastLines: ReadonlyArray<RoadLine> | null = null;
  /** The view's camera (index.ts): only the trees in its sight are drawn, sorted again as it moves */
  camera: Camera | null = null;
  private readonly sight = new Frustum();
  private readonly lastSight = new Float32Array(16);

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
      const bounds = new Sphere();
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
          merged.computeBoundingSphere();
          if (merged.boundingSphere) bounds.union(merged.boundingSphere);
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
      this.batches.push({ meshes, count: 0, matrices: new Float32Array(MAX_PER_SPECIES * 16), centres: new Float32Array(MAX_PER_SPECIES * 3),
        reach: new Float32Array(MAX_PER_SPECIES), bounds });
    }
  }

  private addTree(speciesIdx: number, x: number, z: number, scale: number, yaw: number): void {
    const batch = this.batches[speciesIdx];
    if (!batch || batch.count >= MAX_PER_SPECIES) return;
    const slot = batch.count++;
    const y = this.terrain.sample(x, z);
    bodyMatrix.makeRotationY(yaw).scale(new Vector3(scale, scale, scale)).setPosition(x, y, z);
    bodyMatrix.toArray(batch.matrices, slot * 16);
    treeSphere.copy(batch.bounds).applyMatrix4(bodyMatrix);
    treeSphere.center.toArray(batch.centres, slot * 3); batch.reach[slot] = treeSphere.radius;
  }

  /**
   * The trees in the camera's sight into the meshes, when the camera moved or the trees round it changed: the trees
   * behind it or off the screen's sides cost nothing (they were all drawn before). Without a camera, every tree.
   */
  private cull(planted: boolean): void {
    const moved = this.camera ? frustumOf(this.camera, this.sight, this.lastSight) : false;
    if (!moved && !planted) return;
    for (const b of this.batches) {
      let n = 0;
      for (let slot = 0; slot < b.count; slot++) {
        treeSphere.center.fromArray(b.centres, slot * 3); treeSphere.radius = b.reach[slot] + 1;
        if (this.camera && !this.sight.intersectsSphere(treeSphere)) continue;
        for (const mesh of b.meshes) (mesh.instanceMatrix.array as Float32Array).set(b.matrices.subarray(slot * 16, slot * 16 + 16), n * 16);
        n++;
      }
      for (const mesh of b.meshes) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
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
    // (roads drawn again keep no tree on them: the view no longer plants every tree again for each tile that changes)
    if (lines !== this.lastLines) { this.lastLines = lines; this.lastCellKey = ''; }
    if (cellKey === this.lastCellKey) { this.cull(false); return; }
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
              if (besideCanal(this.snapshot, tileY * this.snapshot.width + tileX)) continue;
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
        // ... and none on a canal or its banks (canals.ts)
        if (besideCanal(this.snapshot, i)) continue;

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

    this.cull(true);
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

