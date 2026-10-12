/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { addNews, NEWS_LIMIT, NewsItem, parseNews } from "../src/newsLog";

const item = (subject: string, month = 3, year = 1902): NewsItem => ({ kind: "bad", subject, month, year, x: null, y: null });

describe("news log", () => {
  test("keeps the newest first, at most NEWS_LIMIT", () => {
    let items: readonly NewsItem[] = [];
    for (let i = 0; i < NEWS_LIMIT + 5; i++) items = addNews(items, item(`news ${i}`, i % 12));
    expect(items).toHaveLength(NEWS_LIMIT);
    expect(items[0].subject).toBe(`news ${NEWS_LIMIT + 4}`);
  });

  test("does not repeat the same news within a month, but does a month later", () => {
    const once = addNews([], item("Fire!"));
    expect(addNews(once, item("Fire!"))).toBe(once); // unchanged, the same list
    expect(addNews(once, item("Fire!", 4))).toHaveLength(2);
    expect(addNews(once, item("Flooding reported"))).toHaveLength(2);
  });

  test("comes back from a save, dropping anything malformed or no longer known", () => {
    const known = (subject: string) => subject !== "Gone";
    const good = { kind: "good", subject: "Town", month: 0, year: 1910, x: null, y: null };
    const placed = { kind: "bad", subject: "Fire!", month: 11, year: 1911, x: 40, y: 7, extra: "dropped" };
    const saved = [
      good, placed,
      { ...good, kind: "awful" }, { ...good, subject: 3 }, { ...good, subject: "Gone" }, { ...good, month: 12 },
      { ...good, year: "1910" }, { ...good, x: 5 }, { ...good, x: -1, y: 2 }, null, "news",
    ];
    expect(parseNews(saved, known)).toEqual([good, { kind: "bad", subject: "Fire!", month: 11, year: 1911, x: 40, y: 7 }]);
    expect(parseNews(Array.from({ length: 30 }, () => good), known)).toHaveLength(NEWS_LIMIT);
    for (const nothing of [undefined, null, {}, "x", 4]) expect(parseNews(nothing, known)).toEqual([]);
  });

  test("has its words in both languages", () => {
    for (const key of ["news.button", "news.button_unread", "news.title", "news.empty", "news.goto"]) expect(hasKey(key)).toBe(true);
  });
});
