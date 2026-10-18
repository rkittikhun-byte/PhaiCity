/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The camera slides towards the edge the mouse is near while a line is drawn (src/edgeScroll.ts).

import { EDGE_PX, EDGE_SPEED, edgeScroll, MAX_FRAME_SECONDS } from "../src/edgeScroll";

const W = 1000, H = 700;

describe("edge scrolling", () => {
  test("the middle of the screen does not slide, nor a mouse that is not over it", () => {
    expect(edgeScroll(500, 350, W, H, 0.016)).toEqual({ dx: 0, dy: 0 });
    expect(edgeScroll(EDGE_PX + 1, EDGE_PX + 1, W, H, 0.016)).toEqual({ dx: 0, dy: 0 });
    expect(edgeScroll(-1, 100, W, H, 0.016)).toEqual({ dx: 0, dy: 0 });
    expect(edgeScroll(100, -1, W, H, 0.016)).toEqual({ dx: 0, dy: 0 });
  });

  test("each edge slides the camera that way: a drag the other way (right edge a drag to the left, and so on)", () => {
    expect(edgeScroll(W, 350, W, H, 0.1).dx).toBeLessThan(0);
    expect(edgeScroll(0, 350, W, H, 0.1).dx).toBeGreaterThan(0);
    expect(edgeScroll(500, H, W, H, 0.1).dy).toBeLessThan(0);
    expect(edgeScroll(500, 0, W, H, 0.1).dy).toBeGreaterThan(0);
    // ... and only along that edge's way
    expect(edgeScroll(W, 350, W, H, 0.1).dy).toBe(0);
    expect(edgeScroll(500, 0, W, H, 0.1).dx).toBe(0);
  });

  test("it starts gently and is fastest on the very edge, in proportion to the time of the frame", () => {
    const at = (distance: number) => Math.abs(edgeScroll(W - distance, 350, W, H, 0.1).dx);
    expect(at(EDGE_PX)).toBe(0);
    expect(at(EDGE_PX * 0.75)).toBeLessThan(at(EDGE_PX * 0.5));
    expect(at(EDGE_PX * 0.5)).toBeLessThan(at(EDGE_PX * 0.1));
    expect(at(0)).toBeCloseTo(EDGE_SPEED * 0.1, 1);
    expect(Math.abs(edgeScroll(W, 350, W, H, 0.05).dx)).toBeCloseTo(at(0) / 2, 1);
    // A stalled frame does not jump the camera
    expect(Math.abs(edgeScroll(W, 350, W, H, 5).dx)).toBeCloseTo(EDGE_SPEED * MAX_FRAME_SECONDS, 1);
  });

  test("a corner slides both ways, and the two opposite edges of a tiny screen cancel", () => {
    const corner = edgeScroll(W, H, W, H, 0.1);
    expect(corner.dx).toBeLessThan(0);
    expect(corner.dy).toBeLessThan(0);
    expect(edgeScroll(10, 10, 20, 20, 0.1)).toEqual({ dx: 0, dy: 0 });
    expect(edgeScroll(10, 10, 0, 0, 0.1)).toEqual({ dx: 0, dy: 0 });
  });
});
