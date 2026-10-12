/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's single audio engine, and the page-level wiring: unlocking audio on the first click or key,
// silence while the tab is hidden, button sounds, the header mute button and the sound settings.
// Plan and sound list: docs/audio/AUDIO_PLAN.md and docs/audio/SOUND_LIST.md.

import { onLanguageChange, t } from "../i18n/index";
import type { Channel } from "./catalog";
import { AudioEngine } from "./engine";
import { MusicPlayer } from "./music";
import { installUiSounds } from "./uiSounds";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const audio = new AudioEngine({ storage: typeof window === "undefined" ? null : browserStorage() });
export const music = new MusicPlayer(audio);

// A speaker drawn in SVG (emoji speakers are missing from some fonts), with sound waves or a cross when muted
export function soundIcon(muted: boolean): string {
  const waves = muted
    ? '<path d="M16 9l5 6M21 9l-5 6"/>'
    : '<path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M18.5 7a7.5 7.5 0 0 1 0 10"/>';
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
    waves + '</svg>';
}

// A sound from each channel, so moving its slider lets the player hear the new level
const CHANNEL_PREVIEW: Partial<Record<Channel, string>> = { effects: "tool.zone", ui: "ui.click" };

// What the player first clicked or pressed a key on, the gesture that let the sound start
let unlockTarget: EventTarget | null = null;

/** True until the player's first click or key press: the game is silent then, though not muted. */
export function soundWaiting(): boolean {
  return !audio.unlocked;
}

/**
 * How a sound button looks: a crossed speaker while muted or still waiting for the first click. A speaker whose
 * volume slider is still tucked away (closedControl) says that a click brings the slider out.
 */
export function renderSoundButton(button: HTMLElement, closedControl = false): void {
  const silent = audio.settings.muted || soundWaiting();
  button.innerHTML = soundIcon(silent);
  button.title = t(soundWaiting() ? "sound.waiting" : closedControl ? "sound.control"
    : audio.settings.muted ? "sound.toggle_on" : "sound.toggle_off");
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(silent));
  button.classList.toggle("soundWaiting", soundWaiting());
}

/** Whether this press on the button is the one that let the sound start. Starts the sound either way. */
function takeFirstPress(button: Element): boolean {
  const firstPress = soundWaiting() || (unlockTarget instanceof Node && button.contains(unlockTarget));
  unlockTarget = null;
  audio.unlock();
  return firstPress;
}

/**
 * What pressing a sound button does: mute or unmute. But the press that first lets the sound start only turns it on,
 * since until then the game was silent anyway; muting it there would leave the player thinking sound is broken.
 */
export function pressSoundButton(button: Element): void {
  if (takeFirstPress(button)) {
    if (audio.settings.muted) audio.setMuted(false);
  } else {
    audio.setMuted(!audio.settings.muted);
  }
  if (!audio.settings.muted) audio.play("ui.click");
}

function bindSoundControls(doc: Document): void {
  const toggle = doc.getElementById("soundToggle");
  // In the game the speaker sits in a pill with the volume slider: the first click slides it out, the next one
  // mutes or unmutes (owner, 12 Oct 2026). A click anywhere else or Esc tucks it away again.
  const control = doc.getElementById("soundControl");
  const volume = doc.getElementById("soundVolume") as HTMLInputElement | null;
  const muted = doc.getElementById("soundMuted") as HTMLInputElement | null;
  const sliders = Array.from(doc.querySelectorAll<HTMLInputElement>("input[data-sound-channel]"));
  const masters = Array.from(doc.querySelectorAll<HTMLInputElement>("input[data-sound-master]"));
  const isOpen = (): boolean => control?.classList.contains("open") ?? false;

  const render = (): void => {
    const { settings } = audio;
    if (toggle) renderSoundButton(toggle, control !== null && !isOpen());
    if (muted) muted.checked = settings.muted;
    for (const slider of sliders) {
      slider.value = String(Math.round(settings.volumes[slider.dataset.soundChannel as Channel] * 100));
    }
    for (const slider of masters) slider.value = String(Math.round(settings.volume * 100));
  };

  const setOpen = (open: boolean): void => {
    if (!control || isOpen() === open) return;
    control.classList.toggle("open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    if (volume) volume.tabIndex = open ? 0 : -1;
    render();
  };

  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!control || isOpen()) {
      pressSoundButton(toggle);
      return;
    }
    if (takeFirstPress(toggle) && audio.settings.muted) audio.setMuted(false);
    setOpen(true);
    if (!audio.settings.muted) audio.play("ui.click");
  });
  doc.addEventListener("pointerdown", (event) => {
    if (control && !control.contains(event.target as Node)) setOpen(false);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
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
  for (const slider of masters) {
    slider.addEventListener("input", () => {
      audio.setMasterVolume(Number(slider.value) / 100);
      // Turning the volume up is a clear wish to hear the game
      if (audio.settings.muted && audio.settings.volume > 0) audio.setMuted(false);
      audio.play("ui.click");
    });
  }

  audio.onChange(render);
  audio.onUnlock(render);
  onLanguageChange(render);
  render();
}

export function installAudio(doc: Document = document): void {
  const unlock = (event: Event): void => {
    if (soundWaiting()) unlockTarget = event.target;
    audio.unlock();
  };
  doc.addEventListener("pointerdown", unlock, true);
  doc.addEventListener("keydown", unlock, true);
  doc.addEventListener("visibilitychange", () => {
    audio.setPageHidden(doc.hidden);
    music.setPaused(doc.hidden);
  });
  installUiSounds(doc, audio);
  bindSoundControls(doc);
}
