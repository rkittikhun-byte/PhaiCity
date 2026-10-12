/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The map's credit line (© OpenStreetMap contributors, modified from micropolisJS, a link to every credit) shows when
// a city opens, then tucks itself behind a © button at the bottom left after a few seconds, or as soon as the player
// starts working on the map; the button brings it back (owner, 12 Oct 2026). This is what the OpenStreetMap
// Foundation's attribution guidelines allow for interactive maps: shown at first, collapsed after five seconds or on
// map interaction, and easy to find again.

/** How long the line stays out before tucking itself away: more than the guidelines' five seconds. */
export const CREDIT_SHOWN_MS = 8000;

export function installCreditLine(doc: Document = document): void {
  const line = doc.getElementById("mapAttribution");
  const button = doc.getElementById("creditToggle");
  if (!line || !button) return;
  let timer: number | undefined;

  const set = (open: boolean): void => {
    window.clearTimeout(timer);
    line.classList.toggle("tucked", !open);
    button.setAttribute("aria-expanded", String(open));
    if (open) timer = window.setTimeout(() => set(false), CREDIT_SHOWN_MS);
  };

  button.addEventListener("click", () => set(line.classList.contains("tucked")));
  // Working on the map tucks it away
  const onMap = (event: Event): void => {
    if (!line.classList.contains("tucked") && (event.target as Element | null)?.id === "MicropolisCanvas") set(false);
  };
  doc.addEventListener("pointerdown", onMap, true);
  doc.addEventListener("wheel", onMap, { capture: true, passive: true });
  // The game shows the line when a city opens (it drops initialHidden): out for a while from then
  new MutationObserver(() => {
    if (!line.classList.contains("initialHidden") && !line.classList.contains("shownOnce")) {
      line.classList.add("shownOnce");
      set(true);
    }
  }).observe(line, { attributes: true, attributeFilter: ["class"] });
}
