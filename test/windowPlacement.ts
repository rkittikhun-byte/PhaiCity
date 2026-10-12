/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { besidePosition, replacingPosition } from "../src/windowPlacement";

describe("windows beside their card", () => {
  const view = { width: 1280, height: 720 };
  const menu = { left: 0, top: 155, width: 150, height: 250 };
  const tools = { left: 1012, top: 48, width: 268, height: 270 };

  test("a card on the left gets its window on its right, level with its top", () => {
    expect(besidePosition(menu, { width: 340, height: 300 }, view)).toEqual({ left: 160, top: 155, from: "left" });
  });

  test("a card on the right gets its window on its left", () => {
    expect(besidePosition(tools, { width: 250, height: 200 }, view)).toEqual({ left: 752, top: 48, from: "right" });
  });

  test("a tall window moves up to stay on screen, but never past the top", () => {
    expect(besidePosition(menu, { width: 340, height: 600 }, view).top).toBe(720 - 12 - 600);
    expect(besidePosition(menu, { width: 340, height: 900 }, view).top).toBe(12);
  });

  test("a wide window stays inside the screen", () => {
    expect(besidePosition(menu, { width: 1200, height: 300 }, view).left).toBe(1280 - 12 - 1200);
  });

  test("a window opened from another window takes its place", () => {
    const other = { left: 160, top: 155, width: 320, height: 400 };
    expect(replacingPosition(other, "left", { width: 380, height: 300 }, view)).toEqual({ left: 160, top: 155, from: "left" });
    const right = { left: 752, top: 48, width: 250, height: 200 };
    expect(replacingPosition(right, "right", { width: 300, height: 200 }, view)).toEqual({ left: 702, top: 48, from: "right" });
  });
});
