/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Keyboard shortcuts in the game: 1–9 pick the most used tools and P pauses or resumes time.
// Keys are matched by their place on the keyboard (event.code), not the character they type, so they work with a
// Thai keyboard layout too. A shortcut just clicks the button, so selecting a tool works exactly as with the mouse.
// Arrows and WASD (panning) and Esc (close a window, drop the tool) stay with src/inputStatus.js and src/game.js.

import { onLanguageChange, t } from "./i18n/index";
import { DEFAULT_RULES, formatPrice, toolPrices } from "./provinceRules";
import { turnView } from "./viewControls";

// The prices on the tool buttons: the game's own until a city starts with its province's (src/provinceRules.ts)
let prices: Record<string, number> = toolPrices(DEFAULT_RULES);
let relabel: (() => void) | null = null;
export const TOOL_LABELS_CHANGED = "phaicity:toollabels";

/** "ที่อยู่อาศัย ฿100": a tool's name with its price in this province. */
export function toolName(tool: string): string {
  const price = prices[tool];
  return t(`tool.${tool}`, price === undefined ? undefined : { price: formatPrice(price) });
}

/** The name and the price apart, for the button: the price sits at its right edge. */
export function toolLabel(tool: string): { name: string; price: string } {
  const price = prices[tool];
  return { name: t(`tool.${tool}`, { price: "" }).trim(), price: price === undefined ? "" : formatPrice(price) };
}

/** Writes the tool buttons' names, prices and icons again: after a button's chosen tool changes. */
export function relabelTools(): void {
  relabel?.();
}

/** Shows a city's prices on the tool buttons. */
export function showToolPrices(next: Record<string, number>): void {
  prices = { ...next };
  relabel?.();
}

/** The key's label on screen, and the tool it picks: none now, every tool is picked by a click (owner, 15 Oct 2026:
 * "ไม่เอาปุ่มเลขลัด ทุกอย่างจะต้องคลิกๆ") */
export const TOOL_KEYS: ReadonlyArray<{ key: string; tool: string }> = [];

export const PAUSE_CODE = "KeyP";
export const MAP_CODE = "KeyM";
/** Q and E turn the 3D view (src/viewControls.ts). */
export const TURN_LEFT_CODE = "KeyQ";
export const TURN_RIGHT_CODE = "KeyE";
export const UNDO_CODE = "KeyZ";

/** What each tool does, for its tooltip: the About page's description (after its "Name: "), or a hint of its own. */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  residential: "about.zone.res",
  zone_farm: "about.zone.farm",
  commercial: "about.zone.com",
  industrial: "about.zone.ind",
  road: "about.infra.road_rail",
  rail: "about.infra.road_rail",
  canal: "tool.hint.canal",
  wire: "about.infra.wire",
  park: "about.building.park",
  bulldozer: "tool.hint.bulldozer",
  query: "tool.hint.query",
  police: "about.building.police",
  fire: "about.building.fire",
  coal: "about.building.coal",
  nuclear: "about.building.nuclear",
  stadium: "about.building.stadium",
  port: "about.building.port",
  airport: "about.building.airport",
  waterworks: "about.building.waterworks",
  watertower: "about.building.watertower",
  gas: "about.building.gas",
  hydro: "about.building.hydro",
  solar: "about.building.solar",
  wind: "about.building.wind",
  mine: "about.building.mines",
  limestone_mine: "about.building.mines",
  potash_mine: "about.building.mines",
  tin_mine: "about.building.mines",
  zinc_mine: "about.building.mines",
  gold_mine: "about.building.mines",
  gem_mine: "about.building.mines",
  rare_earth_mine: "about.building.mines",
  lignite_mine: "about.building.mines",
  oil_well: "about.building.mines",
  farm: "about.building.farm",
  road_asphalt: "about.infra.road_levels",
  road_concrete2: "about.infra.road_levels",
  road_concrete4: "about.infra.road_levels",
  road_concrete6: "about.infra.road_levels",
  road_concrete8: "about.infra.road_levels",
  motorway: "about.infra.road_levels",
  tollway: "about.infra.road_levels",
  road_upgrade: "about.infra.road_levels",
  fishing: "about.building.fishing",
  ruler_house: "about.building.ruler_house",
  ruler_house_upgrade: "about.building.ruler_house",
  ruler_house_wings: "about.building.ruler_house_wings",
  ruler_house_policies: "about.building.ruler_policies",
  kindergarten: "about.building.education",
  primary_school: "about.building.education",
  secondary_school: "about.building.education",
  vocational_college: "about.building.education",
  university: "about.building.education",
  health_centre: "about.building.health",
  landfill: "about.building.waste",
  incinerator: "about.building.waste",
  recycling_plant: "about.building.waste",
  waste_power_plant: "about.building.waste",
  wastewater_plant: "about.building.waste",
  bus_stop: "about.building.transit",
  land: "about.building.land",
  train_station: "about.building.transit",
  metro_station: "about.building.transit",
  hsr_station: "about.building.transit",
  community_hospital: "about.building.health",
  provincial_hospital: "about.building.health",
  regional_hospital: "about.building.health",
};

/** "ที่อยู่อาศัย ฿100 (ปุ่มลัด 1)" on the first line, what the tool does on the second. */
// Which file each tool's icon uses (assets/icons/tools/manifest.json, Codex Prompt UI2): pictures rendered from the
// 3D models where there are some, the drawn SVGs of Prompt UI1 otherwise, and until the manifest has loaded
let iconFiles: Record<string, unknown> = {};
const ICON_FILE = /^[\w-]+\.(png|svg|webp)$/;

// Tools that wear another's icon: the zone brushes their zone's; the eraser has its own, an eraser rubbing a painted
// cell out, not the bulldozer's, which is what it was mistaken for (owner, 18 Oct 2026: "น่าจะมีปุ่มยกเลิกสีดี")
const ICON_OF: Readonly<Record<string, string>> = {
  zone_residential: "residential", zone_commercial: "commercial", zone_industrial: "industrial",
};

/** Where a tool's icon is (assets/icons/tools/, copied into the build as it is). */
export function toolIconUrl(tool: string): string {
  const name = ICON_OF[tool] ?? tool;
  const file = iconFiles[name];
  return `assets/icons/tools/${typeof file === "string" && ICON_FILE.test(file) ? file : `${name}.svg`}`;
}

/** Reads the icon manifest, if there is one yet, and shows the icons it names. */
function loadIconManifest(doc: Document): void {
  fetch("assets/icons/tools/manifest.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((manifest: unknown) => {
      if (!manifest || typeof manifest !== "object") return;
      iconFiles = manifest as Record<string, unknown>;
      doc.querySelectorAll<HTMLImageElement>(".toolButton[data-tool] .toolIcon img").forEach((img) => {
        const tool = img.closest<HTMLElement>(".toolButton")?.dataset.tool;
        if (tool) img.src = toolIconUrl(tool);
      });
    })
    .catch(() => undefined);
}

export function toolTitle(tool: string, key: string | null): string {
  const name = toolName(tool);
  const first = key ? t("shortcut.tool", { tool: name, key }) : name;
  const descriptionKey = TOOL_DESCRIPTIONS[tool];
  if (!descriptionKey) return first;
  const description = t(descriptionKey);
  const colon = description.indexOf(": ");
  return `${first}\n${colon > 0 ? description.slice(colon + 2) : description}`;
}

interface KeyLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** What a key press asks for, or null. Digits on the main row and on the number pad both count. */
export function shortcutFor(event: KeyLike):
    { tool: string } | { pause: true } | { map: true } | { turn: -1 | 1 } | { undo: true } | null {
  // Ctrl+Z (Cmd+Z on a Mac) undoes the last building
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === UNDO_CODE) {
    return { undo: true };
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  if (event.code === PAUSE_CODE) return { pause: true };
  if (event.code === MAP_CODE) return { map: true };
  if (event.code === TURN_LEFT_CODE) return { turn: -1 };
  if (event.code === TURN_RIGHT_CODE) return { turn: 1 };
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
  const entry = TOOL_KEYS.find((k) => k.key === digit);
  return entry ? { tool: entry.tool } : null;
}

/** True while the player types in a field, or a window or the start screen is in front of the city. */
function keysBelongElsewhere(doc: Document, target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))) return true;
  if (doc.body.classList.contains("starting")) return true;
  // Windows keep their "hidden" class while open (src/modalWindow.js shows them with an inline display)
  return [...doc.querySelectorAll<HTMLElement>(".modal")].some((modal) => getComputedStyle(modal).display !== "none");
}

export function installToolShortcuts(doc: Document = document): void {
  loadIconManifest(doc);
  // Each tool button shows its name and price, says what it does when pointed at, and shows its key if it has one
  const label = (): void => {
    doc.querySelectorAll<HTMLElement>(".toolButton[data-tool]").forEach((button) => {
      // A button with choices (src/toolLevels.ts) shows the one chosen; its key belongs to the button
      const tool = button.dataset.activeTool ?? button.dataset.tool as string;
      const key = TOOL_KEYS.find((k) => k.tool === button.dataset.tool)?.key ?? null;
      if (key) button.dataset.key = key;
      // A square in the tool's colour (its shortcut key inside) until the tool icons come, then the name and price
      button.style.setProperty("--tool", button.dataset.colour ?? "#888");
      const { name, price } = toolLabel(tool);
      // The tool's own picture (assets/icons/tools/, Codex Prompt UI1), its shortcut key in the corner
      const icon = doc.createElement("span");
      icon.className = "toolIcon";
      icon.setAttribute("aria-hidden", "true");
      const picture = doc.createElement("img");
      picture.src = toolIconUrl(tool);
      picture.alt = "";
      picture.draggable = false;
      // A tool whose icon is not drawn yet shows a square in its colour
      picture.addEventListener("error", () => icon.classList.add("noIcon"));
      picture.addEventListener("load", () => icon.classList.remove("noIcon"));
      icon.appendChild(picture);
      if (key) {
        const badge = doc.createElement("span");
        badge.className = "toolKey";
        badge.textContent = key;
        icon.appendChild(badge);
      }
      const nameSpan = doc.createElement("span");
      nameSpan.className = "toolName";
      nameSpan.textContent = name;
      const priceSpan = doc.createElement("span");
      priceSpan.className = "toolPrice";
      priceSpan.textContent = price;
      button.replaceChildren(icon, nameSpan, priceSpan);
      button.title = toolTitle(tool, key);
    });
    // The menu's pause and map buttons show their keys in the names that slide out of them (src/menuRail.ts)
    doc.dispatchEvent(new CustomEvent(TOOL_LABELS_CHANGED));
  };
  label();
  relabel = label;
  onLanguageChange(label);

  doc.addEventListener("keydown", (event) => {
    if (keysBelongElsewhere(doc, event.target)) return;
    const shortcut = shortcutFor(event);
    // Only turning repeats while its key is held
    if (!shortcut || (event.repeat && !("turn" in shortcut))) return;
    if ("turn" in shortcut) {
      if (turnView(shortcut.turn)) event.preventDefault();
      return;
    }
    const button = "tool" in shortcut ? doc.querySelector<HTMLElement>(`.toolButton[data-tool="${shortcut.tool}"]`)
      : "undo" in shortcut ? doc.getElementById("undoButton")
      : doc.getElementById("map" in shortcut ? "mapRequest" : "pauseRequest");
    if (!button || button.hidden || (button as HTMLButtonElement).disabled) return;
    event.preventDefault();
    button.click();
  });
}
