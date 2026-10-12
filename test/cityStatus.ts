/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { demandPercent, formatPercent, statusMoney, zonePeople } from "../src/cityStatus";

describe("the city's status", () => {
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
