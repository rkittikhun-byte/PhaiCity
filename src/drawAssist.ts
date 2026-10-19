/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Help while drawing a road, a railway or a canal (owner, 19 Oct 2026: the tool card hid the place to draw, "ทำไม
// ไม่ focus จุดสุดท้ายของถนน?"):
//   - the camera glides to a point just clicked when it lies near the edge or under the cards (focusDrawPoint);
//   - the tool card steps aside once a line is started, and comes back when it is done (setDrawingLine, css
//     "body.drawingLine #toolTray" in tool-dock.css);
//   - with a tool in hand the map slides when the mouse rests near the edge of the screen (src/edgeScroll.ts, game.js
//     edgeScrollView).
// Only the view moves: nothing here changes the city.

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
