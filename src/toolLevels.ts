/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The levels of the tool in hand (owner, 12 Oct 2026): picking a tool shows it again in a small card above the tools
// dock, with places for its levels, such as a road's laterite, asphalt and concrete. Only the first level exists for
// now, the tool as it is; the other places wait, empty, for the levels that the simulation (prices, upkeep, what they
// do) and the 3D models will bring. The card goes when the tool is put down.

import { onLanguageChange, t } from "./i18n/index";
import { hide, isShown, show } from "./motion";
import { toolLabel } from "./toolShortcuts";

/** How many level places each tool shows. */
export const LEVEL_SLOTS = 5;

export function installToolLevels(doc: Document = document): void {
  const card = doc.getElementById("toolLevels");
  const buttons = doc.getElementById("buttons");
  const title = card?.querySelector(".levelsTitle");
  const slots = card?.querySelector(".levelsSlots");
  if (!card || !buttons || !title || !slots) return;
  let shownTool: string | null = null;

  const render = (force = false): void => {
    const selected = buttons.querySelector<HTMLElement>(".toolButton.selected");
    const tool = selected?.dataset.tool ?? null;
    if (tool === null) {
      shownTool = null;
      hide(card, true);
      return;
    }
    if (tool === shownTool && !force && isShown(card)) return;
    shownTool = tool;
    const { name, price } = toolLabel(tool);
    title.textContent = name;
    slots.replaceChildren(...Array.from({ length: LEVEL_SLOTS }, (_, index) => {
      const slot = doc.createElement("div");
      slot.className = index === 0 ? "levelSlot current" : "levelSlot empty";
      const icon = doc.createElement("span");
      icon.className = "levelIcon";
      if (index === 0) {
        const own = selected?.querySelector(".toolIcon");
        if (own) icon.appendChild(own.cloneNode(true));
        slot.style.setProperty("--tool", selected?.style.getPropertyValue("--tool") ?? "");
      }
      const label = doc.createElement("span");
      label.className = "levelName";
      label.textContent = t("levels.level", { n: index + 1 });
      const note = doc.createElement("span");
      note.className = "levelNote";
      note.textContent = index === 0 ? price : t("levels.soon");
      slot.append(icon, label, note);
      return slot;
    }));
    show(card);
  };

  // The game marks the tool in hand with a class on its button (src/inputStatus.js)
  new MutationObserver(() => render()).observe(buttons, { subtree: true, attributes: true, attributeFilter: ["class"] });
  onLanguageChange(() => render(true));
}
