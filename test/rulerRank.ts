/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Evaluation } from "../src/evaluation.js";
import { hasKey, setLanguage, t } from "../src/i18n/index";
import { isRank, keepHigherRank, RANKS, rankForCityClass, rankForPopulation } from "../src/rulerRank";

const evaluation = Evaluation as unknown as Record<string, string> & { prototype: { getCityClass(population: number): string } };

describe("ruler ranks", () => {
  test("follow the game's city classes, from หมื่น to เจ้าพระยา", () => {
    const classes = ["CC_VILLAGE", "CC_TOWN", "CC_CITY", "CC_CAPITAL", "CC_METROPOLIS", "CC_MEGALOPOLIS"].map((name) => evaluation[name]);
    expect(classes.map(rankForCityClass)).toEqual([...RANKS]);
    expect(rankForCityClass("SOMETHING ELSE")).toBe("muen");
  });

  test("use the same population thresholds as the game", () => {
    const getCityClass = evaluation.prototype.getCityClass;
    for (const population of [0, 2000, 2001, 10000, 10001, 50001, 100001, 500000, 500001, 2000000]) {
      const cityClass = getCityClass.call({ cityClass: null, cityClassLast: null, _emitEvent: () => undefined }, population);
      expect({ population, rank: rankForPopulation(population) }).toEqual({ population, rank: rankForCityClass(cityClass) });
    }
  });

  test("are never taken away", () => {
    expect(keepHigherRank("phra", "khun")).toBe("phra");
    expect(keepHigherRank("khun", "phra")).toBe("phra");
    expect(keepHigherRank(undefined, "luang")).toBe("luang"); // a save from before ranks
    expect(keepHigherRank("general", "muen")).toBe("muen");
    expect(isRank("chaophraya")).toBe(true);
    expect(isRank("governor")).toBe(false);
  });

  test("have a name in both languages", () => {
    for (const rank of RANKS) expect({ rank, ok: hasKey(`rank.${rank}`) }).toEqual({ rank, ok: true });
    setLanguage("th");
    expect(t("rank.label", { rank: t("rank.khun") })).toBe("ยศขุน");
    setLanguage("en");
    expect(t("rank.label", { rank: t("rank.chaophraya") })).toBe("Rank: Chao Phraya");
    setLanguage("th");
  });
});
