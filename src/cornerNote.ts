/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A quiet note in the bottom-right corner of the map (#cornerNote in index.html) that fades after a moment:
// "Autosaved 10:42", or why the 3D view could not be used. City news keeps its own bar.

import { hide, show } from "./motion";

let timer: number | undefined;

export function showCornerNote(text: string, ms: number): void {
  const note = document.getElementById("cornerNote");
  if (!note) return;
  note.textContent = text;
  show(note);
  window.clearTimeout(timer);
  timer = window.setTimeout(() => hide(note, true), ms);
}

/** Shows the note only the first time on this browser: a hint the player needs once (remembered under key). */
export function showCornerNoteOnce(key: string, text: string, ms: number): void {
  try {
    if (window.localStorage.getItem(key) !== null) return;
    window.localStorage.setItem(key, "1");
  } catch {
    return; // Nowhere to remember it, so it would come back with every city
  }
  showCornerNote(text, ms);
}
