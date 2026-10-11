/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { handleArrow } from "../src/panelCollapse";
import { hasKey } from "../src/i18n/index";

describe("collapsible panels", () => {
  test("the handle points the way the panel will move", () => {
    expect(handleArrow("left", false)).toBe("‹");
    expect(handleArrow("left", true)).toBe("›");
    expect(handleArrow("right", false)).toBe("›");
    expect(handleArrow("right", true)).toBe("‹");
  });

  test("the handle and menu toggles have text in both languages", () => {
    for (const key of ["ui.collapse", "ui.expand", "ui.hide_menus", "ui.show_menus", "picker.region_enter", "picker.province_enter"]) {
      expect(hasKey(key)).toBe(true);
    }
  });
});
