/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The camera follows the mouse to the edge of the screen while a line is being drawn (owner, 18 Oct 2026: "ถ้าจุดที่วาด ออกนอก
// เฟรม ให้เลื่อนกล้องได้ไหม ... มันชนเส้นขอบ หรือ card tool มันบัง"): the point to click next may lie beyond the screen or
// under a card, so with the mouse near an edge the city slides that way, faster the closer the mouse is to the edge. Plain
// code: no DOM, nothing random.

/** Away from drawing (no tool, or a building in hand), only a thin band at the very edge moves the camera, and only after
 * the pointer has rested in it a moment, so passing the edge on the way to a card moves nothing (owner, 23 Oct 2026) */
export const BAND_PX = 8;
export const BAND_DWELL_MS = 200;
/** ... its speed on the very edge (pixels of a drag a second), a building in hand moving at this share of it */
export const BAND_SPEED = 900;
export const BAND_BUILDING_SHARE = 0.5;

/**
 * The thin band's slide in this frame, as a drag of dx, dy pixels: nothing outside the band; inside, faster the nearer
 * the edge (from a third of the speed at the band's inner side to all of it on the edge). `share` slows it.
 */
export function edgeBand(x: number, y: number, width: number, height: number, seconds: number, share = 1): { dx: number; dy: number } {
  if (x < 0 || y < 0 || x > width || y > height || width <= 0 || height <= 0) return { dx: 0, dy: 0 };
  const step = BAND_SPEED * share * Math.min(Math.max(seconds, 0), MAX_FRAME_SECONDS);
  const depth = (distance: number): number => (distance >= BAND_PX ? 0 : 1 / 3 + (2 / 3) * (1 - Math.max(0, distance) / BAND_PX));
  const dx = depth(x) * step - depth(width - x) * step, dy = depth(y) * step - depth(height - y) * step;
  return { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 };
}

/** How near the edge (pixels) the mouse must be for the camera to start sliding */
export const EDGE_PX = 56;
/** The camera's speed with the mouse on the very edge, in pixels of a mouse drag a second (src/viewControls.ts panOf) */
export const EDGE_SPEED = 750;
/** The longest step of time (seconds) a frame slides for, so a stalled frame does not jump the camera */
export const MAX_FRAME_SECONDS = 0.1;

/**
 * How far to slide the camera in this frame, as a drag of dx, dy pixels (a drag to the right slides the city to the right,
 * so the camera goes left): nothing when the mouse is further than EDGE_PX from every edge of a width × height screen,
 * else towards the nearest edges, in proportion to the square of how deep into the margin it is, so it is gentle at
 * first. The mouse is at (x, y) in pixels from the screen's top left; x or y below 0 is a mouse that is not over it.
 */
export function edgeScroll(x: number, y: number, width: number, height: number, seconds: number): { dx: number; dy: number } {
  if (x < 0 || y < 0 || x > width || y > height || width <= 0 || height <= 0) return { dx: 0, dy: 0 };
  const step = EDGE_SPEED * Math.min(Math.max(seconds, 0), MAX_FRAME_SECONDS);
  const depth = (distance: number): number => {
    const share = Math.min(1, Math.max(0, 1 - distance / EDGE_PX));
    return share * share;
  };
  // Left and top edges move the camera that way, which is a drag the other way
  const dx = depth(x) * step - depth(width - x) * step;
  const dy = depth(y) * step - depth(height - y) * step;
  return { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 };
}
