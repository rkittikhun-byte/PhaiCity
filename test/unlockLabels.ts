/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the player reads about a locked tool (src/unlockLabels.ts, docs/GAME_DESIGN.md 6.2): the unlock table's reason in
// plain words, in both languages, and what the next era brings for the era card.

import { hasKey, setLanguage } from "../src/i18n/index";
import { TRAINED_KINDS } from "../src/trainedPeople";
import { lockedTitle, lockOf, lockText, unlockNames } from "../src/unlockLabels";
import { eraUnlocks, NEEDS, UNLOCKS } from "../src/unlocks";

describe("the words of a locked tool", () => {
  afterEach(() => setLanguage("th"));

  test("say why, as the owner asked: the trained people with how many now, or the era by its name", () => {
    setLanguage("th");
    expect(lockText({ reason: "unlock.trained", params: { kind: "engineer", need: 200, have: 35 } })).toBe("ต้องมีวิศวกร 200 คน (ตอนนี้ 35)");
    expect(lockText({ reason: "unlock.era", params: { era: 4 } })).toBe("ต้องเข้ายุคเมืองสมัยใหม่");
    expect(lockText({ reason: "unlock.first", params: { need: "power_plant" } })).toBe("ต้องมีโรงไฟฟ้าก่อน");
    expect(lockText({ reason: "unlock.limit", params: { count: 1, era: 2 } })).toContain("1");
    setLanguage("en");
    expect(lockText({ reason: "unlock.trained", params: { kind: "nurse", need: 10, have: 0 } })).toBe("Needs 10 nurses (now 0)");
    expect(lockText({ reason: "unlock.era", params: { era: 2 } })).toBe("Needs the Market town era");
    expect(lockedTitle("solar", { reason: "unlock.era", params: { era: 4 } })).toMatch(/: Needs the Modern city era$/);
  });

  test("every reason, kind and need has its words, and a refused command reads back as its lock", () => {
    for (const kind of TRAINED_KINDS) expect(hasKey(`trained.${kind}`)).toBe(true);
    for (const need of NEEDS) expect(hasKey(`unlock.need.${need}`)).toBe(true);
    for (const row of Object.values(UNLOCKS)) {
      for (const need of row.first ?? []) expect(hasKey(`unlock.need.${need}`) || hasKey(`tool.${need}`)).toBe(true);
    }
    expect(lockOf({ reason: "unlock.era", detail: { era: 3 } })).toEqual({ reason: "unlock.era", params: { era: 3 } });
    expect(lockOf({ reason: "outside the province" })).toBeNull();
  });

  test("the era card names what each era brings, each once", () => {
    for (const era of [2, 3, 4, 5] as const) {
      const names = unlockNames(eraUnlocks(era));
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((name) => name.trim().length > 0)).toBe(true);
    }
  });
});
