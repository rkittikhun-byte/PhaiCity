/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Music (docs/audio/AUDIO_PLAN.md stage 3): the main theme on the start screen, and in a city the
// playlist of its region. Tracks stream from assets/audio/music/ and cross-fade; a playlist plays in a
// shuffled order without repeating the last track, with a rest between tracks so the city itself is heard
// (and a short theme does not repeat without a break). Which files exist is listed in
// assets/audio/music/tracks.json, so a region without music yet stays quiet without failed requests.
// The music itself (brief, prompts, file spec, how to add a track): docs/audio/SOUND_LIST.md sections 6 and 9–12.

import type { Channel } from "./catalog";

export type TrackLists = Record<string, string[]>;

/** The part of AudioEngine the music needs. */
export interface MusicEngine {
  readonly unlocked: boolean;
  readonly time: number;
  onUnlock(listener: () => void): void;
  connectMedia(element: HTMLMediaElement, channel: Channel): GainNode | null;
}

interface Playing {
  list: string;
  track: string;
  element: HTMLAudioElement;
  gain: GainNode;
}

export interface MusicOptions {
  baseUrl?: string;
  loadLists?: () => Promise<TrackLists>;
  createElement?: (src: string) => HTMLAudioElement;
  random?: () => number;
  /** Ms of quiet between two tracks, picked at random between the two values. */
  restMs?: readonly [number, number];
}

export const THEME = "theme";
const FADE_SECONDS = 2.5;
const DEFAULT_REST_MS: readonly [number, number] = [20000, 45000];

/** A random track of the list, never the one that just played unless it is the only one. */
export function pickTrack(tracks: readonly string[], previous: string | null, random: () => number): string | null {
  if (tracks.length === 0) return null;
  const choices = tracks.length > 1 ? tracks.filter((track) => track !== previous) : tracks;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export class MusicPlayer {
  private readonly baseUrl: string;
  private readonly loadLists: () => Promise<TrackLists>;
  private readonly createElement: (src: string) => HTMLAudioElement;
  private readonly random: () => number;
  private readonly restMs: readonly [number, number];
  private lists: Promise<TrackLists> | null = null;
  private readonly broken = new Set<string>();
  private wanted: string | null = null;
  private current: Playing | null = null;
  private lastTrack: string | null = null;
  private paused = false;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly engine: MusicEngine, options: MusicOptions = {}) {
    this.baseUrl = options.baseUrl ?? "assets/audio/music/";
    this.loadLists = options.loadLists ?? (async () => {
      const response = await fetch(`${this.baseUrl}tracks.json`);
      return response.ok ? await response.json() as TrackLists : {};
    });
    this.createElement = options.createElement ?? ((src) => new Audio(src));
    this.random = options.random ?? Math.random;
    this.restMs = options.restMs ?? DEFAULT_REST_MS;
    engine.onUnlock(() => void this.update());
  }

  private nextRest(): number {
    const [shortest, longest] = this.restMs;
    return shortest + (longest - shortest) * this.random();
  }

  /** Plays a playlist ("theme" or a region id); asking for the one already playing changes nothing. */
  play(list: string): void {
    if (this.wanted === list) return;
    this.wanted = list;
    void this.update();
  }

  /** The playlist of a province's region, or the theme for practice maps. */
  async playForProvince(provinceId: string | null): Promise<void> {
    if (!provinceId) {
      this.play(THEME);
      return;
    }
    try {
      const response = await fetch("data/thailand-provinces.json");
      const data = await response.json() as { provinces: Array<{ id: string; region: string }> };
      this.play(data.provinces.find((p) => p.id === provinceId)?.region ?? THEME);
    } catch {
      this.play(THEME);
    }
  }

  stop(): void {
    this.wanted = null;
    void this.update();
  }

  /** Pauses while the page is hidden, and carries on where it was. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.current) return;
    if (paused) this.current.element.pause();
    else void this.current.element.play().catch(() => undefined);
  }

  get playing(): { list: string; track: string } | null {
    return this.current ? { list: this.current.list, track: this.current.track } : null;
  }

  private tracksOf(list: string, lists: TrackLists): string[] {
    return (lists[list] ?? []).filter((track) => !this.broken.has(track));
  }

  private async update(): Promise<void> {
    if (!this.engine.unlocked) return; // Browsers allow sound only after a click; onUnlock comes back here
    this.lists ??= this.loadLists().catch(() => ({}));
    const lists = await this.lists;
    if (this.current?.list === this.wanted) return;
    this.fadeOut();
    if (this.wanted) this.startTrack(this.wanted, lists);
  }

  private startTrack(list: string, lists: TrackLists): void {
    const tracks = this.tracksOf(list, lists);
    const track = pickTrack(tracks, this.lastTrack, this.random);
    if (!track) return;
    const element = this.createElement(this.baseUrl + track);
    element.preload = "auto";
    const gain = this.engine.connectMedia(element, "music");
    if (!gain) return;
    gain.gain.setValueAtTime(0, this.engine.time);
    gain.gain.linearRampToValueAtTime(1, this.engine.time + FADE_SECONDS);
    const playing: Playing = { list, track, element, gain };
    this.current = playing;
    this.lastTrack = track;

    element.addEventListener("ended", () => {
      if (this.current !== playing) return;
      this.current = null;
      // A rest, then the next track (the same one again for a playlist of one)
      this.gapTimer = setTimeout(() => {
        if (this.wanted === list && !this.current) this.startTrack(list, lists);
      }, this.nextRest());
    });
    // A file that will not play is skipped for the rest of the visit
    element.addEventListener("error", () => {
      this.broken.add(track);
      if (this.current !== playing) return;
      this.current = null;
      if (this.wanted === list) this.startTrack(list, lists);
    });
    if (!this.paused) void element.play().catch(() => undefined);
  }

  private fadeOut(): void {
    if (this.gapTimer !== null) clearTimeout(this.gapTimer);
    this.gapTimer = null;
    const old = this.current;
    if (!old) return;
    this.current = null;
    const now = this.engine.time;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    setTimeout(() => {
      old.element.pause();
      old.element.removeAttribute("src");
      old.gain.disconnect();
    }, FADE_SECONDS * 1000 + 100);
  }
}
