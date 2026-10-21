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

const aboutHtml = fs.readFileSync(path.join(root, "about.html"), "utf8");

describe.each([
  ["index.html", indexHtml, 100, 5],
  ["about.html", aboutHtml, 50, 8],
])("%s", (_name, html, minKeys, minTemplates) => {
  test("every data-i18n key exists", () => {
    const attributes = /data-i18n(?:-value|-title|-placeholder|-aria-label|-template)?="([^"]+)"/g;
    const keys = [...html.matchAll(attributes)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(minKeys);
    expect(keys.filter((key) => !hasKey(key))).toEqual([]);
  });

  test("each template's placeholders match its slots", () => {
    const templates = [...html.matchAll(/<\w+[^>]*data-i18n-template="([^"]+)"/g)];
    expect(templates.length).toBeGreaterThan(minTemplates);
    for (const match of templates) {
      const markup = elementAt(html, match.index!);
      const slots = [...markup.matchAll(/data-i18n-slot="([^"]+)"/g)].map((m) => `{${m[1]}}`).sort();
      for (const language of ["en", "th"] as const) {
        expect({ key: match[1], language, slots }).toEqual({ key: match[1], language, slots: placeholders(STRINGS[match[1]][language]) });
      }
    }
  });

  test("the credits required by LICENSE and the map data licences stay on the page", () => {
    setLanguage("en");
    expect(t("footer.author")).toContain("micropolisJS");
    setLanguage("th");
    expect(t("footer.author")).toContain("micropolisJS");
    expect(html).toContain('data-i18n-template="footer.author"');
    expect(html).toContain(">Graeme McCutcheon</a>");
    expect(html).toContain(">OpenStreetMap contributors</a>");
    expect(html).toContain("Micropolis is a registered trademark of");
  });
});

describe("about.html", () => {
  test("keeps the original licence header", () => {
    expect(aboutHtml).toContain(" * micropolisJS. Adapted by Graeme McCutcheon from Micropolis.");
    expect(aboutHtml).toContain('The name/term "MICROPOLIS" is a registered trademark of Micropolis');
  });

  test("explains the graphics setting by the names the settings window gives it, in both languages", () => {
    expect(aboutHtml).toContain('data-i18n="about.settings.graphics"');
    for (const language of ["en", "th"] as const) {
      const text = STRINGS["about.settings.graphics"][language];
      expect(text.startsWith(`${STRINGS["graphics.title"][language]}: `)).toBe(true);
      for (const level of ["auto", "low", "medium", "high"]) expect(text).toContain(STRINGS[`graphics.${level}`][language]);
    }
  });

  test("never names the game micropolisJS or SimCity", () => {
    expect(aboutHtml).not.toMatch(/simcity/i);
    expect(aboutHtml).not.toMatch(/<title>[^<]*micropolis/i);
    for (const key of Object.keys(STRINGS).filter((k) => k.startsWith("about."))) {
      for (const language of ["en", "th"] as const) expect({ key, text: STRINGS[key][language] }).not.toMatchObject({ text: expect.stringMatching(/simcity/i) });
    }
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

// Never hardcode UI text (CLAUDE.md): the game's own modules write no Thai words into a string, every one comes through
// t(). Comments may quote the owner in Thai; the street names are bilingual data (each Thai name has its English one),
// and in-world 3D signs (src/render3d) stay Thai on purpose. ฿ is the baht sign of both languages, not a word.
describe("no Thai words written into the code", () => {
  const THAI = /[\u0E01-\u0E3A\u0E40-\u0E5B]/;
  const ALLOWED = new Set(["src/streetNames.ts", "src/i18n/strings.ts"]);
  const folders = ["src", "src/core", "src/objects", "src/audio", "src/geo"];

  it("in the game's modules outside the 3D view", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ts = require("typescript");
    const found: string[] = [];
    for (const folder of folders) {
      for (const name of fs.readdirSync(path.join(root, folder))) {
        const file = `${folder}/${name}`;
        if (!/\.(ts|js)$/.test(name) || ALLOWED.has(file)) continue;
        const text = fs.readFileSync(path.join(root, file), "utf8");
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
        const visit = (node: any): void => {
          const literal = node.kind === ts.SyntaxKind.StringLiteral
            || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
            || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle
            || node.kind === ts.SyntaxKind.TemplateTail;
          if (literal && THAI.test(node.text)) {
            found.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${node.text}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
    expect(found).toEqual([]);
  });
});
