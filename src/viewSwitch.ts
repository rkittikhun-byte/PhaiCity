/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 2D/3D button in the top-right corner. Each view is built when a city opens, so switching saves the city and
// opens it again straight away in the other view: index.html?view=3d&city=<id> (src/cityViewChoice.ts remembers the
// view, src/splashScreen.js opens the city without the start screen).

import { showCornerNote } from "./cornerNote";
import { onLanguageChange, t } from "./i18n/index";

export type ViewKind = "2d" | "3d";

const CITY_ID = /^[a-z0-9]{1,40}$/;

/** Degrees the 3D view turns per press of ⟲ ⟳ or Q and E. */
export const ROTATE_STEP = 15;

/** The page that opens a saved city in a view. */
export function viewSwitchUrl(pathname: string, kind: ViewKind, cityId: string): string {
  return `${pathname}?view=${kind}&city=${encodeURIComponent(cityId)}`;
}

/** The saved city a page asks to open straight away (index.html?city=<id>), or null. */
export function requestedCity(search: string): string | null {
  const id = new URLSearchParams(search).get("city");
  return id !== null && CITY_ID.test(id) ? id : null;
}

interface GameLike {
  cityView: { kind: ViewKind; rotate?(degrees: number): void };
  cityId: string | null;
  /** Saves the city; false when the browser's storage is full. */
  save(): boolean;
}

export function installViewSwitch(game: GameLike, doc: Document = document, location: Location = window.location): void {
  const button = doc.getElementById("viewToggle");
  if (!button) return;
  const other: ViewKind = game.cityView.kind === "3d" ? "2d" : "3d";
  // The turn buttons, only for a view that can turn (the 3D view); Q and E press them (src/toolShortcuts.ts)
  const turns = ([["rotateLeft", -ROTATE_STEP], ["rotateRight", ROTATE_STEP]] as const).flatMap(([id, degrees]) => {
    const turn = doc.getElementById(id);
    if (!turn) return [];
    turn.hidden = typeof game.cityView.rotate !== "function";
    turn.addEventListener("click", () => game.cityView.rotate?.(degrees));
    return [{ turn, key: id === "rotateLeft" ? "view.rotate_left" : "view.rotate_right" }];
  });
  const label = (): void => {
    button.textContent = t(other === "3d" ? "view.to_3d" : "view.to_2d");
    button.title = t("view.switch_title");
    for (const { turn, key } of turns) {
      turn.title = t(key);
      turn.setAttribute("aria-label", turn.title);
    }
  };
  label();
  onLanguageChange(label);

  button.addEventListener("click", () => {
    if (!game.save() || game.cityId === null) {
      showCornerNote(t("view.switch_failed"), 6000);
      return;
    }
    location.assign(viewSwitchUrl(location.pathname, other, game.cityId));
  });
}
