/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Finds the three.js city view (Codex's src/render3d/city/index.ts, prompt R1) without naming it in an import,
// so the game builds before that file exists and picks it up by itself once it does. webpack looks for the file
// at build time and puts it, with three.js, in a chunk of its own that loads only when 3D is chosen.
// Browser only: Node tests never import this file.

import type { CityView } from "./cityView";

/** createCityView3D from RENDERER_SPEC section 3; its setup is the game's live, read-only city. */
export type CityView3DFactory = (setup: Record<string, unknown>) => CityView & { dispose(): void };

interface LazyContext {
  keys(): string[];
  (key: string): Promise<Record<string, unknown>>;
}

interface WebpackRequire {
  context(directory: string, recursive: boolean, filter: RegExp, mode: "lazy"): LazyContext;
}

/** The 3D view's factory, or null while there is none yet (or it cannot be loaded). */
export async function loadCityView3D(): Promise<CityView3DFactory | null> {
  try {
    const context = (require as unknown as WebpackRequire).context("./render3d", true, /^\.\/city\/index\.ts$/, "lazy");
    const key = context.keys()[0];
    if (!key) return null;
    const module = await context(key);
    return typeof module.createCityView3D === "function" ? module.createCityView3D as CityView3DFactory : null;
  } catch (error) {
    console.warn("The 3D city view could not be loaded:", error);
    return null;
  }
}
