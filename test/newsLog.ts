/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { addNews, NEWS_LIMIT, NewsItem } from "../src/newsLog";

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

  test("has its words in both languages", () => {
    for (const key of ["news.button", "news.button_unread", "news.title", "news.empty", "news.goto"]) expect(hasKey(key)).toBe(true);
  });
});
