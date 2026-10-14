/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Roads and railways as smooth curves (owner, 14 Oct 2026: "ที่มันเป็นเหลี่ยมๆ ทำให้มันโค้งๆ สวยๆ ได้ไหม ทั้งจังหวัดเลย",
// with a picture of Cities: Skylines' highways sweeping through the countryside). The game lays them tile by tile, so
// a road at a slant is a staircase of tiles; here each stretch between junctions is drawn as one ribbon through its
// tiles' middles, the steps smoothed away and the bends rounded, lying on the ground. Junctions get a round plate;
// bridges, level crossings and power line crossings keep their own tile models, the ribbons running up to their
// edges. The tiles themselves, which the simulation, the tools and the cars use, are unchanged: the view draws the
// curved tiles as open land (TileSnapshot.curves) and this draws the roads. It reads the map and never writes it.
import { BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, BoxGeometry, Quaternion, Vector3 } from 'three';
import { lateriteColour, LATERITE_EDGE } from '../models/road/laterite.js';
import { RAIL_INTERFACE } from '../models/road/interfaces.js';
import type { CityHeightField } from './heightfield.js';
import { isCurveRail, isPlainRoad as isCurveRoad, isRail, isRoad, type TileSnapshot } from './tileModels.js';
import type { Placement } from './types.js';

type Point = [number, number];
interface Stretch { points: Point[]; level: number; rail: boolean }

/** How far the simplified line may stray from the smoothed one (world units, 10 a tile), and how high it lies */
const STRAY = 1.5, LIFT = 0.15, PLATE_LIFT = 0.17, OUTSIDE_SHADE = 0.62;
/** How many tiles either side each point is averaged with */
const REACH = 4;
/** Half the width of each road level's carriageway (1 laterite … 8 tollway), and its shoulders */
const HALF_WIDTH = [3.5, 3.5, 3.5, 3.6, 4.2, 4.6, 4.9, 4.9, 4.9];
const SHOULDER = 0.6;
const SIDES: ReadonlyArray<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Douglas–Peucker: the fewest points that keep the line within tolerance of where it was */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!, [ax, az] = points[a], [bx, bz] = points[b], dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz) || 1;
    let far = -1, farthest = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / length;
      if (d > farthest) { farthest = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Each point moved to the average of its neighbours along the line, up to reach points either side (fewer near the
 * ends, which stay put), passes times: the stairsteps of a slanted road go, its real bends stay as wide curves.
 */
function average(points: Point[], reach: number, passes: number): Point[] {
  let line = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: Point[] = [];
    for (let i = 0; i < line.length; i++) {
      const r = Math.min(reach, i, line.length - 1 - i);
      let x = 0, z = 0;
      for (let k = i - r; k <= i + r; k++) { x += line[k][0]; z += line[k][1]; }
      next.push([x / (2 * r + 1), z / (2 * r + 1)]);
    }
    line = next;
  }
  return line;
}

/** Chaikin's corner cutting, its ends kept: each bend becomes a curve, long straights stay straight */
function round(points: Point[], passes = 3): Point[] {
  let line = points;
  for (let pass = 0; pass < passes && line.length > 2; pass++) {
    const next: Point[] = [line[0]];
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      if (i > 0) next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      if (i + 2 < line.length) next.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

/** Points no further apart than step, so the ribbon follows the ground */
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}

export class RoadCurves {
  readonly root = new Group();
  private covered = new Uint8Array(0);
  private lines: Array<{ points: Point[]; rail: boolean }> = [];
  private readonly roadMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  private readonly railMaterial = new MeshStandardMaterial({ color: 0x9aa3a0, roughness: 0.4, metalness: 0.6 });
  private readonly sleeperMaterial = new MeshStandardMaterial({ color: 0x8d877c, roughness: 0.9 });
  private readonly sleeperGeometry = new BoxGeometry(1.8, 0.08, 0.22);

  constructor(private readonly snapshot: TileSnapshot, private readonly terrain: CityHeightField) {
    this.root.name = 'road_curves';
    this.rebuild();
  }

  /** Tiles changed: draw the curves again when a road or railway is among them, or was */
  update(changed: readonly number[]): void {
    const values = this.snapshot.values;
    if (changed.some((i) => this.covered[i] || isRoad(values[i]) || isRail(values[i]))) this.rebuild();
  }

  /** Places along the roads near the target for the ambient cars (src/render3d/city/sprites.ts), as tiles would be */
  roadsNear(target: Vector3): Placement[] {
    const near: Placement[] = [];
    for (const { points, rail } of this.lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        if (Math.abs(ax - target.x) > 220 || Math.abs(az - target.z) > 220) continue;
        near.push({ index: -1, x: ax, z: az, id: 'road.curve_straight', kind: 'road', rotation: Math.atan2(bx - ax, bz - az),
          footprint: [1, 1], height: 0, color: 0, water: false, scale: 1, powered: false, options: {} } as Placement);
      }
    }
    return near.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)).slice(0, 64);
  }

  dispose(): void {
    this.clear();
    this.roadMaterial.dispose(); this.railMaterial.dispose(); this.sleeperMaterial.dispose(); this.sleeperGeometry.dispose();
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      if (child instanceof Mesh || child instanceof InstancedMesh) child.geometry.dispose();
      this.root.remove(child);
    }
  }

  private rebuild(): void {
    this.clear();
    const { width } = this.snapshot;
    this.covered = new Uint8Array(this.snapshot.values.length);
    this.lines = [];
    const positions: number[] = [], colors: number[] = [], railPositions: number[] = [], sleepers: Matrix4[] = [];
    for (const rail of [false, true]) {
      const { stretches, plates } = this.stretches(rail);
      for (const stretch of stretches) {
        const line = densify(round(simplify(average(stretch.points, REACH, 2), STRAY), 2), 2.5);
        this.lines.push({ points: line, rail });
        if (rail) this.rail(line, positions, colors, railPositions, sleepers);
        else this.road(line, stretch.level, positions, colors);
      }
      for (const [i, level] of plates) {
        const x = i % width, y = (i - x) / width;
        this.plate((x + 0.5) * 10, (y + 0.5) * 10, rail ? RAIL_INTERFACE.ballastWidth / 2 : this.halfWidth(level) + (level > 1 ? SHOULDER : 0),
          rail ? new Color(0x8b8379) : level > 1 ? new Color(level > 2 ? 0x8f8d86 : 0x555959) : lateriteColour(0), positions, colors);
      }
    }
    if (positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.roadMaterial);
      mesh.name = 'curves'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (railPositions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(railPositions, 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.railMaterial);
      mesh.name = 'rails';
      this.root.add(mesh);
    }
    if (sleepers.length) {
      const mesh = new InstancedMesh(this.sleeperGeometry, this.sleeperMaterial, sleepers.length);
      sleepers.forEach((matrix, n) => mesh.setMatrixAt(n, matrix));
      mesh.name = 'sleepers'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }

  private halfWidth(level: number): number { return HALF_WIDTH[Math.max(1, Math.min(8, level))]; }

  /** The stretches of one network between its junctions, ends and other tiles (bridges, crossings), and its plates */
  private stretches(rail: boolean): { stretches: Stretch[]; plates: Array<[number, number]> } {
    const { width, height, values } = this.snapshot;
    const plain = rail ? isCurveRail : isCurveRoad, joins = rail ? isRail : isRoad;
    const levels = this.snapshot.roadLevels;
    const levelOf = (i: number): number => (rail ? 0 : Math.max(1, levels?.[i] ?? 1));
    const near = (i: number): number[] => {
      const x = i % width, y = (i - x) / width, out: number[] = [];
      for (const [dx, dy] of SIDES) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && joins(values[ny * width + nx])) out.push(ny * width + nx);
      }
      return out;
    };
    const stop = (i: number): boolean => {
      const n = near(i);
      return n.length !== 2 || n.some((j) => !plain(values[j]) || levelOf(j) !== levelOf(i));
    };
    const centre = (i: number): Point => [((i % width) + 0.5) * 10, (Math.floor(i / width) + 0.5) * 10];
    const done = new Set<string>(), stretches: Stretch[] = [], plates: Array<[number, number]> = [];
    const walk = (from: number, to: number): void => {
      const tiles = [from, to];
      done.add(`${from}>${to}`); done.add(`${to}>${from}`);
      while (!stop(tiles[tiles.length - 1])) {
        const last = tiles[tiles.length - 1], before = tiles[tiles.length - 2];
        const next = near(last).find((j) => j !== before && !done.has(`${last}>${j}`));
        if (next === undefined) break;
        done.add(`${last}>${next}`); done.add(`${next}>${last}`);
        tiles.push(next);
        if (next === tiles[0]) break;
      }
      stretches.push({ points: tiles.map(centre), level: levelOf(tiles[1]), rail });
    };
    for (let i = 0; i < values.length; i++) {
      if (!plain(values[i])) continue;
      this.covered[i] = 1;
      if (!stop(i)) continue;
      const n = near(i);
      // Junctions and dead ends get a round plate; a lone tile is one
      if (n.length !== 2 || n.filter((j) => plain(values[j])).length !== n.length) plates.push([i, levelOf(i)]);
      for (const j of n) {
        if (!plain(values[j])) {
          // Up to the edge of a bridge or a crossing, which keeps its own model
          const [cx, cz] = centre(i), [jx, jz] = centre(j);
          stretches.push({ points: [[cx, cz], [(cx + jx) / 2, (cz + jz) / 2]], level: levelOf(i), rail });
        } else if (!done.has(`${i}>${j}`)) walk(i, j);
      }
    }
    // Rings with no junction at all
    for (let i = 0; i < values.length; i++) {
      if (!plain(values[i]) || stop(i)) continue;
      for (const j of near(i)) if (!done.has(`${i}>${j}`)) walk(i, j);
    }
    return { stretches, plates };
  }

  /** The ground's height there, as the ground's own tile draws it */
  private height(x: number, z: number): number {
    const tx = Math.max(0, Math.min(this.snapshot.width - 1, Math.floor(x / 10)));
    const tz = Math.max(0, Math.min(this.snapshot.height - 1, Math.floor(z / 10)));
    return this.terrain.sampleTile(tx, tz, x, z);
  }

  private shade(colour: Color, x: number, z: number): Color {
    const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
    const inside = tx < 0 || ty < 0 || tx >= this.snapshot.width || ty >= this.snapshot.height || this.terrain.inside(tx, ty);
    return inside ? colour : colour.clone().multiplyScalar(OUTSIDE_SHADE);
  }

  /** A band along the line: columns at the given offsets across it, each with its colour, lifted over the ground */
  private band(line: Point[], offsets: readonly number[], colourAt: (offset: number) => Color, lift: number,
    positions: number[], colors: number[]): void {
    const rows: Array<Array<[number, number, number, Color]>> = [];
    for (let i = 0; i < line.length; i++) {
      const [px, pz] = line[i], [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / length, nz = (bx - ax) / length;
      rows.push(offsets.map((d) => {
        const x = px + nx * d, z = pz + nz * d;
        return [x, this.height(x, z) + lift, z, this.shade(colourAt(d), x, z)];
      }));
    }
    for (let i = 1; i < rows.length; i++) for (let k = 1; k < offsets.length; k++) {
      const a = rows[i - 1][k - 1], b = rows[i - 1][k], c = rows[i][k - 1], d = rows[i][k];
      for (const v of [a, b, c, b, d, c]) { positions.push(v[0], v[1], v[2]); colors.push(v[3].r, v[3].g, v[3].b); }
    }
  }

  private road(line: Point[], level: number, positions: number[], colors: number[]): void {
    if (level <= 1) {
      const e = LATERITE_EDGE, offsets = [-e, -e * 0.7, -e * 0.35, 0, e * 0.35, e * 0.7, e];
      this.band(line, offsets, (d) => lateriteColour(Math.abs(d)), LIFT, positions, colors);
      return;
    }
    const half = this.halfWidth(level), surface = new Color(level > 2 ? 0x8f8d86 : 0x555959), shoulder = new Color(0xa39c8f);
    this.band(line, [-half - SHOULDER, -half, half, half + SHOULDER], (d) => (Math.abs(d) > half + 0.01 ? shoulder : surface),
      LIFT, positions, colors);
    // Its centre line
    const paint = new Color(0xd9d2b0);
    this.band(line, [-0.08, 0.08], () => paint, LIFT + 0.01, positions, colors);
  }

  private rail(line: Point[], positions: number[], colors: number[], railPositions: number[], sleepers: Matrix4[]): void {
    const ballast = new Color(0x8b8379), edge = new Color(0x77705f), half = RAIL_INTERFACE.ballastWidth / 2;
    this.band(line, [-half, -1.2, 1.2, half], (d) => (Math.abs(d) > 1.21 ? edge : ballast), LIFT, positions, colors);
    // The two rails, low boxes along the line
    const gauge = (RAIL_INTERFACE.gauge + RAIL_INTERFACE.railWidth) / 2, rail = 0.05;
    for (const side of [-1, 1]) {
      const scratch: number[] = [], none: number[] = [];
      this.band(line, [side * gauge - rail, side * gauge + rail], () => ballast, 0.42, scratch, none);
      railPositions.push(...scratch);
    }
    // Sleepers every RAIL_INTERFACE.sleeperSpacing along it
    const up = new Vector3(0, 1, 0), turn = new Quaternion(), place = new Vector3(), size = new Vector3(1, 1, 1);
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      turn.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax) + Math.PI / 2);
      for (let s = carry; s < length; s += RAIL_INTERFACE.sleeperSpacing) {
        const x = ax + (bx - ax) * s / length, z = az + (bz - az) * s / length;
        place.set(x, this.height(x, z) + 0.3, z);
        sleepers.push(new Matrix4().compose(place, turn, size));
      }
      carry = (carry - length) % RAIL_INTERFACE.sleeperSpacing;
      if (carry < 0) carry += RAIL_INTERFACE.sleeperSpacing;
    }
  }

  /** A round plate at a junction or a road's end */
  private plate(cx: number, cz: number, radius: number, colour: Color, positions: number[], colors: number[]): void {
    const n = 16, centre: [number, number, number] = [cx, this.height(cx, cz) + PLATE_LIFT, cz], shaded = this.shade(colour, cx, cz);
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * radius, z0 = cz + Math.sin(a0) * radius, x1 = cx + Math.cos(a1) * radius, z1 = cz + Math.sin(a1) * radius;
      for (const [x, y, z] of [centre, [x1, this.height(x1, z1) + PLATE_LIFT, z1], [x0, this.height(x0, z0) + PLATE_LIFT, z0]]) {
        positions.push(x, y, z); colors.push(shaded.r, shaded.g, shaded.b);
      }
    }
  }
}
