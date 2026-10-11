/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { MusicEngine, MusicPlayer, pickTrack, TrackLists } from "../src/audio/music";

class FakeParam {
  value = 1;
  setValueAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime(v: number) { this.value = v; }
  cancelScheduledValues() { /* nothing scheduled in the fake */ }
}

class FakeAudio {
  listeners = new Map<string, Array<() => void>>();
  played = false;
  paused = false;
  preload = "";
  loop = false;
  constructor(public src: string) {}
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string) { (this.listeners.get(type) ?? []).forEach((listener) => listener()); }
  play() { this.played = true; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { /* releases the file in a browser */ }
}

function setup(lists: TrackLists) {
  const unlockers: Array<() => void> = [];
  const elements: FakeAudio[] = [];
  const engine: MusicEngine & { unlock(): void } = {
    unlocked: false,
    time: 0,
    onUnlock(listener) { if (this.unlocked) listener(); else unlockers.push(listener); },
    connectMedia: () => ({ gain: new FakeParam(), disconnect() { /* fake */ } }) as unknown as GainNode,
    unlock() { (this as { unlocked: boolean }).unlocked = true; unlockers.forEach((listener) => listener()); },
  };
  const player = new MusicPlayer(engine, {
    loadLists: () => Promise.resolve(lists),
    createElement: (src) => {
      const element = new FakeAudio(src);
      elements.push(element);
      return element as unknown as HTMLAudioElement;
    },
    random: () => 0,
    gapMs: 0,
  });
  return { engine, player, elements };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("pickTrack", () => {
  test("never repeats the last track when there is a choice", () => {
    expect(pickTrack(["a", "b"], "a", () => 0)).toBe("b");
    expect(pickTrack(["a"], "a", () => 0)).toBe("a");
    expect(pickTrack([], null, () => 0)).toBeNull();
  });
});

describe("MusicPlayer", () => {
  test("waits for the player's first click, then plays", async () => {
    const { engine, player, elements } = setup({ theme: ["theme.ogg"] });
    player.play("theme");
    await settle();
    expect(elements).toHaveLength(0);
    engine.unlock();
    await settle();
    expect(elements).toHaveLength(1);
    expect(elements[0].src).toBe("assets/audio/music/theme.ogg");
    expect(elements[0].played).toBe(true);
    expect(elements[0].loop).toBe(true); // a single track loops
  });

  test("asking for the playlist already playing changes nothing; a new one cross-fades", async () => {
    const { engine, player, elements } = setup({ theme: ["theme.ogg"], north: ["n1.ogg", "n2.ogg"] });
    engine.unlock();
    player.play("theme");
    await settle();
    player.play("theme");
    await settle();
    expect(elements).toHaveLength(1);
    player.play("north");
    await settle();
    expect(player.playing?.list).toBe("north");
    expect(elements[1].loop).toBe(false);
  });

  test("moves to another track when one ends, and skips files that fail", async () => {
    const { engine, player, elements } = setup({ north: ["n1.ogg", "n2.ogg"] });
    engine.unlock();
    player.play("north");
    await settle();
    const first = player.playing!.track;
    elements[0].emit("ended");
    await settle();
    expect(player.playing!.track).not.toBe(first);
    elements[1].emit("error");
    await settle();
    expect(player.playing!.track).toBe(first);
  });

  test("a playlist without music stays quiet", async () => {
    const { engine, player, elements } = setup({ south: [] });
    engine.unlock();
    player.play("south");
    await settle();
    expect(elements).toHaveLength(0);
    expect(player.playing).toBeNull();
  });
});

describe("the music folder", () => {
  test("lists a playlist for the theme and each region; every listed file exists and is credited", () => {
    const folder = path.join(__dirname, "..", "assets", "audio", "music");
    const lists = JSON.parse(fs.readFileSync(path.join(folder, "tracks.json"), "utf8"));
    const credits = fs.readFileSync(path.join(folder, "CREDITS.md"), "utf8");
    const regions = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "thailand-provinces.json"), "utf8")).regions;
    for (const name of ["theme", ...regions.map((r: { id: string }) => r.id)]) {
      expect(Array.isArray(lists[name])).toBe(true);
      for (const file of lists[name]) {
        expect(fs.existsSync(path.join(folder, file))).toBe(true);
        expect(credits).toContain(`| \`${file}\` |`);
      }
    }
  });
});
