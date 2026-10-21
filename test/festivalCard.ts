/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festival card and its chip (src/festivalCard.ts; owner, 21 Oct 2026: a new city's first screen had a festival card
// over the middle of the map and the news line above it, "มันมีอะไรมารกหน้าจอมากๆ"): a town's next festival is a small
// chip by the News button that opens the card; the card never opens by itself; how a festival was held is told once,
// in the card when it is open, else in the news; a village's own festivals are told nothing about.

import { FestivalCard, type FestivalCardSource } from "../src/festivalCard";
import type { FestivalId, FestivalNews, FestivalScale } from "../src/festivals";
import { setLanguage } from "../src/i18n/index";

/** Just enough of the page for the card: elements with their attributes, classes, children and listeners */
class FakeElement {
  hidden = false;
  textContent = "";
  className = "";
  readonly style: Record<string, string> = { display: "" };
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  private readonly classes = new Set<string>();
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  readonly classList = {
    add: (...names: string[]) => names.forEach((n) => this.classes.add(n)),
    remove: (...names: string[]) => names.forEach((n) => this.classes.delete(n)),
    contains: (name: string) => this.classes.has(name),
  };
  constructor(readonly ownerDocument: FakeDocument, readonly tagName = "div") {}
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  /** A click on this element (or a child), as the browser sends it */
  click(target: FakeElement = this): void { for (const l of this.listeners.get("click") ?? []) l({ target }); }
  append(...nodes: FakeElement[]): void { this.children.push(...nodes); }
  replaceChildren(...nodes: FakeElement[]): void { this.children.length = 0; this.children.push(...nodes); }
  contains(node: unknown): boolean { return node === this || this.children.some((c) => c.contains(node)); }
  closest(selector: string): FakeElement | null {
    return selector.startsWith(".") && this.className.split(" ").includes(selector.slice(1)) ? this : null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
  /** Every element under this one, itself first */
  all(): FakeElement[] { return [this, ...this.children.flatMap((c) => c.all())]; }
  text(): string { return [this.textContent, ...this.children.map((c) => c.text())].filter(Boolean).join(" "); }
}

class FakeDocument {
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  createElement(tag: string): FakeElement { return new FakeElement(this, tag); }
  getElementById(): null { return null; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(type: string, event: unknown): void { for (const l of this.listeners.get(type) ?? []) l(event); }
}

/** A card on a fake page, with the city's festival news sent by hand */
function setUp() {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
  (globalThis as Record<string, unknown>).getComputedStyle = (el: FakeElement) => ({ display: el.hidden ? "none" : "block" });
  const doc = new FakeDocument(), element = doc.createElement("aside"), chip = doc.createElement("button");
  element.hidden = true;
  chip.hidden = true;
  const listeners: Record<string, Array<(event: FestivalNews) => void>> = {};
  const choices: Partial<Record<FestivalId, FestivalScale>> = {}, news: string[] = [];
  const source: FestivalCardSource = {
    on: (type, listener) => { (listeners[type] ??= []).push(listener); return () => {}; },
    choiceOf: (id) => choices[id] ?? "modest",
    funds: () => 5000,
    choose: (id, scale) => { choices[id] = scale; return true; },
    news: (text) => { news.push(text); },
  };
  const card = new FestivalCard(element as unknown as HTMLElement, chip as unknown as HTMLElement, source);
  const send = (event: FestivalNews) => (listeners[event.type] ?? []).forEach((l) => l(event));
  return { card, element, chip, doc, send, news, choices };
}

const ahead = (id: FestivalId): FestivalNews => ({ type: "festivalAhead", id, scale: "modest", costs: [20, 100] });
const held = (id: FestivalId, more: Partial<Extract<FestivalNews, { type: "festival" }>> = {}): FestivalNews =>
  ({ type: "festival", id, scale: "modest", cost: 20, byPeople: false, downgraded: false, ...more });

describe("the festival card", () => {
  beforeAll(() => setLanguage("en"));
  afterAll(() => setLanguage("th"));

  test("a town's next festival is a chip by the News button; the card opens only from it", () => {
    const { element, chip, send, news } = setUp();
    send(ahead("bun_bang_fai"));
    expect(element.hidden).toBe(true);
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe("Festival: Bun Bang Fai");
    expect(chip.dataset.fresh).toBe("true");
    expect(news).toEqual([]);
    chip.click();
    expect(element.hidden).toBe(false);
    expect(chip.dataset.fresh).toBeUndefined();
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(element.text()).toContain("Bun Bang Fai");
    // A choice is the festival command
    const grand = element.all().find((e) => e.dataset.scale === "grand")!;
    element.click(grand);
    expect(grand.getAttribute("aria-pressed")).toBe("false");
    expect(element.all().find((e) => e.dataset.scale === "grand")!.getAttribute("aria-pressed")).toBe("true");
    // A click on the chip again, or anywhere else, puts it away
    chip.click();
    expect(element.classList.contains("motionLeave") || element.hidden).toBe(true);
  });

  test("how a festival was held is told once: in the open card, else in the news; then the chip goes", () => {
    const open = setUp();
    open.send(ahead("songkran"));
    open.chip.click();
    open.send(held("songkran", { scale: "grand", cost: 100 }));
    expect(open.news).toEqual([]);
    expect(open.element.text()).toContain("This year it is held grandly");
    // ... the chip stays while the card does, and goes when it is closed
    expect(open.chip.hidden).toBe(false);
    open.doc.send("pointerdown", { target: open.doc.createElement("canvas") });
    expect(open.chip.hidden).toBe(true);

    const shut = setUp();
    shut.send(ahead("songkran"));
    shut.send(held("songkran", { scale: "grand", cost: 100 }));
    expect(shut.news).toEqual(["Songkran is held grandly (฿100): visitors fill the town"]);
    expect(shut.element.hidden).toBe(true);
    expect(shut.chip.hidden).toBe(true);
    // ... but a festival held modestly as usual is no news; one the treasury could not pay for is
    shut.send(ahead("loy_krathong"));
    shut.send(held("loy_krathong"));
    expect(shut.news.length).toBe(1);
    expect(shut.chip.hidden).toBe(true);
    shut.send(held("silk", { cost: 0, byPeople: true }));
    expect(shut.news.length).toBe(2);
  });

  test("a village's own festival is told nothing about, and shows no chip", () => {
    const { element, chip, send, news } = setUp();
    send(held("songkran", { cost: 0, byPeople: true, village: true }));
    expect(news).toEqual([]);
    expect(chip.hidden).toBe(true);
    expect(element.hidden).toBe(true);
  });

  test("a fire from lanterns or rockets is always news", () => {
    const { send, news } = setUp();
    send({ type: "festivalFire", id: "yi_peng", x: 3, y: 4 });
    expect(news.length).toBe(1);
  });
});
