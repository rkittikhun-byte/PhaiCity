/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The canals the player dug (src/canals.ts, docs/CANALS.md), drawn along their smooth lines with each one's level
// (models/water/canal.ts) instead of as river tiles. The rest of the view sees a canal's tiles as plain ground
// (canalLand), so the land under and beside a canal stays level and no river bank or water tile is drawn there; this
// draws the water, the banks and what stands along them. Canals are drawn again only when they change (the map's
// canalsVersion, which digging, filling and every level they rise move) or the ground under them does. Their small
// things (piles, lamps, trees, boats) are instanced, and hidden when the camera is far away.

import { Group, InstancedMesh, Mesh, MeshStandardMaterial, type Material } from 'three';
import { isBridgeTile, isWaterTile } from '../../canals.js';
import { networkOf, roadLines, type Point } from '../../roadGeometry.js';
import { buildCanals, canalDetailParts, cutAround, canalSurfaceMeshes, CANAL_PROVINCE_METRE, type CanalJunction,
  type CanalRun } from '../models/water/canal.js';
import type { CityHeightField } from './heightfield.js';
import type { CityMapReader } from './types.js';

export interface CanalMapReader {
  readonly width: number;
  readonly height: number;
  /** Each tile's canal level, 0 where none was dug (src/canals.ts) */
  readonly canals?: Uint8Array | null;
  readonly canalsVersion?: number;
  getTileValue(x: number, y: number): number;
}

/** Beyond this camera distance (world units) a canal's small things are not drawn */
export const CANAL_DETAIL_DISTANCE = 1400;
/** Where canals meet, how far round the middle (metres) their pad of water reaches: past the widest canal's water */
const PAD_METRES = 5;
/** A plain road tile's value, as the road lines read it (src/roadGeometry.ts isLineRoad) */
const LINE_TILE = 66;
/** Natural woods (src/tileValues.ts TREEBASE … WOODS2 - 1), which the view leaves out beside a canal */
const WOODS_FIRST = 21, WOODS_LAST = 39;

/**
 * The map as the rest of the view sees it: a dug canal's water tiles are plain ground, and so are the woods round a
 * canal, where its banks lie (a slanted canal's reach into the tiles beside it); no paddy or orchard is drawn on either
 * (a real-scale city map's land cover). The map itself keeps its woods; only the view leaves them out.
 */
export function canalLand<T extends CityMapReader>(map: T): T {
  const land = Object.create(map) as T;
  const reader = map as unknown as CanalMapReader & { landCover?: Uint8Array | null };
  // 1 a canal's water tile, 2 a tile beside one; worked out again when the canals change
  let clear: { version: number; mask: Uint8Array } | null = null;
  const maskOf = (): Uint8Array | null => {
    const canals = reader.canals;
    if (!canals) return null;
    const version = reader.canalsVersion ?? 0;
    if (clear && clear.version === version && clear.mask.length === canals.length) return clear.mask;
    const { width, height } = map, mask = new Uint8Array(canals.length);
    for (let i = 0; i < canals.length; i++) {
      if (!canals[i] || !isWaterTile(map.getTileValue(i % width, Math.floor(i / width)))) continue;
      const x = i % width, y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && !mask[ny * width + nx]) mask[ny * width + nx] = 2;
      }
      mask[i] = 1;
    }
    clear = { version, mask };
    return mask;
  };
  Object.defineProperty(land, 'getTileValue', { value: (x: number, y: number): number => {
    const value = map.getTileValue(x, y), mask = maskOf();
    const at = mask ? mask[y * map.width + x] : 0;
    if (!at) return value;
    if (at === 1 && isWaterTile(value)) return 0;
    return value >= WOODS_FIRST && value <= WOODS_LAST ? 0 : value;
  } });
  let cover: { mask: Uint8Array; source: Uint8Array; out: Uint8Array } | null = null;
  Object.defineProperty(land, 'landCover', { get: (): Uint8Array | null | undefined => {
    const source = reader.landCover, mask = maskOf();
    if (!source || !mask) return source;
    if (!cover || cover.mask !== mask || cover.source !== source) {
      const out = source.slice();
      for (let i = 0; i < out.length; i++) if (mask[i]) out[i] = 0;
      cover = { mask, source, out };
    }
    return cover.out;
  } });
  return land;
}

/** Whether a tile is a dug canal or beside one, where no loose tree stands (CityFoliage) */
export function besideCanal(snapshot: { readonly width: number; readonly height: number;
  readonly source?: unknown }, index: number): boolean {
  const canals = (snapshot.source as { canals?: Uint8Array | null } | null | undefined)?.canals;
  if (!canals) return false;
  const { width, height } = snapshot, x = index % width, y = (index - x) / width;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && canals[ny * width + nx]) return true;
  }
  return false;
}

export class CityCanals {
  readonly root = new Group();
  private readonly details = new Group();
  private version = -1;
  /** The water of each colour: matte, so it shows its colour rather than the sky's (the library's is glossy) */
  private readonly waters = new Map<string, MeshStandardMaterial>();

  /** metre: world units a metre on a real-scale city map, null on any other */
  constructor(private readonly map: CanalMapReader, private readonly terrain: CityHeightField,
              private readonly metre: () => number | null) {
    this.root.name = 'canals';
    this.details.name = 'canal_details';
    this.root.add(this.details);
  }

  /** The ground moved: draw them again on it */
  invalidate(): void { this.version = -1; }

  /**
   * Each frame: draw them again when they changed, and their small things only near the camera. Returns the tiles that
   * became or stopped being a canal, which the rest of the view draws again: it sees no tile change there (a canal's
   * tiles read as ground), yet their ground must lose its paddy or orchard, or get it back
   */
  update(distance: number): number[] {
    const version = this.map.canalsVersion ?? 0;
    let changed: number[] = [];
    if (version !== this.version) { this.version = version; changed = this.rebuild(); }
    this.details.visible = distance < CANAL_DETAIL_DISTANCE;
    return changed;
  }

  dispose(): void { this.clear(); this.waters.forEach((material) => material.dispose()); this.waters.clear(); }

  private clear(): void {
    for (const child of [...this.root.children, ...this.details.children]) {
      if (child === this.details) continue;
      // The instanced things share their shapes (canalDetailParts); only the surfaces are this view's own
      if (child instanceof InstancedMesh) child.dispose();
      else if (child instanceof Mesh) child.geometry.dispose();
      child.parent?.remove(child);
    }
  }

  /** Whether a tile is a dug canal's water or a bridge over it */
  private isCanal(i: number): boolean {
    const layer = this.map.canals;
    if (!layer?.[i]) return false;
    const value = this.map.getTileValue(i % this.map.width, Math.floor(i / this.map.width));
    return isWaterTile(value) || isBridgeTile(value);
  }

  /** The tiles that were a canal or beside one when last drawn */
  private drawn = new Uint8Array(0);

  private rebuild(): number[] {
    this.clear();
    const { width, height } = this.map, layer = this.map.canals, count = width * height;
    const canal = new Uint8Array(count), was = this.drawn.length === count ? this.drawn : new Uint8Array(count);
    if (layer) for (let i = 0; i < count; i++) if (layer[i] && this.isCanal(i)) canal[i] = layer[i];
    // The canal's tiles and those round them, whose ground the view draws plain (canalLand)
    const near = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      if (!canal[i]) continue;
      const x = i % width, y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) near[ny * width + nx] = 1;
      }
    }
    const changed: number[] = [];
    for (let i = 0; i < count; i++) if (near[i] !== was[i]) changed.push(i);
    this.drawn = near;
    if (!canal.some((level) => level > 0)) return changed;
    this.draw(canal);
    return changed;
  }

  private draw(canal: Uint8Array): void {
    const { width, height } = this.map, count = width * height, values = new Uint16Array(count);
    for (let i = 0; i < count; i++) if (canal[i]) values[i] = LINE_TILE;
    const network = networkOf({ width, height, value: (i) => values[i], level: () => 1 }, false);
    const { lines } = roadLines(network);
    const m = this.metre() ?? CANAL_PROVINCE_METRE, centres = network.junctions, pad = PAD_METRES * m;
    const tileOf = (p: Point): number => {
      const x = Math.floor(p[0] / 10), y = Math.floor(p[1] / 10);
      return x >= 0 && y >= 0 && x < width && y < height ? y * width + x : -1;
    };
    const levelAt = (p: Point): number => { const i = tileOf(p); return i >= 0 ? canal[i] : 0; };
    // Where a canal's end tile lies beside the land's own water (a river, a lake), it opens into it: its line runs on to
    // the edge they share, where a sluice gate stands
    const riverBeside = (p: Point, way: Point): Point | null => {
      const i = tileOf(p);
      if (i < 0) return null;
      const x = i % width, y = (i - x) / width;
      let best: Point | null = null, bestDot = 0.3;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || canal[ny * width + nx]) continue;
        if (!isWaterTile(this.map.getTileValue(nx, ny))) continue;
        const dot = dx * way[0] + dy * way[1];
        if (dot > bestDot) { bestDot = dot; best = [(x + 0.5 + dx * 0.5) * 10, (y + 0.5 + dy * 0.5) * 10]; }
      }
      return best;
    };
    const runs: CanalRun[] = [], arms = new Map<number, CanalJunction>();
    for (const line of lines) {
      const points = line.points.map((p): Point => [p[0], p[1]]);
      if (points.length < 2) continue;
      const startEdge = riverBeside(points[0], unitOf(points[0], points[1], -1));
      const endEdge = riverBeside(points[points.length - 1], unitOf(points[points.length - 2], points[points.length - 1], 1));
      if (startEdge) points.unshift(startEdge);
      if (endEdge) points.push(endEdge);
      const trimmed = { points, openStart: !!startEdge, openEnd: !!endEdge };
      for (const piece of cutAround(trimmed.points, centres, pad)) {
        const first = piece[0], last = piece[piece.length - 1];
        const nearCentre = (p: Point): number => centres.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) < pad + 0.05);
        const startJ = nearCentre(first), endJ = nearCentre(last);
        const startOpen = trimmed.openStart && first === trimmed.points[0], endOpen = trimmed.openEnd && last === trimmed.points[trimmed.points.length - 1];
        // Runs of one level each, the shortest folded into their neighbours so no tile flickers between two
        const pieceRuns = levelRuns(piece, levelAt);
        pieceRuns[0].capStart = startJ < 0 && !startOpen;
        pieceRuns[0].openStart = startOpen;
        pieceRuns[pieceRuns.length - 1].capEnd = endJ < 0 && !endOpen;
        pieceRuns[pieceRuns.length - 1].openEnd = endOpen;
        runs.push(...pieceRuns);
        for (const [j, end, next, level] of [[startJ, first, piece[1], pieceRuns[0].level],
          [endJ, last, piece[piece.length - 2], pieceRuns[pieceRuns.length - 1].level]] as const) {
          if (j < 0) continue;
          const shape = arms.get(j) ?? { at: centres[j], arms: [] };
          const dx = next[0] - end[0], dz = next[1] - end[1], l = Math.hypot(dx, dz) || 1;
          shape.arms.push({ end, way: [dx / l, dz / l], level });
          arms.set(j, shape);
        }
      }
    }
    const terrain = this.terrain;
    const build = buildCanals(runs, [...arms.values()], {
      metre: m, seed: 7,
      ground: (x, z) => terrain.sample(x, z),
      // No banks under a bridge: its deck lies over the water there
      noBank: (x, z) => { const i = tileOf([x, z]); return i >= 0 && isBridgeTile(this.map.getTileValue(i % width, Math.floor(i / width))); },
    });
    for (const mesh of canalSurfaceMeshes(build, 'canals')) {
      const library = mesh.material as MeshStandardMaterial;
      if (library.name.startsWith('water_river#')) {
        let water = this.waters.get(library.name);
        if (!water) {
          water = new MeshStandardMaterial({ color: library.color, roughness: 0.62, metalness: 0, envMapIntensity: 0.35,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
          this.waters.set(library.name, water);
        }
        mesh.material = water;
      }
      this.root.add(mesh);
    }
    const shapes = canalDetailParts();
    for (const [kind, matrices] of build.details) {
      for (const shape of shapes.get(kind) ?? []) {
        const mesh = new InstancedMesh(shape.geometry, shape.material as Material, matrices.length);
        matrices.forEach((matrix, n) => mesh.setMatrixAt(n, matrix));
        mesh.computeBoundingSphere();
        mesh.name = `canals/${kind}`;
        mesh.castShadow = kind === 'tree' || kind === 'boat' || kind.startsWith('sala') || kind === 'gatePier';
        mesh.receiveShadow = true;
        this.details.add(mesh);
      }
    }
  }
}

/** The way from a to b (sign 1) or from b to a (sign -1), a unit vector */
function unitOf(a: Point, b: Point, sign: 1 | -1): Point {
  const dx = (b[0] - a[0]) * sign, dz = (b[1] - a[1]) * sign, l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

/** A line cut where its level changes, a run kept at least three points long */
function levelRuns(points: readonly Point[], levelAt: (p: Point) => number): CanalRun[] {
  const levels = points.map((p) => levelAt(p));
  // A point off the canal's tiles (where it was cut at a pad's edge) takes its neighbour's level
  for (let k = 0; k < levels.length; k++) if (!levels[k]) levels[k] = levels[k - 1] || levels.find((l) => l > 0) || 1;
  const runs: CanalRun[] = [];
  let start = 0;
  for (let k = 1; k <= points.length; k++) {
    if (k < points.length && levels[k] === levels[start]) continue;
    if (k - start < 3 && runs.length) {
      // Too short: part of the run before it
      const before = runs[runs.length - 1];
      before.points.push(...points.slice(start + 1, k + (k < points.length ? 1 : 0)).map((p): Point => [p[0], p[1]]));
    } else {
      runs.push({ points: points.slice(start, Math.min(points.length, k + 1)).map((p): Point => [p[0], p[1]]), level: levels[start] });
    }
    start = k;
  }
  return runs.length ? runs : [{ points: points.map((p): Point => [p[0], p[1]]), level: levels[0] || 1 }];
}
