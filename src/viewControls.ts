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

/** Where a 3D camera looks from: the heading and pitch in radians, its distance, and the ground point it looks at. */
export interface Pose { heading: number; pitch: number; distance: number; x: number; z: number }

interface CameraLike {
  rotate?(dx: number, dy: number): unknown;
  reset?(): unknown;
  pan?(dx: number, dy: number, height: number): unknown;
  update?(time: number): unknown;
  heading?: number;
  pitch?: number;
  distance?: number;
  target?: { x: number; z: number };
}

interface ViewLike {
  rotate?(degrees: number): void;
  resetView?(): void;
  pan?(dx: number, dy: number): void;
  height?: number;
  /** The 3D view's own camera (src/render3d/city/camera.ts), until it has rotate and resetView itself. */
  navigation?: CameraLike;
}

/** How long the camera takes to fly home when ⌂ is pressed. */
export const HOME_FLIGHT_MS = 1100;

/** Part of the way from one pose to another (t from 0 to 1), turning the short way round. */
export function blendPose(from: Pose, to: Pose, t: number): Pose {
  const turn = ((to.heading - from.heading) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const mix = (a: number, b: number): number => a + (b - a) * t;
  return {
    heading: from.heading + turn * t,
    pitch: mix(from.pitch, to.pitch),
    distance: from.distance * Math.pow(to.distance / from.distance, t),
    x: mix(from.x, to.x),
    z: mix(from.z, to.z),
  };
}

/** Slow to start, slow to stop. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function poseOf(camera: CameraLike): Pose | null {
  const { heading, pitch, distance, target } = camera;
  if (typeof heading !== "number" || typeof pitch !== "number" || typeof distance !== "number" || !target) return null;
  return { heading, pitch, distance, x: target.x, z: target.z };
}

function setPose(camera: CameraLike, pose: Pose): void {
  camera.heading = pose.heading;
  camera.pitch = pose.pitch;
  camera.distance = pose.distance;
  if (camera.target) {
    camera.target.x = pose.x;
    camera.target.z = pose.z;
  }
  camera.update?.(performance.now());
}

// The flight home in progress; any drag, key turn or zoom by the player stops it where it is
let homeFlight = 0;

/** Metres per map tile in the 3D world (docs/3d/MODEL_SPEC.md: TILE_M). */
const TILE_M = 10;
// The tile ⌂ comes back to: a whole-province city's town, or null for the middle of the map
let homeTile: { x: number; y: number } | null = null;

/** Sets where ⌂ brings the camera back to: a whole-province city's town (src/game.js), or null for the map's middle. */
export function setViewHome(tile: { x: number; y: number } | null): void {
  homeTile = tile;
}

/** Stops a flight home in progress. */
export function stopHomeFlight(): void {
  if (homeFlight) cancelAnimationFrame(homeFlight);
  homeFlight = 0;
}

/**
 * Flies the camera home: it slides, turns, tilts and zooms together back to the view a city opens with (owner,
 * 12 Oct 2026). The opening view is read from the camera's own reset(), so it is never written down twice; on a
 * whole-province map it looks at the town instead of the map's middle.
 */
function flyHome(camera: CameraLike & { reset(): unknown }): void {
  stopHomeFlight();
  const from = poseOf(camera);
  camera.reset();
  if (homeTile && camera.target) {
    camera.target.x = (homeTile.x + 0.5) * TILE_M;
    camera.target.z = (homeTile.y + 0.5) * TILE_M;
  }
  const to = poseOf(camera);
  if (!from || !to) return;
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  setPose(camera, from);
  const start = performance.now();
  const step = (): void => {
    const t = Math.min(1, (performance.now() - start) / HOME_FLIGHT_MS);
    setPose(camera, blendPose(from, to, easeInOut(t)));
    homeFlight = t < 1 ? requestAnimationFrame(step) : 0;
  };
  homeFlight = requestAnimationFrame(step);
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
  if (navigation && typeof navigation.reset === "function") {
    const camera = navigation as CameraLike & { reset(): unknown };
    return () => flyHome(camera);
  }
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
import { cameraMode } from "./cameraModes.js";

export function installMousePan(view: ViewLike, holdingTool: () => boolean, doc: Document = document,
  onClick?: (x: number, y: number) => void): void {
  const pan = panOf(view);
  const turn = dragTurnOf(view);
  const canvas = doc.getElementById("MicropolisCanvas");
  if (!pan || !canvas) return;
  let drag: { id: number; x: number; y: number; moved: boolean; shift: boolean; turning: boolean } | null = null;

  // The player taking the camera stops a flight home
  canvas.addEventListener("wheel", stopHomeFlight, { passive: true });
  canvas.addEventListener("pointerdown", (event) => {
    stopHomeFlight();
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
    // The camera buttons' mode (src/cameraModes.ts): pan, rotate, zoom or tilt; free as always
    const camera = cameraMode(), navigation = (view as { navigation?: { zoom?(d: number, x: number, y: number, w: number, h: number): void } }).navigation;
    if (camera === "pan") pan(dx, dy);
    else if (camera === "rotate") turn?.(dx, 0);
    else if (camera === "tilt") turn?.(0, dy);
    else if (camera === "zoom") {
      const rect = canvas.getBoundingClientRect();
      navigation?.zoom?.(dy * 4, rect.width / 2, rect.height / 2, rect.width, rect.height);
    } else if (drag.turning) turn?.(dx, dy);
    else pan(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  const end = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    // A press that never became a drag is a click: what is there (src/inspect.ts), in pixels over the canvas
    const clicked = !drag.moved && event.type === "pointerup" && cameraMode() === "free";
    drag = null;
    canvas.classList.remove("panning");
    if (clicked && onClick) {
      const rect = canvas.getBoundingClientRect();
      onClick(event.clientX - rect.left, event.clientY - rect.top);
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

// How the city's view turns for the Q and E keys (src/toolShortcuts.ts), once a city is open
let turnCurrent: ((degrees: number) => void) | null = null;

/** Turns the city's view one step left (-1) or right (1). False when it cannot turn (no city, or the 2D view). */
export function turnView(direction: number): boolean {
  if (!turnCurrent) return false;
  if (homeFlight) stopHomeFlight();
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
