/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which view draws the city. The three.js city (docs/3d/RENDERER_SPEC.md) is the game's view (owner, 12 Oct 2026:
// "3D only, no 2D"). The original 2D tiles remain only as the fallback when 3D cannot start on a computer
// (src/game.js), and for developers at index.html?view=2d, which is not remembered.

export type ViewKind = "2d" | "3d";

export function chooseViewKind(search: string): ViewKind {
  return new URLSearchParams(search).get("view") === "2d" ? "2d" : "3d";
}
