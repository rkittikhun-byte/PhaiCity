/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The people's scan (peopleScan.ts) spread over frames: the same households, workplaces, workers and lines as the
// old scan that weighed every workplace and line in turn, and a bounded share of work each frame while the camera
// pans or jumps over a big town (RENDERER_SPEC 8B).

import { Vector3 } from 'three';
import {
  LineIndex, getStructureInfo, scanPeople, type EmployedCitizen, type Household, type PeopleScan, type RoadLine,
  type ScanTiles, type Workplace,
} from '../../src/render3d/city/peopleScan.js';
import { CityPedestrians, pointAlong } from '../../src/render3d/city/pedestrians.js';
import { TileSnapshot, tileSeed } from '../../src/render3d/city/tileModels.js';
import { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { plotTile, type PlotKind } from '../../src/plots.js';
import { BUS_STOP, CIVIC, FARM_BASE, HOUSE, IND1, TREEBASE } from '../../src/tileValues.js';
import { ZONEBIT } from '../../src/tileFlags.js';
import type { Point } from '../../src/roadGeometry.js';

// ---------------------------------------------------------------------------------------------------------------
// The scan as it was before (pedestrians.ts until 21 Oct 2026), kept here to check the new one against
// ---------------------------------------------------------------------------------------------------------------

let refRng = 0;
const refSeed = (seed: number): void => { refRng = seed >>> 0; };
const refNext = (): number => { refRng = (Math.imul(refRng, 1664525) + 1013904223) >>> 0; return refRng / 4294967296; };
const SHIRTS = [0x2c4c7e, 0xf2f0e8, 0xc85a3b, 0x3b7a6e, 0xe0a238, 0xd96f14, 0x5d7aa8, 0x8b4c70, 0x6b8e4e, 0xd97f54, 0x48525e, 0xe6c229, 0x283845];
const SPORTS = [0x3b7a6e, 0xe0a238, 0xd97f54, 0x8b4c70, 0x2c4c7e, 0xc85a3b];
const IND = [0x2c4c7e, 0x48525e, 0xc85a3b, 0x283845];
const COM = [0xf2f0e8, 0x5d7aa8, 0x283845, 0xe6c229];
const CIV = [0xf2f0e8, 0x283845, 0xe6c229, 0x48525e];
const NAMES = ['สมชาย', 'วิชัย', 'วีระ', 'ประเสริฐ', 'บุญส่ง', 'สุรชัย', 'สมบัติ', 'มานะ', 'สมร', 'กานดา', 'สุภา', 'วันดี', 'รัตนา', 'เพ็ญศรี', 'อรทัย', 'ศิริพร'];

interface RefScan {
  households: Household[]; workplaces: Workplace[]; employed: EmployedCitizen[];
  takraw: unknown[]; chats: unknown[]; stops: unknown[]; shops: unknown[]; byLine: Map<number, EmployedCitizen[]>;
  /** The pairs of resident and workplace, and of worker and line, it weighed */
  weighed: number;
}

function referenceScan(tiles: ScanTiles, cx: number, cz: number, span: number, lines: ReadonlyArray<RoadLine>): RefScan {
  const minTx = Math.max(1, Math.floor((cx - span) / 10)), maxTx = Math.min(tiles.width - 2, Math.ceil((cx + span) / 10));
  const minTy = Math.max(1, Math.floor((cz - span) / 10)), maxTy = Math.min(tiles.height - 2, Math.ceil((cz + span) / 10));
  const households: Household[] = [], workplaces: Workplace[] = [];
  const takraw: { cx: number; cz: number; seed: number; angle0: number; shirts: number[] }[] = [];
  const chats: unknown[] = [], stops: unknown[] = [], shops: unknown[] = [];
  let workerId = 0, houseId = 0, workId = 0, weighed = 0;
  const shirts3 = () => [SPORTS[Math.floor(refNext() * SPORTS.length)], SPORTS[Math.floor(refNext() * SPORTS.length)], SPORTS[Math.floor(refNext() * SPORTS.length)]];
  for (let ty = minTy; ty <= maxTy; ty++) for (let tx = minTx; tx <= maxTx; tx++) {
    const i = ty * tiles.width + tx, info = getStructureInfo(tiles.values[i], tiles.flags[i]);
    if (!info) continue;
    const seed = tileSeed(tx, ty), x = (tx + 0.5) * 10, z = (ty + 0.5) * 10;
    if (info.kind === 'home') {
      households.push({ id: ++houseId, tx, ty, wx: x, wz: z, residentCount: Math.max(1, info.level * 2) });
      if (seed % 6 === 0 && takraw.length < 8) {
        refSeed(seed ^ 0xa5a5a5a5);
        takraw.push({ cx: x + (refNext() - 0.5) * 1.5, cz: z + (refNext() - 0.5) * 1.5, seed, angle0: refNext() * Math.PI * 2, shirts: shirts3() });
      } else if (seed % 4 === 1 && chats.length < 16) {
        refSeed(seed ^ 0x3c3c3c3c);
        chats.push({ cx: x + (refNext() - 0.5) * 2.0, cz: z + (refNext() - 0.5) * 2.0, angle: refNext() * Math.PI,
          shirtA: SHIRTS[Math.floor(refNext() * SHIRTS.length)], shirtB: SHIRTS[Math.floor(refNext() * SHIRTS.length)] });
      }
    } else if (info.kind === 'industry' || info.kind === 'mine') {
      workplaces.push({ id: ++workId, tx, ty, wx: x, wz: z, sector: 'industry', companyName: String(seed % 8), capacity: Math.max(1, info.level * 3), assignedWorkers: 0 });
    } else if (info.kind === 'commercial') {
      workplaces.push({ id: ++workId, tx, ty, wx: x, wz: z, sector: 'commercial', companyName: String(seed % 7), capacity: Math.max(1, info.level * 2), assignedWorkers: 0 });
      if (seed % 3 === 0 && shops.length < 12) {
        refSeed(seed ^ 0x7e7e7e7e);
        shops.push({ wx: x + (refNext() - 0.5) * 2.2, wz: z + (refNext() - 0.5) * 2.2, heading: refNext() * Math.PI * 2, shirt: SHIRTS[Math.floor(refNext() * SHIRTS.length)] });
      }
    } else if (info.kind === 'civic') {
      workplaces.push({ id: ++workId, tx, ty, wx: x, wz: z, sector: 'civic', companyName: String(seed % 6), capacity: 4, assignedWorkers: 0 });
    } else if (info.kind === 'farm') {
      workplaces.push({ id: ++workId, tx, ty, wx: x, wz: z, sector: 'agriculture', companyName: String(seed % 3), capacity: 3, assignedWorkers: 0 });
    } else if (info.kind === 'stop') {
      refSeed(seed ^ 0x55aa55aa);
      stops.push({ wx: x, wz: z, heading: (seed % 4) * (Math.PI / 2), shirt: SHIRTS[Math.floor(refNext() * SHIRTS.length)] });
    } else if (info.kind === 'park' && seed % 3 === 0 && takraw.length < 8) {
      refSeed(seed ^ 0x12345678);
      takraw.push({ cx: x, cz: z, seed, angle0: refNext() * Math.PI * 2, shirts: shirts3() });
    }
  }
  const employed: EmployedCitizen[] = [];
  for (const h of households) {
    refSeed(tileSeed(h.tx + 7, h.ty + 13));
    for (let r = 0; r < h.residentCount; r++) {
      let best: Workplace | null = null, bestDist = Infinity;
      for (const w of workplaces) {
        weighed++;
        if (w.assignedWorkers >= w.capacity) continue;
        const dist = Math.hypot(w.wx - h.wx, w.wz - h.wz);
        if (dist < bestDist) { bestDist = dist; best = w; }
      }
      if (!best) continue;
      best.assignedWorkers++;
      const shirtColor = best.sector === 'commercial' ? COM[(h.id + r) % COM.length] : best.sector === 'civic' ? CIV[(h.id + r) % CIV.length] : IND[(h.id + r) % IND.length];
      employed.push({ id: ++workerId, name: NAMES[(h.id * 3 + r) % NAMES.length], home: h, workplace: best, shirtColor, speedVar: 0.88 + refNext() * 0.24, lineIdx: -1 });
    }
  }
  const byLine = new Map<number, EmployedCitizen[]>();
  for (const worker of employed) {
    let bestLine = -1, minScore = Infinity;
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (line.rail || line.points.length < 2) continue;
      weighed++;
      const mid = line.points[Math.floor(line.points.length / 2)];
      const score = Math.hypot(mid[0] - worker.home.wx, mid[1] - worker.home.wz) + Math.hypot(mid[0] - worker.workplace.wx, mid[1] - worker.workplace.wz);
      if (score < minScore && score < 160) { minScore = score; bestLine = l; }
    }
    worker.lineIdx = bestLine;
    if (bestLine >= 0) { const list = byLine.get(bestLine) ?? []; list.push(worker); byLine.set(bestLine, list); }
  }
  return { households, workplaces, employed, takraw, chats, stops, shops, byLine, weighed };
}

/** The old walk along a line, point by point */
function referenceAlong(points: Point[], along: number): { x: number; z: number; dx: number; dz: number } {
  let acc = 0, px = points[0][0], pz = points[0][1], dx = points[1][0] - px, dz = points[1][1] - pz;
  for (let i = 1; i < points.length; i++) {
    const ax = points[i - 1][0], az = points[i - 1][1], bx = points[i][0], bz = points[i][1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (acc + seg >= along || i === points.length - 1) {
      const t = seg > 0 ? Math.max(0, Math.min(1, (along - acc) / seg)) : 0;
      px = ax + (bx - ax) * t; pz = az + (bz - az) * t; dx = bx - ax; dz = bz - az;
      break;
    }
    acc += seg;
  }
  return { x: px, z: pz, dx, dz };
}

// ---------------------------------------------------------------------------------------------------------------
// A big test town: homes, shops and factories of every level on a grid of streets, with civic buildings, farms, bus
// stops and parks, more people than jobs in some places and more jobs in others
// ---------------------------------------------------------------------------------------------------------------

const SIZE = 180;
const STREET = 8;

function townMap(size = SIZE, jobs = 1): { width: number; height: number; values: Uint16Array; flags: Uint16Array;
  getTileValue(x: number, y: number): number; getTileFlags(x: number, y: number): number } {
  const values = new Uint16Array(size * size), flags = new Uint16Array(size * size);
  for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) {
    if (y % STREET === 0 || x % STREET === 0) continue;
    const h = tileSeed(x * 7 + 3, y * 13 + 5), i = y * size + x, roll = h % 100;
    // The town thins out away from its middle
    const far = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
    if ((h >>> 9) % 100 < far * 55) continue;
    const kind: PlotKind = roll < 22 * jobs ? 'commercial' : roll >= 100 - 10 * jobs ? 'industrial' : 'residential';
    const level = 1 + (h >>> 14) % (kind === 'industrial' ? 3 : 4);
    if (roll === 50) { values[i] = HOUSE + h % 9; continue; }
    if (roll === 51) { values[i] = IND1; flags[i] = ZONEBIT; continue; }
    if (roll === 52) { values[i] = CIVIC; flags[i] = ZONEBIT; continue; }
    if (roll === 53) { values[i] = FARM_BASE; flags[i] = ZONEBIT; continue; }
    if (roll === 54) { values[i] = BUS_STOP; continue; }
    if (roll === 55) { values[i] = TREEBASE + h % 10; continue; }
    values[i] = plotTile(kind, level, (h >>> 20) % 4, (h >>> 4) % 3);
  }
  return { width: size, height: size, values, flags,
    getTileValue: (x: number, y: number) => values[y * size + x], getTileFlags: (x: number, y: number) => flags[y * size + x] };
}

/** The town's streets as road lines a block long, a point every tile, and a railway and a line too short to walk */
function townLines(size = SIZE): RoadLine[] {
  const lines: RoadLine[] = [];
  for (let k = STREET; k < size - 1; k += STREET) {
    for (let a = 0; a + STREET <= size - 1; a += STREET) {
      const along = (n: number): number => (a + n + 0.5) * 10, across = (k + 0.5) * 10;
      const row: Point[] = [], column: Point[] = [];
      for (let n = 0; n <= STREET; n++) { row.push([along(n), across]); column.push([across, along(n)]); }
      lines.push({ points: row, rail: false, level: 2 + (k + a) % 3 }, { points: column, rail: false, level: 2 });
    }
  }
  lines.push({ points: [[5, 5], [size * 10 - 5, size * 10 - 5]], rail: true });
  lines.push({ points: [[size * 5, size * 5]], rail: false });
  return lines;
}

const plainScan = (scan: PeopleScan, lines: ReadonlyArray<RoadLine>) => ({
  households: scan.households,
  workplaces: scan.workplaces.map(w => ({ id: w.id, tx: w.tx, ty: w.ty, sector: w.sector, capacity: w.capacity, assigned: w.assignedWorkers })),
  employed: scan.employed.map(e => [e.id, e.name, e.home.id, e.workplace.id, e.shirtColor, e.speedVar, e.lineIdx]),
  takraw: scan.takrawCourts, chats: scan.chatSpots, stops: scan.transitStops, shops: scan.shopSpots,
  byLine: [...scan.byLine].map(([line, list]) => [lines.indexOf(line), list.map(e => e.id)]).sort((a, b) => (a[0] as number) - (b[0] as number)),
});
const plainReference = (ref: RefScan) => ({
  households: ref.households,
  workplaces: ref.workplaces.map(w => ({ id: w.id, tx: w.tx, ty: w.ty, sector: w.sector, capacity: w.capacity, assigned: w.assignedWorkers })),
  employed: ref.employed.map(e => [e.id, e.name, e.home.id, e.workplace.id, e.shirtColor, e.speedVar, e.lineIdx]),
  takraw: ref.takraw, chats: ref.chats, stops: ref.stops, shops: ref.shops,
  byLine: [...ref.byLine].map(([l, list]) => [l, list.map(e => e.id)]).sort((a, b) => (a[0] as number) - (b[0] as number)),
});

/** The scan to its end, a step at a time, with the most work any one step did */
function runScan(tiles: ScanTiles, x: number, z: number, span: number, lines: ReadonlyArray<RoadLine>) {
  const counter = { units: 0 }, index = new LineIndex(lines, counter), steps = scanPeople(tiles, x, z, span, index, counter);
  let most = 0, count = 0;
  for (;;) {
    const before = counter.units, step = steps.next();
    most = Math.max(most, counter.units - before); count++;
    if (step.done) return { scan: step.value, units: counter.units, most, steps: count };
  }
}

describe('the people\'s scan (peopleScan.ts)', () => {
  const map = townMap(), lines = townLines();
  const middle = referenceScan(map, 900, 900, 400, lines);

  it('finds the same households, workplaces, workers and lines as weighing every workplace and line in turn', () => {
    for (const [x, z, span] of [[900, 900, 400], [450, 1300, 288], [1700, 200, 190], [30, 30, 190]]) {
      const { scan } = runScan(map, x, z, span, lines), ref = x === 900 ? middle : referenceScan(map, x, z, span, lines);
      expect(scan.employed.length).toBeGreaterThan(0);
      const plain = plainScan(scan, lines);
      // The company names are the tables' (the reference keeps only their index)
      expect(plain).toEqual(plainReference(ref));
      expect(scan.workplaces.map(w => w.companyName.length > 0)).not.toContain(false);
    }
  });

  it('matches the old scan where jobs run out and where they are left over', () => {
    for (const jobs of [0.25, 2.5]) {
      const m = townMap(120, jobs), l = townLines(120);
      const { scan } = runScan(m, 600, 600, 400, l), ref = referenceScan(m, 600, 600, 400, l);
      expect(plainScan(scan, l)).toEqual(plainReference(ref));
      const full = scan.workplaces.filter(w => w.assignedWorkers === w.capacity).length;
      if (jobs < 1) expect(full).toBe(scan.workplaces.length); else expect(full).toBeLessThan(scan.workplaces.length);
    }
  });

  it('does a small part of the old work, in small steps', () => {
    const { scan, units, most, steps } = runScan(map, 900, 900, 400, lines), ref = middle;
    expect(scan.employed.length).toBeGreaterThan(2000);
    // The old scan weighed every workplace for each resident and every line for each worker
    expect(units * 20).toBeLessThan(ref.weighed);
    // ... and no step is more than a row of tiles or a household
    expect(most).toBeLessThan(2500);
    expect(steps).toBeGreaterThan(100);
  });

  it('finds a place along a line exactly as walking it point by point does', () => {
    const points: Point[] = [[0, 0], [3, 4], [3, 4], [10, 4], [12.5, -7.25], [12.5, -7.25], [40, 1]];
    const total = referenceAlong(points, Infinity);
    expect(total.x).toBe(40);
    for (let along = -2; along < 80; along += 0.37) expect(pointAlong(points, along)).toEqual(referenceAlong(points, along));
    for (const along of [0, 5, 12, 23.4]) expect(pointAlong(points, along)).toEqual(referenceAlong(points, along));
    for (const line of lines.filter(l => l.points.length >= 2)) {
      for (const along of [0, 7.3, 33, 79.99, 80, 200]) expect(pointAlong(line.points, along)).toEqual(referenceAlong(line.points, along));
    }
  });
});

describe('the people while the camera pans or jumps over a big town', () => {
  const map = townMap(), lines = townLines();
  const make = () => {
    const s = new TileSnapshot(SIZE, SIZE);
    s.sync(map);
    const peds = new CityPedestrians(s, new CityHeightField(s, map), 1);
    // Counted work only, so the test is the same on any machine
    peds.scanBudgetMs = Infinity;
    return peds;
  };
  const placed = (peds: CityPedestrians) => ({
    count: peds.shirtMesh.count,
    matrices: Array.from(peds.shirtMesh.instanceMatrix.array.slice(0, peds.shirtMesh.count * 16)),
    colours: Array.from(peds.shirtMesh.instanceColor!.array.slice(0, peds.shirtMesh.count * 3)),
    takraw: peds.takrawMesh.count,
  });
  const span = (distance: number) => Math.min(340, Math.max(130, distance * 0.95)) + 60;
  // The most work a step of the scans over this town does (a row of tiles or a household), along the pan and where
  // the camera jumps to
  const mostStep = Math.max(...[...Array.from({ length: 13 }, (_, k) => [300 + k * 100, 900]), [1500, 1400]]
    .map(([x, z]) => runScan(map, x, z, span(240), lines).most));

  it('has steps small beside a frame\'s budget', () => {
    expect(mostStep).toBeLessThan(2500);
  });

  it('does at most its budget and a step each frame while panning, and shows people all the way', () => {
    const peds = make(), target = new Vector3(300, 0, 900);
    try {
      peds.update(lines, target, 240, 1);
      expect(peds.scansFinished).toBe(1);
      let most = 0, empty = 0;
      for (let frame = 0; frame < 300; frame++) {
        target.x += 4;
        const before = peds.scanWork;
        peds.update(lines, target, 240, 1 + frame / 60);
        most = Math.max(most, peds.scanWork - before);
        if (peds.shirtMesh.count === 0) empty++;
      }
      expect(most).toBeLessThanOrEqual(peds.scanBudget + mostStep);
      // The scans keep up with the pan (a 40-unit square every 10 frames)
      expect(peds.scansFinished).toBeGreaterThan(12);
      expect(empty).toBe(0);
    } finally {
      peds.dispose();
    }
  });

  it('shows, once the camera stops, the same people as a scan of the whole place at once', () => {
    const peds = make(), target = new Vector3(400, 0, 600);
    try {
      peds.update(lines, target, 240, 1);
      for (let frame = 0; frame < 120; frame++) { target.x += 5; target.z += 3; peds.update(lines, target, 240, 2); }
      // ... the last step into a square no scan has looked from
      target.x += 40;
      let frames = 0;
      do { peds.update(lines, target, 240, 3); frames++; } while (peds.scanning && frames < 500);
      expect(peds.scanning).toBe(false);
      expect(peds.scannedAt).toEqual({ x: target.x, z: target.z });
      const fresh = make();
      try {
        fresh.update(lines, target, 240, 3);
        expect(placed(peds)).toEqual(placed(fresh));
        expect(placed(peds).count).toBeGreaterThan(50);
        expect(peds.employedCitizens.map(e => [e.id, e.home.id, e.workplace.id, e.lineIdx]))
          .toEqual(fresh.employedCitizens.map(e => [e.id, e.home.id, e.workplace.id, e.lineIdx]));
        expect(peds.employmentStats).toEqual(fresh.employmentStats);
      } finally {
        fresh.dispose();
      }
    } finally {
      peds.dispose();
    }
  });

  it('after a jump does at most its budget a frame and soon shows the people where the camera is', () => {
    const peds = make(), target = new Vector3(800, 0, 800);
    try {
      peds.update(lines, target, 240, 1);
      // A scan under way, then the camera jumps across the town (centreOn)
      target.set(860, 0, 860);
      peds.update(lines, target, 240, 1);
      expect(peds.scanning).toBe(true);
      target.set(1500, 0, 1400);
      let frames = 0, most = 0;
      do {
        const before = peds.scanWork;
        peds.update(lines, target, 240, 4);
        most = Math.max(most, peds.scanWork - before); frames++;
      } while (peds.scanning && frames < 500);
      expect(most).toBeLessThanOrEqual(peds.scanBudget + mostStep);
      // The scan from before the jump was dropped, not finished first
      expect(peds.scannedAt).toEqual({ x: 1500, z: 1400 });
      expect(frames).toBeLessThan(40);
      const fresh = make();
      try {
        fresh.update(lines, target, 240, 4);
        expect(placed(peds)).toEqual(placed(fresh));
      } finally {
        fresh.dispose();
      }
    } finally {
      peds.dispose();
    }
  });

  it('keeps the walkers on roads built again unchanged until the next scan is done', () => {
    const peds = make(), target = new Vector3(900, 0, 900);
    try {
      peds.update(lines, target, 240, 5);
      const before = placed(peds);
      expect(peds.activeCommutersCount).toBeGreaterThan(20);
      // The roads built again (roadCurves.ts makes new lines with the same points), so a scan starts
      const rebuilt = lines.map(l => ({ ...l }));
      peds.update(rebuilt, target, 240, 5);
      expect(peds.scanning).toBe(true);
      expect(placed(peds)).toEqual(before);
      let frames = 0;
      do { peds.update(rebuilt, target, 240, 5); frames++; } while (peds.scanning && frames < 500);
      expect(placed(peds)).toEqual(before);
    } finally {
      peds.dispose();
    }
  });
});
