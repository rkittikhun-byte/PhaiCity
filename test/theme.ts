/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The one theme (docs/STYLE_GUIDE.md): css/theme.css is what src/theme/tokens.ts says, the stylesheets take every
// colour from it, its text stays readable, and no code adds colours of its own beyond what it had on 18 Oct 2026.

import * as fs from "fs";
import * as path from "path";
import { RAMPS, SCENE, UI_COLOURS, cssColour, themeCss } from "../src/theme/tokens";

const root = path.join(__dirname, "..");
const read = (file: string): string => fs.readFileSync(path.join(root, file), "utf8");
const STYLESHEETS = ["css/style.css", "css/tool-dock.css"];

describe("css/theme.css", () => {
  it("is generated from the tokens (run `npm run theme:css` after changing src/theme/tokens.ts)", () => {
    expect(read("css/theme.css")).toBe(themeCss());
  });

  it("comes before the stylesheets on every page", () => {
    for (const page of ["index.html", "about.html"]) {
      const html = read(page), theme = html.indexOf('href="css/theme.css"'), style = html.indexOf('href="css/style.css"');
      expect(theme).toBeGreaterThan(-1);
      expect(theme).toBeLessThan(style);
    }
  });
});

describe("stylesheets", () => {
  const values = (css: string): string[] =>
    // the value of every declaration (after a colon, up to ; or }), without comments
    [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/:\s*([^;{}]+)[;}]/g)].map(match => match[1]);

  // CSS's named colours
  const NAMED = ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown "
    + "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod "
    + "darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon "
    + "darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey "
    + "dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey "
    + "honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral "
    + "lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue "
    + "lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine "
    + "mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise "
    + "mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered "
    + "orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple "
    + "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue "
    + "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow "
    + "yellowgreen").split(" ");
  const RAW = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(\\s*\\d|(?<![\\w-])(${NAMED.join("|")})(?![\\w-])`, "i");

  it.each(STYLESHEETS)("%s takes every colour from the theme", file => {
    const raw = values(read(file)).filter(value => RAW.test(value.replace(/url\([^)]*\)|"[^"]*"|'[^']*'/g, "")));
    expect(raw).toEqual([]);
  });

  it.each(STYLESHEETS)("%s only names theme variables that exist", file => {
    const defined = new Set([...themeCss().matchAll(/(--ph-[\w-]+):/g)].map(match => match[1]));
    const used = [...read(file).matchAll(/var\((--ph-[\w-]+)/g)].map(match => match[1]);
    expect(used.filter(name => !defined.has(name))).toEqual([]);
  });
});

describe("tokens", () => {
  const value = (reference: string): number => {
    const [ramp, step] = reference.split("/")[0].split(".");
    return (RAMPS as Record<string, Record<string, number>>)[ramp][step];
  };
  const luminance = (rgb: number): number => {
    const channel = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(rgb >> 16 & 255) + 0.7152 * channel(rgb >> 8 & 255) + 0.0722 * channel(rgb & 255);
  };
  const contrast = (a: number, b: number): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("every UI colour names a ramp step", () => {
    for (const reference of Object.values(UI_COLOURS)) expect(() => cssColour(reference)).not.toThrow();
  });

  it("each ramp runs from light to dark", () => {
    for (const steps of Object.values(RAMPS)) {
      const lights = Object.keys(steps).map(Number).sort((a, b) => a - b).map(step => luminance((steps as Record<number, number>)[step]));
      for (let i = 1; i < lights.length; i++) expect(lights[i]).toBeLessThan(lights[i - 1]);
    }
  });

  // WCAG AA for small text (4.5:1): the HUD is about 9 px
  it.each([
    ["ink", "paper"], ["ink", "paperHi"], ["inkDim", "paper"], ["onAccent", "accentStrong"], ["nightInk", "night"],
  ] as const)("%s on %s is readable", (text, background) => {
    expect(contrast(value(UI_COLOURS[text]), value(UI_COLOURS[background]))).toBeGreaterThanOrEqual(4.5);
  });

  it("the 3D palette has a lit and a shaded side for every colour", () => {
    for (const pair of Object.values(SCENE.palette)) {
      expect(Number.isInteger(pair.lit) && Number.isInteger(pair.shade)).toBe(true);
    }
  });
});

// Colours written straight into code on 18 Oct 2026, by folder. A new colour belongs in src/theme/tokens.ts (SCENE for
// 3D, RAMPS/UI_COLOURS for pages) and is imported from there, so these numbers may only go down: lower them when
// colours move into the theme.
const BASELINE: Record<string, number> = {
  "src/render3d/models/civic": 248, "src/render3d/models/commercial": 68, "src/render3d/models/debug": 4,
  "src/render3d/models/fx": 0, "src/render3d/models/industrial": 42, "src/render3d/models/plot": 726,
  "src/render3d/models/power": 6, "src/render3d/models/rail": 7, "src/render3d/models/residential": 29,
  "src/render3d/models/road": 16, "src/render3d/models/services": 90, "src/render3d/models/terrain": 28,
  "src/render3d/models/transport": 23, "src/render3d/models/ui": 0, "src/render3d/models/vegetation": 24,
  "src/render3d/models/vehicles": 99, "src/render3d/models/waste": 185, "src/render3d/models/water": 55,
  "src/render3d (outside models)": 585, "src (pages, top level)": 63,
};

describe("no new hard-coded colours", () => {
  const COLOUR = /\b0x[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{6}\b/g;
  const filesIn = (dir: string, deep: boolean, skip: string[] = []): string[] =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return deep && !skip.includes(rel) ? filesIn(rel, true, skip) : [];
      return /\.(ts|js)$/.test(entry.name) ? [rel] : [];
    });
  const count = (files: string[]): number => files.reduce((sum, file) => sum + (read(file).match(COLOUR)?.length ?? 0), 0);
  const area = (name: string): string[] => {
    if (name === "src/render3d (outside models)") return filesIn("src/render3d", true, ["src/render3d/models"]);
    if (name === "src (pages, top level)") return filesIn("src", false);
    return fs.existsSync(path.join(root, name)) ? filesIn(name, true) : [];
  };

  it.each(Object.keys(BASELINE))("%s", name => {
    const found = count(area(name));
    if (found > BASELINE[name]) {
      throw new Error(`${name} has ${found} colours written in code, more than its ${BASELINE[name]}: put the new colour in `
        + "src/theme/tokens.ts and import it from there (docs/STYLE_GUIDE.md)");
    }
  });

  it("every model folder is counted", () => {
    const folders = fs.readdirSync(path.join(root, "src/render3d/models"), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => `src/render3d/models/${entry.name}`);
    expect(folders.filter(folder => BASELINE[folder] === undefined)).toEqual([]);
  });
});
