/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The start of the game (docs/ONLINE_PLAN.md phase 1): one dark, full-screen, cinematic map of Thailand
// built from real province shapes.
//   1. intro: a story about Thailand and its six regions that plays by itself (first launch, replayable)
//   2. region: the player clicks the region to live in, and the camera flies into it
//   3. province: clicking a province opens its card (treasury, terrain, resources, starting map, city name
//      and game difficulty), which starts the city.
// Small buttons at the top continue the saved city or start a practice game on a random map.

import { audio } from "./audio/index";
import { groupViewBox, NationalMap, projectNationalMap, ProjectedProvince } from "./geo/nationalMap";
import { drawPresetMap, PresetMap } from "./geo/presetMap";
import { difficultyStars, fundsBonus, provinceResources, startingFunds } from "./geo/provinceProfile";
import { getLanguage, onLanguageChange, setLanguage, t } from "./i18n/index";
import { hide, show } from "./motion";

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
  /** Open straight on this province's card (index.html?province=TH-xx). */
  provinceId?: string | null;
}

type ViewBox = [number, number, number, number];
type Mode = "intro" | "region" | "province";

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "provincePicker";
const INTRO_SEEN_KEY = "phaicity.introSeen";
const PREVIEW_PIXELS_PER_TILE = 1;
const FLY_MS = 1400;
const CAPTION_LEAVE_MS = 350;
const MIN_SCENE_MS = 4200;
const MS_PER_CHARACTER = 45;
const REVEAL_STEP_MS = 280;
const MAX_CITY_NAME_LENGTH = 15;
const WIDE_LAYOUT_PX = 900;
const CARD_WIDTH_PX = 400;

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
  stage: HTMLElement;
  caption: HTMLElement;
  dots: HTMLElement;
  panel: HTMLElement;
  back: HTMLButtonElement;
  skip: HTMLButtonElement;
  replay: HTMLButtonElement;
  sound: HTMLButtonElement;
  svg?: SVGSVGElement;
}

let view: View | null = null;
let dataPromise: Promise<PickerData> | null = null;
let data: PickerData | null = null;
let actions: StartActions | null = null;
let mode: Mode = "region";
let currentRegion: string | null = null;
let selectedProvince: string | null = null;
let sceneIndex = 0;
let sceneTimer = 0;
let framedBox: ViewBox | null = null;
let currentViewBox: ViewBox = [0, 0, 1, 1];
let flyFrame = 0;
let cardToken = 0;
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

  const stage = element("div", "ppStage", t("picker.loading"));

  const top = element("div", "ppTop");
  const back = button("ppBack", t("picker.back_regions"), () => showRegions(false));
  const skip = button("ppSkip", `${t("intro.skip")} ›`, () => showRegions(true));
  const replay = button("ppQuiet", t("splash.replay_intro"), () => playIntro());
  const sound = button("ppQuiet ppSound", "", () => {
    audio.unlock();
    audio.setMuted(!audio.settings.muted);
  });
  const language = button("ppQuiet", t("lang.switch_to"), () => setLanguage(getLanguage() === "th" ? "en" : "th"));
  const left = element("div", "ppTopLeft");
  left.append(element("span", "ppBrand", "PhaiCity"), back);
  const right = element("div", "ppTopRight");
  const saved = actions?.saved;
  if (saved) {
    right.appendChild(button("ppQuiet ppContinue", t("splash.btn.continue", { city: saved.name }), () => leaveTo(() => actions?.continueSaved())));
  }
  right.append(button("ppQuiet", t("start.practice"), () => leaveTo(() => actions?.practice())), replay, sound, language, skip);
  top.append(left, right);

  const caption = element("div", "ppCaption");
  caption.setAttribute("aria-live", "polite");
  const dots = element("div", "ppDots");
  const panel = element("aside", "ppPanel");
  panel.hidden = true;

  // The required credits, small, at the bottom: copies of the game footer's lines
  const credits = element("div", "ppCredits");
  for (const selector of ["#author > span", "#footer .nameLicense", "#footer .mapCredit"]) {
    const line = document.querySelector(selector);
    if (line) credits.appendChild(line.cloneNode(true));
  }

  overlay.append(stage, top, caption, dots, panel, credits);
  document.body.appendChild(overlay);

  const view: View = { overlay, stage, caption, dots, panel, back, skip, replay, sound };
  renderSound(view);
  return view;
}

function renderSound(target: View | null = view): void {
  if (!target) return;
  target.sound.textContent = audio.settings.muted ? "🔇" : "🔊";
  target.sound.title = t(audio.settings.muted ? "sound.toggle_on" : "sound.toggle_off");
}

function setChrome(options: { back?: boolean; skip?: boolean; dots?: boolean }): void {
  if (!view) return;
  view.back.hidden = !options.back;
  view.skip.hidden = !options.skip;
  view.replay.hidden = !!options.skip;
  view.dots.hidden = !options.dots;
}

interface CaptionContent {
  title: string;
  text?: string;
  extra?: string;
  hint?: string;
}

// Each caption fades and slides in; the previous one drifts out.
function setCaption(content: CaptionContent): void {
  if (!view) return;
  for (const old of Array.from(view.caption.children)) {
    old.classList.add("leaving");
    window.setTimeout(() => old.remove(), CAPTION_LEAVE_MS);
  }
  const inner = element("div", "ppCaptionInner");
  inner.appendChild(element("h2", undefined, content.title));
  if (content.text) inner.appendChild(element("p", "ppCaptionText", content.text));
  if (content.extra) inner.appendChild(element("p", "ppCaptionExtra", content.extra));
  if (content.hint !== undefined) inner.appendChild(element("p", "ppCaptionHint", content.hint));
  view.caption.appendChild(inner);
}

function setCaptionHint(text: string): void {
  const hint = view?.caption.querySelector(".ppCaptionInner:not(.leaving) .ppCaptionHint");
  if (hint) hint.textContent = text;
}

function leaveTo(next: () => void): void {
  window.clearTimeout(sceneTimer);
  if (view) hide(view.overlay, true);
  next();
}

// --- Map and camera ---

function regionMembers(regionId: string): ProjectedProvince[] {
  return data ? data.map.provinces.filter((p) => data!.provinces.get(p.id)?.region === regionId) : [];
}

function countryBox(): ViewBox {
  return data ? groupViewBox(data.map.provinces, 0.03) : [0, 0, 1, 1];
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
      tabindex: "0",
      role: "button",
      "aria-label": localName(province),
      "data-region": province.region,
    });
    const tooltip = svgElement("title", {});
    tooltip.textContent = localName(province);
    path.appendChild(tooltip);
    path.addEventListener("mouseenter", () => onHover(province));
    path.addEventListener("mouseleave", () => onHover(null));
    path.addEventListener("click", () => onPick(province));
    path.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        onPick(province);
      }
    });
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
    const members = regionMembers(region.id);
    let weight = 0;
    let x = 0;
    let y = 0;
    for (const p of members) {
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

// The opening scene shows Thailand as the Golden Peninsula (แหลมทอง): one gold gradient across the whole
// country, so province borders don't break it, with a highlight that sweeps slowly across.
function goldDefinitions(box: ViewBox): SVGElement {
  const defs = svgElement("defs", {});
  const gradient = svgElement("linearGradient", {
    id: "ppGold",
    gradientUnits: "userSpaceOnUse",
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
  gradient.setAttribute("spreadMethod", "reflect");
  defs.appendChild(gradient);
  return defs;
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
  for (const label of regionLabels.values()) label.classList.toggle("hidden", !state.regionNames);
  for (const [id, label] of provinceLabels) {
    label.classList.toggle("hidden", !state.provinceNames || label.getAttribute("data-region") !== state.focus);
    label.classList.toggle("selected", id === state.selected);
  }
}

// The space the map may use: the caption covers the left of a wide screen, the card the right.
function insets(): { left: number; right: number } {
  const width = view?.stage.clientWidth ?? 0;
  if (width < WIDE_LAYOUT_PX) return { left: 0, right: 0 };
  return {
    left: Math.min(480, width * 0.34),
    right: view && !view.panel.hidden && !view.panel.classList.contains("motionLeave") ? CARD_WIDTH_PX + 24 : 0,
  };
}

// The viewBox that shows box inside the free part of the stage, with the stage's own aspect ratio.
function frame(box: ViewBox): ViewBox {
  const width = view?.stage.clientWidth || 1;
  const height = view?.stage.clientHeight || 1;
  const { left, right } = insets();
  const usable = Math.max(0.3, (width - left - right) / width);
  const aspect = width / height;
  const viewWidth = Math.max(box[2] / usable, box[3] * aspect);
  const viewHeight = viewWidth / aspect;
  const centre = (left + (width - left - right) / 2) / width;
  return [box[0] + box[2] / 2 - viewWidth * centre, box[1] + box[3] / 2 - viewHeight / 2, viewWidth, viewHeight];
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

function onHover(province: Province | null): void {
  if (!data || mode === "intro") return;
  if (mode === "region") {
    for (const path of paths.values()) {
      path.classList.toggle("hover", province !== null && path.getAttribute("data-region") === province.region);
    }
    const region = province ? data.regions.find((r) => r.id === province.region) : null;
    setCaptionHint(region ? `${localName(region)} · ${t("picker.region_provinces", { count: regionMembers(region.id).length })}` : "");
  } else if (province?.region === currentRegion) {
    setCaptionHint(localName(province));
  }
}

function onPick(province: Province): void {
  if (mode === "region") flyIntoRegion(province.region);
  else if (mode === "province" && province.region === currentRegion) showProvinceCard(province.id);
}

// --- 1. The story, playing by itself ---

function scenes(): Scene[] {
  return [
    { title: t("intro.thailand.title"), text: t("intro.thailand.text"), plain: true, focus: null },
    { title: t("intro.regions.title"), text: t("intro.regions.text"), reveal: true, focus: null },
    ...(data?.regions ?? []).map((region) => ({
      title: localName(region),
      text: t(`region.${region.id}.desc`),
      extra: `${t("picker.region_pros")}: ${t(`region.${region.id}.pros`)} · ${t("picker.region_cons")}: ${t(`region.${region.id}.cons`)}`,
      focus: region.id,
    })),
  ];
}

function playIntro(from = 0): void {
  if (!view) return;
  mode = "intro";
  markIntroSeen();
  hidePanel();
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
  setCaption({ title: scene.title, text: scene.text, extra: scene.extra });

  const length = scene.title.length + scene.text.length + (scene.extra?.length ?? 0);
  window.clearTimeout(sceneTimer);
  sceneTimer = window.setTimeout(() => playScene(list, index + 1), Math.max(MIN_SCENE_MS, length * MS_PER_CHARACTER));
}

// The regions take their colours one after another
function revealRegions(): void {
  if (!data) return;
  const order = new Map(data.regions.map((r, i) => [r.id, i]));
  for (const path of paths.values()) {
    (path as SVGElement & { style: CSSStyleDeclaration }).style.transitionDelay =
      `${(order.get(path.getAttribute("data-region") ?? "") ?? 0) * REVEAL_STEP_MS}ms`;
  }
  window.setTimeout(() => {
    for (const path of paths.values()) (path as SVGElement & { style: CSSStyleDeclaration }).style.transitionDelay = "";
  }, data.regions.length * REVEAL_STEP_MS + 800);
}

// --- 2. Choosing a region ---

function showRegions(afterIntro: boolean): void {
  if (!view || !data) return;
  window.clearTimeout(sceneTimer);
  mode = "region";
  currentRegion = null;
  selectedProvince = null;
  hidePanel();
  setChrome({});
  applyMapState({ regionNames: true });
  flyTo(countryBox());
  setCaption(afterIntro
    ? { title: t("intro.final.title"), text: t("intro.final.text"), hint: "" }
    : { title: t("picker.region_title"), text: t("picker.region_hint"), hint: "" });
}

// --- 3. One region, then a province ---

function flyIntoRegion(regionId: string, selected: string | null = null): void {
  if (!view || !data) return;
  const region = data.regions.find((r) => r.id === regionId);
  if (!region) return;
  window.clearTimeout(sceneTimer);
  mode = "province";
  currentRegion = regionId;
  selectedProvince = null;
  if (!selected) hidePanel();
  setChrome({ back: true });
  applyMapState({ focus: regionId, provinceNames: true });
  flyTo(groupViewBox(regionMembers(regionId)));
  setCaption({
    title: localName(region),
    text: t(`region.${regionId}.desc`),
    extra: `${t("picker.region_pros")}: ${t(`region.${regionId}.pros`)} · ${t("picker.region_cons")}: ${t(`region.${regionId}.cons`)}`,
    hint: t("picker.province_pick"),
  });
  if (selected) showProvinceCard(selected);
}

function hidePanel(): void {
  if (view && !view.panel.hidden) hide(view.panel, true);
}

function showProvinceCard(provinceId: string): void {
  if (!view || !data) return;
  const province = data.provinces.get(provinceId);
  if (!province) return;
  if (province.region !== currentRegion) {
    flyIntoRegion(province.region, provinceId);
    return;
  }
  selectedProvince = provinceId;
  applyMapState({ focus: province.region, provinceNames: true, selected: provinceId });
  const region = data.regions.find((r) => r.id === province.region);
  const token = ++cardToken;

  const card = element("div", "ppCard");
  card.append(
    element("h3", undefined, localName(province)),
    element("p", "ppSub", `${otherName(province)} · ${region ? localName(region) : ""}`),
  );
  const profile = element("div", "ppProfile", t("picker.loading"));
  const preview = element("div", "ppPreview");
  card.append(profile, preview);

  card.appendChild(element("h4", undefined, t("picker.neighbors")));
  const neighbors = element("div", "ppNeighbors");
  for (const id of province.neighbors) {
    const neighbor = data.provinces.get(id);
    if (neighbor) neighbors.appendChild(button("ppChipButton", localName(neighbor), () => showProvinceCard(id)));
  }
  card.appendChild(neighbors);

  // The city: its name and how hard the game is
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
    if (event.key === "Enter") start.click();
  });
  card.append(element("h4", undefined, t("start.label.difficulty")), levels, nameLabel, start);

  view.panel.replaceChildren(card);
  if (view.panel.hidden) show(view.panel);
  flyTo(groupViewBox(regionMembers(province.region))); // make room for the card
  setCaptionHint(localName(province));

  loadPreset(province.id).then((map) => {
    if (token !== cardToken) return; // The player has already picked another province
    const stars = difficultyStars(map.stats);
    const bonus = Math.round(fundsBonus(map.stats) * 100);
    const funds = element("div", "ppFunds");
    funds.append(element("span", undefined, t("picker.funds")), element("strong", undefined, money(startingFunds(map.stats))));
    if (bonus > 0) funds.appendChild(element("small", undefined, t("picker.funds_bonus", { pct: bonus })));
    const terrain = element("div", "ppTerrain");
    terrain.append(
      element("span", undefined, t("picker.difficulty")),
      element("strong", "ppStars", "★".repeat(stars) + "☆".repeat(3 - stars)),
      element("small", undefined, t(`picker.difficulty.${stars}`)),
    );
    const chips = element("div", "ppChips");
    for (const resource of provinceResources(province.tags ?? [], map.stats)) {
      chips.appendChild(element("span", "ppChip", t(resource.key, resource.pct === undefined ? undefined : { pct: resource.pct })));
    }
    profile.replaceChildren(funds, terrain, chips);
    const canvas = element("canvas");
    drawPresetMap(canvas, map, PREVIEW_PIXELS_PER_TILE);
    preview.replaceChildren(canvas);
  }).catch(() => {
    if (token !== cardToken) return;
    profile.textContent = t("picker.no_preview");
  });
}

// --- Entry point ---

function onKeyDown(event: KeyboardEvent): void {
  if (!view || view.overlay.hidden || event.key !== "Escape") return;
  if (mode === "intro") showRegions(true);
  else if (mode === "province") showRegions(false);
}

// The view is built in the current language: rebuild it after a switch and carry on where the player was.
onLanguageChange(() => {
  if (!view) return;
  const wasOpen = !view.overlay.hidden;
  window.clearTimeout(sceneTimer);
  view.overlay.remove();
  view = null;
  paths.clear();
  regionLabels.clear();
  provinceLabels.clear();
  if (!wasOpen || !data) return;
  view = buildShell();
  buildMap();
  if (mode === "intro") playIntro(sceneIndex);
  else if (mode === "province" && currentRegion) flyIntoRegion(currentRegion, selectedProvince);
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
    if (requested) flyIntoRegion(requested.region, requested.id);
    else if (options.intro) playIntro();
    else showRegions(false);
  }).catch(() => {
    if (view) view.stage.textContent = t("picker.load_failed");
  });
}
