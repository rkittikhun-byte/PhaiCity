/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Offline province picker (docs/ONLINE_PLAN.md phase 1, docs/geo/CODEX_PROMPTS.md G4): a full-screen
// map of Thailand built from real province shapes. Choosing a province calls onStart(provinceId).

import { groupCentroid, projectNationalMap, ProjectedProvince } from "./geo/nationalMap";
import { drawPresetMap, PresetMap } from "./geo/presetMap";
import { getLanguage, onLanguageChange, t } from "./i18n/index";

interface Province {
  id: string;
  nameTh: string;
  nameEn: string;
  region: string;
  neighbors: string[];
}

interface Region {
  id: string;
  nameTh: string;
  nameEn: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "provincePicker";
const PREVIEW_PIXELS_PER_TILE = 1;

const REGION_COLORS: Record<string, string> = {
  north: "#8cbf7a",
  northeast: "#e9c46a",
  central: "#f0a982",
  east: "#7fbfd4",
  west: "#b8a3d6",
  south: "#6cc3a9",
};

let overlay: HTMLElement | null = null;
let startCallback: (provinceId: string) => void = () => undefined;

// The picker is built in the current language; rebuild it after a language switch.
onLanguageChange(() => {
  overlay?.remove();
  overlay = null;
});

// Province and region names in the current language.
const localName = (item: { nameTh: string; nameEn: string }): string =>
  getLanguage() === "en" ? item.nameEn : item.nameTh;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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

function close(): void {
  if (overlay) overlay.hidden = true;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildShell(): { map: HTMLElement; hover: HTMLElement; detail: HTMLElement } {
  overlay = element("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ppTitle");

  // A div rather than <header>: the game's stylesheet gives every <header> the striped title bar
  const header = element("div", "ppHeader");
  const title = element("h2", undefined, t("picker.title"));
  title.id = "ppTitle";
  const closeButton = element("button", "ppClose", t("picker.close"));
  closeButton.type = "button";
  closeButton.addEventListener("click", close);
  header.append(title, element("p", "ppHint", t("picker.hint")), closeButton);

  const body = element("div", "ppBody");
  const mapWrap = element("div", "ppMapWrap");
  const map = element("div", "ppMap", t("picker.loading"));
  mapWrap.append(map, element("p", "ppNote", `${t("picker.note")} · ${t("picker.credits")}`));

  const panel = element("aside", "ppPanel");
  const hover = element("p", "ppHover");
  hover.setAttribute("aria-live", "polite");
  const detail = element("div", "ppDetail");
  panel.append(hover, detail);

  body.append(mapWrap, panel);
  overlay.append(header, body);
  document.body.appendChild(overlay);
  return { map, hover, detail };
}

function renderDetail(detail: HTMLElement, province: Province, regions: Map<string, Region>,
                      provinces: Map<string, Province>, select: (id: string) => void): void {
  detail.replaceChildren();
  const region = regions.get(province.region);
  detail.append(
    element("h3", undefined, localName(province)),
    element("p", "ppSub", `${getLanguage() === "en" ? province.nameTh : province.nameEn} ·${region ? localName(region) : ""}`),
    element("h4", undefined, t("picker.neighbors")),
  );

  const neighbors = element("div", "ppNeighbors");
  for (const id of province.neighbors) {
    const neighbor = provinces.get(id);
    if (!neighbor) continue;
    const button = element("button", "ppNeighbor", localName(neighbor));
    button.type = "button";
    button.addEventListener("click", () => select(id));
    neighbors.appendChild(button);
  }
  detail.appendChild(neighbors);

  detail.appendChild(element("h4", undefined, t("picker.preview")));
  const preview = element("div", "ppPreview", t("picker.loading"));
  detail.appendChild(preview);
  fetchJson<PresetMap>(`data/maps/${province.id}.json`).then((map) => {
    const canvas = element("canvas");
    drawPresetMap(canvas, map, PREVIEW_PIXELS_PER_TILE);
    preview.replaceChildren(canvas, element("p", "ppStats",
      `${t("picker.land")} ${percent(map.stats.land)} · ${t("picker.water")} ${percent(map.stats.water)} · ` +
      `${t("picker.woods")} ${percent(map.stats.woods)}`));
  }).catch(() => {
    preview.textContent = t("picker.no_preview");
  });

  const start = element("button", "ppStart", t("picker.start"));
  start.type = "button";
  start.addEventListener("click", () => {
    close();
    startCallback(province.id);
  });
  detail.appendChild(start);
}

function renderMap(container: HTMLElement, hover: HTMLElement, detail: HTMLElement,
                   topology: unknown, data: { regions: Region[]; provinces: Province[] }): void {
  const projected = projectNationalMap(topology);
  const provinces = new Map(data.provinces.map((p) => [p.id, p]));
  const regions = new Map(data.regions.map((r) => [r.id, r]));
  const paths = new Map<string, SVGElement>();

  const svg = svgElement("svg", { viewBox: projected.viewBox.join(" "), class: "ppSvg", role: "group" });

  const select = (id: string): void => {
    const province = provinces.get(id);
    if (!province) return;
    paths.forEach((path, pathId) => path.classList.toggle("selected", pathId === id));
    renderDetail(detail, province, regions, provinces, select);
  };

  for (const shape of projected.provinces) {
    const province = provinces.get(shape.id);
    if (!province) continue;
    const path = svgElement("path", {
      d: shape.path,
      class: "ppProvince",
      fill: REGION_COLORS[province.region] ?? "#ccc",
      tabindex: "0",
      role: "button",
      "aria-label": localName(province),
    });
    const title = svgElement("title", {});
    title.textContent = localName(province);
    path.appendChild(title);
    path.addEventListener("mouseenter", () => {
      const region = regions.get(province.region);
      hover.textContent = `${localName(province)} · ${region ? localName(region) : ""}`;
    });
    path.addEventListener("click", () => select(province.id));
    path.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
        event.preventDefault();
        select(province.id);
      }
    });
    paths.set(province.id, path);
    svg.appendChild(path);
  }

  for (const region of data.regions) {
    const members: ProjectedProvince[] = projected.provinces.filter((p) => provinces.get(p.id)?.region === region.id);
    const [x, y] = groupCentroid(members);
    const label = svgElement("text", { x: x.toFixed(1), y: y.toFixed(1), class: "ppRegionLabel" });
    label.textContent = localName(region);
    svg.appendChild(label);
  }

  container.replaceChildren(svg);
}

export function openProvincePicker(onStart: (provinceId: string) => void): void {
  startCallback = onStart;
  document.addEventListener("keydown", onKeyDown);

  if (overlay) {
    overlay.hidden = false;
    return;
  }

  const { map, hover, detail } = buildShell();
  Promise.all([
    fetchJson<{ regions: Region[]; provinces: Province[] }>("data/thailand-provinces.json"),
    fetchJson<unknown>("data/geo/thailand-provinces.topo.json"),
  ]).then(([data, topology]) => {
    renderMap(map, hover, detail, topology, data);
  }).catch(() => {
    map.textContent = t("picker.load_failed");
  });
}
