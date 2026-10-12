/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { chooseViewKind } from "../src/cityViewChoice";

describe("chooseViewKind", () => {
  test("3D is the game's view", () => {
    expect(chooseViewKind("")).toBe("3d");
    expect(chooseViewKind("?province=TH-50")).toBe("3d");
    expect(chooseViewKind("?view=3d&city=abc")).toBe("3d");
    expect(chooseViewKind("?view=4d")).toBe("3d");
  });

  test("?view=2d is kept for developers", () => {
    expect(chooseViewKind("?view=2d")).toBe("2d");
    expect(chooseViewKind("?city=abc&view=2d")).toBe("2d");
  });
});
