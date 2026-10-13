/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The levels of the tool in hand (owner, 12 Oct 2026): picking a tool shows it again in a small card above the tools
// dock, with places for its levels, such as a road's laterite, asphalt and concrete. Only the first level exists for
// now, the tool as it is; the other places wait, empty, for the levels that the simulation (prices, upkeep, what they
// do) and the 3D models will bring. The card goes when the tool is put down.
//
// A tool can have choices instead (setToolChoices): the power button's places are its kinds of plant (owner,
// 13 Oct 2026; src/powerPlants.ts). Clicking one makes it the tool the button uses (its data-active-tool) and tells
// the game (the "phaicity:toolchoice" event, src/inputStatus.js); a kind the province cannot have waits, greyed.

import { onLanguageChange, t } from "./i18n/index";
import { hide, isShown, show } from "./motion";
import { relabelTools, toolIconUrl, toolLabel } from "./toolShortcuts";

/** How many level places each tool shows. */
export const LEVEL_SLOTS = 5;

/** The event that tells the game the button in hand now uses another tool; its detail is that tool's name. */
export const TOOL_CHOICE_EVENT = "phaicity:toolchoice";

export interface ToolChoice {
  /** The tool it uses (src/gameTools.js) */
  tool: string;
  /** Whether it may be used here: a kind of plant the province lacks may not */
  available: boolean;
  /** Its colour, for the square shown until its icon is drawn */
  colour?: string;
}

const choices = new Map<string, readonly ToolChoice[]>();
let rerender: (() => void) | null = null;

/**
 * Gives a tool button (by its data-tool) choices in place of levels. It keeps the one it uses while that may still be
 * used, else takes the first that may; with none at all (a province with no ore for the mine button) it is disabled.
 */
export function setToolChoices(group: string, list: readonly ToolChoice[], doc: Document = document): void {
  choices.set(group, list);
  const button = doc.querySelector<HTMLButtonElement>(`.toolButton[data-tool="${group}"]`);
  if (button) {
    const usable = list.filter((choice) => choice.available);
    if (!usable.some((choice) => choice.tool === button.dataset.activeTool)) {
      if (usable.length > 0) button.dataset.activeTool = usable[0].tool;
      else delete button.dataset.activeTool;
    }
    button.disabled = usable.length === 0;
    relabelTools();
    if (button.disabled) button.title = t(`choice.none.${group}`);
  }
  rerender?.();
}

export function installToolLevels(doc: Document = document): void {
  const card = doc.getElementById("toolLevels");
  const buttons = doc.getElementById("buttons");
  const title = card?.querySelector(".levelsTitle");
  const slots = card?.querySelector(".levelsSlots");
  if (!card || !buttons || !title || !slots) return;
  let shownTool: string | null = null;

  /** The places of a tool with choices: each one a button. */
  const choiceSlots = (selected: HTMLElement, list: readonly ToolChoice[]): HTMLElement[] => {
    const active = selected.dataset.activeTool ?? selected.dataset.tool;
    return list.map((choice) => {
      const slot = doc.createElement("button");
      slot.type = "button";
      slot.className = `levelSlot choice${choice.tool === active ? " current" : ""}${choice.available ? "" : " unavailable"}`;
      slot.disabled = !choice.available;
      slot.style.setProperty("--tool", choice.colour ?? selected.style.getPropertyValue("--tool"));
      const icon = doc.createElement("span");
      icon.className = "levelIcon";
      const box = doc.createElement("span");
      box.className = "toolIcon";
      const picture = doc.createElement("img");
      picture.alt = "";
      picture.draggable = false;
      picture.addEventListener("error", () => box.classList.add("noIcon"));
      picture.src = toolIconUrl(choice.tool);
      box.appendChild(picture);
      icon.appendChild(box);
      const { name, price } = toolLabel(choice.tool);
      const label = doc.createElement("span");
      label.className = "levelName";
      label.textContent = t(`choice.${choice.tool}`);
      const note = doc.createElement("span");
      note.className = "levelNote";
      note.textContent = choice.available ? price : t("choice.unavailable");
      slot.title = choice.available ? name : `${name}: ${t("choice.unavailable")}`;
      slot.append(icon, label, note);
      slot.addEventListener("click", () => {
        if (!choice.available) return;
        selected.dataset.activeTool = choice.tool;
        relabelTools();
        doc.dispatchEvent(new CustomEvent(TOOL_CHOICE_EVENT, { detail: choice.tool }));
        render(true);
      });
      return slot;
    });
  };

  /** The places of a tool with levels: the first the tool itself, the rest waiting. */
  const levelSlots = (selected: HTMLElement, price: string): HTMLElement[] =>
    Array.from({ length: LEVEL_SLOTS }, (_, index) => {
      const slot = doc.createElement("div");
      slot.className = index === 0 ? "levelSlot current" : "levelSlot empty";
      const icon = doc.createElement("span");
      icon.className = "levelIcon";
      if (index === 0) {
        const own = selected.querySelector(".toolIcon");
        if (own) icon.appendChild(own.cloneNode(true));
        slot.style.setProperty("--tool", selected.style.getPropertyValue("--tool") ?? "");
      }
      const label = doc.createElement("span");
      label.className = "levelName";
      label.textContent = t("levels.level", { n: index + 1 });
      const note = doc.createElement("span");
      note.className = "levelNote";
      note.textContent = index === 0 ? price : t("levels.soon");
      slot.append(icon, label, note);
      return slot;
    });

  const render = (force = false): void => {
    const selected = buttons.querySelector<HTMLElement>(".toolButton.selected");
    const tool = selected?.dataset.tool ?? null;
    if (!selected || tool === null) {
      shownTool = null;
      hide(card, true);
      return;
    }
    if (tool === shownTool && !force && isShown(card)) return;
    shownTool = tool;
    const list = choices.get(tool);
    const { name, price } = toolLabel(selected.dataset.activeTool ?? tool);
    title.textContent = list ? t(`choice.title.${tool}`) : name;
    slots.replaceChildren(...(list ? choiceSlots(selected, list) : levelSlots(selected, price)));
    show(card);
  };
  rerender = () => {
    if (shownTool !== null) render(true);
  };

  // The game marks the tool in hand with a class on its button (src/inputStatus.js)
  new MutationObserver(() => render()).observe(buttons, { subtree: true, attributes: true, attributeFilter: ["class"] });
  onLanguageChange(() => render(true));
}
