/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era card (docs/GAME_DESIGN.md 1.5): a click on the era in the status bar opens it below, a frosted-glass card
// that keeps the city running. It shows what src/eraReport.ts makes of the month's era score: the score and where
// the buildings begin to change, people times how well they live, each side of life against its aim with a tick or a
// cross and one thing to do, what holds the score, and what the next era must have. It is drawn again each month,
// when a new era comes and when the language changes; the era block, its ✕ or Escape closes it. It only reads the city.

import { onLanguageChange, t } from "./i18n/index.js";
import { SCORE_MONTHS } from "./eraRules.js";
import type { EraScore } from "./eraScore.js";
import { eraReport } from "./eraReport.js";
import { hide, isShown, show } from "./motion.js";
import { placeWindow } from "./windowPlacement.js";

/** Where the era score is kept, and what tells when a month has turned (src/core/cityCore.ts) */
export interface EraCardSource {
  map: { eraScore?: EraScore | null };
  on(type: "month" | "era", listener: () => void): () => void;
}

const thousands = (n: number): string => n.toLocaleString("en-US");

/** A bar of a share with an optional mark at its aim, each 0-100 */
function bar(doc: Document, value: number, aim: number | null, mood: "good" | "fair" | "poor"): HTMLElement {
  const box = doc.createElement("span");
  box.className = "eraBar";
  const fill = doc.createElement("span");
  fill.className = "eraFill";
  fill.dataset.mood = mood;
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  box.append(fill);
  if (aim !== null) {
    const mark = doc.createElement("i");
    mark.className = "eraAim";
    mark.style.left = `${Math.max(0, Math.min(100, aim))}%`;
    box.append(mark);
  }
  return box;
}

/** How a row stands: met, more than half way to its aim, or short of it */
const moodOf = (met: boolean, value: number, target: number): "good" | "fair" | "poor" =>
  met ? "good" : target > 0 && value / target >= 0.5 ? "fair" : "poor";

export class EraCard {
  /** @param onToggle told when the card opens or closes (the era block's aria-expanded) */
  constructor(private readonly element: HTMLElement, private readonly source: EraCardSource,
              private readonly onToggle: (open: boolean) => void = () => {}) {
    element.setAttribute("aria-label", t("era.card.title"));
    element.addEventListener("click", event => {
      if ((event.target as HTMLElement).closest(".eraClose")) this.close();
    });
    source.on("month", () => this.render());
    source.on("era", () => this.render());
    onLanguageChange(() => {
      element.setAttribute("aria-label", t("era.card.title"));
      this.render();
    });
    element.ownerDocument.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean { return isShown(this.element); }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (!this.source.map.eraScore) return;
    show(this.element);
    this.render();
    // Below the era block (data-anchor in index.html, src/windowPlacement.ts)
    placeWindow(this.element);
    this.onToggle(true);
  }

  close(): void {
    if (!this.isOpen) return;
    hide(this.element, true);
    this.onToggle(false);
  }

  /** Draws the card from the month's score; nothing while it is closed */
  render(): void {
    const score = this.source.map.eraScore;
    if (!this.isOpen) return;
    if (!score) {
      this.close();
      return;
    }
    const report = eraReport(score);
    const doc = this.element.ownerDocument;
    const element = this.element;
    element.replaceChildren();
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    // The era, the next one, and the score against where the buildings begin to change
    const header = doc.createElement("header");
    const title = el("div", "eraTitle", t("era.card.title"));
    const close = el("button", "eraClose", "✕");
    close.type = "button";
    close.setAttribute("aria-label", t("object.card.close"));
    header.append(title, close);
    element.append(header);
    const name = el("div", "eraName", t(`era.name.${report.era}`));
    if (report.nextEra) name.append(el("span", "eraNextName", ` → ${t(`era.name.${report.nextEra}`)}`));
    const scoreLine = el("div", "eraScoreLine");
    scoreLine.append(bar(doc, report.score, report.stage === "last" ? null : report.transition,
      report.stage === "changing" ? "good" : "fair"), el("span", "eraScoreValue", `${report.score}%`));
    const stage = el("div", "eraStage", report.stage === "last" ? t("status.era_last")
      : t(`era.card.stage.${report.stage}`, { transition: report.transition, next: t(`era.name.${report.nextEra}`) }));
    const formula = el("div", "eraFormula", t("era.card.formula", { months: SCORE_MONTHS,
      people: report.people.percent, quality: report.quality, raw: report.raw }));
    element.append(name, scoreLine, stage, formula);

    // What would help most now
    const best = el("div", "eraBest");
    best.dataset.state = report.best ? "todo" : "done";
    best.textContent = report.best
      ? t("era.card.best", { hint: t(report.best.hint) }) + (report.best.gain > 0 ? ` ${t("era.card.gain", { gain: report.best.gain })}` : "")
      : t("era.card.all_done");
    element.append(best);

    // The floors that hold the score below the transition
    for (const floor of report.floors) {
      const line = el("div", "eraFloor", t(floor.holding ? "era.card.floor_holding" : "era.card.floor", {
        name: t(`era.factor.${floor.factor}`), floor: floor.floor, value: floor.value, cap: report.cap }));
      line.dataset.holding = String(floor.holding);
      element.append(line);
    }

    // People, then each side of life
    const rows = el("ul", "eraRows");
    const row = (opts: { met: boolean; name: string; value: number; aim: number | null; reading: string; gain: number;
                         hint: string | null; weight?: number }): HTMLLIElement => {
      const item = el("li", "eraRow");
      item.dataset.met = String(opts.met);
      const mark = el("span", "eraMark", opts.met ? "✓" : "✗");
      mark.setAttribute("aria-label", t(opts.met ? "era.card.met" : "era.card.unmet"));
      const label = el("span", "eraRowName", opts.name);
      if (opts.weight !== undefined) label.title = t("era.card.weight", { weight: opts.weight });
      const reading = el("span", "eraReading", opts.reading);
      const gain = el("span", "eraGain", opts.gain > 0 ? t("era.card.gain", { gain: opts.gain }) : "");
      item.append(mark, label, bar(doc, opts.value, opts.aim, moodOf(opts.met, opts.value, opts.aim ?? 100)), reading, gain);
      if (opts.hint) item.append(el("span", "eraHint", t(opts.hint)));
      return item;
    };
    const people = report.people;
    rows.append(row({ met: people.met, name: t("era.card.people"), value: people.percent, aim: null,
      reading: t("era.card.people_value", { count: thousands(people.count), wanted: thousands(people.wanted) }),
      gain: people.gain, hint: people.hint }));
    element.append(el("div", "eraSection", t("era.card.section_people")), rows);

    const quality = el("ul", "eraRows");
    for (const factor of report.factors) {
      quality.append(row({ met: factor.met, name: t(`era.factor.${factor.factor}`), weight: factor.weight,
        value: factor.value, aim: factor.count ? null : factor.target,
        reading: factor.count ? t("era.card.count", factor.count) : t("era.card.aim", { value: factor.value, target: factor.target }),
        gain: factor.gain, hint: factor.hint }));
    }
    element.append(el("div", "eraSection", t("era.card.section_quality", { quality: report.quality })), quality);

    // What the next era must have
    if (report.symbols.length) {
      const symbols = el("ul", "eraSymbols");
      for (const symbol of report.symbols) {
        const item = el("li", "eraRow");
        item.dataset.met = String(symbol.has);
        item.append(el("span", "eraMark", symbol.has ? "✓" : "✗"), el("span", "eraRowName", t(`era.symbol.${symbol.key}`)));
        if (symbol.hint) item.append(el("span", "eraHint", t(symbol.hint)));
        symbols.append(item);
      }
      element.append(el("div", "eraSection", report.nextEra
        ? t("era.card.symbols", { next: t(`era.name.${report.nextEra}`) }) : t("era.card.symbols_last")), symbols);
    }
  }
}
