/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How the game feels (owner, 23 Oct 2026: "ทำหน้าปรับค่าความรู้สึกของเกมในหน้าหลังบ้านเลย"; docs/GAME_DESIGN.md 19): the
// length of a day, how slowly the weather sets in and clears, where the smart camera goes for each kind of tool and how
// the camera slides at the screen's edge. They are data, not code: data/game-feel.json, which the owner sets on the
// admin page (src/admin/adminPage.ts) and the game reads when it opens; the numbers here are what the game uses when the
// file is missing or wrong, so a bad file never breaks it. None of them reaches the simulation: they only change what
// the player sees and how the view moves. Plain code, no DOM.

/** Where the smart camera goes for a kind of tool: its tilt above the horizon and the ground across the screen */
export interface FeelPreset { pitchDeg: number; widthM: number }

export interface GameFeel {
  /** A day's real seconds at 1x, 2x and 3x, and how many times as fast the night goes (src/dayClock.ts) */
  day: { seconds1x: number; seconds2x: number; seconds3x: number; nightPace: number };
  /** How fast each part of the weather follows the month's, a share a second, and the ground's wetting and drying
   * (src/render3d/city/weather.ts) */
  weather: { cloud: number; rain: number; fog: number; smoke: number; storm: number; wetting: number; drying: number };
  /** The smart camera (src/smartCamera.ts): each kind of tool's view, a glide's seconds, and how near is near enough
   * that it does not move */
  camera: {
    paint: FeelPreset; line: FeelPreset; build: FeelPreset; land: FeelPreset;
    glideSeconds: number; stillPitchDeg: number; stillDistanceShare: number; stillHeadingDeg: number;
  };
  /** The camera at the screen's edge (src/edgeScroll.ts): the thin band away from drawing, and the wide margin while
   * a line is drawn */
  edge: { bandPx: number; bandDwellMs: number; bandSpeed: number; bandBuildingShare: number; edgePx: number; edgeSpeed: number };
  /** The moon at the full (src/moon.ts, src/render3d/city/skyLight.ts): its light (three.js units; the sun's is 3.3), how
   * dark its shadows are, and how much it brightens the night sky's light on everything; less as it wanes to new */
  moon: { fullLight: number; shadow: number; sky: number };
}

export type FeelGroup = keyof GameFeel;

/** The game's own feel (owner's numbers of 23 Oct 2026) */
export const DEFAULT_FEEL: Readonly<GameFeel> = Object.freeze({
  day: { seconds1x: 480, seconds2x: 360, seconds3x: 240, nightPace: 2 },
  weather: { cloud: 0.15, rain: 0.2, fog: 0.1, smoke: 0.08, storm: 0.15, wetting: 0.35, drying: 0.02 },
  camera: {
    paint: { pitchDeg: 65, widthM: 350 }, line: { pitchDeg: 60, widthM: 750 }, build: { pitchDeg: 48, widthM: 275 },
    land: { pitchDeg: 60, widthM: 1500 },
    glideSeconds: 0.7, stillPitchDeg: 5, stillDistanceShare: 0.2, stillHeadingDeg: 8,
  },
  edge: { bandPx: 8, bandDwellMs: 200, bandSpeed: 900, bandBuildingShare: 0.5, edgePx: 56, edgeSpeed: 750 },
  moon: { fullLight: 0.6, shadow: 0.55, sky: 0.15 },
}) as Readonly<GameFeel>;

/** One number of the feel: where it is ("camera.paint.widthM"), its unit and the range it may take */
export interface FeelField { path: string; group: FeelGroup; unit: string; min: number; max: number; step: number }

const field = (path: string, unit: string, min: number, max: number, step: number): FeelField =>
  ({ path, group: path.split(".")[0] as FeelGroup, unit, min, max, step });

/** Every number, in the order the admin page shows them */
export const FEEL_FIELDS: readonly FeelField[] = [
  field("day.seconds1x", "s", 30, 3600, 10), field("day.seconds2x", "s", 20, 3600, 10),
  field("day.seconds3x", "s", 10, 3600, 10), field("day.nightPace", "x", 1, 6, 0.25),
  ...(["cloud", "rain", "fog", "smoke", "storm"] as const).map((part) => field(`weather.${part}`, "/s", 0.005, 5, 0.005)),
  field("weather.wetting", "/s", 0.01, 5, 0.01), field("weather.drying", "/s", 0.001, 1, 0.001),
  ...(["paint", "line", "build", "land"] as const).flatMap((kind) => [
    field(`camera.${kind}.pitchDeg`, "deg", 20, 89, 1), field(`camera.${kind}.widthM`, "m", 50, 5000, 25),
  ]),
  field("camera.glideSeconds", "s", 0.1, 3, 0.05), field("camera.stillPitchDeg", "deg", 0, 30, 1),
  field("camera.stillDistanceShare", "share", 0, 1, 0.05), field("camera.stillHeadingDeg", "deg", 0, 45, 1),
  field("edge.bandPx", "px", 0, 64, 1), field("edge.bandDwellMs", "ms", 0, 2000, 50),
  field("edge.bandSpeed", "px/s", 0, 4000, 50), field("edge.bandBuildingShare", "share", 0, 1, 0.05),
  field("edge.edgePx", "px", 0, 200, 2), field("edge.edgeSpeed", "px/s", 0, 4000, 50),
  field("moon.fullLight", "light", 0, 3, 0.05), field("moon.shadow", "share", 0, 1, 0.05), field("moon.sky", "share", 0, 1, 0.05),
];

type Tree = { [key: string]: number | Tree };

/** The value at a path of a feel (or undefined) */
export function feelValue(feel: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((at, key) =>
    at && typeof at === "object" && !Array.isArray(at) ? (at as Record<string, unknown>)[key] : undefined, feel);
}

function setValue(feel: Tree, path: string, value: number): void {
  const keys = path.split(".");
  let at = feel;
  for (const key of keys.slice(0, -1)) at = at[key] as Tree;
  at[keys[keys.length - 1]] = value;
}

const copy = (feel: Readonly<GameFeel>): GameFeel => JSON.parse(JSON.stringify(feel)) as GameFeel;

/**
 * Checks a feel file: every number it gives must be in its range, and every key one of the game's (keys starting "_"
 * are notes). What it leaves out, or gets wrong, is the game's own value; the problems say what was wrong.
 */
export function checkFeelData(raw: unknown): { data: GameFeel; problems: string[] } {
  const data = copy(DEFAULT_FEEL), problems: string[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { data, problems: ["the feel is not an object"] };
  }
  const known = new Set(FEEL_FIELDS.map((f) => f.path));
  const prefixes = new Set(FEEL_FIELDS.flatMap((f) => f.path.split(".").slice(0, -1).map((_, i, keys) => keys.slice(0, i + 1).join("."))));
  const walk = (node: Record<string, unknown>, at: string): void => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("_")) continue;
      const path = at ? `${at}.${key}` : key;
      if (prefixes.has(path)) {
        if (value && typeof value === "object" && !Array.isArray(value)) walk(value as Record<string, unknown>, path);
        else problems.push(`${path}: not an object`);
      } else if (!known.has(path)) problems.push(`${path}: not a setting of the game`);
    }
  };
  walk(raw as Record<string, unknown>, "");
  for (const f of FEEL_FIELDS) {
    const value = feelValue(raw, f.path);
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) problems.push(`${f.path}: not a number`);
    else if (value < f.min || value > f.max) problems.push(`${f.path}: ${value} is outside ${f.min}–${f.max}`);
    else setValue(data as unknown as Tree, f.path, value);
  }
  return { data, problems };
}

// --- The feel the game plays with now -------------------------------------------------------------------------------

let current: GameFeel = copy(DEFAULT_FEEL);
const listeners = new Set<(feel: Readonly<GameFeel>) => void>();

/** The feel now: the file's once it is read, else the game's own */
export function gameFeel(): Readonly<GameFeel> { return current; }

/** Plays with this feel from now on (checked first: what is wrong in it stays the game's own) */
export function setGameFeel(raw: unknown): string[] {
  const { data, problems } = checkFeelData(raw);
  current = data;
  listeners.forEach((listener) => listener(current));
  return problems;
}

/** Back to the game's own feel (tests) */
export function resetGameFeel(): void { setGameFeel(DEFAULT_FEEL); }

export function onGameFeelChange(listener: (feel: Readonly<GameFeel>) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The admin page tells a game open in the same browser what it saved, so it plays with it at once (dev server only) */
export const FEEL_CHANNEL = "phaicity.gameFeel";

/**
 * Reads data/game-feel.json when the game opens, and listens for the admin page's saves. A file that cannot be read
 * leaves the game's own feel; problems in it are warned about and the rest is used.
 */
export function loadGameFeel(url = "data/game-feel.json"): Promise<void> {
  try {
    // (a page only: in Node an open channel would keep the process running)
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      new BroadcastChannel(FEEL_CHANNEL).onmessage = (event: MessageEvent) => {
        const problems = setGameFeel(event.data);
        if (problems.length) console.warn(`Game feel: ${problems.join("; ")}`);
      };
    }
  } catch {
    // Without the channel a saved feel takes a reload
  }
  if (typeof fetch !== "function") return Promise.resolve();
  return fetch(url, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((raw: unknown) => {
      const problems = setGameFeel(raw);
      if (problems.length) console.warn(`Game feel: ${problems.join("; ")}`);
    })
    .catch((error: Error) => console.warn(`Could not load the game feel, playing with the game's own: ${error.message}`));
}
