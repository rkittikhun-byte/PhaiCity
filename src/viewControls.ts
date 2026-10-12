/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 3D view's corner buttons: ⟲ ⟳ turn it (keys Q and E, src/toolShortcuts.ts) and ⌂ brings the camera back to
// where it started. They show only when the view can do it, so the 2D fallback has none.
// Also: index.html?city=<id> opens a saved city straight away (src/splashScreen.js).

import { onLanguageChange, t } from "./i18n/index";

const CITY_ID = /^[a-z0-9]{1,40}$/;

/** Degrees the 3D view turns per press of ⟲ ⟳ or Q and E. */
export const ROTATE_STEP = 15;

/** The saved city a page asks to open straight away (index.html?city=<id>), or null. */
export function requestedCity(search: string): string | null {
  const id = new URLSearchParams(search).get("city");
  return id !== null && CITY_ID.test(id) ? id : null;
}

interface ViewLike {
  rotate?(degrees: number): void;
  resetView?(): void;
  /** The 3D view's own camera (src/render3d/city/camera.ts), until it has rotate and resetView itself. */
  navigation?: { rotate?(dx: number, dy: number): unknown; reset?(): unknown };
}

// Until Codex's 3D view has rotate(degrees) and resetView() (RENDERER_SPEC section 4, Prompt R2), its camera's own
// controls do the work: a right-button drag turns the heading by 0.006 radians per pixel, and reset() goes back to
// the opening view. Read-only use of the view's public camera; once the view has the functions they are used instead.
const RADIANS_PER_DRAG_PIXEL = 0.006;

/** How to turn this view by degrees, or null when it cannot turn. */
export function turnOf(view: ViewLike): ((degrees: number) => void) | null {
  if (typeof view.rotate === "function") return (degrees) => view.rotate?.(degrees);
  const navigation = view.navigation;
  if (navigation && typeof navigation.rotate === "function") {
    return (degrees) => navigation.rotate?.(-(degrees * Math.PI / 180) / RADIANS_PER_DRAG_PIXEL, 0);
  }
  return null;
}

/** How to bring this view back to where it started, or null when it has no such thing. */
export function resetOf(view: ViewLike): (() => void) | null {
  if (typeof view.resetView === "function") return () => view.resetView?.();
  const navigation = view.navigation;
  if (navigation && typeof navigation.reset === "function") return () => navigation.reset?.();
  return null;
}

export function installViewControls(view: ViewLike, doc: Document = document): void {
  const turn = turnOf(view);
  const reset = resetOf(view);
  const buttons = [
    { id: "rotateLeft", key: "view.rotate_left", action: turn && (() => turn(-ROTATE_STEP)) },
    { id: "rotateRight", key: "view.rotate_right", action: turn && (() => turn(ROTATE_STEP)) },
    { id: "viewReset", key: "view.reset", action: reset },
  ].flatMap(({ id, key, action }) => {
    const button = doc.getElementById(id);
    if (!button) return [];
    button.hidden = action === null;
    if (action) button.addEventListener("click", action);
    return [{ button, key }];
  });

  const label = (): void => {
    for (const { button, key } of buttons) {
      button.title = t(key);
      button.setAttribute("aria-label", button.title);
    }
  };
  label();
  onLanguageChange(label);
}
