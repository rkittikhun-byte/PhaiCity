/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { requestedCity, viewSwitchUrl } from "../src/viewSwitch";

describe("2D/3D switch", () => {
  test("opens the saved city again in the other view", () => {
    expect(viewSwitchUrl("/", "3d", "mv4wdlmmgkv9")).toBe("/?view=3d&city=mv4wdlmmgkv9");
    expect(viewSwitchUrl("/phaicity/index.html", "2d", "abc")).toBe("/phaicity/index.html?view=2d&city=abc");
  });

  test("reads the city to open from the address, and only a city id", () => {
    expect(requestedCity("?view=3d&city=mv4wdlmmgkv9")).toBe("mv4wdlmmgkv9");
    expect(requestedCity("?city=abc123")).toBe("abc123");
    for (const search of ["", "?view=3d", "?city=", "?city=../x", "?city=ABC", "?city=a%20b", `?city=${"a".repeat(41)}`]) {
      expect(requestedCity(search)).toBeNull();
    }
  });

  test("has its words in both languages", () => {
    for (const key of ["view.to_3d", "view.to_2d", "view.switch_title", "view.switch_failed", "hud.attribution",
      "hud.credits", "sound.waiting", "sound.waiting_short"]) expect(hasKey(key)).toBe(true);
  });
});
