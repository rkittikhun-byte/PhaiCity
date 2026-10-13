/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The card a click on the map opens (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1): what src/inspect.ts found there,
// translated, as a frosted-glass card against the right edge that does not pause or dim the city. Escape or its ✕
// closes it; another click shows the next thing. It changes nothing in the city.

import { formatYear, hasKey, t } from "./i18n/index.js";
import type { Inspection } from "./inspect.js";
import { hide, show } from "./motion.js";

/** A param that names a string (object.grade.2, tool.gas …) is shown translated; a year in the player's calendar */
function word(name: string, value: string | number): string {
  if (name === "year" && typeof value === "number") return formatYear(value);
  if (typeof value === "string" && hasKey(value)) return t(value, { price: "" }).trim();
  return String(value);
}

function line(key: string, params: Record<string, string | number> = {}): string {
  const words: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) words[name] = word(name, value);
  return t(key, words).trim();
}

export class InspectCard {
  private shown: Inspection | null = null;
  constructor(private readonly element: HTMLElement, private readonly onClose: () => void = () => {}) {
    element.setAttribute("aria-label", t("object.card.label"));
    element.addEventListener("click", event => {
      if ((event.target as HTMLElement).closest(".inspectClose")) this.close();
    });
  }
  get isOpen(): boolean { return this.shown !== null; }
  get inspection(): Inspection | null { return this.shown; }
  open(inspection: Inspection): void {
    this.shown = inspection;
    this.render();
    show(this.element);
  }
  close(): void {
    if (!this.shown) return;
    this.shown = null;
    hide(this.element);
    this.onClose();
  }
  /** The player's language changed */
  render(): void {
    const inspection = this.shown;
    if (!inspection) return;
    const doc = this.element.ownerDocument, element = this.element;
    element.replaceChildren();
    const header = doc.createElement("header");
    const title = doc.createElement("div");
    title.className = "inspectTitle";
    title.textContent = line(inspection.title.key, inspection.title.params);
    const close = doc.createElement("button");
    close.type = "button"; close.className = "inspectClose"; close.textContent = "✕";
    close.setAttribute("aria-label", t("object.card.close"));
    header.append(title, close);
    element.append(header);
    const sub: string[] = [];
    if (inspection.street) sub.push(line(inspection.street.key, inspection.street.params));
    if (inspection.sector) sub.push(t(`object.sector.${inspection.sector}`));
    if (sub.length) {
      const subtitle = doc.createElement("div");
      subtitle.className = "inspectSub"; subtitle.textContent = sub.join(" · ");
      element.append(subtitle);
    }
    // How content it is, and why: the biggest reasons first (src/objects/satisfaction.ts)
    const satisfaction = inspection.satisfaction;
    if (satisfaction) {
      const box = doc.createElement("div");
      box.className = "inspectSatisfaction";
      const score = doc.createElement("div");
      score.className = "inspectScore";
      score.textContent = t("object.satisfaction", { score: satisfaction.score });
      const bar = doc.createElement("div");
      bar.className = "inspectBar";
      const fill = doc.createElement("span");
      fill.style.width = `${satisfaction.score}%`;
      fill.dataset.mood = satisfaction.score >= 60 ? "good" : satisfaction.score >= 40 ? "fair" : "poor";
      bar.append(fill);
      const reasons = doc.createElement("ul");
      for (const factor of satisfaction.factors.slice(0, 6)) {
        const item = doc.createElement("li");
        item.dataset.sign = factor.points > 0 ? "plus" : "minus";
        item.textContent = `${factor.points > 0 ? "+" : "−"}${Math.abs(factor.points)} ${t(factor.key)}`;
        reasons.append(item);
      }
      box.append(score, bar, reasons);
      element.append(box);
    }
    const list = doc.createElement("ul");
    for (const fact of inspection.facts) {
      const item = doc.createElement("li");
      item.textContent = line(fact.key, fact.params);
      list.append(item);
    }
    element.append(list);
  }
}
