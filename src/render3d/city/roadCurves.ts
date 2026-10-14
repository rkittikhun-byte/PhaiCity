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
import { halfWidth, networkOf, REAL_WIDTH_M, roadReach, shoulderOf, smoothLine, type Point } from '../../roadGeometry.js';
import { isRail, isRoad, type TileSnapshot } from './tileModels.js';
import { Placement } from './placement.js';
import type { ModelOptions } from '../models/registry.js';

export { smoothLine, type Point };


const LIFT = 0.15, PLATE_LIFT = 0.17, OUTSIDE_SHADE = 0.62;

export class RoadCurves {
  readonly root = new Group();
  private covered = new Uint8Array(0);
  private lines: Array<{ points: Point[]; rail: boolean; level: number }> = [];
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
    this.rebuild();
  }

  /** Tiles changed: draw the curves again when a road or railway is among them, or was */
  update(changed: readonly number[]): void {
    const values = this.snapshot.values;
    if (changed.some((i) => this.covered[i] || isRoad(values[i]) || isRail(values[i]))) this.rebuild();
  }

  /** The point of a road's middle line nearest (x, z) within reach, the way the road runs there and how far it reaches
   * either side, for a building to stand against it (TileSnapshot.roadSnap) */
  nearest(x: number, z: number, reach: number): { x: number; z: number; tx: number; tz: number; reach: number } | null {
    let best: { x: number; z: number; tx: number; tz: number; reach: number } | null = null, bestDistance = reach;
    for (const { points, rail, level } of this.lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)));
        const px = ax + dx * t, pz = az + dz * t, distance = Math.hypot(px - x, pz - z);
        if (distance < bestDistance) { bestDistance = distance; best = { x: px, z: pz, tx: dx / length, tz: dz / length, reach: roadReach(level, this.snapshot.realUnits) }; }
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
      const levels = this.snapshot.roadLevels, values = this.snapshot.values;
      const { stretches, plates, junctions, covered } = networkOf({ width, height: this.snapshot.height, value: (i) => values[i],
        level: (i) => levels?.[i] ?? 1 }, rail);
      for (let i = 0; i < covered.length; i++) if (covered[i]) this.covered[i] = 1;
      // A road that ends at a junction runs on into it a little, so the roads meeting there overlap and fill it
      const atJunction = (point: Point): boolean => junctions.some(([x, z]) => Math.abs(x - point[0]) < 0.01 && Math.abs(z - point[1]) < 0.01);
      for (const stretch of stretches) {
        const line = smoothLine(stretch.points);
        if (line.length > 1) {
          const reach = rail ? 1.6 * this.metre : halfWidth(stretch.level, this.snapshot.realUnits);
          for (const [end, before] of [[0, 1], [line.length - 1, line.length - 2]] as const) {
            if (!atJunction(line[end])) continue;
            const [ex, ez] = line[end], [bx, bz] = line[before], length = Math.hypot(ex - bx, ez - bz) || 1;
            const past: Point = [ex + (ex - bx) / length * reach * 0.6, ez + (ez - bz) / length * reach * 0.6];
            if (end === 0) line.unshift(past); else line.push(past);
          }
        }
        this.lines.push({ points: line, rail, level: stretch.level });
        if (rail) this.rail(line, positions, colors, railPositions, sleepers);
        else this.road(line, stretch.level, positions, colors);
      }
      for (const [x, z, level] of plates) this.plate(x, z, rail ? null : level, positions, colors);
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

  private road(line: Point[], level: number, positions: number[], colors: number[]): void {
    if (level <= 1) {
      const k = this.lateriteShare, e = LATERITE_EDGE * k, offsets = [-e, -e * 0.7, -e * 0.35, 0, e * 0.35, e * 0.7, e];
      this.band(line, offsets, (d) => lateriteColour(Math.abs(d) / k), LIFT, positions, colors);
      return;
    }
    const units = this.snapshot.realUnits, half = halfWidth(level, units), side = shoulderOf(units);
    const surface = new Color(level > 2 ? 0x8f8d86 : 0x555959), shoulder = new Color(0xa39c8f);
    this.band(line, [-half - side, -half, half, half + side], (d) => (Math.abs(d) > half + 0.01 ? shoulder : surface),
      LIFT, positions, colors);
    // Its centre line
    const paint = new Color(0xd9d2b0), stripe = 0.08 * this.metre;
    this.band(line, [-stripe, stripe], () => paint, LIFT + 0.01, positions, colors);
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
