/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which drawn line laid each road or railway tile (owner, 18 Oct 2026: "ถนนที่สร้างไปแล้ว และฉันสร้างต่อ จะต้องไม่เปลี่ยนรูป
// ถนนอีก", and of railways "ทำทางรถไฟแบบเดียวกันด้วย"), as Cities: Skylines keeps every road it draws as a segment of its
// own. Each stroke of a road or rail tool is a new piece, numbered up from 1, and the tiles it lays where there was no
// road or railway take its number (gameMap.roadPieces, two bytes a tile; saved as roadPieces; src/cityCommands.ts). The
// lines (src/roadGeometry.ts) are smoothed a piece at a time and run on through a junction only along one piece, so a
// line built on from another's end, leaving it or crossing it never moves it. 0 is a line laid before the pieces were
// kept, or that came with the map. Plain code, no DOM.

/** The highest piece number; the lines drawn after it share it, and join as roads did before the pieces */
export const MAX_ROAD_PIECE = 65535;

export function newRoadPieces(width: number, height: number): Uint16Array {
  return new Uint16Array(width * height);
}

/** The number the next drawn line takes: one above every piece on the map */
export function nextRoadPiece(pieces: ArrayLike<number> | null | undefined): number {
  let top = 0;
  if (pieces) for (let i = 0; i < pieces.length; i++) if (pieces[i] > top) top = pieces[i];
  return Math.min(MAX_ROAD_PIECE, top + 1);
}

/**
 * The tiles a piece was drawn along, in order (gameMap.roadPaths[piece], saved as roadPaths): its shape is worked out
 * once from them (src/roadGeometry.ts frozen), so bulldozing some of its tiles cuts it and never moves the rest (owner,
 * 18 Oct 2026: "ถ้าลบ ไม่ต้องใช้ฟังก์ชั่นนี้ ให้ถนนมันอยู่กับที่ห้ามขยับ"). from and to: the older pieces whose tiles it began and
 * ended on (0 for none), whose way it bends out of at a joint.
 */
export interface RoadPath {
  from: number;
  to: number;
  tiles: number[];
  /** How it was drawn (src/drawModes.ts): one straight line, the curve through its clicked points (controls, in tiles,
   * as src/drawPaths.ts curvePath bends it), or free (its tiles, smoothed); none for a road laid tile by tile */
  shape?: LineShape;
  controls?: Array<[number, number]>;
}

export const LINE_SHAPES = ["straight", "curve", "free"] as const;
export type LineShape = typeof LINE_SHAPES[number];

/** A save's paths, those that read as paths */
export function readRoadPaths(saved: unknown): Record<number, RoadPath> {
  const out: Record<number, RoadPath> = {};
  if (!saved || typeof saved !== "object") return out;
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    const path = value as Partial<RoadPath> | null;
    if (!path || !Array.isArray(path.tiles) || !path.tiles.every((i) => Number.isInteger(i))) continue;
    const read: RoadPath = { from: Number(path.from) || 0, to: Number(path.to) || 0, tiles: path.tiles.slice() };
    if ((LINE_SHAPES as readonly string[]).includes(path.shape as string)) read.shape = path.shape;
    if (Array.isArray(path.controls) && path.controls.every((c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger))) {
      read.controls = path.controls.map(([x, y]) => [x, y]);
    }
    out[Number(key)] = read;
  }
  return out;
}

/** The paths a save keeps: those of the pieces still on the map, and those their shapes bend out of */
export function roadPathsKept(paths: Readonly<Record<number, RoadPath>> | null | undefined,
                              onMap: Iterable<number>): Record<number, RoadPath> | undefined {
  if (!paths) return undefined;
  const kept: Record<number, RoadPath> = {}, queue = [...onMap];
  while (queue.length) {
    const piece = queue.pop()!, path = paths[piece];
    if (!path || kept[piece]) continue;
    kept[piece] = path;
    queue.push(path.from, path.to);
  }
  return Object.keys(kept).length ? kept : undefined;
}
