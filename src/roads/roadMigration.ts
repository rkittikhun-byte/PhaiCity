/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A save from before the roads were kept in metres (storage version 4, src/storage.js) given its road and rail graphs
// once, from the lines its roads were drawn as (docs/METRE_DRAWING_PLAN.md 1.6): each stroke whose tiles all still
// stand, straight or curved through the points it was drawn through (src/roadPieces.ts RoadPath, the line the 3D view
// drew it as, src/roadGeometry.ts drawnLine), or drawn freely as its tiles smoothed, in short straight pieces. Its
// tiles are left as they are. Roads laid before the strokes were kept, and a map's own roads, stay tiles.

import { decodePresetLayer, decodePresetLayerWide } from "../geo/presetMap";
import { drawnLine, type Point } from "../roadGeometry";
import { readRoadPaths } from "../roadPieces";
import { isAnyRail, isAnyRoad } from "../roadTiles";
import { tileMetres } from "../units";
import { RoadGraph, type Vec } from "./roadGraph";

/** What the migration reads from a save */
interface OldSave {
  width?: number;
  height?: number;
  tileSizeM?: number | null;
  map?: Array<{ value: number }>;
  roadPaths?: unknown;
  roadPieces?: unknown;
  roadLevels?: unknown;
}

/** A freely drawn line's points kept this close to its smoothed line (metres) */
const FREE_TOLERANCE_M = 0.5;

/** Douglas–Peucker: the fewest points within tolerance of the line */
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

/** The road graph and the rail graph of a version 4 save (RoadGraph toJSON data), or none where it drew no strokes */
export function graphsOfOldSave(save: OldSave): { roads?: ReturnType<RoadGraph["toJSON"]>; rails?: ReturnType<RoadGraph["toJSON"]> } {
  const width = Number(save.width), height = Number(save.height), tiles = save.map;
  const paths = readRoadPaths(save.roadPaths);
  if (!width || !height || !Array.isArray(tiles) || tiles.length !== width * height || !Object.keys(paths).length) return {};
  let pieces: Uint16Array | null = null, levels: Uint8Array | null = null;
  try {
    pieces = typeof save.roadPieces === "string" ? decodePresetLayerWide(save.roadPieces, width, height) : null;
    levels = typeof save.roadLevels === "string" ? decodePresetLayer(save.roadLevels, width, height) : null;
  } catch {
    return {};
  }
  if (!pieces) return {};
  const size = tileMetres({ tileSizeM: save.tileSizeM ?? null }), value = (i: number): number => tiles[i].value & 1023;
  // Each stroke's own tiles (those it laid), by its number
  const laid = new Map<number, number[]>();
  for (let i = 0; i < pieces.length; i++) if (pieces[i]) {
    let list = laid.get(pieces[i]);
    if (!list) laid.set(pieces[i], list = []);
    list.push(i);
  }
  const roads = new RoadGraph(), rails = new RoadGraph();
  for (const piece of Object.keys(paths).map(Number).sort((a, b) => a - b)) {
    const path = paths[piece], own = laid.get(piece);
    if (!own || path.tiles.length < 2) continue;
    // ... still all there, every tile it was drawn along a road (or every one a railway)
    const rail = path.tiles.every((i) => i >= 0 && i < tiles.length && isAnyRail(value(i)));
    if (!rail && !path.tiles.every((i) => i >= 0 && i < tiles.length && isAnyRoad(value(i)))) continue;
    // ... at the level most of its own tiles are
    const counts = new Map<number, number>();
    for (const i of own) { const level = rail ? 1 : Math.max(1, levels?.[i] ?? 1); counts.set(level, (counts.get(level) ?? 0) + 1); }
    const level = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    // The line it was drawn as, in metres (world units are ten a tile)
    const metres = (p: readonly [number, number]): Vec => [Math.round(p[0] * size / 10 * 100) / 100, Math.round(p[1] * size / 10 * 100) / 100];
    const middleOf = (i: number): Point => [((i % width) + 0.5) * 10, (Math.floor(i / width) + 0.5) * 10];
    const graph = rail ? rails : roads;
    const controls = path.controls?.map(([x, y]): Vec => [(x + 0.5) * size, (y + 0.5) * size]) ?? null;
    if (path.shape === "straight" && controls && controls.length >= 2) {
      graph.add({ from: controls[0], to: controls[controls.length - 1], level, piece });
    } else if (path.shape === "curve" && controls && (controls.length === 3 || controls.length === 4)) {
      const [a, b] = [controls[0], controls[controls.length - 1]];
      const [c1, c2] = controls.length === 4 ? [controls[1], controls[2]] :
        [[a[0] + (controls[1][0] - a[0]) * 2 / 3, a[1] + (controls[1][1] - a[1]) * 2 / 3] as Vec,
          [b[0] + (controls[1][0] - b[0]) * 2 / 3, b[1] + (controls[1][1] - b[1]) * 2 / 3] as Vec];
      graph.add({ from: a, to: b, c1, c2, level, piece });
    } else {
      // Drawn freely, or a curve of more points: its line in short straight pieces
      const line = simplify(drawnLine(path, middleOf), FREE_TOLERANCE_M * 10 / size).map(metres);
      for (let k = 1; k < line.length; k++) graph.add({ from: line[k - 1], to: line[k], level, piece });
    }
  }
  return { ...(roads.segments.size ? { roads: roads.toJSON() } : {}), ...(rails.segments.size ? { rails: rails.toJSON() } : {}) };
}
