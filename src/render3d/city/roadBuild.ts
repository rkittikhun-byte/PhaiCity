/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The shapes of the roads and railways on the ground, which RoadCurves (roadCurves.ts) shows: from the map's tiles,
// the lines of src/roadGeometry.ts as ribbons, the patches of their junctions, their bends and their ends, as plain
// arrays a mesh takes (owner, 19 Oct 2026: the game stalled each time something was built). Each line, bend, junction
// and end is built once and kept, so a change builds again only what it touched; each corner of a ribbon is shared by
// the triangles round it. It only reads what it is given, so it runs in a Web Worker (road-worker.ts) as well as on
// the page, and never writes the map.
import { Color, Euler, Matrix4, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { lateriteColour, LATERITE_EDGE } from '../models/road/laterite.js';
import { RAIL_INTERFACE } from '../models/road/interfaces.js';
import { halfWidth, nearestOnLines, REAL_WIDTH_M, roadReach, shoulderOf, type JunctionArm, type JunctionShape, type Point } from '../../roadGeometry.js';
import { junctionLayout } from './roadJunctions.js';
import { drawnRoads, type GraphLines } from '../../roads/graphLines.js';
import type { CityMapReader } from './types.js';

const LIFT = 0.15, OUTSIDE_SHADE = 0.62;
/** A road's end under the road it meets, and the shoulders round a junction's corners. */
export const UNDER_LIFT = 0.13;
const CORNER_LIFT = 0.145;
/** A junction's patch (node): well over the roads' surfaces and their lines, which it covers, as the ground under it
 * bends at the tiles' edges where neither follows it exactly; under the crossings and rings painted on it */
const NODE_LIFT = 0.185, NODE_PAINT_LIFT = NODE_LIFT + 0.009;
/** ... laid in triangles no longer than this a side (world units), so it follows the ground */
const NODE_STEP = 1.5;
/** ... the share of the way out from its middle that is all its own colour, before it shades into its roads' */
const NODE_INNER = 0.55;
/** How far along each road a junction measures the way it leaves (world units) */
const NODE_ARM = 6;
/** A railway's sleeper (metres: across the track, high, along it) and the height of its top over the ground */
export const SLEEPER_SIZE = [2, 0.1, 0.26] as const;
const SLEEPER_TOP = 0.35;
/** ... the least half width of a rail (world units), wider than a real one so it shows from the game's camera */
const RAIL_MIN_HALF = 0.06;
/**
 * A laterite road's surface across it, as its gallery model has it (models/road/laterite.ts): by the model's distance
 * from the middle (0 … LATERITE_EDGE), how far over or under the road's lift it lies (world units): a sunlit crown,
 * two wheel tracks worn into it, a low ridge beside them and the edge falling away (owner, 18 Oct 2026: "เพิ่มรายละเอียด
 * 3D (ผิวนูน กรวด ไหล่ทาง) ให้ถนนโค้งและจุดแยกในเกม"). Its crown stays under a junction's patch (NODE_LIFT).
 */
const LATERITE_RELIEF: readonly (readonly [number, number])[] = [[0, 0.025], [0.4, 0.021], [0.8, 0.002], [1.1, -0.022],
  [1.45, -0.022], [1.8, -0.005], [2.1, 0.004], [2.7, -0.003], [3.2, -0.012], [LATERITE_EDGE, -0.018]];
/** ... past its edge a dusty shoulder this share of its half width, sloping down to just over the land */
const LATERITE_SHOULDER = 0.24, SHOULDER_LIFT = 0.04;
/** A laterite road's two wheel tracks: their middle and half their width, as the model's distance from its middle */
const RUT_MIDDLE = 1.275, RUT_HALF = 0.2;
/** ... over a junction's patch, the tracks of cars turning from one road into the next, and of those going straight on,
 * this much of the way from the patch's colour to the tracks' own at their middle (at the roads they are the tracks') */
const TURN_WEAR = 0.5, STRAIGHT_WEAR = 0.8;
/** Two roads meeting end to end at a corner turn on a bend this many times the wider one's reach along each */
const BEND_REACH = 1.6;
/** The laterite's own scanned grain (Poly Haven red_laterite_soil_stones) repeats every 2 m */
const DIRT_REPEAT_M = 2;
/** Loose gravel on the shoulders, between these distances from the middle (the model's, as LATERITE_RELIEF), about
 * one stone each this share of the road's half width along it */
const GRAVEL_FROM = 2.3, GRAVEL_TO = 3.9, GRAVEL_STEP = 0.4;

/** A colour as its three channels (linear, as a mesh's vertex colours are) */
type Rgb = readonly [number, number, number];
const rgb = (hex: number): Rgb => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const laterite = (distance: number): Rgb => { const c = lateriteColour(distance); return [c.r, c.g, c.b]; };
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SHOULDER_DUST = rgb(0xb7a07a), BALLAST = rgb(0x5d564d), BALLAST_EDGE = rgb(0x6b6357);
const ASPHALT = rgb(0x4b4f50), CONCRETE = rgb(0x8f8d86), SHOULDER = rgb(0xb5aea0), CURB = rgb(0x746f65);
const YELLOW_PAINT = rgb(0xe2bc52), WHITE_PAINT = rgb(0xebe6d8), CURB_STONE = rgb(0xd8d2c5), ISLAND_GRASS = rgb(0x4d8a44);
const surfaceOf = (level: number): Rgb => (level > 2 ? CONCRETE : ASPHALT);

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

/** The way a drawn line leaves a point on or near it, measured dist along it on the side `towards` points to */
function leaving(line: readonly Point[], from: Point, towards: Point, dist: number): Point {
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

function lengthOf(line: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return length;
}

/** Whether a line's end lies on one of the stops */
const stopsAt = (p: Point, stops: readonly Point[]): boolean => stops.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 0.5);

/** A line run on straight past each end that lies on one of the stops, by that much, so it stops square there */
function stopSquare(line: Point[], stops: readonly Point[], by: number): Point[] {
  if (line.length < 2 || by <= 0) return line;
  const out = [...line];
  for (const last of [false, true]) {
    const i = last ? out.length - 1 : 0, j = last ? out.length - 2 : 1;
    if (!stopsAt(out[i], stops)) continue;
    const dx = out[i][0] - out[j][0], dz = out[i][1] - out[j][1], l = Math.hypot(dx, dz) || 1;
    const past: Point = [out[i][0] + dx / l * by, out[i][1] + dz / l * by];
    if (last) out.push(past); else out.unshift(past);
  }
  return out;
}

/** A point of the curve from a through b to c (a quadratic Bezier), t from 0 to 1 */
function quadratic(a: Point, b: Point, c: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

/** A point of the curve from a to d, leaving a towards b and coming into d from c (a cubic Bezier), t from 0 to 1 */
function cubic(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
}

/** A short name for a list of numbers, the same for the same numbers (to a thousandth), to know a piece again */
function keyOf(prefix: string, values: readonly number[]): string {
  let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < values.length; i++) {
    const q = Math.round(values[i] * 1024) | 0;
    h1 = Math.imul(h1 ^ q, 16777619);
    h2 = (Math.imul(h2, 33) + q) | 0;
  }
  return `${prefix}${values.length}:${(h1 >>> 0).toString(36)}:${(h2 >>> 0).toString(36)}`;
}
const flatten = (points: readonly Point[]): number[] => {
  const out: number[] = [];
  for (const [x, z] of points) out.push(x, z);
  return out;
};

/** The ground's height and the province's edge, which the roads lie on: the 3D view's height field, or its copy */
export interface HeightSource {
  sampleTile(ix: number, iy: number, x: number, z: number): number;
  inside(x: number, y: number): boolean;
}

/** The height field's numbers (heightfield.ts grid), sent to a worker */
export interface HeightGrid {
  width: number;
  height: number;
  enabled: boolean;
  pads: Float32Array;
  corners: Float32Array;
  mask: Uint8Array | null;
}

/** The height field's own sampling (heightfield.ts sampleTile, inside) from its numbers */
export class GridHeights implements HeightSource {
  constructor(readonly grid: HeightGrid) {}
  private corner(x: number, y: number): number {
    const { width, height, corners } = this.grid;
    return corners[Math.max(0, Math.min(height, y)) * (width + 1) + Math.max(0, Math.min(width, x))];
  }
  sampleTile(ix: number, iy: number, x: number, z: number): number {
    if (!this.grid.enabled) return 0;
    const u = Math.max(0, Math.min(1, x / 10 - ix)), v = Math.max(0, Math.min(1, z / 10 - iy));
    const flat = this.grid.pads[iy * this.grid.width + ix];
    if (Number.isFinite(flat)) return flat;
    const a = this.corner(ix, iy), b = this.corner(ix + 1, iy), c = this.corner(ix, iy + 1), d = this.corner(ix + 1, iy + 1);
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d);
  }
  inside(x: number, y: number): boolean {
    return !this.grid.mask || this.grid.mask[y * this.grid.width + x] !== 0;
  }
}

/**
 * The ground's height there, as the far ground draws its tile (province-surface.ts ground): four triangles round the
 * tile's middle, so a twisted tile's ground does not rise through the road
 */
export function groundHeight(heights: HeightSource, width: number, height: number, x: number, z: number): number {
  const tx = Math.max(0, Math.min(width - 1, Math.floor(x / 10))), tz = Math.max(0, Math.min(height - 1, Math.floor(z / 10)));
  return blendTile(tileSamples(heights, tx, tz), Math.max(0, Math.min(1, x / 10 - tx)), Math.max(0, Math.min(1, z / 10 - tz)));
}

/** A tile's ground at its middle and its four corners (north-west, north-east, south-east, south-west) */
function tileSamples(heights: HeightSource, tx: number, tz: number): readonly number[] {
  const x0 = tx * 10, z0 = tz * 10;
  return [heights.sampleTile(tx, tz, x0 + 5, z0 + 5), heights.sampleTile(tx, tz, x0, z0), heights.sampleTile(tx, tz, x0 + 10, z0),
    heights.sampleTile(tx, tz, x0 + 10, z0 + 10), heights.sampleTile(tx, tz, x0, z0 + 10)];
}

/** The ground at (u, v) across a tile (0 to 1 each way) from its samples: on the triangle from its middle to the edge
 * the point faces */
function blendTile(h: readonly number[], u: number, v: number): number {
  // The triangle's two corners, as places across the tile and as samples
  let ax: number, az: number, bx: number, bz: number, ha: number, hb: number;
  if (v <= u && v <= 1 - u) { ax = 0; az = 0; bx = 1; bz = 0; ha = h[1]; hb = h[2]; }
  else if (u >= v && u >= 1 - v) { ax = 1; az = 0; bx = 1; bz = 1; ha = h[2]; hb = h[3]; }
  else if (v >= u && v >= 1 - u) { ax = 1; az = 1; bx = 0; bz = 1; ha = h[3]; hb = h[4]; }
  else { ax = 0; az = 1; bx = 0; bz = 0; ha = h[4]; hb = h[1]; }
  // Barycentric weights of the point in the triangle (middle, a, b)
  const d = (az - 0.5) * (bx - 0.5) - (ax - 0.5) * (bz - 0.5) || 1;
  const wa = ((v - 0.5) * (bx - 0.5) - (u - 0.5) * (bz - 0.5)) / d;
  const wb = ((u - 0.5) * (az - 0.5) - (v - 0.5) * (ax - 0.5)) / d;
  return h[0] + wa * (ha - h[0]) + wb * (hb - h[0]);
}

/** What the roads are built from: the map's tiles and the roads' levels, pieces and paths */
export interface RoadMap {
  width: number;
  height: number;
  values: Uint16Array;
  levels: Uint8Array | null;
  pieces: Uint16Array | null;
  paths: CityMapReader['roadPaths'];
  /** World units a metre on a real-scale city map (src/roadGeometry.ts realUnits), null on any other */
  realUnits: number | null;
  /** Only these tiles (x0, y0, x1, y1) have roads, the rest of values being none (src/roadGeometry.ts LineMap area) */
  area?: readonly [number, number, number, number];
  /** The roads and railways as drawn (src/roads/graphLines.ts, docs/METRE_DRAWING_PLAN.md 1.4), drawn exactly from
   * the map's road and rail graphs; their own tiles are left out of the lines read from the tiles */
  graph?: GraphLines | null;
  railGraph?: GraphLines | null;
}

/** A mesh's arrays: its corners, which way each faces, its triangles, and its corners' colours and texture places */
export interface MeshData {
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  color: Float32Array | null;
  uv: Float32Array | null;
}

/** The roads and railways as built: their lines, the three meshes, and the gravel's and sleepers' places (16 numbers
 * each, as a Matrix4's), with how many pieces were built and how many kept from before, and where each piece lies in
 * them */
export interface RoadBuild {
  lines: Array<{ points: Point[]; rail: boolean; level: number }>;
  road: MeshData | null;
  dirt: MeshData | null;
  rails: MeshData | null;
  gravel: Float32Array;
  sleepers: Float32Array;
  built: number;
  reused: number;
  pieces: PieceIndex;
}

/** Where each line, bend, junction and end of a build lies, so the page can hide some of them until the next build
 * (roadCurves.ts sketch): each piece's key, its bounds (minX, maxX, minZ, maxZ), and PIECE_RANGE numbers a piece: for
 * the road, dirt and rails meshes its first index, its count of indices, its first corner and its count of corners,
 * then its first gravel stone and their count, and its first sleeper and their count */
export interface PieceIndex {
  keys: string[];
  bounds: Float32Array;
  ranges: Int32Array;
}
export const PIECE_RANGE = 16;

/** Every array a build holds, to hand it to the page without copying */
export function transferablesOf(build: RoadBuild): ArrayBuffer[] {
  const out: ArrayBuffer[] = [build.gravel.buffer as ArrayBuffer, build.sleepers.buffer as ArrayBuffer,
    build.pieces.bounds.buffer as ArrayBuffer, build.pieces.ranges.buffer as ArrayBuffer];
  for (const mesh of [build.road, build.dirt, build.rails]) {
    if (!mesh) continue;
    for (const array of [mesh.position, mesh.normal, mesh.index, mesh.color, mesh.uv]) if (array) out.push(array.buffer as ArrayBuffer);
  }
  return out;
}

/** What the page asks the road worker for (road-worker.ts): the map to build from, the ground's numbers when they
 * changed since it last sent them, and the tiles whose ground moved under some road; quiet, only to have the pieces
 * ready for the next request, with no build sent back (the page has just built the same) */
export interface RoadRequest {
  id: number;
  map: RoadMap;
  grid: HeightGrid | null;
  invalidate: number[];
  quiet?: boolean;
}

/** ... and what it answers: the build, or why there is none */
export interface RoadReply {
  id: number;
  build: RoadBuild | null;
  error: string | null;
}

/** A worker's side: its builder, keeping the pieces between requests, and the ground's numbers last sent */
export class RoadWorkerState {
  private readonly builder = new RoadBuilder();
  private heights: GridHeights | null = null;

  handle(request: RoadRequest): { reply: RoadReply; transfer: ArrayBuffer[] } {
    try {
      if (request.grid) this.heights = new GridHeights(request.grid);
      if (!this.heights) throw new Error('no ground sent');
      this.builder.invalidate(request.invalidate, request.map.width);
      if (request.quiet) {
        this.builder.pieces(request.map, this.heights);
        return { reply: { id: request.id, build: null, error: null }, transfer: [] };
      }
      const build = this.builder.build(request.map, this.heights);
      return { reply: { id: request.id, build, error: null }, transfer: transferablesOf(build) };
    } catch (error) {
      return { reply: { id: request.id, build: null, error: String(error) }, transfer: [] };
    }
  }
}

/** One mesh of a piece, being written: its corners (and their colours) and its triangles */
class Part {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly index: number[] = [];
  minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
  get count(): number { return this.position.length / 3; }
  vertex(x: number, y: number, z: number, colour: Rgb, shade: number): number {
    this.position.push(x, y, z);
    this.color.push(colour[0] * shade, colour[1] * shade, colour[2] * shade);
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (z < this.minZ) this.minZ = z;
    if (z > this.maxZ) this.maxZ = z;
    return this.count - 1;
  }
  /** Its arrays, each corner facing the average of its triangles' ways, its texture place by x and z when repeat */
  finish(coloured: boolean, repeat: number | null): MeshData | null {
    if (!this.index.length) return null;
    const position = Float32Array.from(this.position), index = Uint32Array.from(this.index), normal = new Float32Array(position.length);
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      // As three.js computeVertexNormals: (c - b) x (a - b)
      const cbx = position[c] - position[b], cby = position[c + 1] - position[b + 1], cbz = position[c + 2] - position[b + 2];
      const abx = position[a] - position[b], aby = position[a + 1] - position[b + 1], abz = position[a + 2] - position[b + 2];
      const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
      for (const v of [a, b, c]) { normal[v] += nx; normal[v + 1] += ny; normal[v + 2] += nz; }
    }
    for (let v = 0; v < normal.length; v += 3) {
      const l = Math.hypot(normal[v], normal[v + 1], normal[v + 2]);
      if (l > 0) { normal[v] /= l; normal[v + 1] /= l; normal[v + 2] /= l; } else normal[v + 1] = 1;
    }
    let uv: Float32Array | null = null;
    if (repeat) {
      uv = new Float32Array(position.length / 3 * 2);
      for (let v = 0, u = 0; v < position.length; v += 3, u += 2) { uv[u] = position[v] / repeat; uv[u + 1] = position[v + 2] / repeat; }
    }
    return { position, normal, index, color: coloured ? Float32Array.from(this.color) : null, uv };
  }
}

/** One line, bend, junction or end, built: what it was built from (its key: L a line, R a railway, B a bend, J a
 * junction, l and r a lone tile's), its meshes' arrays, its gravel and sleepers, and where it lies */
export interface Piece {
  key: string;
  road: MeshData | null;
  dirt: MeshData | null;
  rails: MeshData | null;
  gravel: Float32Array;
  sleepers: Float32Array;
  minX: number; maxX: number; minZ: number; maxZ: number;
}

/** Joins the pieces' gravel or sleepers, 16 numbers a place, into one array */
function joinPlaces(lists: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(lists.reduce((sum, list) => sum + list.length, 0));
  let at = 0;
  for (const list of lists) { out.set(list, at); at += list.length; }
  return out;
}

/**
 * The build of these pieces: their meshes joined, and where each piece lies in them (PieceIndex)
 */
export function assemble(lines: RoadBuild['lines'], pieces: readonly Piece[], built: number, reused: number): RoadBuild {
  const ranges = new Int32Array(pieces.length * PIECE_RANGE), bounds = new Float32Array(pieces.length * 4);
  const meshes = (['road', 'dirt', 'rails'] as const).map((kind, k) => {
    let indices = 0, corners = 0;
    pieces.forEach((piece, n) => {
      const data = piece[kind], at = n * PIECE_RANGE + k * 4;
      ranges[at] = indices; ranges[at + 2] = corners;
      if (!data) return;
      ranges[at + 1] = data.index.length; ranges[at + 3] = data.position.length / 3;
      indices += data.index.length; corners += data.position.length / 3;
    });
    return merge(pieces.map((piece) => piece[kind]));
  });
  let stones = 0, sleepers = 0;
  pieces.forEach((piece, n) => {
    const at = n * PIECE_RANGE;
    ranges[at + 12] = stones; ranges[at + 13] = piece.gravel.length / 16; stones += piece.gravel.length / 16;
    ranges[at + 14] = sleepers; ranges[at + 15] = piece.sleepers.length / 16; sleepers += piece.sleepers.length / 16;
    bounds.set([piece.minX, piece.maxX, piece.minZ, piece.maxZ], n * 4);
  });
  return {
    lines, built, reused, road: meshes[0], dirt: meshes[1], rails: meshes[2],
    gravel: joinPlaces(pieces.map((p) => p.gravel)), sleepers: joinPlaces(pieces.map((p) => p.sleepers)),
    pieces: { keys: pieces.map((p) => p.key), bounds, ranges },
  };
}

/** Joins the pieces' arrays of one mesh into one, each piece's triangles counted on from the pieces before it */
function merge(parts: ReadonlyArray<MeshData | null>): MeshData | null {
  const present = parts.filter((part): part is MeshData => part !== null);
  if (!present.length) return null;
  let corners = 0, triangles = 0;
  for (const part of present) { corners += part.position.length; triangles += part.index.length; }
  const position = new Float32Array(corners), normal = new Float32Array(corners), index = new Uint32Array(triangles);
  const color = present[0].color ? new Float32Array(corners) : null, uv = present[0].uv ? new Float32Array(corners / 3 * 2) : null;
  let at = 0, ti = 0;
  for (const part of present) {
    position.set(part.position, at); normal.set(part.normal, at);
    if (color && part.color) color.set(part.color, at);
    if (uv && part.uv) uv.set(part.uv, at / 3 * 2);
    const base = at / 3;
    for (let i = 0; i < part.index.length; i++) index[ti + i] = part.index[i] + base;
    at += part.position.length; ti += part.index.length;
  }
  return { position, normal, index, color, uv };
}

/**
 * Builds the roads and railways from the map, keeping each line, bend, junction and end it built, by what it was built
 * from, to give back again while those stay the same (owner, 19 Oct 2026: "อยากจะปรับ graphic ให้มันลื่นขึ้น").
 */
export class RoadBuilder {
  private cache = new Map<string, Piece>();
  /** The real-scale units the kept pieces were built for */
  private units: number | null | undefined = undefined;
  // What the build in hand is reading and writing
  private map!: RoadMap;
  private heights!: HeightSource;
  private roadPart = new Part();
  private dirtPart = new Part();
  private railPart = new Part();
  private gravel: number[] = [];
  private sleepers: number[] = [];

  /** World units a metre of a road's or a railway's cross-section: 1 on a map of 10 m tiles, less on a real-scale
   * city map's (owner, 15 Oct 2026: roads their real width, src/roadGeometry.ts) */
  private get metre(): number { return Math.min(1, this.map.realUnits ?? 1); }
  /** How much narrower a laterite road is drawn than its tile model's profile (models/road/laterite.ts) */
  private get lateriteShare(): number {
    const units = this.map.realUnits;
    return units ? REAL_WIDTH_M[1] / 2 * units / LATERITE_EDGE : 1;
  }

  /** The ground under these tiles moved: the pieces lying over them are built again next time */
  invalidate(tiles: readonly number[], width: number): void {
    if (!tiles.length) return;
    const boxes = tiles.map((i) => [(i % width) * 10, Math.floor(i / width) * 10]);
    for (const [key, piece] of this.cache) {
      if (boxes.some(([x, z]) => x <= piece.maxX && x + 10 >= piece.minX && z <= piece.maxZ && z + 10 >= piece.minZ)) this.cache.delete(key);
    }
  }

  build(map: RoadMap, heights: HeightSource): RoadBuild {
    const { lines, pieces, built, reused } = this.pieces(map, heights);
    return assemble(lines, pieces, built, reused);
  }

  /**
   * The pieces of the map's roads and railways, each once, and their lines. prune false keeps the pieces built before
   * that this map has not (for building bits of a map, roadCurves.ts sketch), else only this map's are kept.
   */
  pieces(map: RoadMap, heights: HeightSource, prune = true): { lines: RoadBuild['lines']; pieces: Piece[]; built: number; reused: number } {
    this.map = map; this.heights = heights; this.samples.clear();
    if (map.realUnits !== this.units) { this.cache.clear(); this.units = map.realUnits; }
    const used = new Map<string, Piece>(), out: Piece[] = [], lines: RoadBuild['lines'] = [];
    let built = 0, reused = 0;
    // Each piece once, by what it is built from
    const piece = (key: string, draw: () => void): void => {
      let done = used.get(key) ?? this.cache.get(key);
      if (done) reused++;
      else { done = this.draw(draw); done.key = key; built++; }
      if (!used.has(key)) { used.set(key, done); out.push(done); }
    };
    const { width, height } = map;
    for (const rail of [false, true]) {
      // The roads as drawn (the graph) where there are any, and the lines read from the tiles on the rest of the map,
      // one road where it runs on through a junction, the others ending at it (src/roads/graphLines.ts drawnRoads)
      const drawn = drawnRoads({ width, height, value: (i) => map.values[i], level: (i) => map.levels?.[i] ?? 1,
        piece: (i) => map.pieces?.[i] ?? 0, path: (p) => map.paths?.[p] ?? null, area: map.area },
        rail ? map.railGraph : map.graph, rail);
      const { plates, points: junctions } = drawn;
      const stops: Point[] = plates.map(([x, z]): Point => [x, z]);
      if (rail) {
        const by = RAIL_INTERFACE.ballastWidth / 2 * this.metre;
        // A railway that ends at a junction runs on into it a little, so the tracks meeting there overlap and fill it
        for (const { points: line, level } of drawn.lines) {
          if (line.length > 1) for (const [end, before] of [[0, 1], [line.length - 1, line.length - 2]] as const) {
            if (!junctions.some(([x, z]) => Math.hypot(x - line[end][0], z - line[end][1]) < 2)) continue;
            const [ex, ez] = line[end], [bx, bz] = line[before], length = Math.hypot(ex - bx, ez - bz) || 1, reach = 1.6 * this.metre;
            const past: Point = [ex + (ex - bx) / length * reach * 0.6, ez + (ez - bz) / length * reach * 0.6];
            if (end === 0) line.unshift(past); else line.push(past);
          }
          lines.push({ points: line, rail, level });
          const whole = stopSquare(line, stops, by);
          piece(keyOf('R', [by, ...flatten(whole)]), () => this.rail(whole));
        }
      } else {
        // Where a road ends at a junction with a road running through it, its end lies under that road
        const under = new Map<string, number>();
        for (const junction of drawn.junctions) {
          if (junction.through === null) continue;
          const reach = roadReach(drawn.lines[junction.through].level, map.realUnits);
          const along = junction.arms.find((arm) => arm.end === null)!.way;
          for (const arm of junction.arms) if (arm.end !== null) {
            const sine = Math.abs(along[0] * arm.way[1] - along[1] * arm.way[0]);
            under.set(`${arm.line}:${arm.end}`, reach / Math.max(0.35, sine) + 0.3);
          }
        }
        // Where two roads drawn one after another meet end to end at a corner (src/roadPieces.ts), not going on along
        // each other's way, each stops short of it and a bend of its own joins them, its wheel tracks and lines turning
        // with it (owner, 18 Oct 2026: no round plate laid on the corner)
        const cut = new Map<string, number>(), bends: Array<{ at: Point; arms: JunctionArm[] }> = [];
        for (const junction of drawn.junctions) {
          const { arms } = junction;
          if (arms.length !== 2 || junction.smooth || arms.some((arm) => arm.end === null)) continue;
          const reach = Math.max(...arms.map((arm) => roadReach(drawn.lines[arm.line].level, map.realUnits)));
          const along = Math.min(BEND_REACH * reach, ...arms.map((arm) => lengthOf(drawn.lines[arm.line].points) * 0.45));
          for (const arm of arms) cut.set(`${arm.line}:${arm.end}`, along);
          bends.push({ at: junction.at, arms });
        }
        // Where a road stops (a dead end, or a junction only it reaches) it runs on past its tile's middle as far as it
        // reaches either side and stops square (owner, 18 Oct 2026: "เอาวงกลมที่ปลายถนนออก")
        for (const junction of drawn.junctions) if (junction.arms.length === 1) stops.push(junction.at);
        const ends = new Map<string, Point>(), lineKeys: string[] = [];
        drawn.lines.forEach(({ points: line, level }, n) => {
          lines.push({ points: line, rail, level });
          lineKeys.push(keyOf('', flatten(line)));
          const reach = roadReach(level, map.realUnits);
          const cutStart = cut.get(`${n}:0`) ?? 0, cutEnd = cut.get(`${n}:1`) ?? 0;
          const kept = cutStart || cutEnd ? splitEnds(line, cutStart, cutEnd)[1] : line;
          if (kept.length < 2) return;
          ends.set(`${n}:0`, kept[0]); ends.set(`${n}:1`, kept[kept.length - 1]);
          const whole = stopSquare(kept, stops, reach);
          const underStart = under.get(`${n}:0`) ?? 0, underEnd = under.get(`${n}:1`) ?? 0;
          piece(keyOf('L', [level, underStart, underEnd, ...flatten(whole)]), () => {
            const [start, main, finish] = splitEnds(whole, underStart, underEnd);
            for (const part of [start, finish]) if (part.length > 1) this.road(part, level, UNDER_LIFT, false);
            if (main.length > 1) this.road(main, level);
          });
        });
        for (const { at, arms } of bends) {
          const [a, b] = arms, from = ends.get(`${a.line}:${a.end}`), to = ends.get(`${b.line}:${b.end}`);
          if (!from || !to) continue;
          const levelA = drawn.lines[a.line].level, levelB = drawn.lines[b.line].level;
          piece(keyOf('B', [...at, ...from, ...to, levelA, levelB]), () => this.bend(at, from, to, levelA, levelB));
        }
        for (const junction of drawn.junctions) {
          if (junction.arms.length < 3) continue;
          const numbers = [...junction.at, junction.through ?? -1];
          for (const arm of junction.arms) numbers.push(arm.end ?? -1, ...arm.way, drawn.lines[arm.line].level);
          piece(keyOf('J', numbers) + junction.arms.map((arm) => lineKeys[arm.line]).join('|'),
            () => this.junction(junction, drawn.lines));
        }
      }
      // A lone tile, which no line reaches: a short stretch of its road or railway across it, ending square
      for (const [x, z, level] of plates) {
        if (lines.some(({ points, rail: other }) => other === rail &&
          [points[0], points[points.length - 1]].some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.5))) continue;
        const half = rail ? RAIL_INTERFACE.ballastWidth / 2 * this.metre : roadReach(level, map.realUnits);
        const stub: Point[] = [[x - half, z], [x + half, z]];
        piece(keyOf(rail ? 'r' : 'l', [x, z, level]), () => { if (rail) this.rail(stub); else this.road(stub, level); });
      }
    }
    // Only what this map still has is kept for next time
    if (prune) this.cache = used;
    else for (const [key, done] of used) this.cache.set(key, done);
    return { lines, pieces: out, built, reused };
  }

  /** Builds one piece: whatever draw writes into fresh parts, finished as arrays */
  private draw(draw: () => void): Piece {
    this.roadPart = new Part(); this.dirtPart = new Part(); this.railPart = new Part(); this.gravel = []; this.sleepers = [];
    draw();
    const parts = [this.roadPart, this.dirtPart, this.railPart];
    const bound = (pick: (p: Part) => number, fallback: number[], best: (...n: number[]) => number): number =>
      best(...parts.map(pick).filter(Number.isFinite), ...fallback);
    const extra: number[][] = [[], [], [], []];
    for (const list of [this.gravel, this.sleepers]) for (let i = 0; i < list.length; i += 16) { extra[0].push(list[i + 12]); extra[1].push(list[i + 14]); }
    return {
      key: '', road: this.roadPart.finish(true, null), dirt: this.dirtPart.finish(true, DIRT_REPEAT_M * this.metre),
      rails: this.railPart.finish(false, null), gravel: Float32Array.from(this.gravel), sleepers: Float32Array.from(this.sleepers),
      minX: bound((p) => p.minX, extra[0], Math.min) - 1, maxX: bound((p) => p.maxX, extra[0], Math.max) + 1,
      minZ: bound((p) => p.minZ, extra[1], Math.min) - 1, maxZ: bound((p) => p.maxZ, extra[1], Math.max) + 1,
    };
  }

  /** Each tile's ground samples this build has needed (tileSamples), so a tile's ground is read once, not at every
   * corner of the ribbons lying on it */
  private samples = new Map<number, readonly number[]>();

  private height(x: number, z: number): number {
    const { width, height } = this.map;
    const tx = Math.max(0, Math.min(width - 1, Math.floor(x / 10))), tz = Math.max(0, Math.min(height - 1, Math.floor(z / 10)));
    let h = this.samples.get(tz * width + tx);
    if (!h) { h = tileSamples(this.heights, tx, tz); this.samples.set(tz * width + tx, h); }
    return blendTile(h, Math.max(0, Math.min(1, x / 10 - tx)), Math.max(0, Math.min(1, z / 10 - tz)));
  }

  /** Outside the province the land, and the roads on it, are shaded darker */
  private shade(x: number, z: number): number {
    const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
    const inside = tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height || this.heights.inside(tx, ty);
    return inside ? 1 : OUTSIDE_SHADE;
  }

  /** A band along the line: columns at the given offsets across it, each with its colour and lifted over the ground by
   * its own height; each corner shared by the triangles round it */
  private band(part: Part, line: readonly Point[], offsets: readonly number[], colours: readonly Rgb[], lifts: readonly number[]): void {
    const columns = offsets.length, base = part.count;
    for (let i = 0; i < line.length; i++) {
      const [px, pz] = line[i], [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / length, nz = (bx - ax) / length;
      for (let k = 0; k < columns; k++) {
        const x = px + nx * offsets[k], z = pz + nz * offsets[k];
        part.vertex(x, this.height(x, z) + lifts[k], z, colours[k], this.shade(x, z));
      }
    }
    for (let i = 1; i < line.length; i++) for (let k = 1; k < columns; k++) {
      const a = base + (i - 1) * columns + k - 1, b = a + 1, c = base + i * columns + k - 1, d = c + 1;
      part.index.push(a, b, c, b, d, c);
    }
  }

  /** A triangle lying on the ground, lifted (each corner by as much), facing up whichever way round its corners come,
   * each corner its colour */
  private triangle(part: Part, corners: readonly [Point, Point, Point], colours: readonly [Rgb, Rgb, Rgb], lifts: readonly [number, number, number]): void {
    const [a, b, c] = corners;
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    for (const k of up >= 0 ? [0, 1, 2] : [0, 2, 1]) {
      const [x, z] = corners[k];
      part.index.push(part.vertex(x, this.height(x, z) + lifts[k], z, colours[k], this.shade(x, z)));
    }
  }

  private flat(part: Part, corners: readonly [Point, Point, Point], colour: Rgb, lift: number): void {
    this.triangle(part, corners, [colour, colour, colour], [lift, lift, lift]);
  }

  /** A triangle split across its longest side until none is longer than NODE_STEP, so it follows the ground */
  private fine(part: Part, corners: [Point, Point, Point], colours: [Rgb, Rgb, Rgb], lift: number, depth = 0): void {
    const sides = [0, 1, 2].map((k) => Math.hypot(corners[(k + 1) % 3][0] - corners[k][0], corners[(k + 1) % 3][1] - corners[k][1]));
    const k = sides.indexOf(Math.max(...sides));
    if (sides[k] <= NODE_STEP || depth > 8) { this.triangle(part, corners, colours, [lift, lift, lift]); return; }
    const a = corners[k], b = corners[(k + 1) % 3], c = corners[(k + 2) % 3], ca = colours[k], cb = colours[(k + 1) % 3], cc = colours[(k + 2) % 3];
    const m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cm = mix(ca, cb, 0.5);
    this.fine(part, [a, m, c], [ca, cm, cc], lift, depth + 1);
    this.fine(part, [m, b, c], [cm, cb, cc], lift, depth + 1);
  }

  private road(line: Point[], level: number, lift = LIFT, stripe = true): void {
    if (level <= 1) {
      this.laterite(line, lift, !stripe);
      return;
    }
    const units = this.map.realUnits, half = halfWidth(level, units), side = shoulderOf(units), cWidth = 0.12 * this.metre;
    const offsets = [-half - side, -half - cWidth, -half, half, half + cWidth, half + side];
    const colours = offsets.map((d) => {
      const ad = Math.abs(d);
      return ad > half + cWidth + 0.005 ? SHOULDER : ad > half + 0.005 ? CURB : surfaceOf(level);
    });
    this.band(this.roadPart, line, offsets, colours, offsets.map(() => lift));
    // Its centre line and lane dividers, not under the road it meets ("just one more lane": 2, 4, 6, 8 lanes)
    if (!stripe) return;
    const width = 0.08 * this.metre, paint = level >= 4 ? YELLOW_PAINT : WHITE_PAINT;
    this.band(this.roadPart, line, [-width, width], [paint, paint], [lift + 0.01, lift + 0.01]);
    if (level >= 4) {
      const lanesPerDir = level >= 6 ? 4 : level === 5 ? 3 : 2, lw = 0.055 * this.metre;
      for (let lane = 1; lane < lanesPerDir; lane++) {
        const laneOffset = (half * lane) / lanesPerDir;
        for (const centre of [-laneOffset, laneOffset]) {
          this.band(this.roadPart, line, [centre - lw, centre + lw], [WHITE_PAINT, WHITE_PAINT], [lift + 0.01, lift + 0.01]);
        }
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
    const colours = offsets.map((d) => (Math.abs(d) > e + 1e-6 ? SHOULDER_DUST : laterite(Math.abs(d) / k)));
    const lifts = offsets.map((d) => (Math.abs(d) > e + 1e-6 ? SHOULDER_LIFT : lift + (under ? reliefAt(LATERITE_EDGE) : reliefAt(Math.abs(d) / k))));
    this.band(this.dirtPart, line, offsets, colours, lifts);
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

  private readonly matrix = new Matrix4();
  private readonly turn = new Quaternion();
  private readonly euler = new Euler();
  private readonly place = new Vector3();
  private readonly size = new Vector3();

  /** One stone, a flattened pebble of a size and a turn its seed picks, lying at (x, z) that far over the ground */
  private stone(x: number, z: number, lift: number, seed: number, m: number): void {
    const size = (0.8 + 0.8 * scatter(seed + 5.3)) * m;
    this.turn.setFromEuler(this.euler.set(0, scatter(seed + 7.9) * Math.PI, (scatter(seed + 9.2) - 0.5) * 0.6));
    this.matrix.compose(this.place.set(x, this.height(x, z) + lift + 0.015 * size, z), this.turn, this.size.set(0.16 * size, 0.08 * size, 0.12 * size));
    this.gravel.push(...this.matrix.elements);
  }

  /**
   * Two roads drawn one after another meeting end to end at a corner: from where each was cut short of it, one bend
   * through the corner, as the road would be built, its wheel tracks, lines and shoulders turning with it; of each
   * road's own level up to its middle
   */
  private bend(at: Point, from: Point, to: Point, levelA: number, levelB: number): void {
    const steps = 16, points: Point[] = [];
    for (let i = 0; i <= steps; i++) points.push(quadratic(from, at, to, i / steps));
    if (levelA === levelB) { this.road(points, levelA); return; }
    this.road(points.slice(0, steps / 2 + 1), levelA);
    this.road(points.slice(steps / 2), levelB);
  }

  private rail(line: Point[]): void {
    // Dark ballast, so the light sleepers and the steel on it read as a railway, not a pale path (owner, 18 Oct 2026:
    // the track beside the crossing on the Khon Kaen map was taken for a footpath)
    const m = this.metre, half = RAIL_INTERFACE.ballastWidth / 2 * m;
    const offsets = [-half, -1.2 * m, 1.2 * m, half];
    this.band(this.roadPart, line, offsets, offsets.map((d) => (Math.abs(d) > 1.21 * m ? BALLAST_EDGE : BALLAST)), offsets.map(() => LIFT));
    // The two rails, standing up off the sleepers with their sides, at least RAIL_MIN_HALF wide so they still show on a
    // real-scale map, where a metre-gauge rail is a few centimetres of a 16 m tile
    const gauge = (RAIL_INTERFACE.gauge + RAIL_INTERFACE.railWidth) / 2 * m, rail = Math.max(RAIL_INTERFACE.railWidth / 2 * m, RAIL_MIN_HALF);
    const foot = SLEEPER_TOP * m, head = Math.max(RAIL_INTERFACE.headY * m, foot + 2 * rail);
    for (const side of [-1, 1]) {
      const left = side * gauge - rail, right = side * gauge + rail;
      this.band(this.railPart, line, [left - 1e-4, left, right, right + 1e-4], [BALLAST, BALLAST, BALLAST, BALLAST], [foot, head, head, foot]);
    }
    // Sleepers every RAIL_INTERFACE.sleeperSpacing along it
    const up = new Vector3(0, 1, 0), size = new Vector3(m, m, m), spacing = RAIL_INTERFACE.sleeperSpacing * m;
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      this.turn.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax) + Math.PI / 2);
      for (let s = carry; s < length; s += spacing) {
        const x = ax + (bx - ax) * s / length, z = az + (bz - az) * s / length;
        this.matrix.compose(this.place.set(x, this.height(x, z) + (SLEEPER_TOP - SLEEPER_SIZE[1] / 2) * m, z), this.turn, size);
        this.sleepers.push(...this.matrix.elements);
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
  private junction(drawnJunction: JunctionShape, lines: ReadonlyArray<{ level: number; points: Point[] }>): void {
    // ... where its roads really cross (crossingOf), each leaving it the way its line as drawn does
    const junction = this.crossingOf(drawnJunction, lines);
    const { at, arms } = junction, units = this.map.realUnits;
    const maxLevel = Math.max(...arms.map((arm) => lines[arm.line].level));
    const layout = junctionLayout(at, arms.map((arm) => ({ points: lines[arm.line].points, way: arm.way,
      half: lines[arm.line].level <= 1 ? LATERITE_EDGE * this.lateriteShare : halfWidth(lines[arm.line].level, units) })), this.metre);
    this.node(junction, lines, layout);
    // Trafficity-style Automatic Roundabout (วงเวียนอัตโนมัติ) only at true 4+ way intersections where at least 3 arms are paved
    const pavedArms = arms.filter((arm) => lines[arm.line].level >= 2).length;
    if (arms.length >= 4 && pavedArms >= 3 && maxLevel >= 3) {
      const maxReach = Math.max(...arms.map((arm) => roadReach(lines[arm.line].level, units)));
      this.roundabout(at[0], at[1], maxReach, maxLevel);
    }
    // Zebra crosswalks (ทางม้าลาย) on paved urban roads meeting at a junction (levels 2–6)
    const m = this.metre;
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
        this.flat(this.roadPart, [p0, p1, p2], WHITE_PAINT, NODE_PAINT_LIFT);
        this.flat(this.roadPart, [p0, p2, p3], WHITE_PAINT, NODE_PAINT_LIFT);
      }
    }
  }

  /**
   * A junction's middle as one patch over the roads meeting there (owner, 18 Oct 2026: "จุดแยกของถนน มันควรจะมี
   * graphic ที่สวยงามกว่านี้"): each road's carriageway out past where the others cross it, the corners between roads
   * next to each other rounded, so no road's wheel tracks, lines or kerbs run on across the others. A laterite
   * junction shades from its crown in the middle to each road's own colours where the road leaves it, with the wheel
   * tracks turning through it; a paved one is its widest road's surface, with a kerb along each rounded corner.
   */
  private node(junction: JunctionShape, lines: ReadonlyArray<{ level: number; points: Point[] }>, layout: ReturnType<typeof junctionLayout>): void {
    const { at, arms } = junction, units = this.map.realUnits, n = arms.length, m = this.metre;
    const levels = arms.map((arm) => lines[arm.line].level), maxLevel = Math.max(...levels), paved = maxLevel > 1;
    // A laterite junction is the laterite roads' own dirt
    const part = paved ? this.roadPart : this.dirtPart;
    const half = levels.map((level) => (level <= 1 ? LATERITE_EDGE * this.lateriteShare : halfWidth(level, units)));
    const surface = paved ? surfaceOf(maxLevel) : laterite(0.6);
    const { mouths, corners } = layout;
    // Its outline round the junction, each point in its colour: across each road where the patch ends (a laterite
    // road's shades across it), then round the corner to the next road
    const outline: Array<[Point, Rgb]> = [];
    arms.forEach((arm, k) => {
      const mouth = mouths[k], h = half[k], [lx, lz] = mouth.normal, level = lines[arm.line].level;
      const across = level > 1 ? [-1, 0, 1] : [-1, -0.7, -0.35, 0, 0.35, 0.7, 1];
      for (const o of across) outline.push([[mouth.at[0] + lx * h * o, mouth.at[1] + lz * h * o],
        level > 1 ? surfaceOf(level) : laterite(Math.abs(o) * LATERITE_EDGE)]);
      const edgeA = level > 1 ? surfaceOf(level) : laterite(LATERITE_EDGE);
      const nextLevel = levels[(k + 1) % n], edgeB = nextLevel > 1 ? surfaceOf(nextLevel) : laterite(LATERITE_EDGE);
      for (const p of corners[k].points.slice(1, -1)) outline.push([p.at, mix(edgeA, edgeB, p.fraction)]);
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
        this.fine(part, face.map((i) => outline[i][0]) as [Point, Point, Point], face.map((i) => outline[i][1]) as [Rgb, Rgb, Rgb], NODE_LIFT);
      }
    } else for (let k = 0; k < outline.length; k++) {
      const next = (k + 1) % outline.length, [p, cp] = outline[k], [q, cq] = outline[next];
      this.fine(part, [at, inner[k], inner[next]], [surface, surface, surface], NODE_LIFT);
      this.fine(part, [inner[k], p, q], [surface, cp, cq], NODE_LIFT);
      this.fine(part, [inner[k], q, inner[next]], [surface, cq, surface], NODE_LIFT);
    }
    // The same edge samples drive the shoulder and kerb. Their width tapers to zero at a dirt
    // approach instead of drawing a hard kerb or a rectangular shoulder across its wheel tracks.
    for (let k = 0; k < n; k++) {
      const sideA = levels[k] > 1 ? shoulderOf(units) : 0, sideB = levels[(k + 1) % n] > 1 ? shoulderOf(units) : 0;
      const points = corners[k].points;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const wa = sideA + (sideB - sideA) * a.fraction, wb = sideA + (sideB - sideA) * b.fraction;
        if (wa + wb < 0.001) continue;
        const offset = (p: typeof a, w: number): Point => [p.at[0] + p.normal[0] * w, p.at[1] + p.normal[1] * w];
        const ai = offset(a, Math.min(0.12 * m, wa)), bi = offset(b, Math.min(0.12 * m, wb));
        const ao = offset(a, wa), bo = offset(b, wb);
        this.flat(part, [a.at, b.at, bi], CURB, NODE_LIFT + 0.001);
        this.flat(part, [a.at, bi, ai], CURB, NODE_LIFT + 0.001);
        this.flat(part, [ai, bi, bo], SHOULDER, NODE_LIFT + 0.001);
        this.flat(part, [ai, bo, ao], SHOULDER, NODE_LIFT + 0.001);
      }
    }
    if (paved) return;
    this.tracks(layout);
    // A laterite junction's rounded corners fall away into the dusty shoulder its roads have, gravel lying along them
    const edge = laterite(LATERITE_EDGE);
    for (let k = 0; k < n; k++) {
      const points = corners[k].points, widthAt = (p: typeof points[number]): number =>
        LATERITE_SHOULDER * (half[k] + (half[(k + 1) % n] - half[k]) * p.fraction);
      const offset = (p: typeof points[number], w: number): Point => [p.at[0] + p.normal[0] * w, p.at[1] + p.normal[1] * w];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], ao = offset(a, widthAt(a)), bo = offset(b, widthAt(b));
        this.triangle(part, [a.at, b.at, bo], [edge, edge, SHOULDER_DUST], [NODE_LIFT, NODE_LIFT, SHOULDER_LIFT]);
        this.triangle(part, [a.at, bo, ao], [edge, SHOULDER_DUST, SHOULDER_DUST], [NODE_LIFT, SHOULDER_LIFT, SHOULDER_LIFT]);
      }
      points.forEach((p, i) => {
        const seed = p.at[0] * 12.9898 + p.at[1] * 78.233 + i, share = scatter(seed) * 1.3 - 0.3;
        const [x, z] = offset(p, widthAt(p) * share);
        this.stone(x, z, share <= 0 ? NODE_LIFT : NODE_LIFT + (SHOULDER_LIFT + 0.01 - NODE_LIFT) * share, seed, m);
      });
    }
  }

  /**
   * The wheel tracks over a laterite junction's patch (owner, 18 Oct 2026: "ร่องล้อเลี้ยวผ่านแยก"): from each road to
   * the next round it, the tracks of the cars turning there, the inner wheels' tighter than the outer's, and across to a
   * road straight opposite, the tracks of those going on; each leaves its road where that road's own tracks end, in their
   * colour, and wears lighter over the middle where fewer wheels run
   */
  private tracks(layout: ReturnType<typeof junctionLayout>): void {
    const { mouths } = layout, n = mouths.length, k = this.lateriteShare;
    const middle = RUT_MIDDLE * k, half = RUT_HALF * k * 1.15, patch = laterite(0.6), rut = laterite(RUT_MIDDLE);
    const at = (m: typeof mouths[number], offset: number): Point =>
      [m.at[0] + m.normal[0] * offset, m.at[1] + m.normal[1] * offset];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = mouths[i], B = mouths[j], straight = A.way[0] * B.way[0] + A.way[1] * B.way[1] < -0.8;
      if (!straight && j !== i + 1 && !(i === 0 && j === n - 1)) continue;
      // The side of each road the other lies on: the inner wheels' track joins those, the outer wheels' the far sides;
      // going straight on, a track keeps to its side of the road
      const sideA = Math.sign(A.normal[0] * B.way[0] + A.normal[1] * B.way[1]) || 1;
      const sideB = Math.sign(B.normal[0] * A.way[0] + B.normal[1] * A.way[1]) || 1;
      for (const s of [1, -1]) {
        const offA = straight ? s * middle : s * sideA * middle, offB = straight ? -s * middle : s * sideB * middle;
        const p = at(A, offA), q = at(B, offB), reach = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.42;
        const c1: Point = [p[0] - A.way[0] * reach, p[1] - A.way[1] * reach], c2: Point = [q[0] - B.way[0] * reach, q[1] - B.way[1] * reach];
        const line: Point[] = [];
        for (let t = 0; t <= 14; t++) line.push(cubic(p, c1, c2, q, t / 14));
        const wear = straight ? STRAIGHT_WEAR : TURN_WEAR;
        this.track(line, half, (t) => mix(patch, rut, 1 - (1 - wear) * Math.sin(Math.PI * t)), NODE_LIFT + 0.002);
      }
    }
  }

  /** A strip along a line, half wide either side, its colour by how far along it (0 to 1), lying in the dirt */
  private track(line: Point[], half: number, colourAt: (along: number) => Rgb, lift: number): void {
    const part = this.dirtPart;
    for (let i = 1; i < line.length; i++) {
      const edge = (k: number): [Point, Point] => {
        const [ax, az] = line[Math.max(0, k - 1)], [bx, bz] = line[Math.min(line.length - 1, k + 1)];
        const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * half, nz = (bx - ax) / l * half;
        return [[line[k][0] + nx, line[k][1] + nz], [line[k][0] - nx, line[k][1] - nz]];
      };
      const [a0, a1] = edge(i - 1), [b0, b1] = edge(i), ca = colourAt((i - 1) / (line.length - 1)), cb = colourAt(i / (line.length - 1));
      this.triangle(part, [a0, a1, b0], [ca, ca, cb], [lift, lift, lift]);
      this.triangle(part, [a1, b1, b0], [ca, cb, cb], [lift, lift, lift]);
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

  /** A Trafficity-style circular roundabout island and ring carriageway at a major intersection. */
  private roundabout(cx: number, cz: number, maxReach: number, level: number): void {
    const rOuter = maxReach * 1.28, rCarriage = maxReach * 1.08, rIslandCurb = maxReach * 0.46, rIslandGrass = maxReach * 0.36;
    const rings: Array<[number, number, Rgb, number]> = [
      [rCarriage, rOuter, SHOULDER, CORNER_LIFT + 0.002],
      [rIslandCurb, rCarriage, surfaceOf(level), NODE_LIFT + 0.003],
      [rCarriage * 0.92, rCarriage * 0.96, WHITE_PAINT, NODE_PAINT_LIFT],
      [rIslandGrass, rIslandCurb, CURB_STONE, NODE_LIFT + 0.04],
      [0, rIslandGrass, ISLAND_GRASS, NODE_LIFT + 0.07],
    ];
    const n = 24, part = this.roadPart, shade = this.shade(cx, cz);
    for (const [r0, r1, colour, lift] of rings) {
      const corner = (r: number, angle: number): number => {
        const x = cx + Math.cos(angle) * r, z = cz + Math.sin(angle) * r;
        return part.vertex(x, this.height(x, z) + lift, z, colour, shade);
      };
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        const p0 = corner(r0, a0), p1 = corner(r0, a1), p2 = corner(r1, a0), p3 = corner(r1, a1);
        part.index.push(p0, p1, p2, p1, p3, p2);
      }
    }
  }
}
