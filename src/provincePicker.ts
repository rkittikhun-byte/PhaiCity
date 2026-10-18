/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The start of the game (docs/ONLINE_PLAN.md phase 1), styled like a game console's home screen:
// a swaying bamboo grove behind a glowing map of Thailand built from real province shapes, big text on
// the left, and a row of large tiles at the bottom that the mouse or the arrow keys move through.
//   1. intro: a story about Thailand and its six regions that plays by itself each time the game opens
//   2. region: one tile per region; the camera flies to the focused region
//   3. province: one tile per province of that region; choosing one slides in a card with the city name,
//      game difficulty and a start button.
// Small buttons at the top continue the saved city or start a practice game on a random map.

import { audio, music, renderSoundButton, soundWaiting, wireSoundControl } from "./audio/index";
import { tuckable } from "./creditLine";
import { THEME } from "./audio/music";
import type { CityMeta } from "./cityStorage";
import { groupViewBox, NationalMap, projectBox, projectNationalMap, ProjectedProvince, projectPoint } from "./geo/nationalMap";
import { drawPresetMap, PRESET_COLORS, PresetMap, TRANSPORT_COLORS } from "./geo/presetMap";
import { difficultyStars, fundsBonus, provinceResources, resourceNotes, startingFunds } from "./geo/provinceProfile";
import { hasTransport, provinceTransport, waterwayName } from "./geo/provinceTransport";
import { formatYear, getLanguage, onLanguageChange, setLanguage, t } from "./i18n/index";
import { renderLanguageButton } from "./languageFlag";
import { setLoadingProgress } from "./loadingProgress";
import { hide, show } from "./motion";
import { checkRulesData, resolveRules, ruleEffects, type RulesData } from "./provinceRules";
import {
  checkProfilesData, type Indicators, type Levels, MADE_UP, MAX_LEVEL, measuredLevels, provinceLevels, type ProfilesData,
  type ResourceId,
} from "./geo/provinceResources";
import { keepHigherRank, rankForPopulation } from "./rulerRank";
import { mountStartBackdrop, StartBackdrop } from "./startBackdrop";
import { fadeCurtain, setCurtainDark } from "./curtain";

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
  /** How each region and province plays (src/provinceRules.ts); null when the file could not be read. */
  rules: RulesData | null;
  /** Each province's resources (src/geo/provinceResources.ts); null when the files could not be read. */
  resources: { indicators: Record<string, Indicators>; measured: Record<string, Levels>; profiles: ProfilesData } | null;
  /** The districts a city can start in, by province (data/maps/district/index.json); null when none have maps yet. */
  districts: Record<string, District[]> | null;
}

/** A district with a city map of its own (npm run geo:city -- --districts; owner 13 Oct 2026, Khon Kaen first) */
interface District {
  id: string;
  nameTh: string;
  nameEn: string;
  areaKm2: number;
  /** The town its city map centres on */
  town?: { lat: number; lon: number };
  /** A light outline (GeoJSON Polygon or MultiPolygon, longitude/latitude) for the province's map */
  outline?: { type: string; coordinates: unknown };
}

/** Chooses a district in the open card, from its outline on the map; null while no card offers districts. */
let chooseDistrict: ((id: string) => void) | null = null;

/** Marks the chosen district's outline on the province's map. */
function markDistrict(id: string): void {
  view?.svg?.querySelectorAll<SVGElement>(".ppDistrictShape").forEach((shape) => {
    shape.classList.toggle("chosen", shape.dataset.id === id);
  });
}

/** An SVG path of a GeoJSON Polygon or MultiPolygon, in the map's projection. */
function outlinePath(outline: { type: string; coordinates: unknown }): string {
  const polygons = (outline.type === "MultiPolygon" ? outline.coordinates : [outline.coordinates]) as number[][][][];
  return polygons.flatMap((rings) => rings.map((ring) => `M${ring.map(([lon, lat]) => {
    const [x, y] = projectPoint(lon, lat);
    return `${x.toFixed(3)},${y.toFixed(3)}`;
  }).join("L")}Z`)).join(" ");
}

interface Scene {
  title: string;
  text: string;
  extra?: string;
  plain?: boolean;
  reveal?: boolean;
  focus: string | null;
}

export interface StartActions {
  /** Saved cities, most recent first (src/cityStorage.ts) */
  cities: CityMeta[];
  /** difficulty is a Simulation level: 0 easy, 1 medium, 2 hard; districtId, the district whose town it stands in */
  start(provinceId: string, cityName: string, difficulty: number, districtId?: string): void;
  continueCity(id: string): void;
  deleteCity(id: string): void;
  practice(): void;
}

export interface StartOptions {
  /** Play the story first. */
  intro?: boolean;
  /** Open straight on this province (index.html?province=TH-xx). */
  provinceId?: string | null;
  /** The title page in front (src/titleGate.ts): the story waits until the player has entered. */
  gate?: Promise<void> | null;
}

type ViewBox = [number, number, number, number];
type Mode = "intro" | "region" | "province" | "cities";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

interface Tile {
  id: string;
  element: HTMLButtonElement;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "provincePicker";
const TERRAIN_PIXELS_PER_TILE = 3;
const FLY_MS = 1400;
const HERO_LEAVE_MS = 350;
// Typing pace: a beat at each space between phrases, a longer one after ":" and "·", a breath between lines
const TYPE_MS = 48;
const TYPE_SPACE_MS = 160;
const TYPE_MARK_MS = 380;
const TYPE_START_MS = 450;
const TYPE_LINE_PAUSE_MS = 650;
// After the typing, time to read before the next scene
const READ_AFTER_TYPING_MS = 2600;
const MIN_SCENE_MS = 4500;
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
  /** Shows the credits again for a while. */
  showCredits: () => void;
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
let terrainToken = 0;
const paths = new Map<string, SVGElement>();
const regionLabels = new Map<string, SVGElement>();
const provinceLabels = new Map<string, SVGElement>();
// Each province label's shape bounds, to hide names that don't fit at the current zoom
const labelBounds = new Map<SVGElement, [number, number, number, number]>();
// Dragging the map: where the drag started, and whether it has moved far enough to count as a drag
let drag: { x: number; y: number; box: ViewBox; moved: boolean } | null = null;
let suppressClick = false;
const presets = new Map<string, Promise<PresetMap>>();


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
  // The rest of the loading line: the province list, then the province shapes (0.7 to 0.95)
  const track = <T>(promise: Promise<T>, share: number): Promise<T> => promise.then((value) => {
    setLoadingProgress(Math.max(0.7, 0.7 + share));
    return value;
  });
  dataPromise ??= Promise.all([
    track(fetchJson<{ regions: Region[]; provinces: Province[] }>("data/thailand-provinces.json"), 0.08),
    track(fetchJson<unknown>("data/geo/thailand-provinces.topo.json"), 0.25),
    // The cards can do without the rules, so a missing file only leaves them out
    fetchJson<unknown>("data/province-rules.json").then((raw) => checkRulesData(raw).data, () => null),
    // ... and without the resources
    Promise.all([
      fetchJson<{ provinces: Record<string, Indicators> }>("data/geo/province-indicators.json"),
      fetchJson<unknown>("data/province-profiles.json"),
    ]).then(([indicators, profiles]) => ({ indicators: indicators.provinces, measured: measuredLevels(indicators.provinces),
      profiles: checkProfilesData(profiles).data }), () => null),
    // ... and without the districts, where none have maps
    fetchJson<Record<string, District[]>>("data/maps/district/index.json").catch(() => null),
  ]).then(([json, topology, rules, resources, districts]) => ({
    regions: json.regions,
    provinces: new Map(json.provinces.map((p) => [p.id, p])),
    map: projectNationalMap(topology),
    rules,
    resources,
    districts,
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
  // While the map loads: the same thin gold line as the loading screen, and the words for screen readers
  const stage = element("div", "ppStage");
  stage.setAttribute("aria-label", t("picker.loading"));
  stage.appendChild(element("span", "loadingBar"));
  const vignette = element("div", "ppVignette");

  const top = element("div", "ppTop");
  const back = button("ppBack", t("picker.back_regions"), () => showRegions(false));
  const skip = button("ppSkip", `${t("intro.skip")} ›`, () => showRegions(true));
  const replay = button("ppQuiet", t("splash.replay_intro"), () => playIntro());
  // The speaker and its volume, as in the game: a click slides the volume out, the next one mutes (src/audio/index.ts)
  const soundControl = element("div", "ppSoundControl");
  const sound = element("button", "ppQuiet ppSound");
  sound.type = "button";
  const volume = element("input", "ppVolume");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.step = "5";
  volume.setAttribute("aria-label", t("sound.volume"));
  soundControl.append(sound, volume);
  wireSoundControl(soundControl, sound, volume, (closed) => {
    renderSoundButton(sound, closed);
    // Until the first click the sound waits, so the button says how to start it
    if (soundWaiting()) sound.append(element("span", "ppSoundHint", t("sound.waiting_short")));
  });
  // The flag of the language a click switches to (src/languageFlag.ts); the bar is rebuilt after a switch
  const language = button("ppQuiet ppLang", "", () => setLanguage(getLanguage() === "th" ? "en" : "th"));
  renderLanguageButton(language);
  const menus = button("ppQuiet ppMenus", t("ui.hide_menus"), () => setMenusHidden(!overlay.classList.contains("ppMenusHidden")));
  const clock = element("span", "ppClock");
  const left = element("div", "ppTopLeft");
  // Hide menus, the sound and the language sit on the left, by the name (owner, 12 Oct 2026)
  left.append(element("span", "ppBrand", "PhaiCity"), menus, soundControl, language, back);
  const right = element("div", "ppTopRight");
  const cityCount = actions?.cities.length ?? 0;
  if (cityCount > 0) right.appendChild(button("ppQuiet ppContinue", t("cities.button", { count: cityCount }), () => showCities()));
  right.append(button("ppQuiet", t("start.practice"), () => leaveTo(() => actions?.practice())), replay, skip, clock);
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
  // More tiles than fit: the wheel scrolls sideways, arrow buttons appear at the ends, the edges fade
  const scrollPage = (direction: number): void =>
    tileList.scrollBy({ left: direction * tileList.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  // Drawn chevrons, so they sit in the middle of their circles whatever the font (owner, 12 Oct 2026)
  const chevron = (path: string): string => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" ' +
    `stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  const previous = button("ppRowScroll ppRowPrev", "", () => scrollPage(-1));
  previous.innerHTML = chevron("M14.5 5.5L8 12l6.5 6.5");
  previous.setAttribute("aria-label", t("picker.scroll_back"));
  const next = button("ppRowScroll ppRowNext", "", () => scrollPage(1));
  next.innerHTML = chevron("M9.5 5.5L16 12l-6.5 6.5");
  next.setAttribute("aria-label", t("picker.scroll_on"));
  const updateEnds = (): void => {
    row.classList.toggle("canLeft", tileList.scrollLeft > 4);
    row.classList.toggle("canRight", tileList.scrollLeft + tileList.clientWidth < tileList.scrollWidth - 4);
  };
  tileList.addEventListener("scroll", updateEnds);
  window.addEventListener("resize", updateEnds);
  tileList.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    tileList.scrollBy({ left: event.deltaY * 1.5 });
  }, { passive: false });
  const track = element("div", "ppTrack");
  track.append(previous, tileList, next);
  row.append(rowTitle, track);
  // No zoom buttons (owner, 12 Oct 2026): the wheel zooms and a drag moves the map
  const dots = element("div", "ppDots");
  const panel = element("aside", "ppPanel");
  panel.hidden = true;

  // The required credits, small, at the bottom: copies of the game footer's lines
  const credits = element("div", "ppCredits");
  for (const selector of ["#author > span", "#footer .nameLicense", "#footer .mapCredit"]) {
    const line = document.querySelector(selector);
    if (line) credits.appendChild(line.cloneNode(true));
  }

  // They show when the start screen opens, then wait behind the © button (src/creditLine.ts)
  const creditButton = button("ppCreditToggle", "©", () => undefined);
  creditButton.title = t("hud.credit_toggle");
  creditButton.setAttribute("aria-label", creditButton.title);
  const showCredits = tuckable(credits, creditButton,
    (event) => !(event.target as Element | null)?.closest?.(".ppCredits, .ppCreditToggle"));

  overlay.append(backdropLayer, stage, vignette, top, hero, row, dots, panel, credits, creditButton);
  document.body.appendChild(overlay);

  // Clicking anywhere outside the card closes it (tiles and provinces open the next card themselves)
  overlay.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.stopPropagation();
      return;
    }
    const target = event.target as Element;
    if (panel.hidden || panel.contains(target) ||
        target.closest(".ppTile, .ppProvince, .ppDistrictShape, .ppTop, .ppRow, .ppCredits, .ppCreditToggle")) return;
    closeCard();
  }, true);
  installZoomAndPan(stage);

  const updateClock = (): void => {
    clock.textContent = new Date().toLocaleTimeString(getLanguage() === "en" ? "en-GB" : "th-TH", { hour: "2-digit", minute: "2-digit" });
  };
  updateClock();

  const built: View = {
    overlay, backdrop: mountStartBackdrop(backdropLayer), stage, hero, row, rowTitle, tiles: tileList, dots, panel,
    back, skip, replay, sound, menus, clock, clockTimer: window.setInterval(updateClock, CLOCK_MS), showCredits,
  };
  showCredits();
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
  labelBounds.clear();
  tiles = [];
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
  const typed: HTMLElement[] = [];
  if (content.text) typed.push(inner.appendChild(element("p", "ppHeroText", content.text)));
  if (content.extra) typed.push(inner.appendChild(element("p", "ppHeroExtra", content.extra)));
  if (content.body) inner.appendChild(content.body);
  const hint = content.hint ? inner.appendChild(element("p", "ppHeroHint", content.hint)) : null;
  // Each line rises from below, one after another
  Array.from(inner.children).forEach((child, index) => (child as HTMLElement).style.setProperty("--i", String(index)));
  view.hero.appendChild(inner);
  typeOut(inner, typed, hint);
  return inner;
}

// How long typeOut takes for these lines, so each scene waits until the reader has caught up
function typingTime(lines: string[]): number {
  let total = TYPE_START_MS;
  for (const line of lines.filter((text) => text !== "")) {
    for (const part of graphemes(line)) total += /[:·]/.test(part) ? TYPE_MARK_MS : part === " " ? TYPE_SPACE_MS : TYPE_MS;
    total += TYPE_LINE_PAUSE_MS;
  }
  return total;
}

// Splits text into what the eye reads as single characters, so Thai vowels and tone marks arrive with
// their consonant instead of on their own.
function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: object) => { segment(text: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Segmenter) return Array.from(text);
  return Array.from(new Segmenter("th", { granularity: "grapheme" }).segment(text), (part) => part.segment);
}

// The descriptions type themselves out behind a blinking caret, then the hint appears.
// Screen readers get each line whole, from its aria-label.
function typeOut(inner: HTMLElement, lines: HTMLElement[], hint: HTMLElement | null): void {
  if (reducedMotion() || lines.length === 0) return;
  hint?.classList.add("waiting");
  const queue = lines.map((line) => {
    const text = line.textContent ?? "";
    line.setAttribute("aria-label", text);
    const shown = element("span");
    shown.setAttribute("aria-hidden", "true");
    line.replaceChildren(shown);
    return { line, shown, parts: graphemes(text) };
  });
  let lineIndex = 0;
  let partIndex = 0;
  const caret = element("span", "ppCaret");
  caret.setAttribute("aria-hidden", "true");
  const step = (): void => {
    if (!inner.isConnected || inner.classList.contains("leaving")) return;
    const current = queue[lineIndex];
    if (!current) {
      caret.remove();
      hint?.classList.remove("waiting");
      return;
    }
    if (partIndex === 0) current.line.appendChild(caret);
    current.shown.textContent += current.parts[partIndex++] ?? "";
    if (partIndex >= current.parts.length) {
      lineIndex++;
      partIndex = 0;
      window.setTimeout(step, TYPE_LINE_PAUSE_MS);
    } else {
      const typedNow = current.parts[partIndex - 1] ?? "";
      window.setTimeout(step, /[:·]/.test(typedNow) ? TYPE_MARK_MS : typedNow === " " ? TYPE_SPACE_MS : TYPE_MS);
    }
  };
  window.setTimeout(step, TYPE_START_MS);
}

// Set once the player has picked a city: a double click on a start button must not start two games
let leaving = false;

function leaveTo(next: () => void): void {
  if (leaving) return;
  leaving = true;
  window.clearTimeout(sceneTimer);
  if (view) {
    view.overlay.classList.add("leavingToGame");
  }
  setCurtainDark();
  window.setTimeout(() => {
    if (view) {
      view.backdrop.dispose();
      hide(view.overlay, true);
    }
    next();
  }, 700);
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
    labelBounds.set(label, shape.bounds);
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
    label.textContent = t(`region.${region.id}.short`);
    regionLabels.set(region.id, label);
    regionLabelLayer.appendChild(label);
  }

  // The Golden Peninsula's gold lies over the provinces as one shape and fades away when the story moves on, rather
  // than switching at once (owner, 18 Oct 2026): a gradient fill cannot transition into a flat one
  provinceLayer.appendChild(svgElement("path", {
    d: data.map.provinces.map(shape => shape.path).join(" "),
    class: "ppGoldOverlay",
    "aria-hidden": "true",
  }));
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
  view.overlay.dataset.mode = mode;
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
  const sizes: Array<[Map<string, SVGElement>, number]> = [[regionLabels, target[3] / 40], [provinceLabels, target[3] / 62]];
  for (const [labels, size] of sizes) {
    for (const label of labels.values()) {
      label.setAttribute("font-size", size.toFixed(2));
      label.setAttribute("stroke-width", (size * 0.2).toFixed(2));
    }
  }
  // A province's name shows only when the province is about as wide on screen as its name
  const unitsPerPixel = target[2] / (view?.stage.clientWidth || 1);
  const fontPx = target[3] / 62 / unitsPerPixel;
  for (const [label, bounds] of labelBounds) {
    const shapePx = (bounds[2] - bounds[0]) / unitsPerPixel;
    // Thai vowel and tone marks sit above or below their letter and take no width
    const textPx = (label.textContent ?? "").replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g, "").length * fontPx * 0.55;
    label.classList.toggle("tight", shapePx < textPx * 0.85);
  }
}

function setViewBox(box: ViewBox): void {
  currentViewBox = box;
  view?.svg?.setAttribute("viewBox", box.map((v) => v.toFixed(3)).join(" "));
  scaleLabels(box);
}

// --- Zoom and pan by the player: wheel, drag, and the + - buttons ---

function zoomAt(factor: number, clientX?: number, clientY?: number): void {
  if (!view?.svg || mode === "intro" || !data) return;
  cancelAnimationFrame(flyFrame);
  const rect = view.stage.getBoundingClientRect();
  const px = clientX === undefined ? 0.5 : (clientX - rect.left) / rect.width;
  const py = clientY === undefined ? 0.5 : (clientY - rect.top) / rect.height;
  const [x, y, width, height] = currentViewBox;
  const widest = frame(countryBox())[2] * 1.6;
  const next = Math.min(widest, Math.max(1.2, width * factor));
  const scale = next / width;
  // Keep the point under the pointer where it is
  setViewBox([x + width * px * (1 - scale), y + height * py * (1 - scale), width * scale, height * scale]);
}

function installZoomAndPan(stage: HTMLElement): void {
  stage.addEventListener("wheel", (event) => {
    if (mode === "intro") return;
    event.preventDefault();
    zoomAt(Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX, event.clientY);
  }, { passive: false });
  stage.addEventListener("pointerdown", (event) => {
    if (mode === "intro" || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, box: [...currentViewBox] as ViewBox, moved: false };
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      cancelAnimationFrame(flyFrame);
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("dragging");
    }
    const unitsPerPixel = drag.box[2] / (stage.clientWidth || 1);
    setViewBox([drag.box[0] - dx * unitsPerPixel, drag.box[1] - dy * unitsPerPixel, drag.box[2], drag.box[3]]);
  });
  const endDrag = (): void => {
    if (drag?.moved) suppressClick = true; // the click that ends a drag picks nothing
    drag = null;
    stage.classList.remove("dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
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
    // Zoom at a steady rate even across a big change of scale: the size moves geometrically, the centre with it
    const width = from[2] * Math.pow(target[2] / from[2], eased);
    const height = from[3] * Math.pow(target[3] / from[3], eased);
    const zoomShare = from[2] === target[2] ? eased : (width - from[2]) / (target[2] - from[2]);
    const centreX = from[0] + from[2] / 2 + (target[0] + target[2] / 2 - from[0] - from[2] / 2) * zoomShare;
    const centreY = from[1] + from[3] / 2 + (target[1] + target[3] / 2 - from[1] - from[3] / 2) * zoomShare;
    currentViewBox = [centreX - width / 2, centreY - height / 2, width, height];
    svg.setAttribute("viewBox", currentViewBox.map((v) => v.toFixed(3)).join(" "));
    if (k < 1) flyFrame = requestAnimationFrame(step);
    else scaleLabels(target);
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
  for (const [id, label] of provinceLabels) label.classList.toggle("hover", province !== null && id === province.id);
}

// A click on the map goes into the game when it can (owner, 12 Oct 2026): in My cities, on the shown city's
// province; in a region, on the province whose card is already open (the first click opens the card, where a new
// city gets its name and difficulty).
function onMapPick(province: Province): void {
  if (mode === "region") enterRegion(province.region);
  else if (mode === "province" && province.region === currentRegion) {
    if (selectedProvince === province.id && cardOpen()) playFromCard();
    else openCard(province.id);
  } else if (mode === "cities") {
    const index = tiles.findIndex((tile) => actions?.cities.find((city) => city.id === tile.id)?.provinceId === province.id);
    if (index < 0) return;
    if (index === focusIndex) leaveTo(() => actions?.continueCity(tiles[index].id));
    else selectTile(index);
  }
}

/** What the open card's main button does: carry on with the province's saved city, or start the new one. */
function playFromCard(): void {
  const button = view?.panel.querySelector<HTMLButtonElement>(".ppContinueChip") ??
    view?.panel.querySelector<HTMLButtonElement>(".ppStart");
  button?.click();
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
    tile.addEventListener("mouseenter", () => {
      if (!cardOpen()) focusTile(index);
    });
    tile.addEventListener("focus", () => focusTile(index));
    return { id: item.id, element: tile };
  });
  view.tiles.replaceChildren(...tiles.map((tile) => tile.element));
  view.tiles.scrollLeft = 0;
  view.tiles.dispatchEvent(new Event("scroll"));
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
  const list = view.tiles;
  const tile = tiles[next].element;
  list.scrollTo({ left: tile.offsetLeft - (list.clientWidth - tile.offsetWidth) / 2, behavior: reducedMotion() ? "auto" : "smooth" });
  if (!changed) return;
  audio.play("ui.select");
  if (mode === "region") showRegionHero(tiles[next].id);
  else if (mode === "province") showProvinceHero(tiles[next].id);
  else if (mode === "cities") showCityHero(tiles[next].id);
}

function selectTile(index: number): void {
  const tile = tiles[index];
  if (!tile) return;
  if (mode === "region") enterRegion(tile.id);
  else if (mode === "province") {
    focusTile(index);
    openCard(tile.id);
  } else if (mode === "cities") {
    focusTile(index);
    openCityCard(tile.id);
  }
}

// --- My cities: carry on with a saved city, or delete it ---

function cityProvince(city: CityMeta): Province | undefined {
  return city.provinceId ? data?.provinces.get(city.provinceId) : undefined;
}

function cityPlace(city: CityMeta): string {
  const province = cityProvince(city);
  return province ? localName(province) : t("cities.practice");
}

// "ยศขุน" / "Rank: Khun"; cities saved before ranks get the one their population earns
function cityRank(city: CityMeta): string {
  return t("rank.label", { rank: t(`rank.${keepHigherRank(city.rank, rankForPopulation(city.population))}`) });
}

function showCities(): void {
  if (!view || !data || !actions) return;
  if (actions.cities.length === 0) {
    showRegions(false);
    return;
  }
  window.clearTimeout(sceneTimer);
  mode = "cities";
  currentRegion = null;
  closeCard();
  setChrome({ back: true, row: true });
  setTiles(t("cities.title"), actions.cities.map((city) => ({
    id: city.id,
    name: city.name,
    meta: `${cityPlace(city)} · ${cityRank(city)}`,
    color: REGION_COLORS[cityProvince(city)?.region ?? ""] ?? "#8a8f7a",
  })));
  focusIndex = -1;
  focusTile(0);
}

function showCityHero(id: string): void {
  if (!view || !data) return;
  const city = actions?.cities.find((c) => c.id === id);
  if (!city) return;
  const province = cityProvince(city);
  const region = province ? data.regions.find((r) => r.id === province.region) : undefined;
  if (province) {
    applyMapState({ focus: province.region, provinceNames: true, selected: province.id });
    flyTo(provinceBox(province.id));
  } else {
    applyMapState({ regionNames: true });
    flyTo(countryBox());
  }
  view.backdrop.setTint(province ? REGION_COLORS[province.region] ?? GOLD : GOLD);

  const body = element("div", "ppStats");
  const rank = element("p", "ppHeroRank", cityRank(city));
  const funds = element("div", "ppFunds");
  funds.append(element("span", undefined, t("cities.population", { count: "" }).trim()),
    element("strong", undefined, city.population.toLocaleString("en-US")));
  const facts = element("p", "ppHeroExtra",
    `${money(city.funds)} · ${t("cities.date", { month: t(`month.${MONTHS[city.month] ?? "jan"}`), year: formatYear(city.year) })}`);
  const saved = element("p", "ppHeroExtra", t("cities.saved", {
    when: new Date(city.savedAt).toLocaleDateString(getLanguage() === "en" ? "en-GB" : "th-TH",
      { day: "numeric", month: "short", year: "numeric" }),
  }));
  body.append(rank, funds, facts, saved);
  setHero({
    title: city.name,
    sub: region ? `${cityPlace(city)} · ${localName(region)}` : cityPlace(city),
    body,
    hint: t("cities.hint"),
  });
}

function openCityCard(id: string): void {
  if (!view || !actions) return;
  const city = actions.cities.find((c) => c.id === id);
  if (!city) return;
  const card = element("div", "ppCard");
  card.append(element("h3", undefined, city.name), element("p", "ppSmall", cityPlace(city)));
  card.appendChild(button("ppStart", t("cities.continue"), () => leaveTo(() => actions?.continueCity(id))));

  // Deleting asks first, in place
  const danger = element("div", "ppDanger");
  const ask = button("ppChipButton", t("cities.delete"), () => {
    const confirm = element("div", "ppConfirm");
    confirm.append(
      element("p", undefined, t("cities.delete_confirm", { city: city.name })),
      button("ppChipButton ppDeleteYes", t("cities.delete_yes"), () => {
        actions?.deleteCity(id);
        if (actions) actions.cities = actions.cities.filter((c) => c.id !== id);
        const counter = view?.overlay.querySelector(".ppContinue");
        if (counter && actions) {
          if (actions.cities.length > 0) counter.textContent = t("cities.button", { count: actions.cities.length });
          else counter.remove();
        }
        showCities();
      }),
      button("ppChipButton", t("cities.delete_no"), () => danger.replaceChildren(ask)),
    );
    danger.replaceChildren(confirm);
  });
  danger.appendChild(ask);
  card.appendChild(danger);

  view.panel.replaceChildren(card);
  if (!cardOpen()) show(view.panel);
  view.overlay.classList.add("ppCardOpen");
  if (framedBox) flyTo(framedBox);
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

/** The story's first look, Thailand in gold, without starting it: what comes out from behind the title page. */
function showIntroLook(): void {
  if (!view || !data) return;
  const first = scenes()[0];
  setChrome({ skip: true, dots: true });
  applyMapState({ plain: first.plain, focus: first.focus, regionNames: !first.plain && !first.focus });
  flyTo(countryBox(), true);
  view.backdrop.setTint(GOLD);
}

function playIntro(from = 0): void {
  if (!view) return;
  mode = "intro";
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

  const length = typingTime([scene.text, scene.extra ?? ""]) + READ_AFTER_TYPING_MS;
  window.clearTimeout(sceneTimer);
  sceneTimer = window.setTimeout(() => playScene(list, index + 1), Math.max(MIN_SCENE_MS, length));
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

function cardOpen(): boolean {
  return !!view && !view.panel.hidden && !view.panel.classList.contains("motionLeave");
}

function closeCard(): void {
  if (!view || !cardOpen()) return;
  view.overlay.classList.remove("ppCardOpen");
  hide(view.panel, true);
  leaveTerrain();
  if (mode === "province" && currentRegion) {
    if (tiles[focusIndex]) showProvinceHero(tiles[focusIndex].id);
    applyMapState({ focus: currentRegion, provinceNames: true, selected: selectedProvince });
    flyTo(groupViewBox(regionMembers(currentRegion)));
  } else if (framedBox) {
    flyTo(framedBox);
  }
}

// --- Down to the land: the province, then its real map (a lens beside it for the old 2 x 2 km maps) ---

function provinceBox(provinceId: string): ViewBox {
  const shape = data?.map.provinces.find((p) => p.id === provinceId);
  return shape ? groupViewBox([shape], 0.12) : countryBox();
}

function leaveTerrain(): void {
  terrainToken++;
  const layer = view?.svg?.querySelector(".ppTerrainLayer");
  if (!layer) return;
  layer.classList.add("leaving");
  window.setTimeout(() => layer.remove(), 500);
}

function diveIntoTerrain(province: Province, map: PresetMap): void {
  const svg = view?.svg;
  const shape = data?.map.provinces.find((p) => p.id === province.id);
  if (!svg || !shape) return;
  leaveTerrain();
  const token = terrainToken;
  if (map.format >= 2) {
    layTerrainInPlace(province, map, shape, svg, token);
    return;
  }

  // The whole province stays in view. At this scale the 2 x 2 km starting land is a speck, so a glowing
  // marker shows where it is, and a lens beside the province shows the land itself, enlarged.
  const [px0, py0, px1, py1] = shape.bounds;
  const provinceWidth = px1 - px0;
  const provinceHeight = py1 - py0;
  const [lx, ly, lw, lh] = projectBox(map.bbox);
  const landX = lx + lw / 2;
  const landY = ly + lh / 2;
  const size = Math.max(provinceWidth, provinceHeight) * 0.95;
  const gap = Math.max(provinceWidth, provinceHeight) * 0.18;
  const lensX = px1 + gap;
  const lensY = Math.min(Math.max(landY - size / 2, py0), Math.max(py0, py1 - size));
  const unit = size / 100; // strokes and text follow the lens size

  const canvas = element("canvas");
  drawPresetMap(canvas, map, TERRAIN_PIXELS_PER_TILE);
  const layer = svgElement("g", { class: "ppTerrainLayer" });
  const leader = svgElement("line", {
    class: "ppLensLeader",
    x1: landX.toFixed(3), y1: landY.toFixed(3), x2: lensX.toFixed(3), y2: (lensY + size / 2).toFixed(3),
    "stroke-width": (unit * 0.8).toFixed(3),
  });
  const marker = svgElement("circle", {
    class: "ppLandMarker",
    cx: landX.toFixed(3), cy: landY.toFixed(3), r: (unit * 3.2).toFixed(3),
    "stroke-width": (unit * 0.8).toFixed(3),
  });
  const pulse = svgElement("circle", {
    class: "ppLandPulse",
    cx: landX.toFixed(3), cy: landY.toFixed(3), r: (unit * 3.2).toFixed(3),
    "stroke-width": (unit * 0.8).toFixed(3),
  });
  const image = svgElement("image", {
    href: canvas.toDataURL("image/png"),
    x: lensX.toFixed(3), y: lensY.toFixed(3), width: size.toFixed(3), height: size.toFixed(3),
    preserveAspectRatio: "none",
  });
  const frameRect = svgElement("rect", {
    class: "ppTerrainOutline",
    x: lensX.toFixed(3), y: lensY.toFixed(3), width: size.toFixed(3), height: size.toFixed(3),
    rx: (unit * 2).toFixed(3),
  });
  const label = svgElement("text", {
    class: "ppTerrainLabel",
    x: (lensX + size / 2).toFixed(3), y: (lensY - unit * 4).toFixed(3),
    "font-size": (unit * 6).toFixed(3),
    "stroke-width": (unit * 1.2).toFixed(3),
  });
  label.textContent = t("picker.preview");
  const shadow = svgElement("rect", {
    class: "ppLensShadow",
    x: lensX.toFixed(3), y: lensY.toFixed(3), width: size.toFixed(3), height: size.toFixed(3),
    rx: (unit * 2).toFixed(3),
  });
  const credit = svgElement("text", {
    class: "ppTerrainCredit",
    x: (lensX + size / 2).toFixed(3), y: (lensY + size + unit * 5).toFixed(3),
    "font-size": (unit * 3.6).toFixed(3),
  });
  credit.textContent = t("picker.preview_credit");
  layer.append(leader, pulse, marker, shadow, image, frameRect, label, credit);
  svg.querySelector(".ppProvinceLabels")?.before(layer);

  // Frame the province and the lens together
  const top = Math.min(py0, lensY - unit * 12);
  const bottom = Math.max(py1, lensY + size + unit * 7);
  const right = lensX + size;
  applyMapState({ focus: province.region, selected: province.id });
  flyTo(groupViewBox([{ id: "", path: "", centroid: [0, 0], area: 0, bounds: [px0, top, right, bottom] }], 0.06));
  window.setTimeout(() => {
    if (token === terrainToken && cardOpen()) layer.classList.add("shown");
  }, FLY_MS * 0.6);
}

// A whole-province map (format 2) is laid exactly over its province, cut to the province's outline: the province
// turns into the land it will be played on, roads, railways and rivers in place, with its town marked
function layTerrainInPlace(province: Province, map: PresetMap, shape: ProjectedProvince, svg: SVGSVGElement,
                           token: number): void {
  const [x, y, width, height] = projectBox(map.bbox);
  const [px0, py0, px1, py1] = shape.bounds;
  const unit = Math.max(px1 - px0, py1 - py0) / 100; // strokes and text follow the province's size
  const canvas = element("canvas");
  drawPresetMap(canvas, map, TERRAIN_PIXELS_PER_TILE);

  const layer = svgElement("g", { class: "ppTerrainLayer" });
  const clipId = `ppTerrainClip-${province.id}`;
  const clip = svgElement("clipPath", { id: clipId });
  clip.appendChild(svgElement("path", { d: shape.path }));
  const image = svgElement("image", {
    href: canvas.toDataURL("image/png"),
    x: x.toFixed(3), y: y.toFixed(3), width: width.toFixed(3), height: height.toFixed(3),
    preserveAspectRatio: "none", "clip-path": `url(#${clipId})`,
  });
  layer.append(clip, image);
  if (map.town) {
    const tx = (x + ((map.town.x + 0.5) / map.width) * width).toFixed(3);
    const ty = (y + ((map.town.y + 0.5) / map.height) * height).toFixed(3);
    const ring = { cx: tx, cy: ty, r: (unit * 2).toFixed(3), "stroke-width": (unit * 0.6).toFixed(3) };
    layer.append(svgElement("circle", { class: "ppLandPulse", ...ring }), svgElement("circle", { class: "ppLandMarker", ...ring }));
  }
  // Its districts, where they have city maps: a click on one chooses it in the card (owner 13 Oct 2026)
  for (const district of data?.districts?.[province.id] ?? []) {
    if (!district.outline) continue;
    const shape = svgElement("path", { class: "ppDistrictShape", d: outlinePath(district.outline), "data-id": district.id });
    const tip = svgElement("title", {});
    tip.textContent = getLanguage() === "en" ? district.nameEn : district.nameTh;
    shape.appendChild(tip);
    shape.addEventListener("click", (event) => {
      event.stopPropagation();
      chooseDistrict?.(district.id);
    });
    layer.appendChild(shape);
    if (district.town) {
      const [dx, dy] = projectPoint(district.town.lon, district.town.lat);
      layer.appendChild(svgElement("circle", { class: "ppDistrictTown", cx: dx.toFixed(3), cy: dy.toFixed(3),
        r: (unit * 0.9).toFixed(3) }));
    }
  }
  const chosen = view?.panel.querySelector<HTMLSelectElement>(".ppDistrict");
  // The map's data comes from OpenStreetMap, credited where it is shown
  const credit = svgElement("text", {
    class: "ppTerrainCredit",
    x: ((px0 + px1) / 2).toFixed(3), y: (py1 + unit * 5).toFixed(3),
    "font-size": (unit * 3).toFixed(3),
  });
  credit.textContent = t("picker.preview_credit");
  layer.appendChild(credit);
  svg.querySelector(".ppProvinceLabels")?.before(layer);
  if (chosen) markDistrict(chosen.value);

  applyMapState({ focus: province.region, selected: province.id });
  flyTo(groupViewBox([{ id: "", path: "", centroid: [0, 0], area: 0, bounds: [px0, py0, px1, py1 + unit * 7] }], 0.08));
  window.setTimeout(() => {
    if (token === terrainToken && cardOpen()) layer.classList.add("shown");
  }, FLY_MS * 0.6);
}

// The text on the left while looking at the land: what the province has to build with
function showTerrainHero(province: Province, map: PresetMap): void {
  const region = data?.regions.find((r) => r.id === province.region);
  const body = element("div", "ppResources");
  body.appendChild(element("h4", undefined, t("picker.resources")));
  const list = element("ul", "ppResourceList");
  const swatches: Record<string, string> = {
    "resource.flat": PRESET_COLORS[0],
    "resource.water": PRESET_COLORS[1],
    "resource.forest": PRESET_COLORS[2],
  };
  for (const resource of provinceResources(province.tags ?? [], map.stats)) {
    const item = element("li");
    const dot = element("span", "ppSwatch");
    dot.style.background = swatches[resource.key] ?? GOLD;
    item.append(dot, element("span", undefined, t(resource.key, resource.pct === undefined ? undefined : { pct: resource.pct })));
    list.appendChild(item);
  }
  body.appendChild(list);
  for (const note of resourceNotes(province.tags ?? [], map.stats)) body.appendChild(element("p", "ppNote", t(note)));
  const levels = resourceLevelList(province);
  if (levels) body.appendChild(levels);
  const transport = transportList(province, map);
  if (transport) body.append(element("h4", undefined, t("picker.transport")), transport);
  // What its region's and its own rules change, in numbers (src/provinceRules.ts)
  const effects = data?.rules
    ? ruleEffects(resolveRules(data.rules, province.region, province.id), (month) => t(`month.${month}`))
    : [];
  if (effects.length > 0) {
    body.appendChild(element("h4", undefined, t("picker.rules")));
    const rules = element("ul", "ppRules");
    for (const effect of effects) rules.appendChild(element("li", effect.good ? "good" : "bad", t(effect.key, effect.params)));
    body.appendChild(rules);
  }
  const summary = element("p", "ppHeroExtra",
    `${t("picker.funds")} ${money(startingFunds(map.stats))} · ${t("picker.difficulty")} ${stars(difficultyStars(map.stats))}`);
  body.appendChild(summary);
  setHero({
    title: localName(province),
    sub: `${t("picker.terrain_title")} · ${region ? localName(region) : ""}`,
    body,
  });
}

/** "rare_earth" for "rareEarth": resources are named in the strings table in snake_case */
const resourceKey = (id: ResourceId): string => id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// The province's resources at their levels, richest first, each saying on hover what it brings and what it costs;
// then its parks and reserves and its border crossings. Null when the resources could not be read.
function resourceLevelList(province: Province): HTMLElement | null {
  const resources = data?.resources;
  if (!resources) return null;
  const levels = provinceLevels(resources.measured[province.id], resources.profiles.provinces[province.id])
    .filter((resource) => resource.level > 0)
    .sort((a, b) => b.level - a.level);
  const list = element("ul", "ppWealth");
  for (const resource of levels) {
    const key = resourceKey(resource.id);
    const item = element("li");
    item.title = t("resource.gain_cost", { gain: t(`resource.gain.${key}`), cost: t(`resource.cost.${key}`) });
    item.appendChild(element("span", "ppWealthName", t(`resource.level.${key}`)));
    const dots = element("span", "ppWealthDots", "●".repeat(resource.level) + "○".repeat(MAX_LEVEL - resource.level));
    dots.setAttribute("aria-label", `${resource.level}/${MAX_LEVEL}`);
    item.appendChild(dots);
    // A level the game made up says so; one it worked out from what is known about the province does not (owner,
    // 13 Oct 2026: "ไม่ต้องใช้คำว่า อนุมาน ในเกม")
    if (MADE_UP.includes(resource.id)) item.appendChild(element("span", "ppWealthSource", t("resource.made_up")));
    list.appendChild(item);
  }
  const facts = resources.indicators[province.id] ?? {};
  const protectedPct = Math.round((facts.protectedShare ?? 0) * 100);
  if (protectedPct >= 1) list.appendChild(element("li", "ppWealthFact", t("resource.protected", { pct: protectedPct })));
  if ((facts.borderCrossings ?? 0) > 0) {
    list.appendChild(element("li", "ppWealthFact", t("resource.border", { count: facts.borderCrossings ?? 0 })));
  }
  return list.childElementCount > 0 ? list : null;
}

// What links the province to the rest of the country (src/geo/provinceTransport.ts): its laterite roads and railways
// to the neighbours, its waterways, the sea and its airports; null for a map that does not know (format 1)
const AIRPORT_COLOUR = "#9ecbff";
function transportList(province: Province, map: PresetMap): HTMLElement | null {
  const transport = provinceTransport(map, province.tags ?? []);
  if (!hasTransport(transport)) return null;
  const nameOf = (id: string): string => {
    const neighbor = data?.provinces.get(id);
    return neighbor ? localName(neighbor) : id;
  };
  const list = element("ul", "ppResourceList ppTransport");
  const add = (colour: string, text: string): void => {
    const item = element("li");
    const dot = element("span", "ppSwatch");
    dot.style.background = colour;
    item.append(dot, element("span", undefined, text));
    list.appendChild(item);
  };
  const places = transport.roads.map((road) => (road.ref
    ? t("transport.road_ref", { province: nameOf(road.neighbor), ref: road.ref })
    : nameOf(road.neighbor)));
  add(TRANSPORT_COLORS[1], places.length ? t("transport.roads", { places: places.join(", ") }) : t("transport.no_roads"));
  if (transport.rails.length) add(TRANSPORT_COLORS[2], t("transport.rails", { places: transport.rails.map(nameOf).join(", ") }));
  if (transport.waterways.length) {
    const rivers = transport.waterways.map((waterway) => waterwayName(waterway, getLanguage()));
    add(PRESET_COLORS[1], t("transport.waterways", { rivers: rivers.join(", ") }));
  }
  for (const sea of transport.seas) add(PRESET_COLORS[1], t(`transport.sea_${sea}`));
  if (transport.airports.length) {
    const airports = transport.airports.map((airport) => `${waterwayName(airport, getLanguage())} (${airport.iata})`);
    add(AIRPORT_COLOUR, t("transport.airports", { airports: airports.join(", ") }));
  }
  return list;
}

// Hides every menu, card and text so only the bamboo and the map remain; the toggle itself stays.
function setMenusHidden(hidden: boolean): void {
  if (!view) return;
  view.overlay.classList.toggle("ppMenusHidden", hidden);
  view.menus.textContent = t(hidden ? "ui.show_menus" : "ui.hide_menus");
  if (framedBox) flyTo(framedBox);
}

// The card always shows the province in focus, so the text, the map and the card agree.
function openCard(provinceId: string, focusName = true): void {
  if (!view || !data) return;
  const province = data.provinces.get(provinceId);
  if (!province) return;
  const index = tiles.findIndex((tile) => tile.id === provinceId);
  if (index >= 0 && index !== focusIndex) focusTile(index);

  const card = element("div", "ppCard");
  card.append(element("h3", undefined, localName(province)));
  const existing = actions?.cities.find((city) => city.provinceId === province.id);
  if (existing) {
    const note = element("div", "ppExisting");
    note.append(
      element("p", undefined, t("picker.existing_city", { city: existing.name })),
      button("ppChipButton ppContinueChip", t("cities.continue"), () => leaveTo(() => actions?.continueCity(existing.id))),
    );
    card.appendChild(note);
  }

  const nameLabel = element("label", "ppField");
  const nameInput = element("input", "ppName");
  nameInput.type = "text";
  nameInput.maxLength = MAX_CITY_NAME_LENGTH;
  nameInput.value = localName(province).slice(0, MAX_CITY_NAME_LENGTH);
  nameLabel.append(element("span", undefined, t("start.label.name")), nameInput);

  // The district whose town the city stands in, where the province's districts have maps; the city takes its name
  // until the player gives it another
  const districts = data.districts?.[province.id] ?? [];
  const districtLabel = element("label", "ppField");
  const districtSelect = element("select", "ppDistrict");
  const districtName = (district: District): string => {
    const name = getLanguage() === "en" ? district.nameEn : district.nameTh;
    return /^(เมือง|Mueang)\s?/.test(name) ? localName(province) : name;
  };
  for (const district of districts) {
    const option = element("option");
    option.value = district.id;
    option.textContent = `${getLanguage() === "en" ? district.nameEn : district.nameTh} · ${t("picker.district_area", { area: Math.round(district.areaKm2) })}`;
    districtSelect.appendChild(option);
  }
  let named = false;
  nameInput.addEventListener("input", () => { named = true; });
  districtSelect.addEventListener("change", () => {
    const district = districts.find((d) => d.id === districtSelect.value);
    if (district && !named) nameInput.value = districtName(district).slice(0, MAX_CITY_NAME_LENGTH);
    markDistrict(districtSelect.value);
  });
  chooseDistrict = districts.length ? (id: string) => {
    if (!districts.some((d) => d.id === id)) return;
    districtSelect.value = id;
    districtSelect.dispatchEvent(new Event("change"));
  } : null;
  districtSelect.addEventListener("keydown", (event) => event.stopPropagation()); // arrows choose, not move the tiles
  districtLabel.append(element("span", undefined, t("picker.district")), districtSelect);

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
    const districtId = districts.length ? districtSelect.value : undefined;
    leaveTo(() => actions?.start(province.id, name.slice(0, MAX_CITY_NAME_LENGTH), level, districtId));
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
        openCard(id);
      } else {
        enterRegion(neighbor.region, id);
      }
    }));
  }

  if (districts.length) {
    card.append(districtLabel);
    markDistrict(districtSelect.value);
  }
  card.append(nameLabel, element("h4", undefined, t("start.label.difficulty")), levels, start,
    element("h4", undefined, t("picker.neighbors")), neighbors);
  view.panel.replaceChildren(card);
  if (!cardOpen()) show(view.panel);
  view.overlay.classList.add("ppCardOpen");
  if (focusName) {
    nameInput.focus({ preventScroll: true });
    nameInput.select();
  }

  const token = ++heroToken;
  loadPreset(province.id).then((map) => {
    if (token !== heroToken || !cardOpen()) return; // The player has moved on
    diveIntoTerrain(province, map);
    showTerrainHero(province, map);
  }).catch(() => {
    if (token === heroToken) flyTo(provinceBox(province.id));
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
    case "ArrowLeft": {
      const step = event.key === "ArrowRight" ? 1 : -1;
      focusTile(focusIndex < 0 ? 0 : focusIndex + step);
      if (mode === "province" && cardOpen()) openCard(tiles[focusIndex].id, false);
      if (mode === "cities" && cardOpen()) openCityCard(tiles[focusIndex].id);
      break;
    }
    case "Enter":
      // Buttons and fields in the card answer Enter themselves
      if (event.target instanceof Node && view.panel.contains(event.target)) return;
      // The first Enter opens a saved city's card, the second carries on with it
      if (mode === "cities" && cardOpen()) view.panel.querySelector<HTMLButtonElement>(".ppStart")?.click();
      else if (focusIndex >= 0) selectTile(focusIndex);
      break;
    case "Escape":
    case "Backspace":
      if (!view.panel.hidden) closeCard();
      else if (mode === "province" || mode === "cities") showRegions(false);
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
  view.overlay.classList.toggle("awaitGate", awaitingGate);
  buildMap();
  if (awaitingGate && introAfterGate) showIntroLook();
  else if (mode === "intro") playIntro(sceneIndex);
  else if (mode === "province" && currentRegion) enterRegion(currentRegion, cardOpen ? selectedProvince : null);
  else if (mode === "cities") showCities();
  else showRegions(false);
});


// While the title page is up the start screen waits unseen behind it; when the player enters it comes out from
// inside, and only then does the story start (owner, 12 Oct 2026)
let awaitingGate = false;
// The story plays once the title page is gone: until then the screen shows its first look (Thailand in gold)
let introAfterGate = false;
const EMERGE_MS = 1500;

export function openStartScreen(startActions: StartActions, options: StartOptions = {}): void {
  actions = startActions;
  music.play(THEME); // starts with the first click or key, as browsers require
  document.removeEventListener("keydown", onKeyDown);
  document.addEventListener("keydown", onKeyDown);
  view ??= buildShell();
  if (options.gate) {
    awaitingGate = true;
    introAfterGate = options.intro === true;
    view.overlay.classList.add("awaitGate");
  }
  show(view.overlay);
  fadeCurtain(false, 600);

  // The map is drawn as soon as the data is in, behind the title page (its loading line goes with it); the story
  // waits until the player has entered and the screen has come out
  const loading = loadData().then((loaded) => {
    data = loaded;
    if (view && !view.svg) buildMap();
    setLoadingProgress(1);
    if (awaitingGate && introAfterGate) showIntroLook();
  });
  const entered = (options.gate ?? Promise.resolve()).then(() => {
    if (!awaitingGate) return undefined;
    awaitingGate = false;
    view?.overlay.classList.remove("awaitGate");
    view?.overlay.classList.add("emerging");
    return new Promise<void>((resolve) => window.setTimeout(resolve, EMERGE_MS));
  });
  Promise.all([loading, entered]).then(() => {
    if (!view || !data) return;
    if (!view.svg) buildMap();
    const requested = options.provinceId ? data.provinces.get(options.provinceId) : undefined;
    if (requested) enterRegion(requested.region, requested.id);
    else if (options.intro) playIntro();
    else showRegions(false);
  }).catch(() => {
    if (view) view.stage.textContent = t("picker.load_failed");
  });
}
