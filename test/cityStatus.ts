/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { demandPercent, formatPercent, homesHeldBack, statusMoney, zonePeople } from "../src/cityStatus";

describe("the city's status", () => {
  // Playtest, 23 Oct 2026: a new village of homes alone fell to −100% within two years, people left, nothing said why
  test("says in a word why the homes lose people: jobs first, as the demand reads them, then water, then power", () => {
    expect(homesHeldBack({ resPop: 0, comPop: 0, indPop: 0 })).toBeNull();
    // 30 people (resPop 1.5) and no shop or factory: no jobs, whatever the water
    expect(homesHeldBack({ resPop: 1.5, comPop: 0, indPop: 0, dryZoneCount: 2 })).toBe("jobs");
    // places enough for resPop / 8 of workers: then the dry homes
    expect(homesHeldBack({ resPop: 8, comPop: 0.5, indPop: 0.5, dryZoneCount: 0.5 })).toBe("water");
    expect(homesHeldBack({ resPop: 8, comPop: 1, indPop: 0, unpoweredZoneCount: 1 })).toBe("power");
    expect(homesHeldBack({ resPop: 8, comPop: 1, indPop: 1 })).toBeNull();
    for (const why of ["jobs", "water", "power"]) {
      expect(hasKey(`status.why.${why}`) && hasKey(`status.why_title.${why}`)).toBe(true);
    }
  });

  test("shows the demand as a percentage of the most it can want", () => {
    expect(demandPercent(2000)).toBe(100);
    expect(demandPercent(-2000)).toBe(-100);
    expect(demandPercent(800)).toBe(40);
    expect(demandPercent(-5000)).toBe(-100);
    expect([formatPercent(40), formatPercent(-10), formatPercent(0)]).toEqual(["+40%", "−10%", "0%"]);
  });

  test("splits the population into people at home, in shops and in factories, adding up to the game's figure", () => {
    const census = { resPop: 37, comPop: 4, indPop: 9 };
    const people = zonePeople(census);
    expect(people).toEqual({ residential: 740, commercial: 640, industrial: 1440 });
    // src/evaluation.js: (resPop + (comPop + indPop) * 8) * 20
    expect(people.residential + people.commercial + people.industrial).toBe((37 + (4 + 9) * 8) * 20);
  });

  test("writes money with thousands", () => {
    expect(statusMoney("16295")).toBe("฿16,295");
    expect(statusMoney("")).toBe("");
  });

  test("has its topics in both languages", () => {
    for (const key of ["status.city", "status.date", "status.funds", "status.population", "status.residential",
      "status.commercial", "status.industrial", "status.people"]) expect(hasKey(key)).toBe(true);
  });
});
