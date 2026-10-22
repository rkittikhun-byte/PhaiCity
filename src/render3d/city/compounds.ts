/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ground a building of the ruler's reserves, fenced (owner, 21 Oct 2026: "ถ้าพื้นที่ที่กันไว้ ก็ควรจะมีพื้นที่กั้นไว้
// นะ"; docs/design/LOOK_BOOK.md). Every building put down in metres (gameMap.buildings) of two tiles and up gets a low
// fence along what the simulation reserves for it: the outline of a building turned to a slanted road
// (src/buildings/turnedFootprint.ts), else its square block of tiles; a gap for its gate on the side it faces. So no tile
// a building holds looks like empty ground, and a road drawn just outside the fence is one the game takes.
//
// In the era's look: a village's bamboo rails, a market town's timber posts and rails, a factory town's low concrete
// posts and steel rail, a modern city's steel palisade, a future city's clipped hedge. One mesh of flat vertex colours
// for the whole city, laid again when a building comes, goes or moves, or the era changes. It only reads the map.

import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh } from 'three';
import { RAMPS } from '../../theme/tokens.js';
import { mapEra } from '../../era.js';
import { laidOutline, outlineCorners, outlineOf, quarterTurn, type FootprintMap, type Outline } from '../../buildings/turnedFootprint.js';
import type { PlacedBuilding } from '../../buildings/placedBuildings.js';
import { eraBuildingMaterial } from '../materials/library.js';
import { mergeGeometry } from '../util/geometry.js';

/** What of the map the fences read */
export interface CompoundMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  era?: unknown;
  getTileValue(x: number, y: number): number;
  getTile?(x: number, y: number): { isZone(): boolean };
  buildings?: { all(): PlacedBuilding[]; version?: number } | null;
}

/** One side of a fence: from a to b (metres), and whether its middle is the building's gate */
export interface FenceSide { ax: number; az: number; bx: number; bz: number; gate: boolean }

/** The fence round one building: its four sides, round its turned outline or its square block, the gate on its front */
export function compoundSides(b: PlacedBuilding, width: number, tileSizeM: number, turned: Outline | null): FenceSide[] {
  // a square block: its tiles, the centre one in from its top left (src/buildings/placedBuildings.ts blockOf)
  const corner = b.size > 1 ? 1 : 0, left = (b.tile % width - corner) * tileSizeM, top = (Math.floor(b.tile / width) - corner) * tileSizeM;
  const square = outlineOf(left + b.size * tileSizeM / 2, top + b.size * tileSizeM / 2, 0, b.size, tileSizeM);
  const corners = outlineCorners(turned ?? square);
  // the front: the side the building faces, (sin rot, cos rot) from its middle; on its square block the side of it
  // nearest that way, as the 3D view draws it square to its block (tileModels.ts squareBlock)
  const facing = b.rot === null ? 0 : turned ? b.rot : quarterTurn(b.rot);
  const o = turned ?? square, fx = Math.sin(facing), fz = Math.cos(facing);
  return corners.map(([ax, az], k) => {
    const [bx, bz] = corners[(k + 1) % 4], mx = (ax + bx) / 2 - o.x, mz = (az + bz) / 2 - o.z;
    return { ax, az, bx, bz, gate: b.rot !== null && (mx * fx + mz * fz) / Math.hypot(mx, mz) > 0.9 };
  });
}

/** The buildings that are fenced: those of two tiles and up whose centre still stands on the map */
export function fencedBuildings(map: CompoundMap): PlacedBuilding[] {
  return (map.buildings?.all() ?? []).filter((b) => {
    // (a temple's wall is its model's own กำแพงแก้ว, src/temples.ts)
    if (b.size < 2 || b.tool === 'temple') return false;
    const x = b.tile % map.width, y = Math.floor(b.tile / map.width);
    return map.getTile ? map.getTile(x, y).isZone() : true;
  });
}

/** The era's fence: its colours and its height (metres), how far apart its posts are, and whether it is a hedge */
const LOOKS = {
  1: { post: RAMPS.gold[600], rail: RAMPS.gold[500], h: 0.9, span: 3, hedge: false },
  2: { post: RAMPS.sand[700], rail: RAMPS.sand[600], h: 1.0, span: 3.5, hedge: false },
  3: { post: RAMPS.sand[300], rail: RAMPS.water[600], h: 0.9, span: 4, hedge: false },
  4: { post: RAMPS.water[700], rail: RAMPS.water[700], h: 1.1, span: 4, hedge: false },
  5: { post: RAMPS.rice[600], rail: RAMPS.rice[500], h: 0.8, span: 4, hedge: true },
} as const;
/** The pale edge of the ground a building holds, along its fence */
const EDGE = RAMPS.sand[200];
/** The gate's width (metres) */
export const GATE_M = 6;

/** The fences of a city, as one mesh, in world units (`units` a metre) on its ground (`ground(x, z)` world units) */
export function compoundGeometry(map: CompoundMap, units: number, ground: (x: number, z: number) => number): BufferGeometry | null {
  const tileSizeM = map.tileSizeM || 16, era = mapEra(map) as keyof typeof LOOKS, look = LOOKS[era] ?? LOOKS[1];
  const parts: BufferGeometry[] = [];
  const colour = (g: BufferGeometry, hex: number): BufferGeometry => {
    const c = new Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(a, 3));
    return g;
  };
  /** A box along a stretch, w across and h high, standing on the ground at its middle */
  const along = (ax: number, az: number, bx: number, bz: number, w: number, h: number, y0: number, hex: number): void => {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 0.05) return;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, y = ground(mx * units, mz * units);
    const g = new BoxGeometry(length * units, h * units, w * units).rotateY(-Math.atan2(bz - az, bx - ax))
      .translate(mx * units, y + (y0 + h / 2) * units, mz * units);
    parts.push(colour(g, hex));
  };
  const post = (x: number, z: number, h: number, hex: number): void => {
    const g = new BoxGeometry(0.25 * units, h * units, 0.25 * units).translate(x * units, ground(x * units, z * units) + h / 2 * units, z * units);
    parts.push(colour(g, hex));
  };
  for (const b of fencedBuildings(map)) {
    for (const side of compoundSides(b, map.width, tileSizeM, laidOutline(map as FootprintMap, b))) {
      const length = Math.hypot(side.bx - side.ax, side.bz - side.az), dx = (side.bx - side.ax) / length, dz = (side.bz - side.az) / length;
      // the stretches either side of the gate, or the whole side
      const runs: [number, number][] = side.gate ? [[0, (length - GATE_M) / 2], [(length + GATE_M) / 2, length]] : [[0, length]];
      for (const [s0, s1] of runs) {
        const ax = side.ax + dx * s0, az = side.az + dz * s0, bx = side.ax + dx * s1, bz = side.az + dz * s1;
        // the edge of the ground it holds, a pale strip just inside the fence that reads from afar
        along(ax, az, bx, bz, 1.2, 0.05, 0.03, EDGE);
        if (look.hedge) { along(ax, az, bx, bz, 0.8, look.h, 0, look.rail); continue; }
        for (const y of era === 3 ? [look.h - 0.12] : [0.35, look.h - 0.15]) along(ax, az, bx, bz, 0.12, 0.12, y, look.rail);
        const n = Math.max(1, Math.round((s1 - s0) / look.span));
        for (let k = 0; k <= n; k++) post(ax + (bx - ax) * k / n, az + (bz - az) * k / n, look.h, look.post);
      }
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometry(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

/** The fences in the city view, laid again when the buildings or the era change */
export class CityCompounds {
  readonly root = new Group();
  private mesh: Mesh | null = null;
  private seen = '';
  constructor(private readonly map: CompoundMap, private readonly units: number,
              private readonly ground: (x: number, z: number) => number) {
    this.root.name = 'compounds';
  }
  private centres = new Set<number>();
  /** Lays the fences again when a building came, went or moved, or the era changed, or a building's centre tile is among
   * the tiles that changed (it fell, or was built again) */
  update(changed: readonly number[]): void {
    const sign = `${this.map.buildings?.version ?? 0}|${mapEra(this.map)}`;
    if (sign === this.seen && !changed.some((i) => this.centres.has(i))) return;
    this.seen = sign;
    this.centres = new Set((this.map.buildings?.all() ?? []).map((b) => b.tile));
    this.clear();
    const geometry = compoundGeometry(this.map, this.units, this.ground);
    if (!geometry) return;
    this.mesh = new Mesh(geometry, eraBuildingMaterial(false));
    this.mesh.name = 'compound-fences';
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.root.add(this.mesh);
  }
  private clear(): void {
    if (this.mesh) { this.mesh.geometry.dispose(); this.root.remove(this.mesh); this.mesh = null; }
  }
  dispose(): void { this.clear(); }
}
