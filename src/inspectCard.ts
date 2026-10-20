/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The card a click on the map opens (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1): what src/inspect.ts found there,
// translated, as a frosted-glass card against the right edge that does not pause or dim the city. A home, shop or
// factory plot shows its level and what its next level needs first, ticked and crossed (src/plotChecklist.ts). Escape
// or its ✕ closes it; another click shows the next thing. It changes nothing in the city.

import { formatYear, hasKey, t } from "./i18n/index.js";
import type { Inspection } from "./inspect.js";
import type { PlotChecklist } from "./plotChecklist.js";
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
    if (inspection.checklist) this.renderChecklist(inspection.checklist);
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

  /** A plot's level as pips, what holds it, its next level's needs ticked and crossed, and what later levels add */
  private renderChecklist(checklist: PlotChecklist): void {
    const doc = this.element.ownerDocument, element = this.element;
    const level = doc.createElement("div");
    level.className = "plotLevel";
    level.append(t(checklist.level > 0 ? "plot.level" : "plot.level_empty", { level: checklist.level, top: checklist.top }));
    const pips = doc.createElement("span");
    pips.className = "plotPips";
    pips.setAttribute("aria-hidden", "true");
    for (let n = 1; n <= checklist.top; n++) {
      const pip = doc.createElement("i");
      if (n <= checklist.level) pip.className = "reached";
      pips.append(pip);
    }
    level.append(pips);
    const status = doc.createElement("div");
    status.className = "plotStatus";
    const state = checklist.state;
    status.dataset.state = state === "growing" || state === "top" ? state : "held";
    status.textContent = state === "growing" ? t("plot.status.growing", { level: checklist.target ?? checklist.level })
      : state === "top" ? t("plot.status.top")
      : t(checklist.target === null ? "plot.status.keep" : "plot.status.held",
        { level: checklist.target ?? checklist.level, name: t(`plot.name.${state}`) });
    const heading = doc.createElement("div");
    heading.className = "plotChecksTitle";
    heading.textContent = checklist.target === null ? t("plot.checks.keep") : t("plot.checks.next", { level: checklist.target });
    const rows = doc.createElement("ul");
    rows.className = "plotChecks";
    for (const row of checklist.rows) {
      const item = doc.createElement("li");
      item.dataset.ok = String(row.ok);
      item.dataset.holds = String(row.holds);
      const mark = doc.createElement("span");
      mark.className = "checkMark";
      mark.textContent = row.ok ? "✓" : "✗";
      const text = doc.createElement("span");
      text.textContent = line(row.key, row.params);
      item.append(mark, text);
      if (row.hint) {
        const hint = doc.createElement("span");
        hint.className = "checkHint";
        hint.textContent = t(row.hint);
        item.append(hint);
      }
      rows.append(item);
    }
    element.append(level, status, heading, rows);
    if (checklist.later.length) {
      const later = doc.createElement("div");
      later.className = "plotLater";
      later.textContent = checklist.later.map(step => t(step.from === step.to ? "plot.later" : "plot.later_range",
        { level: step.from, from: step.from, to: step.to, needs: step.checks.map(check => t(`plot.later.${check}`)).join(", ") }))
        .join(" · ");
      element.append(later);
    }
  }
}
