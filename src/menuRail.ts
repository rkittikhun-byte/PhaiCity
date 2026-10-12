/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's menu as a strip of icons against the left edge of the screen (owner, 12 Oct 2026). Pointing at an icon
// slides out its name; a click opens its card: the city card, or the window the menu button always opened. Resting
// on another icon puts the open card away, as a click outside it would. The buttons keep their ids, so the game's
// handlers (src/inputStatus.js) are unchanged.

import { onLanguageChange, t } from "./i18n/index";
import { hide, isShown, show } from "./motion";

// Small line drawings in the button's colour (emoji are missing from some fonts)
const svg = (body: string, className = ""): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" ` +
  `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ""}>${body}</svg>`;

export const RAIL_ICONS: Record<string, string> = {
  cityRequest: svg('<path d="M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13"/><path d="M13 11h3M13 15h3"/>'),
  budgetRequest: svg('<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/>' +
    '<path d="M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/>'),
  evalRequest: svg('<path d="M4 20h16"/><path d="M5 16l4.5-4.5 3 3L19 8"/><path d="M15 8h4v4"/>'),
  mapRequest: svg('<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  disasterRequest: svg('<path d="M12 3.5l9 16.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
  saveRequest: svg('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  settingsRequest: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  screenshotRequest: svg('<path d="M4 8h3.5l2-3h5l2 3H20v11H4z"/><circle cx="12" cy="13.3" r="3.3"/>'),
  pauseRequest: svg('<path d="M9 6v12M15 6v12"/>', "railPause") + svg('<path d="M8 5.5l11 6.5-11 6.5z"/>', "railPlay"),
  mainMenuRequest: svg('<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-5h4v5"/>'),
};

/** The windows each icon opens: they stay when their own icon is pointed at. */
export const RAIL_WINDOWS: Record<string, string[]> = {
  budgetRequest: ["budget"],
  evalRequest: ["evalWindow", "graphWindow"],
  mapRequest: ["mapWindow"],
  disasterRequest: ["disasterWindow"],
  saveRequest: ["saveWindow"],
  settingsRequest: ["settingsWindow"],
  screenshotRequest: ["screenshotWindow", "screenshotLinkWindow"],
  mainMenuRequest: ["mainMenuWindow"],
};

/** The keys that also press a menu button (src/toolShortcuts.ts), shown beside its name. */
const SHORTCUT_KEYS: Record<string, string> = { mapRequest: "M", pauseRequest: "P" };

/** How long the mouse rests on another icon before the open card goes away, so crossing an icon on the way to the
 * open window does not close it. */
export const SWITCH_DELAY_MS = 250;

/** The open card (or window) that a rest on this icon should put away, if any. */
export function cardToPutAway(icon: string, openWindows: readonly string[], cityCardOpen: boolean): "city" | string | null {
  if (cityCardOpen && icon !== "cityRequest") return "city";
  const own = RAIL_WINDOWS[icon] ?? [];
  return openWindows.find((id) => !own.includes(id)) ?? null;
}

function openWindows(doc: Document): string[] {
  return [...doc.querySelectorAll<HTMLElement>(".modal")].filter((modal) => isShown(modal)).map((modal) => modal.id);
}

export function installMenuRail(doc: Document = document): void {
  const rail = doc.getElementById("miscButtons");
  const cityCard = doc.getElementById("infobar");
  const opaque = doc.getElementById("opaque");
  if (!rail || !cityCard) return;
  const buttons = [...rail.querySelectorAll<HTMLButtonElement>(".miscButton")];

  // Each button: its icon, and its name in a label that slides out when pointed at
  for (const button of buttons) {
    const key = button.dataset.i18n;
    button.removeAttribute("data-i18n");
    button.removeAttribute("data-i18n-title");
    button.removeAttribute("title");
    const icon = doc.createElement("span");
    icon.className = "railIcon";
    icon.innerHTML = RAIL_ICONS[button.id] ?? "";
    const label = doc.createElement("span");
    label.className = "railLabel";
    const name = doc.createElement("span");
    if (key) {
      name.dataset.i18n = key;
      name.textContent = t(key);
    }
    label.appendChild(name);
    const shortcut = SHORTCUT_KEYS[button.id];
    if (shortcut) {
      const kbd = doc.createElement("kbd");
      kbd.textContent = shortcut;
      label.appendChild(kbd);
    }
    button.replaceChildren(icon, label);
  }
  const name = (): void => buttons.forEach((button) => {
    button.setAttribute("aria-label", button.querySelector(".railLabel > span")?.textContent ?? "");
  });
  name();
  onLanguageChange(name);

  // The city card opens beside its icon, and goes away with a click outside it or Esc
  const cityButton = doc.getElementById("cityRequest");
  const cityOpen = (): boolean => isShown(cityCard) && cityCard.classList.contains("railCard");
  const setCity = (open: boolean): void => {
    if (open === cityOpen()) return;
    if (open && cityButton) {
      cityCard.style.top = `${rail.offsetTop + cityButton.offsetTop}px`;
      cityCard.classList.add("railCard");
      show(cityCard, "block");
    } else {
      hide(cityCard);
    }
    refreshActive();
  };
  cityButton?.addEventListener("click", () => setCity(!cityOpen()));
  doc.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (cityOpen() && !cityCard.contains(target) && !cityButton?.contains(target)) setCity(false);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setCity(false);
  });

  // Puts away the open card or window another icon leaves behind: a window closes as a click outside it would
  const putAway = (icon: string): void => {
    const away = cardToPutAway(icon, openWindows(doc), cityOpen());
    if (away === "city") setCity(false);
    else if (away !== null) opaque?.click();
  };
  let timer: number | undefined;
  for (const button of buttons) {
    button.addEventListener("mouseenter", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => putAway(button.id), SWITCH_DELAY_MS);
    });
    button.addEventListener("mouseleave", () => window.clearTimeout(timer));
  }
  // A click on another icon first puts the open one away, so its own window can open (the game opens one at a time)
  rail.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>(".miscButton");
    if (button) {
      window.clearTimeout(timer);
      putAway(button.id);
    }
  }, true);

  // The icon whose card or window is open stays lit
  const refreshActive = (): void => {
    const open = openWindows(doc);
    for (const button of buttons) {
      const active = button.id === "cityRequest" ? cityOpen() : (RAIL_WINDOWS[button.id] ?? []).some((id) => open.includes(id));
      button.classList.toggle("active", active);
    }
  };
  const watch = new MutationObserver(refreshActive);
  for (const modal of doc.querySelectorAll(".modal")) watch.observe(modal, { attributes: true, attributeFilter: ["style", "class"] });
  watch.observe(cityCard, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
}
