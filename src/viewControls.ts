/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The 3D view's controls besides its own mouse: the keys Q and E turn it (src/toolShortcuts.ts), the ⌂ corner
// button brings the camera back to where it started (shown only when the view can, so the 2D fallback has none),
// and a left-button drag with no tool in hand slides the city.
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
  pan?(dx: number, dy: number): void;
  height?: number;
  /** The 3D view's own camera (src/render3d/city/camera.ts), until it has rotate and resetView itself. */
  navigation?: { rotate?(dx: number, dy: number): unknown; reset?(): unknown; pan?(dx: number, dy: number, height: number): unknown };
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

/** How to slide this view along with a mouse drag of dx, dy pixels, or null when it cannot. */
export function panOf(view: ViewLike): ((dx: number, dy: number) => void) | null {
  if (typeof view.pan === "function") return (dx, dy) => view.pan?.(dx, dy);
  const navigation = view.navigation;
  if (navigation && typeof navigation.pan === "function") {
    return (dx, dy) => navigation.pan?.(dx, dy, Math.max(1, view.height ?? 1));
  }
  return null;
}

/** How to turn (and tilt) this view along with a mouse drag of dx, dy pixels, as a right-button drag does. */
export function dragTurnOf(view: ViewLike): ((dx: number, dy: number) => void) | null {
  const navigation = view.navigation;
  if (navigation && typeof navigation.rotate === "function") return (dx, dy) => navigation.rotate?.(dx, dy);
  if (typeof view.rotate === "function") return (dx) => view.rotate?.(-dx * RADIANS_PER_DRAG_PIXEL * 180 / Math.PI);
  return null;
}

/** Pixels the mouse must move with the button down before a press becomes a drag, and its direction is read. */
export const DRAG_START_PX = 8;

/** A drag that starts closer than this to straight across or straight up and down turns; one in between slides. */
export const DIAGONAL_FROM_DEGREES = 25;

/**
 * What a left-button drag does, from the way its first few pixels go: across or up and down turns the city, a slant
 * slides it, and with Shift held (or a view that cannot turn) it always slides.
 */
export function dragMode(dx: number, dy: number, shift: boolean, canTurn: boolean): "turn" | "pan" {
  if (shift || !canTurn) return "pan";
  const degrees = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
  return degrees < DIAGONAL_FROM_DEGREES || degrees > 90 - DIAGONAL_FROM_DEGREES ? "turn" : "pan";
}

/**
 * With no tool in hand, dragging the city with the left button turns it: to the right turns it right, up and down
 * tilt the camera; a slanting drag slides it instead (owner, 12 Oct 2026, playing on a touchpad), and so does any
 * drag with Shift held. The view's own controls stay as they are: dragging with the right button turns it, with the
 * middle button slides it, and the wheel zooms toward the mouse.
 */
export function installMousePan(view: ViewLike, holdingTool: () => boolean, doc: Document = document): void {
  const pan = panOf(view);
  const turn = dragTurnOf(view);
  const canvas = doc.getElementById("MicropolisCanvas");
  if (!pan || !canvas) return;
  let drag: { id: number; x: number; y: number; moved: boolean; shift: boolean; turning: boolean } | null = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || holdingTool()) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, shift: event.shiftKey, turning: false };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the drag still follows moves over the city
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    canvas.classList.toggle("canPan", !holdingTool());
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
    // The first few pixels decide what this whole drag does
    if (!drag.moved) drag.turning = dragMode(dx, dy, drag.shift, turn !== null) === "turn";
    drag.moved = true;
    canvas.classList.add("panning");
    if (drag.turning) turn?.(dx, dy);
    else pan(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  const end = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    canvas.classList.remove("panning");
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

// How the city's view turns for the Q and E keys (src/toolShortcuts.ts), once a city is open
let turnCurrent: ((degrees: number) => void) | null = null;

/** Turns the city's view one step left (-1) or right (1). False when it cannot turn (no city, or the 2D view). */
export function turnView(direction: number): boolean {
  if (!turnCurrent) return false;
  turnCurrent(Math.sign(direction) * ROTATE_STEP);
  return true;
}

export function installViewControls(view: ViewLike, doc: Document = document): void {
  // The turn buttons are gone (owner, 12 Oct 2026: the mouse and Q and E turn the city); ⌂ stays
  turnCurrent = turnOf(view);
  const reset = resetOf(view);
  const button = doc.getElementById("viewReset");
  if (!button) return;
  // A drawn house, so it sits in the middle of its circle whatever the font (owner, 12 Oct 2026)
  button.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/></svg>';
  button.hidden = reset === null;
  if (reset) button.addEventListener("click", reset);

  const label = (): void => {
    button.title = t("view.reset");
    button.setAttribute("aria-label", button.title);
  };
  label();
  onLanguageChange(label);
}
