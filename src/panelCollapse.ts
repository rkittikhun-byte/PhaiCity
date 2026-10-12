/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every floating game panel can slide away to its side of the screen, leaving a small handle to bring it
// back, so the player can see more of the city. The choice is remembered between visits.

import { onLanguageChange, t } from "./i18n/index";

const STORAGE_KEY = "phaicity.collapsedPanels";

const PANELS: Array<{ id: string; side: "left" | "right" }> = [
  { id: "infobar", side: "left" },
  { id: "miscButtons", side: "left" },
  { id: "RCIContainer", side: "left" },
  { id: "controls", side: "right" },
  { id: "rulerGoals", side: "right" },
];

function loadCollapsed(): Set<string> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Remembered for this page only
  }
}

/** The handle's arrow points the way the panel will move. */
export function handleArrow(side: "left" | "right", collapsed: boolean): string {
  return (side === "left") === collapsed ? "›" : "‹";
}

export function installPanelCollapse(doc: Document = document): void {
  const collapsed = loadCollapsed();
  const renders: Array<() => void> = [];

  for (const { id, side } of PANELS) {
    const panel = doc.getElementById(id);
    if (!panel) continue;
    panel.classList.add("collapsible", side === "left" ? "fromLeft" : "fromRight");
    panel.classList.toggle("collapsed", collapsed.has(id));

    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "panelToggle";
    const render = (): void => {
      const isCollapsed = panel.classList.contains("collapsed");
      toggle.textContent = handleArrow(side, isCollapsed);
      toggle.title = t(isCollapsed ? "ui.expand" : "ui.collapse");
      toggle.setAttribute("aria-label", toggle.title);
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    };
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (panel.classList.toggle("collapsed")) collapsed.add(id);
      else collapsed.delete(id);
      saveCollapsed(collapsed);
      render();
    });
    panel.appendChild(toggle);
    render();
    renders.push(render);
  }

  onLanguageChange(() => renders.forEach((render) => render()));
}
