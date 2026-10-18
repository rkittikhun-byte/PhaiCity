/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The numbers shown while a line is drawn (src/drawReadout.ts): how big a tile is on the screen, each point's tile and
// height, why a click lands where it does, and what a built line laid.

import { pixelsPerTile, pointText, snapWhy, strokeText, tileHeight } from "../src/drawReadout";
import { setLanguage } from "../src/i18n/index";

describe("the drawing readout", () => {
  beforeAll(() => setLanguage("th"));

  test("a tile's size on the screen comes from where the view finds the ground", () => {
    // 40 pixels across is 2 tiles: 20 pixels a tile
    const view = { pointAt: (x: number, y: number) => ({ x: x / 20, y: y / 20 }) };
    expect(pixelsPerTile(view, 100, 100)).toBeCloseTo(20);
    expect(pixelsPerTile({}, 100, 100)).toBeNull();
    expect(pixelsPerTile({ pointAt: () => null }, 100, 100)).toBeNull();
  });

  test("a point's tile and its ground's height", () => {
    const map = { width: 4, height: 3, heights: new Float32Array(12).map((_, i) => 160 + i / 2) };
    expect(tileHeight(map, { x: 1, y: 2 })).toBeCloseTo(164.5);
    expect(tileHeight({ width: 4, height: 3 }, { x: 1, y: 2 })).toBeNull();
    expect(pointText("A", { x: 1, y: 2 }, 164.5)).toBe("A (1, 2, 164.5 ม.)");
    expect(pointText("B", { x: 1, y: 2 }, null)).toBe("B (1, 2, – ม.)");
  });

  test("why a click lands where it does", () => {
    // A road along row 10 from x = 5 to 9
    const isLine = (x: number, y: number) => y === 10 && x >= 5 && x <= 9;
    expect(snapWhy({ x: 7, y: 10 }, { x: 7, y: 10 }, "road", isLine)).toBe("on");
    expect(snapWhy({ x: 11, y: 11 }, { x: 9, y: 10 }, "road", isLine)).toBe("end");
    expect(snapWhy({ x: 7, y: 11 }, { x: 7, y: 10 }, "road", isLine)).toBe("road");
    expect(snapWhy({ x: 7, y: 16 }, { x: 7, y: 17 }, "spacing", isLine)).toBe("spacing");
    expect(snapWhy({ x: 20, y: 1 }, { x: 20, y: 0 }, null, isLine)).toBe("angle");
    expect(snapWhy({ x: 20, y: 1 }, { x: 20, y: 1 }, null, isLine)).toBe("none");
  });

  test("after building, where each point was clicked and used, and what was laid", () => {
    const text = strokeText([{ name: "A", raw: { x: 11, y: 11 }, used: { x: 9, y: 10 } },
      { name: "B", raw: { x: 30, y: 20 }, used: { x: 30, y: 20 } }], 28, 30, [["ที่ดินยังไม่ได้ซื้อ", 2]]);
    expect(text).toBe("A คลิก (11, 11) ใช้ (9, 10) · B คลิก (30, 20) ใช้ (30, 20) · วางได้ 28/30 ช่อง · 2 ช่องวางไม่ได้: ที่ดินยังไม่ได้ซื้อ");
  });
});
