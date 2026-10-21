/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The yard of a power plant or a water works (owner, 21 Oct 2026: "โรงไฟฟ้า ทำไมมีพื้นที่เยอะ"): the simulation gives a
// plant a 4 × 4 block (64 m on a real-scale city map) and a water works or a waste power plant a 3 × 3 (48 m), but its
// building is drawn at its real size, smaller than that: an era model 48 m across, a procedural plant 27-33 m. The rest
// of the block was bare ground. A yard model fills it with what such a plant has round its main building, by kind and
// era: a lignite plant's coal stockpile, conveyor, ash pond, switchyard, truck yard and fence; a gas plant's tanks and
// pipe racks; a solar farm's rows of panels; a wind farm's turbines; a dam's reservoir and spillway; a nuclear plant's
// cooling tower and second containment; a water works' settling tanks, filter beds, clear-water tank, pump house and
// chemical store; a waste power plant's bunker and stack. Era 1 is small, low, earth and timber; later eras bigger and
// more industrial.
//
// The city view stands the yard as a part of the plant's placement (city/tileModels.ts plantYard), turned with it, its
// block's front at the plant's front: the yard keeps clear of `the hole`, the square the main building stands on, which
// its state gives in metres ("hw,c": the hole's half side, and how far its middle stands ahead of the block's). Built in
// metres, then drawn 10 model units a 16 m tile like every model here, so it fills its footprint and never passes it.
// One mesh in the era buildings' flat vertex-coloured material, the same model for every seed and region, so every
// yard of a kind, era and hole is one prototype the city draws as instances, with lighter copies from afar
// (city/plantYards.ts, lod.ts). Colours are the theme's (src/theme/tokens.ts). No brands, logos or signs.

import {
  Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Matrix4,
  Quaternion, SphereGeometry, Vector2, Vector3,
} from 'three';
import { RAMPS } from '../../../theme/tokens.js';
import { eraBuildingMaterial } from '../../materials/library.js';
import { countTriangles, mergeByMaterial, type GeometryPart } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';

export const YARD_KINDS = ['coal', 'gas', 'solar', 'wind', 'hydro', 'nuclear', 'water', 'waste_power'] as const;
export type YardKind = typeof YARD_KINDS[number];
export const yardId = (kind: YardKind): string => `yard.${kind}`;
export const YARD_ERAS = [1, 2, 3, 4, 5] as const;
/** The block each kind stands on, in tiles a side */
export const YARD_TILES: Readonly<Record<YardKind, number>> = {
  coal: 4, gas: 4, solar: 4, wind: 4, hydro: 4, nuclear: 4, water: 3, waste_power: 3,
};
/** Metres a tile: the yard is built in metres and drawn 10 model units a tile, as an era model is */
export const YARD_TILE_METRES = 16;
const UNITS = 10 / YARD_TILE_METRES;
/** The first era each kind is built in (src/unlocks.ts); an earlier variant is drawn as that era's */
const FIRST_ERA: Readonly<Record<YardKind, number>> = { coal: 1, gas: 2, solar: 4, wind: 4, hydro: 3, nuclear: 5, water: 1, waste_power: 4 };
/** The share of its own model a procedural plant is drawn at on a city map (city/tileModels.ts CITY_MODEL_SCALE): the
 * hole a yard keeps when its state does not give one */
export const YARD_MAIN_SHARE: Readonly<Record<YardKind, number>> = {
  coal: 0.75, gas: 0.78, solar: 0.85, wind: 0.85, hydro: 0.85, nuclear: 0.70, water: 0.95, waste_power: 0.80,
};
/** How tall each kind's yard reaches (metres), for the far view */
export const YARD_HEIGHTS: Readonly<Record<YardKind, number>> = {
  coal: 14, gas: 14, solar: 3, wind: 46, hydro: 8, nuclear: 46, water: 8, waste_power: 38,
};

/** The square the main building stands on, in the yard's metres: half its side, and how far ahead (+Z) of the block's
 * middle its own middle stands */
export interface YardHole { hw: number; c: number }
/** A hole as a state: both in whole decimetres, so a few prototypes serve a city */
export const holeState = (hole: YardHole): string => `${Math.round(hole.hw * 10) / 10},${Math.round(hole.c * 10) / 10}`;
/** The hole a procedural plant of the kind leaves, stood with its front at the block's front */
export function defaultHole(kind: YardKind): YardHole {
  const half = YARD_TILES[kind] * YARD_TILE_METRES / 2, hw = (YARD_TILES[kind] * 5 - 0.5) * YARD_MAIN_SHARE[kind];
  return { hw, c: half - hw };
}
export function parseHole(kind: YardKind, state: string | undefined): YardHole {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(state ?? '');
  if (!m) return defaultHole(kind);
  const half = YARD_TILES[kind] * YARD_TILE_METRES / 2, hw = Math.min(half, Math.max(0, Number(m[1])));
  return { hw, c: Math.max(-(half - hw), Math.min(half - hw, Number(m[2]))) };
}
/** Whether a yard is worth drawing round a hole: at least a few metres of ground beside or behind the building */
export function yardFits(kind: YardKind, hole: YardHole): boolean {
  return YARD_TILES[kind] * YARD_TILE_METRES / 2 - hole.hw >= 3;
}

// ---- Colours, the theme's ramps ----------------------------------------------------------------------------------------
const C = {
  earth: RAMPS.clay[500], laterite: RAMPS.clay[400], gravel: RAMPS.sand[400], concrete: RAMPS.sand[300],
  concreteLight: RAMPS.sand[200], asphalt: RAMPS.sand[700], coal: RAMPS.sand[950], coalDust: RAMPS.sand[900],
  ash: RAMPS.sand[500], ashWater: RAMPS.water[500], water: RAMPS.water[300], deepWater: RAMPS.water[400],
  timber: RAMPS.sand[600], timberDark: RAMPS.sand[700], thatch: RAMPS.gold[500], bamboo: RAMPS.gold[600],
  brick: RAMPS.clay[600], zinc: RAMPS.water[200], steel: RAMPS.water[700], steelLight: RAMPS.water[500],
  white: RAMPS.sand[50], offWhite: RAMPS.sand[100], insulator: RAMPS.sand[100], transformer: RAMPS.water[600],
  gasPipe: RAMPS.gold[400], panel: RAMPS.lavender[900], panelNew: RAMPS.lavender[700], panelFrame: RAMPS.sand[300],
  truckCab: RAMPS.clay[500], truckBed: RAMPS.sand[600], tyre: RAMPS.sand[900], ox: RAMPS.sand[500],
  hedge: RAMPS.rice[500], grass: RAMPS.rice[400], leaf: RAMPS.rice[600], jar: RAMPS.clay[700], drum: RAMPS.water[600],
  chemical: RAMPS.gold[300], green: RAMPS.rice[300], glass: RAMPS.water[100], stack: RAMPS.sand[200], band: RAMPS.chili[500],
} as const;

/** A piece of the yard as built, in its metres, for the tests: what it is and the box it takes */
export interface YardPiece { feature: string; box: Box3 }
const PIECES = new WeakMap<Group, YardPiece[]>();
/** The pieces a yard model was built of (metres, before it is drawn 10 units a tile) */
export function yardPieces(root: Group): readonly YardPiece[] { return PIECES.get(root) ?? []; }

const up = new Vector3(0, 1, 0), direction = new Vector3(), q = new Quaternion(), m4 = new Matrix4();

/** Builds a yard in metres, every piece in one flat vertex-coloured mesh */
class YardBuilder {
  readonly material = eraBuildingMaterial(false);
  readonly parts: GeometryPart[] = [];
  readonly pieces: YardPiece[] = [];
  feature = 'yard';

  /** Adds a geometry in metres, coloured all over */
  private push(geometry: BufferGeometry, color: number): void {
    const c = new Color(color), n = geometry.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    this.pieces.push({ feature: this.feature, box: geometry.boundingBox!.clone() });
    this.parts.push({ geometry, material: this.material });
  }
  /** Runs `make` with its pieces named `name` */
  named(name: string, make: () => void): void { const was = this.feature; this.feature = name; make(); this.feature = was; }
  /** A box w × h × d standing on y (its bottom) at (x, z), turned yaw about the vertical */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, yaw = 0): void {
    const g = new BoxGeometry(w, h, d);
    if (yaw) g.rotateY(yaw);
    this.push(g.translate(x, y + h / 2, z), color);
  }
  /** A flat pad on the ground, `t` thick */
  pad(x0: number, z0: number, x1: number, z1: number, color: number, t = 0.08, y = 0.02): void {
    this.box(Math.abs(x1 - x0), t, Math.abs(z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2, color);
  }
  /** An upright cylinder (or cone) standing on y */
  cyl(r: number, h: number, x: number, y: number, z: number, color: number, seg = 10, top = r): void {
    this.push(new CylinderGeometry(top, r, h, seg, 1).translate(x, y + h / 2, z), color);
  }
  /** A cylinder lying along x (axis 'x') or z, its middle at (x, y, z) */
  drum(r: number, length: number, x: number, y: number, z: number, color: number, axis: 'x' | 'z' = 'x', seg = 10): void {
    const g = new CylinderGeometry(r, r, length, seg, 1);
    g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateY(Math.PI / 2);
    this.push(g.translate(x, y, z), color);
  }
  /** A rod from a to b, r thick */
  rod(a: readonly [number, number, number], b: readonly [number, number, number], r: number, color: number, seg = 4): void {
    const from = new Vector3(...a), to = new Vector3(...b), length = from.distanceTo(to);
    if (length < 1e-3) return;
    direction.subVectors(to, from).normalize();
    q.setFromUnitVectors(up, direction);
    const g = new CylinderGeometry(r, r, length, seg, 1);
    g.applyMatrix4(m4.compose(from.clone().add(to).multiplyScalar(0.5), q, new Vector3(1, 1, 1)));
    this.push(g, color);
  }
  /** A ball or (half) mound, rx × ry × rz, its base at y */
  mound(rx: number, ry: number, rz: number, x: number, y: number, z: number, color: number, half = true, seg = 10): void {
    const g = new SphereGeometry(1, seg, half ? 4 : 6, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI);
    g.scale(rx, ry, rz);
    this.push(g.translate(x, half ? y : y + ry, z), color);
  }
  /** A shell turned about the vertical from [radius, height] points */
  lathe(profile: readonly [number, number][], x: number, z: number, color: number, seg = 16): void {
    this.push(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), seg).translate(x, 0, z), color);
  }
  /** A gable roof w × d over a wall top at y, its ridge along x, `rise` high: a triangular prism */
  gable(w: number, d: number, x: number, y: number, z: number, rise: number, color: number): void {
    const a = [-w / 2, w / 2], p = (i: number, e: number): number[] => [a[i], e === 2 ? rise : 0, e === 0 ? -d / 2 : e === 1 ? d / 2 : 0];
    const tri = (...v: number[][]): number[] => v.flat();
    const positions = [
      ...tri(p(0, 0), p(0, 1), p(0, 2)), ...tri(p(1, 0), p(1, 2), p(1, 1)),
      ...tri(p(0, 0), p(0, 2), p(1, 2)), ...tri(p(0, 0), p(1, 2), p(1, 0)),
      ...tri(p(0, 1), p(1, 1), p(1, 2)), ...tri(p(0, 1), p(1, 2), p(0, 2)),
      ...tri(p(0, 0), p(1, 0), p(1, 1)), ...tri(p(0, 0), p(1, 1), p(0, 1)),
    ];
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    this.push(g.translate(x, y, z), color);
  }

  finish(id: string, kind: YardKind, era: number, hole: YardHole): Group {
    const scale = new Matrix4().makeScale(UNITS, UNITS, UNITS);
    this.parts.forEach(part => part.geometry.applyMatrix4(scale));
    const root = mergeByMaterial(id, this.parts);
    this.parts.forEach(part => part.geometry.dispose());
    const tiles = YARD_TILES[kind];
    root.userData = { id, category: 'services', footprint: [tiles, tiles], tiles: [], triangles: countTriangles(root),
      regionTier: 'R3', region: 'central', yardKind: kind, era, hole: { ...hole } };
    PIECES.set(root, this.pieces);
    return root;
  }
}

// ---- The block's free ground ------------------------------------------------------------------------------------------
/** A rectangle of the yard's ground, in metres */
interface Rect { x0: number; x1: number; z0: number; z1: number }
const width = (r: Rect): number => r.x1 - r.x0, depth = (r: Rect): number => r.z1 - r.z0;
const midX = (r: Rect): number => (r.x0 + r.x1) / 2, midZ = (r: Rect): number => (r.z0 + r.z1) / 2;
/** The fence's distance in from the block's edge, and how far the yard keeps from the fence and the building */
const FENCE_IN = 0.9, EDGE = 1.6, CLEAR = 1.5;

/** The ground round the hole: behind it, in front of it (when it does not reach the front), and either side of it */
function bands(half: number, hole: YardHole): { back: Rect | null; front: Rect | null; left: Rect | null; right: Rect | null } {
  const ok = (r: Rect): Rect | null => width(r) >= 2.5 && depth(r) >= 2.5 ? r : null;
  const e = half - EDGE, hz0 = hole.c - hole.hw, hz1 = hole.c + hole.hw;
  return {
    back: ok({ x0: -e, x1: e, z0: -e, z1: hz0 - CLEAR }),
    front: ok({ x0: -e, x1: e, z0: hz1 + CLEAR, z1: e }),
    left: ok({ x0: -e, x1: -hole.hw - CLEAR, z0: Math.max(-e, hz0), z1: Math.min(e, hz1) }),
    right: ok({ x0: hole.hw + CLEAR, x1: e, z0: Math.max(-e, hz0), z1: Math.min(e, hz1) }),
  };
}
/** Splits a rectangle along x at a share of its width, leaving a lane between */
function splitX(r: Rect, share: number, lane = 2): [Rect, Rect] {
  const x = r.x0 + width(r) * share;
  return [{ ...r, x1: x - lane / 2 }, { ...r, x0: x + lane / 2 }];
}
function splitZ(r: Rect, share: number, lane = 2): [Rect, Rect] {
  const z = r.z0 + depth(r) * share;
  return [{ ...r, z1: z - lane / 2 }, { ...r, z0: z + lane / 2 }];
}
/** The two side bands, left (-x) then right */
const sides = (b: ReturnType<typeof bands>): (Rect | null)[] => [b.left, b.right];

// ---- What every yard may have ------------------------------------------------------------------------------------------
/** The fence round the block, in the era's way: bamboo rails, timber posts and wire, concrete posts and mesh, a steel
 * palisade, a slim white fence with a hedge. Across the front it stops at the building, whose own front is the gate. */
function fence(b: YardBuilder, half: number, hole: YardHole, era: number, inner = 0): void {
  b.named('fence', () => {
    const e = half - FENCE_IN - inner, front = hole.c + hole.hw >= half - EDGE;
    const post = era === 1 ? C.bamboo : era === 2 ? C.timberDark : era === 3 ? C.concrete : era === 4 ? C.steel : C.white;
    const h = era === 1 ? 1.3 : era === 2 ? 1.6 : era === 3 ? 2.0 : 2.4;
    const span = era === 2 ? 4 : 5;
    const run = (ax: number, az: number, bx: number, bz: number): void => {
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.5) return;
      const n = Math.max(1, Math.round(length / span)), along = Math.abs(bx - ax) > Math.abs(bz - az);
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        b.box(era === 3 ? 0.18 : 0.12, h + 0.1, era === 3 ? 0.18 : 0.12, x, 0, z, post);
      }
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, w = along ? length : 0.05, d = along ? 0.05 : length;
      if (era <= 2) {
        // rails or strands of wire
        for (const y of era === 1 ? [0.45, 1.05] : [0.5, 0.95, 1.4]) b.box(along ? length : 0.06, 0.06, along ? 0.06 : length, cx, y, cz, era === 1 ? C.bamboo : C.timber);
      } else {
        // a mesh or palisade panel, opaque from afar, and a top rail
        b.box(w, h - 0.25, d, cx, 0.15, cz, era === 3 ? C.steelLight : era === 4 ? C.steel : C.green);
        b.box(along ? length : 0.08, 0.08, along ? 0.08 : length, cx, h - 0.1, cz, post);
      }
    };
    run(-e, -e, e, -e);
    run(-e, -e, -e, e);
    run(e, -e, e, e);
    if (front) {
      run(-e, e, -hole.hw - 0.3, e);
      run(hole.hw + 0.3, e, e, e);
    } else run(-e, e, e, e);
    // era 5: a clipped hedge inside the fence along the back
    if (era === 5 && inner === 0) b.box(2 * e - 2, 0.9, 0.7, 0, 0, -e + 0.8, C.hedge);
  });
}

/** Floodlight masts in the block's corners, inside the fence (an industrial yard's, from era 3) */
function masts(b: YardBuilder, half: number, era: number): void {
  if (era < 3) return;
  b.named('floodlight-masts', () => {
    const e = half - FENCE_IN - 0.7, h = era === 3 ? 14 : 18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.cyl(0.22, h, sx * e, 0, sz * e, C.steelLight, 6, 0.14);
      b.box(1.4, 0.5, 0.5, sx * e, h, sz * e, C.steel);
    }
  });
}

/** A switchyard on a gravel pad: transformers, gantries carrying the lines out and insulators; in era 1 two timber poles
 * with a cross-arm and a small pole transformer, in era 2 an H-frame of poles with a transformer on a plinth */
function switchyard(b: YardBuilder, r: Rect, era: number): void {
  b.named('switchyard', () => {
    const x = midX(r), z = midZ(r), w = width(r), d = depth(r);
    if (era === 1) {
      const n = Math.max(2, Math.min(4, Math.floor(d / 6)));
      for (let i = 0; i < n; i++) {
        const pz = r.z0 + 1 + (d - 2) * i / Math.max(1, n - 1);
        b.cyl(0.13, 7, x, 0, pz, C.timberDark, 6);
        b.box(Math.min(w - 0.4, 2.2), 0.14, 0.14, x, 6.4, pz, C.timberDark);
        if (i === 0) b.box(0.7, 0.9, 0.6, x + 0.45, 4.4, pz, C.transformer);
      }
      for (const dx of [-0.9, 0, 0.9]) b.box(0.03, 0.03, d - 2, x + Math.min(dx, w / 2 - 0.3), 6.55, z, C.timberDark);
      return;
    }
    b.pad(r.x0, r.z0, r.x1, r.z1, C.gravel, 0.1);
    const along = d >= w, len = along ? d : w, across = along ? w : d;
    const n = Math.max(1, Math.min(era >= 4 ? 4 : era === 3 ? 3 : 2, Math.floor((len - 2) / 6)));
    const at = (u: number, v: number): [number, number] => along ? [x + v, r.z0 + u] : [r.x0 + u, z + v];
    for (let i = 0; i < n; i++) {
      const u = 1 + (len - 2) * (i + 0.5) / n, [tx, tz] = at(u, -across * 0.18);
      const tw = Math.min(across * 0.38, era >= 4 ? 3.4 : 2.6), td = Math.min(4, (len - 2) / n - 1.2), th = era >= 4 ? 3 : 2.4;
      // the transformer on its plinth, radiators down one side, its bushings on top
      b.box(along ? tw + 0.4 : td + 0.4, 0.4, along ? td + 0.4 : tw + 0.4, tx, 0.1, tz, C.concrete);
      b.box(along ? tw : td, th, along ? td : tw, tx, 0.5, tz, C.transformer);
      b.box(along ? 0.3 : td * 0.9, th * 0.8, along ? td * 0.9 : 0.3, tx + (along ? tw / 2 + 0.15 : 0), 0.6, tz + (along ? 0 : tw / 2 + 0.15), C.steel);
      for (const k of [-1, 0, 1]) {
        const [bx, bz] = along ? [tx + k * tw * 0.3, tz] : [tx, tz + k * tw * 0.3];
        b.cyl(0.12, 1.2, bx, 0.5 + th, bz, C.insulator, 6);
      }
    }
    // the gantries: two posts and a beam across, every few metres along the pad, and the busbars between them
    const gantryH = era === 2 ? 6 : era === 3 ? 8 : 10, gn = Math.max(2, Math.min(4, Math.floor(len / 6) + 1));
    const v0 = across * 0.08, v1 = across / 2 - 0.4;
    for (let i = 0; i < gn; i++) {
      const u = 0.8 + (len - 1.6) * i / (gn - 1);
      const [ax, az] = at(u, v0), [bx, bz] = at(u, v1);
      const color = era === 2 ? C.timberDark : C.steel;
      b.box(0.3, gantryH, 0.3, ax, 0, az, color);
      b.box(0.3, gantryH, 0.3, bx, 0, bz, color);
      b.box(along ? v1 - v0 + 0.3 : 0.3, 0.3, along ? 0.3 : v1 - v0 + 0.3, (ax + bx) / 2, gantryH - 0.3, (az + bz) / 2, color);
      for (const k of [0.25, 0.5, 0.75]) {
        const [ix, iz] = at(u, v0 + (v1 - v0) * k);
        b.cyl(0.1, 1.0, ix, gantryH - 1.3, iz, C.insulator, 6);
      }
    }
    for (const k of [0.25, 0.5, 0.75]) {
      const [ax, az] = at(0.8, v0 + (v1 - v0) * k), [bx, bz] = at(len - 0.8, v0 + (v1 - v0) * k);
      b.rod([ax, gantryH - 1.35, az], [bx, gantryH - 1.35, bz], 0.05, C.steelLight, 4);
    }
  });
}
/** Trucks (or ox carts in era 1) parked side by side on a pad along the rectangle's longer side, their noses to the front */
function truckYard(b: YardBuilder, r: Rect, era: number, kind: 'dump' | 'tanker' | 'refuse' = 'dump'): void {
  b.named('truck-yard', () => {
    const along = depth(r) >= width(r), len = along ? depth(r) : width(r), across = along ? width(r) : depth(r);
    if (era >= 2) b.pad(r.x0, r.z0, r.x1, r.z1, era === 2 ? C.laterite : C.asphalt, 0.06);
    const W = era === 1 ? 1.5 : era === 2 ? 2.0 : 2.5, L = Math.min(era === 1 ? 3.6 : era === 2 ? 5.5 : 7.5, across - 0.8);
    if (L < 2.5) return;
    const n = Math.max(1, Math.min(5, Math.floor(len / (W + 1.4))));
    for (let i = 0; i < n; i++) {
      // each vehicle in its own frame: u along its length (nose +u), v across
      const s = (i + 0.5) * len / n, cx = along ? midX(r) : r.x0 + s, cz = along ? r.z0 + s : midZ(r);
      const at = (u: number, v: number): [number, number] => along ? [cx + u, cz + v] : [cx + v, cz + u];
      const box = (lu: number, h: number, lv: number, u: number, y: number, v: number, color: number): void => {
        const [x, z] = at(u, v);
        b.box(along ? lu : lv, h, along ? lv : lu, x, y, z, color);
      };
      const wheel = (radius: number, u: number, v: number, color: number): void => {
        const [x, z] = at(u, v);
        b.drum(radius, 0.25, x, radius, z, color, along ? 'z' : 'x', 8);
      };
      if (era === 1) {
        // an ox cart: its bed on two wheels, the shafts out in front, and its ox
        box(L * 0.5, 0.25, W, -L * 0.2, 0.75, 0, C.timber);
        for (const v of [-W / 2, W / 2]) wheel(0.55, -L * 0.2, v, C.timberDark);
        box(L * 0.3, 0.06, 0.08, L * 0.15, 0.85, 0, C.timberDark);
        box(L * 0.28, 0.8, 0.6, L * 0.34, 0.55, 0, C.ox);
        continue;
      }
      const cab = L * 0.26, bed = L - cab - 0.2, bedU = -L / 2 + bed / 2, cabU = L / 2 - cab / 2;
      box(cab, 2.0, W, cabU, 0.55, 0, C.truckCab);
      if (kind === 'tanker') {
        const [x, z] = at(bedU, 0);
        b.drum(W * 0.45, bed, x, 1.75, z, C.white, along ? 'z' : 'x', 10);
      } else box(bed, kind === 'refuse' ? 2.3 : 1.2, W, bedU, 0.85, 0, kind === 'refuse' ? C.hedge : C.truckBed);
      for (const v of [-W / 2 + 0.2, W / 2 - 0.2]) for (const u of [cabU, bedU - bed * 0.25]) wheel(0.45, u, v, C.tyre);
    }
  });
}
/** A low shed or house: walls, a gable roof, a door */
function shed(b: YardBuilder, x: number, z: number, w: number, d: number, h: number, era: number, name = 'shed'): void {
  b.named(name, () => {
    const wall = era === 1 ? C.timber : era === 2 ? C.brick : era === 3 ? C.concreteLight : era === 4 ? C.offWhite : C.white;
    const roof = era === 1 ? C.thatch : era <= 3 ? C.zinc : era === 4 ? C.steelLight : C.green;
    if (era === 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.12, 0.6, x + sx * (w / 2 - 0.2), 0, z + sz * (d / 2 - 0.2), C.timberDark, 6);
    const base = era === 1 ? 0.6 : 0;
    b.box(w, h, d, x, base, z, wall);
    if (era >= 4) b.box(w + 0.4, 0.3, d + 0.4, x, base + h, z, roof);
    else b.gable(w + 0.6, d + 0.6, x, base + h, z, Math.min(2.2, d * 0.35), roof);
    b.box(Math.min(1.6, w * 0.3), Math.min(2.2, h * 0.8), 0.08, x, base, z + d / 2 + 0.02, C.timberDark);
  });
}

/** Trees or shrubs dotted along a rectangle (era 1 and 5 yards, and spare corners) */
function trees(b: YardBuilder, r: Rect, n: number, era: number): void {
  b.named('trees', () => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = width(r) >= depth(r) ? r.x0 + width(r) * t : midX(r), z = width(r) >= depth(r) ? midZ(r) : r.z0 + depth(r) * t;
      const s = era === 1 ? 1.2 : 1;
      b.cyl(0.18 * s, 2.2 * s, x, 0, z, C.timberDark, 5);
      b.mound(1.5 * s, 1.6 * s, 1.5 * s, x, 1.6 * s, z, i % 2 ? C.leaf : C.hedge, false, 7);
    }
  });
}

// ---- Lignite -----------------------------------------------------------------------------------------------------------
function coalYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole), hz0 = hole.c - hole.hw;
  const [lane1, lane2] = sides(g);
  if (g.back) {
    const shallow = depth(g.back) < 9;
    const [pile, pond] = splitX(g.back, era <= 2 ? 0.55 : 0.62, 2.4);
    if (era === 1) {
      // a village's generator yard: firewood stacked in rows the width of the yard, heaps of lignite dug nearby, a
      // thatched fuel shed, a rice-straw stack and the yard's shade trees
      b.named('firewood', () => {
        const rows = Math.max(1, Math.min(4, Math.floor(depth(pile) / 3.2)));
        for (let k = 0; k < rows; k++) {
          const z = pile.z0 + 1 + k * 3.2, lenX = width(pile) * (k % 2 ? 0.5 : 0.62), x = pile.x0 + lenX / 2 + 0.4;
          b.box(lenX, 1.1, 1.2, x, 0, z, C.timber);
          b.box(lenX, 0.08, 1.24, x, 1.1, z, C.timberDark);
        }
      });
      b.named('lignite-heap', () => {
        const r = Math.min(width(pile) * 0.14, depth(pile) * 0.4, 3.6), hx = pile.x1 - r - 0.4;
        b.mound(r, Math.min(1.8, r * 0.5), r * 0.8, hx, 0, pile.z0 + depth(pile) * 0.3, C.coal);
        b.mound(r * 0.8, Math.min(1.4, r * 0.4), r * 0.7, hx, 0, pile.z1 - depth(pile) * 0.28, C.coalDust);
      });
      if (width(pond) > 5) {
        const [store, straw] = splitZ(pond, 0.55, 1.4);
        shed(b, midX(store), midZ(store), Math.min(width(store) - 1, 7), Math.min(depth(store) - 0.6, 4.5), 2.2, 1, 'fuel-shed');
        if (depth(straw) > 2.4) b.named('straw-stack', () => b.mound(Math.min(2.4, width(straw) / 3), 2.6, Math.min(2, depth(straw) / 2), straw.x0 + 2.4, 0, midZ(straw), C.thatch, true, 8));
        if (depth(straw) > 2.4 && width(straw) > 8) trees(b, { ...straw, x0: straw.x0 + 5.5 }, Math.max(1, Math.floor((width(straw) - 5.5) / 5)), 1);
      }
    } else {
      b.named('coal-stockpile', () => {
        b.pad(pile.x0, pile.z0, pile.x1, pile.z1, C.coalDust, 0.06);
        const piles = era >= 4 && !shallow ? 2 : 1;
        const [a, c] = piles === 2 ? splitZ(pile, 0.5, 3) : [pile, pile];
        for (const p of piles === 2 ? [a, c] : [pile]) {
          const rx = width(p) / 2 - 0.4, rz = depth(p) / 2 - 0.3, h = Math.min(era === 2 ? 4 : 7, rz * 1.1);
          if (era === 5) {
            // a covered store: a long barrel vault over the pile
            b.lathe([[0.01, 0], [rz, 0], [rz, 0.6], [rz * 0.86, h * 0.75], [rz * 0.45, h * 1.05], [0.01, h * 1.12]], midX(p) - rx * 0.5, midZ(p), C.offWhite, 14);
            b.lathe([[0.01, 0], [rz, 0], [rz, 0.6], [rz * 0.86, h * 0.75], [rz * 0.45, h * 1.05], [0.01, h * 1.12]], midX(p) + rx * 0.5, midZ(p), C.offWhite, 14);
            b.box(rx, h * 0.9, rz * 1.7, midX(p), 0, midZ(p), C.offWhite);
          } else b.mound(rx, h, rz, midX(p), 0.05, midZ(p), C.coal, true, 12);
        }
        if (era >= 4 && !shallow) {
          // a stacker on its rail beside the pile, its boom over it
          const sx = pile.x0 + width(pile) * 0.35, sz = midZ(pile);
          b.box(width(pile) - 1, 0.3, 0.6, midX(pile), 0, pile.z1 - 0.2, C.steel);
          b.box(2.4, 5, 2.4, sx, 0, pile.z1 - 0.2, C.gasPipe);
          b.rod([sx, 5, pile.z1 - 0.2], [sx, 7.5, sz], 0.35, C.gasPipe, 4);
        }
      });
      b.named('conveyor', () => {
        // from the pile up to the plant's back: a gallery on trestles (a timber chute in era 2)
        const fromX = pile.x1 - 2, fromZ = midZ(pile), toX = Math.max(-hole.hw * 0.4, pile.x0 + 2), toZ = hz0 - CLEAR - 0.2;
        const topY = era === 2 ? 5 : era === 3 ? 10 : 13, r = era === 2 ? 0.35 : 0.7;
        b.rod([fromX, 1.2, fromZ], [toX, topY, toZ], r, era === 2 ? C.timber : C.steelLight, 4);
        const n = era === 2 ? 2 : 3;
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1), x = fromX + (toX - fromX) * t, z = fromZ + (toZ - fromZ) * t, y = 1.2 + (topY - 1.2) * t;
          b.box(0.3, y - r, 0.3, x, 0, z, era === 2 ? C.timberDark : C.steel);
        }
        if (era >= 3) {
          // the crusher house at its foot, and a transfer tower half way up
          b.box(2.8, 3, 2.8, fromX, 0, fromZ, C.steel);
          const tx = (fromX + toX) / 2, tz = (fromZ + toZ) / 2, ty = (1.2 + topY) / 2;
          b.box(2.2, ty + 1.2, 2.2, tx, 0, tz, C.steelLight);
          b.box(2.6, 0.3, 2.6, tx, ty + 1.2, tz, C.steel);
        }
      });
      b.named('ash-pond', () => {
        const p = width(pond) >= 4 ? pond : null;
        if (!p) return;
        const berm = 0.8, bh = era === 2 ? 0.6 : 1.2;
        b.box(width(p), bh, berm, midX(p), 0, p.z0 + berm / 2, C.ash);
        b.box(width(p), bh, berm, midX(p), 0, p.z1 - berm / 2, C.ash);
        b.box(berm, bh, depth(p) - 2 * berm, p.x0 + berm / 2, 0, midZ(p), C.ash);
        b.box(berm, bh, depth(p) - 2 * berm, p.x1 - berm / 2, 0, midZ(p), C.ash);
        b.box(width(p) - 2 * berm, bh * 0.7, depth(p) - 2 * berm, midX(p), 0, midZ(p), C.ashWater);
        if (era >= 3) b.rod([p.x1 - 1, bh + 0.6, p.z1 - 0.4], [Math.min(p.x1 - 1, hole.hw * 0.6), bh + 0.6, hz0 - CLEAR - 0.1], 0.2, C.steel, 6);
      });
    }
  }
  // a switchyard down one side, a truck yard down the other (or both in the back when the sides are narrow)
  if (lane1) switchyard(b, lane1, era);
  if (lane2) truckYard(b, lane2, era, 'dump');
  if (g.front) truckYard(b, g.front, era, 'dump');
  masts(b, half, era);
  fence(b, half, hole, era);
}

// ---- Gas ---------------------------------------------------------------------------------------------------------------
function gasYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole), hz0 = hole.c - hole.hw;
  if (g.back) {
    const [tanks, skid] = splitX(g.back, 0.7, 2.4);
    b.named('gas-tanks', () => {
      b.pad(tanks.x0, tanks.z0, tanks.x1, tanks.z1, C.concrete, 0.12);
      if (era >= 4 && depth(tanks) >= 8) {
        // spheres on legs
        const r = Math.min(depth(tanks) / 2 - 0.8, 6), n = Math.max(1, Math.min(3, Math.floor(width(tanks) / (2 * r + 2.5))));
        for (let i = 0; i < n; i++) {
          const x = tanks.x0 + (i + 0.5) * width(tanks) / n, z = midZ(tanks), y = r * 0.55;
          b.mound(r, r, r, x, y, z, era === 5 ? C.white : C.offWhite, false, 14);
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI * 2, lx = x + Math.cos(a) * r * 0.8, lz = z + Math.sin(a) * r * 0.8;
            b.box(0.3, y + r * 0.4, 0.3, lx, 0, lz, C.steel);
          }
          if (era === 5) b.drum(r * 1.01, 0.4, x, y + r, z, C.green, 'x', 10);
        }
      } else {
        // horizontal bullets on saddles
        const n = Math.max(1, Math.min(4, Math.floor(depth(tanks) / 3.6))), r = Math.min(1.5, (depth(tanks) / n - 0.8) / 2);
        for (let i = 0; i < n; i++) {
          const z = tanks.z0 + (i + 0.5) * depth(tanks) / n, len = width(tanks) - 1.5;
          b.drum(r, len, midX(tanks), r + 0.6, z, C.offWhite, 'x', 12);
          for (const s of [-0.35, 0.35]) b.box(0.5, r + 0.6, r * 1.6, midX(tanks) + s * len, 0, z, C.concrete);
        }
      }
    });
    b.named('pipe-rack', () => {
      // a raised rack from the tanks to the plant's back, three pipes on it
      const y = era <= 3 ? 3 : 4.5, x = Math.min(skid.x0 + 1, hole.hw * 0.5), z0 = midZ(g.back!), z1 = hz0 - CLEAR - 0.1;
      const xs = [tanks.x1 - 1, x];
      for (const px of [tanks.x0 + 1, midX(tanks), tanks.x1 - 1]) b.box(0.3, y, 0.3, px, 0, z0, C.steel);
      b.box(width(tanks) - 1.4, 0.25, 1.4, midX(tanks), y, z0, C.steel);
      for (const dz of [-0.45, 0, 0.45]) b.drum(0.18, width(tanks) - 1.4, midX(tanks), y + 0.45, z0 + dz, C.gasPipe, 'x', 6);
      if (z1 > z0 + 0.5) {
        for (const pz of [z0 + 1, z1 - 0.4]) b.box(0.3, y, 0.3, xs[1], 0, pz, C.steel);
        for (const dx of [-0.4, 0.4]) b.drum(0.18, z1 - z0, xs[1] + dx, y + 0.45, (z0 + z1) / 2, C.gasPipe, 'z', 6);
      }
    });
    b.named('metering-skid', () => {
      if (width(skid) < 3) return;
      b.pad(skid.x0, skid.z0, skid.x1, skid.z1, C.gravel, 0.08);
      for (let k = 0; k < 3; k++) b.cyl(0.5, 2.6, skid.x0 + 1 + k * Math.min(1.6, (width(skid) - 2) / 2), 0.1, midZ(skid), C.steelLight, 8);
      b.drum(0.25, width(skid) - 1, midX(skid), 1.2, midZ(skid) + 1.2, C.gasPipe, 'x', 6);
    });
  }
  if (g.left) switchyard(b, g.left, Math.max(2, era));
  if (g.right) {
    // fin-fan coolers on legs, and the tankers' bay
    const [fans, bay] = splitZ(g.right, 0.45, 2);
    b.named('fin-fan-coolers', () => {
      if (depth(fans) < 3) return;
      const y = 3.2;
      for (const sx of [fans.x0 + 0.4, fans.x1 - 0.4]) for (const sz of [fans.z0 + 0.4, fans.z1 - 0.4]) b.box(0.3, y, 0.3, sx, 0, sz, C.steel);
      b.box(width(fans), 1.2, depth(fans), midX(fans), y, midZ(fans), C.steelLight);
      const n = Math.max(1, Math.floor(depth(fans) / 3));
      for (let k = 0; k < n; k++) b.cyl(Math.min(1.2, width(fans) / 2 - 0.3), 0.4, midX(fans), y + 1.2, fans.z0 + (k + 0.5) * depth(fans) / n, C.steel, 10);
    });
    if (depth(bay) >= 4) truckYard(b, bay, Math.max(2, era), 'tanker');
  }
  if (g.front) truckYard(b, g.front, Math.max(2, era), 'tanker');
  masts(b, half, era);
  fence(b, half, hole, Math.max(2, era));
}

// ---- Solar -------------------------------------------------------------------------------------------------------------
/** Rows of panels across a rectangle, tilted to the front, on posts, a lane down the middle */
function panels(b: YardBuilder, r: Rect, era: number): void {
  b.named('solar-rows', () => {
    const pitch = era === 5 ? 4.2 : 4.6, tableD = 2.3, n = Math.floor((depth(r) + 0.5) / pitch);
    if (n < 1 || width(r) < 3) return;
    const segment = 8, color = era === 5 ? C.panelNew : C.panel;
    for (let k = 0; k < n; k++) {
      const z = r.z0 + tableD / 2 + 0.2 + k * pitch, count = Math.max(1, Math.round(width(r) / segment)), w = width(r) / count;
      for (let s = 0; s < count; s++) {
        const x = r.x0 + (s + 0.5) * w;
        // the table: a thin slab, its back raised (a box sheared by turning: two boxes stepped read as a tilt from afar)
        b.box(w - 0.5, 0.12, tableD * 0.52, x, 1.35, z - tableD * 0.24, color);
        b.box(w - 0.5, 0.12, tableD * 0.52, x, 0.95, z + tableD * 0.24, color);
        b.box(w - 0.5, 0.06, 0.08, x, 0.9, z + tableD / 2, C.panelFrame);
        for (const px of [x - w / 2 + 0.6, x + w / 2 - 0.6]) b.box(0.12, 1.3, 0.12, px, 0, z, C.steelLight);
      }
    }
    // an inverter box at the end of every few rows
    for (let k = 0; k < n; k += 3) b.box(1.4, 1.6, 0.9, r.x1 - 0.7, 0, r.z0 + tableD / 2 + 0.2 + k * pitch + pitch / 2, C.offWhite);
  });
}
function solarYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole);
  b.named('gravel-lanes', () => { for (const r of [g.back, g.front, g.left, g.right]) if (r) b.pad(r.x0, r.z0, r.x1, r.z1, C.gravel, 0.05); });
  for (const r of [g.back, g.front, g.left, g.right]) if (r) panels(b, r, era);
  if (era === 5 && g.back && depth(g.back) > 8) {
    // a row of battery containers along the back fence
    b.named('batteries', () => {
      const z = g.back!.z0 + 1.3, n = Math.max(1, Math.min(4, Math.floor(width(g.back!) / 14)));
      for (let k = 0; k < n; k++) b.box(6, 2.6, 2.4, g.back!.x0 + 4 + k * 7, 0, z, C.offWhite);
    });
  }
  fence(b, half, hole, Math.max(4, era));
}

// ---- Wind --------------------------------------------------------------------------------------------------------------
/** A turbine: a pad, a tapered tower, its nacelle and three blades, its rotor facing the front (+Z) */
function turbine(b: YardBuilder, x: number, z: number, hub: number, blade: number): void {
  b.named('wind-turbine', () => {
    b.cyl(2.2, 0.35, x, 0, z, C.concrete, 10);
    b.lathe([[1.1, 0.3], [0.85, hub * 0.4], [0.55, hub - 0.4], [0.5, hub]], x, z, C.white, 10);
    b.box(1.6, 1.8, 4.4, x, hub - 0.4, z - 0.6, C.offWhite);
    b.cyl(0.6, 1.2, x, hub + 0.5, z + 1.9, C.white, 8);
    for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      const tx = x + Math.sin(a) * blade, ty = hub + 0.5 + Math.cos(a) * blade;
      b.rod([x, hub + 0.5, z + 2.1], [tx, ty, z + 2.2], 0.26, C.white, 4);
    }
    b.box(0.5, 0.3, 0.5, x, hub + 1.4, z - 1.8, C.band);
  });
}
function windYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole), late = era >= 5;
  const hub = late ? 36 : 28, blade = late ? 9.5 : 7.5, spread = 2 * blade + 3;
  // Turbines in staggered rows from the back fence forward, every rotor facing the front (+Z, the same wind), its
  // blades `blade` either side of its tower across the block and clear of the fence, none over the main building, and
  // each a rotor's width from the next in its row
  const xMax = half - FENCE_IN - blade - 0.6, zMin = -half + FENCE_IN + 3, zMax = half - FENCE_IN - 3;
  const kept: [number, number][] = [];
  for (let row = 0, z = zMin; z <= zMax && kept.length < 8; row++, z += 11) {
    for (let x = -xMax + (row % 2 ? spread / 2 : 0); x <= xMax + 1e-6 && kept.length < 8; x += spread) {
      if (Math.abs(x) < hole.hw + blade + 1 && z > hole.c - hole.hw - 3 && z < hole.c + hole.hw + 3) continue;
      if (kept.some(([kx, kz]) => Math.abs(kz - z) < 6 ? Math.abs(kx - x) < spread - 0.5 : Math.hypot(kx - x, kz - z) < 8)) continue;
      kept.push([x, z]);
    }
  }
  for (const [x, z] of kept) turbine(b, x, z, hub, blade);
  b.named('crane-hardstands', () => {
    // beside each tower the gravel pad its crane stood on, and a track from it to the next
    const off = (x0: number, z0: number, x1: number, z1: number): boolean => x1 <= -hole.hw - 0.2 || x0 >= hole.hw + 0.2
      || z1 <= hole.c - hole.hw - 0.2 || z0 >= hole.c + hole.hw + 0.2;
    const e = half - EDGE, pad = (x0: number, z0: number, x1: number, z1: number): void => {
      [x0, z0, x1, z1] = [Math.max(-e, x0), Math.max(-e, z0), Math.min(e, x1), Math.min(e, z1)];
      if (x1 - x0 > 0.5 && z1 - z0 > 0.5 && off(x0, z0, x1, z1)) b.pad(x0, z0, x1, z1, C.gravel, 0.05);
    };
    for (const [x, z] of kept) {
      const side = x > 0 ? -1 : 1;
      pad(Math.min(x + side * 2.4, x + side * 8.4), z - 3.5, Math.max(x + side * 2.4, x + side * 8.4), z + 3.5);
    }
    for (let k = 1; k < kept.length; k++) {
      const [ax, az] = kept[k - 1], [bx, bz] = kept[k];
      pad(Math.min(ax, bx), az - 1.2, Math.max(ax, bx) + 0.01, az + 1.2);
      if (Math.abs(bz - az) > 2.4) pad(bx - 1.2, Math.min(az, bz), bx + 1.2, Math.max(az, bz));
    }
  });
  b.named('turbine-transformers', () => {
    // each turbine's kiosk transformer at its foot, on the far side from its hardstand
    for (const [x, z] of kept) {
      const side = x > 0 ? 1 : -1, kx = Math.max(-half + EDGE + 1, Math.min(half - EDGE - 1, x + side * 3.4));
      b.box(2, 2.3, 1.8, kx, 0, z + 1.5, C.offWhite);
      b.box(2.2, 0.15, 2, kx, 2.3, z + 1.5, C.steelLight);
    }
  });
  b.named('access-track', () => {
    if (g.back) b.pad(g.back.x0, midZ(g.back) - 1.6, g.back.x1, midZ(g.back) + 1.6, C.gravel, 0.05);
  });
  // beside the building: the farm's substation down one side, its maintenance shed and vans down the other, each where
  // no rotor turns over it
  const free = (r: Rect): boolean => !kept.some(([x, z]) => Math.abs(x - midX(r)) < blade + width(r) / 2 && z > r.z0 - 2.5 && z < r.z1 + 2.5);
  if (g.left && width(g.left) >= 4 && depth(g.left) >= 6) {
    const r: Rect = { ...g.left, z0: Math.max(g.left.z0, g.left.z1 - 14) };
    if (free(r)) switchyard(b, r, Math.max(3, era));
  }
  if (g.right && width(g.right) >= 5 && depth(g.right) >= 8) {
    const [shedRect, vans] = splitZ({ ...g.right, z0: Math.max(g.right.z0, g.right.z1 - 20) }, 0.45, 1.5);
    if (free(shedRect) && depth(shedRect) >= 4) shed(b, midX(shedRect), midZ(shedRect), Math.min(width(shedRect) - 0.6, 9), depth(shedRect) - 0.6, 4, Math.max(4, era), 'maintenance-shed');
    if (free(vans) && depth(vans) >= 4) truckYard(b, vans, Math.max(4, era));
  }
  fence(b, half, hole, Math.max(4, era));
}
// ---- Dam ---------------------------------------------------------------------------------------------------------------
function hydroYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole), hz0 = hole.c - hole.hw, e = half - FENCE_IN;
  if (g.back) {
    const wallZ = g.back.z0 + depth(g.back) * 0.62, wallH = era <= 2 ? 2.2 : era === 3 ? 4 : 5;
    b.named('reservoir', () => {
      // the lake behind the dam, its water up near the crest
      b.box(2 * e, wallH - 0.6, wallZ - (-e) - 0.6, 0, 0, (-e + wallZ) / 2 - 0.3, C.deepWater);
      b.box(2 * e, 0.5, 0.8, 0, wallH - 0.5, -e + 0.4, C.leaf);
    });
    b.named('dam-wall', () => {
      b.box(2 * e, wallH, 1.6, 0, 0, wallZ, era <= 2 ? C.gravel : C.concreteLight);
      b.box(2 * e, 0.9, 0.2, 0, wallH, wallZ + 0.7, C.concrete);
      if (era >= 3) for (const x of [-e * 0.5, e * 0.5]) b.box(3, wallH + 3, 3, x, 0, wallZ - 1.2, C.concrete);
    });
    b.named('penstocks', () => {
      const n = era <= 2 ? 1 : era === 3 ? 2 : 3, toZ = hz0 - CLEAR - 0.1;
      for (let k = 0; k < n; k++) {
        const x = (k - (n - 1) / 2) * Math.min(6, hole.hw * 0.6);
        if (toZ > wallZ + 1) b.rod([x, wallH * 0.7, wallZ + 0.8], [x, 1.0, toZ], era <= 2 ? 0.4 : 0.8, era <= 2 ? C.timber : C.steel, 8);
        if (toZ > wallZ + 1) b.box(1.4, 1.0, 1.4, x, 0, (wallZ + toZ) / 2, C.concrete);
      }
    });
  }
  const [spill, other] = [g.right, g.left];
  if (spill) {
    b.named('spillway', () => {
      // a stepped chute from the crest to the tailwater, with its gate piers at the top
      const steps = Math.max(3, Math.min(7, Math.floor(depth(spill) / 4))), w = Math.min(width(spill) - 0.6, 7);
      for (let k = 0; k < steps; k++) {
        const z = spill.z0 + (k + 0.5) * depth(spill) / steps, h = Math.max(0.3, (era <= 2 ? 2 : 4) * (1 - k / steps));
        b.box(w, h, depth(spill) / steps, midX(spill), 0, z, C.concreteLight);
        b.box(w - 1, 0.1, depth(spill) / steps, midX(spill), h, z, C.water);
      }
      for (const s of [-1, 1]) b.box(0.4, 2.2, depth(spill), midX(spill) + s * w / 2, 0, midZ(spill), C.concrete);
      if (era >= 3) for (let k = 0; k <= 2; k++) b.box(0.8, 5, 1.2, midX(spill) - w / 2 + k * w / 2, 0, spill.z0 + 0.6, C.concrete);
    });
  }
  if (other) switchyard(b, other, Math.max(2, era));
  if (g.front) truckYard(b, g.front, Math.max(2, era));
  fence(b, half, hole, Math.max(2, era));
}

// ---- Nuclear -----------------------------------------------------------------------------------------------------------
function coolingTower(b: YardBuilder, x: number, z: number, base: number, height: number): void {
  b.named('cooling-tower', () => {
    // a hyperboloid shell, its waist at three quarters of its height, open at the top, on a ring of slanted legs
    const throat = base * 0.6, at = height * 0.75, k = at / Math.sqrt(base ** 2 - throat ** 2);
    const r = (y: number): number => Math.sqrt(throat ** 2 + ((y - at) / k) ** 2);
    const profile: [number, number][] = [];
    for (let i = 0; i <= 10; i++) { const y = 2.6 + (height - 2.6) * i / 10; profile.push([r(y), y]); }
    b.lathe(profile, x, z, C.offWhite, 18);
    for (let n = 0; n < 10; n++) {
      const a = n / 10 * Math.PI * 2, foot = r(2.6) * 1.04;
      b.rod([x + Math.cos(a) * foot, 0.3, z + Math.sin(a) * foot], [x + Math.cos(a + 0.25) * r(2.6), 2.7, z + Math.sin(a + 0.25) * r(2.6)], 0.25, C.concrete, 4);
    }
  });
}
function nuclearYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole);
  if (g.back) {
    const towerR = Math.min(depth(g.back) / 2 - 0.4, 10, width(g.back) / 4);
    if (towerR >= 4) coolingTower(b, g.back.x0 + towerR + 0.3, midZ(g.back), towerR, Math.min(46, towerR * 4.6));
    const [, rest] = splitX(g.back, (2 * towerR + 1) / width(g.back), 2);
    b.named('containment', () => {
      const r = Math.min(depth(rest) / 2 - 0.5, 6.5, width(rest) / 3);
      if (r < 2.5) return;
      const x = rest.x0 + r + 0.6, z = midZ(rest), h = r * 2.2;
      b.cyl(r, h, x, 0, z, C.offWhite, 18);
      b.mound(r, r * 0.8, r, x, h, z, C.offWhite, true, 18);
      b.box(r, 3, 2.5, x, 0, z + r, C.concrete);
    });
    b.named('fuel-building', () => {
      const w = Math.min(14, width(rest) * 0.45), d = Math.min(depth(rest) - 1, 10);
      if (w < 4 || d < 4) return;
      b.box(w, 9, d, rest.x1 - w / 2 - 0.4, 0, midZ(rest), C.concreteLight);
      b.box(w + 0.4, 0.4, d + 0.4, rest.x1 - w / 2 - 0.4, 9, midZ(rest), C.steelLight);
    });
  }
  if (g.left) switchyard(b, g.left, Math.max(4, era));
  if (g.right) {
    const [office, park] = splitZ(g.right, 0.5, 2);
    if (depth(office) >= 4) shed(b, midX(office), midZ(office), Math.min(width(office) - 0.6, 10), Math.min(depth(office) - 0.6, 7), 4, 5, 'admin-building');
    if (depth(park) >= 4) truckYard(b, park, 4);
  }
  if (g.front) truckYard(b, g.front, 4);
  masts(b, half, Math.max(4, era));
  // a double security fence
  fence(b, half, hole, Math.max(4, era));
  fence(b, half, hole, Math.max(4, era), 1.5);
}

// ---- Water works -------------------------------------------------------------------------------------------------------
function basin(b: YardBuilder, r: Rect, era: number, wall = 1.2): void {
  const t = era === 1 ? 0.9 : 0.35, h = era === 1 ? 0.7 : wall, color = era === 1 ? C.earth : era === 2 ? C.brick : C.concrete;
  b.box(width(r), h, t, midX(r), 0, r.z0 + t / 2, color);
  b.box(width(r), h, t, midX(r), 0, r.z1 - t / 2, color);
  b.box(t, h, depth(r) - 2 * t, r.x0 + t / 2, 0, midZ(r), color);
  b.box(t, h, depth(r) - 2 * t, r.x1 - t / 2, 0, midZ(r), color);
  b.box(width(r) - 2 * t, h * 0.8, depth(r) - 2 * t, midX(r), 0, midZ(r), C.water);
}
function waterYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole);
  if (g.back) {
    const [settle, rest] = splitX(g.back, 0.45, 1.6);
    b.named('settling-tanks', () => {
      const n = depth(settle) >= 8 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const r = n === 2 ? splitZ(settle, 0.5, 1)[k] : settle;
        if (width(r) >= 3 && depth(r) >= 2.5) basin(b, r, era);
      }
    });
    const [filters, clear] = splitX(rest, 0.55, 1.6);
    b.named('filter-beds', () => {
      if (width(filters) < 3) return;
      if (era === 1) {
        // sand and gravel beds in bamboo frames, and the village's clay jars
        b.pad(filters.x0, filters.z0, filters.x1, filters.z0 + depth(filters) * 0.5, C.concreteLight, 0.25);
        const n = Math.max(2, Math.min(5, Math.floor(width(filters) / 1.6)));
        for (let k = 0; k < n; k++) b.cyl(0.45, 0.9, filters.x0 + 0.7 + k * (width(filters) - 1.4) / (n - 1), 0, filters.z1 - 0.8, C.jar, 6, 0.32);
        return;
      }
      const n = Math.max(2, Math.min(6, Math.floor(width(filters) / 2.4)));
      for (let k = 0; k < n; k++) {
        const cw = width(filters) / n;
        basin(b, { x0: filters.x0 + k * cw + 0.1, x1: filters.x0 + (k + 1) * cw - 0.1, z0: filters.z0, z1: filters.z1 - (era >= 3 ? 2 : 0) }, era, 1.6);
      }
      if (era >= 3) b.box(width(filters), 2.6, 1.8, midX(filters), 0, filters.z1 - 0.9, era >= 4 ? C.offWhite : C.concreteLight);
    });
    b.named('clear-water-tank', () => {
      const r = Math.min(width(clear), depth(clear)) / 2 - 0.3;
      if (r < 1.5) return;
      if (era === 1) { b.cyl(r, 2, midX(clear), 0, midZ(clear), C.timber, 10); b.mound(r * 1.1, 1, r * 1.1, midX(clear), 2, midZ(clear), C.thatch, true, 10); return; }
      b.cyl(r, 3, midX(clear), 0, midZ(clear), era === 2 ? C.brick : C.concreteLight, 18);
      b.mound(r, 0.8, r, midX(clear), 3, midZ(clear), C.concrete, true, 18);
      b.box(0.6, 0.8, 0.6, midX(clear), 3.6, midZ(clear), C.steel);
    });
  }
  const [left, right] = sides(g);
  if (left) {
    shed(b, midX(left), midZ(left), Math.min(width(left) - 0.6, 7), Math.min(depth(left) - 0.6, 6), era === 1 ? 2.2 : 3.4, era, 'pump-house');
    b.named('mains', () => b.drum(era <= 1 ? 0.12 : 0.3, depth(left) * 0.8, left.x1 - 0.5, 0.5, midZ(left), era === 1 ? C.bamboo : C.steelLight, 'z', 6));
  }
  if (right) {
    shed(b, midX(right), right.z0 + Math.min(depth(right), 7) / 2, Math.min(width(right) - 0.6, 6), Math.min(depth(right) - 0.6, 5), 3, era, 'chemical-store');
    b.named('chemical-drums', () => {
      const z = right.z0 + Math.min(depth(right), 7) + 1;
      if (z + 1 > right.z1) return;
      for (let k = 0; k < Math.min(4, Math.floor(width(right) / 1.2)); k++) b.cyl(0.4, 1, right.x0 + 0.7 + k * 1.1, 0, z, k % 2 ? C.chemical : C.drum, 8);
    });
  }
  if (g.front) trees(b, g.front, Math.max(1, Math.floor(width(g.front) / 6)), era);
  fence(b, half, hole, era);
}

// ---- Waste power -------------------------------------------------------------------------------------------------------
function wastePowerYard(b: YardBuilder, half: number, hole: YardHole, era: number): void {
  const g = bands(half, hole);
  if (g.back) {
    const [bunker, rest] = splitX(g.back, 0.55, 1.6);
    b.named('refuse-bunker', () => {
      const h = Math.min(12, depth(bunker) * 1.1);
      b.box(width(bunker), h, depth(bunker), midX(bunker), 0, midZ(bunker), era >= 5 ? C.white : C.concreteLight);
      b.box(width(bunker) + 0.4, 0.4, depth(bunker) + 0.4, midX(bunker), h, midZ(bunker), era >= 5 ? C.green : C.steelLight);
      // the tipping bays' doors along its front
      const n = Math.max(1, Math.floor(width(bunker) / 4));
      for (let k = 0; k < n; k++) b.box(2.4, 3.2, 0.1, bunker.x0 + (k + 0.5) * width(bunker) / n, 0, bunker.z1 + 0.02, C.steel);
    });
    b.named('stack', () => {
      const r = Math.min(depth(rest) / 2 - 0.4, 1.6);
      if (r < 0.8) return;
      const x = rest.x1 - r - 0.4, z = midZ(rest);
      b.cyl(r * 1.4, 1, x, 0, z, C.concrete, 12);
      b.cyl(r, 36, x, 1, z, C.stack, 12, r * 0.85);
      b.cyl(r * 0.9, 0.8, x, 30, z, C.band, 12);
    });
    b.named('ash-silo', () => {
      const r = Math.min(depth(rest) / 2 - 0.4, 2.6);
      if (r < 1 || width(rest) < 2 * r + 4) return;
      b.cyl(r, 9, rest.x0 + r + 0.4, 1.5, midZ(rest), C.steelLight, 12);
      for (const s of [-1, 1]) b.box(0.3, 1.5, 0.3, rest.x0 + r + 0.4 + s * r * 0.6, 0, midZ(rest), C.steel);
    });
  }
  const [left, right] = sides(g);
  if (left) truckYard(b, left, Math.max(3, era), 'refuse');
  if (right) {
    b.named('weighbridge', () => {
      const z = midZ(right);
      b.pad(right.x0, z - 4, right.x1, z + 4, C.steel, 0.15);
      b.box(Math.min(2.6, width(right) - 0.4), 2.6, 2.4, midX(right), 0, z + 5.6 > right.z1 ? z - 5.6 : z + 5.6, C.offWhite);
    });
  }
  if (g.front) truckYard(b, g.front, Math.max(3, era), 'refuse');
  masts(b, half, Math.max(3, era));
  fence(b, half, hole, Math.max(3, era));
}

const LAYOUTS: Readonly<Record<YardKind, (b: YardBuilder, half: number, hole: YardHole, era: number) => void>> = {
  coal: coalYard, gas: gasYard, solar: solarYard, wind: windYard, hydro: hydroYard, nuclear: nuclearYard,
  water: waterYard, waste_power: wastePowerYard,
};

/** The yard of a kind of plant: `variant` its era (1-5), `state` its hole (holeState) */
export function createPlantYard(kind: YardKind, options: ModelOptions = {}): Group {
  const era = Math.max(FIRST_ERA[kind], Math.min(5, Math.round(Number(options.variant ?? 0)) || 1));
  const hole = parseHole(kind, options.state), half = YARD_TILES[kind] * YARD_TILE_METRES / 2;
  const b = new YardBuilder();
  if (yardFits(kind, hole)) LAYOUTS[kind](b, half, hole, era);
  // a yard with nothing to stand round still marks its block's corners, so its model is never empty
  if (!b.parts.length) b.named('corner-posts', () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.2, 1.2, 0.2, sx * (half - FENCE_IN), 0, sz * (half - FENCE_IN), C.concrete);
  });
  return b.finish(yardId(kind), kind, era, hole);
}
