/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festival card (docs/GAME_DESIGN.md section 5): a month before one of the province's festivals the news asks the
// ruler how to hold it, on a frosted-glass card under the top bar that keeps the city running. Three choices, each with
// its price and what it brings: grandly, modestly or not at all; what any festival costs besides money (rubbish and
// traffic, Songkran's water, lanterns' and rockets' fires, krathong in the water) below them. A choice is the festival
// command (src/cityCommands.ts) and stands for the years after; a festival not answered is held modestly. When the
// festival comes the news says how it was held (and where a fire its lanterns started), and the card stays, saying so,
// until its ✕, Escape or the next festival's question: a month passes in two to eight seconds, so the ruler who was too
// slow for this year still answers for the next. It only reads the city and sends commands.

import { formatMoney, onLanguageChange, t } from "./i18n/index.js";
import { hide, isShown, show } from "./motion.js";
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

  constructor(private readonly element: HTMLElement, private readonly source: FestivalCardSource) {
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
    element.ownerDocument.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) this.close();
    });
    source.on("festivalAhead", (event) => {
      if (event.type !== "festivalAhead") return;
      // A new question takes the place of the festivals already held
      for (const [id, entry] of [...this.asked]) if (entry.held) this.asked.delete(id);
      this.asked.set(event.id, { costs: event.costs, held: null });
      // It no longer opens by itself (owner, 21 Oct 2026: "นี่บ่อยเกิน หรือไม่ต้องแสดงก็ได้"): an unanswered festival is held
      // modestly, and the card waits to be opened from a chip of its own (ไม้ไผ่26)
      if (this.isOpen) this.render();
    });
    source.on("festival", (event) => {
      if (event.type !== "festival" || !FESTIVAL_SPECS[event.id].choice) return;
      source.news(festivalNewsText(event), event.scale !== "none" && !event.byPeople);
      const entry = this.asked.get(event.id);
      if (entry) entry.held = event;
      this.render();
    });
    source.on("festivalFire", (event) => {
      if (event.type !== "festivalFire") return;
      source.news(t("festival.news.fire", { name: t(`festival.${event.id}`) }), false, { x: event.x, y: event.y });
    });
    onLanguageChange(() => this.render());
  }

  get isOpen(): boolean { return isShown(this.element); }

  open(): void {
    this.render();
    show(this.element);
  }

  close(): void {
    hide(this.element, true);
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

/** The card, made under the top bar if the page has none, listening to the city's festivals */
export function installFestivalCard(source: FestivalCardSource, doc: Document = document): FestivalCard {
  let element = doc.getElementById("festivalCard");
  if (!element) {
    element = doc.createElement("aside");
    element.id = "festivalCard";
    element.setAttribute("role", "dialog");
    element.hidden = true;
    doc.body.append(element);
  }
  return new FestivalCard(element, source);
}
