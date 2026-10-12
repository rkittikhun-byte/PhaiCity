/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Small, quick tooltips over the game (owner, 12 Oct 2026: small words on screen, and what a thing is shown when the
// mouse points at it). Any element in the game with a title gets one: the title moves to data-tip, so the browser's
// slow tooltip does not show too, and a dark label appears beside the element after a short moment. Line breaks in
// the title (the tool buttons' descriptions) are kept. Windows and the start screen keep the browser's own.

const DELAY_MS = 120;
const GAP_PX = 8;

/** Where the label goes: under the element, or above it near the bottom of the window; kept inside the window. */
export function tipPosition(box: { left: number; top: number; width: number; height: number },
    tip: { width: number; height: number }, view: { width: number; height: number }): { left: number; top: number } {
  const below = box.top + box.height + GAP_PX;
  const top = below + tip.height > view.height - GAP_PX ? box.top - GAP_PX - tip.height : below;
  const centred = box.left + box.width / 2 - tip.width / 2;
  const left = Math.min(Math.max(GAP_PX, centred), view.width - tip.width - GAP_PX);
  return { left: Math.round(left), top: Math.round(Math.max(GAP_PX, top)) };
}

export function installHudTooltips(doc: Document = document): void {
  const tip = doc.createElement("div");
  tip.id = "hudTip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  doc.body.appendChild(tip);

  let timer: number | undefined;
  let current: HTMLElement | null = null;

  const hide = (): void => {
    window.clearTimeout(timer);
    current = null;
    tip.hidden = true;
  };

  doc.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[title], [data-tip]") : null;
    if (!target || target.closest(".modal, #provincePicker, #hudTip")) {
      if (current && !current.contains(event.target as Node)) hide();
      return;
    }
    // The game may have set a new title since (a language switch, a new price): it takes over the tip
    if (target.title) {
      target.dataset.tip = target.title;
      target.removeAttribute("title");
    }
    if (target === current) return;
    hide();
    current = target;
    timer = window.setTimeout(() => {
      if (current !== target || !target.dataset.tip || !target.isConnected) return;
      tip.textContent = target.dataset.tip;
      tip.hidden = false;
      const position = tipPosition(target.getBoundingClientRect(), tip.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight });
      tip.style.left = `${position.left}px`;
      tip.style.top = `${position.top}px`;
    }, DELAY_MS);
  });
  doc.addEventListener("mouseout", (event) => {
    if (current && !current.contains(event.relatedTarget as Node | null)) hide();
  });
  doc.addEventListener("mousedown", hide, true);
  doc.addEventListener("keydown", hide, true);
}
