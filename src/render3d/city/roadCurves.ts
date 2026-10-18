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
import { halfWidth, networkOf, REAL_WIDTH_M, roadLines, roadReach, shoulderOf, smoothLine, type JunctionShape, type Point } from '../../roadGeometry.js';
import type { TileSnapshot } from './tileModels.js';
import { Placement } from './placement.js';
import type { ModelOptions } from '../models/registry.js';

export { smoothLine, type Point };


const LIFT = 0.15, PLATE_LIFT = 0.17, OUTSIDE_SHADE = 0.62;
/** A road's end under the road it meets, the corners between roads at a junction (their shoulders, then their
 * carriageways), and a junction's middle where no road runs through it: lifted so each lies over what it should */
const UNDER_LIFT = 0.13, CORNER_LIFT = 0.145, CORNER_TOP_LIFT = 0.154, MIDDLE_LIFT = 0.152;
/** A corner's curve, as a share of the wider road's reach either side of its middle */
const CORNER_RADIUS = 1.65;

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

interface DrawnCurveLine {
  points: Point[];
  rail: boolean;
  level: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function lineBounds(points: Point[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, maxX, minZ, maxZ };
}

export class RoadCurves {
  readonly root = new Group();
  private covered = new Uint8Array(0);
  private lines: DrawnCurveLine[] = [];
  /** The roads and railways as drawn, for whatever moves along them (buses.ts) */
  get drawnLines(): ReadonlyArray<{ points: Point[]; rail: boolean; level: number }> { return this.lines; }
  private readonly roadMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  private readonly railMaterial = new MeshStandardMaterial({ color: 0x9aa3a0, roughness: 0.4, metalness: 0.6 });
  private readonly sleeperMaterial = new MeshStandardMaterial({ color: 0x8d877c, roughness: 0.9 });
  private readonly sleeperGeometry = new BoxGeometry(1.8, 0.08, 0.22);

  /** World units a metre of a road's or a railway's cross-section: 1 on a map of 10 m tiles, less on a real-scale
   * city map's (owner, 15 Oct 2026: roads their real width, src/roadGeometry.ts) */
  private get metre(): number { return Math.min(1, this.snapshot.realUnits ?? 1); }
  /** How much narrower a laterite road is drawn than its tile model's profile (models/road/laterite.ts) */
  private get lateriteShare(): number {
    const units = this.snapshot.realUnits;
    return units ? REAL_WIDTH_M[1] / 2 * units / LATERITE_EDGE : 1;
  }

  constructor(private readonly snapshot: TileSnapshot, private readonly terrain: CityHeightField) {
    this.root.name = 'road_curves';
    this.snapshot.roadSnap = (x, z, reach) => this.nearest(x, z, reach);
    this.roadMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRoadXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoadXZ = position.xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRoadXZ;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float rGrain = sin(vRoadXZ.x * 11.3 + cos(vRoadXZ.y * 9.7)) * cos(vRoadXZ.y * 12.1 - sin(vRoadXZ.x * 8.9));
          float rMacro = sin(vRoadXZ.x * 1.3 + vRoadXZ.y * 0.9) * cos(vRoadXZ.x * 0.8 - vRoadXZ.y * 1.4);
          diffuseColor.rgb *= 1.0 + rGrain * 0.032 + rMacro * 0.024;`);
    };
    this.roadMaterial.customProgramCacheKey = () => 'phaicity-road-curves-grain';
    this.rebuild();
  }

  /** Tiles changed: draw the curves and driveways again when a road, railway or building changes */
  update(changed: readonly number[]): void {
    if (changed.length > 0) this.rebuild();
  }

  /** The point of a road's middle line nearest (x, z) within reach, using AABB early rejection (TileSnapshot.roadSnap) */
  nearest(x: number, z: number, reach: number): { x: number; z: number; tx: number; tz: number; reach: number } | null {
    let best: { x: number; z: number; tx: number; tz: number; reach: number } | null = null, bestDistance = reach;
    for (const line of this.lines) {
      if (line.rail) continue;
      if (x < line.minX - bestDistance || x > line.maxX + bestDistance ||
          z < line.minZ - bestDistance || z > line.maxZ + bestDistance) continue;
      const points = line.points;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        const segMinX = (ax < bx ? ax : bx) - bestDistance;
        if (x < segMinX) continue;
        const segMaxX = (ax > bx ? ax : bx) + bestDistance;
        if (x > segMaxX) continue;
        const segMinZ = (az < bz ? az : bz) - bestDistance;
        if (z < segMinZ) continue;
        const segMaxZ = (az > bz ? az : bz) + bestDistance;
        if (z > segMaxZ) continue;

        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)));
        const px = ax + dx * t, pz = az + dz * t, distance = Math.hypot(px - x, pz - z);
        if (distance < bestDistance) { bestDistance = distance; best = { x: px, z: pz, tx: dx / length, tz: dz / length, reach: roadReach(line.level, this.snapshot.realUnits) }; }
      }
    }
    return best;
  }

  /** Places along the roads near the target for the ambient cars (src/render3d/city/sprites.ts), as tiles would be */
  roadsNear(target: Vector3): Placement[] {
    const near: Placement[] = [];
    for (const { points, rail } of this.lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        if (Math.abs(ax - target.x) > 220 || Math.abs(az - target.z) > 220) continue;
        near.push(new Placement({ index: -1, x: ax, z: az, id: 'road.curve_straight', kind: 'road', rotation: Math.atan2(bx - ax, bz - az),
          footprint: [1, 1], height: 0, color: 0, water: false, scale: 1, powered: false, options: {} as ModelOptions }));
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
      const levels = this.snapshot.roadLevels, values = this.snapshot.values, pieces = this.snapshot.roadPieces, paths = this.snapshot.roadPaths;
      const network = networkOf({ width, height: this.snapshot.height, value: (i) => values[i],
        level: (i) => levels?.[i] ?? 1, piece: (i) => pieces?.[i] ?? 0, path: (piece) => paths?.[piece] ?? null }, rail);
      const { plates, junctions, covered } = network;
      for (let i = 0; i < covered.length; i++) if (covered[i]) this.covered[i] = 1;
      // One road where it runs on through a junction, the others ending at it (src/roadGeometry.ts roadLines)
      const drawn = roadLines(network);
      if (rail) {
        // A railway that ends at a junction runs on into it a little, so the tracks meeting there overlap and fill it
        for (const { points: line, level } of drawn.lines) {
          if (line.length > 1) for (const [end, before] of [[0, 1], [line.length - 1, line.length - 2]] as const) {
            if (!junctions.some(([x, z]) => Math.hypot(x - line[end][0], z - line[end][1]) < 2)) continue;
            const [ex, ez] = line[end], [bx, bz] = line[before], length = Math.hypot(ex - bx, ez - bz) || 1, reach = 1.6 * this.metre;
            const past: Point = [ex + (ex - bx) / length * reach * 0.6, ez + (ez - bz) / length * reach * 0.6];
            if (end === 0) line.unshift(past); else line.push(past);
          }
          this.lines.push({ points: line, rail, level, ...lineBounds(line) });
          this.rail(line, positions, colors, railPositions, sleepers);
        }
      } else {
        // Where a road ends at a junction with a road running through it, its end lies under that road
        const under = new Map<string, number>();
        for (const junction of drawn.junctions) {
          if (junction.through === null) continue;
          const reach = roadReach(drawn.lines[junction.through].level, this.snapshot.realUnits);
          const along = junction.arms.find((arm) => arm.end === null)!.way;
          for (const arm of junction.arms) if (arm.end !== null) {
            const sine = Math.abs(along[0] * arm.way[1] - along[1] * arm.way[0]);
            under.set(`${arm.line}:${arm.end}`, reach / Math.max(0.35, sine) + 0.3);
          }
        }
        drawn.lines.forEach(({ points: line, level }, n) => {
          this.lines.push({ points: line, rail, level, ...lineBounds(line) });
          const [start, main, finish] = splitEnds(line, under.get(`${n}:0`) ?? 0, under.get(`${n}:1`) ?? 0);
          for (const part of [start, finish]) if (part.length > 1) this.road(part, level, positions, colors, UNDER_LIFT, false);
          if (main.length > 1) this.road(main, level, positions, colors);
        });
        for (const junction of drawn.junctions) this.junction(junction, drawn.lines, positions, colors);
      }
      for (const [x, z, level] of plates) this.plate(x, z, rail ? null : level, positions, colors);
    }
    this.driveways(positions, colors);
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

  /**
   * Trafficity-style Driveway Aprons (ทางเชื่อมหน้าตึกเข้าสู่ถนน): every building standing beside a road gets a paved
   * flared driveway and curb cut connecting its front entrance directly to the road edge.
   */
  private driveways(positions: number[], colors: number[]): void {
    const { width, height, values } = this.snapshot;
    if (!this.lines.length) return;
    const m = this.metre;
    const apronColour = new Color(0xb5afa1), paveColour = new Color(0x6e7174);
    for (let i = 0; i < width * height; i++) {
      const v = values[i];
      if (v < 240) continue;
      const p = this.snapshot.placement(i, 'central');
      if (!p || ['terrain', 'road', 'rail', 'shore', 'debug', 'veg', 'park', 'power'].includes(p.kind)) continue;
      if (p.id?.endsWith('zone_empty')) continue;
      const size = Math.max(p.footprint[0], p.footprint[1]);
      const near = this.nearest(p.x, p.z, size * 5 + 28);
      if (!near) continue;

      let nx = -near.tz, nz = near.tx;
      if (nx * (p.x - near.x) + nz * (p.z - near.z) < 0) { nx = -nx; nz = -nz; }
      const tx = near.tx, tz = near.tz;
      const dist = Math.hypot(p.x - near.x, p.z - near.z);
      const d0 = near.reach * 0.72;
      const halfDepth = size * 5 * (p.fill ?? 0.625) * 0.45;
      const d1 = Math.max(d0 + 0.9, dist - halfDepth);
      if (d1 <= d0 + 0.2 || d1 > d0 + 18) continue;

      const wRoad = (size >= 3 ? 3.1 : 1.75) * m;
      const wBldg = (size >= 3 ? 2.3 : 1.25) * m;
      const border = 0.24 * m;
      const rx0 = near.x + nx * d0, rz0 = near.z + nz * d0;
      const rx1 = near.x + nx * d1, rz1 = near.z + nz * d1;

      // Outer concrete curb-cut apron
      const a0: Point = [rx0 - tx * (wRoad + border), rz0 - tz * (wRoad + border)];
      const a1: Point = [rx0 + tx * (wRoad + border), rz0 + tz * (wRoad + border)];
      const a2: Point = [rx1 + tx * (wBldg + border), rz1 + tz * (wBldg + border)];
      const a3: Point = [rx1 - tx * (wBldg + border), rz1 - tz * (wBldg + border)];
      this.flat([a0, a1, a2], apronColour, UNDER_LIFT + 0.006, positions, colors);
      this.flat([a0, a2, a3], apronColour, UNDER_LIFT + 0.006, positions, colors);

      // Inner paved driveway surface
      const b0: Point = [rx0 - tx * wRoad, rz0 - tz * wRoad];
      const b1: Point = [rx0 + tx * wRoad, rz0 + tz * wRoad];
      const b2: Point = [rx1 + tx * wBldg, rz1 + tz * wBldg];
      const b3: Point = [rx1 - tx * wBldg, rz1 - tz * wBldg];
      this.flat([b0, b1, b2], paveColour, UNDER_LIFT + 0.012, positions, colors);
      this.flat([b0, b2, b3], paveColour, UNDER_LIFT + 0.012, positions, colors);
    }
  }

  /**
   * The ground's height there, as the far ground draws its tile (province-surface.ts ground): four triangles round
   * the tile's middle, so a twisted tile's ground does not rise through the road
   */
  private height(x: number, z: number): number {
    const tx = Math.max(0, Math.min(this.snapshot.width - 1, Math.floor(x / 10)));
    const tz = Math.max(0, Math.min(this.snapshot.height - 1, Math.floor(z / 10)));
    const at = (px: number, pz: number): number => this.terrain.sampleTile(tx, tz, px, pz);
    const u = Math.max(0, Math.min(1, x / 10 - tx)), v = Math.max(0, Math.min(1, z / 10 - tz));
    const x0 = tx * 10, z0 = tz * 10, middle = at(x0 + 5, z0 + 5);
    // The triangle's two corners: the edge the point faces from the middle
    const [[ax, az], [bx, bz]] = v <= u && v <= 1 - u ? [[0, 0], [1, 0]] : u >= v && u >= 1 - v ? [[1, 0], [1, 1]]
      : v >= u && v >= 1 - u ? [[1, 1], [0, 1]] : [[0, 1], [0, 0]];
    const ha = at(x0 + ax * 10, z0 + az * 10), hb = at(x0 + bx * 10, z0 + bz * 10);
    // Barycentric weights of the point in the triangle (middle, a, b)
    const d = (az - 0.5) * (bx - 0.5) - (ax - 0.5) * (bz - 0.5) || 1;
    const wa = ((v - 0.5) * (bx - 0.5) - (u - 0.5) * (bz - 0.5)) / d;
    const wb = ((u - 0.5) * (az - 0.5) - (v - 0.5) * (ax - 0.5)) / d;
    return middle + wa * (ha - middle) + wb * (hb - middle);
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

  private road(line: Point[], level: number, positions: number[], colors: number[], lift = LIFT, stripe = true): void {
    if (level <= 1) {
      const k = this.lateriteShare, e = LATERITE_EDGE * k, offsets = [-e, -e * 0.7, -e * 0.35, 0, e * 0.35, e * 0.7, e];
      this.band(line, offsets, (d) => lateriteColour(Math.abs(d) / k), lift, positions, colors);
      return;
    }
    const units = this.snapshot.realUnits, half = halfWidth(level, units), side = shoulderOf(units);
    const surface = new Color(level > 2 ? 0x8f8d86 : 0x4b4f50), shoulder = new Color(0xb5aea0), curb = new Color(0x746f65);
    const cWidth = 0.12 * this.metre;
    this.band(line, [-half - side, -half - cWidth, -half, half, half + cWidth, half + side],
      (d) => {
        const ad = Math.abs(d);
        if (ad > half + cWidth + 0.005) return shoulder;
        if (ad > half + 0.005) return curb;
        return surface;
      }, lift, positions, colors);
    // Its centre line and lane dividers, not under the road it meets ("just one more lane": 2, 4, 6, 8 lanes)
    if (!stripe) return;
    const yellowPaint = new Color(0xe2bc52), whitePaint = new Color(0xebe6d8), width = 0.08 * this.metre;
    this.band(line, [-width, width], () => (level >= 4 ? yellowPaint : whitePaint), lift + 0.01, positions, colors);
    if (level >= 4) {
      const lanesPerDir = level >= 6 ? 4 : level === 5 ? 3 : 2;
      const lw = 0.055 * this.metre;
      for (let lane = 1; lane < lanesPerDir; lane++) {
        const laneOffset = (half * lane) / lanesPerDir;
        this.band(line, [-laneOffset - lw, -laneOffset + lw], () => whitePaint, lift + 0.01, positions, colors);
        this.band(line, [laneOffset - lw, laneOffset + lw], () => whitePaint, lift + 0.01, positions, colors);
      }
    }
  }

  private rail(line: Point[], positions: number[], colors: number[], railPositions: number[], sleepers: Matrix4[]): void {
    const m = this.metre, ballast = new Color(0x8b8379), edge = new Color(0x77705f), half = RAIL_INTERFACE.ballastWidth / 2 * m;
    this.band(line, [-half, -1.2 * m, 1.2 * m, half], (d) => (Math.abs(d) > 1.21 * m ? edge : ballast), LIFT, positions, colors);
    // The two rails, low boxes along the line
    const gauge = (RAIL_INTERFACE.gauge + RAIL_INTERFACE.railWidth) / 2 * m, rail = 0.05 * m;
    for (const side of [-1, 1]) {
      const scratch: number[] = [], none: number[] = [];
      this.band(line, [side * gauge - rail, side * gauge + rail], () => ballast, 0.42 * m, scratch, none);
      railPositions.push(...scratch);
    }
    // Sleepers every RAIL_INTERFACE.sleeperSpacing along it
    const up = new Vector3(0, 1, 0), turn = new Quaternion(), place = new Vector3(), size = new Vector3(m, m, m);
    const spacing = RAIL_INTERFACE.sleeperSpacing * m;
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      turn.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax) + Math.PI / 2);
      for (let s = carry; s < length; s += spacing) {
        const x = ax + (bx - ax) * s / length, z = az + (bz - az) * s / length;
        place.set(x, this.height(x, z) + 0.3 * m, z);
        sleepers.push(new Matrix4().compose(place, turn, size));
      }
      carry = (carry - length) % spacing;
      if (carry < 0) carry += spacing;
    }
  }

  /**
   * A junction's corners, as Cities: Skylines rounds them: between each two roads next to each other round it (not the
   * two halves of a road running through), the ground between their edges is filled up to a curve that meets both
   * edges, first out to their shoulders and then their carriageways; where no road runs through, its middle is filled
   * too. A laterite road has no shoulders and fills to its edge colour.
   */
  private junction(junction: JunctionShape, lines: ReadonlyArray<{ level: number }>, positions: number[], colors: number[]): void {
    const { at, arms } = junction, units = this.snapshot.realUnits, corners: Point[] = [];
    if (!arms.length) return;
    const maxLevel = Math.max(...arms.map((arm) => lines[arm.line].level));
    if (arms.length < 3) {
      // A 2-arm level transition is already joined seamlessly along the continuous smooth curve; 1-arm dead ends get a
      // plate, and so do two drawn lines that meet end to end at a corner (src/roadPieces.ts), not where the newer goes
      // on along the older's way
      if (arms.length === 1 || !junction.smooth && arms.every((arm) => arm.end !== null)) this.plate(at[0], at[1], maxLevel, positions, colors);
      return;
    }
    const surfaceOf = (level: number): Color => (level <= 1 ? lateriteColour(LATERITE_EDGE * 0.3) : new Color(level > 2 ? 0x8f8d86 : 0x4b4f50));
    for (let k = 0; k < arms.length; k++) {
      const a = arms[k], b = arms[(k + 1) % arms.length];
      if (a.line === b.line && a.end === null && b.end === null) continue;
      let turn = Math.atan2(b.way[1], b.way[0]) - Math.atan2(a.way[1], a.way[0]);
      while (turn <= 0) turn += Math.PI * 2;
      if (turn >= Math.PI * 0.72) continue;
      const levelA = lines[a.line].level, levelB = lines[b.line].level;
      const layers: Array<[number, number, Color, number]> = levelA <= 1 && levelB <= 1
        ? [[roadReach(levelA, units), roadReach(levelB, units), lateriteColour(LATERITE_EDGE * 0.8), CORNER_LIFT]]
        : [[roadReach(levelA, units), roadReach(levelB, units), new Color(0xb5aea0), CORNER_LIFT],
          [halfWidth(levelA, units), halfWidth(levelB, units), surfaceOf(Math.max(levelA, levelB)), CORNER_TOP_LIFT]];
      for (const [ha, hb, colour, lift] of layers) {
        const corner = this.corner(at, a.way, b.way, ha, hb, turn, CORNER_RADIUS * Math.max(ha, hb), colour, lift, positions, colors);
        if (corner && lift === CORNER_LIFT) corners.push(corner);
      }
    }
    // A junction no road runs through: its middle, out to the corners
    if (junction.through === null && corners.length >= 2) {
      const colour = surfaceOf(maxLevel);
      for (let k = 0; k < corners.length; k++) this.flat([at, corners[k], corners[(k + 1) % corners.length]], colour, MIDDLE_LIFT, positions, colors);
    }
    // Trafficity-style Automatic Roundabout (วงเวียนอัตโนมัติ) only at true 4+ way intersections where at least 3 arms are paved
    const pavedArms = arms.filter((arm) => lines[arm.line].level >= 2).length;
    if (arms.length >= 4 && pavedArms >= 3 && maxLevel >= 3) {
      const maxReach = Math.max(...arms.map((arm) => roadReach(lines[arm.line].level, units)));
      this.roundabout(at[0], at[1], maxReach, maxLevel, positions, colors);
    }
    // Zebra crosswalks (ทางม้าลาย) on paved urban roads meeting at a junction (levels 2–6)
    if (arms.length >= 3) {
      const m = this.metre, maxReach = Math.max(...arms.map((arm) => roadReach(lines[arm.line].level, units)));
      const zebraPaint = new Color(0xebe6d8), zebraLift = CORNER_TOP_LIFT + 0.012;
      for (const arm of arms) {
        const level = lines[arm.line].level;
        if (level < 2 || level >= 7) continue;
        const hw = halfWidth(level, units), dist = maxReach + 1.15 * m;
        const [wx, wz] = arm.way, nx = -wz, nz = wx;
        const cx = at[0] + wx * dist, cz = at[1] + wz * dist;
        const barHalfLen = 0.68 * m, barHalfW = 0.16 * m, step = 0.62 * m;
        for (let s = -hw * 0.78; s <= hw * 0.78 + 1e-4; s += step) {
          const bx = cx + nx * s, bz = cz + nz * s;
          const p0: Point = [bx - wx * barHalfLen - nx * barHalfW, bz - wz * barHalfLen - nz * barHalfW];
          const p1: Point = [bx - wx * barHalfLen + nx * barHalfW, bz - wz * barHalfLen + nz * barHalfW];
          const p2: Point = [bx + wx * barHalfLen + nx * barHalfW, bz + wz * barHalfLen + nz * barHalfW];
          const p3: Point = [bx + wx * barHalfLen - nx * barHalfW, bz + wz * barHalfLen - nz * barHalfW];
          this.flat([p0, p1, p2], zebraPaint, zebraLift, positions, colors);
          this.flat([p0, p2, p3], zebraPaint, zebraLift, positions, colors);
        }
      }
    }
  }

  /**
   * A Trafficity-style circular roundabout island and ring carriageway at a major intersection.
   */
  private roundabout(cx: number, cz: number, maxReach: number, level: number, positions: number[], colors: number[]): void {
    const surface = new Color(level > 2 ? 0x8f8d86 : 0x4b4f50);
    const shoulder = new Color(0xb5aea0);
    const whiteRing = new Color(0xebe6d8);
    const curbStone = new Color(0xd8d2c5);
    const islandGrass = new Color(0x4d8a44);
    const rOuter = maxReach * 1.28;
    const rCarriage = maxReach * 1.08;
    const rIslandCurb = maxReach * 0.46;
    const rIslandGrass = maxReach * 0.36;
    const rings: Array<[number, number, Color, number]> = [
      [rCarriage, rOuter, shoulder, CORNER_LIFT + 0.002],
      [rIslandCurb, rCarriage, surface, CORNER_TOP_LIFT + 0.006],
      [rCarriage * 0.92, rCarriage * 0.96, whiteRing, CORNER_TOP_LIFT + 0.014],
      [rIslandGrass, rIslandCurb, curbStone, CORNER_TOP_LIFT + 0.05],
      [0, rIslandGrass, islandGrass, CORNER_TOP_LIFT + 0.08],
    ];
    const n = 24;
    for (const [r0, r1, col, lift] of rings) {
      const shaded = this.shade(col, cx, cz);
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        const p0: [number, number, number] = [cx + Math.cos(a0) * r0, this.height(cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0) + lift, cz + Math.sin(a0) * r0];
        const p1: [number, number, number] = [cx + Math.cos(a1) * r0, this.height(cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0) + lift, cz + Math.sin(a1) * r0];
        const p2: [number, number, number] = [cx + Math.cos(a0) * r1, this.height(cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1) + lift, cz + Math.sin(a0) * r1];
        const p3: [number, number, number] = [cx + Math.cos(a1) * r1, this.height(cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1) + lift, cz + Math.sin(a1) * r1];
        for (const v of [p0, p1, p2, p1, p3, p2]) {
          positions.push(v[0], v[1], v[2]);
          colors.push(shaded.r, shaded.g, shaded.b);
        }
      }
    }
  }

  /**
   * One rounded corner between two roads leaving a junction at `at` (ways a then b, b turned from a by turn, less than
   * half a circle) whose edges on that side lie ha and hb from their middles: the ground between the edges filled up to
   * an arc of the given radius that meets both. Returns where the edges meet, or null when they do not.
   */
  private corner(at: Point, a: Point, b: Point, ha: number, hb: number, turn: number, radius: number, colour: Color,
    lift: number, positions: number[], colors: number[]): Point | null {
    // The edges: a's on b's side (a turned a quarter towards b), b's on a's side
    const na: Point = [-a[1], a[0]], nb: Point = [b[1], -b[0]];
    const pa: Point = [at[0] + na[0] * ha, at[1] + na[1] * ha], pb: Point = [at[0] + nb[0] * hb, at[1] + nb[1] * hb];
    // Where they meet: pa + a s = pb + b u
    const det = -a[0] * b[1] + a[1] * b[0];
    if (Math.abs(det) < 0.22) return null;
    const rx = pb[0] - pa[0], rz = pb[1] - pa[1], s = (-rx * b[1] + rz * b[0]) / det;
    const c: Point = [pa[0] + a[0] * s, pa[1] + a[1] * s];
    const maxW = Math.max(ha, hb);
    if (Math.hypot(c[0] - at[0], c[1] - at[1]) > 1.85 * maxW) return null;
    // The arc touching both edges: angle between the edges is (PI - turn), so tangent distance from corner c is r / tan((PI - turn) / 2)
    const interiorHalf = Math.max(0.22, (Math.PI - turn) / 2);
    let r = Math.min(radius, maxW * 1.15);
    let tangent = r / Math.tan(interiorHalf);
    const most = 1.6 * maxW;
    if (tangent > most) { tangent = most; r = tangent * Math.tan(interiorHalf); }
    const t1: Point = [c[0] + a[0] * tangent, c[1] + a[1] * tangent], t2: Point = [c[0] + b[0] * tangent, c[1] + b[1] * tangent];
    const bx = a[0] + b[0], bz = a[1] + b[1], bl = Math.hypot(bx, bz) || 1, out = r / Math.sin(interiorHalf);
    const o: Point = [c[0] + bx / bl * out, c[1] + bz / bl * out];
    const a1 = Math.atan2(t1[1] - o[1], t1[0] - o[0]);
    let a2 = Math.atan2(t2[1] - o[1], t2[0] - o[0]);
    while (a2 - a1 > Math.PI) a2 -= Math.PI * 2;
    while (a1 - a2 > Math.PI) a2 += Math.PI * 2;
    const steps = 12, arc: Point[] = [];
    for (let k = 0; k <= steps; k++) { const angle = a1 + (a2 - a1) * k / steps; arc.push([o[0] + Math.cos(angle) * r, o[1] + Math.sin(angle) * r]); }
    for (let k = 1; k <= steps; k++) this.flat([c, arc[k - 1], arc[k]], colour, lift, positions, colors);
    return c;
  }

  /** A triangle lying on the ground, lifted, facing up whichever way round its corners come */
  private flat(corners: [Point, Point, Point], colour: Color, lift: number, positions: number[], colors: number[]): void {
    const [a, b, c] = corners;
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    for (const [x, z] of up >= 0 ? [a, b, c] : [a, c, b]) {
      positions.push(x, this.height(x, z) + lift, z);
      const shaded = this.shade(colour, x, z); colors.push(shaded.r, shaded.g, shaded.b);
    }
  }

  /**
   * A round plate at a junction or a road's end, shaded across as the road is (its rings the road's colours from its
   * middle to its edge), so the roads meeting there run into it rather than ending at a disc; level null for a railway
   */
  private plate(cx: number, cz: number, level: number | null, positions: number[], colors: number[]): void {
    let rings: Array<[number, Color]>;
    if (level === null) {
      const m = this.metre, half = RAIL_INTERFACE.ballastWidth / 2 * m;
      rings = [[0, new Color(0x8b8379)], [1.2 * m, new Color(0x8b8379)], [half, new Color(0x77705f)]];
    } else if (level <= 1) {
      const k = this.lateriteShare, e = LATERITE_EDGE * k;
      rings = [0, 0.35, 0.7, 1].map((share) => [e * share, lateriteColour(LATERITE_EDGE * share)]);
    } else {
      const units = this.snapshot.realUnits, half = halfWidth(level, units), surface = new Color(level > 2 ? 0x8f8d86 : 0x555959);
      rings = [[0, surface], [half, surface], [half + 0.01, new Color(0xa39c8f)], [half + shoulderOf(units), new Color(0xa39c8f)]];
    }
    const n = 20, at = (radius: number, angle: number): [number, number, number] => {
      const x = cx + Math.cos(angle) * radius, z = cz + Math.sin(angle) * radius;
      return [x, this.height(x, z) + PLATE_LIFT, z];
    };
    for (let ring = 1; ring < rings.length; ring++) {
      const [r0, c0] = rings[ring - 1], [r1, c1] = rings[ring];
      const inner = this.shade(c0, cx, cz), outer = this.shade(c1, cx, cz);
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
        const p = at(r0, a0), q = at(r0, a1), s = at(r1, a0), t = at(r1, a1);
        for (const [v, c] of [[p, inner], [q, inner], [s, outer], [q, inner], [t, outer], [s, outer]] as const) {
          positions.push(v[0], v[1], v[2]); colors.push(c.r, c.g, c.b);
        }
      }
    }
  }
}
