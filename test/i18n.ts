/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { formatMoney, formatYear, getLanguage, hasKey, setLanguage, t } from "../src/i18n/index";
import { STRINGS } from "../src/i18n/strings";

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

const placeholders = (text: string): string[] => (text.match(/\{[^{}\s]+\}/g) ?? []).sort();

// The markup of the element whose start tag begins at `start`, up to its matching end tag.
function elementAt(html: string, start: number): string {
  const tag = /^<(\w+)/.exec(html.slice(start))![1];
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  throw new Error(`unclosed <${tag}> at ${start}`);
}

describe("t", () => {
  afterEach(() => setLanguage("th"));

  test("Thai is the default language", () => {
    expect(getLanguage()).toBe("th");
    expect(t("menu.budget")).toBe("งบประมาณ");
  });

  test("switching to English", () => {
    setLanguage("en");
    expect(t("menu.budget")).toBe("Budget");
  });

  test("unknown keys come back unchanged", () => {
    expect(t("no.such.key")).toBe("no.such.key");
  });

  test("fills placeholders and leaves unknown ones visible", () => {
    setLanguage("en");
    expect(t("budget.rate_label", { pct: 50, total: 200, spent: 100 })).toBe("50% of ฿200 = ฿100");
    expect(t("budget.rate_label", { pct: 50 })).toBe("50% of ฿{total} = ฿{spent}");
  });
});

describe("formatting", () => {
  afterEach(() => setLanguage("th"));

  test("Thai years are Buddhist era, English years Gregorian", () => {
    expect(formatYear(1900)).toBe("2443");
    setLanguage("en");
    expect(formatYear(1900)).toBe("1900");
  });

  test("money is shown in baht with the sign outside", () => {
    expect(formatMoney(1500)).toBe("฿1500");
    expect(formatMoney(-200)).toBe("-฿200");
    expect(formatMoney(0)).toBe("฿0");
  });
});

describe("string table", () => {
  test("every string has both languages", () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect({ key, en: entry.en.length > 0 }).toEqual({ key, en: true });
      expect({ key, th: entry.th.length > 0 }).toEqual({ key, th: true });
    }
  });

  test("both languages use the same placeholders", () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect({ key, th: placeholders(entry.th) }).toEqual({ key, th: placeholders(entry.en) });
    }
  });
});

describe("index.html", () => {
  test("every data-i18n key exists", () => {
    const attributes = /data-i18n(?:-value|-title|-placeholder|-template)?="([^"]+)"/g;
    const keys = [...indexHtml.matchAll(attributes)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((key) => !hasKey(key))).toEqual([]);
  });

  test("each template's placeholders match its slots", () => {
    const templates = [...indexHtml.matchAll(/<\w+[^>]*data-i18n-template="([^"]+)"/g)];
    expect(templates.length).toBeGreaterThan(5);
    for (const match of templates) {
      const markup = elementAt(indexHtml, match.index!);
      const slots = [...markup.matchAll(/data-i18n-slot="([^"]+)"/g)].map((m) => `{${m[1]}}`).sort();
      expect({ key: match[1], slots }).toEqual({ key: match[1], slots: placeholders(STRINGS[match[1]].en) });
    }
  });

  test("the credits required by LICENSE and the map data licences stay on the page", () => {
    setLanguage("en");
    expect(t("footer.author")).toContain("micropolisJS");
    setLanguage("th");
    expect(t("footer.author")).toContain("micropolisJS");
    expect(indexHtml).toContain(">Graeme McCutcheon</a>");
    expect(indexHtml).toContain(">OpenStreetMap contributors</a>");
    expect(indexHtml).toContain("Micropolis is a registered trademark of");
  });
});

describe("game code", () => {
  test("every key used in the game code exists", () => {
    const srcDir = path.join(root, "src");
    const used = new Set<string>();
    for (const file of fs.readdirSync(srcDir).filter((f) => /\.(js|ts)$/.test(f))) {
      const source = fs.readFileSync(path.join(srcDir, file), "utf8");
      for (const m of source.matchAll(/\bt\(\s*["']([a-z][a-z0-9_.]*)["']\s*[,)]/g)) used.add(m[1]);
      // text.js keeps its keys in tables
      if (file === "text.js") for (const m of source.matchAll(/'([a-z]+\.[a-z0-9_.]+)'/g)) used.add(m[1]);
    }
    for (const milestone of ["town", "city", "capital", "metropolis", "megalopolis"]) used.add(`congrats.milestone.${milestone}`);
    used.add("menu.play");

    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((key) => !hasKey(key))).toEqual([]);
  });
});
