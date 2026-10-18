/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The loading screen between the province card and the city (owner, 18 Oct 2026: "จะโหลด สิ่งต่างๆ ในเกมส์ โดยแสดง
// สิ่งต่างๆ ทั้งหมดว่าโหลดอะไรบ้าง ... และ logo phaicity ด้วย และเพลงที่ใช้เป็นของแต่ละภาคด้วย"): the PhaiCity logo, the
// city's name, one line saying what is loading now (owner: "แสดงเป็นบันทัดเดียว แล้ว มี progress แบบ cool ๆ"; the 3D
// view's surfaces counted as they arrive), a glowing gold bar with the share done counting up beside it, and the music
// of the city's region, which starts here and plays on in the city. It all happens in the page, with no reload. It only
// shows what loads; it never changes the city.

import { music } from "./audio/index.js";
import { onLanguageChange, t } from "./i18n/index.js";
import { loadCount, onLoadCount } from "./loadingProgress.js";

/** What a city loads, in the order the screen lists it */
export const LOAD_STEPS = ["map", "heights", "view", "rules", "resources", "ground", "city", "world", "textures"] as const;
export type LoadStep = typeof LOAD_STEPS[number];
export type StepState = "waiting" | "loading" | "done" | "failed";
/** Where the city comes from: a province's real map, a saved city or a random practice map */
export type CitySource = "province" | "saved" | "practice";

/** After the city's first picture, how long the screen waits at most for the surfaces still on their way (ms) */
const SURFACES_WAIT_MS = 8000;
/** ... and how long no new surface must be asked for before they count as all there */
const SURFACES_QUIET_MS = 500;
const FADE_MS = 600, FULL_MS = 350;

/** The steps a city from this source loads: a saved or practice city has its map already, and no heights to fetch */
export function stepsFor(source: CitySource): LoadStep[] {
  return LOAD_STEPS.filter((step) => source === "province" || step !== "heights");
}

/** The words for a step: the map's depend on where the city comes from */
export function stepKey(step: LoadStep, source: CitySource): string {
  if (step === "map" && source !== "province") return `loading.step.${source}`;
  return `loading.step.${step}`;
}

/** The steps and how far each has come; the share done counts the surfaces as they arrive */
export class LoadingSteps {
  readonly states = new Map<LoadStep, StepState>();

  constructor(readonly steps: readonly LoadStep[]) {
    for (const step of steps) this.states.set(step, "waiting");
  }

  mark(step: LoadStep, state: StepState): void {
    if (!this.states.has(step)) return;
    // A step never goes back: done or failed stays so
    const now = this.states.get(step);
    if (now === "done" || now === "failed") return;
    this.states.set(step, state);
  }

  state(step: LoadStep): StepState {
    return this.states.get(step) ?? "waiting";
  }

  /** The step the screen's one line names: the first still loading, else the next waiting, else the last */
  current(): LoadStep {
    const open = this.steps.find((step) => this.state(step) === "loading") ??
      this.steps.find((step) => this.state(step) === "waiting");
    return open ?? this.steps[this.steps.length - 1];
  }

  /** 0 to 1: each step finished counts one, the surfaces their share arrived so far */
  progress(surfaces: { requested: number; finished: number }): number {
    let done = 0;
    for (const [step, state] of this.states) {
      if (state === "done" || state === "failed") done++;
      else if (step === "textures" && surfaces.requested > 0) done += surfaces.finished / surfaces.requested;
    }
    return this.steps.length ? done / this.steps.length : 1;
  }
}

interface Screen {
  root: HTMLElement;
  /** The parts that change: the city's name, the one line, the bar, its glowing head, the share and the music */
  parts: { city: HTMLElement; line: HTMLElement; name: HTMLElement; detail: HTMLElement; fill: HTMLElement;
    percent: HTMLElement; music: HTMLElement };
  /** The share the bar shows, catching up with the real one so it glides */
  shown: number;
  /** The step the line named last, so a new one slides in */
  named: LoadStep | null;
  timer: number;
  steps: LoadingSteps;
  source: CitySource;
  city: string | null;
  music: string;
  stopCount: () => void;
  stopLanguage: () => void;
  closing: boolean;
}

let screen: Screen | null = null;

/** Whether the loading screen is showing */
export function loadingScreenOpen(): boolean {
  return screen !== null;
}

/**
 * Opens the loading screen for a city and starts its region's music (the theme for a practice map). Opening it
 * again while it shows changes nothing.
 */
export function showLoadingScreen(options: { city: string | null; provinceId: string | null; source: CitySource }): void {
  if (screen || typeof document === "undefined") return;
  const root = document.createElement("div");
  root.id = "loadingScreen";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  document.body.appendChild(root);
  screen = {
    root, parts: build(root), shown: 0, named: null, timer: 0,
    steps: new LoadingSteps(stepsFor(options.source)), source: options.source, city: options.city,
    music: options.provinceId ? "" : t("loading.music_theme"), stopCount: () => undefined, stopLanguage: () => undefined,
    closing: false,
  };
  screen.stopCount = onLoadCount(render);
  screen.stopLanguage = onLanguageChange(render);
  render();
  // The bar glides towards the share done, a little each tick (timers, not frames, so it moves in a hidden tab too)
  const live = screen;
  live.timer = window.setInterval(() => glide(live), 40);
  // The region's music starts now and plays on in the city (game.js asks for the same playlist, which changes nothing)
  void music.playForProvince(options.provinceId);
  if (options.provinceId) void showRegionMusic(options.provinceId);
  // Fades in on the next frame
  window.setTimeout(() => root.classList.add("shown"), 20);
}

/** Marks a step */
export function markLoadingStep(step: LoadStep, state: StepState): void {
  if (!screen) return;
  screen.steps.mark(step, state);
  render();
}

/** Marks a step loading until the work settles, then done (or failed); the work's own result passes through */
export function loadingStep<T>(step: LoadStep, work: Promise<T>): Promise<T> {
  markLoadingStep(step, "loading");
  work.then(() => markLoadingStep(step, "done"), () => markLoadingStep(step, "failed"));
  return work;
}

/**
 * The city has drawn its first picture (game.js animate): the world is there. The screen stays while the 3D view's
 * surfaces are still arriving, so the city opens dressed, then fades away.
 */
export function loadingFirstFrame(): void {
  if (!screen || screen.closing) return;
  const shown = screen;
  shown.closing = true;
  markLoadingStep("world", "done");
  const started = Date.now();
  let quietSince = Date.now(), last = loadCount("textures").requested;
  const check = (): void => {
    const surfaces = loadCount("textures");
    if (surfaces.requested !== last) { last = surfaces.requested; quietSince = Date.now(); }
    const settled = surfaces.finished >= surfaces.requested && Date.now() - quietSince >= SURFACES_QUIET_MS;
    if (settled || Date.now() - started >= SURFACES_WAIT_MS) {
      markLoadingStep("textures", "done");
      close(shown);
    } else window.setTimeout(check, 120);
  };
  check();
}

/** The bar fills to the end and shines a moment, then the screen fades */
function close(shown: Screen): void {
  window.clearInterval(shown.timer);
  shown.stopCount();
  shown.stopLanguage();
  shown.parts.fill.style.width = "100%";
  shown.parts.percent.textContent = "100%";
  shown.root.classList.add("complete");
  window.setTimeout(() => shown.root.classList.remove("shown"), FULL_MS);
  window.setTimeout(() => {
    shown.root.remove();
    if (screen === shown) screen = null;
  }, FULL_MS + FADE_MS);
}

/** "Music of the Northeast" under the line, once the province's region is known */
async function showRegionMusic(provinceId: string): Promise<void> {
  try {
    const response = await fetch("data/thailand-provinces.json");
    const data = await response.json() as { provinces: Array<{ id: string; region: string }> };
    const region = data.provinces.find((p) => p.id === provinceId)?.region;
    if (screen) {
      screen.music = region ? t("loading.music", { region: t(`region.${region}.short`) }) : t("loading.music_theme");
      render();
    }
  } catch {
    if (screen) { screen.music = t("loading.music_theme"); render(); }
  }
}

/** The screen's parts, made once: the logo, the city, one line of what loads, the bar with its share, the music */
function build(root: HTMLElement): Screen["parts"] {
  const doc = root.ownerDocument;
  const element = (tag: string, className: string, text = ""): HTMLElement => {
    const node = doc.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const card = element("div", "lsCard"), city = element("div", "lsCity");
  const line = element("div", "lsLine"), name = element("span", "lsName"), detail = element("span", "lsDetail");
  line.append(element("span", "lsSpin"), name, detail);
  const meter = element("div", "lsMeter"), bar = element("div", "lsBar"), fill = element("div", "lsFill");
  const percent = element("div", "lsPercent", "0%");
  fill.append(element("span", "lsHead"));
  bar.append(fill);
  meter.append(bar, percent);
  const music = element("div", "lsMusic");
  card.append(element("div", "lsBrand", "PhaiCity"), city, line, meter, music);
  root.replaceChildren(card);
  return { city, line, name, detail, fill, percent, music };
}

/** The share the bar and the number show moves a fifth of the way to the real one each tick, and never back */
function glide(live: Screen): void {
  const target = live.steps.progress(loadCount("textures"));
  if (target <= live.shown + 0.0005) return;
  live.shown = Math.min(target, live.shown + Math.max(0.004, (target - live.shown) * 0.2));
  live.parts.fill.style.width = `${(live.shown * 100).toFixed(1)}%`;
  live.parts.percent.textContent = `${Math.floor(live.shown * 100)}%`;
}

function render(): void {
  if (!screen) return;
  const { steps, source, city, parts } = screen;
  const surfaces = loadCount("textures");
  // The surfaces load while the world is built; they are loading as soon as the first is asked for
  if (surfaces.requested > 0 && steps.state("textures") === "waiting") steps.mark("textures", "loading");
  parts.city.textContent = city ? t("loading.title", { city }) : t("loading.title_practice");
  // One line: what is loading now, sliding in when it changes
  const step = steps.current();
  parts.name.textContent = t(stepKey(step, source));
  parts.detail.textContent = step === "textures" && surfaces.requested > 0 ? `${surfaces.finished}/${surfaces.requested}` : "";
  if (step !== screen.named) {
    screen.named = step;
    parts.line.classList.remove("lsIn");
    void parts.line.offsetWidth;
    parts.line.classList.add("lsIn");
  }
  parts.music.textContent = screen.music ? `♪ ${screen.music}` : "";
}
