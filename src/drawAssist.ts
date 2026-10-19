/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Help while drawing a road, a railway or a canal (owner, 19 Oct 2026: the tool card hid the place to draw, "ทำไม
// ไม่ focus จุดสุดท้ายของถนน?"):
//   - the camera glides to a point just clicked when it lies near the edge or under the cards (focusDrawPoint);
//   - the tool card steps aside once a line is started, and comes back when it is done (setDrawingLine, css
//     "body.drawingLine #toolTray" in tool-dock.css);
//   - with a tool in hand the map slides when the mouse rests near the edge of the screen (installEdgePan).
// Only the view moves: nothing here changes the city.

import { panOf, type ViewLike } from "./viewControls.js";

/** The part of the screen a clicked point may stay in (fractions of the canvas); outside it the camera recentres.
 *  The bottom stops well above the tool card and the dock. */
export const COMFORT = { left: 0.18, right: 0.82, top: 0.16, bottom: 0.58 } as const;

/** True when a point at (x, y) pixels on a canvas of width × height is outside the comfortable middle. */
export function outsideComfort(x: number, y: number, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const fx = x / width;
  const fy = y / height;
  return fx < COMFORT.left || fx > COMFORT.right || fy < COMFORT.top || fy > COMFORT.bottom;
}

interface CentreView { centreOn(x: number, y: number): void }

/** Glide to tile (tx, ty) when the click at (x, y) on the canvas was near its edge or behind the cards. */
export function focusDrawPoint(view: CentreView, tx: number, ty: number, x: number, y: number,
  canvas: { clientWidth: number; clientHeight: number } | null): boolean {
  if (!canvas || !outsideComfort(x, y, canvas.clientWidth, canvas.clientHeight)) return false;
  view.centreOn(tx, ty);
  return true;
}

/** A line is half drawn (its first point is down): the tool card steps aside until it is finished or dropped. */
export function setDrawingLine(on: boolean, doc: Document | null = typeof document !== "undefined" ? document : null): void {
  doc?.body?.classList.toggle("drawingLine", on);
}

/** How close to the canvas edge, in pixels, the mouse starts sliding the map, and how fast at the very edge. */
export const EDGE_PX = 42;
export const EDGE_SPEED_PX_PER_S = 900;

/** The slide per second for a mouse at (x, y) on a canvas of width × height: zero away from the edges. */
export function edgeVelocity(x: number, y: number, width: number, height: number): { dx: number; dy: number } {
  const push = (distance: number) => distance >= EDGE_PX ? 0 : (1 - Math.max(0, distance) / EDGE_PX) ** 2;
  // The map moves the other way to the mouse, as a drag would: a mouse at the right edge shows more to the right.
  const dx = (push(x) - push(width - x)) * EDGE_SPEED_PX_PER_S;
  const dy = (push(y) - push(height - y)) * EDGE_SPEED_PX_PER_S;
  return { dx, dy };
}

/**
 * With a tool in hand, slides the map while the mouse rests near the edge of the city's canvas (where no panel covers
 * it), as in Cities: Skylines. Not while a button is held, so a drag never fights it.
 */
export function installEdgePan(view: ViewLike, holdingTool: () => boolean, doc: Document = document): void {
  const pan = panOf(view);
  const canvas = doc.getElementById("MicropolisCanvas");
  const win = doc.defaultView;
  if (!pan || !canvas || !win) return;
  let pointer: { x: number; y: number } | null = null;
  let buttons = 0;
  let last = 0;
  let frame = 0;
  const step = (time: number) => {
    frame = 0;
    if (!pointer || buttons !== 0 || !holdingTool()) { last = 0; return; }
    const rect = canvas.getBoundingClientRect();
    const v = edgeVelocity(pointer.x - rect.left, pointer.y - rect.top, rect.width, rect.height);
    if (v.dx === 0 && v.dy === 0) { last = 0; return; }
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
    last = time;
    pan(v.dx * dt, v.dy * dt);
    frame = win.requestAnimationFrame(step);
  };
  const kick = () => { if (!frame) frame = win.requestAnimationFrame(step); };
  canvas.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    buttons = event.buttons;
    kick();
  });
  canvas.addEventListener("pointerdown", (event) => { buttons = event.buttons; });
  canvas.addEventListener("pointerup", (event) => { buttons = event.buttons; kick(); });
  canvas.addEventListener("pointerleave", () => { pointer = null; });
}
