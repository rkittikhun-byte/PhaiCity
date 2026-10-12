/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Keyboard shortcuts in the game: 1–9 pick the most used tools and P pauses or resumes time.
// Keys are matched by their place on the keyboard (event.code), not the character they type, so they work with a
// Thai keyboard layout too. A shortcut just clicks the button, so selecting a tool works exactly as with the mouse.
// Arrows and WASD (panning) and Esc (close a window, drop the tool) stay with src/inputStatus.js and src/game.js.

import { onLanguageChange, t } from "./i18n/index";

/** The key's label on screen, and the tool it picks. */
export const TOOL_KEYS: ReadonlyArray<{ key: string; tool: string }> = [
  { key: "1", tool: "residential" },
  { key: "2", tool: "commercial" },
  { key: "3", tool: "industrial" },
  { key: "4", tool: "road" },
  { key: "5", tool: "rail" },
  { key: "6", tool: "wire" },
  { key: "7", tool: "park" },
  { key: "8", tool: "bulldozer" },
  { key: "9", tool: "query" },
];

export const PAUSE_CODE = "KeyP";

interface KeyLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** What a key press asks for, or null. Digits on the main row and on the number pad both count. */
export function shortcutFor(event: KeyLike): { tool: string } | { pause: true } | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  if (event.code === PAUSE_CODE) return { pause: true };
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
  const entry = TOOL_KEYS.find((k) => k.key === digit);
  return entry ? { tool: entry.tool } : null;
}

/** True while the player types in a field, or a window or the start screen is in front of the city. */
function keysBelongElsewhere(doc: Document, target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))) return true;
  if (doc.body.classList.contains("starting")) return true;
  // Windows keep their "hidden" class while open (src/modalWindow.js shows them with an inline display)
  return [...doc.querySelectorAll<HTMLElement>(".modal")].some((modal) => getComputedStyle(modal).display !== "none");
}

export function installToolShortcuts(doc: Document = document): void {
  // Each tool button shows its key, and says it when pointed at
  const label = (): void => {
    for (const { key, tool } of TOOL_KEYS) {
      const button = doc.querySelector<HTMLElement>(`.toolButton[data-tool="${tool}"]`);
      if (!button) continue;
      button.dataset.key = key;
      button.title = t("shortcut.tool", { tool: t(`tool.${tool}`), key });
    }
    const pause = doc.getElementById("pauseRequest");
    if (pause) pause.title = t("shortcut.pause");
  };
  label();
  onLanguageChange(label);

  doc.addEventListener("keydown", (event) => {
    if (event.repeat || keysBelongElsewhere(doc, event.target)) return;
    const shortcut = shortcutFor(event);
    if (!shortcut) return;
    const button = "tool" in shortcut
      ? doc.querySelector<HTMLElement>(`.toolButton[data-tool="${shortcut.tool}"]`)
      : doc.getElementById("pauseRequest");
    if (!button || (button as HTMLButtonElement).disabled) return;
    event.preventDefault();
    button.click();
  });
}
