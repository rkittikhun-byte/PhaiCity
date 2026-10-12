/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Autosave: a city the player has committed to (a province city, or a practice city saved once by hand) is saved
// every few minutes of play, and again whenever the page is hidden or closed, so closing the tab never loses it.
// Saving goes through the game's own save (src/cityStorage.ts); this only decides when.

import { showCornerNote } from "./cornerNote";
import { getLanguage, t } from "./i18n/index";

export const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;
const NOTE_MS = 2500;
const FULL_NOTE_MS = 9000;

export interface AutosaveTarget {
  /** Saves the city into its slot; false when the browser's storage is full. */
  save(): boolean;
  /** Whether this city is saved automatically (yet). */
  shouldAutosave(): boolean;
}

export interface AutosaveHooks {
  /** After a timed save, for a small "saved" note. Saves when the page is hidden say nothing. */
  onSaved?(): void;
  /** Once, when saving fails because storage is full (again only after a later save worked). */
  onFull?(): void;
}

interface Host {
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface DocumentLike {
  readonly visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface Autosave {
  /** Stops for good, e.g. when the player leaves without saving. */
  stop(): void;
}

export function installAutosave(target: AutosaveTarget, hooks: AutosaveHooks = {},
  host: Host = window, doc: DocumentLike = document, intervalMs = AUTOSAVE_INTERVAL_MS): Autosave {
  let warnedFull = false;
  let stopped = false;

  const saveNow = (quietly: boolean): void => {
    if (stopped || !target.shouldAutosave()) return;
    let saved: boolean;
    try {
      saved = target.save();
    } catch {
      saved = false; // An unexpected failure must never break the game; the next save tries again
    }
    if (saved) {
      warnedFull = false;
      if (!quietly) hooks.onSaved?.();
    } else if (!warnedFull) {
      warnedFull = true;
      hooks.onFull?.();
    }
  };

  const onHidden = (): void => {
    if (doc.visibilityState === "hidden") saveNow(true);
  };
  const onPageHide = (): void => saveNow(true);

  const timer = host.setInterval(() => saveNow(false), intervalMs);
  doc.addEventListener("visibilitychange", onHidden);
  host.addEventListener("pagehide", onPageHide);

  return {
    stop() {
      stopped = true;
      host.clearInterval(timer);
      doc.removeEventListener("visibilitychange", onHidden);
      host.removeEventListener("pagehide", onPageHide);
    },
  };
}

/** "บันทึกอัตโนมัติแล้ว 10:42" for a moment in the corner of the map. */
export function showSavedNote(date: Date = new Date()): void {
  const time = date.toLocaleTimeString(getLanguage() === "en" ? "en-GB" : "th-TH", { hour: "2-digit", minute: "2-digit" });
  showCornerNote(t("autosave.saved", { time }), NOTE_MS);
}

/** The storage is full: says so for longer, and how to make room. */
export function showFullNote(): void {
  showCornerNote(t("autosave.full"), FULL_NOTE_MS);
}
