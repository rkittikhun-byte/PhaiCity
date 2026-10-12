/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The demand bars, the tools and the ruler's tasks sit against their side of the screen and can slide away, so the
// player can see more of the city. A slid-away panel leaves a small tab with its icon sticking out of the screen
// edge, and a click on the tab brings it back (owner, 12 Oct 2026). The choice is remembered between visits.

import { onLanguageChange, t } from "./i18n/index";

const STORAGE_KEY = "phaicity.collapsedPanels";

// Small line drawings in the panel's text colour (emoji are missing from some fonts)
const svg = (body: string): string =>
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" ' +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const PANEL_ICONS = {
  demand: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
  tools: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/>' +
    '<rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  goals: svg('<path d="M4 7l2 2 3-3.5M4 15l2 2 3-3.5M12 8h8M12 16h8"/>'),
};

// The city card and the menu are not here: they became the icon strip on the left (src/menuRail.ts)
const PANELS: Array<{ id: string; side: "left" | "right"; icon: keyof typeof PANEL_ICONS }> = [
  { id: "RCIContainer", side: "left", icon: "demand" },
  { id: "controls", side: "right", icon: "tools" },
  { id: "rulerGoals", side: "right", icon: "goals" },
];

// How each installed panel slides away or comes back, for other code (the tasks card's own button)
const setters = new Map<string, (collapsed: boolean) => void>();

/** Slides a panel away to its tab, or brings it back, as a click on its handle would. */
export function setPanelCollapsed(id: string, collapsed: boolean): void {
  setters.get(id)?.(collapsed);
}

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

  for (const { id, side, icon } of PANELS) {
    const panel = doc.getElementById(id);
    if (!panel) continue;
    panel.classList.add("collapsible", side === "left" ? "fromLeft" : "fromRight");
    panel.classList.toggle("collapsed", collapsed.has(id));

    // Open, the handle is a small arrow in the panel's corner; slid away, it is the tab with the panel's icon
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "panelToggle";
    const render = (): void => {
      const isCollapsed = panel.classList.contains("collapsed");
      if (isCollapsed) toggle.innerHTML = PANEL_ICONS[icon];
      else toggle.textContent = handleArrow(side, false);
      toggle.title = t(isCollapsed ? "ui.show_panel" : "ui.hide_panel", { name: t(`panel.${icon}`) });
      toggle.setAttribute("aria-label", toggle.title);
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    };
    const set = (isCollapsed: boolean): void => {
      panel.classList.toggle("collapsed", isCollapsed);
      if (isCollapsed) collapsed.add(id);
      else collapsed.delete(id);
      saveCollapsed(collapsed);
      render();
    };
    setters.set(id, set);
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      set(!panel.classList.contains("collapsed"));
    });
    panel.appendChild(toggle);
    render();
    renders.push(render);
  }

  onLanguageChange(() => renders.forEach((render) => render()));
}
