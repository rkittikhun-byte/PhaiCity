/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { SOUNDS } from "../src/audio/catalog";
import { AudioEngine, defaultSettings, parseSettings } from "../src/audio/engine";
import {
  ambienceLevels, AMBIENCE_BEDS, BULLDOZER_SOUNDS, classifyTile, isRainySeason, pickAmbientOneShot, sampleView,
  soundForTool, soundsForMessage, SPRITE_SOUNDS, TOOL_RESULT, ViewStats,
} from "../src/audio/gameAudio";
import { uiSoundForControl } from "../src/audio/uiSounds";
import * as Messages from "../src/messages";

const root = path.join(__dirname, "..");
const sfxDir = path.join(root, "assets", "audio", "sfx");

// --- A fake Web Audio context that records what the engine schedules ---

class FakeParam {
  value = 1;
  calls: string[] = [];
  setValueAtTime(v: number) { this.value = v; this.calls.push(`set ${v}`); return this; }
  setTargetAtTime(v: number) { this.value = v; this.calls.push(`target ${v}`); return this; }
  linearRampToValueAtTime(v: number) { this.value = v; this.calls.push(`ramp ${v}`); return this; }
  cancelScheduledValues() { return this; }
}

class FakeNode {
  connected: FakeNode[] = [];
  connect(node: FakeNode) { this.connected.push(node); return node; }
}

class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakePanner extends FakeNode { pan = new FakeParam(); }

class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null;
  loop = false;
  started = false;
  stoppedAt: number | null = null;
  start() { this.started = true; }
  stop(when: number) { this.stoppedAt = when; }
}

class FakeContext {
  currentTime = 0;
  state = "running";
  destination = new FakeNode();
  sources: FakeSource[] = [];
  createGain() { return new FakeGain(); }
  createStereoPanner() { return new FakePanner(); }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  decodeAudioData(bytes: ArrayBuffer) { return Promise.resolve({ duration: new Uint8Array(bytes)[0] }); }
  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
}

function makeEngine(durations: Record<string, number> = {}) {
  const context = new FakeContext();
  const stored = new Map<string, string>();
  let clock = 0;
  const engine = new AudioEngine({
    createContext: () => context as unknown as AudioContext,
    // The fake decoder reads the duration from the first byte
    fetchBytes: (url) => Promise.resolve(new Uint8Array([durations[path.basename(url)] ?? 1]).buffer),
    storage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => { stored.set(k, v); } },
    now: () => clock,
  });
  return { engine, context, stored, tick: (ms: number) => { clock += ms; } };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("sound files", () => {
  const files = fs.readdirSync(sfxDir).sort();
  const credits = fs.readFileSync(path.join(root, "assets", "audio", "CREDITS.md"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "audio", "sfx-manifest.json"), "utf8"));

  test("every catalog sound has its file", () => {
    const missing = Object.entries(SOUNDS).filter(([, s]) => !files.includes(s.file)).map(([id]) => id);
    expect(missing).toEqual([]);
  });

  test("the folder holds exactly the manifest's files, each credited as CC0", () => {
    expect(files).toEqual(manifest.files.map((f: { file: string }) => f.file).sort());
    for (const file of files) expect(credits).toMatch(new RegExp(`\\| \`${file.replace(".", "\\.")}\` \\|.*\\| CC0 \\|`));
  });

  test("the sounds stay small enough for the web", () => {
    const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(sfxDir, f)).size, 0);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });
});

describe("settings", () => {
  test("defaults when nothing is stored or the data is corrupt", () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings("{not json")).toEqual(defaultSettings());
  });

  test("keeps valid values, clamps and ignores the rest", () => {
    const settings = parseSettings(JSON.stringify({ muted: true, volumes: { effects: 0.3, ui: 7, ambience: "loud" } }));
    expect(settings.muted).toBe(true);
    expect(settings.volumes.effects).toBe(0.3);
    expect(settings.volumes.ui).toBe(1);
    expect(settings.volumes.ambience).toBe(defaultSettings().volumes.ambience);
  });
});

describe("AudioEngine", () => {
  test("stays silent until unlocked by the player", async () => {
    const { engine, context } = makeEngine();
    engine.play("ui.click");
    await flush();
    expect(context.sources).toHaveLength(0);
    engine.unlock();
    engine.play("ui.click");
    await flush();
    expect(context.sources.some((s) => s.started)).toBe(true);
  });

  test("does not restart the same sound within its minimum gap", async () => {
    const { engine, context, tick } = makeEngine();
    engine.unlock();
    await flush();
    const before = context.sources.length;
    engine.play("ui.error");
    engine.play("ui.error");
    tick(SOUNDS["ui.error"].minGap! + 1);
    engine.play("ui.error");
    await flush();
    expect(context.sources.length - before).toBe(2);
  });

  test("muting stops new sounds and is remembered", async () => {
    const { engine, context, stored } = makeEngine();
    engine.unlock();
    engine.setMuted(true);
    await flush();
    const before = context.sources.length;
    engine.play("ui.click");
    await flush();
    expect(context.sources.length).toBe(before);
    expect(JSON.parse(stored.get("phaicity.audio")!).muted).toBe(true);
  });

  test("cuts long recordings at their maximum duration", async () => {
    const { engine, context } = makeEngine({ "rumble.ogg": 42 });
    engine.unlock();
    engine.play("event.rumble");
    await flush();
    const source = context.sources.find((s) => s.buffer?.duration === 42)!;
    expect(source.stoppedAt).toBe(SOUNDS["event.rumble"].maxDuration);
  });

  test("ambience asked for before unlocking starts once audio is allowed, and fades out", async () => {
    const { engine, context } = makeEngine();
    engine.setLoop("amb.nature", 0.5);
    engine.unlock();
    await flush();
    const loop = context.sources.find((s) => s.loop)!;
    expect(loop.started).toBe(true);
    engine.setLoop("amb.nature", 0);
    expect(loop.stoppedAt).not.toBeNull();
  });
});

describe("game sounds", () => {
  const ids = (list: string[]) => list.filter((id) => !(id in SOUNDS));

  test("every message maps only to sounds that exist", () => {
    for (const value of Object.values(Messages)) {
      if (typeof value !== "string") continue;
      expect(ids(soundsForMessage(value, "bad"))).toEqual([]);
    }
  });

  test("every disaster and crash has its own sound", () => {
    for (const message of [...Messages.DISASTER_MESSAGES, ...Messages.CRASHES]) {
      expect(soundsForMessage(message, "bad")).not.toEqual(["ui.notify_bad"]);
    }
  });

  test("other messages use the notification sound of their group", () => {
    expect(soundsForMessage(Messages.NEED_MORE_ROADS, "neutral")).toEqual(["ui.notify_neutral"]);
    expect(soundsForMessage(Messages.HIGH_CRIME, "bad")).toEqual(["ui.notify_bad"]);
    expect(soundsForMessage(Messages.REACHED_TOWN, "good")).toEqual(["ui.milestone"]);
    expect(soundsForMessage("Something else", null)).toEqual([]);
  });

  test("sprite, bulldozer and tool sounds exist", () => {
    expect(ids(Object.values(SPRITE_SOUNDS))).toEqual([]);
    expect(ids(Object.values(BULLDOZER_SOUNDS))).toEqual([]);
    const tools = ["residential", "commercial", "industrial", "road", "rail", "wire", "park", "bulldozer", "query",
      "police", "fire", "port", "airport", "stadium", "coal", "nuclear"];
    for (const tool of tools) expect(soundForTool(tool, TOOL_RESULT.OK)).toMatch(/^tool\./);
    expect(ids(tools.map((tool) => soundForTool(tool, TOOL_RESULT.OK)!))).toEqual([]);
  });

  test("a failed tool sounds an error, no tool sounds nothing", () => {
    expect(soundForTool("road", TOOL_RESULT.NO_MONEY)).toBe("ui.error");
    expect(soundForTool("residential", TOOL_RESULT.NEEDS_BULLDOZE)).toBe("ui.error");
    expect(soundForTool(null, TOOL_RESULT.OK)).toBeNull();
  });
});

describe("ambience", () => {
  const empty: ViewStats = { total: 0, water: 0, woods: 0, developed: 0, industrial: 0, airport: 0, stadiumGame: 0 };

  test("classifies tiles", () => {
    expect(classifyTile(0)).toBeNull();
    expect(classifyTile(2)).toBe("water");
    expect(classifyTile(21)).toBe("woods");
    expect(classifyTile(66)).toBe("developed");
    expect(classifyTile(625)).toBe("industrial");
    expect(classifyTile(709)).toBe("airport");
    expect(classifyTile(932)).toBe("stadiumGame");
  });

  test("samples only the tiles inside the map", () => {
    const map = { width: 4, height: 4, getTileValue: (x: number) => (x < 2 ? 21 : 2) };
    const stats = sampleView(map, { x0: -5, y0: -5, x1: 10, y1: 10 });
    expect(stats.total).toBe(16);
    expect(stats.woods).toBe(8);
    expect(stats.water).toBe(8);
  });

  test("samples a large view on a coarser grid", () => {
    const map = { width: 200, height: 200, getTileValue: () => 21 };
    expect(sampleView(map, { x0: 0, y0: 0, x1: 199, y1: 199 }, 100).total).toBeLessThanOrEqual(100);
  });

  test("forest is loud in the countryside and quiet in town; industry hums", () => {
    const forest = ambienceLevels({ ...empty, total: 100, woods: 60 });
    const town = ambienceLevels({ ...empty, total: 100, woods: 10, developed: 80 });
    expect(forest["amb.nature"]).toBe(1);
    expect(town["amb.nature"]).toBeLessThan(0.2);
    expect(ambienceLevels({ ...empty, total: 100, industrial: 10 })["amb.industrial"]).toBeCloseTo(0.5);
    for (const bed of AMBIENCE_BEDS) expect(SOUNDS[bed].loop).toBe(true);
  });

  test("one-shots fit the view and the season", () => {
    const always = () => 0;
    const never = () => 0.99;
    expect(isRainySeason(4)).toBe(true);
    expect(isRainySeason(11)).toBe(false);
    expect(pickAmbientOneShot({ ...empty, total: 100, stadiumGame: 4 }, 0, always)).toBe("amb.crowd");
    expect(pickAmbientOneShot({ ...empty, total: 100 }, 6, always)).toBe("amb.thunder");
    expect(pickAmbientOneShot({ ...empty, total: 100 }, 0, always)).toBeNull();
    expect(pickAmbientOneShot({ ...empty, total: 100, water: 50 }, 0, never)).toBeNull();
  });
});

describe("button sounds", () => {
  const control = (id: string, classes: string[] = [], disabled = false) => ({ id, classes, disabled });

  test("pick a sound by the kind of control", () => {
    expect(uiSoundForControl(control("residentialButton", ["toolButton"]))).toBe("ui.select");
    expect(uiSoundForControl(control("budgetRequest", ["miscButton"]))).toBe("ui.open");
    expect(uiSoundForControl(control("budgetOK", ["dialogOK"]))).toBe("ui.close");
    expect(uiSoundForControl(control("languageToggle"))).toBe("ui.lang");
    expect(uiSoundForControl(control("pauseRequest", ["miscButton"]))).toBe("ui.speed");
    expect(uiSoundForControl(control("splashPlay"))).toBe("ui.click");
  });

  test("disabled buttons, saving and the mute button make no click", () => {
    expect(uiSoundForControl(control("splashLoad", [], true))).toBeNull();
    expect(uiSoundForControl(control("saveRequest", ["miscButton"]))).toBeNull();
    expect(uiSoundForControl(control("soundToggle"))).toBeNull();
  });
});
