/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A building turned to face a slanted road takes the tiles its turned outline covers (owner, 21 Oct 2026: "ถ้าพื้นที่ที่
// กันไว้ ก็ควรจะมีพื้นที่กั้นไว้นะ"; docs/METRE_DRAWING_PLAN.md 4.4, docs/NO_GRID_PLAN.md 3A). Until then the game
// reserved the square block of tiles round its centre tile whatever way it was turned, so a corner of that block stood
// out past the drawn lot as grass that refused a road, and the lot's own corners reached over tiles no one had
// reserved. Now a 3 x 3 building of the ruler's put down turned (its turn not a quarter turn) has an outline: a square
// of its block's side (48 m on a city map) round its middle, turned with it, which the 3D view fences
// (src/render3d/city/compounds.ts). Its tiles are those whose middle lies inside that outline (a tile more than half
// covered, near enough), its centre tile the one under its middle, the rest laid in its tile family as the square's are.
// A road whose body stays outside the outline may still run through one of those tiles near the edge (a road's tiles
// are those its middle line passes through, src/roads/roadRaster.ts): the road takes it, and the building keeps the
// rest. A road whose body comes inside the outline meets the building, as it always met a square one.
//
// Nothing is saved for it: the outline comes from the building's kept middle, turn and size (gameMap.buildings), and its
// tiles are those of the outline that still hold its tiles. A building put down square, or before the metres, keeps its
// square block.

import type { PlacedBuilding } from "./placedBuildings";

/** The sizes of building that turn their footprint with them: every building of the ruler's two tiles a side and up (the
 * 3 x 3s since 21 Oct 2026; the 2 x 2 plants, the 4 x 4 stadium and port and the 6 x 6 airport since docs/NO_GRID_PLAN.md
 * 3A.1). A one-tile building is its own centre tile, so it has nothing to turn. */
export const TURNED_SIZES: ReadonlySet<number> = new Set([2, 3, 4, 6]);

/** Whether a turn is off the quarter turns, so the outline no longer lies square to the tiles */
export function isTurned(rot: number | null | undefined): boolean {
  if (rot === null || rot === undefined || !Number.isFinite(rot)) return false;
  const quarter = Math.PI / 2, off = Math.abs(rot / quarter - Math.round(rot / quarter)) * quarter;
  return off > 1e-3;
}

/** The centre tile of a building laid turned: the tile under its middle (metres), which lies inside its outline whatever
 * its size (a square block's centre, one in from its top left, may not: a 2 x 2's lies up to a tile off its middle) */
export function turnedCentre(x: number, z: number, tileSizeM: number): { cx: number; cy: number } {
  return { cx: Math.floor(x / tileSizeM), cy: Math.floor(z / tileSizeM) };
}

/** Whether a building of this size and turn takes its turned outline's tiles */
export const turnsFootprint = (size: number, rot: number | null | undefined): boolean => TURNED_SIZES.has(size) && isTurned(rot);

/**
 * A turned rectangle: its middle (metres), its half width across (hu) and half depth ahead (hv), the larger of the two
 * (half, which with SQRT2 bounds its corners), and its axes (unit vectors across and ahead). A building's is its lot,
 * its real width and depth (docs/NO_GRID_PLAN.md 3A.1): every model in art/buildings is made on whole 16 m tiles
 * (assets/models/buildings/index.json lists each kind's tiles), so every lot is still its tiles' square, w = d = size
 * tiles; a kind with a lot of its own needs only its w and d given here.
 */
export interface Outline { x: number; z: number; half: number; hu: number; hv: number; ux: number; uz: number; vx: number; vz: number }

/** The outline of a building of `size` tiles of `tileSizeM` metres, middle (x, z), turned `rot` as the view turns it
 * (its front facing (sin rot, cos rot)), `w` metres wide and `d` deep (its tiles' square unless given) */
export function outlineOf(x: number, z: number, rot: number, size: number, tileSizeM: number,
  w = size * tileSizeM, d = w): Outline {
  const s = Math.sin(rot), c = Math.cos(rot);
  // ahead (its front) is (sin, cos); across is that turned a quarter
  return { x, z, half: Math.max(w, d) / 2, hu: w / 2, hv: d / 2, vx: s, vz: c, ux: c, uz: -s };
}

/** Its four corners, in metres, going round */
export function outlineCorners(o: Outline): [number, number][] {
  const hu = o.hu, hv = o.hv;
  return [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]].map(([u, v]) => [o.x + o.ux * u + o.vx * v, o.z + o.uz * u + o.vz * v]);
}

/** How far a point lies outside the outline (metres; 0 or less inside) */
export function outsideBy(o: Outline, px: number, pz: number): number {
  const dx = px - o.x, dz = pz - o.z, u = Math.abs(dx * o.ux + dz * o.uz) - o.hu, v = Math.abs(dx * o.vx + dz * o.vz) - o.hv;
  if (u <= 0 && v <= 0) return Math.max(u, v);
  return Math.hypot(Math.max(u, 0), Math.max(v, 0));
}

/** The tiles (index y * width + x) whose middle lies inside the outline, on a map width x height of tileSizeM tiles */
export function outlineTiles(o: Outline, width: number, height: number, tileSizeM: number): number[] {
  const reach = Math.ceil(o.half * Math.SQRT2 / tileSizeM) + 1, cx = Math.floor(o.x / tileSizeM), cy = Math.floor(o.z / tileSizeM);
  const out: number[] = [];
  for (let ty = cy - reach; ty <= cy + reach; ty++) for (let tx = cx - reach; tx <= cx + reach; tx++) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    if (outsideBy(o, (tx + 0.5) * tileSizeM, (ty + 0.5) * tileSizeM) <= 1e-6) out.push(ty * width + tx);
  }
  return out;
}

/** The outline of a placed building, or null when it keeps its square block */
export function buildingOutline(b: Pick<PlacedBuilding, "x" | "z" | "rot" | "size">, tileSizeM: number): Outline | null {
  return turnsFootprint(b.size, b.rot) ? outlineOf(b.x, b.z, b.rot!, b.size, tileSizeM) : null;
}

/** The value a tile of a 3 x 3's family takes at (dx, dy) tiles from its centre: the square's own, those past the
 * square as the square's edge beside them (src/buildingTool.js lays the square from centre - 4) */
export function familyValue(centre: number, size: number, dx: number, dy: number): number {
  const reach = size > 1 ? 1 : 0, clamp = (d: number): number => Math.max(-reach, Math.min(size - 1 - reach, d));
  return centre - size - 1 + (clamp(dy) + reach) * size + clamp(dx) + reach;
}

/** Whether a tile value is of the family of a 3 x 3 whose centre value is `centre` */
export const inFamily = (value: number, centre: number, size: number): boolean =>
  value >= centre - size - 1 && value <= centre - size - 1 + size * size - 1;

/** A road or railway as the outline sees it: its middle line's points (metres) and how far its body reaches either side */
export interface LineBody { points: readonly [number, number][]; reach: number }

/** Whether a line's body comes inside the outline */
export function bodyMeets(o: Outline, body: LineBody): boolean {
  const pts = body.points;
  if (pts.length === 1) return outsideBy(o, pts[0][0], pts[0][1]) < body.reach;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], length = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(length / 1));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (outsideBy(o, ax + (bx - ax) * t, az + (bz - az) * t) < body.reach) return true;
    }
  }
  return false;
}

/** The middle line of a straight or curved road as drawn (src/roads/roadDraw.ts), points about a metre apart */
export function drawnPoints(from: readonly [number, number], to: readonly [number, number],
  c1?: readonly [number, number], c2?: readonly [number, number]): [number, number][] {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(2, Math.ceil(length));
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (c1 && c2) {
      const s = 1 - t;
      out.push([s * s * s * from[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * to[0],
        s * s * s * from[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * to[1]]);
    } else out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

/** What of a map the footprints read: its size, its tiles and the buildings kept on it */
export interface FootprintMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  getTileValue(x: number, y: number): number;
  buildings?: { all(): PlacedBuilding[]; atTile(tile: number): PlacedBuilding | undefined; version?: number } | null;
}

const tileSizeOf = (map: FootprintMap): number => map.tileSizeM || 16;

/** The square block's tiles round a centre tile (index), on the map */
function squareTiles(centre: number, size: number, width: number, height: number): number[] {
  const corner = size > 1 ? 1 : 0, left = centre % width - corner, top = Math.floor(centre / width) - corner, out: number[] = [];
  for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) if (x >= 0 && y >= 0 && x < width && y < height) out.push(y * width + x);
  return out;
}

/**
 * The outline of a building as its tiles were laid: its turned outline when it was laid turned, else null. A building
 * put down turned before its tiles turned with it (20-21 Oct 2026) still stands on its square block: it is laid turned
 * when its family holds a tile of the outline past its square, or a tile of its square past the outline holds something
 * else (the outline and the square the same, it does not matter)
 */
export function laidOutline(map: FootprintMap, b: PlacedBuilding): Outline | null {
  const size = tileSizeOf(map), o = buildingOutline(b, size);
  if (!o) return null;
  const value = (i: number): number => map.getTileValue(i % map.width, Math.floor(i / map.width));
  const centreValue = value(b.tile), mine = (i: number): boolean => inFamily(value(i), centreValue, b.size);
  const outline = outlineTiles(o, map.width, map.height, size), square = squareTiles(b.tile, b.size, map.width, map.height);
  const inSquare = new Set(square), inOutline = new Set(outline);
  return outline.some((i) => !inSquare.has(i) && mine(i)) || square.some((i) => i !== b.tile && !inOutline.has(i) && !mine(i)) ? o : null;
}

/** The tiles of the building on centre tile `centre` (index) whose centre value is `value`: its turned outline's tiles
 * that still hold its family (a road may have taken some), or null when it keeps its square block */
export function turnedTilesOf(map: FootprintMap, centre: number, value: number): number[] | null {
  const b = map.buildings?.atTile(centre);
  if (!b) return null;
  const o = laidOutline(map, b);
  if (!o) return null;
  return outlineTiles(o, map.width, map.height, tileSizeOf(map))
    .filter((i) => i === centre || inFamily(map.getTileValue(i % map.width, Math.floor(i / map.width)), value, b.size));
}

/** The turned building whose outline holds tile (x, y), with its outline, or null: those whose centre lies within a
 * few tiles */
export function turnedOwnerAt(map: FootprintMap, x: number, y: number): { b: PlacedBuilding; outline: Outline } | null {
  const placed = map.buildings;
  if (!placed) return null;
  const size = tileSizeOf(map);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    const b = placed.atTile(ty * map.width + tx), o = b ? laidOutline(map, b) : null;
    if (b && o && outsideBy(o, (x + 0.5) * size, (y + 0.5) * size) <= 1e-6) return { b, outline: o };
  }
  return null;
}

/** Every turned building's outline on the map */
export function turnedOutlines(map: FootprintMap): { b: PlacedBuilding; outline: Outline }[] {
  const out: { b: PlacedBuilding; outline: Outline }[] = [];
  for (const b of map.buildings?.all() ?? []) {
    const o = laidOutline(map, b);
    if (o) out.push({ b, outline: o });
  }
  return out;
}

/** What the outline checks roads and railways against: the graphs a city map keeps them in, in metres */
export interface LineGraph {
  readonly segments: ReadonlyMap<number, { level: number; traced?: boolean }>;
  polyline(id: number, step?: number): [number, number][];
}

/** How far a railway's body reaches either side of its line (metres): its sleepers and ballast */
export const RAIL_REACH_M = 2.5;

/**
 * The road or railway whose body comes inside the outline, or null: on a map whose roads are drawn in metres from their
 * graphs (`reachOf` a road level's reach in metres), and the lines read from the tiles as drawn (`drawn`, in metres:
 * the roads and railways that came with the map or were laid a tile at a time), else from the road tiles whose middle
 * lies inside it. A staircase of tiles along a slanted road pokes past the road as drawn, which a building's outline
 * stands against (src/game.js buildingPose), so its tiles alone would refuse every turned building beside it.
 */
export function lineInOutline(o: Outline, map: FootprintMap & { roadGraph?: LineGraph | null; railGraph?: LineGraph | null },
  reachOf: (level: number) => number, isLineTile: (value: number) => boolean,
  drawn?: ReadonlyArray<LineBody & { rail: boolean; box?: readonly [number, number, number, number] }> | null): "road" | "rail" | null {
  const size = tileSizeOf(map);
  if (map.roadGraph || map.railGraph || drawn) {
    for (const [graph, kind] of [[map.roadGraph, "road"], [map.railGraph, "rail"]] as const) {
      if (!graph) continue;
      for (const [id, s] of graph.segments) {
        // (a road of tiles the graph has from them, src/roads/roadCover.ts, stands as drawn among `drawn`)
        if (s.traced) continue;
        const reach = kind === "rail" ? RAIL_REACH_M : reachOf(s.level);
        if (bodyMeets(o, { points: graph.polyline(id, 2), reach })) return kind;
      }
    }
    // (only the lines, and their segments, whose box with their reach comes near the outline's: a state road crosses a
    // whole district's map)
    const far = o.half * Math.SQRT2;
    const apart = (x0: number, z0: number, x1: number, z1: number, reach: number): boolean =>
      x0 - reach > o.x + far || x1 + reach < o.x - far || z0 - reach > o.z + far || z1 + reach < o.z - far;
    for (const body of drawn ?? []) {
      const box = body.box, pts = body.points;
      if (box && apart(box[0], box[1], box[2], box[3], body.reach)) continue;
      if (pts.length === 1 && bodyMeets(o, body)) return body.rail ? "rail" : "road";
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        if (apart(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), body.reach)) continue;
        if (bodyMeets(o, { points: [pts[i - 1], pts[i]], reach: body.reach })) return body.rail ? "rail" : "road";
      }
    }
    return null;
  }
  return outlineTiles(o, map.width, map.height, size)
    .some((i) => isLineTile(map.getTileValue(i % map.width, Math.floor(i / map.width)))) ? "road" : null;
}
