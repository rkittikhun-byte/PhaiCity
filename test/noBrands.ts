/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// License rule 8 (CLAUDE.md): no real brands. The game's code never names a real shopping mall or shop chain; its
// shops, malls and signs carry made-up generic Thai names.

import * as fs from "fs";
import * as path from "path";

const root = path.join(__dirname, "..");

const BRANDS: RegExp[] = [
  /central\s*plaza/i, /centralworld/i, /central\s+khon\s*kaen/i, /เซ็นทรัล/,
  /\bbig\s*c\b/i, /บิ๊กซี/, /lotus['’]s/i, /\btesco\b/i, /โลตัส/,
  /\bmakro\b/i, /แม็คโคร/, /robinson/i, /โรบินสัน/, /7-eleven/i, /เซเว่น/,
  /\bstarbucks\b/i, /mcdonald/i, /\bkfc\b/i, /fairy\s*plaza/i, /แฟรี่พลาซ่า/,
  /\bhomepro\b/i, /โฮมโปร/, /\bthai\s*watsadu\b/i, /ไทวัสดุ/,
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.(ts|js|mjs)$/.test(entry.name) ? [rel] : [];
  });
}

describe("no real brands", () => {
  it("no source file names a real mall or shop chain", () => {
    const found: string[] = [];
    for (const file of sourceFiles("src")) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      for (const brand of BRANDS) if (brand.test(text)) found.push(`${file}: ${brand}`);
    }
    expect(found).toEqual([]);
  });
});
