/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Interface sounds for every button on the page, through one delegated click listener,
// so new windows and buttons get sounds without extra code.

import type { SoundPlayer } from "./gameAudio";

export interface ControlInfo {
  id: string;
  classes: string[];
  disabled: boolean;
}

const CONTROLS = "button, input[type=submit], input[type=radio], input[type=checkbox], select";

export function uiSoundForControl(control: ControlInfo): string | null {
  if (control.disabled) return null;
  switch (control.id) {
    case "languageToggle": return "ui.lang";
    case "pauseRequest": return "ui.speed";
    // The mute button sounds after unmuting, and saving sounds when the game has saved
    case "soundToggle":
    case "saveRequest":
      return null;
  }
  const has = (name: string): boolean => control.classes.includes(name);
  if (has("toolButton")) return "ui.select";
  if (has("miscButton")) return "ui.open";
  if (has("dialogOK") || has("cancel")) return "ui.close";
  return "ui.click";
}

export function installUiSounds(root: Document, player: Pick<SoundPlayer, "play">): void {
  root.addEventListener("click", (event) => {
    const control = (event.target as Element | null)?.closest?.(CONTROLS);
    if (!control) return;
    const id = uiSoundForControl({
      id: control.id,
      classes: Array.from(control.classList),
      disabled: (control as HTMLButtonElement).disabled === true,
    });
    if (id) player.play(id);
  }, true);
}
