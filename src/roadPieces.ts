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
