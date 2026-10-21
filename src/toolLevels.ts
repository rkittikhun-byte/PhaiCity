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
// The button takes the chosen tool's size and colour too (data-size, data-colour), for the outline under the mouse.
//
// Buttons that group tools (docs/TOOLS_PLAN.md, owner 13 Oct 2026) work the same way: safety (police, fire), water
// (water works, water tower), farms and harbours, and long-distance transport (port, airport); the power button
// holds the nuclear plant too. The tools that lost their own button keep their size and colour in the page's
// #toolChoices template (pageChoice).

import { renderModes } from "./drawModes";
import { onLanguageChange, t } from "./i18n/index";
import { hide, isShown, show } from "./motion";
import { relabelTools, toolIconUrl, toolLabel, toolTitle } from "./toolShortcuts";

/** How many level places each tool shows. */
export const LEVEL_SLOTS = 5;

/** The event that tells the game the button in hand now uses another tool; its detail is that tool's name. */
export const TOOL_CHOICE_EVENT = "phaicity:toolchoice";
export const TOOL_GROUP_EVENT = "phaicity:toolgroup";
export const TOOL_CHOICES_CHANGED = "phaicity:toolchoiceschanged";

export interface ToolChoice {
  /** The tool it uses (src/gameTools.js) */
  tool: string;
  /** Whether it may be used here: a kind of plant the province lacks may not */
  available: boolean;
  /** Its colour, for the square shown until its icon is drawn and the outline under the mouse */
  colour?: string;
  /** Its width in tiles, for the outline under the mouse; the button's own when left out */
  size?: number;
  /** What its place says in place of its price, a string key (the road upgrade: "one level at a time") */
  note?: string;
  /** Why it may not be used, a string key, in place of "Not in this province" (the house: "needs the rank ขุน") */
  reason?: string;
  /** ... or the reason in words, for a tool the city cannot build yet (src/unlockLabels.ts), which shows a lock */
  reasonText?: string;
  locked?: boolean;
  /** What its place says in place of its price, in words (a building's months as a construction site) */
  noteText?: string;
  /** What its place does instead of choosing a tool: the house's wings open the house's window */
  action?: () => void;
}

const choices = new Map<string, readonly ToolChoice[]>();
let rerender: (() => void) | null = null;
export function toolChoicesFor(group: string): readonly ToolChoice[] | undefined { return choices.get(group); }

/** Selecting a card arms the original game button once; choosing it again keeps the tool in hand. */
export function activateToolChoice(button: HTMLElement, choice: ToolChoice, doc: Document = document): void {
  if (!choice.available) return;
  if (choice.action) { choice.action(); return; }
  button.dataset.activeTool = choice.tool;
  wear(button, choice);
  relabelTools();
  if (!button.classList.contains("selected")) {
    button.dataset.choiceActivating = "true";
    try { button.click(); } finally { delete button.dataset.choiceActivating; }
  }
  doc.dispatchEvent(new CustomEvent(TOOL_CHOICE_EVENT, { detail: choice.tool }));
}

/** A button's own size and colour, kept the first time a choice changes them. */
function own(button: HTMLElement): { size: string; colour: string } {
  if (button.dataset.ownSize === undefined) button.dataset.ownSize = button.dataset.size ?? "1";
  if (button.dataset.ownColour === undefined) button.dataset.ownColour = button.dataset.colour ?? "";
  return { size: button.dataset.ownSize, colour: button.dataset.ownColour };
}

/** Gives the button the size and colour of the tool it now uses. */
function wear(button: HTMLElement, choice: ToolChoice | undefined): void {
  const mine = own(button);
  button.dataset.size = choice?.size !== undefined ? String(choice.size) : mine.size;
  button.dataset.colour = choice?.colour ?? mine.colour;
}

/**
 * A choice for a tool the page lists: a tool button, or a tool kept in the #toolChoices template because it sits in
 * another button's choices. Its size and colour come from there.
 */
export function pageChoice(tool: string, available = true, doc: Document = document): ToolChoice {
  const button = doc.querySelector<HTMLElement>(`.toolButton[data-tool="${tool}"]`);
  const template = doc.getElementById("toolChoices") as HTMLTemplateElement | null;
  const kept = template?.content?.querySelector<HTMLElement>(`[data-tool="${tool}"]`) ?? null;
  const source = button ? own(button) : { size: kept?.dataset.size ?? "", colour: kept?.dataset.colour ?? "" };
  const size = Number(source.size);
  return { tool, available, colour: source.colour || undefined, size: size > 0 ? size : undefined };
}

/**
 * Gives a tool button (by its data-tool) choices in place of levels. It keeps the one it uses while that may still be
 * used, else takes the first that may; with none at all (a province with no ore for the mine button) it is disabled.
 */
export function setToolChoices(group: string, list: readonly ToolChoice[], doc: Document = document): void {
  choices.set(group, list);
  const button = doc.querySelector<HTMLButtonElement>(`.toolButton[data-tool="${group}"]`);
  if (button) {
    // A place that does something else (an action) is never the tool the button uses, but keeps the button usable
    const usable = list.filter((choice) => choice.available && !choice.action);
    if (!usable.some((choice) => choice.tool === button.dataset.activeTool)) {
      if (usable.length > 0) button.dataset.activeTool = usable[0].tool;
      else delete button.dataset.activeTool;
    }
    wear(button, list.find((choice) => choice.tool === button.dataset.activeTool));
    button.disabled = !list.some((choice) => choice.available);
    relabelTools();
    if (button.disabled) button.title = t(`choice.none.${group}`);
  }
  rerender?.();
  doc.dispatchEvent?.(new CustomEvent(TOOL_CHOICES_CHANGED, { detail: group }));
}

/** Takes a button's choices away again: it shows its levels and uses its own tool (a city without painted zones). */
export function clearToolChoices(group: string, doc: Document = document): void {
  if (!choices.delete(group)) return;
  const button = doc.querySelector<HTMLButtonElement>(`.toolButton[data-tool="${group}"]`);
  if (button) {
    delete button.dataset.activeTool;
    wear(button, undefined);
    button.disabled = false;
    relabelTools();
  }
  rerender?.();
  doc.dispatchEvent?.(new CustomEvent(TOOL_CHOICES_CHANGED, { detail: group }));
}

export function installToolLevels(doc: Document = document): void {
  const card = doc.getElementById("toolLevels");
  const buttons = doc.getElementById("buttons");
  const title = card?.querySelector(".levelsTitle");
  const slots = card?.querySelector(".levelsSlots");
  // How the tool draws, for the tools that have modes (src/drawModes.ts)
  const modes = card?.querySelector<HTMLElement>(".levelsModes") ?? null;
  if (!card || !buttons || !title || !slots) return;
  let shownTool: string | null = null;
  let browsing: string | null = null, lastArmed: string | null = null, dismissed: string | null = null;

  /** The places of a tool with choices: each one a button. */
  const choiceSlots = (selected: HTMLElement, list: readonly ToolChoice[]): HTMLElement[] => {
    const active = selected.dataset.activeTool ?? selected.dataset.tool;
    return list.map((choice) => {
      const houseLocked = doc.body.classList.contains("houseFirst") &&
        !["ruler_house", "bulldozer", "query", "road"].includes(selected.dataset.tool ?? "");
      const available = choice.available && !houseLocked;
      const slot = doc.createElement("button");
      slot.type = "button";
      slot.className = `levelSlot choice${choice.tool === active && !choice.action ? " current" : ""}` +
        `${available ? "" : " unavailable"}${choice.locked && !houseLocked ? " locked" : ""}`;
      slot.disabled = !available;
      slot.dataset.toolChoice = choice.tool;
      slot.setAttribute("aria-pressed", String(choice.tool === active && !choice.action));
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
      const unavailable = houseLocked ? t("dock.house_first") : choice.reasonText ?? t(choice.reason ?? "choice.unavailable");
      note.textContent = !available ? unavailable : choice.noteText ?? (choice.note ? t(choice.note) : price);
      slot.title = available ? toolTitle(choice.tool, null) : `${name}: ${unavailable}`;
      slot.append(icon, label, note);
      slot.addEventListener("click", () => {
        if (!available) return;
        activateToolChoice(selected, choice, doc);
        render(true);
      });
      return slot;
    });
  };

  const render = (force = false): void => {
    const armed = buttons.querySelector<HTMLElement>(".toolButton.selected");
    const armedTool = armed?.dataset.tool ?? null;
    if (armedTool !== lastArmed) { browsing = armedTool; dismissed = null; lastArmed = armedTool; }
    const tool = browsing ?? armedTool;
    const selected = tool ? buttons.querySelector<HTMLElement>(`.toolButton[data-tool="${tool}"]`) : null;
    if (!selected || tool === null) {
      shownTool = null;
      hide(card, true);
      return;
    }
    const list = choices.get(tool);
    if (dismissed === tool || !list?.length) { hide(card, true); shownTool = null; return; }
    if (tool === shownTool && !force && isShown(card)) return;
    shownTool = tool;
    title.textContent = t(`choice.title.${tool}`);
    card.dataset.group = tool;
    slots.replaceChildren(...choiceSlots(selected, list));
    if (modes) renderModes(modes, selected.dataset.activeTool ?? tool, doc);
    show(card);
  };
  rerender = () => {
    if (shownTool !== null && isShown(card)) render(true);
  };
  doc.addEventListener(TOOL_GROUP_EVENT, (event) => {
    const group = (event as CustomEvent<string | null>).detail;
    if (group === null) {
      browsing = null; dismissed = lastArmed; shownTool = null; hide(card, true); return;
    }
    // Remember the armed tool independently of the group being browsed.
    lastArmed = buttons.querySelector<HTMLElement>(".toolButton.selected")?.dataset.tool ?? null;
    browsing = group; dismissed = null; render(true);
  });
  doc.getElementById("toolLevelsClose")?.addEventListener("click", () =>
    doc.dispatchEvent(new CustomEvent(TOOL_GROUP_EVENT, { detail: null })));

  // The game marks the tool in hand with a class on its button (src/inputStatus.js)
  new MutationObserver(() => render()).observe(buttons, { subtree: true, attributes: true, attributeFilter: ["class"] });
  onLanguageChange(() => render(true));
  new MutationObserver(() => render(true)).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
}
