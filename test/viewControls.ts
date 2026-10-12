/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { dragMode, dragTurnOf, installViewControls, panOf, requestedCity, resetOf, ROTATE_STEP, turnOf, turnView } from "../src/viewControls";

describe("3D view controls", () => {
  test("turn and reset with the view's own functions when it has them", () => {
    const calls: string[] = [];
    const view = { rotate: (d: number) => calls.push(`rotate ${d}`), resetView: () => calls.push("reset") };
    turnOf(view)!(15);
    resetOf(view)!();
    expect(calls).toEqual(["rotate 15", "reset"]);
  });

  test("otherwise use the 3D camera's own drag turn and reset", () => {
    const calls: Array<[string, number?, number?]> = [];
    const view = { navigation: { rotate: (dx: number, dy: number) => calls.push(["drag", dx, dy]), reset: () => calls.push(["reset"]) } };
    turnOf(view)!(15);
    resetOf(view)!();
    expect(calls[0][0]).toBe("drag");
    // 15 degrees, as pixels of a right-button drag at 0.006 radians a pixel
    expect(calls[0][1]).toBeCloseTo(-(15 * Math.PI / 180) / 0.006, 6);
    expect(calls[0][2]).toBe(0);
    expect(calls[1]).toEqual(["reset"]);
  });

  test("the 2D view has neither", () => {
    expect(turnOf({})).toBeNull();
    expect(resetOf({})).toBeNull();
    expect(panOf({})).toBeNull();
  });

  test("Q and E turn the open city's view a step at a time, and do nothing before a city opens", () => {
    expect(turnView(1)).toBe(false);
    const turns: number[] = [];
    const reset = { hidden: true, title: "", setAttribute: () => undefined, addEventListener: () => undefined };
    const doc = { getElementById: () => reset } as unknown as Document;
    installViewControls({ rotate: (degrees: number) => turns.push(degrees) }, doc);
    expect(turnView(-1)).toBe(true);
    expect(turnView(1)).toBe(true);
    expect(turns).toEqual([-ROTATE_STEP, ROTATE_STEP]);
  });

  test("a drag across or up and down turns the city, a slanting one slides it, and Shift always slides", () => {
    expect(dragMode(10, 1, false, true)).toBe("turn");
    expect(dragMode(-10, 0, false, true)).toBe("turn");
    expect(dragMode(1, -10, false, true)).toBe("turn");
    expect(dragMode(8, 8, false, true)).toBe("pan");
    expect(dragMode(-6, 9, false, true)).toBe("pan");
    expect(dragMode(10, 0, true, true)).toBe("pan");
    expect(dragMode(10, 0, false, false)).toBe("pan");
  });

  test("a drag turns the view as a right-button drag does", () => {
    const calls: number[][] = [];
    dragTurnOf({ navigation: { rotate: (dx: number, dy: number) => calls.push([dx, dy]) } })!(10, -4);
    expect(calls).toEqual([[10, -4]]);
    const degrees: number[] = [];
    dragTurnOf({ rotate: (d: number) => degrees.push(d) })!(10, 0);
    expect(degrees[0]).toBeCloseTo(-10 * 0.006 * 180 / Math.PI, 6);
    expect(dragTurnOf({})).toBeNull();
  });

  test("a mouse drag slides the view, with the 3D camera's own drag when the view has no pan", () => {
    const calls: number[][] = [];
    panOf({ pan: (dx: number, dy: number) => calls.push([dx, dy]) })!(3, -4);
    panOf({ height: 720, navigation: { pan: (dx: number, dy: number, height: number) => calls.push([dx, dy, height]) } })!(5, 6);
    expect(calls).toEqual([[3, -4], [5, 6, 720]]);
  });

  test("reads the city to open from the address, and only a city id", () => {
    expect(requestedCity("?view=3d&city=mv4wdlmmgkv9")).toBe("mv4wdlmmgkv9");
    expect(requestedCity("?city=abc123")).toBe("abc123");
    for (const search of ["", "?view=3d", "?city=", "?city=../x", "?city=ABC", "?city=a%20b", `?city=${"a".repeat(41)}`]) {
      expect(requestedCity(search)).toBeNull();
    }
  });

  test("has its words in both languages", () => {
    for (const key of ["view.reset", "view.mouse_hint", "hud.attribution",
      "hud.credits", "sound.waiting", "sound.waiting_short", "sound.volume", "sound.control"]) expect(hasKey(key)).toBe(true);
  });
});
