/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Where a building goes against the road nearest the mouse (owner, 14 Oct 2026: "จะขยับซ้ายหรือขวา ให้ขยับได้ ทีละช่อง
// ทุก object"; 15 Oct: "tool ทุก tool จะต้อง snap กับ ถนน"): slid along the road a zone cell (2 m) at a time, turned to
// face it, its front at the road's edge. Where the road curves into a corner of a turned outline, or a junction's arm
// comes inside it, it is stood back 2 m at a time, then slid along the road, to the nearest place the build
// command takes it and it still touches the road (owner, 22 Oct 2026: "ทำไมวางตรงนี้ไม่ได้"); the game's outline and
// click both come from here (src/game.js buildingPose).

import { blockOf } from "./placedBuildings";
import { isTurned, TURNED_SIZES } from "./turnedFootprint";
import { besideRoad } from "../cityCommands";
import { roadReach } from "../roadGeometry";
import { unitsPerMetre } from "../units";

type Point = readonly [number, number];

export interface RoadPoseMap {
  readonly width: number;
  readonly height: number;
  /** Metres a tile */
  readonly tileSizeM: number;
  /** World units a metre on a real-scale city map, else null (src/roadGeometry.ts realUnits) */
  readonly realUnits: number | null;
  isRoad(x: number, y: number): boolean;
}

export interface RoadPoseOptions {
  /** How far apart the places along the road are, metres (a zone cell, 2 m; the move tool slides a metre at a time) */
  stepMetres?: number;
  /** How much of its tiles a building smaller than 3 x 3 is drawn at (src/render3d/city/tileModels.ts BUILDING_SCALE) */
  buildingScale?: number;
  /** Why the build command would refuse a pose ([x, z, rot] in world units), or null (CityCommands.quoteBuild); given,
   * a turned building that meets a road where it would stand is moved to the nearest place it fits */
  refusal?: ((pose: [number, number, number]) => string | null) | null;
  /** The refusals a place along the road may put right: a road in the way (first), or none beside it */
  placeReasons?: readonly string[];
}

/** How far a turned building is stood back from its road, at most, and slid along it either way (metres) */
export const FIT_BACK_M = 16;
export const FIT_SLIDE_M = 16;
/** ... stood back this much at a time (metres) */
export const FIT_BACK_STEP_M = 2;

/**
 * [x, z, rotation] in world units (10 a tile) of a building of `size` tiles against the road of `lines` (world units,
 * each with its level in `levels`) nearest (px, pz), or null when no road is within reach
 */
export function roadPose(map: RoadPoseMap, lines: readonly (readonly Point[])[], levels: readonly number[], px: number,
  pz: number, size: number, options: RoadPoseOptions = {}): [number, number, number] | null {
  let best: { line: readonly Point[]; level: number; along: number } | null = null, bestDistance = size * 5 + 20;
  lines.forEach((line, n) => {
    let along = 0;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az;
      const length = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (length * length)));
      const distance = Math.hypot(ax + dx * t - px, az + dz * t - pz);
      if (distance < bestDistance) { bestDistance = distance; best = { line, level: levels[n], along: along + t * length }; }
      along += length;
    }
  });
  if (best === null) return null;
  const road: { line: readonly Point[]; level: number; along: number } = best;
  const metre = unitsPerMetre(map.tileSizeM), step = (options.stepMetres || 2) * metre;
  let total = 0;
  for (let i = 1; i < road.line.length; i++) total += Math.hypot(road.line[i][0] - road.line[i - 1][0], road.line[i][1] - road.line[i - 1][1]);
  const want = Math.min(total, Math.round(road.along / step) * step);
  // The side of the road the mouse is on, at the place it points to
  const at = pointAlong(road.line, want);
  if (at === null) return null;
  const side = at.nx * (px - at.rx) + at.nz * (pz - at.rz) < 0 ? -1 : 1;
  const first = poseAt(map, road.line, road.level, want, side, 0, size, options);
  if (first === null) return null;
  const refusal = options.refusal, fixable = options.placeReasons ?? [];
  if (!refusal || !isTurned(first[2])) return first;
  const why = refusal(first);
  if (why === null || fixable.indexOf(why) === -1) return first;
  // ... stood back from the road, then slid along it a step at a time either way, each stood back as far, to the
  // nearest place it fits and still touches the road
  const slides = [0];
  for (let d = step; d <= FIT_SLIDE_M * metre + 1e-6; d += step) slides.push(d, -d);
  for (const slide of slides) {
    for (let back = slide === 0 ? FIT_BACK_STEP_M : 0; back <= FIT_BACK_M; back += FIT_BACK_STEP_M) {
      const pose = poseAt(map, road.line, road.level, want + slide, side, back * metre, size, options);
      if (pose === null) break;
      const reason = refusal(pose);
      if (reason === null || fixable.indexOf(reason) === -1) return reason === null ? pose : first;
      // (stood further back, it touches the road no more)
      if (reason !== fixable[0]) break;
    }
  }
  return first;
}

/** The point `along` world units along the line, and the way across it (its left) */
function pointAlong(line: readonly Point[], along: number): { rx: number; rz: number; nx: number; nz: number } | null {
  if (line.length < 2 || along < 0) return null;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], dx = line[i][0] - ax, dz = line[i][1] - az, length = Math.hypot(dx, dz) || 1;
    if (walked + length >= along || i === line.length - 1) {
      if (walked + length < along - 1e-6) return null;
      const t = Math.max(0, Math.min(1, (along - walked) / length));
      return { rx: ax + dx * t, rz: az + dz * t, nx: -dz / length, nz: dx / length };
    }
    walked += length;
  }
  return null;
}

/** The pose at `along` on the road's `side`, stood `back` world units further from it than its front at the road's
 * edge; a square block stood back a metre at a time while it would cover a road's tiles or stand beside none */
function poseAt(map: RoadPoseMap, line: readonly Point[], level: number, along: number, side: number, back: number,
  size: number, options: RoadPoseOptions): [number, number, number] | null {
  const at = pointAlong(line, along);
  if (at === null) return null;
  const nx = at.nx * side, nz = at.nz * side, { rx, rz } = at;
  // (a building of two tiles a side and up its whole block deep, as it takes the tiles of its outline turned with it,
  // the outline's front at the road's edge: src/buildings/turnedFootprint.ts; a one-tile one as deep as it is drawn)
  const whole = TURNED_SIZES.has(size), turns = whole && isTurned(Math.atan2(-nx, -nz)), metre = unitsPerMetre(map.tileSizeM);
  let gap = roadReach(level, map.realUnits) + 0.6 + size * 5 * (whole ? 1 : options.buildingScale ?? 1) + back;
  const inside = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
  for (let step = 0; step <= 24 && !turns; step++) {
    const block = blockOf(rx + nx * (gap + step * metre), rz + nz * (gap + step * metre), size, 10);
    let clear = true;
    for (let ty = block.top; ty < block.top + size && clear; ty++)
      for (let tx = block.left; tx < block.left + size && clear; tx++) clear = inside(tx, ty) && !map.isRoad(tx, ty);
    if (clear && besideRoad(map.width, map.height, (x, y) => inside(x, y) && map.isRoad(x, y), block.cx, block.cy, size)) {
      gap += step * metre;
      break;
    }
  }
  return [Math.round((rx + nx * gap) * 100) / 100, Math.round((rz + nz * gap) * 100) / 100,
    Math.round(Math.atan2(-nx, -nz) * 1000) / 1000];
}
