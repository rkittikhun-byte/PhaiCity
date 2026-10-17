/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { onLanguageChange, t } from "./i18n/index.js";
import { TOOL_CHOICES_CHANGED, TOOL_GROUP_EVENT, toolChoicesFor } from "./toolLevels.js";
import { TOOL_LABELS_CHANGED, toolIconUrl, toolLabel } from "./toolShortcuts.js";
import { hide, show } from "./motion.js";

export interface ToolCategory { id: string; icon: string; tools: readonly string[] }
/** Every original game button belongs to exactly one category. Prices and choices stay with the game. */
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  { id: "roads", icon: "road", tools: ["road", "rail", "bus_stop", "port"] },
  { id: "zones", icon: "residential", tools: ["residential", "commercial", "industrial"] },
  { id: "services", icon: "coal", tools: ["coal", "waterworks", "landfill", "police", "primary_school", "health_centre"] },
  { id: "resources", icon: "mine", tools: ["farm", "mine"] },
  { id: "city", icon: "ruler_house", tools: ["ruler_house", "land", "park", "stadium"] },
  { id: "bulldoze", icon: "bulldozer", tools: ["bulldozer"] },
  { id: "info", icon: "query", tools: ["query"] },
];
export const TOOL_GROUP_LABELS = new Set(["coal", "waterworks", "landfill", "police", "primary_school", "health_centre",
  "bus_stop", "port", "farm", "mine", "road", "ruler_house"]);
export function categoryForTool(tool: string): ToolCategory | undefined {
  return TOOL_CATEGORIES.find(category => category.tools.includes(tool));
}
function attribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
function toggle(element: HTMLElement, name: string, value: boolean): void {
  if (element.classList.contains(name) !== value) element.classList.toggle(name, value);
}

/** A category opens a tray; a family opens the side panel; an actual card arms the existing input handler. */
export function installToolDock(doc: Document = document): void {
  const controls = doc.getElementById("controls"), buttons = doc.getElementById("buttons");
  const categories = doc.getElementById("toolCategories");
  if (!controls || !buttons || !categories || controls.dataset.dockInstalled) return;
  controls.dataset.dockInstalled = "true"; doc.body.classList.add("toolDockReady");
  const originals = [...buttons.querySelectorAll<HTMLButtonElement>(".toolButton[data-tool]")];
  const source = (tool: string): HTMLButtonElement | undefined => originals.find(button => button.dataset.tool === tool);
  let current: string | null = null, lastActive = "";
  const tray = doc.createElement("section"); tray.id = "toolTray"; tray.hidden = true;
  tray.setAttribute("aria-labelledby", "toolTrayTitle");
  const heading = doc.createElement("header"); heading.className = "toolTrayHeader";
  const title = doc.createElement("span"); title.id = "toolTrayTitle";
  const close = doc.createElement("button"); close.type = "button"; close.className = "toolTrayClose"; close.textContent = "×";
  heading.append(title, close); buttons.before(tray); tray.append(heading, buttons);
  const nav = new Map<string, HTMLButtonElement>();
  const collapseChoices = (): void => { doc.dispatchEvent(new CustomEvent(TOOL_GROUP_EVENT, { detail: null })); };
  const activateOriginal = (button: HTMLButtonElement): void => {
    button.dataset.choiceActivating = "true";
    try { button.click(); } finally { delete button.dataset.choiceActivating; }
  };
  const openTray = (category: string): void => { current = category; show(tray); refresh(); };

  for (const category of TOOL_CATEGORIES) {
    const button = doc.createElement("button"); button.type = "button"; button.className = "toolCategory";
    button.dataset.category = category.id; button.setAttribute("aria-controls", "toolTray");
    const image = doc.createElement("img"); image.src = toolIconUrl(category.icon); image.alt = ""; image.draggable = false;
    const label = doc.createElement("span"); button.append(image, label); categories.append(button); nav.set(category.id, button);
    button.addEventListener("click", () => {
      collapseChoices();
      const only = category.tools.length === 1 ? source(category.tools[0]) : undefined;
      if (only && !toolChoicesFor(category.tools[0])?.length) {
        current = category.id; hide(tray, true); if (!only.disabled && !only.hidden) activateOriginal(only); refresh(); return;
      }
      if (current === category.id && !tray.hidden) { hide(tray, true); refresh(); }
      else openTray(category.id);
    });
  }

  function refresh(): void {
    const armed = originals.find(button => button.classList.contains("selected"));
    const active = armed ? `${armed.dataset.tool}:${armed.dataset.activeTool ?? armed.dataset.tool}` : "";
    if (active !== lastActive) {
      lastActive = active;
      if (armed) current = categoryForTool(armed.dataset.tool ?? "")?.id ?? current;
    }
    const panel = doc.getElementById("toolLevels");
    for (const button of originals) {
      const group = button.dataset.tool ?? "", family = toolChoicesFor(group), hasChoices = Boolean(family?.length);
      button.dataset.hasChoices = String(hasChoices);
      toggle(button, "dockHidden", categoryForTool(group)?.id !== current);
      toggle(button, "browsing", !panel?.hidden && panel?.dataset.group === group);
      attribute(button, "aria-pressed", String(button === armed));
      if (hasChoices) {
        attribute(button, "aria-controls", "toolLevels");
        attribute(button, "aria-expanded", String(!panel?.hidden && panel?.dataset.group === group));
      }
      const name = button.querySelector<HTMLElement>(".toolName");
      if (name && TOOL_GROUP_LABELS.has(group)) name.textContent = t(`dock.group.${group}`);
      let caption = button.querySelector<HTMLElement>(".toolSelection");
      if (hasChoices && !caption) { caption = doc.createElement("span"); caption.className = "toolSelection"; button.append(caption); }
      if (caption) caption.textContent = button.disabled ? t(`choice.none.${group}`) :
        hasChoices ? toolLabel(button.dataset.activeTool ?? group).name : "";
    }
    for (const category of TOOL_CATEGORIES) {
      const button = nav.get(category.id)!;
      button.querySelector("span")!.textContent = t(`dock.category.${category.id}`);
      const image = button.querySelector("img")!;
      const nextIcon = toolIconUrl(category.icon); if (image.getAttribute("src") !== nextIcon) image.src = nextIcon;
      const highlighted = current === category.id;
      toggle(button,"current",highlighted); toggle(button,"hasTool",Boolean(armed && category.tools.includes(armed.dataset.tool ?? "")));
      toggle(button,"goalHint",originals.some(original => category.tools.includes(original.dataset.tool ?? "") && original.classList.contains("goalHint")));
      attribute(button,"aria-expanded",String(highlighted && !tray.hidden));
      attribute(button,"aria-pressed",String(highlighted));
    }
    title.textContent = current ? t(`dock.category.${current}`) : t("dock.categories");
    close.title = t("dock.close_tray"); close.setAttribute("aria-label",close.title);
    const activeLabel = doc.getElementById("activeToolLabel"), cancel = doc.getElementById("toolCancel");
    if (activeLabel) activeLabel.textContent = armed ? t("dock.active", { name: toolLabel(armed.dataset.activeTool ?? armed.dataset.tool!).name }) : t("dock.choose_category");
    if (cancel) cancel.hidden = !armed;
  }
  buttons.addEventListener("click", (event) => {
    const target = (event.target as Element | null)?.closest<HTMLButtonElement>(".toolButton[data-tool]");
    if (!target || target.disabled || target.dataset.choiceActivating) return;
    const group = target.dataset.tool!, category = categoryForTool(group);
    if (toolChoicesFor(group)?.length) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (category) openTray(category.id);
      doc.dispatchEvent(new CustomEvent(TOOL_GROUP_EVENT, { detail: group })); refresh();
      if (doc.defaultView?.matchMedia("(max-width: 700px)").matches) { hide(tray,true); refresh(); }
    } else { collapseChoices(); if (category) current = category.id; }
  }, true);
  close.addEventListener("click", () => { hide(tray,true); collapseChoices(); refresh(); });
  doc.getElementById("toolCancel")?.addEventListener("click", () => {
    const selected = originals.find(button => button.classList.contains("selected"));
    if (selected) activateOriginal(selected); collapseChoices(); refresh();
  });
  doc.addEventListener("keydown", event => {
    if (event.code === "Escape") {
      const panel = doc.getElementById("toolLevels");
      const hadOpenMenus = !tray.hidden || (panel && !panel.hidden);
      hide(tray, true);
      collapseChoices();
      if (!hadOpenMenus) {
        const selected = originals.find(button => button.classList.contains("selected"));
        if (selected) activateOriginal(selected);
      }
      refresh();
    }
  });
  doc.addEventListener(TOOL_LABELS_CHANGED, refresh);
  doc.addEventListener(TOOL_CHOICES_CHANGED, refresh);
  doc.addEventListener(TOOL_GROUP_EVENT, refresh);
  new MutationObserver(refresh).observe(buttons, { subtree: true, attributes: true, attributeFilter: ["class", "disabled", "hidden", "data-active-tool"] });
  new MutationObserver(refresh).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
  onLanguageChange(refresh); refresh();
}
