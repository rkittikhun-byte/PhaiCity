/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { Block, isWebLink, parseInline, parseMarkdown } from "../src/creditsMarkdown";

const root = path.join(__dirname, "..");
const tables = (blocks: Block[]) => blocks.filter((b): b is Extract<Block, { kind: "table" }> => b.kind === "table");

describe("parseInline", () => {
  test("links, code and bold", () => {
    expect(parseInline("by [Kenney](https://kenney.nl): `chop.ogg` is **CC0**")).toEqual([
      { kind: "text", text: "by " },
      { kind: "link", text: "Kenney", href: "https://kenney.nl" },
      { kind: "text", text: ": " },
      { kind: "code", text: "chop.ogg" },
      { kind: "text", text: " is " },
      { kind: "bold", text: "CC0" },
    ]);
  });
});

describe("isWebLink", () => {
  test("follows only http(s) links", () => {
    expect(isWebLink("https://freesound.org/people/x/sounds/1/")).toBe(true);
    expect(isWebLink("http://kenney.nl")).toBe(true);
    expect(isWebLink("music/CREDITS.md")).toBe(false);
    expect(isWebLink("javascript:alert(1)")).toBe(false);
    expect(isWebLink("data:text/html,x")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  test("headings, paragraphs, lists carried over lines, and tables without their divider row", () => {
    const blocks = parseMarkdown([
      "<!-- licence header",
      " spanning lines -->",
      "# Credits",
      "",
      "Every file is CC0,",
      "with thanks.",
      "",
      "- first item",
      "  carried on",
      "- second",
      "",
      "| File | License |",
      "|---|---|",
      "| `a.ogg` | CC0 |",
      "| `b\\|c.ogg` | CC0 |",
    ].join("\n"));
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "table"]);
    expect(blocks[1]).toEqual({ kind: "paragraph", content: [{ kind: "text", text: "Every file is CC0, with thanks." }] });
    expect(blocks[2]).toEqual({ kind: "list", items: [[{ kind: "text", text: "first item carried on" }], [{ kind: "text", text: "second" }]] });
    const [table] = tables(blocks);
    expect(table.header).toHaveLength(2);
    expect(table.rows.map((row) => row[0])).toEqual([[{ kind: "code", text: "a.ogg" }], [{ kind: "code", text: "b|c.ogg" }]]);
  });

  test("reads every credits file the About page shows", () => {
    for (const file of ["assets/CREDITS.md", "assets/audio/CREDITS.md", "assets/audio/music/CREDITS.md", "data/CREDITS.md"]) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      const found = tables(parseMarkdown(text));
      expect({ file, hasTable: found.length > 0 }).toEqual({ file, hasTable: true });
      for (const table of found) {
        for (const row of table.rows) expect({ file, cells: row.length }).toEqual({ file, cells: table.header.length });
      }
    }
  });

  test("the About page links to each of those files", () => {
    const about = fs.readFileSync(path.join(root, "about.html"), "utf8");
    const listed = [...about.matchAll(/data-credits="([^"]+)"/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual(["assets/CREDITS.md", "assets/audio/CREDITS.md", "assets/audio/music/CREDITS.md", "data/CREDITS.md"]);
  });
});
