/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A small Web Audio engine: one-shot sounds, looping ambience beds that fade in and out, and a volume
// per channel (effects, ambience, interface, music) behind a master mute. Settings persist in localStorage.
// Browsers only allow audio after the player has clicked or pressed a key, so nothing plays until unlock().

import { Channel, SOUNDS, SoundDef } from "./catalog";

export interface AudioSettings {
  muted: boolean;
  volumes: Record<Channel, number>;
}

export interface PlayOptions {
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
  /** Extra gain on top of the catalog volume, 0-1. */
  volume?: number;
}

type SettingsStore = Pick<Storage, "getItem" | "setItem">;

export interface EngineOptions {
  sounds?: Record<string, SoundDef>;
  baseUrl?: string;
  createContext?: () => AudioContext;
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
  storage?: SettingsStore | null;
  now?: () => number;
}

interface LoopState {
  level: number;
  loading: boolean;
  source?: AudioBufferSourceNode;
  gain?: GainNode;
}

export const CHANNELS: Channel[] = ["effects", "ambience", "ui", "music"];
const STORAGE_KEY = "phaicity.audio";
const DEFAULT_MIN_GAP_MS = 60;
const ONE_SHOT_FADE_SECONDS = 0.4;
const LOOP_FADE_SECONDS = 2;
const SETTINGS_SMOOTHING_SECONDS = 0.05;

export function defaultSettings(): AudioSettings {
  return { muted: false, volumes: { effects: 0.8, ambience: 0.5, ui: 0.6, music: 0.6 } };
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

// Stored settings may be missing, partial or corrupt; anything unusable falls back to the default.
export function parseSettings(json: string | null): AudioSettings {
  const settings = defaultSettings();
  if (!json) return settings;
  try {
    const data = JSON.parse(json);
    settings.muted = data?.muted === true;
    for (const channel of CHANNELS) settings.volumes[channel] = clamp01(data?.volumes?.[channel], settings.volumes[channel]);
  } catch {
    // Keep the defaults
  }
  return settings;
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return await response.arrayBuffer();
}

export class AudioEngine {
  settings: AudioSettings;

  private readonly sounds: Record<string, SoundDef>;
  private readonly baseUrl: string;
  private readonly createContext: () => AudioContext;
  private readonly fetchBytes: (url: string) => Promise<ArrayBuffer>;
  private readonly storage: SettingsStore | null;
  private readonly now: () => number;

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly channels = new Map<Channel, GainNode>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly lastStarted = new Map<string, number>();
  private readonly loops = new Map<string, LoopState>();
  private readonly listeners = new Set<(settings: AudioSettings) => void>();

  constructor(options: EngineOptions = {}) {
    this.sounds = options.sounds ?? SOUNDS;
    this.baseUrl = options.baseUrl ?? "assets/audio/sfx/";
    this.createContext = options.createContext ?? (() => new AudioContext());
    this.fetchBytes = options.fetchBytes ?? fetchArrayBuffer;
    this.storage = options.storage ?? null;
    this.now = options.now ?? (() => Date.now());
    let stored: string | null = null;
    try {
      stored = this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      // Private windows may refuse storage
    }
    this.settings = parseSettings(stored);
  }

  get unlocked(): boolean {
    return this.context !== null;
  }

  /** Call from a click or key press. Creates the audio graph the first time, resumes it afterwards. */
  unlock(): void {
    if (this.context) {
      if (this.context.state === "suspended") void this.context.resume();
      return;
    }
    let context: AudioContext;
    try {
      context = this.createContext();
    } catch {
      return; // No Web Audio: the game stays silent
    }
    this.context = context;
    this.master = context.createGain();
    this.master.connect(context.destination);
    for (const channel of CHANNELS) {
      const gain = context.createGain();
      gain.connect(this.master);
      this.channels.set(channel, gain);
    }
    this.applySettings();

    // Short sounds are fetched now so the first clicks are heard; long recordings load on first use
    for (const sound of Object.values(this.sounds)) {
      if (!sound.loop && sound.maxDuration === undefined) void this.load(sound.file);
    }
    for (const [id, loop] of this.loops) {
      if (loop.level > 0) this.startLoop(id);
    }
  }

  play(id: string, options: PlayOptions = {}): void {
    const sound = this.sounds[id];
    if (!sound || !this.context || this.settings.muted || this.settings.volumes[sound.channel] === 0) return;

    const now = this.now();
    const last = this.lastStarted.get(id);
    if (last !== undefined && now - last < (sound.minGap ?? DEFAULT_MIN_GAP_MS)) return;
    this.lastStarted.set(id, now);

    void this.load(sound.file).then((buffer) => {
      if (buffer) this.startOneShot(sound, buffer, options);
    });
  }

  /** Fades a looping ambience bed towards level (0-1); 0 fades it out and stops it. Cheap to call every tick. */
  setLoop(id: string, level: number): void {
    const sound = this.sounds[id];
    if (!sound?.loop) return;
    const loop = this.loops.get(id) ?? { level: 0, loading: false };
    this.loops.set(id, loop);
    const target = clamp01(level, 0);
    if (target === loop.level) return;
    loop.level = target;
    if (!this.context) return;
    if (loop.gain) this.fadeLoop(loop, sound);
    else if (target > 0) this.startLoop(id);
  }

  loopLevel(id: string): number {
    return this.loops.get(id)?.level ?? 0;
  }

  setVolume(channel: Channel, value: number): void {
    this.settings.volumes[channel] = clamp01(value, this.settings.volumes[channel]);
    this.changed();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.changed();
  }

  onChange(listener: (settings: AudioSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Silences everything while the page is hidden, and resumes when it is shown again. */
  setPageHidden(hidden: boolean): void {
    if (!this.context) return;
    if (hidden) void this.context.suspend();
    else void this.context.resume();
  }

  private changed(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // The setting then lasts for this page only
    }
    this.applySettings();
    this.listeners.forEach((listener) => listener(this.settings));
  }

  private applySettings(): void {
    if (!this.context || !this.master) return;
    const time = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, time, SETTINGS_SMOOTHING_SECONDS);
    for (const [channel, gain] of this.channels) {
      gain.gain.setTargetAtTime(this.settings.volumes[channel], time, SETTINGS_SMOOTHING_SECONDS);
    }
  }

  private load(file: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(file);
    if (!buffer) {
      const context = this.context;
      buffer = context
        ? this.fetchBytes(this.baseUrl + file).then((bytes) => context.decodeAudioData(bytes)).catch(() => null)
        : Promise.resolve(null);
      if (context) this.buffers.set(file, buffer);
    }
    return buffer;
  }

  private startOneShot(sound: SoundDef, buffer: AudioBuffer, options: PlayOptions): void {
    const context = this.context;
    const channel = this.channels.get(sound.channel);
    if (!context || !channel) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const level = sound.volume * clamp01(options.volume ?? 1, 1);
    const start = context.currentTime;
    gain.gain.setValueAtTime(level, start);
    source.connect(gain);

    let output: AudioNode = gain;
    if (options.pan && typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      gain.connect(panner);
      output = panner;
    }
    output.connect(channel);

    source.start(start);
    if (sound.maxDuration !== undefined && buffer.duration > sound.maxDuration) {
      const end = start + sound.maxDuration;
      gain.gain.setValueAtTime(level, end - ONE_SHOT_FADE_SECONDS);
      gain.gain.linearRampToValueAtTime(0, end);
      source.stop(end);
    }
  }

  private startLoop(id: string): void {
    const sound = this.sounds[id];
    const loop = this.loops.get(id);
    if (!sound || !loop || loop.loading || loop.gain) return;
    loop.loading = true;
    void this.load(sound.file).then((buffer) => {
      loop.loading = false;
      const context = this.context;
      const channel = this.channels.get(sound.channel);
      if (!buffer || !context || !channel || loop.gain || loop.level === 0) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      source.connect(gain);
      gain.connect(channel);
      source.start();
      loop.source = source;
      loop.gain = gain;
      this.fadeLoop(loop, sound);
    });
  }

  private fadeLoop(loop: LoopState, sound: SoundDef): void {
    const context = this.context;
    if (!context || !loop.gain) return;
    const time = context.currentTime;
    const gain = loop.gain.gain;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(gain.value, time);
    gain.linearRampToValueAtTime(loop.level * sound.volume, time + LOOP_FADE_SECONDS);
    if (loop.level === 0) {
      loop.source?.stop(time + LOOP_FADE_SECONDS);
      loop.source = undefined;
      loop.gain = undefined;
    }
  }
}
