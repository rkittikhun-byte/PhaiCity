/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every docs/….md that the project's own files name must exist. On 17 Oct 2026 a commit deleted 36 docs that
// CLAUDE.md, other docs and code comments still sent readers to, and nothing noticed for four days
// (docs/reports/deleted-docs-78642f9.md). A doc that is retired on purpose takes its references with it.

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const TEXT = /\.(md|ts|js|mjs|cjs|json|html|css|py|sql)$|^\.env\.example$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".claude", "coverage", "_raw", "cache"]);
// Big generated data that never names a doc, and the reports that list the deleted docs on purpose
const SKIP_PATHS = ["data/maps", "data/geo", "docs/reports"];
const ROOTS = ["docs", "src", "scripts", "test", "server", "css", "art", "assets", "data"];
// A docs path not inside another path; "78642f9^:docs/X.md" names a file in git's history, not in the tree
const DOC_PATH = /(?<![\w./:^-])docs\/[\w./-]+?\.md\b/g;

function* textFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (SKIP_PATHS.includes(rel)) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* textFiles(rel);
    } else if (TEXT.test(entry.name)) yield rel;
  }
}

function projectFiles(): string[] {
  const top = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && TEXT.test(entry.name) && entry.name !== "package-lock.json")
    .map(entry => entry.name);
  return [...top, ...ROOTS.filter(dir => fs.existsSync(path.join(ROOT, dir))).flatMap(dir => [...textFiles(dir)])];
}

describe("links to docs", () => {
  test("every docs/….md named in the project exists", () => {
    const missing: string[] = [];
    for (const file of projectFiles()) {
      const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const [doc] of line.matchAll(DOC_PATH)) {
          if (!fs.existsSync(path.join(ROOT, doc))) missing.push(`${file}:${i + 1} names ${doc}`);
        }
      });
    }
    expect(missing).toEqual([]);
  });

  test("finds the docs the project names", () => {
    // Guards the test itself: CLAUDE.md names docs/HANDOFF.md, so the walk and the pattern must find it
    const found = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8").match(DOC_PATH) ?? [];
    expect(found).toContain("docs/HANDOFF.md");
    expect(projectFiles()).toEqual(expect.arrayContaining(["CLAUDE.md", "docs/ARCHITECTURE.md", "src/zoneCells.ts"]));
  });
});
