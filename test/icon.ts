/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's icon (art/icon/build_icon.py, scripts/icon/export.mjs): the files are there at their sizes, the pages
// link them and the build copies them, so the browser's /favicon.ico is found.

import * as fs from "fs";
import * as path from "path";

const root = path.join(__dirname, "..");
const read = (file: string): Buffer => fs.readFileSync(path.join(root, file));
const pngSize = (png: Buffer): [number, number] => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe("the icon", () => {
  it("favicon.ico holds 16, 32 and 48 px PNGs", () => {
    const ico = read("favicon.ico");
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
    const sizes = [];
    for (let i = 0; i < ico.readUInt16LE(4); i++) {
      const at = 6 + 16 * i, png = ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8));
      expect(png.readUInt32BE(0)).toBe(0x89504e47);
      expect(pngSize(png)).toEqual([ico[at], ico[at + 1]]);
      sizes.push(ico[at]);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it.each([32, 180, 192, 512])("assets/icons/app/icon-%i.png is that size", size => {
    expect(pngSize(read(`assets/icons/app/icon-${size}.png`))).toEqual([size, size]);
  });

  it("the web manifest names icons that exist", () => {
    const manifest = JSON.parse(read("manifest.webmanifest").toString("utf8"));
    for (const icon of manifest.icons) expect(fs.existsSync(path.join(root, icon.src))).toBe(true);
  });

  it.each(["index.html", "about.html", "admin.html", "model-gallery.html", "era-buildings.html"])("%s links it", page => {
    const html = read(page).toString("utf8");
    expect(html).toContain('<link rel="icon" href="favicon.ico"');
    expect(html).toContain('<link rel="apple-touch-icon" href="assets/icons/app/icon-180.png">');
  });

  it("the build copies it", () => {
    const config = read("webpack.config.js").toString("utf8");
    expect(config).toContain("'favicon.ico'");
    expect(config).toContain("'manifest.webmanifest'");
  });
});
