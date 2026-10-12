/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Flags for the languages (owner, 12 Oct 2026), drawn in SVG since Windows has no flag emoji: on the start screen's
// language button (the flag of the language a click switches to), the title page and the game's language card.

import { getLanguage, type Language, t } from "./i18n/index";

export const FLAGS: Record<Language, string> = {
  // Thailand: red, white, a double-width blue band, white, red
  th: '<svg viewBox="0 0 9 6" width="21" height="14" aria-hidden="true" class="flag"><rect width="9" height="6" fill="#a51931"/>' +
    '<rect y="1" width="9" height="4" fill="#f4f5f8"/><rect y="2" width="9" height="2" fill="#2d2a4a"/></svg>',
  // The United Kingdom, drawn simply for its small size
  en: '<svg viewBox="0 0 60 30" width="24" height="12" aria-hidden="true" class="flag"><rect width="60" height="30" fill="#012169"/>' +
    '<path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/>' +
    '<path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
};

/** The flag a language button shows: that of the language a click switches to. */
export function flagFor(current: Language): string {
  return current === "th" ? FLAGS.en : FLAGS.th;
}

export function renderLanguageButton(button: HTMLElement): void {
  button.removeAttribute("data-i18n");
  button.removeAttribute("data-i18n-title");
  button.innerHTML = flagFor(getLanguage());
  button.title = t("lang.switch_to");
  button.setAttribute("aria-label", button.title);
}
