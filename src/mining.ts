/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Mines and oil wells (เหมืองและบ่อน้ำมัน, docs/MINING.md; owner, 13 Oct 2026), the third of the province's resources
// to count in the game (docs/PROVINCE_PROFILE.md). Every kind is the same 3 × 3 building (tiles 965–973, centre 969),
// told apart by the map's record of what was dug where (gameMap.mineKinds, saved as mineKinds). A working mine, one
// with power and ore left in the province:
// - brings royalties every month (paid in with the year's taxes) and work (it counts as industry in the census);
// - raises dust (pollution on its tiles), and most kinds poison the ground around them (contamination, 0–255 a
//   tile): cadmium from zinc, cyanide and arsenic from gold, tailings from tin and rare earths, salt from potash;
//   poisoned ground lowers the land's value and spoils the water a water works pumps from it, and stays for years
//   after the mine is gone; an oil well now and then spills;
// - uses up the province's ore: each kind has so many mine-months by its level, shared by all the mines of that kind,
//   so more mines empty it sooner; then they stop, and the news says so.
// No DOM; the only chance (an oil spill) comes through the caller's roll, the simulation's seeded Random.

import { decodePresetLayer, encodePresetLayer } from "./geo/presetMap";
import { POWERBIT } from "./tileFlags";
import { MINE_BASE, MINE_LAST } from "./tileValues";

export const MINE_KINDS = ["limestone", "potash", "tin", "zinc", "gold", "gems", "rareEarth", "lignite", "petroleum"] as const;
export type MineKind = typeof MINE_KINDS[number];

/** The tool that digs each kind (src/gameTools.js) */
export const MINE_TOOLS: Record<MineKind, string> = {
  limestone: "limestone_mine", potash: "potash_mine", tin: "tin_mine", zinc: "zinc_mine", gold: "gold_mine", gems: "gem_mine",
  rareEarth: "rare_earth_mine", lignite: "lignite_mine", petroleum: "oil_well",
};

export function mineKindOfTool(tool: string): MineKind | null {
  return MINE_KINDS.find((kind) => MINE_TOOLS[kind] === tool) ?? null;
}

interface Spec {
  /** Royalties a month at level 3, in baht */
  value: number;
  /** Pollution on each of its tiles: dust, fumes */
  dust: number;
  /** Poison put into the ground under its centre each month (less further out) */
  toxic: number;
  /** Work it gives, as industrial population */
  jobs: number;
  /** The chance a month of a spill */
  spill: number;
}

export const MINE_SPECS: Record<MineKind, Spec> = {
  limestone: { value: 12, dust: 60, toxic: 0, jobs: 2, spill: 0 },
  potash: { value: 20, dust: 30, toxic: 15, jobs: 2, spill: 0 },
  tin: { value: 16, dust: 40, toxic: 20, jobs: 2, spill: 0 },
  zinc: { value: 20, dust: 50, toxic: 40, jobs: 2, spill: 0 },
  gold: { value: 30, dust: 40, toxic: 45, jobs: 2, spill: 0 },
  gems: { value: 18, dust: 30, toxic: 5, jobs: 1, spill: 0 },
  rareEarth: { value: 45, dust: 50, toxic: 50, jobs: 2, spill: 0 },
  lignite: { value: 16, dust: 70, toxic: 10, jobs: 3, spill: 0 },
  petroleum: { value: 40, dust: 20, toxic: 0, jobs: 1, spill: 0.01 },
};

/** Mine-months of ore a province holds per level of a kind */
export const MINE_MONTHS_PER_LEVEL = 60;
/** What a practice map, which is no province, has to dig, at level 2 */
const PRACTICE_KINDS: readonly MineKind[] = ["limestone", "tin", "gold", "petroleum"];
const PRACTICE_LEVEL = 2;
/** How far poison spreads from a mine, and from a spill */
export const TOXIC_RADIUS = 5;
const SPILL_POISON = 200;
const SPILL_RADIUS = 4;

export type Resources = Readonly<Record<string, number>>;

/** A kind's level in this province, 0–5; a practice map has a few kinds at level 2. */
export function mineLevel(kind: MineKind, resources: Resources): number {
  if (Object.keys(resources).length === 0) return PRACTICE_KINDS.includes(kind) ? PRACTICE_LEVEL : 0;
  const level = resources[kind];
  return typeof level === "number" ? Math.max(0, Math.min(5, Math.round(level))) : 0;
}

export function canDig(kind: MineKind, resources: Resources): boolean {
  return mineLevel(kind, resources) >= 1;
}

/** Royalties a working mine brings a month, in baht. */
export function mineValue(kind: MineKind, resources: Resources): number {
  return Math.round(MINE_SPECS[kind].value * (0.6 + 0.2 * mineLevel(kind, resources)));
}

/** The province's ore when a city starts: mine-months by kind. */
export function startingReserves(resources: Resources): Record<string, number> {
  const reserves: Record<string, number> = {};
  for (const kind of MINE_KINDS) {
    const level = mineLevel(kind, resources);
    if (level > 0) reserves[kind] = level * MINE_MONTHS_PER_LEVEL;
  }
  return reserves;
}

/** A mine's kind as the map records it at its centre tile; one without a record is limestone. */
export function mineKindAt(kinds: Readonly<Record<string, string>> | null | undefined, index: number): MineKind {
  const kind = kinds?.[String(index)];
  return (MINE_KINDS as readonly string[]).includes(kind ?? "") ? kind as MineKind : "limestone";
}

/** Poison spread into the ground: amount at (x, y), less further out, as far as radius. */
export function poison(ground: Uint8Array, width: number, height: number, x: number, y: number, amount: number,
    radius = TOXIC_RADIUS): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const tx = x + dx;
      const ty = y + dy;
      if (distance > radius || tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      const i = ty * width + tx;
      ground[i] = Math.min(255, ground[i] + Math.round(amount * (radius + 1 - distance) / (radius + 1)));
    }
  }
}

/** A month of the ground slowly cleaning itself: poison halves in about seven years. */
export function cleanse(ground: Uint8Array): void {
  for (let i = 0; i < ground.length; i++) {
    if (ground[i] > 0) ground[i] -= Math.max(1, Math.floor(ground[i] / 120));
  }
}

export interface WorkingMine {
  x: number;
  y: number;
  kind: MineKind;
}

export interface MiningMonth {
  /** Royalties the working mines brought */
  income: number;
  /** Kinds whose ore ran out this month, with a mine of each */
  exhausted: WorkingMine[];
  /** Oil wells that spilled */
  spills: WorkingMine[];
}

/**
 * A month of the province's mines: royalties, ore used up, poison spread, spills. reserves and ground are changed in
 * place. roll(n) gives a whole number from 0 to n − 1 (the simulation's Random).
 */
export function miningMonth(mines: readonly WorkingMine[], resources: Resources, reserves: Record<string, number>,
    ground: Uint8Array, width: number, height: number, roll: (n: number) => number): MiningMonth {
  const result: MiningMonth = { income: 0, exhausted: [], spills: [] };
  cleanse(ground);
  for (const mine of mines) {
    if (!(reserves[mine.kind] > 0)) continue;
    const spec = MINE_SPECS[mine.kind];
    result.income += mineValue(mine.kind, resources);
    reserves[mine.kind] -= 1;
    if (reserves[mine.kind] <= 0) {
      reserves[mine.kind] = 0;
      result.exhausted.push(mine);
    }
    if (spec.toxic > 0) poison(ground, width, height, mine.x, mine.y, spec.toxic);
    if (spec.spill > 0 && roll(Math.round(1 / spec.spill)) === 0) {
      poison(ground, width, height, mine.x, mine.y, SPILL_POISON, SPILL_RADIUS);
      result.spills.push(mine);
    }
  }
  return result;
}

interface MapLike {
  readonly width: number;
  readonly height: number;
  getTileFlags(x: number, y: number): number;
  mineKinds?: Record<string, string>;
}

interface CensusLike {
  indPop: number;
  mineCount?: number;
}

/** A city's mines: the ore left in the province, the poisoned ground, and the working mines this cycle's scan found. */
export class Mining {
  reserves: Record<string, number> = {};
  /** Poison in the ground, 0–255 a tile, row by row */
  ground: Uint8Array;
  mines: WorkingMine[] = [];
  private started = false;

  constructor(private readonly width: number, private readonly height: number, private resources: Resources = {}) {
    this.ground = new Uint8Array(width * height);
  }

  /** The province's ore as a new city finds it, unless a save brought what is left. */
  start(resources: Resources): void {
    this.resources = resources;
    if (!this.started) this.reserves = startingReserves(resources);
    this.started = true;
  }

  save(saveData: Record<string, unknown>): void {
    saveData.mining = { reserves: { ...this.reserves }, ground: encodePresetLayer(this.ground) };
  }

  load(saveData: Record<string, unknown>): void {
    const saved = saveData.mining as { reserves?: Record<string, number>; ground?: string } | undefined;
    if (!saved || typeof saved !== "object") return;
    this.reserves = {};
    for (const [kind, left] of Object.entries(saved.reserves ?? {})) {
      if ((MINE_KINDS as readonly string[]).includes(kind) && typeof left === "number" && left >= 0) this.reserves[kind] = left;
    }
    if (typeof saved.ground === "string") {
      try {
        this.ground = decodePresetLayer(saved.ground, this.width, this.height);
      } catch (e) {
        // A broken layer only forgets the poison
      }
    }
    this.started = true;
  }

  clearCycle(): void {
    this.mines = [];
  }

  /** The map scan reached a mine's centre: with power and ore left, it works, and gives work. */
  mineFound(map: MapLike, x: number, y: number, simData: { census: CensusLike }): void {
    const kind = mineKindAt(map.mineKinds, y * map.width + x);
    if ((map.getTileFlags(x, y) & POWERBIT) === 0 || !(this.reserves[kind] > 0)) return;
    simData.census.indPop += MINE_SPECS[kind].jobs;
    simData.census.mineCount = (simData.census.mineCount ?? 0) + 1;
    this.mines.push({ x, y, kind });
  }

  month(roll: (n: number) => number): MiningMonth {
    return miningMonth(this.mines, this.resources, this.reserves, this.ground, this.width, this.height, roll);
  }

  /** Pollution added to a tile (src/blockMapUtils.js): a mine's dust on its own tiles, and the poison in the ground. */
  pollutionAt(map: MapLike, x: number, y: number, tileValue: number): number {
    let pollution = Math.floor(this.ground[y * this.width + x] / 8);
    if (tileValue >= MINE_BASE && tileValue <= MINE_LAST) {
      const index = tileValue - MINE_BASE;
      const centre = (y - Math.floor(index / 3) + 1) * map.width + (x - (index % 3) + 1);
      pollution += MINE_SPECS[mineKindAt(map.mineKinds, centre)].dust;
    }
    return pollution;
  }

  /** How much of the water pumped at (x, y) is fit to use, 0.2–1: poisoned ground spoils it. */
  cleanWater(x: number, y: number): number {
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        sum += this.ground[ty * this.width + tx];
        count++;
      }
    }
    return count ? 1 - 0.8 * sum / count / 255 : 1;
  }
}
