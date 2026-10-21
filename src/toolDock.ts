/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { onLanguageChange, t } from "./i18n/index.js";
import { TOOL_CHOICES_CHANGED, activateToolChoice, toolChoicesFor } from "./toolLevels.js";
import { TOOL_LABELS_CHANGED, toolIconUrl, toolLabel } from "./toolShortcuts.js";
import { hide, show } from "./motion.js";
import { modesFor, renderModes } from "./drawModes.js";

export interface ToolCategory { id: string; icon: string; tools: readonly string[] }

export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  { id: "city", icon: "ruler_house", tools: ["ruler_house", "land", "park", "stadium"] },
  { id: "zones", icon: "residential", tools: ["residential", "commercial", "industrial", "zone_farm"] },
  { id: "roads", icon: "road", tools: ["road", "rail", "canal", "bus_stop", "port"] },
  { id: "services", icon: "coal", tools: ["coal", "waterworks", "landfill", "police", "primary_school", "health_centre"] },
  { id: "resources", icon: "mine", tools: ["farm", "mine"] },
  { id: "bulldoze", icon: "bulldozer", tools: ["bulldozer"] },
  { id: "info", icon: "query", tools: ["query"] },
];

export const TOOL_GROUP_LABELS = new Set([
  "coal", "waterworks", "landfill", "police", "primary_school", "health_centre",
  "bus_stop", "port", "farm", "mine", "road", "ruler_house", "zone_farm",
]);

export function categoryForTool(tool: string): ToolCategory | undefined {
  return TOOL_CATEGORIES.find(category => category.tools.includes(tool));
}

function attribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function toggle(element: HTMLElement, name: string, value: boolean): void {
  if (element.classList.contains(name) !== value) element.classList.toggle(name, value);
}

/** A card's or button's tooltip (src/hudTooltip.ts; owner, 18 Oct 2026: "แค่บอกว่า tool นี้ คืออะไร ราคาเท่าไหร่ พอ"): what it
 * is, and its price when it has one */
function tip(element: HTMLElement, name: string, price = ""): void {
  attribute(element, "data-tip", price ? `${name} · ${price}` : name);
}

/**
 * Bottom dock and streamlined Fable-style interactive tray:
 * 1. Click category card on the dock
 * 2. Secondary tray appears with compact cards
 * 3. Clicking tool arms it and dismisses the tray immediately for uncluttered building.
 */
/** What puts the tool card away, once the dock is installed */
let trayCloser: (() => void) | null = null;

/** Puts the open tool card away, as its close button does: a right click on the map, which also puts the tool in hand
 * down (src/game.js cancelDraft; owner, 18 Oct 2026: "ถ้าคลิกขวา ให้ยกเลิก tool และ ซ่อน card ที่เปิดค้างไว้") */
export function closeToolTray(): void {
  trayCloser?.();
}

export function installToolDock(doc: Document = document): void {
  const controls = doc.getElementById("controls"), buttons = doc.getElementById("buttons");
  const categories = doc.getElementById("toolCategories");
  if (!controls || !buttons || !categories || controls.dataset.dockInstalled) return;
  controls.dataset.dockInstalled = "true";
  doc.body.classList.add("toolDockReady");

  const originals = [...buttons.querySelectorAll<HTMLButtonElement>(".toolButton[data-tool]")];
  const source = (tool: string): HTMLButtonElement | undefined => originals.find(b => b.dataset.tool === tool);

  let currentCategory: string | null = null;
  let currentGroup: string | null = null;
  let lastActive = "";

  // The Tray: floats directly above the dock
  const tray = doc.createElement("section");
  tray.id = "toolTray";
  tray.hidden = true;
  tray.setAttribute("aria-labelledby", "toolTrayTitle");

  const heading = doc.createElement("div");
  heading.className = "toolTrayHeader";

  const backBtn = doc.createElement("button");
  backBtn.type = "button";
  backBtn.className = "trayBack";
  backBtn.hidden = true;

  const titleWrap = doc.createElement("div");
  titleWrap.className = "trayTitleWrap";

  const trayIcon = doc.createElement("img");
  trayIcon.className = "trayIcon";
  trayIcon.alt = "";

  const title = doc.createElement("span");
  title.id = "toolTrayTitle";
  titleWrap.append(trayIcon, title);

  const modesWrap = doc.createElement("div");
  modesWrap.className = "trayModes";

  const close = doc.createElement("button");
  close.type = "button";
  close.className = "toolTrayClose";
  close.textContent = "×";
  close.setAttribute("aria-label", t("dock.close_tray"));

  heading.append(backBtn, titleWrap, modesWrap, close);

  const trayCards = doc.createElement("div");
  trayCards.className = "trayCards";

  tray.append(heading, trayCards);
  controls.before(tray);

  // Active Tool Pill (Capsule beside the dock)
  const pill = doc.createElement("div");
  pill.id = "activeToolPill";
  pill.hidden = true;

  const pillIcon = doc.createElement("img");
  pillIcon.className = "pillIcon";
  pillIcon.alt = "";

  const pillText = doc.createElement("span");
  pillText.className = "pillText";

  const pillEsc = doc.createElement("span");
  pillEsc.className = "pillEsc";
  pillEsc.textContent = "Esc";

  const pillCancel = doc.createElement("button");
  pillCancel.type = "button";
  pillCancel.className = "pillCancel";
  pillCancel.textContent = "×";
  pillCancel.setAttribute("aria-label", t("dock.cancel"));

  pill.append(pillIcon, pillText, pillEsc, pillCancel);
  controls.after(pill);

  const nav = new Map<string, HTMLButtonElement>();

  const activateOriginal = (button: HTMLButtonElement): void => {
    button.dataset.choiceActivating = "true";
    try { button.click(); } finally { delete button.dataset.choiceActivating; }
  };

  const closeTray = (): void => {
    currentCategory = null;
    currentGroup = null;
    hide(tray, true);
    refresh();
  };
  trayCloser = () => { if (!tray.hidden || currentCategory !== null) closeTray(); };

  const openTray = (catId: string, group: string | null = null): void => {
    currentCategory = catId;
    currentGroup = group;
    show(tray);
    renderTray();
    refresh();
  };

  // Build the 7 Category buttons on the bottom dock
  for (const category of TOOL_CATEGORIES) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "toolCategory";
    button.dataset.category = category.id;
    button.setAttribute("aria-controls", "toolTray");

    const imgWrap = doc.createElement("span");
    imgWrap.className = "catIconPlate";
    const image = doc.createElement("img");
    image.src = toolIconUrl(category.icon);
    image.alt = "";
    image.draggable = false;
    imgWrap.appendChild(image);

    const label = doc.createElement("span");
    label.className = "catLabel";
    button.append(imgWrap, label);
    categories.append(button);
    nav.set(category.id, button);

    button.addEventListener("click", () => {
      // 1-click tools without sub-choices (Bulldoze, Info)
      const only = category.tools.length === 1 ? source(category.tools[0]) : undefined;
      if (only && !toolChoicesFor(category.tools[0])?.length) {
        closeTray();
        if (!only.disabled && !only.hidden) activateOriginal(only);
        refresh();
        return;
      }
      if (currentCategory === category.id && !tray.hidden) {
        closeTray();
      } else {
        openTray(category.id, null);
      }
    });
  }

  // Render cards inside the Tray (Sub-groups or Tool Choices)
  function renderTray(): void {
    if (!currentCategory) return;
    const cat = TOOL_CATEGORIES.find(c => c.id === currentCategory);
    if (!cat) return;

    trayCards.replaceChildren();
    modesWrap.replaceChildren();

    if (currentGroup) {
      // LEVEL 2: Specific choices for currentGroup (e.g. power plants, road types, transit)
      backBtn.hidden = false;
      backBtn.textContent = `← ${t("dock.back")}`;
      title.textContent = t(`dock.group.${currentGroup}`);
      const iconUrl = toolIconUrl(currentGroup);
      if (trayIcon.getAttribute("src") !== iconUrl) trayIcon.src = iconUrl;

      // Draw modes for this group if applicable (e.g. road)
      if (modesFor(currentGroup).length > 0) {
        renderModes(modesWrap, currentGroup, doc);
      }

      // First card in Level 2 is back navigation
      const backCard = doc.createElement("button");
      backCard.type = "button";
      backCard.className = "trayCard trayBackCard";
      backCard.setAttribute("aria-label", t("dock.back"));
      tip(backCard, t("dock.back"));
      const bThumb = doc.createElement("div");
      bThumb.className = "cardThumb";
      bThumb.innerHTML = '<span style="font-size: 20px; font-weight: bold; color: var(--hud-text, #1d2925);">←</span>';
      backCard.appendChild(bThumb);
      backCard.addEventListener("click", () => {
        currentGroup = null;
        renderTray();
      });
      trayCards.appendChild(backCard);

      const choices = toolChoicesFor(currentGroup) ?? [];
      const orig = source(currentGroup);
      const activeTool = orig?.dataset.activeTool ?? orig?.dataset.tool;

      for (const choice of choices) {
        const houseLocked = doc.body.classList.contains("houseFirst") &&
          !["ruler_house", "bulldozer", "query", "road"].includes(currentGroup);
        const available = choice.available && !houseLocked;

        const card = doc.createElement("button");
        card.type = "button";
        // (a place the city cannot build yet stays open to pointing, which says why, src/unlocks.ts)
        const locked = Boolean(choice.locked) && !houseLocked;
        card.className = `trayCard${choice.tool === activeTool ? " is-active" : ""}${available ? "" : " unavailable"}${locked ? " locked" : ""}`;
        card.disabled = !available && !locked;
        card.dataset.tool = choice.tool;

        // Thumbnail box
        const thumb = doc.createElement("div");
        thumb.className = "cardThumb";
        const thumbImg = doc.createElement("img");
        thumbImg.src = toolIconUrl(choice.tool);
        thumbImg.alt = "";

        // Price badge
        const price = toolLabel(choice.tool).price;
        const badge = doc.createElement("span");
        badge.className = "cardPrice";
        const why = houseLocked ? t("dock.house_first") : choice.reasonText ?? t(choice.reason ?? "choice.unavailable");
        badge.textContent = !available ? why : choice.noteText ?? (choice.note ? t(choice.note) : price);

        thumb.append(thumbImg, badge);

        // Label
        const name = doc.createElement("span");
        name.className = "cardName";
        name.textContent = t(`choice.${choice.tool}`);

        card.append(thumb, name);
        card.setAttribute("aria-label", t(`choice.${choice.tool}`));
        tip(card, t(`choice.${choice.tool}`), available ? choice.noteText ?? price : why);

        card.addEventListener("click", () => {
          if (!available) return;
          if (orig) activateToolChoice(orig, choice, doc);
          renderTray();
        });

        trayCards.appendChild(card);
      }
    } else {
      // LEVEL 1: Groups/tools in category
      backBtn.hidden = true;
      title.textContent = t(`dock.category.${currentCategory}`);
      const iconUrl = toolIconUrl(cat.icon);
      if (trayIcon.getAttribute("src") !== iconUrl) trayIcon.src = iconUrl;

      // Draw modes for category if applicable (e.g. zones, roads)
      if (currentCategory === "zones" && modesFor("residential").length > 0) {
        renderModes(modesWrap, "zone_residential", doc);
      } else if (currentCategory === "roads" && modesFor("road").length > 0) {
        renderModes(modesWrap, "road", doc);
      }

      // Special handling for Zones: 4 direct tools (homes, shops, factories and the eraser)
      if (currentCategory === "zones") {
        const zoneItems = [
          { tool: "residential", paintTool: "zone_residential", icon: "residential", title: t("dock.zone.residential") },
          { tool: "commercial", paintTool: "zone_commercial", icon: "commercial", title: t("dock.zone.commercial") },
          { tool: "industrial", paintTool: "zone_industrial", icon: "industrial", title: t("dock.zone.industrial") },
          { tool: "zone_erase", paintTool: "zone_erase", icon: "zone_erase", title: t("dock.zone.erase") },
        ];

        for (const item of zoneItems) {
          const orig = source(item.tool === "zone_erase" ? "residential" : item.tool);
          const hasPainted = Boolean(toolChoicesFor(item.tool === "zone_erase" ? "residential" : item.tool)?.some(c => c.tool === item.paintTool));

          let isArmed = false;
          if (item.tool === "zone_erase") {
            isArmed = Boolean(orig?.classList.contains("selected") && orig?.dataset.activeTool === "zone_erase");
          } else {
            isArmed = Boolean(orig?.classList.contains("selected") && (orig?.dataset.activeTool ?? orig?.dataset.tool) === (hasPainted ? item.paintTool : item.tool));
          }

          const card = doc.createElement("button");
          card.type = "button";
          card.className = `trayCard${isArmed ? " is-active" : ""}`;
          card.dataset.tool = item.paintTool;
          card.setAttribute("aria-label", item.title);

          const thumb = doc.createElement("div");
          thumb.className = "cardThumb";
          const thumbImg = doc.createElement("img");
          thumbImg.src = toolIconUrl(item.icon);
          thumbImg.alt = "";

          const price = item.tool === "zone_erase" ? "฿0" : toolLabel(item.tool).price;
          if (price) {
            const badge = doc.createElement("span");
            badge.className = "cardPrice";
            badge.textContent = price;
            thumb.appendChild(badge);
          }
          thumb.appendChild(thumbImg);

          const name = doc.createElement("span");
          name.className = "cardName";
          name.textContent = item.title;

          card.append(thumb, name);
          tip(card, item.title, price);

          card.addEventListener("click", () => {
            if (!orig) return;
            if (item.tool === "zone_erase") {
              if (hasPainted) {
                activateToolChoice(orig, { tool: "zone_erase", available: true, size: 1, colour: "#8c8c8c" }, doc);
              } else {
                const bdozer = source("bulldozer");
                if (bdozer) activateOriginal(bdozer);
              }
            } else {
              if (hasPainted) {
                activateToolChoice(orig, { tool: item.paintTool, available: true, size: 1, colour: orig.dataset.colour }, doc);
              } else {
                activateOriginal(orig);
              }
            }
            renderTray();
          });

          trayCards.appendChild(card);
        }
      }

      // ... then the rest of the category's tools as cards of their own: in the zones, the farm zone's brush and eraser
      // (src/farmZone.ts), shown where homes, shops and factories are painted
      const zoneCards = currentCategory === "zones" ? new Set(["residential", "commercial", "industrial"]) : null;
      for (const toolId of cat.tools) {
        const orig = source(toolId);
        if (!orig || orig.hidden || zoneCards?.has(toolId)) continue;

        const family = toolChoicesFor(toolId);
        const hasChoices = Boolean(family?.length);
        const isArmed = orig.classList.contains("selected");
        // A tool the city cannot build yet (src/game.js refreshLocks): greyed with a lock, pointing at it says why
        const locked = orig.classList.contains("locked");

        const card = doc.createElement("button");
        card.type = "button";
        card.className = `trayCard${isArmed ? " is-active" : ""}${orig.disabled || locked ? " unavailable" : ""}${locked ? " locked" : ""}`;
        card.disabled = orig.disabled;
        card.dataset.tool = toolId;

        // Thumbnail box
        const thumb = doc.createElement("div");
        thumb.className = "cardThumb";
        const activeItem = orig.dataset.activeTool ?? toolId;
        const thumbImg = doc.createElement("img");
        thumbImg.src = toolIconUrl(activeItem);
        thumbImg.alt = "";

        const price = toolLabel(activeItem).price;
        if (price && !hasChoices) {
          const badge = doc.createElement("span");
          badge.className = "cardPrice";
          badge.textContent = price;
          thumb.appendChild(badge);
        } else if (hasChoices) {
          const badge = doc.createElement("span");
          badge.className = "cardPrice hasChoices";
          badge.textContent = price ? `${price} ▾` : t("dock.choose");
          thumb.appendChild(badge);
        }
        thumb.appendChild(thumbImg);

        // Label
        const name = doc.createElement("span");
        name.className = "cardName";
        name.textContent = TOOL_GROUP_LABELS.has(toolId) ? t(`dock.group.${toolId}`) : toolLabel(toolId).name;

        card.append(thumb, name);
        card.setAttribute("aria-label", TOOL_GROUP_LABELS.has(toolId) ? t(`dock.group.${toolId}`) : toolLabel(toolId).name);
        tip(card, locked ? orig.dataset.lockTitle ?? name.textContent ?? "" : name.textContent ?? "", locked ? "" : price);

        card.addEventListener("click", () => {
          if (orig.disabled || locked && !hasChoices) return;
          if (hasChoices) {
            // STEP 2: Transition sub-menu in the tray
            currentGroup = toolId;
            renderTray();
          } else {
            // Direct tool: arm it and CLOSE TRAY IMMEDIATELY!
            activateOriginal(orig);
            renderTray();
          }
        });

        trayCards.appendChild(card);
      }
    }
    heading.hidden = modesWrap.childElementCount === 0;
  }

  backBtn.addEventListener("click", () => {
    currentGroup = null;
    renderTray();
  });

  close.addEventListener("click", closeTray);

  function refresh(): void {
    const armed = originals.find(b => b.classList.contains("selected"));
    const active = armed ? `${armed.dataset.tool}:${armed.dataset.activeTool ?? armed.dataset.tool}` : "";
    if (active !== lastActive) {
      lastActive = active;
      if (armed) currentCategory = categoryForTool(armed.dataset.tool ?? "")?.id ?? currentCategory;
      const armedTool = armed ? (armed.dataset.activeTool ?? armed.dataset.tool ?? null) : null;
      doc.dispatchEvent(new CustomEvent("phaicity:active_tool_changed", {
        detail: {
          tool: armedTool,
          category: armed ? (categoryForTool(armed.dataset.tool ?? "")?.id ?? null) : null,
        }
      }));
    }

    // Update categories on the dock
    for (const category of TOOL_CATEGORIES) {
      const button = nav.get(category.id);
      if (!button) continue;
      button.querySelector<HTMLElement>(".catLabel")!.textContent = t(`dock.category.${category.id}`);
      tip(button, t(`dock.category.${category.id}`));
      const highlighted = currentCategory === category.id && !tray.hidden;
      toggle(button, "current", highlighted);
      toggle(button, "hasTool", Boolean(armed && category.tools.includes(armed.dataset.tool ?? "")));
      toggle(button, "goalHint", originals.some(o => category.tools.includes(o.dataset.tool ?? "") && o.classList.contains("goalHint")));
      attribute(button, "aria-expanded", String(highlighted));
      attribute(button, "aria-pressed", String(highlighted));
    }

    // Update Active Tool Pill
    if (armed) {
      const toolId = armed.dataset.activeTool ?? armed.dataset.tool!;
      const info = toolLabel(toolId);
      pillIcon.src = toolIconUrl(toolId);
      pillText.textContent = info.price ? `${info.name} · ${info.price}` : info.name;
      pillCancel.setAttribute("aria-label", t("dock.cancel"));
      show(pill);
    } else {
      hide(pill, true);
    }
  }

  const dropCurrentTool = (): void => {
    const selected = originals.find(b => b.classList.contains("selected"));
    if (selected) activateOriginal(selected);
    closeTray();
  };

  pillCancel.addEventListener("click", dropCurrentTool);
  doc.getElementById("toolCancel")?.addEventListener("click", dropCurrentTool);

  doc.addEventListener("keydown", event => {
    if (event.code === "Escape") {
      if (!tray.hidden) {
        if (currentGroup) {
          currentGroup = null;
          renderTray();
        } else {
          closeTray();
        }
      } else {
        dropCurrentTool();
      }
    }
  });

  doc.addEventListener(TOOL_LABELS_CHANGED, () => { renderTray(); refresh(); });
  doc.addEventListener(TOOL_CHOICES_CHANGED, () => { renderTray(); refresh(); });
  new MutationObserver(() => refresh()).observe(buttons, { subtree: true, attributes: true, attributeFilter: ["class", "disabled", "hidden", "data-active-tool"] });
  new MutationObserver(() => { renderTray(); refresh(); }).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
  onLanguageChange(() => { renderTray(); refresh(); });

  refresh();
}
