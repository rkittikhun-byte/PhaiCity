/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The player's pace of the game's time (owner, 23 Oct 2026: "เราเกมส์ setting แล้วใช่ไหมล่ะ เราจะเพิ่มเข้าไปตรงนั้นด้วย
// ได้ไหม เรื่องความเร็วของเกมส์"): slow, normal or fast, how long a month takes at every speed of the time bar (1x, 2x,
// 3x): slow twice as long, fast half as long. It only spaces the simulation's steps in real time
// (Simulation.setPace); every step is the same, so the same city comes of the same commands at any pace. 3x is held
// back by the game's own loop (a step a frame at most), so fast quickens 1x and 2x. Like the graphics it belongs to
// whoever plays on this browser, not to the city, so it is kept in localStorage (`phaicity.gamePace`) and is no
// command; the settings window's choices change it at once, and OK and Cancel leave it alone.

/** How many times as long as the game's own a month takes */
export const GAME_PACES = { slow: 2, normal: 1, fast: 0.5 } as const;
export type GamePace = keyof typeof GAME_PACES;

const STORAGE_KEY = "phaicity.gamePace";
const DEFAULT_PACE: GamePace = "normal";

const isGamePace = (value: unknown): value is GamePace => typeof value === "string" && value in GAME_PACES;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function load(): GamePace {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    return isGamePace(stored) ? stored : DEFAULT_PACE;
  } catch {
    return DEFAULT_PACE;
  }
}

let current: GamePace = load();
const listeners = new Set<(pace: GamePace) => void>();

export function getGamePace(): GamePace { return current; }

/** How many times as long as the game's own a month takes at the player's pace */
export function gamePaceFactor(): number { return GAME_PACES[current]; }

export function setGamePace(pace: GamePace): void {
  if (!isGamePace(pace)) return;
  current = pace;
  try {
    storage()?.setItem(STORAGE_KEY, pace);
  } catch {
    // A browser that keeps nothing (private window) still uses the setting until the page closes
  }
  listeners.forEach((listener) => listener(pace));
}

/** Calls `listener` whenever the player changes the pace; returns what stops it */
export function onGamePace(listener: (pace: GamePace) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Reads the setting again (a test, or another tab that changed it) */
export function reloadGamePace(): GamePace {
  current = load();
  return current;
}

/** The settings window's choices (`input[name=gamePace]`) show the setting and change it as they are clicked */
export function bindGamePaceSetting(doc: Document | null = typeof document !== "undefined" ? document : null): void {
  const inputs = doc ? Array.from(doc.querySelectorAll<HTMLInputElement>("input[name=gamePace]")) : [];
  const show = (pace: GamePace): void => { for (const input of inputs) input.checked = input.value === pace; };
  show(current);
  for (const input of inputs) {
    input.addEventListener("change", () => { if (input.checked && isGamePace(input.value)) setGamePace(input.value); });
  }
  listeners.add(show);
}
