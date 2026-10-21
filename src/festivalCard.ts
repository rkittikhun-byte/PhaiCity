/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festival card (docs/GAME_DESIGN.md section 5): a month before one of a town's festivals a small chip by the News
// button names it (owner, 21 Oct 2026: the card had opened over the middle of a new city, "มันมีอะไรมารกหน้าจอมากๆ"),
// and a click on it opens the card beside it, frosted glass that keeps the city running. Three choices, each with its
// price and what it brings: grandly, modestly or not at all; what any festival costs besides money (rubbish and traffic,
// Songkran's water, lanterns' and rockets' fires, krathong in the water) below them. A choice is the festival command
// (src/cityCommands.ts) and stands for the years after; a festival not answered is held modestly. When the festival comes
// the card says how it was held if it is open, else the news does unless it was held modestly as usual, never both; the chip goes once every festival it named
// has come and the card is closed. The festivals the people hold quietly (src/festivals.ts: a village's, and a town's
// all but two or three an era): no chip, no card and no news for them. Fires from lanterns and rockets are always news, with where they started. It only reads
// the city and sends commands.

import { formatMoney, onLanguageChange, t } from "./i18n/index.js";
import { hide, isShown, show } from "./motion.js";
import { placeWindow } from "./windowPlacement.js";
import { FESTIVAL_SCALES, FESTIVAL_SPECS, type FestivalId, type FestivalNews, type FestivalScale } from "./festivals.js";

/** What the card needs of the game (src/game.js) */
export interface FestivalCardSource {
  /** The core's festival news (src/core/cityCore.ts) */
  on(type: "festival" | "festivalAhead" | "festivalFire", listener: (event: FestivalNews) => void): () => void;
  /** The ruler's answer for a festival now (gameMap.festivals) */
  choiceOf(id: FestivalId): FestivalScale;
  /** The treasury now */
  funds(): number;
  /** Sends the festival command; whether it was accepted */
  choose(id: FestivalId, scale: FestivalScale): boolean;
  /** Writes a line of news under the top bar; at: where it happened, for a fire */
  news(text: string, good: boolean, at?: { x: number; y: number }): void;
}

/** The choices from the top: the grandest first */
const SHOWN_SCALES: readonly FestivalScale[] = [...FESTIVAL_SCALES].reverse();

/** What besides money holding a festival costs, as string keys */
export function festivalCosts(id: FestivalId): string[] {
  const spec = FESTIVAL_SPECS[id];
  const keys = ["festival.cost.base"];
  if (spec.waterUse > 0) keys.push("festival.cost.water");
  if (spec.fire[1] > 0.05) keys.push("festival.cost.fire");
  if (spec.dirt[1] > 0) keys.push("festival.cost.dirt");
  return keys;
}

/** How a festival was held this year, on the card once it has come */
export function festivalThisYear(event: Extract<FestivalNews, { type: "festival" }>): string {
  const how = event.byPeople ? "by_people" : event.scale;
  return t(`festival.this_year.${how}`, { cost: formatMoney(event.cost) });
}

/** The news line for a festival held this month */
export function festivalNewsText(event: Extract<FestivalNews, { type: "festival" }>): string {
  const params = { name: t(`festival.${event.id}`), cost: formatMoney(event.cost) };
  if (event.byPeople) return t("festival.news.by_people", params);
  if (event.downgraded) return t("festival.news.downgraded", params);
  return t(`festival.news.${event.scale}`, params);
}

export class FestivalCard {
  /** The festivals asked about, with their prices [modest, grand], and how each was held once it came */
  private readonly asked = new Map<FestivalId, { costs: [number, number]; held: Extract<FestivalNews, { type: "festival" }> | null }>();

  constructor(private readonly element: HTMLElement, private readonly chip: HTMLElement, private readonly source: FestivalCardSource) {
    element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".festivalClose")) {
        this.close();
        return;
      }
      const button = target.closest<HTMLElement>(".festivalChoice");
      const id = button?.dataset.festival as FestivalId | undefined, scale = button?.dataset.scale as FestivalScale | undefined;
      if (!id || !scale || this.source.choiceOf(id) === scale) return;
      if (this.source.choose(id, scale)) this.render();
    });
    chip.addEventListener("click", () => {
      if (this.isOpen) this.close();
      else this.open();
    });
    const doc = element.ownerDocument;
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) this.close();
    });
    // A click anywhere else puts the card away, as every window's does
    doc.addEventListener("pointerdown", (event) => {
      const target = event.target as Node | null;
      if (this.isOpen && target && !element.contains(target) && !chip.contains(target)) this.close();
    }, true);
    source.on("festivalAhead", (event) => {
      if (event.type !== "festivalAhead") return;
      // A new question takes the place of the festivals already held
      for (const [id, entry] of [...this.asked]) if (entry.held) this.asked.delete(id);
      this.asked.set(event.id, { costs: event.costs, held: null });
      // It never opens by itself (owner, 21 Oct 2026: "นี่บ่อยเกิน หรือไม่ต้องแสดงก็ได้"): the chip waits to be clicked, and
      // an unanswered festival is held modestly
      this.chip.dataset.fresh = "true";
      this.renderChip();
      if (this.isOpen) this.render();
    });
    source.on("festival", (event) => {
      if (event.type !== "festival" || !FESTIVAL_SPECS[event.id].choice || event.quiet) return;
      const entry = this.asked.get(event.id);
      if (entry) entry.held = event;
      // The card says how it was held when it is open; else the news does, but not of a festival held modestly as it is
      // every year unless the ruler says otherwise (owner, 21 Oct 2026: "นี่บ่อยเกิน"): the bunting in the town shows it
      const usual = event.scale === "modest" && !event.byPeople && !event.downgraded;
      if (this.isOpen && entry) this.render();
      else if (!usual) source.news(festivalNewsText(event), event.scale !== "none" && !event.byPeople);
      if (!this.isOpen) this.forgetHeld();
    });
    source.on("festivalFire", (event) => {
      if (event.type !== "festivalFire") return;
      source.news(t("festival.news.fire", { name: t(`festival.${event.id}`) }), false, { x: event.x, y: event.y });
    });
    onLanguageChange(() => {
      this.renderChip();
      if (this.isOpen) this.render();
    });
  }

  /** Whether the chip is out, naming a festival to answer for */
  get chipShown(): boolean { return !this.chip.hidden; }

  get isOpen(): boolean { return isShown(this.element); }

  open(): void {
    if (!this.asked.size) return;
    delete this.chip.dataset.fresh;
    this.render();
    show(this.element);
    placeWindow(this.element);
    this.chip.setAttribute("aria-expanded", "true");
  }

  close(): void {
    hide(this.element, true);
    this.chip.setAttribute("aria-expanded", "false");
    this.forgetHeld();
  }

  /** Once every festival asked about has come and the card is shut, nothing is left to answer: the chip goes */
  private forgetHeld(): void {
    if ([...this.asked.values()].every((entry) => entry.held)) this.asked.clear();
    this.renderChip();
  }

  /** The chip by the News button: the festivals to answer for, or hidden when there are none */
  private renderChip(): void {
    const ids = [...this.asked.keys()];
    this.chip.textContent = ids.length ? t("festival.chip", { name: ids.map((id) => t(`festival.${id}`)).join(" · ") }) : "";
    this.chip.setAttribute("title", t("festival.chip.hint"));
    this.chip.hidden = ids.length === 0;
  }

  /** The card's lines, for the festivals asked about */
  render(): void {
    const doc = this.element.ownerDocument, el = (tag: string, cls: string, text?: string): HTMLElement => {
      const node = doc.createElement(tag);
      node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const title = t([...this.asked.values()].every((entry) => entry.held) ? "festival.card.now" : "festival.card.title");
    this.element.setAttribute("aria-label", title);
    const header = el("header", "festivalHeader");
    header.append(el("span", "festivalTitle", title));
    const close = el("button", "festivalClose", "✕");
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", t("festival.card.close"));
    header.append(close);
    const parts: HTMLElement[] = [header];
    const funds = this.source.funds();
    for (const [id, { costs, held }] of this.asked) {
      const section = el("section", "festivalOne");
      section.dataset.festival = id;
      section.append(el("div", "festivalName", t(`festival.${id}`)),
        held ? el("p", "festivalAsk festivalHeld", festivalThisYear(held)) : el("p", "festivalAsk", t(`festival.ask.${id}`)));
      const choices = el("div", "festivalChoices"), chosen = this.source.choiceOf(id);
      for (const scale of SHOWN_SCALES) {
        const price = scale === "none" ? 0 : costs[scale === "grand" ? 1 : 0];
        const button = el("button", "festivalChoice");
        button.setAttribute("type", "button");
        button.dataset.festival = id;
        button.dataset.scale = scale;
        button.setAttribute("aria-pressed", String(chosen === scale));
        const top = el("span", "festivalChoiceTop");
        top.append(el("span", "festivalChoiceName", t(`festival.scale.${scale}`)),
          el("span", "festivalPrice", price > 0 ? formatMoney(price) : t("festival.free")));
        button.append(top, el("span", "festivalGain", t(`festival.gain.${scale}`)));
        if (price > funds) {
          button.dataset.short = "true";
          button.append(el("span", "festivalShort", t("festival.short")));
        }
        choices.append(button);
      }
      section.append(choices, el("p", "festivalCosts", festivalCosts(id).map((key) => t(key)).join(" · ")));
      parts.push(section);
    }
    parts.push(el("p", "festivalNote", t("festival.note")));
    this.element.replaceChildren(...parts);
  }
}

/** The card and its chip, made if the page has none (the chip by the News button, else on the page), listening to the
 * city's festivals */
export function installFestivalCard(source: FestivalCardSource, doc: Document = document): FestivalCard {
  let element = doc.getElementById("festivalCard");
  if (!element) {
    element = doc.createElement("aside");
    element.id = "festivalCard";
    element.setAttribute("role", "dialog");
    element.dataset.anchor = "festivalChip";
    element.hidden = true;
    doc.body.append(element);
  }
  let chip = doc.getElementById("festivalChip");
  if (!chip) {
    chip = doc.createElement("button");
    chip.id = "festivalChip";
    chip.setAttribute("type", "button");
    chip.className = "hudPill";
    chip.hidden = true;
    const news = doc.getElementById("newsLogButton");
    if (news) news.before(chip);
    else doc.body.append(chip);
  }
  return new FestivalCard(element, chip, source);
}
