/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A repeatable benchmark of the 3D view over a big town (docs/3d/RENDERER_SPEC.md §8B). Only with `bench` in the page's
// address (index.html?khonkaen&bench) does the view load this file, which puts `phaicityBench` on the page for the
// browser's console or a test driver.
//
// It grows a town of painted plots (homes, shops and factories of mixed levels, with some 2 x 2 lots) round the town
// centre into a stand-in of the map the view reads (benchLand), never into the game's map: the city is not changed and
// nothing of the town can be saved. It then holds the game's own frames, sets the camera, waits until every chunk and
// model has come in and settled, and measures frames it draws itself: triangles and draw calls from the renderer (every
// pass of a frame: the sun's shadows, the city, the lens) and the graphics card's time (gpuTimer.ts). A breakdown takes
// one part of the view out of the frame at a time (by its layer, which nothing else in the view sets) to see what it
// costs. It drives frames itself through a message channel, so it runs in a hidden window too, where the browser
// stops animation frames.

import { BIT_MASK, POWERBIT } from '../../tileFlags.js';
import { LOT_LEVEL, LOT_SIZE, plotTile, zonable, type PlotKind } from '../../plots.js';
import { DIRT, INTERSECTION, LASTRUBBLE, ROADS, ROADS2, RUBBLE, TREEBASE, WOODS2 } from '../../tileValues.js';
import { tileSeed } from './tileModels.js';
import type { CityMapReader } from './types.js';

/** A town grown for measuring: each of its tiles' raw value (tile value and power bit), by index */
export interface BenchTown {
  readonly tiles: Map<number, number>;
  readonly plots: number;
  readonly lots: number;
  readonly centre: { x: number; y: number };
  /** The farthest grown tile from the centre, in tiles */
  readonly radius: number;
  readonly kinds: Record<PlotKind, number>;
  /** Street tiles laid for it, and each road tile's level with them (src/roadLevels.ts) */
  readonly streets: number;
  readonly roadLevels: Uint8Array | null;
}

type BenchMap = CityMapReader & { town?: { x: number; y: number } | null; paintedZones?: boolean };

/** How likely an even 2 x 2 of open land becomes a lot, in hundredths */
const LOT_CHANCE = 12;
/** A street every this many tiles, so the plots three deep either side fill the blocks between (src/plots.ts) */
export const BENCH_STREET_SPACING = 8;
/** The level of the town's streets: asphalt (src/roadLevels.ts) */
const STREET_LEVEL = 2;
const isOpen = (value: number): boolean => value === DIRT || value >= TREEBASE && value < WOODS2 || value >= RUBBLE && value <= LASTRUBBLE;

/**
 * A town of `plots` grown plots on the open land within reach of the roads nearest the map's town centre, the same
 * every time for the same map and seed: shops thicker near the centre, factories toward the edge, homes everywhere,
 * levels 1-4 (factories 1-3) and some lots. Woods painted over are cleared, as painting does. With `streets` (the
 * default) a grid of asphalt streets is laid first over the open land round the centre, as a player lays out a town,
 * so the plots fill whole blocks rather than strung along the map's few real streets.
 */
export function growBenchTown(map: BenchMap, plots = 3000, seed = 1, streets = true): BenchTown {
  const { width, height } = map, centre = map.town ? { x: map.town.x, y: map.town.y } : { x: width >> 1, y: height >> 1 };
  const tiles = new Map<number, number>(), kinds: Record<PlotKind, number> = { residential: 0, commercial: 0, industrial: 0 };
  let streetTiles = 0, roadLevels: Uint8Array | null = null;
  if (streets && plots > 0) {
    // About three plots in four of a block's tiles; the square a little bigger for what is not open land
    const spacing = BENCH_STREET_SPACING, half = Math.ceil(Math.sqrt(plots / .75) / 2 * 1.15 / spacing) * spacing;
    roadLevels = map.roadLevels ? map.roadLevels.slice() : new Uint8Array(width * height);
    const on = (x: number, y: number): boolean => x >= centre.x - half && x <= centre.x + half && y >= centre.y - half && y <= centre.y + half
      && x >= 0 && y >= 0 && x < width && y < height;
    for (let y = centre.y - half; y <= centre.y + half; y++) for (let x = centre.x - half; x <= centre.x + half; x++) {
      if (!on(x, y)) continue;
      const row = (y - centre.y) % spacing === 0, column = (x - centre.x) % spacing === 0;
      if (!row && !column || !isOpen(map.getTileValue(x, y))) continue;
      const i = y * width + x;
      tiles.set(i, row && column ? INTERSECTION : row ? ROADS : ROADS2); roadLevels[i] = STREET_LEVEL; streetTiles++;
    }
  }
  // Every tile by its distance from the centre, a little jittered so the town's edge is not a circle
  const order: number[] = [];
  for (let i = 0; i < width * height; i++) order.push(i);
  const distance = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = (i - x) / width;
    distance[i] = Math.hypot(x - centre.x, y - centre.y) * (1 + (tileSeed(x * 3 + seed, y * 5 - seed) % 1000) / 4000);
  }
  order.sort((a, b) => distance[a] - distance[b]);
  // The map as it reads with the town so far, so a tile is painted once
  const reader = { width, height, paintedZones: map.paintedZones, roadLevels: roadLevels ?? map.roadLevels,
    getTileValue: (x: number, y: number) => { const t = tiles.get(y * width + x); return t === undefined ? map.getTileValue(x, y) : t & BIT_MASK; },
    getTileFlags: (x: number, y: number) => { const t = tiles.get(y * width + x); return t === undefined ? map.getTileFlags(x, y) : t & ~BIT_MASK; } };
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && !tiles.has(y * width + x) && zonable(reader, x, y);
  let grown = 0, lots = 0, radius = 0;
  const put = (x: number, y: number, kind: PlotKind, level: number, value: number, style: number): void => {
    tiles.set(y * width + x, plotTile(kind, level, value, style) | POWERBIT); kinds[kind]++; grown++;
    radius = Math.max(radius, Math.hypot(x - centre.x, y - centre.y));
  };
  for (const i of order) {
    if (grown >= plots) break;
    const x = i % width, y = (i - x) / width;
    if (!open(x, y)) continue;
    const h = tileSeed(x * 7 + seed * 31, y * 13 - seed * 17), share = grown / Math.max(1, plots);
    const roll = h % 100, kind: PlotKind = roll < (share < .25 ? 40 : share < .6 ? 20 : 12) ? 'commercial'
      : roll >= (share > .55 ? 78 : 92) ? 'industrial' : 'residential';
    const value = (h >>> 20) % 4;
    // A lot: four plots of one kind on an even 2 x 2, all open
    if (x % LOT_SIZE === 0 && y % LOT_SIZE === 0 && (h >>> 8) % 100 < LOT_CHANCE && grown + 4 <= plots
      && open(x + 1, y) && open(x, y + 1) && open(x + 1, y + 1)) {
      for (let dy = 0; dy < LOT_SIZE; dy++) for (let dx = 0; dx < LOT_SIZE; dx++) put(x + dx, y + dy, kind, LOT_LEVEL[kind], value, 0);
      lots++;
      continue;
    }
    const top = kind === 'industrial' ? 3 : 4, step = (h >>> 12) % 100;
    // Lower levels are the commonest, as in a growing Thai town
    const level = Math.min(top, step < 38 ? 1 : step < 70 ? 2 : step < 90 ? 3 : 4);
    put(x, y, kind, level, value, (h >>> 4) % 3);
  }
  return { tiles, plots: grown, lots, centre, radius, kinds, streets: streetTiles, roadLevels };
}

/** The map the view reads with a grown town over it, and the era its buildings are drawn in; the map itself untouched */
export function benchLand<T extends CityMapReader>(base: T, town: BenchTown, era: number | null): T {
  const land = Object.create(base) as T, width = base.width, serial = ++lands;
  Object.defineProperty(land, 'getTileValue', { value: (x: number, y: number): number => {
    const t = town.tiles.get(y * width + x); return t === undefined ? base.getTileValue(x, y) : t & BIT_MASK; } });
  Object.defineProperty(land, 'getTileFlags', { value: (x: number, y: number): number => {
    const t = town.tiles.get(y * width + x); return t === undefined ? base.getTileFlags(x, y) : t & ~BIT_MASK; } });
  if (base.rawTileAt) Object.defineProperty(land, 'rawTileAt', { value: (index: number): number => town.tiles.get(index) ?? base.rawTileAt!(index) });
  // ... its count of changes unlike the map's and any earlier town's, so the view goes over the whole map again
  Object.defineProperty(land, 'changeCount', { value: (): number => 1e12 + serial * 1e9 + (base.changeCount?.() ?? 0) });
  if (era !== null) Object.defineProperty(land, 'era', { value: era });
  if (town.roadLevels) Object.defineProperty(land, 'roadLevels', { value: town.roadLevels });
  return land;
}
/** How many towns were laid over a map, so each reads as a change from the last */
let lands = 0;

export interface BenchSample {
  pose: string; plots: number; era: number; quality: string; width: number; height: number; pixelRatio: number;
  drawCalls: number; triangles: number; gpuMs: number | null; cpuMs: number; drawBudget: number; detailCalls: number;
  camera: { distance: number; pitch: number; x: number; z: number };
  /** Whether the models' levels of detail were on (lod.ts), and how many placements were drawn at each level */
  lod: boolean; levels: number[];
}
export interface BenchPart { part: string; drawCalls: number; triangles: number; gpuMs: number | null }
export interface BenchOptions {
  plots?: number; era?: number | null; seed?: number; streets?: boolean; quality?: 'low' | 'medium' | 'high';
  poses?: readonly string[]; frames?: number; breakdown?: boolean; width?: number; height?: number;
  /** Levels of detail on (the default) or off, to measure the city as it was drawn before them */
  lod?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type View = any;

const tick = (): Promise<void> => new Promise(resolve => {
  const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); resolve(); }; channel.port2.postMessage(0);
});
const median = (values: number[]): number => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const HIDDEN_LAYER = 31;

/** The bench on a live view (installBench): `await phaicityBench.run({plots: 3000})`, or `run(...)` and read `status`
 * and `results` while it works */
export class CityBench {
  status = 'idle';
  results: { samples: BenchSample[]; parts: Record<string, BenchPart[]>; town?: Omit<BenchTown, 'tiles' | 'roadLevels'> } = { samples: [], parts: {} };
  private base: CityMapReader;
  private paint: ((hover: null, sprites: null, paused: boolean) => void) | null = null;
  town: BenchTown | null = null;
  /** The processor's time for the last frame's paint, without waiting for the graphics card */
  private paintMs = 0;
  constructor(readonly view: View) { this.base = view.land; }

  /** Holds the game's frames and draws the bench's own instead */
  private hold(): void {
    if (this.paint) return;
    const view = this.view;
    this.paint = view.paint.bind(view);
    view.paint = () => { /* held by the bench */ };
  }
  release(): void {
    if (!this.paint) return;
    delete this.view.paint; this.paint = null;
    this.view.land = this.base; this.view.snapshot.source = this.base;
    this.status = 'released';
  }
  /** One frame, the graphics card done with it before the next so its time is the frame's own */
  private async frame(): Promise<void> {
    const view = this.view;
    view.chunks.drawBudget = view.chunks.maxDrawBudget;
    const start = performance.now();
    this.paint!(null, null, true);
    this.paintMs = performance.now() - start;
    view.renderer.getContext().finish();
    await tick();
  }
  /** Grows the town over the view's map (growBenchTown); 0 plots measures the city as it is */
  grow(plots = 3000, era: number | null = null, seed = 1, streets = true): BenchTown {
    const town = growBenchTown(this.base as BenchMap, plots, seed, streets);
    const land = benchLand(this.base, town, era);
    this.view.land = land; this.view.snapshot.source = land;
    this.town = town;
    return town;
  }
  /** The camera at a pose: `usual` (the starting view over the town centre), `wide` (the whole town), `d<n>` (n units out) */
  pose(name: string): void {
    const n = this.view.navigation, town = this.town;
    n.reset();
    if (name === 'wide' && town) {
      // The whole town on the screen from the usual angle
      n.target.set((town.centre.x + .5) * 10, 0, (town.centre.y + .5) * 10);
      n.distance = Math.max(240, town.radius * 10 * 2.3);
    } else if (/^d\d+$/.test(name)) n.distance = Number(name.slice(1));
    n.update(performance.now());
  }
  /** Frames until no chunk or model is waiting and the detail has stopped changing */
  async settle(limit = 5000): Promise<number> {
    const m = this.view.metrics;
    let still = 0, swaps = -1, frames = 0;
    for (; frames < limit && still < 40; frames++) {
      await this.frame();
      if (m.pendingChunks || m.pendingModels || m.detailSwaps !== swaps) still = 0; else still++;
      swaps = m.detailSwaps;
    }
    return frames;
  }
  async sample(frames: number): Promise<{ drawCalls: number; triangles: number; gpuMs: number | null; cpuMs: number }> {
    const view = this.view, timer = view.gpuTimer;
    timer?.reset();
    const calls: number[] = [], triangles: number[] = [], cpu: number[] = [];
    for (let i = 0; i < frames; i++) {
      await this.frame();
      cpu.push(this.paintMs);
      calls.push(view.metrics.drawCalls); triangles.push(view.metrics.triangles);
    }
    // the timer's answers come a frame or two late
    for (let i = 0; i < 6; i++) { await tick(); timer?.poll(); }
    return { drawCalls: median(calls), triangles: median(triangles), gpuMs: timer?.ms ?? null, cpuMs: +median(cpu).toFixed(2) };
  }
  /**
   * The frame at the camera as it stands with the levels of detail on and off by turns (`rounds` of each, so a machine
   * busy with something else weighs on both alike): the medians of each, and every round's graphics-card time
   */
  async compare(rounds = 3, frames = 40): Promise<Record<'on' | 'off', { drawCalls: number; triangles: number; gpuMs: number | null; cpuMs: number; gpuRounds: (number | null)[] }>> {
    const runs: Record<'on' | 'off', Awaited<ReturnType<CityBench['sample']>>[]> = { on: [], off: [] };
    this.hold();
    for (let r = 0; r < rounds; r++) for (const lod of [true, false]) {
      this.status = `comparing ${lod ? 'on' : 'off'} ${r + 1}/${rounds}`;
      // ... each after the batches have been built again the other way and have settled
      this.view.chunks.lodOn = lod; await this.settle(); for (let i = 0; i < 30; i++) await this.frame();
      runs[lod ? 'on' : 'off'].push(await this.sample(frames));
    }
    this.view.chunks.lodOn = true; await this.frame();
    this.status = 'compared';
    const summary = (list: Awaited<ReturnType<CityBench['sample']>>[]) => {
      const gpu = list.map(s => s.gpuMs).filter((g): g is number => g !== null);
      return { drawCalls: median(list.map(s => s.drawCalls)), triangles: median(list.map(s => s.triangles)),
        gpuMs: gpu.length ? +median(gpu).toFixed(2) : null, cpuMs: +median(list.map(s => s.cpuMs)).toFixed(2),
        gpuRounds: list.map(s => s.gpuMs === null ? null : +s.gpuMs.toFixed(2)) };
    };
    return { on: summary(runs.on), off: summary(runs.off) };
  }
  /** How many buildings the pools drew at each level of detail at their last fill (pools.ts), the shadow's last */
  levels(): number[] {
    const out: number[] = [];
    let shadow = 0;
    for (const pool of this.view.chunks.pools.values()) {
      pool.drawn.forEach((n: number, k: number) => { out[k] = (out[k] ?? 0) + n; });
      shadow += pool.shadowDrawn;
    }
    return [...Array.from(out, n => n ?? 0), shadow];
  }
  /** Each loaded era model's triangles at each level and the levels' errors (the model's metres) */
  models(): Record<string, string> {
    const out: Record<string, string> = {};
    const count = (g: { index: { count: number } | null; attributes: { position: { count: number } } } | null) => g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;
    for (const [key, p] of this.view.chunks.prototypes as Map<string, any>) {
      if (!key.startsWith('era.')) continue;
      const whole = p.parts.reduce((n: number, part: any) => n + count(part.geometry), 0);
      out[key.split('|')[0]] = [String(whole), ...(p.lods ?? []).map((l: any) => `${l.parts.reduce((n: number, g: any) => n + count(g), 0)}@${l.error.toFixed(3)}`)].join(' ');
    }
    return out;
  }
  /** The view's parts the breakdown takes out one at a time */
  private parts(): Record<string, () => unknown[]> {
    const v = this.view, c = v.chunks;
    const batches = (test: (key: string) => boolean) => () =>
      c.chunks.flatMap((chunk: any) => chunk.batches.filter((b: any) => test(b.key)).map((b: any) => b.group));
    const s = c.surfaces;
    return {
      eraBuildings: () => [...batches(k => k.startsWith('era.'))(), ...[...c.pools.values()].map((pool: any) => pool.root)],
      plotModels: batches(k => /^(plot|lot|res|com|ind)\./.test(k)),
      tileRoads: batches(k => /^(road|rail|power)\./.test(k)),
      tileTerrain: batches(k => /^(terrain|veg|shore)/.test(k)),
      otherModels: batches(k => !/^(era|plot|lot|res|com|ind|road|rail|power|terrain|veg|shore)/.test(k)),
      surfaceGround: () => s ? s.chunks.map((x: any) => x.land) : [c.ground, c.water],
      surfaceTrees: () => s ? s.chunks.map((x: any) => x.trees) : [],
      surfaceBoxes: () => s ? s.chunks.map((x: any) => x.buildings) : [c.solid],
      terrainDetail: () => s ? [s.terrainDetail.root] : [],
      roads: () => [v.curves.root],
      foliage: () => [v.foliage.root],
      people: () => [v.pedestrians.root],
      traffic: () => [v.roadTraffic.root, v.buses?.root].filter(Boolean),
      canals: () => [v.canals.root],
      province: () => [v.province?.root].filter(Boolean),
      skyAndWeather: () => [v.sky.mesh, v.weather.root],
      labelsAndOverlays: () => [v.streets?.root, v.cells?.root, v.zones.root, v.outline.root, v.problems?.root, v.sprites.root].filter(Boolean),
    };
  }
  private static layer(roots: unknown[], layer: number): void {
    for (const root of roots) (root as { traverse(f: (o: { layers: { set(n: number): void } }) => void): void }).traverse(o => o.layers.set(layer));
  }
  /** Measures the city with each part taken out in turn: what each costs is the whole frame less the frame without it */
  async breakdown(frames = 30): Promise<BenchPart[]> {
    const whole = await this.sample(frames), out: BenchPart[] = [];
    for (const [part, roots] of Object.entries(this.parts())) {
      const found = roots();
      if (!found.length) continue;
      this.status = `breakdown ${part}`;
      CityBench.layer(found, HIDDEN_LAYER);
      await this.frame(); await this.frame();
      const less = await this.sample(frames);
      CityBench.layer(roots(), 0);
      out.push({ part, drawCalls: whole.drawCalls - less.drawCalls, triangles: whole.triangles - less.triangles,
        gpuMs: whole.gpuMs !== null && less.gpuMs !== null ? +(whole.gpuMs - less.gpuMs).toFixed(2) : null });
    }
    return out;
  }
  /** Grows the town, then measures each pose: the usual camera over the town centre and the whole town ('wide') */
  async run(options: BenchOptions = {}): Promise<CityBench['results']> {
    const { plots = 3000, era = null, seed = 1, streets = true, quality = 'medium', poses = ['usual', 'wide'], frames = 48, breakdown = false,
      width = 1920, height = 1080, lod = true } = options;
    const view = this.view;
    this.results = { samples: [], parts: {} };
    try {
      this.status = 'growing';
      this.hold();
      const container = view.setup.container as HTMLElement;
      container.style.width = `${width}px`; container.style.height = `${height}px`;
      view.setQuality(quality); view.renderer.setPixelRatio(1); view.setDarkMode(false);
      // Levels of detail on or off: a batch built with them turns them on and off at once (CityChunks.lodOn)
      view.chunks.lodOn = lod;
      const town = this.grow(plots, era, seed, streets);
      // ... standing at once, not put up stage by stage as a plot that grows in play is (TileSnapshot.construction)
      const building = view.snapshot.enableConstruction;
      view.snapshot.enableConstruction = false; await this.frame(); view.snapshot.enableConstruction = building;
      this.results.town = { plots: town.plots, lots: town.lots, centre: town.centre, radius: +town.radius.toFixed(1), kinds: town.kinds,
        streets: town.streets };
      for (const pose of poses) {
        this.status = `settling ${pose}`;
        this.pose(pose);
        await this.settle();
        this.status = `measuring ${pose}`;
        const m = await this.sample(frames), n = view.navigation;
        this.results.samples.push({ pose, plots: town.plots, era: era ?? (view.land.era ?? 1), quality, width: view.width, height: view.height,
          pixelRatio: view.renderer.getPixelRatio(), ...m, drawBudget: view.chunks.drawBudget, detailCalls: view.chunks.detailCalls,
          camera: { distance: Math.round(n.distance), pitch: Math.round(n.pitch * 180 / Math.PI), x: Math.round(n.target.x), z: Math.round(n.target.z) },
          lod, levels: this.levels() });
        if (breakdown) this.results.parts[pose] = await this.breakdown(Math.max(24, frames >> 1));
      }
      this.status = 'done';
    } catch (error) {
      this.status = `failed: ${String(error)}`;
    }
    return this.results;
  }
}

/** Puts the bench on the page for this view */
export function installBench(view: View): CityBench {
  const bench = new CityBench(view);
  (globalThis as unknown as { phaicityBench: CityBench }).phaicityBench = bench;
  return bench;
}
