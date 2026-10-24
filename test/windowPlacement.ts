/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { besidePosition, clearOfHud, replacingPosition } from "../src/windowPlacement";

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

  test("a card in the bottom middle, the tools dock, gets its window above it", () => {
    const dock = { left: 285, top: 698, width: 710, height: 70 };
    expect(besidePosition(dock, { width: 210, height: 230 }, view)).toEqual({ left: 535, top: 458, from: "below" });
  });

  test("a card in the top bar, the era in the city's status, gets its window under it", () => {
    const era = { left: 520, top: 10, width: 90, height: 34 };
    expect(besidePosition(era, { width: 310, height: 400 }, view)).toEqual({ left: 520, top: 54, from: "above" });
    // ... kept on screen at the right edge
    expect(besidePosition({ ...era, left: 1200 }, { width: 310, height: 400 }, view).left).toBe(1280 - 12 - 310);
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

  test("a window keeps above the dock, its card and the time bar, and scrolls inside when it is too tall", () => {
    const dock = { left: 374, top: 638, width: 276, height: 50 };
    const levels = { left: 400, top: 520, width: 220, height: 108 };
    const timeBar = { left: 64, top: 666, width: 360, height: 42 };
    const topBar = { left: 12, top: 12, width: 1000, height: 38 };
    const small = { width: 1024, height: 700 };
    // above the dock's own card, not behind it
    expect(clearOfHud(390, 450, { width: 300, height: 200 }, small, [dock, levels])).toEqual({ top: 310, maxHeight: 200 });
    // a window beside the menu keeps above the time bar
    expect(clearOfHud(64, 300, { width: 340, height: 400 }, small, [timeBar, dock])).toEqual({ top: 228, maxHeight: 400 });
    // a window clear of every box is left as it is
    expect(clearOfHud(700, 100, { width: 300, height: 300 }, small, [dock, levels, timeBar])).toEqual({ top: 100, maxHeight: 300 });
    // too tall: from the top bar down to the floor
    expect(clearOfHud(64, 60, { width: 340, height: 900 }, small, [topBar, timeBar, dock]))
      .toEqual({ top: 60, maxHeight: 568 });
  });
});
