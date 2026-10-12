/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The credits on screen show when a city or the start screen opens, then tuck themselves behind a © button after a
// few seconds, or as soon as the player starts working on the map; the button brings them back (owner, 12 Oct 2026).
// This is what the OpenStreetMap Foundation's attribution guidelines allow for interactive maps: shown at first,
// collapsed after five seconds or on map interaction, and easy to find again.

/** How long the credits stay out before tucking themselves away: more than the guidelines' five seconds. */
export const CREDIT_SHOWN_MS = 8000;

/**
 * Credits that tuck away behind their button. onMap tells whether an event is the player working on the map, which
 * tucks them away early. Returns how to show them again (for a while).
 */
export function tuckable(credits: HTMLElement, button: HTMLElement, onMap: (event: Event) => boolean): () => void {
  let timer: number | undefined;
  const set = (open: boolean): void => {
    window.clearTimeout(timer);
    credits.classList.toggle("tucked", !open);
    button.setAttribute("aria-expanded", String(open));
    if (open) timer = window.setTimeout(() => set(false), CREDIT_SHOWN_MS);
  };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    set(credits.classList.contains("tucked"));
  });
  const doc = credits.ownerDocument;
  const work = (event: Event): void => {
    if (!credits.isConnected) {
      doc.removeEventListener("pointerdown", work, true);
      doc.removeEventListener("wheel", work, true);
    } else if (!credits.classList.contains("tucked") && onMap(event)) {
      set(false);
    }
  };
  doc.addEventListener("pointerdown", work, true);
  doc.addEventListener("wheel", work, { capture: true, passive: true });
  return () => set(true);
}

/** The game's credit line (#mapAttribution) and its © button: out when a city opens, then tucked away. */
export function installCreditLine(doc: Document = document): void {
  const line = doc.getElementById("mapAttribution");
  const button = doc.getElementById("creditToggle");
  if (!line || !button) return;
  const showAgain = tuckable(line, button, (event) => (event.target as Element | null)?.id === "MicropolisCanvas");
  line.classList.add("tucked");
  // The game shows the line when a city opens (it drops initialHidden): out for a while from then
  new MutationObserver(() => {
    if (!line.classList.contains("initialHidden") && !line.classList.contains("shownOnce")) {
      line.classList.add("shownOnce");
      showAgain();
    }
  }).observe(line, { attributes: true, attributeFilter: ["class"] });
}
