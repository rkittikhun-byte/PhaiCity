/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// One quiet line at the top left with the city's name, date and money, so they stay in view while the city card
// waits behind its icon (owner, 12 Oct 2026: the left side as icons). It copies the city card's own fields, which
// src/infoBar.js keeps up to date.

import { formatMoney } from "./i18n/index";

/** How the money reads in the line: ฿16,295. Anything that is not a number is shown as it is. */
export function statusMoney(text: string): string {
  const amount = Number(text.replace(/[^\d-]/g, ""));
  return text.trim() !== "" && Number.isFinite(amount) ? formatMoney(amount).replace(/\d+/, (digits) =>
    Number(digits).toLocaleString("en-US")) : text;
}

export function installCityStatus(doc: Document = document): void {
  const copies: Array<[string, string, (text: string) => string]> = [
    ["name", "statusName", (text) => text],
    ["date", "statusDate", (text) => text],
    ["funds", "statusFunds", statusMoney],
  ];
  for (const [from, to, format] of copies) {
    const source = doc.getElementById(from);
    const target = doc.getElementById(to);
    if (!source || !target) continue;
    const copy = (): void => {
      target.textContent = format(source.textContent ?? "");
    };
    copy();
    new MutationObserver(copy).observe(source, { childList: true, characterData: true, subtree: true });
  }
}
