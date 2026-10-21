/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Who lives and works round the camera, for the people walking the streets (pedestrians.ts): the homes, workplaces
// and meeting places on the tiles near it, each resident given the nearest workplace with room, and each worker the
// road between home and work. The renderer only reads the city: nothing here changes it.
//
// It is a job of small steps (scanPeople, a generator): a row of tiles, then a household at a time, each counting its
// work, so the view can do a few thousand of them a frame while the people from the last scan keep walking (a big town
// took 80-500 ms at once). Workplaces are found through squares of tiles nearest first, and lines through their middle
// points' squares, so the answer is the same as looking at every workplace and line in turn, down to the ties.

import {
  BUS_STOP, CIVIC, COMLAST, CZB, FARM_BASE, FARM_LAST,
  FIRESTATION, HARBOUR_BASE, HARBOUR_LAST, HHTHR, HOSPITAL, HOSPITALBASE,
  HOUSE, IND1, LASTIND, LASTTREE, MINE_BASE, MINE_LAST, POLICESTATION,
  RZB, STATION, TREEBASE,
} from '../../tileValues.js';
import { ZONEBIT } from '../../tileFlags.js';
import { readPlotValue } from '../../plots.js';
import type { Point } from '../../roadGeometry.js';
import { tileSeed } from './tileModels.js';

export const MAX_TAKRAW = 8;
const MAX_CHATS = 16;
const MAX_SHOPS = 12;
/** A commute's line: its middle no farther than this from home and on to work, together (world units) */
const LINE_REACH = 160;
/** Workplaces are looked for in squares of this many tiles a side, nearest first */
const WORK_CELL = 4;
/** Road lines are found by their middle point, in squares of this many world units a side */
const LINE_CELL = 80;

export interface RoadLine {
  readonly points: Point[];
  readonly rail: boolean;
  readonly level?: number;
}

export const SHIRT_COLOURS = [
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

export const SPORTS_COLOURS = [
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

export interface StructureInfo {
  readonly kind: 'home' | 'industry' | 'commercial' | 'civic' | 'farm' | 'mine' | 'stop' | 'park';
  readonly level: number;
}

export function getStructureInfo(v: number, flags: number): StructureInfo | null {
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

export interface TakrawCourt {
  readonly cx: number;
  readonly cz: number;
  readonly seed: number;
  readonly angle0: number;
  readonly shirts: readonly [number, number, number];
}

export interface ChatSpot {
  readonly cx: number;
  readonly cz: number;
  readonly angle: number;
  readonly shirtA: number;
  readonly shirtB: number;
}

export interface TransitStopSpot {
  readonly wx: number;
  readonly wz: number;
  readonly heading: number;
  readonly shirt: number;
}

export interface ShopSpot {
  readonly wx: number;
  readonly wz: number;
  readonly heading: number;
  readonly shirt: number;
}

/** What a scan found round one place: who lives and works there, where they meet, and the line each worker walks */
export interface PeopleScan {
  /** The lines it was made for: a worker's lineIdx is in these */
  readonly lines: ReadonlyArray<RoadLine>;
  readonly households: Household[];
  readonly workplaces: Workplace[];
  readonly employed: EmployedCitizen[];
  readonly takrawCourts: TakrawCourt[];
  readonly chatSpots: ChatSpot[];
  readonly transitStops: TransitStopSpot[];
  readonly shopSpots: ShopSpot[];
  /** The workers walking each line, in the order they were found */
  readonly byLine: Map<RoadLine, EmployedCitizen[]>;
  readonly sectors: { readonly industry: number; readonly commercial: number; readonly civic: number; readonly agriculture: number };
}

/** The tiles a scan reads (TileSnapshot) */
export interface ScanTiles {
  readonly width: number;
  readonly height: number;
  readonly values: ArrayLike<number>;
  readonly flags: ArrayLike<number>;
}

/** The scan's count of work: one a tile read, a square of the grids looked into, a workplace or line weighed */
export interface ScanCounter { units: number }

let rngState = 0;
function fastSeed(seed: number): void { rngState = seed >>> 0; }
function fastRng(): number { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; }

/** Every usable road line's middle point (the one `points[length >> 1]`), in squares of LINE_CELL units */
export class LineIndex {
  readonly midX: Float64Array;
  readonly midZ: Float64Array;
  /** Not a railway and at least two points */
  readonly usable: Uint8Array;
  private readonly x0: number;
  private readonly z0: number;
  private readonly cols: number;
  private readonly rows: number;
  /** The lines of each square, by line order: square s holds order[start[s]] to order[start[s + 1] - 1] */
  private readonly start: Int32Array;
  private readonly order: Int32Array;

  constructor(readonly lines: ReadonlyArray<RoadLine>, counter?: ScanCounter) {
    const n = lines.length;
    this.midX = new Float64Array(n); this.midZ = new Float64Array(n); this.usable = new Uint8Array(n);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let l = 0; l < n; l++) {
      const line = lines[l];
      if (line.rail || line.points.length < 2) continue;
      const mid = line.points[Math.floor(line.points.length / 2)];
      this.midX[l] = mid[0]; this.midZ[l] = mid[1]; this.usable[l] = 1;
      x0 = Math.min(x0, mid[0]); z0 = Math.min(z0, mid[1]); x1 = Math.max(x1, mid[0]); z1 = Math.max(z1, mid[1]);
    }
    if (counter) counter.units += n;
    const any = x0 <= x1;
    this.x0 = any ? x0 : 0; this.z0 = any ? z0 : 0;
    this.cols = any ? Math.floor((x1 - x0) / LINE_CELL) + 1 : 0;
    this.rows = any ? Math.floor((z1 - z0) / LINE_CELL) + 1 : 0;
    const cells = this.cols * this.rows;
    this.start = new Int32Array(cells + 1);
    const cellOf = new Int32Array(n).fill(-1);
    for (let l = 0; l < n; l++) {
      if (!this.usable[l]) continue;
      const c = Math.floor((this.midZ[l] - this.z0) / LINE_CELL) * this.cols + Math.floor((this.midX[l] - this.x0) / LINE_CELL);
      cellOf[l] = c; this.start[c + 1]++;
    }
    for (let c = 0; c < cells; c++) this.start[c + 1] += this.start[c];
    this.order = new Int32Array(this.start[cells]);
    const fill = this.start.slice(0, cells);
    for (let l = 0; l < n; l++) if (cellOf[l] >= 0) this.order[fill[cellOf[l]]++] = l;
  }

  /**
   * The line whose middle is nearest home and work together, under LINE_REACH: the same as weighing every line in turn
   * (the first of equals wins), -1 when none is that near
   */
  commuteLine(hx: number, hz: number, wx: number, wz: number, counter: ScanCounter): number {
    // A line under the reach has its middle under it from home and from work along each axis (and a unit more, so no
    // rounding can leave one out)
    const bx0 = Math.max(hx, wx) - LINE_REACH - 1, bx1 = Math.min(hx, wx) + LINE_REACH + 1;
    const bz0 = Math.max(hz, wz) - LINE_REACH - 1, bz1 = Math.min(hz, wz) + LINE_REACH + 1;
    if (bx0 > bx1 || bz0 > bz1 || !this.cols) return -1;
    const c0 = Math.max(0, Math.floor((bx0 - this.x0) / LINE_CELL)), c1 = Math.min(this.cols - 1, Math.floor((bx1 - this.x0) / LINE_CELL));
    const r0 = Math.max(0, Math.floor((bz0 - this.z0) / LINE_CELL)), r1 = Math.min(this.rows - 1, Math.floor((bz1 - this.z0) / LINE_CELL));
    let best = -1, bestScore = Infinity;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cell = r * this.cols + c, end = this.start[cell + 1];
      counter.units++;
      for (let k = this.start[cell]; k < end; k++) {
        const l = this.order[k], mx = this.midX[l], mz = this.midZ[l];
        counter.units++;
        const dHome = Math.hypot(mx - hx, mz - hz);
        const dWork = Math.hypot(mx - wx, mz - wz);
        const score = dHome + dWork;
        if (score < LINE_REACH && (score < bestScore || score === bestScore && l < best)) { bestScore = score; best = l; }
      }
    }
    return best;
  }
}

/** The workplaces with room left, in squares of WORK_CELL tiles over the scan's tiles */
class WorkGrid {
  private readonly cells: number[][];
  private readonly cols: number;
  private readonly rows: number;
  /** Workplaces with room left */
  open = 0;

  constructor(private readonly places: readonly Workplace[], private readonly minTx: number, private readonly minTy: number,
    maxTx: number, maxTy: number) {
    this.cols = Math.max(1, Math.ceil((maxTx - minTx + 1) / WORK_CELL));
    this.rows = Math.max(1, Math.ceil((maxTy - minTy + 1) / WORK_CELL));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    places.forEach((w, i) => { if (w.assignedWorkers < w.capacity) { this.cells[this.cellOf(w.tx, w.ty)].push(i); this.open++; } });
  }

  private cellOf(tx: number, ty: number): number {
    return Math.floor((ty - this.minTy) / WORK_CELL) * this.cols + Math.floor((tx - this.minTx) / WORK_CELL);
  }

  /** A workplace is full: it is looked at no more */
  close(i: number): void {
    const list = this.cells[this.cellOf(this.places[i].tx, this.places[i].ty)], at = list.indexOf(i);
    if (at < 0) return;
    list[at] = list[list.length - 1]; list.pop(); this.open--;
  }

  /**
   * The workplace with room nearest a home, the first of equals by the order they were found (as weighing every
   * workplace in turn gives), -1 when every one is full. Squares are looked into ring by ring round the home's, until
   * the next ring can hold none nearer.
   */
  nearest(h: Household, counter: ScanCounter): number {
    if (this.open === 0) return -1;
    const hx = Math.floor((h.tx - this.minTx) / WORK_CELL), hy = Math.floor((h.ty - this.minTy) / WORK_CELL);
    let best = -1, bestDist = Infinity;
    for (let k = 0; ; k++) {
      // Every tile of a square k rings out is at least (k - 1) squares and a tile away along one axis
      if (k > 0 && bestDist < ((k - 1) * WORK_CELL + 1) * 10) break;
      if (hx - k < 0 && hy - k < 0 && hx + k >= this.cols && hy + k >= this.rows) break;
      const y0 = Math.max(0, hy - k), y1 = Math.min(this.rows - 1, hy + k);
      for (let y = y0; y <= y1; y++) {
        const edge = y === hy - k || y === hy + k;
        // A row on the ring's top or bottom edge is gone over whole, the others only at the ring's two sides
        const step = edge || k === 0 ? 1 : 2 * k;
        for (let x = hx - k; x <= hx + k; x += step) {
          if (x < 0 || x >= this.cols) continue;
          const list = this.cells[y * this.cols + x];
          counter.units++;
          for (let n = 0; n < list.length; n++) {
            const i = list[n], w = this.places[i];
            counter.units++;
            const dist = Math.hypot(w.wx - h.wx, w.wz - h.wz);
            if (dist < bestDist || dist === bestDist && i < best) { bestDist = dist; best = i; }
          }
        }
      }
    }
    return best;
  }
}

/**
 * The scan round (cx, cz), `span` world units each way, over `index`'s lines: a job of small steps, each yielding once
 * done. Its result is the same however its steps are spread over frames.
 */
export function* scanPeople(tiles: ScanTiles, cx: number, cz: number, span: number, index: LineIndex,
  counter: ScanCounter): Generator<void, PeopleScan, void> {
  const minTx = Math.max(1, Math.floor((cx - span) / 10));
  const maxTx = Math.min(tiles.width - 2, Math.ceil((cx + span) / 10));
  const minTy = Math.max(1, Math.floor((cz - span) / 10));
  const maxTy = Math.min(tiles.height - 2, Math.ceil((cz + span) / 10));

  const households: Household[] = [];
  const workplaces: Workplace[] = [];
  const takrawCourts: TakrawCourt[] = [];
  const chatSpots: ChatSpot[] = [];
  const transitStops: TransitStopSpot[] = [];
  const shopSpots: ShopSpot[] = [];

  let workerIdGen = 0;
  let houseIdGen = 0;
  let workIdGen = 0;

  // 1. The tiles, a row a step
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      counter.units++;
      const i = ty * tiles.width + tx;
      const info = getStructureInfo(tiles.values[i], tiles.flags[i]);
      if (!info) continue;

      const seed = tileSeed(tx, ty);
      const wx = (tx + 0.5) * 10;
      const wz = (ty + 0.5) * 10;

      if (info.kind === 'home') {
        households.push({ id: ++houseIdGen, tx, ty, wx, wz, residentCount: Math.max(1, info.level * 2) });
        // Community activities in front of homes: 1 in 6 homes has a takraw court if space permits
        if ((seed % 6 === 0) && takrawCourts.length < MAX_TAKRAW) {
          fastSeed(seed ^ 0xa5a5a5a5);
          takrawCourts.push({
            cx: wx + (fastRng() - 0.5) * 1.5,
            cz: wz + (fastRng() - 0.5) * 1.5,
            seed,
            angle0: fastRng() * Math.PI * 2,
            shirts: [
              SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
              SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
              SPORTS_COLOURS[Math.floor(fastRng() * SPORTS_COLOURS.length)],
            ],
          });
        } else if (seed % 4 === 1 && chatSpots.length < MAX_CHATS) {
          // Chatting neighbors
          fastSeed(seed ^ 0x3c3c3c3c);
          chatSpots.push({
            cx: wx + (fastRng() - 0.5) * 2.0,
            cz: wz + (fastRng() - 0.5) * 2.0,
            angle: fastRng() * Math.PI,
            shirtA: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
            shirtB: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
          });
        }
      } else if (info.kind === 'industry' || info.kind === 'mine') {
        workplaces.push({ id: ++workIdGen, tx, ty, wx, wz, sector: 'industry',
          companyName: THAI_COMPANIES_INDUSTRY[seed % THAI_COMPANIES_INDUSTRY.length], capacity: Math.max(1, info.level * 3), assignedWorkers: 0 });
      } else if (info.kind === 'commercial') {
        workplaces.push({ id: ++workIdGen, tx, ty, wx, wz, sector: 'commercial',
          companyName: THAI_COMPANIES_COMMERCE[seed % THAI_COMPANIES_COMMERCE.length], capacity: Math.max(1, info.level * 2), assignedWorkers: 0 });
        if (seed % 3 === 0 && shopSpots.length < MAX_SHOPS) {
          fastSeed(seed ^ 0x7e7e7e7e);
          shopSpots.push({
            wx: wx + (fastRng() - 0.5) * 2.2,
            wz: wz + (fastRng() - 0.5) * 2.2,
            heading: fastRng() * Math.PI * 2,
            shirt: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)],
          });
        }
      } else if (info.kind === 'civic') {
        workplaces.push({ id: ++workIdGen, tx, ty, wx, wz, sector: 'civic',
          companyName: THAI_COMPANIES_CIVIC[seed % THAI_COMPANIES_CIVIC.length], capacity: 4, assignedWorkers: 0 });
      } else if (info.kind === 'farm') {
        workplaces.push({ id: ++workIdGen, tx, ty, wx, wz, sector: 'agriculture',
          companyName: THAI_COMPANIES_AGRI[seed % THAI_COMPANIES_AGRI.length], capacity: 3, assignedWorkers: 0 });
      } else if (info.kind === 'stop') {
        fastSeed(seed ^ 0x55aa55aa);
        transitStops.push({ wx, wz, heading: (seed % 4) * (Math.PI / 2), shirt: SHIRT_COLOURS[Math.floor(fastRng() * SHIRT_COLOURS.length)] });
      } else if (info.kind === 'park') {
        if (seed % 3 === 0 && takrawCourts.length < MAX_TAKRAW) {
          fastSeed(seed ^ 0x12345678);
          takrawCourts.push({
            cx: wx, cz: wz, seed,
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
    yield;
  }

  // 2. Residents to open workplaces ("คนที่ไปทำงาน ต้อง มีงานจริงๆ นะ"), a household a step, and each worker the road
  // line between home and work
  const grid = new WorkGrid(workplaces, minTx, minTy, maxTx, maxTy);
  const employed: EmployedCitizen[] = [];
  const byLine = new Map<RoadLine, EmployedCitizen[]>();
  const lineOf = new Map<number, number>();
  for (const h of households) {
    fastSeed(tileSeed(h.tx + 7, h.ty + 13));
    lineOf.clear();
    let work = -1;
    for (let r = 0; r < h.residentCount; r++) {
      counter.units++;
      // The nearest workplace with room stays the nearest while it has room: only a full one sends the next resident
      // looking again
      if (work < 0 || workplaces[work].assignedWorkers >= workplaces[work].capacity) work = grid.nearest(h, counter);
      // ... and once none has room, none will for anyone after
      if (work < 0) break;
      const bestWork = workplaces[work];
      bestWork.assignedWorkers++;
      if (bestWork.assignedWorkers >= bestWork.capacity) grid.close(work);
      const name = THAI_CITIZEN_NAMES[(h.id * 3 + r) % THAI_CITIZEN_NAMES.length];
      const shirtColor = bestWork.sector === 'commercial' ? COMMERCE_SHIRTS[(h.id + r) % COMMERCE_SHIRTS.length]
        : bestWork.sector === 'civic' ? CIVIC_SHIRTS[(h.id + r) % CIVIC_SHIRTS.length]
          : INDUSTRY_SHIRTS[(h.id + r) % INDUSTRY_SHIRTS.length];
      let lineIdx = lineOf.get(work);
      if (lineIdx === undefined) { lineIdx = index.commuteLine(h.wx, h.wz, bestWork.wx, bestWork.wz, counter); lineOf.set(work, lineIdx); }
      const worker: EmployedCitizen = { id: ++workerIdGen, name, home: h, workplace: bestWork, shirtColor,
        speedVar: 0.88 + fastRng() * 0.24, lineIdx };
      employed.push(worker);
      if (lineIdx >= 0) {
        const line = index.lines[lineIdx];
        let list = byLine.get(line);
        if (!list) { list = []; byLine.set(line, list); }
        list.push(worker);
      }
    }
    yield;
  }

  // Sector employment totals ("ก็นับด้วยว่าคนทำงาน ในอุตสาหกรรม 1 คน")
  let industry = 0, commercial = 0, civic = 0, agriculture = 0;
  for (const w of employed) {
    if (w.workplace.sector === 'industry') industry++;
    else if (w.workplace.sector === 'commercial') commercial++;
    else if (w.workplace.sector === 'civic') civic++;
    else agriculture++;
  }
  return { lines: index.lines, households, workplaces, employed, takrawCourts, chatSpots, transitStops, shopSpots, byLine,
    sectors: { industry, commercial, civic, agriculture } };
}
