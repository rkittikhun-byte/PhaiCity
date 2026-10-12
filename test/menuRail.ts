/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { hasKey } from "../src/i18n/index";
import { flagFor, FLAGS } from "../src/languageFlag";
import { cardToPutAway, RAIL_ICONS, RAIL_WINDOWS } from "../src/menuRail";

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

describe("the menu as icons", () => {
  const menu = html.slice(html.indexOf('id="miscButtons"'), html.indexOf('id="RCIContainer"'));
  const buttons = [...menu.matchAll(/<button id="(\w+)"[^>]*data-i18n="([\w.]+)"/g)].map((m) => ({ id: m[1], key: m[2] }));

  test("every menu button has an icon and a name in both languages", () => {
    expect(buttons.map((b) => b.id)).toEqual(Object.keys(RAIL_ICONS));
    for (const { id, key } of buttons) {
      expect(RAIL_ICONS[id]).toMatch(/^<svg [^>]*>.+<\/svg>$/);
      expect(hasKey(key)).toBe(true);
    }
  });

  test("every window an icon opens is in the page", () => {
    for (const ids of Object.values(RAIL_WINDOWS)) {
      for (const id of ids) expect(html).toContain(`id="${id}"`);
    }
  });

  test("resting on another icon puts the open card or window away, but not on its own icon", () => {
    expect(cardToPutAway("budgetRequest", ["budget"], false)).toBeNull();
    expect(cardToPutAway("evalRequest", ["budget"], false)).toBe("budget");
    expect(cardToPutAway("evalRequest", ["graphWindow"], false)).toBeNull();
    expect(cardToPutAway("mapRequest", [], true)).toBe("city");
    expect(cardToPutAway("cityRequest", [], true)).toBeNull();
    expect(cardToPutAway("pauseRequest", ["queryWindow"], false)).toBe("queryWindow");
    expect(cardToPutAway("pauseRequest", [], false)).toBeNull();
  });
});

describe("the language button", () => {
  test("shows the flag of the language a click switches to", () => {
    expect(flagFor("th")).toBe(FLAGS.en);
    expect(flagFor("en")).toBe(FLAGS.th);
    for (const flag of Object.values(FLAGS)) expect(flag).toMatch(/^<svg [^>]*>.+<\/svg>$/);
  });

  test("is no longer About, which the credit line links to instead", () => {
    expect(html).not.toContain('data-i18n="nav.about"');
    expect(html).toContain('href="about.html#aboutCredits"');
  });
});
