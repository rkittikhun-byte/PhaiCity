/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festivals in the 3D view (docs/GAME_DESIGN.md section 5; src/festivals.ts). The core holds a festival at its
// month's turn and keeps what it held on the map (gameMap.festivals.held); the view only reads that, never writes it,
// and dresses the town for it:
// - strings of paper lanterns, or of small flags, hung between bamboo poles along the streets round the ruler's house
//   (the town without one) and the town's built-up blocks, and across them now and then, lit at night (owner, 21 Oct
//   2026: single flags along every road near the house read as litter, "มันมีอะไรมารกหน้าจอมากๆ"); none along open road
//   with nothing built beside it, and none for a festival the people hold quietly (src/festivals.ts festivalsShown);
// - at Loy Krathong, krathong with their candles drifting along the canals and rivers near the town;
// - at Yi Peng, sky lanterns rising into the night sky and drifting with the wind;
// - at Bun Bang Fai, rockets going up from beside the town on trails of smoke.
// A grand festival has more of each. Each festival's look shows only while it is held, its month, and fades in a few
// seconds after (owner, 21 Oct 2026, of Bun Bang Fai's smoke still hanging over a town in March: "ไอ้ขาวๆ ลอยขึ้นมาคืออะไร";
// docs/design/LOOK_BOOK.md); the bunting along the roads is the newest festival's. No temple or palace ornaments, no
// images: lanterns, flags, krathong and rockets only.
// Light on the graphics card: every kind of thing is one instanced mesh (nine draws in all), placed again only when
// the festivals or the roads change; only the moving things (krathong, sky lanterns, smoke) are moved each frame, a few
// hundred at most. Colours from src/theme/tokens.ts SCENE.festival.

import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, type Material, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  Vector3 } from 'three';
import { SCENE } from '../../theme/tokens.js';
import { isWaterTile } from '../../canals.js';
import { halfWidth, type Point } from '../../roadGeometry.js';
import { FIELD_BASE, FIELD_LAST } from '../../tileValues.js';

/** What the view reads of the map */
export interface FestivalViewMap {
  readonly width: number;
  readonly height: number;
  readonly festivals?: { readonly held?: ReadonlyArray<{ readonly id: string; readonly scale: string; readonly quiet?: boolean }> } | null;
  readonly rulerHouse?: { readonly x: number; readonly y: number } | null;
  readonly town?: { readonly x: number; readonly y: number } | null;
  /** Each tile's canal level, 0 where none was dug (src/canals.ts): a krathong keeps to a canal's middle */
  readonly canals?: Uint8Array | null;
  getTileValue(x: number, y: number): number;
}

/** The ground: its height, and the water's surface on water tiles (heightfield.ts) */
export interface FestivalGround {
  sample(x: number, z: number): number;
  readonly water?: Float32Array;
}

/** A road as drawn (roadCurves.ts drawnLines) */
export interface FestivalLine { readonly points: readonly Point[]; readonly rail: boolean; readonly level?: number }

type Bunting = 'lantern' | 'flag';
interface Touches { bunting: Bunting; colours: readonly number[]; krathong?: boolean; sky?: boolean; rockets?: boolean }
const F = SCENE.festival;
/** How each festival dresses the town */
export const FESTIVAL_TOUCHES: Readonly<Record<string, Touches>> = {
  new_year: { bunting: 'lantern', colours: F.lanterns },
  songkran: { bunting: 'flag', colours: F.songkran },
  loy_krathong: { bunting: 'lantern', colours: F.lanterns, krathong: true },
  yi_peng: { bunting: 'lantern', colours: F.lanterns, sky: true },
  bun_bang_fai: { bunting: 'flag', colours: F.rocketFlags, rockets: true },
  silk: { bunting: 'flag', colours: F.silk },
  vegetarian: { bunting: 'flag', colours: F.vegetarian },
};

/** The most of each thing, held grandly; a modest festival has MODEST_SHARE of them. The bunting's poles: a pole stands
 * every POLE_SPACING metres along a street, on both sides */
export const MAX_POLES = 120, MAX_KRATHONG = 140, MAX_SKY_LANTERNS = 120, MAX_ROCKETS = 2;
export const MODEST_SHARE = 0.5;
const PUFFS_PER_ROCKET = 28;
/** The bunting, in metres: poles this far apart along a street and this tall, the cords hung from their tops sagging this
 * much (more across the street), a flag every PENNANT_GAP along a cord and a lantern every LANTERN_GAP; a string across the
 * street at every ACROSS_EVERY-th pair of poles */
export const POLE_SPACING = 16;
const POLE_HEIGHT = 5, SAG = 0.6, SAG_ACROSS = 1.1, PENNANT_GAP = 1, LANTERN_GAP = 2.4, ACROSS_EVERY = 2;
/** Small things are drawn this much bigger than they are, so they read from the usual height over the town */
const READ = 1.6;
/** Flags and lanterns at most, for the most poles (a cord between two poles has about 14 flags or 5 lanterns) */
export const MAX_PENNANTS = 2400, MAX_LANTERNS = 900, MAX_CORDS = 2 * 2 * MAX_POLES;
/** The streets dressed: within VENUE_TILES tiles of the venue, or with something built within a tile of the pole, never
 * farther than BUNTING_RADIUS world units (10 a tile) from the venue; how far its people go to float krathong (metres:
 * the town's nearest lake, river or canal; Mueang Khon Kaen's is about 800 m off) */
export const VENUE_TILES = 4, BUNTING_RADIUS = 400;
const KRATHONG_METRES = 1500;
const FADE_IN = 2, FADE_OUT = 3;
/** The roads are looked over again this often while the town is dressed, for new ones */
const REPLACE_SECONDS = 15;

/** A small hash in [0, 1): the same things in the same places every time, without Math.random */
const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

interface Show { id: string; scale: string; since: number; leaving: number | null }
interface Krathong { tile: number; to: number; x: number; z: number; tx: number; tz: number; steps: number; spread: number }

const tMatrix = new Matrix4(), tPos = new Vector3(), tScale = new Vector3(), tQuat = new Quaternion(), tColour = new Color();
const UP = new Vector3(0, 1, 0), ALONG = new Vector3(1, 0, 0), tDir = new Vector3();
/** A flag blows out from its cord, so it shows from the camera above the town */
const FLAG_LEAN = 0.9;
const tLean = new Quaternion();

/** Whether a tile has something built on it: a home, shop, factory or any building of the ruler's, not a field */
export const isBuilt = (value: number): boolean => value >= 240 && !(value >= FIELD_BASE && value <= FIELD_LAST);

/** One piece of the bunting: where it is, how it is turned, its size, and a flag's or lantern's colour */
interface Piece { x: number; y: number; z: number; q: Quaternion; sx: number; sy: number; sz: number; colour: number }
/** A pole the bunting may hang from: on which line, the how-many-th along it, which side of the road, and where */
interface Pole { line: number; k: number; side: number; x: number; z: number; d: number }
type Bunted = { poles: Piece[]; cords: Piece[]; hung: Piece[]; flag: boolean };
const NO_BUNTING = (): Bunted => ({ poles: [], cords: [], hung: [], flag: true });

/** A flag: a small pennant hanging from its cord, along +X, its point down */
function pennantGeometry(width: number, drop: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-width / 2, 0, 0, width / 2, 0, 0, 0, -drop, 0], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  return geometry;
}

/** A mesh of instances whose colour each instance may set, drawn only while some are shown */
function instanced(geometry: ConstructorParameters<typeof InstancedMesh>[0], material: Material, count: number,
                   name: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return mesh;
}

export class CityFestivals {
  readonly root = new Group();
  private readonly shows = new Map<string, Show>();
  /** What was placed for, and when */
  private placedFor = '';
  private placedAt = -Infinity;
  /** The road lines placed along: they are built again (in a worker) after the city opens and as roads are drawn */
  private placedLines: ReadonlyArray<FestivalLine> | null = null;
  private readonly lantern: InstancedMesh;
  private readonly flag: InstancedMesh;
  private readonly pole: InstancedMesh;
  private readonly cord: InstancedMesh;
  private readonly krathongBase: InstancedMesh;
  private readonly krathongFlame: InstancedMesh;
  private readonly skyLantern: InstancedMesh;
  private readonly smoke: InstancedMesh;
  private readonly rocket: InstancedMesh;
  private readonly lanternMaterial: MeshBasicMaterial;
  private readonly flameMaterial: MeshBasicMaterial;
  private readonly skyMaterial: MeshBasicMaterial;
  /** The bunting as placed: its poles, its cords and the flags or lanterns on them */
  private bunting: Bunted = NO_BUNTING();
  private krathong: Krathong[] = [];
  private venue: { x: number; z: number } | null = null;
  private strengthShown = -1;
  private lastSeconds = 0;

  /** size: the scale of the view's small things (sprites.size: 1, or a real-scale city map's units a metre); units:
   * world units a metre on a real-scale city map, else null (roadGeometry.ts realUnits) */
  constructor(private readonly map: FestivalViewMap, private readonly ground: FestivalGround, private readonly size = 1,
              private readonly units: number | null = null) {
    this.root.name = 'festivals';
    // About twice their real size, so they read from the usual height over the town (a real 40 cm flag is lost at once);
    // the bunting READ times
    const s = size * 2, r = size * READ;
    this.lanternMaterial = new MeshBasicMaterial({ toneMapped: false });
    this.lantern = instanced(new IcosahedronGeometry(0.28 * r, 1).scale(1, 1.25, 1), this.lanternMaterial, MAX_LANTERNS, 'festival_lanterns');
    this.flag = instanced(pennantGeometry(0.62 * r, 0.75 * r), new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide }),
      MAX_PENNANTS, 'festival_flags');
    // A pole one unit tall from its foot, and a cord one unit long along +X, as thin as a rope seen from the usual height
    this.pole = instanced(new CylinderGeometry(0.06 * r, 0.08 * r, 1, 5).translate(0, 0.5, 0),
      new MeshStandardMaterial({ color: F.pole, roughness: 0.9 }), MAX_POLES, 'festival_poles');
    this.cord = instanced(new BoxGeometry(1, 0.05 * r, 0.05 * r), new MeshBasicMaterial({ color: F.cord }), MAX_CORDS, 'festival_cords');
    this.krathongBase = instanced(new CylinderGeometry(0.25 * s, 0.18 * s, 0.12 * s, 8),
      new MeshStandardMaterial({ color: F.krathong, roughness: 0.9 }), MAX_KRATHONG, 'festival_krathong');
    this.flameMaterial = new MeshBasicMaterial({ color: F.candle, toneMapped: false });
    this.krathongFlame = instanced(new ConeGeometry(0.08 * s, 0.2 * s, 5), this.flameMaterial, MAX_KRATHONG, 'festival_candles');
    this.skyMaterial = new MeshBasicMaterial({ color: F.skyLantern, toneMapped: false });
    this.skyLantern = instanced(new CylinderGeometry(0.42 * s, 0.3 * s, 0.75 * s, 6), this.skyMaterial, MAX_SKY_LANTERNS, 'festival_sky_lanterns');
    this.smoke = instanced(new IcosahedronGeometry(0.6 * s, 1),
      new MeshStandardMaterial({ color: F.smoke, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }),
      MAX_ROCKETS * PUFFS_PER_ROCKET, 'festival_rocket_smoke');
    this.rocket = instanced(new IcosahedronGeometry(0.25 * s, 0), new MeshBasicMaterial({ color: F.flame, toneMapped: false }),
      MAX_ROCKETS, 'festival_rockets');
    this.root.add(...this.meshes());
  }

  /** The festivals the view dresses the town for now */
  get shown(): string[] { return [...this.shows.keys()]; }

  /**
   * Each frame: lines, the roads as drawn; night 0 (day) to 1 (night); seconds, the view's clock (it stops while the
   * game is paused); wind, the way the sky lanterns drift (src/wind.ts).
   */
  update(lines: ReadonlyArray<FestivalLine>, night: number, seconds: number, wind: { x: number; y: number } = { x: 1, y: 0 }): void {
    this.follow(seconds);
    if (!this.shows.size) {
      if (this.root.visible) this.clear();
      return;
    }
    this.root.visible = true;
    const sign = [...this.shows.values()].map((s) => `${s.id}:${s.scale}`).sort().join(',');
    if (sign !== this.placedFor || seconds - this.placedAt >= REPLACE_SECONDS ||
      (lines !== this.placedLines && seconds - this.placedAt >= 1)) this.place(lines, sign, seconds);
    const look = this.touches(seconds);
    if (Math.abs(look.strength.bunting - this.strengthShown) > 0.01) this.drawBunting(look.strength.bunting);
    this.lanternMaterial.color.setScalar(0.75 + 0.6 * night);
    this.flameMaterial.color.set(F.candle).multiplyScalar(0.7 + 0.8 * night);
    const dt = Math.min(0.1, Math.max(0, seconds - this.lastSeconds));
    this.lastSeconds = seconds;
    this.drawKrathong(look.strength.krathong, seconds, dt);
    this.drawSky(look.sky, look.strength.sky, night, seconds, wind);
    this.drawRockets(look.rockets, look.strength.rockets, seconds);
  }

  /** Which festivals are shown: those held, and for FADE_OUT seconds those that were */
  private follow(seconds: number): void {
    const held = (this.map.festivals?.held ?? []).filter((h) => h.scale !== 'none' && !h.quiet && FESTIVAL_TOUCHES[h.id]);
    for (const h of held) {
      const show = this.shows.get(h.id);
      if (!show) this.shows.set(h.id, { id: h.id, scale: h.scale, since: seconds, leaving: null });
      else if (show.leaving === null) show.scale = h.scale;
    }
    for (const show of [...this.shows.values()]) {
      const stillHeld = held.some((h) => h.id === show.id);
      if (show.leaving === null && !stillHeld) show.leaving = seconds;
      if (show.leaving !== null && seconds - show.leaving >= FADE_OUT) this.shows.delete(show.id);
      // A festival held again (next year) before its look faded starts afresh
      if (show.leaving !== null && stillHeld) this.shows.set(show.id, { ...show, since: seconds, leaving: null });
    }
  }

  /** How much of a festival's look shows, 0–1: it fades in when the festival begins and out when it ends */
  private strengthOf(show: Show, seconds: number): number {
    const rise = Math.min(1, Math.max(0, (seconds - show.since) / FADE_IN));
    const fall = show.leaving === null ? 1 : Math.max(0, 1 - (seconds - show.leaving) / FADE_OUT);
    return rise * fall;
  }

  /**
   * What is drawn and how strongly. The bunting along the roads is the newest festival's (two begun together, as Loy
   * Krathong and Yi Peng, share it: lanterns over flags, as many as the grander asks), so Khon Kaen's silk banners take
   * the place of Loy Krathong's lanterns; the krathong, sky lanterns and rockets each last their own festival's time.
   */
  private touches(seconds: number): { bunting: { kind: Bunting; colours: readonly number[]; share: number } | null;
      krathong: number; sky: number; rockets: number; strength: { bunting: number; krathong: number; sky: number; rockets: number } } {
    const all = [...this.shows.values()], on = all.filter((show) => show.leaving === null), pool = on.length ? on : all;
    const newest = pool.length ? Math.max(...pool.map((show) => show.since)) : 0;
    let kind: Bunting | null = null, colours: readonly number[] = [], most = 0, krathong = 0, sky = 0, rockets = 0;
    const strength = { bunting: 0, krathong: 0, sky: 0, rockets: 0 };
    for (const show of all) {
      const touch = FESTIVAL_TOUCHES[show.id], share = show.scale === 'grand' ? 1 : MODEST_SHARE, shows = this.strengthOf(show, seconds);
      if (pool.includes(show) && show.since === newest) {
        if (kind === null || (touch.bunting === 'lantern' && kind === 'flag')) { kind = touch.bunting; colours = touch.colours; }
        most = Math.max(most, share);
        strength.bunting = Math.max(strength.bunting, shows);
      }
      if (touch.krathong) { krathong = Math.max(krathong, Math.round(MAX_KRATHONG * share)); strength.krathong = Math.max(strength.krathong, shows); }
      if (touch.sky) { sky = Math.max(sky, Math.round(MAX_SKY_LANTERNS * share)); strength.sky = Math.max(strength.sky, shows); }
      if (touch.rockets) { rockets = Math.max(rockets, show.scale === 'grand' ? MAX_ROCKETS : 1); strength.rockets = Math.max(strength.rockets, shows); }
    }
    return { bunting: kind === null ? null : { kind, colours, share: most }, krathong, sky, rockets, strength };
  }

  /** Where the venue is (the ruler's house, else the town), and the bunting along the roads near it, and the water */
  private place(lines: ReadonlyArray<FestivalLine>, sign: string, seconds: number): void {
    this.placedFor = sign;
    this.placedAt = seconds;
    this.placedLines = lines;
    this.strengthShown = -1;
    const at = this.map.rulerHouse ?? this.map.town ?? { x: this.map.width / 2, y: this.map.height / 2 };
    const vx = (at.x + 0.5) * 10, vz = (at.y + 0.5) * 10;
    this.venue = { x: vx, z: vz };
    const look = this.touches(seconds), bunting = look.bunting;
    this.bunting = bunting ? this.string(lines, vx, vz, bunting) : NO_BUNTING();
    // The water near the town, for the krathong: river tiles and dug canals
    const { width, height } = this.map, tx = Math.floor(at.x), ty = Math.floor(at.y), water: number[] = [];
    // ... tiles of 10 world units, which are 10 / units metres on a real-scale city map (a world unit a metre elsewhere)
    const reach = Math.max(8, Math.round(KRATHONG_METRES / (this.units ? 10 / this.units : 10)));
    for (let y = Math.max(0, ty - reach); y <= Math.min(height - 1, ty + reach); y++) {
      for (let x = Math.max(0, tx - reach); x <= Math.min(width - 1, tx + reach); x++) {
        if (isWaterTile(this.map.getTileValue(x, y) & 1023)) water.push(y * width + x);
      }
    }
    // ... the nearest first, so a town by a river floats its krathong at its own landing
    water.sort((a, b) => Math.hypot(a % width - tx, Math.floor(a / width) - ty) - Math.hypot(b % width - tx, Math.floor(b / width) - ty));
    const wanted = look.krathong, s = this.size;
    const wet = new Set(water);
    if (this.krathong.length !== wanted || !this.krathong.every((k) => wet.has(k.tile))) {
      this.krathong = [];
      const pool = Math.min(water.length, Math.max(8, Math.round(wanted / 2)));
      for (let k = 0; k < wanted && pool > 0; k++) {
        const tile = water[Math.floor(hash(k * 13 + 1) * pool)];
        const spread = this.map.canals?.[tile] ? 1.1 * s : 3.5 * s;
        const x = (tile % width + 0.5) * 10 + (hash(k * 5 + 2) - 0.5) * 2 * spread;
        const z = (Math.floor(tile / width) + 0.5) * 10 + (hash(k * 11 + 4) - 0.5) * 2 * spread;
        this.krathong.push({ tile, to: tile, x, z, tx: x, tz: z, steps: k, spread });
      }
    }
  }

  /**
   * The bunting along the streets near the venue: a pole every POLE_SPACING metres on both sides of a street where it is
   * near the venue or has something built beside it, the nearest first, as many as the festival asks; a cord from each
   * pole to the next along its side, and across the street now and then, sagging between them, with flags or lanterns
   * hung along it. A pole with no cord to another is left out, so nothing stands alone.
   */
  private string(lines: ReadonlyArray<FestivalLine>, vx: number, vz: number,
                 bunting: { kind: Bunting; colours: readonly number[]; share: number }): Bunted {
    const s = this.size, spacing = POLE_SPACING * s, { width, height } = this.map;
    const builtNear = (x: number, z: number): boolean => {
      const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x2 = tx - 1; x2 <= tx + 1; x2++) {
        if (x2 >= 0 && y >= 0 && x2 < width && y < height && isBuilt(this.map.getTileValue(x2, y) & 1023)) return true;
      }
      return false;
    };
    const candidates: Pole[] = [];
    lines.forEach((line, n) => {
      if (line.rail) return;
      const reach = halfWidth(line.level ?? 1, this.units) + 0.6 * s;
      let carried = 0, k = 0;
      for (let i = 1; i < line.points.length; i++) {
        const [ax, az] = line.points[i - 1], [bx, bz] = line.points[i], len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-6) continue;
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        for (let t = (spacing - (carried % spacing)) % spacing; t < len; t += spacing, k++) {
          const px = ax + (bx - ax) * t / len, pz = az + (bz - az) * t / len, d = Math.hypot(px - vx, pz - vz);
          if (d > BUNTING_RADIUS) continue;
          for (const side of [-1, 1]) {
            const x = px + nx * reach * side, z = pz + nz * reach * side;
            if (d <= VENUE_TILES * 10 || builtNear(x, z)) candidates.push({ line: n, k, side, x, z, d });
          }
        }
        carried += len;
      }
    });
    candidates.sort((a, b) => a.d - b.d);
    const keyOf = (p: { line: number; k: number; side: number }): string => `${p.line}:${p.k}:${p.side}`;
    const chosen = new Map(candidates.slice(0, Math.round(MAX_POLES * bunting.share)).map((p) => [keyOf(p), p]));
    // The cords: along each side to the next pole, and across the street at every ACROSS_EVERY-th pair
    const spans: [Pole, Pole, number][] = [];
    for (const p of chosen.values()) {
      const next = chosen.get(keyOf({ ...p, k: p.k + 1 }));
      if (next && Math.hypot(next.x - p.x, next.z - p.z) < spacing * 1.6) spans.push([p, next, SAG]);
      const other = p.side < 0 ? chosen.get(keyOf({ ...p, side: 1 })) : undefined;
      if (other && p.k % ACROSS_EVERY === 0) spans.push([p, other, SAG_ACROSS]);
    }
    const top = POLE_HEIGHT * s, flag = bunting.kind === 'flag', base = new Map<Pole, number>(), out = NO_BUNTING();
    out.flag = flag;
    for (const [a, b] of spans) for (const p of [a, b]) {
      if (base.has(p)) continue;
      const y = this.ground.sample(p.x, p.z);
      base.set(p, y);
      out.poles.push({ x: p.x, y, z: p.z, q: new Quaternion(), sx: 1, sy: top, sz: 1, colour: 0 });
    }
    let n = 0;
    for (const [a, b, sag] of spans) {
      const ya = base.get(a)! + top * 0.96, yb = base.get(b)! + top * 0.96, dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz), drop = sag * s;
      const at = (u: number): [number, number, number] => [a.x + dx * u, ya + (yb - ya) * u - drop * 4 * u * (1 - u), a.z + dz * u];
      // The cord in two straight halves, down to its lowest point and up again
      for (const [u0, u1] of [[0, 0.5], [0.5, 1]]) {
        const [x0, y0, z0] = at(u0), [x1, y1, z1] = at(u1), l = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
        const q = new Quaternion().setFromUnitVectors(ALONG, tDir.set(x1 - x0, y1 - y0, z1 - z0).normalize());
        out.cords.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, q, sx: l, sy: 1, sz: 1, colour: 0 });
      }
      const gap = (flag ? PENNANT_GAP : LANTERN_GAP) * s, count = Math.max(1, Math.floor(len / gap) - 1);
      const turn = new Quaternion().setFromUnitVectors(ALONG, tDir.set(dx, 0, dz).normalize());
      for (let i = 1; i <= count; i++) {
        const u = i / (count + 1), [x, y, z] = at(u), colour = bunting.colours[Math.floor(hash(n * 7 + 3) * bunting.colours.length)];
        n++;
        if (flag) {
          // Each flag blown a little out from the cord, the other way from the last, so the string shows from above
          const q = turn.clone().multiply(tLean.setFromAxisAngle(ALONG, (n % 2 ? 1 : -1) * FLAG_LEAN));
          out.hung.push({ x, y, z, q, sx: 1, sy: 1, sz: 1, colour });
        } else {
          out.hung.push({ x, y: y - 0.45 * READ * s, z, q: new Quaternion(), sx: 1, sy: 1, sz: 1, colour });
        }
      }
    }
    out.poles.length = Math.min(out.poles.length, MAX_POLES);
    out.cords.length = Math.min(out.cords.length, MAX_CORDS);
    out.hung.length = Math.min(out.hung.length, flag ? MAX_PENNANTS : MAX_LANTERNS);
    return out;
  }

  private drawBunting(strength: number): void {
    this.strengthShown = strength;
    const k = Math.max(0.001, strength), { poles, cords, hung, flag } = this.bunting;
    const put = (mesh: InstancedMesh, pieces: readonly Piece[], coloured: boolean): void => {
      pieces.forEach((p, i) => {
        mesh.setMatrixAt(i, tMatrix.compose(tPos.set(p.x, p.y, p.z), p.q, tScale.set(p.sx * k, p.sy * k, p.sz * k)));
        if (coloured) mesh.setColorAt(i, tColour.set(p.colour));
      });
      mesh.count = pieces.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (coloured && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    put(this.pole, poles, false);
    put(this.cord, cords, false);
    put(flag ? this.flag : this.lantern, hung, true);
    (flag ? this.lantern : this.flag).count = 0;
  }

  /** Krathong drift from tile to tile along the water, slowly, each to a neighbour of the water it is on */
  private drawKrathong(strength: number, seconds: number, dt: number): void {
    const width = this.map.width, s = this.size, speed = 0.25 * s;
    let n = 0;
    for (const k of this.krathong) {
      // Move toward its next point; there, choose the next water tile beside it
      const dx = k.tx - k.x, dz = k.tz - k.z, d = Math.hypot(dx, dz);
      if (d < 0.05) {
        const x = k.to % width, y = Math.floor(k.to / width), next: number[] = [];
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= this.map.height) continue;
          const i = ny * width + nx;
          if (i !== k.tile && isWaterTile(this.map.getTileValue(nx, ny) & 1023)) next.push(i);
        }
        k.tile = k.to;
        k.steps++;
        k.to = next.length ? next[Math.floor(hash(k.steps * 31 + k.tile) * next.length)] : k.tile;
        k.tx = (k.to % width + 0.5) * 10 + (hash(k.steps * 17 + 9) - 0.5) * 2 * k.spread;
        k.tz = (Math.floor(k.to / width) + 0.5) * 10 + (hash(k.steps * 23 + 5) - 0.5) * 2 * k.spread;
      } else {
        const move = Math.min(d, speed * dt);
        k.x += dx / d * move;
        k.z += dz / d * move;
      }
      const surface = this.ground.water?.[k.tile];
      const y = (Number.isFinite(surface) ? surface as number : this.ground.sample(k.x, k.z)) + 0.06 * s;
      const bob = Math.sin(seconds * 1.7 + k.steps) * 0.02 * s;
      tQuat.setFromAxisAngle(UP, k.steps * 0.7);
      tScale.setScalar(Math.max(0.001, strength));
      this.krathongBase.setMatrixAt(n, tMatrix.compose(tPos.set(k.x, y + bob, k.z), tQuat, tScale));
      this.krathongFlame.setMatrixAt(n, tMatrix.compose(tPos.set(k.x, y + bob + 0.2 * s, k.z), tQuat, tScale));
      n++;
    }
    for (const mesh of [this.krathongBase, this.krathongFlame]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Yi Peng's lanterns: let go round the venue after dark, rising and drifting with the wind, smaller as they go */
  private drawSky(wanted: number, strength: number, night: number, seconds: number, wind: { x: number; y: number }): void {
    const venue = this.venue, s = this.size;
    const dusk = Math.min(1, Math.max(0, (night - 0.35) / 0.4));
    if (!wanted || !venue || dusk <= 0) { this.skyLantern.count = 0; return; }
    const life = 80, rise = 2.2 * s, drift = 0.9 * s, len = Math.hypot(wind.x, wind.y) || 1;
    const wx = wind.x / len, wz = wind.y / len, base = this.ground.sample(venue.x, venue.z);
    let n = 0;
    for (let k = 0; k < wanted; k++) {
      const age = (seconds + hash(k * 3 + 1) * life) % life, a = hash(k * 19 + 7) * Math.PI * 2, r = (6 + hash(k * 29 + 3) * 34) * s;
      const x = venue.x + Math.cos(a) * r + wx * age * drift + Math.sin(age * 0.3 + k) * 2 * s;
      const z = venue.z + Math.sin(a) * r + wz * age * drift + Math.cos(age * 0.27 + k) * 2 * s;
      const shrink = age > life * 0.75 ? Math.max(0, 1 - (age - life * 0.75) / (life * 0.25)) : 1;
      tQuat.identity();
      tScale.setScalar(Math.max(0.001, strength * dusk * shrink));
      this.skyLantern.setMatrixAt(n++, tMatrix.compose(tPos.set(x, base + 4 * s + age * rise, z), tQuat, tScale));
    }
    this.skyLantern.count = n;
    this.skyLantern.instanceMatrix.needsUpdate = true;
  }

  /** Bun Bang Fai's rockets: up from the fields beside the town on a leaning trail of smoke, one after another */
  private drawRockets(wanted: number, strength: number, seconds: number): void {
    const venue = this.venue, s = this.size;
    if (!wanted || !venue) { this.rocket.count = 0; this.smoke.count = 0; return; }
    // ... over the town, not across the sky: they go up beside it and come down near it
    const cycle = 11, climb = 6, height = 90 * s;
    let puffs = 0, heads = 0;
    for (let r = 0; r < wanted; r++) {
      const t = (seconds + r * cycle / wanted) % cycle, round = Math.floor((seconds + r * cycle / wanted) / cycle);
      const a = hash(round * 7 + r) * Math.PI * 2, from = 30 * s, lean = 0.1 + hash(round * 13 + r) * 0.1;
      const x0 = venue.x + Math.cos(a) * from, z0 = venue.z + Math.sin(a) * from, y0 = this.ground.sample(x0, z0);
      const at = (u: number): [number, number, number] => {
        const k = Math.min(1, Math.max(0, u));
        return [x0 + Math.cos(a) * lean * height * k * k, y0 + height * (1 - (1 - k) * (1 - k)), z0 + Math.sin(a) * lean * height * k * k];
      };
      const head = t / climb;
      if (head < 1) {
        const [hx, hy, hz] = at(head);
        tQuat.identity();
        tScale.setScalar(Math.max(0.001, strength));
        this.rocket.setMatrixAt(heads++, tMatrix.compose(tPos.set(hx, hy, hz), tQuat, tScale));
      }
      // The trail: puffs left behind the head, growing and thinning as they hang in the air
      for (let p = 0; p < PUFFS_PER_ROCKET; p++) {
        const u = p / PUFFS_PER_ROCKET;
        if (u > head) break;
        const age = t - u * climb, [px, py, pz] = at(u), fade = Math.max(0, 1 - age / (cycle - 1));
        tQuat.setFromAxisAngle(UP, p);
        tScale.setScalar(Math.max(0.001, strength * fade * (0.6 + Math.min(2.4, age * 0.5))));
        this.smoke.setMatrixAt(puffs++, tMatrix.compose(tPos.set(px + age * 0.6 * s, py + age * 0.4 * s, pz), tQuat, tScale));
      }
    }
    this.rocket.count = heads;
    this.smoke.count = puffs;
    this.rocket.instanceMatrix.needsUpdate = true;
    this.smoke.instanceMatrix.needsUpdate = true;
  }

  private clear(): void {
    for (const mesh of this.meshes()) mesh.count = 0;
    this.root.visible = false;
    this.placedFor = '';
    this.krathong = [];
    this.bunting = NO_BUNTING();
  }

  /** How many of each thing are drawn now (tests, the metrics) */
  counts(): Record<'poles' | 'cords' | 'lanterns' | 'flags' | 'krathong' | 'skyLanterns' | 'smoke' | 'rockets', number> {
    return { poles: this.pole.count, cords: this.cord.count, lanterns: this.lantern.count, flags: this.flag.count, krathong: this.krathongBase.count,
      skyLanterns: this.skyLantern.count, smoke: this.smoke.count, rockets: this.rocket.count };
  }

  /** Every mesh it draws with, the bunting's first */
  private meshes(): InstancedMesh[] {
    return [this.pole, this.cord, this.lantern, this.flag, this.krathongBase, this.krathongFlame, this.skyLantern, this.smoke, this.rocket];
  }

  dispose(): void {
    for (const mesh of this.meshes()) {
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
      mesh.dispose();
    }
    this.root.clear();
  }
}
