/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The cars on the road as the 3D view drives them (owner, 23 Oct 2026: "รถไม่ควรจะซ้อนกันคันกัน ... คัน b ผ่ากลางคัน a ไปเลย"):
// each car keeps a safe gap behind the one ahead of it in its lane and slows to its speed (the intelligent driver
// model), changes to a free lane of its way to pass a slower one where the road has two or more, and at a junction
// waits its turn behind a car crossing from another road. How fast each piece of road wants a car to go comes from the
// month's trips (src/sim/trips.ts), so a jammed road still creeps; the cars only follow it.
//
// Cars are kept in buckets by road piece, way and lane and sorted along it each step, so finding the car ahead is
// cheap (no pair of cars is ever compared across the town). It is the view's own: nothing here is the city's state.

/** One piece of a car's way: a stretch of one road segment, as the car drives it */
export interface LanePiece {
  /** The road segment (graph id), and whether the way runs up its parameter (a to b) */
  readonly segment: number;
  readonly up: boolean;
  /** Where the piece starts and ends along the way (world units) */
  readonly start: number;
  readonly end: number;
  /** Where on its segment (from the segment's start the way it runs, world units) the piece starts, and the segment's length */
  readonly entry: number;
  readonly length: number;
  /** Lanes a way, and a lane's width (world units) */
  readonly lanes: number;
  readonly laneWidth: number;
  /** How fast a car goes here (world units a second), from the month's trips */
  readonly speed: number;
  /** The junction at the piece's end and start the way runs (graph node ids), -1 for none (the way's ends) */
  readonly nodeEnd: number;
  readonly nodeStart: number;
  /** The segment's parameter where the piece starts and ends (the way it runs), when the way knows it */
  readonly t0?: number;
  readonly t1?: number;
  /** The index of the way's point the piece starts at (shared with the piece before it) */
  readonly first?: number;
}

/** A car's way: its line (world units) with the distance to each point, and its pieces */
export interface LanePath {
  readonly xs: Float32Array;
  readonly zs: Float32Array;
  readonly dist: Float32Array;
  /** Each point's place on its segment (the segment's own parameter, 0 at its a end, 1 at b): every way along a segment
   * measures a car's place on it alike, however finely it was drawn (tripCars.ts lanePathOf); without it, the distance */
  readonly ts?: Float32Array;
  readonly total: number;
  readonly pieces: readonly LanePiece[];
}

/** A car on the road */
export interface LaneCar {
  readonly id: number;
  readonly path: LanePath;
  /** Driving the way backwards (from its end to its start: home from work) */
  readonly rev: boolean;
  /** Its length (world units) and how fast it goes against a car (an ox cart 0.3) */
  readonly length: number;
  readonly slow: number;
  /** How far it has come along its way, and its speed (world units, a second) */
  s: number;
  v: number;
  /** Its lane (0 the kerb's) and where it is across the lanes now, easing to it */
  lane: number;
  shift: number;
  /** How far it has driven in all (world units): its wheels turn by it */
  odometer: number;
  /** Whatever the drawer keeps with it (its model) */
  readonly tag: number;
  /** The junction it may cross, and when it began to wait at one (seconds) */
  holding: number;
  waiting: number;
  /** The last time it changed lanes */
  changed: number;
  /** Its piece now (an index into its way's pieces), kept as it goes */
  piece: number;
  done: boolean;
}

/** The car-following numbers in metres and seconds (scaled to world units by the view's metre) */
export const IDM = {
  /** The gap kept when standing (m), the time headway (s), the most it speeds up and the braking it is comfortable with (m/s²) */
  gap: 2.0, headway: 1.2, accel: 1.4, brake: 2.6,
  /** A car comes no nearer than this to a car ahead (m), whatever happens */
  hard: 0.6,
};
/** A car waits for a junction from this far before it (m), and holds it until this far past it */
const JUNCTION_REACH_M = 12;
const JUNCTION_CLEAR_M = 3;
/** A car waits this far from the junction's middle (m): half the road it crosses, and a metre */
const STOP_LINE_M = 4.5;
/** A car that has waited this long at a junction goes (s): no knot of cars stands for ever */
const JUNCTION_PATIENCE = 8;
/** A lane change takes about this long (s), and a car changes again only after this long */
const SHIFT_SECONDS = 1.6;
const CHANGE_COOLDOWN = 4;

/** Where a car is on its segment (world units from the segment's start the way the car drives), and its bucket key */
interface Placed { car: LaneCar; key: number; u: number; piece: LanePiece; ahead: LaneCar | null; gap: number; leadV: number }

/** The piece of a way at distance d along it, starting from a guess */
export function pieceAt(path: LanePath, d: number, guess = 0): number {
  const pieces = path.pieces;
  let k = Math.max(0, Math.min(pieces.length - 1, guess));
  while (k > 0 && d < pieces[k].start) k--;
  while (k < pieces.length - 1 && d >= pieces[k].end) k++;
  return k;
}

/** How far along its way a car is (from the way's start) */
export const along = (car: LaneCar): number => car.rev ? car.path.total - car.s : car.s;

/** The lanes of traffic and the junctions between them */
export class LaneTraffic {
  readonly cars: LaneCar[] = [];
  private nextId = 1;
  /** Each junction's cars allowed across now, with the road each comes in by and the road it leaves by */
  private readonly junctions = new Map<number, Map<LaneCar, [number, number]>>();
  private readonly buckets = new Map<number, Placed[]>();
  private readonly placed = new Map<LaneCar, Placed>();
  private clock = 0;

  /** metre: world units a metre */
  constructor(private readonly metre: number) {}

  /** Puts a car on its way `s` along (from the end it starts at), if the lane there is clear; the car, or null */
  add(path: LanePath, rev: boolean, s: number, lane: number, length: number, slow: number, tag: number): LaneCar | null {
    const car: LaneCar = { id: this.nextId++, path, rev, length, slow, s, v: 0, lane: 0, shift: 0, odometer: 0, tag, holding: -1,
      waiting: -1, changed: -Infinity, piece: 0, done: false };
    const k = pieceAt(path, along(car));
    car.piece = k;
    const p = path.pieces[k];
    car.lane = car.shift = Math.max(0, Math.min(p.lanes - 1, lane));
    car.v = p.speed * slow * 0.6;
    // ... only where no car stands near it in that lane
    const key = this.key(p, rev, car.lane), u = this.u(car, p);
    for (const other of this.buckets.get(key) ?? []) {
      if (Math.abs(other.u - u) < (length + other.car.length) / 2 + IDM.gap * this.metre) return null;
    }
    this.cars.push(car);
    const placed: Placed = { car, key, u, piece: p, ahead: null, gap: Infinity, leadV: 0 };
    this.placed.set(car, placed);
    let bucket = this.buckets.get(key);
    if (!bucket) this.buckets.set(key, bucket = []);
    bucket.push(placed);
    bucket.sort((a, b) => a.u - b.u);
    return car;
  }

  /** Takes a car off the road */
  remove(car: LaneCar): void {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.release(car);
    const placed = this.placed.get(car);
    if (placed) {
      const bucket = this.buckets.get(placed.key);
      if (bucket) { const j = bucket.indexOf(placed); if (j >= 0) bucket.splice(j, 1); }
      this.placed.delete(car);
    }
  }

  clear(): void { this.cars.length = 0; this.junctions.clear(); this.buckets.clear(); this.placed.clear(); }

  /** A bucket: the road segment, the way along it and the lane */
  private key(p: LanePiece, rev: boolean, lane: number): number {
    return (p.segment * 2 + ((p.up !== rev) ? 1 : 0)) * 8 + Math.min(7, lane);
  }

  /** Where a car is on its segment, from the segment's start the way the car drives */
  private u(car: LaneCar, p: LanePiece): number {
    const ts = car.path.ts;
    if (ts) {
      // the segment's parameter at the car, from the way's points either side of it
      const { dist } = car.path, d = along(car);
      let lo = p.first ?? 0, hi = dist.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (dist[mid] <= d) lo = mid; else hi = mid; }
      const span = dist[hi] - dist[lo], f = span > 0 ? Math.max(0, Math.min(1, (d - dist[lo]) / span)) : 0;
      // (a point shared by two pieces carries the parameter of the piece it ends; the next starts again from its own)
      let t0 = ts[lo];
      if (lo === p.first || (p.first === undefined && dist[lo] <= p.start + 1e-3)) t0 = p.t0 ?? (p.up ? p.entry / p.length : 1 - p.entry / p.length);
      const t = t0 + (ts[hi] - t0) * f, up = p.up !== car.rev;
      return (up ? t : 1 - t) * p.length;
    }
    const into = along(car) - p.start;
    // the way's own direction along the piece; a car driving the way backwards meets the segment from its other end
    const fromWayStart = p.entry + into;
    return car.rev ? p.length - fromWayStart : fromWayStart;
  }

  private release(car: LaneCar): void {
    if (car.holding < 0) return;
    const j = this.junctions.get(car.holding);
    if (j) { j.delete(car); if (!j.size) this.junctions.delete(car.holding); }
    car.holding = -1;
  }

  /** The junction ahead of a car on its piece (-1 at its way's end), and how far off it is */
  private junctionAhead(car: LaneCar, p: LanePiece): { node: number; distance: number } {
    const d = along(car);
    return car.rev ? { node: p.nodeStart, distance: d - p.start } : { node: p.nodeEnd, distance: p.end - d };
  }

  /** The piece after a car's piece the way it drives, or null at its end */
  private nextPiece(car: LaneCar): LanePiece | null {
    const k = car.piece + (car.rev ? -1 : 1);
    return k >= 0 && k < car.path.pieces.length ? car.path.pieces[k] : null;
  }

  /** One step of `dt` seconds: every car follows the one ahead of it, changes lane, waits at junctions and moves on */
  step(dt: number): void {
    if (dt <= 0) return;
    this.clock += dt;
    const m = this.metre;
    // Where each car is, in its bucket, sorted along its lane
    this.buckets.clear();
    const active: Placed[] = [];
    for (const car of this.cars) {
      if (car.done) continue;
      car.piece = pieceAt(car.path, along(car), car.piece);
      const p = car.path.pieces[car.piece], lane = Math.max(0, Math.min(p.lanes - 1, car.lane));
      car.lane = lane;
      const placed = this.placed.get(car)!;
      placed.key = this.key(p, car.rev, lane); placed.u = this.u(car, p); placed.piece = p; placed.ahead = null;
      placed.gap = Infinity; placed.leadV = 0;
      let bucket = this.buckets.get(placed.key);
      if (!bucket) this.buckets.set(placed.key, bucket = []);
      bucket.push(placed);
      active.push(placed);
    }
    for (const bucket of this.buckets.values()) bucket.sort((a, b) => a.u - b.u);
    // The car ahead of each: the next in its bucket, else the last of the bucket it goes on into
    for (const bucket of this.buckets.values()) {
      for (let i = 0; i < bucket.length; i++) {
        const me = bucket[i], next = bucket[i + 1];
        if (next) {
          me.ahead = next.car; me.gap = next.u - me.u - (next.car.length + me.car.length) / 2; me.leadV = next.car.v;
          continue;
        }
        const after = this.nextPiece(me.car);
        if (!after) continue;
        const nextBucket = this.buckets.get(this.key(after, me.car.rev, Math.min(after.lanes - 1, me.car.lane)));
        // the first car on the next piece past where this one comes onto it
        const tIn = me.car.rev ? after.t1 : after.t0;
        const enterU = tIn !== undefined ? ((after.up !== me.car.rev) ? tIn : 1 - tIn) * after.length
          : me.car.rev ? after.length - (after.entry + (after.end - after.start)) : after.entry;
        const first = nextBucket?.find(o => o.car !== me.car && o.u >= enterU - 0.01);
        if (!first) continue;
        const left = this.junctionAhead(me.car, me.piece).distance;
        me.ahead = first.car; me.gap = left + (first.u - enterU) - (first.car.length + me.car.length) / 2; me.leadV = first.car.v;
      }
    }
    // Lane changes: a car held up by a slower one moves to a free lane of its way
    for (const me of active) {
      const car = me.car, p = me.piece;
      car.shift += Math.sign(car.lane - car.shift) * Math.min(Math.abs(car.lane - car.shift), dt / SHIFT_SECONDS);
      if (p.lanes < 2 || !me.ahead || this.clock - car.changed < CHANGE_COOLDOWN) continue;
      const want = p.speed * car.slow;
      if (me.gap > 18 * m || me.leadV > want * 0.85) continue;
      for (const lane of [car.lane + 1, car.lane - 1]) {
        if (lane < 0 || lane >= p.lanes) continue;
        const others = this.buckets.get(this.key(p, car.rev, lane)) ?? [];
        const clear = others.every(o => o.u + o.car.length / 2 < me.u - car.length / 2 - 8 * m || o.u - o.car.length / 2 > me.u + car.length / 2 + 6 * m);
        if (!clear) continue;
        car.lane = lane; car.changed = this.clock;
        break;
      }
    }
    // Junctions: a car near one asks to cross; it may if none is crossing from another road, else it waits at the line
    for (const me of active) {
      const car = me.car, { node, distance } = this.junctionAhead(car, me.piece);
      // past the junction it held, by enough, it lets it go
      if (car.holding >= 0 && car.holding !== node) {
        const before = car.path.pieces[car.piece + (car.rev ? 1 : -1)];
        const passed = before ? (car.rev ? before.start - along(car) : along(car) - before.end) : Infinity;
        if (passed > JUNCTION_CLEAR_M * m + car.length / 2 || !before) this.release(car);
      }
      if (node < 0 || distance > JUNCTION_REACH_M * m || car.holding === node) continue;
      // it may cross with cars coming in by its own road, or coming the other way along the road it goes on by and
      // leaving by the road it comes in by (two ways of one road, side by side); any other movement crosses its own
      const into = me.piece.segment, onto = this.nextPiece(car)?.segment ?? -1, j = this.junctions.get(node);
      let free = car.waiting >= 0 && this.clock - car.waiting > JUNCTION_PATIENCE;
      if (!free) {
        free = true;
        if (j) for (const [, [a, b]] of j) if (!(a === into || (a === onto && b === into))) { free = false; break; }
      }
      if (free && car.holding < 0) {
        if (!j) this.junctions.set(node, new Map([[car, [into, onto]]])); else j.set(car, [into, onto]);
        car.holding = node; car.waiting = -1;
      } else {
        if (car.waiting < 0) car.waiting = this.clock;
        // the stop line, as a car standing there: clear of the road it crosses (half a road's width and a metre)
        const stop = distance - car.length / 2 - STOP_LINE_M * m;
        if (stop < me.gap) { me.gap = Math.max(0, stop); me.leadV = 0; }
      }
    }
    // Follow (the intelligent driver model) and move
    const s0 = IDM.gap * m, a = IDM.accel * m, b = IDM.brake * m, hard = IDM.hard * m;
    for (const me of active) {
      const car = me.car, want = Math.max(0.5 * m, me.piece.speed * car.slow);
      const gap = me.gap;
      let accel: number;
      if (gap === Infinity) accel = a * (1 - (car.v / want) ** 4);
      else {
        const desired = s0 + Math.max(0, car.v * IDM.headway + car.v * (car.v - me.leadV) / (2 * Math.sqrt(a * b)));
        accel = a * (1 - (car.v / want) ** 4 - (desired / Math.max(0.01, gap)) ** 2);
      }
      car.v = Math.max(0, car.v + Math.max(-4 * b, accel) * dt);
      let move = car.v * dt;
      // never into the car ahead
      if (gap !== Infinity) move = Math.min(move, Math.max(0, gap - hard));
      if (move < car.v * dt) car.v = move / dt;
      car.s = Math.min(car.path.total, car.s + move);
      car.odometer += move;
      if (car.s >= car.path.total - 1e-6) { car.done = true; this.release(car); }
    }
  }

  /** Where a car is drawn: its place (world units, keeping left in its lane) and the way it faces (x, z of a unit vector) */
  pose(car: LaneCar, out: { x: number; z: number; dx: number; dz: number }): typeof out {
    const p = car.path.pieces[car.piece], d = along(car);
    // keeping left (Thailand): the lane's middle, left of the way it faces, along a side line mitred at every bend so
    // the car never hops at a corner; it faces the way that line takes it
    const side = (car.shift + 0.5) * p.laneWidth / Math.max(1, p.lanes) * (car.rev ? -1 : 1);
    const ahead = (car.rev ? -1 : 1) * Math.max(0.25, Math.min(1.5, car.length * 0.25));
    sideAt(car.path, d, side, out);
    const x = out.x, z = out.z;
    // a little ahead of it the way it goes (or behind it, at its way's end)
    const fore = d + ahead >= 0 && d + ahead <= car.path.total;
    sideAt(car.path, fore ? d + ahead : d - ahead, side, out);
    let dx = fore ? out.x - x : x - out.x, dz = fore ? out.z - z : z - out.z;
    let l = Math.hypot(dx, dz);
    if (l < 1e-9) {
      // at the very end of its way: the way's own last direction
      const n = car.path.xs.length - 1;
      dx = (car.path.xs[n] - car.path.xs[n - 1]) * (car.rev ? -1 : 1); dz = (car.path.zs[n] - car.path.zs[n - 1]) * (car.rev ? -1 : 1);
      l = Math.hypot(dx, dz) || 1;
    }
    out.x = x; out.z = z; out.dx = dx / l; out.dz = dz / l;
    return out;
  }
}

/** Each way's left normals at its points, mitred (longer at a bend so the side line keeps its distance), made once */
const mitres = new WeakMap<LanePath, Float32Array>();
function mitresOf(path: LanePath): Float32Array {
  let m = mitres.get(path);
  if (m) return m;
  const { xs, zs } = path, n = xs.length;
  m = new Float32Array(n * 2);
  const left = (i: number): [number, number] => {
    const dx = xs[i + 1] - xs[i], dz = zs[i + 1] - zs[i], l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  };
  for (let i = 0; i < n; i++) {
    const a = left(Math.max(0, i - 1)), b = left(Math.min(n - 2, i));
    let nx = a[0] + b[0], nz = a[1] + b[1];
    const l = Math.hypot(nx, nz);
    if (l < 1e-6) { nx = b[0]; nz = b[1]; } else { nx /= l; nz /= l; }
    // 1 / cos of half the turn, kept within twice the width at a hairpin
    const k = Math.min(2, 1 / Math.max(0.5, nx * b[0] + nz * b[1]));
    m[i * 2] = nx * k; m[i * 2 + 1] = nz * k;
  }
  mitres.set(path, m);
  return m;
}

/** The point `side` to the left of a way (world units; negative to the right), `d` along it */
function sideAt(path: LanePath, d: number, side: number, out: { x: number; z: number }): void {
  const { xs, zs, dist } = path, m = mitresOf(path);
  let lo = 0, hi = dist.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (dist[mid] <= d) lo = mid; else hi = mid; }
  const span = dist[hi] - dist[lo], f = span > 0 ? Math.max(0, Math.min(1, (d - dist[lo]) / span)) : 0;
  const nx = m[lo * 2] + (m[hi * 2] - m[lo * 2]) * f, nz = m[lo * 2 + 1] + (m[hi * 2 + 1] - m[lo * 2 + 1]) * f;
  out.x = xs[lo] + (xs[hi] - xs[lo]) * f + nx * side;
  out.z = zs[lo] + (zs[hi] - zs[lo]) * f + nz * side;
}
