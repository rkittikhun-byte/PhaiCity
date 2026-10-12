/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which view draws the city: the original 2D tiles, or the three.js city (docs/3d/RENDERER_SPEC.md) while it is
// being built. index.html?view=3d chooses 3D and ?view=2d goes back; the choice is remembered, because "Main menu"
// reloads the page without the address's parameters. 2D stays the default until the 3D view is complete.

export type ViewKind = "2d" | "3d";

const STORAGE_KEY = "phaicity.view";

type Store = Pick<Storage, "getItem" | "setItem">;

export function chooseViewKind(search: string, store: Store | null): ViewKind {
  const asked = new URLSearchParams(search).get("view");
  if (asked === "2d" || asked === "3d") {
    try {
      store?.setItem(STORAGE_KEY, asked);
    } catch {
      // Remembered for this page only
    }
    return asked;
  }
  try {
    return store?.getItem(STORAGE_KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}
