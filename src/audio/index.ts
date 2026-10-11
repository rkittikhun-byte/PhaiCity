/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's single audio engine, and the page-level wiring: unlocking audio on the first click or key,
// silence while the tab is hidden, button sounds, the header mute button and the sound settings.
// Plan and sound list: docs/audio/AUDIO_PLAN.md and docs/audio/SOUND_LIST.md.

import { onLanguageChange, t } from "../i18n/index";
import type { Channel } from "./catalog";
import { AudioEngine } from "./engine";
import { installUiSounds } from "./uiSounds";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const audio = new AudioEngine({ storage: typeof window === "undefined" ? null : browserStorage() });

// A sound from each channel, so moving its slider lets the player hear the new level
const CHANNEL_PREVIEW: Partial<Record<Channel, string>> = { effects: "tool.zone", ui: "ui.click" };

function bindSoundControls(doc: Document): void {
  const toggle = doc.getElementById("soundToggle");
  const muted = doc.getElementById("soundMuted") as HTMLInputElement | null;
  const sliders = Array.from(doc.querySelectorAll<HTMLInputElement>("input[data-sound-channel]"));

  const render = (): void => {
    const { settings } = audio;
    if (toggle) {
      toggle.textContent = settings.muted ? "🔇" : "🔊";
      toggle.title = t(settings.muted ? "sound.toggle_on" : "sound.toggle_off");
      toggle.setAttribute("aria-label", toggle.title);
      toggle.setAttribute("aria-pressed", String(settings.muted));
    }
    if (muted) muted.checked = settings.muted;
    for (const slider of sliders) {
      slider.value = String(Math.round(settings.volumes[slider.dataset.soundChannel as Channel] * 100));
    }
  };

  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    audio.unlock();
    audio.setMuted(!audio.settings.muted);
    if (!audio.settings.muted) audio.play("ui.click");
  });
  muted?.addEventListener("change", () => audio.setMuted(muted.checked));
  for (const slider of sliders) {
    const channel = slider.dataset.soundChannel as Channel;
    slider.addEventListener("input", () => {
      audio.setVolume(channel, Number(slider.value) / 100);
      const preview = CHANNEL_PREVIEW[channel];
      if (preview) audio.play(preview);
    });
  }

  audio.onChange(render);
  onLanguageChange(render);
  render();
}

export function installAudio(doc: Document = document): void {
  const unlock = (): void => audio.unlock();
  doc.addEventListener("pointerdown", unlock, true);
  doc.addEventListener("keydown", unlock, true);
  doc.addEventListener("visibilitychange", () => audio.setPageHidden(doc.hidden));
  installUiSounds(doc, audio);
  bindSoundControls(doc);
}
