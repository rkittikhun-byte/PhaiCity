/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The card a click on the map opens (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1): what src/inspect.ts found there,
// translated, as a frosted-glass card against the right edge that does not pause or dim the city. A home, shop or
// factory plot shows its level and what its next level needs first, ticked and crossed (src/plotChecklist.ts). Escape
// or its ✕ closes it; another click shows the next thing. It changes nothing in the city.

import { formatMoney, formatYear, getLanguage, hasKey, t } from "./i18n/index.js";
import type { Inspection } from "./inspect.js";
import type { PlotChecklist } from "./plotChecklist.js";
import { hide, show } from "./motion.js";
import type { RosterSection } from "./register/registerCards.js";
import type { Name } from "./register/names.js";

/** The params that are a person's money (baht a month, src/register/), shown as ฿12,340 */
const MONEY = new Set(["income", "living", "savings", "debt"]);

/** A param that names a string (object.grade.2, tool.gas …) is shown translated; a year in the player's calendar */
function word(name: string, value: string | number): string {
  if (name === "year" && typeof value === "number") return formatYear(value);
  if (MONEY.has(name) && typeof value === "number") return formatMoney(value).replace(/\d+/, (d) => Number(d).toLocaleString("en-US"));
  if (typeof value === "string" && hasKey(value)) return t(value, { price: "" }).trim();
  return String(value);
}

/** A line in the player's language; a param "@key" is the name names[key] (a business's, a person's) */
function line(key: string, params: Record<string, string | number> = {}, names: Record<string, Name> = {}): string {
  const words: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    const named = typeof value === "string" && value.startsWith("@") ? names[value.slice(1)] : undefined;
    words[name] = named ? named[getLanguage()] : word(name, value);
  }
  return t(key, words).trim();
}

export class InspectCard {
  private shown: Inspection | null = null;
  /** A person's name clicked in a list: the game opens their card (src/register/) */
  onPerson: (id: string) => void = () => {};
  /** A person's home or workplace asked for: the game shows that building (by its object's id), or what is at the tile */
  onPlace: (x: number, y: number, id: number | null) => void = () => {};
  constructor(private readonly element: HTMLElement, private readonly onClose: () => void = () => {}) {
    element.setAttribute("aria-label", t("object.card.label"));
    element.addEventListener("click", event => {
      const target = event.target as HTMLElement;
      if (target.closest(".inspectClose")) this.close();
      const person = target.closest<HTMLElement>("[data-person]");
      if (person?.dataset.person) this.onPerson(person.dataset.person);
      const place = target.closest<HTMLElement>("[data-place-x]");
      if (place) this.onPlace(Number(place.dataset.placeX), Number(place.dataset.placeY),
        place.dataset.placeId ? Number(place.dataset.placeId) : null);
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
    // (a person's card is titled with their name, in the player's language)
    const names = inspection.names ?? {};
    title.textContent = inspection.person ? inspection.person.name[getLanguage()] : line(inspection.title.key, inspection.title.params, names);
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
      item.textContent = line(fact.key, fact.params, names);
      list.append(item);
    }
    element.append(list);
    // A person's home and workplace, to go to
    const person = inspection.person;
    if (person) {
      const places = doc.createElement("div");
      places.className = "inspectPlaces";
      const go = (key: string, at: { x: number; y: number }, id: number | null): HTMLButtonElement => {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = t(key);
        button.dataset.placeX = String(at.x);
        button.dataset.placeY = String(at.y);
        if (id !== null) button.dataset.placeId = String(id);
        return button;
      };
      places.append(go("register.go_home", person.home, person.homeId));
      if (person.work) places.append(go("register.go_work", person.work, person.work.id));
      element.append(places);
    }
    for (const section of inspection.people ?? []) this.renderPeople(section);
  }

  /** A list of people (a household, a workplace's staff): each name opens that person's card */
  private renderPeople(section: RosterSection): void {
    const doc = this.element.ownerDocument, language = getLanguage();
    const box = doc.createElement("section");
    box.className = "inspectPeople";
    const heading = doc.createElement("div");
    heading.className = "inspectPeopleTitle";
    heading.textContent = line(section.heading.key, section.heading.params, section.names ?? {});
    const rows = doc.createElement("ul");
    for (const row of section.rows) {
      const item = doc.createElement("li");
      const name = doc.createElement("button");
      name.type = "button";
      name.className = "personName";
      name.dataset.person = row.id;
      name.textContent = row.name[language];
      const about = doc.createElement("span");
      about.className = "personLine";
      about.textContent = line(row.line.key, row.line.params);
      item.append(name, about);
      rows.append(item);
    }
    box.append(heading, rows);
    if (section.more > 0) {
      const more = doc.createElement("div");
      more.className = "inspectPeopleMore";
      more.textContent = t("register.more", { people: section.more });
      box.append(more);
    }
    if (section.note) {
      const note = doc.createElement("div");
      note.className = "inspectPeopleMore";
      note.textContent = line(section.note.key, section.note.params);
      box.append(note);
    }
    this.element.append(box);
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
