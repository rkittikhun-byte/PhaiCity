/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { hasKey } from "../src/i18n/index";
import { flagFor, FLAGS } from "../src/languageFlag";
import { cardToPutAway, RAIL_CARDS, RAIL_ICONS, RAIL_WINDOWS } from "../src/menuRail";

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
    expect(cardToPutAway("budgetRequest", ["budget"], null)).toBeNull();
    expect(cardToPutAway("evalRequest", ["budget"], null)).toBe("budget");
    expect(cardToPutAway("evalRequest", ["graphWindow"], null)).toBeNull();
    expect(cardToPutAway("mapRequest", [], "cityRequest")).toBe("card");
    expect(cardToPutAway("cityRequest", [], "cityRequest")).toBeNull();
    expect(cardToPutAway("languageRequest", [], "cityRequest")).toBe("card");
    expect(cardToPutAway("pauseRequest", ["queryWindow"], null)).toBe("queryWindow");
    expect(cardToPutAway("pauseRequest", [], null)).toBeNull();
  });

  test("the cards that open beside their icon are in the page, with a flag for each language", () => {
    for (const id of Object.values(RAIL_CARDS)) expect(html).toContain(`id="${id}"`);
    for (const language of ["th", "en"]) expect(html).toContain(`data-lang="${language}"`);
  });
});

describe("the title page", () => {
  test("has its words and each language's name in both languages", () => {
    for (const key of ["gate.tagline", "gate.language", "gate.sound", "gate.enter", "gate.hint", "lang.th", "lang.en",
      "menu.language"]) expect(hasKey(key)).toBe(true);
  });

  test("comes before the story, except for a city or province opened from the address", () => {
    const splash = fs.readFileSync(path.join(__dirname, "..", "src", "splashScreen.js"), "utf8");
    expect(splash).toContain("gate: requested === null ? showTitleGate() : null");
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
