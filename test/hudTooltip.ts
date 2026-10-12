/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { tipPosition } from "../src/hudTooltip";

describe("quick tooltips", () => {
  const view = { width: 1280, height: 720 };
  const tip = { width: 200, height: 40 };

  test("sit under the element, centred on it", () => {
    expect(tipPosition({ left: 500, top: 100, width: 100, height: 30 }, tip, view)).toEqual({ left: 450, top: 138 });
  });

  test("go above the element near the bottom of the window", () => {
    expect(tipPosition({ left: 500, top: 680, width: 100, height: 30 }, tip, view)).toEqual({ left: 450, top: 632 });
  });

  test("stay inside the window at its edges", () => {
    expect(tipPosition({ left: 1250, top: 20, width: 28, height: 28 }, tip, view).left).toBe(1280 - 200 - 8);
    expect(tipPosition({ left: 0, top: 20, width: 28, height: 28 }, tip, view).left).toBe(8);
  });

  test("the menu buttons say what they do in both languages", () => {
    for (const key of ["budget", "evaluation", "disasters", "save", "settings", "screenshot", "main"]) {
      expect(hasKey(`menu.tip.${key}`)).toBe(true);
    }
  });
});
