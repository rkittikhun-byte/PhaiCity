/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The player's length of a day (owner, 23 Oct 2026: "ให้ผู้เล่นเลือกความยาววันได้ในหน้าตั้งค่า"): short, normal or long,
// times the day the owner set (src/gameFeel.ts). It turns the game's clock faster or slower (src/dayClock.ts) and
// nothing else: the calendar and the simulation go their own pace. Like the graphics it belongs to whoever plays on this
// browser, not to the city, so it is kept in localStorage (`phaicity.dayLength`) and is no command; the settings
// window's choices change it at once, and OK and Cancel leave it alone.

export const DAY_LENGTHS = { short: 0.5, normal: 1, long: 2 } as const;
export type DayLength = keyof typeof DAY_LENGTHS;

const STORAGE_KEY = "phaicity.dayLength";
const DEFAULT_LENGTH: DayLength = "normal";

const isDayLength = (value: unknown): value is DayLength => typeof value === "string" && value in DAY_LENGTHS;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function load(): DayLength {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    return isDayLength(stored) ? stored : DEFAULT_LENGTH;
  } catch {
    return DEFAULT_LENGTH;
  }
}

let current: DayLength = load();
const listeners = new Set<(length: DayLength) => void>();

export function getDayLength(): DayLength { return current; }

/** How many times as long as the owner's day the player's day is */
export function dayLengthFactor(): number { return DAY_LENGTHS[current]; }

export function setDayLength(length: DayLength): void {
  if (!isDayLength(length)) return;
  current = length;
  try {
    storage()?.setItem(STORAGE_KEY, length);
  } catch {
    // A browser that keeps nothing (private window) still uses the setting until the page closes
  }
  listeners.forEach((listener) => listener(length));
}

/** Reads the setting again (a test, or another tab that changed it) */
export function reloadDayLength(): DayLength {
  current = load();
  return current;
}

/** The settings window's choices (`input[name=dayLength]`) show the setting and change it as they are clicked */
export function bindDayLengthSetting(doc: Document | null = typeof document !== "undefined" ? document : null): void {
  const inputs = doc ? Array.from(doc.querySelectorAll<HTMLInputElement>("input[name=dayLength]")) : [];
  const show = (length: DayLength): void => { for (const input of inputs) input.checked = input.value === length; };
  show(current);
  for (const input of inputs) {
    input.addEventListener("change", () => { if (input.checked && isDayLength(input.value)) setDayLength(input.value); });
  }
  listeners.add(show);
}
