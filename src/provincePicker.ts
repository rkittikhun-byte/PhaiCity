/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The way into a province (docs/ONLINE_PLAN.md phase 1), on one full-screen map of Thailand built from
// real province shapes:
//   1. intro: a scrolling story about Thailand and its six regions (shown on first launch, replayable)
//   2. region: pick the region to live in
//   3. province: the map zooms into that region; pick a province from its card (treasury, difficulty,
//      resources, starting map). Choosing a province calls onStart(provinceId).

import { groupCentroid, groupViewBox, NationalMap, projectNationalMap, ProjectedProvince } from "./geo/nationalMap";
import { drawPresetMap, PresetMap } from "./geo/presetMap";
import { difficultyStars, fundsBonus, provinceResources, startingFunds } from "./geo/provinceProfile";
import { getLanguage, onLanguageChange, t } from "./i18n/index";
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
  plain: boolean;
  focus: string | null;
  final?: boolean;
}

type ViewBox = [number, number, number, number];
type Mode = "intro" | "region" | "province";

export interface PickerOptions {
  /** Start with the story about Thailand instead of the region map. */
  intro?: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "provincePicker";
const INTRO_SEEN_KEY = "phaicity.introSeen";
const PREVIEW_PIXELS_PER_TILE = 1;
const ZOOM_MS = 700;
const REGION_LABEL_SIZE = 30;
const PROVINCE_LABELS_PER_WIDTH = 55;

const REGION_COLORS: Record<string, string> = {
  north: "#8cbf7a",
  northeast: "#e9c46a",
  central: "#f0a982",
  east: "#7fbfd4",
  west: "#b8a3d6",
  south: "#6cc3a9",
};

interface View {
  overlay: HTMLElement;
  title: HTMLElement;
  hint: HTMLElement;
  skip: HTMLButtonElement;
  back: HTMLButtonElement;
  mapWrap: HTMLElement;
  map: HTMLElement;
  panel: HTMLElement;
  svg?: SVGSVGElement;
}

let view: View | null = null;
let dataPromise: Promise<PickerData> | null = null;
let data: PickerData | null = null;
let startCallback: (provinceId: string) => void = () => undefined;
let mode: Mode = "region";
let currentRegion: string | null = null;
let fullViewBox: ViewBox = [0, 0, 1, 1];
let currentViewBox: ViewBox = [0, 0, 1, 1];
let zoomFrame = 0;
let introObserver: IntersectionObserver | null = null;
let cardToken = 0;
const paths = new Map<string, SVGElement>();
const regionLabels = new Map<string, SVGElement>();
const provinceLabels = new Map<string, SVGElement>();
const presets = new Map<string, Promise<PresetMap>>();

// The picker is built in the current language; rebuild it after a language switch.
onLanguageChange(() => {
  introObserver?.disconnect();
  view?.overlay.remove();
  view = null;
  paths.clear();
  regionLabels.clear();
  provinceLabels.clear();
});

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

function close(): void {
  if (view) hide(view.overlay, true);
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

// --- Shell ---

function buildShell(): View {
  const overlay = element("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ppTitle");

  // A div rather than <header>: the game's stylesheet gives every <header> the striped title bar
  const header = element("div", "ppHeader");
  const back = button("ppBack", t("picker.back_regions"), () => showRegions());
  const title = element("h2");
  title.id = "ppTitle";
  const hint = element("p", "ppHint");
  hint.setAttribute("aria-live", "polite");
  const skip = button("ppSkip", t("intro.skip"), () => showRegions());
  header.append(back, title, hint, skip, button("ppClose", t("picker.close"), close));

  const body = element("div", "ppBody");
  const mapWrap = element("div", "ppMapWrap");
  const map = element("div", "ppMap", t("picker.loading"));
  mapWrap.append(map, element("p", "ppNote", `${t("picker.note")} · ${t("picker.credits")}`));
  const panel = element("aside", "ppPanel");
  body.append(mapWrap, panel);
  overlay.append(header, body);
  document.body.appendChild(overlay);

  // Scrolling over the map moves the story along too
  mapWrap.addEventListener("wheel", (event) => {
    const scenes = panel.querySelector(".ppScenes");
    if (mode !== "intro" || !scenes) return;
    event.preventDefault();
    scenes.scrollBy({ top: event.deltaY, behavior: "smooth" });
  }, { passive: false });

  return { overlay, title, hint, skip, back, mapWrap, map, panel };
}

function setHeader(title: string, hint: string, options: { back?: boolean; skip?: boolean } = {}): void {
  if (!view) return;
  view.title.textContent = title;
  view.hint.textContent = hint;
  view.back.hidden = !options.back;
  view.skip.hidden = !options.skip;
}

// --- Map ---

function regionMembers(regionId: string): ProjectedProvince[] {
  return data ? data.map.provinces.filter((p) => data!.provinces.get(p.id)?.region === regionId) : [];
}

function buildMap(): void {
  if (!view || !data) return;
  const projected = data.map;
  fullViewBox = [...projected.viewBox] as ViewBox;
  currentViewBox = [...fullViewBox] as ViewBox;

  const svg = svgElement("svg", { viewBox: fullViewBox.join(" "), class: "ppSvg", role: "group" }) as SVGSVGElement;
  const provinceLayer = svgElement("g", { class: "ppProvinces" });
  const provinceLabelLayer = svgElement("g", { class: "ppProvinceLabels" });
  const regionLabelLayer = svgElement("g", { class: "ppRegionLabels" });

  for (const shape of projected.provinces) {
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
      class: "ppProvinceLabel",
      "data-region": province.region,
    });
    label.textContent = localName(province);
    provinceLabels.set(province.id, label);
    provinceLabelLayer.appendChild(label);
  }

  for (const region of data.regions) {
    const [x, y] = groupCentroid(regionMembers(region.id));
    const label = svgElement("text", { x: x.toFixed(1), y: y.toFixed(1), class: "ppRegionLabel" });
    label.textContent = localName(region);
    regionLabels.set(region.id, label);
    regionLabelLayer.appendChild(label);
  }

  svg.append(provinceLayer, provinceLabelLayer, regionLabelLayer);
  view.map.replaceChildren(svg);
  view.svg = svg;
}

interface MapState {
  /** All provinces in one quiet colour (the opening scene). */
  plain?: boolean;
  /** Colour this region and fade the others. */
  focus?: string | null;
  /** Outline this province. */
  selected?: string | null;
  /** Show province names of the focused region. */
  provinceNames?: boolean;
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
    label.classList.toggle("hidden", !!state.plain || state.provinceNames === true || (!!state.focus && id !== state.focus));
  }
  for (const [id, label] of provinceLabels) {
    label.classList.toggle("hidden", !state.provinceNames || label.getAttribute("data-region") !== state.focus);
    label.classList.toggle("selected", id === state.selected);
  }
}

// Labels are sized in map units, so scale them with the zoom to keep them readable.
function scaleLabels(target: ViewBox): void {
  const regionSize = REGION_LABEL_SIZE * (target[2] / fullViewBox[2]);
  const provinceSize = target[2] / PROVINCE_LABELS_PER_WIDTH;
  const sizes: Array<[Map<string, SVGElement>, number]> = [[regionLabels, regionSize], [provinceLabels, provinceSize]];
  for (const [labels, size] of sizes) {
    for (const label of labels.values()) {
      label.setAttribute("font-size", size.toFixed(2));
      label.setAttribute("stroke-width", (size * 0.22).toFixed(2)); // the white halo
    }
  }
}

function zoomTo(target: ViewBox): void {
  const svg = view?.svg;
  if (!svg) return;
  cancelAnimationFrame(zoomFrame);
  scaleLabels(target);
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    currentViewBox = [...target] as ViewBox;
    svg.setAttribute("viewBox", currentViewBox.join(" "));
    return;
  }
  const from = [...currentViewBox] as ViewBox;
  const started = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - started) / ZOOM_MS);
    const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    currentViewBox = from.map((value, i) => value + (target[i] - value) * eased) as ViewBox;
    svg.setAttribute("viewBox", currentViewBox.map((v) => v.toFixed(2)).join(" "));
    if (k < 1) zoomFrame = requestAnimationFrame(step);
  };
  zoomFrame = requestAnimationFrame(step);
}

function onHover(province: Province | null): void {
  if (!view || !data || mode === "intro") return;
  if (mode === "region") {
    for (const path of paths.values()) {
      path.classList.toggle("hover", province !== null && path.getAttribute("data-region") === province.region);
    }
    const region = province ? data.regions.find((r) => r.id === province.region) : null;
    view.hint.textContent = region ? localName(region) : t("picker.region_hint");
  } else if (province?.region === currentRegion) {
    view.hint.textContent = localName(province);
  } else {
    view.hint.textContent = t("picker.hint");
  }
}

function onPick(province: Province): void {
  if (mode === "region") showRegionCard(province.region);
  else if (mode === "province" && province.region === currentRegion) showProvinceCard(province.id);
}

// --- Step 1: the story ---

function scenes(): Scene[] {
  const regions = data?.regions ?? [];
  return [
    { title: t("intro.thailand.title"), text: t("intro.thailand.text"), plain: true, focus: null },
    { title: t("intro.regions.title"), text: t("intro.regions.text"), plain: false, focus: null },
    ...regions.map((region) => ({
      title: localName(region),
      text: t(`region.${region.id}.desc`),
      extra: `${t("picker.region_pros")}: ${t(`region.${region.id}.pros`)} · ${t("picker.region_cons")}: ${t(`region.${region.id}.cons`)}`,
      plain: false,
      focus: region.id,
    })),
    { title: t("intro.final.title"), text: t("intro.final.text"), plain: false, focus: null, final: true },
  ];
}

function showIntro(): void {
  if (!view) return;
  mode = "intro";
  markIntroSeen();
  setHeader(t("intro.title"), "", { skip: true });

  const list = scenes();
  const scroller = element("div", "ppScenes");
  scroller.tabIndex = -1;
  const sections = list.map((scene, index) => {
    const section = element("section", "ppScene");
    section.dataset.index = String(index);
    const card = element("div", "ppSceneCard");
    card.append(element("h3", undefined, scene.title), element("p", undefined, scene.text));
    if (scene.extra) card.appendChild(element("p", "ppSceneExtra", scene.extra));
    if (scene.final) {
      card.appendChild(button("ppStart", t("intro.final.button"), () => showRegions()));
    } else {
      const next = button("ppNext", `${t(index === 0 ? "intro.scroll" : "intro.next")} ↓`, () => {
        sections[index + 1]?.scrollIntoView({ behavior: "smooth" });
      });
      card.appendChild(next);
    }
    section.appendChild(card);
    return section;
  });
  scroller.append(...sections);
  view.panel.classList.add("ppStory");
  view.panel.replaceChildren(scroller);

  introObserver?.disconnect();
  introObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const scene = list[Number((entry.target as HTMLElement).dataset.index)];
      sections.forEach((s) => s.classList.toggle("active", s === entry.target));
      applyMapState({ plain: scene.plain, focus: scene.focus });
      zoomTo(scene.focus ? groupViewBox(regionMembers(scene.focus)) : fullViewBox);
    }
  }, { root: scroller, threshold: 0.6 });
  sections.forEach((section) => introObserver!.observe(section));

  applyMapState({ plain: true });
  zoomTo(fullViewBox);
  scroller.focus({ preventScroll: true });
}

// --- Step 2: regions ---

function showRegions(): void {
  if (!view || !data) return;
  introObserver?.disconnect();
  introObserver = null;
  mode = "region";
  currentRegion = null;
  setHeader(t("picker.region_title"), t("picker.region_hint"));
  view.panel.classList.remove("ppStory");
  view.panel.replaceChildren(element("p", "ppPrompt", t("picker.region_pick")));
  applyMapState({});
  zoomTo(fullViewBox);
}

function showRegionCard(regionId: string): void {
  if (!view || !data) return;
  const region = data.regions.find((r) => r.id === regionId);
  if (!region) return;
  applyMapState({ focus: regionId });
  const count = regionMembers(regionId).length;
  const card = element("div", "ppDetail");
  const traits = element("dl", "ppTraits");
  traits.append(
    element("dt", undefined, t("picker.region_pros")), element("dd", undefined, t(`region.${regionId}.pros`)),
    element("dt", undefined, t("picker.region_cons")), element("dd", undefined, t(`region.${regionId}.cons`)),
  );
  card.append(
    element("h3", undefined, localName(region)),
    element("p", "ppSub", `${otherName(region)} · ${t("picker.region_provinces", { count })}`),
    element("p", undefined, t(`region.${regionId}.desc`)),
    traits,
    element("p", "ppSmall", t("picker.region_note")),
    button("ppStart", t("picker.region_go"), () => showProvinces(regionId)),
  );
  view.panel.replaceChildren(card);
}

// --- Step 3: provinces in one region ---

function showProvinces(regionId: string, selected: string | null = null): void {
  if (!view || !data) return;
  const region = data.regions.find((r) => r.id === regionId);
  if (!region) return;
  mode = "province";
  currentRegion = regionId;
  setHeader(`${t("picker.title")} · ${localName(region)}`, t("picker.hint"), { back: true });
  applyMapState({ focus: regionId, provinceNames: true, selected });
  zoomTo(groupViewBox(regionMembers(regionId)));

  if (selected) {
    showProvinceCard(selected);
    return;
  }
  const list = element("div", "ppNeighbors");
  const provinces = [...data.provinces.values()].filter((p) => p.region === regionId)
    .sort((a, b) => localName(a).localeCompare(localName(b), getLanguage()));
  for (const province of provinces) list.appendChild(button("ppNeighbor", localName(province), () => showProvinceCard(province.id)));
  view.panel.replaceChildren(element("p", "ppPrompt", t("picker.province_pick")), list);
}

function showProvinceCard(provinceId: string): void {
  if (!view || !data) return;
  const province = data.provinces.get(provinceId);
  if (!province) return;
  if (province.region !== currentRegion) {
    showProvinces(province.region, provinceId);
    return;
  }
  applyMapState({ focus: province.region, provinceNames: true, selected: provinceId });
  const region = data.regions.find((r) => r.id === province.region);
  const token = ++cardToken;

  const card = element("div", "ppDetail");
  card.append(
    element("h3", undefined, localName(province)),
    element("p", "ppSub", `${otherName(province)} · ${region ? localName(region) : ""}`),
  );
  const profile = element("div", "ppProfile", t("picker.loading"));
  card.appendChild(profile);

  card.appendChild(element("h4", undefined, t("picker.neighbors")));
  const neighbors = element("div", "ppNeighbors");
  for (const id of province.neighbors) {
    const neighbor = data.provinces.get(id);
    if (neighbor) neighbors.appendChild(button("ppNeighbor", localName(neighbor), () => showProvinceCard(id)));
  }
  card.appendChild(neighbors);

  card.appendChild(element("h4", undefined, t("picker.preview")));
  const preview = element("div", "ppPreview", t("picker.loading"));
  card.appendChild(preview);
  card.appendChild(button("ppStart", t("picker.start"), () => {
    close();
    startCallback(province.id);
  }));
  view.panel.replaceChildren(card);

  loadPreset(province.id).then((map) => {
    if (token !== cardToken) return; // The player has already picked another province
    const stars = difficultyStars(map.stats);
    const bonus = Math.round(fundsBonus(map.stats) * 100);
    const funds = element("div", "ppFunds");
    funds.append(element("span", undefined, t("picker.funds")), element("strong", undefined, money(startingFunds(map.stats))));
    if (bonus > 0) funds.appendChild(element("small", undefined, t("picker.funds_bonus", { pct: bonus })));
    const difficulty = element("div", "ppDifficulty");
    difficulty.append(
      element("span", undefined, t("picker.difficulty")),
      element("strong", "ppStars", "★".repeat(stars) + "☆".repeat(3 - stars)),
      element("small", undefined, t(`picker.difficulty.${stars}`)),
    );
    const chips = element("div", "ppChips");
    for (const resource of provinceResources(province.tags ?? [], map.stats)) {
      chips.appendChild(element("span", "ppChip", t(resource.key, resource.pct === undefined ? undefined : { pct: resource.pct })));
    }
    profile.replaceChildren(funds, difficulty, element("h4", undefined, t("picker.resources")), chips);

    const canvas = element("canvas");
    drawPresetMap(canvas, map, PREVIEW_PIXELS_PER_TILE);
    preview.replaceChildren(canvas);
  }).catch(() => {
    if (token !== cardToken) return;
    profile.textContent = "";
    preview.textContent = t("picker.no_preview");
  });
}

// --- Entry point ---

export function openProvincePicker(onStart: (provinceId: string) => void, options: PickerOptions = {}): void {
  startCallback = onStart;
  document.addEventListener("keydown", onKeyDown);
  view ??= buildShell();
  show(view.overlay);

  loadData().then((loaded) => {
    data = loaded;
    if (!view) return;
    if (!view.svg) buildMap();
    if (options.intro) showIntro();
    else showRegions();
  }).catch(() => {
    if (view) view.map.textContent = t("picker.load_failed");
  });
}
