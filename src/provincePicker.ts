/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The start of the game (docs/ONLINE_PLAN.md phase 1), styled like a game console's home screen:
// a swaying bamboo grove behind a glowing map of Thailand built from real province shapes, big text on
// the left, and a row of large tiles at the bottom that the mouse or the arrow keys move through.
//   1. intro: a story about Thailand and its six regions that plays by itself (first launch, replayable)
//   2. region: one tile per region; the camera flies to the focused region
//   3. province: one tile per province of that region; choosing one slides in a card with the city name,
//      game difficulty and a start button.
// Small buttons at the top continue the saved city or start a practice game on a random map.

import { audio } from "./audio/index";
import { groupViewBox, NationalMap, projectNationalMap, ProjectedProvince } from "./geo/nationalMap";
import { drawPresetMap, PresetMap } from "./geo/presetMap";
import { difficultyStars, fundsBonus, provinceResources, startingFunds } from "./geo/provinceProfile";
import { getLanguage, onLanguageChange, setLanguage, t } from "./i18n/index";
import { hide, show } from "./motion";
import { mountStartBackdrop, StartBackdrop } from "./startBackdrop";

interface Province {
  id: string;
  nameTh: string;
  nameEn: string;
  region: string;
  neighbors: string[];
  tags?: string[];
}

interface Region {
  id: string;
  nameTh: string;
  nameEn: string;
}

interface PickerData {
  regions: Region[];
  provinces: Map<string, Province>;
  map: NationalMap;
}

interface Scene {
  title: string;
  text: string;
  extra?: string;
  plain?: boolean;
  reveal?: boolean;
  focus: string | null;
}

export interface SavedCity {
  name: string;
  provinceId: string | null;
}

export interface StartActions {
  saved: SavedCity | null;
  /** difficulty is a Simulation level: 0 easy, 1 medium, 2 hard */
  start(provinceId: string, cityName: string, difficulty: number): void;
  continueSaved(): void;
  practice(): void;
}

export interface StartOptions {
  /** Play the story first. */
  intro?: boolean;
  /** Open straight on this province (index.html?province=TH-xx). */
  provinceId?: string | null;
}

type ViewBox = [number, number, number, number];
type Mode = "intro" | "region" | "province";

interface Tile {
  id: string;
  element: HTMLButtonElement;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "provincePicker";
const INTRO_SEEN_KEY = "phaicity.introSeen";
const PREVIEW_PIXELS_PER_TILE = 1;
const FLY_MS = 1400;
const HERO_LEAVE_MS = 350;
const MIN_SCENE_MS = 4200;
const MS_PER_CHARACTER = 45;
const REVEAL_STEP_MS = 280;
const MAX_CITY_NAME_LENGTH = 15;
const WIDE_LAYOUT_PX = 900;
const CARD_WIDTH_PX = 400;
const TOP_BAR_PX = 70;
const TILE_ROW_PX = 220;
const CLOCK_MS = 20000;
const GOLD = "#f6cd6e";

const REGION_COLORS: Record<string, string> = {
  north: "#8cbf7a",
  northeast: "#e9c46a",
  central: "#f0a982",
  east: "#7fbfd4",
  west: "#b8a3d6",
  south: "#6cc3a9",
};

const LEVELS: Array<[number, string]> = [[0, "start.diff.easy"], [1, "start.diff.med"], [2, "start.diff.hard"]];

interface View {
  overlay: HTMLElement;
  backdrop: StartBackdrop;
  stage: HTMLElement;
  hero: HTMLElement;
  row: HTMLElement;
  rowTitle: HTMLButtonElement;
  tiles: HTMLElement;
  dots: HTMLElement;
  panel: HTMLElement;
  back: HTMLButtonElement;
  skip: HTMLButtonElement;
  replay: HTMLButtonElement;
  sound: HTMLButtonElement;
  menus: HTMLButtonElement;
  clock: HTMLElement;
  clockTimer: number;
  svg?: SVGSVGElement;
}

let view: View | null = null;
let dataPromise: Promise<PickerData> | null = null;
let data: PickerData | null = null;
let actions: StartActions | null = null;
let mode: Mode = "region";
let currentRegion: string | null = null;
let selectedProvince: string | null = null;
let tiles: Tile[] = [];
let focusIndex = 0;
let sceneIndex = 0;
let sceneTimer = 0;
let framedBox: ViewBox | null = null;
let currentViewBox: ViewBox = [0, 0, 1, 1];
let flyFrame = 0;
let heroToken = 0;
const paths = new Map<string, SVGElement>();
const regionLabels = new Map<string, SVGElement>();
const provinceLabels = new Map<string, SVGElement>();
const presets = new Map<string, Promise<PresetMap>>();

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return true; // Without storage the story would replay on every visit; show it on request only
  }
}

function markIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Nothing to remember it in
  }
}

const localName = (item: { nameTh: string; nameEn: string }): string =>
  getLanguage() === "en" ? item.nameEn : item.nameTh;
const otherName = (item: { nameTh: string; nameEn: string }): string =>
  getLanguage() === "en" ? item.nameTh : item.nameEn;
const money = (amount: number): string => `฿${amount.toLocaleString("en-US")}`;
const stars = (count: number): string => "★".repeat(count) + "☆".repeat(3 - count);
const reducedMotion = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function svgElement(tag: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return await response.json() as T;
}

function loadData(): Promise<PickerData> {
  dataPromise ??= Promise.all([
    fetchJson<{ regions: Region[]; provinces: Province[] }>("data/thailand-provinces.json"),
    fetchJson<unknown>("data/geo/thailand-provinces.topo.json"),
  ]).then(([json, topology]) => ({
    regions: json.regions,
    provinces: new Map(json.provinces.map((p) => [p.id, p])),
    map: projectNationalMap(topology),
  }));
  dataPromise.catch(() => {
    dataPromise = null; // Let the next open try again
  });
  return dataPromise;
}

function loadPreset(provinceId: string): Promise<PresetMap> {
  let preset = presets.get(provinceId);
  if (!preset) {
    preset = fetchJson<PresetMap>(`data/maps/${provinceId}.json`);
    preset.catch(() => presets.delete(provinceId));
    presets.set(provinceId, preset);
  }
  return preset;
}

// --- Shell ---

function buildShell(): View {
  const overlay = element("div", "ppCinema");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "PhaiCity");

  const backdropLayer = element("div", "ppBackdrop");
  const stage = element("div", "ppStage", t("picker.loading"));
  const vignette = element("div", "ppVignette");

  const top = element("div", "ppTop");
  const back = button("ppBack", t("picker.back_regions"), () => showRegions(false));
  const skip = button("ppSkip", `${t("intro.skip")} ›`, () => showRegions(true));
  const replay = button("ppQuiet", t("splash.replay_intro"), () => playIntro());
  const sound = button("ppQuiet ppSound", "", () => {
    audio.unlock();
    audio.setMuted(!audio.settings.muted);
  });
  const language = button("ppQuiet", t("lang.switch_to"), () => setLanguage(getLanguage() === "th" ? "en" : "th"));
  const menus = button("ppQuiet ppMenus", t("ui.hide_menus"), () => setMenusHidden(!overlay.classList.contains("ppMenusHidden")));
  const clock = element("span", "ppClock");
  const left = element("div", "ppTopLeft");
  left.append(element("span", "ppBrand", "PhaiCity"), back);
  const right = element("div", "ppTopRight");
  const saved = actions?.saved;
  if (saved) {
    right.appendChild(button("ppQuiet ppContinue", t("splash.btn.continue", { city: saved.name }), () => leaveTo(() => actions?.continueSaved())));
  }
  right.append(button("ppQuiet", t("start.practice"), () => leaveTo(() => actions?.practice())), replay, sound, language, menus, skip, clock);
  top.append(left, right);

  const hero = element("div", "ppHero");
  hero.setAttribute("aria-live", "polite");
  const row = element("div", "ppRow");
  const rowTitle = element("button", "ppRowTitle");
  rowTitle.type = "button";
  rowTitle.addEventListener("click", () => {
    row.classList.toggle("collapsed");
    if (framedBox) flyTo(framedBox);
  });
  const tileList = element("div", "ppTiles");
  tileList.setAttribute("role", "listbox");
  row.append(rowTitle, tileList);
  const dots = element("div", "ppDots");
  const panel = element("aside", "ppPanel");
  panel.hidden = true;

  // The required credits, small, at the bottom: copies of the game footer's lines
  const credits = element("div", "ppCredits");
  for (const selector of ["#author > span", "#footer .nameLicense", "#footer .mapCredit"]) {
    const line = document.querySelector(selector);
    if (line) credits.appendChild(line.cloneNode(true));
  }

  overlay.append(backdropLayer, stage, vignette, top, hero, row, dots, panel, credits);
  document.body.appendChild(overlay);

  // Clicking anywhere outside the card closes it (tiles and provinces open the next card themselves)
  overlay.addEventListener("pointerdown", (event) => {
    const target = event.target as Element;
    if (panel.hidden || panel.contains(target) || target.closest(".ppTile, .ppProvince, .ppTop")) return;
    closeCard();
  });

  const updateClock = (): void => {
    clock.textContent = new Date().toLocaleTimeString(getLanguage() === "en" ? "en-GB" : "th-TH", { hour: "2-digit", minute: "2-digit" });
  };
  updateClock();

  const built: View = {
    overlay, backdrop: mountStartBackdrop(backdropLayer), stage, hero, row, rowTitle, tiles: tileList, dots, panel,
    back, skip, replay, sound, menus, clock, clockTimer: window.setInterval(updateClock, CLOCK_MS),
  };
  renderSound(built);
  return built;
}

function destroyShell(): void {
  if (!view) return;
  window.clearTimeout(sceneTimer);
  window.clearInterval(view.clockTimer);
  view.backdrop.dispose();
  view.overlay.remove();
  view = null;
  paths.clear();
  regionLabels.clear();
  provinceLabels.clear();
  tiles = [];
}

function renderSound(target: View | null = view): void {
  if (!target) return;
  target.sound.textContent = audio.settings.muted ? "🔇" : "🔊";
  target.sound.title = t(audio.settings.muted ? "sound.toggle_on" : "sound.toggle_off");
}

function setChrome(options: { back?: boolean; skip?: boolean; dots?: boolean; row?: boolean }): void {
  if (!view) return;
  view.back.hidden = !options.back;
  view.skip.hidden = !options.skip;
  view.replay.hidden = !!options.skip;
  view.dots.hidden = !options.dots;
  if (options.row) show(view.row);
  else hide(view.row, true);
}

interface HeroContent {
  title: string;
  sub?: string;
  text?: string;
  extra?: string;
  body?: HTMLElement;
  hint?: string;
}

// The big text on the left changes with what is in focus: the new text slides in as the old drifts out.
function setHero(content: HeroContent): HTMLElement | null {
  if (!view) return null;
  for (const old of Array.from(view.hero.children)) {
    old.classList.add("leaving");
    window.setTimeout(() => old.remove(), HERO_LEAVE_MS);
  }
  const inner = element("div", "ppHeroInner");
  inner.appendChild(element("h2", undefined, content.title));
  if (content.sub) inner.appendChild(element("p", "ppHeroSub", content.sub));
  if (content.text) inner.appendChild(element("p", "ppHeroText", content.text));
  if (content.extra) inner.appendChild(element("p", "ppHeroExtra", content.extra));
  if (content.body) inner.appendChild(content.body);
  if (content.hint) inner.appendChild(element("p", "ppHeroHint", content.hint));
  view.hero.appendChild(inner);
  return inner;
}

function leaveTo(next: () => void): void {
  window.clearTimeout(sceneTimer);
  if (view) {
    hide(view.overlay, true);
    // Nothing comes back to the start screen without a reload, so free the animation now
    view.backdrop.dispose();
  }
  next();
}

// --- Map and camera ---

function regionMembers(regionId: string): ProjectedProvince[] {
  return data ? data.map.provinces.filter((p) => data!.provinces.get(p.id)?.region === regionId) : [];
}

function countryBox(): ViewBox {
  return data ? groupViewBox(data.map.provinces, 0.03) : [0, 0, 1, 1];
}

// The opening scene shows Thailand as the Golden Peninsula (แหลมทอง): one gold gradient across the whole
// country, so province borders don't break it, with a highlight that sweeps slowly across.
function goldDefinitions(box: ViewBox): SVGElement {
  const defs = svgElement("defs", {});
  const gradient = svgElement("linearGradient", {
    id: "ppGold",
    gradientUnits: "userSpaceOnUse",
    spreadMethod: "reflect",
    x1: box[0].toFixed(1),
    y1: box[1].toFixed(1),
    x2: (box[0] + box[2]).toFixed(1),
    y2: (box[1] + box[3]).toFixed(1),
  });
  const stops: Array<[string, string]> = [["0", "#7a5410"], ["0.35", "#d4a83a"], ["0.5", "#fff1b8"], ["0.65", "#d4a83a"], ["1", "#7a5410"]];
  for (const [offset, color] of stops) gradient.appendChild(svgElement("stop", { offset, "stop-color": color }));
  if (!reducedMotion()) {
    gradient.appendChild(svgElement("animateTransform", {
      attributeName: "gradientTransform",
      type: "translate",
      values: `${-box[2]} ${-box[3] / 2}; ${box[2]} ${box[3] / 2}`,
      dur: "6s",
      repeatCount: "indefinite",
    }));
  }
  defs.appendChild(gradient);
  return defs;
}

function buildMap(): void {
  if (!view || !data) return;
  const svg = svgElement("svg", { class: "ppSvg", role: "group", preserveAspectRatio: "xMidYMid meet" }) as SVGSVGElement;
  const provinceLayer = svgElement("g", { class: "ppProvinces" });
  const provinceLabelLayer = svgElement("g", { class: "ppProvinceLabels" });
  const regionLabelLayer = svgElement("g", { class: "ppRegionLabels" });

  for (const shape of data.map.provinces) {
    const province = data.provinces.get(shape.id);
    if (!province) continue;
    const path = svgElement("path", {
      d: shape.path,
      class: "ppProvince",
      fill: REGION_COLORS[province.region] ?? "#ccc",
      "aria-label": localName(province),
      "data-region": province.region,
    });
    const tooltip = svgElement("title", {});
    tooltip.textContent = localName(province);
    path.appendChild(tooltip);
    path.addEventListener("mouseenter", () => onMapHover(province));
    path.addEventListener("mouseleave", () => onMapHover(null));
    path.addEventListener("click", () => onMapPick(province));
    paths.set(province.id, path);
    provinceLayer.appendChild(path);

    const label = svgElement("text", {
      x: shape.centroid[0].toFixed(1),
      y: shape.centroid[1].toFixed(1),
      class: "ppProvinceLabel hidden",
      "data-region": province.region,
    });
    label.textContent = localName(province);
    provinceLabels.set(province.id, label);
    provinceLabelLayer.appendChild(label);
  }

  for (const region of data.regions) {
    let weight = 0;
    let x = 0;
    let y = 0;
    for (const p of regionMembers(region.id)) {
      weight += p.area;
      x += p.centroid[0] * p.area;
      y += p.centroid[1] * p.area;
    }
    const label = svgElement("text", {
      x: (weight ? x / weight : 0).toFixed(1),
      y: (weight ? y / weight : 0).toFixed(1),
      class: "ppRegionLabel hidden",
    });
    label.textContent = localName(region);
    regionLabels.set(region.id, label);
    regionLabelLayer.appendChild(label);
  }

  svg.append(goldDefinitions(countryBox()), provinceLayer, provinceLabelLayer, regionLabelLayer);
  view.stage.replaceChildren(svg);
  view.svg = svg;
  currentViewBox = frame(countryBox());
  svg.setAttribute("viewBox", currentViewBox.join(" "));
}

interface MapState {
  plain?: boolean;
  focus?: string | null;
  regionNames?: boolean;
  provinceNames?: boolean;
  selected?: string | null;
}

function applyMapState(state: MapState): void {
  if (!view?.svg) return;
  view.svg.classList.toggle("plain", state.plain === true);
  view.svg.dataset.mode = mode;
  for (const [id, path] of paths) {
    const region = path.getAttribute("data-region");
    path.classList.toggle("dim", !!state.focus && region !== state.focus);
    path.classList.toggle("selected", id === state.selected);
    path.classList.remove("hover");
  }
  for (const [id, label] of regionLabels) {
    label.classList.toggle("hidden", !state.regionNames || (!!state.focus && id !== state.focus));
  }
  for (const [id, label] of provinceLabels) {
    label.classList.toggle("hidden", !state.provinceNames || label.getAttribute("data-region") !== state.focus);
    label.classList.toggle("selected", id === state.selected);
  }
}

// The space the map may use: the text covers the left of a wide screen, the tiles the bottom, the card the right.
function insets(): { left: number; right: number; top: number; bottom: number } {
  const width = view?.stage.clientWidth ?? 0;
  const menusHidden = !!view && view.overlay.classList.contains("ppMenusHidden");
  if (menusHidden) return { left: 0, right: 0, top: TOP_BAR_PX, bottom: 60 };
  const rowShown = !!view && !view.row.hidden && !view.row.classList.contains("motionLeave");
  const rowOpen = rowShown && !view!.row.classList.contains("collapsed");
  const cardShown = !!view && !view.panel.hidden && !view.panel.classList.contains("motionLeave");
  const bottom = rowOpen ? TILE_ROW_PX : rowShown ? 110 : 60;
  if (width < WIDE_LAYOUT_PX) return { left: 0, right: 0, top: TOP_BAR_PX, bottom };
  return { left: Math.min(480, width * 0.34), right: cardShown ? CARD_WIDTH_PX + 24 : 0, top: TOP_BAR_PX, bottom };
}

// The viewBox that shows box inside the free part of the stage, with the stage's own aspect ratio.
function frame(box: ViewBox): ViewBox {
  const width = view?.stage.clientWidth || 1;
  const height = view?.stage.clientHeight || 1;
  const { left, right, top, bottom } = insets();
  const usableX = Math.max(0.3, (width - left - right) / width);
  const usableY = Math.max(0.3, (height - top - bottom) / height);
  const aspect = width / height;
  const viewWidth = Math.max(box[2] / usableX, (box[3] / usableY) * aspect);
  const viewHeight = viewWidth / aspect;
  const centreX = (left + (width - left - right) / 2) / width;
  const centreY = (top + (height - top - bottom) / 2) / height;
  return [box[0] + box[2] / 2 - viewWidth * centreX, box[1] + box[3] / 2 - viewHeight * centreY, viewWidth, viewHeight];
}

function scaleLabels(target: ViewBox): void {
  const sizes: Array<[Map<string, SVGElement>, number]> = [[regionLabels, target[3] / 26], [provinceLabels, target[3] / 48]];
  for (const [labels, size] of sizes) {
    for (const label of labels.values()) {
      label.setAttribute("font-size", size.toFixed(2));
      label.setAttribute("stroke-width", (size * 0.2).toFixed(2));
    }
  }
}

// Moves the camera to frame box, smoothly unless the player prefers less motion.
function flyTo(box: ViewBox, instant = false): void {
  const svg = view?.svg;
  if (!svg) return;
  framedBox = box;
  const target = frame(box);
  cancelAnimationFrame(flyFrame);
  scaleLabels(target);
  if (instant || reducedMotion()) {
    currentViewBox = target;
    svg.setAttribute("viewBox", target.join(" "));
    return;
  }
  const from = [...currentViewBox] as ViewBox;
  const started = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - started) / FLY_MS);
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    currentViewBox = from.map((value, i) => value + (target[i] - value) * eased) as ViewBox;
    svg.setAttribute("viewBox", currentViewBox.map((v) => v.toFixed(2)).join(" "));
    if (k < 1) flyFrame = requestAnimationFrame(step);
  };
  flyFrame = requestAnimationFrame(step);
}

window.addEventListener("resize", () => {
  if (framedBox && view && !view.overlay.hidden) flyTo(framedBox, true);
});

function onMapHover(province: Province | null): void {
  if (mode === "intro") return;
  for (const path of paths.values()) {
    const same = province !== null && (mode === "region"
      ? path.getAttribute("data-region") === province.region
      : path === paths.get(province.id));
    path.classList.toggle("hover", same);
  }
}

function onMapPick(province: Province): void {
  if (mode === "region") enterRegion(province.region);
  else if (mode === "province" && province.region === currentRegion) {
    const index = tiles.findIndex((tile) => tile.id === province.id);
    if (index >= 0) {
      focusTile(index);
      openCard(province.id);
    }
  }
}

// --- Tiles ---

function setTiles(title: string, items: Array<{ id: string; name: string; meta: string; color: string }>): void {
  if (!view) return;
  view.rowTitle.textContent = title;
  tiles = items.map((item, index) => {
    const tile = button("ppTile", "", () => selectTile(index));
    tile.setAttribute("role", "option");
    tile.style.setProperty("--tile-color", item.color);
    tile.style.setProperty("--i", String(index));
    tile.append(element("span", "ppTileName", item.name), element("span", "ppTileMeta", item.meta));
    tile.addEventListener("mouseenter", () => focusTile(index));
    tile.addEventListener("focus", () => focusTile(index));
    return { id: item.id, element: tile };
  });
  view.tiles.replaceChildren(...tiles.map((tile) => tile.element));
}

function focusTile(index: number): void {
  if (!view || !data || tiles.length === 0) return;
  const next = Math.max(0, Math.min(tiles.length - 1, index));
  const changed = next !== focusIndex || !tiles[next].element.classList.contains("focused");
  focusIndex = next;
  tiles.forEach((tile, i) => {
    tile.element.classList.toggle("focused", i === next);
    tile.element.setAttribute("aria-selected", String(i === next));
  });
  tiles[next].element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  if (!changed) return;
  audio.play("ui.select");
  if (mode === "region") showRegionHero(tiles[next].id);
  else if (mode === "province") showProvinceHero(tiles[next].id);
}

function selectTile(index: number): void {
  const tile = tiles[index];
  if (!tile) return;
  if (mode === "region") enterRegion(tile.id);
  else if (mode === "province") {
    focusTile(index);
    openCard(tile.id);
  }
}

// --- 1. The story, playing by itself ---

function scenes(): Scene[] {
  return [
    { title: t("intro.thailand.title"), text: t("intro.thailand.text"), plain: true, focus: null },
    { title: t("intro.regions.title"), text: t("intro.regions.text"), reveal: true, focus: null },
    ...(data?.regions ?? []).map((region) => ({
      title: localName(region),
      text: t(`region.${region.id}.desc`),
      extra: traits(region.id),
      focus: region.id,
    })),
  ];
}

const traits = (regionId: string): string =>
  `${t("picker.region_pros")}: ${t(`region.${regionId}.pros`)} · ${t("picker.region_cons")}: ${t(`region.${regionId}.cons`)}`;

function playIntro(from = 0): void {
  if (!view) return;
  mode = "intro";
  markIntroSeen();
  closeCard();
  setChrome({ skip: true, dots: true });
  const list = scenes();
  view.dots.replaceChildren(...list.map(() => element("span")));
  playScene(list, from);
}

function playScene(list: Scene[], index: number): void {
  if (!view || mode !== "intro") return;
  if (index >= list.length) {
    showRegions(true);
    return;
  }
  sceneIndex = index;
  const scene = list[index];
  Array.from(view.dots.children).forEach((dot, i) => dot.classList.toggle("on", i <= index));

  if (scene.reveal) revealRegions();
  applyMapState({ plain: scene.plain, focus: scene.focus, regionNames: !scene.plain && !scene.focus });
  flyTo(scene.focus ? groupViewBox(regionMembers(scene.focus)) : countryBox(), index === 0);
  view.backdrop.setTint(scene.focus ? REGION_COLORS[scene.focus] : GOLD);
  setHero({ title: scene.title, text: scene.text, extra: scene.extra });

  const length = scene.title.length + scene.text.length + (scene.extra?.length ?? 0);
  window.clearTimeout(sceneTimer);
  sceneTimer = window.setTimeout(() => playScene(list, index + 1), Math.max(MIN_SCENE_MS, length * MS_PER_CHARACTER));
}

// The regions take their colours one after another
function revealRegions(): void {
  if (!data) return;
  const order = new Map(data.regions.map((r, i) => [r.id, i]));
  const styled = (path: SVGElement): CSSStyleDeclaration => (path as SVGElement & { style: CSSStyleDeclaration }).style;
  for (const path of paths.values()) {
    styled(path).transitionDelay = `${(order.get(path.getAttribute("data-region") ?? "") ?? 0) * REVEAL_STEP_MS}ms`;
  }
  window.setTimeout(() => {
    for (const path of paths.values()) styled(path).transitionDelay = "";
  }, data.regions.length * REVEAL_STEP_MS + 800);
}

// --- 2. Regions ---

function showRegions(afterIntro: boolean): void {
  if (!view || !data) return;
  window.clearTimeout(sceneTimer);
  const previous = currentRegion;
  mode = "region";
  currentRegion = null;
  selectedProvince = null;
  closeCard();
  setChrome({ row: true });
  setTiles(t("picker.region_title"), data.regions.map((region) => ({
    id: region.id,
    name: localName(region),
    meta: t("picker.region_provinces", { count: regionMembers(region.id).length }),
    color: REGION_COLORS[region.id] ?? "#888",
  })));
  if (afterIntro) {
    // Finish the story on the whole country before the player picks
    applyMapState({ regionNames: true });
    flyTo(countryBox());
    view.backdrop.setTint(GOLD);
    setHero({ title: t("intro.final.title"), text: t("intro.final.text"), hint: t("picker.region_hint") });
    focusIndex = -1;
    tiles.forEach((tile) => tile.element.classList.remove("focused"));
    return;
  }
  const start = previous ? Math.max(0, tiles.findIndex((tile) => tile.id === previous)) : 0;
  focusIndex = -1;
  focusTile(start);
}

function showRegionHero(regionId: string): void {
  if (!view || !data) return;
  const region = data.regions.find((r) => r.id === regionId);
  if (!region) return;
  applyMapState({ focus: regionId, regionNames: true });
  flyTo(groupViewBox(regionMembers(regionId)));
  view.backdrop.setTint(REGION_COLORS[regionId] ?? GOLD);
  setHero({
    title: localName(region),
    sub: `${otherName(region)} · ${t("picker.region_provinces", { count: regionMembers(regionId).length })}`,
    text: t(`region.${regionId}.desc`),
    extra: traits(regionId),
    hint: t("picker.region_enter"),
  });
}

// --- 3. One region's provinces ---

function enterRegion(regionId: string, focusProvince: string | null = null): void {
  if (!view || !data) return;
  const region = data.regions.find((r) => r.id === regionId);
  if (!region) return;
  window.clearTimeout(sceneTimer);
  mode = "province";
  currentRegion = regionId;
  closeCard();
  setChrome({ back: true, row: true });
  applyMapState({ focus: regionId, provinceNames: true });
  flyTo(groupViewBox(regionMembers(regionId)));
  view.backdrop.setTint(REGION_COLORS[regionId] ?? GOLD);

  const provinces = [...data.provinces.values()].filter((p) => p.region === regionId)
    .sort((a, b) => localName(a).localeCompare(localName(b), getLanguage()));
  setTiles(t("picker.provinces_of", { region: localName(region) }), provinces.map((province) => ({
    id: province.id,
    name: localName(province),
    meta: "",
    color: REGION_COLORS[regionId] ?? "#888",
  })));
  // Fill in each tile's treasury and terrain as the maps arrive, one at a time
  const tileList = tiles;
  void tileList.reduce((chain, tile) => chain.then(() => loadPreset(tile.id).then((map) => {
    const meta = tile.element.querySelector(".ppTileMeta");
    if (meta) meta.textContent = `${money(startingFunds(map.stats))} · ${stars(difficultyStars(map.stats))}`;
  }).catch(() => undefined)), Promise.resolve());

  focusIndex = -1;
  const index = focusProvince ? tiles.findIndex((tile) => tile.id === focusProvince) : 0;
  focusTile(Math.max(0, index));
  if (focusProvince) openCard(focusProvince);
}

function showProvinceHero(provinceId: string): void {
  if (!view || !data) return;
  const province = data.provinces.get(provinceId);
  if (!province) return;
  selectedProvince = provinceId;
  applyMapState({ focus: province.region, provinceNames: true, selected: provinceId });
  const region = data.regions.find((r) => r.id === province.region);
  const body = element("div", "ppStats", t("picker.loading"));
  setHero({
    title: localName(province),
    sub: `${otherName(province)} · ${region ? localName(region) : ""}`,
    body,
    hint: t("picker.province_enter"),
  });
  const token = ++heroToken;
  loadPreset(provinceId).then((map) => {
    if (token !== heroToken) return; // The player has already moved on
    const bonus = Math.round(fundsBonus(map.stats) * 100);
    const funds = element("div", "ppFunds");
    funds.append(element("span", undefined, t("picker.funds")), element("strong", undefined, money(startingFunds(map.stats))));
    if (bonus > 0) funds.appendChild(element("small", undefined, t("picker.funds_bonus", { pct: bonus })));
    const terrainStars = difficultyStars(map.stats);
    const terrain = element("div", "ppTerrain");
    terrain.append(
      element("span", undefined, t("picker.difficulty")),
      element("strong", "ppStars", stars(terrainStars)),
      element("small", undefined, t(`picker.difficulty.${terrainStars}`)),
    );
    const chips = element("div", "ppChips");
    for (const resource of provinceResources(province.tags ?? [], map.stats)) {
      chips.appendChild(element("span", "ppChip", t(resource.key, resource.pct === undefined ? undefined : { pct: resource.pct })));
    }
    body.replaceChildren(funds, terrain, chips);
  }).catch(() => {
    if (token === heroToken) body.textContent = t("picker.no_preview");
  });
}

// --- The card that starts a city ---

function closeCard(): void {
  if (!view || view.panel.hidden || view.panel.classList.contains("motionLeave")) return;
  hide(view.panel, true);
  if (framedBox) flyTo(framedBox);
}

// Hides every menu, card and text so only the bamboo and the map remain; the toggle itself stays.
function setMenusHidden(hidden: boolean): void {
  if (!view) return;
  view.overlay.classList.toggle("ppMenusHidden", hidden);
  view.menus.textContent = t(hidden ? "ui.show_menus" : "ui.hide_menus");
  if (framedBox) flyTo(framedBox);
}

function openCard(provinceId: string): void {
  if (!view || !data) return;
  const province = data.provinces.get(provinceId);
  if (!province) return;

  const card = element("div", "ppCard");
  card.append(element("h3", undefined, localName(province)));
  const preview = element("div", "ppPreview");
  card.appendChild(preview);

  const nameLabel = element("label", "ppField");
  const nameInput = element("input", "ppName");
  nameInput.type = "text";
  nameInput.maxLength = MAX_CITY_NAME_LENGTH;
  nameInput.value = localName(province).slice(0, MAX_CITY_NAME_LENGTH);
  nameLabel.append(element("span", undefined, t("start.label.name")), nameInput);

  const levels = element("div", "ppLevels");
  levels.setAttribute("role", "radiogroup");
  levels.setAttribute("aria-label", t("start.label.difficulty"));
  for (const [level, key] of LEVELS) {
    const option = element("label", "ppLevel");
    const radio = element("input");
    radio.type = "radio";
    radio.name = "ppLevel";
    radio.value = String(level);
    radio.checked = level === 0;
    option.append(radio, element("span", undefined, t(key)));
    levels.appendChild(option);
  }

  const start = button("ppStart", t("picker.start"), () => {
    const name = nameInput.value.trim() || localName(province);
    const level = Number((levels.querySelector("input:checked") as HTMLInputElement | null)?.value ?? 0);
    leaveTo(() => actions?.start(province.id, name.slice(0, MAX_CITY_NAME_LENGTH), level));
  });
  nameInput.addEventListener("keydown", (event) => {
    event.stopPropagation(); // typing must not move the tiles
    if (event.key === "Enter") start.click();
  });

  const neighbors = element("div", "ppNeighbors");
  for (const id of province.neighbors) {
    const neighbor = data.provinces.get(id);
    if (!neighbor) continue;
    neighbors.appendChild(button("ppChipButton", localName(neighbor), () => {
      if (neighbor.region === currentRegion) {
        focusTile(tiles.findIndex((tile) => tile.id === id));
        openCard(id);
      } else {
        enterRegion(neighbor.region, id);
      }
    }));
  }

  card.append(nameLabel, element("h4", undefined, t("start.label.difficulty")), levels, start,
    element("h4", undefined, t("picker.neighbors")), neighbors);
  view.panel.replaceChildren(card);
  if (view.panel.hidden) show(view.panel);
  flyTo(groupViewBox(regionMembers(province.region))); // make room for the card
  nameInput.focus({ preventScroll: true });
  nameInput.select();

  loadPreset(province.id).then((map) => {
    const canvas = element("canvas");
    drawPresetMap(canvas, map, PREVIEW_PIXELS_PER_TILE);
    preview.replaceChildren(canvas, element("p", "ppSmall", t("picker.preview")));
  }).catch(() => {
    preview.textContent = t("picker.no_preview");
  });
}

// --- Keys and language ---

function onKeyDown(event: KeyboardEvent): void {
  if (!view || view.overlay.hidden) return;
  if (event.key === "h" || event.key === "H") {
    setMenusHidden(!view.overlay.classList.contains("ppMenusHidden"));
    return;
  }
  if (mode === "intro") {
    if (event.key === "Escape" || event.key === "Enter") showRegions(true);
    return;
  }
  switch (event.key) {
    case "ArrowRight":
      focusTile(focusIndex < 0 ? 0 : focusIndex + 1);
      break;
    case "ArrowLeft":
      focusTile(focusIndex < 0 ? 0 : focusIndex - 1);
      break;
    case "Enter":
      if (focusIndex >= 0) selectTile(focusIndex);
      break;
    case "Escape":
    case "Backspace":
      if (!view.panel.hidden) closeCard();
      else if (mode === "province") showRegions(false);
      break;
    default:
      return;
  }
  event.preventDefault();
}

// The view is built in the current language: rebuild it after a switch and carry on where the player was.
onLanguageChange(() => {
  if (!view) return;
  const wasOpen = !view.overlay.hidden;
  const cardOpen = !view.panel.hidden;
  destroyShell();
  if (!wasOpen || !data) return;
  view = buildShell();
  buildMap();
  if (mode === "intro") playIntro(sceneIndex);
  else if (mode === "province" && currentRegion) enterRegion(currentRegion, cardOpen ? selectedProvince : null);
  else showRegions(false);
});

audio.onChange(() => renderSound());

export function openStartScreen(startActions: StartActions, options: StartOptions = {}): void {
  actions = startActions;
  document.removeEventListener("keydown", onKeyDown);
  document.addEventListener("keydown", onKeyDown);
  view ??= buildShell();
  show(view.overlay);

  loadData().then((loaded) => {
    data = loaded;
    if (!view) return;
    if (!view.svg) buildMap();
    const requested = options.provinceId ? data.provinces.get(options.provinceId) : undefined;
    if (requested) enterRegion(requested.region, requested.id);
    else if (options.intro) playIntro();
    else showRegions(false);
  }).catch(() => {
    if (view) view.stage.textContent = t("picker.load_failed");
  });
}
