/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Recent city news: the news bar shows one item at a time and hides it after 30 seconds, so this keeps the last
// items with their game date, and they are saved with the city. The "News" button by the bar opens the list; an
// item with a place takes the view there. Words are looked up when shown, so a language switch changes them too.
// Only reads the city.

import { formatYear, onLanguageChange, t } from "./i18n/index";
import { hide, isShown, show } from "./motion";

export type NewsKind = "good" | "bad" | "neutral";

export interface NewsItem {
  kind: NewsKind;
  subject: string;
  month: number;
  year: number;
  x: number | null;
  y: number | null;
}

export const NEWS_LIMIT = 20;

/**
 * Newest first, at most NEWS_LIMIT. The same news again in the same month is not repeated: the list comes back
 * unchanged (the same array).
 */
export function addNews(items: readonly NewsItem[], item: NewsItem): readonly NewsItem[] {
  const latest = items[0];
  if (latest && latest.subject === item.subject && latest.month === item.month && latest.year === item.year) return items;
  return [item, ...items].slice(0, NEWS_LIMIT);
}

const KINDS: readonly NewsKind[] = ["good", "bad", "neutral"];

const isCoordinate = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);

/** The news saved with a city, keeping only well-formed items whose message still has words (known(subject)). */
export function parseNews(saved: unknown, known: (subject: string) => boolean): NewsItem[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((item): item is NewsItem => typeof item === "object" && item !== null &&
      KINDS.includes(item.kind) && typeof item.subject === "string" && known(item.subject) &&
      Number.isInteger(item.month) && item.month >= 0 && item.month < 12 && Number.isInteger(item.year) &&
      isCoordinate(item.x) && isCoordinate(item.y) && (item.x === null) === (item.y === null))
    .slice(0, NEWS_LIMIT)
    .map(({ kind, subject, month, year, x, y }) => ({ kind, subject, month, year, x, y }));
}

export interface NewsLogSetup {
  date(): { month: number; year: number };
  /** The text of a message subject, in the current language (src/text.js messageText), or undefined. */
  text(subject: string): string | undefined;
  /** The name of a month 0–11, in the current language. */
  monthName(month: number): string;
  centreOn(x: number, y: number): void;
  /** The news saved with this city, if any; it counts as read. */
  saved?: unknown;
}

export interface NewsLog {
  add(kind: NewsKind, subject: string, x?: number, y?: number): void;
  /** For the save. */
  items(): NewsItem[];
}

export function installNewsLog(setup: NewsLogSetup, doc: Document = document): NewsLog {
  let items: readonly NewsItem[] = parseNews(setup.saved, (subject) => Boolean(setup.text(subject)));
  let unread = 0;
  const button = doc.getElementById("newsLogButton");
  const panel = doc.getElementById("newsLog");
  const list = doc.getElementById("newsLogList");
  if (!button || !panel || !list) return { add() { /* no news panel on this page */ }, items: () => [...items] };

  const renderButton = (): void => {
    button.textContent = unread > 0 ? t("news.button_unread", { count: unread }) : t("news.button");
  };

  const renderList = (): void => {
    if (items.length === 0) {
      const empty = doc.createElement("li");
      empty.className = "newsEmpty";
      empty.textContent = t("news.empty");
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...items.map((item) => {
      const li = doc.createElement("li");
      li.className = `news ${item.kind}`;
      const when = doc.createElement("span");
      when.className = "newsDate";
      when.textContent = t("infobar.date", { month: setup.monthName(item.month), year: formatYear(item.year) });
      const what = doc.createElement("span");
      what.className = "newsText";
      what.textContent = setup.text(item.subject) ?? item.subject;
      li.append(when, what);
      if (item.x !== null && item.y !== null) {
        const go = doc.createElement("button");
        go.type = "button";
        go.className = "newsGo";
        go.textContent = t("news.goto");
        const { x, y } = item;
        go.addEventListener("click", () => {
          setup.centreOn(x, y as number);
          hide(panel, true);
        });
        li.append(go);
      }
      return li;
    }));
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isShown(panel)) {
      hide(panel, true);
      return;
    }
    unread = 0;
    renderButton();
    renderList();
    show(panel);
  });
  // Clicking anywhere else closes it, like the other cards
  doc.addEventListener("click", (event) => {
    if (isShown(panel) && !panel.contains(event.target as Node)) hide(panel, true);
  });
  onLanguageChange(() => {
    renderButton();
    if (isShown(panel)) renderList();
  });
  renderButton();

  return {
    add(kind, subject, x, y) {
      const { month, year } = setup.date();
      const next = addNews(items, { kind, subject, month, year, x: x ?? null, y: y ?? null });
      if (next === items) return;
      items = next;
      if (isShown(panel)) renderList();
      else unread = Math.min(unread + 1, NEWS_LIMIT);
      renderButton();
    },
    items: () => [...items],
  };
}
