/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Game windows open beside the card that opened them instead of in the middle of the screen, and the city stays
// in view around them (owner, 12 Oct 2026). A window opened from the menu sits right of the icon strip, level with
// its icon; one opened from inside another window takes that window's place; one that opens by itself or from a key
// goes beside its home (data-anchor in index.html: its menu icon, or the tools for the inspect window), or under it
// when its home is in the top bar (the era card under the era in the city's status). Windows with no home, such as a
// new rank's congratulations, stay in the middle.

const GAP_PX = 10;
const MARGIN_PX = 12;
/** A press this recent counts as the one that opened the window. */
const PRESS_MS = 1500;
/** What a window never covers (owner, 24 Oct 2026): the tools dock with the card above it, the time bar and the top bar. */
const HUD = "#controls, #toolTray, #toolLevels, #timeBar, #header";
const CARDS = "#infobar, #miscButtons, #RCIContainer, #controls, #rulerGoals, #notifications, #newsLogButton";

export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Place { left: number; top: number; from: "left" | "right" | "below" | "above" }

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(value, high));

function onScreen(left: number, top: number, size: Size, view: Size, from: Place["from"]): Place {
  return {
    left: Math.round(clamp(left, MARGIN_PX, view.width - MARGIN_PX - size.width)),
    top: Math.round(clamp(top, MARGIN_PX, view.height - MARGIN_PX - size.height)),
    from,
  };
}

/**
 * Where a window goes beside a card: on the card's inner side (right of a card on the left half of the screen, left
 * of one on the right half) and level with its top, moved as far as needed to stay on screen. `from` is the side the
 * window slides in from.
 */
export function besidePosition(card: Box, size: Size, view: Size): Place {
  // A card in the bottom middle (the tools dock) gets its window above it
  const middle = card.left + card.width / 2;
  if (Math.abs(middle - view.width / 2) < view.width * 0.15 && card.top > view.height / 2) {
    return onScreen(middle - size.width / 2, card.top - GAP_PX - size.height, size, view, "below");
  }
  // A card in the top bar (the city's status) gets its window under it, from its left edge
  if (card.top + card.height < view.height * 0.15) {
    return onScreen(card.left, card.top + card.height + GAP_PX, size, view, "above");
  }
  const onLeft = middle < view.width / 2;
  const left = onLeft ? card.left + card.width + GAP_PX : card.left - GAP_PX - size.width;
  return onScreen(left, card.top, size, view, onLeft ? "left" : "right");
}

/** Where a window goes that replaces another one: the same top and the same outer edge. */
export function replacingPosition(other: Box, from: Place["from"], size: Size, view: Size): Place {
  if (from === "below") {
    // Over the same place: centred, with the same bottom
    return onScreen(other.left + other.width / 2 - size.width / 2, other.top + other.height - size.height, size, view, from);
  }
  const left = from === "left" || from === "above" ? other.left : other.left + other.width - size.width;
  return onScreen(left, other.top, size, view, from);
}

export interface Fit { top: number; maxHeight: number }

/**
 * Moves a window at `top` (with its natural height) clear of the HUD boxes it sits over: a box in the lower half of the
 * screen is the floor, one in the upper part (the top bar) the ceiling. A window taller than the free space between is
 * given a maxHeight and scrolls inside.
 */
export function clearOfHud(left: number, top: number, size: Size, view: Size, hud: Box[]): Fit {
  let floor = view.height - MARGIN_PX;
  let ceiling = MARGIN_PX;
  for (const box of hud) {
    if (box.left >= left + size.width || box.left + box.width <= left) continue;
    if (box.top > view.height / 2) floor = Math.min(floor, box.top - GAP_PX);
    else if (box.top + box.height < view.height * 0.2) ceiling = Math.max(ceiling, box.top + box.height + GAP_PX);
  }
  const maxHeight = Math.max(0, Math.min(size.height, floor - ceiling));
  return { top: Math.round(clamp(top, ceiling, floor - maxHeight)), maxHeight: Math.floor(maxHeight) };
}

function hudBoxes(win: HTMLElement): Box[] {
  return [...win.ownerDocument.querySelectorAll<HTMLElement>(HUD)]
    .filter((el) => !el.contains(win) && !win.contains(el) && visible(el))
    .map((el) => el.getBoundingClientRect());
}

let lastPress: { target: Element; time: number } | null = null;

/** Remembers what the player last pressed, so a window can open beside it. */
export function trackPresses(doc: Document = document): void {
  doc.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element) lastPress = { target: event.target, time: performance.now() };
  }, true);
}

function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/** What a window sits beside: a menu icon's own height at the edge of the icon strip, or a whole card. */
function anchorBox(element: Element): Box {
  const box = element.getBoundingClientRect();
  const strip = element.closest("#miscButtons");
  if (!strip || strip === element) return box;
  const edge = strip.getBoundingClientRect();
  return { left: edge.left, top: box.top, width: edge.width, height: box.height };
}

// Some windows fill in after they open (the city map draws its picture), so a docked window keeps its bottom on
// screen as it grows or as the browser window changes size, staying as close to its card's level as it can
let resizes: ResizeObserver | null = null;

function refit(win: HTMLElement): void {
  if (!win.classList.contains("docked")) return;
  win.style.maxHeight = "";
  const size = { width: win.getBoundingClientRect().width, height: win.getBoundingClientRect().height };
  const fit = clearOfHud(win.getBoundingClientRect().left, Number(win.dataset.wantedTop) || MARGIN_PX, size,
    { width: window.innerWidth, height: window.innerHeight }, hudBoxes(win));
  win.style.top = `${fit.top}px`;
  win.style.maxHeight = `${fit.maxHeight}px`;
}

function keepFitted(win: HTMLElement): void {
  if (!resizes && typeof ResizeObserver !== "undefined") {
    resizes = new ResizeObserver((entries) => entries.forEach((entry) => refit(entry.target as HTMLElement)));
    window.addEventListener("resize", () => {
      document.querySelectorAll<HTMLElement>(".modal.docked").forEach((open) => {
        refit(open);
      });
    });
  }
  resizes?.observe(win);
}

/** Moves a window that has just been shown beside the card that opened it, or leaves it in the middle. */
export function placeWindow(win: HTMLElement): void {
  win.classList.remove("docked", "dockFromLeft", "dockFromRight", "dockFromBelow", "dockFromAbove");
  win.style.left = "";
  win.style.top = "";
  win.style.maxHeight = "";

  const pressed = lastPress && performance.now() - lastPress.time < PRESS_MS ? lastPress.target : null;
  const other = pressed?.closest<HTMLElement>(".modal.docked") ?? null;
  const replacing = other !== null && other !== win ? other : null;
  const home = win.dataset.anchor ? win.ownerDocument.getElementById(win.dataset.anchor) : null;
  const card = replacing ? null : pressed?.closest(`#miscButtons .miscButton, ${CARDS}`) ?? (home && visible(home) ? home : null);
  if (!replacing && !card) return;

  win.classList.add("docked");
  const view = { width: window.innerWidth, height: window.innerHeight };
  win.style.maxHeight = `${view.height - 2 * MARGIN_PX}px`;
  const size = win.getBoundingClientRect();
  // The window being replaced is on its way out, sliding: where it was put, not where its exit animation has it now
  const beside = replacing
    ? { left: parseFloat(replacing.style.left), top: parseFloat(replacing.style.top), width: replacing.offsetWidth,
      height: replacing.offsetHeight }
    : anchorBox(card!);
  const place = replacing
    ? replacingPosition(beside, replacing.classList.contains("dockFromRight") ? "right"
      : replacing.classList.contains("dockFromBelow") ? "below" : replacing.classList.contains("dockFromAbove") ? "above"
      : "left", size, view)
    : besidePosition(beside, size, view);
  const fit = clearOfHud(place.left, place.top, size, view, hudBoxes(win));
  win.style.left = `${place.left}px`;
  win.style.top = `${fit.top}px`;
  win.style.maxHeight = `${fit.maxHeight}px`;
  // (one under the top bar keeps to its place below it as it grows)
  win.dataset.wantedTop = String(place.from === "above" ? place.top : Math.round(beside.top));
  win.classList.add(place.from === "left" ? "dockFromLeft" : place.from === "right" ? "dockFromRight"
    : place.from === "above" ? "dockFromAbove" : "dockFromBelow");
  keepFitted(win);
}
