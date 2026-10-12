/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { requestedCity, resetOf, turnOf } from "../src/viewControls";

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
  });

  test("reads the city to open from the address, and only a city id", () => {
    expect(requestedCity("?view=3d&city=mv4wdlmmgkv9")).toBe("mv4wdlmmgkv9");
    expect(requestedCity("?city=abc123")).toBe("abc123");
    for (const search of ["", "?view=3d", "?city=", "?city=../x", "?city=ABC", "?city=a%20b", `?city=${"a".repeat(41)}`]) {
      expect(requestedCity(search)).toBeNull();
    }
  });

  test("has its words in both languages", () => {
    for (const key of ["view.rotate_left", "view.rotate_right", "view.reset", "hud.attribution", "hud.credits",
      "sound.waiting", "sound.waiting_short"]) expect(hasKey(key)).toBe(true);
  });
});
